import { describe, expect, it } from 'vitest';
import { CAPTAINS } from '../../src/run/meta';
import { cutSkater, cutValue, lineup, newRun, serializeRun, shortFor, toggleStarter } from '../../src/run/runState';
import { migrateRun } from '../../src/core/save';

describe('lineup management', () => {
  it('starters follow lineupIds; injured starters are replaced from the bench', () => {
    const r = newRun('l', CAPTAINS[0], 0, []);
    expect(r.lineupIds.length).toBe(3);
    const bench = r.roster[3];
    expect(lineup(r).map((s) => s.id)).not.toContain(bench.id);
    // swap the bench skater in for the third starter
    expect(toggleStarter(r, r.roster[2].id)).toBe(true);
    expect(toggleStarter(r, bench.id)).toBe(true);
    expect(lineup(r).map((s) => s.id)).toContain(bench.id);
    // injure a starter → bench fills
    r.roster[1].hp = 5;
    const l = lineup(r).map((s) => s.id);
    expect(l).not.toContain(r.roster[1].id);
    expect(l.length).toBe(3);
    // an injured pick can be benched, but not re-added
    expect(toggleStarter(r, r.roster[1].id)).toBe(true);
    expect(toggleStarter(r, r.roster[1].id)).toBe(false);
  });
  it('picking a fourth starter drops the oldest pick', () => {
    const r = newRun('four', CAPTAINS[0], 0, []);
    const first = r.lineupIds[0];
    toggleStarter(r, r.roster[3].id);
    expect(r.lineupIds.length).toBe(3);
    expect(r.lineupIds).not.toContain(first);
  });
  it('cutting pays cash, never the captain, never below three skaters', () => {
    const r = newRun('cut', CAPTAINS[1], 0, []);
    const cashBefore = r.cash;
    const victim = r.roster[3];
    expect(cutSkater(r, r.roster[0].id)).toBe(0);
    const paid = cutSkater(r, victim.id);
    expect(paid).toBe(cutValue(victim));
    expect(r.cash).toBe(cashBefore + paid);
    expect(r.roster.length).toBe(3);
    expect(cutSkater(r, r.roster[1].id)).toBe(0);
  });
});

describe('team identity', () => {
  it('custom identity flows into the run and survives save + migration', () => {
    const r = newRun('id', CAPTAINS[0], 0, [], { name: 'Salt Flats Skunks', color: '#ff7a1a', logo: 'star' });
    expect(r.teamName).toBe('Salt Flats Skunks');
    expect(r.teamShort).toBe('SKUNKS');
    expect(r.teamColor).toBe('#ff7a1a');
    expect(r.teamLogo).toBe('star');
    const json = JSON.parse(serializeRun(r));
    delete json.teamLogo;
    delete json.lineupIds;
    const back = migrateRun(json)!;
    expect(back.teamLogo).toBe('circle');
    expect(back.lineupIds.length).toBe(3);
    expect(shortFor('the Very Long Team Name!!')).toBe('NAME');
    expect(shortFor('')).toBe('TEAM');
  });
});
