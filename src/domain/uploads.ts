/** Validación de archivos de expediente: extensión permitida, contenido coherente con la extensión y tamaño. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type Rule = { mime: string; check: (b: Uint8Array) => boolean };
const startsWith = (b: Uint8Array, sig: number[]) => sig.every((x, i) => b[i] === x);
const textual = (b: Uint8Array) => {
  const n = Math.min(b.length, 8192);
  for (let i = 0; i < n; i++) if (b[i] === 0) return false; // un archivo de texto no trae bytes nulos
  return true;
};
const xmlLike = (b: Uint8Array) => {
  let i = 0;
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3;
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x0a || b[i] === 0x0d || b[i] === 0x09)) i++;
  return b[i] === 0x3c && textual(b);
};
const zip = (b: Uint8Array) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]);

const RULES: Record<string, Rule> = {
  pdf: { mime: 'application/pdf', check: b => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  xml: { mime: 'application/xml', check: xmlLike },
  png: { mime: 'image/png', check: b => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  jpg: { mime: 'image/jpeg', check: b => startsWith(b, [0xff, 0xd8, 0xff]) },
  jpeg: { mime: 'image/jpeg', check: b => startsWith(b, [0xff, 0xd8, 0xff]) },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', check: zip },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', check: zip },
  csv: { mime: 'text/csv', check: textual },
  txt: { mime: 'text/plain', check: textual },
  ofx: { mime: 'application/x-ofx', check: textual },
  qfx: { mime: 'application/x-ofx', check: textual },
};
export const ALLOWED_EXTENSIONS = Object.keys(RULES);

export type UploadCheck = { ok: true; mime: string } | { ok: false; error: string };

export function validateUpload(name: string, bytes: Uint8Array): UploadCheck {
  if (bytes.length === 0) return { ok: false, error: 'El archivo está vacío.' };
  if (bytes.length > MAX_UPLOAD_BYTES) return { ok: false, error: `El archivo excede el límite de ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  const ext = /\.([A-Za-z0-9]{1,6})$/.exec(name.trim())?.[1].toLowerCase() ?? '';
  const rule = RULES[ext];
  if (!rule) return { ok: false, error: `Tipo de archivo no permitido (.${ext || 'sin extensión'}). Permitidos: ${ALLOWED_EXTENSIONS.join(', ')}.` };
  if (!rule.check(bytes)) return { ok: false, error: `El contenido no corresponde a un archivo .${ext}.` };
  return { ok: true, mime: rule.mime };
}

/** Los nombres son datos, no rutas: se conserva solo el nombre base, sin caracteres de control. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'archivo';
  const clean = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').trim().slice(0, 150);
  return clean && clean !== '.' && clean !== '..' ? clean : 'archivo';
}
