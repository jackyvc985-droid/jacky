import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';

const arr = <T,>(x: T | T[] | undefined): T[] => (x === undefined ? [] : Array.isArray(x) ? x : [x]);
const colIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/[^A-Z]/gi, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
};

/** Lee la primera hoja de un .xlsx como tabla de textos (los números quedan como texto; las fechas, como serial). */
export function xlsxToTable(bytes: Uint8Array): string[][] {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(bytes, { filter: f => /^xl\/(sharedStrings|worksheets\/sheet\d+|workbook)\.xml$/.test(f.name) }); }
  catch { throw new Error('El archivo Excel está dañado o no es .xlsx (guárdalo como .xlsx o CSV)'); }
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', removeNSPrefix: true, processEntities: true, parseTagValue: false, trimValues: false });
  const shared: string[] = files['xl/sharedStrings.xml']
    ? arr<any>(parser.parse(strFromU8(files['xl/sharedStrings.xml'])).sst?.si).map(si => (typeof si.t === 'object' ? si.t['#text'] ?? '' : si.t ?? arr<any>(si.r).map(r => (typeof r.t === 'object' ? r.t['#text'] ?? '' : r.t ?? '')).join('')))
    : [];
  const sheetName = Object.keys(files).filter(n => n.startsWith('xl/worksheets/')).sort()[0];
  if (!sheetName) throw new Error('El Excel no contiene hojas');
  const sheet = parser.parse(strFromU8(files[sheetName])).worksheet;
  const table: string[][] = [];
  for (const row of arr<any>(sheet?.sheetData?.row)) {
    const r: string[] = [];
    for (const c of arr<any>(row.c)) {
      const i = colIndex(c.r ?? '');
      let v = '';
      if (c.t === 's') v = shared[Number(c.v)] ?? '';
      else if (c.t === 'inlineStr') v = typeof c.is?.t === 'object' ? c.is.t['#text'] ?? '' : c.is?.t ?? '';
      else v = c.v === undefined ? '' : String(typeof c.v === 'object' ? c.v['#text'] ?? '' : c.v);
      r[i] = v;
    }
    for (let k = 0; k < r.length; k++) if (r[k] === undefined) r[k] = '';
    table.push(r);
  }
  return table;
}
