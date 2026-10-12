import React, { useState } from 'react';
import { View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { uid, useStore } from '../store.tsx';
import { Badge, Banner, Btn, Card, confirmAction, Empty, FormModal, Muted, notify, Page, Row, T } from '../ui/kit.tsx';
import { DOC_CATEGORIES, Doc, DocStatus } from '../domain/types.ts';
import { canChangeDocStatus } from '../domain/permissions.ts';
import { useDocFiles } from '../docs';
import { clientName, clientOptions, Role, thisPeriod } from './common.ts';

const STATUSES: DocStatus[] = ['Pendiente', 'En revisión', 'Completo'];
const tone = (s: DocStatus) => (s === 'Completo' ? 'ok' : s === 'En revisión' ? 'warn' : 'muted');
const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function Documentos({ role, filterClient }: { role: Role; filterClient: string }) {
  const { view, data, mode, activeClientId, upsert } = useStore();
  const files = useDocFiles();
  const [uploading, setUploading] = useState(false);
  const [picked, setPicked] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [fc, setFc] = useState(filterClient);
  const docs = view.docs.filter(d => !fc || d.clientId === fc).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!r.canceled && r.assets[0]) setPicked(r.assets[0]);
  };

  const submit = async (v: Record<string, string>) => {
    if (!picked) throw new Error('Selecciona un archivo');
    const clientId = role === 'cliente' ? activeClientId : v.clientId;
    if (!clientId && mode !== 'cloud') throw new Error('Selecciona un cliente');
    if (!clientId && role === 'propietario') throw new Error('Selecciona un cliente');
    await files.upload({ uri: picked.uri, name: picked.name, mime: picked.mimeType ?? '', size: picked.size ?? 0 }, { clientId, category: v.category, period: v.period });
    setUploading(false); setPicked(null);
  };

  return (
    <Page title="Documentos" actions={role === 'lectura' ? undefined : <Btn label="Subir documento" onPress={() => { if (role === 'propietario' && data.clients.length === 0) return notify('Primero crea un cliente.'); setUploading(true); }} />}>
      {mode === 'cloud' && <Banner tone="info">Los archivos se guardan en el servidor y se descargan con autorización de tu cuenta. El estado «Completo» indica organización del expediente, no certificación fiscal.</Banner>}
      {mode === 'local' && <Banner tone="info">Los archivos se guardan en este dispositivo. Si se borra el almacenamiento del navegador, se pierden. El estado «Completo» indica organización del expediente, no certificación fiscal.</Banner>}
      {mode === 'demo' && <Banner tone="warn">Demostración: los archivos de ejemplo no tienen contenido real, pero puedes subir uno para probar.</Banner>}
      {role === 'propietario' && data.clients.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Btn small kind={fc ? 'ghost' : 'primary'} label="Todos" onPress={() => setFc('')} />
          {data.clients.map(c => <Btn key={c.id} small kind={fc === c.id ? 'primary' : 'ghost'} label={c.name} onPress={() => setFc(c.id)} />)}
        </View>
      )}
      {docs.length === 0 && <Empty>No hay documentos.</Empty>}
      {docs.map(d => (
        <Card key={d.id}>
          <T bold>{d.name}</T>
          <Muted>{d.category} · {d.period || 'sin periodo'} · {clientName(data, d.clientId)} · {fmtSize(d.size)} · subido por {d.uploadedBy}</Muted>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge label={d.status} tone={tone(d.status)} />
            {canChangeDocStatus(role) && STATUSES.filter(s => s !== d.status).map(s => <Btn key={s} small kind="ghost" label={`→ ${s}`} onPress={() => upsert('docs', { ...d, status: s }, x => x.id === d.id)} />)}
            <Btn small kind="ghost" label="Abrir" onPress={() => files.open(d).catch(e => notify(e.message))} />
            {role === 'propietario' && <Btn small kind="danger" label="Eliminar" onPress={() => confirmAction('¿Eliminar este documento y su archivo?', () => files.delete(d))} />}
          </View>
        </Card>
      ))}
      {uploading && (
        <FormModal title="Subir documento" onClose={() => { setUploading(false); setPicked(null); }} onSubmit={submit}
          initial={{ category: DOC_CATEGORIES[0], period: thisPeriod(), clientId: filterClient || data.clients[0]?.id || '' }}
          fields={[
            { key: 'category', label: 'Categoría', type: 'select', options: DOC_CATEGORIES.map(c => ({ value: c, label: c })) },
            ...(role === 'propietario' ? [{ key: 'clientId', label: 'Cliente', type: 'select' as const, options: clientOptions(data) }] : []),
            { key: 'period', label: 'Periodo', type: 'period' },
          ]}
          extra={<View style={{ marginTop: 12, gap: 6 }}><Btn small kind="ghost" label={picked ? `📎 ${picked.name}` : 'Seleccionar archivo'} onPress={pick} /></View>} />
      )}
    </Page>
  );
}
