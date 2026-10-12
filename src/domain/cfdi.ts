import { XMLParser } from 'fast-xml-parser';

export type CfdiReport = {
  ok: boolean; errors: string[]; warnings: string[];
  uuid?: string; emisorRfc?: string; receptorRfc?: string; fecha?: string; subtotal?: number; total?: number; tipo?: string; version?: string;
};

const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;
const UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
const toCents = (s: unknown) => Math.round(Number(s) * 100);
const arr = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);

/**
 * Validación ESTRUCTURAL y aritmética de un CFDI 4.0/3.3. No verifica sello, certificado ni
 * estatus ante el SAT (eso requiere consultar al SAT o a un PAC).
 */
export function validateCfdi(xml: string): CfdiReport {
  const errors: string[] = [], warnings: string[] = [];
  let doc: any;
  try {
    doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true, processEntities: false }).parse(xml);
  } catch { return { ok: false, errors: ['XML mal formado'], warnings }; }
  const c = doc?.Comprobante;
  if (!c) return { ok: false, errors: ['No es un CFDI: falta el nodo Comprobante'], warnings };

  const version = String(c.Version ?? c.version ?? '');
  if (!['4.0', '3.3'].includes(version)) errors.push(`Versión no soportada: ${version || 'sin versión'}`);
  const fecha = String(c.Fecha ?? '');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(fecha)) errors.push('Fecha inválida (AAAA-MM-DDThh:mm:ss)');
  const tipo = String(c.TipoDeComprobante ?? '');
  if (!['I', 'E', 'T', 'P', 'N'].includes(tipo)) errors.push('TipoDeComprobante inválido');
  const emisorRfc = String(c.Emisor?.Rfc ?? ''), receptorRfc = String(c.Receptor?.Rfc ?? '');
  if (!RFC.test(emisorRfc)) errors.push('RFC del emisor inválido');
  if (!RFC.test(receptorRfc)) errors.push('RFC del receptor inválido');
  if (!c.Certificado || !c.Sello || !c.NoCertificado) errors.push('Faltan Certificado, NoCertificado o Sello');

  const tfd = doc.Comprobante?.Complemento?.TimbreFiscalDigital;
  const uuid = String(tfd?.UUID ?? '');
  if (!tfd) errors.push('Sin TimbreFiscalDigital: el CFDI no está timbrado');
  else if (!UUID.test(uuid)) errors.push('UUID inválido');

  const subtotal = toCents(c.SubTotal), total = toCents(c.Total);
  if (!Number.isFinite(subtotal) || !Number.isFinite(total)) errors.push('SubTotal o Total no numéricos');
  else {
    const conceptos = arr<any>(c.Conceptos?.Concepto);
    if (conceptos.length === 0) errors.push('Sin conceptos');
    const sumImporte = conceptos.reduce((s, x) => s + toCents(x.Importe), 0);
    if (tipo !== 'P' && Math.abs(sumImporte - subtotal) > conceptos.length) errors.push('La suma de importes de conceptos no coincide con el SubTotal');
    const imp = c.Impuestos;
    const tras = imp?.TotalImpuestosTrasladados !== undefined ? toCents(imp.TotalImpuestosTrasladados) : 0;
    const ret = imp?.TotalImpuestosRetenidos !== undefined ? toCents(imp.TotalImpuestosRetenidos) : 0;
    const desc = c.Descuento !== undefined ? toCents(c.Descuento) : 0;
    if (tipo !== 'P' && Math.abs(subtotal - desc + tras - ret - total) > 1) errors.push('Total ≠ SubTotal − Descuento + Traslados − Retenciones');
  }
  if (c.Moneda && c.Moneda !== 'MXN' && !c.TipoCambio) warnings.push('Moneda distinta de MXN sin TipoCambio');
  warnings.push('No se verificó sello, cadena original ni estatus ante el SAT.');
  return { ok: errors.length === 0, errors, warnings, uuid: uuid || undefined, emisorRfc, receptorRfc, fecha, subtotal, total, tipo, version };
}
