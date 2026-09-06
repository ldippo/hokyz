import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/puck-motion', { recursive: true });
const out = mkdtempSync(resolve('.gaming/puck-motion', `${Date.now()}-`));
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
const checks = [], errors = []; let browser;
try {
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem('hokyz.meta.v1', JSON.stringify({ quality: 'low', cinematics: false, music: false })));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  await page.waitForFunction(() => window.__hokyz?.assetsLoaded && window.__hokyz?.view, null, { timeout: 90000 });
  await page.evaluate(() => { window.__hokyz.loop.stop(); window.__hokyz.showScreen(null); });
  for (const reduced of [false, true, false]) {
    const states = await page.evaluate(reduced => {
      const app = window.__hokyz, sim = app.view.sim;
      app.meta.reducedMotion = reduced; app.startView(sim, false);
      const view = app.view, puck = sim.st.puck;
      puck.owner = null; puck.pos = { x: 0, y: 0 }; puck.z = 1;
      view.puck.snap(puck);
      return [0, Math.PI / 16, 3 * Math.PI / 16].map(time => {
        view.time = time; view.render(1, 0);
        return { scale: view.puck.glow.scale.x, visible: view.puck.glow.visible,
          cueY: view.puck.glow.position.y, puckY: view.puck.mesh.position.y, reduced: view.access.reducedMotion };
      });
    }, reduced);
    checks.push({ reduced, states });
    await page.screenshot({ path: join(out, `puck-${checks.length}-${reduced}.png`) });
    assert.ok(states.every(s => s.visible && s.cueY === 0.012 && s.puckY === 1.03 && s.reduced === reduced));
    if (!process.argv.includes('--baseline')) {
      if (reduced) assert.ok(states.every(s => s.scale === 1), 'Reduced-motion locator pulses');
      else assert.ok(states[1].scale > states[2].scale, 'Normal pulse did not restore');
    }
  }
  assert.deepEqual(errors, []);
} catch (e) { errors.push(String(e)); process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
writeFileSync(join(out, 'report.json'), JSON.stringify({ pass: !errors.length, checks, errors,
  scope: 'Prepared airborne loose puck through production startView preferences; fixed render times, not natural passing or OS preference coverage.' }, null, 2));
console.log(out, errors.length ? errors : 'PASS puck motion');
