import type { MatchMods, TeamMods } from '../sim/types';
import { addMod, mulMod } from '../sim/modifiers';

export type Rarity = 'common' | 'rare' | 'epic';
export type Tag = 'FIRE' | 'IRON' | 'JET' | 'SNIPE' | 'WALL' | 'SCRAP' | 'CASH';
export const TAG_INFO: Record<Tag, { icon: string; set: string; desc: string }> = {
  FIRE: { icon: '🔥', set: 'Wildfire', desc: 'When a skater catches fire, a teammate ignites too.' },
  IRON: { icon: '🛡️', set: 'Iron Curtain', desc: 'Knockdowns never injure. +15% hit resistance.' },
  JET: { icon: '✈️', set: 'Afterburners', desc: 'Turbo regenerates twice as fast. +6% speed.' },
  SNIPE: { icon: '🎯', set: 'Dead Aim', desc: '+40% shot accuracy. Special meter fills 30% faster.' },
  WALL: { icon: '🧱', set: 'Fortress', desc: 'Your goalie starts every period with a free auto-save.' },
  SCRAP: { icon: '🥊', set: 'Goon Squad', desc: 'Fights hit 50% harder and get offered more often.' },
  CASH: { icon: '💰', set: 'Franchise', desc: 'Shop prices 25% off and +25% cash.' },
};
export const SET_SIZE = 3;

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
  tags?: Tag[];
  /** cursed perks: big upside, stated downside */
  curse?: string;
}

export const PERKS: Perk[] = [
  { id: 'turbo_junkie', name: 'Turbo Junkie', icon: '🔥', rarity: 'common', desc: 'Turbo regenerates 45% faster.', team: (m) => mulMod(m, 'turboRegenMul', 1.45), tags: ['JET'] },
  { id: 'big_tank', name: 'Big Tank', icon: '🛢️', rarity: 'common', desc: 'Turbo drains 30% slower.', team: (m) => mulMod(m, 'turboDrainMul', 0.7), tags: ['JET'] },
  { id: 'glass_cannon', name: 'Glass Cannon', icon: '💥', rarity: 'common', desc: '+30% shot power, but you get knocked down easier.', team: (m) => { mulMod(m, 'shotPowerMul', 1.3); mulMod(m, 'hitResistMul', 0.8); }, tags: ['SNIPE'] },
  { id: 'enforcers_pride', name: "Enforcer's Pride", icon: '🔨', rarity: 'common', desc: 'Big hits refill an extra 35% turbo.', team: (m) => addMod(m, 'bigHitTurboRefill', 0.35), tags: ['SCRAP', 'JET'] },
  { id: 'sniper_nest', name: 'Sniper Nest', icon: '🎯', rarity: 'common', desc: '+25% shot accuracy.', team: (m) => mulMod(m, 'shotAccuracyMul', 1.25), tags: ['SNIPE'] },
  { id: 'brick_wall', name: 'Brick Wall', icon: '🧱', rarity: 'common', desc: 'Your goalie saves 15% more often.', team: (m) => mulMod(m, 'goalieSaveMul', 1.15), tags: ['WALL'] },
  { id: 'iron_skates', name: 'Iron Skates', icon: '🛡️', rarity: 'common', desc: '+25% resistance to hits.', team: (m) => mulMod(m, 'hitResistMul', 1.25), tags: ['IRON'] },
  { id: 'heavy_hands', name: 'Heavy Hands', icon: '👊', rarity: 'common', desc: '+25% hit power.', team: (m) => mulMod(m, 'hitPowerMul', 1.25), tags: ['SCRAP'] },
  { id: 'jet_fuel', name: 'Jet Fuel', icon: '✈️', rarity: 'common', desc: '+8% skating speed.', team: (m) => mulMod(m, 'speedMul', 1.08), tags: ['JET'] },
  { id: 'tape_to_tape', name: 'Tape to Tape', icon: '🏒', rarity: 'common', desc: 'Passes travel 25% faster.', team: (m) => mulMod(m, 'passSpeedMul', 1.25), tags: ['SNIPE'] },
  { id: 'ironman', name: 'Ironman', icon: '🩹', rarity: 'common', desc: 'Injuries deal 50% less damage.', team: (m) => mulMod(m, 'injuryMul', 0.5), run: (r) => { r.injuryMul *= 0.5; }, tags: ['IRON'] },
  { id: 'merch_deal', name: 'Merch Deal', icon: '💰', rarity: 'common', desc: '+35% cash from matches.', run: (r) => { r.cashMul *= 1.35; }, tags: ['CASH'] },
  { id: 'trainer', name: 'Team Trainer', icon: '🧊', rarity: 'common', desc: 'Heal 15 HP for every skater after each node.', run: (r) => { r.healPerNode += 15; }, tags: ['IRON', 'CASH'] },
  { id: 'kindling', name: 'Kindling', icon: '🕯️', rarity: 'rare', desc: 'On Fire streaks build 50% faster.', team: (m) => mulMod(m, 'onFireGainMul', 1.5), tags: ['FIRE'] },
  { id: 'inferno', name: 'Inferno', icon: '🌋', rarity: 'rare', desc: 'On Fire lasts 60% longer.', team: (m) => mulMod(m, 'onFireDurationMul', 1.6), tags: ['FIRE'] },
  { id: 'long_bombs', name: 'Long Bombs', icon: '🚀', rarity: 'rare', desc: 'Goals from outside the blue line count double.', team: (m) => addMod(m, 'longShotBonus', 1), tags: ['SNIPE'] },
  { id: 'vampire', name: 'Bloodthirst', icon: '🧛', rarity: 'rare', desc: 'Big hits heal the hitter 10 HP.', team: (m) => addMod(m, 'hpOnBigHit', 10), tags: ['SCRAP', 'FIRE'] },
  { id: 'nitrous', name: 'Nitrous', icon: '⚗️', rarity: 'rare', desc: 'Turbo meter holds 50% more.', team: (m) => { m.turboMax = 1.5; }, tags: ['JET'] },
  { id: 'sticky_pads', name: 'Sticky Pads', icon: '🧤', rarity: 'rare', desc: 'Your goalie gives up 60% fewer rebounds.', team: (m) => mulMod(m, 'reboundMul', 0.4), tags: ['WALL'] },
  { id: 'haggler', name: 'Haggler', icon: '🤝', rarity: 'rare', desc: 'Shop prices 30% off.', run: (r) => { r.shopDiscount += 0.3; }, tags: ['CASH'] },
  { id: 'second_wind', name: 'Second Wind', icon: '❤️‍🔥', rarity: 'epic', desc: 'Survive one loss this run.', run: (r) => { r.extraLives += 1; }, tags: ['IRON'] },
  { id: 'home_ice', name: 'Home Ice', icon: '🏟️', rarity: 'epic', desc: '+10% speed, +10% hit power, +10% shot power.', team: (m) => { mulMod(m, 'speedMul', 1.1); mulMod(m, 'hitPowerMul', 1.1); mulMod(m, 'shotPowerMul', 1.1); }, tags: ['FIRE', 'WALL'] },
  { id: 'juggernaut', name: 'Juggernaut', icon: '🦏', rarity: 'epic', desc: '+50% hit power. Your hits hurt.', team: (m) => { mulMod(m, 'hitPowerMul', 1.5); mulMod(m, 'injuryMul', 1.2); }, tags: ['SCRAP', 'IRON'] },
  { id: 'two_for_one', name: 'Two For One', icon: '2️⃣', rarity: 'epic', desc: 'Every goal you score is worth 2. Every goal against too.', match: (mm) => { mm.teams[0].goalValue = 2; mm.teams[1].goalValue = 2; }, tags: ['SNIPE', 'CASH'] },
  // cursed: big upside, real downside
  { id: 'glass_jaw', name: 'Glass Jaw', icon: '🍷', rarity: 'epic', desc: '+50% shot power. Knockdowns injure you twice as much.', curse: 'Injuries ×2', tags: ['SNIPE'], team: (m) => { mulMod(m, 'shotPowerMul', 1.5); mulMod(m, 'injuryMul', 2); }, run: (r) => { r.injuryMul *= 2; } },
  { id: 'blood_money', name: 'Blood Money', icon: '🩸', rarity: 'epic', desc: '+80% cash from matches. -25% hit resistance.', curse: 'Softer skaters', tags: ['CASH', 'SCRAP'], team: (m) => mulMod(m, 'hitResistMul', 0.75), run: (r) => { r.cashMul *= 1.8; } },
  { id: 'loose_cannon', name: 'Loose Cannon', icon: '🧨', rarity: 'epic', desc: 'Fights hit twice as hard and you pick them constantly. On-fire gain +50%.', curse: 'Fights every period', tags: ['SCRAP', 'FIRE'], team: (m) => { mulMod(m, 'fightPowerMul', 2); mulMod(m, 'temperMul', 2.5); mulMod(m, 'onFireGainMul', 1.5); } },
  { id: 'overclock', name: 'Overclock', icon: '⚡', rarity: 'epic', desc: 'Special meter fills 80% faster. Turbo drains 60% faster.', curse: 'Thirsty turbo', tags: ['JET', 'SNIPE'], team: (m) => { mulMod(m, 'specialGainMul', 1.8); mulMod(m, 'turboDrainMul', 1.6); } },
  { id: 'scrapper', name: 'Scrapper', icon: '🥊', rarity: 'common', desc: 'Fights hit 25% harder.', tags: ['SCRAP'], team: (m) => mulMod(m, 'fightPowerMul', 1.25) },
  { id: 'showtime', name: 'Showtime', icon: '🎇', rarity: 'rare', desc: 'Special meter fills 35% faster.', tags: ['SNIPE', 'FIRE'], team: (m) => mulMod(m, 'specialGainMul', 1.35) },
  // meta-unlocked
  { id: 'gasoline', name: 'Gasoline', icon: '⛽', rarity: 'epic', desc: 'On Fire streaks build twice as fast.', team: (m) => mulMod(m, 'onFireGainMul', 2), unlock: 'perk_gasoline', tags: ['FIRE'] },
  { id: 'zamboni', name: 'Zamboni Crew', icon: '🚜', rarity: 'rare', desc: 'Heal 30 HP after each node.', run: (r) => { r.healPerNode += 30; }, unlock: 'perk_zamboni', tags: ['IRON'] },
  { id: 'deadeye', name: 'Deadeye', icon: '👁️', rarity: 'epic', desc: '+50% shot accuracy, +15% shot power.', team: (m) => { mulMod(m, 'shotAccuracyMul', 1.5); mulMod(m, 'shotPowerMul', 1.15); }, unlock: 'perk_deadeye', tags: ['SNIPE'] },
];

export const PERK_BY_ID: Record<string, Perk> = Object.fromEntries(PERKS.map((p) => [p.id, p]));

/** Tag counts across owned perks. */
export function tagCounts(perkIds: string[]): Partial<Record<Tag, number>> {
  const out: Partial<Record<Tag, number>> = {};
  for (const id of perkIds) for (const t of PERK_BY_ID[id]?.tags ?? []) out[t] = (out[t] ?? 0) + 1;
  return out;
}

/** Completed sets (≥ SET_SIZE of a tag). */
export function activeSets(perkIds: string[]): Tag[] {
  const c = tagCounts(perkIds);
  return (Object.keys(c) as Tag[]).filter((t) => (c[t] ?? 0) >= SET_SIZE);
}

/** Apply set bonuses to team + run effects. */
export function applySetBonuses(sets: Tag[], m: TeamMods, r: RunEffects): void {
  for (const t of sets) {
    switch (t) {
      case 'FIRE':
        m.fireSpread = true;
        break;
      case 'IRON':
        m.injuryMul = 0;
        r.injuryMul = 0;
        mulMod(m, 'hitResistMul', 1.15);
        break;
      case 'JET':
        mulMod(m, 'turboRegenMul', 2);
        mulMod(m, 'speedMul', 1.06);
        break;
      case 'SNIPE':
        mulMod(m, 'shotAccuracyMul', 1.4);
        mulMod(m, 'specialGainMul', 1.3);
        break;
      case 'WALL':
        addMod(m, 'periodBrickWall', 1);
        break;
      case 'SCRAP':
        mulMod(m, 'fightPowerMul', 1.5);
        mulMod(m, 'temperMul', 1.6);
        break;
      case 'CASH':
        r.shopDiscount += 0.25;
        r.cashMul *= 1.25;
        break;
    }
  }
}

export function defaultRunEffects(): RunEffects {
  return { extraLives: 0, cashMul: 1, healPerNode: 0, injuryMul: 1, shopDiscount: 0, freeReroll: 0, trainPerRest: 1 };
}

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 62, rare: 30, epic: 8 };
export const PERK_PRICE: Record<Rarity, number> = { common: 60, rare: 95, epic: 140 };
