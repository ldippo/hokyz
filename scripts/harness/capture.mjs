import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
mkdirSync('.gaming/captures', { recursive: true });
const dir = mkdtempSync(resolve('.gaming/captures', `${Date.now()}-`));
const errors = [];
const arena = process.argv.includes('--arena');
const crowdMotion = process.argv.includes('--crowd-motion');
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
  if (arena) await page.addInitScript(quality => localStorage.setItem('hokyz.meta.v1', JSON.stringify({ quality, music: false, cinematics: false, reducedMotion: true })), process.argv.includes('--low') ? 'low' : 'high');
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
  if (arena) {
    await page.evaluate(crowdMotion => {
      const app = window.__hokyz; app.loop.stop();
      if (crowdMotion) app.rig.settings.crowdAnim = true;
      const originalRandom = Math.random;
      let seed = 42;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      try { app.disposeView(); app.attract(); } finally { Math.random = originalRandom; }
      app.showScreen(null);
      app.view.hud.root.style.display = '';
      for (let i = 0; i < 360; i++) app.view.afterStep(app.view.sim.step());
      app.view.render(1, 0);
    }, crowdMotion);
    await page.screenshot({ path: join(dir, 'arena-fixed.png') });
    if (process.argv.includes('--play-motion')) {
      const samples = [];
      let capturedHit = false;
      for (let frame = 0; frame < 120; frame++) {
        const sample = await page.evaluate(() => {
          const view = window.__hokyz.view;
          const events = [];
          for (let step = 0; step < 6; step++) {
            const next = view.sim.step(); events.push(...next); view.afterStep(next);
          }
          view.render(1, 0.1);
          const st = view.sim.st;
          const projected = view.puck.mesh.position.clone().project(view.rig.camera);
          return { t: st.t, phase: st.phase, puck: { ...st.puck.pos }, owner: st.puck.owner,
            puckView: { z: st.puck.z, x: (projected.x + 1) * innerWidth / 2, y: (1 - projected.y) * innerHeight / 2,
              depth: projected.z, meshVisible: view.puck.mesh.visible, glowVisible: view.puck.glow.visible },
            events: events.filter(e => ['hit', 'shot', 'goal', 'pass'].includes(e.type)),
            skaters: st.order.map(id => { const s = st.skaters[id]; return { id, pos: { ...s.pos }, speed: Math.hypot(s.vel.x,s.vel.y), knockdown: s.knockdown }; }) };
        });
        samples.push(sample);
        if (frame % 20 === 0) await page.screenshot({ path: join(dir, `play-motion-${frame}.png`) });
        if (!capturedHit && sample.events.some(e => e.type === 'hit')) {
          await page.screenshot({ path: join(dir, 'play-motion-hit.png') }); capturedHit = true;
          const x = Math.max(0, Math.min(1080, sample.puckView.x - 100));
          const y = Math.max(0, Math.min(520, sample.puckView.y - 100));
          await page.screenshot({ path: join(dir, 'play-motion-hit-puck.png'), clip: { x, y, width: 200, height: 200 } });
        }
      }
      writeFileSync(join(dir, 'play-motion.json'), JSON.stringify({ samples,
        scope: 'Natural seeded attract play; 12 simulated seconds sampled/rendered at 10Hz. No human input or hardware FPS claim.' }, null, 2));
      assert.ok(samples.at(-1).t > samples[0].t, 'Motion capture simulation did not advance');
    }
    if (crowdMotion) {
      const states = [];
      for (const stage of ['idle', 'wave', 'settled']) {
        states.push(await page.evaluate(stage => {
          const app = window.__hokyz, crowd = app.view.rink.crowd;
          if (stage === 'wave') { crowd.startWave(); crowd.update(2, 0); }
          if (stage === 'settled') crowd.update(10, 0);
          app.view.render(1, 0);
          return { stage, wave: crowd.wave.value, active: crowd.waveActive?.value,
            animatedMeshes: crowd.meshes.filter(mesh => mesh.material.positionNode).length };
        }, stage));
        await page.screenshot({ path: join(dir, `crowd-${stage}.png`) });
      }
      writeFileSync(join(dir, 'crowd-motion.json'), JSON.stringify(states, null, 2));
      if (!process.argv.includes('--baseline')) {
        assert.deepEqual(states.map(state => state.active), [0, 1, 0], 'Crowd wave must be idle, active, then idle');
        assert.ok(states.every(state => state.animatedMeshes === 3), 'All three crowd variants must compile with motion');
      }
    }
  }
} catch (error) { errors.push(String(error)); }
finally {
  await browser?.close();
  if (server) await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
writeFileSync(join(dir, 'capture.json'), JSON.stringify({ pass: errors.length === 0, scenario: 'AI attract match', fixedArena: arena ? { seed: 42, simSteps: 360, reducedMotion: true, crowdMotionOverride: crowdMotion } : null, build, viewport: [1280, 720], telemetry, errors }, null, 2) + '\n');
console.log(`${errors.length ? 'FAIL' : 'PASS'} capture: ${dir}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
