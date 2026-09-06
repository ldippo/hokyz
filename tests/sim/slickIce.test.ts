import { describe, expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam, stats } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { stepSkater } from '../../src/sim/skater';
import { applyHit } from '../../src/sim/hits';
import { EMPTY_INPUT } from '../../src/sim/types';
import { Rng } from '../../src/core/rng';

function fixture(slick: boolean) {
  const mods = defaultMatchMods(); mods.slipperyIce = slick;
  const team = (short: string) => ({ ...quickTeam(short), name: short, short, color: '#f00', isHuman: false, difficulty: 1 });
  return new MatchSim([team('A'), team('B')], mods, 1).st;
}

describe('slick ice counterplay contract', () => {
  it.each(['A1', 'B1'])('reduces steering grip and increases coasting for %s', id => {
    const normal = fixture(false), slick = fixture(true);
    for (const st of [normal, slick]) {
      const sk = st.skaters[id]; sk.pos = { x: 0, y: 0 }; sk.vel = { x: 4, y: 0 };
      stepSkater(sk, { ...EMPTY_INPUT, move: { x: 0, y: 1 } }, st, 1 / 60, []);
    }
    expect(slick.skaters[id].vel.y).toBeLessThan(normal.skaters[id].vel.y);
    expect(slick.skaters[id].vel.x).toBeGreaterThan(normal.skaters[id].vel.x);
    for (const st of [normal, slick]) {
      st.skaters[id].vel = { x: 4, y: 0 };
      stepSkater(st.skaters[id], EMPTY_INPUT, st, 1 / 60, []);
    }
    expect(slick.skaters[id].vel.x).toBeGreaterThan(normal.skaters[id].vel.x);
  });
  it.each([['A1', 'B1'], ['B1', 'A1']])('makes a marginal check by %s knock down %s', (hitter, victim) => {
    const normal = fixture(false), slick = fixture(true);
    for (const st of [normal, slick]) {
      const h = st.skaters[hitter], v = st.skaters[victim];
      h.stats = stats(6, 6, 6, 6, 6, 6); v.stats = { ...h.stats };
      h.pos = { x: 0, y: 0 }; v.pos = { x: 1, y: 0 }; v.facing = Math.PI;
      h.vel = { x: 7, y: 0 }; v.invuln = 0;
      applyHit(st, h, v, new Rng(1), []);
    }
    expect(normal.skaters[victim].knockdown).toBe(0);
    expect(slick.skaters[victim].knockdown).toBeGreaterThan(0);
  });
});
