import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Data, Mode, emptyData } from './domain/types.ts';
import { clientView } from './domain/permissions.ts';
import { demoData } from './seed.ts';

const K_DATA = 'canville:data:v1';
const K_MODE = 'canville:mode:v1';

type Collections = { [K in keyof Data]: Data[K] extends (infer T)[] ? T : never };
export type Ctx = {
  ready: boolean;
  mode: Mode;
  data: Data;                 // datos reales del modo actual
  view: Data;                 // lo que ve el usuario actual (cliente en vista previa ve solo su expediente)
  previewClientId: string | '';
  setPreviewClientId: (id: string) => void;
  startLocal: () => Promise<void>;
  backToDemo: () => void;
  resetLocal: () => void;
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
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        if ((await AsyncStorage.getItem(K_MODE)) === 'local') {
          const raw = await AsyncStorage.getItem(K_DATA);
          setData({ ...emptyData(), ...(raw ? JSON.parse(raw) : {}) });
          setMode('local');
        }
      } catch { /* arranca en demostración */ }
      loaded.current = true;
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current || mode !== 'local') return; // la demostración nunca se guarda
    AsyncStorage.setItem(K_DATA, JSON.stringify(data)).catch(() => {});
  }, [data, mode]);

  const startLocal = useCallback(async () => {
    // Conserva los datos locales existentes; solo crea un espacio vacío si no hay ninguno.
    let next = emptyData();
    try {
      const raw = await AsyncStorage.getItem(K_DATA);
      if (raw) next = { ...next, ...JSON.parse(raw) };
      else await AsyncStorage.setItem(K_DATA, JSON.stringify(next));
      await AsyncStorage.setItem(K_MODE, 'local');
    } catch { /* si falla el almacenamiento, se trabaja en memoria */ }
    setData(next); setMode('local'); setPreviewClientId('');
  }, []);
  const backToDemo = useCallback(() => {
    setData(demoData()); setMode('demo'); setPreviewClientId('');
    AsyncStorage.setItem(K_MODE, 'demo').catch(() => {});
  }, []);
  const resetLocal = useCallback(() => { setData(emptyData()); setPreviewClientId(''); }, []);

  const upsert: Ctx['upsert'] = useCallback((col, item, match) => {
    setData(d => {
      const arr = d[col] as unknown as Collections[typeof col][];
      const i = arr.findIndex(match);
      const next = i >= 0 ? arr.map((x, j) => (j === i ? item : x)) : [...arr, item];
      return { ...d, [col]: next };
    });
  }, []);
  const remove: Ctx['remove'] = useCallback((col, match) => {
    setData(d => ({ ...d, [col]: (d[col] as unknown as Collections[typeof col][]).filter(x => !match(x)) }));
  }, []);
  const add: Ctx['add'] = useCallback((col, items) => {
    setData(d => ({ ...d, [col]: [...(d[col] as unknown as unknown[]), ...items] }));
  }, []);

  const view = useMemo(() => (previewClientId ? clientView(data, previewClientId) : data), [data, previewClientId]);
  const value = useMemo(() => ({ ready, mode, data, view, previewClientId, setPreviewClientId, startLocal, backToDemo, resetLocal, upsert, remove, add }),
    [ready, mode, data, view, previewClientId, startLocal, backToDemo, resetLocal, upsert, remove, add]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
