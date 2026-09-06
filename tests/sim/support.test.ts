import { describe, expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { givePuck } from '../../src/sim/puck';
import { TeamBrains } from '../../src/sim/ai/teamAI';
import { Rng } from '../../src/core/rng';
import type { TeamId } from '../../src/sim/types';

describe('breakout support', () => {
  for (const teamId of [0, 1] as TeamId[]) {
    for (const carrierY of [-4, 0, 4]) {
      it(`offers separate stable lanes for team ${teamId}, carrier y=${carrierY}`, () => {
        const rosters = [quickTeam('A'), quickTeam('B')];
        const sim = new MatchSim(rosters.map((roster, i) => ({
          name: `${i}`, short: `${i}`, color: '#f00', skaters: roster.skaters,
          goalie: roster.goalie, isHuman: i === teamId, difficulty: 1,
        })) as ConstructorParameters<typeof MatchSim>[0], defaultMatchMods(), 7);
        sim.st.phase = 'play';
        const dir = teamId === 0 ? 1 : -1;
        const [carrier, high, low] = sim.st.teams[teamId].skaters.map(id => sim.st.skaters[id]);
        carrier.pos = { x: -15 * dir, y: carrierY };
        high.pos = { x: -10 * dir, y: carrierY + 2 };
        low.pos = { x: -12 * dir, y: carrierY - 2 };
        givePuck(sim.st, carrier, []);
        const brains = new TeamBrains();
        brains.assignRoles(sim.st, teamId);
        expect(brains.brain(high.id).role).toBe('supportHigh');
        expect(brains.brain(low.id).role).toBe('supportLow');
        const rng = new Rng(17);
        const decide = () => {
          for (const sk of [high, low]) {
            brains.brain(sk.id).timer = 0;
            brains.think(sim.st, sk, sim.st.dt, rng);
          }
          return [high, low].map(sk => ({ ...brains.brain(sk.id).target }));
        };
        const targets = decide();
        expect(targets[0].y * targets[1].y).toBeLessThan(0);
        expect(Math.abs(targets[0].y - targets[1].y)).toBeGreaterThan(12);
        expect((targets[0].x - carrier.pos.x) * dir).toBeGreaterThan(5);
        expect((targets[1].x - carrier.pos.x) * dir).toBeGreaterThan(0);
        high.pos.y = carrierY - 2;
        low.pos.y = carrierY + 2;
        expect(decide()).toEqual(targets);
      });
    }
  }
});
