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
  await page.keyboard.down('d');
  const movedX = await page.evaluate(() => {
    const app = window.__hokyz, sim = app.view.sim;
    app.input.poll();
    for (let i = 0; i < 30; i++) app.view.afterStep(sim.step({ 0: app.input.simInput() }));
    app.view.render(1, 0);
    return sim.st.skaters[sim.st.teams[0].controlledId].pos.x;
  });
  await page.keyboard.up('d');
  assert.ok(movedX > movement.x + 0.1, 'Human movement did not move the skater');
  checks.push('Real keyboard input moves the human skater in a fixed-step match');
  await page.screenshot({ path: join(out, 'human-match.png') });
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
  await page.keyboard.down('d'); await page.keyboard.down(passKey);
  await page.evaluate(() => window.__hokyz.input.poll());
  await page.keyboard.up(passKey);
  const passEvent = await page.evaluate(() => {
    const app = window.__hokyz;
    app.input.poll();
    const events = app.view.sim.step({ 0: app.input.simInput() });
    app.view.afterStep(events);
    return events.find(event => event.type === 'pass');
  });
  assert.equal(passEvent?.from, passing.passerId, 'Keyboard pass did not release from carrier');
  assert.equal(passEvent?.to, passing.receiverId, 'Keyboard direction selected wrong receiver');
  await page.keyboard.up('d');
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
  await page.keyboard.down(shotKey);
  await page.evaluate(() => {
    const app = window.__hokyz;
    for (let i = 0; i < 18; i++) {
      app.input.poll(); app.view.afterStep(app.view.sim.step({ 0: app.input.simInput() }));
    }
  });
  await page.keyboard.up(shotKey);
  const followupShot = await page.evaluate(() => {
    const app = window.__hokyz;
    app.input.poll();
    const events = app.view.sim.step({ 0: app.input.simInput() });
    app.view.afterStep(events);
    return events.find(event => event.type === 'shot');
  });
  assert.equal(followupShot?.shooter, passing.receiverId, 'Shoot input did not reach the new controlled receiver');
  writeFileSync(join(out, 'human-passing.json'), JSON.stringify({ passing, passEvent, reception, followupShot }, null, 2));
  checks.push('Keyboard pass to moving AI receiver, automatic control switch and follow-up shot without resetting possession');
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
  await page.keyboard.down('s');
  await page.keyboard.down('ArrowUp');
  await page.keyboard.down(shotKey);
  await page.evaluate(() => window.__hokyz.input.poll());
  await page.keyboard.up(shotKey);
  const shot = await page.evaluate(() => {
    const app = window.__hokyz;
    app.input.poll();
    return app.view.sim.step({ 0: app.input.simInput() }).find((event) => event.type === 'shot');
  });
  assert.ok(shot?.zone.startsWith('far-'), `Aim controls ignored: ${JSON.stringify(shot)}`);
  await page.keyboard.up('s'); await page.keyboard.up('ArrowUp');
  checks.push('Keyboard shot aims far while skating near in prepared possession fixture');
  await page.keyboard.press('p');
  await page.evaluate(() => { const app = window.__hokyz; app.input.poll(); app.onTick(); });
  assert.equal(await page.getByRole('button', { name: 'Resume', exact: true }).count(), 1);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
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
  scope: 'Built WebGL game, keyboard/menu interactions and fixed-step human match fixtures; not a full run or hardware performance test' }, null, 2) + '\n');
console.log(`${errors.length ? 'FAIL' : 'PASS'} browser playtest: ${out}`);
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
