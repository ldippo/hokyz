import { describe, expect, it } from 'vitest';
import { PossessionMetrics } from '../../scripts/harness/possession';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';

function fixture() {
  const teams = ['A', 'B'].map(name => ({ ...quickTeam(name), name, short: name,
    color: '#f00', isHuman: false, difficulty: 1 }));
  const st = new MatchSim([teams[0], teams[1]], defaultMatchMods(), 101).st;
  st.phase = 'play';
  const metrics = new PossessionMetrics();
  st.puck.owner = null;
  metrics.sample(st, [{ type: 'pass', from: 'A1', to: 'A2' }]);
  return { st, metrics };
}

describe('possession diagnostics', () => {
  it.each([['A2', 'completed'], ['A1', 'recovered'], ['A3', 'recovered'], ['B1', 'intercepted']] as const)(
    'classifies first observed owner %s as %s exactly once', (owner, outcome) => {
      const { st, metrics } = fixture();
      st.puck.owner = owner;
      metrics.sample(st, []);
      metrics.sample(st, []);
      metrics.finish();
      expect(metrics.passes[outcome]).toBe(1);
      expect(Object.values(metrics.passes).slice(1).reduce((a, b) => a + b, 0)).toBe(1);
      expect(metrics.playSeconds).toBeCloseTo(metrics.looseSeconds + metrics.possessionSeconds.reduce((a, b) => a + b, 0));
    });

  it('does not credit the next faceoff winner with completing a stopped pass', () => {
    const { st, metrics } = fixture();
    st.phase = 'faceoff';
    metrics.sample(st, []);
    st.phase = 'play'; st.puck.owner = 'A2';
    metrics.sample(st, []);
    expect(metrics.passes.unresolved).toBe(1);
    expect(metrics.passes.completed).toBe(0);
  });

  it('recognizes a receiver immediately passing again between samples', () => {
    const { st, metrics } = fixture();
    metrics.sample(st, [{ type: 'pass', from: 'A2', to: 'A3' }]);
    metrics.finish(); metrics.finish();
    expect(metrics.passes).toEqual({ attempts: 2, completed: 1, recovered: 0, intercepted: 0, unresolved: 1 });
  });

  it('leaves simulation state unchanged', () => {
    const { st, metrics } = fixture();
    const before = JSON.stringify(st);
    metrics.sample(st, []);
    expect(JSON.stringify(st)).toBe(before);
  });
});
