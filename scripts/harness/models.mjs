import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';

mkdirSync('.gaming/models', { recursive: true });
const out = mkdtempSync(resolve('.gaming/models', `${Date.now()}-`));
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
let browser;
try {
  browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
  for (const version of process.argv.includes('--compare') ? ['before', 'after'] : ['after']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    if (version === 'before') await page.route('**/models/*.glb', route => route.fulfill({ path: resolve('.gaming/models-before', new URL(route.request().url()).pathname.split('/').pop()), contentType: 'model/gltf-binary' }));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?rigview=1&capture=1&poses=idle,skate,charge,lunge,down&goalie=butterfly`);
    await page.waitForFunction(() => window.__rigview, null, { timeout: 90000 });
    if(process.argv.includes('--stride')) {
      const speed=Number(process.argv.find(a=>a.startsWith('--speed='))?.split('=')[1]??6);
      const roll=Number(process.argv.find(a=>a.startsWith('--roll='))?.split('=')[1]??0);
      const samples=[];
      for(let phase=0;phase<12;phase++) {
        const sample=await page.evaluate(({phase,speed,roll})=>{
          const app=window.__hokyz,{entries,grig}=window.__rigview,{rig,st}=entries[0];
          entries.forEach(e=>e.rig.group.visible=e.rig===rig);grig.group.visible=false;
          Object.assign(rig,{fall:0,spin:0,lean:Math.min(.4,speed*.035),roll,turnRate:0,stride:phase*Math.PI/6});
          Object.assign(st,{vel:{x:speed,y:0},turboActive:speed>9,knockdown:0,controlled:true});
          rig.update(st,1,0,0);rig.group.updateMatrixWorld(true);
          const feet={footL:[],footR:[]};
          rig.model.traverse(mesh=>{
            if(!mesh.isSkinnedMesh)return;
            const p=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex;
            for(let i=0;i<p.count;i++) {
              const name=mesh.skeleton.bones[indices.getX(i)]?.name;
              if(!(name in feet)||p.getY(i)>.027)continue;
              const v=rig.group.position.clone();mesh.getVertexPosition(i,v);mesh.localToWorld(v);
              feet[name].push(v.y);
            }
          });
          const heights=Object.fromEntries(Object.entries(feet).map(([name,ys])=>[name,{count:ys.length,min:Math.min(...ys),max:Math.max(...ys)}]));
          const cam=app.rig.camera;cam.position.set(.4,.85,.2);cam.lookAt(.3,.7,-3.4);
          document.querySelectorAll('#ui, .hud').forEach(el=>el.style.display='none');
          app.rig.render(0);
          const ring=rig.ring.getWorldPosition(rig.group.position.clone());
          return {phase,speed,roll,heights,ringError:Math.hypot(ring.x-st.pos.x,ring.z-st.pos.y),contactPoints:rig.bladeContacts?.reduce((n,c)=>n+c.points.length,0)};
        },{phase,speed,roll});
        samples.push(sample);
        if(phase%3===0)await page.screenshot({path:join(out,`${version}-stride-${phase}.png`)});
      }
      writeFileSync(join(out,`${version}-stride.json`),JSON.stringify(samples,null,2));
      for(const sample of samples){
        assert.ok(Object.values(sample.heights).every(f=>f.count>0),'No blade vertices sampled');
        assert.ok(sample.ringError<1e-6,'Control ring left simulation position');
        if(!process.argv.includes('--baseline')) {
          const support=Math.min(...Object.values(sample.heights).map(f=>f.min));
          assert.ok(support>=-.015&&support<=.025,`Stride ${sample.phase} support blade height ${support}`);
        }
      }
      if(errors.length)throw new Error(errors.join('\n'));
      await page.close();continue;
    }
    if (process.argv.includes('--timing')) {
      const samples=[];
      for (const fps of [30,60,120]) {
        const sample=await page.evaluate(fps=>{
          const app=window.__hokyz,{entries,grig}=window.__rigview;
          const {rig,st}=entries[0];
          entries.forEach(e=>e.rig.group.visible=e.rig===rig);grig.group.visible=false;
          for(const key of ['fall','lean','roll','spin','stride','turnRate','prevFacing','snapT','celebrateT'])rig[key]=0;
          rig.fallSeed=0;st.facing=0;st.vel={x:6,y:0};st.controlled=true;st.knockdown=1;
          rig.snap(st);
          const state=()=>({fall:rig.fall,lean:rig.lean,pivot:rig.pivot.position.toArray(),ring:rig.ring.getWorldPosition(rig.group.position.clone()).toArray(),position:rig.group.position.toArray()});
          for(let i=0;i<fps/10;i++)rig.update(st,1,1/fps,(i+1)/fps);
          const down=state();
          const cam=app.rig.camera;cam.position.set(4,3,-.8);cam.lookAt(.5,.6,-3.4);
          document.querySelectorAll('#ui, .hud').forEach(el=>el.style.display='none');
          app.rig.render(0);
          return {fps,down};
        },fps);
        await page.screenshot({path:join(out,`${version}-down-${fps}.png`)});
        sample.recovery=await page.evaluate(fps=>{
          const {rig,st}=window.__rigview.entries[0];st.knockdown=0;
          for(let i=0;i<fps/5;i++)rig.update(st,1,1/fps,.1+(i+1)/fps);
          return {fall:rig.fall,lean:rig.lean};
        },fps);
        samples.push(sample);
      }
      writeFileSync(join(out,`${version}-timing.json`),JSON.stringify(samples,null,2));
      if(!process.argv.includes('--baseline'))for(const sample of samples){
        for(const phase of ['down','recovery'])for(const field of ['fall','lean'])assert.ok(Math.abs(sample[phase][field]-samples[1][phase][field])<1e-6,`${phase} ${field} depends on render rate`);
        assert.ok(Math.abs(sample.down.ring[0]-sample.down.position[0])<1e-6&&Math.abs(sample.down.ring[2]-sample.down.position[2])<1e-6,'Control ring drifted from simulation position');
      }
      if(errors.length)throw new Error(errors.join('\n'));
      await page.close();
      continue;
    }
    for (const subject of ['skater', 'goalie', 'poses']) {
      await page.evaluate(subject => {
        const app = window.__hokyz, { entries, grig } = window.__rigview;
        document.querySelectorAll('#ui, .hud').forEach(el => { el.style.display = 'none'; });
        entries.forEach(({ rig }, i) => { rig.group.visible = subject === 'poses' || (subject === 'skater' && i === 0); });
        grig.group.visible = subject !== 'skater';
        const cam = app.rig.camera;
        if (subject === 'skater') { cam.position.set(2.6, 1.8, -1.75); cam.lookAt(0, 0.9, -3.4); }
        else if (subject === 'goalie') { cam.position.set(0.8, 1.7, 1.5); cam.lookAt(-1.8, 0.75, 0); }
        else { cam.position.set(9, 6, 8); cam.lookAt(-0.5, 0.8, 0); }
        app.rig.render(0);
      }, subject);
      await page.screenshot({ path: join(out, `${version}-${subject}.png`) });
    }
    if (errors.length) throw new Error(errors.join('\n'));
    await page.close();
  }
  console.log(out);
} finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
