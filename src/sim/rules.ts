import { GOALIE, RINK, RULES } from './constants';
import { resetGoalieMem } from './goalie';
import { CROSSBAR_HEIGHT, GOALS, defendGoal, nearestFaceoffSpot } from './rink';
import { givePuck } from './puck';
import type { MatchEvent, MatchState, Skater, TeamId, Vec2 } from './types';
import type { Rng } from '../core/rng';

/** Detect puck crossing goal line. Uses previous x. */
export function checkGoal(st: MatchState, prevX: number, events: MatchEvent[]): void {
  const p = st.puck;
  if (p.z > CROSSBAR_HEIGHT) return;
  for (const g of GOALS) {
    const crossed = g.dir > 0 ? prevX <= g.lineX && p.pos.x > g.lineX : prevX >= g.lineX && p.pos.x < g.lineX;
    if (!crossed) continue;
    if (p.pos.y < g.mouth.y1 || p.pos.y > g.mouth.y2) continue;
    const scoringTeam: TeamId = g.team === 0 ? 1 : 0;
    const scorerId = p.lastTouch && st.skaters[p.lastTouch]?.team === scoringTeam ? p.lastTouch : null;
    // own goal: credit nearest attacker
    let scorer = scorerId;
    if (!scorer) {
      let bd = Infinity;
      for (const id of st.teams[scoringTeam].skaters) {
        const d = Math.hypot(st.skaters[id].pos.x - p.pos.x, st.skaters[id].pos.y - p.pos.y);
        if (d < bd) {
          bd = d;
          scorer = id;
        }
      }
    }
    const shootoutAttempt = st.phase === 'shootout';
    const assist = !shootoutAttempt && p.prevTouch && p.prevTouch !== scorer && st.skaters[p.prevTouch]?.team === scoringTeam ? p.prevTouch : null;
    const m = st.mods.teams[scoringTeam];
    let value = shootoutAttempt ? 1 : m.goalValue;
    // long shot bonus: shot released from beyond the attacking blue line
    if (!shootoutAttempt && m.longShotBonus > 0 && scorer) {
      const s = st.skaters[scorer];
      const dist = Math.abs(s.pos.x - g.lineX);
      if (dist > RINK.goalLineX - RINK.blueLineX) value += m.longShotBonus;
    }
    // Attempts live in shootout.goals; only its winner earns a deciding team
    // point. They must not inflate regulation stats or inherit scoring perks.
    if (!shootoutAttempt) {
      st.teams[scoringTeam].score += value;
      if (scorer) st.skaters[scorer].goals++;
      if (assist) st.skaters[assist].assists++;
    }
    events.push({ type: 'goal', team: scoringTeam, scorer: scorer ?? '', assist, pos: { ...p.pos }, value, ownGoal: scorerId === null, high: p.z > 0.6 });
    st.shake = Math.max(st.shake, 0.6);
    st.phase = 'goal';
    st.phaseTimer = RULES.goalCelebration;
    st.faceoffSpot = { x: 0, y: 0 };
    st.faceoffTeamAdvantage = null;
    // puck settles in net
    p.vel.x *= 0.1;
    p.vel.y *= 0.1;
    if (p.owner) {
      st.skaters[p.owner].hasPuck = false;
      p.owner = null;
    }
    return;
  }
}

/** Place everyone for a faceoff at st.faceoffSpot. */
export function setupFaceoff(st: MatchState, events: MatchEvent[]): void {
  const spot = st.faceoffSpot;
  const p = st.puck;
  if (p.owner) {
    st.skaters[p.owner].hasPuck = false;
    p.owner = null;
  }
  p.pos = { ...spot };
  p.vel = { x: 0, y: 0 };
  p.z = 0;
  p.vz = 0;
  p.passTarget = null;
  p.isShot = false;
  p.lastTouch = null;
  p.prevTouch = null;
  p.lastTouchTeam = null;
  for (const t of st.teams) {
    const dir = t.id === 0 ? 1 : -1; // attack dir
    const skaters = t.skaters.map((id) => st.skaters[id]);
    // sort: best hands takes draw
    const center = skaters.reduce((a, b) => (b.stats.hands > a.stats.hands ? b : a), skaters[0]);
    const wingers = skaters.filter((s) => s !== center);
    placeSkater(center, spot.x - dir * 0.9, spot.y, dir);
    const wingerXOff = spot.x === 0 ? 3.5 : 2.5;
    wingers.forEach((w, i) => {
      const side = i === 0 ? -1 : 1;
      // keep inside rink
      let y = spot.y + side * 4.5;
      const maxY = RINK.width / 2 - 1.5;
      if (y > maxY) y = maxY;
      if (y < -maxY) y = -maxY;
      placeSkater(w, spot.x - dir * wingerXOff, y, dir);
    });
    if (t.goalie) {
      const g = st.skaters[t.goalie];
      const goal = defendGoal(t.id);
      placeSkater(g, goal.lineX - goal.dir * GOALIE.depthFromGoalLine, 0, dir);
      resetGoalieMem(g);
    }
    t.switchLock = 0;
    t.diveWindow = 0;
    t.diveReturnId = null;
    // human controls center at faceoff
    if (t.isHuman) {
      if (t.controlledId) st.skaters[t.controlledId].controlled = false;
      t.controlledId = center.id;
      center.controlled = true;
    }
  }
  st.phase = 'faceoff';
  st.phaseTimer = RULES.faceoffCountdown;
  events.push({ type: 'faceoff', pos: { ...spot } });
}

function placeSkater(s: Skater, x: number, y: number, dir: number): void {
  s.pos.x = x;
  s.pos.y = y;
  s.vel.x = 0;
  s.vel.y = 0;
  s.facing = dir > 0 ? 0 : Math.PI;
  s.knockdown = 0;
  s.stumble = 0;
  s.lunge = 0;
  s.deke = 0;
  s.hasPuck = false;
  s.charging = false;
  s.shotCharge = 0;
  s.pickupCooldown = 0;
  s.turboActive = false;
  s.butterfly = 0;
}

/** Drop the puck: decide winner by hands + mash bonus + rng. */
export function dropPuck(st: MatchState, mash: [number, number], rng: Rng, events: MatchEvent[]): void {
  const centers = st.teams.map((t) => {
    const sk = t.skaters.map((id) => st.skaters[id]);
    return sk.reduce((a, b) => (Math.hypot(b.pos.x - st.faceoffSpot.x, b.pos.y - st.faceoffSpot.y) < Math.hypot(a.pos.x - st.faceoffSpot.x, a.pos.y - st.faceoffSpot.y) ? b : a), sk[0]);
  });
  const w0 = centers[0].stats.hands + mash[0] * 1.5 + rng.next() * 6 + (st.faceoffTeamAdvantage === 0 ? 2 : 0);
  const w1 = centers[1].stats.hands + mash[1] * 1.5 + rng.next() * 6 + (st.faceoffTeamAdvantage === 1 ? 2 : 0);
  const winner: TeamId = w0 >= w1 ? 0 : 1;
  const c = centers[winner];
  givePuck(st, c, events);
  // slight backward pop so it feels like a draw
  c.pickupCooldown = 0;
  st.phase = 'play';
  events.push({ type: 'faceoffWon', team: winner });
}

export function faceoffSpotAfterStoppage(pos: Vec2, defendingTeamOfZone: TeamId | null): Vec2 {
  if (defendingTeamOfZone === null) return nearestFaceoffSpot(pos);
  const goal = defendGoal(defendingTeamOfZone);
  return nearestFaceoffSpot(pos, goal.dir);
}
