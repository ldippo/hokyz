import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

const source=process.argv.find(a=>a.startsWith('--resume='))?.slice(9);
assert.ok(source,'Provide an earned run/meta checkpoint with --resume');
const checkpoint=JSON.parse(readFileSync(resolve(source),'utf8'));
mkdirSync('.gaming/intro-navigation',{recursive:true});
const out=mkdtempSync(resolve('.gaming/intro-navigation',`${Date.now()}-`));
const server=await preview({preview:{host:'127.0.0.1',port:0,open:false}});
const checks=[],errors=[];let browser,page;
try {
  browser=await chromium.launch({args:['--enable-unsafe-swiftshader','--use-angle=swiftshader','--disable-dev-shm-usage']});
  page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(checkpoint=>{
    if(sessionStorage.getItem('intro-restored'))return;
    localStorage.setItem('hokyz.run.v1',checkpoint.run);localStorage.setItem('hokyz.meta.v1',checkpoint.meta);sessionStorage.setItem('intro-restored','1');
  },checkpoint);
  const ready=async()=>{await page.waitForFunction(()=>window.__hokyz?.assetsLoaded&&window.__hokyz?.view,null,{timeout:90000});await page.evaluate(()=>window.__hokyz.loop.stop());};
  const resume=async()=>{await ready();await page.getByRole('button',{name:'Continue Run',exact:true}).click();};
  const state=()=>page.evaluate(()=>{const r=window.__hokyz.run;return {act:r.act,row:r.row,path:r.path,rngState:r.rngState,available:[...document.querySelectorAll('.node.available')].map(n=>({title:n.title,text:n.textContent}))};});
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);await resume();
  const before=await state();assert.ok(before.row>0&&before.available.length>0);
  await page.locator('.node.available').first().click();
  assert.equal(await page.getByRole('button',{name:'Drop the Puck',exact:true}).count(),1);
  await page.screenshot({path:join(out,'intro.png')});
  await page.getByRole('button',{name:'Back to Map',exact:true}).click();
  const after=await state();checks.push({before,after});
  await page.screenshot({path:join(out,'back-to-map.png')});
  if(!process.argv.includes('--baseline'))assert.deepEqual(after,before,'Preview consumed connected route choices');
  await page.reload();await resume();
  const reloaded=await state();checks.push({reloaded});
  if(!process.argv.includes('--baseline')) {
    assert.deepEqual(reloaded,before,'Reload lost connected choices after preview');
    await page.locator('.node.available').first().click();
    await page.keyboard.press('Escape');await page.evaluate(()=>window.__hokyz.simStep());
    assert.deepEqual(await state(),before,'Keyboard Back lost connected choices');
    await page.locator('.node.available').first().click();
    await page.getByRole('button',{name:'Drop the Puck',exact:true}).click();
    const started=await page.evaluate(()=>({rngState:window.__hokyz.run.rngState,savedRngState:JSON.parse(localStorage.getItem('hokyz.run.v1')).rngState,human:window.__hokyz.humanPlaying}));
    assert.notEqual(started.rngState,before.rngState,'Match start did not consume setup RNG');
    assert.equal(started.savedRngState,started.rngState);assert.equal(started.human,true);
    checks.push({started});
  }
  assert.deepEqual(errors,[]);
}catch(e){errors.push(String(e));process.exitCode=1;await page?.screenshot({path:join(out,'failure.png')}).catch(()=>{});}
finally{await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));}
writeFileSync(join(out,'report.json'),JSON.stringify({pass:!errors.length,baseline:process.argv.includes('--baseline'),source,checks,errors,scope:'Earned checkpoint restored; normal mode asserts pointer/reload/keyboard Back preserve choices and RNG, then start consumes and persists RNG. Baseline records only. No human difficulty claim.'},null,2));
console.log(out,errors.length?errors:'PASS intro navigation');
