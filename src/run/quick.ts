import type { Rng } from '../core/rng';
import type { Captain } from './meta';
import { generateGoalie, generateSkater, randomArchetype } from './roster';
import { quickTeam } from '../sim/fixtures';
import type { SkaterDef } from '../sim/types';

/** Home squad for Quick Match: a pick-up team, or an unlocked captain with two generated linemates and a goalie. */
export function buildHomeSquad(rng: Rng, captain: Captain | null): { skaters: SkaterDef[]; goalie: SkaterDef; name: string; short: string } {
  if (!captain) {
    const t = quickTeam('H');
    return { skaters: t.skaters, goalie: t.goalie!, name: 'Your Squad', short: 'YOU' };
  }
  const cap: SkaterDef = { id: 'qm_cap', name: captain.name, archetype: captain.archetype, stats: { ...captain.stats }, traits: [...captain.traits], hp: 100, maxHp: 100 };
  const a1 = randomArchetype(rng);
  let a2 = randomArchetype(rng);
  if (a2 === a1) a2 = randomArchetype(rng);
  const skaters = [cap, generateSkater(rng, a1, 1, 'qm'), generateSkater(rng, a2, 1, 'qm')];
  const goalie = generateGoalie(rng, 1, 'qmg');
  const last = captain.name.split(' ').pop() ?? captain.name;
  return { skaters, goalie, name: `${last}'s Crew`, short: last.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CREW' };
}
