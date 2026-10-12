import type { Data, Payroll } from './domain/types.ts';
import { calcPayroll } from './domain/fiscal.ts';
import { addDays, localDate } from './domain/planning.ts';

const today = new Date();
const iso = (monthsAgo: number, day: number) => {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, day));
  return d.toISOString().slice(0, 10);
};
const per = (m: number) => iso(m, 1).slice(0, 7);

function payroll(id: string, employee: string, clientId: string, input: Parameters<typeof calcPayroll>[0]): Payroll {
  const r = calcPayroll(input);
  return {
    id, employee, clientId, period: per(0), perceptionsCents: r.grossCents, deductionsCents: r.deductionsTotal, subsidyPaidCents: r.subsidyPaid,
    calc: { isrCents: r.isrWithheld, imssCents: r.imss, subsidyAppliedCents: r.subsidyApplied, otherCents: r.other, tablesYear: r.tablesYear, detail: r.detail },
  };
}

/** Datos de demostración: solo existen en memoria, nunca se suben ni se guardan. */
export function demoData(): Data {
  const movements: Data['movements'] = [];
  for (let m = 5; m >= 0; m--) {
    movements.push(
      { id: `mi${m}`, date: iso(m, 5), type: 'ingreso', concept: 'Honorarios mensuales', category: 'Servicios', amountCents: 4500000 + m * 120000, clientId: 'c1' },
      { id: `mj${m}`, date: iso(m, 12), type: 'ingreso', concept: 'Asesoría', category: 'Servicios', amountCents: 1800000, clientId: 'c2' },
      { id: `mg${m}`, date: iso(m, 15), type: 'gasto', concept: 'Renta de oficina', category: 'Renta', amountCents: 1500000, clientId: '' },
      { id: `mh${m}`, date: iso(m, 20), type: 'gasto', concept: 'Software y licencias', category: 'Software', amountCents: 250000 + m * 40000, clientId: '' },
    );
  }
  return {
    clients: [
      { id: 'c1', name: 'Comercializadora Aurora SA de CV', rfc: 'CAU010101AAA', email: 'contacto@aurora.example', phone: '55 1234 5678', status: 'Activo', notes: 'Cliente demostración' },
      { id: 'c2', name: 'Taller Mecánico Ramírez', rfc: 'RAMR800101BBB', email: 'ramirez@example.com', phone: '33 8765 4321', status: 'Activo', notes: '' },
      { id: 'c3', name: 'Estudio Creativo Luna', rfc: '', email: '', phone: '', status: 'Inactivo', notes: '' },
    ],
    docs: [
      { id: 'd1', clientId: 'c1', category: 'Constancia de situación fiscal', period: per(0), name: 'constancia.pdf', mime: 'application/pdf', size: 120000, fileKey: 'demo', status: 'Completo', createdAt: iso(0, 1), uploadedBy: 'despacho' },
      { id: 'd2', clientId: 'c1', category: 'Declaración', period: per(1), name: 'declaracion.pdf', mime: 'application/pdf', size: 98000, fileKey: 'demo', status: 'En revisión', createdAt: iso(0, 2), uploadedBy: 'cliente' },
    ],
    tasks: [
      { id: 't1', title: 'Solicitar CFDI del mes', clientId: 'c1', projectId: 'p1', due: iso(0, 28), done: false },
      { id: 't2', title: 'Revisar declaración mensual', clientId: 'c2', projectId: '', due: iso(0, 17), done: false },
      { id: 't3', title: 'Enviar contrato firmado', clientId: 'c1', projectId: '', due: iso(1, 10), done: true },
    ],
    projects: [
      { id: 'p1', name: 'Regularización fiscal 2026', clientId: 'c1', status: 'En curso', description: 'Ordenar expediente y obligaciones' },
      { id: 'p2', name: 'Alta de nómina', clientId: 'c2', status: 'Planeado', description: '' },
    ],
    movements,
    budgets: [
      { category: 'Software', clientId: '', period: per(0), limitCents: 280000 },
      { category: 'Renta', clientId: '', period: per(0), limitCents: 1400000 },
    ],
    payrolls: [
      payroll('n1', 'Ana López', 'c1', { salaryCents: 1500000, dailySalaryCents: 50000, days: 30 }),
      payroll('n2', 'Luis Pérez', 'c1', { salaryCents: 980000, otherTaxableCents: 120000, exemptCents: 80000, dailySalaryCents: 32667, days: 30, otherDeductionsCents: 150000 }),
      payroll('n3', 'Marta Ruiz', 'c2', { salaryCents: 850000, dailySalaryCents: 28333, days: 30 }),
    ],
    obligations: [
      { id: 'o1', name: 'Declaración mensual ISR/IVA', clientId: 'c1', dueDate: iso(0, 17), amountCents: 320000, status: 'Pendiente' },
      { id: 'o2', name: 'DIOT', clientId: 'c2', dueDate: iso(0, 17), amountCents: 0, status: 'Presentada' },
    ],
    employees: [],
    forecasts: [
      { id: 'f1', concept: 'Honorarios del mes (Aurora)', kind: 'cobro', amountCents: 4500000, dueDate: addDays(localDate(), 6), clientId: 'c1', category: 'Servicios', status: 'Pendiente', note: 'Factura enviada' },
      { id: 'f2', concept: 'Asesoría trimestral (Ramírez)', kind: 'cobro', amountCents: 1800000, dueDate: addDays(localDate(), 24), clientId: 'c2', category: 'Servicios', status: 'Pendiente', note: '' },
      { id: 'f3', concept: 'Renta de oficina', kind: 'pago', amountCents: 1500000, dueDate: addDays(localDate(), 12), clientId: '', category: 'Renta', status: 'Pendiente', note: '' },
      { id: 'f4', concept: 'Licencias de software', kind: 'pago', amountCents: 320000, dueDate: addDays(localDate(), 41), clientId: '', category: 'Software', status: 'Pendiente', note: '' },
      { id: 'f5', concept: 'Cobro atrasado (Aurora)', kind: 'cobro', amountCents: 600000, dueDate: addDays(localDate(), -5), clientId: 'c1', category: 'Servicios', status: 'Pendiente', note: 'Dar seguimiento' },
      { id: 'f6', concept: 'Pago a proveedor liquidado', kind: 'pago', amountCents: 250000, dueDate: addDays(localDate(), -9), clientId: '', category: 'Software', status: 'Liquidado', note: '' },
    ],
    invites: [], proposals: [],
  };
}
