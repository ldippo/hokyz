import type { App } from '../../app';
import { btn, esc, h } from '../dom';
import type { MapNode } from '../../run/mapGen';
import { applyMatchOutcome, buildMatch, previewMatch, completeNode, prepareDraft, type MatchOutcome } from '../../run/runState';
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
import { awardFeats } from '../../run/feats';
import type { MetaProfile } from '../../run/meta';

export function matchIntroScreen(app: App, node: MapNode): void {
  const run = app.run!;
  const { bundle, rngState } = previewMatch(run, node);
  app.saveRun();
  const rival = RIVAL_BY_ID[bundle.away.rivalId];
  const mut = node.mutatorId ? MUTATOR_BY_ID[node.mutatorId] : null;
  const diffName = ['ROOKIE', 'PRO', 'ALL-STAR', 'BRUTAL'][bundle.away.difficulty];
  const el = h('div', { class: 'screen match-intro' }, h('div', { class: 'match-intro-content' },
    h('h2', { class: 'screen-title' }, node.type === 'boss' ? '👑 BOSS FIGHT' : node.type === 'elite' ? '💀 ELITE MATCH' : 'NEXT MATCH'),
    bundle.away.taunt ? h('div', { class: 'taunt' }, `“${bundle.away.taunt}”`, h('span', {}, ` — GRUDGE MATCH · +${bundle.away.grudge * 50}% BOUNTY · TIER +${Math.min(2, bundle.away.grudge)}`)) : null,
    h('div', { class: 'matchup' },
      h('div', { class: 'team' }, h('div', { class: 'tn', style: `color:${bundle.home.color}` }, esc(run.teamName)), h('div', { class: 'gimmick' }, `${bundle.home.skaters.map((s) => s.name.split(' ')[0]).join(' · ')}`)),
      h('div', { class: 'vs' }, 'VS'),
      h('div', { class: 'team' }, h('div', { class: 'tn', style: `color:${bundle.away.color}` }, esc(rival.name)), h('div', { class: 'gimmick' }, rival.gimmick)),
    ),
    h('div', {}, h('span', { class: 'mod-tag' }, `AI: ${diffName}`), mut ? h('span', { class: 'mod-tag', title: mut.desc }, `MUTATOR: ${mut.name} — ${mut.desc}`) : null, run.flags.easyNext ? h('span', { class: 'mod-tag' }, 'REF BRIBED') : null, run.flags.hardNext ? h('span', { class: 'mod-tag' }, 'REF ANGRY') : null),
    bundle.mods.bossPhases.length ? h('div', { style: 'max-width:640px;margin-top:10px' }, ...bundle.mods.bossPhases.map((p) => h('div', { class: 'perk-chip epic', style: 'margin-top:6px' }, h('b', {}, `👑 ${p.label}`), h('div', {}, p.desc)))) : null,
    h('div', { class: 'menu' }, btn('Drop the Puck', () => {
      run.rngState = rngState;
      app.saveRun();
      startRunMatch(app, node, bundle);
    }, 'primary'), btn('Back to Map', () => runMapScreen(app))),
  ));
  const nav = app.showScreen(el);
  if (nav) nav.onBack = () => runMapScreen(app);
}

function startRunMatch(app: App, node: MapNode, bundle: ReturnType<typeof buildMatch>): void {
  const run = app.run!;
  const sim = new MatchSim(
    [
      { name: bundle.home.name, short: bundle.home.short, color: bundle.home.color, skaters: bundle.home.skaters, goalie: bundle.home.goalie, isHuman: true, difficulty: 2, logo: bundle.home.logo },
      { name: bundle.away.name, short: bundle.away.short, color: bundle.away.color, skaters: bundle.away.skaters, goalie: bundle.away.goalie, isHuman: false, difficulty: bundle.away.difficulty },
    ],
    bundle.mods,
    bundle.seed,
  );
  const perkNames = run.perks.map((id) => `${PERK_BY_ID[id]?.icon ?? ''} ${PERK_BY_ID[id]?.name ?? id}`);
  playMatch(app, sim, perkNames, (outcome) => {
    const res = applyMatchOutcome(run, node, outcome);
    if (!res.ended) completeNode(run, node);
    if (outcome.won && !res.ended) prepareDraft(run, node);
    const rivalId = node.rivalId ?? 'unknown';
    app.meta.rivalRecord ??= {};
    const rr = (app.meta.rivalRecord[rivalId] ??= { w: 0, l: 0 });
    if (outcome.won) rr.w++;
    else rr.l++;
    const feats = awardFeats(app.meta, { outcome, run, node });
    app.saveMeta();
    app.saveRun();
    if (feats.length) app.toast(`FEAT: ${feats.map((f) => `${f.icon} ${f.name} +${f.reward.cash ?? 0}`).join('  ·  ')}`);
    matchResultScreen(app, node, outcome, res);
  });
}

/** Runs a match with the human on team 0. Calls done() with outcome after final whistle + confirm. */
export function playMatch(app: App, sim: MatchSim, perkNames: string[], done: (o: MatchOutcome) => void): void {
  app.showScreen(null);
  const view = app.startView(sim, true, perkNames);
  view.shakeMul = app.meta.screenShake === false || app.meta.reducedMotion === true ? 0 : 1;
  if (app.meta.cinematics !== false) view.enablePresentation();
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
    const st0 = sim.st;
    const rows = st0.order.map((id) => st0.skaters[id]).filter((s) => !s.ejected).map((s) =>
      h('tr', { style: `color:${s.team === 0 ? '#fff' : '#c8d4f0'}` },
        h('td', {}, `${s.team === 0 ? '🔵' : '🔴'} ${s.name}${s.isGoalie ? ' (G)' : ''}`),
        h('td', { class: 'num' }, String(s.goals)), h('td', { class: 'num' }, String(s.assists)), h('td', { class: 'num' }, String(s.shots)), h('td', { class: 'num' }, String(s.hits)), h('td', { class: 'num' }, String(s.bigHits)), h('td', { class: 'num' }, s.isGoalie ? String(s.saves) : String(s.blocks)),
      ),
    );
    pauseEl = h('div', { class: 'pause' },
      h('h2', { class: 'screen-title' }, 'PAUSED'),
      h('table', { class: 'box', style: 'font-size:13px;min-width:460px' }, h('thead', {}, h('tr', {}, h('th', {}, 'PLAYER'), h('th', {}, 'G'), h('th', {}, 'A'), h('th', {}, 'SOG'), h('th', {}, 'HITS'), h('th', {}, 'BIG'), h('th', {}, 'SV/BLK'))), h('tbody', {}, ...rows)),
      perkNames.length ? h('p', { class: 'small', style: 'max-width:560px;text-align:center;color:#8fa3d9' }, `PERKS · ${perkNames.join(' · ')}`) : null,
      h('div', { class: 'menu', style: 'margin-top:14px' },
        btn('Resume', () => closePause(), 'primary'),
        btn('Photo Mode', () => { void app.snap().then((ok) => app.toast(ok ? 'Photo saved to your downloads' : 'Photo failed')); }),
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
      ...extras,
      shootoutGoals: st.shootout?.stage === 'done' ? [...st.shootout.goals] : undefined,
      boxScore: st.order.map((id) => {
        const s = st.skaters[id];
        return { id, name: s.name, team: s.team, goals: s.goals, assists: s.assists, hits: s.hits, bigHits: s.bigHits, shots: s.shots, saves: s.saves, blocks: s.blocks, isGoalie: s.isGoalie };
      }),
    };
    app.disposeView();
    recordMatch(app.meta, outcome, sim.st.teams[1].name);
    done(outcome);
  };
  const extras = { fightsWon: 0, specialsUsed: 0, ankleBreakers: 0, bigSaves: 0, shootoutWon: false, topCornerGoals: 0, teamFire: false, blocks: 0 };
  let overSince = -1;
  app.onTick = () => {
    if (finished) return;
    for (const e of app.view?.lastEvents ?? []) {
      if (e.type === 'fightEnd' && e.winner && sim.st.skaters[e.winner]?.team === 0) extras.fightsWon++;
      if (e.type === 'special' && sim.st.skaters[e.skater]?.team === 0) extras.specialsUsed++;
      if (e.type === 'ankleBreaker' && sim.st.skaters[e.skater]?.team === 0) extras.ankleBreakers++;
      if (e.type === 'bigSave' && sim.st.skaters[e.goalie]?.team === 0) extras.bigSaves++;
      if (e.type === 'shotBlock' && sim.st.skaters[e.blocker]?.team === 0) extras.blocks++;
      if (e.type === 'shootoutEnd' && e.winner === 0) extras.shootoutWon = true;
      if (e.type === 'goal' && e.team === 0 && e.high) extras.topCornerGoals++;
      if (e.type === 'teamFire' && e.team === 0) extras.teamFire = true;
    }
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
      if (app.view?.director.active) return;
      if (sim.st.t - overSince > 2.2 && (app.input.justPressed('confirm') || app.input.justPressed('pass') || app.input.justPressed('shoot'))) {
        finished = true;
        finish();
      } else if (sim.st.t - overSince > 2.2 && !app.view!.hud.root.querySelector('.toast')) {
        app.view!.hud.root.appendChild(h('div', { class: 'toast' }, 'PRESS J / ENTER / A TO CONTINUE'));
      }
    }
  };
}

/** Meta records + lifetime stats from any match (run or quick). */
export function recordMatch(meta: MetaProfile, outcome: MatchOutcome, opponent: string): void {
  meta.totalGoals += outcome.scoreFor;
  meta.totalBigHits += outcome.bigHits;
  meta.totalFightsWon = (meta.totalFightsWon ?? 0) + (outcome.fightsWon ?? 0);
  meta.totalTopCorner = (meta.totalTopCorner ?? 0) + (outcome.topCornerGoals ?? 0);
  meta.totalAnkle = (meta.totalAnkle ?? 0) + (outcome.ankleBreakers ?? 0);
  meta.totalSpecials = (meta.totalSpecials ?? 0) + (outcome.specialsUsed ?? 0);
  meta.totalBlocks = (meta.totalBlocks ?? 0) + (outcome.blocks ?? 0);
  meta.totalShootoutWins = (meta.totalShootoutWins ?? 0) + (outcome.shootoutWon ? 1 : 0);
  meta.bestGoalsMatch = Math.max(meta.bestGoalsMatch ?? 0, outcome.scoreFor);
  meta.bestBigHitsMatch = Math.max(meta.bestBigHitsMatch ?? 0, outcome.bigHits);
  void opponent;
}

export function matchResultScreen(app: App, node: MapNode, outcome: MatchOutcome, res: { cash: number; ended: boolean; usedLife: boolean }): void {
  const run = app.run!;
  const rows = outcome.boxScore.map((b) =>
    h('tr', { style: `color:${b.team === 0 ? '#fff' : '#c8d4f0'}` },
      h('td', {}, `${b.team === 0 ? '🔵' : '🔴'} ${b.name}${b.isGoalie ? ' (G)' : ''}`),
      h('td', { class: 'num' }, String(b.goals)), h('td', { class: 'num' }, String(b.assists)), h('td', { class: 'num' }, String(b.shots)), h('td', { class: 'num' }, String(b.hits)), h('td', { class: 'num' }, String(b.bigHits)), h('td', { class: 'num' }, b.isGoalie ? String(b.saves) : String(b.blocks ?? 0)),
    ),
  );
  const injured = run.roster.filter((s) => s.hp <= 20);
  const mvp = [...outcome.boxScore].sort((x, y) => (y.goals * 3 + y.assists * 2 + y.bigHits * 2 + y.hits * 0.3 + y.saves * 0.6 + (y.blocks ?? 0) * 0.8) - (x.goals * 3 + x.assists * 2 + x.bigHits * 2 + x.hits * 0.3 + x.saves * 0.6 + (x.blocks ?? 0) * 0.8))[0];
  const el = h('div', { class: 'screen' },
    h('div', { class: 'result' },
      h('h2', { class: outcome.won ? 'win' : 'lose' }, outcome.won ? 'VICTORY' : res.usedLife ? 'SECOND WIND' : 'RUN OVER'),
      h('div', { class: 'score-line' }, `${run.teamShort} ${outcome.scoreFor} — ${outcome.scoreAgainst} ${RIVAL_BY_ID[node.rivalId!]?.short ?? 'OPP'}`),
      outcome.shootoutGoals ? h('p', { class: 'result-description shootout-summary' },
        `Shootout: ${run.teamShort} ${outcome.shootoutGoals[0]} : ${outcome.shootoutGoals[1]} ${RIVAL_BY_ID[node.rivalId!]?.short ?? 'OPP'}. `,
        'Winner receives one deciding point. Player goals and assists exclude shootout attempts.',
      ) : null,
      res.cash ? h('div', { style: 'font-family:var(--font-display);font-size:24px;color:var(--gold);margin-bottom:12px' }, `+${res.cash} CASH`) : null,
      res.usedLife ? h('p', { class: 'screen-sub' }, 'Second Wind burned. You live to skate again.') : null,
      injured.length ? h('p', { class: 'screen-sub', style: 'color:#f66' }, `INJURED: ${injured.map((s) => s.name).join(', ')} — out until healed`) : null,
      mvp ? h('div', { class: 'mvp-card' }, h('div', { class: 'rarity' }, 'PLAYER OF THE GAME'), h('div', { class: 'cname' }, `${mvp.team === 0 ? '🔵' : '🔴'} ${mvp.name}`), h('div', { class: 'desc' }, mvp.isGoalie ? `${mvp.saves} saves` : `${mvp.goals} G · ${mvp.assists} A · ${mvp.hits} hits · ${mvp.bigHits} big${(mvp.blocks ?? 0) > 0 ? ` · ${mvp.blocks} blk` : ''}`)) : null,
      h('p', { class: 'stats-scroll-hint' }, 'Player stats: scroll sideways for all columns.'),
      h('div', { class: 'match-stats', role: 'region', 'aria-label': 'Player statistics', tabindex: 0,
        onKeydown: e => { if (e instanceof KeyboardEvent && e.key.startsWith('Arrow')) e.stopPropagation(); },
      }, h('table', { class: 'box' }, h('thead', {}, h('tr', {}, h('th', {}, 'PLAYER'), h('th', {}, 'G'), h('th', {}, 'A'), h('th', {}, 'SOG'), h('th', {}, 'HITS'), h('th', {}, 'BIG'), h('th', { title: 'Saves for goalies, blocked shots for skaters' }, 'SV/BLK'))), h('tbody', {}, ...rows))),
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
