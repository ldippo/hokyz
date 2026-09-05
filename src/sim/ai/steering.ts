import type { Vec2 } from '../types';
import { clamp, len, norm, sub } from '../vec';

export function seek(from: Vec2, to: Vec2): Vec2 {
  return norm(sub(to, from));
}

/** Arrive: slows within radius. Returns move vector (len ≤ 1). */
export function arrive(from: Vec2, to: Vec2, slowRadius = 1.5): Vec2 {
  const d = sub(to, from);
  const l = len(d);
  if (l < 0.05) return { x: 0, y: 0 };
  const s = clamp(l / slowRadius, 0, 1);
  return { x: (d.x / l) * s, y: (d.y / l) * s };
}

export function predict(pos: Vec2, vel: Vec2, t: number): Vec2 {
  return { x: pos.x + vel.x * t, y: pos.y + vel.y * t };
}
