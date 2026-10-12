import React from 'react';
import { View } from 'react-native';
import { useStore } from '../store.tsx';
import { Badge, Card, H2, Muted, Page, Row, T, theme } from '../ui/kit.tsx';
import { budgetAlerts, periodOf, totals } from '../domain/accounting.ts';
import { formatMXN } from '../domain/money.ts';
import { clientName, thisPeriod, today } from './common.ts';

export default function Inicio({ role }: { role: 'propietario' | 'cliente' }) {
  const { view: d } = useStore();
  const per = thisPeriod();
  const t = totals(d.movements.filter(m => periodOf(m.date) === per));
  const openTasks = d.tasks.filter(t => !t.done);
  const overdue = openTasks.filter(t => t.due && t.due < today());
  const alerts = budgetAlerts(d.budgets, d.movements).filter(a => a.level !== 'ok');
  const pendingObl = d.obligations.filter(o => o.status === 'Pendiente');
  const inReview = d.docs.filter(x => x.status === 'En revisión');
  return (
    <Page title={role === 'cliente' ? 'Mi expediente' : 'Inicio'}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[
          ['Ingresos del mes', formatMXN(t.income), theme.primary],
          ['Gastos del mes', formatMXN(t.expense), theme.accent],
          ['Resultado', formatMXN(t.result), t.result >= 0 ? theme.ok : theme.bad],
        ].map(([l, v, c]) => (
          <Card key={l} style={{ flexGrow: 1, flexBasis: 200 }}><Muted>{l}</Muted><T bold style={{ fontSize: 22, color: c }}>{v}</T></Card>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {role === 'propietario' && <Card style={{ flexGrow: 1, flexBasis: 140 }}><Muted>Clientes activos</Muted><T bold style={{ fontSize: 22 }}>{String(d.clients.filter(c => c.status === 'Activo').length)}</T></Card>}
        <Card style={{ flexGrow: 1, flexBasis: 140 }}><Muted>Proyectos en curso</Muted><T bold style={{ fontSize: 22 }}>{String(d.projects.filter(p => p.status === 'En curso').length)}</T></Card>
        <Card style={{ flexGrow: 1, flexBasis: 140 }}><Muted>Documentos en revisión</Muted><T bold style={{ fontSize: 22 }}>{String(inReview.length)}</T></Card>
        <Card style={{ flexGrow: 1, flexBasis: 140 }}><Muted>Tareas pendientes</Muted><T bold style={{ fontSize: 22 }}>{String(openTasks.length)}</T></Card>
      </View>
      <Card>
        <H2>Pendientes</H2>
        {overdue.length + alerts.length + pendingObl.length === 0 && <Muted>Sin alertas por ahora.</Muted>}
        {overdue.map(x => <Row key={x.id}><T>{x.title}</T><Badge tone="bad" label={`Vencida ${x.due}`} /></Row>)}
        {alerts.map(a => (
          <Row key={a.budget.category + a.budget.period + a.budget.clientId}>
            <T>Presupuesto {a.budget.category} ({a.budget.period})</T>
            <Badge tone={a.level === 'excedido' ? 'bad' : 'warn'} label={`${Math.round(a.pct)}% · ${a.level}`} />
          </Row>
        ))}
        {pendingObl.map(o => <Row key={o.id}><T>{o.name} · {clientName(d, o.clientId)}</T><Badge tone="warn" label={`Vence ${o.dueDate}`} /></Row>)}
      </Card>
    </Page>
  );
}
