import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/endings', { recursive: true });
const out = mkdtempSync(resolve('.gaming/endings', `${Date.now()}-`));
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
let browser, page;
const errors = [], checks = [];
try {
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(() => {
    if (!localStorage.getItem('hokyz.meta.v1')) localStorage.setItem('hokyz.meta.v1', JSON.stringify({ quality: 'low', cinematics: false, music: false }));
  });
  const ready = async () => {
    await page.waitForFunction(() => window.__hokyz?.assetsLoaded && window.__hokyz?.view, null, { timeout: 90000 });
    await page.evaluate(() => window.__hokyz.loop.stop());
  };
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`); await ready();
  await page.getByRole('button', { name: 'New Run', exact: true }).click();
  await page.locator('.cards [data-nav]').first().click();
  await page.locator('.node.available.match').first().click();
  await page.getByRole('button', { name: 'Drop the Puck', exact: true }).click();
  await page.evaluate(() => {
    const app = window.__hokyz, st = app.view.sim.st;
    st.phase = 'over'; st.winner = 1; st.teams[0].score = 1; st.teams[1].score = 3;
    app.onTick(); st.t += 3;
  });
  await page.keyboard.press('Enter');
  await page.evaluate(() => { const app = window.__hokyz; app.input.poll(); app.onTick(); });
  assert.equal(await page.getByRole('button', { name: 'See Run Summary', exact: true }).count(), 1);
  const endedSave = await page.evaluate(() => localStorage.getItem('hokyz.run.v1'));
  assert.equal(JSON.parse(endedSave)?.over, true, 'Ended run deleted before settlement');
  const before = await page.evaluate(() => window.__hokyz.meta.cash);
  await page.reload(); await ready();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.__restoreStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function(key, value) {
      if (key === 'hokyz.meta.v1') throw new DOMException('Test quota failure', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Continue Run', exact: true }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('hokyz.run.v1')), endedSave, 'Failed payout save discarded the ended run');
  await page.evaluate(() => window.__restoreStorage());
  checks.push('Failed meta write retains ended run for retry');
  await page.getByRole('button', { name: 'Continue Run', exact: true }).click();
  assert.equal(await page.locator('.result h2').textContent(), 'RUN OVER');
  const paid = await page.evaluate(() => JSON.parse(localStorage.getItem('hokyz.meta.v1')));
  assert.ok(paid.cash > before, 'Recovered run did not pay out');
  assert.equal(await page.evaluate(() => localStorage.getItem('hokyz.run.v1')), null);
  checks.push('Loss result survives reload and settles through Continue');
  await page.screenshot({ path: join(out, 'recovered-run-over.png') });
  // Model interrupted cleanup: meta was saved but the old run key remains.
  await page.evaluate(raw => localStorage.setItem('hokyz.run.v1', raw), endedSave);
  await page.reload(); await ready();
  await page.getByRole('button', { name: 'Continue Run', exact: true }).click();
  const repeated = await page.evaluate(() => JSON.parse(localStorage.getItem('hokyz.meta.v1')));
  assert.deepEqual(repeated, paid, 'Retry duplicated settlement, records or feats');
  checks.push('Uncleared ended save cannot duplicate payout or records');
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(String(error)); process.exitCode = 1;
  await page?.screenshot({ path: join(out, 'failure.png') }).catch(() => {});
} finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
writeFileSync(join(out, 'report.json'), JSON.stringify({ pass: !errors.length, checks, errors,
  scope: 'Prepared terminal loss; real outcome/summary/save/reload. Not full-run play evidence.' }, null, 2));
console.log(out, errors.length ? errors : 'PASS run settlement');
