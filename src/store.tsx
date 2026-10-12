import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Data, Mode, emptyData } from './domain/types.ts';
import { ClientModule, DEFAULT_CLIENT_MODULES, clientView } from './domain/permissions.ts';
import { demoData } from './seed.ts';
import { ApiError, Membership, Session, api, fetchData, normalizeUrl, putData } from './cloud';
import { secureDel, secureGet, secureSet } from './secure';

const K_DATA = 'canville:data:v1';
const K_MODE = 'canville:mode:v1';
const K_SESSION = 'canville:session:v1';
const POLL_MS = 15000;
const SAVE_DEBOUNCE_MS = 700;

export type Role = 'propietario' | 'cliente';
export type SyncState = 'idle' | 'saving' | 'error';
type Collections = { [K in keyof Data]: Data[K] extends (infer T)[] ? T : never };

export type Ctx = {
  ready: boolean;
  mode: Mode;
  data: Data;                       // datos del modo actual (en nube de cliente: ya filtrados por el servidor)
  view: Data;                       // lo que se muestra (vista previa de cliente filtra localmente)
  role: Role;
  activeClientId: string;           // cliente del portal (real o en vista previa)
  modules: ClientModule[] | null;   // módulos autorizados al cliente (null = propietario: todos)
  readOnly: boolean;
  previewClientId: string;
  setPreviewClientId: (id: string) => void;
  session: Session | null;
  sync: { state: SyncState; message: string; lastSync: string };
  notice: string; clearNotice: () => void;
  startLocal: () => Promise<void>;
  backToDemo: () => void;
  resetLocal: () => void;
  replaceData: (d: Data) => void;   // restaurar respaldo
  login: (apiUrl: string, email: string, password: string) => Promise<void>;
  register: (apiUrl: string, email: string, password: string, workspaceName: string, inviteCode?: string) => Promise<void>;
  acceptInvite: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (id: string) => Promise<void>;
  enterCloud: () => Promise<void>;
  refresh: () => Promise<void>;
  upsert: <K extends keyof Data>(col: K, item: Collections[K], match: (x: Collections[K]) => boolean) => void;
  remove: <K extends keyof Data>(col: K, match: (x: Collections[K]) => boolean) => void;
  add: <K extends keyof Data>(col: K, items: Collections[K][]) => void;
};

const C = createContext<Ctx>(null as never);
export const useStore = () => useContext(C);
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>('demo');
  const [data, setData] = useState<Data>(demoData);
  const [previewClientId, setPreviewClientId] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [cloudRole, setCloudRole] = useState<Role>('propietario');
  const [cloudClientId, setCloudClientId] = useState('');
  const [cloudModules, setCloudModules] = useState<ClientModule[] | null>(null);
  const [sync, setSync] = useState<Ctx['sync']>({ state: 'idle', message: '', lastSync: '' });
  const [notice, setNotice] = useState('');

  const loaded = useRef(false);
  const dataRef = useRef(data); dataRef.current = data;
  const modeRef = useRef(mode); modeRef.current = mode;
  const sessionRef = useRef(session); sessionRef.current = session;
  const roleRef = useRef(cloudRole); roleRef.current = cloudRole;
  const revRef = useRef(0);
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readOnlyCloud = mode === 'cloud' && cloudRole === 'cliente';

  // ---------- nube ----------
  const loadCloud = useCallback(async (s: Session) => {
    const r = await fetchData(s);
    revRef.current = r.rev; dirty.current = false;
    setData({ ...emptyData(), ...r.data }); setCloudRole(r.role); setCloudClientId(r.clientId); setCloudModules(r.modules ?? null);
    setSync({ state: 'idle', message: '', lastSync: new Date().toISOString() });
  }, []);

  const flush = useCallback(async () => {
    const s = sessionRef.current;
    if (modeRef.current !== 'cloud' || !s || roleRef.current !== 'propietario' || saving.current || !dirty.current) return;
    saving.current = true; setSync(x => ({ ...x, state: 'saving', message: '' }));
    try {
      while (dirty.current) {
        dirty.current = false;
        const snapshot = dataRef.current;
        try {
          const r = await putData(s, revRef.current, snapshot);
          revRef.current = r.rev;
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) {
            // Otro dispositivo guardó antes: se recarga lo más reciente y se avisa (no se pisa nada en silencio).
            await loadCloud(s);
            setNotice('Otro usuario o dispositivo guardó cambios antes. Se cargó la versión más reciente; repite tu último cambio si no lo ves.');
            return;
          }
          dirty.current = true; throw e;
        }
      }
      setSync({ state: 'idle', message: '', lastSync: new Date().toISOString() });
    } catch (e) {
      setSync(x => ({ ...x, state: 'error', message: e instanceof Error ? e.message : 'No se pudo guardar' }));
    } finally { saving.current = false; }
  }, [loadCloud]);

  const markDirty = useCallback(() => {
    if (modeRef.current !== 'cloud') return;
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [flush]);

  const refresh = useCallback(async () => {
    const s = sessionRef.current;
    if (modeRef.current !== 'cloud' || !s) return;
    try { await loadCloud(s); } catch (e) { setSync(x => ({ ...x, state: 'error', message: e instanceof Error ? e.message : 'Sin conexión' })); }
  }, [loadCloud]);

  // Consulta de cambios colaborativos cada 15 s (sondeo; no hay transmisión instantánea).
  useEffect(() => {
    if (mode !== 'cloud' || !session) return;
    const t = setInterval(async () => {
      if (dirty.current || saving.current) return;
      try {
        const r = await fetchData(session);
        if (r.rev !== revRef.current && !dirty.current && !saving.current) {
          revRef.current = r.rev; setData({ ...emptyData(), ...r.data }); setCloudModules(r.modules ?? null);
        }
        setSync(x => (x.state === 'error' ? { state: 'idle', message: '', lastSync: new Date().toISOString() } : { ...x, lastSync: new Date().toISOString() }));
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) { setNotice('Tu sesión venció. Vuelve a iniciar sesión.'); await doLogout(false); }
        else setSync(x => ({ ...x, state: 'error', message: 'Sin conexión con el servidor' }));
      }
    }, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, session]);

  // ---------- arranque ----------
  useEffect(() => {
    (async () => {
      try {
        const m = await AsyncStorage.getItem(K_MODE);
        const raw = await secureGet(K_SESSION);
        if (m === 'cloud' && raw) {
          const s: Session = JSON.parse(raw);
          setSession(s); setMode('cloud'); modeRef.current = 'cloud'; sessionRef.current = s;
          try { await loadCloud(s); } catch (e) {
            if (e instanceof ApiError && e.status === 401) { await secureDel(K_SESSION); setSession(null); setMode('demo'); setNotice('Tu sesión venció. Vuelve a iniciar sesión.'); }
            else setSync({ state: 'error', message: 'Sin conexión con el servidor', lastSync: '' });
          }
        } else if (m === 'local') {
          const d = await AsyncStorage.getItem(K_DATA);
          setData({ ...emptyData(), ...(d ? JSON.parse(d) : {}) });
          setMode('local');
          if (raw) setSession(JSON.parse(raw));
        } else if (raw) setSession(JSON.parse(raw));
      } catch { /* arranca en demostración */ }
      loaded.current = true;
      setReady(true);
    })();
  }, [loadCloud]);

  // La demostración y la nube nunca escriben en el almacenamiento local de datos.
  useEffect(() => {
    if (!loaded.current || mode !== 'local') return;
    AsyncStorage.setItem(K_DATA, JSON.stringify(data)).catch(() => {});
  }, [data, mode]);

  // ---------- modos ----------
  const startLocal = useCallback(async () => {
    let next = emptyData();
    try {
      const raw = await AsyncStorage.getItem(K_DATA);
      if (raw) next = { ...next, ...JSON.parse(raw) };
      else await AsyncStorage.setItem(K_DATA, JSON.stringify(next));
      await AsyncStorage.setItem(K_MODE, 'local');
    } catch { /* en memoria */ }
    setData(next); setMode('local'); setPreviewClientId('');
  }, []);
  const backToDemo = useCallback(() => {
    setData(demoData()); setMode('demo'); setPreviewClientId('');
    AsyncStorage.setItem(K_MODE, 'demo').catch(() => {});
  }, []);
  const resetLocal = useCallback(() => { setData(emptyData()); setPreviewClientId(''); }, []);
  const replaceData = useCallback((d: Data) => { setData(d); markDirty(); }, [markDirty]);

  const adopt = useCallback(async (s: Session) => {
    await secureSet(K_SESSION, JSON.stringify(s));
    await AsyncStorage.setItem(K_MODE, 'cloud');
    sessionRef.current = s; modeRef.current = 'cloud';
    setSession(s); setMode('cloud'); setPreviewClientId('');
    await loadCloud(s);
  }, [loadCloud]);

  const pick = (ms: Membership[]) => ms.find(m => m.role === 'propietario') ?? ms[0];
  const finishAuth = useCallback(async (apiUrl: string, r: { token: string; email: string; memberships: Membership[] }) => {
    const m = pick(r.memberships);
    if (!m) throw new Error('Tu cuenta no tiene espacios asignados');
    await adopt({ apiUrl: normalizeUrl(apiUrl), token: r.token, email: r.email, memberships: r.memberships, workspaceId: m.workspaceId });
  }, [adopt]);

  const login = useCallback(async (apiUrl: string, email: string, password: string) => {
    await finishAuth(apiUrl, await api(apiUrl, undefined, 'POST', '/auth/login', { email, password }));
  }, [finishAuth]);
  const register = useCallback(async (apiUrl: string, email: string, password: string, workspaceName: string, inviteCode?: string) => {
    await finishAuth(apiUrl, await api(apiUrl, undefined, 'POST', '/auth/register', { email, password, workspaceName, inviteCode: inviteCode || undefined }));
  }, [finishAuth]);
  const acceptInvite = useCallback(async (code: string) => {
    const s = sessionRef.current; if (!s) throw new Error('Inicia sesión primero');
    const r = await api<{ memberships: Membership[] }>(s.apiUrl, s.token, 'POST', '/auth/accept', { inviteCode: code });
    const m = r.memberships.find(x => x.role === 'cliente') ?? pick(r.memberships);
    await adopt({ ...s, memberships: r.memberships, workspaceId: m.workspaceId });
  }, [adopt]);
  const switchWorkspace = useCallback(async (id: string) => {
    const s = sessionRef.current; if (!s) return;
    await adopt({ ...s, workspaceId: id });
  }, [adopt]);
  const enterCloud = useCallback(async () => {
    const s = sessionRef.current; if (!s) throw new Error('Inicia sesión primero');
    await adopt(s);
  }, [adopt]);

  const doLogout = useCallback(async (callServer: boolean) => {
    const s = sessionRef.current;
    if (callServer && s) await api(s.apiUrl, s.token, 'POST', '/auth/logout').catch(() => {});
    await secureDel(K_SESSION);
    if (timer.current) clearTimeout(timer.current);
    dirty.current = false; sessionRef.current = null;
    setSession(null); setCloudRole('propietario'); setCloudClientId(''); setCloudModules(null);
    const hasLocal = !!(await AsyncStorage.getItem(K_DATA).catch(() => null));
    if (hasLocal) await startLocal(); else backToDemo();
  }, [startLocal, backToDemo]);
  const logout = useCallback(() => doLogout(true), [doLogout]);

  // ---------- mutaciones ----------
  const guard = () => !(modeRef.current === 'cloud' && roleRef.current === 'cliente');
  const upsert: Ctx['upsert'] = useCallback((col, item, match) => {
    if (!guard()) return;
    setData(d => {
      const arr = d[col] as unknown as Collections[typeof col][];
      const i = arr.findIndex(match);
      return { ...d, [col]: i >= 0 ? arr.map((x, j) => (j === i ? item : x)) : [...arr, item] };
    });
    markDirty();
  }, [markDirty]);
  const remove: Ctx['remove'] = useCallback((col, match) => {
    if (!guard()) return;
    setData(d => ({ ...d, [col]: (d[col] as unknown as Collections[typeof col][]).filter(x => !match(x)) }));
    markDirty();
  }, [markDirty]);
  const add: Ctx['add'] = useCallback((col, items) => {
    if (!guard()) return;
    setData(d => ({ ...d, [col]: [...(d[col] as unknown as unknown[]), ...items] }));
    markDirty();
  }, [markDirty]);

  const role: Role = readOnlyCloud || previewClientId ? 'cliente' : 'propietario';
  const activeClientId = previewClientId || (readOnlyCloud ? cloudClientId : '');
  const view = useMemo(() => (previewClientId ? clientView(data, previewClientId, DEFAULT_CLIENT_MODULES) : data), [data, previewClientId]);
  const modules: ClientModule[] | null = previewClientId ? DEFAULT_CLIENT_MODULES : readOnlyCloud ? cloudModules ?? DEFAULT_CLIENT_MODULES : null;

  const value = useMemo<Ctx>(() => ({
    ready, mode, data, view, role, activeClientId, modules, readOnly: readOnlyCloud, previewClientId, setPreviewClientId, session, sync,
    notice, clearNotice: () => setNotice(''),
    startLocal, backToDemo, resetLocal, replaceData, login, register, acceptInvite, logout, switchWorkspace, enterCloud, refresh, upsert, remove, add,
  }), [ready, mode, data, view, role, activeClientId, modules, readOnlyCloud, previewClientId, session, sync, notice, startLocal, backToDemo, resetLocal, replaceData, login, register, acceptInvite, logout, switchWorkspace, enterCloud, refresh, upsert, remove, add]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
