import {createRequire} from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
let pw; try { pw = require('playwright'); } catch { pw = (await import('playwright')).default ?? await import('playwright'); }
const {chromium} = pw;
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = process.cwd();
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, {'content-type': f.endsWith('.js') || f.endsWith('.mjs') ? 'text/javascript' : 'text/html'}); r.end(d); }); }).listen(8765);
const mode = process.argv[2]; // shots | render
const scale = process.argv[3] || '0.4';
const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl']});
const page = await browser.newPage({viewport: {width: Math.round(1080 * scale), height: Math.round(1920 * scale)}});
page.on('console', m => console.log('console:', m.text())); page.on('pageerror', e => console.log('ERR', e.message));
await page.goto(`http://localhost:8765/index.html?scale=${scale}&mc=${process.argv[4] || 150}`);
await page.waitForFunction('window.__ready', null, {timeout: 600000});
if (mode === 'shots') {
  for (const t of (process.argv[5] || '0,2.5,4,5').split(',')) {
    await page.evaluate(i => window.renderFrame(i), Math.round(Number(t) * 30));
    await page.screenshot({path: `shot_${t}.png`}); console.log('shot', t);
  }
} else {
  fs.mkdirSync('frames', {recursive: true});
  for (let i = 0; i < 150; i++) { await page.evaluate(i => window.renderFrame(i), i); await page.screenshot({path: `frames/f${String(i).padStart(4, '0')}.png`}); if (i % 10 == 0) console.log('frame', i); }
}
await browser.close(); srv.close();
