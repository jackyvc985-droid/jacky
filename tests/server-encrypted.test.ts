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

import { spawnSync } from 'node:child_process';
import { checkKeyAtStartup, decrypt, encrypt, fingerprint, parseKey } from '../server/crypto.ts';
import { rekey } from '../server/rekey.ts';

const newKey = () => crypto.randomBytes(32);

test('arranque seguro: crea la marca de clave, rechaza una clave equivocada y rechaza arrancar sin clave', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canville-key-'));
  const A = newKey(), B = newKey();
  assert.ok(checkKeyAtStartup(dir, null, fs, path).startsWith('SIN cifrado'));
  assert.equal(fs.existsSync(path.join(dir, '.key-check')), false);
  assert.ok(checkKeyAtStartup(dir, A, fs, path).includes(fingerprint(A)));
  assert.ok(checkKeyAtStartup(dir, A, fs, path).includes('cifrado activo'));       // mismo arranque otra vez: ok
  assert.throws(() => checkKeyAtStartup(dir, B, fs, path), /no corresponde/);       // clave equivocada
  assert.throws(() => checkKeyAtStartup(dir, null, fs, path), /falta DATA_KEY/);    // sin clave en un servidor que ya cifra
  assert.throws(() => parseKey('corta'), /32 bytes/);
  assert.notEqual(fingerprint(A), fingerprint(B));
  assert.equal(fingerprint(A).length, 8);
  // la marca no revela la clave y no se puede leer con otra
  const mark = fs.readFileSync(path.join(dir, '.key-check'));
  assert.ok(!mark.includes(A));
  assert.throws(() => decrypt(B, mark));
});

test('arranque real del servidor: con la clave correcta inicia; con otra o sin clave se detiene con un mensaje claro', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canville-boot-'));
  const run = (key?: string) => spawnSync(process.execPath, ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', '--input-type=module', '-e', `await import(${JSON.stringify(new URL('../server/index.ts', import.meta.url).href)})`], { env: { ...process.env, DATA_DIR: dir, DATA_KEY: key ?? '' }, encoding: 'utf8', timeout: 30000 });
  const A = newKey().toString('base64'), B = newKey().toString('base64');
  assert.equal(run(A).status, 0);
  const wrong = run(B);
  assert.notEqual(wrong.status, 0);
  assert.match(wrong.stderr, /no corresponde a la clave/);
  const none = run();
  assert.notEqual(none.status, 0);
  assert.match(none.stderr, /falta DATA_KEY/);
  assert.equal(run(A).status, 0);                                                    // la correcta sigue funcionando
});

test('cambio de clave: todo se recifra, la anterior deja de servir y se puede activar el cifrado en datos sin cifrar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'canville-rekey-'));
  fs.mkdirSync(path.join(dir, 'files', 'w1'), { recursive: true });
  const db = new DatabaseSync(path.join(dir, 'canville.db'));
  db.exec('CREATE TABLE workspaces(id TEXT PRIMARY KEY, name TEXT, rev INTEGER, data TEXT, created_at TEXT)');
  db.prepare('INSERT INTO workspaces VALUES(?,?,?,?,?)').run('w1', 'x', 1, '{"employees":[{"name":"Ana Secreta"}]}', '');   // sin cifrar
  db.close();
  fs.writeFileSync(path.join(dir, 'files', 'w1', 'f1'), 'contenido del recibo');
  const A = newKey(), B = newKey();

  // 1) activar el cifrado sobre datos existentes
  assert.deepEqual(rekey(dir, null, A), { workspaces: 1, files: 1 });
  let row = (() => { const d = new DatabaseSync(path.join(dir, 'canville.db')); const r = d.prepare('SELECT data FROM workspaces').get() as { data: string }; d.close(); return r.data; })();
  assert.ok(row.startsWith('enc1:') && !row.includes('Ana Secreta'));
  assert.equal(decrypt(A, fs.readFileSync(path.join(dir, 'files', 'w1', 'f1'))).toString(), 'contenido del recibo');
  assert.ok(checkKeyAtStartup(dir, A, fs, path).includes('cifrado activo'));

  // 2) cambiar de clave A → B
  assert.throws(() => rekey(dir, B, newKey()), /no corresponde/);                    // con una clave actual equivocada no toca nada
  assert.deepEqual(rekey(dir, A, B), { workspaces: 1, files: 1 });
  row = (() => { const d = new DatabaseSync(path.join(dir, 'canville.db')); const r = d.prepare('SELECT data FROM workspaces').get() as { data: string }; d.close(); return r.data; })();
  assert.equal(decrypt(B, Buffer.from(row.slice(5), 'base64')).toString(), '{"employees":[{"name":"Ana Secreta"}]}');
  assert.throws(() => decrypt(A, Buffer.from(row.slice(5), 'base64')));              // la clave anterior ya no sirve
  assert.throws(() => decrypt(A, fs.readFileSync(path.join(dir, 'files', 'w1', 'f1'))));
  assert.equal(decrypt(B, fs.readFileSync(path.join(dir, 'files', 'w1', 'f1'))).toString(), 'contenido del recibo');
  assert.ok(checkKeyAtStartup(dir, B, fs, path).includes(fingerprint(B)));
  assert.throws(() => checkKeyAtStartup(dir, A, fs, path), /no corresponde/);
  void encrypt;
});
