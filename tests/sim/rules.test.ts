import { describe, expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { GOALS } from '../../src/sim/rink';
import { checkGoal } from '../../src/sim/rules';

function sim(mods = defaultMatchMods(), seed = 7) {
  const a = quickTeam('A'),
    b = quickTeam('B');
  return new MatchSim(
    [
      { name: 'A', short: 'A', color: '#f00', skaters: a.skaters, goalie: a.goalie, isHuman: false, difficulty: 1 },
      { name: 'B', short: 'B', color: '#00f', skaters: b.skaters, goalie: b.goalie, isHuman: false, difficulty: 1 },
    ],
    mods,
    seed,
  );
}

describe('goal detection', () => {
  it('scores for team 0 when puck crosses +x goal line inside the mouth', () => {
    const s = sim();
    const st = s.st;
    st.phase = 'play';
    const g = GOALS[1];
    st.puck.pos = { x: g.lineX + 0.05, y: 0 };
    st.puck.lastTouch = 'A1';
    st.puck.lastTouchTeam = 0;
    const ev: any[] = [];
    checkGoal(st, g.lineX - 0.2, ev);
    expect(st.teams[0].score).toBe(1);
    expect(ev.find((e) => e.type === 'goal')?.scorer).toBe('A1');
    expect(st.phase).toBe('goal');
  });
  it('does not score when wide of the mouth or above crossbar', () => {
    const s = sim();
    const st = s.st;
    const g = GOALS[1];
    st.puck.pos = { x: g.lineX + 0.05, y: g.mouth.y2 + 0.3 };
    checkGoal(st, g.lineX - 0.2, []);
    expect(st.teams[0].score).toBe(0);
    st.puck.pos = { x: g.lineX + 0.05, y: 0 };
    st.puck.z = 2;
    checkGoal(st, g.lineX - 0.2, []);
    expect(st.teams[0].score).toBe(0);
  });
  it('applies goalValue and longShotBonus', () => {
    const mods = defaultMatchMods();
    mods.teams[0].goalValue = 2;
    mods.teams[0].longShotBonus = 1;
    const s = sim(mods);
    const st = s.st;
    const g = GOALS[1];
    st.skaters['A1'].pos = { x: -5, y: 0 }; // beyond blue line from +x goal
    st.puck.pos = { x: g.lineX + 0.05, y: 0 };
    st.puck.lastTouch = 'A1';
    st.puck.lastTouchTeam = 0;
    checkGoal(st, g.lineX - 0.2, []);
    expect(st.teams[0].score).toBe(3);
  });
});

describe('match flow', () => {
  it('starts with intro, then faceoff, then play', () => {
    const s = sim();
    expect(s.st.phase).toBe('intro');
    for (let i = 0; i < 60 * 1.5; i++) s.step();
    expect(s.st.phase).toBe('faceoff');
    for (let i = 0; i < 60 * 2; i++) s.step();
    expect(s.st.phase).toBe('play');
    expect(s.st.puck.lastTouch).not.toBeNull();
  });
  it('plays all periods and ends with a winner or overtime', () => {
    const mods = defaultMatchMods();
    mods.periodLength = 20;
    const s = sim(mods, 3);
    let n = 0;
    let periods = 0;
    while (s.st.phase !== 'over' && n < 60 * 60 * 5) {
      for (const e of s.step()) if (e.type === 'period') periods++;
      n++;
    }
    expect(s.st.phase).toBe('over');
    expect(periods).toBeGreaterThanOrEqual(3);
    if (!s.st.overtime) expect(s.st.teams[0].score).not.toBe(s.st.teams[1].score);
  });
  it('sudden death ends on first goal', () => {
    const mods = defaultMatchMods();
    mods.suddenDeath = true;
    const s = sim(mods, 11);
    let goals = 0;
    let n = 0;
    while (s.st.phase !== 'over' && n < 60 * 60 * 10) {
      for (const e of s.step()) if (e.type === 'goal') goals++;
      n++;
    }
    expect(goals).toBe(1);
    expect(s.st.phase).toBe('over');
  });
  it('no goalies mod creates no goalie skaters', () => {
    const mods = defaultMatchMods();
    mods.noGoalies = true;
    const s = sim(mods);
    expect(s.st.teams[0].goalie).toBeNull();
    expect(s.st.order.length).toBe(6);
  });
});
