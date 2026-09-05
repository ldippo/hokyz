/**
 * All game-feel tuning lives here. Units: meters, seconds, radians.
 * x = along rink length (goals at ±), y = across width.
 */
export const RINK = {
  length: 52,
  width: 26,
  cornerRadius: 6.5,
  goalLineX: 22, // goal line distance from center
  goalWidth: 2.6,
  goalDepth: 1.3,
  creaseRadius: 2.4,
  blueLineX: 8,
  faceoffDotX: 14,
  faceoffDotY: 6,
  boardRestitution: 0.55,
  boardFriction: 0.85,
};

export const SKATER = {
  radius: 0.55,
  mass: 1,
  baseAccel: 16,
  baseMaxSpeed: 8.5,
  turboSpeedMul: 1.45,
  turboAccelMul: 1.5,
  turboDrainPerSec: 0.32,
  turboRegenPerSec: 0.11,
  turboMinToActivate: 0.08,
  iceFriction: 3.2, // exponential velocity damping (1/s)
  turnRate: 9, // rad/s facing slew
  dekeChainWindow: 1.0,
  dekeChainMax: 3,
  dekeTurboCost: 0.12,
  knockdownTime: 1.25,
  getUpInvuln: 0.9,
  stumbleTime: 0.5,
  puckMagnetRange: 1.1,
  puckPickupCooldown: 0.25,
  possessionOffset: 0.85, // puck carried this far ahead of skater center
  statScale: (v: number) => 0.7 + (v / 10) * 0.6, // stat 1..10 → 0.76 .. 1.3
};

export const GOALIE = {
  diveWindow: 0.6,
  diveTime: 0.45,
  diveSpeed: 9,
  diveRightMul: 1.4,
  diveWrongMul: 0.5,
  pullHold: 1.0,
  pullClock: 120,
  radius: 0.75,
  maxSpeed: 5.5,
  accel: 22,
  depthFromGoalLine: 0.9,
  lateralRange: 1.8,
  reactDelay: 0.08,
  baseSaveChance: 0.88,
  butterflyTime: 0.45,
  reboundSpeedMul: 0.35,
  reboundChance: 0.35,
};

export const PUCK = {
  radius: 0.14,
  mass: 0.17,
  friction: 0.35, // exponential damping
  passSpeed: 15,
  passLead: 0.35,
  shotSpeedMin: 14,
  shotSpeedMax: 30,
  chargeTime: 0.9,
  shotLiftMax: 1.4,
  dumpSpeed: 9,
  oneTimerWindow: 0.28,
  saucerHold: 0.22, // hold pass this long → saucer
  saucerLift: 3.6,
  saucerSpeedMul: 0.85,
  oneTimerPowerMul: 1.25,
  gravity: 9.8,
  bounce: 0.4,
};

export const HIT = {
  lungeSpeed: 13,
  lungeTime: 0.22,
  cooldown: 1.1,
  coneHalfAngle: Math.PI / 3.2,
  reach: 1.35,
  knockThreshold: 1.05, // score above → knockdown
  bigHitThreshold: 1.55, // score above → big hit
  knockdownImpulse: 6,
  bigHitImpulse: 10,
  pushImpulse: 3.5,
  puckPopSpeed: 6,
  injuryPerHit: 3,
  injuryPerBigHit: 9,
  turboRefillOnBigHit: 0.35,
};

export const RULES = {
  periods: 3,
  periodLength: 120,
  otLength: 90,
  faceoffCountdown: 1.6,
  goalCelebration: 2.4,
  periodBreak: 2.0,
};

export const ONFIRE = {
  streakNeeded: 3,
  duration: 28,
  speedMul: 1.18,
  hitMul: 1.5,
  shotMul: 1.6,
  turboInfinite: true,
};

export const AI = {
  // Per difficulty (0 = easy ... 3 = brutal). Indexed by difficulty.
  reactDelay: [0.35, 0.22, 0.12, 0.05],
  turboUse: [0.25, 0.5, 0.8, 1.0],
  shotAccuracy: [0.55, 0.7, 0.85, 1.0],
  checkAggression: [0.35, 0.5, 0.65, 0.8],
  checkRetry: [2.4, 2.0, 1.8, 1.6], // seconds between AI check attempts
  passSmarts: [0.4, 0.6, 0.85, 1.0],
  shootRangeX: 9, // shoot when within this x of goal line
  pullClock: 90, // AI pulls the goalie when trailing by ≤2 inside this
  pullDeficitMax: 2,
  shootRate: [0.9, 1.1, 1.3, 1.5], // shots attempted per second while in the zone
  supportSpacing: 6,
};

export const FIGHT = {
  offerTime: 1.6,
  duelTime: 8,
  cueEvery: 1.05,
  cueWindow: 0.5,
  punchDmg: 22,
  counterDmg: 26,
  wrongDmg: 10,
  feintDmg: 14,
  mashNeeded: 6,
  mashHeal: 24,
  resultTime: 2.2,
  /** knockdowns in a period before a big hit provokes a fight */
  provokeKnockdowns: 3,
  /** max fights per period (both teams combined) */
  perPeriod: 1,
  enforcerProvokeChance: 0.3,
};

export const SPECIAL = {
  gainPerSec: 1 / 115,
  gainBigHit: 0.09,
  gainGoal: 0.18,
  gainSave: 0.04,
  gainAnkle: 0.08,
  laserTime: 6,
  afterburnerTime: 3.2,
  afterburnerSpeed: 1.6,
  shockwaveRadius: 4.2,
  blinkWindow: 0.7,
  brickWallSaves: 3,
  bulldozeTime: 5,
  phantomTime: 4,
};

export const TEAMFIRE = {
  duration: 20,
  cooldown: 45,
  unansweredGoals: 3,
};

export const SIM_DT = 1 / 60;
