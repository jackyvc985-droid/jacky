import type { Data } from '../domain/types.ts';
import { localDate } from '../domain/planning.ts';
export const today = () => localDate();
export const thisPeriod = () => today().slice(0, 7);
export const clientName = (d: Data, id: string) => d.clients.find(c => c.id === id)?.name ?? '—';
export const clientOptions = (d: Data, allowNone = false) => [
  ...(allowNone ? [{ value: '', label: 'Ninguno' }] : []),
  ...d.clients.map(c => ({ value: c.id, label: c.name })),
];
/** 'lectura' = miembro del equipo que puede ver esta pantalla pero no modificarla. */
export type Role = 'propietario' | 'cliente' | 'lectura';
