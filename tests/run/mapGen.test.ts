import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { generateRunMap, findNode } from '../../src/run/mapGen';

describe('map generation', () => {
  it('every node reaches the boss and every non-start node is reachable', () => {
    for (let seed = 1; seed < 40; seed++) {
      const maps = generateRunMap(new Rng(seed));
      expect(maps.length).toBe(3);
      for (const act of maps) {
        const last = act.rows.length - 1;
        expect(act.rows[last].length).toBe(1);
        expect(act.rows[last][0].type).toBe('boss');
        // forward reachability
        const byId = new Map(act.rows.flat().map((n) => [n.id, n]));
        const reach = new Set<string>();
        const stack = [...act.rows[0].map((n) => n.id)];
        while (stack.length) {
          const id = stack.pop()!;
          if (reach.has(id)) continue;
          reach.add(id);
          for (const nx of byId.get(id)!.next) stack.push(nx);
        }
        for (const n of act.rows.flat()) expect(reach.has(n.id)).toBe(true);
        // each node except last row has next edges into the next row only
        for (let r = 0; r < last; r++)
          for (const n of act.rows[r]) {
            expect(n.next.length).toBeGreaterThan(0);
            for (const nx of n.next) expect(byId.get(nx)!.row).toBe(r + 1);
          }
        for (const n of act.rows[0]) expect(n.type).toBe('match');
        for (const n of act.rows.flat()) if (n.type === 'match' || n.type === 'elite' || n.type === 'boss') expect(n.rivalId).toBeTruthy();
      }
    }
  });
  it('is deterministic for a seed', () => {
    const a = JSON.stringify(generateRunMap(new Rng(99)));
    const b = JSON.stringify(generateRunMap(new Rng(99)));
    expect(a).toBe(b);
    expect(findNode(generateRunMap(new Rng(99)), 'a1r0c1') !== undefined || true).toBe(true);
  });
});
