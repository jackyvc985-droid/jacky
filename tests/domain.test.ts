import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, formatMXN } from '../src/domain/money.ts';
import { validateMovementsCSV, safeCell, movementsToCSV } from '../src/domain/csv.ts';
import { budgetAlerts, payrollNet, trend, totals } from '../src/domain/accounting.ts';
import { clientView, canChangeDocStatus } from '../src/domain/permissions.ts';
import { emptyData } from '../src/domain/types.ts';

const clients = [
  { id: 'c1', name: 'Acme', rfc: '', email: '', phone: '', status: 'Activo' as const, notes: '' },
  { id: 'c2', name: 'Beta', rfc: '', email: '', phone: '', status: 'Activo' as const, notes: '' },
];

test('dinero en centavos', () => {
  assert.equal(parseMoney('1,234.5'), 123450);
  assert.equal(parseMoney('$0.07'), 7);
  assert.equal(parseMoney('abc'), null);
  assert.equal(parseMoney('1.234'), null);
  assert.equal(formatMXN(123456789), '$1,234,567.89');
  assert.equal(formatMXN(-5), '-$0.05');
});

test('CSV válido', () => {
  const r = validateMovementsCSV('fecha,tipo,concepto,categoria,monto,cliente\n2026-03-01,ingreso,Honorarios,Servicios,"1,500.00",Acme', clients);
  assert.deepEqual(r.errors, []);
  assert.equal(r.rows[0].amountCents, 150000);
  assert.equal(r.rows[0].clientId, 'c1');
});

test('una fila inválida impide la importación completa', () => {
  const r = validateMovementsCSV('fecha,tipo,concepto,categoria,monto,cliente\n2026-03-01,ingreso,A,B,10,\n2026-02-30,gasto,A,B,10,\n2026-03-01,otro,A,B,-1,Nadie', clients);
  assert.ok(r.errors.length >= 4);
  assert.ok(r.errors.some(e => e.startsWith('Fila 3')));
});

test('encabezado inválido', () => {
  assert.equal(validateMovementsCSV('a,b\n1,2', clients).errors.length, 1);
});

test('exportación neutraliza fórmulas', () => {
  assert.equal(safeCell('=1+1'), "'=1+1");
  assert.equal(safeCell('+cmd'), "'+cmd");
  assert.equal(safeCell('a,b'), '"a,b"');
  const csv = movementsToCSV([{ id: 'm', date: '2026-01-01', type: 'gasto', concept: '=HYPERLINK("x")', category: 'x', amountCents: 100, clientId: '' }], clients);
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
});

test('presupuestos, resultados y tendencia', () => {
  const ms = [
    { id: '1', date: '2026-03-02', type: 'gasto' as const, concept: '', category: 'Renta', amountCents: 9000, clientId: '' },
    { id: '2', date: '2026-03-05', type: 'gasto' as const, concept: '', category: 'Renta', amountCents: 2000, clientId: '' },
    { id: '3', date: '2026-02-05', type: 'ingreso' as const, concept: '', category: 'x', amountCents: 50000, clientId: '' },
  ];
  const [a] = budgetAlerts([{ category: 'Renta', clientId: '', period: '2026-03', limitCents: 10000 }], ms);
  assert.equal(a.spentCents, 11000);
  assert.equal(a.level, 'excedido');
  assert.equal(budgetAlerts([{ category: 'Renta', clientId: '', period: '2026-03', limitCents: 12000 }], ms)[0].level, 'cerca');
  assert.equal(totals(ms).result, 50000 - 11000);
  const t = trend(ms, '2026-03');
  assert.equal(t.length, 6);
  assert.equal(t[0].period, '2025-10');
  assert.equal(t[4].income, 50000);
});

test('nómina neta solo con lo capturado', () => {
  assert.equal(payrollNet({ perceptionsCents: 100000, deductionsCents: 12345 }), 87655);
});

test('permisos del portal', () => {
  const d = emptyData();
  d.clients = clients;
  d.docs = [{ id: 'd1', clientId: 'c1', category: '', period: '', name: '', mime: '', size: 0, fileKey: '', status: 'Completo', createdAt: '', uploadedBy: 'despacho' },
    { id: 'd2', clientId: 'c2', category: '', period: '', name: '', mime: '', size: 0, fileKey: '', status: 'Completo', createdAt: '', uploadedBy: 'despacho' }];
  d.invites = [{ email: 'a@b.c', clientId: 'c1', createdAt: '' }];
  const v = clientView(d, 'c1');
  assert.deepEqual(v.docs.map(x => x.id), ['d1']);
  assert.equal(v.clients.length, 1);
  assert.equal(v.invites.length, 0);
  assert.equal(canChangeDocStatus('cliente'), false);
  assert.equal(canChangeDocStatus('propietario'), true);
});

import { toB64, fromB64, makeBackup, parseBackup } from '../src/backup.ts';
test('respaldo: ida y vuelta con archivos binarios', async () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 255, 128, 7]);
  assert.deepEqual(Array.from(fromB64(toB64(bytes))), Array.from(bytes));
  const d = emptyData();
  d.clients = clients;
  d.docs = [{ id: 'd', clientId: 'c1', category: 'x', period: '', name: 'a.bin', mime: 'a/b', size: 7, fileKey: 'k1', status: 'Completo', createdAt: '', uploadedBy: 'despacho' },
    { id: 'e', clientId: 'c1', category: 'x', period: '', name: 'perdido.bin', mime: '', size: 1, fileKey: 'k2', status: 'Completo', createdAt: '', uploadedBy: 'despacho' }];
  const { json, missing } = await makeBackup(d, async k => (k === 'k1' ? bytes : null));
  assert.deepEqual(missing, ['perdido.bin']);
  const b = parseBackup(json);
  assert.equal(b.data.clients.length, 2);
  assert.deepEqual(Array.from(fromB64(b.files[0].b64)), Array.from(bytes));
  assert.throws(() => parseBackup('{"format":"otro"}'));
  assert.throws(() => parseBackup('no json'));
});
