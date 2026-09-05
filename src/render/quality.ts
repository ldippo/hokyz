/** Quality tiers, GPU probe, frame-time watchdog, perf overlay. */
export type Tier = 'low' | 'med' | 'high';
export const TIERS: Tier[] = ['low', 'med', 'high'];

export interface TierSettings {
  pixelRatioCap: number;
  shadowMapSize: number;
  bloom: boolean;
  gtao: boolean;
  traa: boolean;
  hitFx: boolean;
  /** future: planar reflection, skate marks */
  reflections: boolean;
  crowdAnim: boolean;
}

export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  low: { pixelRatioCap: 1, shadowMapSize: 1024, bloom: false, gtao: false, traa: false, hitFx: false, reflections: false, crowdAnim: false },
  med: { pixelRatioCap: 1.5, shadowMapSize: 2048, bloom: true, gtao: false, traa: false, hitFx: true, reflections: false, crowdAnim: true },
  high: { pixelRatioCap: 2, shadowMapSize: 2048, bloom: true, gtao: true, traa: true, hitFx: true, reflections: true, crowdAnim: true },
};

const WEAK_GPU = /intel|iris|uhd|hd graphics|adreno|mali|powervr|apple gpu|apple m1|swiftshader|llvmpipe|software|mesa|virtio|basic render/i;
const STRONG_GPU = /nvidia|geforce|rtx|radeon rx|radeon pro|arc a|apple m[2-9]|apple m1 (pro|max|ultra)/i;

export interface GpuInfo {
  backend: 'webgpu' | 'webgl';
  description: string;
}

/** Pick a starting tier from adapter description + backend. */
export function probeTier(info: GpuInfo): Tier {
  const d = info.description;
  if (STRONG_GPU.test(d)) return 'high';
  if (WEAK_GPU.test(d)) return info.backend === 'webgpu' ? 'med' : 'low';
  if ((navigator.hardwareConcurrency ?? 8) <= 4) return 'low';
  return info.backend === 'webgpu' ? 'high' : 'med';
}

/** Rolling frame-time watchdog. Steps a tier down when sustained above target. */
export class Watchdog {
  private samples: number[] = [];
  private accum = 0;
  private cooldown = 0;
  /** ms per frame considered too slow (30 fps = 33ms; use 36 for hysteresis) */
  targetMs = 36;
  windowSec = 3;
  constructor(public onStepDown: (from: Tier) => void) {}
  reset(): void {
    this.samples = [];
    this.accum = 0;
    this.cooldown = 4; // grace after a change
  }
  push(dtSec: number, tier: Tier): void {
    if (this.cooldown > 0) {
      this.cooldown -= dtSec;
      return;
    }
    this.samples.push(dtSec * 1000);
    this.accum += dtSec;
    if (this.accum >= this.windowSec) {
      const sorted = [...this.samples].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      this.samples = [];
      this.accum = 0;
      if (median > this.targetMs && tier !== 'low') {
        this.onStepDown(tier);
        this.reset();
      }
    }
  }
}

export class PerfProbe {
  el: HTMLElement | null = null;
  private frames = 0;
  private t = 0;
  private worst = 0;
  fps = 0;
  ms = 0;
  enabled = false;
  constructor(parent: HTMLElement) {
    this.enabled = new URLSearchParams(location.search).has('perf');
    if (!this.enabled) return;
    this.el = document.createElement('div');
    this.el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;font:12px monospace;color:#0f0;background:rgba(0,0,0,.6);padding:4px 8px;pointer-events:none;white-space:pre';
    parent.appendChild(this.el);
  }
  push(dt: number, info: string): void {
    if (!this.enabled) return;
    this.frames++;
    this.t += dt;
    this.worst = Math.max(this.worst, dt * 1000);
    if (this.t >= 1) {
      this.fps = this.frames / this.t;
      this.ms = (this.t / this.frames) * 1000;
      const line = `${this.fps.toFixed(0)} fps  ${this.ms.toFixed(1)} ms  worst ${this.worst.toFixed(0)} ms  ${info}`;
      if (this.el) this.el.textContent = line;
      console.log('[perf]', line);
      this.frames = 0;
      this.t = 0;
      this.worst = 0;
    }
  }
}
