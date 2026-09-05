import type { MatchMods } from '../sim/types';
import { mulMod } from '../sim/modifiers';

export interface Mutator {
  id: string;
  name: string;
  desc: string;
  apply: (mm: MatchMods) => void;
}

export const MUTATORS: Mutator[] = [
  { id: 'empty_nets', name: 'Empty Nets', desc: 'No goalies. Every shot counts.', apply: (mm) => { mm.noGoalies = true; } },
  { id: 'overdrive', name: 'Turbo Overdrive', desc: 'Infinite turbo for everyone.', apply: (mm) => { mm.turboInfinite = true; } },
  { id: 'bouncy', name: 'Bouncy Boards', desc: 'Boards are trampolines. Pucks fly.', apply: (mm) => { mm.boardsBouncy = true; mm.puckFrictionMul = 0.6; } },
  { id: 'slick', name: 'Slick Ice', desc: 'Low grip. Everyone falls easier.', apply: (mm) => { mm.slipperyIce = true; } },
  { id: 'long_bombs', name: 'Long Bomb Night', desc: 'Goals from outside the blue line count double for both teams.', apply: (mm) => { mm.teams[0].longShotBonus += 1; mm.teams[1].longShotBonus += 1; } },
  { id: 'sudden', name: 'Sudden Death', desc: 'First goal wins.', apply: (mm) => { mm.suddenDeath = true; } },
  { id: 'iron_men', name: 'Iron Men', desc: 'Everyone is hard to knock down. Hits are heavier.', apply: (mm) => { for (const t of mm.teams) { mulMod(t, 'hitResistMul', 1.3); mulMod(t, 'hitPowerMul', 1.3); } } },
  { id: 'short', name: 'Quick Skate', desc: 'One long period.', apply: (mm) => { mm.periods = 1; mm.periodLength = 180; } },
];
export const MUTATOR_BY_ID: Record<string, Mutator> = Object.fromEntries(MUTATORS.map((m) => [m.id, m]));
