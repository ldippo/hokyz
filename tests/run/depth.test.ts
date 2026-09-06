import { describe, expect, it } from 'vitest';
import { CAPTAINS } from '../../src/run/meta';
import { applyMatchOutcome, availableNodes, buildMatch, newRun, pendingLevelUps, teamMods, runEffects, type MatchOutcome } from '../../src/run/runState';
import { activeSets, tagCounts, PERKS } from '../../src/run/perks';
import { levelFor, XP_LEVELS, xpForMatch } from '../../src/run/roster';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { RIVAL_BY_ID, buildRivalRoster } from '../../src/run/teams';
import { Rng } from '../../src/core/rng';

describe('perk synergy sets', () => {
  it('three FIRE perks complete the Wildfire set and enable fire spread', () => {
    const r = newRun('sets', CAPTAINS[0], 0, []);
    r.perks.push('kindling', 'inferno', 'gasoline');
    expect(tagCounts(r.perks).FIRE).toBe(3);
    expect(activeSets(r.perks)).toContain('FIRE');
    expect(teamMods(r).fireSpread).toBe(true);
    // two is not a set
    r.perks = ['kindling', 'inferno'];
    expect(activeSets(r.perks)).toEqual([]);
    expect(teamMods(r).fireSpread).toBe(false);
  });
  it('IRON set zeroes injuries in both sim and run effects', () => {
    const r = newRun('iron', CAPTAINS[0], 0, []);
    r.perks.push('iron_skates', 'ironman', 'second_wind');
    expect(teamMods(r).injuryMul).toBe(0);
    expect(runEffects(r).injuryMul).toBe(0);
  });
  it('every perk has tags and cursed perks declare their curse', () => {
    for (const p of PERKS) expect(p.tags?.length ?? 0).toBeGreaterThan(0);
    const cursed = PERKS.filter((p) => p.curse);
    expect(cursed.length).toBeGreaterThanOrEqual(4);
    for (const p of cursed) expect(p.rarity).toBe('epic');
  });
});

describe('skater xp', () => {
  it('levels follow thresholds and captains earn 1.5x', () => {
    expect(levelFor(0)).toBe(0);
    expect(levelFor(XP_LEVELS[1])).toBe(1);
    expect(levelFor(XP_LEVELS[3] + 1)).toBe(3);
    const box = { goals: 2, assists: 1, hits: 5, bigHits: 1, saves: 0 };
    expect(xpForMatch(box, true)).toBeGreaterThan(xpForMatch(box, false));
  });
  it('a big match queues a level-up for the scorer', () => {
    const r = newRun('xp', CAPTAINS[0], 0, []);
    const cap = r.roster[0];
    const node = availableNodes(r)[0];
    const outcome: MatchOutcome = {
      won: true,
      scoreFor: 4,
      scoreAgainst: 1,
      bigHits: 2,
      hp: {},
      boxScore: [{ id: cap.id, name: cap.name, team: 0, goals: 3, assists: 1, hits: 6, bigHits: 2, shots: 8, saves: 0, isGoalie: false }],
    };
    applyMatchOutcome(r, node, outcome);
    expect(cap.xp).toBeGreaterThanOrEqual(XP_LEVELS[1]);
    expect(cap.level).toBeGreaterThanOrEqual(1);
    expect(pendingLevelUps(r).map((s) => s.id)).toContain(cap.id);
  });
});

describe('boss phases', () => {
  function bossSim(rivalId: string, seed = 4) {
    const rng = new Rng(seed);
    const rival = RIVAL_BY_ID[rivalId];
    const opp = buildRivalRoster(rng, rival, 1);
    const home = quickTeam('H');
    const mods = defaultMatchMods();
    mods.periodLength = 6;
    mods.bossPhases = (rival.phases ?? []).map((p) => ({ ...p, applied: false }));
    if (mods.bossPhases.some((p) => p.kind === 'extraSkater')) mods.extraSkater = opp.skaters[0] && { ...opp.skaters[0], id: 'extra1', name: 'Extra' };
    return new MatchSim(
      [
        { name: 'H', short: 'H', color: '#00f', skaters: home.skaters, goalie: home.goalie, isHuman: false, difficulty: 1 },
        { name: rival.name, short: rival.short, color: rival.color, skaters: opp.skaters, goalie: opp.goalie, isHuman: false, difficulty: 1 },
      ],
      mods,
      seed,
    );
  }
  it('Wreckers add a fourth skater in the third period', () => {
    const s = bossSim('boss_wrecking');
    const startingSkaters = [...s.st.teams[1].skaters];
    const startingGoalie = s.st.teams[1].goalie;
    let phases = 0;
    for (let i = 0; i < 60 * 60 && s.st.phase !== 'over'; i++) for (const e of s.step()) if (e.type === 'bossPhase') phases++;
    expect(phases).toBe(1);
    // Late-game AI may pull the goalie as an attacker. Assert the exact boss
    // roster addition independently of that score-dependent tactical decision.
    expect(s.st.teams[1].skaters.filter(id => id !== startingGoalie).sort())
      .toEqual([...startingSkaters, 'extra1'].sort());
    expect(s.st.skaters['extra1']).toBeDefined();
  });
  it('Blur turns the ice slick in period 2 and infinite turbo in period 3', () => {
    const s = bossSim('boss_blur');
    const seen: string[] = [];
    for (let i = 0; i < 60 * 60 && s.st.phase !== 'over'; i++) for (const e of s.step()) if (e.type === 'bossPhase') seen.push(e.label);
    expect(seen).toEqual(['ICE STORM', 'REDLINE']);
    expect(s.st.mods.slipperyIce).toBe(true);
    expect(s.st.mods.turboInfinite).toBe(true);
  });
  it('run buildMatch attaches phases for boss nodes only', () => {
    const r = newRun('boss', CAPTAINS[0], 0, []);
    const node = availableNodes(r)[0];
    expect(buildMatch(r, node).mods.bossPhases.length).toBe(0);
    const bossNode = r.maps[0].rows[r.maps[0].rows.length - 1][0];
    const b = buildMatch(r, bossNode);
    expect(b.mods.bossPhases.length).toBeGreaterThan(0);
    if (b.mods.bossPhases.some((p) => p.kind === 'extraSkater')) expect(b.mods.extraSkater).not.toBeNull();
  });
});
