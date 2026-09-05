import type { App } from '../../app';
import { btn, h } from '../dom';
import { commitRng, pendingLevelUps, runRng } from '../../run/runState';
import { ARCHETYPES, TRAITS } from '../../run/roster';
import type { Stats } from '../../sim/types';
import { runMapScreen } from './runMap';
import { sfx } from '../../audio/sfx';

const STAT_LABEL: Record<keyof Stats, string> = { speed: 'Speed', shot: 'Shot', hands: 'Hands', hit: 'Hit', balance: 'Balance', stamina: 'Stamina' };

/** Spend one pending level-up: +1 to one of two stats, or a new trait. */
export function levelUpScreen(app: App): void {
  const run = app.run!;
  const s = pendingLevelUps(run)[0];
  if (!s) {
    runMapScreen(app);
    return;
  }
  const rng = runRng(run);
  const keys = (Object.keys(STAT_LABEL) as (keyof Stats)[]).filter((k) => s.stats[k] < 10);
  const picks = rng.shuffle([...keys]).slice(0, 2);
  const traitPool = TRAITS.filter((t) => !s.traits.includes(t.id) && !t.desc.startsWith('-'));
  const trait = s.archetype !== 'goalie' && traitPool.length && rng.chance(0.6) ? rng.pick(traitPool) : null;
  commitRng(run, rng);
  const arch = s.archetype === 'goalie' ? { label: 'Goalie', icon: '🥅' } : ARCHETYPES[s.archetype];
  const done = () => {
    s.pendingLevels = Math.max(0, (s.pendingLevels ?? 0) - 1);
    sfx.cash();
    app.saveRun();
    levelUpScreen(app);
  };
  const el = h('div', { class: 'screen' },
    h('h2', { class: 'screen-title' }, 'LEVEL UP'),
    h('p', { class: 'screen-sub' }, `${arch.icon} ${s.name} reached level ${s.level}. Pick a boost.`),
    h('div', { class: 'cards' },
      ...picks.map((k) => h('div', { class: 'card', 'data-nav': '1', onClick: () => { s.stats[k] = Math.min(10, s.stats[k] + 1); done(); } },
        h('div', { class: 'rarity' }, 'stat'), h('div', { class: 'ico' }, '📈'), h('div', { class: 'cname' }, `+1 ${STAT_LABEL[k]}`), h('div', { class: 'desc' }, `${s.stats[k]} → ${s.stats[k] + 1}`))),
      trait ? h('div', { class: 'card rare', 'data-nav': '1', onClick: () => { s.traits.push(trait.id); if (trait.stats) for (const k of Object.keys(trait.stats) as (keyof Stats)[]) s.stats[k] = Math.max(1, Math.min(10, s.stats[k] + (trait.stats[k] ?? 0))); done(); } },
        h('div', { class: 'rarity' }, 'trait'), h('div', { class: 'ico' }, '★'), h('div', { class: 'cname' }, trait.name), h('div', { class: 'desc' }, trait.desc)) : null,
    ),
    h('div', { class: 'menu' }, btn('Skip', () => done())),
  );
  app.showScreen(el);
}
