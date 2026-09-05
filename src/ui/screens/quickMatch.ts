import type { App } from '../../app';
import { btn, h } from '../dom';
import { titleScreen } from './title';
import { RIVALS, buildRivalRoster } from '../../run/teams';
import { Rng } from '../../core/rng';
import { buildHomeSquad } from '../../run/quick';
import { CAPTAINS, isUnlocked } from '../../run/meta';
import { defaultMatchMods } from '../../sim/modifiers';
import { MatchSim } from '../../sim/match';
import { playMatch } from './match';
import { MUTATORS } from '../../run/mutators';
import { awardFeats } from '../../run/feats';

export function quickMatchScreen(app: App): void {
  let diff = 1;
  let rivalIdx = 0;
  let mutator = -1;
  let capIdx = 0; // 0 = pick-up squad
  const caps = CAPTAINS.filter((c) => isUnlocked(app.meta, c.id));
  const rivals = RIVALS;
  const diffLbl = h('span', {}, '');
  const rivalLbl = h('span', {}, '');
  const mutLbl = h('span', {}, '');
  const capLbl = h('span', {}, '');
  const refresh = () => {
    capLbl.textContent = capIdx === 0 ? 'PICK-UP SQUAD' : `${caps[capIdx - 1].icon} ${caps[capIdx - 1].name.toUpperCase()}`;
    diffLbl.textContent = ['ROOKIE', 'PRO', 'ALL-STAR', 'BRUTAL'][diff];
    rivalLbl.textContent = rivals[rivalIdx].name;
    mutLbl.textContent = mutator < 0 ? 'NONE' : MUTATORS[mutator].name;
  };
  refresh();
  const row = (label: string, val: HTMLElement, onChange: (d: number) => void) =>
    h('div', { class: 'settings-row' }, h('span', {}, label), h('div', { style: 'display:flex;gap:8px;align-items:center' }, btn('‹', () => { onChange(-1); refresh(); }), val, btn('›', () => { onChange(1); refresh(); })));
  const el = h('div', { class: 'screen transparent' },
    h('h2', { class: 'screen-title' }, 'QUICK MATCH'),
    h('p', { class: 'screen-sub' }, 'Exhibition · no run progress'),
    h('div', { style: 'margin:20px 0' },
      row('Your team', capLbl, (d) => (capIdx = (capIdx + d + caps.length + 1) % (caps.length + 1))),
      row('Opponent', rivalLbl, (d) => (rivalIdx = (rivalIdx + d + rivals.length) % rivals.length)),
      row('Difficulty', diffLbl, (d) => (diff = Math.max(0, Math.min(3, diff + d)))),
      row('Mutator', mutLbl, (d) => (mutator = ((mutator + 1 + d + MUTATORS.length + 1) % (MUTATORS.length + 1)) - 1)),
    ),
    h('div', { class: 'menu' },
      btn('Drop the Puck', () => {
        const rng = new Rng(Date.now() & 0xfffff);
        const home = buildHomeSquad(rng, capIdx === 0 ? null : caps[capIdx - 1]);
        const rival = rivals[rivalIdx];
        const away = buildRivalRoster(rng, rival, diff);
        const mods = defaultMatchMods();
        rival.mods?.(mods.teams[1]);
        if (mutator >= 0) MUTATORS[mutator].apply(mods);
        const sim = new MatchSim(
          [
            { name: home.name, short: home.short, color: '#2f6bff', skaters: home.skaters, goalie: home.goalie, isHuman: true, difficulty: 2 },
            { name: rival.name, short: rival.short, color: rival.color, skaters: away.skaters, goalie: away.goalie, isHuman: false, difficulty: diff },
          ],
          mods,
          rng.int(1, 1e9),
        );
        playMatch(app, sim, [], (outcome) => {
          const feats = awardFeats(app.meta, { outcome });
          app.saveMeta();
          if (feats.length) app.toast(`FEAT: ${feats.map((f) => `${f.icon} ${f.name} +${f.reward.cash ?? 0}`).join('  ·  ')}`);
          titleScreen(app);
        });
      }, 'primary'),
      btn('Back', () => titleScreen(app)),
    ),
  );
  const nav = app.showScreen(el);
  if (nav) nav.onBack = () => titleScreen(app);
}
