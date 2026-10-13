// Web: no hay llavero; se usa localStorage (el token vence a los 30 días y se revoca al cerrar sesión).
export const secureGet = async (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
export const secureSet = async (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
export const secureDel = async (k: string) => { try { localStorage.removeItem(k); } catch { /* sin almacenamiento */ } };
