import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { clientView } from '../src/domain/permissions.ts';
import { emptyData } from '../src/domain/types.ts';
import type { Data } from '../src/domain/types.ts';
import { consultaSat } from './sat.ts';

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'server-data');
const PORT = Number(process.env.PORT ?? 8787);
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? '*').split(',').map((s: string) => s.trim());
const MAX_JSON = 20 * 1024 * 1024, MAX_FILE = 25 * 1024 * 1024, SESSION_DAYS = 30, ORPHAN_GRACE_MS = 3600_000;

fs.mkdirSync(path.join(DATA_DIR, 'files'), { recursive: true });
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
  if (++a.n > 10) throw new HttpError(429, 'Demasiados intentos. Espera 15 minutos.');
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

function member(a: Auth, ws: string) {
  const m = db.prepare('SELECT role, client_id AS clientId FROM members WHERE workspace_id=? AND user_id=?').get(ws, a.userId) as { role: string; clientId: string } | undefined;
  if (!m) throw new HttpError(404, 'Espacio no encontrado'); // no revela si existe
  return m;
}
const owner = (a: Auth, ws: string) => { const m = member(a, ws); if (m.role !== 'propietario') throw new HttpError(403, 'Solo el propietario'); return m; };
const wsRow = (ws: string) => db.prepare('SELECT rev, data FROM workspaces WHERE id=?').get(ws) as { rev: number; data: string };
const parseData = (s: string): Data => ({ ...emptyData(), ...JSON.parse(s) });

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

type Handler = (req: http.IncomingMessage, res: http.ServerResponse, p: string[], url: URL) => Promise<unknown>;
const send = (res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, { 'content-type': isBuf ? 'application/octet-stream' : 'application/json', ...headers });
  res.end(isBuf ? body : JSON.stringify(body));
};

const routes: Handler = async (req, res, p, url) => {
  const method = req.method ?? 'GET';
  if (method === 'GET' && p[0] === 'health') return { ok: true };

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
        db.prepare('INSERT INTO members VALUES(?,?,?,?)').run(invite.workspace_id, userId, 'cliente', invite.client_id);
        db.prepare('UPDATE invites SET used_at=? WHERE id=?').run(now(), invite.id);
        audit(invite.workspace_id, userId, 'invite.accepted', email);
      } else {
        const wsId = id();
        db.prepare('INSERT INTO workspaces VALUES(?,?,?,?,?)').run(wsId, String(b.workspaceName ?? 'Mi despacho').slice(0, 80), 1, JSON.stringify(emptyData()), now());
        db.prepare('INSERT INTO members VALUES(?,?,?,?)').run(wsId, userId, 'propietario', '');
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
      db.prepare('INSERT OR REPLACE INTO members VALUES(?,?,?,?)').run(inv.workspace_id, a.userId, 'cliente', inv.client_id);
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
        return { rev: r.rev, role: m.role, clientId: m.clientId, data: m.role === 'propietario' ? d : clientView(d, m.clientId) };
      }
      if (method === 'PUT') {
        owner(a, ws);
        const b = await readJson(req);
        const next = parseData(JSON.stringify(b.data ?? {}));
        // Actualización condicional: solo escribe si nadie cambió la revisión (revisión optimista).
        const r = db.prepare('UPDATE workspaces SET data=?, rev=rev+1 WHERE id=? AND rev=?').run(JSON.stringify(next), ws, Number(b.baseRev));
        if (r.changes === 0) throw new HttpError(409, 'Hay cambios más recientes. Recarga antes de guardar.', { rev: wsRow(ws).rev });
        audit(ws, a.userId, 'data.saved', `rev ${Number(b.baseRev) + 1}`);
        sweepOrphans(ws, next);
        return { rev: Number(b.baseRev) + 1 };
      }
    }

    if (p[2] === 'files' && p[3]) {
      const key = p[3]; const fp = filePath(ws, key);
      if (method === 'PUT') {
        owner(a, ws);
        const buf = await readBody(req, MAX_FILE);
        fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, buf);
        const name = decodeURIComponent(String(req.headers['x-name'] ?? 'archivo')).slice(0, 200);
        db.prepare('INSERT OR REPLACE INTO files VALUES(?,?,?,?,?,?)').run(ws, key, name, String(req.headers['x-mime'] ?? ''), buf.length, Date.now());
        audit(ws, a.userId, 'file.uploaded', key);
        return { ok: true };
      }
      if (method === 'GET') {
        const d = parseData(wsRow(ws).data);
        const doc = d.docs.find(x => x.fileKey === key);
        if (!doc || (m.role !== 'propietario' && doc.clientId !== m.clientId)) throw new HttpError(404, 'Archivo no encontrado');
        if (!fs.existsSync(fp)) throw new HttpError(404, 'El archivo no existe en el servidor');
        audit(ws, a.userId, 'file.downloaded', key);
        return { __raw: fs.readFileSync(fp), name: doc.name, mime: doc.mime };
      }
      if (method === 'DELETE') { // eliminación física
        owner(a, ws);
        fs.rmSync(fp, { force: true });
        db.prepare('DELETE FROM files WHERE workspace_id=? AND key=?').run(ws, key);
        audit(ws, a.userId, 'file.deleted', key);
        return { ok: true };
      }
    }

    if (p[2] === 'portal' && p[3] === 'upload' && method === 'POST') { // el cliente sube a SU expediente
      if (m.role !== 'cliente') throw new HttpError(403, 'Solo clientes del portal');
      const buf = await readBody(req, MAX_FILE);
      const key = id();
      const fp = filePath(ws, key);
      fs.mkdirSync(path.dirname(fp), { recursive: true }); fs.writeFileSync(fp, buf);
      const h = (n: string) => decodeURIComponent(String(req.headers[n] ?? ''));
      const doc = { id: id(), clientId: m.clientId, category: h('x-category').slice(0, 80) || 'Otro', period: h('x-period').slice(0, 7), name: h('x-name').slice(0, 200) || 'archivo', mime: h('x-mime').slice(0, 100), size: buf.length, fileKey: key, status: 'En revisión', createdAt: now(), uploadedBy: 'cliente' };
      db.prepare('INSERT INTO files VALUES(?,?,?,?,?,?)').run(ws, key, doc.name, doc.mime, buf.length, Date.now());
      const r = wsRow(ws); const d = parseData(r.data); d.docs.push(doc as never);
      db.prepare('UPDATE workspaces SET data=?, rev=rev+1 WHERE id=?').run(JSON.stringify(d), ws);
      audit(ws, a.userId, 'portal.upload', key);
      return { doc };
    }

    if (p[2] === 'invites') {
      owner(a, ws);
      if (method === 'POST') {
        const b = await readJson(req);
        const email = String(b.email ?? '').trim().toLowerCase();
        const clientId = String(b.clientId ?? '');
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Correo inválido');
        if (!parseData(wsRow(ws).data).clients.some(c => c.id === clientId)) throw new HttpError(400, 'Cliente inexistente');
        const code = crypto.randomBytes(5).toString('hex').toUpperCase(); // se comparte manualmente
        db.prepare('DELETE FROM invites WHERE workspace_id=? AND email=? AND used_at IS NULL').run(ws, email);
        db.prepare('INSERT INTO invites VALUES(?,?,?,?,?,?,NULL)').run(id(), ws, email, clientId, sha(code), now());
        audit(ws, a.userId, 'invite.created', email);
        return { code, email };
      }
      if (method === 'GET') {
        const pend = db.prepare('SELECT email, client_id AS clientId, created_at AS createdAt FROM invites WHERE workspace_id=? AND used_at IS NULL').all(ws);
        const mem = db.prepare("SELECT u.email, m.client_id AS clientId FROM members m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? AND m.role='cliente'").all(ws);
        return { pending: pend, members: mem };
      }
      if (method === 'DELETE' && p[3]) { // revocar acceso y sesiones del correo
        const email = decodeURIComponent(p[3]).toLowerCase();
        db.prepare('DELETE FROM invites WHERE workspace_id=? AND email=?').run(ws, email);
        const u = db.prepare('SELECT id FROM users WHERE email=?').get(email) as any;
        if (u) db.prepare("DELETE FROM members WHERE workspace_id=? AND user_id=? AND role='cliente'").run(ws, u.id);
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
  createServer().listen(PORT, () => console.log(`Canville API en :${PORT} (datos en ${DATA_DIR})`));
}
