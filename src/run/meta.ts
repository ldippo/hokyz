import type { Archetype, Stats } from '../sim/types';

export interface Captain {
  id: string;
  name: string;
  archetype: Exclude<Archetype, 'goalie'>;
  stats: Stats;
  traits: string[];
  blurb: string;
  cost: number; // 0 = starter
  icon: string;
}

export const CAPTAINS: Captain[] = [
  { id: 'cap_bricker', name: 'Moose Bricker', archetype: 'enforcer', stats: { speed: 5, shot: 4, hands: 4, hit: 10, balance: 9, stamina: 6 }, traits: ['ironjaw'], blurb: 'Nobody skates through Moose. Nobody.', cost: 0, icon: '🔨' },
  { id: 'cap_flash', name: 'Flash Halvorsen', archetype: 'speedster', stats: { speed: 10, shot: 5, hands: 6, hit: 3, balance: 4, stamina: 9 }, traits: ['jets'], blurb: 'Blink and she is behind the net.', cost: 0, icon: '⚡' },
  { id: 'cap_sniperov', name: 'Ace Sniperov', archetype: 'sniper', stats: { speed: 6, shot: 10, hands: 7, hit: 3, balance: 4, stamina: 6 }, traits: ['cannon'], blurb: 'Top shelf, where mama keeps the cookies.', cost: 300, icon: '🎯' },
  { id: 'cap_wizard', name: 'Slick Fontaine', archetype: 'playmaker', stats: { speed: 7, shot: 6, hands: 10, hit: 4, balance: 5, stamina: 7 }, traits: ['hothands'], blurb: 'Has never lost a faceoff, allegedly.', cost: 300, icon: '🧠' },
  { id: 'cap_tank', name: 'Tank Zamboni', archetype: 'enforcer', stats: { speed: 4, shot: 6, hands: 3, hit: 10, balance: 10, stamina: 8 }, traits: ['goon', 'ironjaw'], blurb: 'Part man, part resurfacer.', cost: 600, icon: '🚜' },
];

export interface Unlockable {
  id: string;
  name: string;
  desc: string;
  cost: number;
  kind: 'perk' | 'rink' | 'ascension';
  icon: string;
}
export const UNLOCKABLES: Unlockable[] = [
  { id: 'perk_zamboni', name: 'Perk: Zamboni Crew', desc: 'Adds Zamboni Crew (heal 30/node) to the perk pool.', cost: 200, kind: 'perk', icon: '🚜' },
  { id: 'perk_gasoline', name: 'Perk: Gasoline', desc: 'Adds Gasoline (2× On Fire gain) to the perk pool.', cost: 350, kind: 'perk', icon: '⛽' },
  { id: 'perk_deadeye', name: 'Perk: Deadeye', desc: 'Adds Deadeye (+50% accuracy) to the perk pool.', cost: 350, kind: 'perk', icon: '👁️' },
  { id: 'rink_neon', name: 'Rink: Neon Dome', desc: 'Purple lights, loud crowd. Cosmetic.', cost: 250, kind: 'rink', icon: '🟣' },
  { id: 'rink_frost', name: 'Rink: Frostbite Arena', desc: 'Outdoor ice, teal glow. Cosmetic.', cost: 250, kind: 'rink', icon: '🧊' },
  { id: 'asc_1', name: 'Ascension 1', desc: 'Opponents +1 tier. +25% cash.', cost: 400, kind: 'ascension', icon: '🔺' },
  { id: 'asc_2', name: 'Ascension 2', desc: 'Opponents +2 tiers, no base heal. +50% cash.', cost: 800, kind: 'ascension', icon: '🔻' },
];

export interface RinkTheme {
  id: string;
  name: string;
  bg: number;
  crowd: number[];
  kick: number;
  hemi: number;
  spot: number;
  banners: string[];
}
export const RINK_THEMES: Record<string, RinkTheme> = {
  classic: { id: 'classic', name: 'Classic Barn', bg: 0x07070c, crowd: [0xd8262f, 0x1c4fd6, 0xffffff, 0x222222, 0xe8b021, 0x2fa84f, 0x8844cc], kick: 0xe8b021, hemi: 0xcfe8ff, spot: 0xfff2dd, banners: ['HOKYZ CUP 1998', 'RETIRED #88 BRICKER', 'BIG HITZ NIGHT', 'ZAMBONI CO.'] },
  rink_neon: { id: 'rink_neon', name: 'Neon Dome', bg: 0x0d0418, crowd: [0xff2bd6, 0x8a3cff, 0x00e5ff, 0x111111, 0xffffff], kick: 0xff2bd6, hemi: 0xd8b8ff, spot: 0xc06cff, banners: ['NEON DOME', 'LOUDEST BARN', 'GLOW NIGHT', 'RAGE FUEL'] },
  rink_frost: { id: 'rink_frost', name: 'Frostbite Arena', bg: 0x061418, crowd: [0x2fd0c8, 0xffffff, 0x1c4fd6, 0x88ccff, 0x223344], kick: 0x2fd0c8, hemi: 0xbfffff, spot: 0xbfffff, banners: ['FROSTBITE ARENA', 'OUTDOOR CLASSIC', 'TUNDRA YETIS', 'ICE BATH'] },
};

export interface MetaProfile {
  version: 1;
  cash: number;
  unlocked: string[]; // captain ids + unlockable ids
  runs: number;
  wins: number;
  bestAct: number;
  bestRow: number;
  totalGoals: number;
  totalBigHits: number;
  selectedRink: string;
  volume: number;
  seenIntro: boolean;
  /** 'auto' picks by GPU probe + watchdog */
  quality: 'auto' | 'low' | 'med' | 'high';
  cinematics: boolean;
  screenShake: boolean;
  hitFx: boolean;
  music: boolean;
}

export function defaultMeta(): MetaProfile {
  return { version: 1, cash: 0, unlocked: ['cap_bricker', 'cap_flash'], runs: 0, wins: 0, bestAct: 0, bestRow: 0, totalGoals: 0, totalBigHits: 0, selectedRink: 'classic', volume: 0.7, seenIntro: false, quality: 'auto', cinematics: true, screenShake: true, hitFx: true, music: true };
}

export const isUnlocked = (m: MetaProfile, id: string): boolean => m.unlocked.includes(id);
export const ascensionLevel = (m: MetaProfile): number => (isUnlocked(m, 'asc_2') ? 2 : isUnlocked(m, 'asc_1') ? 1 : 0);
