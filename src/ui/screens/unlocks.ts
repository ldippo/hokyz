import type { App } from '../../app';
import { btn, h } from '../dom';
import { titleScreen } from './title';
import { CAPTAINS, UNLOCKABLES, isUnlocked } from '../../run/meta';
import { sfx } from '../../audio/sfx';

export function unlocksScreen(app: App): void {
  const m = app.meta;
  const render = () => {
    const capCards = CAPTAINS.filter((c) => c.cost > 0).map((c) => {
      const owned = isUnlocked(m, c.id);
      const can = !owned && m.cash >= c.cost;
      return h('div', { class: `card ${owned ? 'done' : can ? '' : 'disabled'}`, 'data-nav': can ? '1' : '', onClick: () => { if (!can) return; m.cash -= c.cost; m.unlocked.push(c.id); sfx.cash(); app.saveMeta(); render(); } },
        h('div', { class: 'rarity' }, 'captain'), h('div', { class: 'ico' }, c.icon), h('div', { class: 'cname' }, c.name), h('div', { class: 'desc' }, c.blurb), h('div', { class: 'price' }, owned ? 'UNLOCKED' : `${c.cost} CASH`));
    });
    const unCards = UNLOCKABLES.map((u) => {
      const owned = isUnlocked(m, u.id);
      const prereqOk = u.id !== 'asc_2' || isUnlocked(m, 'asc_1');
      const can = !owned && prereqOk && m.cash >= u.cost;
      const isRink = u.kind === 'rink';
      const selected = isRink && m.selectedRink === u.id;
      return h('div', { class: `card ${owned && !isRink ? 'done' : can || (owned && isRink) ? '' : 'disabled'} ${selected ? 'rare' : ''}`, 'data-nav': can || (owned && isRink) ? '1' : '', onClick: () => {
        if (owned && isRink) { m.selectedRink = selected ? 'classic' : u.id; app.saveMeta(); app.disposeView(); app.attract(); render(); return; }
        if (!can) return;
        m.cash -= u.cost; m.unlocked.push(u.id); sfx.cash(); app.saveMeta(); render();
      } },
        h('div', { class: 'rarity' }, u.kind), h('div', { class: 'ico' }, u.icon), h('div', { class: 'cname' }, u.name), h('div', { class: 'desc' }, u.desc), h('div', { class: 'price' }, owned ? (isRink ? (selected ? 'SELECTED' : 'SELECT') : 'UNLOCKED') : `${u.cost} CASH`));
    });
    const el = h('div', { class: 'screen transparent', style: 'overflow:auto;justify-content:flex-start;padding:30px 0' },
      h('h2', { class: 'screen-title' }, 'UNLOCKS'),
      h('p', { class: 'screen-sub' }, `Bank: ${m.cash} cash · earn cash by finishing runs`),
      h('div', { class: 'unlock-grid' }, ...capCards, ...unCards),
      h('div', { class: 'menu' }, btn('Back', () => titleScreen(app))),
    );
    el.querySelectorAll('.card.disabled, .card.done').forEach((c) => { if (!c.classList.contains('rare')) c.removeAttribute('data-nav'); });
    const nav = app.showScreen(el);
    if (nav) nav.onBack = () => titleScreen(app);
  };
  render();
}
