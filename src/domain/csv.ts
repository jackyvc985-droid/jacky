import { parseMoney } from './money.ts';
import type { Client, Movement } from './types.ts';

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}

/** Neutraliza fórmulas de hoja de cálculo (CSV injection). */
export function safeCell(v: string | number): string {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows: (string | number)[][]): string {
  return rows.map(r => r.map(safeCell).join(',')).join('\n');
}

export const MOVEMENT_HEADER = ['fecha', 'tipo', 'concepto', 'categoria', 'monto', 'cliente'];

export type ImportResult = { rows: Omit<Movement, 'id'>[]; errors: string[] };

/** Valida todas las filas; si hay algún error, no se debe confirmar la importación. */
export function validateMovementsCSV(text: string, clients: Client[]): ImportResult {
  const table = parseCSV(text);
  const errors: string[] = [];
  const rows: Omit<Movement, 'id'>[] = [];
  if (table.length === 0) return { rows, errors: ['El archivo está vacío'] };
  const header = table[0].map(h => h.trim().toLowerCase());
  if (MOVEMENT_HEADER.some((h, i) => header[i] !== h)) {
    return { rows, errors: [`Encabezado inválido. Se esperaba: ${MOVEMENT_HEADER.join(',')}`] };
  }
  table.slice(1).forEach((r, idx) => {
    const n = idx + 2;
    const [fecha, tipo, concepto, categoria, monto, cliente] = r.map(x => (x ?? '').trim());
    const bad = (m: string) => errors.push(`Fila ${n}: ${m}`);
    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(fecha) && !Number.isNaN(Date.parse(fecha)) &&
      new Date(fecha + 'T00:00:00Z').toISOString().slice(0, 10) === fecha;
    if (!dateOk) bad('fecha inválida (use AAAA-MM-DD)');
    if (tipo !== 'ingreso' && tipo !== 'gasto') bad('tipo debe ser ingreso o gasto');
    if (!concepto) bad('concepto vacío');
    if (!categoria) bad('categoría vacía');
    const cents = parseMoney(monto);
    if (cents === null || cents <= 0) bad('monto inválido (debe ser mayor a 0)');
    let clientId = '';
    if (cliente) {
      const c = clients.find(x => x.name.toLowerCase() === cliente.toLowerCase());
      if (!c) bad(`cliente "${cliente}" no existe`); else clientId = c.id;
    }
    if (dateOk && (tipo === 'ingreso' || tipo === 'gasto') && concepto && categoria && cents !== null && cents > 0) {
      rows.push({ date: fecha, type: tipo, concept: concepto, category: categoria, amountCents: cents, clientId });
    }
  });
  if (table.length === 1) errors.push('No hay filas de datos');
  return { rows, errors };
}

export function movementsToCSV(ms: Movement[], clients: Client[]): string {
  const name = (id: string) => clients.find(c => c.id === id)?.name ?? '';
  return toCSV([MOVEMENT_HEADER, ...ms.map(m => [m.date, m.type, m.concept, m.category, (m.amountCents / 100).toFixed(2), name(m.clientId)])]);
}
