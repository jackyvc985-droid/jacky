import React, { useState } from 'react';
import { View } from 'react-native';
import { uid, useStore } from '../store.tsx';
import { Badge, Banner, Btn, Card, confirmAction, Empty, FormModal, H2, Muted, notify, Page, Row, T } from '../ui/kit.tsx';
import { Client, DOC_CATEGORIES } from '../domain/types.ts';
import { useDocFiles } from '../docs';
import { api } from '../cloud';
import { CLIENT_MODULES, ClientModule, DEFAULT_CLIENT_MODULES, MODULE_LABELS } from '../domain/permissions.ts';

const fields = [
  { key: 'name', label: 'Nombre o razón social', required: true },
  { key: 'rfc', label: 'RFC', hint: 'Necesario para reconocer sus recibos de nómina timbrados.' }, { key: 'email', label: 'Correo' }, { key: 'phone', label: 'Teléfono' },
  { key: 'status', label: 'Estado', type: 'select' as const, options: [{ value: 'Activo', label: 'Activo' }, { value: 'Inactivo', label: 'Inactivo' }] },
  { key: 'notes', label: 'Notas', type: 'multiline' as const },
];

export default function Clientes({ onOpenDocs, readOnly = false }: { onOpenDocs: (clientId: string) => void; readOnly?: boolean }) {
  const { data, upsert, remove, mode, setPreviewClientId, session } = useStore();
  const files = useDocFiles();
  const [editing, setEditing] = useState<Client | 'new' | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const c = data.clients.find(x => x.id === sel);

  const save = (v: Record<string, string>) => {
    const item: Client = { id: editing !== 'new' && editing ? editing.id : uid(), name: v.name.trim(), rfc: v.rfc.trim().toUpperCase(), email: v.email.trim(), phone: v.phone.trim(), status: v.status === 'Inactivo' ? 'Inactivo' : 'Activo', notes: v.notes };
    upsert('clients', item, x => x.id === item.id);
    setEditing(null);
  };

  if (c) {
    const docs = data.docs.filter(x => x.clientId === c.id);
    const have = new Set(docs.filter(x => x.status === 'Completo').map(x => x.category));
    const invites = data.invites.filter(i => i.clientId === c.id);
    return (
      <Page title={c.name} actions={<><Btn small kind="ghost" label="← Clientes" onPress={() => setSel(null)} />{!readOnly && <Btn small label="Editar" onPress={() => setEditing(c)} />}</>}>
        <Card>
          <T>RFC: {c.rfc || '—'}</T><T>Correo: {c.email || '—'}</T><T>Teléfono: {c.phone || '—'}</T>
          <Badge label={c.status} tone={c.status === 'Activo' ? 'ok' : 'muted'} />
          {c.notes ? <Muted>{c.notes}</Muted> : null}
        </Card>
        <Card>
          <H2>Expediente</H2>
          <Muted>«Completo» indica organización del expediente, no certificación fiscal.</Muted>
          {DOC_CATEGORIES.map(cat => (
            <Row key={cat}><T>{cat}</T><Badge tone={have.has(cat) ? 'ok' : 'muted'} label={have.has(cat) ? 'Completo' : docs.some(d => d.category === cat) ? 'En proceso' : 'Falta'} /></Row>
          ))}
          <Btn small kind="ghost" label={`Ver documentos (${docs.length})`} onPress={() => onOpenDocs(c.id)} />
        </Card>
        {readOnly ? null : mode === 'cloud' && session ? <CloudPortal clientId={c.id} email={c.email} /> : (
        <Card>
          <H2>Portal del cliente</H2>
          <Banner tone="warn">El portal con acceso remoto requiere iniciar sesión en la nube (Configuración → Cuenta en la nube). En este modo la invitación solo se registra localmente y no da acceso a nadie.</Banner>
          {invites.map(i => (
            <Row key={i.email}><T>{i.email}</T><Btn small kind="danger" label="Quitar" onPress={() => remove('invites', x => x.email === i.email && x.clientId === c.id)} /></Row>
          ))}
          <Btn small kind="ghost" label="Vista previa como cliente" onPress={() => setPreviewClientId(c.id)} />
          <Muted>La vista previa no modifica los permisos reales.</Muted>
        </Card>)}
        {!readOnly && <Btn kind="danger" label="Eliminar cliente" onPress={() => confirmAction('Se eliminarán también sus documentos y datos asociados. ¿Continuar?', async () => {
          for (const d of docs) await files.deleteFileOnly(d);
          remove('docs', x => x.clientId === c.id); remove('tasks', x => x.clientId === c.id);
          remove('projects', x => x.clientId === c.id); remove('invites', x => x.clientId === c.id);
          remove('payrolls', x => x.clientId === c.id); remove('obligations', x => x.clientId === c.id);
          remove('budgets', x => x.clientId === c.id);
          remove('clients', x => x.id === c.id); setSel(null);
        })} />}
        {editing && <FormModal title="Editar cliente" fields={fields} initial={{ ...c }} onSubmit={save} onClose={() => setEditing(null)} />}
      </Page>
    );
  }

  return (
    <Page title="Clientes" actions={readOnly ? undefined : <Btn label="+ Nuevo cliente" onPress={() => setEditing('new')} />}>
      {data.clients.length === 0 && <Empty>Aún no hay clientes. Crea el primero.</Empty>}
      <Card>
        {data.clients.map(x => (
          <Row key={x.id} onPress={() => setSel(x.id)}>
            <T bold>{x.name}</T><Badge label={x.status} tone={x.status === 'Activo' ? 'ok' : 'muted'} />
          </Row>
        ))}
      </Card>
      {editing === 'new' && <FormModal title="Nuevo cliente" fields={fields} initial={{ status: 'Activo' }} onSubmit={save} onClose={() => setEditing(null)} />}
    </Page>
  );
}

const MODULE_OPTIONS = CLIENT_MODULES.map(m => ({ value: m, label: MODULE_LABELS[m] }));
const MODULE_HINT = 'Por defecto el cliente solo ve documentos, proyectos y pendientes. Cifras, previsiones, obligaciones y nóminas solo se abren si las marcas. «Nóminas» incluye nombres de empleados, sueldos y recibos.';

function CloudPortal({ clientId, email }: { clientId: string; email: string }) {
  const { session, setPreviewClientId } = useStore();
  type Entry = { email: string; clientId: string; modules: ClientModule[] };
  const [list, setList] = useState<{ pending: Entry[]; members: Entry[] } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [code, setCode] = useState<{ email: string; code: string } | null>(null);
  const s = session!;
  const load = () => api(s.apiUrl, s.token, 'GET', `/ws/${s.workspaceId}/invites`).then(setList).catch(e => notify(e.message));
  React.useEffect(() => { load(); }, [clientId]);
  const mine = (x: { clientId: string }) => x.clientId === clientId;
  const labels = (ms: ClientModule[]) => ms.length ? ms.map(m => MODULE_LABELS[m]).join(', ') : 'ninguno';
  const putModules = (e: Entry, v: Record<string, string>) =>
    api(s.apiUrl, s.token, 'PUT', `/ws/${s.workspaceId}/invites/${encodeURIComponent(e.email)}/modules`, { modules: v.modules.split(',').filter(Boolean) }).then(() => { setEditing(null); load(); });
  return (
    <Card>
      <H2>Portal del cliente</H2>
      <Banner tone="info">La invitación asigna un correo a este expediente y genera un código de un solo uso. Debes compartir manualmente el código y el enlace de la app; no se envía correo automático.</Banner>
      {code && <Banner tone="warn">Código para {code.email}: {code.code} — cópialo ahora, no se vuelve a mostrar.</Banner>}
      {list?.members.filter(mine).map(m => (
        <View key={m.email} style={{ gap: 4, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
          <Row><T bold>{m.email}</T><Badge tone="ok" label="Con acceso" /></Row>
          <Muted>Ve: {labels(m.modules)}</Muted>
          <Row>
            <Btn small kind="ghost" label="Cambiar accesos" onPress={() => setEditing(m)} />
            <Btn small kind="danger" label="Revocar" onPress={() => confirmAction(`¿Revocar acceso de ${m.email}?`, () => api(s.apiUrl, s.token, 'DELETE', `/ws/${s.workspaceId}/invites/${encodeURIComponent(m.email)}`).then(load).catch(e => notify(e.message)))} />
          </Row>
        </View>
      ))}
      {list?.pending.filter(mine).map(m => (
        <View key={m.email} style={{ gap: 4, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
          <Row><T bold>{m.email}</T><Badge tone="warn" label="Invitación pendiente" /></Row>
          <Muted>Verá: {labels(m.modules)}</Muted>
          <Row>
            <Btn small kind="ghost" label="Cambiar accesos" onPress={() => setEditing(m)} />
            <Btn small kind="danger" label="Cancelar" onPress={() => api(s.apiUrl, s.token, 'DELETE', `/ws/${s.workspaceId}/invites/${encodeURIComponent(m.email)}`).then(load).catch(e => notify(e.message))} />
          </Row>
        </View>
      ))}
      <Btn small label="Invitar al portal" onPress={() => setInviting(true)} />
      <Btn small kind="ghost" label="Vista previa como cliente" onPress={() => setPreviewClientId(clientId)} />
      <Muted>La vista previa muestra los módulos predeterminados y no modifica los permisos reales.</Muted>
      {inviting && <FormModal title="Invitar al portal" initial={{ email, modules: DEFAULT_CLIENT_MODULES.join(',') }} onClose={() => setInviting(false)}
        fields={[{ key: 'email', label: 'Correo del cliente', required: true }, { key: 'modules', label: 'Qué podrá ver', type: 'multi', options: MODULE_OPTIONS, hint: MODULE_HINT }]}
        onSubmit={async v => {
          const r = await api<{ code: string; email: string }>(s.apiUrl, s.token, 'POST', `/ws/${s.workspaceId}/invites`, { email: v.email.trim(), clientId, modules: v.modules.split(',').filter(Boolean) });
          setCode(r); setInviting(false); load();
        }} />}
      {editing && <FormModal title={`Accesos de ${editing.email}`} initial={{ modules: editing.modules.join(',') }} onClose={() => setEditing(null)}
        fields={[{ key: 'modules', label: 'Qué puede ver', type: 'multi', options: MODULE_OPTIONS, hint: MODULE_HINT }]}
        onSubmit={v => putModules(editing, v)} />}
    </Card>
  );
}
