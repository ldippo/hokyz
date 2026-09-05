import type { App } from '../../app';
import { btn, esc, h } from '../dom';
import { titleScreen } from './title';
import { runMapScreen } from './runMap';
import { CAPTAINS, ascensionLevel, isUnlocked } from '../../run/meta';
import { newRun } from '../../run/runState';
import { ARCHETYPES, statLine } from '../../run/roster';

export function captainScreen(app: App): void {
  const maxAsc = ascensionLevel(app.meta);
  let asc = maxAsc;
  const seedInput = h('input', { type: 'text', placeholder: 'seed (optional)', style: 'font-family:var(--font-display);font-size:18px;padding:6px 10px;background:#10141f;border:2px solid #3a4260;color:#fff;letter-spacing:0.1em;width:220px' }) as HTMLInputElement;
  const ascLbl = h('span', {}, `ASCENSION ${asc}`);
  const cards = CAPTAINS.map((c) => {
    const unlocked = isUnlocked(app.meta, c.id);
    const card = h('div', { class: `card ${unlocked ? '' : 'disabled'}`, 'data-nav': unlocked ? '1' : '', onClick: () => { if (!unlocked) return; startRun(c.id); } },
      h('div', { class: 'rarity' }, ARCHETYPES[c.archetype].label),
      h('div', { class: 'ico' }, c.icon),
      h('div', { class: 'cname' }, c.name),
      h('div', { class: 'desc' }, c.blurb),
      h('div', { class: 'cstats', html: Object.entries(c.stats).map(([k, v]) => `<span>${k.slice(0, 3).toUpperCase()} <b>${v}</b></span>`).join('') }),
      h('div', { class: 'price' }, unlocked ? 'READY' : `LOCKED · ${c.cost}`),
    );
    if (!unlocked) card.removeAttribute('data-nav');
    return card;
  });
  const startRun = (capId: string) => {
    const cap = CAPTAINS.find((c) => c.id === capId)!;
    const unlockedPerks = app.meta.unlocked.filter((u) => u.startsWith('perk_'));
    app.run = newRun(seedInput.value.trim(), cap, asc, unlockedPerks);
    app.meta.runs++;
    app.saveMeta();
    app.saveRun();
    runMapScreen(app);
  };
  const el = h('div', { class: 'screen transparent' },
    h('h2', { class: 'screen-title' }, 'PICK YOUR CAPTAIN'),
    h('p', { class: 'screen-sub', html: `Captain + 2 random skaters + bench + goalie. <span style="color:var(--gold)">${esc(statLine({ speed: 0, shot: 0, hands: 0, hit: 0, balance: 0, stamina: 0 }).replace(/ \d/g, ''))}</span>` }),
    h('div', { class: 'cards' }, ...cards),
    h('div', { style: 'display:flex;gap:16px;align-items:center;margin-top:24px' },
      seedInput,
      maxAsc > 0 ? btn('‹', () => { asc = Math.max(0, asc - 1); ascLbl.textContent = `ASCENSION ${asc}`; }) : null,
      maxAsc > 0 ? ascLbl : null,
      maxAsc > 0 ? btn('›', () => { asc = Math.min(maxAsc, asc + 1); ascLbl.textContent = `ASCENSION ${asc}`; }) : null,
      btn('Back', () => titleScreen(app)),
    ),
  );
  const nav = app.showScreen(el);
  if (nav) nav.onBack = () => titleScreen(app);
}
