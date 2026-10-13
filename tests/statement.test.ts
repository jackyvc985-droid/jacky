import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { parseBankDate, parseBankAmount, parseStatementText, parseStatementBytes, markDuplicates, summarize, suggestCategory, applyMapping } from '../src/domain/statement.ts';

test('fechas bancarias', () => {
  assert.equal(parseBankDate('15/01/2026'), '2026-01-15');
  assert.equal(parseBankDate('05-03-26'), '2026-03-05');
  assert.equal(parseBankDate('2026-02-28'), '2026-02-28');
  assert.equal(parseBankDate('15 ENE 2026'), '2026-01-15');
  assert.equal(parseBankDate('03/SEP/2026'), '2026-09-03');
  assert.equal(parseBankDate('20260131'), '2026-01-31');
  assert.equal(parseBankDate('31/02/2026'), null);
  assert.equal(parseBankDate('13/25/2026'), null);
  assert.equal(parseBankDate('46023'), '2026-01-01');
  assert.equal(parseBankDate('46037'), '2026-01-15');
  assert.equal(parseBankDate('abc'), null);
});

test('importes bancarios', () => {
  assert.equal(parseBankAmount('1,234.56'), 123456);
  assert.equal(parseBankAmount('$ 1,234.50'), 123450);
  assert.equal(parseBankAmount('(500.00)'), -50000);
  assert.equal(parseBankAmount('-12.3'), -1230);
  assert.equal(parseBankAmount('99.10-'), -9910);
  assert.equal(parseBankAmount('1.234,56'), 123456);
  assert.equal(parseBankAmount(''), null);
  assert.equal(parseBankAmount('12.345'), null);
});

const BBVA = `Estado de cuenta;Cuenta 0123456789
Periodo;01/01/2026 al 31/01/2026
;
Fecha;Concepto / Descripción;Cargo;Abono;Saldo
02/01/2026;SPEI RECIBIDO CLIENTE UNO;;"15,000.00";"65,000.00"
05/01/2026;PAGO RENTA OFICINA;"8,500.00";;"56,500.00"
10/01/2026;COMISION MANEJO DE CUENTA;"350.00";;"56,150.00"
15/01/2026;NOMINA QUINCENA 1;"12,000.50";;"44,149.50"
31/01/2026;Saldo final;;;"44,149.50"
`;
test('CSV con preámbulo, punto y coma, cargo/abono separados', () => {
  const r = parseStatementText(BBVA);
  assert.equal(r.errors.length, 0);
  assert.equal(r.rows.length, 4);
  assert.deepEqual(r.rows.map(x => x.type), ['ingreso', 'gasto', 'gasto', 'gasto']);
  assert.equal(r.rows[0].amountCents, 1500000);
  assert.equal(r.rows[3].amountCents, 1200050);
  assert.deepEqual(r.rows.map(x => x.category), ['Cobros', 'Renta', 'Comisiones bancarias', 'Nómina']);
  const s = summarize(r.rows);
  assert.equal(s.credits, 1500000); assert.equal(s.from, '2026-01-02'); assert.equal(s.to, '2026-01-15');
});

test('CSV con monto con signo y coma como separador', () => {
  const r = parseStatementText('Fecha,Descripción,Importe\n2026-02-01,Venta mostrador,"1,200.00"\n2026-02-02,CFE recibo,-845.10\n');
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[1].type, 'gasto');
  assert.equal(r.rows[1].amountCents, 84510);
  assert.equal(r.rows[1].category, 'Servicios');
});

test('filas ilegibles se reportan, nunca se omiten en silencio', () => {
  const r = parseStatementText('Fecha;Concepto;Cargo;Abono\n01/01/2026;A;10.00;\n99/99/2026;B;5.00;\n02/01/2026;C;xx;\n03/01/2026;D;1.00;2.00\n');
  assert.equal(r.rows.length, 1);
  assert.equal(r.errors.length, 3);
  assert.ok(r.errors[0].startsWith('Línea 3'));
});

test('OFX', () => {
  const ofx = `OFXHEADER:100\n<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260105120000<TRNAMT>2500.00<FITID>1<NAME>DEPOSITO CLIENTE<MEMO>Factura 12</STMTTRN>\n<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260106<TRNAMT>-300.25<FITID>2<NAME>PAGO TELMEX</STMTTRN></BANKTRANLIST></OFX>`;
  const r = parseStatementText(ofx);
  assert.equal(r.format, 'ofx');
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].concept, 'DEPOSITO CLIENTE · Factura 12');
  assert.equal(r.rows[1].amountCents, 30025);
  assert.equal(r.rows[1].category, 'Servicios');
});

test('Excel .xlsx (primera hoja, cadenas compartidas, fechas serial)', () => {
  const sst = `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Fecha</t></si><si><t>Descripción</t></si><si><t>Cargo</t></si><si><t>Abono</t></si><si><t>PAGO PROVEEDOR &amp; CIA</t></si></sst>`;
  const sheet = `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row>
<row r="2"><c r="A2"><v>46037</v></c><c r="B2" t="s"><v>4</v></c><c r="C2"><v>1500.5</v></c></row>
<row r="3"><c r="A3"><v>46038</v></c><c r="B3" t="inlineStr"><is><t>Depósito</t></is></c><c r="D3"><v>300</v></c></row></sheetData></worksheet>`;
  const bytes = zipSync({ 'xl/sharedStrings.xml': strToU8(sst), 'xl/worksheets/sheet1.xml': strToU8(sheet), 'xl/workbook.xml': strToU8('<workbook/>') });
  const r = parseStatementBytes(bytes);
  assert.equal(r.format, 'xlsx');
  assert.deepEqual(r.errors, []);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].concept, 'PAGO PROVEEDOR & CIA');
  assert.equal(r.rows[0].date, '2026-01-15');
  assert.equal(r.rows[0].amountCents, 150050);
  assert.equal(r.rows[1].type, 'ingreso');
});

test('PDF se rechaza con un mensaje claro; Latin-1 se decodifica', () => {
  assert.throws(() => parseStatementBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), /PDF/);
  const latin = new Uint8Array([...'Fecha,Descripci'].map(c => c.charCodeAt(0)).concat([0xf3], [...'n,Importe\n01/01/2026,N'].map(c => c.charCodeAt(0)), [0xf3], [...'MINA,-10.00\n'].map(c => c.charCodeAt(0))));
  const r = parseStatementBytes(latin);
  assert.equal(r.rows[0].concept, 'NóMINA');
});

test('duplicados contra movimientos existentes (una coincidencia por fila)', () => {
  const r = parseStatementText(BBVA);
  const ex = [
    { date: '2026-01-05', type: 'gasto' as const, amountCents: 850000, concept: 'Pago renta oficina', clientId: 'c1' },
    { date: '2026-01-05', type: 'gasto' as const, amountCents: 850000, concept: 'otro cliente', clientId: 'c2' },
  ];
  assert.deepEqual(markDuplicates(r.rows, ex, 'c1'), [false, true, false, false]);
  assert.deepEqual(markDuplicates(r.rows, ex, 'c3'), [false, false, false, false]);
  const twice = [r.rows[1], r.rows[1]];
  assert.deepEqual(markDuplicates(twice, ex, 'c1'), [true, false]);
});

test('mapeo manual cuando no se detectan columnas', () => {
  const table = [['a', 'b', 'c'], ['01/01/2026', 'Algo', '-5.00']];
  const r = applyMapping(table, 0, { date: 0, concept: 1, debit: -1, credit: -1, amount: 2 });
  assert.equal(r.rows[0].type, 'gasto');
  assert.ok(applyMapping(table, 0, { date: -1, concept: 1, debit: -1, credit: -1, amount: 2 }).errors.length);
  assert.equal(suggestCategory('sin pista', 'gasto'), 'Sin categorizar');
});
