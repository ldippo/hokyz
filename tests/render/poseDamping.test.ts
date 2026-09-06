import { describe, expect, it } from 'vitest';
import { poseBlend } from '../../src/render/poseDamping';

describe('player pose damping', () => {
  it.each([6, 8, 10, 12, 14])('preserves 60Hz response and elapsed-time composition at rate %i', rate => {
    expect(poseBlend(rate, 1 / 60)).toBeCloseTo(rate / 60, 14);
    const settle = (steps: number) => {
      let value = 0;
      for (let i = 0; i < steps; i++) value += (1 - value) * poseBlend(rate, 0.1 / steps);
      return value;
    };
    for (const steps of [1, 3, 6, 12, 24]) expect(settle(steps)).toBeCloseTo(settle(6), 14);
    const a = poseBlend(rate, .023), b = poseBlend(rate, .077);
    expect(a + (1 - a) * b).toBeCloseTo(poseBlend(rate, .1), 14);
  });
  it('does not advance on a paused redraw or overshoot after a long frame', () => {
    expect(poseBlend(14, 0)).toBe(0);
    expect(poseBlend(14, -1)).toBe(0);
    expect(poseBlend(14, 1)).toBeGreaterThan(0);
    expect(poseBlend(14, 1)).toBeLessThanOrEqual(1);
    expect(poseBlend(0, 1)).toBe(0);
  });
});
