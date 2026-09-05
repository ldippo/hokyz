import { RINK } from './constants';
import type { Vec2, TeamId } from './types';

const hx = RINK.length / 2;
const hy = RINK.width / 2;
const R = RINK.cornerRadius;

/** Signed distance to rounded-rect boards. Negative = inside. */
export function boardsSdf(p: Vec2): number {
  const qx = Math.abs(p.x) - (hx - R);
  const qy = Math.abs(p.y) - (hy - R);
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - R;
}

/** Inward-facing normal at p (points toward rink center). */
export function boardsNormal(p: Vec2): Vec2 {
  const qx = Math.abs(p.x) - (hx - R);
  const qy = Math.abs(p.y) - (hy - R);
  const sx = Math.sign(p.x) || 1;
  const sy = Math.sign(p.y) || 1;
  if (qx > 0 && qy > 0) {
    const l = Math.hypot(qx, qy) || 1;
    return { x: -(qx / l) * sx, y: -(qy / l) * sy };
  }
  if (qx > qy) return { x: -sx, y: 0 };
  return { x: 0, y: -sy };
}

export interface GoalGeom {
  team: TeamId; // team defending this goal
  lineX: number; // goal line x (signed)
  dir: number; // +1 if net is at +x side
  mouth: { y1: number; y2: number };
  backX: number;
  posts: [Vec2, Vec2];
}

/** Team 0 defends −x goal, attacks +x. Team 1 defends +x goal. */
export const GOALS: [GoalGeom, GoalGeom] = [
  {
    team: 0,
    lineX: -RINK.goalLineX,
    dir: -1,
    mouth: { y1: -RINK.goalWidth / 2, y2: RINK.goalWidth / 2 },
    backX: -RINK.goalLineX - RINK.goalDepth,
    posts: [
      { x: -RINK.goalLineX, y: -RINK.goalWidth / 2 },
      { x: -RINK.goalLineX, y: RINK.goalWidth / 2 },
    ],
  },
  {
    team: 1,
    lineX: RINK.goalLineX,
    dir: 1,
    mouth: { y1: -RINK.goalWidth / 2, y2: RINK.goalWidth / 2 },
    backX: RINK.goalLineX + RINK.goalDepth,
    posts: [
      { x: RINK.goalLineX, y: -RINK.goalWidth / 2 },
      { x: RINK.goalLineX, y: RINK.goalWidth / 2 },
    ],
  },
];

export const CROSSBAR_HEIGHT = 1.2;

/** Goal the given team attacks. */
export const attackGoal = (team: TeamId): GoalGeom => GOALS[team === 0 ? 1 : 0];
export const defendGoal = (team: TeamId): GoalGeom => GOALS[team];
/** Direction (+1/−1 on x) team attacks toward. */
export const attackDir = (team: TeamId): number => (team === 0 ? 1 : -1);

export const CENTER: Vec2 = { x: 0, y: 0 };

export const FACEOFF_SPOTS: Vec2[] = [
  { x: 0, y: 0 },
  { x: -RINK.faceoffDotX, y: -RINK.faceoffDotY },
  { x: -RINK.faceoffDotX, y: RINK.faceoffDotY },
  { x: RINK.faceoffDotX, y: -RINK.faceoffDotY },
  { x: RINK.faceoffDotX, y: RINK.faceoffDotY },
];

/** Nearest faceoff spot in the zone of the team that was scored against / etc. */
export function nearestFaceoffSpot(p: Vec2, sideX?: number): Vec2 {
  let best = FACEOFF_SPOTS[0];
  let bd = Infinity;
  for (const s of FACEOFF_SPOTS) {
    if (sideX !== undefined && Math.sign(s.x) !== Math.sign(sideX) && s.x !== 0) continue;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}

/** Is a point inside the net box (behind goal line)? */
export function inNetBox(p: Vec2, g: GoalGeom, pad = 0): boolean {
  const xIn = g.dir > 0 ? p.x > g.lineX - pad && p.x < g.backX + pad : p.x < g.lineX + pad && p.x > g.backX - pad;
  return xIn && p.y > g.mouth.y1 - pad && p.y < g.mouth.y2 + pad;
}

export function isInsideRink(p: Vec2, r = 0): boolean {
  return boardsSdf(p) < -r;
}

export function clampToRink(p: Vec2, r: number): Vec2 {
  const s = boardsSdf(p);
  if (s > -r) {
    const n = boardsNormal(p);
    const push = s + r;
    return { x: p.x + n.x * push, y: p.y + n.y * push };
  }
  return p;
}
