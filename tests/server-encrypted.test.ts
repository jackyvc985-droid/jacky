import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

process.env.RATE_LIMIT = '1000';
process.env.DATA_KEY = crypto.randomBytes(32).toString('base64');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'canville-enc-'));
const { createServer } = await import('../server/index.ts');
const srv = createServer();
let base = '';
before(() => new Promise<void>(r => srv.listen(0, () => { base = `http://127.0.0.1:${(srv.address() as any).port}`; r(); })));
after(() => { srv.close(); });
const call = async (method: string, p: string, token?: string, body?: unknown, headers: Record<string, string> = {}) => {
  const raw = body instanceof Buffer;
  const r = await fetch(base + p, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body && !raw ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? (raw ? body : JSON.stringify(body)) : undefined });
  const ct = r.headers.get('content-type') ?? '';
  return { status: r.status, cache: r.headers.get('cache-control'), json: ct.includes('json') ? await r.json() : null, buf: ct.includes('json') ? null : Buffer.from(await r.arrayBuffer()) };
};

test('cifrado en reposo: la base y los archivos no contienen texto legible, y la API sigue funcionando', async () => {
  assert.equal((await call('GET', '/health')).json.encrypted, true);
  const o = await call('POST', '/auth/register', undefined, { email: 'cifra@x.co', password: 'contraseña-larga-1', workspaceName: 'Cifrado' });
  const tok = o.json.token, w = o.json.memberships[0].workspaceId;
  const g = await call('GET', `/ws/${w}/data`, tok);
  assert.equal(g.cache, 'private, no-store');                                   // datos fiscales: nunca en caché
  const d = g.json.data;
  d.clients = [{ id: 'k1', name: 'Empresa Reservada SA', rfc: 'AAA010101AAA', email: '', phone: '', status: 'Activo', notes: '' }];
  d.employees = [{ id: 'e1', clientId: 'k1', name: 'Ana Secreta Gómez', curp: 'SECA900101MDFRRN01', clabe: '002010077777777771' }];
  d.docs = [{ id: 'r1', clientId: 'k1', category: 'Nómina', period: '', name: 'recibo.xml', mime: '', size: 1, fileKey: 'recibo-cifrado', status: 'Completo', createdAt: '', uploadedBy: 'despacho', employeeId: 'e1' }];
  await call('PUT', `/ws/${w}/files/recibo-cifrado`, tok, Buffer.from('<?xml version="1.0"?><Comprobante Total="9999.99" Nombre="ANA SECRETA"/>'), { 'x-name': 'recibo.xml' });
  assert.equal((await call('PUT', `/ws/${w}/data`, tok, { baseRev: g.json.rev, data: d })).status, 200);

  // por la API todo se lee normal
  const back = await call('GET', `/ws/${w}/data`, tok);
  assert.equal(back.json.data.employees[0].name, 'Ana Secreta Gómez');
  const file = await call('GET', `/ws/${w}/files/recibo-cifrado`, tok);
  assert.ok(file.buf!.toString().includes('ANA SECRETA'));

  // pero en disco no hay nada legible
  const dir = process.env.DATA_DIR!;
  const db = new DatabaseSync(path.join(dir, 'canville.db'));
  const row = db.prepare('SELECT data FROM workspaces WHERE id=?').get(w) as { data: string };
  db.close();
  assert.ok(row.data.startsWith('enc1:'));
  assert.ok(!row.data.includes('Ana Secreta') && !Buffer.from(row.data.slice(5), 'base64').toString('latin1').includes('Ana Secreta'));
  const onDisk = fs.readFileSync(path.join(dir, 'files', w, 'recibo-cifrado'));
  assert.equal(onDisk.subarray(0, 6).toString(), 'CVENC1');
  assert.ok(!onDisk.toString('latin1').includes('ANA SECRETA') && !onDisk.toString('latin1').includes('9999.99'));
  const raw = fs.readFileSync(path.join(dir, 'canville.db'), 'latin1') + fs.readFileSync(path.join(dir, 'canville.db-wal'), 'latin1').toString();
  assert.ok(!raw.includes('Ana Secreta Gómez') && !raw.includes('002010077777777771'));   // ni en el archivo de la base (ni su registro WAL)

  // una alteración del archivo cifrado se detecta (no se entrega basura)
  const tampered = Buffer.from(onDisk); tampered[tampered.length - 1] ^= 1;
  fs.writeFileSync(path.join(dir, 'files', w, 'recibo-cifrado'), tampered);
  assert.equal((await call('GET', `/ws/${w}/files/recibo-cifrado`, tok)).status, 500);
});
