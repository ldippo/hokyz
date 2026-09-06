import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/models', { recursive: true });
const out = mkdtempSync(resolve('.gaming/models', `${Date.now()}-`));
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
  for (const version of process.argv.includes('--compare') ? ['before', 'after'] : ['after']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    if (version === 'before') await page.route('**/models/*.glb', route => route.fulfill({ path: resolve('.gaming/models-before', new URL(route.request().url()).pathname.split('/').pop()), contentType: 'model/gltf-binary' }));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?rigview=1&capture=1&poses=idle,skate,charge,lunge,down&goalie=butterfly`);
    await page.waitForFunction(() => window.__rigview, null, { timeout: 90000 });
    for (const subject of ['skater', 'goalie', 'poses']) {
      await page.evaluate(subject => {
        const app = window.__hokyz, { entries, grig } = window.__rigview;
        document.querySelectorAll('#ui, .hud').forEach(el => { el.style.display = 'none'; });
        entries.forEach(({ rig }, i) => { rig.group.visible = subject === 'poses' || (subject === 'skater' && i === 0); });
        grig.group.visible = subject !== 'skater';
        const cam = app.rig.camera;
        if (subject === 'skater') { cam.position.set(2.6, 1.8, -1.75); cam.lookAt(0, 0.9, -3.4); }
        else if (subject === 'goalie') { cam.position.set(0.8, 1.7, 1.5); cam.lookAt(-1.8, 0.75, 0); }
        else { cam.position.set(9, 6, 8); cam.lookAt(-0.5, 0.8, 0); }
        app.rig.render(0);
      }, subject);
      await page.screenshot({ path: join(out, `${version}-${subject}.png`) });
    }
    if (errors.length) throw new Error(errors.join('\n'));
    await page.close();
  }
  console.log(out);
} finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
