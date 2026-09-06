import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_KEYS, InputManager } from '../../src/core/input';

afterEach(() => vi.unstubAllGlobals());
const input = () => {
  vi.stubGlobal('window', { addEventListener: vi.fn() });
  return new InputManager();
};
describe('safe key remapping', () => {
  it('swaps occupied gameplay keys without leaving either action unbound', () => {
    const manager = input();
    expect(manager.bind('KeyK', 'pass')).toBe(true);
    expect(manager.keymap.KeyK).toBe('pass');
    expect(manager.keymap.KeyJ).toBe('shoot');
    expect(new Set(Object.values(manager.keymap))).toEqual(new Set(Object.values(DEFAULT_KEYS)));
  });
  it.each(['Enter', 'Escape'])('does not steal %s from menu navigation', key => {
    const manager = input();
    expect(manager.bind(key, 'pass')).toBe(false);
    expect(manager.keymap).toEqual(DEFAULT_KEYS);
  });
  it('can bind a free key, keep the same key, and reset defaults', () => {
    const manager = input();
    expect(manager.bind('KeyQ', 'pass')).toBe(true);
    expect(manager.keymap.KeyJ).toBeUndefined();
    expect(manager.bind('KeyQ', 'pass')).toBe(true);
    manager.resetKeys();
    expect(manager.keymap).toEqual(DEFAULT_KEYS);
  });
});
