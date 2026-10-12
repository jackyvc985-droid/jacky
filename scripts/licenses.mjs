// Inventario de licencias de las dependencias de producción (según package-lock.json).
// Uso: node scripts/licenses.mjs > docs/THIRD_PARTY_LICENSES.md
import fs from 'node:fs';
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const PERMISSIVE = /^(MIT|ISC|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|0BSD|BlueOak-1\.0\.0|CC0-1\.0|Unlicense|Python-2\.0|CC-BY-4\.0|MIT-0)$/;
const rows = [];
for (const [path, meta] of Object.entries(lock.packages)) {
  if (!path.startsWith('node_modules/') || meta.dev || meta.optional && meta.devOptional) continue;
  const name = path.replace(/^.*node_modules\//, '');
  let lic = meta.license;
  let repo = '';
  try {
    const pj = JSON.parse(fs.readFileSync(`${path}/package.json`, 'utf8'));
    lic = lic ?? pj.license ?? (Array.isArray(pj.licenses) ? pj.licenses.map(l => l.type).join(' OR ') : pj.licenses?.type);
    repo = typeof pj.repository === 'string' ? pj.repository : pj.repository?.url ?? '';
  } catch { /* paquete opcional no instalado en esta plataforma */ }
  if (typeof lic === 'object' && lic) lic = lic.type;
  rows.push({ name, version: meta.version, lic: String(lic ?? 'DESCONOCIDA'), repo: repo.replace(/^git\+/, '').replace(/\.git$/, '') });
}
rows.sort((a, b) => a.name.localeCompare(b.name));
const simple = l => l.replace(/[()]/g, '').split(/ OR /i).map(s => s.trim());
const review = rows.filter(r => !simple(r.lic).some(l => PERMISSIVE.test(l)));
const counts = {};
for (const r of rows) counts[r.lic] = (counts[r.lic] ?? 0) + 1;
const out = [];
out.push('# Dependencias de terceros y licencias\n');
out.push(`Generado con \`node scripts/licenses.mjs\` a partir de \`package-lock.json\` (solo dependencias de producción: ${rows.length}). **Es un inventario automático, no un dictamen legal**: revísalo con un especialista antes de publicar, sobre todo las filas marcadas.\n`);
out.push('## Resumen por licencia\n');
for (const [l, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) out.push(`- ${l}: ${n}`);
out.push(`\n## Requieren revisión (${review.length})\n`);
out.push(review.length ? review.map(r => `- **${r.name}@${r.version}** — ${r.lic} ${r.repo}`).join('\n') : 'Ninguna: todas declaran una licencia permisiva conocida.');
out.push('\n## Inventario completo\n\n| Paquete | Versión | Licencia |\n|---|---|---|');
for (const r of rows) out.push(`| ${r.name} | ${r.version} | ${r.lic} |`);
console.log(out.join('\n'));
