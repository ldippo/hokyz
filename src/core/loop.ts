import { SIM_DT } from '../sim/constants';

export interface LoopHooks {
  /** fixed-step update; return false to stop */
  simStep: () => void;
  /** render with interpolation alpha in [0,1) */
  render: (alpha: number, dtRender: number) => void;
}

export class GameLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;
  running = false;
  speed = 1;
  maxStepsPerFrame = 5;
  constructor(private hooks: LoopHooks) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25;
      this.acc += dt * this.speed;
      let steps = 0;
      while (this.acc >= SIM_DT && steps < this.maxStepsPerFrame) {
        this.hooks.simStep();
        this.acc -= SIM_DT;
        steps++;
      }
      if (steps === this.maxStepsPerFrame) this.acc = 0;
      this.hooks.render(this.acc / SIM_DT, dt);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
