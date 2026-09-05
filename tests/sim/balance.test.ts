import { describe, expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';

function playMatch(seed: number, difficulty: number) {
  const a = quickTeam('A'),
    b = quickTeam('B');
  const s = new MatchSim(
    [
      { name: 'A', short: 'A', color: '#f00', skaters: a.skaters, goalie: a.goalie, isHuman: false, difficulty },
      { name: 'B', short: 'B', color: '#00f', skaters: b.skaters, goalie: b.goalie, isHuman: false, difficulty },
    ],
    defaultMatchMods(),
    seed,
  );
  let n = 0;
  let goals = 0,
    hits = 0,
    stuck = 0;
  let lastPuck = { x: 0, y: 0 };
  let stillTicks = 0;
  while (s.st.phase !== 'over' && n < 60 * 60 * 12) {
    for (const e of s.step()) {
      if (e.type === 'goal') goals++;
      if (e.type === 'hit') hits++;
    }
    if (s.st.phase === 'play') {
      const p = s.st.puck.pos;
      if (Math.hypot(p.x - lastPuck.x, p.y - lastPuck.y) < 0.01) stillTicks++;
      else stillTicks = 0;
      if (stillTicks > 60 * 8) stuck++;
      lastPuck = { x: p.x, y: p.y };
    }
    for (const id of s.st.order) {
      const sk = s.st.skaters[id];
      if (!Number.isFinite(sk.pos.x + sk.pos.y + sk.vel.x + sk.vel.y)) throw new Error('NaN in skater ' + id);
    }
    n++;
  }
  return { goals, hits, stuck, finished: s.st.phase === 'over', ticks: n };
}

describe('AI vs AI balance (headless)', () => {
  it('matches finish, produce goals in a sane range, and never stall', () => {
    const results = [0, 1, 2, 3].flatMap((d) => [101, 202].map((seed) => playMatch(seed + d, d)));
    for (const r of results) {
      expect(r.finished).toBe(true);
      expect(r.stuck).toBe(0);
    }
    const avgGoals = results.reduce((a, r) => a + r.goals, 0) / results.length;
    expect(avgGoals).toBeGreaterThan(3);
    expect(avgGoals).toBeLessThan(16);
  }, 60000);
});
