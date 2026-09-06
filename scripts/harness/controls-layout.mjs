import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/controls-layout', { recursive: true });
const out = mkdtempSync(resolve('.gaming/controls-layout', `${Date.now()}-`));
const baseline = process.argv.includes('--baseline');
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
let browser;
const findings = [];
try {
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('hokyz.meta.v1', JSON.stringify({ quality: 'low', cinematics: false, music: false })));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  await page.waitForFunction(() => window.__hokyz?.assetsLoaded && window.__hokyz?.view, null, { timeout: 90000 });
  await page.evaluate(() => window.__hokyz.loop.stop());
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Controls…', exact: true }).click();
  for (const [width, height, scale] of [[1280,720,1], [390,844,1], [390,844,1.5]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(scale => {
      const app = window.__hokyz;
      app.meta.textScale = scale; app.applyAccessPrefs();
      document.querySelector('.screen').scrollTop = 0;
    }, scale);
    await page.screenshot({ path: join(out, `controls-${width}-${scale}.png`) });
    const clipped = [];
    for (const el of await page.locator('.screen button, .settings-row > span, .screen-sub, .screen-title, .screen kbd').all()) {
      await el.evaluate(el => el.scrollIntoView({ block: 'center' }));
      const r = await el.boundingBox();
      if (!r || r.x < -1 || r.y < -1 || r.x+r.width > width+1 || r.y+r.height > height+1) clipped.push(await el.textContent());
    }
    const horizontalOverflow = await page.locator('.screen').evaluate(el => el.scrollWidth > el.clientWidth + 1);
    findings.push({ width, height, scale, clipped, horizontalOverflow });
  }
  if (!baseline) {
    await page.getByRole('button', { name: 'Reset to defaults', exact: true }).click();
    assert.equal(await page.locator('.settings-row').filter({ hasText: 'Pass / switch / block' }).locator('kbd').textContent(), 'J');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    assert.equal(await page.locator('.screen-title').textContent(), 'SETTINGS');
  }
  writeFileSync(join(out, 'report.json'), JSON.stringify({ baseline, findings }, null, 2));
  console.log(out);
  if (!baseline) assert.ok(findings.every(f => !f.clipped.length && !f.horizontalOverflow), JSON.stringify(findings));
} finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
