import type { Forecast, Movement } from './types.ts';

/** Fecha local AAAA-MM-DD (no UTC: en la noche de México UTC ya es el día siguiente). */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Base = neto de movimientos REGISTRADOS hasta el ancla (inclusive). No es saldo bancario. */
export function netBase(movements: Pick<Movement, 'date' | 'type' | 'amountCents'>[], anchor: string): number {
  let n = 0;
  for (const m of movements) if (m.date <= anchor) n += m.type === 'ingreso' ? m.amountCents : -m.amountCents;
  return n;
}

const pending = (f: Forecast) => f.status === 'Pendiente';
const signed = (f: Forecast) => (f.kind === 'cobro' ? f.amountCents : -f.amountCents);

export type Projection = { days: 30 | 60 | 90; to: string; inflowCents: number; outflowCents: number; netCents: number; endCents: number; count: number };

/**
 * Proyección = base + cobros pendientes − pagos pendientes con vencimiento desde el ancla hasta ancla + N días (ambos inclusive).
 * Excluye cancelados, liquidados y vencidos anteriores al ancla (esos se informan aparte).
 */
export function projections(forecasts: Forecast[], movements: Movement[], anchor: string): Projection[] {
  const base = netBase(movements, anchor);
  return ([30, 60, 90] as const).map(days => {
    const to = addDays(anchor, days);
    const inRange = forecasts.filter(f => pending(f) && f.dueDate >= anchor && f.dueDate <= to);
    const inflow = inRange.filter(f => f.kind === 'cobro').reduce((s, f) => s + f.amountCents, 0);
    const outflow = inRange.filter(f => f.kind === 'pago').reduce((s, f) => s + f.amountCents, 0);
    return { days, to, inflowCents: inflow, outflowCents: outflow, netCents: inflow - outflow, endCents: base + inflow - outflow, count: inRange.length };
  });
}

export const overdue = (forecasts: Forecast[], anchor: string) => forecasts.filter(f => pending(f) && f.dueDate < anchor).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

/** Agenda de un mes (AAAA-MM) independiente del ancla del pronóstico. */
export const agenda = (forecasts: Forecast[], month: string) => forecasts.filter(f => f.dueDate.startsWith(month)).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.concept.localeCompare(b.concept));

export const signedAmount = signed;
