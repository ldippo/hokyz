import { MatchSim } from '../src/sim/match';
import { quickTeam } from '../src/sim/fixtures';
import { defaultMatchMods } from '../src/sim/modifiers';

const N = Number(process.argv[2] ?? 10);
const diffs = [0, 1, 2, 3];
for (const d of diffs) {
  let goals = 0,
    hits = 0,
    big = 0,
    shots = 0,
    fire = 0,
    ticks = 0,
    saves = 0,
    fights = 0,
    specials = 0,
    teamFire = 0;
  let maxTicks = 0;
  for (let i = 0; i < N; i++) {
    const a = quickTeam('A');
    const b = quickTeam('B');
    const sim = new MatchSim(
      [
        { name: 'A', short: 'A', color: '#f00', skaters: a.skaters, goalie: a.goalie, isHuman: false, difficulty: d },
        { name: 'B', short: 'B', color: '#00f', skaters: b.skaters, goalie: b.goalie, isHuman: false, difficulty: d },
      ],
      defaultMatchMods(),
      1000 + i,
    );
    let t = 0;
    while (sim.st.phase !== 'over' && t < 60 * 60 * 20) {
      const ev = sim.step();
      for (const e of ev) {
        if (e.type === 'goal') goals++;
        if (e.type === 'hit') {
          hits++;
          if (e.big) big++;
        }
        if (e.type === 'shot') shots++;
        if (e.type === 'onFire') fire++;
        if (e.type === 'save') saves++;
        if (e.type === 'fightStart') fights++;
        if (e.type === 'special') specials++;
        if (e.type === 'teamFire') teamFire++;
      }
      t++;
      for (const id of sim.st.order) {
        const s = sim.st.skaters[id];
        if (!Number.isFinite(s.pos.x) || !Number.isFinite(s.pos.y)) throw new Error('NaN skater ' + id);
      }
      if (!Number.isFinite(sim.st.puck.pos.x)) throw new Error('NaN puck');
    }
    ticks += t;
    maxTicks = Math.max(maxTicks, t);
  }
  console.log(
    `diff ${d}: goals/match ${(goals / N).toFixed(2)} shots ${(shots / N).toFixed(1)} saves ${(saves / N).toFixed(1)} hits ${(hits / N).toFixed(1)} big ${(big / N).toFixed(1)} onFire ${(fire / N).toFixed(2)} fights ${(fights / N).toFixed(2)} specials ${(specials / N).toFixed(2)} teamFire ${(teamFire / N).toFixed(2)} avgMin ${(ticks / N / 3600).toFixed(1)} maxMin ${(maxTicks / 3600).toFixed(1)}`,
  );
}
