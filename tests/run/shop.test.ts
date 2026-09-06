import { expect, it } from 'vitest';
import { CAPTAINS } from '../../src/run/meta';
import { newRun, availableNodes, prepareShop, serializeRun, deserializeRun, completeNode } from '../../src/run/runState';

it('retains shop offers and purchase/reroll state through reload until leaving', () => {
  const run = newRun('shop', CAPTAINS[0], 0, []), node = availableNodes(run)[0];
  node.type = 'shop';
  const shop = prepareShop(run, node), rng = run.rngState;
  const restored = deserializeRun(serializeRun(run))!;
  expect(prepareShop(restored, node)).toEqual(shop);
  expect(restored.rngState).toBe(rng);
  restored.pendingShop!.perkIds.pop(); restored.pendingShop!.hired = true; restored.pendingShop!.rerolls = 2;
  const purchased = deserializeRun(serializeRun(restored))!;
  expect(prepareShop(purchased, node)).toEqual(restored.pendingShop);
  completeNode(purchased, purchased.maps[0].rows[0][0]);
  expect(purchased.pendingShop).toBeUndefined();
});
