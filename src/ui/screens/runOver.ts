import type { App } from '../../app';
import { btn, h } from '../dom';
import { titleScreen } from './title';
import { captainScreen } from './captain';
import { PERK_BY_ID } from '../../run/perks';

export function runOverScreen(app: App): void {
  const run = app.run!;
  const earned = Math.floor(run.cash * 0.5) + run.matchesWon * 25 + (run.won ? 500 : 0) + run.ascension * 50;
  app.meta.cash += earned;
  if (run.won) app.meta.wins++;
  if (run.act > app.meta.bestAct || (run.act === app.meta.bestAct && run.row > app.meta.bestRow)) {
    app.meta.bestAct = run.act;
    app.meta.bestRow = run.row;
  }
  app.saveMeta();
  app.clearSavedRun();
  app.run = null;
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
      h('div', { class: 'menu' }, btn('New Run', () => captainScreen(app), 'primary'), btn('Title', () => titleScreen(app))),
    ),
  );
  app.showScreen(el);
}
