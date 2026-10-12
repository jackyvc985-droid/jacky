import React, { useState } from 'react';
import { View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { uid, useStore } from '../store.tsx';
import { Badge, Banner, Btn, Card, Empty, FormModal, H2, Muted, notify, Page, Row, T, theme } from '../ui/kit.tsx';
import { Movement } from '../domain/types.ts';
import { formatMXN, parseMoney } from '../domain/money.ts';
import { ImportResult, MOVEMENT_HEADER, movementsToCSV, validateMovementsCSV } from '../domain/csv.ts';
import { totals } from '../domain/accounting.ts';
import { exportText } from '../files';
import { clientName, clientOptions, Role, thisPeriod, today } from './common.ts';
import { TextInput } from 'react-native';

export default function Movimientos({ role }: { role: Role }) {
  const { view, data, upsert, remove, add } = useStore();
  const [edit, setEdit] = useState<Movement | 'new' | null>(null);
  const [imp, setImp] = useState<{ text: string; res: ImportResult } | null>(null);
  const [period, setPeriod] = useState(thisPeriod());
  const list = view.movements.filter(m => m.date.startsWith(period)).sort((a, b) => b.date.localeCompare(a.date));
  const t = totals(list);

  const save = (v: Record<string, string>) => {
    const m: Movement = { id: edit && edit !== 'new' ? edit.id : uid(), date: v.date, type: v.type === 'gasto' ? 'gasto' : 'ingreso', concept: v.concept.trim(), category: v.category.trim(), amountCents: parseMoney(v.amount)!, clientId: v.clientId || '' };
    if (m.amountCents <= 0) throw new Error('El monto debe ser mayor a 0');
    upsert('movements', m, x => x.id === m.id); setEdit(null);
  };
  const analyze = (text: string) => setImp({ text, res: validateMovementsCSV(text, data.clients) });
  const pickCsv = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (r.canceled || !r.assets[0]) return;
    analyze(await (await fetch(r.assets[0].uri)).text());
  };
  const shiftPeriod = (d: number) => { const [y, m] = period.split('-').map(Number); const n = new Date(Date.UTC(y, m - 1 + d, 1)); setPeriod(n.toISOString().slice(0, 7)); };

  return (
    <Page title={role === 'cliente' ? 'Mis cifras' : 'Movimientos'} actions={role === 'propietario' ? <>
      <Btn small kind="ghost" label="Importar CSV" onPress={() => setImp({ text: '', res: { rows: [], errors: [] } })} />
      <Btn small kind="ghost" label="Exportar CSV" onPress={() => exportText(`movimientos-${period}.csv`, movementsToCSV(list, data.clients)).catch(e => notify(e.message))} />
      <Btn label="+ Movimiento" onPress={() => setEdit('new')} /></> : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Btn small kind="ghost" label="◀" onPress={() => shiftPeriod(-1)} /><T bold>{period}</T><Btn small kind="ghost" label="▶" onPress={() => shiftPeriod(1)} />
      </View>
      <Card>
        <Row><T>Ingresos</T><T bold style={{ color: theme.primary }}>{formatMXN(t.income)}</T></Row>
        <Row><T>Gastos</T><T bold style={{ color: theme.accent }}>{formatMXN(t.expense)}</T></Row>
        <Row><T>Resultado (ingresos − gastos registrados)</T><T bold style={{ color: t.result >= 0 ? theme.ok : theme.bad }}>{formatMXN(t.result)}</T></Row>
      </Card>
      {list.length === 0 && <Empty>Sin movimientos en este periodo.</Empty>}
      <Card>
        {list.map(m => (
          <Row key={m.id}>
            <View style={{ flex: 1, minWidth: 160 }}><T bold>{m.concept}</T><Muted>{m.date} · {m.category} · {clientName(data, m.clientId)}</Muted></View>
            <T bold style={{ color: m.type === 'ingreso' ? theme.ok : theme.bad }}>{m.type === 'gasto' ? '-' : ''}{formatMXN(m.amountCents)}</T>
            {role === 'propietario' && <><Btn small kind="ghost" label="Editar" onPress={() => setEdit(m)} /><Btn small kind="danger" label="✕" onPress={() => remove('movements', x => x.id === m.id)} /></>}
          </Row>
        ))}
      </Card>
      {edit && <FormModal title={edit === 'new' ? 'Nuevo movimiento' : 'Editar movimiento'} onClose={() => setEdit(null)} onSubmit={save}
        initial={edit === 'new' ? { date: today(), type: 'ingreso' } : { ...edit, amount: (edit.amountCents / 100).toFixed(2) }}
        fields={[
          { key: 'type', label: 'Tipo', type: 'select', options: [{ value: 'ingreso', label: 'Ingreso' }, { value: 'gasto', label: 'Gasto' }] },
          { key: 'date', label: 'Fecha', type: 'date', required: true },
          { key: 'concept', label: 'Concepto', required: true },
          { key: 'category', label: 'Categoría', required: true },
          { key: 'amount', label: 'Monto (MXN)', type: 'money', required: true },
          { key: 'clientId', label: 'Cliente', type: 'select', options: clientOptions(data, true) },
        ]} />}
      {imp && (
        <FormModal title="Importar movimientos (CSV)" initial={{}} fields={[]} onClose={() => setImp(null)}
          onSubmit={() => {
            if (imp.res.errors.length || imp.res.rows.length === 0) throw new Error('Corrige los errores antes de confirmar');
            add('movements', imp.res.rows.map(r => ({ ...r, id: uid() })));
            const n = imp.res.rows.length; setImp(null); notify(`Se importaron ${n} movimientos.`);
          }}
          extra={<View style={{ gap: 8, marginTop: 10 }}>
            <Muted>Columnas: {MOVEMENT_HEADER.join(', ')}. Fecha AAAA-MM-DD. Si una fila es inválida no se importa nada.</Muted>
            <Btn small kind="ghost" label="Elegir archivo CSV" onPress={pickCsv} />
            <TextInput multiline value={imp.text} onChangeText={analyze} placeholder="…o pega aquí el contenido CSV" style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 8, minHeight: 90 }} />
            {imp.res.errors.slice(0, 8).map(e => <Muted key={e} style={{ color: theme.bad }}>{e}</Muted>)}
            {imp.res.errors.length > 8 && <Muted>…y {imp.res.errors.length - 8} errores más</Muted>}
            {imp.text && imp.res.errors.length === 0 && <Badge tone="ok" label={`${imp.res.rows.length} filas válidas`} />}
          </View>} />
      )}
    </Page>
  );
}
