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

export type Archetype = 'sniper' | 'enforcer' | 'playmaker' | 'speedster' | 'goalie';

export interface SkaterDef {
  id: string;
  name: string;
  archetype: Archetype;
  stats: Stats;
  traits: string[];
  hp: number;
  maxHp: number;
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
}

export type MatchPhase = 'intro' | 'faceoff' | 'play' | 'goal' | 'periodEnd' | 'over';

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
});

export type MatchEvent =
  | { type: 'goal'; team: TeamId; scorer: string; assist: string | null; pos: Vec2; value: number }
  | { type: 'hit'; hitter: string; victim: string; big: boolean; pos: Vec2 }
  | { type: 'shot'; shooter: string; power: number; pos: Vec2; oneTimer: boolean; zone: string }
  | { type: 'saucer'; from: string; to: string | null }
  | { type: 'ankleBreaker'; skater: string; victim: string }
  | { type: 'bigSave'; goalie: string; pos: Vec2 }
  | { type: 'divePrompt'; team: TeamId }
  | { type: 'goaliePulled'; team: TeamId; pulled: boolean }
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
  teams: [TeamMods, TeamMods];
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
  /** camera shake request (decays outside sim) */
  shake: number;
  stats: {
    hits: [number, number];
    bigHits: [number, number];
    shots: [number, number];
  };
}
