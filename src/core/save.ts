import { defaultMeta, type MetaProfile } from '../run/meta';
import type { RunState } from '../run/runState';

const META_KEY = 'hokyz.meta.v1';
const RUN_KEY = 'hokyz.run.v1';
export const META_SCHEMA = 2;
export const RUN_SCHEMA = 2;
const NODE_TYPES = new Set(['match', 'elite', 'shop', 'event', 'rest', 'boss', 'shootout', 'hitparade']);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Deep-fill: every key in `defaults` exists in the result; nested plain objects merge recursively. */
export function deepFill<T>(defaults: T, value: unknown): T {
  if (!isObj(defaults)) return (value === undefined ? defaults : (value as T));
  const out: Record<string, unknown> = { ...(isObj(value) ? value : {}) };
  for (const k of Object.keys(defaults as Record<string, unknown>)) {
    const d = (defaults as Record<string, unknown>)[k];
    const v = out[k];
    if (isObj(d)) out[k] = deepFill(d, v);
    else if (v === undefined || v === null) out[k] = d;
  }
  return out as T;
}

/** Bring any stored meta up to the current schema. Unknown/garbage → fresh defaults. */
export function migrateMeta(raw: unknown): MetaProfile {
  if (!isObj(raw)) return defaultMeta();
  const m = deepFill(defaultMeta(), raw) as MetaProfile & { schema?: number };
  // v1 had no schema field; nothing structural changed, only new fields (filled above)
  if (!Array.isArray(m.unlocked) || m.unlocked.length === 0) m.unlocked = defaultMeta().unlocked;
  if (!Array.isArray(m.feats)) m.feats = [];
  m.schema = META_SCHEMA;
  return m;
}

/** Bring a stored run up to the current schema, or null if it cannot be trusted. */
export function migrateRun(raw: unknown): RunState | null {
  if (!isObj(raw)) return null;
  const r = raw as Partial<RunState> & { version?: number };
  if (!r.maps || !Array.isArray(r.maps) || !r.roster || !r.goalie) return null;
  if (r.version !== 1 && r.version !== 2) return null;
  // structural validation: every node has a known type
  for (const act of r.maps) {
    if (!act || !Array.isArray(act.rows)) return null;
    for (const row of act.rows) for (const n of row) if (!NODE_TYPES.has(n.type)) return null;
  }
  const run = r as RunState;
  run.grudges ??= {};
  run.flags ??= { unlockedPerks: [] };
  run.flags.unlockedPerks ??= [];
  run.weekly ??= null;
  run.perks ??= [];
  run.path ??= [];
  run.teamLogo ??= 'circle';
  run.lineupIds ??= run.roster.slice(0, 3).map((s) => s.id);
  run.goalie.goalieStyle ??= 'butterfly';
  for (const s of [...run.roster, run.goalie]) {
    s.xp ??= 0;
    s.level ??= 0;
    s.pendingLevels ??= 0;
    s.traits ??= [];
  }
  run.version = 1; // RunState type pins 1; schema tracked separately
  (run as RunState & { schema?: number }).schema = RUN_SCHEMA;
  return run;
}

export function loadMeta(): MetaProfile {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    return migrateMeta(JSON.parse(raw));
  } catch {
    return defaultMeta();
  }
}
export function saveMeta(m: MetaProfile): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify({ ...m, schema: META_SCHEMA }));
  } catch {
    /* ignore */
  }
}
export function loadRunRaw(): string | null {
  try {
    return localStorage.getItem(RUN_KEY);
  } catch {
    return null;
  }
}
export function saveRunRaw(json: string | null): void {
  try {
    if (json === null) localStorage.removeItem(RUN_KEY);
    else localStorage.setItem(RUN_KEY, json);
  } catch {
    /* ignore */
  }
}
