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
