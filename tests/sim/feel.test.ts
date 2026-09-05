import { describe, expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { applyHit } from '../../src/sim/hits';
import { givePuck, pickPassTarget } from '../../src/sim/puck';
import { Rng } from '../../src/core/rng';
import { GOALS } from '../../src/sim/rink';
import { TeamBrains } from '../../src/sim/ai/teamAI';

function sim(seed = 8) {
  const a = quickTeam('A'),
    b = quickTeam('B');
  const s = new MatchSim(
    [
      { name: 'A', short: 'A', color: '#f00', skaters: a.skaters, goalie: a.goalie, isHuman: false, difficulty: 2 },
      { name: 'B', short: 'B', color: '#00f', skaters: b.skaters, goalie: b.goalie, isHuman: false, difficulty: 2 },
    ],
    defaultMatchMods(),
    seed,
  );
  s.st.phase = 'play';
  return s;
}

describe('own-goal guards', () => {
  it('a hit near the victim\'s own net never pops the puck toward that net', () => {
    for (let seed = 1; seed < 30; seed++) {
      const s = sim(seed);
      const g = GOALS[0]; // team 0 defends -x
      const vic = s.st.skaters['A1'];
      const h = s.st.skaters['B2'];
      vic.pos = { x: g.lineX + 4, y: 0.5 };
      h.pos = { x: vic.pos.x + 1.2, y: 0.5 };
      h.facing = Math.PI;
      h.vel = { x: -13, y: 0 };
      givePuck(s.st, vic, []);
      applyHit(s.st, h, vic, new Rng(seed), []);
      if (s.st.puck.owner) continue; // dodged
      const v = s.st.puck.vel;
      // heading toward -x goal mouth?
      const towardGoal = v.x < 0 && Math.abs(v.y / Math.max(0.1, Math.abs(v.x))) < 0.35;
      expect(towardGoal).toBe(false);
    }
  });
  it('pass targeting avoids lanes across the own crease', () => {
    const s = sim(2);
    const g = GOALS[0];
    const me = s.st.skaters['A1'];
    const across = s.st.skaters['A2'];
    const safe = s.st.skaters['A3'];
    me.pos = { x: g.lineX + 2, y: 5 };
    across.pos = { x: g.lineX + 2, y: -5 }; // lane crosses the crease
    safe.pos = { x: g.lineX + 8, y: 6 };
    givePuck(s.st, me, []);
    for (const id of s.st.teams[1].skaters) s.st.skaters[id].pos = { x: 20, y: 0 };
    const t = pickPassTarget(s.st, me, null);
    expect(t?.id).toBe('A3');
  });
});

describe('AI goalie pull', () => {
  it('a trailing AI team pulls its goalie late, and puts it back when tied', () => {
    const s = sim(4);
    const st = s.st;
    st.period = 3;
    st.clock = 60;
    st.teams[1].score = 1; // team 0 trails
    let pulled = 0;
    for (let i = 0; i < 10; i++) for (const e of s.step()) if (e.type === 'goaliePulled' && e.team === 0 && e.pulled) pulled++;
    expect(pulled).toBe(1);
    expect(st.teams[0].goalie).toBeNull();
    st.teams[0].score = 1; // tie it up
    let back = 0;
    for (let i = 0; i < 10; i++) for (const e of s.step()) if (e.type === 'goaliePulled' && e.team === 0 && !e.pulled) back++;
    expect(back).toBe(1);
    expect(st.teams[0].goalie).not.toBeNull();
  });
});

describe('breakout support', () => {
  it('wingers fan ahead of a carrier in the defensive zone', () => {
    const s = sim(5);
    const st = s.st;
    const carrier = st.skaters['A1'];
    carrier.pos = { x: -16, y: 0 };
    givePuck(st, carrier, []);
    const brains = new TeamBrains();
    brains.assignRoles(st, 0);
    for (const id of ['A2', 'A3']) {
      const sk = st.skaters[id];
      sk.pos = { x: -14, y: id === 'A2' ? 3 : -3 };
      const b = brains.brain(id);
      b.timer = 0;
      brains.think(st, sk, 1 / 60, new Rng(1));
      expect(b.target.x).toBeGreaterThan(carrier.pos.x + 2);
    }
  });
});
