import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/championship', { recursive: true });
const out = mkdtempSync(resolve('.gaming/championship', `${Date.now()}-`));
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
let browser, page;
const errors = [], checks = [];
try {
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
  for (const branch of ['bank', 'extend']) {
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => {
      if (!localStorage.getItem('hokyz.meta.v1')) localStorage.setItem('hokyz.meta.v1', JSON.stringify({ quality: 'low', cinematics: false, music: false }));
    });
    const ready = async () => {
      await page.waitForFunction(() => window.__hokyz?.assetsLoaded && window.__hokyz?.view, null, { timeout: 90000 });
      await page.evaluate(() => window.__hokyz.loop.stop());
    };
    const resume = async () => {
      await page.reload(); await ready();
      await page.getByRole('button', { name: 'Continue Run', exact: true }).click();
    };
    const finish = async won => {
      await page.evaluate(won => {
        const app = window.__hokyz, st = app.view.sim.st;
        st.phase = 'over'; st.winner = won ? 0 : 1;
        st.teams[0].score = won ? 3 : 1; st.teams[1].score = won ? 1 : 3;
        app.onTick(); st.t += 3;
      }, won);
      await page.keyboard.press('Enter');
      await page.evaluate(() => { const app = window.__hokyz; app.input.poll(); app.onTick(); });
    };
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`); await ready();
    await page.getByRole('button', { name: 'New Run', exact: true }).click();
    await page.locator('.cards [data-nav]').first().click();
    // Prepare a last-boss checkpoint, not a claim of playing the previous acts.
    await page.evaluate(() => {
      const app = window.__hokyz, run = app.run;
      run.act = 3; run.row = run.maps[2].rows.length - 1; run.currentNodeId = null;
      app.saveRun();
    });
    await resume();
    await page.locator('.node.available.boss').click();
    await page.getByRole('button', { name: 'Drop the Puck', exact: true }).click();
    await finish(true);
    assert.equal(await page.evaluate(() => window.__hokyz.run.leagueOffer), true);
    assert.equal(await page.evaluate(() => window.__hokyz.run.pendingDraft?.type), 'boss');
    await resume();
    assert.equal(await page.locator('.screen-title').textContent(), 'DRAFT A PERK', 'League offer skipped earned boss loot');
    assert.equal(await page.locator('.cards [data-nav]').count(), 4);
    await page.getByRole('button', { name: 'Skip (+25 cash)', exact: true }).click();
    await resume();
    assert.equal(await page.getByRole('button', { name: 'Bank the Trophy', exact: true }).count(), 1);
    await page.screenshot({ path: join(out, `${branch}-league-offer.png`) });
    if (branch === 'bank') {
      await page.getByRole('button', { name: 'Bank the Trophy', exact: true }).click();
    } else {
      await page.getByRole('button', { name: 'Keep Skating · Act 4', exact: true }).click();
      for (let i = 0; i < 10 && (await page.locator('.screen-title').allTextContents()).includes('LEVEL UP'); i++) {
        await page.getByRole('button', { name: 'Skip', exact: true }).click();
      }
      const league = await page.evaluate(() => ({ act: window.__hokyz.run.act, maps: window.__hokyz.run.maps.length, won: window.__hokyz.run.won }));
      assert.deepEqual(league, { act: 4, maps: 4, won: true });
      await page.getByRole('button', { name: 'Save & Quit', exact: true }).click();
      await resume();
      assert.equal(await page.evaluate(() => window.__hokyz.run.act), 4);
      await page.locator('.node.available.match').first().click();
      await page.getByRole('button', { name: 'Drop the Puck', exact: true }).click();
      await finish(false);
      await page.getByRole('button', { name: 'See Run Summary', exact: true }).click();
    }
    assert.match(await page.locator('.result h2').textContent(), /CHAMPIONS/);
    const meta = await page.evaluate(() => JSON.parse(localStorage.getItem('hokyz.meta.v1')));
    assert.equal(meta.wins, 1);
    assert.ok(meta.cash >= 500);
    assert.equal(await page.evaluate(() => localStorage.getItem('hokyz.run.v1')), null);
    await page.screenshot({ path: join(out, `${branch}-champion-summary.png`) });
    checks.push(`${branch}: boss loot precedes saved league choice, champion status and one settled win retained`);
    await page.close();
  }
  assert.deepEqual(errors, []);
} catch (error) {
  errors.push(String(error)); process.exitCode = 1;
  await page?.screenshot({ path: join(out, 'failure.png') }).catch(() => {});
} finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
writeFileSync(join(out, 'report.json'), JSON.stringify({ pass: !errors.length, checks, errors,
  scope: 'Prepared last-boss checkpoint and terminal outcomes; real reward/league/bank/reload UI. Not three-act play evidence.' }, null, 2));
console.log(out, errors.length ? errors : 'PASS championship routing');
