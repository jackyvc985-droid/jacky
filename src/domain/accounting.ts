import type { Budget, Movement, Payroll } from './types.ts';

export const periodOf = (date: string) => date.slice(0, 7);

export function totals(ms: Movement[]) {
  let income = 0, expense = 0;
  for (const m of ms) m.type === 'ingreso' ? (income += m.amountCents) : (expense += m.amountCents);
  return { income, expense, result: income - expense };
}

/** Últimos `n` meses terminando en `endPeriod` (AAAA-MM), del más antiguo al más reciente. */
export function lastPeriods(endPeriod: string, n = 6): string[] {
  const [y, m] = endPeriod.split('-').map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function trend(ms: Movement[], endPeriod: string, n = 6) {
  return lastPeriods(endPeriod, n).map(p => ({ period: p, ...totals(ms.filter(m => periodOf(m.date) === p)) }));
}

export type BudgetAlert = { budget: Budget; spentCents: number; pct: number; level: 'ok' | 'cerca' | 'excedido' };

export function budgetAlerts(budgets: Budget[], ms: Movement[]): BudgetAlert[] {
  return budgets.map(b => {
    const spent = ms
      .filter(m => m.type === 'gasto' && m.category === b.category && periodOf(m.date) === b.period && (!b.clientId || m.clientId === b.clientId))
      .reduce((s, m) => s + m.amountCents, 0);
    const pct = b.limitCents > 0 ? (spent / b.limitCents) * 100 : 0;
    return { budget: b, spentCents: spent, pct, level: pct > 100 ? 'excedido' : pct >= 80 ? 'cerca' : 'ok' };
  });
}

/** Neto = percepciones capturadas − deducciones capturadas. No calcula ISR, IMSS, etc. */
export const payrollNet = (p: Pick<Payroll, 'perceptionsCents' | 'deductionsCents'>) => p.perceptionsCents - p.deductionsCents;

export const budgetKey = (b: Pick<Budget, 'category' | 'clientId' | 'period'>) => `${b.category}|${b.clientId}|${b.period}`;
