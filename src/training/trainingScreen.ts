import type { App } from '../app';
import { btn, h } from '../ui/dom';
import { MatchSim } from '../sim/match';
import { defaultMatchMods } from '../sim/modifiers';
import { quickSkater, stats } from '../sim/fixtures';
import { Nav } from '../ui/nav';
import { sfx } from '../audio/sfx';
import { DRILLS, type DrillCtx } from './drills';
import type { Vec2 } from '../sim/types';
import { setControlled } from '../sim/puck';
import { titleScreen } from '../ui/screens/title';

/** Renders "[K]" style glyphs as kbd chips. */
function glyphs(text: string): string {
  return text.replace(/\[([^\]]+)\]/g, '<kbd>$1</kbd>');
}

export function trainingScreen(app: App): void {
  const home = {
    skaters: [quickSkater('T1', 'You', 'sniper', stats(7, 7, 7, 6, 6, 7)), quickSkater('T2', 'Coach Sully', 'playmaker', stats(6, 6, 9, 4, 5, 7)), quickSkater('T3', 'Bench', 'enforcer', stats(5, 5, 4, 8, 8, 6))],
    goalie: quickSkater('TG', 'Wall', 'goalie', stats(5, 3, 7, 4, 8, 6)),
  };
  const dummies = {
    skaters: [quickSkater('D1', 'Dummy Dan', 'enforcer', stats(5, 5, 5, 6, 4, 6)), quickSkater('D2', 'Dummy Deb', 'speedster', stats(5, 5, 5, 4, 4, 6)), quickSkater('D3', 'Dummy Doug', 'sniper', stats(5, 5, 5, 4, 4, 6))],
  };
  const mods = defaultMatchMods();
  mods.noFights = true;
  mods.periodLength = 9999;
  const sim = new MatchSim(
    [
      { name: 'Training Camp', short: 'CAMP', color: '#2f6bff', skaters: home.skaters, goalie: home.goalie, isHuman: true, difficulty: 0, scripted: true },
      { name: 'Dummies', short: 'DUMMY', color: '#8a8f99', skaters: dummies.skaters, goalie: null, isHuman: false, difficulty: 0, scripted: true },
    ],
    mods,
    42,
  );
  sim.freezeClock = true;
  const st = sim.st;
  // jump straight to play
  st.phase = 'play';
  st.phaseTimer = 0;
  app.showScreen(null);
  const view = app.startView(sim, true, []);
  view.shakeMul = app.meta.screenShake === false ? 0 : 1;
  view.hud.showClock(false);
  const me = st.skaters['T1'];
  const mate = st.skaters['T2'];
  const bench = st.skaters['T3'];
  bench.pos.x = -24;
  bench.pos.y = 11;
  setControlled(st, 0, me.id, []);

  let idx = 0;
  let drillT = 0;
  let hintShown = false;
  let done = false;
  const ctx: DrillCtx = {
    sim,
    st,
    me,
    mate,
    dummies: st.teams[1].skaters.map((id) => st.skaters[id]),
    goalie: st.teams[0].goalie ? st.skaters[st.teams[0].goalie] : null,
    t: 0,
    events: [],
    marker: (p: Vec2 | null) => view.setMarker(p),
  };

  // overlay
  const title = h('div', { class: 'drill-title' }, '');
  const text = h('div', { class: 'drill-text' }, '');
  const prog = h('div', { class: 'drill-prog' }, '');
  const panel = h('div', { class: 'drill' }, prog, title, text, h('div', { class: 'drill-btns' }, btn('Skip drill', () => advance(true)), btn('Leave camp', () => finish(false))));
  app.ui.appendChild(panel);
  const nav = new Nav(panel);
  app.nav = null; // keyboard nav would eat gameplay keys; buttons are mouse/click only
  void nav;

  const startDrill = () => {
    const d = DRILLS[idx];
    drillT = 0;
    hintShown = false;
    ctx.t = 0;
    for (const k of Object.keys(ctx)) if (!['sim', 'st', 'me', 'mate', 'dummies', 'goalie', 't', 'events', 'marker'].includes(k)) delete (ctx as unknown as Record<string, unknown>)[k];
    sim.scriptInputs.clear();
    st.teams[0].special = 0;
    d.setup(ctx);
    prog.textContent = `DRILL ${idx + 1} / ${DRILLS.length}`;
    title.textContent = d.title;
    text.innerHTML = glyphs(app.input.fill(d.text));
    view.hud.announce(d.title, 'gold', `DRILL ${idx + 1}`);
    sfx.whistle();
  };
  const advance = (skipped: boolean) => {
    if (done) return;
    if (!skipped) {
      view.hud.announce('NICE!', 'gold');
      sfx.cash();
    }
    idx++;
    if (idx >= DRILLS.length) finish(true);
    else startDrill();
  };
  const finish = (completed: boolean) => {
    if (done) return;
    done = true;
    app.onTick = null;
    panel.remove();
    view.setMarker(null);
    const first = !app.meta.trainingDone;
    if (completed) {
      app.meta.trainingDone = true;
      if (first) app.meta.cash += 50;
      app.saveMeta();
    }
    app.disposeView();
    app.attract();
    const el = h('div', { class: 'screen transparent' },
      h('h2', { class: 'screen-title' }, completed ? 'CAMP COMPLETE' : 'CAMP LEFT EARLY'),
      h('p', { class: 'screen-sub' }, completed ? (first ? 'You know the verbs now. +50 bank cash for graduating.' : 'Sharp as ever.') : 'Come back any time from the title screen.'),
      h('div', { class: 'menu' }, btn('Back to Title', () => titleScreen(app), 'primary')),
    );
    app.showScreen(el);
  };

  app.onTick = () => {
    if (done) return;
    if (app.input.justPressed('pause') || app.input.justPressed('back')) {
      finish(false);
      return;
    }
    const dt = 1 / 60;
    drillT += dt;
    ctx.t = drillT;
    ctx.events = view.lastEvents;
    // keep control on the trainee unless the goalie is mid-dive
    const team = st.teams[0];
    const g = ctx.goalie;
    if (team.controlledId !== me.id && !(g && team.controlledId === g.id && g.dive > 0)) setControlled(st, 0, me.id, []);
    // keep the sim in play (goals trigger celebrations → faceoffs; let those run, then re-setup)
    if (st.phase === 'faceoff') {
      st.phase = 'play';
      st.phaseTimer = 0;
      DRILLS[idx].setup(ctx);
    }
    const d = DRILLS[idx];
    if (d.tick(ctx)) advance(false);
    else if (d.hint && !hintShown && drillT > 12) {
      hintShown = true;
      view.hud.prompt(d.hint, 4, 'quiet');
    }
  };
  (window as unknown as { __training: unknown }).__training = { get idx() { return idx; }, skip: () => advance(true), complete: () => advance(false), ctx };
  startDrill();
}
