import { periodOf, totals } from './accounting.ts';
import { formatMXN } from './money.ts';
import type { Budget, Movement } from './types.ts';

export type StatFilter = { clientId: string | ''; period: string }; // period = AAAA-MM

export const filterMovements = (ms: Movement[], f: StatFilter) =>
  ms.filter(m => periodOf(m.date) === f.period && (!f.clientId || m.clientId === f.clientId));

export function expenseByCategory(ms: Movement[]) {
  const by: Record<string, number> = {};
  for (const m of ms) if (m.type === 'gasto') by[m.category] = (by[m.category] ?? 0) + m.amountCents;
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  return Object.entries(by).sort((a, b) => b[1] - a[1]).map(([category, cents]) => ({ category, cents, share: total ? (cents / total) * 100 : 0 }));
}

/** Excedente = (gasto − presupuesto) / presupuesto × 100. Con presupuesto 0 y gasto > 0 no hay porcentaje (null). */
export function excessPct(spentCents: number, limitCents: number): number | null {
  if (limitCents > 0) return ((spentCents - limitCents) / limitCents) * 100;
  return spentCents > 0 ? null : 0;
}
/** Porcentaje UTILIZADO (distinto del excedente: 10,540 de 8,000 es 132 % utilizado y 32 % por encima). */
export const usedPct = (spentCents: number, limitCents: number) => (limitCents > 0 ? (spentCents / limitCents) * 100 : 0);

export function budgetVsSpent(budgets: Budget[], ms: Movement[], f: StatFilter) {
  return budgets
    .filter(b => b.period === f.period && (!f.clientId || b.clientId === f.clientId))
    .map(b => {
      const spent = ms.filter(m => m.type === 'gasto' && m.category === b.category && periodOf(m.date) === b.period && (!b.clientId || m.clientId === b.clientId)).reduce((s, m) => s + m.amountCents, 0);
      return { category: b.category, clientId: b.clientId, limitCents: b.limitCents, spentCents: spent, used: usedPct(spent, b.limitCents), excess: excessPct(spent, b.limitCents) };
    });
}

const prevPeriod = (p: string) => { const [y, m] = p.split('-').map(Number); const d = new Date(Date.UTC(y, m - 2, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

/** Observaciones deterministas: cada una cita las cifras que la sustentan. */
export function insights(all: Movement[], budgets: Budget[], f: StatFilter): string[] {
  const out: string[] = [];
  const scoped = all.filter(m => !f.clientId || m.clientId === f.clientId);
  const cur = totals(scoped.filter(m => periodOf(m.date) === f.period));
  const prev = totals(scoped.filter(m => periodOf(m.date) === prevPeriod(f.period)));
  for (const b of budgetVsSpent(budgets, scoped, f)) {
    if (b.limitCents === 0 && b.spentCents > 0) out.push(`${b.category}: hay gasto de ${formatMXN(b.spentCents)} con presupuesto de $0.00.`);
    else if (b.excess !== null && b.excess > 0) out.push(`${b.category} está ${Math.round(b.excess)} % por encima del presupuesto (gasto ${formatMXN(b.spentCents)} contra ${formatMXN(b.limitCents)}).`);
    else if (b.used >= 80) out.push(`${b.category} lleva ${Math.round(b.used)} % del presupuesto (${formatMXN(b.spentCents)} de ${formatMXN(b.limitCents)}).`);
  }
  if (prev.expense > 0 && cur.expense > 0) {
    const ch = ((cur.expense - prev.expense) / prev.expense) * 100;
    if (Math.abs(ch) >= 10) out.push(`Los gastos ${ch > 0 ? 'subieron' : 'bajaron'} ${Math.round(Math.abs(ch))} % frente al mes anterior (${formatMXN(prev.expense)} → ${formatMXN(cur.expense)}).`);
  }
  const top = expenseByCategory(scoped.filter(m => periodOf(m.date) === f.period))[0];
  if (top && top.share >= 40) out.push(`${top.category} concentra ${Math.round(top.share)} % del gasto del mes (${formatMXN(top.cents)}).`);
  if (cur.result < 0) out.push(`El mes cierra con ${formatMXN(-cur.result)} más de gastos que de ingresos registrados.`);
  return out;
}
