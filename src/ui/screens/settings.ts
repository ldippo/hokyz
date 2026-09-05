import type { App } from '../../app';
import { btn, h } from '../dom';
import { titleScreen } from './title';
import { sfx } from '../../audio/sfx';
import { controlsScreen } from './controls';

export function settingsScreen(app: App): void {
  const levels = ['auto', 'low', 'med', 'high'] as const;
  const qLbl = h('span', {}, '');
  const refreshQ = () => { qLbl.textContent = `${app.meta.quality.toUpperCase()}${app.meta.quality === 'auto' ? ` (${app.rig.tier.toUpperCase()})` : ''} · ${app.rig.gpu.backend.toUpperCase()}`; };
  const cycleQ = (d: number) => { const i = levels.indexOf(app.meta.quality); app.meta.quality = levels[(i + d + levels.length) % levels.length]; app.saveMeta(); app.applyQualityPref(); refreshQ(); };
  refreshQ();
  const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: app.meta.volume, onInput: (e) => { const v = Number((e.target as HTMLInputElement).value); app.meta.volume = v; sfx.setVolume(v); app.saveMeta(); }, 'data-nav': '1' });
  const cycle = <T extends string | number>(label: string, values: readonly T[], get: () => T, set: (v: T) => void, fmt: (v: T) => string = (v) => String(v).toUpperCase()) => {
    const lbl = h('span', {}, '');
    const refresh = () => { lbl.textContent = fmt(get()); };
    refresh();
    const step = (d: number) => { const i = values.indexOf(get()); set(values[(i + d + values.length) % values.length]); app.saveMeta(); refresh(); };
    return h('div', { class: 'settings-row' }, h('span', {}, label), h('div', { style: 'display:flex;gap:8px;align-items:center' }, btn('‹', () => step(-1)), lbl, btn('›', () => step(1))));
  };
  const toggleBool = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const lbl = h('span', {}, '');
    const refresh = () => { lbl.textContent = get() ? 'ON' : 'OFF'; };
    refresh();
    const flip = () => { set(!get()); app.saveMeta(); refresh(); };
    return h('div', { class: 'settings-row' }, h('span', {}, label), h('div', { style: 'display:flex;gap:8px;align-items:center' }, btn('‹', flip), lbl, btn('›', flip)));
  };
  const toggle = (label: string, key: 'cinematics' | 'screenShake' | 'hitFx' | 'music', onChange?: () => void) => {
    const lbl = h('span', {}, '');
    const refresh = () => { lbl.textContent = app.meta[key] === false ? 'OFF' : 'ON'; };
    refresh();
    return h('div', { class: 'settings-row' }, h('span', {}, label), h('div', { style: 'display:flex;gap:8px;align-items:center' }, btn('‹', () => { app.meta[key] = app.meta[key] === false; app.saveMeta(); refresh(); onChange?.(); }), lbl, btn('›', () => { app.meta[key] = app.meta[key] === false; app.saveMeta(); refresh(); onChange?.(); })));
  };
  const el = h('div', { class: 'screen transparent' },
    h('h2', { class: 'screen-title' }, 'SETTINGS'),
    h('div', { style: 'margin:20px 0' },
      h('div', { class: 'settings-row' }, h('span', {}, 'Volume'), vol),
      toggle('Menu music', 'music', () => { if (app.meta.music === false) sfx.stopMusic(); else sfx.startMusic(); }),
      toggle('Cinematics (intro, replays)', 'cinematics'),
      toggle('Screen shake', 'screenShake'),
      toggle('Hit flash / zoom fx', 'hitFx', () => app.applyQualityPref()),
      cycle('Colorblind palette', ['off', 'deuteranopia', 'protanopia', 'tritanopia'] as const, () => app.meta.colorblind ?? 'off', (v) => { app.meta.colorblind = v; }),
      cycle('Name tags', ['all', 'controlled', 'off'] as const, () => app.meta.nameTags ?? 'all', (v) => { app.meta.nameTags = v; }),
      cycle('HUD text size', [1, 1.25, 1.5] as const, () => (app.meta.textScale ?? 1) as 1 | 1.25 | 1.5, (v) => { app.meta.textScale = v; app.applyAccessPrefs(); }, (v) => `${Math.round(v * 100)}%`),
      toggleBool('Reduced motion (no shake, flashes, hit fx, crowd)', () => app.meta.reducedMotion === true, (v) => { app.meta.reducedMotion = v; app.applyQualityPref(); }),
      toggleBool('Gamepad rumble', () => app.meta.rumble !== false, (v) => { app.meta.rumble = v; app.applyAccessPrefs(); }),
      h('div', { class: 'settings-row' }, h('span', {}, 'Key bindings'), btn('Controls…', () => controlsScreen(app))),
      h('div', { class: 'settings-row' }, h('span', {}, 'Quality'), h('div', { style: 'display:flex;gap:8px;align-items:center' }, btn('‹', () => cycleQ(-1)), qLbl, btn('›', () => cycleQ(1)))),
      h('div', { class: 'settings-row' }, h('span', {}, 'Move'), h('span', { html: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / Left stick' })),
      h('div', { class: 'settings-row' }, h('span', {}, 'Turbo'), h('span', { html: '<kbd>SHIFT</kbd> / RT' })),
      h('div', { class: 'settings-row' }, h('span', {}, 'Pass · Switch'), h('span', { html: '<kbd>J</kbd> / A' })),
      h('div', { class: 'settings-row' }, h('span', {}, 'Shoot (hold) · Check'), h('span', { html: '<kbd>K</kbd> / B' })),
      h('div', { class: 'settings-row' }, h('span', {}, 'Special move'), h('span', { html: '<kbd>SPACE</kbd> / Y' })),
      h('div', { class: 'settings-row' }, h('span', {}, 'Aim shot'), h('span', { html: '<kbd>↑</kbd><kbd>↓</kbd> / Right stick / Mouse' })),
      h('div', { class: 'settings-row' }, h('span', {}, 'Saucer · Pull goalie'), h('span', { html: 'Hold <kbd>J</kbd> short / 1s (last 2:00)' })),
      h('div', { class: 'settings-row' }, h('span', {}, 'Fight'), h('span', { html: '<kbd>K</kbd> high · <kbd>L</kbd> low · <kbd>J</kbd> block · mash <kbd>K</kbd>' })),
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
