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
  private toastEl: HTMLElement | null = null;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.rig = new SceneRig(canvas);
    this.ui = ui;
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
  }

  applyQualityPref(): void {
    const pref = this.meta.quality ?? 'auto';
    const tier: Tier = pref === 'auto' ? probeTier(this.rig.gpu) : pref;
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

  private simStep(): void {
    this.input.poll();
    if (this.view && !this.paused) {
      const ev = this.view.sim.step(this.humanPlaying ? { 0: this.input.simInput() } : {});
      this.view.afterStep(ev);
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
    const theme = RINK_THEMES[this.meta.selectedRink] ?? RINK_THEMES.classic;
    this.view = new MatchView(this.rig, sim, this.ui, human ? 0 : null, perkNames, theme);
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
  }

  // ---------- persistence ----------
  saveMeta(): void {
    saveMeta(this.meta);
  }
  saveRun(): void {
    if (this.run && !this.run.over) saveRunRaw(serializeRun(this.run));
    else saveRunRaw(null);
  }
  loadSavedRun(): RunState | null {
    const raw = loadRunRaw();
    if (!raw) return null;
    const r = deserializeRun(raw);
    if (!r || r.over) return null;
    return r;
  }
  clearSavedRun(): void {
    saveRunRaw(null);
  }
}
