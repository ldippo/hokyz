import { describe, expect, it } from 'vitest';
import { defaultMeta, isoWeek, weeklySeed } from '../../src/run/meta';
import { awardFeats, FEATS } from '../../src/run/feats';
import { newRun, type MatchOutcome } from '../../src/run/runState';
import { CAPTAINS } from '../../src/run/meta';
import { hashSeed } from '../../src/core/rng';

const outcome = (o: Partial<MatchOutcome>): MatchOutcome => ({ won: true, scoreFor: 3, scoreAgainst: 1, bigHits: 1, hp: {}, boxScore: [], ...o });

describe('feats', () => {
  it('awards once, pays cash, grants unlocks', () => {
    const meta = defaultMeta();
    meta.totalGoals = 1;
    const cash = meta.cash;
    const got = awardFeats(meta, {});
    expect(got.map((f) => f.id)).toContain('first_blood');
    expect(meta.cash).toBe(cash + 25);
    expect(awardFeats(meta, {}).length).toBe(0);
    const run = newRun('f', CAPTAINS[0], 0, []);
    run.perks = ['kindling', 'inferno', 'gasoline'];
    const got2 = awardFeats(meta, { run });
    expect(got2.map((f) => f.id)).toContain('set_piece');
    expect(meta.unlocked).toContain('perk_zamboni');
  });
  it('match feats read the outcome extras', () => {
    const meta = defaultMeta();
    const got = awardFeats(meta, { outcome: outcome({ scoreAgainst: 0, bigHits: 5, fightsWon: 1, ankleBreakers: 3, bigSaves: 1, specialsUsed: 3, shootoutWon: true, topCornerGoals: 3, boxScore: [{ id: 'x', name: 'x', team: 0, goals: 3, assists: 0, hits: 0, bigHits: 0, shots: 0, saves: 0, isGoalie: false }] }) });
    const ids = got.map((f) => f.id);
    for (const id of ['hat_trick', 'shutout', 'big_hitter', 'brawler', 'ankle_breaker', 'wall', 'showtime', 'top_shelf', 'shootout_king']) expect(ids).toContain(id);
  });
  it('run feats fire on act clears and the championship', () => {
    const meta = defaultMeta();
    const run = newRun('c', CAPTAINS[0], 0, []);
    run.act = 3;
    run.won = true;
    const ids = awardFeats(meta, { run, runOver: true }).map((f) => f.id);
    expect(ids).toContain('act1');
    expect(ids).toContain('act2');
    expect(ids).toContain('champion');
    expect(meta.unlocked).toContain('perk_deadeye');
  });
  it('every feat has a reward and a unique id', () => {
    const ids = new Set(FEATS.map((f) => f.id));
    expect(ids.size).toBe(FEATS.length);
    for (const f of FEATS) expect((f.reward.cash ?? 0) > 0 || !!f.reward.unlock).toBe(true);
  });
});

describe('weekly seed', () => {
  it('iso week is stable within a week and the seed hashes deterministically', () => {
    // local-time dates: the week rolls at local midnight on Monday
    expect(isoWeek(new Date(2026, 8, 5, 12))).toBe('2026-W36');
    expect(isoWeek(new Date(2026, 8, 6, 23))).toBe('2026-W36');
    expect(isoWeek(new Date(2026, 8, 7, 1))).toBe('2026-W37');
    expect(hashSeed(weeklySeed('2026-W36'))).toBe(hashSeed(weeklySeed('2026-W36')));
    const a = newRun(weeklySeed('2026-W36'), CAPTAINS[0], 0, []);
    const b = newRun(weeklySeed('2026-W36'), CAPTAINS[1], 0, []);
    expect(JSON.stringify(a.maps.map((m) => m.rows.map((r) => r.map((n) => n.type + n.rivalId))))).toBe(JSON.stringify(b.maps.map((m) => m.rows.map((r) => r.map((n) => n.type + n.rivalId)))));
  });
});
