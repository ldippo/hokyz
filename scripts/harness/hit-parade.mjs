import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/hit-parade', { recursive: true });
const out = mkdtempSync(resolve('.gaming/hit-parade', `${Date.now()}-`));
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
const errors = [], checks = [];
let browser, page;
try {
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(() => localStorage.setItem('hokyz.meta.v1', JSON.stringify({ quality: 'low', cinematics: false, music: false })));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  await page.waitForFunction(() => window.__hokyz?.assetsLoaded && window.__hokyz?.view, null, { timeout: 90000 });
  await page.evaluate(() => window.__hokyz.loop.stop());
  await page.getByRole('button', { name: 'New Run', exact: true }).click();
  await page.locator('.cards [data-nav]').first().click();
  await page.evaluate(() => { window.__hokyz.run.maps[0].rows[0][0].type = 'hitparade'; });
  await page.locator('.node.available.match').first().click();
  await page.getByRole('button', { name: 'Drop the Gloves', exact: true }).click();
  const step = () => page.evaluate(() => window.__hokyz.simStep());
  await page.keyboard.press('p');
  // Prepared hit on the pause tick exercises real scoring and guards against
  // replaying that event when menu Resume occurs before another sim step.
  await page.evaluate(() => {
    const app = window.__hokyz, st = app.view.sim.st;
    st.t += 1 / 60;
    app.view.lastEvents = [{ type: 'hit', hitter: st.teams[0].controlledId, victim: st.teams[1].skaters[0], big: true }];
    app.input.poll(); app.onTick();
  });
  assert.equal(await page.locator('.pause .screen-title').textContent(), 'HIT PARADE PAUSED');
  assert.match(await page.locator('.pause p').textContent(), /^2 \/ 8/);
  const snapshot = () => page.evaluate(() => ({ state: JSON.stringify(window.__hokyz.view.sim.st), save: localStorage.getItem('hokyz.run.v1'), cash: window.__hokyz.run.cash }));
  const paused = await snapshot();
  await page.evaluate(() => { for (let i = 0; i < 300; i++) window.__hokyz.simStep(); });
  assert.deepEqual(await snapshot(), paused, 'Pause changed simulation, cash or save');
  await page.screenshot({ path: join(out, 'paused.png') });
  await page.keyboard.press('Enter'); await step();
  assert.equal(await page.evaluate(() => window.__hokyz.paused), false);
  assert.deepEqual(await snapshot(), paused, 'Resume replayed the paused simulation tick');
  await page.keyboard.press('Escape'); await step();
  assert.match(await page.locator('.pause p').textContent(), /^2 \/ 8/, 'Resume counted the previous hit twice');
  assert.match(await page.locator('.pause p').textContent(), /60s remaining$/, 'Paused ticks consumed challenge time');
  await page.keyboard.press('p'); await step();
  assert.equal(await page.evaluate(() => window.__hokyz.paused), false);
  await step();
  assert.notEqual((await snapshot()).state, paused.state, 'Simulation did not resume');
  checks.push('Pause preserves state/save/cash; menu Resume avoids duplicate hit; Escape pauses and P resumes');
  await page.keyboard.press('p'); await step();
  await page.getByRole('button', { name: 'End challenge', exact: true }).click();
  assert.equal(await page.locator('.result h2').textContent(), 'NOT THIS TIME');
  assert.equal(await page.locator('.score-line').textContent(), '2 / 8');
  assert.equal(await page.evaluate(() => window.__hokyz.paused), false);
  assert.equal(await page.evaluate(() => window.__hokyz.run.cash), paused.cash);
  assert.notEqual((await page.evaluate(() => localStorage.getItem('hokyz.run.v1'))), paused.save);
  checks.push('Explicit End challenge settles once without granting an unearned reward');
  await page.screenshot({ path: join(out, 'ended.png') });
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(String(error)); process.exitCode = 1;
  await page?.screenshot({ path: join(out, 'failure.png') }).catch(() => {});
} finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
writeFileSync(join(out, 'report.json'), JSON.stringify({ pass: !errors.length, checks, errors, scope: 'Prepared reachable node/hit event; real input, pause, simulation stepping and settlement; not a human challenge victory' }, null, 2));
console.log(out, errors.length ? errors : 'PASS Hit Parade pause');
