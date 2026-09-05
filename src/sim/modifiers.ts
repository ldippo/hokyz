import type { MatchMods, TeamMods } from './types';
import { RULES } from './constants';

export function defaultTeamMods(): TeamMods {
  return {
    speedMul: 1,
    accelMul: 1,
    turboRegenMul: 1,
    turboDrainMul: 1,
    turboMax: 1,
    shotPowerMul: 1,
    shotAccuracyMul: 1,
    hitPowerMul: 1,
    hitResistMul: 1,
    injuryMul: 1,
    goalieSaveMul: 1,
    passSpeedMul: 1,
    onFireGainMul: 1,
    onFireDurationMul: 1,
    bigHitTurboRefill: 0,
    longShotBonus: 0,
    goalValue: 1,
    hpOnBigHit: 0,
    reboundMul: 1,
    staminaMul: 1,
  };
}

export function defaultMatchMods(): MatchMods {
  return {
    noGoalies: false,
    periodLength: RULES.periodLength,
    periods: RULES.periods,
    turboInfinite: false,
    puckFrictionMul: 1,
    boardsBouncy: false,
    slipperyIce: false,
    suddenDeath: false,
    mercyRule: 0,
    teams: [defaultTeamMods(), defaultTeamMods()],
  };
}

/** Multiplicative merge helper for perk application. */
export function mulMod(m: TeamMods, key: keyof TeamMods, factor: number): void {
  (m[key] as number) *= factor;
}
export function addMod(m: TeamMods, key: keyof TeamMods, amount: number): void {
  (m[key] as number) += amount;
}
