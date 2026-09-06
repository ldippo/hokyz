import { Rng } from '../core/rng';
import { EMPTY_INPUT, type Input, type Skater } from './types';

/** Challenge-local randomness, independent of rendering and the match RNG. */
export class HitParadeDummies {
  private rng: Rng;
  private wander = new Map<string, { x: number; y: number; until: number }>();
  private inputs = new Map<string, Input>();
  private lastTime = -Infinity;

  constructor(seed: number) { this.rng = new Rng(seed); }

  update(time: number, dummies: readonly Pick<Skater, 'id' | 'pos'>[]): ReadonlyMap<string, Input> {
    // Re-rendering or pausing at the same sim time cannot consume randomness.
    if (time <= this.lastTime) return this.inputs;
    this.lastTime = time;
    this.inputs.clear();
    for (const dummy of dummies) {
      let target = this.wander.get(dummy.id);
      if (!target || time > target.until || Math.abs(dummy.pos.x) > 18 || Math.abs(dummy.pos.y) > 9) {
        target = { x: this.rng.range(-15, 15), y: this.rng.range(-7, 7), until: time + this.rng.range(1.5, 3.5) };
        this.wander.set(dummy.id, target);
      }
      this.inputs.set(dummy.id, { ...EMPTY_INPUT,
        move: { x: target.x - dummy.pos.x, y: target.y - dummy.pos.y },
        aim: { x: 0, y: 0 }, turbo: this.rng.chance(0.3),
      });
    }
    return this.inputs;
  }
}
