import type { Data, Id } from './types.ts';

/** Módulos que el propietario puede abrir a un cliente del portal. Denegar por defecto. */
export const CLIENT_MODULES = ['documentos', 'proyectos', 'tareas', 'movimientos', 'presupuestos', 'previsiones', 'fiscal', 'nominas'] as const;
export type ClientModule = (typeof CLIENT_MODULES)[number];
export const MODULE_LABELS: Record<ClientModule, string> = {
  documentos: 'Documentos', proyectos: 'Proyectos', tareas: 'Pendientes', movimientos: 'Cifras (movimientos)',
  presupuestos: 'Presupuestos', previsiones: 'Previsión de pagos', fiscal: 'Obligaciones fiscales', nominas: 'Nóminas',
};
/** Mínimo privilegio: sin cifras ni nómina hasta que el propietario las autorice. */
export const DEFAULT_CLIENT_MODULES: ClientModule[] = ['documentos', 'proyectos', 'tareas'];

export function sanitizeModules(input: unknown): ClientModule[] {
  if (!Array.isArray(input)) return [...DEFAULT_CLIENT_MODULES];
  return CLIENT_MODULES.filter(m => input.includes(m));
}
export function parseModules(raw: string | null | undefined): ClientModule[] {
  if (!raw) return [...DEFAULT_CLIENT_MODULES]; // membresías anteriores: se aplica el mínimo
  try { return sanitizeModules(JSON.parse(raw)); } catch { return [...DEFAULT_CLIENT_MODULES]; }
}

/**
 * Datos visibles para un cliente del portal: solo su expediente y solo los módulos autorizados.
 * Las notas internas del despacho nunca se envían; los documentos de nómina exigen el módulo «nominas».
 */
export function clientView(data: Data, clientId: Id, modules: readonly ClientModule[] = DEFAULT_CLIENT_MODULES): Data {
  const can = (m: ClientModule) => modules.includes(m);
  const projectIds = new Set(data.projects.filter(p => p.clientId === clientId).map(p => p.id));
  return {
    ...data,
    clients: data.clients.filter(c => c.id === clientId).map(c => ({ ...c, notes: '' })),
    docs: can('documentos') ? data.docs.filter(d => d.clientId === clientId && (d.category !== 'Nómina' || can('nominas'))) : [],
    tasks: can('tareas') ? data.tasks.filter(t => t.clientId === clientId || projectIds.has(t.projectId)) : [],
    projects: can('proyectos') ? data.projects.filter(p => p.clientId === clientId) : [],
    movements: can('movimientos') ? data.movements.filter(m => m.clientId === clientId) : [],
    budgets: can('presupuestos') ? data.budgets.filter(b => b.clientId === clientId) : [],
    payrolls: can('nominas') ? data.payrolls.filter(p => p.clientId === clientId) : [],
    obligations: can('fiscal') ? data.obligations.filter(o => o.clientId === clientId) : [],
    forecasts: can('previsiones') ? data.forecasts.filter(f => f.clientId === clientId) : [],
    invites: [], proposals: [],
  };
}

/** Solo el propietario cambia el estado administrativo de un documento. */
export const canChangeDocStatus = (role: string) => role === 'propietario';
