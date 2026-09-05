import type { MatchState, Skater, Puck } from '../sim/types';

/** Minimal per-frame snapshot of what the renderer needs. */
export interface SkaterFrame {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  knockdown: number;
  lunge: number;
  deke: number;
  stumble: number;
  turboActive: boolean;
  charging: boolean;
  shotCharge: number;
  hasPuck: boolean;
  onFire: number;
  butterfly: number;
}
export interface Frame {
  t: number;
  skaters: Record<string, SkaterFrame>;
  puck: { x: number; y: number; z: number; vx: number; vy: number; owner: string | null };
}

export function captureFrame(st: MatchState): Frame {
  const skaters: Record<string, SkaterFrame> = {};
  for (const id of st.order) {
    const s = st.skaters[id];
    skaters[id] = { x: s.pos.x, y: s.pos.y, vx: s.vel.x, vy: s.vel.y, facing: s.facing, knockdown: s.knockdown, lunge: s.lunge, deke: s.deke, stumble: s.stumble, turboActive: s.turboActive, charging: s.charging, shotCharge: s.shotCharge, hasPuck: s.hasPuck, onFire: s.onFire, butterfly: s.butterfly };
  }
  const p = st.puck;
  return { t: st.t, skaters, puck: { x: p.pos.x, y: p.pos.y, z: p.z, vx: p.vel.x, vy: p.vel.y, owner: p.owner } };
}

/** Ring buffer of recent frames. */
export class ReplayBuffer {
  private frames: Frame[] = [];
  private head = 0;
  private filled = 0;
  constructor(public capacity = 300) {}
  push(f: Frame): void {
    this.frames[this.head] = f;
    this.head = (this.head + 1) % this.capacity;
    this.filled = Math.min(this.capacity, this.filled + 1);
  }
  /** Oldest → newest copy. */
  snapshot(): Frame[] {
    const out: Frame[] = [];
    for (let i = 0; i < this.filled; i++) out.push(this.frames[(this.head - this.filled + i + this.capacity) % this.capacity]);
    return out;
  }
  clear(): void {
    this.filled = 0;
    this.head = 0;
  }
}

/** Build a Skater-shaped object the rigs can consume from a frame (mutates target in place). */
export function applyFrameToSkater(target: Skater, f: SkaterFrame, prev?: SkaterFrame, alpha = 1): void {
  const a = alpha;
  const lerp = (x: number, y: number) => x + (y - x) * a;
  if (prev) {
    target.pos.x = lerp(prev.x, f.x);
    target.pos.y = lerp(prev.y, f.y);
    let d = f.facing - prev.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    target.facing = prev.facing + d * a;
  } else {
    target.pos.x = f.x;
    target.pos.y = f.y;
    target.facing = f.facing;
  }
  target.vel.x = f.vx;
  target.vel.y = f.vy;
  target.knockdown = f.knockdown;
  target.lunge = f.lunge;
  target.deke = f.deke;
  target.stumble = f.stumble;
  target.turboActive = f.turboActive;
  target.charging = f.charging;
  target.shotCharge = f.shotCharge;
  target.hasPuck = f.hasPuck;
  target.onFire = f.onFire;
  target.butterfly = f.butterfly;
}

export function applyFrameToPuck(target: Puck, f: Frame['puck'], prev?: Frame['puck'], alpha = 1): void {
  const lerp = (x: number, y: number) => x + (y - x) * alpha;
  target.pos.x = prev ? lerp(prev.x, f.x) : f.x;
  target.pos.y = prev ? lerp(prev.y, f.y) : f.y;
  target.z = prev ? lerp(prev.z, f.z) : f.z;
  target.vel.x = f.vx;
  target.vel.y = f.vy;
  target.owner = f.owner;
}
