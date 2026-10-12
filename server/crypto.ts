import crypto from 'node:crypto';

const MAGIC = Buffer.from('CVENC1');

/** Interpreta una clave en base64 de 32 bytes (AES-256). */
export function parseKey(b64: string | undefined): Buffer | null {
  if (!b64) return null;
  const k = Buffer.from(b64, 'base64');
  if (k.length !== 32) throw new Error('DATA_KEY debe ser una clave de 32 bytes en base64 (genérala con scripts/genkey.mjs)');
  return k;
}

/** Huella corta de la clave: sirve para comprobar que se tiene la correcta sin mostrarla. No permite recuperarla. */
export const fingerprint = (key: Buffer) => crypto.createHash('sha256').update(key).digest('hex').slice(0, 8).toUpperCase();

export const isEncrypted = (b: Buffer) => b.subarray(0, MAGIC.length).equals(MAGIC);

export function encrypt(key: Buffer | null, plain: Buffer): Buffer {
  if (!key) return plain;
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), ct]);
}

/** Descifra; un dato sin marca (anterior al cifrado) se devuelve tal cual. Lanza si la clave no corresponde o el dato se alteró. */
export function decrypt(key: Buffer | null, data: Buffer): Buffer {
  if (!isEncrypted(data)) return data;
  if (!key) throw new Error('Los datos están cifrados y falta DATA_KEY');
  const d = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(6, 18));
  d.setAuthTag(data.subarray(18, 34));
  return Buffer.concat([d.update(data.subarray(34)), d.final()]);
}

export const CANARY_FILE = '.key-check';
const CANARY_TEXT = 'canville-clave-correcta';

/**
 * Comprobación al arrancar. Evita dos desastres: usar una clave equivocada (datos ilegibles o ilegibles a medias)
 * y arrancar SIN clave en un servidor que ya cifra (escribiría datos sin cifrar mezclados con cifrados).
 */
export function checkKeyAtStartup(dir: string, key: Buffer | null, fs: typeof import('node:fs'), path: typeof import('node:path')): string {
  const f = path.join(dir, CANARY_FILE);
  if (fs.existsSync(f)) {
    const stored = fs.readFileSync(f);
    if (!key) throw new Error('Este servidor ya usa cifrado y falta DATA_KEY. No se inicia para no escribir datos sin cifrar.');
    let ok = false;
    try { ok = decrypt(key, stored).toString() === CANARY_TEXT; } catch { ok = false; }
    if (!ok) throw new Error(`DATA_KEY no corresponde a la clave con la que se cifraron los datos (huella de la clave dada: ${fingerprint(key)}). No se inicia.`);
    return `cifrado activo (huella de clave ${fingerprint(key)})`;
  }
  if (key) { fs.writeFileSync(f, encrypt(key, Buffer.from(CANARY_TEXT)), { mode: 0o600 }); return `cifrado activado (huella de clave ${fingerprint(key)}): anótala en la hoja de custodia`; }
  return 'SIN cifrado (define DATA_KEY para cifrar datos y archivos)';
}
