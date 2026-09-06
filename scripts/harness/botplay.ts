import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import bounds from '../../docs/design/bounds.json';
import { PossessionMetrics } from './possession';

const out = resolve(process.argv[2] ?? `.gaming/botplay/${Date.now()}.json`);
const matches = [];
const failures: string[] = [];
for (const difficulty of bounds.difficulties) {
  for (const baseSeed of bounds.seeds) {
    const seed = baseSeed + difficulty;
    const teams = ['A', 'B'].map((name) => ({
      ...quickTeam(name), name, short: name, color: name === 'A' ? '#f00' : '#00f',
      isHuman: false, difficulty,
    }));
    const sim = new MatchSim([teams[0], teams[1]], defaultMatchMods(), seed);
    const possession = new PossessionMetrics();
    let ticks = 0, goals = 0, shots = 0, hits = 0, ownGoals = 0, stillSeconds = 0;
    let last = { x: 0, y: 0 };
    const label = `difficulty=${difficulty} seed=${seed}`;
    try {
      while (sim.st.phase !== 'over' && ticks < bounds.maxTicks) {
        const events = sim.step();
        possession.sample(sim.st, events);
        for (const event of events) {
          if (event.type === 'goal') { goals++; if (event.ownGoal) ownGoals++; }
          if (event.type === 'shot') shots++;
          if (event.type === 'hit') hits++;
        }
        ticks++;
        const st = sim.st;
        const vectors = [st.puck.pos, st.puck.vel, ...st.order.flatMap((id) => [st.skaters[id].pos, st.skaters[id].vel])];
        if (!vectors.every((v) => Number.isFinite(v.x) && Number.isFinite(v.y))) throw new Error('non-finite physics');
        if (st.phase === 'play' && Math.hypot(st.puck.pos.x - last.x, st.puck.pos.y - last.y) < 0.01) stillSeconds += st.dt;
        else stillSeconds = 0;
        last = { ...st.puck.pos };
        if (stillSeconds > bounds.maxStationaryPlaySeconds) throw new Error('puck stalled during play');
      }
      if (sim.st.phase !== 'over') throw new Error('match exceeded tick budget');
    } catch (error) { failures.push(`${label}: ${String(error)}`); }
    possession.finish();
    matches.push({ seed, difficulty, ticks, finished: sim.st.phase === 'over', goals, shots, hits, ownGoals, score: sim.st.teams.map((t) => t.score), possession: possession.report() });
  }
}
const meanGoals = matches.reduce((sum, match) => sum + match.goals, 0) / matches.length;
if (!(meanGoals > bounds.meanGoalsExclusive[0] && meanGoals < bounds.meanGoalsExclusive[1])) failures.push(`mean goals outside bounds: ${meanGoals}`);
const report = { pass: failures.length === 0, meanGoals, failures, bounds, matches };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(`${report.pass ? 'PASS' : 'FAIL'}: ${matches.length} hockey matches, mean goals ${meanGoals}; ${out}`);
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
