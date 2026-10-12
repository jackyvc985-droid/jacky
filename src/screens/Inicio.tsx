import React from 'react';
import { View } from 'react-native';
import { useStore } from '../store.tsx';
import { Badge, Card, H2, Muted, Page, Row, T, theme } from '../ui/kit.tsx';
import { budgetAlerts, periodOf, totals } from '../domain/accounting.ts';
import { formatMXN } from '../domain/money.ts';
import { clientName, thisPeriod, today } from './common.ts';
import { addDays, overdue } from '../domain/planning.ts';

export default function Inicio({ role }: { role: 'propietario' | 'cliente' }) {
  const { view: d } = useStore();
  const per = thisPeriod();
  const t = totals(d.movements.filter(m => periodOf(m.date) === per));
  const openTasks = d.tasks.filter(t => !t.done);
  const overdueTasks = openTasks.filter(t => t.due && t.due < today());
  const alerts = budgetAlerts(d.budgets, d.movements).filter(a => a.level !== 'ok');
  const soon = d.obligations.filter(o => o.status === 'Pendiente' && o.dueDate <= addDays(today(), 7)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const lateForecasts = overdue(d.forecasts, today());
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
        <H2>Alertas</H2>
        <Muted>Avisos dentro de la app calculados con tus datos; no se envían por correo, push ni WhatsApp.</Muted>
        {alerts.length + overdueTasks.length + lateForecasts.length + soon.length + inReview.length === 0 && <Muted>Sin alertas por ahora.</Muted>}
        {lateForecasts.map(f => <Row key={f.id}><T>{f.kind === 'cobro' ? 'Cobro vencido' : 'Pago vencido'}: {f.concept} ({formatMXN(f.amountCents)})</T><Badge tone="bad" label={`Venció ${f.dueDate}`} /></Row>)}
        {overdueTasks.map(x => <Row key={x.id}><T>Tarea vencida: {x.title}</T><Badge tone="bad" label={`Venció ${x.due}`} /></Row>)}
        {soon.map(o => <Row key={o.id}><T>{o.name} · {clientName(d, o.clientId)}</T><Badge tone={o.dueDate <= addDays(today(), 1) ? 'bad' : 'warn'} label={o.dueDate === today() ? 'Vence hoy' : o.dueDate <= addDays(today(), 1) ? 'Vence mañana' : `Vence ${o.dueDate}`} /></Row>)}
        {alerts.map(a => (
          <Row key={a.budget.category + a.budget.period + a.budget.clientId}>
            <T>Presupuesto {a.budget.category} ({a.budget.period})</T>
            <Badge tone={a.level === 'excedido' ? 'bad' : 'warn'} label={a.level === 'excedido' ? (a.excess === null ? 'sin presupuesto' : `${Math.round(a.excess)} % por encima`) : `${Math.round(a.pct)} % utilizado`} />
          </Row>
        ))}
        {role === 'propietario' && inReview.length > 0 && <Row><T>{inReview.length} documento(s) requieren revisión</T><Badge tone="warn" label="Requiere revisión" /></Row>}
      </Card>
    </Page>
  );
}
