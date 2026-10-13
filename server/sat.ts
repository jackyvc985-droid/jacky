/**
 * Consulta de estatus de CFDI ante el SAT (servicio público "ConsultaCFDIService").
 * Construcción de la solicitud y lectura de la respuesta según la especificación pública.
 * NOTA: no se pudo probar contra el servicio real desde el entorno de desarrollo (sin acceso de red al SAT).
 */
export const SAT_URL = 'https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc';
const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;
const UUID = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;

export type SatQuery = { re: string; rr: string; total: string; uuid: string };

export function validateQuery(q: SatQuery): string | null {
  if (!RFC.test(q.re)) return 'RFC emisor inválido';
  if (!RFC.test(q.rr)) return 'RFC receptor inválido';
  if (!UUID.test(q.uuid)) return 'UUID inválido';
  if (!/^\d{1,10}(\.\d{1,6})?$/.test(q.total)) return 'Total inválido';
  return null;
}

/** tt = 10 enteros + 6 decimales, ej. 0000001160.000000 */
export function formatTotal(total: string): string {
  const [i, d = ''] = total.split('.');
  return `${i.padStart(10, '0')}.${d.padEnd(6, '0')}`;
}

export function buildEnvelope(q: SatQuery): string {
  const expr = `?re=${q.re}&rr=${q.rr}&tt=${formatTotal(q.total)}&id=${q.uuid}`;
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/"><soapenv:Header/><soapenv:Body><tem:Consulta><tem:expresionImpresa><![CDATA[${expr}]]></tem:expresionImpresa></tem:Consulta></soapenv:Body></soapenv:Envelope>`;
}

export type SatStatus = { codigo: string; estado: string; cancelable: string; estatusCancelacion: string };
export function parseResponse(xml: string): SatStatus {
  const pick = (tag: string) => new RegExp(`<(?:\\w+:)?${tag}[^>]*>([^<]*)</(?:\\w+:)?${tag}>`).exec(xml)?.[1]?.trim() ?? '';
  const estado = pick('Estado');
  if (!estado) throw new Error('Respuesta del SAT no reconocida');
  return { codigo: pick('CodigoEstatus'), estado, cancelable: pick('EsCancelable'), estatusCancelacion: pick('EstatusCancelacion') };
}

export async function consultaSat(q: SatQuery, timeoutMs = 10000): Promise<SatStatus> {
  const bad = validateQuery(q); if (bad) throw new Error(bad);
  const res = await fetch(SAT_URL, {
    method: 'POST', signal: AbortSignal.timeout(timeoutMs),
    headers: { 'content-type': 'text/xml; charset=utf-8', soapaction: 'http://tempuri.org/IConsultaCFDIService/Consulta' },
    body: buildEnvelope(q),
  });
  if (!res.ok) throw new Error(`El SAT respondió ${res.status}`);
  return parseResponse(await res.text());
}
