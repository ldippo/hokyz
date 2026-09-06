import { describe, expect, it } from 'vitest';
import { newRun, availableNodes, enterNode, completeNode } from '../../src/run/runState';
import { CAPTAINS } from '../../src/run/meta';

describe('unplayed encounter preview navigation', () => {
  it.each([1, 2, 4, 5])('retains connected choices after previewing row %i and serializing', row => {
    const run = newRun('preview-navigation', CAPTAINS[0], 0, []);
    for (let i = 0; i < row; i++) completeNode(run, availableNodes(run)[0]);
    const choices = availableNodes(run).map(n => n.id);
    const path = [...run.path];
    for (const id of choices) {
      const node = run.maps.flatMap(m => m.rows.flat()).find(n => n.id === id)!;
      enterNode(run, node);
      expect(availableNodes(run).map(n => n.id)).toEqual(choices);
      expect(availableNodes(JSON.parse(JSON.stringify(run))).map(n => n.id)).toEqual(choices);
      expect(run.path).toEqual(path);
      expect(run.row).toBe(row);
    }
  });
  it('advances connectivity only when the selected encounter completes', () => {
    const run = newRun('preview-navigation', CAPTAINS[0], 0, []);
    const first = availableNodes(run)[0];
    completeNode(run, first);
    const second = availableNodes(run)[0];
    enterNode(run, second);
    completeNode(run, second);
    expect(availableNodes(run).map(n => n.id)).toEqual(run.maps[0].rows[2].filter(n => second.next.includes(n.id)).map(n => n.id));
    expect(run.path).toEqual([first.id, second.id]);
  });
  it.each([2, 3])('uses completed nodes in Act %i, not the previous act or current preview', act => {
    const run = newRun('preview-next-act', CAPTAINS[0], 0, []);
    for (let i = 0; i < (act - 1) * 6 + 1; i++) completeNode(run, availableNodes(run)[0]);
    expect(run.act).toBe(act);
    const choices = availableNodes(run).map(n => n.id);
    enterNode(run, availableNodes(run)[0]);
    expect(availableNodes(run).map(n => n.id)).toEqual(choices);
  });
});
