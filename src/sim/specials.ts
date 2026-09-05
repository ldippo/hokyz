import { SPECIAL, TEAMFIRE } from './constants';
import { givePuck, releasePuck } from './puck';
import type { Input, MatchEvent, MatchState, Skater, TeamId } from './types';
import { angleOf, dist, fromAngle, len, sub } from './vec';
import type { Rng } from '../core/rng';

/** Meter gain from events; call with this tick's events. */
export function gainSpecial(st: MatchState, dt: number, events: MatchEvent[], out: MatchEvent[]): void {
  for (const t of st.teams) {
    const m = st.mods.teams[t.id];
    const before = t.special;
    if (st.phase === 'play') t.special += SPECIAL.gainPerSec * m.specialGainMul * dt;
    for (const e of events) {
      if (e.type === 'hit' && e.big && st.skaters[e.hitter]?.team === t.id) t.special += SPECIAL.gainBigHit * m.specialGainMul;
      if (e.type === 'goal' && e.team === t.id) t.special += SPECIAL.gainGoal * m.specialGainMul;
      if (e.type === 'save' && st.skaters[e.goalie]?.team === t.id) t.special += SPECIAL.gainSave * m.specialGainMul;
      if (e.type === 'ankleBreaker' && st.skaters[e.skater]?.team === t.id) t.special += SPECIAL.gainAnkle * m.specialGainMul;
    }
    t.special = Math.min(1, t.special);
    if (before < 1 && t.special >= 1) out.push({ type: 'specialReady', team: t.id });
  }
}

/** Try to fire the controlled/AI skater's special. Returns true if it fired. */
export function trySpecial(st: MatchState, sk: Skater, rng: Rng, events: MatchEvent[]): boolean {
  const team = st.teams[sk.team];
  if (team.special < 1 || sk.knockdown > 0 || sk.specialTimer > 0) return false;
  const kind = sk.specialKind;
  const pos = { x: sk.pos.x, y: sk.pos.y };
  switch (kind) {
    case 'laser':
      sk.specialTimer = SPECIAL.laserTime;
      break;
    case 'afterburner':
      sk.specialTimer = SPECIAL.afterburnerTime;
      sk.turbo = 1;
      break;
    case 'shockwave': {
      const opp = st.teams[sk.team === 0 ? 1 : 0];
      let hitAny = false;
      for (const id of [...opp.skaters, ...(opp.goalie ? [opp.goalie] : [])]) {
        const o = st.skaters[id];
        const d = dist(o.pos, sk.pos);
        if (d > SPECIAL.shockwaveRadius) continue;
        const dirV = d > 0.01 ? sub(o.pos, sk.pos) : { x: 1, y: 0 };
        const n = len(dirV) || 1;
        const push = 9 * (1 - d / (SPECIAL.shockwaveRadius + 1));
        o.vel.x += (dirV.x / n) * push;
        o.vel.y += (dirV.y / n) * push;
        if (!o.isGoalie) {
          o.knockdown = Math.max(o.knockdown, 1.4);
          o.knockdownsThisPeriod++;
          if (o.hasPuck) {
            releasePuck(st, o, fromAngle(angleOf(dirV) + (rng.next() - 0.5), 5));
            st.puck.lastTouch = sk.id;
            st.puck.lastTouchTeam = sk.team;
          }
          events.push({ type: 'knockdown', skater: o.id });
        } else o.stumble = 1.0;
        hitAny = true;
      }
      st.shake = Math.max(st.shake, 1);
      sk.specialTimer = 0.6; // animation lock
      void hitAny;
      break;
    }
    case 'blink': {
      if (!sk.hasPuck) return false;
      // best teammate: closest to the attacking goal that is upright
      const attackX = sk.team === 0 ? 22 : -22;
      let best: Skater | null = null;
      let bs = Infinity;
      for (const id of team.skaters) {
        if (id === sk.id) continue;
        const t = st.skaters[id];
        if (t.knockdown > 0) continue;
        const score = Math.abs(t.pos.x - attackX);
        if (score < bs) {
          bs = score;
          best = t;
        }
      }
      if (!best) return false;
      sk.hasPuck = false;
      st.puck.owner = null;
      st.puck.prevTouch = sk.id;
      givePuck(st, best, events);
      best.perfectUntil = st.t + SPECIAL.blinkWindow;
      sk.specialTimer = 0.4;
      events.push({ type: 'pass', from: sk.id, to: best.id });
      break;
    }
    case 'brickwall':
      team.brickWall = sk.goalieStyle === 'handler' ? SPECIAL.brickWallSaves - 1 : SPECIAL.brickWallSaves;
      sk.specialTimer = 0.5;
      break;
    case 'bulldoze':
      sk.specialTimer = SPECIAL.bulldozeTime;
      sk.turbo = 1;
      break;
    case 'phantom':
      sk.specialTimer = SPECIAL.phantomTime;
      break;
  }
  team.special = 0;
  events.push({ type: 'special', skater: sk.id, kind, pos });
  return true;
}

/** AI: decide whether to use a full meter now. */
export function aiWantsSpecial(st: MatchState, sk: Skater, rng: Rng): boolean {
  const team = st.teams[sk.team];
  if (team.special < 1 || sk.specialTimer > 0) return false;
  const p = st.puck;
  const attackX = sk.team === 0 ? 22 : -22;
  switch (sk.specialKind) {
    case 'laser':
      return sk.hasPuck && Math.abs(sk.pos.x - attackX) < 14 && rng.next() < 0.08;
    case 'afterburner':
      return sk.hasPuck && Math.abs(sk.pos.x - attackX) > 12 && rng.next() < 0.05;
    case 'shockwave': {
      let near = 0;
      for (const id of st.teams[sk.team === 0 ? 1 : 0].skaters) if (dist(st.skaters[id].pos, sk.pos) < 3.5) near++;
      const carrierNear = p.owner && st.skaters[p.owner].team !== sk.team && dist(st.skaters[p.owner].pos, sk.pos) < 3.2;
      return (near >= 2 || !!carrierNear) && rng.next() < 0.12;
    }
    case 'blink': {
      if (!sk.hasPuck) return false;
      let pressured = false;
      for (const id of st.teams[sk.team === 0 ? 1 : 0].skaters) if (dist(st.skaters[id].pos, sk.pos) < 2.6) pressured = true;
      return pressured && rng.next() < 0.1;
    }
    case 'brickwall':
      return !p.owner && p.isShot && p.lastTouchTeam !== sk.team && rng.next() < 0.5;
    case 'bulldoze': {
      const carrierNear = p.owner && st.skaters[p.owner].team !== sk.team && dist(st.skaters[p.owner].pos, sk.pos) < 6;
      return (!!carrierNear || sk.hasPuck) && rng.next() < 0.08;
    }
    case 'phantom': {
      if (!sk.hasPuck) return false;
      let pressured = false;
      for (const id of st.teams[sk.team === 0 ? 1 : 0].skaters) if (dist(st.skaters[id].pos, sk.pos) < 3.5) pressured = true;
      return pressured && rng.next() < 0.12;
    }
  }
}

export function stepSpecialInputs(st: MatchState, inputs: Map<string, Input>, rng: Rng, events: MatchEvent[]): void {
  for (const team of st.teams) {
    const ids = [...team.skaters, ...(team.goalie ? [team.goalie] : [])];
    for (const id of ids) {
      const sk = st.skaters[id];
      const human = team.isHuman && team.controlledId === id;
      const inp = inputs.get(id);
      if (human) {
        if (inp?.special) trySpecial(st, sk, rng, events);
      } else if (team.special >= 1 && aiWantsSpecial(st, sk, rng)) {
        trySpecial(st, sk, rng, events);
      }
    }
  }
}

/** Team fire: two skaters on fire at once, or N unanswered goals. */
export function stepTeamFire(st: MatchState, dt: number, events: MatchEvent[], unanswered: [number, number]): void {
  for (const t of st.teams) {
    t.teamFireCooldown = Math.max(0, t.teamFireCooldown - dt);
    if (t.teamFireCooldown > 0) continue;
    let burning = 0;
    for (const id of t.skaters) if (st.skaters[id].onFire > 0) burning++;
    if (burning >= 2 || unanswered[t.id] >= TEAMFIRE.unansweredGoals) {
      for (const id of [...t.skaters, ...(t.goalie ? [t.goalie] : [])]) {
        const s = st.skaters[id];
        s.onFire = Math.max(s.onFire, TEAMFIRE.duration);
      }
      t.teamFireCooldown = TEAMFIRE.cooldown + TEAMFIRE.duration;
      unansweredReset(unanswered, t.id as TeamId);
      events.push({ type: 'teamFire', team: t.id });
    }
  }
}
const unansweredReset = (u: [number, number], team: TeamId) => {
  u[team] = 0;
};
