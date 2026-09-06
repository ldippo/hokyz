import type { MatchState } from '../sim/types';

/** Describe dressed attackers, not the full roster or shootout participants. */
export function manpowerText(st: MatchState): string {
  if (st.shootout || !['play', 'faceoff', 'goal', 'periodEnd'].includes(st.phase)) return '';
  if (st.teams.every(t => t.skaters.length === 3 && !t.pulled && !t.ejected.length)) return '';
  const counts = st.teams.map(t => `${t.short} ${t.skaters.length}`).join(' · ');
  const reasons = st.teams.flatMap(t => {
    const notes: string[] = [];
    if (t.pulled) notes.push(`${t.short}: empty net`);
    if (t.ejected.length) notes.push(`${t.short}: ${t.ejected.length} sitting this period`);
    return notes;
  });
  return `${counts} skaters${reasons.length ? ` | ${reasons.join(' · ')}` : ''}`;
}
