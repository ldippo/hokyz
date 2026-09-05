import { describe, expect, it } from 'vitest';
import { awayColorFor, colorDistance, lanePalette, simulate, COLLISION_THRESHOLD } from '../../src/ui/colors';
import { labelForCode, DEFAULT_KEYS } from '../../src/core/input';

describe('colorblind-safe colors', () => {
  it('red vs green collapse under deuteranopia and the away color gets swapped', () => {
    const home = '#d8262f',
      away = '#2fa84f';
    expect(colorDistance(home, away, 'off')).toBeGreaterThan(COLLISION_THRESHOLD);
    expect(colorDistance(home, away, 'deuteranopia')).toBeLessThan(colorDistance(home, away, 'off'));
    const swapped = awayColorFor(home, away, 'deuteranopia');
    expect(swapped).not.toBe(away);
    expect(colorDistance(home, swapped, 'deuteranopia')).toBeGreaterThanOrEqual(COLLISION_THRESHOLD);
  });
  it('distinct colors stay untouched; palettes differ by mode', () => {
    expect(awayColorFor('#2f6bff', '#ffd23f', 'protanopia')).toBe('#ffd23f');
    expect(awayColorFor('#2f6bff', '#ff2d3a', 'off')).toBe('#ff2d3a');
    expect(lanePalette('off')).not.toEqual(lanePalette('deuteranopia'));
    expect(simulate('#ffffff', 'tritanopia').every((c) => c > 200)).toBe(true);
  });
});

describe('key labels', () => {
  it('pretty-prints codes and defaults cover every remappable action', () => {
    expect(labelForCode('KeyJ')).toBe('J');
    expect(labelForCode('ArrowUp')).toBe('↑');
    expect(labelForCode('ShiftLeft')).toBe('SHIFT');
    expect(labelForCode('Space')).toBe('SPACE');
    const actions = new Set(Object.values(DEFAULT_KEYS));
    for (const a of ['up', 'down', 'left', 'right', 'turbo', 'pass', 'shoot', 'deke', 'special', 'aimUp', 'aimDown', 'pause']) expect(actions.has(a as never)).toBe(true);
  });
});
