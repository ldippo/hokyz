import { describe, expect, it } from 'vitest';
import { CAPTAINS } from '../../src/run/meta';
import { availableNodes, claimDraft, deserializeRun, newRun, prepareDraft, serializeRun } from '../../src/run/runState';

describe('durable match rewards', () => {
  it('restores identical choices without consuming RNG again', () => {
    const run = newRun('reward-resume', CAPTAINS[0], 0, []);
    const node = availableNodes(run)[0];
    const ids = prepareDraft(run, node).map(p => p.id);
    const restored = deserializeRun(serializeRun(run))!;
    expect(restored.pendingDraft?.perkIds).toEqual(ids);
    const rng = restored.rngState;
    expect(prepareDraft(restored, node).map(p => p.id)).toEqual(ids);
    expect(restored.rngState).toBe(rng);
    expect(claimDraft(restored, ids[0])).toBe(true);
    expect(claimDraft(restored, ids[0])).toBe(false);
    expect(restored.perks.filter(id => id === ids[0])).toHaveLength(1);
    expect(deserializeRun(serializeRun(restored))!.pendingDraft).toBeUndefined();
  });

  it('rejects an unoffered perk and credits skipping exactly once', () => {
    const run = newRun('reward-skip', CAPTAINS[0], 0, []);
    prepareDraft(run, availableNodes(run)[0]);
    const cash = run.cash;
    expect(claimDraft(run, 'not-offered')).toBe(false);
    expect(run.pendingDraft).toBeDefined();
    expect(claimDraft(run, null)).toBe(true);
    expect(claimDraft(run, null)).toBe(false);
    expect(run.cash).toBe(cash + 25);
  });

  it('keeps old saves without a pending reward loadable', () => {
    const run = newRun('old-reward', CAPTAINS[0], 0, []);
    expect(deserializeRun(serializeRun(run))?.pendingDraft).toBeUndefined();
  });
});
