import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { CAPTAINS, ascensionLevel, defaultMeta } from '../../src/run/meta';
import { bankRun, buildMatch, completeNode, draftPerks, extendRun, newRun, nodeTier, runEffects } from '../../src/run/runState';
import { migrateRun, deepFill } from '../../src/core/save';
import { serializeRun } from '../../src/run/runState';
import { RIVAL_BY_ID } from '../../src/run/teams';
import { PERK_BY_ID } from '../../src/run/perks';

function runAtLastBoss(asc = 0) {
  const run = newRun('endgame', CAPTAINS[0], asc, ['perk_deadeye', 'perk_zamboni', 'perk_gasoline']);
  run.act = 3;
  const act = run.maps[2];
  run.row = act.rows.length - 1;
  return { run, boss: act.rows[act.rows.length - 1][0] };
}

describe('overtime league', () => {
  it('clearing the act-3 boss wins the run but offers the league instead of ending it', () => {
    const { run, boss } = runAtLastBoss();
    completeNode(run, boss);
    expect(run.won).toBe(true);
    expect(run.over).toBe(false);
    expect(run.leagueOffer).toBe(true);
  });
  it('banking ends the run; extending adds a tougher act with a boss row', () => {
    const a = runAtLastBoss();
    completeNode(a.run, a.boss);
    bankRun(a.run);
    expect(a.run.over).toBe(true);
    expect(a.run.leagueOffer).toBe(false);

    const b = runAtLastBoss();
    completeNode(b.run, b.boss);
    const map = extendRun(b.run);
    expect(b.run.act).toBe(4);
    expect(b.run.maps.length).toBe(4);
    expect(b.run.row).toBe(0);
    expect(b.run.league).toBe(1);
    expect(b.run.leagueOffer).toBe(false);
    const bossNode = map.rows[map.rows.length - 1][0];
    expect(bossNode.type).toBe('boss');
    expect(RIVAL_BY_ID[bossNode.rivalId!].boss).toBe(true);
    expect(nodeTier(b.run, bossNode)).toBeGreaterThanOrEqual(4);
    expect(runEffects(b.run).cashMul).toBeGreaterThan(runEffects(a.run).cashMul);
    // league bosses stack an extra phase
    const bundle = buildMatch(b.run, bossNode);
    const base = RIVAL_BY_ID[bossNode.rivalId!].phases?.length ?? 0;
    expect(bundle.mods.bossPhases.length).toBe(base + 1);
    expect(bundle.mods.bossPhases.some((p) => p.label.startsWith('OVERTIME RULES'))).toBe(true);
  });
  it('old saves get league defaults and league runs survive a round trip', () => {
    const { run, boss } = runAtLastBoss();
    completeNode(run, boss);
    extendRun(run);
    const raw = JSON.parse(serializeRun(run));
    delete raw.league;
    delete raw.leagueOffer;
    const back = migrateRun(raw)!;
    expect(back.league).toBe(0);
    expect(back.leagueOffer).toBe(false);
    expect(back.maps.length).toBe(4);
    expect(back.act).toBe(4);
  });
});

describe('ascension 3-5', () => {
  it('ascension level reads the highest owned tier', () => {
    const m = deepFill(defaultMeta(), { unlocked: ['cap_bricker', 'asc_1', 'asc_4'] });
    expect(ascensionLevel(m)).toBe(4);
    expect(ascensionLevel(defaultMeta())).toBe(0);
  });
  it('ascension 3 drafts always carry a cursed perk', () => {
    const run = newRun('cursed-drafts', CAPTAINS[0], 3, []);
    let allCursed = true;
    for (let i = 0; i < 12; i++) {
      const picks = draftPerks(run, 3, 0);
      if (!picks.some((p) => p.curse)) allCursed = false;
    }
    expect(allCursed).toBe(true);
    const plain = newRun('cursed-drafts', CAPTAINS[0], 0, []);
    let sawPlain = false;
    for (let i = 0; i < 12; i++) if (!draftPerks(plain, 3, 0).some((p) => p.curse)) sawPlain = true;
    expect(sawPlain).toBe(true);
    void PERK_BY_ID;
  });
  it('ascension 5 bosses get an extra phase; ascension 5 in the league stacks two', () => {
    const { run, boss } = runAtLastBoss(5);
    const base = RIVAL_BY_ID[boss.rivalId!].phases?.length ?? 0;
    expect(buildMatch(run, boss).mods.bossPhases.length).toBe(base + 1);
    completeNode(run, boss);
    const map = extendRun(run);
    const b2 = map.rows[map.rows.length - 1][0];
    const base2 = RIVAL_BY_ID[b2.rivalId!].phases?.length ?? 0;
    expect(buildMatch(run, b2).mods.bossPhases.length).toBe(Math.min(5, base2 + 2));
  });
  it('cash multipliers climb with ascension', () => {
    const m = (asc: number) => runEffects(newRun('cash', CAPTAINS[0], asc, [])).cashMul;
    expect(m(3)).toBeGreaterThan(m(2));
    expect(m(5)).toBeGreaterThan(m(4));
    void Rng;
  });
});
