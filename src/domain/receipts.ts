import { cfdiTotals, parseNominaCfdi, type ParsedNomina } from './cfdiNomina.ts';
import { payrollNet } from './accounting.ts';
import { blankEmployee } from './employees.ts';
import type { Data, Doc, Employee, Id, Payroll } from './types.ts';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const baseName = (n: string) => n.replace(/\.[^.]+$/, '').toLowerCase();

/**
 * Empareja cada XML con su PDF: mismo nombre base; o el UUID completo dentro del nombre del PDF;
 * o el patrón de CONTPAQi «…_<NumEmpleado>_<últimas 3 letras del UUID>» (p. ej. …_001_9F0).
 */
export function pairPdf(xmlName: string, uuid: string, pdfNames: string[], numEmpleado = ''): string | undefined {
  const b = baseName(xmlName);
  const byBase = pdfNames.find(p => baseName(p) === b);
  if (byBase) return byBase;
  if (uuid) { const byUuid = pdfNames.find(p => p.toLowerCase().includes(uuid.toLowerCase())); if (byUuid) return byUuid; }
  if (uuid && numEmpleado) {
    const tail = `_${numEmpleado}_${uuid.slice(-3)}`.toLowerCase();
    const hits = pdfNames.filter(p => baseName(p).endsWith(tail));
    if (hits.length === 1) return hits[0];
  }
  return undefined;
}

export type ReceiptStatus = 'nuevo' | 'actualiza' | 'duplicado' | 'revisar' | 'error';
export type ReceiptPlan = {
  xmlName: string; pdfName?: string; parsed: ParsedNomina;
  status: ReceiptStatus; errors: string[]; warnings: string[];
  clientId: Id | ''; employeeId: Id | ''; createEmployee: boolean; payrollId: Id | ''; period: string;
};

export function planReceipts(items: { xmlName: string; xmlText: string; pdfName?: string }[], data: Data, forceClient: Record<string, string> = {}): ReceiptPlan[] {
  const seen = new Set(data.payrolls.map(p => p.cfdi?.uuid).filter(Boolean) as string[]);
  return items.map(it => {
    const parsed = parseNominaCfdi(it.xmlText);
    const n = parsed.nomina;
    const base = { xmlName: it.xmlName, pdfName: it.pdfName, parsed, errors: [...parsed.errors], warnings: [...parsed.warnings], clientId: '' as Id | '', employeeId: '' as Id | '', createEmployee: false, payrollId: '' as Id | '', period: '' };
    if (!n || parsed.errors.length) return { ...base, status: 'error' as const };
    base.period = (n.fechaPago || n.fechaFinal).slice(0, 7); // el mes de pago
    if (n.uuid && seen.has(n.uuid)) return { ...base, status: 'duplicado' as const, warnings: [...base.warnings, 'Este recibo (UUID) ya está cargado.'] };
    if (n.uuid) seen.add(n.uuid); // también detecta repetidos dentro del mismo lote

    const client = data.clients.find(c => c.id === forceClient[it.xmlName]) ?? data.clients.find(c => c.rfc && c.rfc.toUpperCase() === n.emisorRfc.toUpperCase());
    base.clientId = client?.id ?? '';
    const pool = data.employees.filter(e => !client || e.clientId === client.id || !e.clientId);
    const r = n.receptor;
    const emp = pool.find(e => e.rfc && e.rfc.toUpperCase() === r.rfc.toUpperCase()) ?? pool.find(e => e.curp && e.curp.toUpperCase() === r.curp.toUpperCase()) ?? pool.find(e => e.numEmpleado && e.numEmpleado === r.numEmpleado && client && e.clientId === client.id);
    base.employeeId = emp?.id ?? '';
    base.createEmployee = !emp;
    if (!client) base.warnings.push(`Ningún cliente tiene el RFC del emisor (${n.emisorRfc}). Elige el cliente o captura ese RFC en su ficha.`);
    if (!emp) base.warnings.push(`No hay un trabajador con RFC ${r.rfc}: se creará su ficha con los datos del recibo.`);

    // Solo los recibos MENSUALES se asocian a una nómina calculada en la app (que es mensual); semanales/quincenales siempre son nóminas nuevas.
    const existing = emp && n.receptor.periodicidad === '05' ? data.payrolls.filter(p => !p.cfdi && p.period === base.period && (p.employeeId === emp.id || (!p.employeeId && norm(p.employee) === norm(emp.name)))) : [];
    if (existing.length === 1) {
      base.payrollId = existing[0].id;
      base.warnings.push(...reconcile(existing[0], n.totalCents, parsed.nomina!.lines).map(d => `Difiere del cálculo de la app: ${d}`));
      return { ...base, status: client ? ('actualiza' as const) : ('revisar' as const) };
    }
    return { ...base, status: client ? ('nuevo' as const) : ('revisar' as const) };
  });
}

/** Diferencias entre un cálculo hecho en la app y el recibo timbrado (informativas, no bloquean). */
export function reconcile(p: Payroll, cfdiTotalCents: number, lines: import('./types.ts').CfdiLine[]): string[] {
  const out: string[] = [];
  const t = cfdiTotals(lines);
  const m = (c: number) => `$${(c / 100).toFixed(2)}`;
  if (Math.abs(payrollNet(p) - cfdiTotalCents) > 1) out.push(`neto ${m(payrollNet(p))} contra ${m(cfdiTotalCents)} del CFDI`);
  if (p.calc && Math.abs(p.calc.isrCents - t.isr) > 1) out.push(`ISR ${m(p.calc.isrCents)} contra ${m(t.isr)}`);
  if (p.calc && Math.abs(p.calc.imssCents - t.imss) > 1) out.push(`IMSS ${m(p.calc.imssCents)} contra ${m(t.imss)}`);
  return out;
}

export type StoredFiles = { xmlKey: string; xmlSize: number; pdfKey?: string; pdfSize?: number };

/** Construye los registros (trabajador, nómina, documentos) de un recibo ya planeado. No guarda nada por sí mismo. */
export function buildReceiptRecords(plan: ReceiptPlan, data: Data, newId: () => string, files: StoredFiles, now = new Date().toISOString()): { employee?: Employee; payroll: Payroll; docs: Doc[] } {
  const n = plan.parsed.nomina!;
  const r = n.receptor;
  let employee: Employee | undefined;
  let employeeId = plan.employeeId;
  if (!employeeId) {
    employeeId = newId();
    employee = { ...blankEmployee(employeeId, plan.clientId), numEmpleado: r.numEmpleado, name: r.nombre, rfc: r.rfc, curp: r.curp, nss: r.nss, hireDate: r.fechaInicioRel, puesto: r.puesto, departamento: r.departamento, contractType: r.tipoContrato || '01', jornada: r.jornada || '01', periodicidad: r.periodicidad || '05', entidad: r.entidad, cp: r.cp, dailySalaryCents: 0, sbcDailyCents: r.sbcCents || r.sdiCents, bank: r.banco, clabe: /^\d{18}$/.test(r.cuenta) ? r.cuenta : '', notes: 'Ficha creada a partir de un recibo timbrado: el recibo no trae el salario diario ni el domicilio; complétalos.' };
  }
  const existing = plan.payrollId ? data.payrolls.find(p => p.id === plan.payrollId) : undefined;
  const payrollId = existing?.id ?? newId();
  const xmlDocId = newId(), pdfDocId = files.pdfKey ? newId() : undefined;
  const doc = (docId: Id, name: string, mime: string, key: string, size: number): Doc => ({ id: docId, clientId: plan.clientId, category: 'Nómina', period: plan.period, name, mime, size, fileKey: key, status: 'Completo', createdAt: now, uploadedBy: 'despacho', employeeId, payrollId, uuid: n.uuid });
  const docs = [doc(xmlDocId, plan.xmlName, 'application/xml', files.xmlKey, files.xmlSize)];
  if (files.pdfKey && plan.pdfName && pdfDocId) docs.push(doc(pdfDocId, plan.pdfName, 'application/pdf', files.pdfKey, files.pdfSize ?? 0));
  const t = cfdiTotals(n.lines);
  const cfdi = { uuid: n.uuid, status: 'Timbrado' as const, xmlDocId, pdfDocId, fechaPago: n.fechaPago, fechaInicial: n.fechaInicial, fechaFinal: n.fechaFinal, diasPagados: n.diasPagados, emisorRfc: n.emisorRfc, receptorRfc: r.rfc, totalCents: n.totalCents, lines: n.lines, checkedAt: now, notes: plan.warnings.filter(w => w.startsWith('Difiere')) };
  // Una vez timbrado, el CFDI es la cifra oficial: sustituye a la capturada o calculada en la app (la diferencia queda anotada).
  const fromCfdi = { perceptionsCents: n.totalPercepciones, deductionsCents: n.totalDeducciones, subsidyPaidCents: n.totalOtrosPagos || undefined, source: 'cfdi' as const, employeeId, calc: { isrCents: t.isr, imssCents: t.imss, subsidyAppliedCents: n.subsidioCausadoCents, otherCents: t.other, tablesYear: Number(n.fechaPago.slice(0, 4)) }, cfdi };
  const payroll: Payroll = existing
    ? { ...existing, ...fromCfdi, clientId: existing.clientId || plan.clientId }
    : { id: payrollId, employee: employee?.name ?? data.employees.find(e => e.id === employeeId)?.name ?? r.nombre, clientId: plan.clientId, period: plan.period, ...fromCfdi };
  return { employee, payroll, docs };
}
