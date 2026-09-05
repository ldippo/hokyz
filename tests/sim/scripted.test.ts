import { describe, expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { EMPTY_INPUT } from '../../src/sim/types';
import { DRILLS } from '../../src/training/drills';

describe('scripted teams + frozen clock (training)', () => {
  it('scripted skaters follow script inputs and the clock holds', () => {
    const a = quickTeam('A'),
      b = quickTeam('B', false);
    const mods = defaultMatchMods();
    const s = new MatchSim(
      [
        { name: 'A', short: 'A', color: '#f00', skaters: a.skaters, goalie: a.goalie, isHuman: true, difficulty: 0, scripted: true },
        { name: 'B', short: 'B', color: '#00f', skaters: b.skaters, goalie: null, isHuman: false, difficulty: 0, scripted: true },
      ],
      mods,
      1,
    );
    s.freezeClock = true;
    s.st.phase = 'play';
    const d = s.st.skaters['B1'];
    d.pos = { x: 0, y: 0 };
    const clock = s.st.clock;
    s.scriptInputs.set('B1', { ...EMPTY_INPUT, move: { x: 1, y: 0 }, aim: { x: 0, y: 0 } });
    for (let i = 0; i < 60; i++) s.step({ 0: EMPTY_INPUT });
    expect(d.pos.x).toBeGreaterThan(2);
    expect(s.st.clock).toBe(clock);
    // an unscripted dummy stands still
    const d2 = s.st.skaters['B2'];
    const x0 = d2.pos.x;
    for (let i = 0; i < 60; i++) s.step({ 0: EMPTY_INPUT });
    expect(Math.abs(d2.pos.x - x0)).toBeLessThan(0.5);
  });
  it('every drill has setup, tick and glyph text', () => {
    expect(DRILLS.length).toBeGreaterThanOrEqual(9);
    for (const d of DRILLS) {
      expect(typeof d.setup).toBe('function');
      expect(typeof d.tick).toBe('function');
      expect(d.text).toMatch(/\[[^\]]+\]/);
    }
  });
});
