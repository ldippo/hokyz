import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { chromium } from 'playwright';

process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
mkdirSync('.gaming/playtests', { recursive: true });
const out = mkdtempSync(resolve('.gaming/playtests', `${Date.now()}-`));
const checks = [], errors = [];
const remap = process.argv.includes('--remap');
const gamepad = process.argv.includes('--gamepad');
const passKey = remap ? 'k' : 'j', shotKey = remap ? 'j' : 'k';
let server, browser, page;
try {
  server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
  const address = server.httpServer.address();
  browser = await chromium.launch({ headless: true,
    ...(process.env.GAMING_CHROME ? { executablePath: process.env.GAMING_CHROME } : {}),
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
  });
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    if (!localStorage.getItem('hokyz.meta.v1')) localStorage.setItem('hokyz.meta.v1', JSON.stringify({ quality: 'low', cinematics: false, music: false }));
  });
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.waitForFunction(() => window.__hokyz?.assetsLoaded && window.__hokyz?.view, null, { timeout: 60000 });
  // Use fixed simulation steps for input fixtures; no software-GPU speed assumption.
  await page.evaluate(() => window.__hokyz.loop.stop());
  for (const [width, height] of [[1280, 720], [390, 844]]) {
    await page.setViewportSize({ width, height });
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.title-screen [data-nav]')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.x < 0 || r.right > innerWidth || r.y < 0 || r.bottom > document.querySelector('.title-footer').getBoundingClientRect().top;
    }).map((el) => el.textContent));
    assert.deepEqual(clipped, [], `Title actions clipped at ${width}x${height}`);
    await page.screenshot({ path: join(out, `title-${width}.png`) });
    checks.push(`Title actions fit ${width}x${height}`);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  const navKey = async (key) => {
    await page.keyboard.press(key);
    await page.evaluate(() => {
      const app = window.__hokyz;
      app.input.poll(); app.nav.update(app.input); app.input.poll();
    });
  };
  await navKey('Enter');
  const nameField = page.locator('.identity input');
  await nameField.fill('');
  await nameField.pressSequentially('Skate Kings');
  assert.equal(await nameField.inputValue(), 'Skate Kings', 'Gameplay bindings intercepted team-name typing');
  await page.locator('.cards [data-nav]').first().click();
  assert.equal(await page.evaluate(() => window.__hokyz.run.teamName), 'Skate Kings');
  await page.getByRole('button', { name: 'Save & Quit', exact: true }).click();
  await page.getByRole('button', { name: 'Continue Run', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__hokyz.run.teamName), 'Skate Kings');
  await page.getByRole('button', { name: 'Save & Quit', exact: true }).click();
  checks.push('Custom team typing, captain selection, save and continue');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('.settings-row').filter({ hasText: 'Reduced motion' }).getByRole('button').first().click();
  assert.equal(await page.evaluate(() => window.__hokyz.meta.reducedMotion), true);
  if (remap) {
    await page.getByRole('button', { name: 'Controls…', exact: true }).click();
    const passRow = () => page.locator('.settings-row').filter({ hasText: 'Pass / switch / block' });
    await passRow().getByRole('button').click();
    await page.keyboard.press('k');
    assert.equal(await passRow().locator('kbd').textContent(), 'K');
    assert.equal(await page.locator('.settings-row').filter({ hasText: 'Shoot / check / high' }).locator('kbd').textContent(), 'J');
    await passRow().getByRole('button').click();
    await page.keyboard.press('Enter');
    assert.equal(await passRow().locator('kbd').textContent(), 'K');
    assert.equal(await page.evaluate(() => window.__hokyz.input.keymap.Enter), 'confirm');
    await passRow().getByRole('button').click();
    await page.keyboard.press('Escape');
    assert.equal(await passRow().locator('kbd').textContent(), 'K');
    await page.screenshot({ path: join(out, 'remapped-controls.png') });
    await page.reload();
    await page.waitForFunction(() => window.__hokyz?.assetsLoaded && window.__hokyz?.view, null, { timeout: 60000 });
    await page.evaluate(() => window.__hokyz.loop.stop());
    assert.deepEqual(await page.evaluate(() => [window.__hokyz.input.keymap.KeyK, window.__hokyz.input.keymap.KeyJ]), ['pass', 'shoot']);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    assert.equal(await page.locator('.settings-row').filter({ hasText: 'Pass · Switch' }).locator('kbd').textContent(), 'K');
    assert.equal(await page.locator('.settings-row').filter({ hasText: 'Shoot (hold) · Check' }).locator('kbd').textContent(), 'J');
    checks.push('Occupied keys swap, Enter is protected, Escape cancels, and bindings survive reload');
  }
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await navKey('s');
  await navKey('s');
  assert.equal(await page.locator('.title-menu .focus').textContent(), 'Quick Match');
  await navKey('Enter');
  assert.equal(await page.locator('.screen-title').textContent(), 'QUICK MATCH');
  checks.push('Keyboard navigation opens Quick Match');
  await page.getByRole('button', { name: 'Drop the Puck', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__hokyz.view.shakeMul), 0, 'Match startup lost reduced-motion preference');
  checks.push('Reduced motion survives Settings to match startup');
  if (gamepad) await page.evaluate(() => {
    window.__testPad = { connected: true, axes: [0,0,0,0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.__testPad];
  });
  const control = async (key, down) => {
    if (!gamepad) return page.keyboard[down ? 'down' : 'up'](key);
    await page.evaluate(({ key, down, passKey, shotKey }) => {
      const pad = window.__testPad;
      const button = key === passKey ? 0 : key === shotKey ? 1 : key === 'p' ? 9 : null;
      if (button !== null) pad.buttons[button] = { pressed: down, value: down ? 1 : 0 };
      else if (key === 'd') pad.axes[0] = down ? 1 : 0;
      else if (key === 's') pad.axes[1] = down ? 1 : 0;
      else if (key === 'ArrowUp') pad.axes[3] = down ? -1 : 0;
      else throw new Error(`Unmapped test control: ${key}`);
    }, { key, down, passKey, shotKey });
  };
  if (gamepad) {
    const inputs = await page.evaluate(() => {
      const pad = window.__testPad, input = window.__hokyz.input;
      pad.axes = [0.1,0.1,0.1,0.1]; input.poll();
      const deadZone = input.simInput();
      pad.axes = [0.5,0,0,-0.7];
      for (const index of [2,3,7]) pad.buttons[index] = { pressed: true, value: 1 };
      input.poll(); const active = input.simInput();
      input.poll(); const held = input.simInput();
      pad.connected = false; input.poll(); const disconnected = input.simInput();
      pad.connected = true; pad.axes = [0,0,0,0];
      pad.buttons.forEach(button => { button.pressed = false; button.value = 0; });
      input.poll();
      return { deadZone, active, held, disconnected };
    });
    assert.deepEqual(inputs.deadZone.move, { x: 0, y: 0 });
    assert.deepEqual(inputs.active.move, { x: 0.5, y: 0 });
    assert.deepEqual(inputs.active.aim, { x: 0, y: -0.7 });
    assert.ok(inputs.active.turbo && inputs.active.deke && inputs.active.special);
    assert.ok(inputs.held.turbo && !inputs.held.deke && !inputs.held.special);
    assert.deepEqual(inputs.disconnected.move, { x: 0, y: 0 });
    assert.equal(inputs.disconnected.turbo, false);
    writeFileSync(join(out, 'gamepad-input.json'), JSON.stringify(inputs, null, 2));
    checks.push('Synthetic pad dead zone, analog magnitude, separate aim, turbo/deke/special edges and disconnect release');
  }
  const movement = await page.evaluate(() => {
    const app = window.__hokyz, sim = app.view.sim;
    for (let i = 0; i < 900 && sim.st.phase !== 'play'; i++) sim.step();
    if (sim.st.phase !== 'play') throw new Error('Match never entered play');
    const sk = sim.st.skaters[sim.st.teams[0].controlledId];
    // An open-ice movement fixture avoids a seeded faceoff collision or automatic
    // possession switch deciding which skater this input assertion measures.
    for (const team of sim.st.teams) team.skaters.forEach((id, i) => {
      sim.st.skaters[id].pos = { x: team.id ? 12 : -12, y: (i - 1) * 6 };
      sim.st.skaters[id].vel = { x: 0, y: 0 };
      sim.st.skaters[id].hasPuck = false;
    });
    sk.pos = { x: -3, y: 0 }; sk.knockdown = 0;
    sim.st.puck.owner = null; sim.st.puck.pos = { x: 15, y: -8 };
    sim.st.puck.vel = { x: 0, y: 0 };
    return { id: sk.id, x: sk.pos.x };
  });
  await control('d', true);
  const movedX = await page.evaluate(() => {
    const app = window.__hokyz, sim = app.view.sim;
    app.input.poll();
    for (let i = 0; i < 30; i++) app.view.afterStep(sim.step({ 0: app.input.simInput() }));
    app.view.render(1, 0);
    return sim.st.skaters[sim.st.teams[0].controlledId].pos.x;
  });
  await control('d', false);
  assert.ok(movedX > movement.x + 0.1, 'Human movement did not move the skater');
  checks.push('Match input moves the human skater in a fixed-step match');
  await page.screenshot({ path: join(out, 'human-match.png') });
  if(process.argv.includes('--fight')) {
    const captureFight=async stage=>{
      if(!process.argv.includes('--fight-layout'))return;
      for(const [width,height,scale] of [[1280,720,1],[390,844,1.5]]) {
        await page.setViewportSize({width,height});
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        const boxes=await page.evaluate(scale=>{const app=window.__hokyz;app.meta.textScale=scale;app.applyAccessPrefs();app.view.render(1,0);return [...document.querySelectorAll('.fight,.fighter,.fname,.fcue')].map(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom};});},scale);
        checks.push({fightLayout:{stage,width,height,scale,boxes}});
        await page.screenshot({path:join(out,`fight-${stage}-${width}.png`)});
        if(!process.argv.includes('--baseline'))assert.ok(boxes.every(b=>b.left>=0&&b.right<=width&&b.top>=0&&b.bottom<=height),JSON.stringify(boxes));
      }
      await page.setViewportSize({width:1280,height:720});
      await page.evaluate(()=>{const app=window.__hokyz;app.meta.textScale=1;app.applyAccessPrefs();});
    };
    const offer=async()=>page.evaluate(()=>{
      const app=window.__hokyz,st=app.view.sim.st,a=st.teams[0].controlledId,b=st.teams[1].skaters[0];
      // Prepared offer with opponent consent; human choices use real keys below.
      st.fight={a,b,stage:'offer',t:0,hp:[100,100],accepted:[null,true],cue:null,nextCue:0.6,winner:null,lastHit:null};st.phase='fight';
      app.view.afterStep([{type:'fightOffer',a,b}]);app.view.director.stop();app.view.render(1,0);
    });
    const fightKey=async key=>{
      await control(key,true);
      // Pass/block uses release, matching the production pass input contract.
      if(key===passKey){await page.evaluate(()=>window.__hokyz.input.poll());await control(key,false);}
      const result=await page.evaluate(()=>{const app=window.__hokyz;app.input.poll();const events=app.view.sim.step({0:app.input.simInput()});app.view.afterStep(events);app.view.render(1,0);return {phase:app.view.sim.st.phase,fight:app.view.sim.st.fight,events,visible:document.querySelector('.fight').classList.contains('on')};});
      await control(key,false);await page.evaluate(()=>window.__hokyz.input.poll());return result;
    };
    await offer();
    await captureFight('offer');
    const declined=await fightKey(passKey);checks.push({fightDecline:declined});
    assert.equal(declined.phase,'play');assert.equal(declined.fight,null);
    if(!process.argv.includes('--baseline'))assert.equal(declined.visible,false,'Fight HUD remains after declining');
    await offer();const accepted=await fightKey(shotKey);checks.push({fightAccept:accepted});assert.equal(accepted.fight.stage,'duel');
    for(const [kind,key] of [['high',shotKey],['low','l'],['feint',passKey]]) {
      await page.evaluate(kind=>{const app=window.__hokyz,f=app.view.sim.st.fight;f.cue={kind,target:0,t:0,window:0.8,done:false,mash:0};app.view.render(1,0);},kind);
      if(kind==='feint')await captureFight('feint');
      const hit=await fightKey(key);assert.ok(hit.events.some(e=>e.type==='fightHit'&&e.attacker===hit.fight.a),`${kind} key did not land`);
      checks.push({fightCue:{kind,events:hit.events}});
    }
    await page.evaluate(()=>{const app=window.__hokyz;app.view.sim.st.fight=null;app.view.sim.st.phase='play';app.view.render(1,0);});
  }
  if(process.argv.includes('--charge-layout')) {
    await page.evaluate(()=>{
      const st=window.__hokyz.view.sim.st,sk=st.skaters[st.teams[0].controlledId];
      for(const id of st.order)st.skaters[id].hasPuck=false;
      sk.hasPuck=true;sk.vel={x:0,y:0};sk.charging=false;sk.shotCharge=0;
      st.puck.owner=sk.id;st.puck.pos={...sk.pos};st.puck.vel={x:0,y:0};
    });
    await control(shotKey,true);
    const charged=await page.evaluate(()=>{
      const app=window.__hokyz;app.input.poll();
      for(let i=0;i<18;i++)app.view.afterStep(app.view.sim.step({0:app.input.simInput()}));
      const st=app.view.sim.st,sk=st.skaters[st.teams[0].controlledId];
      return {charging:sk.charging,charge:sk.shotCharge};
    });
    assert.ok(charged.charging&&charged.charge>0,'Held Shoot did not charge');
    for(const [width,height,scale] of [[1280,720,1],[390,844,1],[390,844,1.5]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const boxes=await page.evaluate(scale=>{
        const app=window.__hokyz;app.meta.textScale=scale;app.applyAccessPrefs();app.view.render(1,0);
        return ['.charge-wrap','.turbo','.special-label','.special','.player-tag','.turbo-wrap'].map(selector=>{
          const el=document.querySelector(selector),r=el.getBoundingClientRect();
          return {selector,left:r.left,right:r.right,top:r.top,bottom:r.bottom,on:el.classList.contains('on')};
        });
      },scale);
      await page.screenshot({path:join(out,`charge-${width}-${scale}.png`)});
      const charge=boxes[0],overlap=boxes.slice(1).filter(b=>charge.left<b.right&&charge.right>b.left&&charge.top<b.bottom&&charge.bottom>b.top);
      checks.push({chargeLayout:{width,height,scale,charged,boxes,overlap}});
      assert.ok(charge.on);
      if(!process.argv.includes('--baseline'))assert.ok(!overlap.length&&charge.left>=0&&charge.right<=width&&charge.top>=0&&charge.bottom<=height,JSON.stringify(boxes));
    }
    await control(shotKey,false);
    const release=await page.evaluate(()=>{
      const app=window.__hokyz;app.input.poll();
      const events=app.view.sim.step({0:app.input.simInput()});app.view.afterStep(events);app.view.render(1,0);
      return {shot:events.some(e=>e.type==='shot'),indicatorOn:document.querySelector('.charge-wrap').classList.contains('on')};
    });
    assert.ok(release.shot&&!release.indicatorOn,'Released shot did not fire and clear charge indicator');
    checks.push({chargeRelease:release});
    await page.setViewportSize({width:1280,height:720});
    await page.evaluate(()=>{const app=window.__hokyz;app.meta.textScale=1;app.applyAccessPrefs();});
  }
  // Prepared open-ice start only; pass flight, AI receiving, possession and
  // control transfer below all use the production simulation and keyboard input.
  const passing = await page.evaluate(() => {
    const app = window.__hokyz, st = app.view.sim.st, team = st.teams[0];
    const [passerId, receiverId, thirdId] = team.skaters;
    for (const id of st.order) {
      const sk = st.skaters[id];
      sk.hasPuck = false; sk.controlled = false; sk.charging = false;
      sk.knockdown = 0; sk.pickupCooldown = 0; sk.stumble = 0;
      sk.vel = { x: 0, y: 0 };
      if (!sk.isGoalie) sk.pos = { x: 15, y: 8 };
    }
    const passer = st.skaters[passerId], receiver = st.skaters[receiverId];
    passer.pos = { x: -6, y: 0 }; passer.facing = 0;
    receiver.pos = { x: 0, y: 0.5 }; receiver.vel = { x: 1, y: 0 };
    st.skaters[thirdId].pos = { x: -8, y: 8 };
    passer.hasPuck = true; passer.controlled = true; team.controlledId = passerId;
    team.switchLock = 0;
    Object.assign(st.puck, { owner: passerId, pos: { ...passer.pos }, vel: { x: 0, y: 0 },
      z: 0, vz: 0, isShot: false, saucer: false, passTarget: null });
    app.input.poll();
    return { passerId, receiverId };
  });
  await control('d', true); await control(passKey, true);
  await page.evaluate(() => window.__hokyz.input.poll());
  await control(passKey, false);
  const passEvent = await page.evaluate(() => {
    const app = window.__hokyz;
    app.input.poll();
    const events = app.view.sim.step({ 0: app.input.simInput() });
    app.view.afterStep(events);
    return events.find(event => event.type === 'pass');
  });
  assert.equal(passEvent?.from, passing.passerId, 'Keyboard pass did not release from carrier');
  assert.equal(passEvent?.to, passing.receiverId, 'Keyboard direction selected wrong receiver');
  await control('d', false);
  const reception = await page.evaluate(({ receiverId }) => {
    const app = window.__hokyz, sim = app.view.sim, events = [];
    let ticks = 0;
    while (ticks++ < 120 && sim.st.puck.owner !== receiverId && sim.st.phase === 'play') {
      app.input.poll();
      const next = sim.step({ 0: app.input.simInput() });
      events.push(...next); app.view.afterStep(next);
    }
    app.view.render(1, 0);
    return { ticks, owner: sim.st.puck.owner, controlled: sim.st.teams[0].controlledId,
      switches: events.filter(event => event.type === 'switch') };
  }, passing);
  assert.equal(reception.owner, passing.receiverId, 'Moving AI receiver did not collect the pass');
  assert.equal(reception.controlled, passing.receiverId, 'Reception did not transfer human control');
  assert.ok(reception.switches.some(event => event.to === passing.receiverId), 'No reception switch event');
  await page.screenshot({ path: join(out, 'human-pass-received.png') });
  await control(shotKey, true);
  await page.evaluate(() => {
    const app = window.__hokyz;
    for (let i = 0; i < 18; i++) {
      app.input.poll(); app.view.afterStep(app.view.sim.step({ 0: app.input.simInput() }));
    }
  });
  await control(shotKey, false);
  const followupShot = await page.evaluate(() => {
    const app = window.__hokyz;
    app.input.poll();
    const events = app.view.sim.step({ 0: app.input.simInput() });
    app.view.afterStep(events);
    return events.find(event => event.type === 'shot');
  });
  assert.equal(followupShot?.shooter, passing.receiverId, 'Shoot input did not reach the new controlled receiver');
  writeFileSync(join(out, 'human-passing.json'), JSON.stringify({ passing, passEvent, reception, followupShot }, null, 2));
  checks.push('Pass to moving AI receiver, automatic control switch and follow-up shot without resetting possession');
  // Isolate shot direction from contact/possession changes in a prepared fixture.
  await page.evaluate(() => {
    const app = window.__hokyz, st = app.view.sim.st;
    const sk = st.skaters[st.teams[0].controlledId];
    for (const id of st.order) { st.skaters[id].hasPuck = false; st.skaters[id].pos = { x: -15, y: 10 }; }
    sk.pos = { x: 12, y: 0 }; sk.vel = { x: 0, y: 0 }; sk.facing = 0;
    sk.hasPuck = true; sk.charging = true; sk.shotCharge = 0.8;
    st.puck.owner = sk.id; st.puck.pos = { ...sk.pos };
    app.input.poll();
  });
  await control('s', true);
  await control('ArrowUp', true);
  await control(shotKey, true);
  await page.evaluate(() => window.__hokyz.input.poll());
  await control(shotKey, false);
  const shot = await page.evaluate(() => {
    const app = window.__hokyz;
    app.input.poll();
    return app.view.sim.step({ 0: app.input.simInput() }).find((event) => event.type === 'shot');
  });
  assert.ok(shot?.zone.startsWith('far-'), `Aim controls ignored: ${JSON.stringify(shot)}`);
  await control('s', false); await control('ArrowUp', false);
  checks.push('Shot aims far while skating near in prepared possession fixture');
  await control('p', true);
  await page.evaluate(() => { const app = window.__hokyz; app.input.poll(); app.onTick(); });
  await control('p', false);
  assert.equal(await page.getByRole('button', { name: 'Resume', exact: true }).count(), 1);
  if (gamepad) {
    await page.evaluate(() => window.__hokyz.input.poll());
    await control('p', true);
    await page.evaluate(() => { const app = window.__hokyz; app.input.poll(); app.onTick(); });
    await control('p', false);
  } else await page.getByRole('button', { name: 'Resume', exact: true }).click();
  assert.equal(await page.evaluate(() => window.__hokyz.paused), false);
  checks.push('Pause and resume work in a human match');
} catch (error) {
  errors.push(String(error));
  if (page) {
    await page.screenshot({ path: join(out, 'failure.png') }).catch(() => {});
    const state = await page.evaluate(() => ({ screen: document.getElementById('ui')?.textContent,
      savedRun: localStorage.getItem('hokyz.run.v1'), run: window.__hokyz?.run })).catch(() => null);
    writeFileSync(join(out, 'failure-state.json'), JSON.stringify(state, null, 2));
  }
}
finally {
  await browser?.close();
  if (server) await new Promise((resolve) => server.httpServer.close(resolve));
}
writeFileSync(join(out, 'report.json'), JSON.stringify({ pass: !errors.length, checks, errors,
  matchInput: gamepad ? 'Synthetic standard gamepad, production polling' : 'Browser keyboard',
  scope: 'Built WebGL game, keyboard/menu interactions and fixed-step human match fixtures; not a full run or hardware performance test' }, null, 2) + '\n');
console.log(`${errors.length ? 'FAIL' : 'PASS'} browser playtest: ${out}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
