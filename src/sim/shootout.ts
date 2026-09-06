import { GOALIE, RULES } from './constants';
import { resetGoalieMem } from './goalie';
import { attackGoal, defendGoal } from './rink';
import { givePuck, setControlled } from './puck';
import type { Input, MatchEvent, MatchState, ShootoutState, Skater, TeamId } from './types';
import { EMPTY_INPUT } from './types';
import { len } from './vec';
import type { Rng } from '../core/rng';

const BENCH_Y = 15.5;
const ATTEMPT_TIME = 12;

/** Pick the shooter for a team's nth attempt: best shot stat first, rotating. */
function shooterFor(st: MatchState, team: TeamId, n: number): Skater {
  const ids = st.teams[team].skaters.filter((id) => !st.skaters[id].ejected);
  const sorted = ids.map((id) => st.skaters[id]).sort((a, b) => b.stats.shot + b.stats.hands - (a.stats.shot + a.stats.hands));
  return sorted[n % sorted.length];
}

export function startShootout(st: MatchState, events: MatchEvent[], rounds: number): void {
  st.shootout = { rounds, round: 1, turn: 0, stage: 'setup', t: 0, attempts: [], goals: [0, 0], shooterId: null, suddenDeath: false, lastScored: null, ai: { deked: false, charging: 0 } };
  st.phase = 'shootout';
  st.fight = null;
  for (const t of st.teams) {
    t.pulled = false;
    t.diveWindow = 0;
    t.diveReturnId = null;
    t.scripted = true; // shooters are driven here, everyone else parks
  }
  events.push({ type: 'shootoutStart', rounds });
}

function park(st: MatchState): void {
  for (const id of st.order) {
    const s = st.skaters[id];
    if (s.isGoalie) continue;
    s.pos.x = s.team === 0 ? -8 - (st.order.indexOf(id) % 4) * 1.4 : 8 + (st.order.indexOf(id) % 4) * 1.4;
    s.pos.y = BENCH_Y;
    s.vel.x = s.vel.y = 0;
    s.hasPuck = false;
    s.knockdown = 0;
    s.lunge = 0;
    s.charging = false;
    s.shotCharge = 0;
  }
  const p = st.puck;
  p.owner = null;
  p.isShot = false;
  p.saucer = false;
  p.laser = false;
  p.vel.x = p.vel.y = 0;
  p.z = 0;
  p.vz = 0;
}

function setupAttempt(st: MatchState, so: ShootoutState, events: MatchEvent[], rng: Rng): void {
  park(st);
  const team = so.turn;
  const n = Math.floor(so.attempts.filter((a) => a.team === team).length);
  const shooter = shooterFor(st, team, n);
  const goal = attackGoal(team);
  const dir = goal.dir;
  shooter.pos.x = -dir * 1.5;
  shooter.pos.y = 0;
  shooter.facing = dir > 0 ? 0 : Math.PI;
  shooter.vel.x = shooter.vel.y = 0;
  shooter.turbo = 1;
  shooter.stumble = 0;
  shooter.invuln = 0;
  givePuck(st, shooter, events);
  so.shooterId = shooter.id;
  so.ai = { deked: false, charging: 0 };
  // goalie of the defending team in the crease; the shooting team's goalie parks in its own crease
  for (const t of st.teams) {
    if (!t.goalie) continue;
    const g = st.skaters[t.goalie];
    const dg = defendGoal(t.id);
    g.pos.x = dg.lineX - dg.dir * GOALIE.depthFromGoalLine;
    g.pos.y = 0;
    g.vel.x = g.vel.y = 0;
    g.hasPuck = false;
    g.dive = 0;
    g.butterfly = 0;
    g.knockdown = 0;
    resetGoalieMem(g);
  }
  // human control: shooter if shooting, else nothing until the dive window
  const t = st.teams[team];
  if (t.isHuman) setControlled(st, team, shooter.id, events);
  const def = st.teams[team === 0 ? 1 : 0];
  if (def.isHuman && def.controlledId && def.controlledId !== def.goalie) {
    const prev = st.skaters[def.controlledId];
    prev.controlled = false;
    def.controlledId = def.goalie;
    if (def.goalie) st.skaters[def.goalie].controlled = true;
  }
  so.stage = 'attempt';
  so.t = 0;
  so.lastScored = null;
  st.faceoffTeamAdvantage = null;
  events.push({ type: 'shootoutAttempt', team, shooter: shooter.id, round: so.round, suddenDeath: so.suddenDeath });
  void rng;
}

/** Script the AI shooter: skate in, maybe deke, charge and fire far side. */
export function aiShooterInput(st: MatchState, so: ShootoutState, sh: Skater, rng: Rng): Input {
  const goal = attackGoal(sh.team);
  const dir = goal.dir;
  const dGoal = Math.abs(goal.lineX - sh.pos.x);
  const inp: Input = { ...EMPTY_INPUT, move: { x: dir, y: 0 }, aim: { x: 0, y: 0 } };
  const gid = st.teams[sh.team === 0 ? 1 : 0].goalie;
  const g = gid ? st.skaters[gid] : null;
  const farSide = g ? -Math.sign(g.pos.y || 1) : rng.next() < 0.5 ? -1 : 1;
  if (!sh.hasPuck) return inp;
  inp.move.y = farSide * 0.25;
  inp.aim = { x: 0, y: farSide };
  if (so.ai.charging > 0) {
    so.ai.charging -= 1 / 60;
    inp.shoot = true;
    if (so.ai.charging <= 0) {
      inp.shoot = false;
      inp.shootRelease = true;
    }
    return inp;
  }
  if (!so.ai.deked && dGoal < 8 && dGoal > 5 && rng.next() < 0.5) {
    so.ai.deked = true;
    inp.deke = true;
    inp.move.y = farSide;
    return inp;
  }
  if (dGoal < 6.5 || so.t > 6) {
    so.ai.charging = 0.25 + rng.next() * 0.45;
    inp.shoot = true;
    inp.turbo = false;
  } else inp.turbo = dGoal > 10;
  return inp;
}

function attemptOver(st: MatchState, so: ShootoutState): 'goal' | 'miss' | null {
  if (st.phase === 'goal') return 'goal';
  const p = st.puck;
  const sh = so.shooterId ? st.skaters[so.shooterId] : null;
  if (!sh) return 'miss';
  const goal = attackGoal(sh.team);
  const gid = st.teams[sh.team === 0 ? 1 : 0].goalie;
  if (gid && p.owner === gid) return 'miss';
  if (!p.owner) {
    const behind = goal.dir > 0 ? p.pos.x > goal.lineX + 0.3 : p.pos.x < goal.lineX - 0.3;
    if (behind && p.freeTime > 0.2) return 'miss';
    if (p.freeTime > 0.6 && len(p.vel) < 1.0) return 'miss';
  }
  if (so.t > ATTEMPT_TIME) return 'miss';
  // shooter lost the puck to the goalie's poke or skated past the goal line
  if (sh.hasPuck && (goal.dir > 0 ? sh.pos.x > goal.lineX : sh.pos.x < goal.lineX)) return 'miss';
  return null;
}

function decided(so: ShootoutState): TeamId | null {
  const [a, b] = so.goals;
  const done = [0, 1].map((t) => so.attempts.filter((x) => x.team === t).length) as [number, number];
  if (!so.suddenDeath) {
    // regulation rounds: can the trailing team still catch up?
    const remA = so.rounds - done[0],
      remB = so.rounds - done[1];
    if (a > b + remB) return 0;
    if (b > a + remA) return 1;
    if (done[0] >= so.rounds && done[1] >= so.rounds) return a === b ? null : a > b ? 0 : 1;
    return null;
  }
  if (done[0] === done[1] && a !== b) return a > b ? 0 : 1;
  return null;
}

/**
 * Drives the shootout. `stepAttempt` runs the normal play step for the attempt;
 * this function handles setup/result sequencing around it.
 */
export function stepShootout(st: MatchState, dt: number, rng: Rng, events: MatchEvent[], stepAttempt: () => void, finish: (winner: TeamId) => void): void {
  const so = st.shootout;
  if (!so) return;
  so.t += dt;
  switch (so.stage) {
    case 'setup':
      if (so.t >= 1.2) setupAttempt(st, so, events, rng);
      break;
    case 'attempt': {
      stepAttempt();
      const res = attemptOver(st, so);
      if (res) {
        const scored = res === 'goal';
        // undo the celebration phase the goal check set; we manage our own
        if (st.phase === 'goal') {
          st.phase = 'shootout';
        }
        so.goals[so.turn] += scored ? 1 : 0;
        so.attempts.push({ team: so.turn, scored, shooter: so.shooterId ?? '' });
        so.lastScored = scored;
        events.push({ type: 'shootoutResult', team: so.turn, shooter: so.shooterId ?? '', scored });
        so.stage = 'result';
        so.t = 0;
      }
      break;
    }
    case 'result':
      if (so.t >= 1.8) {
        const w = decided(so);
        if (w !== null) {
          so.stage = 'done';
          st.teams[w].score += 1;
          events.push({ type: 'shootoutEnd', winner: w, goals: [...so.goals] as [number, number] });
          finish(w);
          return;
        }
        // next turn
        so.turn = so.turn === 0 ? 1 : 0;
        const done = [0, 1].map((t) => so.attempts.filter((x) => x.team === t).length);
        if (done[0] >= so.rounds && done[1] >= so.rounds) so.suddenDeath = true;
        if (so.turn === 0) so.round++;
        so.stage = 'setup';
        so.t = 0.6;
      }
      break;
    case 'done':
      break;
  }
}

export const shootoutRulesTime = RULES.otLength;
