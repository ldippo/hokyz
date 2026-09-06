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
  if (!baseline) {
    const tick = () => page.evaluate(() => { const app = window.__hokyz; app.input.poll(); app.nav?.update(app.input); });
    const key = async code => { await page.keyboard.press(code); await tick(); await tick(); };
    const focusedRow = () => page.locator('.settings-row').filter({ has: page.locator('.focus') });
    await key('s');
    assert.match(await focusedRow().textContent(), /Move down/);
    await key('Enter');
    assert.ok(await page.evaluate(() => !!window.__hokyz.input.capture));
    await key('q');
    assert.equal(await focusedRow().locator('kbd').textContent(), 'Q');
    await key('Enter'); await key('Escape');
    assert.equal(await focusedRow().locator('kbd').textContent(), 'Q');
    assert.equal(await page.locator('.screen-title').textContent(), 'CONTROLS');
    // Down is now Q, so keyboard navigation must follow the new binding.
    for (let i = 0; i < 11; i++) await key('q');
    assert.equal(await page.locator('.controls-screen .focus').textContent(), 'Reset to defaults');
    await key('Enter');
    assert.equal(await page.evaluate(() => window.__hokyz.input.keymap.KeyS), 'down');
    await key('Escape');
    assert.equal(await page.locator('.screen-title').textContent(), 'SETTINGS');
    await page.getByRole('button', { name: 'Controls…', exact: true }).click();
    // Synthetic standard gamepad exercises production polling and menu routing.
    await page.evaluate(() => {
      window.__testPad = { connected: true, axes: [0,0,0,0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
      navigator.getGamepads = () => [window.__testPad];
    });
    const pad = async index => {
      await page.evaluate(index => { window.__testPad.buttons[index] = { pressed: true, value: 1 }; }, index);
      await tick();
      await page.evaluate(index => { window.__testPad.buttons[index] = { pressed: false, value: 0 }; }, index);
      await tick();
    };
    await pad(13); await pad(0);
    assert.ok(await page.evaluate(() => !!window.__hokyz.input.capture));
    await pad(13);
    assert.match(await focusedRow().textContent(), /Move down/);
    await pad(1);
    assert.equal(await page.evaluate(() => !!window.__hokyz.input.capture), false);
    assert.equal(await page.locator('.screen-title').textContent(), 'CONTROLS');
    await pad(1);
    assert.equal(await page.locator('.screen-title').textContent(), 'SETTINGS');
    await page.getByRole('button', { name: 'Controls…', exact: true }).click();
    findings.push({ interaction: 'Keyboard rebind, retained focus, cancel, remapped navigation, reset/back; synthetic gamepad navigate/capture/cancel/back', clipped: [] });
  }
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
