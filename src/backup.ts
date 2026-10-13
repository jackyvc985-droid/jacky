import { emptyData } from './domain/types.ts';
import type { Data } from './domain/types.ts';

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toB64(b: Uint8Array): string {
  let o = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    o += ABC[(n >> 18) & 63] + ABC[(n >> 12) & 63] + (i + 1 < b.length ? ABC[(n >> 6) & 63] : '=') + (i + 2 < b.length ? ABC[n & 63] : '=');
  }
  return o;
}
export function fromB64(s: string): Uint8Array {
  const clean = s.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buf = 0, bits = 0, j = 0;
  for (const c of clean) {
    const v = ABC.indexOf(c);
    if (v < 0) throw new Error('Respaldo corrupto (base64)');
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[j++] = (buf >> bits) & 255; }
  }
  return out;
}

export type BackupFile = { key: string; name: string; mime: string; b64: string };
export type Backup = { format: 'canville-backup'; version: 1; exportedAt: string; data: Data; files: BackupFile[] };

export async function makeBackup(data: Data, read: (key: string) => Promise<Uint8Array | null>): Promise<{ json: string; missing: string[] }> {
  const files: BackupFile[] = [], missing: string[] = [];
  for (const d of data.docs) {
    const bytes = await read(d.fileKey).catch(() => null);
    if (bytes) files.push({ key: d.fileKey, name: d.name, mime: d.mime, b64: toB64(bytes) }); else missing.push(d.name);
  }
  const b: Backup = { format: 'canville-backup', version: 1, exportedAt: new Date().toISOString(), data, files };
  return { json: JSON.stringify(b), missing };
}

export function parseBackup(text: string): Backup {
  let b: any;
  try { b = JSON.parse(text); } catch { throw new Error('El archivo no es un respaldo válido (JSON)'); }
  if (b?.format !== 'canville-backup' || b.version !== 1 || typeof b.data !== 'object' || !Array.isArray(b.files)) throw new Error('El archivo no es un respaldo de Canville');
  const base = emptyData();
  for (const k of Object.keys(base) as (keyof Data)[]) {
    if (b.data[k] !== undefined && !Array.isArray(b.data[k])) throw new Error(`Respaldo dañado: ${k}`);
  }
  return { ...b, data: { ...base, ...b.data } };
}
