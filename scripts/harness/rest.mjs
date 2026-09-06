import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { runProbe } from './run-probe.mjs';

mkdirSync('.gaming/rest', { recursive:true });
const out = mkdtempSync(resolve('.gaming/rest', `${Date.now()}-`));
const server = await preview({ preview:{ host:'127.0.0.1', port:0, open:false } });
const checks = [], errors = [];
let browser;
try {
  browser = await chromium.launch({ args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage'] });
  for (const ascension of [0, 4]) {
    const page = await browser.newPage({ viewport:{ width:1280,height:900 } });
    page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => { if (!localStorage.getItem('hokyz.meta.v1')) localStorage.setItem('hokyz.meta.v1', JSON.stringify({ quality:'low',cinematics:false,music:false })); });
    const ready = async () => { await page.waitForFunction(()=>window.__hokyz?.assetsLoaded && window.__hokyz?.view,null,{timeout:90000}); await page.evaluate(()=>window.__hokyz.loop.stop()); };
    const snapshot = () => page.evaluate(() => { const run=window.__hokyz.run; return { rest:run.pendingRest, rng:run.rngState, row:run.row, stats:run.roster.map(sk=>sk.stats), hp:run.roster.map(sk=>sk.hp), goalie:run.goalie.hp }; });
    const reload = async () => { await page.reload(); await ready(); await page.getByRole('button',{name:'Continue Run',exact:true}).click(); };
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`); await ready();
    await page.getByRole('button',{name:'New Run',exact:true}).click();
    await page.locator('.cards [data-nav]').first().click();
    if (process.argv.includes('--layout') && ascension===0) writeFileSync(join(out,'map-layout.json'),JSON.stringify(await runProbe(page,out,'map'),null,2));
    await page.evaluate(ascension=>{ const run=window.__hokyz.run; run.ascension=ascension; run.maps[0].rows[0][0].type='rest'; run.roster.forEach(sk=>sk.hp=25); run.goalie.hp=25; },ascension);
    await page.locator('.node.available.match').first().click();
    const initial = await snapshot();
    if (process.argv.includes('--layout') && ascension===0) writeFileSync(join(out,'rest-layout.json'),JSON.stringify(await runProbe(page,out,'rest'),null,2));
    assert.equal(initial.goalie, ascension===4 ? 25 : 100);
    assert.ok(initial.hp.every(hp=>hp===(ascension===4 ? 25 : 100)));
    const descriptions = await page.locator('.map-scroll .cards .desc').allTextContents();
    await page.getByRole('button',{name:'Save & Quit',exact:true}).click();
    await reload();
    assert.deepEqual(await snapshot(),initial,'Save & Quit/reload changed rest state');
    assert.deepEqual(await page.locator('.map-scroll .cards .desc').allTextContents(),descriptions);
    await page.screenshot({path:join(out,`rest-${ascension}.png`)});
    if (ascension===0) await page.locator('.map-scroll .cards .card').first().click();
    else await page.getByRole('button',{name:'Skip training',exact:true}).click();
    const completed=await snapshot();
    assert.equal(completed.row,1); assert.ok(!completed.rest);
    if (ascension===0) {
      const expected=structuredClone(initial.stats), stat=initial.rest.offers[0].stat;
      expected[0][stat]=Math.min(10,expected[0][stat]+2);
      assert.deepEqual(completed.stats,expected);
    } else { assert.deepEqual(completed.stats,initial.stats); assert.deepEqual(completed.hp,initial.hp); }
    await reload(); assert.deepEqual(await snapshot(),completed,'Completed rest applied again');
    checks.push(`Ascension${ascension}: stable saved offers/healing, ${ascension===0?'train':'skip'} once, completed reload`);
    await page.close();
  }
  assert.deepEqual(errors,[]);
} catch(error) { errors.push(String(error)); process.exitCode=1; }
finally { await browser?.close(); await new Promise(resolve=>server.httpServer.close(resolve)); }
writeFileSync(join(out,'report.json'),JSON.stringify({pass:!errors.length,checks,errors,scope:'Prepared rest node and injury state, real Save & Quit/Continue/training/skip'},null,2));
console.log(out,errors.length?errors:'PASS rest persistence');
