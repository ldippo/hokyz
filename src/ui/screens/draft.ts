import type { App } from '../../app';
import { btn, h } from '../dom';
import type { MapNode } from '../../run/mapGen';
import { draftPerks } from '../../run/runState';
import { TAG_INFO, SET_SIZE, tagCounts, type Perk } from '../../run/perks';
import { runMapScreen } from './runMap';
import { sfx } from '../../audio/sfx';

export function perkCard(p: Perk, onPick: () => void, price?: number, disabled = false, owned: string[] = []): HTMLElement {
  const counts = tagCounts(owned);
  const card = h('div', { class: `card ${p.rarity} ${p.curse ? 'cursed' : ''} ${disabled ? 'disabled' : ''}`, onClick: () => { if (!disabled) onPick(); } },
    h('div', { class: 'rarity' }, p.curse ? `${p.rarity} · CURSED` : p.rarity),
    h('div', { class: 'ico' }, p.icon),
    h('div', { class: 'cname' }, p.name),
    h('div', { class: 'desc' }, p.desc),
    p.curse ? h('div', { class: 'curse' }, `CURSE: ${p.curse}`) : null,
    p.tags?.length ? h('div', { class: 'tags' }, ...p.tags.map((t) => { const n = counts[t] ?? 0; const done = n + 1 >= SET_SIZE; return h('span', { class: `tag ${done ? 'complete' : ''}`, title: `${TAG_INFO[t].set}: ${TAG_INFO[t].desc}` }, `${TAG_INFO[t].icon} ${t} ${Math.min(SET_SIZE, n + 1)}/${SET_SIZE}`); })) : null,
    price !== undefined ? h('div', { class: 'price' }, `${price} CASH`) : null,
  );
  if (!disabled) card.setAttribute('data-nav', '1');
  return card;
}

export function draftScreen(app: App, node: MapNode): void {
  const run = app.run!;
  const count = node.type === 'boss' || node.type === 'elite' ? 4 : 3;
  const bonus = node.type === 'boss' ? 1.5 : node.type === 'elite' ? 0.8 : 0;
  const picks = draftPerks(run, count, bonus);
  const tel = (app.meta.telemetry ??= { perkOffered: {}, perkPicked: {}, nodePicked: {}, runEndAct: {} });
  for (const p of picks) tel.perkOffered[p.id] = (tel.perkOffered[p.id] ?? 0) + 1;
  const el = h('div', { class: 'screen' },
    h('h2', { class: 'screen-title' }, 'DRAFT A PERK'),
    h('p', { class: 'screen-sub' }, node.type === 'boss' ? 'Boss loot · rare odds boosted' : node.type === 'elite' ? 'Elite loot · rare odds boosted' : 'Pick one'),
    h('div', { class: 'cards' }, ...picks.map((p) => perkCard(p, () => { run.perks.push(p.id); tel.perkPicked[p.id] = (tel.perkPicked[p.id] ?? 0) + 1; app.saveMeta(); sfx.cash(); app.saveRun(); runMapScreen(app); }, undefined, false, run.perks))),
    h('div', { class: 'menu' }, btn('Skip (+25 cash)', () => { run.cash += 25; app.saveRun(); runMapScreen(app); })),
  );
  app.showScreen(el);
}
