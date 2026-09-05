import { defaultMeta, type MetaProfile } from '../run/meta';

const META_KEY = 'hokyz.meta.v1';
const RUN_KEY = 'hokyz.run.v1';

export function loadMeta(): MetaProfile {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw) as Partial<MetaProfile>;
    return { ...defaultMeta(), ...parsed };
  } catch {
    return defaultMeta();
  }
}
export function saveMeta(m: MetaProfile): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
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
