import { describe, expect, it } from 'vitest';
import { availableNodes, buildMatch, newRun, previewMatch } from '../../src/run/runState';
import { CAPTAINS } from '../../src/run/meta';

// Generated IDs are identity-only; roster names, stats and traits are seeded.
const gameplay = (value: unknown): unknown => JSON.parse(JSON.stringify(value, (key, v) => key === 'id' ? undefined : v));

describe('match preview randomness', () => {
  it('keeps the run unchanged across repeated and reloaded previews', () => {
    const run = newRun('preview-rng', CAPTAINS[0], 0, []);
    const node = availableNodes(run)[0];
    const before = JSON.stringify(run);
    const first = previewMatch(run, node);
    expect(JSON.stringify(run)).toBe(before);
    expect(gameplay(previewMatch(run, node))).toEqual(gameplay(first));
    expect(gameplay(previewMatch(JSON.parse(before), node))).toEqual(gameplay(first));
    expect(JSON.stringify(run)).toBe(before);
  });
  it('preserves the original first-match setup and consumed RNG state', () => {
    const run = newRun('preview-original', CAPTAINS[0], 5, []);
    const node = run.maps[0].rows[5][0];
    const preview = previewMatch(run, node);
    const original = buildMatch(run, node);
    expect(gameplay(preview.bundle)).toEqual(gameplay(original));
    expect(preview.rngState).toBe(run.rngState);
  });
  it('refreshes home lineup and identity without rerolling the opponent', () => {
    const run = newRun('preview-lineup', CAPTAINS[0], 0, []);
    const node = availableNodes(run)[0];
    const first = previewMatch(run, node);
    run.lineupIds = run.roster.slice(-3).map(s => s.id);
    run.teamName = 'Updated team';
    const next = previewMatch(run, node);
    expect(next.bundle.home.name).toBe('Updated team');
    expect(next.bundle.home.skaters.map(s => s.id)).toEqual(run.lineupIds);
    expect(gameplay(next.bundle.away)).toEqual(gameplay(first.bundle.away));
    expect(next.bundle.seed).toBe(first.bundle.seed);
  });
});
