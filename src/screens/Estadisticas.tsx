import React, { useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../store';
import { Badge, Bars, Btn, Card, H2, Muted, Page, Row, T, theme } from '../ui/kit.tsx';
import { totals, trend } from '../domain/accounting.ts';
import { formatMXN } from '../domain/money.ts';
import { budgetVsSpent, expenseByCategory, filterMovements, insights } from '../domain/stats.ts';
import { Role, thisPeriod } from './common.ts';

export default function Estadisticas({ role }: { role: Role }) {
  const { view: d } = useStore();
  const [period, setPeriod] = useState(thisPeriod());
  const [clientId, setClientId] = useState('');
  const f = { clientId, period };
  const scoped = d.movements.filter(m => !clientId || m.clientId === clientId);
  const month = filterMovements(d.movements, f);
  const t = totals(month);
  const tr = trend(scoped, period, 6);
  const cats = expenseByCategory(month);
  const bud = budgetVsSpent(d.budgets, d.movements, f);
  const notes = insights(d.movements, d.budgets, f);
  const shift = (n: number) => { const [y, m] = period.split('-').map(Number); setPeriod(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)); };
  const scale = Math.max(1, ...bud.flatMap(b => [b.limitCents, b.spentCents]));
  const openTasks = d.tasks.filter(x => !x.done).length;
  const inReview = d.docs.filter(x => x.status === 'En revisión').length;

  return (
    <Page title="Estadísticas">
      <Muted>Calculado con los movimientos registrados: ingresos − gastos. No es un estado financiero ni utilidad fiscal.</Muted>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Btn small kind="ghost" label="◀" onPress={() => shift(-1)} /><T bold>{period}</T><Btn small kind="ghost" label="▶" onPress={() => shift(1)} />
        {role === 'propietario' && d.clients.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Btn small kind={clientId ? 'ghost' : 'primary'} label="Todos los clientes" onPress={() => setClientId('')} />
            {d.clients.map(c => <Btn key={c.id} small kind={clientId === c.id ? 'primary' : 'ghost'} label={c.name} onPress={() => setClientId(c.id)} />)}
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[['Ingresos', t.income, theme.primary], ['Gastos', t.expense, theme.accent], ['Resultado', t.result, t.result >= 0 ? theme.ok : theme.bad]].map(([l, v, c]) => (
          <Card key={l as string} style={{ flexGrow: 1, flexBasis: 180 }}><Muted>{l as string}</Muted><T bold style={{ fontSize: 22, color: c as string }}>{formatMXN(v as number)}</T></Card>
        ))}
      </View>

      <Card>
        <H2>Lo que dicen los números</H2>
        {notes.length === 0 && <Muted>Sin observaciones para este periodo: no hay desviaciones que reportar con los datos registrados.</Muted>}
        {notes.map(n => <T key={n}>• {n}</T>)}
      </Card>

      <Card>
        <H2>Tendencia de 6 meses</H2>
        {tr.every(x => x.income === 0 && x.expense === 0) ? <Muted>Sin movimientos en estos meses.</Muted> : <Bars data={tr.map(x => ({ label: x.period, a: x.income, b: x.expense }))} />}
        <Muted>Cada barra se dibuja a la misma escala (máximo {formatMXN(Math.max(0, ...tr.flatMap(x => [x.income, x.expense])))}).</Muted>
        {tr.map(x => <Row key={x.period}><T>{x.period}</T><Muted>Ingresos {formatMXN(x.income)} · Gastos {formatMXN(x.expense)}</Muted><T bold style={{ color: x.result >= 0 ? theme.ok : theme.bad }}>{formatMXN(x.result)}</T></Row>)}
      </Card>

      <Card>
        <H2>Gasto por categoría ({period})</H2>
        {cats.length === 0 && <Muted>Sin gastos en este periodo.</Muted>}
        {cats.map(c => (
          <View key={c.category} style={{ gap: 4, paddingVertical: 4 }}>
            <Row><T>{c.category}</T><T bold>{formatMXN(c.cents)} · {c.share.toFixed(1)} %</T></Row>
            <View style={{ height: 6, backgroundColor: theme.line, borderRadius: 3 }}><View style={{ height: 6, width: `${c.share}%`, backgroundColor: theme.accent, borderRadius: 3 }} /></View>
          </View>
        ))}
      </Card>

      <Card>
        <H2>Presupuesto contra gasto ({period})</H2>
        {bud.length === 0 && <Muted>Sin presupuestos para este periodo.</Muted>}
        {bud.map(b => (
          <View key={b.category + b.clientId} style={{ gap: 4, paddingVertical: 4 }}>
            <Row>
              <T bold>{b.category}</T>
              <Badge tone={b.spentCents > b.limitCents ? 'bad' : b.used >= 80 ? 'warn' : 'ok'} label={b.spentCents > b.limitCents ? (b.excess === null ? 'sin presupuesto' : `${Math.round(b.excess)} % por encima`) : `${Math.round(b.used)} % utilizado`} />
            </Row>
            <View style={{ height: 8, backgroundColor: theme.line, borderRadius: 4 }}><View style={{ height: 8, width: `${(b.limitCents / scale) * 100}%`, backgroundColor: theme.teal, opacity: 0.35, borderRadius: 4 }} /></View>
            <View style={{ height: 8, backgroundColor: theme.line, borderRadius: 4 }}><View style={{ height: 8, width: `${(b.spentCents / scale) * 100}%`, backgroundColor: b.spentCents > b.limitCents ? theme.accent : theme.teal, borderRadius: 4 }} /></View>
            <Muted>Presupuesto {formatMXN(b.limitCents)} · Gasto {formatMXN(b.spentCents)} · {b.limitCents - b.spentCents >= 0 ? `Disponible ${formatMXN(b.limitCents - b.spentCents)}` : `Excede ${formatMXN(b.spentCents - b.limitCents)}`}</Muted>
          </View>
        ))}
      </Card>

      <Card>
        <H2>Indicadores administrativos</H2>
        <Muted>Totales del expediente autorizado; no siguen el filtro de periodo ni de cliente.</Muted>
        <Row><T>Tareas pendientes</T><T bold>{openTasks}</T></Row>
        <Row><T>Documentos en revisión</T><T bold>{inReview}</T></Row>
        <Row><T>Proyectos en curso</T><T bold>{d.projects.filter(p => p.status === 'En curso').length}</T></Row>
      </Card>
    </Page>
  );
}
