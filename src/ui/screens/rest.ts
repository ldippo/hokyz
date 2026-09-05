import type { App } from '../../app';
import { btn, h } from '../dom';
import type { MapNode } from '../../run/mapGen';
import { completeNode, runRng, commitRng } from '../../run/runState';
import { runMapScreen, topBar, rosterPanel } from './runMap';
import { ARCHETYPES } from '../../run/roster';
import type { Stats } from '../../sim/types';
import { sfx } from '../../audio/sfx';

const STAT_LABEL: Record<keyof Stats, string> = { speed: 'Speed', shot: 'Shot', hands: 'Hands', hit: 'Hit', balance: 'Balance', stamina: 'Stamina' };

export function restScreen(app: App, node: MapNode): void {
  const run = app.run!;
  // heal everyone (ascension 4: rest stops only train)
  const heals = run.ascension < 4;
  if (heals) {
    run.roster.forEach((s) => (s.hp = s.maxHp));
    run.goalie.hp = 100;
  }
  const rng = runRng(run);
  const keys = Object.keys(STAT_LABEL) as (keyof Stats)[];
  const offers = run.roster.slice(0, 4).map((s) => ({ s, stat: rng.pick(keys.filter((k) => s.stats[k] < 10)) ?? 'speed' }));
  commitRng(run, rng);
  const el = h('div', { class: 'run-shell' },
    topBar(app, run),
    h('div', { class: 'run-body' },
      h('div', { class: 'map-scroll' },
        h('h2', { class: 'screen-title' }, '🔥 REST STOP'),
        h('p', { class: 'screen-sub' }, heals ? 'Everyone healed to full. Pick one skater to train (+2 stat).' : 'Ascension 4: no heals here. Pick one skater to train (+2 stat).'),
        h('div', { class: 'cards' }, ...offers.map(({ s, stat }) =>
          h('div', { class: 'card', 'data-nav': '1', onClick: () => { s.stats[stat] = Math.min(10, s.stats[stat] + 2); sfx.cash(); completeNode(run, node); app.saveRun(); runMapScreen(app); } },
            h('div', { class: 'rarity' }, ARCHETYPES[s.archetype as keyof typeof ARCHETYPES]?.label ?? s.archetype), h('div', { class: 'ico' }, ARCHETYPES[s.archetype as keyof typeof ARCHETYPES]?.icon ?? '🏒'), h('div', { class: 'cname' }, s.name),
            h('div', { class: 'desc' }, `Train ${STAT_LABEL[stat]}: ${s.stats[stat]} → ${Math.min(10, s.stats[stat] + 2)}`),
            h('div', { class: 'cstats', html: Object.entries(s.stats).map(([k, v]) => `<span>${k.slice(0, 3).toUpperCase()} <b>${v}</b></span>`).join('') }),
          ))),
        h('div', { class: 'menu' }, btn('Skip training', () => { completeNode(run, node); app.saveRun(); runMapScreen(app); })),
      ),
      rosterPanel(run),
    ),
  );
  app.showScreen(el);
}
