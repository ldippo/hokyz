import { BLOCK, PUCK } from './constants';
import type { MatchEvent, MatchState } from './types';
import { angleOf, fromAngle, len } from './vec';
import type { Rng } from '../core/rng';

/**
 * Free pucks hit bodies. Upright skaters block shots (clean block or deflection, sometimes
 * a sting); fallen bodies stop low pucks. Goalies are handled in goalie.ts.
 */
export function collidePuckSkaters(st: MatchState, rng: Rng, events: MatchEvent[]): void {
  const p = st.puck;
  if (p.owner) return;
  if (p.saucer && p.z > 0.35) return;
  const speed = len(p.vel);
  for (const id of st.order) {
    const sk = st.skaters[id];
    if (sk.isGoalie) continue;
    if (p.lastTouch === id && p.freeTime < BLOCK.selfBlockGrace) continue;
    const dx = p.pos.x - sk.pos.x,
      dy = p.pos.y - sk.pos.y;
    const d = Math.hypot(dx, dy);
    const down = sk.knockdown > 0;
    const reach = (down ? sk.radius * 1.4 : sk.radius) + PUCK.radius;
    if (d > reach) continue;
    if (down ? p.z > BLOCK.bodyLowZ : p.z > BLOCK.maxZ) continue;
    const n = d > 1e-4 ? { x: dx / d, y: dy / d } : { x: 1, y: 0 };
    // moving toward the body?
    const vn = p.vel.x * n.x + p.vel.y * n.y;
    if (vn > 0) continue;
    const isShot = p.isShot && speed >= BLOCK.minShotSpeed;
    if (isShot && !down) {
      const clean = rng.next() < BLOCK.cleanBase + sk.stats.balance * BLOCK.cleanPerBalance;
      const shooter = p.lastTouch;
      if (clean) {
        p.vel.x = n.x * speed * BLOCK.cleanSpeedMul;
        p.vel.y = n.y * speed * BLOCK.cleanSpeedMul;
        p.z = 0;
        p.vz = 0;
      } else {
        const ang = angleOf(n) + (rng.next() - 0.5) * 1.8;
        const v = fromAngle(ang, speed * BLOCK.deflectSpeedMul);
        p.vel.x = v.x;
        p.vel.y = v.y;
        p.vz = Math.min(p.vz, 0) + rng.next() * 1.5;
      }
      p.pos.x = sk.pos.x + n.x * (reach + 0.02);
      p.pos.y = sk.pos.y + n.y * (reach + 0.02);
      p.isShot = !clean;
      p.laser = false;
      p.prevTouch = p.lastTouch;
      p.lastTouch = sk.id;
      p.lastTouchTeam = sk.team;
      sk.blocks++;
      if (speed >= BLOCK.stingSpeed && sk.stats.balance < BLOCK.stingBalance && !(sk.specialTimer > 0 && sk.specialKind === 'bulldoze')) {
        sk.stumble = Math.max(sk.stumble, BLOCK.stingTime);
        events.push({ type: 'sting', skater: sk.id });
      }
      events.push({ type: 'shotBlock', blocker: sk.id, shooter, pos: { x: p.pos.x, y: p.pos.y }, clean });
      st.shake = Math.max(st.shake, clean ? 0.15 : 0.05);
      return;
    }
    // upright skaters take slow pucks on the stick (pickup logic); only fallen bodies bounce them
    if (!down) continue;
    const e = 0.25;
    p.vel.x -= (1 + e) * vn * n.x;
    p.vel.y -= (1 + e) * vn * n.y;
    p.vel.x *= 0.6;
    p.vel.y *= 0.6;
    p.pos.x = sk.pos.x + n.x * (reach + 0.02);
    p.pos.y = sk.pos.y + n.y * (reach + 0.02);
    return;
  }
}
