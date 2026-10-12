import type { Data } from '../domain/types.ts';
export const today = () => new Date().toISOString().slice(0, 10);
export const thisPeriod = () => today().slice(0, 7);
export const clientName = (d: Data, id: string) => d.clients.find(c => c.id === id)?.name ?? '—';
export const clientOptions = (d: Data, allowNone = false) => [
  ...(allowNone ? [{ value: '', label: 'Ninguno' }] : []),
  ...d.clients.map(c => ({ value: c.id, label: c.name })),
];
export type Role = 'propietario' | 'cliente';
