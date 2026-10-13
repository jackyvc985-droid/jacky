// Cambia la clave de cifrado (o activa el cifrado en datos existentes). Úsalo con el servidor DETENIDO y con un respaldo.
//   OLD_DATA_KEY=<clave actual o vacío si hoy no hay cifrado> NEW_DATA_KEY=<clave nueva> \
//   node --experimental-strip-types server/rekey.ts --yes
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { CANARY_FILE, checkKeyAtStartup, decrypt, encrypt, fingerprint, parseKey } from './crypto.ts';

export function rekey(dir: string, oldKey: Buffer | null, newKey: Buffer): { workspaces: number; files: number } {
  if (!newKey) throw new Error('Falta la clave nueva');
  // La clave actual debe ser la correcta antes de tocar nada (si el servidor ya cifraba).
  const canary = path.join(dir, CANARY_FILE);
  if (fs.existsSync(canary) || oldKey) checkKeyAtStartup(dir, oldKey, fs, path);
  const db = new DatabaseSync(path.join(dir, 'canville.db'));
  const rows = db.prepare('SELECT id, data FROM workspaces').all() as { id: string; data: string }[];
  // 1) Se prepara todo en memoria/temporales y se verifica antes de reemplazar nada.
  const newRows = rows.map(r => {
    const plain = r.data.startsWith('enc1:') ? decrypt(oldKey, Buffer.from(r.data.slice(5), 'base64')) : Buffer.from(r.data, 'utf8');
    const packed = 'enc1:' + encrypt(newKey, plain).toString('base64');
    if (!decrypt(newKey, Buffer.from(packed.slice(5), 'base64')).equals(plain)) throw new Error('Verificación fallida al recifrar');
    return { id: r.id, packed };
  });
  const files: string[] = [];
  const walk = (d: string) => { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) { const f = path.join(d, e.name); e.isDirectory() ? walk(f) : files.push(f); } };
  walk(path.join(dir, 'files'));
  for (const f of files) {
    const plain = decrypt(oldKey, fs.readFileSync(f));
    const out = encrypt(newKey, plain);
    if (!decrypt(newKey, out).equals(plain)) throw new Error(`Verificación fallida al recifrar ${f}`);
    fs.writeFileSync(f + '.rekey', out);
  }
  // 2) Se reemplaza: archivos, base (en una transacción) y marca de clave.
  for (const f of files) fs.renameSync(f + '.rekey', f);
  db.exec('BEGIN');
  try { for (const r of newRows) db.prepare('UPDATE workspaces SET data=? WHERE id=?').run(r.packed, r.id); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
  db.close();
  fs.writeFileSync(canary, encrypt(newKey, Buffer.from('canville-clave-correcta')), { mode: 0o600 });
  return { workspaces: newRows.length, files: files.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.env.DATA_DIR ?? path.join(process.cwd(), 'server-data');
  if (!process.argv.includes('--yes')) { console.error('Detén el servidor, haz un respaldo y vuelve a ejecutar con --yes.'); process.exit(1); }
  const oldKey = parseKey(process.env.OLD_DATA_KEY || undefined), newKey = parseKey(process.env.NEW_DATA_KEY);
  if (!newKey) { console.error('Define NEW_DATA_KEY (genérala con scripts/genkey.mjs).'); process.exit(1); }
  const r = rekey(dir, oldKey, newKey);
  console.log(`Listo: ${r.workspaces} espacio(s) y ${r.files} archivo(s) recifrados. Huella de la clave nueva: ${fingerprint(newKey)}. Anótala y guarda la clave nueva; la anterior ya no sirve.`);
}
