import type { App } from '../../app';
import { btn, h } from '../dom';
import type { MapNode } from '../../run/mapGen';
import { completeNode, runRng, commitRng } from '../../run/runState';
import { EVENTS } from '../../run/events';
import { runMapScreen, topBar, rosterPanel } from './runMap';

export function eventScreen(app: App, node: MapNode): void {
  const run = app.run!;
  const ev = EVENTS.find((e) => e.id === node.eventId) ?? EVENTS[0];
  const box = h('div', { class: 'event-box' },
    h('h2', { class: 'screen-title', style: 'font-size:40px' }, `${ev.icon} ${ev.title}`),
    h('p', {}, ev.text),
    h('div', { class: 'choices' }, ...ev.choices.map((c) => {
      const disabled = c.disabled?.(run) ?? false;
      const b = btn(c.label, () => {
        if (disabled) return;
        const rng = runRng(run);
        const result = c.effect(run, rng);
        commitRng(run, rng);
        run.cash = Math.max(0, run.cash);
        completeNode(run, node);
        app.saveRun();
        box.innerHTML = '';
        box.append(h('h2', { class: 'screen-title', style: 'font-size:40px' }, `${ev.icon} ${ev.title}`), h('p', {}, result), h('div', { class: 'choices' }, btn('Continue', () => runMapScreen(app), 'primary')));
        app.nav?.focusFirst();
      });
      b.appendChild(h('small', {}, c.detail));
      if (disabled) {
        b.disabled = true;
        b.removeAttribute('data-nav');
      }
      return b;
    })),
  );
  const el = h('div', { class: 'run-shell' }, topBar(app, run), h('div', { class: 'run-body' }, h('div', { class: 'map-scroll', style: 'display:flex;align-items:center;justify-content:center' }, box), rosterPanel(run)));
  app.showScreen(el);
}
