import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/natural-route', { recursive:true });
const out=mkdtempSync(resolve('.gaming/natural-route',`${Date.now()}-`));
const seed=process.argv.find(a=>a.startsWith('--seed='))?.slice(7)??'natural-act-1';
const server=await preview({preview:{host:'127.0.0.1',port:0,open:false}});
const checks=[],errors=[],encounters=[];
let browser,page,terminal=null,originalMap;
try {
  browser=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage']});
  page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>{if(!localStorage.getItem('hokyz.meta.v1'))localStorage.setItem('hokyz.meta.v1',JSON.stringify({quality:'low',cinematics:false,music:false}));});
  const ready=async()=>{await page.waitForFunction(()=>window.__hokyz?.assetsLoaded&&window.__hokyz?.view,null,{timeout:90000});await page.evaluate(()=>window.__hokyz.loop.stop());};
  const snapshot=()=>page.evaluate(()=>{
    const r=window.__hokyz.run,player=s=>({...s,xp:s.xp??0,level:s.level??0,pendingLevels:s.pendingLevels??0});
    // First opening of a draft legitimately records offer telemetry. Compare
    // the earned choices/state, excluding that presentation receipt only.
    const pendingDraft=r.pendingDraft?Object.fromEntries(Object.entries(r.pendingDraft).filter(([key])=>key!=='offeredLogged')):undefined;
    return {act:r.act,row:r.row,path:r.path,currentNodeId:r.currentNodeId,cash:r.cash,perks:r.perks,roster:r.roster.map(player),goalie:player(r.goalie),matchesPlayed:r.matchesPlayed,matchesWon:r.matchesWon,rngState:r.rngState,over:r.over,pendingDraft};
  });
  const mapShape=()=>page.evaluate(()=>window.__hokyz.run.maps[0].rows.map(row=>row.map(({done,...node})=>node)));
  const reload=async()=>{await page.reload();await ready();await page.getByRole('button',{name:'Continue Run',exact:true}).click();};
  const save=async label=>writeFileSync(join(out,`${label}.json`),JSON.stringify(await snapshot(),null,2));
  const upgrades=async()=>{
    for(let i=0;i<40;i++) {
      const r=await snapshot(),heading=page.locator('.screen-title').first();
      const title=await heading.count()?await heading.textContent():null;
      if(!r.pendingDraft&&title!=='LEVEL UP')return;
      const cards=page.locator('.cards [data-nav]'),names=await cards.allTextContents();
      assert.ok(names.length>0,'Earned upgrade has no choices');
      await reload();assert.deepEqual(await snapshot(),r,'Reload changed earned upgrade state');
      assert.deepEqual(await cards.allTextContents(),names,'Reload changed earned choices');
      await cards.first().click();
      const after=await snapshot();
      if(r.pendingDraft)assert.ok(!after.pendingDraft,'Draft was not claimed');
      else assert.equal([...after.roster,after.goalie].reduce((n,s)=>n+s.pendingLevels,0),[...r.roster,r.goalie].reduce((n,s)=>n+s.pendingLevels,0)-1);
      checks.push({upgrade:title??'draft',choice:names[0]});
    }
    throw new Error('Upgrade choices did not terminate');
  };
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);await ready();
  await page.getByRole('button',{name:'New Run',exact:true}).click();
  await page.getByPlaceholder('seed (optional)').fill(seed);
  await page.locator('.cards [data-nav]').first().click();
  originalMap=await mapShape();writeFileSync(join(out,'generated-map.json'),JSON.stringify(originalMap,null,2));
  await save('initial-run');
  for(let step=0;step<12;step++) {
    await upgrades();
    const before=await snapshot();
    assert.deepEqual(await mapShape(),originalMap,'Generated map topology/content changed');
    if(before.act===2){assert.equal(before.row,0);terminal='act2';await page.screenshot({path:join(out,'earned-act2.png')});break;}
    assert.equal(before.act,1);assert.ok(!before.over);
    const available=await page.evaluate(()=>{
      const r=window.__hokyz.run,rows=r.maps[0].rows,prev=rows.flat().find(n=>n.id===r.currentNodeId);
      return rows[r.row].filter(n=>r.row===0||!prev||prev.next.includes(n.id));
    });
    assert.equal(await page.locator('.node.available').count(),available.length);
    const hurt=[...before.roster,before.goalie].some(s=>s.hp<60);
    const priority=hurt?['rest','shop','event','match','shootout','elite','boss','hitparade']:['match','rest','event','shop','shootout','elite','boss','hitparade'];
    const node=priority.flatMap(type=>available.filter(n=>n.type===type))[0];
    assert.ok(node,'No connected node available');
    const record={node,before};encounters.push(record);
    console.log(`Act1 row${before.row}: ${node.type} ${node.id}`);
    await page.locator(`.node.available.${node.type}`).first().click();
    assert.equal(await page.evaluate(()=>window.__hokyz.run.currentNodeId),node.id);
    if(['match','elite','boss','shootout'].includes(node.type)) {
      await page.getByRole('button',{name:node.type==='shootout'?'Take the Shot':'Drop the Puck',exact:true}).click();
      // Only the pilot changes; generated rosters, modifiers, clocks and outcomes do not.
      await page.evaluate(()=>{const a=window.__hokyz;a.view.sim.st.teams[0].isHuman=false;a.humanPlaying=false;});
      let over=false;
      for(let ticks=0;ticks<90000&&!over;ticks+=600)over=await page.evaluate(()=>{const a=window.__hokyz;for(let i=0;i<600;i++){a.simStep();if(a.view.sim.st.phase==='over')return true;}return false;});
      assert.ok(over,'Natural match did not terminate');
      record.match=await page.evaluate(()=>{const a=window.__hokyz,s=a.view.sim.st;const result={time:s.t,score:s.teams.map(t=>t.score),winner:s.winner,stats:s.stats};for(let i=0;i<150;i++)a.simStep();return result;});
      await page.keyboard.press('Enter');await page.evaluate(()=>window.__hokyz.simStep());
      const result=await snapshot();
      if(node.type!=='shootout') {
        assert.equal(result.matchesPlayed,before.matchesPlayed+1);
        assert.equal(result.matchesWon,before.matchesWon+(record.match.winner===0?1:0));
      }
      await page.screenshot({path:join(out,`row-${before.row}-result.png`)});
      console.log(`Result ${record.match.score.join('-')}`);
      if(result.over) {
        record.after=result;await save('ended-run');
        assert.deepEqual(await mapShape(),originalMap);
        await reload();assert.equal(await page.evaluate(()=>localStorage.getItem('hokyz.run.v1')),null);
        terminal='loss';checks.push('Ended run settled through reload');break;
      }
      // Resume earned drafts through persistence, avoiding special inline result paths.
      if(result.pendingDraft){await reload();assert.deepEqual(await snapshot(),result);}
      else await page.getByRole('button',{name:'Back to Map',exact:true}).click();
    } else if(node.type==='rest') {
      await page.locator('.map-scroll .cards [data-nav]').first().click();
    } else if(node.type==='shop') {
      const doctor=page.locator('.card:not(.disabled)').filter({hasText:'Team Doctor'});
      if(hurt&&await doctor.count())await doctor.click();
      await page.getByRole('button',{name:'Leave Shop',exact:true}).click();
    } else if(node.type==='event') {
      const choice=page.locator('.event-box .choices button:not(:disabled)').first();
      record.choice=await choice.textContent();await choice.click();
      await page.getByRole('button',{name:'Continue',exact:true}).click();
    } else {
      throw new Error(`Unsupported generated encounter ${node.type}; no route was rewritten`);
    }
    record.after=await snapshot();
    assert.ok(record.after.act>before.act||record.after.row>before.row,'Encounter did not advance');
    const saved=await snapshot();await reload();assert.deepEqual(await snapshot(),saved,'Completed encounter changed on reload');
    await save(`row-${before.row}-run`);
  }
  assert.ok(terminal,'Traversal did not reach Act2 or natural run loss');
  if(terminal==='act2')assert.deepEqual(await mapShape(),originalMap);
  assert.deepEqual(errors,[]);
} catch(e) {errors.push(String(e));process.exitCode=1;await page?.screenshot({path:join(out,'failure.png')}).catch(()=>{});}
finally {await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));}
writeFileSync(join(out,'report.json'),JSON.stringify({pass:!errors.length,seed,terminal,checks,encounters,errors,scope:'Untouched generated Act1 map/rosters/injuries. Real choices and reloads; production AI pilots hockey. First offered upgrades; healing prioritized when hurt. No human difficulty or complete-run victory claim.'},null,2));
console.log(out,errors.length?errors:'PASS natural route');
