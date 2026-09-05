import type { App } from '../../app';
import { copyText, seedLink } from '../../run/share';
import { btn, h } from '../dom';
import { titleScreen } from './title';
import { captainScreen } from './captain';
import { PERK_BY_ID } from '../../run/perks';
import { awardFeats } from '../../run/feats';

export function runOverScreen(app: App): void {
  const run = app.run!;
  const earned = Math.floor(run.cash * 0.5) + run.matchesWon * 25 + (run.won ? 500 : 0) + run.ascension * 50;
  app.meta.cash += earned;
  if (run.won) app.meta.wins++;
  if (run.act > app.meta.bestAct || (run.act === app.meta.bestAct && run.row > app.meta.bestRow)) {
    app.meta.bestAct = run.act;
    app.meta.bestRow = run.row;
  }
  const m = app.meta;
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
  const feats = awardFeats(m, { run, runOver: true });
  app.saveMeta();
  app.clearSavedRun();
  app.run = null;
  if (feats.length) app.toast(`FEAT: ${feats.map((f) => `${f.icon} ${f.name} +${f.reward.cash ?? 0}`).join('  ·  ')}`);
  app.attract();
  const el = h('div', { class: 'screen transparent' },
    h('div', { class: 'result' },
      h('h2', { class: run.won ? 'win' : 'lose' }, run.won ? '🏆 CHAMPIONS' : 'RUN OVER'),
      h('div', { class: 'score-line' }, run.won ? 'You beat The Legends. Legend status: confirmed.' : `Knocked out in Act ${run.act}, stop ${run.row + 1}.`),
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
