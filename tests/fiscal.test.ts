import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABLES_2026, isrMonthly, calcPayroll } from '../src/domain/fiscal.ts';
import { validateCfdi } from '../src/domain/cfdi.ts';

test('tarifa ISR: cada cuota fija es consistente con el renglón anterior (±1 centavo)', () => {
  const t = TABLES_2026.isrMonthly;
  for (let i = 1; i < t.length; i++) {
    const p = t[i - 1];
    const expected = p.fixed + Math.round(((p.upper - p.lower) * p.rateBp) / 10000);
    assert.ok(Math.abs(expected - t[i].fixed) <= 2, `renglón ${i + 1}: ${expected} vs ${t[i].fixed}`);
  }
});

test('ISR mensual conocido', () => {
  assert.equal(isrMonthly(1500000), 140282);      // $15,000.00 → $1,402.82
  assert.equal(isrMonthly(0), 0);
  assert.equal(isrMonthly(84459), Math.round(84458 * 192 / 10000));
});

test('subsidio: aplica bajo el límite y se entrega el excedente al trabajador', () => {
  const low = calcPayroll({ perceptionsCents: 800000, dailySalaryCents: 26000, days: 30 });
  assert.equal(low.subsidyApplied, 53565);
  assert.equal(low.isrWithheld, Math.max(0, low.isrBeforeSubsidy - 53565));
  const tiny = calcPayroll({ perceptionsCents: 50000, dailySalaryCents: 1700, days: 30 });
  assert.equal(tiny.isrWithheld, 0);
  assert.ok(tiny.subsidyPaid > 0);
  const high = calcPayroll({ perceptionsCents: 1500000, dailySalaryCents: 50000, days: 30 });
  assert.equal(high.subsidyApplied, 0);
  assert.equal(high.isrWithheld, 140282);
});

test('IMSS obrero: tasa fija 2.375 % y 0.40 % sobre excedente de 3 UMA', () => {
  const r = calcPayroll({ perceptionsCents: 1500000, dailySalaryCents: 50000, days: 30, integrationFactor: 1 });
  const sbc = 50000, exc = sbc - 3 * 11731;
  assert.equal(r.imss, Math.round(exc * 40 * 30 / 10000) + Math.round(sbc * 237.5 * 30 / 10000));
  assert.equal(r.net, 1500000 - r.deductionsTotal + r.subsidyPaid);
});

test('IMSS: tope de 25 UMA', () => {
  const r = calcPayroll({ perceptionsCents: 9000000, dailySalaryCents: 1000000, days: 30 });
  assert.equal(r.sbcDaily, 25 * 11731);
});

const CFDI = (total = '116.00', extra = '') => `<?xml version="1.0"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Fecha="2026-03-01T10:00:00" SubTotal="100.00" Total="${total}" Moneda="MXN" TipoDeComprobante="I" NoCertificado="123" Certificado="abc" Sello="xyz">
 <cfdi:Emisor Rfc="AAA010101AAA" Nombre="X"/><cfdi:Receptor Rfc="XAXX010101000" Nombre="Y"/>
 <cfdi:Conceptos><cfdi:Concepto Importe="100.00" Descripcion="s"/></cfdi:Conceptos>
 <cfdi:Impuestos TotalImpuestosTrasladados="16.00"/>
 <cfdi:Complemento>${extra || '<tfd:TimbreFiscalDigital UUID="6128396F-C09B-4EC6-8699-43C5F7E3B230"/>'}</cfdi:Complemento>
</cfdi:Comprobante>`;

test('CFDI válido', () => {
  const r = validateCfdi(CFDI());
  assert.deepEqual(r.errors, []);
  assert.equal(r.uuid, '6128396F-C09B-4EC6-8699-43C5F7E3B230');
  assert.equal(r.total, 11600);
});
test('CFDI con total incorrecto, sin timbre y XML roto', () => {
  assert.ok(validateCfdi(CFDI('120.00')).errors.some(e => e.startsWith('Total')));
  assert.ok(validateCfdi(CFDI('116.00', ' ')).errors.some(e => e.includes('timbrado')));
  assert.equal(validateCfdi('<a><b></a>').ok, false);
  assert.equal(validateCfdi('<x/>').ok, false);
});
