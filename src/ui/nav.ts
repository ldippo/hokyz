import type { InputManager } from '../core/input';
import { sfx } from '../audio/sfx';

/** Keyboard/gamepad focus navigation over [data-nav] elements in a screen. */
export class Nav {
  private idx = -1;
  onBack: (() => void) | null = null;
  constructor(private root: HTMLElement) {
    root.addEventListener('mouseover', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
      if (t) this.setFocus(this.items().indexOf(t), false);
    });
  }
  items(): HTMLElement[] {
    return Array.from(this.root.querySelectorAll<HTMLElement>('[data-nav]')).filter((e) => !(e as HTMLButtonElement).disabled && e.offsetParent !== null);
  }
  setFocus(i: number, sound = true): void {
    const items = this.items();
    if (!items.length) return;
    this.idx = ((i % items.length) + items.length) % items.length;
    items.forEach((e, k) => e.classList.toggle('focus', k === this.idx));
    if (sound) sfx.ui();
    items[this.idx].scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  focusFirst(): void {
    const items = this.items();
    const primary = items.findIndex((e) => e.classList.contains('primary') || e.classList.contains('available'));
    this.setFocus(primary >= 0 ? primary : 0, false);
  }
  update(input: InputManager): void {
    const items = this.items();
    if (!items.length) return;
    if (this.idx < 0 || this.idx >= items.length) this.idx = 0;
    const horizontal = this.root.dataset.navDir === 'h' || items[0].closest('.cards, .unlock-grid, .map') !== null;
    const next = horizontal ? input.justPressed('right') || input.justPressed('down') : input.justPressed('down') || input.justPressed('right');
    const prev = horizontal ? input.justPressed('left') || input.justPressed('up') : input.justPressed('up') || input.justPressed('left');
    if (next) this.setFocus(this.idx + 1);
    else if (prev) this.setFocus(this.idx - 1);
    if (input.justPressed('confirm') || input.justPressed('pass')) {
      const el = items[this.idx];
      if (el) {
        sfx.uiConfirm();
        el.click();
      }
    }
    if (input.justPressed('back') || input.justPressed('shoot')) {
      if (this.onBack) {
        sfx.uiBack();
        this.onBack();
      }
    }
  }
}
