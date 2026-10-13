import { payrollNet } from './accounting.ts';
import type { Employee, Payroll } from './types.ts';

export type SummaryRow = {
  payrollId: string; employeeId: string; name: string; clientId: string; period: string;
  perceptions: number; isr: number; imss: number; other: number; subsidyPaid: number; deductions: number; net: number;
  timbrado: boolean; uuid: string; detailed: boolean;
};
export type PayrollSummary = {
  rows: SummaryRow[];
  totals: { perceptions: number; isr: number; imss: number; other: number; subsidyPaid: number; deductions: number; net: number };
  timbrados: number; pendientes: number; withoutDetail: number;
};

/** Desglose general de la nómina de un periodo (y opcionalmente de un cliente), para todos los trabajadores. */
export type PayRun = { key: string; from: string; to: string; payDate: string; count: number };
/** Corridas de pago del mes (una semana, una quincena…) tomadas de las fechas de los recibos timbrados. */
export function payRuns(payrolls: Payroll[], f: { period: string; clientId: string }): PayRun[] {
  const m = new Map<string, PayRun>();
  for (const p of payrolls) {
    if (p.period !== f.period || (f.clientId && p.clientId !== f.clientId) || !p.cfdi?.fechaInicial) continue;
    const key = `${p.cfdi.fechaInicial}|${p.cfdi.fechaFinal}`;
    const r = m.get(key) ?? { key, from: p.cfdi.fechaInicial, to: p.cfdi.fechaFinal, payDate: p.cfdi.fechaPago, count: 0 };
    r.count++; m.set(key, r);
  }
  return [...m.values()].sort((a, b) => a.from.localeCompare(b.from));
}

export function payrollSummary(payrolls: Payroll[], employees: Employee[], f: { period: string; clientId: string; run?: string }): PayrollSummary {
  const rows = payrolls
    .filter(p => p.period === f.period && (!f.clientId || p.clientId === f.clientId) && (!f.run || `${p.cfdi?.fechaInicial}|${p.cfdi?.fechaFinal}` === f.run))
    .map<SummaryRow>(p => {
      const emp = p.employeeId ? employees.find(e => e.id === p.employeeId) : undefined;
      const detailed = !!p.calc;
      const isr = p.calc?.isrCents ?? 0, imss = p.calc?.imssCents ?? 0;
      return {
        payrollId: p.id, employeeId: p.employeeId ?? '', name: emp?.name ?? p.employee, clientId: p.clientId, period: p.period,
        perceptions: p.perceptionsCents, isr, imss, other: p.deductionsCents - isr - imss, subsidyPaid: p.subsidyPaidCents ?? 0,
        deductions: p.deductionsCents, net: payrollNet(p), timbrado: p.cfdi?.status === 'Timbrado', uuid: p.cfdi?.uuid ?? '', detailed,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const sum = (k: keyof SummaryRow) => rows.reduce((a, r) => a + (r[k] as number), 0);
  return {
    rows,
    totals: { perceptions: sum('perceptions'), isr: sum('isr'), imss: sum('imss'), other: sum('other'), subsidyPaid: sum('subsidyPaid'), deductions: sum('deductions'), net: sum('net') },
    timbrados: rows.filter(r => r.timbrado).length, pendientes: rows.filter(r => !r.timbrado).length, withoutDetail: rows.filter(r => !r.detailed).length,
  };
}
