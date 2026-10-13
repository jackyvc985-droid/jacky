// Respaldo consistente del servidor: copia de la base (VACUUM INTO) + archivos.
// Uso: node --experimental-strip-types server/backup.ts <carpeta-destino>
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'server-data');
const dest = process.argv[2];
if (!dest) { console.error('Indica la carpeta destino'); process.exit(1); }
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(dest, `canville-${stamp}`);
fs.mkdirSync(out, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'canville.db'));
db.exec(`VACUUM INTO '${path.join(out, 'canville.db').replace(/'/g, "''")}'`);
db.close();
fs.cpSync(path.join(DATA_DIR, 'files'), path.join(out, 'files'), { recursive: true });
console.log(`Respaldo creado en ${out}`);
