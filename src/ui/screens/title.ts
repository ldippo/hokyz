import type { App } from '../../app';
import { btn, h } from '../dom';
import { captainScreen } from './captain';
import { runMapScreen } from './runMap';
import { unlocksScreen } from './unlocks';
import { settingsScreen } from './settings';
import { quickMatchScreen } from './quickMatch';
import { trainingScreen } from '../../training/trainingScreen';
import { recordsScreen } from './records';
import { isoWeek } from '../../run/meta';

export function titleScreen(app: App): void {
  app.attract();
  const saved = app.loadSavedRun();
  const el = h('div', { class: 'screen title-screen' },
    h('main', { class: 'title-content' },
    h('header', { class: 'title-brand' },
      h('div', { class: 'title-eyebrow' }, 'ARCADE HOCKEY / ROGUE RUN'),
      h('h1', { class: 'logo' }, 'HOKYZ'),
      h('p', { class: 'title-tagline' }, 'Small teams. Big hits. One more run.'),
    ),
    h('div', { class: 'menu title-menu', 'aria-label': 'Play modes' },
      saved ? btn('Continue Run', () => { app.run = saved; runMapScreen(app); }, 'primary') : null,
      btn('New Run', () => captainScreen(app), saved ? '' : 'primary'),
      btn('Quick Match', () => quickMatchScreen(app)),
      btn(app.meta.trainingDone ? 'Training Camp' : 'Training Camp · Start here', () => trainingScreen(app)),
      btn(`Weekly Run · ${isoWeek()}${app.meta.weekly?.week === isoWeek() ? ` · best A${app.meta.weekly.bestAct}` : ''}`, () => captainScreen(app, isoWeek())),
    ),
    app.meta.trainingDone ? null : h('p', { class: 'title-tip' }, 'New to the ice? Learn the moves in Training Camp.'),
    h('nav', { class: 'title-links', 'aria-label': 'Profile and options' },
      btn('Feats & Records', () => recordsScreen(app)),
      btn('Unlocks', () => unlocksScreen(app)),
      btn('Settings', () => settingsScreen(app)),
    ),
    h('div', { class: 'title-career' }, `${app.meta.cash} CASH`, h('span', {}, `${app.meta.runs} RUNS / ${app.meta.wins} WINS`)),
    ),
    h('div', { class: 'title-rink-caption', 'aria-hidden': 'true' },
      h('span', {}, '3 ON 3'), h('span', {}, 'BUILT FOR THE BIG HIT'),
    ),
    h('footer', { class: 'title-footer' },
      h('span', {}, app.input.fill('{up}{left}{down}{right} Navigate · {confirm} Select')),
      h('span', {}, 'Keyboard + gamepad'),
      app.assetsLoaded ? null : h('span', { class: 'loading-hint' }, 'Loading arena…'),
    ),
  );
  // Keep decorative CSS arrows out of button names announced by assistive tech.
  el.querySelectorAll<HTMLButtonElement>('.title-menu .btn').forEach((button) => {
    button.setAttribute('aria-label', button.textContent ?? '');
  });
  app.showScreen(el);
}
