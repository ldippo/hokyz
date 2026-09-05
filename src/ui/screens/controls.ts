import type { App } from '../../app';
import { btn, h } from '../dom';
import { settingsScreen } from './settings';
import { REMAPPABLE, type Action } from '../../core/input';
import { sfx } from '../../audio/sfx';

/** Key remapping: click a row, press a key. Escape cancels. */
export function controlsScreen(app: App): void {
  let waiting: Action | null = null;
  const render = () => {
    const rows = REMAPPABLE.map((r) => {
      const isWaiting = waiting === r.action;
      const key = h('span', { class: isWaiting ? 'rebind-wait' : '' }, isWaiting ? 'PRESS A KEY…' : app.input.label(r.action));
      return h('div', { class: 'settings-row' }, h('span', {}, r.label), h('div', { style: 'display:flex;gap:10px;align-items:center' }, h('kbd', { style: 'font-size:16px;padding:4px 10px' }, key), btn('Rebind', () => {
        waiting = r.action;
        render();
        app.input.capture = (code) => {
          if (code !== 'Escape') {
            app.input.bind(code, r.action);
            app.meta.keymap = { ...app.input.keymap };
            app.saveMeta();
            sfx.uiConfirm();
          } else sfx.uiBack();
          waiting = null;
          render();
        };
      })));
    });
    const el = h('div', { class: 'screen transparent', style: 'overflow:auto;justify-content:flex-start;padding:24px 0' },
      h('h2', { class: 'screen-title' }, 'CONTROLS'),
      h('p', { class: 'screen-sub' }, 'Keyboard bindings. Gamepad uses the standard layout. Prompts in-game follow your bindings.'),
      h('div', { style: 'margin:12px 0' }, ...rows),
      h('div', { class: 'menu', style: 'flex-direction:row' },
        btn('Reset to defaults', () => { app.input.resetKeys(); app.meta.keymap = null; app.saveMeta(); render(); }),
        btn('Back', () => { app.input.capture = null; settingsScreen(app); }, 'primary'),
      ),
    );
    app.showScreen(el, false); // no keyboard nav: keys are being captured
  };
  render();
}
