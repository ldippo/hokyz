import { expect, it, vi } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { offerFight, stepFight } from '../../src/sim/fight';
import { MUTATOR_BY_ID } from '../../src/run/mutators';
import { FIGHT } from '../../src/sim/constants';
import type { FightCue, MatchEvent } from '../../src/sim/types';

function duel(kind: FightCue, target: 0 | 1 = 1, seed = 17) {
  const teams = ['A', 'B'].map(name => ({ ...quickTeam(name), name, short: name, color: '#fff', isHuman: false, difficulty: 2 }));
  const sim = new MatchSim([teams[0], teams[1]], defaultMatchMods(), seed);
  sim.st.phase = 'fight';
  sim.st.fight = { a: 'A1', b: 'B1', stage: 'duel', t: 1, hp: [100, 100], accepted: [true, true], cue: { kind, target, t: 0.4, window: 0.8, done: false, mash: 0 }, nextCue: 20, winner: null, lastHit: null };
  return sim;
}

it.each([0, 1] as const)('Fight Night keeps team %i last skater available', teamId => {
  const sim = duel('high'), st = sim.st, team = st.teams[teamId];
  MUTATOR_BY_ID.fight_night.apply(st.mods);
  st.fight = null; st.phase = 'play';
  for (let loss = 0; loss < 2; loss++) {
    offerFight(st, team.skaters[0], st.teams[1 - teamId].skaters[0], []);
    const f = st.fight!;
    expect(f).not.toBe(null);
    f.accepted = [true, true]; stepFight(st, 1 / 60, {}, sim.rng, []);
    f.hp = [0, 100]; stepFight(st, 1 / 60, {}, sim.rng, []);
    stepFight(st, FIGHT.resultTime, {}, sim.rng, []);
    for (let i = 0; i < 180 && st.phase !== 'play'; i++) sim.step();
  }
  expect(team.skaters).toHaveLength(1);
  const events: MatchEvent[] = [];
  offerFight(st, team.skaters[0], st.teams[1 - teamId].skaters[0], events);
  expect(st.fight).toBe(null); expect(events).toEqual([]); expect(st.phase).toBe('play');
  st.phase = 'periodEnd'; st.phaseTimer = 0; sim.step();
  expect(team.skaters).toHaveLength(3);
  expect(st.phase).toBe('faceoff');
  offerFight(st, team.skaters[0], st.teams[1 - teamId].skaters[0], events);
  expect(st.fight).not.toBe(null);
});

for (const target of [0, 1] as const) it.each(['high', 'low', 'feint'] as const)(`AI fighter ${target} resolves %s exactly once`, kind => {
  const sim = duel(kind, target), f = sim.st.fight!, events: MatchEvent[] = [];
  sim.st.skaters[target === 0 ? f.a : f.b].stats.hit = 10;
  vi.spyOn(sim.rng, 'next').mockReturnValue(0.5); // ready reaction, correct choice
  stepFight(sim.st, 1 / 60, {}, sim.rng, events);
  const damage = kind === 'feint' ? FIGHT.counterDmg : FIGHT.punchDmg;
  expect(f.hp[1 - target]).toBe(100 - damage);
  expect(events.filter(e => e.type === 'fightHit')).toHaveLength(1);
  expect(f.cue?.done).toBe(true);
  for (let i = 0; i < 30; i++) stepFight(sim.st, 1 / 60, {}, sim.rng, events);
  expect(events.filter(e => e.type === 'fightHit')).toHaveLength(1);
});

it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])('seed %i resolves a full AI duel deterministically', seed => {
  const run = () => {
    const sim = duel('high', 0, seed), events: MatchEvent[] = [];
    const f = sim.st.fight!;
    f.cue = null; f.t = 0; f.nextCue = 0.7;
    for (let i = 0; i < 900 && sim.st.phase === 'fight'; i++) events.push(...sim.step());
    expect(events.filter(e => e.type === 'fightHit').length).toBeGreaterThan(0);
    expect(events.filter(e => e.type === 'fightEnd')).toHaveLength(1);
    expect(sim.st.fight).toBe(null);
    return { events, hp: f.hp, winner: f.winner, ejected: sim.st.teams.map(t => t.ejected) };
  };
  expect(run()).toEqual(run());
});

it('an incorrect AI response takes damage once', () => {
  const sim = duel('high'), f = sim.st.fight!, events: MatchEvent[] = [];
  vi.spyOn(sim.rng, 'next').mockReturnValue(0.99); // chooses low against high
  stepFight(sim.st, 1 / 60, {}, sim.rng, events);
  expect(f.hp[1]).toBe(100 - FIGHT.wrongDmg);
  expect(f.hp[0]).toBe(100);
  expect(f.cue?.done).toBe(true);
});

it('an AI no-response choice waits for one missed-window jab instead of rerolling', () => {
  const sim = duel('high'), f = sim.st.fight!, events: MatchEvent[] = [];
  const random = vi.spyOn(sim.rng, 'next').mockReturnValueOnce(0.5).mockReturnValueOnce(0.99).mockReturnValueOnce(0.2).mockReturnValue(0.5);
  stepFight(sim.st, 1 / 60, {}, sim.rng, events);
  expect(f.hp).toEqual([100, 100]);
  for (let i = 0; i < 15; i++) stepFight(sim.st, 1 / 60, {}, sim.rng, events);
  expect(random).toHaveBeenCalledTimes(3);
  for (let i = 0; i < 40; i++) stepFight(sim.st, 1 / 60, {}, sim.rng, events);
  expect(f.hp[1]).toBe(100 - FIGHT.wrongDmg * 0.6);
  expect(events.filter(e => e.type === 'fightHit')).toHaveLength(1);
});
