import { SceneRig } from './render/scene';
import { InputManager } from './core/input';
import { GameLoop } from './core/loop';
import { MatchView } from './render/matchView';
import { MatchSim } from './sim/match';
import { sfx } from './audio/sfx';
import { loadMeta, loadRunRaw, saveMeta, saveRunRaw } from './core/save';
import { RINK_THEMES, type MetaProfile } from './run/meta';
import { deserializeRun, serializeRun, type RunState } from './run/runState';
import { Nav } from './ui/nav';
import { quickTeam } from './sim/fixtures';
import { defaultMatchMods } from './sim/modifiers';
import { RIVALS, buildRivalRoster } from './run/teams';
import { Rng } from './core/rng';
import { PerfProbe, TIERS, Watchdog, probeTier, type Tier } from './render/quality';
import { h } from './ui/dom';
import { loadRigs } from './render/skaterRig';
import { loadRinkTextures } from './render/textures';
import { titleScreen } from './ui/screens/title';
import { setupEnvironment } from './render/environment';

export class App {
  rig: SceneRig;
  input = new InputManager();
  loop: GameLoop;
  ui: HTMLElement;
  meta: MetaProfile;
  run: RunState | null = null;
  view: MatchView | null = null;
  screen: HTMLElement | null = null;
  nav: Nav | null = null;
  /** function called each sim tick while a screen is up (e.g. pause handling) */
  onTick: (() => void) | null = null;
  paused = false;
  humanPlaying = false;
  watchdog: Watchdog;
  perf: PerfProbe;
  assetsReady: Promise<void> = Promise.resolve();
  assetsLoaded = false;
  private toastEl: HTMLElement | null = null;

  private crashCount = 0;
  private crashWindowStart = 0;
  private dead = false;

  /** Global error recovery: log, toast, drop the match view, return to the title. */
  private installErrorRecovery(): void {
    const handle = (msg: string) => {
      const now = performance.now();
      if (now - this.crashWindowStart > 60000) {
        this.crashWindowStart = now;
        this.crashCount = 0;
      }
      this.crashCount++;
      console.error('[recover]', msg);
      if (this.dead) return;
      if (this.crashCount > 3) {
        this.hardError(msg);
        return;
      }
      try {
        this.onTick = null;
        this.paused = false;
        this.loop.speed = 1;
        this.disposeView();
        this.showScreen(null);
        this.saveRun();
        this.toast('Something broke. Back to the title — your run is saved.');
        titleScreen(this);
      } catch (e) {
        this.hardError(String(e));
      }
    };
    window.addEventListener('error', (e) => handle(e.message || String(e.error)));
    window.addEventListener('unhandledrejection', (e) => handle(String((e as PromiseRejectionEvent).reason)));
  }
  private hardError(msg: string): void {
    this.dead = true;
    this.loop.stop();
    try {
      this.disposeView();
    } catch {
      /* ignore */
    }
    this.showScreen(h('div', { class: 'screen' }, h('h2', { class: 'screen-title' }, 'HOKYZ HIT THE BOARDS'), h('p', { class: 'screen-sub' }, 'Repeated errors. Your run and profile are saved.'), h('pre', { style: 'max-width:640px;white-space:pre-wrap;font-size:12px;color:#8fa3d9' }, msg.slice(0, 400)), h('div', { class: 'menu' }, h('button', { class: 'btn primary', 'data-nav': '1', onClick: () => location.reload() }, 'Reload'))));
  }

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.rig = new SceneRig(canvas);
    this.ui = ui;
    this.installErrorRecovery();
    this.meta = loadMeta();
    sfx.setVolume(this.meta.volume);
    this.input.onAnyPress = () => sfx.resume();
    window.addEventListener('pointerdown', () => sfx.resume());
    this.loop = new GameLoop({
      simStep: () => this.simStep(),
      render: (a, dt) => this.render(a, dt),
    });
    this.perf = new PerfProbe(ui);
    this.watchdog = new Watchdog((from) => {
      const next = TIERS[Math.max(0, TIERS.indexOf(from) - 1)];
      this.rig.applyTier(next);
      this.toast(`Quality auto-lowered to ${next.toUpperCase()}`);
    });
    this.rig.hitStopHandler = (frames) => {
      this.loop.freezeFrames = Math.max(this.loop.freezeFrames, frames);
    };
  }

  /** Await renderer backend init, then pick a quality tier. */
  async init(): Promise<void> {
    await this.rig.ready;
    this.applyQualityPref();
    setupEnvironment(this.rig.renderer, this.rig.scene, 0.35);
    // assets stream in behind the title; the attract match re-creates itself when they land
    this.assetsReady = Promise.all([
      loadRigs().catch((e) => console.warn('skater rigs failed to load, using fallback meshes', e)),
      loadRinkTextures(),
    ]).then(() => {
      this.assetsLoaded = true;
      if (this.view && !this.humanPlaying) {
        this.disposeView();
        this.attract();
      }
      document.querySelector('.loading-hint')?.remove();
    });
  }

  /** Accessibility prefs that live outside the renderer. */
  applyAccessPrefs(): void {
    const m = this.meta;
    if (m.keymap) this.input.keymap = { ...m.keymap } as typeof this.input.keymap;
    else this.input.resetKeys();
    this.input.rumbleEnabled = m.rumble !== false;
    document.documentElement.style.setProperty('--ui-scale', String(m.textScale || 1));
    (this.ui.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(m.textScale || 1);
  }

  applyQualityPref(): void {
    const pref = this.meta.quality ?? 'auto';
    const tier: Tier = pref === 'auto' ? probeTier(this.rig.gpu) : pref;
    const reduced = this.meta.reducedMotion === true;
    this.rig.overrides = { ...this.rig.overrides };
    if (this.meta.hitFx === false || reduced) this.rig.overrides.hitFx = false;
    else delete this.rig.overrides.hitFx;
    if (reduced) this.rig.overrides.crowdAnim = false;
    else delete this.rig.overrides.crowdAnim;
    this.applyAccessPrefs();
    this.rig.applyTier(tier);
    this.watchdog.reset();
  }

  toast(text: string): void {
    this.toastEl?.remove();
    this.toastEl = h('div', { class: 'toast' }, text);
    this.ui.appendChild(this.toastEl);
    const el = this.toastEl;
    setTimeout(() => el.remove(), 2600);
  }

  start(): void {
    this.loop.start();
  }

  /** Photo mode: fresh frame, scoreboard strip and watermark composited on a copy of the canvas. */
  photo(): Promise<Blob | null> {
    const src = this.rig.renderer.domElement as HTMLCanvasElement;
    if (this.view) this.view.render(1, 0);
    else this.rig.render(0);
    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const g = out.getContext('2d');
    if (!g) return Promise.resolve(null);
    g.drawImage(src, 0, 0);
    const st = this.view?.sim.st;
    const scale = out.width / 1280;
    if (st) {
      const [a, b] = st.teams;
      const c = Math.max(0, st.clock);
      const clock = `${Math.floor(c / 60)}:${Math.floor(c % 60).toString().padStart(2, '0')}`;
      const per = st.overtime ? 'OT' : st.period === 1 ? '1ST' : st.period === 2 ? '2ND' : st.period === 3 ? '3RD' : `${st.period}TH`;
      const text = `${a.short} ${a.score}   ${clock} ${per}   ${b.score} ${b.short}`;
      g.font = `${Math.round(30 * scale)}px "Bebas Neue", Impact, sans-serif`;
      const w = g.measureText(text).width + 48 * scale;
      const x = (out.width - w) / 2,
        y = 18 * scale,
        hgt = 48 * scale;
      g.fillStyle = 'rgba(8,10,20,0.78)';
      g.fillRect(x, y, w, hgt);
      g.fillStyle = a.color;
      g.fillRect(x, y, 8 * scale, hgt);
      g.fillStyle = b.color;
      g.fillRect(x + w - 8 * scale, y, 8 * scale, hgt);
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, out.width / 2, y + hgt / 2);
    }
    g.font = `${Math.round(22 * scale)}px "Bebas Neue", Impact, sans-serif`;
    g.textAlign = 'right';
    g.textBaseline = 'bottom';
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText('HOKYZ', out.width - 16 * scale, out.height - 12 * scale);
    return new Promise((resolve) => out.toBlob((blob) => resolve(blob), 'image/png'));
  }

  /** Photo mode → download. */
  async snap(): Promise<boolean> {
    const blob = await this.photo();
    if (!blob) return false;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hokyz-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return true;
  }

  private simStep(): void {
    this.input.poll();
    if (this.view && !this.paused) {
      const v = this.view;
      if (v.director.active && v.director.kind !== 'fight' && this.humanPlaying && (this.input.justPressed('confirm') || this.input.justPressed('pass') || this.input.justPressed('shoot') || this.input.justPressed('back'))) {
        v.skipCinematic();
      }
      this.loop.speed = v.timeScale;
      if (!v.holdSim) {
        const hi = this.humanPlaying ? this.input.simInput() : null;
        v.humanInput = hi;
        const ev = v.sim.step(hi ? { 0: hi } : {});
        v.afterStep(ev);
      }
    }
    this.nav?.update(this.input);
    this.onTick?.();
  }

  private render(alpha: number, dt: number): void {
    if (this.view) this.view.render(alpha, this.paused ? 0 : dt);
    else this.rig.render(dt);
    if ((this.meta.quality ?? 'auto') === 'auto') this.watchdog.push(dt, this.rig.tier);
    this.perf.push(dt, `${this.rig.gpu.backend} ${this.rig.tier}`);
  }

  // ---------- screens ----------
  showScreen(el: HTMLElement | null, withNav = true): Nav | null {
    this.screen?.remove();
    this.nav = null;
    this.screen = el;
    if (el) {
      this.ui.appendChild(el);
      if (withNav) {
        this.nav = new Nav(el);
        this.nav.focusFirst();
      }
    }
    return this.nav;
  }

  // ---------- match view ----------
  startView(sim: MatchSim, human: boolean, perkNames: string[] = []): MatchView {
    this.disposeView();
    if (human) sfx.stopMusic();
    this.loop.speed = 1;
    const theme = RINK_THEMES[this.meta.selectedRink] ?? RINK_THEMES.classic;
    const m = this.meta;
    this.view = new MatchView(this.rig, sim, this.ui, human ? 0 : null, perkNames, theme, {
      colorblind: m.colorblind ?? 'off',
      nameTags: human ? (m.nameTags ?? 'all') : 'off',
      reducedMotion: m.reducedMotion === true,
      rumble: (st, w, ms) => this.input.rumble(st, w, ms),
      fill: (t) => this.input.fill(t),
    });
    if (m.reducedMotion) this.view.shakeMul = 0;
    this.humanPlaying = human;
    this.paused = false;
    return this.view;
  }
  disposeView(): void {
    this.view?.dispose();
    this.view = null;
    this.humanPlaying = false;
  }

  /** AI vs AI background match for menus. */
  attract(): void {
    if (this.view && !this.humanPlaying) return;
    const rng = new Rng(Date.now() & 0xffff);
    const a = buildRivalRoster(rng, rng.pick(RIVALS.filter((r) => !r.boss)), 1);
    const bTeam = rng.pick(RIVALS.filter((r) => !r.boss));
    const b = buildRivalRoster(rng, bTeam, 1);
    const q = quickTeam('X');
    const sim = new MatchSim(
      [
        { name: 'Home', short: 'HOME', color: '#2f6bff', skaters: a.skaters.length ? a.skaters : q.skaters, goalie: a.goalie, isHuman: false, difficulty: 2 },
        { name: bTeam.name, short: bTeam.short, color: bTeam.color, skaters: b.skaters, goalie: b.goalie, isHuman: false, difficulty: 2 },
      ],
      defaultMatchMods(),
      rng.int(1, 1e9),
    );
    const v = this.startView(sim, false);
    v.hud.root.style.display = 'none';
    v.silent = true;
    if (this.meta.music !== false) sfx.startMusic();
  }

  // ---------- persistence ----------
  saveMeta(): void {
    saveMeta(this.meta);
  }
  saveRun(): void {
    if (this.run) saveRunRaw(serializeRun(this.run));
    else saveRunRaw(null);
  }
  loadSavedRun(): RunState | null {
    const raw = loadRunRaw();
    if (!raw) return null;
    const r = deserializeRun(raw);
    if (!r) return null;
    return r;
  }
  clearSavedRun(): void {
    saveRunRaw(null);
  }
}
