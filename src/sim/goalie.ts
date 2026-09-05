import { GOALIE, PUCK, RINK, SKATER } from './constants';
import { damp, integrate } from './physics';
import { defendGoal } from './rink';
import { doPass, givePuck, pickPassTarget } from './puck';
import type { MatchEvent, MatchState, Skater } from './types';
import { clamp, len } from './vec';
import type { Rng } from '../core/rng';

interface GoalieMem {
  holdTimer: number;
  beaten: number;
  prevPuck: { x: number; y: number };
}
const mem = new WeakMap<Skater, GoalieMem>();
const getMem = (g: Skater): GoalieMem => {
  let m = mem.get(g);
  if (!m) {
    m = { holdTimer: 0, beaten: 0, prevPuck: { x: 0, y: 0 } };
    mem.set(g, m);
  }
  return m;
};

export function stepGoalie(st: MatchState, g: Skater, dt: number, rng: Rng, events: MatchEvent[]): void {
  const gm = getMem(g);
  const goal = defendGoal(g.team);
  const p = st.puck;
  gm.beaten = Math.max(0, gm.beaten - dt);
  g.knockdown = Math.max(0, g.knockdown - dt);
  g.stumble = Math.max(0, g.stumble - dt);
  g.pickupCooldown = Math.max(0, g.pickupCooldown - dt);
  g.dive = Math.max(0, g.dive - dt);

  if (g.knockdown > 0) {
    damp(g.vel, 6, dt);
    integrate(g.pos, g.vel, dt);
    return;
  }

  // holding puck → quick outlet pass
  if (g.hasPuck) {
    gm.holdTimer += dt;
    if (gm.holdTimer > 0.55) {
      const t = pickPassTarget(st, g, null);
      doPass(st, g, t, events);
      gm.holdTimer = 0;
    }
  }

  // --- positioning: on line from puck to goal center, at depth in crease ---
  const gc = { x: goal.lineX, y: 0 };
  const puckBehind = goal.dir > 0 ? p.pos.x > goal.lineX : p.pos.x < goal.lineX;
  let tx: number, ty: number;
  const depth = GOALIE.depthFromGoalLine;
  if (puckBehind) {
    // hug near post
    tx = goal.lineX - goal.dir * (depth * 0.6);
    ty = clamp(p.pos.y, -RINK.goalWidth / 2, RINK.goalWidth / 2) * 0.9;
  } else {
    const dx = p.pos.x - gc.x;
    const dy = p.pos.y - gc.y;
    const d = Math.hypot(dx, dy) || 1;
    // step out toward puck slightly more when it's close & central (cut angle)
    const closeness = clamp(1 - d / 20, 0, 1);
    const out = depth + closeness * 0.9;
    tx = gc.x + (dx / d) * out;
    ty = gc.y + (dy / d) * out;
    ty = clamp(ty, -GOALIE.lateralRange, GOALIE.lateralRange);
    // never wander in front of the crease
    const maxOut = goal.lineX - goal.dir * RINK.creaseRadius;
    tx = goal.dir > 0 ? Math.max(tx, maxOut) : Math.min(tx, maxOut);
  }
  // beaten → sluggish
  const spd = GOALIE.maxSpeed * (gm.beaten > 0 ? 0.4 : 1) * (0.85 + g.stats.speed / 60);
  const desired = { x: tx - g.pos.x, y: ty - g.pos.y };
  const dl = len(desired);
  if (dl > 0.02) {
    const s = Math.min(spd, dl * 8);
    desired.x = (desired.x / dl) * s;
    desired.y = (desired.y / dl) * s;
  } else {
    desired.x = desired.y = 0;
  }
  if (g.dive > 0) {
    // committed dive: lateral lunge toward the chosen side
    desired.x = 0;
    desired.y = g.diveDir * GOALIE.diveSpeed;
    g.butterfly = Math.max(g.butterfly, 0.2);
  }
  let ax = desired.x - g.vel.x,
    ay = desired.y - g.vel.y;
  const al = Math.hypot(ax, ay);
  const maxA = GOALIE.accel * dt * (g.dive > 0 ? 2.5 : 1);
  if (al > maxA) {
    ax *= maxA / al;
    ay *= maxA / al;
  }
  g.vel.x += ax;
  g.vel.y += ay;
  integrate(g.pos, g.vel, dt);
  // face the puck
  g.facing = Math.atan2(p.pos.y - g.pos.y, p.pos.x - g.pos.x);

  // --- blocking / saving ---
  if (!p.owner && g.pickupCooldown === 0 && gm.beaten === 0) {
    // swept test: distance from goalie center to puck segment prev→cur
    const a = gm.prevPuck;
    const b = p.pos;
    const abx = b.x - a.x,
      aby = b.y - a.y;
    const ab2 = abx * abx + aby * aby;
    let t = 0;
    if (ab2 > 1e-8) t = clamp(((g.pos.x - a.x) * abx + (g.pos.y - a.y) * aby) / ab2, 0, 1);
    const cx = a.x + abx * t,
      cy = a.y + aby * t;
    const d = Math.hypot(cx - g.pos.x, cy - g.pos.y);
    const reach = g.radius + PUCK.radius + 0.5;
    if (d < reach) {
      const towardGoal = Math.sign(p.vel.x) === goal.dir;
      const speed = len(p.vel);
      const isShot = p.isShot && speed > 6 && p.lastTouchTeam !== g.team;
      if (isShot) {
        const m = st.mods.teams[g.team];
        // angle factor: shots from wide angles are easier
        const ang = Math.abs(Math.atan2(p.pos.y - goal.lineX * 0 - 0, Math.abs(p.pos.x - goal.lineX) + 0.1));
        const angleF = 1 + ang * 0.25;
        const powerF = clamp(1 - (speed - 16) / 60, 0.62, 1.05);
        const highF = p.z > 0.8 ? 0.9 : 1;
        // screened? opponent skater between puck path and goalie
        let screen = 1;
        for (const oid of st.teams[g.team === 0 ? 1 : 0].skaters) {
          const o = st.skaters[oid];
          if (Math.hypot(o.pos.x - g.pos.x, o.pos.y - g.pos.y) < 2.6) screen = 0.85;
        }
        // read: charged shots telegraph; quick releases beat the goalie
        const readF = 0.86 + 0.28 * clamp(p.shotCharge, 0, 1);
        let diveF = 1;
        let bigSave = false;
        if (g.dive > 0) {
          const side = Math.sign(p.pos.y - g.pos.y) || 1;
          const right = side === Math.sign(g.diveDir || 1);
          diveF = right ? GOALIE.diveRightMul : GOALIE.diveWrongMul;
          bigSave = right;
        }
        let chance = GOALIE.baseSaveChance * SKATER.statScale(g.stats.hands) * m.goalieSaveMul * angleF * powerF * highF * screen * readF * diveF * (gm.beaten > 0 ? 0.3 : 1);
        const team = st.teams[g.team];
        if (g.onFire > 0) chance *= 1.35;
        if (team.brickWall > 0) {
          chance = 2;
          team.brickWall--;
          bigSave = true;
        } else if (p.laser) chance = 0;
        if (rng.next() < clamp(chance, 0.15, 0.97) || chance >= 2) {
          if (bigSave) events.push({ type: 'bigSave', goalie: g.id, pos: { ...p.pos } });
          // SAVE
          g.saves++;
          events.push({ type: 'save', goalie: g.id, pos: { ...p.pos } });
          const rebound = rng.next() < GOALIE.reboundChance * m.reboundMul;
          if (rebound) {
            // deflect out at reduced speed, random angle in front
            const outAng = Math.atan2(rng.next() - 0.5, -goal.dir) + (rng.next() - 0.5) * 1.4;
            const s = speed * GOALIE.reboundSpeedMul;
            p.vel.x = Math.cos(outAng) * s;
            p.vel.y = Math.sin(outAng) * s;
            p.pos.x = g.pos.x - goal.dir * (reach + 0.05);
            p.z = 0;
            p.vz = 0;
            p.isShot = false;
            g.pickupCooldown = 0.2;
            g.butterfly = GOALIE.butterflyTime;
          } else {
            givePuck(st, g, events);
            gm.holdTimer = 0;
            g.butterfly = GOALIE.butterflyTime;
          }
        } else {
          // BEATEN — puck passes through
          gm.beaten = 0.55;
          g.butterfly = GOALIE.butterflyTime;
        }
      } else if (!towardGoal || speed < 6) {
        // loose puck near goalie: cover it (unless own team's puck moving away)
        if (speed < 9) {
          givePuck(st, g, events);
          gm.holdTimer = 0;
        }
      } else {
        // slow-ish puck toward goal (e.g. pass across) – block it
        p.vel.x = -goal.dir * Math.max(3, speed * 0.3);
        p.vel.y *= 0.5;
        p.pos.x = g.pos.x - goal.dir * (reach + 0.05);
        g.pickupCooldown = 0.15;
      }
    }
  }
  gm.prevPuck.x = p.pos.x;
  gm.prevPuck.y = p.pos.y;
}

export function resetGoalieMem(g: Skater): void {
  const m = getMem(g);
  m.beaten = 0;
  m.holdTimer = 0;
  m.prevPuck.x = st_dummy.x;
  m.prevPuck.y = st_dummy.y;
}
const st_dummy = { x: 0, y: 0 };
