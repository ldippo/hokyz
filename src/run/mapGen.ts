import type { Rng } from '../core/rng';
import { RIVALS } from './teams';
import { MUTATORS } from './mutators';
import { EVENTS } from './events';

export type NodeType = 'match' | 'elite' | 'shop' | 'event' | 'rest' | 'boss' | 'shootout' | 'hitparade';

export interface MapNode {
  id: string;
  act: number;
  row: number;
  col: number; // 0..COLS-1 for layout
  type: NodeType;
  next: string[]; // ids in next row
  done: boolean;
  /** match/elite/boss */
  rivalId?: string;
  mutatorId?: string;
  eventId?: string;
}

export interface ActMap {
  act: number;
  rows: MapNode[][];
}

export const COLS = 5;
export const ROWS_PER_ACT = 6;

const ICONS: Record<NodeType, string> = { match: '🏒', elite: '💀', shop: '🛒', event: '❓', rest: '🔥', boss: '👑', shootout: '🥅', hitparade: '💥' };
export const nodeIcon = (t: NodeType): string => ICONS[t];
export const nodeLabel = (t: NodeType): string => ({ match: 'MATCH', elite: 'ELITE', shop: 'SHOP', event: 'EVENT', rest: 'REST', boss: 'BOSS', shootout: 'SHOOTOUT', hitparade: 'HIT PARADE' })[t];

function pickType(rng: Rng, row: number, lastRow: number, prevTypes: NodeType[]): NodeType {
  if (row === 0) return 'match';
  if (row === lastRow) return 'boss';
  if (row === lastRow - 1) return rng.chance(0.55) ? 'rest' : 'shop';
  const w: [NodeType, number][] = [
    ['match', 40],
    ['elite', row >= 2 ? 15 : 6],
    ['shop', 11],
    ['event', 16],
    ['rest', 7],
    ['shootout', row >= 1 ? 6 : 0],
    ['hitparade', row >= 1 ? 5 : 0],
  ];
  // avoid duplicating non-match types adjacent in same row
  const filtered = w.filter(([t]) => t === 'match' || !prevTypes.includes(t));
  const total = filtered.reduce((a, [, n]) => a + n, 0);
  let r = rng.next() * total;
  for (const [t, n] of filtered) {
    if (r < n) return t;
    r -= n;
  }
  return 'match';
}

export function generateAct(rng: Rng, act: number, usedRivals: Set<string>): ActMap {
  const lastRow = ROWS_PER_ACT - 1;
  const rows: MapNode[][] = [];
  // Layout: choose number of nodes per row (2-4), boss row 1
  const counts: number[] = [];
  for (let r = 0; r < ROWS_PER_ACT; r++) counts.push(r === lastRow ? 1 : r === 0 ? rng.int(2, 3) : rng.int(2, 4));
  const regular = RIVALS.filter((t) => !t.boss);
  const boss = RIVALS.find((t) => t.boss && t.act === act) ?? RIVALS.find((t) => t.boss)!;
  const evPool = rng.shuffle([...EVENTS]);
  let evIdx = 0;
  for (let r = 0; r < ROWS_PER_ACT; r++) {
    const n = counts[r];
    const row: MapNode[] = [];
    // spread columns
    const cols: number[] = [];
    if (n === 1) cols.push(2);
    else {
      const start = Math.floor((COLS - n) / 2) + (rng.chance(0.5) && n < COLS - 1 ? rng.int(0, 1) : 0);
      for (let i = 0; i < n; i++) cols.push(Math.min(COLS - 1, start + i));
    }
    const prevTypes: NodeType[] = [];
    for (let i = 0; i < n; i++) {
      const type = pickType(rng, r, lastRow, prevTypes);
      prevTypes.push(type);
      const node: MapNode = { id: `a${act}r${r}c${cols[i]}`, act, row: r, col: cols[i], type, next: [], done: false };
      if (type === 'shootout') {
        node.rivalId = rng.pick(regular).id;
      }
      if (type === 'match' || type === 'elite') {
        // prefer rivals not used yet in this act
        const fresh = regular.filter((t) => !usedRivals.has(t.id));
        const pool = fresh.length ? fresh : regular;
        const t = rng.pick(pool);
        usedRivals.add(t.id);
        node.rivalId = t.id;
        if (type === 'elite') node.mutatorId = rng.pick(MUTATORS).id;
      } else if (type === 'boss') {
        node.rivalId = boss.id;
      } else if (type === 'event') {
        node.eventId = evPool[evIdx++ % evPool.length].id;
      }
      row.push(node);
    }
    rows.push(row);
  }
  // Edges: each node → 1-2 nodes in next row, nearest by column; ensure every next-row node has an incoming edge
  for (let r = 0; r < lastRow; r++) {
    const cur = rows[r],
      nxt = rows[r + 1];
    for (const node of cur) {
      const sorted = [...nxt].sort((a, b) => Math.abs(a.col - node.col) - Math.abs(b.col - node.col));
      node.next.push(sorted[0].id);
      if (sorted[1] && rng.chance(0.55) && Math.abs(sorted[1].col - node.col) <= 2) node.next.push(sorted[1].id);
    }
    for (const nn of nxt) {
      if (!cur.some((c) => c.next.includes(nn.id))) {
        const nearest = [...cur].sort((a, b) => Math.abs(a.col - nn.col) - Math.abs(b.col - nn.col))[0];
        nearest.next.push(nn.id);
      }
    }
    // prevent crossing edges: sort next lists and fix simple crossings
    for (let i = 0; i < cur.length - 1; i++) {
      const a = cur[i],
        b = cur[i + 1];
      const aMax = Math.max(...a.next.map((id) => nxt.find((n) => n.id === id)!.col));
      const bMin = Math.min(...b.next.map((id) => nxt.find((n) => n.id === id)!.col));
      if (aMax > bMin) {
        // drop a's far edge (or b's near edge) only if the target keeps another incoming edge
        const incoming = (id: string) => cur.filter((c) => c.next.includes(id)).length;
        const aFar = nxt.find((n) => n.col === aMax)!.id;
        const bNear = nxt.find((n) => n.col === bMin)!.id;
        if (a.next.length > 1 && incoming(aFar) > 1) a.next = a.next.filter((id) => id !== aFar);
        else if (b.next.length > 1 && incoming(bNear) > 1) b.next = b.next.filter((id) => id !== bNear);
      }
    }
    // final safety: every next-row node must have an incoming edge
    for (const nn of nxt) {
      if (!cur.some((c) => c.next.includes(nn.id))) {
        const nearest = [...cur].sort((a, b) => Math.abs(a.col - nn.col) - Math.abs(b.col - nn.col))[0];
        nearest.next.push(nn.id);
      }
    }
  }
  return { act, rows };
}

export function generateRunMap(rng: Rng, acts = 3): ActMap[] {
  const used = new Set<string>();
  const out: ActMap[] = [];
  for (let a = 1; a <= acts; a++) {
    if (a > 1) used.clear();
    out.push(generateAct(rng, a, used));
  }
  return out;
}

export function findNode(maps: ActMap[], id: string): MapNode | undefined {
  for (const m of maps) for (const row of m.rows) for (const n of row) if (n.id === id) return n;
  return undefined;
}
