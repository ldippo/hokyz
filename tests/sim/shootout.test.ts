import { describe, expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { generateRunMap } from '../../src/run/mapGen';
import { Rng } from '../../src/core/rng';

function sim(mods = defaultMatchMods(), seed = 21) {
  const a = quickTeam('A'),
    b = quickTeam('B');
  return new MatchSim(
    [
      { name: 'A', short: 'A', color: '#f00', skaters: a.skaters, goalie: a.goalie, isHuman: false, difficulty: 2 },
      { name: 'B', short: 'B', color: '#00f', skaters: b.skaters, goalie: b.goalie, isHuman: false, difficulty: 2 },
    ],
    mods,
    seed,
  );
}

describe('shootout', () => {
  it('shootout-only match runs attempts alternately and ends with a winner', () => {
    const mods = defaultMatchMods();
    mods.shootoutOnly = true;
    mods.shootoutRounds = 3;
    const s = sim(mods, 7);
    const attempts: number[] = [];
    let results = 0;
    let end: { winner: number; goals: [number, number] } | null = null;
    for (let i = 0; i < 60 * 240 && s.st.phase !== 'over'; i++) {
      for (const e of s.step()) {
        if (e.type === 'shootoutAttempt') attempts.push(e.team);
        if (e.type === 'shootoutResult') results++;
        if (e.type === 'shootoutEnd') end = { winner: e.winner, goals: e.goals };
      }
    }
    expect(s.st.phase).toBe('over');
    expect(end).not.toBeNull();
    expect(attempts.length).toBeGreaterThanOrEqual(3);
    expect(results).toBe(attempts.length);
    // alternation: no team shoots twice in a row
    for (let i = 1; i < attempts.length; i++) expect(attempts[i]).not.toBe(attempts[i - 1]);
    // winner got the extra goal on the scoreboard, loser didn't
    const w = end!.winner;
    expect(s.st.teams[w].score).toBe(1);
    expect(s.st.teams[w === 0 ? 1 : 0].score).toBe(0);
    expect(s.st.winner).toBe(w);
  });
  it('a tied overtime goes to a shootout instead of another OT', () => {
    const mods = defaultMatchMods();
    mods.periodLength = 4;
    // make scoring impossible: park the puck at centre ice every frame
    const s = sim(mods, 3);
    let sawShootout = false;
    for (let i = 0; i < 60 * 200 && !sawShootout; i++) {
      for (const e of s.step()) if (e.type === 'shootoutStart') sawShootout = true;
      const p = s.st.puck;
      if (s.st.phase === 'play') {
        if (p.owner) s.st.skaters[p.owner].hasPuck = false;
        p.owner = null;
        p.pos = { x: 0, y: 0 };
        p.vel = { x: 0, y: 0 };
        p.isShot = false;
      }
    }
    expect(sawShootout).toBe(true);
    expect(s.st.overtime).toBe(true);
  });
});

describe('skills nodes on the map', () => {
  it('shootout and hit parade nodes appear across seeds, never in the first row, shootouts carry a rival', () => {
    let so = 0,
      hp = 0;
    for (let seed = 1; seed < 60; seed++) {
      for (const act of generateRunMap(new Rng(seed))) {
        for (const n of act.rows[0]) expect(['match']).toContain(n.type);
        for (const row of act.rows)
          for (const n of row) {
            if (n.type === 'shootout') {
              so++;
              expect(n.rivalId).toBeTruthy();
            }
            if (n.type === 'hitparade') hp++;
          }
      }
    }
    expect(so).toBeGreaterThan(10);
    expect(hp).toBeGreaterThan(10);
  });
});
