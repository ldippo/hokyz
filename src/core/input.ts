import type { Input } from '../sim/types';

export type Action = 'up' | 'down' | 'left' | 'right' | 'turbo' | 'pass' | 'shoot' | 'deke' | 'pause' | 'confirm' | 'back';

const DEFAULT_KEYS: Record<string, Action> = {
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ShiftLeft: 'turbo',
  ShiftRight: 'turbo',
  KeyJ: 'pass',
  KeyK: 'shoot',
  KeyL: 'deke',
  Space: 'shoot',
  Enter: 'confirm',
  Escape: 'back',
  KeyP: 'pause',
};

/** Standard gamepad button indexes */
const PAD_BUTTONS: Record<number, Action> = {
  0: 'pass', // A
  1: 'shoot', // B
  2: 'deke', // X
  3: 'turbo', // Y (alt)
  5: 'turbo', // RB
  7: 'turbo', // RT
  9: 'pause',
  12: 'up',
  13: 'down',
  14: 'left',
  15: 'right',
};

export class InputManager {
  private held = new Set<Action>();
  private prevHeld = new Set<Action>();
  private keyHeld = new Set<Action>();
  private pressedThisFrame = new Set<Action>();
  private padAxes = { x: 0, y: 0 };
  keymap: Record<string, Action> = { ...DEFAULT_KEYS };
  gamepadIndex: number | null = null;
  /** Called on any key/button press (for "press any key" screens). */
  onAnyPress: (() => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      const a = this.keymap[e.code];
      if (a) {
        if (!this.keyHeld.has(a)) this.pressedThisFrame.add(a);
        this.keyHeld.add(a);
        e.preventDefault();
        this.onAnyPress?.();
      }
    });
    window.addEventListener('keyup', (e) => {
      const a = this.keymap[e.code];
      if (a) this.keyHeld.delete(a);
    });
    window.addEventListener('blur', () => this.keyHeld.clear());
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
    });
  }

  /** Poll gamepad and compute held set. Call once per render frame BEFORE consuming inputs. */
  poll(): void {
    this.prevHeld = new Set(this.held);
    this.held = new Set(this.keyHeld);
    this.padAxes.x = 0;
    this.padAxes.y = 0;
    const pads = navigator.getGamepads?.() ?? [];
    let pad: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) pad = pad ?? p;
    if (pad) {
      const dz = 0.2;
      const ax = pad.axes[0] ?? 0,
        ay = pad.axes[1] ?? 0;
      if (Math.hypot(ax, ay) > dz) {
        this.padAxes.x = ax;
        this.padAxes.y = ay;
      }
      pad.buttons.forEach((b, i) => {
        const a = PAD_BUTTONS[i];
        if (a && (b.pressed || b.value > 0.5)) this.held.add(a);
      });
      if (this.held.size > 0 && this.onAnyPress) {
        for (const a of this.held) if (!this.prevHeld.has(a)) this.onAnyPress();
      }
    }
    for (const a of this.pressedThisFrame) this.held.add(a);
    this.pressedThisFrame.clear();
  }

  isHeld(a: Action): boolean {
    return this.held.has(a);
  }
  justPressed(a: Action): boolean {
    return this.held.has(a) && !this.prevHeld.has(a);
  }
  justReleased(a: Action): boolean {
    return !this.held.has(a) && this.prevHeld.has(a);
  }

  /** Build sim input. Sim x = screen right, sim y = screen down (toward camera). */
  simInput(): Input {
    let x = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
    let y = (this.held.has('down') ? 1 : 0) - (this.held.has('up') ? 1 : 0);
    if (this.padAxes.x !== 0 || this.padAxes.y !== 0) {
      x = this.padAxes.x;
      y = this.padAxes.y;
    }
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return {
      move: { x, y },
      turbo: this.held.has('turbo'),
      pass: this.justPressed('pass'),
      shoot: this.held.has('shoot'),
      shootRelease: this.justReleased('shoot'),
      check: this.justPressed('shoot'),
      deke: this.justPressed('deke'),
    };
  }
}
