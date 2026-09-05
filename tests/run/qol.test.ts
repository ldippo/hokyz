import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { buildHomeSquad } from '../../src/run/quick';
import { CAPTAINS } from '../../src/run/meta';
import { newRun } from '../../src/run/runState';
import { seedLink } from '../../src/run/share';
import { DRILLS } from '../../src/training/drills';

describe('quick match squads', () => {
  it('a pick-up squad has three skaters and a goalie', () => {
    const t = buildHomeSquad(new Rng(1), null);
    expect(t.skaters.length).toBe(3);
    expect(t.goalie.archetype).toBe('goalie');
    expect(t.short).toBe('YOU');
  });
  it('a captain leads the squad with two generated linemates', () => {
    const cap = CAPTAINS[0];
    const t = buildHomeSquad(new Rng(2), cap);
    expect(t.skaters[0].name).toBe(cap.name);
    expect(t.skaters[0].archetype).toBe(cap.archetype);
    expect(t.skaters.length).toBe(3);
    expect(new Set(t.skaters.map((s) => s.id)).size).toBe(3);
    expect(t.goalie.goalieStyle).toBeDefined();
    expect(t.name).toContain('Crew');
  });
});

describe('seeded runs', () => {
  it('a chosen goalie style lands on the run goalie; random leaves generation alone', () => {
    const a = newRun('qol-seed', CAPTAINS[0], 0, [], undefined, 'standup');
    expect(a.goalie.goalieStyle).toBe('standup');
    const b = newRun('qol-seed', CAPTAINS[0], 0, []);
    expect(['butterfly', 'standup', 'handler']).toContain(b.goalie.goalieStyle);
    expect(JSON.stringify(b.maps)).toBe(JSON.stringify(a.maps));
  });
  it('seed links encode the seed text', () => {
    const url = seedLink('big cats 7');
    expect(url).toMatch(/\?seed=big%20cats%207$/);
  });
});

describe('training drills', () => {
  it('includes the shot block drill with a lane marker', () => {
    const d = DRILLS.find((x) => x.id === 'block');
    expect(d).toBeDefined();
    expect(d!.text).toMatch(/\[/);
  });
});

describe('shot block drill', () => {
  it('counts three body blocks from the lane and completes', async () => {
    const { MatchSim } = await import('../../src/sim/match');
    const { quickSkater, stats } = await import('../../src/sim/fixtures');
    const { defaultMatchMods } = await import('../../src/sim/modifiers');
    const home = {
      skaters: [quickSkater('T1', 'You', 'sniper', stats(7, 7, 7, 6, 6, 7)), quickSkater('T2', 'Coach', 'playmaker', stats(6, 6, 9, 4, 5, 7)), quickSkater('T3', 'Bench', 'enforcer', stats(5, 5, 4, 8, 8, 6))],
      goalie: quickSkater('TG', 'Wall', 'goalie', stats(5, 3, 7, 4, 8, 6)),
    };
    const dummies = [quickSkater('D1', 'Dan', 'enforcer', stats(5, 5, 5, 6, 4, 6)), quickSkater('D2', 'Deb', 'speedster', stats(5, 5, 5, 4, 4, 6)), quickSkater('D3', 'Doug', 'sniper', stats(5, 5, 5, 4, 4, 6))];
    const mods = defaultMatchMods();
    mods.noFights = true;
    mods.periodLength = 9999;
    const sim = new MatchSim(
      [
        { name: 'Camp', short: 'CAMP', color: '#2f6bff', skaters: home.skaters, goalie: home.goalie, isHuman: true, difficulty: 0, scripted: true },
        { name: 'Dummies', short: 'DUMMY', color: '#8a8f99', skaters: dummies, goalie: null, isHuman: false, difficulty: 0, scripted: true },
      ],
      mods,
      42,
    );
    const st = sim.st;
    st.phase = 'play';
    const me = st.skaters['T1'];
    const ctx = { sim, st, me, mate: st.skaters['T2'], dummies: st.teams[1].skaters.map((id) => st.skaters[id]), goalie: st.skaters['TG'], t: 0, events: [] as import('../../src/sim/types').MatchEvent[], marker: () => {} };
    const drill = DRILLS.find((x) => x.id === 'block')!;
    drill.setup(ctx);
    // the trainee stands in the lane
    me.pos = { x: -12.4, y: 0 };
    let done = false;
    for (let i = 0; i < 60 * 30 && !done; i++) {
      ctx.events = sim.step({});
      ctx.t += 1 / 60;
      me.pos = { x: -12.4, y: 0 };
      me.vel = { x: 0, y: 0 };
      if (me.hasPuck) {
        me.hasPuck = false;
        st.puck.owner = null;
        st.puck.freeTime = 9;
      }
      done = drill.tick(ctx);
    }
    expect(done).toBe(true);
    expect(me.blocks).toBeGreaterThanOrEqual(3);
  });
});
