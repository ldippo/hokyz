import type { App } from '../../app';
import { btn, h } from '../dom';
import { titleScreen } from './title';
import { FEATS } from '../../run/feats';
import { RIVAL_BY_ID } from '../../run/teams';
import { PERK_BY_ID } from '../../run/perks';

export function recordsScreen(app: App): void {
  const m = app.meta;
  const feats = m.feats ?? [];
  const featCards = FEATS.map((f) => {
    const got = feats.includes(f.id);
    return h('div', { class: `card ${got ? 'rare' : 'disabled'}`, style: 'width:200px;min-height:150px;cursor:default' },
      h('div', { class: 'rarity' }, got ? 'EARNED' : 'LOCKED'),
      h('div', { class: 'ico' }, f.icon),
      h('div', { class: 'cname', style: 'font-size:20px' }, f.name),
      h('div', { class: 'desc' }, f.desc),
      h('div', { class: 'price' }, `${f.reward.cash ? `+${f.reward.cash} CASH` : ''}${f.reward.unlock ? ' · UNLOCK' : ''}`),
    );
  });
  const rr = m.rivalRecord ?? {};
  const rivalRows = Object.keys(rr).map((id) => h('tr', {}, h('td', {}, RIVAL_BY_ID[id]?.name ?? id), h('td', { class: 'num' }, String(rr[id].w)), h('td', { class: 'num' }, String(rr[id].l))));
  const tel = m.telemetry ?? { perkOffered: {}, perkPicked: {}, nodePicked: {}, runEndAct: {} };
  const perkRows = Object.keys(tel.perkPicked)
    .map((id) => ({ id, picked: tel.perkPicked[id], offered: tel.perkOffered[id] ?? tel.perkPicked[id] }))
    .sort((a, b) => b.picked - a.picked)
    .slice(0, 8)
    .map((r) => h('tr', {}, h('td', {}, `${PERK_BY_ID[r.id]?.icon ?? ''} ${PERK_BY_ID[r.id]?.name ?? r.id}`), h('td', { class: 'num' }, `${r.picked}/${r.offered}`), h('td', { class: 'num' }, `${Math.round((r.picked / Math.max(1, r.offered)) * 100)}%`)));
  const endRows = Object.keys(tel.runEndAct).map((k) => h('tr', {}, h('td', {}, k === 'won' ? 'Won the run' : `Knocked out in Act ${k}`), h('td', { class: 'num' }, String(tel.runEndAct[k]))));
  const stat = (label: string, v: string | number) => h('tr', {}, h('td', {}, label), h('td', { class: 'num' }, String(v)));
  const el = h('div', { class: 'screen transparent', style: 'overflow:auto;justify-content:flex-start;padding:24px 0' },
    h('h2', { class: 'screen-title' }, 'FEATS & RECORDS'),
    h('p', { class: 'screen-sub' }, `${feats.length} / ${FEATS.length} feats · bank ${m.cash} cash`),
    h('div', { style: 'display:flex;gap:40px;flex-wrap:wrap;justify-content:center;margin:16px 0' },
      h('table', { class: 'box', style: 'min-width:320px' }, h('thead', {}, h('tr', {}, h('th', {}, 'RECORDS'), h('th', {}, ''))), h('tbody', {},
        stat('Runs / wins', `${m.runs} / ${m.wins}`),
        stat('Best run', m.bestAct ? `Act ${m.bestAct}, stop ${m.bestRow + 1}` : '—'),
        stat('Weekly best', m.weekly ? `${m.weekly.week}: ${m.weekly.won ? 'WON' : `Act ${m.weekly.bestAct}`} (${m.weekly.runs} runs)` : '—'),
        stat('Most goals in a match', m.bestGoalsMatch ?? 0),
        stat('Most big hits in a match', m.bestBigHitsMatch ?? 0),
        stat('Career goals', m.totalGoals),
        stat('Career big hits', m.totalBigHits),
        stat('Fights won', m.totalFightsWon ?? 0),
        stat('Top-corner goals', m.totalTopCorner ?? 0),
        stat('Ankle breakers', m.totalAnkle ?? 0),
        stat('Specials fired', m.totalSpecials ?? 0),
        stat('Shootouts won', m.totalShootoutWins ?? 0),
      )),
      h('table', { class: 'box', style: 'min-width:300px' }, h('thead', {}, h('tr', {}, h('th', {}, 'RIVAL'), h('th', {}, 'W'), h('th', {}, 'L'))), h('tbody', {}, ...(rivalRows.length ? rivalRows : [h('tr', {}, h('td', {}, 'No rivals faced yet'), h('td'), h('td'))]))),
      h('table', { class: 'box', style: 'min-width:300px' }, h('thead', {}, h('tr', {}, h('th', {}, 'RUN DATA · TOP PICKS'), h('th', {}, 'PICK/OFFER'), h('th', {}, '%'))), h('tbody', {}, ...(perkRows.length ? perkRows : [h('tr', {}, h('td', {}, 'Draft a perk to start collecting'), h('td'), h('td'))]), ...endRows)),
    ),
    h('div', { class: 'unlock-grid' }, ...featCards),
    h('div', { class: 'menu' }, btn('Back', () => titleScreen(app), 'primary')),
  );
  const nav = app.showScreen(el);
  if (nav) nav.onBack = () => titleScreen(app);
}
