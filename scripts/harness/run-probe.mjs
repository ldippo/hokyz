import { join } from 'node:path';
import assert from 'node:assert/strict';

export async function runProbe(page, out, prefix) {
  const findings = [];
  for (const [width, height, scale] of [[1280,720,1], [390,844,1], [390,844,1.5]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(scale => {
      const app = window.__hokyz; app.meta.textScale = scale; app.applyAccessPrefs();
      document.querySelectorAll('.run-shell, .map-scroll, .side').forEach(el => { el.scrollTop = 0; el.scrollLeft = 0; });
    }, scale);
    await page.screenshot({ path: join(out, `${prefix}-${width}-${scale}.png`) });
    const clipped = [];
    for (const el of await page.locator('.run-shell [data-nav], .run-shell button, .run-shell .screen-title, .run-shell .cname, .run-shell .desc').all()) {
      await el.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
      const r = await el.boundingBox();
      if (!r || r.x < -1 || r.y < -1 || r.x+r.width > width+1 || r.y+r.height > height+1) clipped.push((await el.textContent())?.slice(0,100));
    }
    const overflow = await page.locator('.run-shell').evaluate(el => el.scrollWidth > el.clientWidth + 1);
    findings.push({ width, height, scale, clipped, overflow });
    if (!process.argv.includes('--baseline')) assert.ok(!clipped.length && !overflow, JSON.stringify(findings.at(-1)));
    if (process.argv.includes('--nav') && scale === 1.5) {
      for (const device of ['keyboard', 'gamepad']) findings.push(await navigationProbe(page, out, prefix, device, width, height));
    }
  }
  await page.setViewportSize({ width:1280,height:900 });
  await page.evaluate(() => { const app=window.__hokyz; app.meta.textScale=1; app.applyAccessPrefs(); });
  return findings;
}

async function navigationProbe(page, out, prefix, device, width, height) {
  if (device === 'gamepad') await page.evaluate(() => {
    window.__runPad = { connected: true, axes: [0,0,0,0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__runPad];
  });
  const press = async (key, button) => {
    if (device === 'keyboard') await page.keyboard.down(key);
    else await page.evaluate(button => { window.__runPad.buttons[button] = { pressed: true, value: 1 }; }, button);
    await page.evaluate(() => window.__hokyz.simStep());
    if (device === 'keyboard') await page.keyboard.up(key);
    else await page.evaluate(button => { window.__runPad.buttons[button] = { pressed: false, value: 0 }; }, button);
    await page.evaluate(() => window.__hokyz.simStep());
  };
  const count = await page.evaluate(() => window.__hokyz.nav.items().length);
  assert.ok(count > 1);
  const visited = new Set();
  for (let i = 0; i < count; i++) {
    await press('ArrowDown', 13);
    const focus = page.locator('.run-shell [data-nav].focus');
    assert.equal(await focus.count(), 1);
    const idx = await page.evaluate(() => window.__hokyz.nav.items().findIndex(el => el.classList.contains('focus')));
    visited.add(idx);
    const r = await focus.boundingBox();
    const visible = r && r.x >= -1 && r.y >= -1 && r.x+r.width <= width+1 && r.y+r.height <= height+1;
    if (!visible) await page.screenshot({ path: join(out, `${prefix}-${device}-focus-failure.png`) });
    assert.ok(visible, `${prefix}/${device}: focused action clipped: ${await focus.textContent()} ${JSON.stringify(r)}`);
  }
  assert.equal(visited.size, count, `${device}: navigation failed to visit every action`);
  const select = async text => {
    const n = await page.evaluate(() => window.__hokyz.nav.items().length);
    for (let i = 0; i <= n; i++) {
      const focused = await page.locator('[data-nav].focus').textContent();
      if (focused === text) { await press('Enter', 0); return; }
      await press('ArrowDown', 13);
    }
    assert.fail(`${device}: could not select ${text}`);
  };
  const snapshot = () => page.evaluate(() => {
    const r=window.__hokyz.run;
    return { rng:r.rngState, row:r.row, cash:r.cash, shop:r.pendingShop??null, rest:r.pendingRest??null };
  });
  const before = await snapshot();
  await select('Save & Quit');
  await select('Continue Run');
  assert.equal(await page.locator('.run-shell').count(), 1);
  assert.deepEqual(await snapshot(), before, `${device}: Save/Continue changed encounter state`);
  await page.screenshot({ path: join(out, `${prefix}-${device}-continued.png`) });
  if (device === 'gamepad') await page.evaluate(() => { navigator.getGamepads = () => []; window.__hokyz.simStep(); });
  return { device, visited:visited.size, saveContinue:true };
}
