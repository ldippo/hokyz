import { describe, expect, it } from 'vitest';
import { deepFill, migrateMeta, migrateRun, META_SCHEMA } from '../../src/core/save';
import { defaultMeta, CAPTAINS } from '../../src/run/meta';
import { newRun, serializeRun } from '../../src/run/runState';

describe('save migrations', () => {
  it('deepFill adds missing nested keys without clobbering values', () => {
    const d = { a: 1, b: { c: 2, d: { e: 3 } }, list: [1] };
    const out = deepFill(d, { a: 9, b: { d: {} }, extra: true });
    expect(out.a).toBe(9);
    expect(out.b.c).toBe(2);
    expect(out.b.d.e).toBe(3);
    expect((out as unknown as { extra: boolean }).extra).toBe(true);
  });
  it('a v1-era meta (no feats/telemetry/access fields) migrates to a full profile', () => {
    const old = { version: 1, cash: 120, unlocked: ['cap_bricker', 'cap_flash', 'perk_zamboni'], runs: 3, wins: 1, bestAct: 2, bestRow: 3, totalGoals: 40, totalBigHits: 12, selectedRink: 'rink_neon', volume: 0.5, seenIntro: false };
    const m = migrateMeta(old);
    expect(m.cash).toBe(120);
    expect(m.unlocked).toContain('perk_zamboni');
    expect(m.feats).toEqual([]);
    expect(m.telemetry.perkPicked).toEqual({});
    expect(m.quality).toBe('auto');
    expect(m.colorblind).toBe('off');
    expect(m.trainingDone).toBe(false);
    expect((m as unknown as { schema: number }).schema).toBe(META_SCHEMA);
    expect(migrateMeta('garbage').cash).toBe(defaultMeta().cash);
  });
  it('a current run round-trips; a v1 run without grudges/weekly gets them; unknown node types are rejected', () => {
    const run = newRun('mig', CAPTAINS[0], 0, []);
    const json = JSON.parse(serializeRun(run));
    delete json.grudges;
    delete json.weekly;
    delete json.flags;
    for (const s of json.roster) {
      delete s.xp;
      delete s.level;
    }
    const back = migrateRun(json)!;
    expect(back).not.toBeNull();
    expect(back.grudges).toEqual({});
    expect(back.weekly).toBeNull();
    expect(back.flags.unlockedPerks).toEqual([]);
    expect(back.roster[0].xp).toBe(0);
    const bad = JSON.parse(serializeRun(run));
    bad.maps[0].rows[1][0].type = 'tavern';
    expect(migrateRun(bad)).toBeNull();
    expect(migrateRun({ version: 7, maps: [] })).toBeNull();
    expect(migrateRun(null)).toBeNull();
  });
});
