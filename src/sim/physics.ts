import { PUCK, RINK, SKATER } from './constants';
import { boardsNormal, boardsSdf, GOALS, inNetBox } from './rink';
import type { MatchEvent, MatchState, Puck, Skater, Vec2 } from './types';
import { dot, len, sub } from './vec';

/** Apply exponential damping: v *= e^(-k dt) */
export function damp(vel: Vec2, k: number, dt: number): void {
  const f = Math.exp(-k * dt);
  vel.x *= f;
  vel.y *= f;
}

export function integrate(pos: Vec2, vel: Vec2, dt: number): void {
  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
}

/** Push a circle inside the boards, reflect velocity. Returns impact speed if collided. */
export function collideBoards(pos: Vec2, vel: Vec2, r: number, restitution: number, friction: number, bouncy = false): number {
  const s = boardsSdf(pos);
  if (s > -r) {
    const n = boardsNormal(pos);
    const push = s + r;
    pos.x += n.x * push;
    pos.y += n.y * push;
    const vn = dot(vel, n);
    if (vn < 0) {
      const e = bouncy ? Math.min(1, restitution * 1.6) : restitution;
      // reflect normal component, damp tangential
      const tx = vel.x - n.x * vn;
      const ty = vel.y - n.y * vn;
      vel.x = tx * friction - n.x * vn * e;
      vel.y = ty * friction - n.y * vn * e;
      return -vn;
    }
  }
  return 0;
}

/** Skaters cannot enter net boxes. Push out along shortest axis. */
export function collideNetBox(pos: Vec2, vel: Vec2, r: number): void {
  for (const g of GOALS) {
    if (!inNetBox(pos, g, r)) continue;
    // candidate pushes: out the mouth (toward center), or sideways
    const mouthX = g.lineX - g.dir * r;
    const dxMouth = Math.abs(pos.x - mouthX);
    const dySide1 = Math.abs(pos.y - (g.mouth.y1 - r));
    const dySide2 = Math.abs(pos.y - (g.mouth.y2 + r));
    const m = Math.min(dxMouth, dySide1, dySide2);
    if (m === dxMouth) {
      pos.x = mouthX;
      if (Math.sign(vel.x) === g.dir) vel.x = 0;
    } else if (m === dySide1) {
      pos.y = g.mouth.y1 - r;
      if (vel.y > 0) vel.y = 0;
    } else {
      pos.y = g.mouth.y2 + r;
      if (vel.y < 0) vel.y = 0;
    }
  }
}

/** Puck vs posts + net back/sides. Returns 'post' | 'net' | null. */
export function collidePuckNet(p: Puck): 'post' | 'net' | null {
  let result: 'post' | 'net' | null = null;
  for (const g of GOALS) {
    for (const post of g.posts) {
      const d = sub(p.pos, post);
      const l = len(d);
      const rr = PUCK.radius + 0.07;
      if (l < rr && l > 1e-6) {
        const nx = d.x / l,
          ny = d.y / l;
        p.pos.x = post.x + nx * rr;
        p.pos.y = post.y + ny * rr;
        const vn = p.vel.x * nx + p.vel.y * ny;
        if (vn < 0) {
          p.vel.x -= 1.8 * vn * nx;
          p.vel.y -= 1.8 * vn * ny;
          result = 'post';
        }
      }
    }
    // inside net: heavy damping + contain within box
    if (inNetBox(p.pos, g)) {
      const backLimit = g.backX - g.dir * PUCK.radius;
      if (g.dir > 0 ? p.pos.x > backLimit : p.pos.x < backLimit) {
        p.pos.x = backLimit;
        p.vel.x *= -0.2;
      }
      if (p.pos.y < g.mouth.y1 + PUCK.radius) {
        p.pos.y = g.mouth.y1 + PUCK.radius;
        p.vel.y *= -0.2;
      }
      if (p.pos.y > g.mouth.y2 - PUCK.radius) {
        p.pos.y = g.mouth.y2 - PUCK.radius;
        p.vel.y *= -0.2;
      }
      p.vel.x *= 0.85;
      p.vel.y *= 0.85;
      result = result ?? 'net';
    } else {
      // approaching net from behind/sides: treat net walls as solid to puck
      const pad = PUCK.radius;
      const behind = g.dir > 0 ? p.pos.x > g.lineX : p.pos.x < g.lineX;
      const withinDepth = g.dir > 0 ? p.pos.x < g.backX + pad : p.pos.x > g.backX - pad;
      if (behind && withinDepth) {
        // side walls
        if (p.pos.y < g.mouth.y1 && p.pos.y > g.mouth.y1 - pad) {
          p.pos.y = g.mouth.y1 - pad;
          if (p.vel.y > 0) p.vel.y *= -0.4;
        } else if (p.pos.y > g.mouth.y2 && p.pos.y < g.mouth.y2 + pad) {
          p.pos.y = g.mouth.y2 + pad;
          if (p.vel.y < 0) p.vel.y *= -0.4;
        }
      }
      // back wall from behind
      const beyondBack = g.dir > 0 ? p.pos.x > g.backX && p.pos.x < g.backX + pad : p.pos.x < g.backX && p.pos.x > g.backX - pad;
      if (beyondBack && p.pos.y > g.mouth.y1 - pad && p.pos.y < g.mouth.y2 + pad) {
        p.pos.x = g.backX + g.dir * pad;
        if (Math.sign(p.vel.x) === -g.dir) p.vel.x *= -0.4;
      }
    }
  }
  return result;
}

/** Skater-skater soft body collision. */
export function collideSkaters(a: Skater, b: Skater): void {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  const d = Math.hypot(dx, dy);
  const minD = a.radius + b.radius;
  if (d >= minD || d < 1e-6) return;
  const nx = dx / d,
    ny = dy / d;
  const overlap = minD - d;
  const downA = a.knockdown > 0;
  const downB = b.knockdown > 0;
  // knocked-down skaters are lighter obstacles
  const wa = downA ? 0.2 : b.mass / (a.mass + b.mass);
  const wb = downB ? 0.2 : a.mass / (a.mass + b.mass);
  a.pos.x -= nx * overlap * wa;
  a.pos.y -= ny * overlap * wa;
  b.pos.x += nx * overlap * wb;
  b.pos.y += ny * overlap * wb;
  const rvx = b.vel.x - a.vel.x;
  const rvy = b.vel.y - a.vel.y;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    const e = 0.25;
    const j = (-(1 + e) * vn) / (1 / a.mass + 1 / b.mass);
    a.vel.x -= (j / a.mass) * nx;
    a.vel.y -= (j / a.mass) * ny;
    b.vel.x += (j / b.mass) * nx;
    b.vel.y += (j / b.mass) * ny;
  }
}

export function stepPuckPhysics(st: MatchState, dt: number, events: MatchEvent[]): void {
  const p = st.puck;
  if (p.owner) return;
  const friction = PUCK.friction * st.mods.puckFrictionMul * (p.z > 0.05 ? 0.15 : 1);
  damp(p.vel, friction, dt);
  integrate(p.pos, p.vel, dt);
  // vertical
  if (p.z > 0 || p.vz > 0) {
    p.vz -= PUCK.gravity * dt;
    p.z += p.vz * dt;
    if (p.z <= 0) {
      p.z = 0;
      p.vz = -p.vz * PUCK.bounce;
      if (Math.abs(p.vz) < 0.8) p.vz = 0;
    }
  }
  const hit = collideBoards(p.pos, p.vel, PUCK.radius, RINK.boardRestitution, RINK.boardFriction, st.mods.boardsBouncy);
  if (hit > 4) {
    events.push({ type: 'boards', pos: { ...p.pos }, speed: hit });
    if (p.z > 1.0) p.vz = Math.min(p.vz, 0);
  }
  const net = collidePuckNet(p);
  if (net === 'post') events.push({ type: 'post', pos: { ...p.pos } });
  p.freeTime += dt;
}

export const SKATER_DAMP = SKATER.iceFriction;
