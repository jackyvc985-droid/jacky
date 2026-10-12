import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { uid, useStore } from '../store.tsx';
import { Badge, Banner, Btn, Card, Empty, FormModal, Muted, Page, Row, T } from '../ui/kit.tsx';
import { Obligation, ObligationStatus } from '../domain/types.ts';
import { formatMXN, parseMoney } from '../domain/money.ts';
import { clientName, clientOptions, today } from './common.ts';

const ST: ObligationStatus[] = ['Pendiente', 'Presentada', 'Pagada'];
const LINKS = [['Portal SAT', 'https://www.sat.gob.mx'], ['Declaraciones', 'https://www.sat.gob.mx/aplicacion/53175/presenta-tu-declaracion-de-impuestos'], ['Validar CFDI', 'https://verificacfdi.facturaelectronica.sat.gob.mx']] as const;

export default function Fiscal() {
  const { data, upsert, remove } = useStore();
  const [edit, setEdit] = useState<Obligation | 'new' | null>(null);
  const list = [...data.obligations].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const save = (v: Record<string, string>) => {
    const o: Obligation = { id: edit && edit !== 'new' ? edit.id : uid(), name: v.name.trim(), clientId: v.clientId || '', dueDate: v.dueDate, amountCents: parseMoney(v.amount || '0')!, status: (ST as string[]).includes(v.status) ? (v.status as ObligationStatus) : 'Pendiente' };
    upsert('obligations', o, x => x.id === o.id); setEdit(null);
  };
  return (
    <Page title="Fiscal" actions={<Btn label="+ Obligación" onPress={() => setEdit('new')} />}>
      <Banner tone="warn">Sirve para organizar obligaciones, importes capturados, fechas y estados. No presenta declaraciones ni valida XML o estatus ante el SAT; las reglas vigentes deben confirmarse con un contador.</Banner>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{LINKS.map(([l, u]) => <Btn key={l} small kind="ghost" label={l} onPress={() => Linking.openURL(u)} />)}</View>
      {list.length === 0 && <Empty>Sin obligaciones registradas.</Empty>}
      {list.map(o => (
        <Card key={o.id}>
          <Row><T bold>{o.name}</T><Badge label={o.status} tone={o.status === 'Pendiente' ? (o.dueDate < today() ? 'bad' : 'warn') : 'ok'} /></Row>
          <Muted>{clientName(data, o.clientId)} · Vence {o.dueDate} · Importe capturado {formatMXN(o.amountCents)}</Muted>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {ST.filter(s => s !== o.status).map(s => <Btn key={s} small kind="ghost" label={`→ ${s}`} onPress={() => upsert('obligations', { ...o, status: s }, x => x.id === o.id)} />)}
            <Btn small kind="ghost" label="Editar" onPress={() => setEdit(o)} /><Btn small kind="danger" label="Eliminar" onPress={() => remove('obligations', x => x.id === o.id)} />
          </View>
        </Card>
      ))}
      {edit && <FormModal title={edit === 'new' ? 'Nueva obligación' : 'Editar obligación'} onClose={() => setEdit(null)} onSubmit={save}
        initial={edit === 'new' ? { status: 'Pendiente', dueDate: today() } : { ...edit, amount: (edit.amountCents / 100).toFixed(2) }}
        fields={[
          { key: 'name', label: 'Obligación', required: true },
          { key: 'clientId', label: 'Cliente', type: 'select', options: clientOptions(data, true) },
          { key: 'dueDate', label: 'Fecha límite', type: 'date', required: true },
          { key: 'amount', label: 'Importe capturado (MXN)', type: 'money' },
          { key: 'status', label: 'Estado', type: 'select', options: ST.map(s => ({ value: s, label: s })) },
        ]} />}
    </Page>
  );
}
