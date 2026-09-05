import { FIGHT, ONFIRE } from './constants';
import type { FightCue, Input, MatchEvent, MatchState, Skater } from './types';
import type { Rng } from '../core/rng';

/** Start the "drop the gloves" offer. Play freezes; both sides accept or decline. */
export function offerFight(st: MatchState, a: string, b: string, events: MatchEvent[]): void {
  st.fight = { a, b, stage: 'offer', t: 0, hp: [100, 100], accepted: [null, null], cue: null, nextCue: 0.6, winner: null, lastHit: null };
  st.phase = 'fight';
  const sa = st.skaters[a],
    sb = st.skaters[b];
  for (const s of [sa, sb]) {
    s.knockdown = 0;
    s.lunge = 0;
    s.vel.x = s.vel.y = 0;
    if (s.hasPuck) {
      s.hasPuck = false;
      st.puck.owner = null;
    }
  }
  // face each other
  const ang = Math.atan2(sb.pos.y - sa.pos.y, sb.pos.x - sa.pos.x);
  sa.facing = ang;
  sb.facing = ang + Math.PI;
  events.push({ type: 'fightOffer', a, b });
}

function fighter(st: MatchState, i: 0 | 1): Skater {
  return st.skaters[i === 0 ? st.fight!.a : st.fight!.b];
}

/** AI accept probability from hit stat, temper trait and difficulty. */
function aiAccepts(st: MatchState, sk: Skater, rng: Rng): boolean {
  const team = st.teams[sk.team];
  const p = (0.08 + sk.stats.hit / 30 + sk.temper * 0.35 + team.difficulty * 0.04) * st.mods.teams[sk.team].temperMul;
  return rng.next() < Math.min(0.9, p);
}

const cueButton = (kind: FightCue, inp: Input): 'high' | 'low' | 'block' | 'mash' | null => {
  if (inp.shoot && kind === 'mash') return 'mash';
  if (inp.check) return 'high';
  if (inp.deke) return 'low';
  if (inp.pass) return 'block';
  return null;
};

export function stepFight(st: MatchState, dt: number, inputs: Partial<Record<0 | 1, Input>>, rng: Rng, events: MatchEvent[]): void {
  const f = st.fight;
  if (!f) return;
  f.t += dt;
  const A = fighter(st, 0),
    B = fighter(st, 1);
  const humanFor = (i: 0 | 1): Input | null => {
    const sk = i === 0 ? A : B;
    const team = st.teams[sk.team];
    return team.isHuman ? (inputs[team.id] ?? null) : null;
  };

  if (f.stage === 'offer') {
    for (const i of [0, 1] as const) {
      if (f.accepted[i] !== null) continue;
      const inp = humanFor(i);
      if (inp) {
        if (inp.check || inp.shoot) f.accepted[i] = true;
        else if (inp.pass) f.accepted[i] = false;
      } else if (f.t > 0.4 + rng.next() * 0.5) {
        f.accepted[i] = aiAccepts(st, i === 0 ? A : B, rng);
      }
    }
    const decided = f.accepted[0] !== null && f.accepted[1] !== null;
    if (f.t >= FIGHT.offerTime || (decided && (f.accepted[0] === false || f.accepted[1] === false))) {
      // timed out or declined → back to play
      if (!(f.accepted[0] && f.accepted[1])) {
        st.fight = null;
        st.phase = 'play';
        events.push({ type: 'fightEnd', winner: null, loser: null, a: f.a, b: f.b });
        return;
      }
    }
    if (f.accepted[0] && f.accepted[1]) {
      f.stage = 'duel';
      f.t = 0;
      f.nextCue = 0.7;
      st.fightsThisPeriod++;
      events.push({ type: 'fightStart', a: f.a, b: f.b });
      // bystanders back off to a ring around the scrap
      const mx = (A.pos.x + B.pos.x) / 2,
        my = (A.pos.y + B.pos.y) / 2;
      let k = 0;
      for (const id of st.order) {
        if (id === f.a || id === f.b) continue;
        const s = st.skaters[id];
        if (s.isGoalie) continue;
        const ang = (k++ / 6) * Math.PI * 2 + 0.4;
        s.pos.x = mx + Math.cos(ang) * 5.5;
        s.pos.y = my + Math.sin(ang) * 4.5;
        s.vel.x = s.vel.y = 0;
        s.knockdown = 0;
        s.facing = Math.atan2(my - s.pos.y, mx - s.pos.x);
      }
      // square up
      const gap = 1.7;
      const dx = B.pos.x - A.pos.x,
        dy = B.pos.y - A.pos.y;
      const dl = Math.hypot(dx, dy) || 1;
      A.pos.x = mx - (dx / dl) * (gap / 2);
      A.pos.y = my - (dy / dl) * (gap / 2);
      B.pos.x = mx + (dx / dl) * (gap / 2);
      B.pos.y = my + (dy / dl) * (gap / 2);
      // human takes control of their fighter
      for (const i of [0, 1] as const) {
        const sk = i === 0 ? A : B;
        const team = st.teams[sk.team];
        if (team.isHuman && team.controlledId !== sk.id) {
          if (team.controlledId) st.skaters[team.controlledId].controlled = false;
          team.controlledId = sk.id;
          sk.controlled = true;
        }
      }
    }
    return;
  }

  if (f.stage === 'duel') {
    // spawn cues
    if (!f.cue && f.t >= f.nextCue && f.t < FIGHT.duelTime - 0.6) {
      const target: 0 | 1 = rng.next() < 0.5 ? 0 : 1;
      const low = f.hp[target] < 35;
      const roll = rng.next();
      const kind: FightCue = low && rng.next() < 0.45 ? 'mash' : roll < 0.38 ? 'high' : roll < 0.72 ? 'low' : 'feint';
      f.cue = { kind, target, t: 0, window: FIGHT.cueWindow, done: false, mash: 0 };
      events.push({ type: 'fightCue', kind, target: target === 0 ? f.a : f.b });
    }
    if (f.cue) {
      const c = f.cue;
      c.t += dt;
      const tgt = c.target;
      const opp: 0 | 1 = tgt === 0 ? 1 : 0;
      const tgtSk = tgt === 0 ? A : B;
      const inp = humanFor(tgt);
      let pressed: ReturnType<typeof cueButton> = null;
      if (inp) pressed = cueButton(c.kind, inp);
      else if (!c.done && c.t > 0.12 + rng.next() * 0.25) {
        // AI reaction: right answer with probability from hit stat + difficulty
        const team = st.teams[tgtSk.team];
        const p = 0.4 + tgtSk.stats.hit / 30 + team.difficulty * 0.1;
        if (c.kind === 'mash') pressed = 'mash';
        else if (rng.next() < p) pressed = c.kind === 'high' ? 'high' : c.kind === 'low' ? 'low' : 'block';
        else pressed = rng.next() < 0.5 ? null : rng.next() < 0.5 ? 'high' : 'low';
        if (c.kind !== 'mash') c.done = true;
      }
      const m = st.mods.teams[tgtSk.team];
      const dmgMul = m.fightPowerMul * (tgtSk.onFire > 0 ? 1.25 : 1);
      if (pressed && !c.done) {
        if (c.kind === 'mash') {
          c.mash += inp ? 1 : 2.2 * (0.6 + tgtSk.stats.hit / 12);
        } else if (c.t <= c.window) {
          const right = (c.kind === 'high' && pressed === 'high') || (c.kind === 'low' && pressed === 'low') || (c.kind === 'feint' && pressed === 'block');
          if (right) {
            const dmg = (c.kind === 'feint' ? FIGHT.counterDmg : FIGHT.punchDmg) * dmgMul;
            f.hp[opp] = Math.max(0, f.hp[opp] - dmg);
            f.lastHit = { by: tgt, t: f.t };
            events.push({ type: 'fightHit', attacker: tgtSk.id, defender: (opp === 0 ? A : B).id, dmg, counter: c.kind === 'feint' });
          } else {
            const dmg = c.kind === 'feint' ? FIGHT.feintDmg : FIGHT.wrongDmg;
            f.hp[tgt] = Math.max(0, f.hp[tgt] - dmg);
            f.lastHit = { by: opp, t: f.t };
            events.push({ type: 'fightHit', attacker: (opp === 0 ? A : B).id, defender: tgtSk.id, dmg, counter: false });
          }
          c.done = true;
        }
      }
      if (c.kind === 'mash' && c.t >= c.window * 2.2 && !c.done) {
        c.done = true;
        if (c.mash >= FIGHT.mashNeeded) f.hp[tgt] = Math.min(100, f.hp[tgt] + FIGHT.mashHeal);
      }
      if (c.t >= c.window * (c.kind === 'mash' ? 2.4 : 1.6)) {
        if (!c.done && c.kind !== 'mash') {
          // missed window entirely: opponent lands a jab
          f.hp[tgt] = Math.max(0, f.hp[tgt] - FIGHT.wrongDmg * 0.6);
          f.lastHit = { by: opp, t: f.t };
          events.push({ type: 'fightHit', attacker: (opp === 0 ? A : B).id, defender: tgtSk.id, dmg: FIGHT.wrongDmg * 0.6, counter: false });
        }
        f.cue = null;
        f.nextCue = f.t + FIGHT.cueEvery * (0.8 + rng.next() * 0.4);
      }
    }
    const ko = f.hp[0] <= 0 || f.hp[1] <= 0;
    if (ko || f.t >= FIGHT.duelTime) {
      f.stage = 'result';
      f.t = 0;
      if (f.hp[0] === f.hp[1]) f.winner = null;
      else f.winner = f.hp[0] > f.hp[1] ? 0 : 1;
      const w = f.winner === null ? null : f.winner === 0 ? A : B;
      const l = f.winner === null ? null : f.winner === 0 ? B : A;
      if (w) {
        w.onFire = ONFIRE.duration;
        w.streak = 0;
      }
      if (l) {
        l.knockdown = FIGHT.resultTime + 0.5;
        l.ejected = true;
        const team = st.teams[l.team];
        team.ejected.push(l.id);
      }
      events.push({ type: 'fightEnd', winner: w?.id ?? null, loser: l?.id ?? null, a: f.a, b: f.b });
    }
    return;
  }

  if (f.stage === 'result') {
    if (f.t >= FIGHT.resultTime) {
      // eject the loser for the rest of the period, faceoff at center
      const l = f.winner === null ? null : f.winner === 0 ? B : A;
      if (l) {
        const team = st.teams[l.team];
        team.skaters = team.skaters.filter((id) => id !== l.id);
        if (team.controlledId === l.id && team.skaters.length) {
          l.controlled = false;
          team.controlledId = team.skaters[0];
          st.skaters[team.controlledId].controlled = true;
        }
        l.pos.x = l.team === 0 ? -RINK_BENCH_X : RINK_BENCH_X;
        l.pos.y = 15.5;
        l.vel.x = l.vel.y = 0;
      }
      st.fight = null;
      st.phase = 'goal'; // reuse the celebration timer → faceoff at center
      st.phaseTimer = 0.4;
      st.faceoffSpot = { x: 0, y: 0 };
    }
  }
}

const RINK_BENCH_X = 8;

/** Rest-of-period ejections end at the period break: bring skaters back. */
export function restoreEjected(st: MatchState): void {
  for (const t of st.teams) {
    for (const id of t.ejected) {
      const s = st.skaters[id];
      s.ejected = false;
      if (!t.skaters.includes(id)) t.skaters.push(id);
    }
    t.ejected = [];
  }
  for (const id of st.order) st.skaters[id].knockdownsThisPeriod = 0;
  st.fightsThisPeriod = 0;
}
