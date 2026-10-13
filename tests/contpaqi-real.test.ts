import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseNominaCfdi, cfdiTotals } from '../src/domain/cfdiNomina.ts';
import { pairPdf, planReceipts, buildReceiptRecords } from '../src/domain/receipts.ts';
import { payRuns, payrollSummary } from '../src/domain/payrollSummary.ts';
import { payrollNet } from '../src/domain/accounting.ts';
import { emptyData } from '../src/domain/types.ts';
import type { Data, Payroll } from '../src/domain/types.ts';

// Recibos SEMANALES con la estructura exacta que emite CONTPAQi (datos anonimizados a partir de un lote real:
// nombres, RFC, CURP, NSS, UUID, sellos y certificados son ficticios).
const dir = new URL('./fixtures/contpaqi/', import.meta.url);
const X1 = 'RE_6103_Semanal_2026_39_001_9F0.xml', X2 = 'RE_6103_Semanal_2026_39_002_46A.xml';
const xml = (n: string) => fs.readFileSync(new URL(n, dir), 'utf8');
const pdfNames = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));

const world = (): Data => {
  const d = emptyData();
  d.clients = [{ id: 'c1', name: 'Empresa Ejemplo', rfc: 'AAA010101AAA', email: '', phone: '', status: 'Activo', notes: '' }];
  return d;
};

test('recibo real de CONTPAQi (semanal): se lee completo y sin errores', () => {
  const r = parseNominaCfdi(xml(X1));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  const n = r.nomina!;
  assert.equal(n.uuid, '11111111-AAAA-4AAA-8AAA-3E2B1C4D59F0');
  assert.equal(n.totalCents, 214200);
  assert.equal(n.totalPercepciones, 223482);
  assert.equal(n.totalDeducciones, 9284);
  assert.equal(n.totalOtrosPagos, 2);                                    // «Ajuste al neto» de 2 centavos
  assert.equal(n.subsidioCausadoCents, 12334);                           // subsidio causado aunque se pague $0.00
  assert.equal(n.fechaPago, '2026-10-02');
  assert.equal(n.fechaInicial, '2026-09-28'); assert.equal(n.fechaFinal, '2026-10-04');
  assert.equal(n.diasPagados, 7);
  assert.equal(n.receptor.periodicidad, '02');                           // semanal
  assert.equal(n.receptor.cp, '06600');
  assert.equal(n.receptor.sbcCents, 33500);
  assert.equal(n.receptor.sdiCents, 31926);
  assert.equal(n.lines.length, 6);                                       // 2 percepciones (sueldo + séptimo día), 2 deducciones, 2 otros pagos
  assert.deepEqual(n.lines.filter(l => l.kind === 'percepcion').map(l => l.concepto), ['Sueldo', 'Séptimo día']);
  assert.deepEqual(cfdiTotals(n.lines), { isr: 3715, imss: 5569, other: 0, deductions: 9284, otros: 2 });
});

test('emparejar PDF: por nombre base y por el patrón «…_<empleado>_<últimas 3 del UUID>» aunque los nombres lleven prefijos', () => {
  const u1 = '11111111-AAAA-4AAA-8AAA-3E2B1C4D59F0', u2 = '22222222-BBBB-4BBB-8BBB-7C5D2E8F146A';
  assert.equal(pairPdf(X1, u1, pdfNames, '001'), 'RE_6103_Semanal_2026_39_001_9F0.pdf');
  assert.equal(pairPdf(X2, u2, pdfNames, '002'), 'RE_6103_Semanal_2026_39_002_46A.pdf');
  // al descargar/subir, los archivos pueden llegar con un prefijo distinto en el XML y en el PDF
  const prefixed = pdfNames.map(p => `abcd1234-${p}`);
  assert.equal(pairPdf(`zzzz9999-${X1}`, u1, prefixed, '001'), 'abcd1234-RE_6103_Semanal_2026_39_001_9F0.pdf');
  assert.equal(pairPdf(`zzzz9999-${X2}`, u2, prefixed, '002'), 'abcd1234-RE_6103_Semanal_2026_39_002_46A.pdf');
  // el PDF del trabajador 006 no tiene XML: no se empareja con ninguno
  const used = [pairPdf(X1, u1, pdfNames, '001'), pairPdf(X2, u2, pdfNames, '002')];
  assert.deepEqual(pdfNames.filter(p => !used.includes(p)), ['RE_6103_Semanal_2026_39_006_0D1.pdf']);
  // sin empleado o con otra terminación, no se adivina
  assert.equal(pairPdf(X1, u1, ['otro_001_AAA.pdf'], '001'), undefined);
});

test('carga del lote semanal: trabajadores nuevos, neto = Total del CFDI, ficha sin inventar salario', () => {
  const d = world();
  const plans = planReceipts([{ xmlName: X1, xmlText: xml(X1), pdfName: 'RE_6103_Semanal_2026_39_001_9F0.pdf' }, { xmlName: X2, xmlText: xml(X2) }], d);
  assert.deepEqual(plans.map(p => p.status), ['nuevo', 'nuevo']);
  assert.deepEqual(plans.map(p => p.period), ['2026-10', '2026-10']);                    // mes de pago
  assert.ok(plans.every(p => p.createEmployee && p.clientId === 'c1'));
  let k = 0;
  const rec = buildReceiptRecords(plans[0], d, () => `id${++k}`, { xmlKey: 'kx', xmlSize: 10, pdfKey: 'kp', pdfSize: 5 });
  assert.equal(payrollNet(rec.payroll), 214200);
  assert.equal(rec.payroll.source, 'cfdi');
  assert.equal(rec.payroll.cfdi!.fechaInicial, '2026-09-28');
  assert.equal(rec.employee!.rfc, 'PEPJ800101AB1');
  assert.equal(rec.employee!.cp, '06600');
  assert.equal(rec.employee!.periodicidad, '02');
  assert.equal(rec.employee!.hireDate, '2026-01-26');
  assert.equal(rec.employee!.puesto, 'GERENTE');
  assert.equal(rec.employee!.dailySalaryCents, 0);                                        // no viene en el recibo
  assert.equal(rec.employee!.sbcDailyCents, 33500);
  assert.equal(rec.docs.length, 2);
});

test('semana siguiente del mismo trabajador: se reconoce su ficha y se crea otra nómina (no se pisa la anterior)', () => {
  let d = world();
  let k = 0; const id = () => `id${++k}`;
  const p1 = planReceipts([{ xmlName: X1, xmlText: xml(X1) }], d)[0];
  const r1 = buildReceiptRecords(p1, d, id, { xmlKey: 'k1', xmlSize: 1 });
  d = { ...d, employees: [r1.employee!], payrolls: [r1.payroll], docs: r1.docs };
  // la semana 40 del mismo trabajador (otro UUID y otras fechas)
  const week40 = xml(X1).replace('11111111-AAAA-4AAA-8AAA-3E2B1C4D59F0', '33333333-CCCC-4CCC-8CCC-111111111111').replace('FechaInicialPago="2026-09-28"', 'FechaInicialPago="2026-10-05"').replace('FechaFinalPago="2026-10-04"', 'FechaFinalPago="2026-10-11"').replace('FechaPago="2026-10-02"', 'FechaPago="2026-10-09"');
  const p2 = planReceipts([{ xmlName: 'sem40.xml', xmlText: week40 }], d)[0];
  assert.equal(p2.status, 'nuevo');
  assert.equal(p2.createEmployee, false);
  assert.equal(p2.employeeId, r1.employee!.id);
  assert.equal(p2.payrollId, '');                                                          // semanal: nunca se asocia a una nómina mensual
  const r2 = buildReceiptRecords(p2, d, id, { xmlKey: 'k2', xmlSize: 1 });
  assert.notEqual(r2.payroll.id, r1.payroll.id);
  d = { ...d, payrolls: [...d.payrolls, r2.payroll] };
  // el mismo recibo otra vez: duplicado
  assert.equal(planReceipts([{ xmlName: X1, xmlText: xml(X1) }], d)[0].status, 'duplicado');
});

test('resumen por periodo de pago: la semana 28 sep – 4 oct y el mes completo', () => {
  let d = world(); let k = 0; const id = () => `id${++k}`;
  for (const x of [X1, X2]) {
    const pl = planReceipts([{ xmlName: x, xmlText: xml(x) }], d)[0];
    const r = buildReceiptRecords(pl, d, id, { xmlKey: `k${k}`, xmlSize: 1 });
    d = { ...d, employees: [...d.employees, ...(r.employee ? [r.employee] : [])], payrolls: [...d.payrolls, r.payroll], docs: [...d.docs, ...r.docs] };
  }
  const week2: Payroll = { ...d.payrolls[0], id: 'w2', cfdi: { ...d.payrolls[0].cfdi!, uuid: 'U2', fechaInicial: '2026-10-05', fechaFinal: '2026-10-11', fechaPago: '2026-10-09' } };
  d.payrolls.push(week2);
  const f = { period: '2026-10', clientId: '' };
  const runs = payRuns(d.payrolls, f);
  assert.deepEqual(runs.map(r => [r.from, r.to, r.payDate, r.count]), [['2026-09-28', '2026-10-04', '2026-10-02', 2], ['2026-10-05', '2026-10-11', '2026-10-09', 1]]);
  const wk = payrollSummary(d.payrolls, d.employees, { ...f, run: runs[0].key });
  assert.equal(wk.rows.length, 2);
  assert.equal(wk.totals.perceptions, 2 * 223482);
  assert.equal(wk.totals.isr, 2 * 3715);
  assert.equal(wk.totals.net, 2 * 214200);
  assert.equal(wk.timbrados, 2);
  assert.equal(payrollSummary(d.payrolls, d.employees, f).rows.length, 3);                // todo el mes
});
