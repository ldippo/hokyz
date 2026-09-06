import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/result-layout', { recursive: true });
const out = mkdtempSync(resolve('.gaming/result-layout', `${Date.now()}-`));
const baseline = process.argv.includes('--baseline');
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
let browser;
const findings = [];
try {
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('hokyz.meta.v1', JSON.stringify({ quality: 'low', cinematics: false, music: false })));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  await page.waitForFunction(() => window.__hokyz?.assetsLoaded && window.__hokyz?.view, null, { timeout: 90000 });
  await page.evaluate(() => window.__hokyz.loop.stop());
  await page.getByRole('button', { name: 'New Run', exact: true }).click();
  await page.locator('.cards [data-nav]').first().click();
  await page.evaluate(() => {
    const app = window.__hokyz;
    Object.assign(app.run, { act: 3, won: true, leagueOffer: true });
  });
  await page.getByRole('button', { name: 'Save & Quit', exact: true }).click();
  await page.getByRole('button', { name: 'Continue Run', exact: true }).click();
  for (const screen of ['league', 'summary']) {
    if (screen === 'summary') await page.getByRole('button', { name: 'Bank the Trophy', exact: true }).click();
    for (const [width, height, scale] of [[1280,900,1], [1280,720,1.25], [390,844,1], [390,844,1.25]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(scale => {
        const app = window.__hokyz;
        app.meta.textScale = scale; app.applyAccessPrefs();
        document.querySelector('.screen').scrollTop = 0;
      }, scale);
      await page.screenshot({ path: join(out, `${screen}-${width}-${scale}.png`) });
      const clipped = [];
      for (const button of await page.locator('.result button').all()) {
        await button.evaluate(el => el.scrollIntoView({ block: 'center' }));
        const r = await button.boundingBox();
        if (!r || r.x < -1 || r.y < -1 || r.x+r.width > width+1 || r.y+r.height > height+1) clipped.push(await button.textContent());
      }
      findings.push({ screen, width, height, scale, clipped });
    }
  }
  writeFileSync(join(out, 'report.json'), JSON.stringify({ baseline, findings }, null, 2));
  if (!baseline) assert.ok(findings.every(f => !f.clipped.length), JSON.stringify(findings));
  console.log(out);
} finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
