import { parseCSV } from './csv.ts';
import { xlsxToTable } from './xlsx.ts';
import type { Movement } from './types.ts';

export type StmtRow = { line: number; date: string; concept: string; type: 'ingreso' | 'gasto'; amountCents: number; category: string };
export type Mapping = { date: number; concept: number; debit: number; credit: number; amount: number };
export type StmtParse = {
  format: 'csv' | 'xlsx' | 'ofx';
  table: string[][];            // tabla cruda (vacía en OFX)
  headerIndex: number;
  headers: string[];
  mapping: Mapping;
  rows: StmtRow[];
  errors: string[];             // filas que no se pudieron leer: nunca se importan en silencio
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const MONTHS: Record<string, number> = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12 };
const pad = (n: number) => String(n).padStart(2, '0');
function validYmd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return new Date(iso + 'T00:00:00Z').toISOString().slice(0, 10) === iso ? iso : null;
}

/** Fechas de estados de cuenta mexicanos: dd/mm/aaaa (nunca mm/dd), aaaa-mm-dd, 15 ENE 2026, 15-ene-26, aaaammdd, serial de Excel. */
export function parseBankDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/.exec(s))) return validYmd(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{4})(\d{2})(\d{2})(?:\d{6}.*)?$/.exec(s))) return validYmd(+m[1], +m[2], +m[3]);
  if ((m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})(?:[T ].*)?$/.exec(s))) return validYmd(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  if ((m = /^(\d{1,2})[-/. ]?([A-Za-zÁÉÍÓÚáéíóú]{3,4})\.?[-/. ]?(\d{2,4})$/.exec(s))) {
    const mo = MONTHS[norm(m[2]).slice(0, m[2].length === 4 && norm(m[2]) === 'sept' ? 4 : 3)];
    return mo ? validYmd(m[3].length === 2 ? 2000 + +m[3] : +m[3], mo, +m[1]) : null;
  }
  if (/^\d{5}(\.\d+)?$/.test(s) && +s > 30000 && +s < 70000) { // serial de Excel
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 86400000).toISOString().slice(0, 10);
  }
  return null;
}

/** Importes: 1,234.56 · $1,234.56 · (1,234.56) · -1234.56 · 1,234.56- · 1.234,56. Devuelve centavos con signo, o null. */
export function parseBankAmount(raw: string): number | null {
  let s = raw.trim().replace(/\s|\$|MXN|MN/gi, '');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { neg = !neg || true; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); // formato europeo
  else s = s.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [i, d = ''] = s.split('.');
  const cents = Number(i) * 100 + Number(d.padEnd(2, '0'));
  return neg ? -cents : cents;
}

const RULES: [RegExp, string][] = [
  [/n[oó]mina|sueldo|salario/i, 'Nómina'],
  [/\bsat\b|impuesto|\bisr\b|\biva\b|imss|infonavit|sar\b/i, 'Impuestos y cuotas'],
  [/renta|arrendamiento/i, 'Renta'],
  [/comisi[oó]n|cuota anual|membres[ií]a|manejo de cuenta|anualidad/i, 'Comisiones bancarias'],
  [/\bcfe\b|telmex|telcel|izzi|totalplay|internet|agua|luz\b|gas natural/i, 'Servicios'],
  [/gasolin|pemex|combustible/i, 'Combustible'],
  [/seguro|aseguradora|gnp|axa\b|qualitas/i, 'Seguros'],
];
export function suggestCategory(concept: string, type: 'ingreso' | 'gasto'): string {
  for (const [re, cat] of RULES) if (re.test(concept)) return cat;
  return type === 'ingreso' ? 'Cobros' : 'Sin categorizar';
}

const HEADER_KEYS = {
  date: ['fecha', 'fecha operacion', 'fecha de operacion', 'fecha oper', 'fecha movimiento', 'fecha contable', 'date', 'fecha valor'],
  concept: ['concepto', 'descripcion', 'descripcion del movimiento', 'detalle', 'movimiento', 'description', 'concepto movimiento', 'leyenda', 'referencia'],
  debit: ['cargo', 'cargos', 'retiro', 'retiros', 'debito', 'debitos', 'debe', 'egreso', 'egresos', 'withdrawal', 'salida'],
  credit: ['abono', 'abonos', 'deposito', 'depositos', 'credito', 'creditos', 'haber', 'ingreso', 'ingresos', 'deposit', 'entrada'],
  amount: ['monto', 'importe', 'amount', 'cantidad'],
} as const;

export function detectMapping(headers: string[]): Mapping {
  const h = headers.map(norm);
  const find = (keys: readonly string[]) => {
    for (const k of keys) { const i = h.indexOf(k); if (i >= 0) return i; }
    for (const k of keys) { const i = h.findIndex(x => x.startsWith(k + ' ') || x.endsWith(' ' + k)); if (i >= 0) return i; }
    return -1;
  };
  return { date: find(HEADER_KEYS.date), concept: find(HEADER_KEYS.concept), debit: find(HEADER_KEYS.debit), credit: find(HEADER_KEYS.credit), amount: find(HEADER_KEYS.amount) };
}

const looksLikeHeader = (row: string[]) => {
  const m = detectMapping(row);
  return m.date >= 0 && (m.debit >= 0 || m.credit >= 0 || m.amount >= 0) && m.concept >= 0;
};

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 40).join('\n');
  const count = (d: string) => (sample.match(new RegExp(d === '\t' ? '\t' : `\\${d}`, 'g')) ?? []).length;
  return [',', ';', '\t', '|'].map(d => [d, count(d)] as const).sort((a, b) => b[1] - a[1])[0][0];
}

/** Aplica un mapeo de columnas a la tabla. Cada fila ilegible genera un error con su número de línea. */
export function applyMapping(table: string[][], headerIndex: number, map: Mapping): { rows: StmtRow[]; errors: string[] } {
  const rows: StmtRow[] = [], errors: string[] = [];
  if (map.date < 0 || map.concept < 0 || (map.debit < 0 && map.credit < 0 && map.amount < 0)) {
    return { rows, errors: ['Indica las columnas de fecha, concepto y cargo/abono (o monto).'] };
  }
  for (let i = headerIndex + 1; i < table.length; i++) {
    const r = table[i], line = i + 1;
    const cell = (k: number) => (k >= 0 ? (r[k] ?? '').trim() : '');
    if (r.every(c => !(c ?? '').trim())) continue;
    const dateTxt = cell(map.date);
    const concept = cell(map.concept);
    // Filas de totales o saldos iniciales/finales sin fecha: se ignoran solo si tampoco traen importe.
    const debitTxt = cell(map.debit), creditTxt = cell(map.credit), amountTxt = cell(map.amount);
    if (!dateTxt && !debitTxt && !creditTxt && !amountTxt) continue;
    const date = parseBankDate(dateTxt);
    if (!date) { if (/saldo|total/i.test(concept) && !debitTxt && !creditTxt) continue; errors.push(`Línea ${line}: fecha inválida «${dateTxt}»`); continue; }
    let signed: number | null = null;
    const d = debitTxt ? parseBankAmount(debitTxt) : null, c = creditTxt ? parseBankAmount(creditTxt) : null;
    if (map.debit >= 0 || map.credit >= 0) {
      if ((debitTxt && d === null) || (creditTxt && c === null)) { errors.push(`Línea ${line}: importe inválido`); continue; }
      const dv = d ? Math.abs(d) : 0, cv = c ? Math.abs(c) : 0;
      if (dv && cv) { errors.push(`Línea ${line}: trae cargo y abono a la vez`); continue; }
      if (!dv && !cv) { if (amountTxt === '') continue; }
      signed = cv ? cv : dv ? -dv : null;
    }
    if (signed === null && map.amount >= 0) {
      const a = parseBankAmount(amountTxt);
      if (a === null) { errors.push(`Línea ${line}: importe inválido «${amountTxt}»`); continue; }
      signed = a;
    }
    if (signed === null || signed === 0) { if (signed === 0) continue; errors.push(`Línea ${line}: sin importe`); continue; }
    const type = signed > 0 ? 'ingreso' : 'gasto';
    const text = concept || '(sin concepto)';
    rows.push({ line, date, concept: text, type, amountCents: Math.abs(signed), category: suggestCategory(text, type) });
  }
  if (rows.length === 0 && errors.length === 0) errors.push('No se encontraron movimientos.');
  return { rows, errors };
}

function parseOfx(text: string): StmtParse {
  const rows: StmtRow[] = [], errors: string[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  const tag = (b: string, t: string) => new RegExp(`<${t}>([^<\\r\\n]*)`, 'i').exec(b)?.[1]?.trim() ?? '';
  blocks.forEach((b, i) => {
    const date = parseBankDate(tag(b, 'DTPOSTED').slice(0, 8));
    const amt = parseBankAmount(tag(b, 'TRNAMT'));
    const name = [tag(b, 'NAME'), tag(b, 'MEMO')].filter(Boolean).join(' · ') || '(sin concepto)';
    if (!date || amt === null || amt === 0) { errors.push(`Movimiento ${i + 1}: fecha o importe inválido`); return; }
    const type = amt > 0 ? 'ingreso' : 'gasto';
    rows.push({ line: i + 1, date, concept: name, type, amountCents: Math.abs(amt), category: suggestCategory(name, type) });
  });
  if (blocks.length === 0) errors.push('El archivo OFX no contiene movimientos.');
  return { format: 'ofx', table: [], headerIndex: -1, headers: [], mapping: { date: -1, concept: -1, debit: -1, credit: -1, amount: -1 }, rows, errors };
}

/** Texto (CSV/OFX) → resultado con mapeo detectado. */
export function parseStatementText(text: string): StmtParse {
  if (/<OFX>|OFXHEADER/i.test(text)) return parseOfx(text);
  const table = parseCSV(text, detectDelimiter(text));
  return fromTable(table, 'csv');
}
export function parseStatementXlsx(bytes: Uint8Array): StmtParse { return fromTable(xlsxToTable(bytes), 'xlsx'); }

function fromTable(table: string[][], format: 'csv' | 'xlsx'): StmtParse {
  let headerIndex = table.findIndex(looksLikeHeader);
  if (headerIndex < 0) headerIndex = table.findIndex(r => r.filter(c => (c ?? '').trim()).length >= 3);
  if (headerIndex < 0) return { format, table, headerIndex: 0, headers: [], mapping: { date: -1, concept: -1, debit: -1, credit: -1, amount: -1 }, rows: [], errors: ['No se encontró una tabla de movimientos.'] };
  const headers = table[headerIndex].map(h => (h ?? '').trim());
  const mapping = detectMapping(headers);
  return { format, table, headerIndex, headers, mapping, ...applyMapping(table, headerIndex, mapping) };
}

/** Decodifica bytes de un archivo bancario: UTF-8 y, si no es válido, Windows-1252/Latin-1. */
export function decodeBankText(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { /* no es UTF-8 */ }
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}
export const isXlsx = (b: Uint8Array) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b;
export const isPdf = (b: Uint8Array) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

export function parseStatementBytes(bytes: Uint8Array): StmtParse {
  if (isPdf(bytes)) throw new Error('Los PDF no se pueden leer de forma confiable. Descarga el estado de cuenta en CSV, Excel u OFX desde la banca en línea.');
  if (isXlsx(bytes)) return parseStatementXlsx(bytes);
  return parseStatementText(decodeBankText(bytes));
}

const key = (m: { date: string; type: string; amountCents: number; concept: string }) => `${m.date}|${m.type}|${m.amountCents}|${norm(m.concept)}`;

/** Marca como duplicado cada fila que ya existe en los movimientos del cliente (se consume una coincidencia por fila). */
export function markDuplicates(rows: StmtRow[], existing: Pick<Movement, 'date' | 'type' | 'amountCents' | 'concept' | 'clientId'>[], clientId: string): boolean[] {
  const pool = new Map<string, number>();
  for (const m of existing) if (m.clientId === clientId) pool.set(key(m), (pool.get(key(m)) ?? 0) + 1);
  return rows.map(r => {
    const n = pool.get(key(r)) ?? 0;
    if (n > 0) { pool.set(key(r), n - 1); return true; }
    return false;
  });
}

export function summarize(rows: StmtRow[]) {
  let credits = 0, debits = 0, from = '9999', to = '0000';
  for (const r of rows) { r.type === 'ingreso' ? (credits += r.amountCents) : (debits += r.amountCents); if (r.date < from) from = r.date; if (r.date > to) to = r.date; }
  return { credits, debits, from: rows.length ? from : '', to: rows.length ? to : '' };
}

/** Estado de cuenta de ejemplo (mes en curso) para probar el importador sin un archivo real. */
export function sampleStatement(now = new Date()): string {
  const y = now.getUTCFullYear(), m = pad(now.getUTCMonth() + 1);
  const d = (n: number) => `${pad(n)}/${m}/${y}`;
  return [
    'Estado de cuenta;Cuenta 0123456789', `Periodo;${d(1)} al ${d(28)}`, ';',
    'Fecha;Concepto / Descripción;Cargo;Abono;Saldo',
    `${d(2)};SPEI RECIBIDO COMERCIALIZADORA AURORA;;"45,000.00";"95,000.00"`,
    `${d(5)};PAGO RENTA OFICINA;"15,000.00";;"80,000.00"`,
    `${d(8)};PAGO TELMEX;"1,299.00";;"78,701.00"`,
    `${d(10)};COMISION MANEJO DE CUENTA;"350.00";;"78,351.00"`,
    `${d(12)};SPEI RECIBIDO TALLER RAMIREZ;;"18,000.00";"96,351.00"`,
    `${d(15)};PAGO NOMINA QUINCENA;"28,450.00";;"67,901.00"`,
    `${d(18)};PAGO SAT IMPUESTOS FEDERALES;"6,820.50";;"61,080.50"`,
    `${d(28)};Saldo final;;;"61,080.50"`,
  ].join('\n');
}
