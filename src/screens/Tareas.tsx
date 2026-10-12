import React, { useState } from 'react';
import { View } from 'react-native';
import { uid, useStore } from '../store.tsx';
import { Badge, Btn, Card, Empty, FormModal, Muted, Page, Row, T } from '../ui/kit.tsx';
import { Task } from '../domain/types.ts';
import { clientName, clientOptions, Role, today } from './common.ts';

export default function Tareas({ role }: { role: Role }) {
  const { view, data, upsert, remove } = useStore();
  const [edit, setEdit] = useState<Task | 'new' | null>(null);
  const tasks = [...view.tasks].sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9').localeCompare(b.due || '9'));
  const save = (v: Record<string, string>) => {
    const t: Task = { id: edit && edit !== 'new' ? edit.id : uid(), title: v.title.trim(), clientId: v.clientId || '', projectId: v.projectId || '', due: v.due || '', done: edit && edit !== 'new' ? edit.done : false };
    upsert('tasks', t, x => x.id === t.id); setEdit(null);
  };
  return (
    <Page title={role === 'cliente' ? 'Mis pendientes' : 'Tareas'} actions={role === 'propietario' ? <Btn label="+ Nueva tarea" onPress={() => setEdit('new')} /> : undefined}>
      {tasks.length === 0 && <Empty>No hay tareas.</Empty>}
      <Card>
        {tasks.map(t => (
          <Row key={t.id}>
            <View style={{ flex: 1 }}>
              <T bold style={t.done ? { textDecorationLine: 'line-through', opacity: 0.5 } : undefined}>{t.title}</T>
              <Muted>{clientName(data, t.clientId)}{t.projectId ? ` · ${data.projects.find(p => p.id === t.projectId)?.name ?? ''}` : ''}</Muted>
            </View>
            {t.due ? <Badge label={t.due} tone={!t.done && t.due < today() ? 'bad' : 'muted'} /> : null}
            {role === 'propietario' && <>
              <Btn small kind="ghost" label={t.done ? 'Reabrir' : 'Hecha'} onPress={() => upsert('tasks', { ...t, done: !t.done }, x => x.id === t.id)} />
              <Btn small kind="ghost" label="Editar" onPress={() => setEdit(t)} />
              <Btn small kind="danger" label="✕" onPress={() => remove('tasks', x => x.id === t.id)} />
            </>}
          </Row>
        ))}
      </Card>
      {edit && <FormModal title={edit === 'new' ? 'Nueva tarea' : 'Editar tarea'} initial={edit === 'new' ? {} : { ...edit }} onClose={() => setEdit(null)} onSubmit={save}
        fields={[
          { key: 'title', label: 'Tarea', required: true },
          { key: 'clientId', label: 'Cliente', type: 'select', options: clientOptions(data, true) },
          { key: 'projectId', label: 'Proyecto', type: 'select', options: [{ value: '', label: 'Ninguno' }, ...data.projects.map(p => ({ value: p.id, label: p.name }))] },
          { key: 'due', label: 'Fecha límite', type: 'date' },
        ]} />}
    </Page>
  );
}
