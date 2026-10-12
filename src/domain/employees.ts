import type { Employee } from './types.ts';

export const RFC_PF = /^[A-ZÑ&]{4}\d{6}[A-Z\d]{3}$/;
export const CURP = /^[A-Z]{4}\d{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;
export const NSS = /^\d{11}$/;

/** Dígito verificador de la CLABE (pesos 3-7-1). */
export function clabeValid(clabe: string): boolean {
  if (!/^\d{18}$/.test(clabe)) return false;
  const w = [3, 7, 1];
  const sum = clabe.slice(0, 17).split('').reduce((a, d, i) => a + ((Number(d) * w[i % 3]) % 10), 0);
  return (10 - (sum % 10)) % 10 === Number(clabe[17]);
}

export const CONTRACT_TYPES: [string, string][] = [['01', 'Por tiempo indeterminado'], ['02', 'Por obra determinada'], ['03', 'Por tiempo determinado'], ['04', 'Por temporada'], ['05', 'Sujeto a prueba'], ['06', 'Capacitación inicial'], ['07', 'Pago por hora'], ['08', 'Comisión laboral'], ['09', 'Sin relación de trabajo']];
export const JORNADAS: [string, string][] = [['01', 'Diurna'], ['02', 'Nocturna'], ['03', 'Mixta'], ['04', 'Por hora'], ['05', 'Reducida'], ['06', 'Continuada'], ['07', 'Partida'], ['08', 'Por turnos']];
export const PERIODICIDADES: [string, string][] = [['01', 'Diario'], ['02', 'Semanal'], ['03', 'Catorcenal'], ['04', 'Quincenal'], ['05', 'Mensual'], ['06', 'Bimestral'], ['99', 'Otra']];
export const labelOf = (list: [string, string][], code: string) => list.find(([c]) => c === code)?.[1] ?? code;

export const blankEmployee = (id: string, clientId = ''): Employee => ({
  id, clientId, numEmpleado: '', name: '', rfc: '', curp: '', nss: '', birthDate: '', email: '', phone: '', address: '', cp: '',
  hireDate: '', endDate: '', status: 'Activo', puesto: '', departamento: '', contractType: '01', jornada: '01', periodicidad: '05', regimen: '02', entidad: '',
  dailySalaryCents: 0, sbcDailyCents: 0, bank: '', clabe: '', infonavitType: '', infonavitValue: '', infonavitCredit: '', notes: '',
});

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;

/** Errores de captura (bloquean guardar) y avisos (no bloquean). Los campos fiscales vacíos solo avisan. */
export function validateEmployee(e: Employee): { errors: string[]; warnings: string[] } {
  const errors: string[] = [], warnings: string[] = [];
  if (!e.name.trim()) errors.push('Falta el nombre completo.');
  if (e.rfc && !RFC_PF.test(e.rfc)) errors.push('RFC inválido (persona física: 4 letras, 6 dígitos y 3 de homoclave).');
  if (e.curp && !CURP.test(e.curp)) errors.push('CURP inválida (18 caracteres).');
  if (e.nss && !NSS.test(e.nss)) errors.push('El NSS debe tener 11 dígitos.');
  if (e.clabe && !clabeValid(e.clabe)) errors.push('CLABE inválida (18 dígitos con dígito verificador correcto).');
  if (e.cp && !/^\d{5}$/.test(e.cp)) errors.push('El código postal debe tener 5 dígitos.');
  if (e.email && !/^\S+@\S+\.\S+$/.test(e.email)) errors.push('Correo inválido.');
  for (const [k, label] of [['birthDate', 'nacimiento'], ['hireDate', 'ingreso'], ['endDate', 'baja']] as const) if (e[k] && !isDate(e[k])) errors.push(`Fecha de ${label} inválida (AAAA-MM-DD).`);
  if (e.hireDate && e.endDate && e.endDate < e.hireDate) errors.push('La fecha de baja es anterior a la de ingreso.');
  if (e.status === 'Baja' && !e.endDate) warnings.push('Trabajador dado de baja sin fecha de baja.');
  if (!e.rfc) warnings.push('Sin RFC: no se podrá conciliar con sus recibos timbrados.');
  if (!e.curp) warnings.push('Sin CURP.');
  if (!e.nss) warnings.push('Sin NSS.');
  if (!e.hireDate) warnings.push('Sin fecha de ingreso.');
  if (e.dailySalaryCents <= 0) warnings.push('Sin salario diario.');
  return { errors, warnings };
}

export const maskClabe = (c: string) => (c.length === 18 ? `${'•'.repeat(14)}${c.slice(-4)}` : c);
