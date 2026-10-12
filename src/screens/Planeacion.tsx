import React, { useState } from 'react';
import { View } from 'react-native';
import { uid, useStore } from '../store';
import { Badge, Banner, Btn, Card, Empty, FormModal, H2, Muted, Page, Row, T, notify, theme } from '../ui/kit.tsx';
import { Forecast, ForecastStatus } from '../domain/types.ts';
import { formatMXN, parseMoney } from '../domain/money.ts';
import { agenda, netBase, overdue, projections, signedAmount } from '../domain/planning.ts';
import { toCSV } from '../domain/csv.ts';
import { exportText } from '../files';
import { clientName, clientOptions, Role, thisPeriod, today } from './common.ts';

const ST: ForecastStatus[] = ['Pendiente', 'Liquidado', 'Cancelado'];

export default function Planeacion({ role }: { role: Role }) {
  const { view, data, upsert, remove } = useStore();
  const [edit, setEdit] = useState<Forecast | 'new' | null>(null);
  const [month, setMonth] = useState(thisPeriod());
  const anchor = today();
  const fs = view.forecasts;
  const proj = projections(fs, view.movements, anchor);
  const late = overdue(fs, anchor);
  const items = agenda(fs, month);
  const base = netBase(view.movements, anchor);
  const shift = (d: number) => { const [y, m] = month.split('-').map(Number); setMonth(new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7)); };

  const save = (v: Record<string, string>) => {
    const cents = parseMoney(v.amount);
    if (cents === null || cents <= 0) throw new Error('El monto debe ser mayor a 0');
    const x: Forecast = { id: edit && edit !== 'new' ? edit.id : uid(), concept: v.concept.trim(), kind: v.kind === 'pago' ? 'pago' : 'cobro', amountCents: cents, dueDate: v.dueDate, clientId: v.clientId || '', category: v.category.trim() || 'Sin categoría', status: (ST as string[]).includes(v.status) ? (v.status as ForecastStatus) : 'Pendiente', note: v.note ?? '' };
    upsert('forecasts', x, y => y.id === x.id); setEdit(null);
  };
  const exportCsv = () => exportText(`previsiones-${month}.csv`, toCSV([['fecha', 'tipo', 'concepto', 'categoria', 'monto', 'estado', 'cliente', 'nota'], ...items.map(f => [f.dueDate, f.kind, f.concept, f.category, (f.amountCents / 100).toFixed(2), f.status, clientName(data, f.clientId) === '—' ? '' : clientName(data, f.clientId), f.note])])).catch(e => notify(e.message));

  return (
    <Page title="Planeación" actions={role === 'propietario' ? <><Btn small kind="ghost" label="Exportar CSV" onPress={exportCsv} /><Btn label="+ Cobro o pago" onPress={() => setEdit('new')} /></> : <Btn small kind="ghost" label="Exportar CSV" onPress={exportCsv} />}>
      <Banner tone="info">Previsión, no saldo bancario. Son cobros y pagos esperados: no mueven dinero, no registran movimientos y «Liquidado» lo marcas tú. La base es el neto de los movimientos registrados hasta hoy ({anchor}).</Banner>

      <Card>
        <H2>Proyección a 30, 60 y 90 días</H2>
        <Muted>Base neta registrada: {formatMXN(base)} · + cobros pendientes − pagos pendientes con vencimiento desde hoy (los vencidos van aparte y no entran).</Muted>
        {proj.map(p => (
          <View key={p.days} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.line, gap: 2 }}>
            <Row><T bold>{p.days} días (hasta {p.to})</T><T bold style={{ color: p.endCents >= 0 ? theme.ok : theme.bad }}>{formatMXN(p.endCents)}</T></Row>
            <Muted>Cobros {formatMXN(p.inflowCents)} · Pagos {formatMXN(p.outflowCents)} · Neto del periodo {formatMXN(p.netCents)} · {p.count} previsión(es)</Muted>
          </View>
        ))}
      </Card>

      <Card>
        <H2>Vencidos ({late.length})</H2>
        {late.length === 0 && <Muted>Sin cobros ni pagos vencidos.</Muted>}
        {late.map(f => (
          <Row key={f.id}>
            <View style={{ flex: 1, minWidth: 160 }}><T bold>{f.concept}</T><Muted>{f.kind === 'cobro' ? 'Cobro' : 'Pago'} · venció {f.dueDate} · {clientName(data, f.clientId)}</Muted></View>
            <T bold style={{ color: theme.bad }}>{formatMXN(f.amountCents)}</T>
            {role === 'propietario' && <Btn small kind="ghost" label="Liquidado" onPress={() => upsert('forecasts', { ...f, status: 'Liquidado' }, y => y.id === f.id)} />}
          </Row>
        ))}
      </Card>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Btn small kind="ghost" label="◀" onPress={() => shift(-1)} /><T bold>Agenda {month}</T><Btn small kind="ghost" label="▶" onPress={() => shift(1)} />
      </View>
      {items.length === 0 && <Empty>Sin cobros ni pagos previstos en este mes.</Empty>}
      <Card>
        {items.map(f => (
          <Row key={f.id}>
            <View style={{ flex: 1, minWidth: 160 }}>
              <T bold style={f.status !== 'Pendiente' ? { opacity: 0.5, textDecorationLine: f.status === 'Cancelado' ? 'line-through' : 'none' } : undefined}>{f.concept}</T>
              <Muted>{f.dueDate} · {f.kind === 'cobro' ? 'Cobro' : 'Pago'} · {f.category} · {clientName(data, f.clientId)}{f.note ? ` · ${f.note}` : ''}</Muted>
            </View>
            <Badge tone={f.status === 'Pendiente' ? (f.dueDate < anchor ? 'bad' : 'warn') : f.status === 'Liquidado' ? 'ok' : 'muted'} label={f.status} />
            <T bold style={{ color: signedAmount(f) >= 0 ? theme.ok : theme.bad }}>{signedAmount(f) < 0 ? '-' : ''}{formatMXN(f.amountCents)}</T>
            {role === 'propietario' && <>
              {ST.filter(s => s !== f.status).map(s => <Btn key={s} small kind="ghost" label={s} onPress={() => upsert('forecasts', { ...f, status: s }, y => y.id === f.id)} />)}
              <Btn small kind="ghost" label="Editar" onPress={() => setEdit(f)} />
              <Btn small kind="danger" label="✕" onPress={() => remove('forecasts', y => y.id === f.id)} />
            </>}
          </Row>
        ))}
      </Card>

      {edit && <FormModal title={edit === 'new' ? 'Nuevo cobro o pago' : 'Editar previsión'} onClose={() => setEdit(null)} onSubmit={save}
        initial={edit === 'new' ? { kind: 'cobro', status: 'Pendiente', dueDate: anchor } : { ...edit, amount: (edit.amountCents / 100).toFixed(2) }}
        fields={[
          { key: 'kind', label: 'Tipo', type: 'select', options: [{ value: 'cobro', label: 'Cobro esperado' }, { value: 'pago', label: 'Pago por hacer' }] },
          { key: 'concept', label: 'Concepto', required: true },
          { key: 'amount', label: 'Monto (MXN)', type: 'money', required: true },
          { key: 'dueDate', label: 'Vencimiento', type: 'date', required: true },
          { key: 'clientId', label: 'Cliente', type: 'select', options: clientOptions(data, true) },
          { key: 'category', label: 'Categoría' },
          { key: 'status', label: 'Estado', type: 'select', options: ST.map(s => ({ value: s, label: s })) },
          { key: 'note', label: 'Nota', type: 'multiline' },
        ]} />}
    </Page>
  );
}
