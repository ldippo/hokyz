import type { App } from '../../app';
import { btn, esc, h } from '../dom';
import { titleScreen } from './title';
import { availableNodes, currentAct, enterNode, lineup, runEffects, type RunState } from '../../run/runState';
import { COLS, nodeIcon, nodeLabel, type MapNode } from '../../run/mapGen';
import { PERK_BY_ID, TAG_INFO, SET_SIZE, tagCounts, activeSets } from '../../run/perks';
import { XP_LEVELS, MAX_LEVEL, GOALIE_STYLES } from '../../run/roster';
import { ARCHETYPES, isInjured, TRAITS } from '../../run/roster';
import { matchIntroScreen } from './match';
import { shopScreen } from './shop';
import { eventScreen } from './event';
import { restScreen } from './rest';
import { runOverScreen } from './runOver';
import { RIVAL_BY_ID } from '../../run/teams';
import { levelUpScreen } from './levelUp';
import { pendingLevelUps } from '../../run/runState';
import { skillsScreen } from './skills';
import { rosterScreen } from './roster';
import { MUTATOR_BY_ID } from '../../run/mutators';

function xpPct(xp: number, level: number): number {
  if (level >= MAX_LEVEL) return 100;
  const lo = XP_LEVELS[level],
    hi = XP_LEVELS[level + 1];
  return ((xp - lo) / (hi - lo)) * 100;
}

let panelApp: App | null = null;
export function rosterPanel(run: RunState): HTMLElement {
  const app = panelApp!;
  const line = lineup(run);
  const cards = run.roster.map((s) => {
    const inj = isInjured(s);
    const starting = line.includes(s);
    const arch = s.archetype === 'goalie' ? { label: 'Goalie', icon: '🥅' } : ARCHETYPES[s.archetype];
    return h('div', { class: `roster-card ${inj ? 'injured' : ''}` },
      h('div', { class: 'nm' }, `${arch.icon} ${s.name}${s === run.roster[0] ? ' (C)' : ''}`),
      h('div', { class: 'arch' }, `${inj ? 'INJURED' : starting ? 'STARTING' : 'BENCH'} · L${s.level ?? 0}${(s.pendingLevels ?? 0) > 0 ? ' ▲' : ''}`),
      h('div', { class: 'stats', html: `SPD <b>${s.stats.speed}</b> SHT <b>${s.stats.shot}</b> HND <b>${s.stats.hands}</b> HIT <b>${s.stats.hit}</b> BAL <b>${s.stats.balance}</b> STA <b>${s.stats.stamina}</b>` }),
      s.traits.length ? h('div', { class: 'stats' }, ...s.traits.map((t) => h('span', { title: TRAITS.find((x) => x.id === t)?.desc ?? '' }, `★ ${TRAITS.find((x) => x.id === t)?.name ?? t}`))) : null,
      h('div', { class: 'hpbar' }, h('i', { style: `width:${Math.round((s.hp / s.maxHp) * 100)}%;background:${s.hp > 50 ? '#3f3' : s.hp > 20 ? '#fc3' : '#f33'}` })),
      h('div', { class: 'xpbar' }, h('i', { style: `width:${Math.round(xpPct(s.xp ?? 0, s.level ?? 0))}%` })),
    );
  });
  const g = run.goalie;
  cards.push(h('div', { class: 'roster-card', title: GOALIE_STYLES[g.goalieStyle ?? 'butterfly'].desc }, h('div', { class: 'nm' }, `🥅 ${g.name}`), h('div', { class: 'arch' }, `GOALIE · ${GOALIE_STYLES[g.goalieStyle ?? 'butterfly'].icon} ${GOALIE_STYLES[g.goalieStyle ?? 'butterfly'].label.toUpperCase()}`), h('div', { class: 'stats', html: `SAVES <b>${g.stats.hands}</b> SPD <b>${g.stats.speed}</b> BAL <b>${g.stats.balance}</b>` })));
  const perks = run.perks.map((id) => PERK_BY_ID[id]).filter(Boolean);
  const counts = tagCounts(run.perks);
  const sets = activeSets(run.perks);
  const tagRow = (Object.keys(TAG_INFO) as (keyof typeof TAG_INFO)[]).filter((t) => (counts[t] ?? 0) > 0).map((t) => h('span', { class: `tag ${sets.includes(t) ? 'complete' : ''}`, title: `${TAG_INFO[t].set}: ${TAG_INFO[t].desc}` }, `${TAG_INFO[t].icon} ${t} ${Math.min(SET_SIZE, counts[t] ?? 0)}/${SET_SIZE}`));
  return h('div', { class: 'side' },
    h('h3', {}, `Roster · ${run.teamName}`),
    h('div', { style: 'margin-bottom:8px' }, btn('Manage lineup', () => rosterScreen(app))),
    ...cards,
    h('h3', {}, `Perks (${perks.length})`),
    tagRow.length ? h('div', { class: 'tags', style: 'margin-bottom:8px' }, ...tagRow) : null,
    ...sets.map((t) => h('div', { class: 'perk-chip epic' }, h('b', {}, `${TAG_INFO[t].icon} SET: ${TAG_INFO[t].set}`), h('div', {}, TAG_INFO[t].desc))),
    h('div', { class: 'perk-list' }, ...(perks.length ? perks.map((p) => h('div', { class: `perk-chip ${p.rarity}` }, h('b', {}, `${p.icon} ${p.name}`), h('div', {}, p.desc))) : [h('div', { class: 'perk-chip' }, 'None yet. Win a match to draft.')])),
  );
}

export function topBar(app: App, run: RunState, extra?: HTMLElement): HTMLElement {
  const e = runEffects(run);
  const lives = e.extraLives - run.livesUsed;
  return h('div', { class: 'topbar' },
    h('div', { style: 'display:flex;align-items:center' },
      h('span', { class: 'title' }, `ACT ${run.act} · ${run.teamName}`),
      h('span', { class: 'stat' }, h('small', {}, 'CASH'), String(run.cash)),
      h('span', { class: 'stat' }, h('small', {}, 'RECORD'), `${run.matchesWon}-${run.matchesPlayed - run.matchesWon}`),
      lives > 0 ? h('span', { class: 'stat' }, h('small', {}, 'SECOND WIND'), '❤️'.repeat(lives)) : null,
      run.ascension ? h('span', { class: 'stat' }, h('small', {}, 'ASC'), String(run.ascension)) : null,
      h('span', { class: 'stat', style: 'color:#8fa3d9;font-size:13px' }, h('small', {}, 'SEED'), run.seedText || String(run.seed)),
    ),
    h('div', { style: 'display:flex;gap:10px' }, extra ?? null, btn('Save & Quit', () => { app.saveRun(); app.disposeView(); titleScreen(app); })),
  );
}

export function runMapScreen(app: App): void {
  panelApp = app;
  const run = app.run!;
  if (run.over) {
    runOverScreen(app);
    return;
  }
  if (pendingLevelUps(run).length) {
    levelUpScreen(app);
    return;
  }
  app.saveRun();
  app.attract();
  const act = currentAct(run);
  const avail = availableNodes(run);
  const availIds = new Set(avail.map((n) => n.id));
  const colW = 150,
    rowH = 92;
  const W = COLS * colW,
    H = act.rows.length * rowH;
  const map = h('div', { class: 'map', style: `width:${W}px;height:${H}px` });
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  const pos = (n: MapNode) => ({ x: n.col * colW + colW / 2, y: H - (n.row * rowH + rowH / 2) });
  const byId = new Map<string, MapNode>();
  for (const row of act.rows) for (const n of row) byId.set(n.id, n);
  for (const row of act.rows)
    for (const n of row)
      for (const nid of n.next) {
        const m = byId.get(nid)!;
        const a = pos(n),
          b = pos(m);
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', String(a.x));
        line.setAttribute('y1', String(a.y));
        line.setAttribute('x2', String(b.x));
        line.setAttribute('y2', String(b.y));
        const onPath = n.done && (m.done || availIds.has(m.id));
        line.setAttribute('stroke', onPath ? '#ffd23f' : '#2b3352');
        line.setAttribute('stroke-width', onPath ? '4' : '3');
        line.setAttribute('stroke-dasharray', onPath ? '' : '6 6');
        svg.appendChild(line);
      }
  map.appendChild(svg);
  for (const row of act.rows)
    for (const n of row) {
      const p = pos(n);
      const isAvail = availIds.has(n.id);
      const isCurrent = run.currentNodeId === n.id;
      const cls = ['node', n.type, isAvail ? 'available' : '', n.done ? 'done' : '', isCurrent ? 'current' : '', !isAvail && !n.done && n.row >= run.row ? 'locked' : ''].join(' ');
      const rival = n.rivalId ? RIVAL_BY_ID[n.rivalId] : null;
      const tip = rival ? `${rival.name}${n.mutatorId ? ` · ${MUTATOR_BY_ID[n.mutatorId].name}` : ''}` : nodeLabel(n.type);
      const el = h('div', { class: cls, style: `left:${p.x}px;top:${p.y}px`, title: tip, onClick: () => { if (isAvail) pickNode(app, n); } }, h('div', { class: 'ico' }, nodeIcon(n.type)), h('div', {}, n.type === 'match' && rival ? esc(rival.short) : nodeLabel(n.type)));
      if (isAvail) el.setAttribute('data-nav', '1');
      map.appendChild(el);
    }
  const legend = h('div', { style: 'text-align:center;color:#8fa3d9;font-size:12px;letter-spacing:0.15em;margin-top:10px' }, '🏒 MATCH · 💀 ELITE · 🥅 SHOOTOUT · 💥 HIT PARADE · 🛒 SHOP · ❓ EVENT · 🔥 REST · 👑 BOSS');
  const el = h('div', { class: 'run-shell' },
    topBar(app, run),
    h('div', { class: 'run-body' }, h('div', { class: 'map-scroll' }, h('div', { style: 'text-align:center;font-family:var(--font-display);letter-spacing:0.2em;color:#ffd23f;margin-bottom:8px' }, `ACT ${run.act} OF 3 · PICK YOUR NEXT STOP`), map, legend), rosterPanel(run)),
  );
  const nav = app.showScreen(el);
  if (nav) {
    nav.onBack = () => {};
    // focus first available node
    const first = el.querySelector<HTMLElement>('.node.available');
    if (first) nav.setFocus(nav.items().indexOf(first), false);
  }
}

export function pickNode(app: App, node: MapNode): void {
  const run = app.run!;
  const tel = (app.meta.telemetry ??= { perkOffered: {}, perkPicked: {}, nodePicked: {}, runEndAct: {} });
  tel.nodePicked[node.type] = (tel.nodePicked[node.type] ?? 0) + 1;
  app.saveMeta();
  enterNode(run, node);
  app.saveRun();
  switch (node.type) {
    case 'match':
    case 'elite':
    case 'boss':
      matchIntroScreen(app, node);
      break;
    case 'shop':
      shopScreen(app, node);
      break;
    case 'event':
      eventScreen(app, node);
      break;
    case 'rest':
      restScreen(app, node);
      break;
    case 'shootout':
    case 'hitparade':
      skillsScreen(app, node);
      break;
  }
}
