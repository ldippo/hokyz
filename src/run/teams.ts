import type { Rng } from '../core/rng';
import type { Archetype, BossPhase, SkaterDef, TeamMods } from '../sim/types';
import { mulMod } from '../sim/modifiers';
import { generateGoalie, generateSkater } from './roster';

type Arch = Exclude<Archetype, 'goalie'>;

export interface RivalTeam {
  id: string;
  name: string;
  short: string;
  color: string;
  gimmick: string;
  lineup: [Arch, Arch, Arch];
  /** tier bonus on top of act tier */
  tierBonus: number;
  mods?: (m: TeamMods) => void;
  boss?: boolean;
  act?: number; // for bosses
  phases?: BossPhase[];
}

export const RIVALS: RivalTeam[] = [
  { id: 'bruisers', name: 'Bayside Bruisers', short: 'BRUISERS', color: '#ff2d3a', gimmick: 'All muscle. +30% hit power.', lineup: ['enforcer', 'enforcer', 'playmaker'], tierBonus: 0, mods: (m) => mulMod(m, 'hitPowerMul', 1.3) },
  { id: 'ghosts', name: 'Northport Ghosts', short: 'GHOSTS', color: '#b8c4ff', gimmick: 'Fast and slippery. +12% speed.', lineup: ['speedster', 'speedster', 'sniper'], tierBonus: 0, mods: (m) => mulMod(m, 'speedMul', 1.12) },
  { id: 'snipers', name: 'Redline Snipers', short: 'SNIPERS', color: '#ff7a1a', gimmick: 'Deadly release. +30% shot accuracy.', lineup: ['sniper', 'sniper', 'playmaker'], tierBonus: 0, mods: (m) => mulMod(m, 'shotAccuracyMul', 1.3) },
  { id: 'walls', name: 'Granite Walls', short: 'WALLS', color: '#8a8f99', gimmick: 'Hard to knock down. Goalie +15% saves.', lineup: ['enforcer', 'playmaker', 'sniper'], tierBonus: 0, mods: (m) => { mulMod(m, 'hitResistMul', 1.35); mulMod(m, 'goalieSaveMul', 1.15); } },
  { id: 'wizards', name: 'Harbor Wizards', short: 'WIZARDS', color: '#8a3cff', gimmick: 'Puck magicians. Passes 30% faster.', lineup: ['playmaker', 'playmaker', 'speedster'], tierBonus: 0, mods: (m) => mulMod(m, 'passSpeedMul', 1.3) },
  { id: 'pyros', name: 'Furnace Pyros', short: 'PYROS', color: '#ffb300', gimmick: 'Catch fire fast. On Fire builds 60% faster.', lineup: ['sniper', 'speedster', 'enforcer'], tierBonus: 0, mods: (m) => mulMod(m, 'onFireGainMul', 1.6) },
  { id: 'yetis', name: 'Tundra Yetis', short: 'YETIS', color: '#2fd0c8', gimmick: 'Big bodies. +20% hit, +20% resist.', lineup: ['enforcer', 'enforcer', 'speedster'], tierBonus: 1, mods: (m) => { mulMod(m, 'hitPowerMul', 1.2); mulMod(m, 'hitResistMul', 1.2); } },
  { id: 'sharks', name: 'Vortex Sharks', short: 'SHARKS', color: '#2fa84f', gimmick: 'Relentless. Turbo regens 50% faster.', lineup: ['speedster', 'playmaker', 'enforcer'], tierBonus: 1, mods: (m) => mulMod(m, 'turboRegenMul', 1.5) },
  // BOSSES
  { id: 'boss_wrecking', name: 'The Wrecking Crew', short: 'WRECKERS', color: '#d40000', gimmick: 'BOSS. Every hit is a big hit. +60% hit power.', lineup: ['enforcer', 'enforcer', 'enforcer'], tierBonus: 1, boss: true, act: 1, mods: (m) => { mulMod(m, 'hitPowerMul', 1.6); mulMod(m, 'hitResistMul', 1.2); }, phases: [{ period: 3, kind: 'extraSkater', label: 'REINFORCEMENTS', desc: 'A fourth Wrecker jumps the boards for the third period.' }] },
  { id: 'boss_blur', name: 'Velocity Blur', short: 'BLUR', color: '#00e5ff', gimmick: 'BOSS. Infinite turbo, +15% speed.', lineup: ['speedster', 'speedster', 'sniper'], tierBonus: 2, boss: true, act: 2, mods: (m) => { mulMod(m, 'speedMul', 1.15); mulMod(m, 'turboDrainMul', 0.01); }, phases: [{ period: 2, kind: 'slickIce', label: 'ICE STORM', desc: 'The ice turns slick from the second period on. Everyone falls easier.' }, { period: 3, kind: 'turboAll', label: 'REDLINE', desc: 'Infinite turbo for everyone in the third.' }] },
  { id: 'boss_legends', name: 'The Legends', short: 'LEGENDS', color: '#ffd23f', gimmick: 'BOSS. All-star lineup. Everything is better.', lineup: ['sniper', 'enforcer', 'playmaker'], tierBonus: 3, boss: true, act: 3, mods: (m) => { mulMod(m, 'speedMul', 1.1); mulMod(m, 'hitPowerMul', 1.3); mulMod(m, 'shotAccuracyMul', 1.3); mulMod(m, 'goalieSaveMul', 1.2); mulMod(m, 'hitResistMul', 1.3); }, phases: [{ period: 0, kind: 'goalieFire', goalsAgainst: 2, label: 'THE WALL WAKES', desc: 'Score twice and their goalie catches fire for the rest of the game.' }, { period: 3, kind: 'bouncy', label: 'LEGENDS NIGHT', desc: 'Boards turn to trampolines in the third.' }] },
];
export const RIVAL_BY_ID: Record<string, RivalTeam> = Object.fromEntries(RIVALS.map((r) => [r.id, r]));

export function buildRivalRoster(rng: Rng, team: RivalTeam, tier: number): { skaters: SkaterDef[]; goalie: SkaterDef } {
  const t = tier + team.tierBonus;
  const skaters = team.lineup.map((a) => generateSkater(rng, a, t, 'opp'));
  const goalie = generateGoalie(rng, t, 'oppg');
  return { skaters, goalie };
}
