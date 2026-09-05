import { AI, HIT, RINK } from '../constants';
import { attackDir, attackGoal, defendGoal, boardsSdf } from '../rink';
import type { Input, MatchState, Skater, Vec2 } from '../types';
import { angleDiff, angleOf, clamp, dist, len, norm, sub } from '../vec';
import { arrive, predict, seek } from './steering';
import type { Rng } from '../../core/rng';

export type Role = 'carrier' | 'supportHigh' | 'supportLow' | 'chase' | 'pressure' | 'mark' | 'back';

export interface Brain {
  role: Role;
  timer: number;
  target: Vec2;
  turbo: boolean;
  shootHold: number; // >0 means currently charging, counts down to release
  wantShoot: boolean;
  lastDecision: number;
  pressureMemory: number;
  checkRetry: number;
  interval: number;
}

export function makeBrain(): Brain {
  return { role: 'back', timer: 0, target: { x: 0, y: 0 }, turbo: false, shootHold: 0, wantShoot: false, lastDecision: -1, pressureMemory: 0, checkRetry: 0, interval: 0.2 };
}

const diff = (st: MatchState, sk: Skater, key: keyof typeof AI): number => {
  const arr = AI[key] as number[];
  const d = clamp(st.teams[sk.team].difficulty, 0, arr.length - 1);
  return arr[d];
};

function keepInRink(p: Vec2, margin = 1.6): Vec2 {
  const out = { x: p.x, y: p.y };
  const hx = RINK.length / 2 - margin,
    hy = RINK.width / 2 - margin;
  out.x = clamp(out.x, -hx, hx);
  out.y = clamp(out.y, -hy, hy);
  // corners: pull in if outside rounded boards
  let guard = 0;
  while (boardsSdf(out) > -margin && guard++ < 8) {
    out.x *= 0.95;
    out.y *= 0.95;
  }
  return out;
}

function nearestOpponent(st: MatchState, sk: Skater, excludeGoalie = true): { sk: Skater | null; d: number } {
  const opp = st.teams[sk.team === 0 ? 1 : 0];
  let best: Skater | null = null;
  let bd = Infinity;
  for (const id of opp.skaters) {
    const o = st.skaters[id];
    if (excludeGoalie && o.isGoalie) continue;
    if (o.knockdown > 0) continue;
    const d = dist(o.pos, sk.pos);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return { sk: best, d: bd };
}

/** Is an opponent lunging at us right now? */
function incomingCheck(st: MatchState, sk: Skater): boolean {
  const opp = st.teams[sk.team === 0 ? 1 : 0];
  for (const id of opp.skaters) {
    const o = st.skaters[id];
    if (o.lunge <= 0) continue;
    const d = dist(o.pos, sk.pos);
    if (d > HIT.reach + 1.6) continue;
    const ang = angleOf(sub(sk.pos, o.pos));
    if (Math.abs(angleDiff(o.facing, ang)) < HIT.coneHalfAngle * 1.3) return true;
  }
  return false;
}

export function thinkSkater(st: MatchState, sk: Skater, brain: Brain, dt: number, rng: Rng): Input {
  const input: Input = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, turbo: false, pass: false, passHeld: false, passHoldTime: 0, shoot: false, shootRelease: false, check: false, deke: false, special: false };
  if (sk.knockdown > 0) return input;
  const team = st.teams[sk.team];
  const dir = attackDir(sk.team);
  const goal = attackGoal(sk.team);
  const own = defendGoal(sk.team);
  const p = st.puck;
  const react = diff(st, sk, 'reactDelay');
  brain.timer -= dt;
  brain.checkRetry = Math.max(0, brain.checkRetry - dt);
  const decide = brain.timer <= 0;
  if (decide) {
    brain.interval = react + rng.next() * react;
    brain.timer = brain.interval;
  }
  /** probability for a per-second rate over this decision interval */
  const rateP = (rate: number) => 1 - Math.exp(-rate * brain.interval);

  const ownerSk = p.owner ? st.skaters[p.owner] : null;
  const weHavePuck = ownerSk?.team === sk.team;
  const theyHavePuck = ownerSk && ownerSk.team !== sk.team;

  // ---------- CARRIER ----------
  if (sk.hasPuck) {
    const goalCenter = { x: goal.lineX, y: 0 };
    const dGoal = Math.abs(goal.lineX - sk.pos.x);
    const angleToGoal = Math.abs(Math.atan2(sk.pos.y, dGoal + 0.01));
    const near = nearestOpponent(st, sk);
    const pressured = near.d < 2.4 && near.sk !== null;
    const inShootZone = dGoal < AI.shootRangeX && angleToGoal < 0.8 && Math.sign(goal.lineX - sk.pos.x) === dir && dGoal > 1.5;
    const oppGoalieId = st.teams[sk.team === 0 ? 1 : 0].goalie;
    const emptyNet = oppGoalieId === null;

    // shooting state machine
    if (brain.shootHold > 0) {
      brain.shootHold -= dt;
      input.shoot = true;
      // aim: bias toward far side from goalie
      const g = oppGoalieId ? st.skaters[oppGoalieId] : null;
      input.move.y = g ? -Math.sign(g.pos.y || (rng.next() - 0.5)) * 0.8 : (rng.next() - 0.5) * 1.2;
      input.move.x = dir * 0.3;
      if (brain.shootHold <= 0) {
        input.shootRelease = true;
        input.shoot = false;
      }
      return input;
    }
    if (decide) {
      const accuracyPref = diff(st, sk, 'shotAccuracy');
      const oneTimer = st.t - sk.receivedAt < 0.25 && inShootZone;
      if (oneTimer && rng.next() < accuracyPref) {
        brain.shootHold = 0.01;
      } else if ((inShootZone && rng.next() < rateP(diff(st, sk, 'shootRate') * (pressured ? 1.8 : 1))) || (emptyNet && dGoal < 22 && rng.next() < rateP(1.5))) {
        // charge longer from farther out, shorter if pressured
        brain.shootHold = pressured ? 0.15 : clamp(0.25 + dGoal / 25, 0.2, 0.9);
      } else if (pressured && rng.next() < rateP(diff(st, sk, 'passSmarts') * 4)) {
        // pass to best option
        input.pass = true;
        return input;
      } else if (pressured && incomingCheck(st, sk) && rng.next() < 0.6) {
        input.deke = true;
      } else if (!pressured && rng.next() < rateP((sk.pos.x * dir < -RINK.blueLineX ? 1.3 : 0.35) * diff(st, sk, 'passSmarts')) && dGoal > 12) {
        // outlet / up-ice pass to an open teammate ahead (much likelier on the breakout)
        for (const id of team.skaters) {
          const t = st.skaters[id];
          if (t.id === sk.id) continue;
          if ((t.pos.x - sk.pos.x) * dir > 5 && nearestOpponent(st, t).d > 3.5) {
            input.pass = true;
            input.move = norm(sub(t.pos, sk.pos));
            return input;
          }
        }
      }
      // skate lane: aim at a point in front of the net, drifting away from nearest defender
      let ty = clamp(sk.pos.y * 0.4, -5, 5);
      if (near.sk) {
        const away = Math.sign(sk.pos.y - near.sk.pos.y) || (rng.next() < 0.5 ? -1 : 1);
        ty = clamp(sk.pos.y + away * 4, -RINK.width / 2 + 3, RINK.width / 2 - 3);
      }
      const tx = goalCenter.x - dir * 5.5;
      brain.target = keepInRink({ x: tx, y: ty });
      brain.turbo = !pressured && rng.next() < diff(st, sk, 'turboUse') && sk.turbo > 0.3;
    }
    input.move = seek(sk.pos, brain.target);
    input.turbo = brain.turbo && sk.turbo > 0.1;
    return input;
  }

  // ---------- OFF PUCK ----------
  const oppTeam = st.teams[sk.team === 0 ? 1 : 0];
  if (decide) {
    brain.turbo = false;
    if (weHavePuck && ownerSk) {
      // support positions relative to carrier
      const ahead = ownerSk.pos.x * dir < goal.lineX * dir - 8;
      const mySide = Math.sign(sk.pos.y - ownerSk.pos.y) || (brain.role === 'supportHigh' ? 1 : -1);
      const breakout = ownerSk.pos.x * dir < -RINK.blueLineX;
      if (breakout) {
        // breakout lanes: wingers fan to the boards ahead of the carrier, trailer offers a drop pass
        if (brain.role === 'supportHigh') brain.target = keepInRink({ x: ownerSk.pos.x + dir * 9, y: mySide * 8.5 });
        else brain.target = keepInRink({ x: ownerSk.pos.x + dir * 3.5, y: -mySide * 7 });
        brain.turbo = rng.next() < diff(st, sk, 'turboUse') * 0.5;
      } else if (brain.role === 'supportHigh') {
        // go to far post / slot for one-timer
        const slotX = goal.lineX - dir * (ahead ? 7 : 5);
        brain.target = keepInRink({ x: slotX, y: clamp(-Math.sign(ownerSk.pos.y || mySide) * 4.5, -6, 6) });
      } else {
        // trail: behind carrier, other side, ready for drop pass / defense
        brain.target = keepInRink({ x: ownerSk.pos.x - dir * 5, y: clamp(mySide * 5 + ownerSk.pos.y * 0.3, -8, 8) });
      }
      brain.turbo = rng.next() < diff(st, sk, 'turboUse') * 0.4 && dist(sk.pos, brain.target) > 6;
    } else if (theyHavePuck && ownerSk) {
      if (brain.role === 'pressure') {
        brain.target = predict(ownerSk.pos, ownerSk.vel, 0.25);
        brain.turbo = rng.next() < diff(st, sk, 'turboUse') && dist(sk.pos, ownerSk.pos) > 3;
      } else if ((brain.role === 'mark' || brain.role === 'back') && ownerSk.charging && Math.hypot(ownerSk.pos.x - own.lineX, ownerSk.pos.y) < 15 && rng.next() < diff(st, sk, 'laneBlock')) {
        // the carrier is winding up: step into the shooting lane
        const toGoal = norm(sub({ x: own.lineX, y: 0 }, ownerSk.pos));
        brain.target = keepInRink({ x: ownerSk.pos.x + toGoal.x * 2.6, y: ownerSk.pos.y + toGoal.y * 2.6 });
        brain.timer = Math.min(brain.timer, 0.08);
      } else if (brain.role === 'mark') {
        // mark the most dangerous other opponent
        let mark: Skater | null = null;
        let bs = -Infinity;
        for (const id of oppTeam.skaters) {
          const o = st.skaters[id];
          if (o.id === ownerSk.id || o.isGoalie) continue;
          const s = -Math.abs(o.pos.x - own.lineX);
          if (s > bs) {
            bs = s;
            mark = o;
          }
        }
        if (mark) {
          // stand between mark and own goal
          const toGoal = norm(sub({ x: own.lineX, y: 0 }, mark.pos));
          brain.target = keepInRink({ x: mark.pos.x + toGoal.x * 1.5, y: mark.pos.y + toGoal.y * 1.5 });
        } else brain.target = { x: own.lineX + -own.dir * 6, y: 0 };
      } else {
        // back: between puck and own goal, ~5m out
        const toGoal = norm(sub({ x: own.lineX, y: 0 }, ownerSk.pos));
        const d = dist(ownerSk.pos, { x: own.lineX, y: 0 });
        const k = clamp(d - 5, 2, d * 0.6);
        brain.target = keepInRink({ x: ownerSk.pos.x + toGoal.x * k, y: (ownerSk.pos.y + toGoal.y * k) * 0.7 });
      }
    } else {
      // free puck
      if (brain.role === 'chase') {
        brain.target = predict(p.pos, p.vel, clamp(dist(sk.pos, p.pos) / 12, 0.05, 0.5));
        brain.turbo = rng.next() < diff(st, sk, 'turboUse') && dist(sk.pos, p.pos) > 4;
      } else if (brain.role === 'supportHigh') {
        brain.target = keepInRink({ x: p.pos.x + dir * 6, y: -Math.sign(p.pos.y || 1) * 4 });
      } else {
        brain.target = keepInRink({ x: p.pos.x - dir * 6, y: p.pos.y * 0.5 });
      }
    }
  }

  // execute movement
  const usesArrive = brain.role !== 'chase' && brain.role !== 'pressure';
  input.move = usesArrive ? arrive(sk.pos, brain.target, 2) : seek(sk.pos, brain.target);
  input.turbo = brain.turbo && sk.turbo > 0.15;

  // checking: pressure role or anyone close to carrier
  if (theyHavePuck && ownerSk && !ownerSk.isGoalie && sk.checkCooldown === 0 && sk.lunge === 0 && brain.role !== 'back') {
    const d = dist(sk.pos, ownerSk.pos);
    const ang = angleOf(sub(ownerSk.pos, sk.pos));
    const facingOk = Math.abs(angleDiff(sk.facing, ang)) < HIT.coneHalfAngle * 1.1;
    const closing = len(sk.vel) > 2;
    if (d < HIT.reach + sk.radius + ownerSk.radius + 1.0 && facingOk && closing && brain.checkRetry === 0) {
      brain.checkRetry = diff(st, sk, 'checkRetry') * (0.7 + rng.next() * 0.6);
      if (rng.next() < diff(st, sk, 'checkAggression') * (brain.role === 'pressure' ? 1 : 0.35)) {
        input.check = true;
        input.move = norm(sub(ownerSk.pos, sk.pos));
      }
    }
  }
  // dodge incoming checks
  if (incomingCheck(st, sk) && sk.deke === 0 && rng.next() < 0.35 * diff(st, sk, 'passSmarts')) {
    input.deke = true;
  }
  return input;
}
