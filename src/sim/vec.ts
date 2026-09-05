import type { Vec2 } from './types';

export const v = (x = 0, y = 0): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const len2 = (a: Vec2): number => a.x * a.x + a.y * a.y;
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Vec2): Vec2 => {
  const l = len(a);
  return l > 1e-6 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
};
export const fromAngle = (a: number, m = 1): Vec2 => ({ x: Math.cos(a) * m, y: Math.sin(a) * m });
export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
export const clampLen = (a: Vec2, max: number): Vec2 => {
  const l = len(a);
  return l > max ? scale(a, max / l) : a;
};
export const rot = (a: Vec2, ang: number): Vec2 => {
  const c = Math.cos(ang),
    s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};
export const angleDiff = (a: number, b: number): number => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
export const slewAngle = (cur: number, target: number, maxDelta: number): number => {
  const d = angleDiff(cur, target);
  return cur + clamp(d, -maxDelta, maxDelta);
};
export const copyInto = (dst: Vec2, src: Vec2): void => {
  dst.x = src.x;
  dst.y = src.y;
};
