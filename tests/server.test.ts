import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

process.env.RATE_LIMIT = '1000';
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

const PDF = (t: string) => Buffer.from(`%PDF-1.4\n${t}`);
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
  const put = await call('PUT', `/ws/${ws}/files/archivo1234`, ownerTok, PDF('contenido'), { 'x-name': 'a.pdf', 'x-mime': 'application/pdf' });
  assert.equal(put.status, 200);
  const g = await call('GET', `/ws/${ws}/data`, ownerTok);
  g.json.data.docs = [{ id: 'd1', clientId: 'c1', category: 'Acuse', period: '2026-01', name: 'a.pdf', mime: 'application/pdf', size: 9, fileKey: 'archivo1234', status: 'Completo', createdAt: '', uploadedBy: 'despacho' },
    { id: 'd2', clientId: 'c2', category: 'Acuse', period: '2026-01', name: 'b.pdf', mime: '', size: 1, fileKey: 'archivo5678', status: 'Completo', createdAt: '', uploadedBy: 'despacho' }];
  assert.equal((await call('PUT', `/ws/${ws}/data`, ownerTok, { baseRev: g.json.rev, data: g.json.data })).status, 200);
  const d = await call('GET', `/ws/${ws}/files/archivo1234`, ownerTok);
  assert.ok(d.buf!.toString().endsWith('contenido'));
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

test('el portal es de solo consulta y descarga: el cliente no puede subir ni modificar nada', async () => {
  const up = await call('POST', `/ws/${ws}/portal/upload`, clientTok, Buffer.from('<?xml version="1.0"?><a/>'), { 'x-name': 'cfdi.xml', 'x-mime': 'text/xml', 'x-category': 'CFDI/Factura', 'x-period': '2026-02' });
  assert.equal(up.status, 403);
  assert.equal((await call('PUT', `/ws/${ws}/files/intento-sube1`, clientTok, PDF('x'), { 'x-name': 'x.pdf' })).status, 403);
  assert.equal((await call('DELETE', `/ws/${ws}/files/archivo1234`, clientTok)).status, 403);
  const o = await call('GET', `/ws/${ws}/data`, ownerTok);
  assert.ok(!o.json.data.docs.some((x: any) => x.uploadedBy === 'cliente'));
  assert.equal((await call('GET', `/ws/${ws}/files/archivo1234`, clientTok)).status, 200);   // descargar sí
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
  await call('PUT', `/ws/${w}/files/archivoXYZ1`, tok, PDF('x'), { 'x-name': 'a.pdf' });
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

test('subidas: contenido y extensión se validan; se calcula huella; nombres sin rutas', async () => {
  const o = await call('POST', '/auth/register', undefined, { email: 'valida@x.co', password: 'contraseña-larga-1' });
  const tok = o.json.token, w = o.json.memberships[0].workspaceId;
  const put = (key: string, body: Buffer, name: string) => call('PUT', `/ws/${w}/files/${key}`, tok, body, { 'x-name': encodeURIComponent(name) });
  assert.equal((await put('malo00001', Buffer.from('MZ\x90\x00 programa'), 'factura.pdf')).status, 415);      // ejecutable disfrazado de PDF
  assert.equal((await put('malo00002', PDF('x'), 'programa.exe')).status, 415);                              // extensión no permitida
  assert.equal((await put('malo00003', Buffer.from(''), 'vacio.pdf')).status, 415);
  assert.equal((await put('malo00004', Buffer.from('<script>alert(1)</script>'), 'x.svg')).status, 415);
  const ok = await put('bueno0001', PDF('hola'), '../../etc/pasa.pdf');
  assert.equal(ok.status, 200);
  assert.equal(ok.json.sha256, createHash('sha256').update(PDF('hola')).digest('hex'));
  assert.equal(ok.json.mime, 'application/pdf');
  assert.equal(fs.existsSync(path.join(process.env.DATA_DIR!, 'files', w, 'malo00001')), false);              // lo rechazado no se guarda
  const b = await call('GET', `/ws/${w}/backup`, tok);
  assert.equal(b.json.files.find((f: any) => f.key === 'bueno0001').name, 'pasa.pdf');                        // sin ../
});

test('portal: mínimo privilegio por defecto (sin nómina ni cifras), notas internas ocultas, módulos ajustables', async () => {
  const o = await call('POST', '/auth/register', undefined, { email: 'mod@x.co', password: 'contraseña-larga-1' });
  const tok = o.json.token, w = o.json.memberships[0].workspaceId;
  const g = await call('GET', `/ws/${w}/data`, tok);
  const d = g.json.data;
  d.clients = [{ id: 'k1', name: 'K1', rfc: '', email: '', phone: '', status: 'Activo', notes: 'NOTA INTERNA: cliente moroso' }, { id: 'k2', name: 'K2', rfc: '', email: '', phone: '', status: 'Activo', notes: '' }];
  d.payrolls = [{ id: 'n1', employee: 'Ana', clientId: 'k1', period: '2026-01', perceptionsCents: 100000, deductionsCents: 10000 }];
  d.movements = [{ id: 'm1', date: '2026-01-02', type: 'ingreso', concept: 'x', category: 'x', amountCents: 5000, clientId: 'k1' }];
  d.forecasts = [{ id: 'f1', concept: 'x', kind: 'cobro', amountCents: 100, dueDate: '2026-02-01', clientId: 'k1', category: 'x', status: 'Pendiente', note: '' }];
  d.docs = [
    { id: 'dn', clientId: 'k1', category: 'Nómina', period: '2026-01', name: 'recibo.pdf', mime: '', size: 1, fileKey: 'nomina0001', status: 'Completo', createdAt: '', uploadedBy: 'despacho' },
    { id: 'dc', clientId: 'k1', category: 'Acuse', period: '2026-01', name: 'acuse.pdf', mime: '', size: 1, fileKey: 'acuse00001', status: 'Completo', createdAt: '', uploadedBy: 'despacho' },
  ];
  await call('PUT', `/ws/${w}/files/nomina0001`, tok, PDF('recibo'), { 'x-name': 'recibo.pdf' });
  await call('PUT', `/ws/${w}/files/acuse00001`, tok, PDF('acuse'), { 'x-name': 'acuse.pdf' });
  assert.equal((await call('PUT', `/ws/${w}/data`, tok, { baseRev: g.json.rev, data: d })).status, 200);

  const inv = await call('POST', `/ws/${w}/invites`, tok, { email: 'cli-mod@x.co', clientId: 'k1' });          // sin módulos: mínimo
  assert.deepEqual(inv.json.modules, ['documentos', 'proyectos', 'tareas']);
  const c = await call('POST', '/auth/register', undefined, { email: 'cli-mod@x.co', password: 'contraseña-larga-1', inviteCode: inv.json.code });
  const ct = c.json.token;
  let v = await call('GET', `/ws/${w}/data`, ct);
  assert.deepEqual(v.json.modules, ['documentos', 'proyectos', 'tareas']);
  assert.equal(v.json.data.payrolls.length, 0);                                    // nómina: nunca por defecto
  assert.equal(v.json.data.movements.length, 0);
  assert.equal(v.json.data.forecasts.length, 0);
  assert.deepEqual(v.json.data.docs.map((x: any) => x.id), ['dc']);                // el recibo de nómina tampoco
  assert.equal(v.json.data.clients[0].notes, '');                                  // notas internas ocultas
  assert.ok(!JSON.stringify(v.json).includes('NOTA INTERNA'));
  assert.ok(!JSON.stringify(v.json).includes('Ana'));                              // ni el nombre del empleado en el JSON
  assert.equal((await call('GET', `/ws/${w}/files/nomina0001`, ct)).status, 404);  // IDOR: descarga directa por clave
  assert.equal((await call('GET', `/ws/${w}/files/acuse00001`, ct)).status, 200);
  assert.equal((await call('POST', `/ws/${w}/portal/upload`, ct, PDF('x'), { 'x-name': 'n.pdf', 'x-category': 'N%C3%B3mina' })).status, 403);   // el cliente nunca sube

  // el propietario abre módulos: efecto inmediato
  const set = await call('PUT', `/ws/${w}/invites/${encodeURIComponent('cli-mod@x.co')}/modules`, tok, { modules: ['documentos', 'nominas', 'movimientos', 'basura'] });
  assert.deepEqual(set.json.modules, ['documentos', 'movimientos', 'nominas']);    // valores desconocidos descartados
  v = await call('GET', `/ws/${w}/data`, ct);
  assert.equal(v.json.data.payrolls.length, 1);
  assert.equal(v.json.data.movements.length, 1);
  assert.deepEqual(v.json.data.docs.map((x: any) => x.id).sort(), ['dc', 'dn']);
  assert.equal((await call('GET', `/ws/${w}/files/nomina0001`, ct)).status, 200);
  assert.equal(v.json.data.clients.length, 1);                                     // sigue sin ver a k2
  // y los cierra
  await call('PUT', `/ws/${w}/invites/${encodeURIComponent('cli-mod@x.co')}/modules`, tok, { modules: ['tareas'] });
  assert.equal((await call('GET', `/ws/${w}/files/acuse00001`, ct)).status, 404);
  assert.equal((await call('PUT', `/ws/${w}/invites/nadie%40x.co/modules`, tok, { modules: [] })).status, 404);
  const lst = await call('GET', `/ws/${w}/invites`, tok);
  assert.deepEqual(lst.json.members.find((m: any) => m.email === 'cli-mod@x.co').modules, ['tareas']);
});

test('membresías anteriores sin módulos guardados reciben el mínimo (no el acceso amplio)', async () => {
  const o = await call('POST', '/auth/register', undefined, { email: 'legado@x.co', password: 'contraseña-larga-1' });
  const tok = o.json.token, w = o.json.memberships[0].workspaceId;
  const g = await call('GET', `/ws/${w}/data`, tok);
  g.json.data.clients = [{ id: 'k1', name: 'K', rfc: '', email: '', phone: '', status: 'Activo', notes: '' }];
  g.json.data.payrolls = [{ id: 'n1', employee: 'Ana', clientId: 'k1', period: '2026-01', perceptionsCents: 1, deductionsCents: 0 }];
  await call('PUT', `/ws/${w}/data`, tok, { baseRev: g.json.rev, data: g.json.data });
  const inv = await call('POST', `/ws/${w}/invites`, tok, { email: 'viejo@x.co', clientId: 'k1' });
  const c = await call('POST', '/auth/register', undefined, { email: 'viejo@x.co', password: 'contraseña-larga-1', inviteCode: inv.json.code });
  const db = new DatabaseSync(path.join(process.env.DATA_DIR!, 'canville.db'));
  db.exec("UPDATE members SET modules=NULL WHERE role='cliente'");                  // simula una fila creada antes de esta versión
  db.close();
  const v = await call('GET', `/ws/${w}/data`, c.json.token);
  assert.equal(v.json.data.payrolls.length, 0);
});

test('roles del equipo y trabajador: cada uno ve y escribe solo lo suyo (servidor)', async () => {
  const o = await call('POST', '/auth/register', undefined, { email: 'jefa@x.co', password: 'contraseña-larga-1', workspaceName: 'Roles' });
  const tok = o.json.token, w = o.json.memberships[0].workspaceId;
  const emp = (id: string, name: string) => ({ id, clientId: 'k1', numEmpleado: id, name, rfc: '', curp: '', nss: '', birthDate: '', email: '', phone: '', address: '', cp: '', hireDate: '', endDate: '', status: 'Activo', puesto: '', departamento: '', contractType: '01', jornada: '01', periodicidad: '05', regimen: '02', entidad: '', dailySalaryCents: 1, sbcDailyCents: 1, bank: '', clabe: '', infonavitType: '', infonavitValue: '', infonavitCredit: '', notes: '' });
  const g = await call('GET', `/ws/${w}/data`, tok);
  const d = g.json.data;
  d.clients = [{ id: 'k1', name: 'K1', rfc: 'AAA010101AAA', email: '', phone: '', status: 'Activo', notes: 'NOTA INTERNA' }];
  d.employees = [emp('e1', 'Ana Secreta'), emp('e2', 'Beto Reservado')];
  d.payrolls = [{ id: 'p1', employee: 'Ana Secreta', employeeId: 'e1', clientId: 'k1', period: '2026-10', perceptionsCents: 100000, deductionsCents: 10000 }, { id: 'p2', employee: 'Beto Reservado', employeeId: 'e2', clientId: 'k1', period: '2026-10', perceptionsCents: 200000, deductionsCents: 20000 }];
  d.movements = [{ id: 'm1', date: '2026-10-01', type: 'ingreso', concept: 'x', category: 'x', amountCents: 5000, clientId: 'k1' }];
  d.docs = [
    { id: 'r1', clientId: 'k1', category: 'Nómina', period: '2026-10', name: 'ana.xml', mime: '', size: 1, fileKey: 'recibo-ana1', status: 'Completo', createdAt: '', uploadedBy: 'despacho', employeeId: 'e1' },
    { id: 'r2', clientId: 'k1', category: 'Nómina', period: '2026-10', name: 'beto.xml', mime: '', size: 1, fileKey: 'recibo-beto', status: 'Completo', createdAt: '', uploadedBy: 'despacho', employeeId: 'e2' },
    { id: 'ac', clientId: 'k1', category: 'Acuse', period: '2026-10', name: 'acuse.pdf', mime: '', size: 1, fileKey: 'acuse-roles', status: 'Completo', createdAt: '', uploadedBy: 'despacho' },
  ];
  await call('PUT', `/ws/${w}/files/recibo-ana1`, tok, Buffer.from('<?xml version="1.0"?><a/>'), { 'x-name': 'ana.xml' });
  await call('PUT', `/ws/${w}/files/recibo-beto`, tok, Buffer.from('<?xml version="1.0"?><b/>'), { 'x-name': 'beto.xml' });
  await call('PUT', `/ws/${w}/files/acuse-roles`, tok, PDF('acuse'), { 'x-name': 'acuse.pdf' });
  assert.equal((await call('PUT', `/ws/${w}/data`, tok, { baseRev: g.json.rev, data: d })).status, 200);

  const join = async (email: string, body: object) => {
    const inv = await call('POST', `/ws/${w}/invites`, tok, { email, ...body });
    assert.equal(inv.status, 200, JSON.stringify(inv.json));
    const r = await call('POST', '/auth/register', undefined, { email, password: 'contraseña-larga-1', inviteCode: inv.json.code });
    assert.equal(r.status, 200);
    return { token: r.json.token as string, role: r.json.memberships[0].role as string };
  };
  assert.equal((await call('POST', `/ws/${w}/invites`, tok, { email: 'mal@x.co', role: 'superadmin' })).status, 400);
  assert.equal((await call('POST', `/ws/${w}/invites`, tok, { email: 'mal@x.co', role: 'empleado', employeeId: 'nadie' })).status, 400);

  // --- responsable de nómina
  const nom = await join('nomina@x.co', { role: 'nomina', clientScope: 'all' });
  assert.equal(nom.role, 'nomina');
  let v = await call('GET', `/ws/${w}/data`, nom.token);
  assert.equal(v.json.data.payrolls.length, 2);
  assert.equal(v.json.data.movements.length, 0);
  assert.equal(v.json.data.clients[0].notes, '');
  assert.deepEqual(v.json.data.docs.map((x: any) => x.id).sort(), ['r1', 'r2']);
  const edited = v.json.data.payrolls.map((p: any) => (p.id === 'p1' ? { ...p, perceptionsCents: 123456 } : p));
  assert.equal((await call('PUT', `/ws/${w}/data`, nom.token, { baseRev: v.json.rev, data: { payrolls: edited } })).status, 200);
  let full = await call('GET', `/ws/${w}/data`, tok);
  assert.equal(full.json.data.payrolls.find((p: any) => p.id === 'p1').perceptionsCents, 123456);
  assert.equal(full.json.data.movements.length, 1);                              // lo que no ve, intacto
  assert.equal(full.json.data.clients[0].notes, 'NOTA INTERNA');
  assert.equal(full.json.data.docs.length, 3);
  v = await call('GET', `/ws/${w}/data`, nom.token);
  assert.equal((await call('PUT', `/ws/${w}/data`, nom.token, { baseRev: v.json.rev, data: { movements: [{ id: 'm9', date: '2026-10-02', type: 'gasto', concept: 'x', category: 'x', amountCents: 1, clientId: 'k1' }] } })).status, 403);
  const acuseAsNomina = { id: 'x1', clientId: 'k1', category: 'Acuse', period: '', name: 'a.pdf', mime: '', size: 1, fileKey: 'zzzzzzz1', status: 'Completo', createdAt: '', uploadedBy: 'despacho' };
  assert.equal((await call('PUT', `/ws/${w}/data`, nom.token, { baseRev: v.json.rev, data: { docs: [...v.json.data.docs, acuseAsNomina] } })).status, 403);   // no escribe documentos que no son de nómina
  assert.equal((await call('PUT', `/ws/${w}/files/nuevo-recib1`, nom.token, Buffer.from('<?xml version="1.0"?><c/>'), { 'x-name': 'c.xml' })).status, 200);
  assert.equal((await call('GET', `/ws/${w}/files/acuse-roles`, nom.token)).status, 404);        // el acuse no es de nómina
  assert.equal((await call('GET', `/ws/${w}/invites`, nom.token)).status, 403);                  // no administra accesos
  assert.equal((await call('GET', `/ws/${w}/backup`, nom.token)).status, 403);

  // --- administrador interno: sin nómina
  const adm = await join('admin@x.co', { role: 'administrador', clientScope: 'all' });
  v = await call('GET', `/ws/${w}/data`, adm.token);
  assert.equal(v.json.data.payrolls.length, 0); assert.equal(v.json.data.employees.length, 0);
  assert.equal(v.json.data.movements.length, 1);
  assert.deepEqual(v.json.data.docs.map((x: any) => x.id), ['ac']);
  assert.ok(!JSON.stringify(v.json).includes('Ana Secreta'));
  assert.equal((await call('GET', `/ws/${w}/files/recibo-ana1`, adm.token)).status, 404);
  assert.equal((await call('PUT', `/ws/${w}/data`, adm.token, { baseRev: v.json.rev, data: { payrolls: [{ id: 'p1', employee: 'x', clientId: 'k1', period: '2026-10', perceptionsCents: 1, deductionsCents: 0 }] } })).status, 403);
  assert.equal((await call('PUT', `/ws/${w}/data`, adm.token, { baseRev: v.json.rev, data: { tasks: [{ id: 't1', title: 'Llamar', clientId: 'k1', projectId: '', due: '', done: false }] } })).status, 200);
  full = await call('GET', `/ws/${w}/data`, tok);
  assert.equal(full.json.data.payrolls.length, 2);                                                // la nómina sobrevive al guardado del administrador
  assert.equal(full.json.data.tasks.length, 1);

  // --- trabajador: solo lo suyo
  const emp1 = await join('ana@x.co', { role: 'empleado', employeeId: 'e1' });
  assert.equal(emp1.role, 'empleado');
  v = await call('GET', `/ws/${w}/data`, emp1.token);
  assert.deepEqual(v.json.data.employees.map((e: any) => e.id), ['e1']);
  assert.deepEqual(v.json.data.payrolls.map((p: any) => p.id), ['p1']);
  assert.deepEqual(v.json.data.docs.map((x: any) => x.id), ['r1']);
  assert.equal(v.json.data.movements.length + v.json.data.tasks.length, 0);
  assert.ok(!JSON.stringify(v.json).includes('Beto Reservado'));
  assert.ok(!JSON.stringify(v.json).includes('NOTA INTERNA'));
  assert.equal((await call('GET', `/ws/${w}/files/recibo-ana1`, emp1.token)).status, 200);
  assert.equal((await call('GET', `/ws/${w}/files/recibo-beto`, emp1.token)).status, 404);        // el recibo de otro trabajador
  assert.equal((await call('PUT', `/ws/${w}/data`, emp1.token, { baseRev: v.json.rev, data: { payrolls: [] } })).status, 403);
  assert.equal((await call('PUT', `/ws/${w}/files/hack-hack1`, emp1.token, PDF('x'), { 'x-name': 'x.pdf' })).status, 403);
  assert.equal((await call('POST', `/ws/${w}/portal/upload`, emp1.token, PDF('x'), { 'x-name': 'x.pdf' })).status, 403);

  // --- el listado de accesos y la revocación
  const lst = await call('GET', `/ws/${w}/invites`, tok);
  assert.deepEqual(lst.json.members.map((m: any) => m.role).sort(), ['administrador', 'empleado', 'nomina']);
  assert.equal((await call('DELETE', `/ws/${w}/invites/${encodeURIComponent('ana@x.co')}`, tok)).status, 200);
  assert.equal((await call('GET', `/ws/${w}/data`, emp1.token)).status, 404);
});

test('alcance por cliente en el equipo: sin asignación se rechaza; asignado a uno no ve ni descarga el otro', async () => {
  const o = await call('POST', '/auth/register', undefined, { email: 'alcance@x.co', password: 'contraseña-larga-1', workspaceName: 'Alcance' });
  const tok = o.json.token, w = o.json.memberships[0].workspaceId;
  const emp = (id: string, clientId: string, name: string) => ({ id, clientId, numEmpleado: id, name, rfc: '', curp: '', nss: '', birthDate: '', email: '', phone: '', address: '', cp: '', hireDate: '', endDate: '', status: 'Activo', puesto: '', departamento: '', contractType: '01', jornada: '01', periodicidad: '05', regimen: '02', entidad: '', dailySalaryCents: 1, sbcDailyCents: 1, bank: '', clabe: '', infonavitType: '', infonavitValue: '', infonavitCredit: '', notes: '' });
  const g = await call('GET', `/ws/${w}/data`, tok);
  const d = g.json.data;
  d.clients = [{ id: 'a1', name: 'Cliente A', rfc: '', email: '', phone: '', status: 'Activo', notes: '' }, { id: 'b2', name: 'Cliente B', rfc: '', email: '', phone: '', status: 'Activo', notes: '' }];
  d.employees = [emp('ea', 'a1', 'Trabajador De A'), emp('eb', 'b2', 'Trabajador De B')];
  d.payrolls = [{ id: 'pa', employee: 'Trabajador De A', employeeId: 'ea', clientId: 'a1', period: '2026-10', perceptionsCents: 1, deductionsCents: 0 }, { id: 'pb', employee: 'Trabajador De B', employeeId: 'eb', clientId: 'b2', period: '2026-10', perceptionsCents: 2, deductionsCents: 0 }];
  d.docs = [
    { id: 'da', clientId: 'a1', category: 'Nómina', period: '', name: 'a.xml', mime: '', size: 1, fileKey: 'recibo-de-a1', status: 'Completo', createdAt: '', uploadedBy: 'despacho', employeeId: 'ea' },
    { id: 'db', clientId: 'b2', category: 'Nómina', period: '', name: 'b.xml', mime: '', size: 1, fileKey: 'recibo-de-b2', status: 'Completo', createdAt: '', uploadedBy: 'despacho', employeeId: 'eb' },
  ];
  await call('PUT', `/ws/${w}/files/recibo-de-a1`, tok, Buffer.from('<?xml version="1.0"?><a/>'), { 'x-name': 'a.xml' });
  await call('PUT', `/ws/${w}/files/recibo-de-b2`, tok, Buffer.from('<?xml version="1.0"?><b/>'), { 'x-name': 'b.xml' });
  assert.equal((await call('PUT', `/ws/${w}/data`, tok, { baseRev: g.json.rev, data: d })).status, 200);

  assert.equal((await call('POST', `/ws/${w}/invites`, tok, { email: 'sin@x.co', role: 'nomina' })).status, 400);                      // sin asignación: no se invita
  assert.equal((await call('POST', `/ws/${w}/invites`, tok, { email: 'sin@x.co', role: 'nomina', clientScope: ['inexistente'] })).status, 400);
  const inv = await call('POST', `/ws/${w}/invites`, tok, { email: 'soloa@x.co', role: 'nomina', clientScope: ['a1'] });
  assert.equal(inv.status, 200);
  const reg = await call('POST', '/auth/register', undefined, { email: 'soloa@x.co', password: 'contraseña-larga-1', inviteCode: inv.json.code });
  const t = reg.json.token;
  let v = await call('GET', `/ws/${w}/data`, t);
  assert.deepEqual(v.json.data.clients.map((c: any) => c.id), ['a1']);
  assert.deepEqual(v.json.data.payrolls.map((p: any) => p.id), ['pa']);
  assert.deepEqual(v.json.data.employees.map((e: any) => e.id), ['ea']);
  assert.ok(!JSON.stringify(v.json).includes('Trabajador De B'));
  assert.equal((await call('GET', `/ws/${w}/files/recibo-de-a1`, t)).status, 200);
  assert.equal((await call('GET', `/ws/${w}/files/recibo-de-b2`, t)).status, 404);                                                     // el recibo del otro cliente
  // no puede escribir en el cliente B ni colar su nómina
  assert.equal((await call('PUT', `/ws/${w}/data`, t, { baseRev: v.json.rev, data: { payrolls: [...v.json.data.payrolls, { id: 'nuevo', employee: 'x', clientId: 'b2', period: '2026-10', perceptionsCents: 1, deductionsCents: 0 }] } })).status, 403);
  assert.equal((await call('PUT', `/ws/${w}/data`, t, { baseRev: v.json.rev, data: { payrolls: [{ id: 'pb', employee: 'hackeo', clientId: 'a1', period: '2026-10', perceptionsCents: 9, deductionsCents: 0 }] } })).status, 403);   // sustituir la que no ve
  const mine = v.json.data.payrolls.map((p: any) => ({ ...p, perceptionsCents: 777 }));
  assert.equal((await call('PUT', `/ws/${w}/data`, t, { baseRev: v.json.rev, data: { payrolls: mine } })).status, 200);
  const full = await call('GET', `/ws/${w}/data`, tok);
  assert.equal(full.json.data.payrolls.find((p: any) => p.id === 'pb').perceptionsCents, 2);                                           // la del otro, intacta
  assert.equal(full.json.data.payrolls.find((p: any) => p.id === 'pa').perceptionsCents, 777);

  // el propietario amplía el alcance: efecto inmediato
  assert.equal((await call('PUT', `/ws/${w}/invites/${encodeURIComponent('soloa@x.co')}/scope`, tok, { clientScope: ['a1', 'b2'] })).status, 200);
  v = await call('GET', `/ws/${w}/data`, t);
  assert.deepEqual(v.json.data.payrolls.map((p: any) => p.id).sort(), ['pa', 'pb']);
  assert.equal((await call('PUT', `/ws/${w}/invites/${encodeURIComponent('soloa@x.co')}/scope`, tok, { clientScope: [] })).status, 400);
  assert.equal((await call('PUT', `/ws/${w}/invites/${encodeURIComponent('soloa@x.co')}/scope`, t, { clientScope: 'all' })).status, 403);   // solo el propietario
  const lst = await call('GET', `/ws/${w}/invites`, tok);
  assert.deepEqual(lst.json.members.find((m: any) => m.email === 'soloa@x.co').scope, ['a1', 'b2']);
  // la lectura de nómina por parte del equipo queda en la bitácora (sin saturarla: una vez por persona cada 10 min)
  await call('GET', `/ws/${w}/data`, t);
  const au = await call('GET', `/ws/${w}/audit`, tok);
  assert.equal(au.json.filter((x: any) => x.action === 'payroll.read').length, 1);
  assert.ok(au.json.some((x: any) => x.action === 'access.scope'));
});
