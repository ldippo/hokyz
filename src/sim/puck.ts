import { ONFIRE, PUCK, RINK, SKATER } from './constants';
import { attackGoal } from './rink';
import { stickPoint } from './skater';
import type { Input, MatchEvent, MatchState, Puck, Skater, Vec2 } from './types';
import { add, clamp, dist, fromAngle, len, norm, scale, sub } from './vec';
import type { Rng } from '../core/rng';

export function makePuck(): Puck {
  return {
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    z: 0,
    vz: 0,
    owner: null,
    lastTouch: null,
    lastTouchTeam: null,
    prevTouch: null,
    passTarget: null,
    freeTime: 0,
    isShot: false,
    saucer: false,
    shotCharge: 0,
    laser: false,
  };
}

export function givePuck(st: MatchState, sk: Skater, events: MatchEvent[]): void {
  const p = st.puck;
  if (p.owner === sk.id) return;
  if (p.owner) {
    const prev = st.skaters[p.owner];
    if (prev) prev.hasPuck = false;
  }
  p.owner = sk.id;
  if (p.lastTouch !== sk.id) {
    p.prevTouch = p.lastTouch;
  }
  p.lastTouch = sk.id;
  p.lastTouchTeam = sk.team;
  p.passTarget = null;
  p.isShot = false;
  p.saucer = false;
  p.laser = false;
  p.freeTime = 0;
  p.z = 0;
  p.vz = 0;
  sk.hasPuck = true;
  sk.receivedAt = st.t;
  sk.shotCharge = 0;
  sk.charging = false;
  const team = st.teams[sk.team];
  if (!sk.isGoalie && team.isHuman && team.controlledId !== sk.id) {
    setControlled(st, sk.team, sk.id, events);
  }
}

export function setControlled(st: MatchState, teamId: 0 | 1, id: string, events: MatchEvent[]): void {
  const team = st.teams[teamId];
  if (team.controlledId) {
    const prev = st.skaters[team.controlledId];
    if (prev) prev.controlled = false;
  }
  team.controlledId = id;
  st.skaters[id].controlled = true;
  events.push({ type: 'switch', team: teamId, to: id });
}

export function releasePuck(st: MatchState, sk: Skater, vel: Vec2, lift = 0): void {
  const p = st.puck;
  const sp = stickPoint(sk);
  p.pos.x = sp.x;
  p.pos.y = sp.y;
  p.vel.x = vel.x;
  p.vel.y = vel.y;
  p.z = 0.01;
  p.vz = lift;
  p.owner = null;
  p.freeTime = 0;
  sk.hasPuck = false;
  sk.pickupCooldown = SKATER.puckPickupCooldown;
  sk.charging = false;
  sk.shotCharge = 0;
}

/** Update carried puck position each tick. */
export function carryPuck(st: MatchState): void {
  const p = st.puck;
  if (!p.owner) return;
  const sk = st.skaters[p.owner];
  if (!sk) {
    p.owner = null;
    return;
  }
  const sp = stickPoint(sk);
  p.pos.x = sp.x;
  p.pos.y = sp.y;
  p.vel.x = sk.vel.x;
  p.vel.y = sk.vel.y;
  p.z = 0;
  // keep carried puck inside rink
  const hx = RINK.length / 2 - 0.3,
    hy = RINK.width / 2 - 0.3;
  p.pos.x = clamp(p.pos.x, -hx, hx);
  p.pos.y = clamp(p.pos.y, -hy, hy);
}

/** Free-puck pickup by skaters (goalies handled in goalie.ts). */
export function tryPickups(st: MatchState, events: MatchEvent[]): void {
  const p = st.puck;
  if (p.owner) return;
  if (p.z > 0.7) return;
  // saucer in flight: only the intended target may catch it before it lands
  if (p.saucer && p.z > 0.05) {
    const t = p.passTarget ? st.skaters[p.passTarget] : null;
    if (t && dist(stickPoint(t), p.pos) < SKATER.puckMagnetRange && p.z < 0.6) givePuck(st, t, events);
    return;
  }
  if (p.saucer) p.saucer = false;
  const speed = len(p.vel);
  let best: Skater | null = null;
  let bestD = Infinity;
  for (const id of st.order) {
    const sk = st.skaters[id];
    if (sk.isGoalie || sk.knockdown > 0 || sk.pickupCooldown > 0) continue;
    const sp = stickPoint(sk);
    const d = dist(sp, p.pos);
    const range = SKATER.puckMagnetRange * (0.8 + sk.stats.hands / 40) * (sk.stumble > 0 ? 0.6 : 1);
    if (d > range) continue;
    // pass target gets priority + bigger range
    const isTarget = p.passTarget === sk.id;
    // fast pucks: only intended target or lucky hands catch it
    if (speed > 17 && !isTarget && sk.stats.hands < 7) continue;
    if (p.isShot && speed > 12 && !isTarget && sk.team === p.lastTouchTeam) continue; // don't intercept own shot
    const score = d - (isTarget ? 1 : 0);
    if (score < bestD) {
      bestD = score;
      best = sk;
    }
  }
  if (best) givePuck(st, best, events);
}

/** Is the passing lane from `from` to `to` blocked by an opponent? */
export function laneBlocked(st: MatchState, from: Skater, to: Skater): boolean {
  const d = dist(from.pos, to.pos);
  if (d < 0.5) return false;
  const n = norm(sub(to.pos, from.pos));
  for (const oid of st.teams[from.team === 0 ? 1 : 0].skaters) {
    const o = st.skaters[oid];
    if (o.knockdown > 0) continue;
    const proj = (o.pos.x - from.pos.x) * n.x + (o.pos.y - from.pos.y) * n.y;
    if (proj > 0 && proj < d) {
      const perp = Math.abs(-(o.pos.x - from.pos.x) * n.y + (o.pos.y - from.pos.y) * n.x);
      if (perp < 1.0) return true;
    }
  }
  return false;
}

export function pickPassTarget(st: MatchState, sk: Skater, aim: Vec2 | null): Skater | null {
  const team = st.teams[sk.team];
  const dir = aim && len(aim) > 0.2 ? norm(aim) : fromAngle(sk.facing);
  let best: Skater | null = null;
  let bestScore = -Infinity;
  const attackX = attackGoal(sk.team).lineX;
  for (const id of team.skaters) {
    if (id === sk.id) continue;
    const t = st.skaters[id];
    if (t.knockdown > 0) continue;
    const to = sub(t.pos, sk.pos);
    const d = len(to);
    if (d < 0.5) continue;
    const n = norm(to);
    const align = n.x * dir.x + n.y * dir.y; // -1..1
    // prefer teammates in aim direction, closer to attack goal, not too far
    const forward = -Math.abs(t.pos.x - attackX) / RINK.length;
    let score = align * 2 + forward * 1.5 - d / 30;
    // lane blocked?
    for (const oid of st.teams[sk.team === 0 ? 1 : 0].skaters) {
      const o = st.skaters[oid];
      const proj = (o.pos.x - sk.pos.x) * n.x + (o.pos.y - sk.pos.y) * n.y;
      if (proj > 0 && proj < d) {
        const perp = Math.abs(-(o.pos.x - sk.pos.x) * n.y + (o.pos.y - sk.pos.y) * n.x);
        if (perp < 1.0) score -= 1.2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  return best;
}

export function doPass(st: MatchState, sk: Skater, target: Skater | null, events: MatchEvent[], saucer = false): void {
  const m = st.mods.teams[sk.team];
  const speed = PUCK.passSpeed * m.passSpeedMul * (0.85 + sk.stats.hands / 40) * (saucer ? PUCK.saucerSpeedMul : 1);
  let dirV: Vec2;
  if (target) {
    // lead the target
    const lead = add(target.pos, scale(target.vel, PUCK.passLead));
    dirV = norm(sub(lead, stickPoint(sk)));
    st.puck.passTarget = target.id;
  } else {
    dirV = fromAngle(sk.facing);
    st.puck.passTarget = null;
  }
  releasePuck(st, sk, scale(dirV, speed), saucer ? PUCK.saucerLift : 0);
  st.puck.passTarget = target ? target.id : null;
  st.puck.saucer = saucer;
  if (saucer) events.push({ type: 'saucer', from: sk.id, to: target?.id ?? null });
  events.push({ type: 'pass', from: sk.id, to: target?.id ?? null });
}

export function doShot(st: MatchState, sk: Skater, aim: Vec2, charge: number, rng: Rng, events: MatchEvent[]): void {
  const m = st.mods.teams[sk.team];
  const goal = attackGoal(sk.team);
  const isOneTimer = st.t - sk.receivedAt < PUCK.oneTimerWindow || st.t < sk.perfectUntil;
  let power = clamp(charge, 0.15, 1);
  if (isOneTimer) power = Math.min(1.2, power * PUCK.oneTimerPowerMul + 0.3);
  const shotStat = SKATER.statScale(sk.stats.shot);
  let speed = (PUCK.shotSpeedMin + (PUCK.shotSpeedMax - PUCK.shotSpeedMin) * power) * shotStat * m.shotPowerMul;
  if (sk.onFire > 0) speed *= ONFIRE.shotMul;
  const laser = sk.specialTimer > 0 && sk.specialKind === 'laser';
  if (laser) speed *= 1.35;
  // aim zones: aim.y picks the post (screen up = far post = -y), charge > 0.6 lifts to the top corners.
  // No aim input → auto far side from the goalie.
  const goalieId = st.teams[sk.team === 0 ? 1 : 0].goalie;
  const gk = goalieId ? st.skaters[goalieId] : null;
  let post: number;
  if (len(aim) > 0.25) post = clamp(aim.y * 1.3, -1, 1);
  else if (gk) post = -Math.sign(gk.pos.y || (rng.next() - 0.5)) * 0.85;
  else post = (rng.next() - 0.5) * 1.6;
  const high = power > 0.6;
  const zone = Math.abs(post) < 0.3 ? 'five-hole' : `${post < 0 ? 'far' : 'near'}-${high ? 'high' : 'low'}`;
  const targetY = post * (RINK.goalWidth / 2) * 0.82;
  const target = { x: goal.lineX + goal.dir * 0.3, y: targetY };
  // accuracy spread grows with distance & low hands
  const sp = stickPoint(sk);
  const d = dist(sp, target);
  const acc = SKATER.statScale(sk.stats.hands) * m.shotAccuracyMul;
  const spread = ((0.05 + d / 90) * (1.45 - acc * 0.5)) / (sk.stumble > 0 ? 0.5 : 1);
  const baseAng = Math.atan2(target.y - sp.y, target.x - sp.x);
  // if shooter faces away from goal, shot goes where they face (dump)
  const faceDiff = Math.abs(((baseAng - sk.facing + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  let ang: number;
  if (faceDiff > Math.PI * 0.55) {
    ang = sk.facing;
    speed = Math.min(speed, PUCK.dumpSpeed);
  } else {
    ang = baseAng + (rng.next() - 0.5) * 2 * spread;
  }
  // vertical launch so the puck reaches the zone height at the goal line; error grows with distance
  const flight = Math.max(0.12, d / speed);
  const targetZ = high ? 0.95 : zone === 'five-hole' ? 0.05 : 0.3;
  let lift = (targetZ + 0.5 * PUCK.gravity * flight * flight) / flight;
  lift *= 1 + (rng.next() - 0.5) * (0.12 + d / 120) * (1.45 - acc * 0.5);
  releasePuck(st, sk, fromAngle(ang, speed), Math.max(0, lift));
  st.puck.isShot = true;
  st.puck.shotCharge = charge;
  st.puck.laser = laser;
  if (laser) sk.specialTimer = 0;
  sk.shots++;
  st.stats.shots[sk.team]++;
  events.push({ type: 'shot', shooter: sk.id, power, pos: { ...st.puck.pos }, oneTimer: isOneTimer, zone });
}

/** Handle carrier inputs: pass / shoot charge / deke. */
export function stepCarrier(st: MatchState, sk: Skater, input: Input, dt: number, rng: Rng, events: MatchEvent[]): void {
  if (!sk.hasPuck || sk.knockdown > 0) return;
  if (input.pass) {
    // long holds are the pull-goalie gesture, not a pass
    if (input.passHoldTime >= 1.0 && st.teams[sk.team].isHuman) return;
    const target = pickPassTarget(st, sk, input.move);
    doPass(st, sk, target, events, input.passHoldTime >= PUCK.saucerHold);
    return;
  }
  if (input.deke && sk.stumble === 0 && sk.deke < 0.2) {
    // chained dekes: up to N within a window, each costs turbo
    if (sk.dekeWindow > 0 && sk.dekeChain >= SKATER.dekeChainMax) return;
    if (sk.dekeChain > 0 && sk.turbo < SKATER.dekeTurboCost && !st.mods.turboInfinite) return;
    const lateral = -Math.sin(sk.facing) * input.move.x + Math.cos(sk.facing) * input.move.y;
    sk.dekeKind = Math.abs(lateral) > 0.4 ? (lateral > 0 ? 'dragL' : 'dragR') : 'spin';
    sk.deke = 0.45;
    sk.invuln = Math.max(sk.invuln, 0.35);
    sk.dekeChain = sk.dekeWindow > 0 ? sk.dekeChain + 1 : 1;
    sk.dekeWindow = SKATER.dekeChainWindow;
    if (sk.dekeChain > 1 && !st.mods.turboInfinite) sk.turbo = Math.max(0, sk.turbo - SKATER.dekeTurboCost);
  }
  if (input.shoot) {
    sk.charging = true;
    sk.shotCharge = Math.min(1, sk.shotCharge + dt / PUCK.chargeTime);
  }
  if (input.shootRelease || (sk.charging && !input.shoot)) {
    const charge = sk.charging ? sk.shotCharge : 0.3;
    doShot(st, sk, input.move, charge, rng, events);
  }
}
