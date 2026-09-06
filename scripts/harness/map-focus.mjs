import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/map-focus', { recursive:true });
const out=mkdtempSync(resolve('.gaming/map-focus',`${Date.now()}-`));
const server=await preview({preview:{host:'127.0.0.1',port:0,open:false}});
const errors=[],checks=[]; let browser;
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
  await press('Enter');
  assert.equal(await page.locator('.screen-title').textContent(),'NEXT MATCH');
  assert.ok((await page.locator('.matchup .tn').last().textContent()).includes(expected.split(' · ')[0]));
  checks.push({activation:'Enter opened selected rival'});
  assert.deepEqual(errors,[]);
} catch(e){errors.push(String(e));process.exitCode=1;}
finally{await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));}
writeFileSync(join(out,'report.json'),JSON.stringify({pass:!errors.length,checks,errors,scope:'Seeded map, keyboard/synthetic-pad selection and keyboard activation; reduced-motion preference requested, not a whole-UI animation audit. Not physical controller evidence.'},null,2));
console.log(out,errors.length?errors:'PASS map focus');
