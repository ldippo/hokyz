import type { App } from '../../app';
import { btn, esc, h } from '../dom';
import type { MapNode } from '../../run/mapGen';
import { applyMatchOutcome, buildMatch, completeNode, type MatchOutcome } from '../../run/runState';
import { MatchSim } from '../../sim/match';
import { PERK_BY_ID } from '../../run/perks';
import { runMapScreen } from './runMap';
import { draftScreen } from './draft';
import { runOverScreen } from './runOver';
import { titleScreen } from './title';
import { sfx } from '../../audio/sfx';
import { RIVAL_BY_ID } from '../../run/teams';
import { MUTATOR_BY_ID } from '../../run/mutators';
import { Nav } from '../nav';

export function matchIntroScreen(app: App, node: MapNode): void {
  const run = app.run!;
  const bundle = buildMatch(run, node);
  app.saveRun();
  const rival = RIVAL_BY_ID[bundle.away.rivalId];
  const mut = node.mutatorId ? MUTATOR_BY_ID[node.mutatorId] : null;
  const diffName = ['ROOKIE', 'PRO', 'ALL-STAR', 'BRUTAL'][bundle.away.difficulty];
  const el = h('div', { class: 'screen transparent' },
    h('h2', { class: 'screen-title' }, node.type === 'boss' ? '👑 BOSS FIGHT' : node.type === 'elite' ? '💀 ELITE MATCH' : 'NEXT MATCH'),
    h('div', { class: 'matchup' },
      h('div', { class: 'team' }, h('div', { class: 'tn', style: `color:${bundle.home.color}` }, esc(run.teamName)), h('div', { class: 'gimmick' }, `${bundle.home.skaters.map((s) => s.name.split(' ')[0]).join(' · ')}`)),
      h('div', { class: 'vs' }, 'VS'),
      h('div', { class: 'team' }, h('div', { class: 'tn', style: `color:${bundle.away.color}` }, esc(rival.name)), h('div', { class: 'gimmick' }, rival.gimmick)),
    ),
    h('div', {}, h('span', { class: 'mod-tag' }, `AI: ${diffName}`), mut ? h('span', { class: 'mod-tag', title: mut.desc }, `MUTATOR: ${mut.name} — ${mut.desc}`) : null, run.flags.easyNext ? h('span', { class: 'mod-tag' }, 'REF BRIBED') : null, run.flags.hardNext ? h('span', { class: 'mod-tag' }, 'REF ANGRY') : null),
    h('div', { class: 'menu' }, btn('Drop the Puck', () => startRunMatch(app, node, bundle), 'primary'), btn('Back to Map', () => runMapScreen(app))),
  );
  const nav = app.showScreen(el);
  if (nav) nav.onBack = () => runMapScreen(app);
}

function startRunMatch(app: App, node: MapNode, bundle: ReturnType<typeof buildMatch>): void {
  const run = app.run!;
  const sim = new MatchSim(
    [
      { name: bundle.home.name, short: bundle.home.short, color: bundle.home.color, skaters: bundle.home.skaters, goalie: bundle.home.goalie, isHuman: true, difficulty: 2 },
      { name: bundle.away.name, short: bundle.away.short, color: bundle.away.color, skaters: bundle.away.skaters, goalie: bundle.away.goalie, isHuman: false, difficulty: bundle.away.difficulty },
    ],
    bundle.mods,
    bundle.seed,
  );
  const perkNames = run.perks.map((id) => `${PERK_BY_ID[id]?.icon ?? ''} ${PERK_BY_ID[id]?.name ?? id}`);
  playMatch(app, sim, perkNames, (outcome) => {
    const res = applyMatchOutcome(run, node, outcome);
    app.meta.totalGoals += outcome.scoreFor;
    app.meta.totalBigHits += outcome.bigHits;
    app.saveMeta();
    if (!res.ended) completeNode(run, node);
    app.saveRun();
    matchResultScreen(app, node, outcome, res);
  });
}

/** Runs a match with the human on team 0. Calls done() with outcome after final whistle + confirm. */
export function playMatch(app: App, sim: MatchSim, perkNames: string[], done: (o: MatchOutcome) => void): void {
  app.showScreen(null);
  app.startView(sim, true, perkNames);
  let finished = false;
  let pauseEl: HTMLElement | null = null;
  const closePause = () => {
    pauseEl?.remove();
    pauseEl = null;
    app.nav = null;
    app.paused = false;
  };
  const openPause = () => {
    app.paused = true;
    pauseEl = h('div', { class: 'pause' },
      h('h2', { class: 'screen-title' }, 'PAUSED'),
      h('div', { class: 'menu' },
        btn('Resume', () => closePause(), 'primary'),
        btn('Forfeit Match', () => {
          closePause();
          finished = true;
          const st = sim.st;
          st.teams[1].score = Math.max(st.teams[1].score, st.teams[0].score + 1);
          st.phase = 'over';
          st.winner = 1;
          finish();
        }),
      ),
    );
    app.ui.appendChild(pauseEl);
    app.screen = null;
    const nav = new Nav(pauseEl);
    app.nav = nav;
    nav.focusFirst();
    nav.onBack = () => closePause();
  };
  const finish = () => {
    app.onTick = null;
    const st = sim.st;
    const hp: Record<string, number> = {};
    for (const id of st.teams[0].skaters) hp[id] = st.skaters[id].hp;
    const outcome: MatchOutcome = {
      won: st.winner === 0,
      scoreFor: st.teams[0].score,
      scoreAgainst: st.teams[1].score,
      bigHits: st.stats.bigHits[0],
      hp,
      boxScore: st.order.map((id) => {
        const s = st.skaters[id];
        return { id, name: s.name, team: s.team, goals: s.goals, assists: s.assists, hits: s.hits, bigHits: s.bigHits, shots: s.shots, saves: s.saves, isGoalie: s.isGoalie };
      }),
    };
    app.disposeView();
    done(outcome);
  };
  let overSince = -1;
  app.onTick = () => {
    if (finished) return;
    if (app.paused) {
      if (app.input.justPressed('pause')) closePause();
      return;
    }
    if (app.input.justPressed('pause') || app.input.justPressed('back')) {
      openPause();
      return;
    }
    if (sim.st.phase === 'over') {
      if (overSince < 0) overSince = sim.st.t;
      if (sim.st.t - overSince > 2.2 && (app.input.justPressed('confirm') || app.input.justPressed('pass') || app.input.justPressed('shoot'))) {
        finished = true;
        finish();
      } else if (sim.st.t - overSince > 2.2 && !app.view!.hud.root.querySelector('.toast')) {
        app.view!.hud.root.appendChild(h('div', { class: 'toast' }, 'PRESS J / ENTER / A TO CONTINUE'));
      }
    }
  };
}

export function matchResultScreen(app: App, node: MapNode, outcome: MatchOutcome, res: { cash: number; ended: boolean; usedLife: boolean }): void {
  const run = app.run!;
  const rows = outcome.boxScore.map((b) =>
    h('tr', { style: `color:${b.team === 0 ? '#fff' : '#c8d4f0'}` },
      h('td', {}, `${b.team === 0 ? '🔵' : '🔴'} ${b.name}${b.isGoalie ? ' (G)' : ''}`),
      h('td', { class: 'num' }, String(b.goals)), h('td', { class: 'num' }, String(b.assists)), h('td', { class: 'num' }, String(b.shots)), h('td', { class: 'num' }, String(b.hits)), h('td', { class: 'num' }, String(b.bigHits)), h('td', { class: 'num' }, String(b.saves)),
    ),
  );
  const injured = run.roster.filter((s) => s.hp <= 20);
  const el = h('div', { class: 'screen' },
    h('div', { class: 'result' },
      h('h2', { class: outcome.won ? 'win' : 'lose' }, outcome.won ? 'VICTORY' : res.usedLife ? 'SECOND WIND' : 'RUN OVER'),
      h('div', { class: 'score-line' }, `${run.teamShort} ${outcome.scoreFor} — ${outcome.scoreAgainst} ${RIVAL_BY_ID[node.rivalId!]?.short ?? 'OPP'}`),
      res.cash ? h('div', { style: 'font-family:var(--font-display);font-size:24px;color:var(--gold);margin-bottom:12px' }, `+${res.cash} CASH`) : null,
      res.usedLife ? h('p', { class: 'screen-sub' }, 'Second Wind burned. You live to skate again.') : null,
      injured.length ? h('p', { class: 'screen-sub', style: 'color:#f66' }, `INJURED: ${injured.map((s) => s.name).join(', ')} — out until healed`) : null,
      h('table', { class: 'box' }, h('thead', {}, h('tr', {}, h('th', {}, 'PLAYER'), h('th', {}, 'G'), h('th', {}, 'A'), h('th', {}, 'SOG'), h('th', {}, 'HITS'), h('th', {}, 'BIG'), h('th', {}, 'SV'))), h('tbody', {}, ...rows)),
      h('div', { class: 'menu' },
        btn(res.ended ? 'See Run Summary' : outcome.won ? 'Draft a Perk' : 'Back to Map', () => {
          if (res.ended) runOverScreen(app);
          else if (outcome.won) draftScreen(app, node);
          else runMapScreen(app);
        }, 'primary'),
      ),
    ),
  );
  sfx.cash();
  app.showScreen(el);
  void titleScreen;
}
