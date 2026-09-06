import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright';

process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
mkdirSync('.gaming/captures', { recursive: true });
const dir = mkdtempSync(resolve('.gaming/captures', `${Date.now()}-`));
const errors = [];
let server, browser;
let telemetry;
let build;
try {
  build = { indexSha256: createHash('sha256').update(readFileSync('dist/index.html')).digest('hex'),
    modifiedAt: statSync('dist/index.html').mtime.toISOString(), sourceFreshnessVerified: false };
  server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('No preview port');
  browser = await chromium.launch({ headless: true,
    ...(process.env.GAMING_CHROME ? { executablePath: process.env.GAMING_CHROME } : {}),
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => { Date.now = () => 1700000000000; });
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__hokyz?.assetsLoaded && window.__hokyz?.view?.sim.st.t > 2, null, { timeout: 60_000 });
  await page.screenshot({ path: join(dir, 'title.png') });
  await page.evaluate(() => { window.__hokyz.showScreen(null); window.__hokyz.view.hud.root.style.display = ''; });
  telemetry = await page.evaluate(async () => {
    const app = window.__hokyz;
    const initial = app.view.sim.st.t;
    const frames = [];
    let previous = performance.now();
    await new Promise((resolve) => {
      let active = true;
      setTimeout(() => { active = false; resolve(); }, 5_000);
      function frame(now) {
        if (!active) return;
        frames.push(now - previous); previous = now;
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    frames.sort((a, b) => a - b);
    const st = app.view.sim.st;
    return { initialSimTime: initial, simTime: st.t, phase: st.phase,
      score: st.teams.map((team) => team.score), backend: app.rig.gpu.backend,
      tier: app.rig.tier, frameP95Ms: frames[Math.floor(frames.length * 0.95)], frames: frames.length };
  });
  if (telemetry.frames < 2) errors.push('Insufficient rendered frames during sampling');
  if (!(telemetry.simTime > telemetry.initialSimTime)) errors.push('Rendered simulation did not advance');
  await page.screenshot({ path: join(dir, 'rink.png') });
} catch (error) { errors.push(String(error)); }
finally {
  await browser?.close();
  if (server) await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
writeFileSync(join(dir, 'capture.json'), JSON.stringify({ pass: errors.length === 0, scenario: 'AI attract match', build, viewport: [1280, 720], telemetry, errors }, null, 2) + '\n');
console.log(`${errors.length ? 'FAIL' : 'PASS'} capture: ${dir}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
