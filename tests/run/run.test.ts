import { describe, expect, it } from 'vitest';
import { CAPTAINS } from '../../src/run/meta';
import { applyMatchOutcome, availableNodes, buildMatch, completeNode, deserializeRun, draftPerks, newRun, serializeRun, teamMods, type MatchOutcome } from '../../src/run/runState';
import { PERKS, PERK_BY_ID } from '../../src/run/perks';
import { defaultTeamMods } from '../../src/sim/modifiers';

const outcome = (won: boolean, hp = 80): MatchOutcome => ({ won, scoreFor: won ? 5 : 2, scoreAgainst: won ? 2 : 5, bigHits: 3, hp: {}, boxScore: [] });

describe('run state', () => {
  it('new run has captain + 2 starters + bench + goalie', () => {
    const r = newRun('test', CAPTAINS[0], 0, []);
    expect(r.roster.length).toBe(4);
    expect(r.roster[0].name).toBe(CAPTAINS[0].name);
    expect(r.goalie.archetype).toBe('goalie');
    expect(availableNodes(r).length).toBeGreaterThan(0);
  });
  it('perk hooks change team mods', () => {
    const r = newRun('perks', CAPTAINS[0], 0, []);
    r.perks.push('turbo_junkie', 'heavy_hands');
    const m = teamMods(r);
    const d = defaultTeamMods();
    expect(m.turboRegenMul).toBeCloseTo(d.turboRegenMul * 1.45);
    expect(m.hitPowerMul).toBeCloseTo(1.25);
  });
  it('every perk applies without throwing', () => {
    const r = newRun('all', CAPTAINS[0], 0, ['perk_gasoline', 'perk_zamboni', 'perk_deadeye']);
    r.perks = PERKS.map((p) => p.id);
    expect(() => teamMods(r)).not.toThrow();
    const node = availableNodes(r)[0];
    expect(() => buildMatch(r, node)).not.toThrow();
  });
  it('draft never offers owned perks or locked ones', () => {
    const r = newRun('draft', CAPTAINS[1], 0, []);
    r.perks.push('turbo_junkie');
    for (let i = 0; i < 20; i++) {
      const picks = draftPerks(r, 3);
      expect(picks.length).toBe(3);
      for (const p of picks) {
        expect(p.id).not.toBe('turbo_junkie');
        expect(PERK_BY_ID[p.id].unlock).toBeUndefined();
      }
      expect(new Set(picks.map((p) => p.id)).size).toBe(3);
    }
  });
  it('win awards cash and advances; loss ends run unless second wind', () => {
    const r = newRun('flow', CAPTAINS[0], 0, []);
    const node = availableNodes(r)[0];
    const res = applyMatchOutcome(r, node, outcome(true));
    expect(res.cash).toBeGreaterThan(0);
    completeNode(r, node);
    expect(r.row).toBe(1);
    expect(node.done).toBe(true);
    const next = availableNodes(r);
    expect(next.length).toBeGreaterThan(0);
    expect(next.every((n) => node.next.includes(n.id))).toBe(true);
    // second wind
    r.perks.push('second_wind');
    const loss1 = applyMatchOutcome(r, next[0], outcome(false));
    expect(loss1.ended).toBe(false);
    expect(loss1.usedLife).toBe(true);
    const loss2 = applyMatchOutcome(r, next[0], outcome(false));
    expect(loss2.ended).toBe(true);
    expect(r.over).toBe(true);
  });
  it('completing the act 3 boss wins the run', () => {
    const r = newRun('win', CAPTAINS[0], 0, []);
    for (let guard = 0; guard < 40 && !r.over; guard++) {
      const n = availableNodes(r)[0];
      completeNode(r, n);
    }
    expect(r.over).toBe(true);
    expect(r.won).toBe(true);
  });
  it('serializes round-trip', () => {
    const r = newRun('save', CAPTAINS[0], 1, []);
    r.perks.push('jet_fuel');
    const json = serializeRun(r);
    const back = deserializeRun(json)!;
    expect(back).not.toBeNull();
    expect(back.perks).toEqual(['jet_fuel']);
    expect(back.maps[0].rows.length).toBe(r.maps[0].rows.length);
    expect(deserializeRun('garbage')).toBeNull();
  });
  it('injured starters are benched in lineup', () => {
    const r = newRun('inj', CAPTAINS[0], 0, []);
    r.roster[1].hp = 5;
    const node = availableNodes(r)[0];
    const b = buildMatch(r, node);
    expect(b.home.skaters.length).toBe(3);
    expect(b.home.skaters.some((s) => s.id === r.roster[1].id)).toBe(false);
  });
});
