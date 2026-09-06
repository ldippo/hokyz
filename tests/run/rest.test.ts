import { expect, it } from 'vitest';
import { CAPTAINS } from '../../src/run/meta';
import { newRun, availableNodes, prepareRest, claimRest, serializeRun, deserializeRun } from '../../src/run/runState';

it.each([0, 4])('persists rest offers and healing policy at ascension %i', ascension => {
  const run = newRun('rest', CAPTAINS[0], ascension, []), node = availableNodes(run)[0];
  node.type = 'rest'; run.roster.forEach(skater => { skater.hp = 25; }); run.goalie.hp = 25;
  const rest = prepareRest(run, node), rng = run.rngState;
  expect(run.roster[0].hp).toBe(ascension < 4 ? run.roster[0].maxHp : 25);
  expect(run.goalie.hp).toBe(ascension < 4 ? 100 : 25);
  const loaded = deserializeRun(serializeRun(run))!;
  expect(prepareRest(loaded, node)).toEqual(rest); expect(loaded.rngState).toBe(rng);
  const offer = rest.offers[0], skater = loaded.roster.find(skater => skater.id === offer.skaterId)!;
  const before = skater.stats[offer.stat];
  expect(claimRest(loaded, loaded.maps[0].rows[0][0], 'missing')).toBe(false);
  expect(claimRest(loaded, loaded.maps[0].rows[0][0], skater.id)).toBe(true);
  expect(skater.stats[offer.stat]).toBe(Math.min(10, before+2));
  expect(claimRest(loaded, loaded.maps[0].rows[0][0], skater.id)).toBe(false);
  expect(loaded.row).toBe(1); expect(loaded.pendingRest).toBeUndefined();
});

it('skips once without training', () => {
  const run = newRun('skip-rest', CAPTAINS[0], 0, []), node = availableNodes(run)[0];
  prepareRest(run, node);
  const stats = structuredClone(run.roster.map(skater => skater.stats));
  expect(claimRest(run, node, null)).toBe(true);
  expect(claimRest(run, node, null)).toBe(false);
  expect(run.roster.map(skater => skater.stats)).toEqual(stats);
});
