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
export function payrollSummary(payrolls: Payroll[], employees: Employee[], f: { period: string; clientId: string }): PayrollSummary {
  const rows = payrolls
    .filter(p => p.period === f.period && (!f.clientId || p.clientId === f.clientId))
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
