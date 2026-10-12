import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'canville-'));
const { createServer } = await import('../server/index.ts');
const srv = createServer();
let base = '';
before(() => new Promise<void>(r => srv.listen(0, () => { base = `http://127.0.0.1:${(srv.address() as any).port}`; r(); })));
after(() => { srv.close(); });

const call = async (method: string, p: string, token?: string, body?: unknown, headers: Record<string, string> = {}) => {
  const raw = body instanceof Buffer;
  const r = await fetch(base + p, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body && !raw ? { 'content-type': 'application/json' } : {}), ...headers }, body: body ? (raw ? body : JSON.stringify(body)) : undefined });
  const ct = r.headers.get('content-type') ?? '';
  return { status: r.status, json: ct.includes('json') ? await r.json() : null, buf: ct.includes('json') ? null : Buffer.from(await r.arrayBuffer()) };
};

let ownerTok = '', ws = '', clientTok = '';

test('registro, login y rechazo sin sesión', async () => {
  assert.equal((await call('GET', '/ws/x/data')).status, 401);
  assert.equal((await call('POST', '/auth/register', undefined, { email: 'a@b.co', password: 'corta' })).status, 400);
  const r = await call('POST', '/auth/register', undefined, { email: 'dueno@x.co', password: 'contraseña-larga-1', workspaceName: 'Despacho' });
  assert.equal(r.status, 200);
  ownerTok = r.json.token; ws = r.json.memberships[0].workspaceId;
  assert.equal(r.json.memberships[0].role, 'propietario');
  assert.equal((await call('POST', '/auth/login', undefined, { email: 'dueno@x.co', password: 'mala' })).status, 401);
  assert.equal((await call('POST', '/auth/login', undefined, { email: 'dueno@x.co', password: 'contraseña-larga-1' })).status, 200);
});

test('revisión optimista: el segundo guardado con revisión vieja recibe 409', async () => {
  const g = await call('GET', `/ws/${ws}/data`, ownerTok);
  const data = g.json.data;
  data.clients = [{ id: 'c1', name: 'Uno', rfc: '', email: '', phone: '', status: 'Activo', notes: '' }, { id: 'c2', name: 'Dos', rfc: '', email: '', phone: '', status: 'Activo', notes: '' }];
  const ok = await call('PUT', `/ws/${ws}/data`, ownerTok, { baseRev: g.json.rev, data });
  assert.equal(ok.status, 200);
  const stale = await call('PUT', `/ws/${ws}/data`, ownerTok, { baseRev: g.json.rev, data });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.rev, g.json.rev + 1);
});

test('archivos: propietario sube; documento indexado; descarga con autorización', async () => {
  const put = await call('PUT', `/ws/${ws}/files/archivo1234`, ownerTok, Buffer.from('contenido'), { 'x-name': 'a.pdf', 'x-mime': 'application/pdf' });
  assert.equal(put.status, 200);
  const g = await call('GET', `/ws/${ws}/data`, ownerTok);
  g.json.data.docs = [{ id: 'd1', clientId: 'c1', category: 'Acuse', period: '2026-01', name: 'a.pdf', mime: 'application/pdf', size: 9, fileKey: 'archivo1234', status: 'Completo', createdAt: '', uploadedBy: 'despacho' },
    { id: 'd2', clientId: 'c2', category: 'Acuse', period: '2026-01', name: 'b.pdf', mime: '', size: 1, fileKey: 'archivo5678', status: 'Completo', createdAt: '', uploadedBy: 'despacho' }];
  assert.equal((await call('PUT', `/ws/${ws}/data`, ownerTok, { baseRev: g.json.rev, data: g.json.data })).status, 200);
  const d = await call('GET', `/ws/${ws}/files/archivo1234`, ownerTok);
  assert.equal(d.buf!.toString(), 'contenido');
});

test('portal: invitación con código, vista filtrada, sin escritura, sin ver otros expedientes', async () => {
  const inv = await call('POST', `/ws/${ws}/invites`, ownerTok, { email: 'cli@x.co', clientId: 'c1' });
  assert.equal(inv.status, 200);
  // otro correo no puede usar el código
  assert.equal((await call('POST', '/auth/register', undefined, { email: 'intruso@x.co', password: 'contraseña-larga-1', inviteCode: inv.json.code })).status, 400);
  const reg = await call('POST', '/auth/register', undefined, { email: 'cli@x.co', password: 'contraseña-larga-1', inviteCode: inv.json.code });
  assert.equal(reg.status, 200);
  clientTok = reg.json.token;
  assert.equal(reg.json.memberships[0].role, 'cliente');
  // el código es de un solo uso
  assert.equal((await call('POST', '/auth/register', undefined, { email: 'cli@x.co', password: 'contraseña-larga-1', inviteCode: inv.json.code })).status, 409);

  const v = await call('GET', `/ws/${ws}/data`, clientTok);
  assert.deepEqual(v.json.data.clients.map((c: any) => c.id), ['c1']);
  assert.deepEqual(v.json.data.docs.map((x: any) => x.id), ['d1']);
  assert.equal((await call('PUT', `/ws/${ws}/data`, clientTok, { baseRev: v.json.rev, data: {} })).status, 403);
  assert.equal((await call('GET', `/ws/${ws}/files/archivo1234`, clientTok)).status, 200);
  assert.equal((await call('GET', `/ws/${ws}/files/archivo5678`, clientTok)).status, 404);
  assert.equal((await call('GET', `/ws/${ws}/invites`, clientTok)).status, 403);
  assert.equal((await call('GET', `/ws/${ws}/audit`, clientTok)).status, 403);
});

test('el cliente sube a su expediente y queda En revisión', async () => {
  const up = await call('POST', `/ws/${ws}/portal/upload`, clientTok, Buffer.from('xyz'), { 'x-name': 'cfdi.xml', 'x-mime': 'text/xml', 'x-category': 'CFDI/Factura', 'x-period': '2026-02' });
  assert.equal(up.status, 200);
  assert.equal(up.json.doc.status, 'En revisión');
  assert.equal(up.json.doc.clientId, 'c1');
  const o = await call('GET', `/ws/${ws}/data`, ownerTok);
  assert.ok(o.json.data.docs.some((x: any) => x.uploadedBy === 'cliente' && x.clientId === 'c1'));
});

test('revocar acceso corta el portal; auditoría y respaldo solo para el propietario', async () => {
  assert.equal((await call('DELETE', `/ws/${ws}/invites/${encodeURIComponent('cli@x.co')}`, ownerTok)).status, 200);
  assert.equal((await call('GET', `/ws/${ws}/data`, clientTok)).status, 404);
  const a = await call('GET', `/ws/${ws}/audit`, ownerTok);
  assert.ok(a.json.some((x: any) => x.action === 'invite.revoked'));
  const b = await call('GET', `/ws/${ws}/backup`, ownerTok);
  assert.ok(b.json.data.clients.length === 2 && b.json.files.length >= 1);
});

test('eliminación física de archivos', async () => {
  assert.equal((await call('DELETE', `/ws/${ws}/files/archivo1234`, ownerTok)).status, 200);
  assert.equal(fs.existsSync(path.join(process.env.DATA_DIR!, 'files', ws, 'archivo1234')), false);
});

test('otro propietario no ve el espacio ajeno', async () => {
  const r = await call('POST', '/auth/register', undefined, { email: 'otro@x.co', password: 'contraseña-larga-1' });
  assert.equal((await call('GET', `/ws/${ws}/data`, r.json.token)).status, 404);
});

test('eliminación de cuenta: exige contraseña; cliente sale sin tocar al despacho; propietario borra espacio y archivos', async () => {
  const o = await call('POST', '/auth/register', undefined, { email: 'borrar@x.co', password: 'contraseña-larga-1', workspaceName: 'Temporal' });
  const tok = o.json.token, w = o.json.memberships[0].workspaceId;
  const g = await call('GET', `/ws/${w}/data`, tok);
  g.json.data.clients = [{ id: 'k1', name: 'K', rfc: '', email: '', phone: '', status: 'Activo', notes: '' }];
  await call('PUT', `/ws/${w}/data`, tok, { baseRev: g.json.rev, data: g.json.data });
  await call('PUT', `/ws/${w}/files/archivoXYZ1`, tok, Buffer.from('x'), { 'x-name': 'a' });
  const inv = await call('POST', `/ws/${w}/invites`, tok, { email: 'cli-borra@x.co', clientId: 'k1' });
  const c = await call('POST', '/auth/register', undefined, { email: 'cli-borra@x.co', password: 'contraseña-larga-1', inviteCode: inv.json.code });

  assert.equal((await call('DELETE', '/me', c.json.token, { password: 'incorrecta' })).status, 401);
  assert.equal((await call('DELETE', '/me', c.json.token, { password: 'contraseña-larga-1' })).status, 200);
  assert.equal((await call('GET', '/me', c.json.token)).status, 401);            // su sesión murió
  assert.equal((await call('GET', `/ws/${w}/data`, tok)).status, 200);            // el despacho sigue intacto
  assert.equal((await call('POST', '/auth/login', undefined, { email: 'cli-borra@x.co', password: 'contraseña-larga-1' })).status, 401);

  const noConfirm = await call('DELETE', '/me', tok, { password: 'contraseña-larga-1' });
  assert.equal(noConfirm.status, 409);                                            // pide confirmar la eliminación de espacios
  assert.equal((await call('GET', `/ws/${w}/data`, tok)).status, 200);
  assert.equal((await call('DELETE', '/me', tok, { password: 'contraseña-larga-1', deleteOwnedWorkspaces: true })).status, 200);
  assert.equal(fs.existsSync(path.join(process.env.DATA_DIR!, 'files', w)), false);
  assert.equal((await call('GET', `/ws/${w}/data`, tok)).status, 401);
});
