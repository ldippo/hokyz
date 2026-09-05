import type { Input } from '../sim/types';

export type Action = 'up' | 'down' | 'left' | 'right' | 'aimUp' | 'aimDown' | 'aimLeft' | 'aimRight' | 'turbo' | 'pass' | 'shoot' | 'deke' | 'special' | 'pause' | 'confirm' | 'back';

export const REMAPPABLE: { action: Action; label: string }[] = [
  { action: 'up', label: 'Move up' },
  { action: 'down', label: 'Move down' },
  { action: 'left', label: 'Move left' },
  { action: 'right', label: 'Move right' },
  { action: 'turbo', label: 'Turbo' },
  { action: 'pass', label: 'Pass / switch / block' },
  { action: 'shoot', label: 'Shoot / check / high' },
  { action: 'deke', label: 'Deke / low' },
  { action: 'special', label: 'Special move' },
  { action: 'aimUp', label: 'Aim far post' },
  { action: 'aimDown', label: 'Aim near post' },
  { action: 'pause', label: 'Pause' },
];

/** Pretty name for a KeyboardEvent.code. */
export function labelForCode(code: string): string {
  const map: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ShiftLeft: 'SHIFT', ShiftRight: 'R-SHIFT', Space: 'SPACE', Escape: 'ESC', Enter: 'ENTER', ControlLeft: 'CTRL', ControlRight: 'R-CTRL', AltLeft: 'ALT', Tab: 'TAB', Backspace: 'BKSP' };
  if (map[code]) return map[code];
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'NUM ');
}

export const DEFAULT_KEYS: Record<string, Action> = {
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  ArrowUp: 'aimUp',
  ArrowDown: 'aimDown',
  ArrowLeft: 'aimLeft',
  ArrowRight: 'aimRight',
  ShiftLeft: 'turbo',
  ShiftRight: 'turbo',
  KeyJ: 'pass',
  KeyK: 'shoot',
  KeyL: 'deke',
  Space: 'special',
  KeyI: 'special',
  Enter: 'confirm',
  Escape: 'back',
  KeyP: 'pause',
};

/** Standard gamepad button indexes */
const PAD_BUTTONS: Record<number, Action> = {
  0: 'pass', // A
  1: 'shoot', // B
  2: 'deke', // X
  3: 'special', // Y
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
  private padAim = { x: 0, y: 0 };
  private mouseAim = { x: 0, y: 0, t: 0 };
  private passHoldStart = -1;
  private passHoldAtRelease = 0;
  keymap: Record<string, Action> = { ...DEFAULT_KEYS };
  gamepadIndex: number | null = null;
  /** Called on any key/button press (for "press any key" screens). */
  onAnyPress: (() => void) | null = null;
  /** when set, the next keydown is captured for rebinding instead of played */
  capture: ((code: string) => void) | null = null;
  rumbleEnabled = true;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (this.capture) {
        e.preventDefault();
        const cb = this.capture;
        this.capture = null;
        cb(e.code);
        return;
      }
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
    window.addEventListener('mousemove', (e) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      this.mouseAim = { x: nx, y: ny, t: performance.now() };
    });
  }

  /** Poll gamepad and compute held set. Call once per render frame BEFORE consuming inputs. */
  poll(): void {
    this.prevHeld = new Set(this.held);
    this.held = new Set(this.keyHeld);
    this.padAxes.x = 0;
    this.padAxes.y = 0;
    this.padAim.x = 0;
    this.padAim.y = 0;
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
      const rx = pad.axes[2] ?? 0,
        ry = pad.axes[3] ?? 0;
      if (Math.hypot(rx, ry) > dz) {
        this.padAim.x = rx;
        this.padAim.y = ry;
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
    // pass hold tracking
    const now = performance.now();
    if (this.held.has('pass') && !this.prevHeld.has('pass')) this.passHoldStart = now;
    if (!this.held.has('pass') && this.prevHeld.has('pass')) {
      this.passHoldAtRelease = this.passHoldStart >= 0 ? (now - this.passHoldStart) / 1000 : 0;
      this.passHoldStart = -1;
    }
  }
  get passHoldTime(): number {
    if (this.held.has('pass') && this.passHoldStart >= 0) return (performance.now() - this.passHoldStart) / 1000;
    return this.passHoldAtRelease;
  }

  /** Human-readable key for an action (first bound key). */
  label(a: Action): string {
    const code = Object.keys(this.keymap).find((k) => this.keymap[k] === a);
    return code ? labelForCode(code) : '?';
  }
  /** Replace {action} tokens with the bound key. */
  fill(text: string): string {
    return text.replace(/\{(\w+)\}/g, (_, a: string) => this.label(a as Action));
  }
  /** Rebind: remove other keys for the action, keep one binding per action. */
  bind(code: string, a: Action): void {
    for (const k of Object.keys(this.keymap)) if (this.keymap[k] === a) delete this.keymap[k];
    this.keymap[code] = a;
  }
  resetKeys(): void {
    this.keymap = { ...DEFAULT_KEYS };
  }
  /** Gamepad rumble (no-op without a pad or when disabled). */
  rumble(strong: number, weak: number, ms: number): void {
    if (!this.rumbleEnabled) return;
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      const act = (p as Gamepad & { vibrationActuator?: { playEffect?: (t: string, o: object) => Promise<unknown> } })?.vibrationActuator;
      if (act?.playEffect) void act.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => undefined);
    }
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
    let ax = (this.held.has('aimRight') ? 1 : 0) - (this.held.has('aimLeft') ? 1 : 0);
    let ay = (this.held.has('aimDown') ? 1 : 0) - (this.held.has('aimUp') ? 1 : 0);
    if (this.padAim.x !== 0 || this.padAim.y !== 0) {
      ax = this.padAim.x;
      ay = this.padAim.y;
    } else if (ax === 0 && ay === 0 && performance.now() - this.mouseAim.t < 1500) {
      ax = this.mouseAim.x;
      ay = this.mouseAim.y;
    }
    return {
      move: { x, y },
      aim: { x: ax, y: ay },
      turbo: this.held.has('turbo'),
      pass: this.justReleased('pass'),
      passHeld: this.held.has('pass'),
      passHoldTime: this.passHoldTime,
      shoot: this.held.has('shoot'),
      shootRelease: this.justReleased('shoot'),
      check: this.justPressed('shoot'),
      deke: this.justPressed('deke'),
      special: this.justPressed('special'),
    };
  }
}
