import type { Rng } from '../core/rng';
import type { Archetype, SkaterDef, Stats } from '../sim/types';

export const ARCHETYPES: Record<Exclude<Archetype, 'goalie'>, { label: string; icon: string; base: Stats; blurb: string }> = {
  sniper: { label: 'Sniper', icon: '🎯', base: { speed: 6, shot: 8, hands: 7, hit: 3, balance: 4, stamina: 6 }, blurb: 'Lethal release. Charge it up, pick a corner.' },
  enforcer: { label: 'Enforcer', icon: '🔨', base: { speed: 5, shot: 4, hands: 3, hit: 9, balance: 8, stamina: 6 }, blurb: 'Lays out anything that moves. Hard to knock down.' },
  playmaker: { label: 'Playmaker', icon: '🧠', base: { speed: 6, shot: 6, hands: 8, hit: 4, balance: 5, stamina: 7 }, blurb: 'Tape-to-tape passes, wins draws, slick dekes.' },
  speedster: { label: 'Speedster', icon: '⚡', base: { speed: 9, shot: 5, hands: 6, hit: 3, balance: 4, stamina: 8 }, blurb: 'Blur on skates. Turbo for days.' },
};
export const GOALIE_BASE: Stats = { speed: 5, shot: 3, hands: 6, hit: 4, balance: 8, stamina: 6 };

const FIRST = ['Gord', 'Wendel', 'Tie', 'Dutch', 'Moose', 'Brick', 'Sal', 'Rocco', 'Bo', 'Flash', 'Duke', 'Rip', 'Sully', 'Tank', 'Mack', 'Ace', 'Boomer', 'Hoss', 'Slick', 'Trigger', 'Vern', 'Lars', 'Nico', 'Yuri', 'Deke', 'Bones', 'Pepper', 'Rudy', 'Zeke', 'Cosmo', 'Jinx', 'Kip', 'Ozzie', 'Remy', 'Sasha', 'Tuck'];
const LAST = ['Bricker', 'Hammerlund', 'Vasquez', 'Oduya', 'Kowalski', 'Tremblay', 'Ironside', 'Blaze', 'Kettleburn', 'Stonewall', 'Rakoczy', 'Mbeki', 'Halvorsen', 'Sato', 'Delgado', 'Crashman', 'Petrov', 'McGraw', 'Slapinski', 'Bodycheck', 'Fontaine', 'Guzman', 'Lindqvist', 'Nakamura', 'Rourke', 'Tanaka', 'Vukovic', 'Wexler', 'Zamboni', 'Frostbite', 'Puckett', 'Sniperov'];

export interface Trait {
  id: string;
  name: string;
  desc: string;
  stats?: Partial<Stats>;
}
export const TRAITS: Trait[] = [
  { id: 'ironjaw', name: 'Iron Jaw', desc: '+2 balance', stats: { balance: 2 } },
  { id: 'hothands', name: 'Hot Hands', desc: '+2 hands', stats: { hands: 2 } },
  { id: 'cannon', name: 'Cannon', desc: '+2 shot', stats: { shot: 2 } },
  { id: 'jets', name: 'Jets', desc: '+2 speed', stats: { speed: 2 } },
  { id: 'brawler', name: 'Brawler', desc: '+2 hit', stats: { hit: 2 } },
  { id: 'lungs', name: 'Big Lungs', desc: '+2 stamina', stats: { stamina: 2 } },
  { id: 'glass', name: 'Glass Ankles', desc: '-2 balance, +1 shot, +1 speed', stats: { balance: -2, shot: 1, speed: 1 } },
  { id: 'goon', name: 'Goon', desc: '+3 hit, -2 hands', stats: { hit: 3, hands: -2 } },
];

let uid = 0;
export function newId(prefix = 'sk'): string {
  uid++;
  return `${prefix}_${Date.now().toString(36)}_${uid}_${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function clampStats(s: Stats): Stats {
  const c = (v: number) => Math.max(1, Math.min(10, Math.round(v)));
  return { speed: c(s.speed), shot: c(s.shot), hands: c(s.hands), hit: c(s.hit), balance: c(s.balance), stamina: c(s.stamina) };
}

export function randomName(rng: Rng): string {
  return `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
}

/** tier 0 = rookie, 1 = solid, 2 = star, 3 = legend. */
export function generateSkater(rng: Rng, archetype: Exclude<Archetype, 'goalie'>, tier = 0, idPrefix = 'sk'): SkaterDef {
  const base = ARCHETYPES[archetype].base;
  const stats: Stats = { ...base };
  for (const k of Object.keys(stats) as (keyof Stats)[]) {
    stats[k] += rng.int(-1, 1) + tier * 0.6 + (rng.next() < 0.3 ? tier : 0);
  }
  const traits: string[] = [];
  if (rng.next() < 0.45 + tier * 0.2) {
    const t = rng.pick(TRAITS);
    traits.push(t.id);
    if (t.stats) for (const k of Object.keys(t.stats) as (keyof Stats)[]) stats[k] += t.stats[k] ?? 0;
  }
  return { id: newId(idPrefix), name: randomName(rng), archetype, stats: clampStats(stats), traits, hp: 100, maxHp: 100 };
}

export function generateGoalie(rng: Rng, tier = 0, idPrefix = 'g'): SkaterDef {
  const stats: Stats = { ...GOALIE_BASE };
  stats.hands += rng.int(-1, 1) + tier;
  stats.speed += rng.int(-1, 1) + tier * 0.5;
  stats.balance += rng.int(0, 1);
  return { id: newId(idPrefix), name: randomName(rng), archetype: 'goalie', stats: clampStats(stats), traits: [], hp: 100, maxHp: 100 };
}

export function randomArchetype(rng: Rng): Exclude<Archetype, 'goalie'> {
  return rng.pick(['sniper', 'enforcer', 'playmaker', 'speedster'] as const);
}

export const INJURED_THRESHOLD = 20;
export const isInjured = (s: SkaterDef): boolean => s.hp <= INJURED_THRESHOLD;

export function statLine(s: Stats): string {
  return `SPD ${s.speed} · SHT ${s.shot} · HND ${s.hands} · HIT ${s.hit} · BAL ${s.balance} · STA ${s.stamina}`;
}
