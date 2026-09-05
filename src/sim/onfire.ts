import { ONFIRE } from './constants';
import type { MatchEvent, MatchState } from './types';

/** Process streaks: goals and big hits by the same skater. Called with this tick's events. */
export function stepOnFire(st: MatchState, events: MatchEvent[]): void {
  const add: MatchEvent[] = [];
  for (const e of events) {
    if (e.type === 'goal') {
      const s = st.skaters[e.scorer];
      if (s) bump(st, s.id, add);
      // opponents lose fire
      const other = st.teams[e.team === 0 ? 1 : 0];
      for (const id of other.skaters) {
        const o = st.skaters[id];
        o.streak = 0;
        if (o.onFire > 0) {
          o.onFire = 0;
          add.push({ type: 'onFireEnd', skater: o.id });
        }
      }
    } else if (e.type === 'hit' && e.big) {
      bump(st, e.hitter, add);
      const v = st.skaters[e.victim];
      if (v) v.streak = 0;
    } else if (e.type === 'ankleBreaker') {
      bump(st, e.skater, add);
    } else if (e.type === 'bigSave') {
      bump(st, e.goalie, add);
    }
  }
  events.push(...add);
}

function bump(st: MatchState, id: string, add: MatchEvent[]): void {
  const s = st.skaters[id];
  if (!s) return;
  const m = st.mods.teams[s.team];
  s.streak += 1 * m.onFireGainMul;
  if (s.onFire > 0) {
    s.onFire = ONFIRE.duration * m.onFireDurationMul; // refresh
    return;
  }
  if (s.streak >= ONFIRE.streakNeeded) {
    s.onFire = ONFIRE.duration * m.onFireDurationMul;
    s.streak = 0;
    add.push({ type: 'onFire', skater: id });
    if (m.fireSpread) {
      const mates = st.teams[s.team].skaters.filter((x) => x !== id && st.skaters[x].onFire === 0);
      if (mates.length) {
        const mate = st.skaters[mates[Math.floor((st.t * 7919) % mates.length)]];
        mate.onFire = ONFIRE.duration * m.onFireDurationMul * 0.7;
        add.push({ type: 'onFire', skater: mate.id });
      }
    }
  }
}
