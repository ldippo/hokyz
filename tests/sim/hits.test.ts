import { describe, expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam, stats } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { applyHit, resolveHits, tryStartCheck } from '../../src/sim/hits';
import { Rng } from '../../src/core/rng';
import { EMPTY_INPUT } from '../../src/sim/types';
import { givePuck } from '../../src/sim/puck';

function sim() {
  const a = quickTeam('A'),
    b = quickTeam('B');
  a.skaters[1].stats = stats(5, 5, 5, 10, 8, 5); // A2 enforcer
  b.skaters[0].stats = stats(6, 8, 7, 2, 2, 6); // B1 glass
  const s = new MatchSim(
    [
      { name: 'A', short: 'A', color: '#f00', skaters: a.skaters, goalie: a.goalie, isHuman: false, difficulty: 1 },
      { name: 'B', short: 'B', color: '#00f', skaters: b.skaters, goalie: b.goalie, isHuman: false, difficulty: 1 },
    ],
    defaultMatchMods(),
    5,
  );
  s.st.phase = 'play';
  return s;
}

describe('body checks', () => {
  it('lunge starts on check input when not carrying', () => {
    const s = sim();
    const h = s.st.skaters['A2'];
    tryStartCheck(h, { ...EMPTY_INPUT, check: true, move: { x: 1, y: 0 } }, s.st);
    expect(h.lunge).toBeGreaterThan(0);
    expect(h.vel.x).toBeGreaterThan(5);
    expect(h.checkCooldown).toBeGreaterThan(0);
  });
  it('a fast enforcer knocks down a low-balance carrier and pops the puck loose', () => {
    const s = sim();
    const h = s.st.skaters['A2'];
    const v = s.st.skaters['B1'];
    h.pos = { x: 0, y: 0 };
    v.pos = { x: 1.2, y: 0 };
    h.facing = 0;
    h.vel = { x: 13, y: 0 };
    givePuck(s.st, v, []);
    const ev: any[] = [];
    applyHit(s.st, h, v, new Rng(1), ev);
    expect(v.knockdown).toBeGreaterThan(0);
    expect(v.hasPuck).toBe(false);
    expect(s.st.puck.owner).toBeNull();
    expect(ev.some((e) => e.type === 'hit')).toBe(true);
    expect(v.hp).toBeLessThan(100);
  });
  it('resolveHits only hits opponents inside the cone', () => {
    const s = sim();
    const h = s.st.skaters['A2'];
    const v = s.st.skaters['B1'];
    h.pos = { x: 0, y: 0 };
    h.facing = 0;
    h.lunge = 0.2;
    h.vel = { x: 12, y: 0 };
    v.pos = { x: -1.2, y: 0 }; // behind hitter
    const ev: any[] = [];
    resolveHits(s.st, new Rng(2), ev);
    expect(ev.some((e) => e.type === 'hit')).toBe(false);
    v.pos = { x: 1.2, y: 0 };
    resolveHits(s.st, new Rng(2), ev);
    expect(ev.some((e) => e.type === 'hit')).toBe(true);
  });
  it('invulnerable (deking) victims dodge the hit', () => {
    const s = sim();
    const h = s.st.skaters['A2'];
    const v = s.st.skaters['B1'];
    v.invuln = 0.3;
    h.vel = { x: 13, y: 0 };
    const ev: any[] = [];
    applyHit(s.st, h, v, new Rng(1), ev);
    expect(v.knockdown).toBe(0);
    expect(h.stumble).toBeGreaterThan(0);
  });
});
