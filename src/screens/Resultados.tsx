import React from 'react';
import { View } from 'react-native';
import { useStore } from '../store.tsx';
import { Bars, Card, H2, Muted, Page, Row, T, theme } from '../ui/kit.tsx';
import { periodOf, totals, trend } from '../domain/accounting.ts';
import { formatMXN } from '../domain/money.ts';
import { thisPeriod } from './common.ts';

export default function Resultados() {
  const { view: d } = useStore();
  const per = thisPeriod();
  const tr = trend(d.movements, per, 6);
  const month = d.movements.filter(m => periodOf(m.date) === per);
  const byCat: Record<string, number> = {};
  for (const m of month.filter(m => m.type === 'gasto')) byCat[m.category] = (byCat[m.category] ?? 0) + m.amountCents;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const top = cats[0]?.[1] ?? 1;
  const y = totals(d.movements.filter(m => m.date.startsWith(per.slice(0, 4))));
  return (
    <Page title="Resultados">
      <Muted>Calculados desde los movimientos registrados: ingresos − gastos. No es un estado financiero certificado.</Muted>
      <Card><H2>Tendencia de 6 meses</H2><Bars data={tr.map(t => ({ label: t.period, a: t.income, b: t.expense }))} /></Card>
      <Card>
        <H2>Resultado por mes</H2>
        {tr.map(t => <Row key={t.period}><T>{t.period}</T><T bold style={{ color: t.result >= 0 ? theme.ok : theme.bad }}>{formatMXN(t.result)}</T></Row>)}
      </Card>
      <Card>
        <H2>Gastos por categoría ({per})</H2>
        {cats.length === 0 && <Muted>Sin gastos este mes.</Muted>}
        {cats.map(([c, v]) => (
          <View key={c} style={{ gap: 4, paddingVertical: 6 }}>
            <Row><T>{c}</T><T bold>{formatMXN(v)}</T></Row>
            <View style={{ height: 6, backgroundColor: '#e5e7eb', borderRadius: 3 }}><View style={{ height: 6, width: `${(v / top) * 100}%`, backgroundColor: theme.accent, borderRadius: 3 }} /></View>
          </View>
        ))}
      </Card>
      <Card><H2>Acumulado {per.slice(0, 4)}</H2><T>Ingresos {formatMXN(y.income)} · Gastos {formatMXN(y.expense)}</T><T bold style={{ color: y.result >= 0 ? theme.ok : theme.bad }}>Resultado {formatMXN(y.result)}</T></Card>
    </Page>
  );
}
