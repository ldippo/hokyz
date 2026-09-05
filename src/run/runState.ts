import { Rng, hashSeed } from '../core/rng';
import { migrateRun } from '../core/save';
import type { MatchMods, SkaterDef, TeamMods, GoalieStyle } from '../sim/types';
import { defaultMatchMods, defaultTeamMods } from '../sim/modifiers';
import { findNode, generateAct, generateRunMap, type ActMap, type MapNode } from './mapGen';
import type { BossPhase } from '../sim/types';
import { CAPTAINS, type Captain } from './meta';
import { PERKS, PERK_BY_ID, RARITY_WEIGHT, activeSets, applySetBonuses, defaultRunEffects, type Perk, type Rarity, type RunEffects } from './perks';
import { generateGoalie, generateSkater, isInjured, levelFor, newId, randomArchetype, xpForMatch, MAX_LEVEL } from './roster';
import { RIVAL_BY_ID, RIVALS, buildRivalRoster } from './teams';
import { MUTATOR_BY_ID } from './mutators';

export interface RunState {
  version: 1;
  seed: number;
  seedText: string;
  rngState: number;
  ascension: number;
  captainId: string;
  teamName: string;
  teamShort: string;
  teamColor: string;
  teamLogo: string;
  /** chosen starters (ids); healthy ones start, bench fills in */
  lineupIds: string[];
  maps: ActMap[];
  act: number;
  row: number; // next row to play (0 = start)
  currentNodeId: string | null; // node being played / just completed
  /** ids of nodes visited in order */
  path: string[];
  roster: SkaterDef[]; // index 0 = captain; first 3 healthy = lineup
  goalie: SkaterDef;
  perks: string[];
  cash: number;
  livesUsed: number;
  matchesWon: number;
  matchesPlayed: number;
  goalsFor: number;
  goalsAgainst: number;
  bigHits: number;
  flags: { easyNext?: boolean; hardNext?: boolean; betNext?: boolean; scoutedBoss?: boolean; unlockedPerks: string[] };
  /** rivals we beat this run: they come back angrier */
  grudges: Record<string, { beaten: number; act: number }>;
  /** weekly-seed run (records tracked separately) */
  weekly?: string | null;
  /** Overtime League: acts played past the act-3 boss */
  league?: number;
  /** an act just ended past the base run: bank the win or keep skating */
  leagueOffer?: boolean;
  over: boolean;
  won: boolean;
}

export interface TeamIdentity {
  name: string;
  short: string;
  color: string;
  logo: string;
}

export const TEAM_NAMES = ['Iron Elks', 'Rust Belt Rhinos', 'Midnight Owls', 'Junkyard Dogs', 'Thunder Moose', 'Backalley Bandits', 'Frostbite Foxes', 'Harbor Hammers', 'Coal Town Crows', 'Delta Devils'];
export const TEAM_COLORS = ['#2f6bff', '#d8262f', '#2fa84f', '#ffd23f', '#8a3cff', '#ff7a1a', '#00b8d4', '#ffffff', '#111111', '#ff3cac'];
export const TEAM_LOGOS = ['circle', 'shield', 'diamond', 'star', 'hex'];
export function shortFor(name: string): string {
  const words = name.trim().split(/\s+/);
  const w = (words[words.length - 1] || 'TEAM').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return w.slice(0, 8) || 'TEAM';
}

export function newRun(seedText: string, captain: Captain, ascension: number, unlockedPerks: string[], identity?: Partial<TeamIdentity>, goalieStyle: GoalieStyle | null = null): RunState {
  const seed = hashSeed(seedText || String(Date.now()));
  const rng = new Rng(seed);
  const maps = generateRunMap(rng.fork(), 3);
  const cap: SkaterDef = { id: newId('cap'), name: captain.name, archetype: captain.archetype, stats: { ...captain.stats }, traits: [...captain.traits], hp: 100, maxHp: 100 };
  const roster = [cap];
  const a1 = randomArchetype(rng);
  let a2 = randomArchetype(rng);
  if (a2 === a1) a2 = randomArchetype(rng);
  roster.push(generateSkater(rng, a1, 0), generateSkater(rng, a2, 0));
  roster.push(generateSkater(rng, randomArchetype(rng), 0)); // bench
  const goalie = generateGoalie(rng, 0);
  if (goalieStyle) goalie.goalieStyle = goalieStyle;
  const ni = rng.int(0, TEAM_NAMES.length - 1);
  const name = identity?.name?.trim() || TEAM_NAMES[ni];
  return {
    version: 1,
    seed,
    seedText,
    rngState: rng.state,
    ascension,
    captainId: captain.id,
    teamName: name,
    teamShort: identity?.short || shortFor(name),
    teamColor: identity?.color || '#2f6bff',
    teamLogo: identity?.logo || TEAM_LOGOS[ni % TEAM_LOGOS.length],
    lineupIds: roster.slice(0, 3).map((s) => s.id),
    maps,
    act: 1,
    row: 0,
    currentNodeId: null,
    path: [],
    roster,
    goalie,
    perks: [],
    cash: 40,
    livesUsed: 0,
    matchesWon: 0,
    matchesPlayed: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    bigHits: 0,
    flags: { unlockedPerks },
    grudges: {},
    over: false,
    won: false,
  };
}

export function runRng(run: RunState): Rng {
  const r = new Rng(run.rngState);
  return r;
}
export function commitRng(run: RunState, rng: Rng): void {
  run.rngState = rng.state;
}

export function currentAct(run: RunState): ActMap {
  return run.maps[run.act - 1];
}

/** Nodes the player can pick next. */
export function availableNodes(run: RunState): MapNode[] {
  const act = currentAct(run);
  if (run.row >= act.rows.length) return [];
  if (run.row === 0) return act.rows[0];
  const prev = run.currentNodeId ? findNode(run.maps, run.currentNodeId) : null;
  if (!prev || prev.act !== run.act) return act.rows[run.row];
  return act.rows[run.row].filter((n) => prev.next.includes(n.id));
}

export function runEffects(run: RunState): RunEffects {
  const e = defaultRunEffects();
  for (const id of run.perks) PERK_BY_ID[id]?.run?.(e);
  applySetBonuses(activeSets(run.perks), defaultTeamMods(), e);
  if (run.ascension >= 1) e.cashMul *= 1.25;
  if (run.ascension >= 2) e.cashMul *= 1.2;
  if (run.ascension >= 3) e.cashMul *= 1.15;
  if (run.ascension >= 4) e.cashMul *= 1.15;
  if (run.ascension >= 5) e.cashMul *= 1.15;
  if ((run.league ?? 0) > 0) e.cashMul *= 1 + 0.25 * (run.league ?? 0);
  return e;
}

export function teamMods(run: RunState): TeamMods {
  const m = defaultTeamMods();
  for (const id of run.perks) PERK_BY_ID[id]?.team?.(m);
  applySetBonuses(activeSets(run.perks), m, defaultRunEffects());
  return m;
}

export function lineup(run: RunState): SkaterDef[] {
  const ids = run.lineupIds ?? [];
  const chosen = ids.map((id) => run.roster.find((s) => s.id === id)).filter((s): s is SkaterDef => !!s && !isInjured(s));
  const rest = run.roster.filter((s) => !chosen.includes(s));
  const healthyRest = rest.filter((s) => !isInjured(s));
  const injured = rest.filter((s) => isInjured(s));
  return [...chosen, ...healthyRest, ...injured].slice(0, 3);
}

/** Toggle a skater into/out of the starting three. Returns false if the change is not allowed. */
export function toggleStarter(run: RunState, id: string): boolean {
  run.lineupIds ??= [];
  const s = run.roster.find((x) => x.id === id);
  if (!s) return false;
  if (run.lineupIds.includes(id)) {
    run.lineupIds = run.lineupIds.filter((x) => x !== id);
    return true;
  }
  if (isInjured(s)) return false;
  if (run.lineupIds.length >= 3) run.lineupIds.shift();
  run.lineupIds.push(id);
  return true;
}

export function cutValue(s: SkaterDef): number {
  return 15 + (s.level ?? 0) * 10;
}

/** Release a non-captain skater for cash. Needs at least 3 skaters left. */
export function cutSkater(run: RunState, id: string): number {
  const idx = run.roster.findIndex((s) => s.id === id);
  if (idx <= 0 || run.roster.length <= 3) return 0;
  const [s] = run.roster.splice(idx, 1);
  run.lineupIds = (run.lineupIds ?? []).filter((x) => x !== id);
  const cash = cutValue(s);
  run.cash += cash;
  return cash;
}

export function nodeTier(run: RunState, node: MapNode): number {
  let t = run.act - 1 + (node.type === 'elite' ? 1 : 0) + (node.type === 'boss' ? 1 : 0);
  t += run.ascension;
  return Math.min(run.act >= 4 ? 6 : 4, t);
}
export function nodeDifficulty(run: RunState, node: MapNode): number {
  let d = run.act - 1 + (node.type === 'elite' ? 1 : 0) + (node.type === 'boss' ? 1 : 0);
  if (run.ascension > 0) d += 1;
  if (run.flags.easyNext) d -= 1;
  if (run.flags.hardNext) d += 1;
  return Math.max(0, Math.min(3, d));
}

export interface MatchSetupBundle {
  home: { name: string; short: string; color: string; skaters: SkaterDef[]; goalie: SkaterDef; logo?: string };
  away: { name: string; short: string; color: string; skaters: SkaterDef[]; goalie: SkaterDef; gimmick: string; difficulty: number; rivalId: string; grudge: number; taunt: string | null };
  mods: MatchMods;
  mutatorName: string | null;
  seed: number;
}

export function buildMatch(run: RunState, node: MapNode): MatchSetupBundle {
  const rng = runRng(run);
  const rival = RIVAL_BY_ID[node.rivalId ?? 'bruisers'];
  const grudge = (run.grudges ?? {})[rival.id]?.beaten ?? 0;
  const opp = buildRivalRoster(rng, rival, nodeTier(run, node) + Math.min(2, grudge));
  const taunt = grudge ? rng.pick(TAUNTS).replace('{team}', rival.name) : null;
  const mods = defaultMatchMods();
  mods.teams[0] = teamMods(run);
  rival.mods?.(mods.teams[1]);
  for (const id of run.perks) PERK_BY_ID[id]?.match?.(mods);
  let mutatorName: string | null = null;
  if (node.mutatorId) {
    const mu = MUTATOR_BY_ID[node.mutatorId];
    mu.apply(mods);
    mutatorName = mu.name;
  }
  if (node.type === 'boss') {
    mods.teams[1].speedMul *= 1.05;
    mods.bossPhases = (rival.phases ?? []).map((p) => ({ ...p, applied: false }));
    const stacks = (run.ascension >= 5 ? 1 : 0) + (run.act >= 4 ? 1 : 0);
    for (let i = 0; i < stacks; i++) {
      const extra = extraBossPhase(rng, mods.bossPhases);
      if (extra) mods.bossPhases.push({ ...extra, label: `${run.act >= 4 && i === stacks - 1 ? 'OVERTIME RULES' : 'ASCENSION RULES'} · ${extra.label}` });
    }
    if (mods.bossPhases.some((p) => p.kind === 'extraSkater')) mods.extraSkater = generateSkater(rng, 'enforcer', nodeTier(run, node) + 1, 'opp');
  }
  if (run.flags.easyNext) mods.teams[1].turboRegenMul *= 0.6;
  if (run.flags.hardNext) mods.teams[1].hitPowerMul *= 1.2;
  if (run.flags.scoutedBoss && node.type === 'boss') mods.teams[1].speedMul *= 0.9;
  if (grudge) {
    mods.teams[1].hitPowerMul *= 1 + 0.1 * grudge;
    mods.teams[1].onFireGainMul *= 1 + 0.15 * grudge;
  }
  const seed = rng.int(1, 1e9);
  commitRng(run, rng);
  return {
    home: { name: run.teamName, short: run.teamShort, color: run.teamColor, skaters: lineup(run), goalie: run.goalie, logo: run.teamLogo },
    away: { name: rival.name, short: rival.short, color: rival.color, skaters: opp.skaters, goalie: opp.goalie, gimmick: rival.gimmick, difficulty: nodeDifficulty(run, node), rivalId: rival.id, grudge, taunt },
    mods,
    mutatorName,
    seed,
  };
}

export interface MatchOutcome {
  won: boolean;
  scoreFor: number;
  scoreAgainst: number;
  bigHits: number;
  fightsWon?: number;
  specialsUsed?: number;
  ankleBreakers?: number;
  bigSaves?: number;
  /** shots blocked by the home team's skaters */
  blocks?: number;
  shootoutWon?: boolean;
  topCornerGoals?: number;
  /** hp by roster skater id after the match */
  hp: Record<string, number>;
  boxScore: { id: string; name: string; team: 0 | 1; goals: number; assists: number; hits: number; bigHits: number; shots: number; saves: number; blocks?: number; isGoalie: boolean }[];
}

export function cashForNode(run: RunState, node: MapNode, outcome: MatchOutcome): number {
  const e = runEffects(run);
  const base = node.type === 'boss' ? 160 : node.type === 'elite' ? 95 : 55;
  const bonus = Math.max(0, outcome.scoreFor - outcome.scoreAgainst) * 6 + outcome.bigHits * 2;
  const grudge = node.rivalId ? ((run.grudges ?? {})[node.rivalId]?.beaten ?? 0) : 0;
  const bounty = grudge ? 1 + 0.5 * grudge : 1;
  const bet = run.flags.betNext ? 2 : 1;
  return Math.round((base + bonus) * e.cashMul * bounty * bet);
}

const TAUNTS = [
  'Remember us? {team} remembers you.',
  '{team} did not come here to lose twice.',
  'Word is you beat {team}. Word is wrong tonight.',
  '{team} skated laps all week thinking about you.',
  'Nobody beats {team} and gets a quiet bus ride home.',
];

/** When a new act opens, half its match nodes bring back rivals we already beat. */
export function reassignActRivals(run: RunState): void {
  const beaten = Object.keys(run.grudges ?? {});
  if (!beaten.length) return;
  const rng = runRng(run);
  const act = currentAct(run);
  const nodes = act.rows.flat().filter((n) => (n.type === 'match' || n.type === 'elite') && n.rivalId);
  const picks = rng.shuffle([...nodes]).slice(0, Math.max(1, Math.floor(nodes.length / 2)));
  for (const n of picks) n.rivalId = rng.pick(beaten);
  commitRng(run, rng);
  void RIVALS;
}

/** Apply match result. Returns { cash, ended } */
export function applyMatchOutcome(run: RunState, node: MapNode, outcome: MatchOutcome): { cash: number; ended: boolean; usedLife: boolean } {
  const e = runEffects(run);
  run.matchesPlayed++;
  // skater XP + level-ups (spent at the next node)
  for (const b of outcome.boxScore) {
    if (b.team !== 0) continue;
    const s = run.roster.find((x) => x.id === b.id) ?? (run.goalie.id === b.id ? run.goalie : null);
    if (!s) continue;
    const before = s.level ?? 0;
    s.xp = (s.xp ?? 0) + xpForMatch(b, s === run.roster[0]);
    const after = Math.min(MAX_LEVEL, levelFor(s.xp));
    if (after > before) {
      s.pendingLevels = (s.pendingLevels ?? 0) + (after - before);
      s.level = after;
    }
  }
  run.goalsFor += outcome.scoreFor;
  run.goalsAgainst += outcome.scoreAgainst;
  run.bigHits += outcome.bigHits;
  // carry injuries
  for (const s of run.roster) {
    if (outcome.hp[s.id] !== undefined) {
      const lost = (s.hp - outcome.hp[s.id]) * e.injuryMul;
      s.hp = Math.max(0, Math.round(s.hp - lost));
    }
  }
  let cash = 0;
  let usedLife = false;
  if (outcome.won) {
    run.matchesWon++;
    cash = cashForNode(run, node, outcome);
    run.cash += cash;
    if (node.rivalId && node.type !== 'boss') {
      run.grudges ??= {};
      const g = run.grudges[node.rivalId] ?? { beaten: 0, act: run.act };
      g.beaten++;
      g.act = run.act;
      run.grudges[node.rivalId] = g;
    }
  } else if (run.flags.betNext) {
    run.cash = Math.max(0, run.cash - 40);
  }
  run.flags.easyNext = false;
  run.flags.hardNext = false;
  run.flags.betNext = false;
  if (node.type === 'boss') run.flags.scoutedBoss = false;
  if (!outcome.won) {
    if (run.livesUsed < e.extraLives) {
      run.livesUsed++;
      usedLife = true;
      cash = Math.round(20 * e.cashMul);
      run.cash += cash;
    } else {
      run.over = true;
      return { cash: 0, ended: true, usedLife: false };
    }
  }
  return { cash, ended: false, usedLife };
}

/** Mark node complete and advance row; handles act transitions and run win. */
export function completeNode(run: RunState, node: MapNode): void {
  node.done = true;
  run.currentNodeId = node.id;
  run.path.push(node.id);
  // passive per-node heal
  const e = runEffects(run);
  const heal = (run.ascension >= 2 ? 0 : 8) + e.healPerNode;
  for (const s of run.roster) s.hp = Math.min(s.maxHp, s.hp + heal);
  run.goalie.hp = Math.min(100, run.goalie.hp + heal);
  run.row++;
  const act = currentAct(run);
  if (run.row >= act.rows.length) {
    if (run.act >= run.maps.length) {
      // base run cleared (or another league act): champion status sticks, the player chooses what happens next
      run.won = true;
      run.leagueOffer = true;
    } else {
      run.act++;
      run.row = 0;
      run.currentNodeId = null;
      reassignActRivals(run);
    }
  }
}

/** Overtime League: bolt a fresh act onto the run at a higher tier. */
export function extendRun(run: RunState): ActMap {
  const rng = runRng(run);
  const act = run.maps.length + 1;
  const map = generateAct(rng, act, new Set());
  run.maps.push(map);
  run.act = act;
  run.row = 0;
  run.currentNodeId = null;
  run.league = (run.league ?? 0) + 1;
  run.leagueOffer = false;
  run.over = false;
  commitRng(run, rng);
  reassignActRivals(run);
  return map;
}

/** Take the trophy and end the run. */
export function bankRun(run: RunState): void {
  run.leagueOffer = false;
  run.over = true;
}

const EXTRA_PHASES: BossPhase[] = [
  { period: 2, kind: 'slickIce', label: 'BLACK ICE', desc: 'Slick ice from the second period on.' },
  { period: 3, kind: 'bouncy', label: 'TRAMPOLINE TIME', desc: 'Boards turn to trampolines in the third.' },
  { period: 3, kind: 'turboAll', label: 'REDLINE', desc: 'Infinite turbo for everyone in the third.' },
  { period: 3, kind: 'extraSkater', label: 'SIXTH MAN', desc: 'A fourth skater jumps the boards for the third.' },
  { period: 0, kind: 'goalieFire', goalsAgainst: 2, label: 'HOT GLOVE', desc: 'Score twice and their goalie catches fire.' },
];
/** A boss phase not already in the list (ascension 5 and the Overtime League stack these). */
export function extraBossPhase(rng: Rng, existing: BossPhase[]): BossPhase | null {
  const cands = EXTRA_PHASES.filter((e) => !existing.some((x) => x.kind === e.kind));
  return cands.length ? { ...rng.pick(cands), applied: false } : null;
}

export function enterNode(run: RunState, node: MapNode): void {
  run.currentNodeId = node.id;
}

/** Perk pool available for drafting. */
export function perkPool(run: RunState): Perk[] {
  return PERKS.filter((p) => !run.perks.includes(p.id) && (!p.unlock || run.flags.unlockedPerks.includes(p.unlock)));
}

export function rollRarity(rng: Rng, bonus = 0): Rarity {
  const w = { common: Math.max(5, RARITY_WEIGHT.common - bonus * 20), rare: RARITY_WEIGHT.rare + bonus * 12, epic: RARITY_WEIGHT.epic + bonus * 8 };
  const total = w.common + w.rare + w.epic;
  let r = rng.next() * total;
  if (r < w.common) return 'common';
  r -= w.common;
  if (r < w.rare) return 'rare';
  return 'epic';
}

export function draftPerks(run: RunState, count: number, rarityBonus = 0): Perk[] {
  const rng = runRng(run);
  const pool = perkPool(run);
  const picks: Perk[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    const rar = rollRarity(rng, rarityBonus);
    let cands = pool.filter((p) => p.rarity === rar && !picks.includes(p));
    if (!cands.length) cands = pool.filter((p) => !picks.includes(p));
    if (!cands.length) break;
    picks.push(rng.pick(cands));
  }
  // ascension 3: every draft carries a curse, and epic slots are cursed-only
  if (run.ascension >= 3 && picks.length && !picks.some((p) => p.curse)) {
    const cursed = pool.filter((p) => p.curse && !picks.includes(p));
    if (cursed.length) {
      const idx = Math.max(0, picks.findIndex((p) => p.rarity === 'epic'));
      picks[idx] = rng.pick(cursed);
    }
  }
  commitRng(run, rng);
  return picks;
}

/** Skaters with unspent level-ups. */
export function pendingLevelUps(run: RunState): SkaterDef[] {
  return [...run.roster, run.goalie].filter((s) => (s.pendingLevels ?? 0) > 0);
}

export function captainOf(run: RunState): Captain {
  return CAPTAINS.find((c) => c.id === run.captainId) ?? CAPTAINS[0];
}

export function serializeRun(run: RunState): string {
  return JSON.stringify(run);
}
export function deserializeRun(json: string): RunState | null {
  try {
    return migrateRun(JSON.parse(json));
  } catch {
    return null;
  }
}
