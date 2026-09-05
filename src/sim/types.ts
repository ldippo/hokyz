export interface Vec2 {
  x: number;
  y: number;
}

export type TeamId = 0 | 1;

/** All 1..10 */
export interface Stats {
  speed: number;
  shot: number;
  hands: number;
  hit: number;
  balance: number;
  stamina: number;
}

export type Archetype = 'sniper' | 'enforcer' | 'playmaker' | 'speedster' | 'grinder' | 'dangler' | 'goalie';

export interface SkaterDef {
  id: string;
  name: string;
  archetype: Archetype;
  stats: Stats;
  traits: string[];
  hp: number;
  maxHp: number;
  xp?: number;
  level?: number;
  /** level-ups earned but not yet spent */
  pendingLevels?: number;
}

export interface Skater {
  id: string;
  name: string;
  team: TeamId;
  isGoalie: boolean;
  archetype: Archetype;
  stats: Stats;
  pos: Vec2;
  vel: Vec2;
  facing: number;
  radius: number;
  mass: number;
  turbo: number;
  turboActive: boolean;
  /** Seconds remaining down. 0 = upright */
  knockdown: number;
  stumble: number;
  invuln: number;
  hasPuck: boolean;
  pickupCooldown: number;
  shotCharge: number;
  charging: boolean;
  /** Match time puck was received */
  receivedAt: number;
  lunge: number;
  checkCooldown: number;
  deke: number;
  /** 'spin' | 'dragL' | 'dragR' — animation hint for the current deke */
  dekeKind: 'spin' | 'dragL' | 'dragR';
  dekeChain: number;
  dekeWindow: number;
  /** goalie dive timer + direction (sim y sign) */
  dive: number;
  diveDir: number;
  knockdownsThisPeriod: number;
  /** 0..1 fight temper from traits/archetype */
  temper: number;
  /** out for the rest of the period (lost a fight) */
  ejected: boolean;
  specialKind: SpecialKind;
  specialTimer: number;
  /** extended one-timer window (blink pass) until match time */
  perfectUntil: number;
  onFire: number; // seconds remaining
  streak: number;
  hp: number;
  injuryTaken: number;
  controlled: boolean;
  /** goalie: butterfly timer */
  butterfly: number;
  // per-match tallies
  goals: number;
  assists: number;
  hits: number;
  bigHits: number;
  shots: number;
  saves: number;
}

export interface Puck {
  pos: Vec2;
  vel: Vec2;
  z: number;
  vz: number;
  owner: string | null;
  lastTouch: string | null;
  lastTouchTeam: TeamId | null;
  prevTouch: string | null;
  passTarget: string | null;
  /** time since released from a stick */
  freeTime: number;
  isShot: boolean;
  /** airborne pass: nobody but the target can pick it up until it lands */
  saucer: boolean;
  /** charge of the last shot (goalie read) */
  shotCharge: number;
  /** laser shot: unsavable if on net */
  laser: boolean;
}

export interface TeamState {
  id: TeamId;
  name: string;
  short: string;
  color: string;
  score: number;
  skaters: string[];
  goalie: string | null;
  /** time-based lock so pass button doesn't switch too often */
  switchLock: number;
  controlledId: string | null;
  isHuman: boolean;
  difficulty: number;
  shotsOnGoal: number;
  /** goalie pulled for an extra attacker */
  pulled: boolean;
  /** seconds left in the dive window after an opponent's shot (0 = none) */
  diveWindow: number;
  /** skater to hand control back to after a goalie dive */
  diveReturnId: string | null;
  pullLatch: boolean;
  pulledGoalieId?: string | null;
  scripted?: boolean;
  logo?: string;
  /** special meter 0..1 */
  special: number;
  brickWall: number; // auto-saves remaining
  teamFireCooldown: number;
  ejected: string[];
}

export type MatchPhase = 'intro' | 'faceoff' | 'play' | 'goal' | 'periodEnd' | 'fight' | 'shootout' | 'over';

export interface ShootoutState {
  rounds: number;
  round: number; // 1-based
  turn: TeamId;
  stage: 'setup' | 'attempt' | 'result' | 'done';
  t: number;
  attempts: { team: TeamId; scored: boolean; shooter: string }[];
  goals: [number, number];
  shooterId: string | null;
  suddenDeath: boolean;
  lastScored: boolean | null;
  /** ai shooter script memory */
  ai: { deked: boolean; charging: number };
}

export type SpecialKind = 'laser' | 'shockwave' | 'afterburner' | 'blink' | 'brickwall' | 'bulldoze' | 'phantom';
export type FightCue = 'high' | 'low' | 'feint' | 'mash';

export interface FightState {
  a: string; // initiator
  b: string; // opponent
  stage: 'offer' | 'duel' | 'result';
  t: number; // stage time
  hp: [number, number];
  accepted: [boolean | null, boolean | null];
  cue: { kind: FightCue; target: 0 | 1; t: number; window: number; done: boolean; mash: number } | null;
  nextCue: number;
  winner: 0 | 1 | null;
  lastHit: { by: 0 | 1; t: number } | null;
}

export interface Input {
  move: Vec2;
  /** shot aim (screen-space: x right, y down). Zero = auto-aim. */
  aim: Vec2;
  turbo: boolean;
  /** pass button released this tick */
  pass: boolean;
  /** pass button currently held */
  passHeld: boolean;
  /** seconds the pass button was held (at release, or so far) */
  passHoldTime: number;
  shoot: boolean;
  shootRelease: boolean;
  check: boolean;
  deke: boolean;
  /** special move button (edge) */
  special: boolean;
}

export const EMPTY_INPUT: Readonly<Input> = Object.freeze({
  move: { x: 0, y: 0 },
  aim: { x: 0, y: 0 },
  turbo: false,
  pass: false,
  passHeld: false,
  passHoldTime: 0,
  shoot: false,
  shootRelease: false,
  check: false,
  deke: false,
  special: false,
});

export type MatchEvent =
  | { type: 'goal'; team: TeamId; scorer: string; assist: string | null; pos: Vec2; value: number; ownGoal: boolean; high: boolean }
  | { type: 'hit'; hitter: string; victim: string; big: boolean; pos: Vec2 }
  | { type: 'shot'; shooter: string; power: number; pos: Vec2; oneTimer: boolean; zone: string }
  | { type: 'saucer'; from: string; to: string | null }
  | { type: 'ankleBreaker'; skater: string; victim: string }
  | { type: 'bigSave'; goalie: string; pos: Vec2 }
  | { type: 'divePrompt'; team: TeamId }
  | { type: 'goaliePulled'; team: TeamId; pulled: boolean }
  | { type: 'fightOffer'; a: string; b: string }
  | { type: 'fightStart'; a: string; b: string }
  | { type: 'fightCue'; kind: FightCue; target: string }
  | { type: 'fightHit'; attacker: string; defender: string; dmg: number; counter: boolean }
  | { type: 'fightEnd'; winner: string | null; loser: string | null; a: string; b: string }
  | { type: 'special'; skater: string; kind: SpecialKind; pos: Vec2 }
  | { type: 'specialReady'; team: TeamId }
  | { type: 'teamFire'; team: TeamId }
  | { type: 'bossPhase'; label: string; desc: string }
  | { type: 'shootoutStart'; rounds: number }
  | { type: 'shootoutAttempt'; team: TeamId; shooter: string; round: number; suddenDeath: boolean }
  | { type: 'shootoutResult'; team: TeamId; shooter: string; scored: boolean }
  | { type: 'shootoutEnd'; winner: TeamId; goals: [number, number] }
  | { type: 'save'; goalie: string; pos: Vec2 }
  | { type: 'post'; pos: Vec2 }
  | { type: 'pass'; from: string; to: string | null }
  | { type: 'onFire'; skater: string }
  | { type: 'onFireEnd'; skater: string }
  | { type: 'faceoff'; pos: Vec2 }
  | { type: 'faceoffWon'; team: TeamId }
  | { type: 'period'; period: number; overtime: boolean }
  | { type: 'periodEnd'; period: number }
  | { type: 'turbo'; skater: string; on: boolean }
  | { type: 'boards'; pos: Vec2; speed: number }
  | { type: 'knockdown'; skater: string }
  | { type: 'injury'; skater: string; amount: number }
  | { type: 'switch'; team: TeamId; to: string }
  | { type: 'over'; winner: TeamId | null };

export interface TeamMods {
  speedMul: number;
  accelMul: number;
  turboRegenMul: number;
  turboDrainMul: number;
  turboMax: number;
  shotPowerMul: number;
  shotAccuracyMul: number;
  hitPowerMul: number;
  hitResistMul: number;
  injuryMul: number;
  goalieSaveMul: number;
  passSpeedMul: number;
  onFireGainMul: number;
  onFireDurationMul: number;
  bigHitTurboRefill: number;
  /** Goals from beyond blue line worth extra */
  longShotBonus: number;
  /** Goals count this many */
  goalValue: number;
  /** flat hp regen per big hit landed */
  hpOnBigHit: number;
  /** extra goalie rebound control (lower = fewer rebounds) */
  reboundMul: number;
  staminaMul: number;
  specialGainMul: number;
  fightPowerMul: number;
  /** set bonus: when a skater ignites, a teammate ignites too */
  fireSpread: boolean;
  /** auto-saves granted at every period start */
  periodBrickWall: number;
  /** multiplies fight provoke/accept odds */
  temperMul: number;
}

export interface MatchMods {
  noGoalies: boolean;
  periodLength: number;
  periods: number;
  turboInfinite: boolean;
  puckFrictionMul: number;
  boardsBouncy: boolean;
  /** everyone knocked down easier */
  slipperyIce: boolean;
  suddenDeath: boolean; // first goal wins
  mercyRule: number; // 0 = off, else lead needed to end
  noFights: boolean;
  fightsPerPeriod: number;
  /** start directly in a shootout (skills node) */
  shootoutOnly: boolean;
  shootoutRounds: number;
  /** boss rule changes keyed by period */
  bossPhases: BossPhase[];
  /** pre-built 4th skater for an 'extraSkater' phase (team 1) */
  extraSkater: SkaterDef | null;
  teams: [TeamMods, TeamMods];
}

export interface BossPhase {
  period: number;
  kind: 'extraSkater' | 'slickIce' | 'goalieFire' | 'bouncy' | 'turboAll';
  label: string;
  desc: string;
  /** goalieFire: goals against that trigger it (checked each goal) */
  goalsAgainst?: number;
  applied?: boolean;
}

export interface MatchState {
  t: number;
  dt: number;
  phase: MatchPhase;
  phaseTimer: number;
  period: number;
  clock: number;
  overtime: boolean;
  skaters: Record<string, Skater>;
  order: string[];
  puck: Puck;
  teams: [TeamState, TeamState];
  faceoffSpot: Vec2;
  faceoffTeamAdvantage: TeamId | null;
  events: MatchEvent[];
  winner: TeamId | null;
  mods: MatchMods;
  fight: FightState | null;
  fightsThisPeriod: number;
  shootout: ShootoutState | null;
  /** camera shake request (decays outside sim) */
  shake: number;
  stats: {
    hits: [number, number];
    bigHits: [number, number];
    shots: [number, number];
  };
}
