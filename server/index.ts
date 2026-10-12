import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseModules, sanitizeModules } from '../src/domain/permissions.ts';
import { validateUpload, safeFileName } from '../src/domain/uploads.ts';
import { INVITABLE_ROLES, STAFF_ROLES, authorizeWrite, canWrite, canWriteDoc, parseScope, viewFor } from '../src/domain/roles.ts';
import type { Member, RoleId } from '../src/domain/roles.ts';
import { emptyData } from '../src/domain/types.ts';
import type { Data } from '../src/domain/types.ts';
import { consultaSat } from './sat.ts';
import { checkKeyAtStartup, decrypt, encrypt, parseKey } from './crypto.ts';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'server-data');
const PORT = Number(process.env.PORT ?? 8787);
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? '*').split(',').map((s: string) => s.trim());
const RATE_LIMIT = Number(process.env.RATE_LIMIT ?? 10); // intentos por 15 min (registro, inicio de sesión, borrado)
const MAX_JSON = 20 * 1024 * 1024, MAX_FILE = 25 * 1024 * 1024, SESSION_DAYS = 30, ORPHAN_GRACE_MS = 3600_000;

// Cifrado en reposo (AES-256-GCM) de los datos del espacio y de los archivos. Clave: DATA_KEY (32 bytes en base64).
// Quien opere el servidor guarda la clave aparte de los respaldos: sin ella, lo cifrado no se puede recuperar.
const DATA_KEY = parseKey(process.env.DATA_KEY);
const encBuf = (b: Buffer) => encrypt(DATA_KEY, b);
const decBuf = (b: Buffer) => decrypt(DATA_KEY, b);
const packData = (json: string) => (DATA_KEY ? 'enc1:' + encBuf(Buffer.from(json, 'utf8')).toString('base64') : json);
const unpackData = (s: string) => (s.startsWith('enc1:') ? decBuf(Buffer.from(s.slice(5), 'base64')).toString('utf8') : s);

fs.mkdirSync(path.join(DATA_DIR, 'files'), { recursive: true });
const KEY_STATUS = checkKeyAtStartup(DATA_DIR, DATA_KEY, fs, path); // lanza si la clave falta o no corresponde
const db = new DatabaseSync(path.join(DATA_DIR, 'canville.db'));
db.exec(`
PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY, name TEXT NOT NULL, rev INTEGER NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS members(workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, client_id TEXT NOT NULL DEFAULT '', PRIMARY KEY(workspace_id,user_id));
CREATE TABLE IF NOT EXISTS invites(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, email TEXT NOT NULL, client_id TEXT NOT NULL, code_hash TEXT NOT NULL, created_at TEXT NOT NULL, used_at TEXT);
CREATE TABLE IF NOT EXISTS files(workspace_id TEXT NOT NULL, key TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workspace_id,key));
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT, user_id TEXT, action TEXT NOT NULL, detail TEXT, at TEXT NOT NULL);
`);

// Migraciones aditivas (nunca borran columnas ni datos).
for (const sql of [
  'ALTER TABLE members ADD COLUMN modules TEXT',
  'ALTER TABLE invites ADD COLUMN modules TEXT',
  'ALTER TABLE files ADD COLUMN sha256 TEXT',
  'ALTER TABLE files ADD COLUMN mime_detected TEXT',
  'ALTER TABLE members ADD COLUMN employee_id TEXT',
  'ALTER TABLE invites ADD COLUMN role TEXT',
  'ALTER TABLE invites ADD COLUMN employee_id TEXT',
  'ALTER TABLE members ADD COLUMN client_scope TEXT',
  'ALTER TABLE invites ADD COLUMN client_scope TEXT',
]) { try { db.exec(sql); } catch { /* la columna ya existe */ } }

const id = () => crypto.randomBytes(9).toString('base64url');
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const now = () => new Date().toISOString();
const audit = (ws: string | null, user: string | null, action: string, detail = '') =>
  db.prepare('INSERT INTO audit(workspace_id,user_id,action,detail,at) VALUES(?,?,?,?,?)').run(ws, user, action, detail, now());

function hashPassword(pw: string, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(pw, salt, 64).toString('hex') };
}
const checkPassword = (pw: string, salt: string, hash: string) => {
  const a = Buffer.from(crypto.scryptSync(pw, salt, 64).toString('hex')), b = Buffer.from(hash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

class HttpError extends Error {
  status: number; extra: object;
  constructor(status: number, msg: string, extra: object = {}) { super(msg); this.status = status; this.extra = extra; }
}

const attempts = new Map<string, { n: number; reset: number }>();
function throttle(key: string) {
  const t = Date.now(), a = attempts.get(key);
  if (!a || a.reset < t) { attempts.set(key, { n: 1, reset: t + 15 * 60_000 }); return; }
  if (++a.n > RATE_LIMIT) throw new HttpError(429, 'Demasiados intentos. Espera 15 minutos.');
}

function readBody(req: http.IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((res, rej) => {
    const chunks: Buffer[] = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { rej(new HttpError(413, 'Contenido demasiado grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => res(Buffer.concat(chunks)));
    req.on('error', rej);
  });
}
const readJson = async (req: http.IncomingMessage) => {
  try { return JSON.parse((await readBody(req, MAX_JSON)).toString('utf8') || '{}'); } catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(400, 'JSON inválido'); }
};

type Auth = { userId: string; email: string };
function auth(req: http.IncomingMessage): Auth {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  if (!m) throw new HttpError(401, 'Sin sesión');
  const s = db.prepare('SELECT s.user_id, s.expires_at, u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=?').get(sha(m[1])) as any;
  if (!s || s.expires_at < Date.now()) throw new HttpError(401, 'Sesión inválida o vencida');
  return { userId: s.user_id, email: s.email };
}
const newSession = (userId: string) => {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sha(token), userId, Date.now() + SESSION_DAYS * 86400_000);
  return token;
};
const memberships = (userId: string) =>
  db.prepare('SELECT m.workspace_id AS workspaceId, w.name, m.role, m.client_id AS clientId FROM members m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=?').all(userId);

function member(a: Auth, ws: string): Member {
  const m = db.prepare('SELECT role, client_id AS clientId, modules, employee_id AS employeeId, client_scope AS scope FROM members WHERE workspace_id=? AND user_id=?').get(ws, a.userId) as { role: string; clientId: string; modules: string | null; employeeId: string | null; scope: string | null } | undefined;
  if (!m) throw new HttpError(404, 'Espacio no encontrado'); // no revela si existe
  return { role: m.role as RoleId, clientId: m.clientId ?? '', modules: parseModules(m.modules), employeeId: m.employeeId ?? '', scope: parseScope(m.scope) };
}
const owner = (a: Auth, ws: string) => { const m = member(a, ws); if (m.role !== 'propietario') throw new HttpError(403, 'Solo el propietario'); return m; };
const wsRow = (ws: string) => { const r = db.prepare('SELECT rev, data FROM workspaces WHERE id=?').get(ws) as { rev: number; data: string }; return { rev: r.rev, data: unpackData(r.data) }; };
const parseData = (s: string): Data => ({ ...emptyData(), ...JSON.parse(s) });

/** 'all' | ['id',…] válido (solo clientes existentes); null si no se indicó. */
function normalizeScope(input: unknown, validIds: string[]): 'all' | string[] | null {
  if (input === 'all') return 'all';
  if (!Array.isArray(input) || input.length === 0) return null;
  const ids = [...new Set(input.map(String))];
  if (ids.some(i => !validIds.includes(i))) throw new HttpError(400, 'Cliente inexistente en la asignación');
  return ids;
}

const KEY = /^[A-Za-z0-9_-]{6,40}$/;
const filePath = (ws: string, key: string) => {
  if (!KEY.test(key) || !KEY.test(ws)) throw new HttpError(400, 'Clave de archivo inválida');
  return path.join(DATA_DIR, 'files', ws, key);
};

function sweepOrphans(ws: string, data: Data) {
  const used = new Set(data.docs.map(d => d.fileKey));
  const rows = db.prepare('SELECT key, created_at FROM files WHERE workspace_id=?').all(ws) as { key: string; created_at: number }[];
  for (const r of rows) {
    if (!used.has(r.key) && Date.now() - r.created_at > ORPHAN_GRACE_MS) {
      fs.rmSync(filePath(ws, r.key), { force: true });
      db.prepare('DELETE FROM files WHERE workspace_id=? AND key=?').run(ws, r.key);
      audit(ws, null, 'file.purged', r.key);
    }
  }
}

// Lectura de nómina por quien no es propietario: se registra una vez cada 10 minutos por persona para no saturar la bitácora.
const lastPayrollRead = new Map<string, number>();
function auditPayrollRead(ws: string, userId: string, role: string, n: number) {
  const k = `${ws}:${userId}`, t = Date.now();
  if ((lastPayrollRead.get(k) ?? 0) > t - 10 * 60_000) return;
  lastPayrollRead.set(k, t);
  audit(ws, userId, 'payroll.read', `rol:${role} nóminas:${n}`);
}

type Handler = (req: http.IncomingMessage, res: http.ServerResponse, p: string[], url: URL) => Promise<unknown>;
const send = (res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, { 'content-type': isBuf ? 'application/octet-stream' : 'application/json', 'cache-control': 'private, no-store', ...headers });
  res.end(isBuf ? body : JSON.stringify(body));
};

const routes: Handler = async (req, res, p, url) => {
  const method = req.method ?? 'GET';
  if (method === 'GET' && p[0] === 'health') return { ok: true, encrypted: !!DATA_KEY };

  if (p[0] === 'auth') {
    const ip = req.socket.remoteAddress ?? '';
    if (p[1] === 'register' && method === 'POST') {
      const b = await readJson(req);
      const email = String(b.email ?? '').trim().toLowerCase(), pw = String(b.password ?? '');
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Correo inválido');
      if (pw.length < 10) throw new HttpError(400, 'La contraseña debe tener al menos 10 caracteres');
      throttle(`reg:${ip}`);
      if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw new HttpError(409, 'Ese correo ya tiene cuenta. Inicia sesión.');
      let invite: any = null;
      if (b.inviteCode) {
        invite = db.prepare('SELECT * FROM invites WHERE email=? AND code_hash=? AND used_at IS NULL').get(email, sha(String(b.inviteCode).trim().toUpperCase()));
        if (!invite) throw new HttpError(400, 'Código de invitación inválido para ese correo');
      }
      const userId = id(); const { salt, hash } = hashPassword(pw);
      db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(userId, email, salt, hash, now());
      if (invite) {
        db.prepare('INSERT INTO members(workspace_id,user_id,role,client_id,modules,employee_id,client_scope) VALUES(?,?,?,?,?,?,?)').run(invite.workspace_id, userId, invite.role ?? 'cliente', invite.client_id, invite.modules ?? JSON.stringify(sanitizeModules(null)), invite.employee_id ?? '', invite.client_scope ?? null);
        db.prepare('UPDATE invites SET used_at=? WHERE id=?').run(now(), invite.id);
        audit(invite.workspace_id, userId, 'invite.accepted', email);
      } else {
        const wsId = id();
        db.prepare('INSERT INTO workspaces VALUES(?,?,?,?,?)').run(wsId, String(b.workspaceName ?? 'Mi despacho').slice(0, 80), 1, packData(JSON.stringify(emptyData())), now());
        db.prepare('INSERT INTO members(workspace_id,user_id,role,client_id) VALUES(?,?,?,?)').run(wsId, userId, 'propietario', '');
        audit(wsId, userId, 'workspace.created', email);
      }
      return { token: newSession(userId), email, memberships: memberships(userId) };
    }
    if (p[1] === 'login' && method === 'POST') {
      const b = await readJson(req);
      const email = String(b.email ?? '').trim().toLowerCase();
      throttle(`login:${ip}:${email}`);
      const u = db.prepare('SELECT * FROM users WHERE email=?').get(email) as any;
      const fake = hashPassword('x', '00'.repeat(16)); // iguala tiempos si el usuario no existe
      const ok = u ? checkPassword(String(b.password ?? ''), u.salt, u.hash) : (checkPassword(String(b.password ?? ''), fake.salt, fake.hash) && false);
      if (!ok) { audit(null, u?.id ?? null, 'login.failed', email); throw new HttpError(401, 'Correo o contraseña incorrectos'); }
      attempts.delete(`login:${ip}:${email}`);
      audit(null, u.id, 'login.ok', email);
      return { token: newSession(u.id), email, memberships: memberships(u.id) };
    }
    if (p[1] === 'logout' && method === 'POST') {
      const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
      if (m) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(m[1]));
      return { ok: true };
    }
    if (p[1] === 'accept' && method === 'POST') { // cuenta existente acepta invitación
      const a = auth(req); const b = await readJson(req);
      const inv = db.prepare('SELECT * FROM invites WHERE email=? AND code_hash=? AND used_at IS NULL').get(a.email, sha(String(b.inviteCode ?? '').trim().toUpperCase())) as any;
      if (!inv) throw new HttpError(400, 'Código de invitación inválido para esta cuenta');
      db.prepare('INSERT OR REPLACE INTO members(workspace_id,user_id,role,client_id,modules,employee_id,client_scope) VALUES(?,?,?,?,?,?,?)').run(inv.workspace_id, a.userId, inv.role ?? 'cliente', inv.client_id, inv.modules ?? JSON.stringify(sanitizeModules(null)), inv.employee_id ?? '', inv.client_scope ?? null);
      db.prepare('UPDATE invites SET used_at=? WHERE id=?').run(now(), inv.id);
      audit(inv.workspace_id, a.userId, 'invite.accepted', a.email);
      return { memberships: memberships(a.userId) };
    }
  }

  if (p[0] === 'cfdi' && p[1] === 'status' && method === 'POST') { // requiere sesión: no es un proxy abierto
    const a = auth(req); throttle(`sat:${a.userId}`);
    const b = await readJson(req);
    try { return await consultaSat({ re: String(b.re ?? '').toUpperCase(), rr: String(b.rr ?? '').toUpperCase(), total: String(b.total ?? ''), uuid: String(b.uuid ?? '').toUpperCase() }); }
    catch (e) { throw new HttpError(502, e instanceof Error ? e.message : 'No se pudo consultar al SAT'); }
  }

  if (p[0] === 'me' && method === 'DELETE') { // eliminación de cuenta y datos (exigida por las tiendas)
    const a = auth(req);
    const b = await readJson(req);
    throttle(`del:${a.userId}`);
    const u = db.prepare('SELECT salt, hash FROM users WHERE id=?').get(a.userId) as { salt: string; hash: string };
    if (!checkPassword(String(b.password ?? ''), u.salt, u.hash)) throw new HttpError(401, 'Contraseña incorrecta');
    const owned = db.prepare("SELECT workspace_id AS id FROM members WHERE user_id=? AND role='propietario'").all(a.userId) as { id: string }[];
    if (owned.length && b.deleteOwnedWorkspaces !== true) {
      throw new HttpError(409, 'Esta cuenta es propietaria de espacios. Confirma que se eliminarán con todos sus datos y archivos.', { ownedWorkspaces: owned.length });
    }
    for (const w of owned) {
      fs.rmSync(path.join(DATA_DIR, 'files', w.id), { recursive: true, force: true });
      for (const t of ['files', 'invites', 'members']) db.prepare(`DELETE FROM ${t} WHERE workspace_id=?`).run(w.id);
      db.prepare('DELETE FROM workspaces WHERE id=?').run(w.id);
      db.prepare('UPDATE audit SET user_id=NULL, detail=\'\' WHERE workspace_id=?').run(w.id);
    }
    db.prepare('DELETE FROM members WHERE user_id=?').run(a.userId);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(a.userId);
    db.prepare('DELETE FROM invites WHERE email=?').run(a.email);
    db.prepare('DELETE FROM users WHERE id=?').run(a.userId);
    db.prepare("UPDATE audit SET user_id=NULL, detail='' WHERE user_id=?").run(a.userId); // se conserva el evento sin datos personales
    audit(null, null, 'account.deleted', `workspaces:${owned.length}`);
    return { ok: true, deletedWorkspaces: owned.length };
  }

  if (p[0] === 'me' && method === 'GET') { const a = auth(req); return { email: a.email, memberships: memberships(a.userId) }; }

  if (p[0] === 'ws' && p[1]) {
    const a = auth(req), ws = p[1];
    const m = member(a, ws);

    if (p[2] === 'data') {
      if (method === 'GET') {
        const r = wsRow(ws); const d = parseData(r.data);
        const view = viewFor(d, m);
        if (m.role !== 'propietario' && (view.payrolls.length || view.employees.length)) auditPayrollRead(ws, a.userId, m.role, view.payrolls.length);
        return { rev: r.rev, role: m.role, clientId: m.clientId, employeeId: m.employeeId, modules: m.role === 'cliente' ? m.modules : null, data: view };
      }
      if (method === 'PUT') {
        const b = await readJson(req);
        const stored = parseData(wsRow(ws).data);
        const res = authorizeWrite(stored, m.role === 'propietario' ? parseData(JSON.stringify(b.data ?? {})) : (b.data ?? {}), m);
        if (!res.ok) throw new HttpError(403, res.error);
        const next = parseData(JSON.stringify(res.merged));
        // Actualización condicional: solo escribe si nadie cambió la revisión (revisión optimista).
        const r = db.prepare('UPDATE workspaces SET data=?, rev=rev+1 WHERE id=? AND rev=?').run(packData(JSON.stringify(next)), ws, Number(b.baseRev));
        if (r.changes === 0) throw new HttpError(409, 'Hay cambios más recientes. Recarga antes de guardar.', { rev: wsRow(ws).rev });
        audit(ws, a.userId, 'data.saved', `rev ${Number(b.baseRev) + 1} rol:${m.role}`);
        sweepOrphans(ws, next);
        return { rev: Number(b.baseRev) + 1 };
      }
    }

    if (p[2] === 'files' && p[3]) {
      const key = p[3]; const fp = filePath(ws, key);
      if (method === 'PUT') {
        if (!canWrite(m.role, 'docs')) throw new HttpError(403, 'Tu rol no puede subir documentos');
        const buf = await readBody(req, MAX_FILE);
        const name = safeFileName(decodeURIComponent(String(req.headers['x-name'] ?? 'archivo')));
        const chk = validateUpload(name, buf);
        if (!chk.ok) throw new HttpError(415, chk.error);
        const sha = crypto.createHash('sha256').update(buf).digest('hex');
        fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, encBuf(buf));
        db.prepare('INSERT OR REPLACE INTO files(workspace_id,key,name,mime,size,created_at,sha256,mime_detected) VALUES(?,?,?,?,?,?,?,?)').run(ws, key, name, chk.mime, buf.length, Date.now(), sha, chk.mime);
        audit(ws, a.userId, 'file.uploaded', key);
        return { ok: true, sha256: sha, mime: chk.mime };
      }
      if (method === 'GET') {
        const full = parseData(wsRow(ws).data);
        const d = viewFor(full, m); // mismas reglas que la lista de documentos de su rol
        const doc = d.docs.find(x => x.fileKey === key);
        if (!doc) throw new HttpError(404, 'Archivo no encontrado');
        if (!fs.existsSync(fp)) throw new HttpError(404, 'El archivo no existe en el servidor');
        audit(ws, a.userId, 'file.downloaded', key);
        return { __raw: decBuf(fs.readFileSync(fp)), name: doc.name, mime: doc.mime };
      }
      if (method === 'DELETE') { // eliminación física
        const doc = parseData(wsRow(ws).data).docs.find(x => x.fileKey === key);
        if (doc ? !canWriteDoc(m.role, doc) : !canWrite(m.role, 'docs')) throw new HttpError(403, 'Tu rol no puede eliminar este archivo');
        fs.rmSync(fp, { force: true });
        db.prepare('DELETE FROM files WHERE workspace_id=? AND key=?').run(ws, key);
        audit(ws, a.userId, 'file.deleted', key);
        return { ok: true };
      }
    }

    if (p[2] === 'portal') { // el portal es de solo consulta y descarga: todo lo carga el despacho
      throw new HttpError(403, 'El portal es de solo consulta y descarga. Los documentos los carga el despacho.');
    }

    if (p[2] === 'invites') {
      owner(a, ws);
      if (method === 'POST') {
        const b = await readJson(req);
        const email = String(b.email ?? '').trim().toLowerCase();
        const role = String(b.role ?? 'cliente') as RoleId;
        const clientId = String(b.clientId ?? '');
        const employeeId = String(b.employeeId ?? '');
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Correo inválido');
        if (!INVITABLE_ROLES.includes(role)) throw new HttpError(400, 'Rol inválido');
        const cur = parseData(wsRow(ws).data);
        if (role === 'cliente' && !cur.clients.some(c => c.id === clientId)) throw new HttpError(400, 'Cliente inexistente');
        if (role === 'empleado' && !cur.employees.some(e => e.id === employeeId)) throw new HttpError(400, 'Trabajador inexistente');
        let scopeJson: string | null = null;
        if ((STAFF_ROLES as readonly string[]).includes(role)) { // el equipo debe tener clientes asignados de forma expresa
          const sc = normalizeScope(b.clientScope, cur.clients.map(c => c.id));
          if (sc === null) throw new HttpError(400, 'Indica a qué clientes tendrá acceso («todos» o una lista). Sin asignación no ve ninguno.');
          scopeJson = JSON.stringify(sc);
        }
        const code = crypto.randomBytes(5).toString('hex').toUpperCase(); // se comparte manualmente
        const modules = sanitizeModules(b.modules); // si no se indica, el mínimo
        db.prepare('DELETE FROM invites WHERE workspace_id=? AND email=? AND used_at IS NULL').run(ws, email);
        db.prepare('INSERT INTO invites(id,workspace_id,email,client_id,code_hash,created_at,used_at,modules,role,employee_id,client_scope) VALUES(?,?,?,?,?,?,NULL,?,?,?,?)').run(id(), ws, email, role === 'cliente' ? clientId : '', sha(code), now(), JSON.stringify(modules), role, role === 'empleado' ? employeeId : '', scopeJson);
        audit(ws, a.userId, 'invite.created', `${email} rol:${role}${role === 'cliente' ? ` módulos:${modules.join(',')}` : ''}`);
        return { code, email, modules, role };
      }
      if (method === 'GET') {
        const pend = (db.prepare("SELECT email, client_id AS clientId, created_at AS createdAt, modules, COALESCE(role,'cliente') AS role, COALESCE(employee_id,'') AS employeeId, client_scope AS scope FROM invites WHERE workspace_id=? AND used_at IS NULL").all(ws) as any[]).map(r => ({ ...r, modules: parseModules(r.modules), scope: parseScope(r.scope) }));
        const mem = (db.prepare("SELECT u.email, m.client_id AS clientId, m.modules, m.role AS role, COALESCE(m.employee_id,'') AS employeeId, m.client_scope AS scope FROM members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? AND m.role<>'propietario'").all(ws) as any[]).map(r => ({ ...r, modules: parseModules(r.modules), scope: parseScope(r.scope) }));
        return { pending: pend, members: mem };
      }
      if (method === 'PUT' && p[3] && p[4] === 'scope') { // el propietario cambia qué clientes atiende una persona del equipo
        const email = decodeURIComponent(p[3]).toLowerCase();
        const b = await readJson(req);
        const sc = normalizeScope(b.clientScope, parseData(wsRow(ws).data).clients.map(c => c.id));
        if (sc === null) throw new HttpError(400, 'Indica «todos» o una lista de clientes.');
        const json = JSON.stringify(sc);
        const u = db.prepare('SELECT id FROM users WHERE email=?').get(email) as any;
        const staffIn = STAFF_ROLES.map(r => `'${r}'`).join(',');
        const r1 = u ? db.prepare(`UPDATE members SET client_scope=? WHERE workspace_id=? AND user_id=? AND role IN (${staffIn})`).run(json, ws, u.id) : { changes: 0 };
        const r2 = db.prepare(`UPDATE invites SET client_scope=? WHERE workspace_id=? AND email=? AND used_at IS NULL AND role IN (${staffIn})`).run(json, ws, email);
        if (!r1.changes && !r2.changes) throw new HttpError(404, 'No hay una persona del equipo con ese correo');
        audit(ws, a.userId, 'access.scope', `${email} clientes:${sc === 'all' ? 'todos' : sc.length}`);
        return { ok: true, scope: sc };
      }
      if (method === 'PUT' && p[3] && p[4] === 'modules') { // el propietario cambia lo que ve un cliente (efecto inmediato)
        const email = decodeURIComponent(p[3]).toLowerCase();
        const b = await readJson(req);
        const modules = JSON.stringify(sanitizeModules(b.modules));
        const u = db.prepare('SELECT id FROM users WHERE email=?').get(email) as any;
        const r1 = u ? db.prepare("UPDATE members SET modules=? WHERE workspace_id=? AND user_id=? AND role='cliente'").run(modules, ws, u.id) : { changes: 0 };
        const r2 = db.prepare('UPDATE invites SET modules=? WHERE workspace_id=? AND email=? AND used_at IS NULL').run(modules, ws, email);
        if (!r1.changes && !r2.changes) throw new HttpError(404, 'No hay invitación ni acceso para ese correo');
        audit(ws, a.userId, 'access.modules', `${email} módulos:${JSON.parse(modules).join(',')}`);
        return { ok: true, modules: JSON.parse(modules) };
      }
      if (method === 'DELETE' && p[3]) { // revocar acceso y sesiones del correo
        const email = decodeURIComponent(p[3]).toLowerCase();
        db.prepare('DELETE FROM invites WHERE workspace_id=? AND email=?').run(ws, email);
        const u = db.prepare('SELECT id FROM users WHERE email=?').get(email) as any;
        if (u) db.prepare("DELETE FROM members WHERE workspace_id=? AND user_id=? AND role<>'propietario'").run(ws, u.id);
        audit(ws, a.userId, 'invite.revoked', email);
        return { ok: true };
      }
    }

    if (p[2] === 'audit' && method === 'GET') {
      owner(a, ws);
      return db.prepare('SELECT user_id AS userId, action, detail, at FROM audit WHERE workspace_id=? ORDER BY id DESC LIMIT 200').all(ws);
    }
    if (p[2] === 'backup' && method === 'GET') {
      owner(a, ws);
      const r = wsRow(ws);
      const files = db.prepare('SELECT key, name, mime, size FROM files WHERE workspace_id=?').all(ws);
      audit(ws, a.userId, 'backup.exported');
      return { exportedAt: now(), rev: r.rev, data: parseData(r.data), files };
    }
  }
  throw new HttpError(404, 'No encontrado');
};

export function createServer() {
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin ?? '';
    const allow = ORIGINS.includes('*') ? '*' : ORIGINS.includes(origin) ? origin : '';
    const cors: Record<string, string> = allow ? { 'access-control-allow-origin': allow, 'access-control-allow-headers': 'authorization,content-type,x-name,x-mime,x-category,x-period', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-expose-headers': 'x-name', vary: 'origin' } : {};
    cors['x-content-type-options'] = 'nosniff';
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
      const url = new URL(req.url ?? '/', 'http://x');
      const out: any = await routes(req, res, url.pathname.split('/').filter(Boolean), url);
      if (out && out.__raw) return send(res, 200, out.__raw, { ...cors, 'x-name': encodeURIComponent(out.name), 'content-disposition': 'attachment' });
      send(res, 200, out, cors);
    } catch (e) {
      if (e instanceof HttpError) return send(res, e.status, { error: e.message, ...e.extra }, cors);
      console.error(e);
      send(res, 500, { error: 'Error interno' }, cors);
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(PORT, () => console.log(`Canville API en :${PORT} (datos en ${DATA_DIR}) · ${KEY_STATUS}`));
}
