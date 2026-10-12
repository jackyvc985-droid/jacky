import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNominaCfdi, cfdiTotals } from '../src/domain/cfdiNomina.ts';
import { pairPdf, planReceipts, buildReceiptRecords } from '../src/domain/receipts.ts';
import { payrollSummary } from '../src/domain/payrollSummary.ts';
import { blankEmployee, validateEmployee, clabeValid, maskClabe } from '../src/domain/employees.ts';
import { emptyData } from '../src/domain/types.ts';
import { payrollNet } from '../src/domain/accounting.ts';
import type { Payroll } from '../src/domain/types.ts';

type Opts = { uuid?: string; rfc?: string; curp?: string; sueldo?: number; vales?: number; isr?: number; imss?: number; infonavit?: number; subsidio?: number; emisor?: string; fechaFin?: string; breakTotals?: boolean; tipo?: string; nomina?: boolean };
const m = (c: number) => (c / 100).toFixed(2);
/** CFDI de nómina con la forma que emite CONTPAQi (CFDI 4.0 + complemento nomina12). Montos en centavos. */
function xml(o: Opts = {}) {
  const sueldo = o.sueldo ?? 1500000, vales = o.vales ?? 0, isr = o.isr ?? 140282, imss = o.imss ?? 39454, inf = o.infonavit ?? 0, sub = o.subsidio ?? 0;
  const P = sueldo + vales, D = isr + imss + inf, O = sub;
  const sumD = D;
  const comp = o.nomina === false ? '' : `<nomina12:Nomina Version="1.2" TipoNomina="O" FechaPago="2026-10-15" FechaInicialPago="2026-10-01" FechaFinalPago="${o.fechaFin ?? '2026-10-15'}" NumDiasPagados="15.000" TotalPercepciones="${m(P)}" TotalDeducciones="${m(o.breakTotals ? sumD + 100 : sumD)}"${O ? ` TotalOtrosPagos="${m(O)}"` : ''}>
   <nomina12:Emisor RegistroPatronal="A1234567890"/>
   <nomina12:Receptor Curp="${o.curp ?? 'PEPL850101HDFRRS09'}" NumSeguridadSocial="12345678901" FechaInicioRelLaboral="2024-02-01" TipoContrato="01" TipoJornada="01" TipoRegimen="02" NumEmpleado="E-014" Departamento="Ventas" Puesto="Vendedor" PeriodicidadPago="04" SalarioBaseCotApor="524.65" SalarioDiarioIntegrado="524.65" ClaveEntFed="CMX"/>
   <nomina12:Percepciones TotalSueldos="${m(P)}" TotalGravado="${m(sueldo)}" TotalExento="${m(vales)}">
    <nomina12:Percepcion TipoPercepcion="001" Clave="P001" Concepto="Sueldos, Salarios Rayas y Jornales" ImporteGravado="${m(sueldo)}" ImporteExento="0.00"/>
    ${vales ? `<nomina12:Percepcion TipoPercepcion="029" Clave="P029" Concepto="Vales de despensa" ImporteGravado="0.00" ImporteExento="${m(vales)}"/>` : ''}
   </nomina12:Percepciones>
   <nomina12:Deducciones TotalOtrasDeducciones="${m(imss + inf)}" TotalImpuestosRetenidos="${m(isr)}">
    <nomina12:Deduccion TipoDeduccion="001" Clave="D001" Concepto="Seguridad social" Importe="${m(imss)}"/>
    <nomina12:Deduccion TipoDeduccion="002" Clave="D002" Concepto="ISR" Importe="${m(isr)}"/>
    ${inf ? `<nomina12:Deduccion TipoDeduccion="010" Clave="D010" Concepto="Crédito de vivienda" Importe="${m(inf)}"/>` : ''}
   </nomina12:Deducciones>
   ${O ? `<nomina12:OtrosPagos><nomina12:OtroPago TipoOtroPago="002" Clave="O002" Concepto="Subsidio para el empleo" Importe="${m(O)}"><nomina12:SubsidioAlEmpleo SubsidioCausado="${m(O)}"/></nomina12:OtroPago></nomina12:OtrosPagos>` : ''}
  </nomina12:Nomina>`;
  return `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:nomina12="http://www.sat.gob.mx/nomina12" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="N" Folio="15" Fecha="2026-10-15T12:00:00" SubTotal="${m(P + O)}" Descuento="${m(D)}" Moneda="MXN" Total="${m(P + O - D)}" TipoDeComprobante="${o.tipo ?? 'N'}" NoCertificado="30001000000500003416" Certificado="MIIB" Sello="abcd">
 <cfdi:Emisor Rfc="${o.emisor ?? 'AAA010101AAA'}" Nombre="Cliente Uno SA de CV" RegimenFiscal="601"/>
 <cfdi:Receptor Rfc="${o.rfc ?? 'PEPL850101AB1'}" Nombre="LUIS PEREZ PEREZ" UsoCFDI="CN01"/>
 <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111505" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago de nómina" ValorUnitario="${m(P + O)}" Importe="${m(P + O)}" Descuento="${m(D)}"/></cfdi:Conceptos>
 <cfdi:Complemento>${comp}<tfd:TimbreFiscalDigital Version="1.1" UUID="${o.uuid ?? '6128396F-C09B-4EC6-8699-43C5F7E3B230'}" FechaTimbrado="2026-10-15T12:01:00" SelloSAT="x"/></cfdi:Complemento>
</cfdi:Comprobante>`;
}

test('recibo de nómina: lectura de totales, líneas y desglose por tipo', () => {
  const r = parseNominaCfdi(xml({ vales: 80000, infonavit: 150000, subsidio: 20000 }));
  assert.deepEqual(r.errors, []);
  const n = r.nomina!;
  assert.equal(n.uuid, '6128396F-C09B-4EC6-8699-43C5F7E3B230');
  assert.equal(n.receptor.rfc, 'PEPL850101AB1');
  assert.equal(n.receptor.curp, 'PEPL850101HDFRRS09');
  assert.equal(n.fechaPago, '2026-10-15');
  assert.equal(n.totalPercepciones, 1580000);
  assert.equal(n.totalOtrosPagos, 20000);
  assert.equal(n.totalCents, 1580000 + 20000 - (140282 + 39454 + 150000));
  assert.equal(n.lines.length, 6);
  assert.equal(n.subsidioCausadoCents, 20000);
  const t = cfdiTotals(n.lines);
  assert.deepEqual([t.isr, t.imss, t.other, t.otros], [140282, 39454, 150000, 20000]);
});

test('recibo con incoherencias o que no es de nómina', () => {
  assert.ok(parseNominaCfdi(xml({ breakTotals: true })).errors.some(e => /Deducciones|Descuento/.test(e)));
  assert.ok(parseNominaCfdi(xml({ tipo: 'I' })).errors.some(e => e.includes('No es un CFDI de nómina')));
  assert.ok(parseNominaCfdi(xml({ nomina: false })).errors.some(e => e.includes('complemento de nómina')));
  assert.ok(parseNominaCfdi(xml({ curp: 'MALA' })).errors.some(e => e.includes('CURP')));
  assert.equal(parseNominaCfdi('<a><b></a>').nomina, null);
});

const base = () => {
  const d = emptyData();
  d.clients = [{ id: 'c1', name: 'Cliente Uno', rfc: 'AAA010101AAA', email: '', phone: '', status: 'Activo', notes: '' }];
  return d;
};

test('plan: trabajador y cliente nuevos / existentes, duplicados, sin cliente', () => {
  const d = base();
  const emp = { ...blankEmployee('e1', 'c1'), name: 'Luis Pérez Pérez', rfc: 'PEPL850101AB1' };
  d.employees = [emp];
  const calc: Payroll = { id: 'p1', employee: 'Luis Pérez Pérez', clientId: 'c1', period: '2026-10', perceptionsCents: 1500000, deductionsCents: 170000, employeeId: 'e1', calc: { isrCents: 130000, imssCents: 40000, subsidyAppliedCents: 0, otherCents: 0, tablesYear: 2026 } };
  d.payrolls = [calc];
  const [a, b, c, dup, nocli] = planReceipts([
    { xmlName: 'a.xml', xmlText: xml() },
    { xmlName: 'b.xml', xmlText: xml({ uuid: '7A28396F-C09B-4EC6-8699-43C5F7E3B231', rfc: 'GOMA900202XY3', curp: 'GOMA900202MDFMRN04' }) },
    { xmlName: 'c.xml', xmlText: xml({ breakTotals: true, uuid: '8B28396F-C09B-4EC6-8699-43C5F7E3B232' }) },
    { xmlName: 'd.xml', xmlText: xml() },                                   // mismo UUID que a.xml en el lote
    { xmlName: 'e.xml', xmlText: xml({ uuid: '9C28396F-C09B-4EC6-8699-43C5F7E3B233', emisor: 'ZZZ990101ZZ9' }) },
  ], d);
  assert.equal(a.status, 'actualiza');
  assert.equal(a.payrollId, 'p1');
  assert.equal(a.employeeId, 'e1');
  assert.ok(a.warnings.some(w => w.startsWith('Difiere del cálculo de la app')));
  assert.equal(b.status, 'nuevo');
  assert.equal(b.createEmployee, true);
  assert.equal(c.status, 'error');
  assert.equal(dup.status, 'duplicado');
  assert.equal(nocli.status, 'revisar');
  assert.equal(nocli.clientId, '');
  // un UUID ya guardado en una nómina también es duplicado
  d.payrolls.push({ ...calc, id: 'p2', cfdi: { uuid: '6128396F-C09B-4EC6-8699-43C5F7E3B230', status: 'Timbrado', xmlDocId: 'x', fechaPago: '', fechaInicial: '', fechaFinal: '', diasPagados: 15, emisorRfc: '', receptorRfc: '', totalCents: 0, lines: [], checkedAt: '', notes: [] } });
  assert.equal(planReceipts([{ xmlName: 'a.xml', xmlText: xml() }], d)[0].status, 'duplicado');
});

test('registros: nómina nueva desde el recibo (neto = Total del CFDI), trabajador creado, documentos vinculados', () => {
  const d = base();
  let n = 0; const id = () => `id${++n}`;
  const [pl] = planReceipts([{ xmlName: 'rec.xml', xmlText: xml({ vales: 80000, infonavit: 150000, subsidio: 20000 }), pdfName: 'rec.pdf' }], d);
  assert.equal(pl.status, 'nuevo');
  const rec = buildReceiptRecords(pl, d, id, { xmlKey: 'kx', xmlSize: 10, pdfKey: 'kp', pdfSize: 20 }, '2026-10-15T00:00:00Z');
  assert.equal(rec.employee!.rfc, 'PEPL850101AB1');
  assert.equal(rec.employee!.numEmpleado, 'E-014');
  assert.equal(rec.employee!.dailySalaryCents, 52465);
  assert.equal(rec.payroll.source, 'cfdi');
  assert.equal(payrollNet(rec.payroll), pl.parsed.nomina!.totalCents);   // el neto de la app = el Total timbrado
  assert.equal(rec.payroll.calc!.isrCents, 140282);
  assert.equal(rec.payroll.cfdi!.status, 'Timbrado');
  assert.equal(rec.docs.length, 2);
  assert.ok(rec.docs.every(x => x.category === 'Nómina' && x.employeeId === rec.employee!.id && x.payrollId === rec.payroll.id && x.uuid === pl.parsed.nomina!.uuid));
  assert.equal(rec.payroll.cfdi!.pdfDocId, rec.docs[1].id);
});

test('registros: un recibo se adjunta a una nómina calculada sin pisar sus cifras', () => {
  const d = base();
  d.employees = [{ ...blankEmployee('e1', 'c1'), name: 'Luis Pérez Pérez', rfc: 'PEPL850101AB1' }];
  const calc: Payroll = { id: 'p1', employee: 'Luis Pérez Pérez', clientId: 'c1', period: '2026-10', perceptionsCents: 1500000, deductionsCents: 180000, employeeId: 'e1' };
  d.payrolls = [calc];
  const [pl] = planReceipts([{ xmlName: 'a.xml', xmlText: xml() }], d);
  const rec = buildReceiptRecords(pl, d, (() => { let k = 0; return () => `n${++k}`; })(), { xmlKey: 'k', xmlSize: 1 });
  assert.equal(rec.payroll.id, 'p1');
  assert.equal(rec.payroll.deductionsCents, 180000);
  assert.ok(rec.payroll.cfdi);
  assert.equal(rec.employee, undefined);
});

test('emparejar PDF con su XML', () => {
  assert.equal(pairPdf('Recibo_001.xml', 'U', ['otro.pdf', 'recibo_001.PDF']), 'recibo_001.PDF');
  assert.equal(pairPdf('x.xml', '6128396F-C09B-4EC6-8699-43C5F7E3B230', ['6128396f-c09b-4ec6-8699-43c5f7e3b230.pdf']), '6128396f-c09b-4ec6-8699-43c5f7e3b230.pdf');
  assert.equal(pairPdf('x.xml', 'U', ['y.pdf']), undefined);
});

test('desglose general de nómina por periodo y cliente', () => {
  const emps = [{ ...blankEmployee('e1', 'c1'), name: 'Ana' }, { ...blankEmployee('e2', 'c1'), name: 'Beto' }];
  const ps: Payroll[] = [
    { id: 'a', employee: 'x', employeeId: 'e1', clientId: 'c1', period: '2026-10', perceptionsCents: 1500000, deductionsCents: 179736, calc: { isrCents: 140282, imssCents: 39454, subsidyAppliedCents: 0, otherCents: 0, tablesYear: 2026 }, cfdi: { uuid: 'U', status: 'Timbrado', xmlDocId: 'd', fechaPago: '', fechaInicial: '', fechaFinal: '', diasPagados: 30, emisorRfc: '', receptorRfc: '', totalCents: 0, lines: [], checkedAt: '', notes: [] } },
    { id: 'b', employee: 'Beto', employeeId: 'e2', clientId: 'c1', period: '2026-10', perceptionsCents: 1000000, deductionsCents: 120000 },
    { id: 'c', employee: 'Otro mes', clientId: 'c1', period: '2026-09', perceptionsCents: 1, deductionsCents: 0 },
    { id: 'd', employee: 'Otro cliente', clientId: 'c2', period: '2026-10', perceptionsCents: 5, deductionsCents: 0 },
  ];
  const s = payrollSummary(ps, emps, { period: '2026-10', clientId: 'c1' });
  assert.deepEqual(s.rows.map(r => r.name), ['Ana', 'Beto']);
  assert.equal(s.totals.perceptions, 2500000);
  assert.equal(s.totals.isr, 140282);
  assert.equal(s.totals.deductions, 299736);
  assert.equal(s.totals.net, 2500000 - 299736);
  assert.equal(s.timbrados, 1); assert.equal(s.pendientes, 1); assert.equal(s.withoutDetail, 1);
  assert.equal(s.rows[1].other, 120000);                       // manual: todo cae en «otras deducciones»
  assert.equal(payrollSummary(ps, emps, { period: '2026-10', clientId: '' }).rows.length, 3);
  assert.equal(payrollSummary(ps, emps, { period: '2030-01', clientId: '' }).rows.length, 0);
});

test('ficha del trabajador: validaciones', () => {
  assert.equal(clabeValid('002010077777777771'), true);
  assert.equal(clabeValid('002010077777777772'), false);
  assert.equal(maskClabe('002010077777777771'), '••••••••••••••7771');
  const e = { ...blankEmployee('e'), name: 'Ana', rfc: 'PEPL850101AB1', curp: 'PEPL850101HDFRRS09', nss: '12345678901', clabe: '002010077777777771', cp: '06600', hireDate: '2024-01-01', dailySalaryCents: 50000 };
  assert.deepEqual(validateEmployee(e).errors, []);
  const bad = validateEmployee({ ...e, name: '', rfc: 'X', curp: 'Y', nss: '1', clabe: '1', cp: '1', email: 'no', hireDate: '2025-02-30', endDate: '2023-01-01' });
  assert.ok(bad.errors.length >= 8, bad.errors.join('|'));
  assert.ok(validateEmployee(blankEmployee('z')).warnings.some(w => w.includes('RFC')));
});
