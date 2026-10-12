import React, { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { useStore } from '../store';
import { Badge, Banner, Btn, Card, askConfirm, confirmAction, FormModal, H2, Muted, notify, Page, Row, T, theme } from '../ui/kit.tsx';
import { useDocFiles } from '../docs';
import { ApiError, DEFAULT_API, api, fetchData, putData, putFileCloud } from '../cloud';
import { exportText, readBytes as localRead, requestPersistence, writeBytes as localWrite } from '../files';
import { fromB64, makeBackup, parseBackup } from '../backup.ts';
import { emptyData } from '../domain/types.ts';
import type { Data } from '../domain/types.ts';

const input = { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, fontSize: 15, color: theme.text, backgroundColor: '#fff' } as const;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error');

export default function Configuracion() {
  const st = useStore();
  const { mode, data, session, sync } = st;
  const files = useDocFiles();
  const [url, setUrl] = useState(session?.apiUrl ?? DEFAULT_API);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [wsName, setWsName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [audit, setAudit] = useState<{ action: string; detail: string; at: string }[]>([]);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isOwnerCloud = mode === 'cloud' && session && st.role === 'propietario';

  useEffect(() => {
    if (!isOwnerCloud || !session) return;
    api(session.apiUrl, session.token, 'GET', `/ws/${session.workspaceId}/audit`).then(r => setAudit(r.slice(0, 15))).catch(() => {});
  }, [isOwnerCloud, session?.workspaceId]);

  const run = async (f: () => Promise<void>) => { setBusy(true); try { await f(); } catch (e) { notify(errMsg(e)); } finally { setBusy(false); } };

  const migrate = () => run(async () => {
    if (!session) return;
    const raw = await AsyncStorage.getItem('canville:data:v1');
    const local: Data = { ...emptyData(), ...(raw ? JSON.parse(raw) : {}) };
    if (local.clients.length + local.docs.length + local.movements.length === 0) throw new Error('No hay datos locales para subir.');
    const remote = await fetchData(session);
    const d = remote.data;
    if (d.clients.length + d.docs.length + d.movements.length > 0) throw new Error('El espacio en la nube ya tiene datos. Para no mezclar ni sobrescribir, usa un espacio vacío (otra cuenta/espacio).');
    let missing = 0;
    for (const doc of local.docs) {
      const bytes = await localRead(doc.fileKey).catch(() => null);
      if (!bytes) { missing++; continue; }
      await putFileCloud(session, doc.fileKey, bytes, doc.name, doc.mime);
    }
    await putData(session, remote.rev, local);
    await st.enterCloud();
    notify(`Datos subidos a la nube.${missing ? ` ${missing} archivo(s) no se encontraron en este dispositivo y quedaron sin contenido.` : ''} Tus datos locales se conservan en este dispositivo.`);
  });

  const exportBackup = () => run(async () => {
    const { json, missing } = await makeBackup(data, k => files.readBytes(k));
    await exportText(`canville-respaldo-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json');
    if (missing.length) notify(`Respaldo creado, pero ${missing.length} archivo(s) no estaban disponibles: ${missing.slice(0, 5).join(', ')}`);
  });

  const restoreBackup = () => run(async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    const b = parseBackup(await (await fetch(r.assets[0].uri)).text());
    confirmAction(`Se reemplazarán los datos actuales por el respaldo del ${b.exportedAt.slice(0, 10)} (${b.data.clients.length} clientes, ${b.data.docs.length} documentos). ¿Continuar?`, () => {
      run(async () => {
        for (const f of b.files) {
          const bytes = fromB64(f.b64);
          if (session && mode === 'cloud') await putFileCloud(session, f.key, bytes, f.name, f.mime); else await localWrite(f.key, bytes);
        }
        st.replaceData(b.data);
        notify('Respaldo restaurado.');
      });
    });
  });

  return (
    <Page title="Configuración">
      <Card>
        <H2>Modo de trabajo</H2>
        <Row><T>Modo actual</T><Badge tone={mode === 'demo' ? 'warn' : 'ok'} label={mode === 'demo' ? 'Demostración' : mode === 'local' ? 'Este dispositivo' : 'Nube'} /></Row>
        {mode === 'demo' && <Muted>Los datos de demostración existen solo en memoria y no se guardan ni se suben.</Muted>}
        {mode !== 'local' && <Btn kind="ghost" label="Trabajar en este dispositivo" onPress={() => confirmAction('Se abrirá tu espacio en este dispositivo (vacío si es la primera vez). ¿Continuar?', () => { st.startLocal(); })} />}
        {mode !== 'demo' && <Btn kind="ghost" label="Ver demostración" onPress={() => confirmAction('Volverás a la demostración. Tus datos no se borran.', st.backToDemo)} />}
        {session && mode !== 'cloud' && <Btn kind="ghost" label="Usar la nube" onPress={() => run(st.enterCloud)} />}
        {mode === 'local' && <Muted>Los datos se guardan solo en este dispositivo y no se sincronizan.</Muted>}
      </Card>

      <Card>
        <H2>Cuenta en la nube</H2>
        {session ? (
          <>
            <Row><T>{session.email}</T><Badge tone={sync.state === 'error' ? 'bad' : 'ok'} label={sync.state === 'saving' ? 'Guardando…' : sync.state === 'error' ? 'Error de conexión' : 'Sincronizado'} /></Row>
            {sync.message ? <Muted style={{ color: theme.bad }}>{sync.message}</Muted> : null}
            {sync.lastSync ? <Muted>Última consulta: {sync.lastSync.slice(11, 19)} UTC · los cambios de otros se consultan cada 15 s (sin transmisión instantánea).</Muted> : null}
            {session.memberships.length > 1 && (
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {session.memberships.map(m => <Btn key={m.workspaceId} small kind={m.workspaceId === session.workspaceId ? 'primary' : 'ghost'} label={`${m.name} (${m.role})`} onPress={() => run(() => st.switchWorkspace(m.workspaceId))} />)}
              </View>
            )}
            {mode === 'cloud' && st.role === 'propietario' && <Btn small kind="ghost" label="Subir los datos de este dispositivo a la nube" disabled={busy} onPress={() => confirmAction('Se copiarán a un espacio vacío en la nube tus datos y archivos locales. Los datos de demostración nunca se suben. ¿Continuar?', () => { migrate(); })} />}
            <Row>
              <Btn small kind="ghost" label="Consultar ahora" onPress={() => run(st.refresh)} />
              <Btn small kind="danger" label="Cerrar sesión" onPress={() => confirmAction('¿Cerrar sesión en este dispositivo?', () => { st.logout(); })} />
            </Row>
            <Btn small kind="danger" label="Eliminar mi cuenta y mis datos" onPress={() => setDeleting(true)} />
            {st.role === 'cliente' && <Muted>Eres cliente del portal: ves solo tu expediente y puedes subir documentos.</Muted>}
            <Muted>Código de invitación recibido:</Muted>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="CÓDIGO" style={[input, { flex: 1 }]} />
              <Btn small label="Aceptar" disabled={!code.trim() || busy} onPress={() => run(async () => { await st.acceptInvite(code.trim()); setCode(''); })} />
            </View>
          </>
        ) : (
          <>
            <Muted>Con una cuenta tus datos viven en el servidor (con respaldo), puedes usar varios dispositivos y compartir un portal con tus clientes.</Muted>
            <T>Dirección del servidor</T>
            <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" placeholder="https://api.tudominio.com" style={input} />
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Correo" style={input} />
            <TextInput value={pw} onChangeText={setPw} secureTextEntry placeholder="Contraseña (mínimo 10 caracteres)" style={input} />
            <Btn label="Iniciar sesión" disabled={busy || !url || !email || !pw} onPress={() => run(() => st.login(url, email.trim(), pw))} />
            <Muted>¿Primera vez? Crea la cuenta de tu despacho:</Muted>
            <TextInput value={wsName} onChangeText={setWsName} placeholder="Nombre del despacho" style={input} />
            <Btn kind="ghost" label="Crear cuenta de despacho" disabled={busy || !url || !email || pw.length < 10} onPress={() => run(() => st.register(url, email.trim(), pw, wsName.trim() || 'Mi despacho'))} />
            <Muted>¿Eres cliente y tienes un código de invitación?</Muted>
            <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="Código de invitación" style={input} />
            <Btn kind="ghost" label="Crear mi cuenta con código" disabled={busy || !url || !email || pw.length < 10 || !code.trim()} onPress={() => run(() => st.register(url, email.trim(), pw, '', code.trim()))} />
          </>
        )}
      </Card>

      <Card>
        <H2>Respaldo y protección de datos</H2>
        {mode === 'local' && <Banner tone="warn">Los datos de este modo viven solo en el dispositivo. Si se borra el almacenamiento del navegador o se desinstala la app, se pierden. Descarga respaldos con frecuencia o usa la nube.</Banner>}
        {mode === 'cloud' && <Muted>En la nube los archivos se eliminan físicamente del servidor al borrarlos. El servidor guarda una bitácora de accesos. El operador del servidor debe respaldar la carpeta de datos (ver server/README.md).</Muted>}
        {mode !== 'demo' && st.role === 'propietario' && <>
          <Btn kind="ghost" label="Descargar respaldo completo (datos + archivos)" disabled={busy} onPress={exportBackup} />
          <Btn kind="ghost" label="Restaurar desde un respaldo" disabled={busy} onPress={restoreBackup} />
        </>}
        {mode === 'demo' && <Muted>Cambia a «este dispositivo» o a la nube para respaldar datos reales.</Muted>}
        <Btn small kind="ghost" label="Pedir al navegador que proteja este almacenamiento" onPress={async () => setPersisted(await requestPersistence())} />
        {persisted !== null && <Muted>{persisted ? 'Almacenamiento protegido: el navegador no debería borrarlo por falta de espacio.' : 'El navegador no concedió protección permanente; mantén respaldos.'}</Muted>}
        {mode === 'local' && <Btn kind="danger" label="Borrar todos los datos de este dispositivo" onPress={() => confirmAction('Se borrarán clientes, documentos y registros de este dispositivo. No se puede deshacer. ¿Descargaste un respaldo?', async () => {
          for (const d of data.docs) await files.deleteFileOnly(d);
          st.resetLocal();
        })} />}
      </Card>

      {isOwnerCloud && (
        <Card>
          <H2>Bitácora reciente</H2>
          {audit.length === 0 && <Muted>Sin eventos.</Muted>}
          {audit.map((a, i) => <Row key={i}><T>{a.action}</T><Muted>{a.detail} · {a.at.slice(0, 16).replace('T', ' ')}</Muted></Row>)}
        </Card>
      )}
      {deleting && session && (
        <FormModal title="Eliminar cuenta y datos" fields={[{ key: 'password', label: 'Confirma tu contraseña', required: true }]} initial={{}} onClose={() => setDeleting(false)}
          extra={<Muted style={{ marginTop: 10 }}>Se eliminará tu cuenta y tu acceso. Si eres propietario, también se borrarán de forma definitiva los espacios que posees: clientes, registros y archivos. Se conserva únicamente una bitácora sin datos personales. Si debes conservar información por obligaciones legales, descarga un respaldo antes. Esta acción no se puede deshacer.</Muted>}
          onSubmit={async v => {
            const call = (confirmOwned: boolean) => api(session.apiUrl, session.token, 'DELETE', '/me', { password: v.password, deleteOwnedWorkspaces: confirmOwned });
            try { await call(false); }
            catch (e) {
              if (e instanceof ApiError && e.status === 409) {
                const ok = await askConfirm(`${e.message}\n\n¿Eliminar definitivamente?`);
                if (!ok) throw new Error('Eliminación cancelada');
                await call(true);
              } else throw e;
            }
            setDeleting(false); await st.logout(); notify('Tu cuenta y tus datos en la nube fueron eliminados.');
          }} />
      )}
      <Banner tone="warn">Esta aplicación no sustituye la asesoría de un contador ni garantiza certeza jurídica o contable.</Banner>
    </Page>
  );
}
