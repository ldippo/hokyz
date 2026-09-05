import type { App } from '../../app';
import { btn, h } from '../dom';
import { captainScreen } from './captain';
import { runMapScreen } from './runMap';
import { unlocksScreen } from './unlocks';
import { settingsScreen } from './settings';
import { quickMatchScreen } from './quickMatch';

export function titleScreen(app: App): void {
  app.attract();
  const saved = app.loadSavedRun();
  const el = h('div', { class: 'screen transparent' },
    h('h1', { class: 'logo' }, 'HOKYZ'),
    h('div', { class: 'tagline' }, '3-on-3 · Big Hits · No Rules · Rogue Run'),
    h('div', { class: 'menu' },
      saved ? btn('Continue Run', () => { app.run = saved; runMapScreen(app); }, 'primary') : null,
      btn('New Run', () => captainScreen(app), saved ? '' : 'primary'),
      btn('Quick Match', () => quickMatchScreen(app)),
      btn('Unlocks', () => unlocksScreen(app)),
      btn('Settings', () => settingsScreen(app)),
    ),
    h('div', { class: 'small' }, `Bank: ${app.meta.cash} cash · Runs: ${app.meta.runs} · Wins: ${app.meta.wins}`),
    h('div', { class: 'small', html: 'Move <kbd>WASD</kbd> · Turbo <kbd>SHIFT</kbd> · Pass/Switch <kbd>J</kbd> · Shoot/Check <kbd>K</kbd> · Deke <kbd>L</kbd> · Special <kbd>SPACE</kbd> · Aim <kbd>↑↓</kbd> · Gamepad supported' }),
  );
  app.showScreen(el);
}
