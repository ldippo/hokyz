import type { App } from '../../app';
import { btn, esc, h } from '../dom';
import type { MapNode } from '../../run/mapGen';
import { completeNode, draftPerks, lineup, runEffects, runRng, commitRng, nodeTier } from '../../run/runState';
import { MatchSim } from '../../sim/match';
import { defaultMatchMods } from '../../sim/modifiers';
import { RIVAL_BY_ID, buildRivalRoster } from '../../run/teams';
import { generateSkater } from '../../run/roster';
import { runMapScreen } from './runMap';
import { playMatch } from './match';
import { perkCard } from './draft';
import { sfx } from '../../audio/sfx';
import { EMPTY_INPUT, type Input } from '../../sim/types';
import { setControlled } from '../../sim/puck';

const HIT_PARADE_TIME = 60;
const hitTarget = (act: number) => [8, 12, 16][Math.min(2, act - 1)];

export function skillsScreen(app: App, node: MapNode): void {
  const run = app.run!;
  const isShootout = node.type === 'shootout';
  const rival = RIVAL_BY_ID[node.rivalId ?? 'bruisers'];
  const reward = Math.round((isShootout ? 70 : 60) * runEffects(run).cashMul);
  const el = h('div', { class: 'screen transparent' },
    h('h2', { class: 'screen-title' }, isShootout ? '🥅 SHOOTOUT DUEL' : '💥 HIT PARADE'),
    h('p', { class: 'screen-sub' }, isShootout ? `Best of 3 vs ${esc(rival.name)}. Aim, deke, dive.` : `${HIT_PARADE_TIME} seconds. Knock down ${hitTarget(run.act)} dummies. Big hits count double.`),
    h('div', { style: 'margin:14px 0' }, h('span', { class: 'mod-tag' }, `WIN: +${reward} CASH + PERK DRAFT`), h('span', { class: 'mod-tag' }, 'LOSE: NOTHING LOST')),
    h('div', { class: 'menu' }, btn(isShootout ? 'Take the Shot' : 'Drop the Gloves', () => (isShootout ? startShootout(app, node, reward) : startHitParade(app, node, reward)), 'primary'), btn('Back to Map', () => runMapScreen(app))),
  );
  const nav = app.showScreen(el);
  if (nav) nav.onBack = () => runMapScreen(app);
}

function startShootout(app: App, node: MapNode, reward: number): void {
  const run = app.run!;
  const rng = runRng(run);
  const rival = RIVAL_BY_ID[node.rivalId ?? 'bruisers'];
  const opp = buildRivalRoster(rng, rival, nodeTier(run, node));
  commitRng(run, rng);
  const mods = defaultMatchMods();
  mods.shootoutOnly = true;
  mods.shootoutRounds = 3;
  rival.mods?.(mods.teams[1]);
  const sim = new MatchSim(
    [
      { name: run.teamName, short: run.teamShort, color: run.teamColor, skaters: lineup(run), goalie: run.goalie, isHuman: true, difficulty: 2, logo: run.teamLogo },
      { name: rival.name, short: rival.short, color: rival.color, skaters: opp.skaters, goalie: opp.goalie, isHuman: false, difficulty: Math.min(3, run.act) },
    ],
    mods,
    rng.int(1, 1e9),
  );
  playMatch(app, sim, [], (outcome) => {
    const g = sim.st.shootout?.goals;
    finishSkills(app, node, outcome.won, g ? `${g[0]} - ${g[1]}` : `${outcome.scoreFor} - ${outcome.scoreAgainst}`, reward);
  });
}

function startHitParade(app: App, node: MapNode, reward: number): void {
  const run = app.run!;
  const rng = runRng(run);
  const dummies = [0, 1, 2].map(() => generateSkater(rng, 'speedster', 0, 'dummy'));
  dummies.forEach((d) => (d.stats.balance = 3));
  commitRng(run, rng);
  const mods = defaultMatchMods();
  mods.noGoalies = true;
  mods.noFights = true;
  mods.periodLength = 9999;
  const sim = new MatchSim(
    [
      { name: run.teamName, short: run.teamShort, color: run.teamColor, skaters: lineup(run), goalie: null, isHuman: true, difficulty: 2, scripted: true, logo: run.teamLogo },
      { name: 'Dummies', short: 'DUMMY', color: '#8a8f99', skaters: dummies, goalie: null, isHuman: false, difficulty: 0, scripted: true },
    ],
    mods,
    rng.int(1, 1e9),
  );
  sim.freezeClock = true;
  const st = sim.st;
  st.phase = 'play';
  app.showScreen(null);
  const view = app.startView(sim, true, []);
  view.hud.showClock(false);
  const me = st.skaters[st.teams[0].skaters[0]];
  setControlled(st, 0, me.id, []);
  // teammates park
  st.teams[0].skaters.slice(1).forEach((id, i) => {
    const s = st.skaters[id];
    s.pos.x = -10 - i * 1.5;
    s.pos.y = 15.5;
  });
  const target = hitTarget(run.act);
  let score = 0;
  let t = 0;
  let done = false;
  const wander = new Map<string, { x: number; y: number; until: number }>();
  const finish = () => {
    if (done) return;
    done = true;
    app.onTick = null;
    const won = score >= target;
    app.disposeView();
    finishSkills(app, node, won, `${score} / ${target}`, reward);
  };
  app.onTick = () => {
    if (done) return;
    t += 1 / 60;
    if (app.input.justPressed('pause')) {
      finish();
      return;
    }
    // dummies wander; knocked-down ones get up and keep going
    for (const id of st.teams[1].skaters) {
      const d = st.skaters[id];
      let w = wander.get(id);
      if (!w || t > w.until || Math.abs(d.pos.x) > 18 || Math.abs(d.pos.y) > 9) {
        w = { x: (Math.random() - 0.5) * 30, y: (Math.random() - 0.5) * 14, until: t + 1.5 + Math.random() * 2 };
        wander.set(id, w);
      }
      const inp: Input = { ...EMPTY_INPUT, move: { x: w.x - d.pos.x, y: w.y - d.pos.y }, aim: { x: 0, y: 0 }, turbo: Math.random() < 0.3 };
      sim.scriptInputs.set(id, inp);
      if (st.puck.owner === id) d.hasPuck = false, (st.puck.owner = null);
    }
    if (st.teams[0].controlledId !== me.id) setControlled(st, 0, me.id, []);
    for (const e of view.lastEvents) {
      if (e.type === 'hit' && e.hitter === me.id) {
        const pts = e.big ? 2 : st.skaters[e.victim].knockdown > 0 ? 1 : 0;
        if (pts) {
          score += pts;
          view.hud.announce(`+${pts}`, e.big ? 'fire' : 'gold', `${score} / ${target}`);
        }
      }
    }
    const left = Math.max(0, HIT_PARADE_TIME - t);
    view.hud.prompt(`${score} / ${target}   ·   ${left.toFixed(0)}s`, 0.2, score >= target ? '' : 'quiet');
    if (left <= 0) finish();
  };
  view.hud.announce('HIT PARADE', 'red', `KNOCK DOWN ${target}`);
  sfx.whistle();
}

function finishSkills(app: App, node: MapNode, won: boolean, line: string, reward: number): void {
  const run = app.run!;
  if (won) run.cash += reward;
  completeNode(run, node);
  app.saveRun();
  app.attract();
  const picks = won ? draftPerks(run, 3, 0) : [];
  const el = h('div', { class: 'screen transparent' },
    h('div', { class: 'result' },
      h('h2', { class: won ? 'win' : 'lose' }, won ? 'CHALLENGE CLEARED' : 'NOT THIS TIME'),
      h('div', { class: 'score-line' }, line),
      won ? h('div', { style: 'font-family:var(--font-display);font-size:24px;color:var(--gold);margin-bottom:12px' }, `+${reward} CASH · PICK A PERK`) : h('p', { class: 'screen-sub' }, 'No penalty. Skills nodes only give.'),
      won ? h('div', { class: 'cards' }, ...picks.map((p) => perkCard(p, () => { run.perks.push(p.id); sfx.cash(); app.saveRun(); runMapScreen(app); }, undefined, false, run.perks))) : null,
      h('div', { class: 'menu' }, btn(won ? 'Skip perk' : 'Back to Map', () => runMapScreen(app), won ? '' : 'primary')),
    ),
  );
  if (won) sfx.cash();
  app.showScreen(el);
}
