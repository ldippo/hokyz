import { describe, expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { givePuck, laneBlocked, pickPassTarget } from '../../src/sim/puck';
import { makeBrain, thinkSkater } from '../../src/sim/ai/skaterAI';
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

describe('AI passing decisions', () => {
  for (const pressured of [false, true]) {
    it(`avoids blocked lanes with pressured=${pressured}, while still taking an open outlet`, () => {
      const teams = ['A', 'B'].map(name => ({ ...quickTeam(name), name, short: name,
        color: '#f00', isHuman: false, difficulty: 3 }));
      const st = new MatchSim([teams[0], teams[1]], defaultMatchMods(), 12).st;
      st.phase = 'play';
      const carrier = st.skaters.A1;
      carrier.pos = { x: -15, y: 0 }; carrier.facing = 0;
      st.skaters.A2.pos = { x: -5, y: 5 };
      st.skaters.A3.pos = { x: -5, y: -5 };
      st.skaters.B1.pos = { x: -10, y: 2.5 };
      st.skaters.B2.pos = { x: -10, y: -2.5 };
      st.skaters.B3.pos = pressured ? { x: -16, y: 0 } : { x: 10, y: 0 };
      givePuck(st, carrier, []);
      const decisions = () => Array.from({ length: 100 }, (_, seed) =>
        thinkSkater(st, carrier, makeBrain(), st.dt, new Rng(seed + 1)));
      expect(decisions().filter(input => input.pass)).toHaveLength(0);
      st.skaters.B2.pos = { x: 10, y: -8 };
      const passes = decisions().filter(input => input.pass);
      expect(passes.length).toBeGreaterThan(0);
      for (const input of passes) {
        const receiver = pickPassTarget(st, carrier, input.move);
        expect(receiver?.id).toBe('A3');
        expect(laneBlocked(st, carrier, receiver!)).toBe(false);
      }
    });
  }
});
