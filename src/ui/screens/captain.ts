import type { App } from '../../app';
import { btn, esc, h } from '../dom';
import { titleScreen } from './title';
import { runMapScreen } from './runMap';
import { CAPTAINS, ascensionLevel, isUnlocked, weeklySeed } from '../../run/meta';
import { newRun, TEAM_NAMES, TEAM_COLORS, TEAM_LOGOS, shortFor } from '../../run/runState';
import { Rng } from '../../core/rng';
import { awayColorFor } from '../colors';
import { ARCHETYPES, statLine } from '../../run/roster';

export function captainScreen(app: App, weekly: string | null = null): void {
  const maxAsc = ascensionLevel(app.meta);
  let asc = maxAsc;
  const seedInput = h('input', { type: 'text', placeholder: 'seed (optional)', style: 'font-family:var(--font-display);font-size:18px;padding:6px 10px;background:#10141f;border:2px solid #3a4260;color:#fff;letter-spacing:0.1em;width:220px' }) as HTMLInputElement;
  const ascLbl = h('span', {}, `ASCENSION ${asc}`);
  // team identity
  const rnd = new Rng(Date.now() & 0xffff);
  const identity = { name: rnd.pick(TEAM_NAMES), color: TEAM_COLORS[0], logo: TEAM_LOGOS[rnd.int(0, TEAM_LOGOS.length - 1)] };
  const nameInput = h('input', { type: 'text', maxlength: 22, value: identity.name, style: 'font-family:var(--font-display);font-size:20px;padding:6px 10px;background:#10141f;border:2px solid #3a4260;color:#fff;letter-spacing:0.08em;width:260px', onInput: (e) => { identity.name = (e.target as HTMLInputElement).value; preview(); } }) as HTMLInputElement;
  const logoIcons: Record<string, string> = { circle: '●', shield: '⛊', diamond: '◆', star: '★', hex: '⬢' };
  const swatches = h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, ...TEAM_COLORS.map((c) => h('button', { class: 'swatch', style: `background:${c}`, title: c, onClick: () => { identity.color = c; preview(); } })));
  const logos = h('div', { style: 'display:flex;gap:6px' }, ...TEAM_LOGOS.map((l) => h('button', { class: 'swatch logo', onClick: () => { identity.logo = l; preview(); } }, logoIcons[l])));
  const previewEl = h('div', { class: 'team-preview' });
  const preview = () => {
    swatches.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('sel', (b as HTMLElement).title === identity.color));
    logos.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('sel', b.textContent === logoIcons[identity.logo]));
    const cb = app.meta.colorblind ?? 'off';
    const clash = cb !== 'off' && awayColorFor(identity.color, '#d8262f', cb) !== '#d8262f';
    previewEl.innerHTML = `<span class="badge" style="background:${identity.color}">${logoIcons[identity.logo]}</span> <b>${identity.name || 'TEAM'}</b> <small>${shortFor(identity.name || 'TEAM')}</small>${clash ? ' <em>· away jerseys will auto-swap under your colorblind palette</em>' : ''}`;
  };
  preview();
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
    app.run = newRun(weekly ? weeklySeed(weekly) : seedInput.value.trim(), cap, weekly ? 0 : asc, unlockedPerks, { name: identity.name, short: shortFor(identity.name || 'TEAM'), color: identity.color, logo: identity.logo });
    app.run.weekly = weekly;
    app.meta.runs++;
    app.saveMeta();
    app.saveRun();
    runMapScreen(app);
  };
  const el = h('div', { class: 'screen transparent' },
    h('h2', { class: 'screen-title' }, weekly ? `WEEKLY RUN · ${weekly}` : 'PICK YOUR CAPTAIN'),
    h('p', { class: 'screen-sub', html: `Captain + 2 random skaters + bench + goalie. <span style="color:var(--gold)">${esc(statLine({ speed: 0, shot: 0, hands: 0, hit: 0, balance: 0, stamina: 0 }).replace(/ \d/g, ''))}</span>` }),
    h('div', { class: 'cards' }, ...cards),
    h('div', { class: 'identity' }, h('div', { class: 'identity-row' }, h('span', { class: 'lbl' }, 'TEAM'), nameInput, btn('🎲', () => { identity.name = rnd.pick(TEAM_NAMES); nameInput.value = identity.name; preview(); })), h('div', { class: 'identity-row' }, h('span', { class: 'lbl' }, 'COLOR'), swatches), h('div', { class: 'identity-row' }, h('span', { class: 'lbl' }, 'LOGO'), logos), previewEl),
    h('div', { style: 'display:flex;gap:16px;align-items:center;margin-top:16px' },
      weekly ? h('span', { class: 'small' }, `Seed locked: ${weeklySeed(weekly)} · same map for everyone this week · no ascension`) : seedInput,
      maxAsc > 0 ? btn('‹', () => { asc = Math.max(0, asc - 1); ascLbl.textContent = `ASCENSION ${asc}`; }) : null,
      maxAsc > 0 ? ascLbl : null,
      maxAsc > 0 ? btn('›', () => { asc = Math.min(maxAsc, asc + 1); ascLbl.textContent = `ASCENSION ${asc}`; }) : null,
      btn('Back', () => titleScreen(app)),
    ),
  );
  const nav = app.showScreen(el);
  if (nav) nav.onBack = () => titleScreen(app);
}
