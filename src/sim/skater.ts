import { GOALIE, ONFIRE, RINK, SKATER } from './constants';
import { collideBoards, collideNetBox, damp, integrate } from './physics';
import type { Archetype, Input, MatchEvent, MatchState, Skater, Stats, TeamId, Vec2 } from './types';
import { angleOf, clampLen, len, slewAngle } from './vec';

export function makeSkater(
  id: string,
  name: string,
  team: TeamId,
  stats: Stats,
  archetype: Archetype,
  isGoalie: boolean,
  hp = 100,
): Skater {
  return {
    id,
    name,
    team,
    isGoalie,
    archetype,
    stats: { ...stats },
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    facing: team === 0 ? 0 : Math.PI,
    radius: isGoalie ? GOALIE.radius : SKATER.radius,
    mass: isGoalie ? 1.4 : SKATER.mass * (0.85 + stats.hit / 40),
    turbo: 1,
    turboActive: false,
    knockdown: 0,
    stumble: 0,
    invuln: 0,
    hasPuck: false,
    pickupCooldown: 0,
    shotCharge: 0,
    charging: false,
    receivedAt: -10,
    lunge: 0,
    checkCooldown: 0,
    deke: 0,
    dekeKind: 'spin',
    dekeChain: 0,
    dekeWindow: 0,
    dive: 0,
    diveDir: 0,
    onFire: 0,
    streak: 0,
    hp,
    injuryTaken: 0,
    controlled: false,
    butterfly: 0,
    goals: 0,
    assists: 0,
    hits: 0,
    bigHits: 0,
    shots: 0,
    saves: 0,
  };
}

const tick = (v: number, dt: number) => (v > 0 ? Math.max(0, v - dt) : 0);

export function skaterMaxSpeed(sk: Skater, st: MatchState): number {
  const m = st.mods.teams[sk.team];
  let s = SKATER.baseMaxSpeed * SKATER.statScale(sk.stats.speed) * m.speedMul;
  if (sk.onFire > 0) s *= ONFIRE.speedMul;
  if (sk.turboActive) s *= SKATER.turboSpeedMul;
  if (sk.hasPuck) s *= 0.9 + sk.stats.hands / 100;
  if (sk.stumble > 0) s *= 0.6;
  if (sk.hp < 30) s *= 0.9;
  return s;
}

export function stepSkater(sk: Skater, input: Input, st: MatchState, dt: number, events: MatchEvent[]): void {
  const m = st.mods.teams[sk.team];
  sk.knockdown = tick(sk.knockdown, dt);
  sk.stumble = tick(sk.stumble, dt);
  sk.invuln = tick(sk.invuln, dt);
  sk.pickupCooldown = tick(sk.pickupCooldown, dt);
  sk.checkCooldown = tick(sk.checkCooldown, dt);
  sk.deke = tick(sk.deke, dt);
  sk.dekeWindow = tick(sk.dekeWindow, dt);
  if (sk.dekeWindow === 0) sk.dekeChain = 0;
  sk.butterfly = tick(sk.butterfly, dt);
  if (sk.onFire > 0) {
    sk.onFire = Math.max(0, sk.onFire - dt);
    if (sk.onFire === 0) events.push({ type: 'onFireEnd', skater: sk.id });
  }

  if (sk.knockdown > 0) {
    damp(sk.vel, 6, dt);
    integrate(sk.pos, sk.vel, dt);
    collideBoards(sk.pos, sk.vel, sk.radius, 0.2, 0.5);
    collideNetBox(sk.pos, sk.vel, sk.radius);
    sk.turboActive = false;
    sk.charging = false;
    sk.shotCharge = 0;
    if (sk.knockdown === 0) sk.invuln = SKATER.getUpInvuln;
    return;
  }

  // --- turbo ---
  const move = clampLen(input.move, 1);
  const moving = len(move) > 0.05;
  const infinite = st.mods.turboInfinite || (sk.onFire > 0 && ONFIRE.turboInfinite);
  const wantTurbo = input.turbo && moving && !sk.isGoalie;
  if (wantTurbo && (sk.turboActive ? sk.turbo > 0 : sk.turbo > SKATER.turboMinToActivate || infinite)) {
    if (!sk.turboActive) events.push({ type: 'turbo', skater: sk.id, on: true });
    sk.turboActive = true;
    if (!infinite) sk.turbo = Math.max(0, sk.turbo - SKATER.turboDrainPerSec * m.turboDrainMul * dt);
  } else {
    if (sk.turboActive) events.push({ type: 'turbo', skater: sk.id, on: false });
    sk.turboActive = false;
    const regen = SKATER.turboRegenPerSec * m.turboRegenMul * (0.8 + sk.stats.stamina / 50) * m.staminaMul;
    sk.turbo = Math.min(m.turboMax, sk.turbo + regen * dt);
  }
  if (infinite) sk.turbo = Math.max(sk.turbo, 1);

  // --- movement ---
  const maxSpeed = skaterMaxSpeed(sk, st);
  let accel = SKATER.baseAccel * SKATER.statScale(sk.stats.speed) * m.accelMul;
  if (sk.turboActive) accel *= SKATER.turboAccelMul;
  if (sk.stumble > 0) accel *= 0.4;
  if (st.mods.slipperyIce) accel *= 0.55;

  if (sk.lunge > 0) {
    sk.lunge = tick(sk.lunge, dt);
    // lunge overrides steering: keep committed velocity, slight decay
    damp(sk.vel, 1.5, dt);
  } else if (moving) {
    const desired = { x: move.x * maxSpeed, y: move.y * maxSpeed };
    let ax = desired.x - sk.vel.x;
    let ay = desired.y - sk.vel.y;
    const al = Math.hypot(ax, ay);
    const maxA = accel * dt;
    if (al > maxA) {
      ax *= maxA / al;
      ay *= maxA / al;
    }
    sk.vel.x += ax;
    sk.vel.y += ay;
    sk.facing = slewAngle(sk.facing, angleOf(move), SKATER.turnRate * dt * (sk.hasPuck ? 0.8 : 1));
  } else {
    damp(sk.vel, SKATER.iceFriction * (st.mods.slipperyIce ? 0.5 : 1), dt);
  }
  // hard cap (turbo off transitions)
  const sp = len(sk.vel);
  const cap = maxSpeed * 1.05;
  if (sp > cap) {
    sk.vel.x *= cap / sp;
    sk.vel.y *= cap / sp;
  }

  integrate(sk.pos, sk.vel, dt);
  const boardHit = collideBoards(sk.pos, sk.vel, sk.radius, 0.25, 0.6);
  if (boardHit > 9 && sk.lunge > 0) {
    // smashed self into boards during lunge → stumble
    sk.stumble = SKATER.stumbleTime;
    sk.lunge = 0;
  }
  collideNetBox(sk.pos, sk.vel, sk.radius);
}

/** Stick tip position — where the puck sits when carried. */
export function stickPoint(sk: Skater, out?: Vec2): Vec2 {
  const o = out ?? { x: 0, y: 0 };
  let off = SKATER.possessionOffset;
  let side = 0;
  if (sk.deke > 0) {
    if (sk.dekeKind === 'spin') {
      // puck swings side-to-side during a spin
      side = Math.sin(sk.deke * 18) * 0.7;
      off *= 0.8;
    } else {
      // toe drag: pull the puck wide to one side then back
      const k = Math.sin(Math.min(1, sk.deke / 0.45) * Math.PI);
      side = (sk.dekeKind === 'dragL' ? 1 : -1) * 0.9 * k;
      off *= 0.7 + 0.3 * (1 - k);
    }
  }
  const c = Math.cos(sk.facing),
    s = Math.sin(sk.facing);
  o.x = sk.pos.x + c * off - s * side;
  o.y = sk.pos.y + s * off + c * side;
  return o;
}

export function clampSkaterToRink(sk: Skater): void {
  const r = sk.radius;
  const hx = RINK.length / 2 - r,
    hy = RINK.width / 2 - r;
  if (sk.pos.x > hx) sk.pos.x = hx;
  if (sk.pos.x < -hx) sk.pos.x = -hx;
  if (sk.pos.y > hy) sk.pos.y = hy;
  if (sk.pos.y < -hy) sk.pos.y = -hy;
}
