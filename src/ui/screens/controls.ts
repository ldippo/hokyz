import type { App } from '../../app';
import { btn, h } from '../dom';
import { settingsScreen } from './settings';
import { REMAPPABLE, type Action } from '../../core/input';
import { sfx } from '../../audio/sfx';

/** Key remapping: click a row, press a key. Escape cancels. */
export function controlsScreen(app: App): void {
  let waiting: Action | null = null;
  let selected = 0;
  const back = () => {
    app.input.capture = null;
    if (waiting) { waiting = null; render(); }
    else settingsScreen(app);
  };
  const render = () => {
    const rows = REMAPPABLE.map((r, index) => {
      const isWaiting = waiting === r.action;
      const key = h('span', { class: isWaiting ? 'rebind-wait' : '' }, isWaiting ? 'PRESS A KEY…' : app.input.label(r.action));
      return h('div', { class: 'settings-row' }, h('span', {}, r.label), h('div', { class: 'binding-action' }, h('kbd', {}, key), btn('Rebind', () => {
        selected = index;
        waiting = r.action;
        render();
        app.input.capture = (code) => {
          if (code !== 'Escape') {
            if (!app.input.bind(code, r.action)) {
              app.toast('That key is reserved for menu navigation. Choose another key.');
              waiting = null;
              render();
              return;
            }
            app.meta.keymap = { ...app.input.keymap };
            app.saveMeta();
            sfx.uiConfirm();
          } else sfx.uiBack();
          waiting = null;
          render();
        };
      })));
    });
    const el = h('div', { class: 'screen controls-screen' },
      h('h2', { class: 'screen-title' }, 'CONTROLS'),
      h('p', { class: 'screen-sub' }, 'Choose a key. Occupied gameplay keys swap bindings; Enter stays available for menus. Escape cancels. Gamepad uses the standard layout.'),
      h('div', { class: 'bindings-list' }, ...rows),
      h('div', { class: 'menu' },
        btn('Reset to defaults', () => { app.input.capture = null; waiting = null; selected = REMAPPABLE.length; app.input.resetKeys(); app.meta.keymap = null; app.saveMeta(); render(); }),
        btn('Back', back, 'primary'),
      ),
    );
    const nav = app.showScreen(el);
    if (nav) { nav.setFocus(selected, false); nav.onBack = back; }
  };
  render();
}
