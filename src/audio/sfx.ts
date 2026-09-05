/** Procedural Web Audio SFX. No assets. */
export class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  volume = 0.7;
  private noiseBuf: AudioBuffer | null = null;
  private crowdNode: AudioBufferSourceNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private crowdTarget = 0.12;

  init(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  resume(): void {
    this.init();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }
  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  private noise(dur: number, gain: number, filterHz: number, q = 1, type: BiquadFilterType = 'bandpass', attack = 0.005): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterHz;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }
  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'square', slideTo?: number, attack = 0.005): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  slapshot(power: number): void {
    this.noise(0.12 + power * 0.1, 0.5 + power * 0.4, 1800, 0.8);
    this.tone(180, 0.08, 0.25, 'triangle', 60);
  }
  pass(): void {
    this.noise(0.08, 0.3, 2400, 1.2);
  }
  hit(big: boolean): void {
    this.noise(big ? 0.35 : 0.18, big ? 1.1 : 0.5, big ? 300 : 500, 0.7, 'lowpass');
    this.tone(big ? 90 : 120, big ? 0.3 : 0.15, big ? 0.6 : 0.3, 'sine', 30);
    if (big) this.noise(0.5, 0.35, 4000, 0.5, 'highpass', 0.02);
  }
  boards(speed: number): void {
    const g = Math.min(0.7, speed / 20);
    this.noise(0.2, g, 700, 0.8, 'lowpass');
    this.tone(140, 0.12, g * 0.5, 'triangle', 80);
  }
  post(): void {
    this.tone(1400, 0.4, 0.5, 'sine', 1200);
    this.tone(2100, 0.25, 0.25, 'sine');
  }
  save(): void {
    this.noise(0.15, 0.45, 900, 0.9, 'lowpass');
  }
  goal(): void {
    // arena horn
    const f = 196;
    for (const [mul, gain] of [
      [1, 0.5],
      [1.5, 0.3],
      [2, 0.2],
      [3.01, 0.08],
    ]) {
      this.tone(f * mul, 1.6, gain, 'sawtooth', undefined, 0.05);
    }
    this.noise(1.2, 0.2, 400, 0.5, 'lowpass', 0.3);
    this.crowdBurst(1);
  }
  onFire(): void {
    this.tone(220, 0.5, 0.4, 'sawtooth', 880, 0.02);
    this.noise(0.6, 0.4, 3000, 0.6, 'highpass', 0.1);
    this.crowdBurst(0.6);
  }
  whistle(): void {
    this.tone(2400, 0.35, 0.35, 'square', 2600, 0.01);
    this.tone(2400 * 1.02, 0.35, 0.2, 'square', 2600, 0.01);
  }
  turbo(on: boolean): void {
    if (on) this.tone(300, 0.2, 0.15, 'sawtooth', 700, 0.01);
    else this.tone(500, 0.12, 0.08, 'sawtooth', 250, 0.01);
  }
  knockdown(): void {
    this.noise(0.25, 0.4, 250, 0.7, 'lowpass');
  }
  ui(): void {
    this.tone(880, 0.06, 0.15, 'square');
  }
  uiConfirm(): void {
    this.tone(660, 0.08, 0.2, 'square', 990);
  }
  uiBack(): void {
    this.tone(500, 0.1, 0.15, 'square', 300);
  }
  faceoffDrop(): void {
    this.noise(0.06, 0.4, 2000, 1);
  }
  cash(): void {
    this.tone(1320, 0.12, 0.2, 'triangle', 1760);
  }
  countdownBeep(final: boolean): void {
    this.tone(final ? 1200 : 700, final ? 0.3 : 0.1, 0.2, 'square');
  }

  /** Continuous crowd bed */
  startCrowd(): void {
    if (!this.ctx || !this.master || !this.noiseBuf || this.crowdNode) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 500;
    f.Q.value = 0.4;
    const g = this.ctx.createGain();
    g.gain.value = 0.12;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    this.crowdNode = src;
    this.crowdGain = g;
    this.crowdFilter = f;
  }
  stopCrowd(): void {
    this.crowdNode?.stop();
    this.crowdNode = null;
  }
  crowdBurst(intensity: number): void {
    if (!this.ctx || !this.crowdGain || !this.crowdFilter) return;
    const t = this.ctx.currentTime;
    this.crowdGain.gain.cancelScheduledValues(t);
    this.crowdGain.gain.setValueAtTime(this.crowdGain.gain.value, t);
    this.crowdGain.gain.linearRampToValueAtTime(0.12 + 0.55 * intensity, t + 0.15);
    this.crowdGain.gain.exponentialRampToValueAtTime(this.crowdTarget, t + 2.5 + intensity * 2);
    this.crowdFilter.frequency.setValueAtTime(500 + 900 * intensity, t);
    this.crowdFilter.frequency.exponentialRampToValueAtTime(500, t + 3);
  }
  setCrowdBase(v: number): void {
    this.crowdTarget = v;
  }
}

export const sfx = new Sfx();
