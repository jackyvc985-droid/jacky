import type { Client, Employee, Payroll } from './types.ts';
import { payrollNet } from './accounting.ts';

const m = (c: number) => (c / 100).toFixed(2);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const uuid4 = () => 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)).toUpperCase();

/**
 * Recibo de nómina DE EJEMPLO (con la forma del CFDI 4.0 + complemento nomina12) para probar la carga sin un archivo real.
 * No está timbrado por el SAT ni por un PAC: el sello y el UUID son ficticios. Solo sirve en la demostración.
 */
export function sampleReceiptXml(client: Client, emp: Employee, payroll: Payroll | undefined, fechaPago: string): string {
  const P = payroll?.perceptionsCents ?? 1500000;
  const isr = payroll?.calc?.isrCents ?? Math.round(P * 0.093), imss = payroll?.calc?.imssCents ?? Math.round(P * 0.026), other = payroll?.calc ? payroll.calc.otherCents : 0;
  const O = payroll?.subsidyPaidCents ?? 0;
  const D = payroll ? isr + imss + other : isr + imss;
  const total = P + O - D;
  void payrollNet;
  const period = fechaPago.slice(0, 7);
  return `<?xml version="1.0" encoding="utf-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:nomina12="http://www.sat.gob.mx/nomina12" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="EJEMPLO" Folio="1" Fecha="${fechaPago}T12:00:00" SubTotal="${m(P + O)}" Descuento="${m(D)}" Moneda="MXN" Total="${m(total)}" TipoDeComprobante="N" NoCertificado="00000000000000000000" Certificado="EJEMPLO" Sello="EJEMPLO">
 <cfdi:Emisor Rfc="${esc(client.rfc)}" Nombre="${esc(client.name)}" RegimenFiscal="601"/>
 <cfdi:Receptor Rfc="${esc(emp.rfc)}" Nombre="${esc(emp.name.toUpperCase())}" UsoCFDI="CN01"/>
 <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111505" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago de nómina" ValorUnitario="${m(P + O)}" Importe="${m(P + O)}" Descuento="${m(D)}"/></cfdi:Conceptos>
 <cfdi:Complemento>
  <nomina12:Nomina Version="1.2" TipoNomina="O" FechaPago="${fechaPago}" FechaInicialPago="${period}-01" FechaFinalPago="${fechaPago}" NumDiasPagados="30.000" TotalPercepciones="${m(P)}" TotalDeducciones="${m(D)}"${O ? ` TotalOtrosPagos="${m(O)}"` : ''}>
   <nomina12:Receptor Curp="${esc(emp.curp)}" NumSeguridadSocial="${esc(emp.nss || '00000000000')}" FechaInicioRelLaboral="${emp.hireDate || '2024-01-01'}" TipoContrato="01" TipoJornada="01" TipoRegimen="02" NumEmpleado="${esc(emp.numEmpleado || '1')}" Departamento="${esc(emp.departamento || 'General')}" Puesto="${esc(emp.puesto || 'Empleado')}" PeriodicidadPago="05" ClaveEntFed="CMX"/>
   <nomina12:Percepciones TotalSueldos="${m(P)}" TotalGravado="${m(P)}" TotalExento="0.00"><nomina12:Percepcion TipoPercepcion="001" Clave="P001" Concepto="Sueldos, Salarios Rayas y Jornales" ImporteGravado="${m(P)}" ImporteExento="0.00"/></nomina12:Percepciones>
   <nomina12:Deducciones TotalOtrasDeducciones="${m(imss + other)}" TotalImpuestosRetenidos="${m(isr)}"><nomina12:Deduccion TipoDeduccion="001" Clave="D001" Concepto="Seguridad social" Importe="${m(imss)}"/><nomina12:Deduccion TipoDeduccion="002" Clave="D002" Concepto="ISR" Importe="${m(isr)}"/>${other ? `<nomina12:Deduccion TipoDeduccion="004" Clave="D004" Concepto="Otras deducciones" Importe="${m(other)}"/>` : ''}</nomina12:Deducciones>
   ${O ? `<nomina12:OtrosPagos><nomina12:OtroPago TipoOtroPago="002" Clave="O002" Concepto="Subsidio para el empleo" Importe="${m(O)}"><nomina12:SubsidioAlEmpleo SubsidioCausado="${m(O)}"/></nomina12:OtroPago></nomina12:OtrosPagos>` : ''}
  </nomina12:Nomina>
  <tfd:TimbreFiscalDigital Version="1.1" UUID="${uuid4()}" FechaTimbrado="${fechaPago}T12:01:00" SelloSAT="EJEMPLO"/>
 </cfdi:Complemento>
</cfdi:Comprobante>`;
}
