import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/route', { recursive:true });
const out = mkdtempSync(resolve('.gaming/route', `${Date.now()}-`));
const server = await preview({ preview:{ host:'127.0.0.1',port:0,open:false } });
const checks=[], errors=[], checkpoints=[];
const combat=process.argv.includes('--combat');
let browser,page;
try {
  browser=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage']});
  page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror',error=>errors.push(String(error)));
  await page.addInitScript(()=>{if(!localStorage.getItem('hokyz.meta.v1'))localStorage.setItem('hokyz.meta.v1',JSON.stringify({quality:'low',cinematics:false,music:false}));});
  const ready=async()=>{await page.waitForFunction(()=>window.__hokyz?.assetsLoaded&&window.__hokyz?.view,null,{timeout:90000});await page.evaluate(()=>window.__hokyz.loop.stop());};
  const snapshot=()=>page.evaluate(()=>{const r=window.__hokyz.run;const player=sk=>({...sk,xp:sk.xp??0,level:sk.level??0,pendingLevels:sk.pendingLevels??0});return {row:r.row,path:r.path,cash:r.cash,roster:r.roster.map(player),goalie:player(r.goalie),perks:r.perks,rng:r.rngState,shop:r.pendingShop,rest:r.pendingRest};});
  const reload=async()=>{await page.reload();await ready();await page.getByRole('button',{name:'Continue Run',exact:true}).click();};
  const enter=()=>page.locator('.node.available').first().click();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);await ready();
  await page.getByRole('button',{name:'New Run',exact:true}).click();await page.locator('.cards [data-nav]').first().click();
  await page.evaluate(combat=>{
    const r=window.__hokyz.run;
    ['event','shop','rest'].forEach((type,row)=>r.maps[0].rows[row].forEach(node=>{node.type=type;if(type==='event')node.eventId='fan_favorite';}));
    if(combat)r.maps[0].rows[3].forEach(node=>{node.type='match';node.rivalId??='bruisers';});
    r.roster.forEach(sk=>sk.hp=25);r.goalie.hp=25;
    window.__hokyz.saveRun();
  },combat);
  const initial=await snapshot();
  await enter();await page.getByRole('button',{name:/Sell the banner/}).click();
  const event=await snapshot();
  assert.equal(event.cash,initial.cash+45);assert.equal(event.row,1);
  await reload();assert.deepEqual(await snapshot(),event,'Event-result reload changed the applied choice');
  checkpoints.push(event);checks.push('Event cash applies once and reload returns to next connected row');
  await enter();
  const shop=await snapshot();assert.ok(shop.shop);assert.ok(!shop.rest);
  await page.locator('.cards .card').filter({hasText:'Team Doctor'}).click();
  const healed=await snapshot();assert.equal(healed.cash,event.cash-45);
  assert.ok(healed.roster.every(sk=>sk.hp===sk.maxHp));assert.equal(healed.goalie.hp,100);
  await reload();assert.deepEqual(await snapshot(),healed,'Shop reload changed purchase or event effects');
  await page.getByRole('button',{name:'Leave Shop',exact:true}).click();
  const left=await snapshot();assert.equal(left.row,2);assert.ok(!left.shop);
  await reload();assert.deepEqual(await snapshot(),left);
  checkpoints.push(left);checks.push('Event earnings fund doctor; shop completion persists without pending state');
  await enter();
  const rest=await snapshot();assert.ok(rest.rest);assert.ok(!rest.shop);
  await page.getByRole('button',{name:'Save & Quit',exact:true}).click();
  await reload();assert.deepEqual(await snapshot(),rest,'Rest resume changed earlier route state');
  const offer=rest.rest.offers[0];
  await page.locator('.map-scroll .cards .card').first().click();
  const trained=await snapshot();assert.equal(trained.row,3);assert.ok(!trained.rest&&!trained.shop);
  const expected=structuredClone(rest.roster);const sk=expected.find(sk=>sk.id===offer.skaterId);sk.stats[offer.stat]=Math.min(10,sk.stats[offer.stat]+2);
  assert.deepEqual(trained.roster,expected);assert.equal(trained.cash,initial.cash);
  await reload();assert.deepEqual(await snapshot(),trained,'Final reload replayed a prior encounter');
  assert.equal(new Set(trained.path).size,3);
  assert.ok(await page.evaluate(()=>{const r=window.__hokyz.run,nodes=r.maps[0].rows.flat();return r.path.slice(1).every((id,i)=>nodes.find(node=>node.id===r.path[i]).next.includes(id));}));
  await page.screenshot({path:join(out,'three-node-route.png')});
  checkpoints.push(trained);checks.push('Rest trains once; all three path nodes remain connected after reload');
  if(combat){
    await enter();await page.getByRole('button',{name:'Drop the Puck',exact:true}).click();
    await page.evaluate(()=>{const app=window.__hokyz;app.view.sim.st.teams[0].isHuman=false;app.humanPlaying=false;});
    let finished=false,ticks=0;
    while(!finished&&ticks<90000){
      finished=await page.evaluate(()=>{const app=window.__hokyz;for(let i=0;i<600;i++){app.simStep();if(app.view.sim.st.phase==='over')return true;}return false;});
      ticks+=600;
    }
    assert.ok(finished,'Natural match did not reach a terminal state');
    const match=await page.evaluate(()=>{const app=window.__hokyz,st=app.view.sim.st;const result={time:st.t,score:st.teams.map(t=>t.score),winner:st.winner,period:st.period,stats:st.stats};for(let i=0;i<150;i++)app.simStep();return result;});
    await page.keyboard.press('Enter');await page.evaluate(()=>window.__hokyz.simStep());
    assert.equal(await page.evaluate(()=>window.__hokyz.run.matchesPlayed),1);
    assert.equal(await page.evaluate(()=>window.__hokyz.run.matchesWon),match.winner===0?1:0);
    await page.screenshot({path:join(out,'natural-match-result.png')});
    checkpoints.push({match,run:await snapshot()});
    if(match.winner===0){
      assert.ok(await page.evaluate(()=>window.__hokyz.run.pendingDraft));
      await reload();
      assert.equal(await page.locator('.screen-title').textContent(),'DRAFT A PERK');
      await page.getByRole('button',{name:'Skip (+25 cash)',exact:true}).click();
      assert.ok(!await page.evaluate(()=>window.__hokyz.run.pendingDraft));
    }else{
      assert.ok(await page.evaluate(()=>window.__hokyz.run.over));
      await reload();
      assert.equal(await page.evaluate(()=>localStorage.getItem('hokyz.run.v1')),null);
    }
    checks.push(`Natural AI-controlled match ${match.score.join('-')}: outcome counted once and ${match.winner===0?'reward resumed':'loss settled'} through reload`);
  }
  assert.deepEqual(errors,[]);
}catch(error){errors.push(String(error));process.exitCode=1;await page?.screenshot({path:join(out,'failure.png')}).catch(()=>{});}
finally{await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));}
writeFileSync(join(out,'report.json'),JSON.stringify({pass:!errors.length,checks,checkpoints,errors,scope:`Generated links preserved; encounter types and injuries prepared. Real choices/reload${combat?'; home team AI-controlled, full-length natural match outcome':''}. Not human or complete-run victory evidence.`},null,2));
console.log(out,errors.length?errors:'PASS connected route');
