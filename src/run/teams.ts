import type { Rng } from '../core/rng';
import type { Archetype, BossPhase, SkaterDef, TeamMods } from '../sim/types';
import { mulMod } from '../sim/modifiers';
import { generateGoalie, generateSkater } from './roster';
import type { GoalieStyle } from '../sim/types';

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
  /** fixed goalie style for flavour; random otherwise */
  goalieStyle?: GoalieStyle;
}

export const RIVALS: RivalTeam[] = [
  { id: 'bruisers', name: 'Bayside Bruisers', short: 'BRUISERS', color: '#ff2d3a', gimmick: 'All muscle. +30% hit power.', lineup: ['enforcer', 'enforcer', 'playmaker'], tierBonus: 0, mods: (m) => mulMod(m, 'hitPowerMul', 1.3) },
  { id: 'ghosts', name: 'Northport Ghosts', short: 'GHOSTS', color: '#b8c4ff', gimmick: 'Fast and slippery. +12% speed.', lineup: ['speedster', 'speedster', 'sniper'], tierBonus: 0, mods: (m) => mulMod(m, 'speedMul', 1.12) },
  { id: 'snipers', name: 'Redline Snipers', short: 'SNIPERS', color: '#ff7a1a', gimmick: 'Deadly release. +30% shot accuracy.', lineup: ['sniper', 'sniper', 'playmaker'], tierBonus: 0, mods: (m) => mulMod(m, 'shotAccuracyMul', 1.3) },
  { id: 'walls', name: 'Granite Walls', short: 'WALLS', color: '#8a8f99', gimmick: 'Hard to knock down. Goalie +15% saves.', lineup: ['enforcer', 'playmaker', 'sniper'], tierBonus: 0, goalieStyle: 'standup', mods: (m) => { mulMod(m, 'hitResistMul', 1.35); mulMod(m, 'goalieSaveMul', 1.15); } },
  { id: 'wizards', name: 'Harbor Wizards', short: 'WIZARDS', color: '#8a3cff', gimmick: 'Puck magicians. Passes 30% faster.', lineup: ['playmaker', 'playmaker', 'speedster'], tierBonus: 0, mods: (m) => mulMod(m, 'passSpeedMul', 1.3) },
  { id: 'pyros', name: 'Furnace Pyros', short: 'PYROS', color: '#ffb300', gimmick: 'Catch fire fast. On Fire builds 60% faster.', lineup: ['sniper', 'speedster', 'enforcer'], tierBonus: 0, mods: (m) => mulMod(m, 'onFireGainMul', 1.6) },
  { id: 'yetis', name: 'Tundra Yetis', short: 'YETIS', color: '#2fd0c8', gimmick: 'Big bodies. +20% hit, +20% resist.', lineup: ['enforcer', 'enforcer', 'speedster'], tierBonus: 1, mods: (m) => { mulMod(m, 'hitPowerMul', 1.2); mulMod(m, 'hitResistMul', 1.2); } },
  { id: 'sharks', name: 'Vortex Sharks', short: 'SHARKS', color: '#2fa84f', gimmick: 'Relentless. Turbo regens 50% faster.', lineup: ['speedster', 'playmaker', 'enforcer'], tierBonus: 1, mods: (m) => mulMod(m, 'turboRegenMul', 1.5) },
  { id: 'anvils', name: 'Ironworks Anvils', short: 'ANVILS', color: '#6b5f4a', gimmick: 'Built like bridges. +40% hit resistance, hits hurt more.', lineup: ['enforcer', 'grinder', 'sniper'], tierBonus: 1, mods: (m) => { mulMod(m, 'hitResistMul', 1.4); mulMod(m, 'hitPowerMul', 1.15); } },
  { id: 'cyclones', name: 'Cyclone Jets', short: 'CYCLONES', color: '#7fe3ff', gimmick: 'Never out of gas. Turbo regens 60% faster, +5% speed.', lineup: ['speedster', 'playmaker', 'speedster'], tierBonus: 0, mods: (m) => { mulMod(m, 'turboRegenMul', 1.6); mulMod(m, 'speedMul', 1.05); } },
  { id: 'gators', name: 'Bayou Gators', short: 'GATORS', color: '#3d8f3d', gimmick: 'Swamp goalie. +20% saves, half the rebounds.', lineup: ['playmaker', 'enforcer', 'dangler'], tierBonus: 0, goalieStyle: 'butterfly', mods: (m) => { mulMod(m, 'goalieSaveMul', 1.2); mulMod(m, 'reboundMul', 0.5); } },
  { id: 'ghouls', name: 'Graveyard Ghouls', short: 'GHOULS', color: '#b39ddb', gimmick: 'Ghoulish tempers. On Fire builds 50% faster, fights early and often.', lineup: ['sniper', 'sniper', 'enforcer'], tierBonus: 1, mods: (m) => { mulMod(m, 'onFireGainMul', 1.5); mulMod(m, 'temperMul', 1.6); } },
  // BOSSES
  { id: 'boss_wrecking', name: 'The Wrecking Crew', short: 'WRECKERS', color: '#d40000', gimmick: 'BOSS. Every hit is a big hit. +60% hit power.', lineup: ['enforcer', 'enforcer', 'enforcer'], tierBonus: 1, boss: true, act: 1, mods: (m) => { mulMod(m, 'hitPowerMul', 1.6); mulMod(m, 'hitResistMul', 1.2); }, phases: [{ period: 3, kind: 'extraSkater', label: 'REINFORCEMENTS', desc: 'A fourth Wrecker jumps the boards for the third period.' }] },
  { id: 'boss_blur', name: 'Velocity Blur', short: 'BLUR', color: '#00e5ff', gimmick: 'BOSS. Infinite turbo, +15% speed.', lineup: ['speedster', 'speedster', 'sniper'], tierBonus: 2, boss: true, act: 2, mods: (m) => { mulMod(m, 'speedMul', 1.15); mulMod(m, 'turboDrainMul', 0.01); }, phases: [{ period: 2, kind: 'slickIce', label: 'ICE STORM', desc: 'The ice turns slick from the second period on. Everyone falls easier.' }, { period: 3, kind: 'turboAll', label: 'REDLINE', desc: 'Infinite turbo for everyone in the third.' }] },
  { id: 'boss_legends', name: 'The Legends', short: 'LEGENDS', color: '#ffd23f', gimmick: 'BOSS. All-star lineup. Everything is better.', lineup: ['sniper', 'enforcer', 'playmaker'], tierBonus: 3, boss: true, act: 3, goalieStyle: 'butterfly', mods: (m) => { mulMod(m, 'speedMul', 1.1); mulMod(m, 'hitPowerMul', 1.3); mulMod(m, 'shotAccuracyMul', 1.3); mulMod(m, 'goalieSaveMul', 1.2); mulMod(m, 'hitResistMul', 1.3); }, phases: [{ period: 0, kind: 'goalieFire', goalsAgainst: 2, label: 'THE WALL WAKES', desc: 'Score twice and their goalie catches fire for the rest of the game.' }, { period: 3, kind: 'bouncy', label: 'LEGENDS NIGHT', desc: 'Boards turn to trampolines in the third.' }] },

  // ALT BOSSES (one boss per act is picked at map gen)
  { id: 'boss_maidens', name: 'The Iron Maidens', short: 'MAIDENS', color: '#9aa4b0', gimmick: 'BOSS. Nothing knocks them down. +60% hit resistance.', lineup: ['grinder', 'enforcer', 'grinder'], tierBonus: 1, boss: true, act: 1, mods: (m) => { mulMod(m, 'hitResistMul', 1.6); mulMod(m, 'injuryMul', 0.5); }, phases: [{ period: 2, kind: 'slickIce', label: 'FROZEN OVER', desc: 'Slick ice from the second period. Their balance does not care.' }] },
  { id: 'boss_carnival', name: 'Carnival Freaks', short: 'FREAKS', color: '#ff3cac', gimmick: 'BOSS. Chaos rink. Bouncy boards from the drop, specials charge fast.', lineup: ['dangler', 'speedster', 'enforcer'], tierBonus: 2, boss: true, act: 2, mods: (m) => { mulMod(m, 'specialGainMul', 1.8); mulMod(m, 'onFireGainMul', 1.3); }, phases: [{ period: 1, kind: 'bouncy', label: 'FUNHOUSE', desc: 'Boards are trampolines all night.' }, { period: 3, kind: 'turboAll', label: 'FIREWORKS', desc: 'Infinite turbo for everyone in the third.' }] },
  { id: 'boss_dynasty', name: 'The Dynasty', short: 'DYNASTY', color: '#e0c060', gimmick: 'BOSS. Champions. Their goalie ignites after one goal against.', lineup: ['dangler', 'grinder', 'sniper'], tierBonus: 3, boss: true, act: 3, goalieStyle: 'handler', mods: (m) => { mulMod(m, 'speedMul', 1.08); mulMod(m, 'shotAccuracyMul', 1.35); mulMod(m, 'goalieSaveMul', 1.15); mulMod(m, 'hitResistMul', 1.25); mulMod(m, 'turboRegenMul', 1.4); }, phases: [{ period: 0, kind: 'goalieFire', goalsAgainst: 1, label: 'THE DYNASTY ANSWERS', desc: 'One goal against and their goalie catches fire for the rest of the game.' }, { period: 3, kind: 'extraSkater', label: 'RING NIGHT', desc: 'A fourth champion joins the third period.' }] },

];
/** Boss roster for an act (one is picked per run). */
export const bossesForAct = (act: number): RivalTeam[] => RIVALS.filter((t) => t.boss && t.act === act);

export const RIVAL_BY_ID: Record<string, RivalTeam> = Object.fromEntries(RIVALS.map((r) => [r.id, r]));

export function buildRivalRoster(rng: Rng, team: RivalTeam, tier: number): { skaters: SkaterDef[]; goalie: SkaterDef } {
  const t = tier + team.tierBonus;
  const skaters = team.lineup.map((a) => generateSkater(rng, a, t, 'opp'));
  const goalie = generateGoalie(rng, t, 'oppg');
  if (team.goalieStyle) goalie.goalieStyle = team.goalieStyle;
  return { skaters, goalie };
}
