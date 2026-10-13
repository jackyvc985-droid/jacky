import { clientView } from './permissions.ts';
import type { ClientModule } from './permissions.ts';
import type { Data, Employee } from './types.ts';

export const STAFF_ROLES = ['administrador', 'contador', 'nomina', 'proyectos', 'facturacion'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type RoleId = 'propietario' | StaffRole | 'cliente' | 'empleado';
export const INVITABLE_ROLES: RoleId[] = [...STAFF_ROLES, 'cliente', 'empleado'];
export const ROLE_LABELS: Record<RoleId, string> = {
  propietario: 'Propietaria', administrador: 'Administrador interno', contador: 'Contador', nomina: 'Responsable de nómina',
  proyectos: 'Coordinador de proyectos', facturacion: 'Responsable de facturación', cliente: 'Cliente (portal)', empleado: 'Trabajador (sus recibos)',
};
export const ROLE_SUMMARY: Record<RoleId, string> = {
  propietario: 'Todo, incluidos equipo, accesos, respaldos y bitácora.',
  administrador: 'Clientes, documentos (sin nómina), tareas, proyectos, movimientos, presupuestos, previsiones y obligaciones. Sin nómina.',
  contador: 'Movimientos, presupuestos, previsiones, obligaciones, nómina y trabajadores. Lee clientes, proyectos y tareas.',
  nomina: 'Trabajadores, nóminas y documentos de nómina. Lee clientes (sin notas internas).',
  proyectos: 'Proyectos y tareas. Lee clientes y documentos que no son de nómina.',
  facturacion: 'Movimientos, previsiones y documentos CFDI/Factura. Lee clientes, presupuestos y obligaciones.',
  cliente: 'Solo consulta y descarga de su expediente, en los módulos que se le autoricen. No sube, edita ni borra nada: todo lo carga el despacho.',
  empleado: 'Solo su ficha, sus nóminas y sus recibos.',
};

export type Coll = Exclude<keyof Data, 'invites' | 'proposals'>;
type Rule = true | ((item: any) => boolean);
type Rules = { read: Partial<Record<Coll, Rule>>; write: Partial<Record<Coll, Rule>>; notes: boolean };
const notPayroll: Rule = d => d.category !== 'Nómina';
const onlyPayroll: Rule = d => d.category === 'Nómina';
const onlyCfdi: Rule = d => d.category === 'CFDI/Factura';

/** Matriz de permisos del equipo. Denegar por defecto: lo que no aparece aquí no se ve ni se modifica. */
export const STAFF_RULES: Record<StaffRole, Rules> = {
  administrador: {
    notes: true,
    read: { clients: true, docs: notPayroll, tasks: true, projects: true, movements: true, budgets: true, forecasts: true, obligations: true },
    write: { clients: true, docs: notPayroll, tasks: true, projects: true, movements: true, budgets: true, forecasts: true, obligations: true },
  },
  contador: {
    notes: true,
    read: { clients: true, docs: true, tasks: true, projects: true, movements: true, budgets: true, forecasts: true, obligations: true, payrolls: true, employees: true },
    write: { docs: true, movements: true, budgets: true, forecasts: true, obligations: true, payrolls: true, employees: true },
  },
  nomina: {
    notes: false,
    read: { clients: true, docs: onlyPayroll, payrolls: true, employees: true },
    write: { docs: onlyPayroll, payrolls: true, employees: true },
  },
  proyectos: {
    notes: false,
    read: { clients: true, docs: notPayroll, tasks: true, projects: true },
    write: { tasks: true, projects: true },
  },
  facturacion: {
    notes: false,
    read: { clients: true, docs: onlyCfdi, movements: true, budgets: true, forecasts: true, obligations: true },
    write: { docs: onlyCfdi, movements: true, forecasts: true },
  },
};

/** Clientes que un miembro del equipo puede atender: todos (decisión expresa) o una lista. Sin asignación = ninguno. */
export type ClientScope = 'all' | readonly string[];
export type Member = { role: RoleId; clientId: string; modules: readonly ClientModule[]; employeeId: string; scope?: ClientScope };
const COLLS: Coll[] = ['clients', 'docs', 'tasks', 'projects', 'movements', 'budgets', 'payrolls', 'employees', 'obligations', 'forecasts'];
const pass = (r: Rule | undefined, item: unknown) => r === true || (typeof r === 'function' && r(item));
/** Alcance por cliente: los elementos sin cliente (internos del despacho) solo los ve quien atiende «todos». */
const inScope = (scope: ClientScope | undefined, c: Coll, item: any) => {
  if (scope === 'all') return true;
  const list = scope ?? [];
  return c === 'clients' ? list.includes(item.id) : !!item.clientId && list.includes(item.clientId);
};

export const budgetKey = (b: { category: string; clientId: string; period: string }) => `${b.category}|${b.clientId}|${b.period}`;
const keyOf = (c: Coll, item: any): string => (c === 'budgets' ? budgetKey(item) : String(item.id));

/** Vista de un trabajador: solo su ficha, sus nóminas y sus recibos (nunca los de otros ni datos del despacho). */
export function employeeView(data: Data, employeeId: string): Data {
  const emp = data.employees.find(e => e.id === employeeId);
  const empty: Data = { ...data, clients: [], docs: [], tasks: [], projects: [], movements: [], budgets: [], payrolls: [], employees: [], obligations: [], forecasts: [], invites: [], proposals: [] };
  if (!emp) return empty;
  const client = data.clients.find(c => c.id === emp.clientId);
  return {
    ...empty,
    clients: client ? [{ ...client, notes: '', email: '', phone: '' }] : [],
    employees: [emp],
    payrolls: data.payrolls.filter(p => p.employeeId === employeeId),
    docs: data.docs.filter(d => d.employeeId === employeeId && d.category === 'Nómina'),
  };
}

export function viewFor(data: Data, m: Member): Data {
  if (m.role === 'propietario') return data;
  if (m.role === 'cliente') return clientView(data, m.clientId, m.modules);
  if (m.role === 'empleado') return employeeView(data, m.employeeId);
  const rules = STAFF_RULES[m.role];
  const out: Data = { ...data, invites: [], proposals: [] };
  for (const c of COLLS) {
    const r = rules.read[c];
    (out as any)[c] = r ? (data as any)[c].filter((i: unknown) => pass(r, i) && inScope(m.scope, c, i)) : [];
  }
  if (!rules.notes) out.clients = out.clients.map(c => ({ ...c, notes: '' }));
  return out;
}

const deepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every(k => deepEqual(a[k], b[k]));
};

export type WriteResult = { ok: true; merged: Data } | { ok: false; error: string };

/**
 * Autoriza un guardado de un miembro con permisos parciales y lo fusiona con lo que él no puede ver.
 * - Solo se aceptan cambios en colecciones y elementos que su rol puede escribir.
 * - Lo que no ve se conserva intacto aunque la solicitud lo traiga vacío o alterado.
 * - Un elemento oculto nunca puede ser reemplazado (colisión de identificador).
 */
export function authorizeWrite(stored: Data, submitted: Partial<Data>, m: Member): WriteResult {
  if (m.role === 'propietario') return { ok: true, merged: { ...stored, ...(submitted as Data) } };
  if (m.role === 'cliente' || m.role === 'empleado') return { ok: false, error: 'Tu acceso es de solo lectura.' };
  const rules = STAFF_RULES[m.role];
  const view = viewFor(stored, m);
  const merged: Data = { ...stored };
  for (const c of COLLS) {
    const visible: any[] = (view as any)[c];
    const sub: any[] | undefined = (submitted as any)[c];
    if (sub === undefined) continue;
    const wr = rules.write[c];
    if (!Array.isArray(sub)) return { ok: false, error: `Datos inválidos en ${c}.` };
    if (!wr) {
      if (!deepEqual(sub, visible)) return { ok: false, error: `Tu rol no puede modificar ${c}.` };
      continue;
    }
    const visKeys = new Map<string, any>(visible.map(i => [keyOf(c, i), i]));
    const subKeys = new Set<string>();
    for (const i of sub) {
      const k = keyOf(c, i);
      if (subKeys.has(k)) return { ok: false, error: `Elemento repetido en ${c}.` };
      subKeys.add(k);
      const prev = visKeys.get(k);
      if (prev && deepEqual(prev, i)) continue;             // sin cambios
      if (!prev && (stored as any)[c].some((s: any) => keyOf(c, s) === k)) return { ok: false, error: `No puedes sustituir un elemento de ${c} que no ves.` };
      if (!pass(wr, i) || !inScope(m.scope, c, i)) return { ok: false, error: `Tu rol no puede escribir ese elemento de ${c}.` };
      if (prev && (!pass(wr, prev) || !inScope(m.scope, c, prev))) return { ok: false, error: `Tu rol no puede modificar ese elemento de ${c}.` };
    }
    for (const [k, prev] of visKeys) if (!subKeys.has(k) && (!pass(wr, prev) || !inScope(m.scope, c, prev))) return { ok: false, error: `Tu rol no puede eliminar ese elemento de ${c}.` };
    const hidden = (stored as any)[c].filter((s: any) => !visKeys.has(keyOf(c, s)));
    (merged as any)[c] = [...hidden, ...sub];
  }
  return { ok: true, merged };
}

export const canRead = (role: RoleId, c: Coll) => role === 'propietario' || (role in STAFF_RULES && !!STAFF_RULES[role as StaffRole].read[c]);
export const canWrite = (role: RoleId, c: Coll) => role === 'propietario' || (role in STAFF_RULES && !!STAFF_RULES[role as StaffRole].write[c]);
export const canWriteDoc = (role: RoleId, doc: { category: string }) => role === 'propietario' || (role in STAFF_RULES && pass(STAFF_RULES[role as StaffRole].write.docs, doc));
export const parseScope = (raw: string | null | undefined): ClientScope => {
  if (!raw) return []; // sin asignación: denegar
  try { const v = JSON.parse(raw); return v === 'all' ? 'all' : Array.isArray(v) ? v.filter((x: unknown) => typeof x === 'string') : []; } catch { return []; }
};
export const isStaff = (role: RoleId) => role === 'propietario' || (STAFF_ROLES as readonly string[]).includes(role);
export const employeeOf = (data: Data, id: string): Employee | undefined => data.employees.find(e => e.id === id);
