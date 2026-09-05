import type { App } from '../../app';
import { btn, h } from '../dom';
import { cutSkater, cutValue, lineup, toggleStarter } from '../../run/runState';
import { ARCHETYPES, isInjured, TRAITS, XP_LEVELS, MAX_LEVEL } from '../../run/roster';
import { runMapScreen, topBar } from './runMap';
import { sfx } from '../../audio/sfx';

/** Pick your three starters, bench the rest, cut for cash. */
export function rosterScreen(app: App): void {
  const run = app.run!;
  const render = () => {
    const starters = lineup(run);
    const cards = run.roster.map((s, i) => {
      const inj = isInjured(s);
      const starting = starters.includes(s);
      const chosen = (run.lineupIds ?? []).includes(s.id);
      const arch = ARCHETYPES[s.archetype as keyof typeof ARCHETYPES];
      const xpPct = (s.level ?? 0) >= MAX_LEVEL ? 100 : (((s.xp ?? 0) - XP_LEVELS[s.level ?? 0]) / (XP_LEVELS[(s.level ?? 0) + 1] - XP_LEVELS[s.level ?? 0])) * 100;
      return h('div', { class: `card ${starting ? 'rare' : ''} ${inj ? 'disabled' : ''}`, style: 'width:260px;cursor:default' },
        h('div', { class: 'rarity' }, `${i === 0 ? 'CAPTAIN · ' : ''}${inj ? 'INJURED' : starting ? 'STARTING' : 'BENCH'} · L${s.level ?? 0}`),
        h('div', { class: 'ico' }, arch?.icon ?? '🏒'),
        h('div', { class: 'cname' }, s.name),
        h('div', { class: 'desc' }, arch?.label ?? s.archetype),
        h('div', { class: 'cstats', html: Object.entries(s.stats).map(([k, v]) => `<span>${k.slice(0, 3).toUpperCase()} <b>${v}</b></span>`).join('') }),
        s.traits.length ? h('div', { class: 'desc' }, ...s.traits.map((t) => { const tr = TRAITS.find((x) => x.id === t); return h('div', { title: tr?.desc ?? '' }, `★ ${tr?.name ?? t}: ${tr?.desc ?? ''}`); })) : null,
        h('div', { class: 'hpbar', style: 'height:6px;background:#300;margin-top:6px' }, h('i', { style: `display:block;height:100%;width:${Math.round((s.hp / s.maxHp) * 100)}%;background:${s.hp > 50 ? '#3f3' : s.hp > 20 ? '#fc3' : '#f33'}` })),
        h('div', { class: 'xpbar', style: 'height:4px;background:#1c2033;margin-top:3px' }, h('i', { style: `display:block;height:100%;width:${Math.round(xpPct)}%;background:#7fa6ff` })),
        h('div', { style: 'display:flex;gap:8px;margin-top:10px' },
          inj ? h('span', { class: 'small' }, `HP ${s.hp} · out until healed`) : btn(chosen ? 'Bench' : 'Start', () => { if (toggleStarter(run, s.id)) { sfx.ui(); app.saveRun(); render(); } }, chosen ? '' : 'primary'),
          i > 0 && run.roster.length > 3 ? btn(`Cut +${cutValue(s)}`, () => { if (cutSkater(run, s.id)) { sfx.cash(); app.saveRun(); render(); } }) : null,
        ),
      );
    });
    const g = run.goalie;
    cards.push(h('div', { class: 'card', style: 'width:260px;cursor:default' }, h('div', { class: 'rarity' }, 'GOALIE'), h('div', { class: 'ico' }, '🥅'), h('div', { class: 'cname' }, g.name), h('div', { class: 'cstats', html: `<span>SAVES <b>${g.stats.hands}</b></span><span>SPD <b>${g.stats.speed}</b></span><span>BAL <b>${g.stats.balance}</b></span>` })));
    const el = h('div', { class: 'run-shell' },
      topBar(app, run),
      h('div', { class: 'map-scroll' },
        h('h2', { class: 'screen-title' }, 'ROSTER'),
        h('p', { class: 'screen-sub' }, `Pick three starters. Injured skaters sit until healed; the bench fills in. ${starters.length < 3 ? 'Not enough healthy skaters: the injured will dress.' : ''}`),
        h('div', { class: 'cards' }, ...cards),
        h('div', { class: 'menu' }, btn('Back to Map', () => runMapScreen(app), 'primary')),
      ),
    );
    app.showScreen(el);
  };
  render();
}
