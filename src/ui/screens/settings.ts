import type { App } from '../../app';
import { btn, h } from '../dom';
import { titleScreen } from './title';
import { sfx } from '../../audio/sfx';

export function settingsScreen(app: App): void {
  const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: app.meta.volume, onInput: (e) => { const v = Number((e.target as HTMLInputElement).value); app.meta.volume = v; sfx.setVolume(v); app.saveMeta(); }, 'data-nav': '1' });
  const el = h('div', { class: 'screen transparent' },
    h('h2', { class: 'screen-title' }, 'SETTINGS'),
    h('div', { style: 'margin:20px 0' },
      h('div', { class: 'settings-row' }, h('span', {}, 'Volume'), vol),
      h('div', { class: 'settings-row' }, h('span', {}, 'Move'), h('span', { html: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / Left stick' })),
      h('div', { class: 'settings-row' }, h('span', {}, 'Turbo'), h('span', { html: '<kbd>SHIFT</kbd> / RT' })),
      h('div', { class: 'settings-row' }, h('span', {}, 'Pass · Switch'), h('span', { html: '<kbd>J</kbd> / A' })),
      h('div', { class: 'settings-row' }, h('span', {}, 'Shoot (hold) · Check'), h('span', { html: '<kbd>K</kbd> or <kbd>SPACE</kbd> / B' })),
      h('div', { class: 'settings-row' }, h('span', {}, 'Deke · Spin'), h('span', { html: '<kbd>L</kbd> / X' })),
      h('div', { class: 'settings-row' }, h('span', {}, 'Pause'), h('span', { html: '<kbd>P</kbd> / <kbd>ESC</kbd> / Start' })),
    ),
    h('div', { class: 'menu' },
      btn('Wipe Save Data', () => { if (confirm('Delete all progress?')) { localStorage.clear(); location.reload(); } }),
      btn('Back', () => titleScreen(app), 'primary'),
    ),
  );
  const nav = app.showScreen(el);
  if (nav) nav.onBack = () => titleScreen(app);
}
