import { expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { givePuck } from '../../src/sim/puck';
import { stepFight } from '../../src/sim/fight';
import { FIGHT } from '../../src/sim/constants';

function match() {
  const teams = ['A', 'B'].map(name => ({ ...quickTeam(name), name, short: name, color: '#fff', isHuman: true, difficulty: 1 }));
  const sim = new MatchSim([teams[0], teams[1]], defaultMatchMods(), 17);
  sim.st.phase = 'play'; return sim;
}

it('does not recall the only remaining attacker until benched teammates return', () => {
  const sim = match(), st = sim.st, team = st.teams[0], id = team.goalie!;
  sim.togglePull(0, []);
  team.ejected = team.skaters.filter(s => s !== id);
  for (const s of team.ejected) st.skaters[s].ejected = true;
  team.skaters = [id];
  sim.togglePull(0, []);
  expect(team.skaters).toEqual([id]); expect(team.goalie).toBe(null);
  st.phase = 'periodEnd'; st.phaseTimer = 0; sim.step();
  sim.togglePull(0, []);
  expect(team.skaters).toHaveLength(3); expect(team.goalie).toBe(id);
});

it.each([0, 1] as const)('team %i returns its controlled puck-carrying goalie without dangling possession', teamId => {
  const sim = match(), st = sim.st, team = st.teams[teamId], id = team.goalie!;
  sim.togglePull(teamId, []);
  st.skaters[team.controlledId!].controlled = false;
  team.controlledId = id; st.skaters[id].controlled = true;
  givePuck(st, st.skaters[id], []);
  sim.togglePull(teamId, []);
  expect(st.puck.owner).toBe(null); expect(st.skaters[id].hasPuck).toBe(false);
  expect(team.skaters).not.toContain(id); expect(team.goalie).toBe(id);
  expect(team.skaters).toContain(team.controlledId);
  expect(st.skaters[team.controlledId!].controlled).toBe(true);
  expect(st.skaters[id].controlled).toBe(false);
});

it.each([0, 1] as const)('team %i cannot recall an ejected pulled goalie before the period break', teamId => {
  const sim = match(), st = sim.st, team = st.teams[teamId], id = team.goalie!;
  sim.togglePull(teamId, []);
  // Terminal duel fixture; production fight settlement performs the ejection.
  st.phase = 'fight';
  st.fight = { a: id, b: st.teams[1 - teamId].skaters[0], stage: 'duel', t: 1, hp: [0, 100], accepted: [true, true], cue: null, nextCue: 20, winner: null, lastHit: null };
  stepFight(st, 1 / 60, {}, sim.rng, []);
  stepFight(st, FIGHT.resultTime, {}, sim.rng, []);
  expect(team.ejected).toContain(id); expect(team.skaters).not.toContain(id);
  sim.togglePull(teamId, []); // Manual recall must not bypass sitting out.
  expect(team.goalie).toBe(null); expect(team.pulled).toBe(true);
  for (let i = 0; i < 30; i++) sim.step(); // Automatic stoppage recall, too.
  expect(team.goalie).toBe(null); expect(team.skaters).not.toContain(id);
  expect(st.skaters[id].ejected).toBe(true);
  st.phase = 'periodEnd'; st.phaseTimer = 0; sim.step();
  expect(st.skaters[id].ejected).toBe(false);
  expect(team.skaters.filter(s => s === id)).toHaveLength(1);
  sim.togglePull(teamId, []);
  expect(team.goalie).toBe(id); expect(team.skaters).not.toContain(id);
});
