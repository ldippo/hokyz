import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { resultProbe } from './result-probe.mjs';

mkdirSync('.gaming/rewards', { recursive: true });
const out = mkdtempSync(resolve('.gaming/rewards', `${Date.now()}-`));
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
let browser;
const checks = [], errors = [];
const skills = process.argv.includes('--skills');
const shootoutResult = process.argv.includes('--shootout-result');
try {
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
  for (const choice of ['pick', 'skip']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => {
      if (!localStorage.getItem('hokyz.meta.v1')) localStorage.setItem('hokyz.meta.v1', JSON.stringify({ quality: 'low', cinematics: false, music: false }));
    });
    const ready = async () => {
      await page.waitForFunction(() => window.__hokyz?.assetsLoaded && window.__hokyz?.view, null, { timeout: 90000 });
      await page.evaluate(() => window.__hokyz.loop.stop());
    };
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
    await ready();
    await page.getByRole('button', { name: 'New Run', exact: true }).click();
    await page.locator('.cards [data-nav]').first().click();
    if (skills) await page.evaluate(() => {
      // Prepare a reachable shootout node; outcome and reward code remain real.
      const run = window.__hokyz.run;
      run.maps[0].rows[0][0].type = 'shootout';
    });
    await page.locator('.node.available.match').first().click();
    await page.getByRole('button', { name: skills ? 'Take the Shot' : 'Drop the Puck', exact: true }).click();
    // A terminal win fixture exercises production outcome/reward routing, not
    // human match difficulty. No direct mutation of the run or reward itself.
    await page.evaluate(shootoutResult => {
      const app = window.__hokyz, st = app.view.sim.st;
      st.phase = 'over'; st.winner = 0; st.teams[0].score = 3; st.teams[1].score = 1;
      if (shootoutResult) {
        st.teams[1].score = 2;
        st.shootout = { stage: 'done', goals: [2, 0] };
      }
      app.onTick(); st.t += 3;
    }, shootoutResult);
    await page.keyboard.press('Enter');
    await page.evaluate(() => { const app = window.__hokyz; app.input.poll(); app.onTick(); });
    if (!skills) assert.equal(await page.getByRole('button', { name: 'Draft a Perk', exact: true }).count(), 1);
    else assert.equal(await page.locator('.result h2').textContent(), 'CHALLENGE CLEARED');
    if (!skills && !process.argv.includes('--baseline')) {
      const note = page.locator('.shootout-summary');
      if (shootoutResult) {
        assert.match(await note.textContent(), /Shootout:.*2.*0/);
        assert.match(await note.textContent(), /deciding point/);
      } else assert.equal(await note.count(), 0);
      checks.push(shootoutResult ? 'Completed shootout attempts and deciding-point explanation rendered' : 'Regulation result has no shootout explanation');
    }
    if (process.argv.includes('--layout') && choice === 'pick') writeFileSync(join(out, 'layout.json'), JSON.stringify(await resultProbe(page, out, 'result'), null, 2));
    const pending = await page.evaluate(() => window.__hokyz.run.pendingDraft);
    assert.ok(pending?.perkIds.length, 'Result did not persist earned reward');
    await page.reload(); await ready();
    await page.getByRole('button', { name: 'Continue Run', exact: true }).click();
    assert.equal(await page.locator('.screen-title').textContent(), 'DRAFT A PERK');
    const names = await page.locator('.cards .cname').allTextContents();
    const offered = await page.evaluate(() => window.__hokyz.meta.telemetry.perkOffered);
    await page.reload(); await ready();
    await page.getByRole('button', { name: 'Continue Run', exact: true }).click();
    assert.deepEqual(await page.locator('.cards .cname').allTextContents(), names, 'Reload rerolled reward choices');
    assert.deepEqual(await page.evaluate(() => window.__hokyz.meta.telemetry.perkOffered), offered, 'Reload counted the same offers again');
    const cash = await page.evaluate(() => window.__hokyz.run.cash);
    await page.screenshot({ path: join(out, `${choice}-resumed-draft.png`) });
    if (choice === 'pick') await page.locator('.cards [data-nav]').first().click();
    else await page.getByRole('button', { name: skills ? 'Skip perk' : 'Skip (+25 cash)', exact: true }).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hokyz.run.v1')));
    assert.ok(!saved.pendingDraft, 'Resolved reward still pending in save');
    if (choice === 'pick') assert.equal(saved.perks.filter(id => id === pending.perkIds[0]).length, 1);
    else assert.equal(saved.cash, cash + (skills ? 0 : 25));
    checks.push(`${skills ? 'skills' : 'match'} ${choice}: result reload, draft reload, stable choices, persisted resolution`);
    await page.close();
  }
  assert.deepEqual(errors, []);
} catch (error) { errors.push(String(error)); process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
writeFileSync(join(out, 'report.json'), JSON.stringify({ pass: !errors.length, checks, errors, scope: 'Terminal-win fixture and real UI/save/reload; not complete-run or human victory evidence' }, null, 2));
console.log(out, errors.length ? errors : 'PASS reward recovery');
