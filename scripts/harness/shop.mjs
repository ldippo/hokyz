import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/shop', { recursive: true });
const out = mkdtempSync(resolve('.gaming/shop', `${Date.now()}-`));
const server = await preview({ preview: { host:'127.0.0.1', port:0, open:false } });
let browser, page;
const errors = [], checks = [];
try {
  browser = await chromium.launch({ args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage'] });
  page = await browser.newPage({ viewport:{ width:1280, height:900 } });
  page.on('pageerror', error => errors.push(String(error)));
  await page.addInitScript(() => { if (!localStorage.getItem('hokyz.meta.v1')) localStorage.setItem('hokyz.meta.v1', JSON.stringify({ quality:'low', cinematics:false, music:false })); });
  const ready = async () => {
    await page.waitForFunction(() => window.__hokyz?.assetsLoaded && window.__hokyz?.view, null, { timeout:90000 });
    await page.evaluate(() => window.__hokyz.loop.stop());
  };
  const snapshot = () => page.evaluate(() => {
    const run = window.__hokyz.run;
    return { shop:run.pendingShop, cash:run.cash, perks:run.perks, roster:run.roster.map(sk => sk.id), rng:run.rngState };
  });
  const reload = async () => { await page.reload(); await ready(); await page.getByRole('button', { name:'Continue Run', exact:true }).click(); };
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`); await ready();
  await page.getByRole('button', { name:'New Run', exact:true }).click();
  await page.locator('.cards [data-nav]').first().click();
  await page.evaluate(() => { const run = window.__hokyz.run; run.maps[0].rows[0][0].type = 'shop'; run.cash = 1000; });
  await page.locator('.node.available.match').first().click();
  const initial = await snapshot();
  await reload();
  assert.deepEqual(await snapshot(), initial, 'Opening/reloading rerolled the shop');
  const card = page.locator('.cards .card').first();
  const cost = Number((await card.locator('.price').textContent()).match(/\d+/)[0]);
  await card.click();
  const purchased = await snapshot();
  assert.equal(purchased.cash, initial.cash-cost);
  assert.equal(purchased.shop.perkIds.length, initial.shop.perkIds.length-1);
  await page.locator('.cards .card').filter({ hasText:'free agent' }).click();
  await page.getByRole('button', { name:/Reroll perks/ }).click();
  const changed = await snapshot(), rerollLabel = await page.getByRole('button', { name:/Reroll perks/ }).textContent();
  assert.equal(changed.shop.rerolls, 1); assert.equal(changed.shop.hired, true);
  assert.equal(changed.roster.filter(id => id === changed.shop.hire.id).length, 1);
  await reload();
  assert.deepEqual(await snapshot(), changed, 'Reload lost purchases, hired player, reroll state or RNG');
  assert.equal(await page.getByRole('button', { name:/Reroll perks/ }).textContent(), rerollLabel);
  assert.equal(await page.locator('.cards .card').filter({ hasText:'free agent' }).count(), 0);
  await page.screenshot({ path:join(out,'resumed-shop.png') });
  checks.push('Initial offers, purchase, hire and escalating reroll survive reload with identical cash/RNG');
  await page.getByRole('button', { name:'Leave Shop', exact:true }).click();
  assert.equal(await page.evaluate(() => window.__hokyz.run.row), 1);
  assert.ok(!await page.evaluate(() => window.__hokyz.run.pendingShop));
  await reload();
  assert.ok(!await page.evaluate(() => window.__hokyz.run.pendingShop));
  assert.equal(await page.evaluate(() => window.__hokyz.run.row), 1);
  checks.push('Leaving clears active shop and persists one node completion');
  assert.deepEqual(errors, []);
} catch(error) { errors.push(String(error)); process.exitCode=1; await page?.screenshot({ path:join(out,'failure.png') }).catch(()=>{}); }
finally { await browser?.close(); await new Promise(resolve=>server.httpServer.close(resolve)); }
writeFileSync(join(out,'report.json'), JSON.stringify({ pass:!errors.length, checks, errors, scope:'Prepared shop node and funds; real purchases/navigation/reload, not a complete run' },null,2));
console.log(out,errors.length ? errors : 'PASS shop persistence');
