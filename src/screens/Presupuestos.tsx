import React, { useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../store.tsx';
import { Badge, Btn, Card, Empty, FormModal, Muted, Page, Row, T, theme } from '../ui/kit.tsx';
import { Budget } from '../domain/types.ts';
import { budgetAlerts, budgetKey } from '../domain/accounting.ts';
import { formatMXN, parseMoney } from '../domain/money.ts';
import { clientName, clientOptions, thisPeriod } from './common.ts';

export default function Presupuestos({ role = 'propietario' }: { role?: 'propietario' | 'cliente' | 'lectura' }) {
  const { data, upsert, remove } = useStore();
  const [edit, setEdit] = useState<Budget | 'new' | null>(null);
  const alerts = budgetAlerts(data.budgets, data.movements);
  const save = (v: Record<string, string>) => {
    const b: Budget = { category: v.category.trim(), clientId: v.clientId || '', period: v.period, limitCents: parseMoney(v.limit)! };
    if (b.limitCents <= 0) throw new Error('El límite debe ser mayor a 0');
    // La edición se identifica por categoría + cliente + periodo.
    const original = edit && edit !== 'new' ? budgetKey(edit) : budgetKey(b);
    if (original !== budgetKey(b) && data.budgets.some(x => budgetKey(x) === budgetKey(b))) throw new Error('Ya existe un presupuesto para esa categoría, cliente y periodo');
    upsert('budgets', b, x => budgetKey(x) === original); setEdit(null);
  };
  return (
    <Page title="Presupuestos" actions={role === 'propietario' ? <Btn label="+ Presupuesto" onPress={() => setEdit('new')} /> : undefined}>
      <Muted>Compara el gasto registrado de la categoría contra el límite del periodo. Alerta desde 80%.</Muted>
      {alerts.length === 0 && <Empty>Sin presupuestos.</Empty>}
      {alerts.map(a => (
        <Card key={budgetKey(a.budget)}>
          <Row><T bold>{a.budget.category} · {a.budget.period}</T><Badge label={a.level} tone={a.level === 'excedido' ? 'bad' : a.level === 'cerca' ? 'warn' : 'ok'} /></Row>
          <Muted>{clientName(data, a.budget.clientId) === '—' ? 'General' : clientName(data, a.budget.clientId)}</Muted>
          <View style={{ height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(100, a.pct)}%`, height: 8, backgroundColor: a.level === 'excedido' ? theme.bad : a.level === 'cerca' ? theme.warn : theme.ok }} />
          </View>
          <T>{formatMXN(a.spentCents)} de {formatMXN(a.budget.limitCents)} · {Math.round(a.pct)} % utilizado</T>
          {a.level === 'excedido' && <T bold style={{ color: theme.bad }}>{a.excess === null ? 'Gasto sin presupuesto asignado' : `${Math.round(a.excess)} % por encima del presupuesto (excede ${formatMXN(a.spentCents - a.budget.limitCents)})`}</T>}
          {role === 'propietario' && <Row><Btn small kind="ghost" label="Editar" onPress={() => setEdit(a.budget)} /><Btn small kind="danger" label="Eliminar" onPress={() => remove('budgets', x => budgetKey(x) === budgetKey(a.budget))} /></Row>}
        </Card>
      ))}
      {edit && <FormModal title={edit === 'new' ? 'Nuevo presupuesto' : 'Editar presupuesto'} onClose={() => setEdit(null)} onSubmit={save}
        initial={edit === 'new' ? { period: thisPeriod() } : { ...edit, limit: (edit.limitCents / 100).toFixed(2) }}
        fields={[
          { key: 'category', label: 'Categoría de gasto', required: true },
          { key: 'clientId', label: 'Cliente (opcional)', type: 'select', options: clientOptions(data, true) },
          { key: 'period', label: 'Periodo', type: 'period', required: true },
          { key: 'limit', label: 'Límite (MXN)', type: 'money', required: true },
        ]} />}
    </Page>
  );
}
