import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/map-focus', { recursive:true });
const out=mkdtempSync(resolve('.gaming/map-focus',`${Date.now()}-`));
const server=await preview({preview:{host:'127.0.0.1',port:0,open:false}});
const errors=[],checks=[]; let browser;
const variant=process.argv.includes('--boss-intro')?'boss':process.argv.includes('--elite-intro')?'elite':null;
try {
  browser=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(()=>localStorage.setItem('hokyz.meta.v1',JSON.stringify({quality:'low',cinematics:false,music:false,reducedMotion:true})));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);
  await page.waitForFunction(()=>window.__hokyz?.assetsLoaded&&window.__hokyz?.view,null,{timeout:90000});
  await page.evaluate(()=>window.__hokyz.loop.stop());
  await page.getByRole('button',{name:'New Run',exact:true}).click();
  await page.getByPlaceholder('seed (optional)').fill('map-focus-1');
  await page.locator('.cards [data-nav]').first().click();
  if (process.argv.includes('--motion')) {
    for (const [setting, os] of [[false,'no-preference'],[true,'no-preference'],[false,'reduce'],[false,'no-preference']]) {
      await page.emulateMedia({reducedMotion:os});
      await page.evaluate(setting=>{const app=window.__hokyz;app.meta.reducedMotion=setting;app.applyAccessPrefs();},setting);
      const motion=await page.locator('.node.available').first().evaluate(el=>({animation:getComputedStyle(el).animationName,transition:getComputedStyle(el).transitionDuration}));
      checks.push({setting,os,...motion});
      if(!process.argv.includes('--baseline')) assert.equal(motion.animation,setting||os==='reduce'?'none':'pulse');
      const hud = await page.evaluate(() => {
        const host=document.createElement('div');window.__hokyz.ui.append(host);
        const add=(className,text='')=>{const el=document.createElement('div');el.className=className;el.textContent=text;host.append(el);return el;};
        const announcement=add('announce pop','GOAL!'), animation=announcement.getAnimations()[0];
        animation.pause();animation.currentTime=400;
        const middle=getComputedStyle(announcement).opacity;
        const transforms=animation.effect.getKeyframes().some(frame=>'transform' in frame);
        animation.currentTime=1600;
        const end=getComputedStyle(announcement).opacity;
        const countdown=add('countdown show','3'),flash=add('flash on');
        const pulse=['prompt dive','special ready','fcue mash','rebind-wait'].map(name=>getComputedStyle(add(name)).animationName);
        const result={middle,end,transforms,pulse,countdown:getComputedStyle(countdown).animationName,countdownOpacity:getComputedStyle(countdown).opacity,flash:getComputedStyle(flash).animationName};
        host.remove();return result;
      });
      checks.push({setting,os,hud});
      if(!process.argv.includes('--baseline') && (setting||os==='reduce')) {
        assert.equal(motion.transition,'0s');assert.equal(hud.middle,'1');assert.equal(hud.end,'0');assert.equal(hud.transforms,false);
        assert.ok(hud.pulse.every(name=>name==='none'));assert.equal(hud.countdown,'none');assert.equal(hud.countdownOpacity,'1');assert.equal(hud.flash,'none');
      }
    }
    await page.evaluate(()=>{window.__hokyz.meta.reducedMotion=true;window.__hokyz.applyAccessPrefs();});
  }
  const press=async key=>{await page.keyboard.down(key);await page.evaluate(()=>window.__hokyz.simStep());await page.keyboard.up(key);await page.evaluate(()=>window.__hokyz.simStep());};
  const capture=async label=>{
    const selected=page.locator('.node.focus'); assert.equal(await selected.count(),1);
    const state=await selected.evaluate(el=>({label:el.textContent,outline:getComputedStyle(el).outlineStyle,marker:getComputedStyle(el,'::after').content}));
    await page.screenshot({path:join(out,`${label}.png`)});
    if(!process.argv.includes('--baseline')) {assert.equal(state.outline,'solid');assert.ok(state.marker.includes('▶'));}
    checks.push({capture:label,...state}); return state.label;
  };
  const first=await capture('first');
  await press('s');
  const second=await capture('keyboard-next'); assert.notEqual(first,second);
  await page.evaluate(()=>{window.__mapPad={connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.__mapPad];window.__mapPad.buttons[14]={pressed:true,value:1};window.__hokyz.simStep();window.__mapPad.buttons[14]={pressed:false,value:0};window.__hokyz.simStep();});
  assert.equal(await capture('controller-previous'),first);
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>{window.__hokyz.meta.textScale=1.5;window.__hokyz.applyAccessPrefs();});
  await press('s'); await capture('narrow-next');
  const expected=await page.locator('.node.focus').getAttribute('title');
  if(variant) await page.evaluate(({variant,outnumbered})=>{
    const run=window.__hokyz.run;
    run.maps[0].rows[0].forEach(node=>{node.type=variant;node.rivalId='boss_maidens';node.mutatorId=outnumbered?'outnumbered':'long_bombs';});
    run.grudges.boss_maidens={beaten:2,act:1};run.ascension=5;
  },{variant,outnumbered:process.argv.includes('--outnumbered')});
  await press('Enter');
  const heading=variant==='boss'?'👑 BOSS FIGHT':variant==='elite'?'💀 ELITE MATCH':'NEXT MATCH';
  assert.equal(await page.locator('.screen-title').textContent(),heading);
  if(!variant) assert.ok((await page.locator('.matchup .tn').last().textContent()).includes(expected.split(' · ')[0]));
  else {
    assert.ok(await page.locator('.taunt').count());
    assert.match(await page.locator('.match-intro-content').textContent(),process.argv.includes('--outnumbered')?/Outnumbered/:/Long Bomb Night/);
    if(variant==='boss') assert.ok(await page.locator('.match-intro .perk-chip').count()>=2);
  }
  checks.push({activation:'Enter opened selected rival'});
  if (process.argv.includes('--intro-layout')) {
    for (const [width,height,scale] of [[1280,720,1],[390,844,1],[390,844,1.5]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(scale=>{window.__hokyz.meta.textScale=scale;window.__hokyz.applyAccessPrefs();document.querySelector('.screen').scrollTop=0;},scale);
      await page.screenshot({path:join(out,`intro-${width}-${scale}.png`)});
      const clipped=[];
      for(const el of await page.locator('.screen [data-nav], .screen-title, .matchup .tn, .matchup .gimmick, .mod-tag, .taunt, .match-intro .perk-chip').all()) {
        await el.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest'}));
        const r=await el.boundingBox();
        if(!r||r.x< -1||r.y< -1||r.x+r.width>width+1||r.y+r.height>height+1)clipped.push(await el.textContent());
      }
      const overflow=await page.locator('.screen').evaluate(el=>el.scrollWidth>el.clientWidth+1);
      checks.push({intro:true,width,height,scale,clipped,overflow});
      if(!process.argv.includes('--baseline'))assert.ok(!clipped.length&&!overflow,JSON.stringify(checks.at(-1)));
    }
    // Actual keyboard back, then controller activation of the selected match.
    await press('Escape'); assert.equal(await page.locator('.run-shell').count(),1);
    await press('Enter'); assert.equal(await page.locator('.screen-title').textContent(),heading);
    await page.evaluate(()=>{window.__mapPad.buttons[0]={pressed:true,value:1};window.__hokyz.simStep();window.__mapPad.buttons[0]={pressed:false,value:0};window.__hokyz.simStep();});
    assert.equal(await page.evaluate(()=>window.__hokyz.humanPlaying),true);
    checks.push({introNavigation:'Keyboard back/re-entry and controller Drop the Puck'});
    if(process.argv.includes('--outnumbered')) {
      await page.setViewportSize({width:1280,height:720});
      // Flush the viewport's resize event before drawing a stopped-loop frame.
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      await page.evaluate(()=>{window.__hokyz.meta.textScale=1;window.__hokyz.applyAccessPrefs();});
      const roster=await page.evaluate(()=>{
        const app=window.__hokyz;for(let i=0;i<300&&app.view.sim.st.phase!=='faceoff';i++)app.simStep();
        const st=app.view.sim.st;app.render(1,1/60);
        const positions=st.teams.flatMap(t=>t.skaters.map(id=>({id,team:t.id,...st.skaters[id].pos})));
        const minSeparation=Math.min(...positions.flatMap((p,i)=>positions.slice(i+1).map(q=>Math.hypot(p.x-q.x,p.y-q.y))));
        return {phase:st.phase,positions,minSeparation,period:st.period,home:st.teams[0].skaters.length,away:st.teams[1].skaters.length,extraId:st.mods.extraSkater?.id,extraPresent:!!st.skaters[st.mods.extraSkater?.id],phases:st.mods.bossPhases};
      });
      assert.equal(roster.period,1);assert.equal(roster.home,3);assert.equal(roster.away,4);assert.ok(roster.extraPresent);
      checks.push({outnumbered:roster});
      const capture=await page.screenshot({path:join(out,'outnumbered-match.png')});
      // Check the captured image, not just the renderer's state: a late resize
      // can clear the canvas after a valid render while the DOM HUD stays visible.
      const iceFraction=await page.evaluate(async url=>{
        const img=new Image();img.src=url;await img.decode();
        const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;
        const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
        const pixels=ctx.getImageData(200,400,880,160).data;let bright=0;
        for(let i=0;i<pixels.length;i+=4)if(pixels[i]>150&&pixels[i+1]>150&&pixels[i+2]>150)bright++;
        return bright/(pixels.length/4);
      },`data:image/png;base64,${capture.toString('base64')}`);
      checks.push({openingCaptureIceFraction:iceFraction});
      assert.ok(iceFraction>0.15,'Opening capture lost the rink behind the HUD');
      const feedback=await page.evaluate(()=>{
        const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
        return {score:box('.scoreboard'),announcement:box('.hud .announce'),countdown:box('.hud .countdown')};
      });
      checks.push({openingFeedback:feedback});
      if(!process.argv.includes('--baseline')) {
        assert.ok(feedback.announcement.top>=feedback.score.bottom,'Announcement covers scoreboard');
        assert.ok(feedback.countdown.top>=feedback.announcement.bottom,'Countdown overlaps announcement');
        assert.ok(feedback.countdown.bottom<720*0.35,'Opening feedback covers center ice');
      }
      assert.equal(roster.phase,'faceoff');
      if(!process.argv.includes('--baseline'))assert.ok(roster.minSeparation>1.1,JSON.stringify(roster));
      const rendered=await page.evaluate(()=>{
        const view=window.__hokyz.view,st=view.sim.st,id=st.mods.extraSkater?.id,mesh=view.skaters.get(id);
        const originals=new Map(view.skaters),children=view.group.children.length;
        for(let i=0;i<10;i++)window.__hokyz.simStep();
        return {id,simCount:st.order.length,meshCount:view.skaters.size,extraMesh:!!mesh,attached:mesh?.group.parent===view.group,visible:mesh?.group.visible,position:mesh?.group.position.toArray(),expected:st.skaters[id]?.pos,stableModels:[...originals].every(([id,mesh])=>view.skaters.get(id)===mesh)&&view.group.children.length===children};
      });
      checks.push({renderedRoster:rendered});
      if(!process.argv.includes('--baseline')) {
        assert.equal(rendered.meshCount,rendered.simCount,'Simulation skater has no model');
        assert.ok(rendered.extraMesh&&rendered.attached&&rendered.visible,'Extra skater is not rendered');
        assert.ok(rendered.stableModels,'Model synchronization recreated or duplicated existing models');
        assert.ok(Math.abs(rendered.position[0]-rendered.expected.x)<0.01&&Math.abs(rendered.position[2]-rendered.expected.y)<0.01);
      }
      if(process.argv.includes('--feedback-layout')) {
        for(const [width,height,scale] of [[1280,720,1],[390,844,1.5]]) {
          await page.setViewportSize({width,height});
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const layout=await page.evaluate(scale=>{
            const app=window.__hokyz;app.meta.textScale=scale;app.applyAccessPrefs();
            app.view.hud.announce('ASCENSION RULES · HOT GLOVE','red','Score twice and their goalie catches fire.');
            const el=document.querySelector('.hud .announce');
            for(const a of el.getAnimations()){a.pause();a.currentTime=400;}
            app.render(1,0);
            const r=el.getBoundingClientRect();
            return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:el.scrollWidth,width:el.clientWidth,opacity:getComputedStyle(el).opacity};
          },scale);
          checks.push({feedbackLayout:{width,height,scale,...layout}});
          assert.ok(layout.left>=0&&layout.right<=width&&layout.bottom<height&&layout.scroll<=layout.width+1);
          assert.equal(layout.opacity,'1');
          await page.screenshot({path:join(out,`feedback-${width}.png`)});
        }
      }
      if(process.argv.includes('--hud-layout')) {
        for(const [width,height,scale] of [[1280,720,1],[390,844,1],[390,844,1.5]]) {
          await page.setViewportSize({width,height});
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          const layout=await page.evaluate(scale=>{
            const app=window.__hokyz;app.meta.textScale=scale;app.applyAccessPrefs();app.render(1,0);
            const selectors=['.scoreboard','.sb-team.t0 .name','.sb-team.t1 .name','.sb-team.t0 .score','.sb-team.t1 .score','.clock','.period','.turbo-wrap','.turbo','.special-label','.player-tag','.pname','.ptype','.hp','.fire-streak'];
            return selectors.map(selector=>{const el=document.querySelector(`.hud ${selector}`),r=el.getBoundingClientRect();return {selector,left:r.left,right:r.right,top:r.top,bottom:r.bottom,scroll:el.scrollWidth,width:el.clientWidth};});
          },scale);
          checks.push({hudLayout:{width,height,scale,boxes:layout}});
          await page.screenshot({path:join(out,`hud-${width}-${scale}.png`)});
          if(!process.argv.includes('--baseline')) {
            assert.ok(layout.every(r=>r.left>=0&&r.right<=width&&r.top>=0&&r.bottom<=height&&(r.selector==='.fire-streak'||r.scroll<=r.width+1)),JSON.stringify(layout));
            const a=layout.find(r=>r.selector==='.turbo-wrap'),b=layout.find(r=>r.selector==='.player-tag');
            assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,'Player panel overlaps meters');
          }
        }
      }
    }
  }
  assert.deepEqual(errors,[]);
} catch(e){errors.push(String(e));process.exitCode=1;}
finally{await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));}
writeFileSync(join(out,'report.json'),JSON.stringify({pass:!errors.length,variant,checks,errors,scope:'Seeded map, keyboard/synthetic-pad selection and keyboard activation; optional prepared boss/elite, grudge, ascension and mutator fixture. Reduced-motion preference requested, not a whole-UI animation audit. Not physical controller evidence.'},null,2));
console.log(out,errors.length?errors:'PASS map focus');
