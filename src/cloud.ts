import type { Data } from './domain/types.ts';
import type { ClientModule } from './domain/permissions.ts';

export type Membership = { workspaceId: string; name: string; role: 'propietario' | 'cliente'; clientId: string };
export type Session = { apiUrl: string; token: string; email: string; memberships: Membership[]; workspaceId: string };

export class ApiError extends Error {
  status: number; body: any;
  constructor(status: number, message: string, body: any) { super(message); this.status = status; this.body = body; }
}

export const DEFAULT_API = (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? '';
export const normalizeUrl = (u: string) => u.trim().replace(/\/+$/, '');

async function raw(apiUrl: string, token: string | undefined, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const isBin = body instanceof Uint8Array;
  let res: Response;
  try {
    res = await fetch(normalizeUrl(apiUrl) + path, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body && !isBin ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : isBin ? (body as unknown as BodyInit) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'No hay conexión con el servidor', null);
  }
  return res;
}

export async function api<T = any>(apiUrl: string, token: string | undefined, method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
  const res = await raw(apiUrl, token, method, path, body, headers);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `Error ${res.status}`, json);
  return json as T;
}

export async function apiBytes(apiUrl: string, token: string, path: string): Promise<Uint8Array> {
  const res = await raw(apiUrl, token, 'GET', path);
  if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => ({})))?.error ?? `Error ${res.status}`, null);
  return new Uint8Array(await res.arrayBuffer());
}

export type CloudData = { rev: number; role: 'propietario' | 'cliente'; clientId: string; modules: ClientModule[] | null; data: Data };
export const fetchData = (s: Session) => api<CloudData>(s.apiUrl, s.token, 'GET', `/ws/${s.workspaceId}/data`);
export const putData = (s: Session, baseRev: number, data: Data) => api<{ rev: number }>(s.apiUrl, s.token, 'PUT', `/ws/${s.workspaceId}/data`, { baseRev, data });
export const putFileCloud = (s: Session, key: string, bytes: Uint8Array, name: string, mime: string) =>
  api<{ ok: boolean; sha256: string; mime: string }>(s.apiUrl, s.token, 'PUT', `/ws/${s.workspaceId}/files/${key}`, bytes, { 'x-name': encodeURIComponent(name), 'x-mime': mime || '' });
export const getFileCloud = (s: Session, key: string) => apiBytes(s.apiUrl, s.token, `/ws/${s.workspaceId}/files/${key}`);
export const deleteFileCloud = (s: Session, key: string) => api(s.apiUrl, s.token, 'DELETE', `/ws/${s.workspaceId}/files/${key}`);
