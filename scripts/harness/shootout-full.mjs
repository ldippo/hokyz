import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/shootout-full', { recursive: true });
const out = mkdtempSync(resolve('.gaming/shootout-full', `${Date.now()}-`));
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
const checks = [], errors = [], matches = [];
let browser;
try {
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
  for (const control of ['idle', 'ai']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
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
    await page.getByPlaceholder('seed (optional)').fill('shootout-flow-1');
    await page.locator('.cards [data-nav]').first().click();
    const before = await page.evaluate(() => {
      const run = window.__hokyz.run;
      run.maps[0].rows[0].forEach(node => { node.type = 'shootout'; node.rivalId = 'bruisers'; });
      return { cash: run.cash, roster: run.roster, goalie: run.goalie };
    });
    await page.locator('.node.available').first().click();
    await page.getByRole('button', { name: 'Take the Shot', exact: true }).click();
    const rngEvidence = await page.evaluate(() => {
      const app = window.__hokyz, sim = app.view.sim;
      const Rng = sim.rng.constructor;
      // Rewind one mulberry32 draw: the committed final setup draw must be
      // the match seed, not an earlier opponent-generation draw.
      const previous = new Rng((app.run.rngState - 0x6d2b79f5) >>> 0);
      const next = new Rng(app.run.rngState);
      return { runRng: app.run.rngState, lastSetupDraw: previous.int(1, 1e9), nextRunDraw: next.int(1, 1e9), matchSeed: sim.rng.state };
    });
    writeFileSync(join(out, `${control}-rng.json`), JSON.stringify(rngEvidence, null, 2));
    assert.equal(rngEvidence.lastSetupDraw, rngEvidence.matchSeed, 'Run RNG did not commit the consumed shootout seed');
    if (control === 'ai') await page.evaluate(() => {
      const app = window.__hokyz;
      app.view.sim.st.teams[0].isHuman = false; app.humanPlaying = false;
    });
    let over = false;
    const events = [];
    const captured=new Set();
    for (let ticks = 0; ticks < 36000 && !over; ticks += 300) {
      const batch = await page.evaluate(() => {
        const app = window.__hokyz, events = [];
        for (let i = 0; i < 300; i++) {
          app.simStep();
          events.push(...app.view.lastEvents.filter(e => ['shootoutAttempt', 'shootoutResult', 'shootoutEnd'].includes(e.type)));
          if (app.view.sim.st.phase === 'over') return { over: true, events };
        }
        return { over: false, events };
      });
      over = batch.over; events.push(...batch.events);
      const stage=events.filter(e=>e.type==='shootoutResult').length>=12?'extended':'opening';
      if(process.argv.includes('--layout')&&!over&&!captured.has(stage)) {
        captured.add(stage);
        for(const [width,height,scale] of [[1280,720,1],[390,844,1.5]]) {
          await page.setViewportSize({width,height});
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const layout=await page.evaluate(scale=>{
            const app=window.__hokyz;app.meta.textScale=scale;app.applyAccessPrefs();app.view.render(1,0);
            const boxes=[...document.querySelectorAll('.so,.so-row,.so-mid')].map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:el.scrollWidth,width:el.clientWidth};});
            const st=app.view.sim.st,so=st.shootout;
            return {boxes,results:so,summary:[...document.querySelectorAll('.so-summary')].map(el=>el.textContent),expected:st.teams.map(t=>`${t.short} · ${so.goals[t.id]} goals / ${so.attempts.filter(a=>a.team===t.id).length} shots`)};
          },scale);
          checks.push({layout:{control,stage,width,height,scale,...layout}});
          await page.screenshot({path:join(out,`${control}-${stage}-${width}.png`)});
          if(!process.argv.includes('--baseline')) {
            assert.ok(layout.boxes.every(b=>b.left>=0&&b.right<=width&&b.bottom<=height&&b.scroll<=b.width+1),JSON.stringify(layout));
            assert.deepEqual(layout.summary,layout.expected);
          }
        }
        await page.setViewportSize({width:1280,height:900});
        await page.evaluate(()=>{const app=window.__hokyz;app.meta.textScale=1;app.applyAccessPrefs();});
      }
    }
    assert.ok(over, `${control}: natural shootout did not terminate`);
    if(process.argv.includes('--layout')&&control==='ai')assert.ok(captured.has('extended'),'Named AI fixture did not exercise extended tracker');
    const result = await page.evaluate(() => {
      const app = window.__hokyz, st = app.view.sim.st;
      const result = { time: st.t, winner: st.winner, score: st.teams.map(t => t.score), shootout: st.shootout };
      for (let i = 0; i < 150; i++) app.simStep();
      return result;
    });
    assert.equal(events.filter(e => e.type === 'shootoutEnd').length, 1);
    assert.equal(events.filter(e => e.type === 'shootoutResult').length, result.shootout.attempts.length);
    assert.equal(result.score[result.winner], 1);
    assert.equal(result.score[result.winner === 0 ? 1 : 0], 0);
    for (let i = 1; i < result.shootout.attempts.length; i++) assert.notEqual(result.shootout.attempts[i].team, result.shootout.attempts[i - 1].team);
    await page.keyboard.press('Enter'); await page.evaluate(() => window.__hokyz.simStep());
    const won = result.winner === 0;
    assert.equal(await page.locator('.result h2').textContent(), won ? 'CHALLENGE CLEARED' : 'NOT THIS TIME');
    assert.equal(await page.locator('.score-line').textContent(), result.shootout.goals.join(' - '));
    await page.screenshot({ path: join(out, `${control}-result.png`) });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hokyz.run.v1')));
    assert.equal(saved.row, 1); assert.equal(saved.path.length, 1);
    assert.equal(saved.cash, before.cash + (won ? 70 : 0));
    assert.deepEqual(saved.roster, before.roster); assert.deepEqual(saved.goalie, before.goalie);
    await page.reload(); await ready();
    await page.getByRole('button', { name: 'Continue Run', exact: true }).click();
    if (won) {
      assert.equal(await page.locator('.screen-title').textContent(), 'DRAFT A PERK');
      await page.getByRole('button', { name: 'Skip perk', exact: true }).click();
    }
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('hokyz.run.v1')));
    assert.equal(after.cash, saved.cash); assert.equal(after.row, 1); assert.ok(!after.pendingDraft);
    matches.push({ control, ...result, rngEvidence, events });
    checks.push(`${control}: natural ${result.shootout.goals.join('-')} ${won ? 'win, +70 cash, draft reload and zero-cash skip' : 'loss, no penalty or reward, reload to map'}`);
    await page.close();
  }
  assert.deepEqual(errors, []);
} catch (error) { errors.push(String(error)); process.exitCode = 1; }
finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
writeFileSync(join(out, 'report.json'), JSON.stringify({ pass: !errors.length, checks, matches, errors, scope: 'Prepared reachable node; idle or production AI, natural attempts and outcome. Not human difficulty or hardware performance evidence.' }, null, 2));
console.log(out, errors.length ? errors : 'PASS natural shootout flow');
