import { describe, expect, it, vi } from 'vitest';
import { HitParadeDummies } from '../../src/sim/hitParade';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { EMPTY_INPUT } from '../../src/sim/types';

const dummies = [{ id: 'a', pos: { x: 0, y: 0 } }, { id: 'b', pos: { x: 4, y: 3 } }];
describe('seeded Hit Parade steering', () => {
  it('repeats full simulated movement and hit scoring even with a pause', () => {
    const play = (pause: boolean) => {
      const mods = defaultMatchMods();
      mods.noGoalies = true; mods.noFights = true; mods.periodLength = 9999;
      const sim = new MatchSim([0, 1].map(team => ({
        name: String(team), short: String(team), color: '#888',
        skaters: quickTeam(team ? 'B' : 'A', false).skaters, goalie: null,
        isHuman: team === 0, difficulty: 0, scripted: true,
      })) as ConstructorParameters<typeof MatchSim>[0], mods, 42);
      sim.freezeClock = true; sim.st.phase = 'play';
      const controller = new HitParadeDummies(42 ^ 0x485054);
      const trace = []; let score = 0;
      for (let tick = 0; tick < 3600; tick++) {
        const dummies = sim.st.teams[1].skaters.map(id => sim.st.skaters[id]);
        for (const [id, input] of controller.update(sim.st.t, dummies)) sim.scriptInputs.set(id, input);
        if (pause && tick === 1200) for (let i = 0; i < 300; i++) controller.update(sim.st.t, dummies);
        const me = sim.st.skaters[sim.st.teams[0].controlledId!];
        const target = dummies[tick % dummies.length];
        const events = sim.step({ 0: { ...EMPTY_INPUT, move: { x: target.pos.x - me.pos.x, y: target.pos.y - me.pos.y }, turbo: true, check: tick % 30 === 0 } });
        for (const event of events) if (event.type === 'hit' && event.hitter === me.id) score += event.big ? 2 : sim.st.skaters[event.victim].knockdown > 0 ? 1 : 0;
        if (tick % 60 === 0) trace.push(dummies.map(dummy => ({ ...dummy.pos })));
      }
      return { trace, score };
    };
    const normal = play(false);
    expect(play(true)).toEqual(normal);
    expect(normal.score).toBeGreaterThan(0);
    expect(normal.trace[0]).not.toEqual(normal.trace[59]);
  });
  it('repeats inputs across a full challenge independently of global randomness', () => {
    const a = new HitParadeDummies(42), b = new HitParadeDummies(42);
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Global randomness used'); });
    try {
      for (let tick = 0; tick <= 3600; tick++) expect([...a.update(tick / 60, dummies)]).toEqual([...b.update(tick / 60, dummies)]);
    } finally { random.mockRestore(); }
  });
  it('paused/repeated updates do not advance steering randomness', () => {
    const a = new HitParadeDummies(42), b = new HitParadeDummies(42);
    a.update(1, dummies); b.update(1, dummies);
    for (let tick = 0; tick < 300; tick++) a.update(1, dummies);
    for (let tick = 61; tick < 180; tick++) expect([...a.update(tick / 60, dummies)]).toEqual([...b.update(tick / 60, dummies)]);
  });
  it('varies by seed and steers escaped dummies toward the playable area', () => {
    expect([...new HitParadeDummies(1).update(0, dummies)]).not.toEqual([...new HitParadeDummies(2).update(0, dummies)]);
    const input = new HitParadeDummies(3).update(0, [{ id: 'a', pos: { x: 20, y: -10 } }]).get('a')!;
    expect(input.move.x).toBeLessThan(0); expect(input.move.y).toBeGreaterThan(0);
    expect(input.shoot).toBe(false); expect(input.check).toBe(false);
  });
});
