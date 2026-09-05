import type { App } from '../../app';
import { btn, h } from '../dom';
import type { MapNode } from '../../run/mapGen';
import { draftPerks } from '../../run/runState';
import type { Perk } from '../../run/perks';
import { runMapScreen } from './runMap';
import { sfx } from '../../audio/sfx';

export function perkCard(p: Perk, onPick: () => void, price?: number, disabled = false): HTMLElement {
  const card = h('div', { class: `card ${p.rarity} ${disabled ? 'disabled' : ''}`, onClick: () => { if (!disabled) onPick(); } },
    h('div', { class: 'rarity' }, p.rarity),
    h('div', { class: 'ico' }, p.icon),
    h('div', { class: 'cname' }, p.name),
    h('div', { class: 'desc' }, p.desc),
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
  const el = h('div', { class: 'screen' },
    h('h2', { class: 'screen-title' }, 'DRAFT A PERK'),
    h('p', { class: 'screen-sub' }, node.type === 'boss' ? 'Boss loot · rare odds boosted' : node.type === 'elite' ? 'Elite loot · rare odds boosted' : 'Pick one'),
    h('div', { class: 'cards' }, ...picks.map((p) => perkCard(p, () => { run.perks.push(p.id); sfx.cash(); app.saveRun(); runMapScreen(app); }))),
    h('div', { class: 'menu' }, btn('Skip (+25 cash)', () => { run.cash += 25; app.saveRun(); runMapScreen(app); })),
  );
  app.showScreen(el);
}
