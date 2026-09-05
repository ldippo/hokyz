import type { App } from '../../app';
import { btn, h } from '../dom';
import { bankRun, extendRun } from '../../run/runState';
import { runOverScreen } from './runOver';
import { runMapScreen } from './runMap';
import { sfx } from '../../audio/sfx';

/** Shown when an act ends past the base run: take the trophy or keep skating in the Overtime League. */
export function leagueOfferScreen(app: App): void {
  const run = app.run!;
  const nextAct = run.maps.length + 1;
  const league = (run.league ?? 0) + 1;
  const injured = run.roster.filter((s) => s.hp <= 20).length;
  const el = h('div', { class: 'screen transparent' },
    h('div', { class: 'result' },
      h('h2', { class: 'win' }, run.league ? `ACT ${run.act} CLEARED` : '🏆 CHAMPIONS'),
      h('div', { class: 'score-line' }, run.league ? `The Overtime League rolls on. Nobody has to know when you stopped.` : 'You beat the act-3 boss. The trophy is yours either way.'),
      h('p', { class: 'screen-sub', style: 'max-width:560px' }, `OVERTIME LEAGUE · ACT ${nextAct}: a fresh map at a higher tier, any boss can show up with an extra phase, cash pays +${25 * league}%. Injuries and perks carry over${injured ? ` (${injured} skater${injured > 1 ? 's' : ''} currently out)` : ''}. Lose and the run ends, but the win is already banked.`),
      h('div', { class: 'menu' },
        btn('Bank the Trophy', () => { bankRun(run); app.saveRun(); runOverScreen(app); }, 'primary'),
        btn(`Keep Skating · Act ${nextAct}`, () => { extendRun(run); sfx.cash(); app.saveRun(); runMapScreen(app); }),
      ),
    ),
  );
  app.showScreen(el);
}
