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
    localStorage.setItem('hokyz.meta.v1', JSON.stringify({ quality: 'low', cinematics: false, music: false }));
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
  await page.keyboard.down('k');
  await page.evaluate(() => window.__hokyz.input.poll());
  await page.keyboard.up('k');
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
