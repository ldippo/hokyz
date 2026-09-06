import { expect, it } from 'vitest';
import { MatchSim } from '../../src/sim/match';
import { quickTeam } from '../../src/sim/fixtures';
import { defaultMatchMods } from '../../src/sim/modifiers';
import { manpowerText } from '../../src/ui/manpower';

function state() {
  const teams = ['HOME', 'AWAY'].map(name => ({ ...quickTeam(name), name, short: name, color: '#fff', isHuman: false, difficulty: 1 }));
  const st = new MatchSim([teams[0], teams[1]], defaultMatchMods(), 1).st;
  st.phase = 'play'; return st;
}
it('hides normal manpower and clears after restoration', () => {
  const st = state(); expect(manpowerText(st)).toBe('');
  const id = st.teams[0].skaters.pop()!; st.teams[0].ejected.push(id);
  expect(manpowerText(st)).toBe('HOME 2 · AWAY 3 skaters | HOME: 1 sitting this period');
  st.teams[0].skaters.push(id); st.teams[0].ejected = [];
  expect(manpowerText(st)).toBe('');
});
it('distinguishes a pulled goalie from reinforcements', () => {
  const st = state(); st.teams[1].skaters.push('extra');
  expect(manpowerText(st)).toBe('HOME 3 · AWAY 4 skaters');
  st.teams[1].pulled = true;
  expect(manpowerText(st)).toContain('AWAY: empty net');
});
it('shows equal headcounts with different goalie/ejection conditions', () => {
  const st = state(); st.teams[0].pulled = true; st.teams[0].ejected.push('sitting');
  expect(manpowerText(st)).toContain('HOME 3 · AWAY 3 skaters | HOME: empty net · HOME: 1 sitting this period');
});
it.each(['intro', 'fight', 'shootout', 'over'] as const)('hides in %s', phase => {
  const st = state(); st.phase = phase; st.teams[1].skaters.push('extra');
  expect(manpowerText(st)).toBe('');
});
