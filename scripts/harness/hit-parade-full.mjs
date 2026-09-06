import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { resultProbe } from './result-probe.mjs';

mkdirSync('.gaming/hit-parade-full', { recursive: true });
const out = mkdtempSync(resolve('.gaming/hit-parade-full', `${Date.now()}-`));
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
const results = [], errors = [];
let browser;
try {
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
  for (const mode of ['idle', 'chase']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => {
      Date.now = () => 1700000000000;
      localStorage.setItem('hokyz.meta.v1', JSON.stringify({ quality: 'low', cinematics: false, music: false }));
    });
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
    await page.waitForFunction(() => window.__hokyz?.assetsLoaded && window.__hokyz?.view, null, { timeout: 90000 });
    await page.evaluate(() => window.__hokyz.loop.stop());
    await page.getByRole('button', { name: 'New Run', exact: true }).click();
    await page.locator('.cards [data-nav]').first().click();
    await page.evaluate(() => { window.__hokyz.run.maps[0].rows[0][0].type = 'hitparade'; });
    await page.locator('.node.available.match').first().click();
    await page.getByRole('button', { name: 'Drop the Gloves', exact: true }).click();
    const evidence = await page.evaluate(mode => {
      const app = window.__hokyz, sim = app.view.sim, held = new Set();
      const cashBefore = app.run.cash, hits = [], positions = [];
      const setKey = (code, down) => {
        if (held.has(code) === down) return;
        if (down) held.add(code); else held.delete(code);
        window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
      };
      let ticks = 0;
      while (app.view?.sim === sim && ticks < 3610) {
        if (mode === 'chase') {
          const me = sim.st.skaters[sim.st.teams[0].controlledId];
          const targets = sim.st.teams[1].skaters.map(id => sim.st.skaters[id]);
          const standing = targets.filter(sk => sk.knockdown <= 0);
          const target = (standing.length ? standing : targets).sort((a,b) => Math.hypot(a.pos.x-me.pos.x,a.pos.y-me.pos.y)-Math.hypot(b.pos.x-me.pos.x,b.pos.y-me.pos.y))[0];
          const dx = target.pos.x-me.pos.x, dy = target.pos.y-me.pos.y;
          for (const [code, down] of [['KeyD',dx>0.2],['KeyA',dx< -0.2],['KeyS',dy>0.2],['KeyW',dy< -0.2],['ShiftLeft',true],['KeyK',ticks%30<2]]) setKey(code, down);
        }
        app.simStep(); ticks++;
        if (app.view?.sim === sim) {
          for (const event of app.view.lastEvents) if (event.type === 'hit') hits.push({ tick: ticks, ...event });
          if (ticks % 600 === 0) positions.push({ tick: ticks, positions: sim.st.teams[1].skaters.map(id => ({ ...sim.st.skaters[id].pos })) });
        }
      }
      for (const code of [...held]) setKey(code, false);
      return { ticks, simTime: sim.st.t, cashBefore, cashAfter: app.run.cash, hits, positions, pending: app.run.pendingDraft };
    }, mode);
    const heading = await page.locator('.result h2').textContent();
    const score = await page.locator('.score-line').textContent();
    const layout = process.argv.includes('--layout') ? await resultProbe(page, out, mode) : null;
    results.push({ mode, heading, score, ...evidence, layout });
    await page.screenshot({ path: join(out, `${mode}-result.png`) });
    assert.ok(evidence.ticks >= 3600 && evidence.ticks <= 3602, 'Challenge did not expire naturally at 60 seconds');
    if (mode === 'idle') {
      assert.equal(heading, 'NOT THIS TIME');
      assert.equal(evidence.cashAfter, evidence.cashBefore);
      assert.ok(!evidence.pending);
    } else {
      assert.ok(evidence.hits.length > 0, 'Movement/check input produced no hits');
      assert.equal(heading, 'CHALLENGE CLEARED', 'Seeded pursuit no longer reaches the challenge target');
      if (heading === 'CHALLENGE CLEARED') {
        assert.equal(evidence.cashAfter, evidence.cashBefore + 60);
        assert.ok(evidence.pending?.perkIds.length);
        await page.getByRole('button', { name: 'Skip perk', exact: true }).click();
        assert.equal(await page.evaluate(() => window.__hokyz.run.cash), evidence.cashAfter);
        assert.ok(!await page.evaluate(() => window.__hokyz.run.pendingDraft));
      }
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
} catch (error) { errors.push(String(error)); process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
writeFileSync(join(out, 'report.json'), JSON.stringify({ pass: !errors.length, results, errors, scope: 'Prepared reachable node; 60 seconds of real simulation, DOM key events and natural outcome. Scripted pursuit is not human game-feel evidence.' }, null, 2));
console.log(out, errors.length ? errors : results.map(({ mode, score, heading }) => ({ mode, score, heading })));
