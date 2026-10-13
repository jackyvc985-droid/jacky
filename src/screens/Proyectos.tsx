import React, { useState } from 'react';
import { uid, useStore } from '../store.tsx';
import { Badge, Btn, Card, Empty, FormModal, Muted, Page, Row, T } from '../ui/kit.tsx';
import { Project } from '../domain/types.ts';
import { clientName, clientOptions, Role } from './common.ts';

const ST = ['Planeado', 'En curso', 'Terminado'] as const;

export default function Proyectos({ role }: { role: Role }) {
  const { view, data, upsert, remove } = useStore();
  const [edit, setEdit] = useState<Project | 'new' | null>(null);
  const save = (v: Record<string, string>) => {
    const p: Project = { id: edit && edit !== 'new' ? edit.id : uid(), name: v.name.trim(), clientId: v.clientId, status: (ST as readonly string[]).includes(v.status) ? (v.status as Project['status']) : 'Planeado', description: v.description ?? '' };
    upsert('projects', p, x => x.id === p.id); setEdit(null);
  };
  return (
    <Page title="Proyectos" actions={role === 'propietario' ? <Btn label="+ Nuevo proyecto" onPress={() => setEdit('new')} /> : undefined}>
      {view.projects.length === 0 && <Empty>No hay proyectos.</Empty>}
      {view.projects.map(p => {
        const ts = view.tasks.filter(t => t.projectId === p.id);
        const done = ts.filter(t => t.done).length;
        return (
          <Card key={p.id}>
            <Row><T bold>{p.name}</T><Badge label={p.status} tone={p.status === 'Terminado' ? 'ok' : p.status === 'En curso' ? 'warn' : 'muted'} /></Row>
            <Muted>{clientName(data, p.clientId)} · Tareas {done}/{ts.length}</Muted>
            {p.description ? <T>{p.description}</T> : null}
            {role === 'propietario' && <Row><Btn small kind="ghost" label="Editar" onPress={() => setEdit(p)} /><Btn small kind="danger" label="Eliminar" onPress={() => remove('projects', x => x.id === p.id)} /></Row>}
          </Card>
        );
      })}
      {edit && <FormModal title={edit === 'new' ? 'Nuevo proyecto' : 'Editar proyecto'} initial={edit === 'new' ? { status: 'Planeado', clientId: data.clients[0]?.id ?? '' } : { ...edit }} onClose={() => setEdit(null)} onSubmit={save}
        fields={[
          { key: 'name', label: 'Nombre', required: true },
          { key: 'clientId', label: 'Cliente', type: 'select', options: clientOptions(data), required: true },
          { key: 'status', label: 'Estado', type: 'select', options: ST.map(s => ({ value: s, label: s })) },
          { key: 'description', label: 'Descripción', type: 'multiline' },
        ]} />}
    </Page>
  );
}
