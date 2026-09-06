import { expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickSkater, quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { setupFaceoff } from '../../src/sim/rules';
import { FACEOFF_SPOTS, isInsideRink } from '../../src/sim/rink';
import { SKATER } from '../../src/sim/constants';
import { makeSkater } from '../../src/sim/skater';

it.each([3, 4, 5])('%i-skater faceoffs keep both teams separated at every dot', (count) => {
  const teams = ['A', 'B'].map(prefix => {
    const t = quickTeam(prefix);
    while (t.skaters.length < count) t.skaters.push(quickSkater(`${prefix}${t.skaters.length + 1}`, 'Extra'));
    return { ...t, name: prefix, short: prefix, color: '#fff', isHuman: false, difficulty: 2 };
  });
  const sim = new MatchSim([teams[0], teams[1]], defaultMatchMods(), 8);
  // Match construction dresses three; reinforcement/pull paths add bodies later.
  for (const t of sim.st.teams) for (const def of teams[t.id].skaters.slice(3)) {
    sim.st.skaters[def.id] = makeSkater(def.id, def.name, t.id, def.stats, def.archetype, false, def.hp);
    sim.st.order.push(def.id);
    t.skaters.push(def.id);
  }
  expect(sim.st.teams.map(t => t.skaters.length)).toEqual([count, count]);
  for (const spot of FACEOFF_SPOTS) {
    sim.st.faceoffSpot = { ...spot };
    setupFaceoff(sim.st, []);
    const players = sim.st.teams.flatMap(t => t.skaters.map(id => sim.st.skaters[id]));
    for (const [i, player] of players.entries()) {
      expect(isInsideRink(player.pos, SKATER.radius)).toBe(true);
      for (const other of players.slice(i + 1)) {
        expect(Math.hypot(player.pos.x - other.pos.x, player.pos.y - other.pos.y)).toBeGreaterThan(2 * SKATER.radius);
      }
    }
    for (const t of sim.st.teams) {
      const dir = t.id === 0 ? 1 : -1;
      // Preserve the original center and two wing positions exactly.
      expect(sim.st.skaters[t.skaters[0]].pos).toEqual({ x: spot.x - dir * 0.9, y: spot.y });
      for (let i = 1; i <= 2; i++) expect(sim.st.skaters[t.skaters[i]].pos).toEqual({
        x: spot.x - dir * (spot.x === 0 ? 3.5 : 2.5), y: spot.y + (i === 1 ? -4.5 : 4.5),
      });
    }
  }
});
