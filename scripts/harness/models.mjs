import { mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
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
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/?rigview=1&capture=1&poses=idle,skate,charge,lunge,down&goalie=butterfly${process.argv.includes('--puck')?'&puck=1':''}`);
    await page.waitForFunction(() => window.__rigview, null, { timeout: 90000 });
    const goalieTrace=process.argv.find(a=>a.startsWith('--goalie-carry='))?.slice('--goalie-carry='.length);
    if(goalieTrace){
      const source=JSON.parse(readFileSync(resolve(goalieTrace),'utf8'));
      const cases=source.samples.filter(s=>s.carrier?.goalie&&s.carrier.state&&s.carrier.poseState);
      assert.ok(cases.length>0,'No saved goalie carrier cases');
      const samples=[];
      for(const [index,saved] of cases.entries()){
        const sample=await page.evaluate(saved=>{
          const app=window.__hokyz,{entries,grig:rig,gState:st}=window.__rigview;
          entries.forEach(e=>e.rig.group.visible=false);rig.group.visible=true;
          Object.assign(st,saved.carrier.state);st.pos={x:0,y:-3.4};rig.snap(st);
          Object.assign(rig,saved.carrier.poseState);rig.update(st,1,0,0);rig.group.updateMatrixWorld(true);
          const stick=rig.bones.get('stick').bone;
          const height=Math.min(...rig.stickContacts.map(p=>stick.localToWorld(p.clone()).y));
          const grips=rig.grips.map(g=>rig.bones.get(`hand${g.side}`).bone.getWorldPosition(rig.group.position.clone()).distanceTo(stick.localToWorld(g.offset.clone())));
          window.__rigview.placePuck(st);
          app.rig.camera.position.copy(rig.group.position.clone().set(3,1.9,2.5).applyQuaternion(rig.group.quaternion).add(rig.group.position));app.rig.camera.lookAt(0,.65,-3.4);
          document.querySelectorAll('#ui,.hud').forEach(el=>el.style.display='none');app.rig.render(0);
          return {t:saved.t,height,grips,butterfly:st.butterfly,sourceHeight:saved.carrier.bladeLow};
        },saved);
        samples.push(sample);await page.screenshot({path:join(out,`goalie-carry-${index}.png`)});
      }
      writeFileSync(join(out,'goalie-carry.json'),JSON.stringify({source:goalieTrace,samples,scope:'Saved pose replay at normalized origin, not a new natural save or goalie-control input.'},null,2));
      if(!process.argv.includes('--baseline'))assert.ok(samples.every(s=>s.height>=-.015&&s.grips.every(g=>g<.02)),'Goalie blade/grip failed');
      if(errors.length)throw new Error(errors.join('\n'));
      await page.close();continue;
    }
    if(process.argv.includes('--reach-study')) {
      const study=await page.evaluate(()=>{
        const {rig,st}=window.__rigview.entries[0];
        const vector=(x=0,y=0,z=0)=>rig.group.position.clone().set(x,y,z);
        const quat=()=>rig.group.quaternion.clone().identity();
        const results=[];
        for(const action of ['skate','charge','dragL','dragR']) {
          Object.assign(st,{hasPuck:true,vel:{x:6,y:0},charging:action==='charge',shotCharge:.75,deke:action.startsWith('drag')?.3:0,dekeKind:action});
          Object.assign(rig,{fall:0,spin:0,lean:.21,roll:0,turnRate:0,stride:0});
          rig.update(st,1,0,0);rig.group.updateMatrixWorld(true);
          const stick=rig.bones.get('stick'),puck=window.__rigview.placePuck(st);
          const center=vector();for(const p of rig.stickContacts)center.add(p);center.multiplyScalar(1/rig.stickContacts.length);
          const grips=['L','R'].map(side=>{
            const shoulder=rig.bones.get(`upperArm${side}`).bone.getWorldPosition(vector());
            const elbow=rig.bones.get(`foreArm${side}`).bone.getWorldPosition(vector());
            const hand=rig.bones.get(`hand${side}`).bone.getWorldPosition(vector());
            return {side,shoulder,max:shoulder.distanceTo(elbow)+elbow.distanceTo(hand)-.015,
              offset:stick.bone.worldToLocal(hand.clone())};
          });
          const body={min:vector(Infinity,Infinity,Infinity),max:vector(-Infinity,-Infinity,-Infinity)};
          const shaftRange={min:Infinity,max:-Infinity};
          rig.model.traverse(mesh=>{
            if(!mesh.isSkinnedMesh)return;
            const skin=mesh.geometry.attributes.skinIndex;
            for(let i=0;i<skin.count;i++) {
              if(mesh.material.name==='stick'&&mesh.skeleton.bones[skin.getX(i)]?.name==='stick') {
                const p=vector();mesh.getVertexPosition(i,p);mesh.localToWorld(p);stick.bone.worldToLocal(p);
                shaftRange.min=Math.min(shaftRange.min,p.y);shaftRange.max=Math.max(shaftRange.max,p.y);
              }
              if(!['hips','spine','chest'].includes(mesh.skeleton.bones[skin.getX(i)]?.name))continue;
              const p=vector();mesh.getVertexPosition(i,p);mesh.localToWorld(p);rig.group.worldToLocal(p);
              body.min.min(p);body.max.max(p);
            }
          });
          const intersects=(a,b)=>{
            a=rig.group.worldToLocal(a.clone());b=rig.group.worldToLocal(b.clone());let lo=0,hi=1;
            for(const axis of ['x','y','z']) {
              const d=b[axis]-a[axis];
              if(Math.abs(d)<1e-8){if(a[axis]<body.min[axis]||a[axis]>body.max[axis])return false;continue;}
              const t0=(body.min[axis]-a[axis])/d,t1=(body.max[axis]-a[axis])/d;
              lo=Math.max(lo,Math.min(t0,t1));hi=Math.min(hi,Math.max(t0,t1));if(lo>hi)return false;
            }return true;
          };
          const counts={total:0,reachable:0,inFront:0,belowHeightLimit:0,clear:0};let best=null;
          for(const [dx,dz] of [[-.33,0],[.33,0],[0,-.33],[0,.33]])for(let yi=-36;yi<=36;yi++)for(let ti=0;ti<=20;ti++) {
            counts.total++;const yaw=yi*Math.PI/36,tilt=ti/20;
            const flat=quat().setFromAxisAngle(vector(0,1,0),yaw).multiply(stick.invRestWorld.clone().invert());
            const shaft=grips[1].offset.clone().sub(center).applyQuaternion(flat).normalize();
            const upright=quat().setFromUnitVectors(shaft,vector(0,1,0));
            const rotation=quat().slerp(upright,tilt).multiply(flat);
            const blade=vector(puck.x+dx,0,puck.y+dz),position=blade.clone().sub(center.clone().applyQuaternion(rotation));
            let low=Infinity;for(const p of rig.stickContacts)low=Math.min(low,p.clone().applyQuaternion(rotation).y+position.y);
            position.y+=.003-low;
            const targets=grips.map(g=>g.offset.clone().applyQuaternion(rotation).add(position));
            if(targets.some((t,i)=>t.distanceTo(grips[i].shoulder)>grips[i].max))continue;counts.reachable++;
            if(targets.some(t=>rig.group.worldToLocal(t.clone()).x<body.max.x+.02))continue;counts.inFront++;
            if(targets.some((t,i)=>t.y>grips[i].shoulder.y+.1))continue;counts.belowHeightLimit++;
            const bladeWorld=center.clone().applyQuaternion(rotation).add(position);
            if(intersects(position,bladeWorld))continue;counts.clear++;
            const score=yaw*yaw+tilt*tilt;
            if(!best||score<best.score)best={yaw,tilt,score,offset:[dx,dz],rotation:rotation.toArray(),targets:targets.map(t=>t.toArray()),blade:bladeWorld.toArray(),origin:position.toArray()};
          }
          const gripShaftDistance=grips.map(g=>({side:g.side,distance:g.offset.distanceTo(vector(0,Math.max(shaftRange.min,Math.min(shaftRange.max,g.offset.y)),0))}));
          results.push({action,shaftRange,gripShaftDistance,body:{min:body.min.toArray(),max:body.max.toArray()},counts,best});
        }
        return results;
      });
      writeFileSync(join(out,'reach-study.json'),JSON.stringify({study,scope:'Offline facing0 pose feasibility, conservative torso AABB and shaft centerline; not a runtime pose or exact collision/contact proof.'},null,2));
      assert.ok(study.every(s=>s.counts.total===6132));
      assert.ok(study.every(s=>Number.isFinite(s.shaftRange.min)&&s.shaftRange.max>s.shaftRange.min&&s.gripShaftDistance.every(g=>Number.isFinite(g.distance))),'Missing shaft geometry');
      if(process.argv.includes('--shaft'))assert.ok(study.every(s=>s.gripShaftDistance.every(g=>g.distance<.03)),'Hand is not on the physical shaft');
      if(process.argv.includes('--reach-preview'))for(const sample of study.filter(s=>s.best)) {
        const check=await page.evaluate(({action,best})=>{
          const app=window.__hokyz,{entries,grig}=window.__rigview,{rig,st}=entries[0];
          entries.forEach(e=>e.rig.group.visible=e.rig===rig);grig.group.visible=false;
          Object.assign(st,{hasPuck:true,vel:{x:6,y:0},charging:action==='charge',shotCharge:.75,deke:action.startsWith('drag')?.3:0,dekeKind:action});
          Object.assign(rig,{fall:0,spin:0,lean:.21,roll:0,turnRate:0,stride:0});
          rig.update(st,1,0,0);rig.group.updateMatrixWorld(true);
          const vector=(x=0,y=0,z=0)=>rig.group.position.clone().set(x,y,z);
          for(const [i,side] of ['L','R'].entries()) {
            const upper=rig.bones.get(`upperArm${side}`).bone,fore=rig.bones.get(`foreArm${side}`).bone,hand=rig.bones.get(`hand${side}`).bone;
            const shoulder=upper.getWorldPosition(vector()),elbow=fore.getWorldPosition(vector()),current=hand.getWorldPosition(vector());
            const a=shoulder.distanceTo(elbow),b=elbow.distanceTo(current),target=vector().fromArray(best.targets[i]);
            const d=target.distanceTo(shoulder),dir=target.clone().sub(shoulder).normalize(),pole=vector(-.5,-.35,side==='L'?.7:-.7).normalize();
            pole.addScaledVector(dir,-pole.dot(dir)).normalize();
            const angle=Math.acos(Math.max(-1,Math.min(1,(a*a+d*d-b*b)/(2*a*d))));
            const desiredElbow=shoulder.clone().addScaledVector(dir,a*Math.cos(angle)).addScaledVector(pole,a*Math.sin(angle));
            for(let pass=0;pass<2;pass++){rig.aimBone(upper,fore,desiredElbow);rig.aimBone(fore,hand,target);}
          }
          const stick=rig.bones.get('stick').bone,hand=rig.bones.get('handR').bone;
          const rotation=hand.quaternion.clone().fromArray(best.rotation).multiply(stick.quaternion.clone().invert());
          const parent=hand.quaternion.clone();hand.parent.getWorldQuaternion(parent);
          hand.quaternion.copy(parent.invert().multiply(rotation));hand.updateMatrixWorld(true);
          window.__rigview.placePuck(st);
          app.rig.camera.position.set(.4,.85,.2);app.rig.camera.lookAt(.3,.7,-3.4);
          document.querySelectorAll('#ui,.hud').forEach(el=>el.style.display='none');app.rig.render(0);
          return ['L','R'].map((side,i)=>rig.bones.get(`hand${side}`).bone.getWorldPosition(vector()).distanceTo(vector().fromArray(best.targets[i])));
        },sample);
        writeFileSync(join(out,`reach-preview-${sample.action}.json`),JSON.stringify({action:sample.action,handTargetErrors:check,scope:'Independent offline arm solve; visual acceptance and blade/puck contact are not asserted.'},null,2));
        assert.ok(check.every(d=>Number.isFinite(d)&&d<.02),'Offline preview hand target missed');
        await page.screenshot({path:join(out,`reach-preview-${sample.action}.png`)});
      }
      if(errors.length)throw new Error(errors.join('\n'));
      await page.close();continue;
    }
    if(process.argv.includes('--carry-motion')) {
      const samples=await page.evaluate(baseline=>{
        const {rig,st}=window.__rigview.entries[0];
        if(baseline)rig.poseCarrier=()=>{};
        st.facing=0;st.vel={x:6,y:0};st.knockdown=0;rig.snap(st);rig.carryBlend=0;
        const samples=[];
        for(let i=0;i<150;i++) {
          const t=i/60;
          st.hasPuck=t>=.2&&t<1.9;
          st.charging=t>=.7&&t<1;st.shotCharge=st.charging?(t-.7)/.3:0;
          st.deke=t>=1.2&&t<1.65?1.65-t:0;st.dekeKind='dragL';
          rig.update(st,1,1/60,t);rig.group.updateMatrixWorld(true);
          const stick=rig.bones.get('stick').bone,points=rig.stickContacts.map(p=>stick.localToWorld(p.clone()));
          const center=points.reduce((sum,p)=>sum.add(p),rig.group.position.clone().set(0,0,0)).multiplyScalar(1/points.length);
          const grips=rig.grips.map(g=>rig.bones.get(`hand${g.side}`).bone.getWorldPosition(center.clone()).distanceTo(stick.localToWorld(g.offset.clone())));
          samples.push({t,shotRelease:i===60,blend:rig.carryBlend,center:center.toArray(),low:Math.min(...points.map(p=>p.y)),grips});
        }
        return samples;
      },process.argv.includes('--baseline'));
      writeFileSync(join(out,'carry-motion.json'),JSON.stringify(samples,null,2));
      assert.ok(samples.every(s=>s.low>=-.015),'Carrier transition buried blade');
      assert.ok(samples.every(s=>s.grips.every(g=>g<.02)),'Carrier transition broke grip');
      assert.ok(samples[40].blend>.99&&samples.at(-1).blend<.001,'Possession blend did not settle in/out');
      let maxStep=0;
      // The existing authored shot-release snap moves ~1.58m in this fixture.
      // Preserve that action; this continuity gate covers the other transitions.
      for(let i=1;i<samples.length;i++)if(!samples[i].shotRelease)maxStep=Math.max(maxStep,Math.hypot(...samples[i].center.map((v,j)=>v-samples[i-1].center[j])));
      if(!process.argv.includes('--baseline'))assert.ok(maxStep<.2,`Carrier transition jumped ${maxStep}m per frame`);
      if(errors.length)throw new Error(errors.join('\n'));
      await page.close();continue;
    }
    if(process.argv.includes('--stride')) {
      const speed=Number(process.argv.find(a=>a.startsWith('--speed='))?.split('=')[1]??6);
      const roll=Number(process.argv.find(a=>a.startsWith('--roll='))?.split('=')[1]??0);
      const action=process.argv.find(a=>a.startsWith('--action='))?.split('=')[1]??'skate';
      const facing=Number(process.argv.find(a=>a.startsWith('--facing='))?.split('=')[1]??0);
      const carry=process.argv.includes('--carry');
      const scan=process.argv.includes('--clearance-scan');
      const samples=[];
      for(let phase=0;phase<12;phase++) {
        const sample=await page.evaluate(({phase,speed,roll,action,facing,carry,scan})=>{
          const app=window.__hokyz,{entries,grig}=window.__rigview,{rig,st}=entries[0];
          entries.forEach(e=>e.rig.group.visible=e.rig===rig);grig.group.visible=false;
          Object.assign(rig,{fall:0,spin:0,lean:Math.min(.4,speed*.035),roll,turnRate:0,stride:phase*Math.PI/6});
          Object.assign(st,{facing,vel:{x:speed*Math.cos(facing),y:speed*Math.sin(facing)},turboActive:speed>9,knockdown:0,controlled:true});
          rig.snap(st);rig.carryBlend=carry?1:0;
          st.hasPuck=new URLSearchParams(location.search).has('puck');
          st.charging=action==='charge';st.shotCharge=st.charging?.75:0;
          st.deke=action.startsWith('drag')?.3:0;st.dekeKind=action;
          const bladeCenter=()=>{
            const center=rig.group.position.clone().set(0,0,0),bone=rig.bones.get('stick').bone;
            for(const point of rig.stickContacts)center.add(bone.localToWorld(point.clone()));
            return center.multiplyScalar(1/rig.stickContacts.length);
          };
          let neutralBlade=null;
          if(st.deke>0){const deke=st.deke;st.deke=0;rig.update(st,1,0,0);rig.group.updateMatrixWorld(true);neutralBlade=bladeCenter();st.deke=deke;}
          rig.update(st,1,0,0);rig.group.updateMatrixWorld(true);
          const dragLateral=neutralBlade?bladeCenter().z-neutralBlade.z:null;
          const feet={footL:[],footR:[]};
          const stickHeights=[],bladePoints=[];
          const puck=window.__rigview.placePuck(st);
          rig.model.traverse(mesh=>{
            if(!mesh.isSkinnedMesh)return;
            const p=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex;
            for(let i=0;i<p.count;i++) {
              const name=mesh.skeleton.bones[indices.getX(i)]?.name;
              if(name==='stick') {
                const v=rig.group.position.clone();mesh.getVertexPosition(i,v);mesh.localToWorld(v);stickHeights.push(v.y);
                if(mesh.material.name==='tape')bladePoints.push({x:v.x,y:v.y,z:v.z});
              }
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
          const stick=rig.bones.get('stick').bone;
          const gripErrors=rig.grips.map(g=>rig.bones.get(`hand${g.side}`).bone.getWorldPosition(rig.group.position.clone()).distanceTo(stick.localToWorld(g.offset.clone())));
          const gripReach=rig.grips.map(g=>{const s=rig.bones.get(`upperArm${g.side}`).bone.getWorldPosition(rig.group.position.clone());return {max:g.upper+g.fore-.01,start:s.distanceTo(stick.localToWorld(g.offset.clone())),end:s.distanceTo(rig.bones.get('handR').bone.getWorldPosition(rig.group.position.clone()))};});
          const clearanceScan=[];
          if(scan){
            const arm=rig.bones.get('upperArmR').bone,base=arm.quaternion.clone();
            for(let i=0;i<=36;i++){
              arm.quaternion.copy(base);rig.rot('upperArm.R',rig.group.position.clone().set(0,0,1),i*.05);arm.updateMatrixWorld(true);
              clearanceScan.push({angle:i*.05,low:Math.min(...rig.stickContacts.map(p=>stick.localToWorld(p.clone()).y))});
            }
            arm.quaternion.copy(base);arm.updateMatrixWorld(true);
          }
          return {phase,speed,roll,action,facing,carry,clearanceScan,heights,puck,dragLateral,bladePuckDistance:Math.min(...bladePoints.map(v=>Math.hypot(v.x-puck.x,v.z-puck.y))),bladePoints:bladePoints.length,stickMin:Math.min(...stickHeights),gripErrors,gripReach,ringError:Math.hypot(ring.x-st.pos.x,ring.z-st.pos.y),contactPoints:rig.bladeContacts?.reduce((n,c)=>n+c.points.length,0)};
        },{phase,speed,roll,action,facing,carry,scan});
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
          if(process.argv.includes('--stick')) {
            assert.ok(sample.stickMin>=-.015,`Stride ${sample.phase} stick buried: ${sample.stickMin}`);
            assert.ok(sample.gripErrors.every(e=>e<.02),'Hand left stick grip');
          }
          if(carry&&action==='skate'&&speed===6&&roll===0)assert.ok(sample.bladePuckDistance>=.15&&sample.bladePuckDistance<=.19,'Neutral carrier blade misses puck edge');
          if(process.argv.includes('--puck')&&sample.dragLateral!==null)assert.ok(sample.dragLateral*(action==='dragL'?1:-1)>0,'Blade sweeps opposite the puck drag');
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
