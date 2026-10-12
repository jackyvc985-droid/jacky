import React, { useState } from 'react';
import { uid, useStore } from '../store.tsx';
import { Badge, Banner, Btn, Card, confirmAction, Empty, FormModal, H2, Muted, notify, Page, Row, T } from '../ui/kit.tsx';
import { Client, DOC_CATEGORIES } from '../domain/types.ts';
import { useDocFiles } from '../docs';
import { api } from '../cloud';

const fields = [
  { key: 'name', label: 'Nombre o razón social', required: true },
  { key: 'rfc', label: 'RFC' }, { key: 'email', label: 'Correo' }, { key: 'phone', label: 'Teléfono' },
  { key: 'status', label: 'Estado', type: 'select' as const, options: [{ value: 'Activo', label: 'Activo' }, { value: 'Inactivo', label: 'Inactivo' }] },
  { key: 'notes', label: 'Notas', type: 'multiline' as const },
];

export default function Clientes({ onOpenDocs }: { onOpenDocs: (clientId: string) => void }) {
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
      <Page title={c.name} actions={<><Btn small kind="ghost" label="← Clientes" onPress={() => setSel(null)} /><Btn small label="Editar" onPress={() => setEditing(c)} /></>}>
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
        {mode === 'cloud' && session ? <CloudPortal clientId={c.id} email={c.email} /> : (
        <Card>
          <H2>Portal del cliente</H2>
          <Banner tone="warn">El portal con acceso remoto requiere iniciar sesión en la nube (Configuración → Cuenta en la nube). En este modo la invitación solo se registra localmente y no da acceso a nadie.</Banner>
          {invites.map(i => (
            <Row key={i.email}><T>{i.email}</T><Btn small kind="danger" label="Quitar" onPress={() => remove('invites', x => x.email === i.email && x.clientId === c.id)} /></Row>
          ))}
          <Btn small kind="ghost" label="Vista previa como cliente" onPress={() => setPreviewClientId(c.id)} />
          <Muted>La vista previa no modifica los permisos reales.</Muted>
        </Card>)}
        <Btn kind="danger" label="Eliminar cliente" onPress={() => confirmAction('Se eliminarán también sus documentos y datos asociados. ¿Continuar?', async () => {
          for (const d of docs) await files.deleteFileOnly(d);
          remove('docs', x => x.clientId === c.id); remove('tasks', x => x.clientId === c.id);
          remove('projects', x => x.clientId === c.id); remove('invites', x => x.clientId === c.id);
          remove('payrolls', x => x.clientId === c.id); remove('obligations', x => x.clientId === c.id);
          remove('budgets', x => x.clientId === c.id);
          remove('clients', x => x.id === c.id); setSel(null);
        })} />
        {editing && <FormModal title="Editar cliente" fields={fields} initial={{ ...c }} onSubmit={save} onClose={() => setEditing(null)} />}
      </Page>
    );
  }

  return (
    <Page title="Clientes" actions={<Btn label="+ Nuevo cliente" onPress={() => setEditing('new')} />}>
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

function CloudPortal({ clientId, email }: { clientId: string; email: string }) {
  const { session, setPreviewClientId } = useStore();
  const [list, setList] = useState<{ pending: { email: string; clientId: string }[]; members: { email: string; clientId: string }[] } | null>(null);
  const [inviting, setInviting] = useState(false);
  const [code, setCode] = useState<{ email: string; code: string } | null>(null);
  const s = session!;
  const load = () => api(s.apiUrl, s.token, 'GET', `/ws/${s.workspaceId}/invites`).then(setList).catch(e => notify(e.message));
  React.useEffect(() => { load(); }, [clientId]);
  const mine = (x: { clientId: string }) => x.clientId === clientId;
  return (
    <Card>
      <H2>Portal del cliente</H2>
      <Banner tone="info">La invitación asigna un correo a este expediente y genera un código de un solo uso. Debes compartir manualmente el código y el enlace de la app; no se envía correo automático.</Banner>
      {code && <Banner tone="warn">Código para {code.email}: {code.code} — cópialo ahora, no se vuelve a mostrar.</Banner>}
      {list?.members.filter(mine).map(m => (
        <Row key={m.email}><T>{m.email}</T><Badge tone="ok" label="Con acceso" />
          <Btn small kind="danger" label="Revocar" onPress={() => confirmAction(`¿Revocar acceso de ${m.email}?`, () => api(s.apiUrl, s.token, 'DELETE', `/ws/${s.workspaceId}/invites/${encodeURIComponent(m.email)}`).then(load).catch(e => notify(e.message)))} /></Row>
      ))}
      {list?.pending.filter(mine).map(m => (
        <Row key={m.email}><T>{m.email}</T><Badge tone="warn" label="Invitación pendiente" />
          <Btn small kind="danger" label="Cancelar" onPress={() => api(s.apiUrl, s.token, 'DELETE', `/ws/${s.workspaceId}/invites/${encodeURIComponent(m.email)}`).then(load).catch(e => notify(e.message))} /></Row>
      ))}
      <Btn small label="Invitar al portal" onPress={() => setInviting(true)} />
      <Btn small kind="ghost" label="Vista previa como cliente" onPress={() => setPreviewClientId(clientId)} />
      <Muted>La vista previa no modifica los permisos reales.</Muted>
      {inviting && <FormModal title="Invitar al portal" fields={[{ key: 'email', label: 'Correo del cliente', required: true }]} initial={{ email }} onClose={() => setInviting(false)}
        onSubmit={async v => {
          const r = await api<{ code: string; email: string }>(s.apiUrl, s.token, 'POST', `/ws/${s.workspaceId}/invites`, { email: v.email.trim(), clientId });
          setCode(r); setInviting(false); load();
        }} />}
    </Card>
  );
}
