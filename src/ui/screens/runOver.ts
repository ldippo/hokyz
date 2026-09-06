import type { App } from '../../app';
import { copyText, seedLink } from '../../run/share';
import { btn, h } from '../dom';
import { titleScreen } from './title';
import { captainScreen } from './captain';
import { PERK_BY_ID } from '../../run/perks';
import { awardFeats } from '../../run/feats';
import { saveMeta } from '../../core/save';

export function runOverScreen(app: App): void {
  const run = app.run!;
  const leagueActs = Math.max(0, run.act - 3);
  const earned = Math.floor(run.cash * 0.5) + run.matchesWon * 25 + (run.won ? 500 : 0) + run.ascension * 50 + leagueActs * 150;
  // Roster IDs are unique per new run and persisted, including in legacy saves.
  const settlementKey = `${run.seed}:${run.goalie.id}:${run.roster[0]?.id}`;
  const m = app.meta;
  const settled = m.settledRuns?.[settlementKey] === true;
  if (!settled) {
    m.cash += earned;
    if (run.won) m.wins++;
    if (run.act > m.bestAct || (run.act === m.bestAct && run.row > m.bestRow)) {
      m.bestAct = run.act;
      m.bestRow = run.row;
    }
    if (run.won) m.bestAscWon = Math.max(m.bestAscWon ?? 0, run.ascension);
    if (run.act >= 4) m.leagueBestAct = Math.max(m.leagueBestAct ?? 0, run.act);
    m.telemetry ??= { perkOffered: {}, perkPicked: {}, nodePicked: {}, runEndAct: {} };
    m.telemetry.runEndAct[String(run.won ? 'won' : run.act)] = (m.telemetry.runEndAct[String(run.won ? 'won' : run.act)] ?? 0) + 1;
    if (run.weekly) {
      const w = m.weekly && m.weekly.week === run.weekly ? m.weekly : { week: run.weekly, bestAct: 0, bestRow: 0, won: false, runs: 0 };
      w.runs++;
      if (run.won || run.act > w.bestAct || (run.act === w.bestAct && run.row > w.bestRow)) {
        w.bestAct = run.act;
        w.bestRow = run.row;
      }
      if (run.won) w.won = true;
      m.weekly = w;
    }
  }
  const feats = settled ? [] : awardFeats(m, { run, runOver: true });
  (m.settledRuns ??= {})[settlementKey] = true;
  if (!saveMeta(m)) {
    app.toast('Could not save your payout. Free browser storage, then retry or reload. Your run is retained.');
    return;
  }
  app.clearSavedRun();
  app.run = null;
  if (feats.length) app.toast(`FEAT: ${feats.map((f) => `${f.icon} ${f.name} +${f.reward.cash ?? 0}`).join('  ·  ')}`);
  app.attract();
  const el = h('div', { class: 'screen transparent' },
    h('div', { class: 'result' },
      h('h2', { class: run.won ? 'win' : 'lose' }, run.won ? '🏆 CHAMPIONS' : 'RUN OVER'),
      h('div', { class: 'result-description' }, run.won ? (run.act >= 4 ? (run.row >= (run.maps[run.act - 1]?.rows.length ?? 99) ? `Overtime League: cleared through Act ${run.act}. Trophy banked.` : `Overtime League run ended in Act ${run.act}, stop ${run.row + 1}. The trophy stays.`) : 'You beat the act-3 boss. Legend status: confirmed.') : `Knocked out in Act ${run.act}, stop ${run.row + 1}.`),
      h('table', { class: 'box' },
        h('tbody', {},
          h('tr', {}, h('td', {}, 'Record'), h('td', { class: 'num' }, `${run.matchesWon}-${run.matchesPlayed - run.matchesWon}`)),
          h('tr', {}, h('td', {}, 'Goals for / against'), h('td', { class: 'num' }, `${run.goalsFor} / ${run.goalsAgainst}`)),
          h('tr', {}, h('td', {}, 'Big hits'), h('td', { class: 'num' }, String(run.bigHits))),
          h('tr', {}, h('td', {}, 'Perks'), h('td', { class: 'num' }, run.perks.map((p) => PERK_BY_ID[p]?.icon ?? '').join(' ') || '—')),
          h('tr', {}, h('td', {}, 'Cash banked'), h('td', { class: 'num', style: 'color:var(--gold)' }, `+${earned}`)),
          h('tr', {}, h('td', {}, 'Total bank'), h('td', { class: 'num', style: 'color:var(--gold)' }, String(app.meta.cash))),
        )),
      h('div', { class: 'menu' }, btn('New Run', () => captainScreen(app), 'primary'), btn('Replay This Seed', () => captainScreen(app, null, run.seedText || String(run.seed))), btn('Copy Seed Link', () => { void copyText(seedLink(run.seedText || String(run.seed))).then((ok) => app.toast(ok ? 'Seed link copied' : 'Copy failed')); }), btn('Title', () => titleScreen(app))),
    ),
  );
  app.showScreen(el);
}
