import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, netBase, projections, overdue, agenda, localDate } from '../src/domain/planning.ts';
import { excessPct, usedPct, budgetVsSpent, expenseByCategory, insights } from '../src/domain/stats.ts';
import { budgetAlerts } from '../src/domain/accounting.ts';
import type { Forecast, Movement } from '../src/domain/types.ts';

const f = (id: string, kind: 'cobro' | 'pago', cents: number, due: string, status: Forecast['status'] = 'Pendiente', clientId = ''): Forecast => ({ id, concept: id, kind, amountCents: cents, dueDate: due, clientId, category: 'x', status, note: '' });
const mv = (date: string, type: 'ingreso' | 'gasto', cents: number, category = 'x', clientId = ''): Movement => ({ id: date + type + cents, date, type, concept: '', category, amountCents: cents, clientId });

test('fechas: suma de días y fecha local', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 30), '2027-01-30');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(localDate(new Date(2026, 9, 12, 23, 59)), '2026-10-12');
});

test('proyección: base + cobros − pagos, fronteras inclusivas, excluye vencidos/cancelados/liquidados', () => {
  const anchor = '2026-10-12';
  const movs = [mv('2026-10-12', 'ingreso', 100000), mv('2026-10-13', 'ingreso', 999999), mv('2026-10-01', 'gasto', 30000)];
  assert.equal(netBase(movs, anchor), 70000); // el movimiento posterior al ancla no cuenta
  const fs = [
    f('hoy', 'cobro', 10000, '2026-10-12'),            // día del ancla: entra
    f('dia30', 'pago', 4000, '2026-11-11'),            // ancla + 30: entra
    f('dia31', 'cobro', 50000, '2026-11-12'),          // ancla + 31: solo en 60
    f('dia90', 'pago', 2000, '2027-01-10'),            // ancla + 90: entra en 90
    f('dia91', 'cobro', 777, '2027-01-11'),            // fuera
    f('vencido', 'cobro', 123456, '2026-10-11'),       // vencido: aparte
    f('cancelado', 'cobro', 55555, '2026-10-20', 'Cancelado'),
    f('liquidado', 'pago', 66666, '2026-10-20', 'Liquidado'),
  ];
  const [p30, p60, p90] = projections(fs, movs, anchor);
  assert.equal(p30.to, '2026-11-11');
  assert.deepEqual([p30.inflowCents, p30.outflowCents, p30.endCents, p30.count], [10000, 4000, 76000, 2]);
  assert.deepEqual([p60.inflowCents, p60.outflowCents, p60.endCents], [60000, 4000, 126000]);
  assert.deepEqual([p90.inflowCents, p90.outflowCents, p90.endCents], [60000, 6000, 124000]);
  assert.deepEqual(overdue(fs, anchor).map(x => x.id), ['vencido']);
  assert.deepEqual(agenda(fs, '2026-10').map(x => x.id), ['vencido', 'hoy', 'cancelado', 'liquidado']);
});

test('saldo negativo y sin datos', () => {
  assert.deepEqual(projections([], [mv('2026-01-01', 'gasto', 5000)], '2026-10-12').map(p => p.endCents), [-5000, -5000, -5000]);
  assert.equal(projections([], [], '2026-10-12')[0].count, 0);
});

test('excedente vs porcentaje utilizado (10,540 contra 8,000)', () => {
  assert.equal(Math.round(excessPct(1054000, 800000)!), 32);
  assert.equal(Math.round(usedPct(1054000, 800000)), 132);
  assert.equal(excessPct(500, 0), null);
  assert.equal(excessPct(0, 0), 0);
  assert.ok(excessPct(100, 1000)! < 0);
  const [a] = budgetAlerts([{ category: 'Comer fuera', clientId: '', period: '2026-03', limitCents: 800000 }], [mv('2026-03-05', 'gasto', 1054000, 'Comer fuera')]);
  assert.equal(a.level, 'excedido');
  assert.equal(Math.round(a.excess!), 32);
});

test('estadísticas: filtro por cliente y periodo, distribución e insights deterministas', () => {
  const ms = [
    mv('2026-03-05', 'gasto', 1054000, 'Comer fuera', 'c1'), mv('2026-03-06', 'gasto', 200000, 'Renta', 'c1'), mv('2026-03-07', 'gasto', 999999, 'Otro cliente', 'c2'),
    mv('2026-02-05', 'gasto', 500000, 'Comer fuera', 'c1'), mv('2026-03-08', 'ingreso', 100000, 'Ventas', 'c1'),
  ];
  const flt = { clientId: 'c1', period: '2026-03' };
  const dist = expenseByCategory(ms.filter(m => m.clientId === 'c1' && m.date.startsWith('2026-03')));
  assert.deepEqual(dist.map(d => d.category), ['Comer fuera', 'Renta']);
  assert.equal(Math.round(dist[0].share), 84);
  const budgets = [{ category: 'Comer fuera', clientId: 'c1', period: '2026-03', limitCents: 800000 }];
  assert.equal(budgetVsSpent(budgets, ms, flt)[0].spentCents, 1054000);
  const out = insights(ms, budgets, flt);
  assert.ok(out.some(s => s.includes('32 % por encima del presupuesto')), out.join('|'));
  assert.ok(out.some(s => s.includes('concentra 84 %')));
  assert.ok(!out.some(s => s.includes('Otro cliente')));            // no mezcla clientes
  assert.deepEqual(insights([], [], flt), []);                        // sin datos: sin inventar
});

import { PLANS, ivaCents, totalWithIva } from '../src/domain/plans.ts';
test('planes: tres planes mensuales, IVA 16 % en centavos', () => {
  assert.deepEqual(PLANS.map(p => p.id), ['esencial', 'profesional', 'empresarial']);
  assert.deepEqual(PLANS.map(p => p.priceCents), [49900, 99900, 199900]);
  assert.deepEqual(PLANS.map(p => totalWithIva(p.priceCents)), [57884, 115884, 231884]);
  assert.equal(ivaCents(49900), 7984);
});
