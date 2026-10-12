// Genera la clave de cifrado del servidor (AES-256). Se muestra UNA vez y no se guarda en ningún archivo.
//   node scripts/genkey.mjs                  → genera una clave nueva
//   node scripts/genkey.mjs --verify         → pide una clave (variable DATA_KEY) y muestra su huella
import crypto from 'node:crypto';

const fp = k => crypto.createHash('sha256').update(k).digest('hex').slice(0, 8).toUpperCase();

if (process.argv[2] === '--verify') {
  const b64 = process.env.DATA_KEY ?? '';
  const k = Buffer.from(b64, 'base64');
  if (k.length !== 32) { console.error('DATA_KEY no es una clave válida (32 bytes en base64). Ejecuta: DATA_KEY=<tu clave> node scripts/genkey.mjs --verify'); process.exit(1); }
  console.log(`Huella de la clave: ${fp(k)}  (compárala con la anotada en la hoja de custodia)`);
} else {
  const key = crypto.randomBytes(32);
  console.log(`
CLAVE DE CIFRADO (cópiala AHORA; no se vuelve a mostrar ni se guardó en ningún archivo):

  ${key.toString('base64')}

Huella (se puede anotar y mostrar sin riesgo): ${fp(key)}

Qué hacer:
  1. Guárdala en el gestor de contraseñas de Grupo Canville y en una copia impresa sellada, en dos lugares distintos.
  2. Pásala al servidor como la variable DATA_KEY (nunca en el repositorio, ni por chat o correo).
  3. Anota la huella en docs/custodia-clave.md. Al arrancar, el servidor imprime la huella de la clave que recibió.
  4. Guarda la clave APARTE de los respaldos de la base y los archivos.
Si pierdes esta clave, los datos cifrados NO se pueden recuperar.
`);
}
