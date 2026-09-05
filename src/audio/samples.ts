/** Sample bank: decoded ogg buffers played through the shared AudioContext. */
export class SampleBank {
  private buffers = new Map<string, AudioBuffer>();
  private loading: Promise<void> | null = null;
  constructor(private ctx: AudioContext, private master: GainNode, private base = '/audio/') {}

  load(names: string[]): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = Promise.all(
      names.map(async (n) => {
        try {
          const res = await fetch(`${this.base}${n}.ogg`);
          if (!res.ok) return;
          const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
          this.buffers.set(n, buf);
        } catch {
          /* missing sample: synth fallback stays */
        }
      }),
    ).then(() => undefined);
    return this.loading;
  }
  has(name: string): boolean {
    return this.buffers.has(name);
  }

  play(name: string, opts: { gain?: number; rate?: number; detune?: number; pan?: number } = {}): AudioBufferSourceNode | null {
    const b = this.buffers.get(name);
    if (!b) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = opts.rate ?? 1;
    if (opts.detune) src.detune.value = opts.detune;
    const g = this.ctx.createGain();
    g.gain.value = opts.gain ?? 1;
    let node: AudioNode = g;
    if (opts.pan !== undefined && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      g.connect(p);
      node = p;
    }
    src.connect(g);
    node.connect(this.master);
    src.start();
    return src;
  }

  /** Looping source with its own gain for crossfades. */
  loop(name: string, gain = 0): { src: AudioBufferSourceNode; gain: GainNode } | null {
    const b = this.buffers.get(name);
    if (!b) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = b;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    src.start();
    return { src, gain: g };
  }
}
