import { XMLParser } from 'fast-xml-parser';
import { validateCfdi, type CfdiReport } from './cfdi.ts';
import type { CfdiLine } from './types.ts';

const arr = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const cents = (v: unknown) => (v === undefined || v === '' ? 0 : Math.round(Number(v) * 100));
const str = (v: unknown) => (v === undefined || v === null ? '' : String(v));

export type NominaCfdi = {
  uuid: string; fecha: string; totalCents: number; serie: string; folio: string;
  tipoNomina: string; fechaPago: string; fechaInicial: string; fechaFinal: string; diasPagados: number;
  totalPercepciones: number; totalDeducciones: number; totalOtrosPagos: number;
  emisorRfc: string; emisorNombre: string; registroPatronal: string;
  receptor: { rfc: string; nombre: string; curp: string; nss: string; numEmpleado: string; fechaInicioRel: string; puesto: string; departamento: string; tipoContrato: string; jornada: string; periodicidad: string; sbcCents: number; sdiCents: number; entidad: string; banco: string; cuenta: string };
  lines: CfdiLine[];
  subsidioCausadoCents: number;
};
export type ParsedNomina = { report: CfdiReport; nomina: NominaCfdi | null; errors: string[]; warnings: string[] };

/** Lee un CFDI de nómina (complemento 1.2) timbrado por CONTPAQi u otro sistema y revisa su coherencia interna. */
export function parseNominaCfdi(xml: string): ParsedNomina {
  const report = validateCfdi(xml);
  const errors = [...report.errors], warnings = report.warnings.filter(w => !w.startsWith('No se verificó'));
  let doc: any;
  try { doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true, processEntities: false }).parse(xml); } catch { return { report, nomina: null, errors, warnings }; }
  const c = doc?.Comprobante;
  const n = c?.Complemento?.Nomina;
  if (!c) return { report, nomina: null, errors, warnings };
  if (str(c.TipoDeComprobante) !== 'N') errors.push('No es un CFDI de nómina (TipoDeComprobante distinto de N).');
  if (!n) { errors.push('No contiene el complemento de nómina.'); return { report, nomina: null, errors, warnings }; }
  if (str(n.Version) !== '1.2') warnings.push(`Versión del complemento de nómina: ${str(n.Version) || 'desconocida'} (se esperaba 1.2).`);

  const lines: CfdiLine[] = [];
  for (const p of arr<any>(n.Percepciones?.Percepcion)) lines.push({ kind: 'percepcion', tipo: str(p.TipoPercepcion), clave: str(p.Clave), concepto: str(p.Concepto), gravadoCents: cents(p.ImporteGravado), exentoCents: cents(p.ImporteExento) });
  for (const d of arr<any>(n.Deducciones?.Deduccion)) lines.push({ kind: 'deduccion', tipo: str(d.TipoDeduccion), clave: str(d.Clave), concepto: str(d.Concepto), gravadoCents: cents(d.Importe), exentoCents: 0 });
  let subsidioCausado = 0;
  for (const o of arr<any>(n.OtrosPagos?.OtroPago)) {
    lines.push({ kind: 'otropago', tipo: str(o.TipoOtroPago), clave: str(o.Clave), concepto: str(o.Concepto), gravadoCents: cents(o.Importe), exentoCents: 0 });
    subsidioCausado += cents(o.SubsidioAlEmpleo?.SubsidioCausado);
  }
  const totalP = cents(n.TotalPercepciones), totalD = cents(n.TotalDeducciones), totalO = cents(n.TotalOtrosPagos);
  const sum = (k: CfdiLine['kind']) => lines.filter(l => l.kind === k).reduce((a, l) => a + l.gravadoCents + l.exentoCents, 0);
  if (Math.abs(sum('percepcion') - totalP) > 1) errors.push('La suma de percepciones no coincide con TotalPercepciones.');
  if (Math.abs(sum('deduccion') - totalD) > 1) errors.push('La suma de deducciones no coincide con TotalDeducciones.');
  if (Math.abs(sum('otropago') - totalO) > 1) errors.push('La suma de otros pagos no coincide con TotalOtrosPagos.');
  if (Math.abs(cents(c.SubTotal) - (totalP + totalO)) > 1) errors.push('SubTotal ≠ TotalPercepciones + TotalOtrosPagos.');
  if (Math.abs(cents(c.Descuento) - totalD) > 1) errors.push('Descuento ≠ TotalDeducciones.');
  const r = n.Receptor ?? {};
  if (!/^[A-Z]{4}\d{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/.test(str(r.Curp))) errors.push('CURP del receptor inválida o ausente.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(n.FechaPago))) errors.push('FechaPago inválida.');

  const nomina: NominaCfdi = {
    uuid: report.uuid ?? '', fecha: str(c.Fecha), totalCents: cents(c.Total), serie: str(c.Serie), folio: str(c.Folio),
    tipoNomina: str(n.TipoNomina), fechaPago: str(n.FechaPago), fechaInicial: str(n.FechaInicialPago), fechaFinal: str(n.FechaFinalPago), diasPagados: Math.round(Number(n.NumDiasPagados ?? 0)),
    totalPercepciones: totalP, totalDeducciones: totalD, totalOtrosPagos: totalO,
    emisorRfc: str(c.Emisor?.Rfc), emisorNombre: str(c.Emisor?.Nombre), registroPatronal: str(n.Emisor?.RegistroPatronal),
    receptor: { rfc: str(c.Receptor?.Rfc), nombre: str(c.Receptor?.Nombre), curp: str(r.Curp), nss: str(r.NumSeguridadSocial), numEmpleado: str(r.NumEmpleado), fechaInicioRel: str(r.FechaInicioRelLaboral), puesto: str(r.Puesto), departamento: str(r.Departamento), tipoContrato: str(r.TipoContrato), jornada: str(r.TipoJornada), periodicidad: str(r.PeriodicidadPago), sbcCents: cents(r.SalarioBaseCotApor), sdiCents: cents(r.SalarioDiarioIntegrado), entidad: str(r.ClaveEntFed), banco: str(r.Banco), cuenta: str(r.CuentaBancaria) },
    lines, subsidioCausadoCents: subsidioCausado,
  };
  return { report, nomina, errors, warnings };
}

/** Totales por tipo de línea útiles para el desglose y la conciliación. */
export function cfdiTotals(lines: CfdiLine[]) {
  const isr = lines.filter(l => l.kind === 'deduccion' && l.tipo === '002').reduce((a, l) => a + l.gravadoCents, 0);
  const imss = lines.filter(l => l.kind === 'deduccion' && l.tipo === '001').reduce((a, l) => a + l.gravadoCents, 0);
  const deductions = lines.filter(l => l.kind === 'deduccion').reduce((a, l) => a + l.gravadoCents, 0);
  const otros = lines.filter(l => l.kind === 'otropago').reduce((a, l) => a + l.gravadoCents, 0);
  return { isr, imss, other: deductions - isr - imss, deductions, otros };
}
