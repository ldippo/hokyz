import type { MatchMods, TeamMods } from '../sim/types';
import { addMod, mulMod } from '../sim/modifiers';

export type Rarity = 'common' | 'rare' | 'epic';

/** Run-level effects (outside the sim). */
export interface RunEffects {
  extraLives: number;
  cashMul: number;
  healPerNode: number;
  injuryMul: number; // applied to post-match hp loss carry-over
  shopDiscount: number;
  freeReroll: number;
  trainPerRest: number;
}

export interface Perk {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  desc: string;
  /** Applies to our team's sim mods. */
  team?: (m: TeamMods) => void;
  /** Applies to match-wide mods (affects both teams). */
  match?: (mm: MatchMods) => void;
  run?: (r: RunEffects) => void;
  /** Meta unlock required (id) — undefined = always in pool */
  unlock?: string;
}

export const PERKS: Perk[] = [
  { id: 'turbo_junkie', name: 'Turbo Junkie', icon: '🔥', rarity: 'common', desc: 'Turbo regenerates 45% faster.', team: (m) => mulMod(m, 'turboRegenMul', 1.45) },
  { id: 'big_tank', name: 'Big Tank', icon: '🛢️', rarity: 'common', desc: 'Turbo drains 30% slower.', team: (m) => mulMod(m, 'turboDrainMul', 0.7) },
  { id: 'glass_cannon', name: 'Glass Cannon', icon: '💥', rarity: 'common', desc: '+30% shot power, but you get knocked down easier.', team: (m) => { mulMod(m, 'shotPowerMul', 1.3); mulMod(m, 'hitResistMul', 0.8); } },
  { id: 'enforcers_pride', name: "Enforcer's Pride", icon: '🔨', rarity: 'common', desc: 'Big hits refill an extra 35% turbo.', team: (m) => addMod(m, 'bigHitTurboRefill', 0.35) },
  { id: 'sniper_nest', name: 'Sniper Nest', icon: '🎯', rarity: 'common', desc: '+25% shot accuracy.', team: (m) => mulMod(m, 'shotAccuracyMul', 1.25) },
  { id: 'brick_wall', name: 'Brick Wall', icon: '🧱', rarity: 'common', desc: 'Your goalie saves 15% more often.', team: (m) => mulMod(m, 'goalieSaveMul', 1.15) },
  { id: 'iron_skates', name: 'Iron Skates', icon: '🛡️', rarity: 'common', desc: '+25% resistance to hits.', team: (m) => mulMod(m, 'hitResistMul', 1.25) },
  { id: 'heavy_hands', name: 'Heavy Hands', icon: '👊', rarity: 'common', desc: '+25% hit power.', team: (m) => mulMod(m, 'hitPowerMul', 1.25) },
  { id: 'jet_fuel', name: 'Jet Fuel', icon: '✈️', rarity: 'common', desc: '+8% skating speed.', team: (m) => mulMod(m, 'speedMul', 1.08) },
  { id: 'tape_to_tape', name: 'Tape to Tape', icon: '🏒', rarity: 'common', desc: 'Passes travel 25% faster.', team: (m) => mulMod(m, 'passSpeedMul', 1.25) },
  { id: 'ironman', name: 'Ironman', icon: '🩹', rarity: 'common', desc: 'Injuries deal 50% less damage.', team: (m) => mulMod(m, 'injuryMul', 0.5), run: (r) => { r.injuryMul *= 0.5; } },
  { id: 'merch_deal', name: 'Merch Deal', icon: '💰', rarity: 'common', desc: '+35% cash from matches.', run: (r) => { r.cashMul *= 1.35; } },
  { id: 'trainer', name: 'Team Trainer', icon: '🧊', rarity: 'common', desc: 'Heal 15 HP for every skater after each node.', run: (r) => { r.healPerNode += 15; } },
  { id: 'kindling', name: 'Kindling', icon: '🕯️', rarity: 'rare', desc: 'On Fire streaks build 50% faster.', team: (m) => mulMod(m, 'onFireGainMul', 1.5) },
  { id: 'inferno', name: 'Inferno', icon: '🌋', rarity: 'rare', desc: 'On Fire lasts 60% longer.', team: (m) => mulMod(m, 'onFireDurationMul', 1.6) },
  { id: 'long_bombs', name: 'Long Bombs', icon: '🚀', rarity: 'rare', desc: 'Goals from outside the blue line count double.', team: (m) => addMod(m, 'longShotBonus', 1) },
  { id: 'vampire', name: 'Bloodthirst', icon: '🧛', rarity: 'rare', desc: 'Big hits heal the hitter 10 HP.', team: (m) => addMod(m, 'hpOnBigHit', 10) },
  { id: 'nitrous', name: 'Nitrous', icon: '⚗️', rarity: 'rare', desc: 'Turbo meter holds 50% more.', team: (m) => { m.turboMax = 1.5; } },
  { id: 'sticky_pads', name: 'Sticky Pads', icon: '🧤', rarity: 'rare', desc: 'Your goalie gives up 60% fewer rebounds.', team: (m) => mulMod(m, 'reboundMul', 0.4) },
  { id: 'haggler', name: 'Haggler', icon: '🤝', rarity: 'rare', desc: 'Shop prices 30% off.', run: (r) => { r.shopDiscount += 0.3; } },
  { id: 'second_wind', name: 'Second Wind', icon: '❤️‍🔥', rarity: 'epic', desc: 'Survive one loss this run.', run: (r) => { r.extraLives += 1; } },
  { id: 'home_ice', name: 'Home Ice', icon: '🏟️', rarity: 'epic', desc: '+10% speed, +10% hit power, +10% shot power.', team: (m) => { mulMod(m, 'speedMul', 1.1); mulMod(m, 'hitPowerMul', 1.1); mulMod(m, 'shotPowerMul', 1.1); } },
  { id: 'juggernaut', name: 'Juggernaut', icon: '🦏', rarity: 'epic', desc: '+50% hit power. Your hits hurt.', team: (m) => { mulMod(m, 'hitPowerMul', 1.5); mulMod(m, 'injuryMul', 1.2); } },
  { id: 'two_for_one', name: 'Two For One', icon: '2️⃣', rarity: 'epic', desc: 'Every goal you score is worth 2. Every goal against too.', match: (mm) => { mm.teams[0].goalValue = 2; mm.teams[1].goalValue = 2; } },
  // meta-unlocked
  { id: 'gasoline', name: 'Gasoline', icon: '⛽', rarity: 'epic', desc: 'On Fire streaks build twice as fast.', team: (m) => mulMod(m, 'onFireGainMul', 2), unlock: 'perk_gasoline' },
  { id: 'zamboni', name: 'Zamboni Crew', icon: '🚜', rarity: 'rare', desc: 'Heal 30 HP after each node.', run: (r) => { r.healPerNode += 30; }, unlock: 'perk_zamboni' },
  { id: 'deadeye', name: 'Deadeye', icon: '👁️', rarity: 'epic', desc: '+50% shot accuracy, +15% shot power.', team: (m) => { mulMod(m, 'shotAccuracyMul', 1.5); mulMod(m, 'shotPowerMul', 1.15); }, unlock: 'perk_deadeye' },
];

export const PERK_BY_ID: Record<string, Perk> = Object.fromEntries(PERKS.map((p) => [p.id, p]));

export function defaultRunEffects(): RunEffects {
  return { extraLives: 0, cashMul: 1, healPerNode: 0, injuryMul: 1, shopDiscount: 0, freeReroll: 0, trainPerRest: 1 };
}

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 62, rare: 30, epic: 8 };
export const PERK_PRICE: Record<Rarity, number> = { common: 60, rare: 95, epic: 140 };
