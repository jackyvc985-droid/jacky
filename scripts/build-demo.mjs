// Genera demo/canville-demo.html: la versión web en un solo archivo (modo demostración).
// Uso: npm run build:demo
import fs from 'node:fs';
import { execSync } from 'node:child_process';

execSync('npx expo export --platform web', { stdio: 'inherit', env: { ...process.env, CI: '1' } });
const dir = 'dist/_expo/static/js/web';
const bundle = fs.readdirSync(dir).find(f => /^index-.*\.js$/.test(f));
const js = fs.readFileSync(`${dir}/${bundle}`, 'utf8').replaceAll('</script', '<\\/script');
let html = fs.readFileSync('dist/index.html', 'utf8')
  .replace(/<link rel="icon"[^>]*>/, '')
  .replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '')
  .replace('<html lang="en">', '<html lang="es">')
  .replace('</body>', () => `<script>${js}</script></body>`);
fs.mkdirSync('demo', { recursive: true });
fs.writeFileSync('demo/canville-demo.html', html);
console.log(`demo/canville-demo.html (${Math.round(html.length / 1024)} KB)`);
