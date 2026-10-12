import type { Data, Id } from './types.ts';

/** Datos visibles para un cliente del portal: solo su expediente. */
export function clientView(data: Data, clientId: Id): Data {
  const projectIds = new Set(data.projects.filter(p => p.clientId === clientId).map(p => p.id));
  return {
    ...data,
    clients: data.clients.filter(c => c.id === clientId),
    docs: data.docs.filter(d => d.clientId === clientId),
    tasks: data.tasks.filter(t => t.clientId === clientId || projectIds.has(t.projectId)),
    projects: data.projects.filter(p => p.clientId === clientId),
    movements: data.movements.filter(m => m.clientId === clientId),
    budgets: data.budgets.filter(b => b.clientId === clientId),
    payrolls: data.payrolls.filter(p => p.clientId === clientId),
    obligations: data.obligations.filter(o => o.clientId === clientId),
    invites: [], proposals: [],
  };
}

/** Solo el propietario cambia el estado administrativo de un documento. */
export const canChangeDocStatus = (role: 'propietario' | 'cliente') => role === 'propietario';
