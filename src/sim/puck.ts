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

export function doPass(st: MatchState, sk: Skater, target: Skater | null, events: MatchEvent[]): void {
  const m = st.mods.teams[sk.team];
  const speed = PUCK.passSpeed * m.passSpeedMul * (0.85 + sk.stats.hands / 40);
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
  releasePuck(st, sk, scale(dirV, speed));
  st.puck.passTarget = target ? target.id : null;
  events.push({ type: 'pass', from: sk.id, to: target?.id ?? null });
}

export function doShot(st: MatchState, sk: Skater, aim: Vec2, charge: number, rng: Rng, events: MatchEvent[]): void {
  const m = st.mods.teams[sk.team];
  const goal = attackGoal(sk.team);
  const isOneTimer = st.t - sk.receivedAt < PUCK.oneTimerWindow;
  let power = clamp(charge, 0.15, 1);
  if (isOneTimer) power = Math.min(1.2, power * PUCK.oneTimerPowerMul + 0.3);
  const shotStat = SKATER.statScale(sk.stats.shot);
  let speed = (PUCK.shotSpeedMin + (PUCK.shotSpeedMax - PUCK.shotSpeedMin) * power) * shotStat * m.shotPowerMul;
  if (sk.onFire > 0) speed *= ONFIRE.shotMul;
  // aim: default at goal mouth; move input biases target y within the mouth (and can miss)
  const aimStrength = len(aim) > 0.2 ? aim.y : 0;
  const targetY = clamp(aimStrength * 0.9, -1, 1) * (RINK.goalWidth / 2) * 0.85;
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
  const lift = power > 0.55 ? (power - 0.55) * PUCK.shotLiftMax * (1 + (rng.next() - 0.5) * 0.6) : 0;
  releasePuck(st, sk, fromAngle(ang, speed), lift);
  st.puck.isShot = true;
  sk.shots++;
  st.stats.shots[sk.team]++;
  events.push({ type: 'shot', shooter: sk.id, power, pos: { ...st.puck.pos } });
}

/** Handle carrier inputs: pass / shoot charge / deke. */
export function stepCarrier(st: MatchState, sk: Skater, input: Input, dt: number, rng: Rng, events: MatchEvent[]): void {
  if (!sk.hasPuck || sk.knockdown > 0) return;
  if (input.pass) {
    const target = pickPassTarget(st, sk, input.move);
    doPass(st, sk, target, events);
    return;
  }
  if (input.deke && sk.deke === 0 && sk.stumble === 0) {
    sk.deke = 0.45;
    sk.invuln = Math.max(sk.invuln, 0.35);
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
