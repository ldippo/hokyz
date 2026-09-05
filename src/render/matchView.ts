import * as THREE from 'three/webgpu';
import { MatchSim } from '../sim/match';
import type { MatchEvent, MatchState } from '../sim/types';
import { SceneRig } from './scene';
import { RinkMesh } from './rinkMesh';
import { SkateMarks } from './skateMarks';
import { Director } from './director';
import { ReplayBuffer, captureFrame, applyFrameToSkater, applyFrameToPuck, type Frame } from './replay';
import type { Skater, Puck, Vec2 } from '../sim/types';
import { getRinkTextures } from './textures';
import { SkaterMesh } from './skaterMesh';
import { SkaterRig, jerseySpecFor, loadRigs, rigsReady } from './skaterRig';
import { PuckMesh } from './puckMesh';
import { Particles } from './effects';
import { FollowCamera } from './camera';
import { Hud } from '../ui/hud';
import { sfx as realSfx } from '../audio/sfx';
const sfx = realSfx;
const SILENT = new Proxy({}, { get: () => () => {} }) as typeof realSfx;
import { defendGoal, attackGoal } from '../sim/rink';
import { laneBlocked } from '../sim/puck';
import { PUCK, RINK, GOALIE } from '../sim/constants';
import type { Input } from '../sim/types';
import { RINK_THEMES, type RinkTheme } from '../run/meta';
import { awayColorFor, lanePalette, type CbMode } from '../ui/colors';

let rigTpl: Awaited<ReturnType<typeof loadRigs>> | null = null;
void loadRigs().then((t) => (rigTpl = t)).catch(() => (rigTpl = null));
function rigTemplate(goalie: boolean) {
  return goalie ? rigTpl!.goalie : rigTpl!.skater;
}

/** Binds a MatchSim to the renderer + HUD + audio. */
export class MatchView {
  rink: RinkMesh;
  skaters = new Map<string, SkaterMesh | SkaterRig>();
  puck = new PuckMesh();
  particles = new Particles();
  marks: SkateMarks | null = null;
  director: Director;
  replayBuf = new ReplayBuffer(300);
  /** presentation beats on (off in attract mode) */
  presentation = false;
  /** camera shake multiplier (settings) */
  shakeMul = 1;
  /** accessibility prefs, set by App before play */
  access: { colorblind: CbMode; nameTags: 'off' | 'controlled' | 'all'; reducedMotion: boolean; rumble: (s: number, w: number, ms: number) => void; fill: (t: string) => string } = { colorblind: 'off', nameTags: 'all', reducedMotion: false, rumble: () => undefined, fill: (t) => t };
  private replay: { frames: Frame[]; pos: number; skaters: Record<string, Skater>; puck: Puck } | null = null;
  private pendingReplay: { team: 0 | 1; pos: Vec2; at: number } | null = null;
  private pendingMvp: { at: number; id: string } | null = null;
  /** highlight clips captured during the match */
  private clips: { kind: 'goal' | 'hit' | 'save' | 'ankle' | 'fight'; pos: Vec2; scoredOn: 0 | 1 | null; frames: Frame[]; label: string }[] = [];
  private pendingClips: { kind: 'goal' | 'hit' | 'save' | 'ankle' | 'fight'; pos: Vec2; scoredOn: 0 | 1 | null; label: string; after: number }[] = [];
  private reel: { idx: number } | null = null;
  reelDone = false;
  private introBeats = 0;
  private lastCam: 'follow' | 'director' = 'follow';
  /** latest human input, for the aim reticle */
  humanInput: Input | null = null;
  /** events from the most recent sim step (training drills read these) */
  lastEvents: MatchEvent[] = [];
  private markerMesh: THREE.Group | null = null;
  private reticle: THREE.Group;
  private reticleRing: THREE.Mesh;
  private reticleHigh: THREE.Mesh;
  private lanes: THREE.Mesh[] = [];
  private otRing: THREE.Mesh;
  private pullHint = 0;
  private shockRing: THREE.Mesh;
  private prevVel = new Map<string, { x: number; y: number }>();
  private shockT = 0;
  private laserTrail = 0;
  cam: FollowCamera;
  hud: Hud;
  time = 0;
  excite = 0;
  private group = new THREE.Group();
  private lastPhase: MatchState['phase'] = 'intro';
  private lastAnnounce = 'WELCOME TO THE BARN';
  /** attract mode: no sfx */
  silent = false;

  constructor(public rig: SceneRig, public sim: MatchSim, uiRoot: HTMLElement, humanTeam: 0 | 1 | null, perkNames: string[] = [], theme: RinkTheme = RINK_THEMES.classic, access?: Partial<MatchView['access']>) {
    if (access) Object.assign(this.access, access);
    // colorblind-safe away jersey when the two team colors collide
    sim.st.teams[1].color = awayColorFor(sim.st.teams[0].color, sim.st.teams[1].color, this.access.colorblind);
    const s = rig.settings;
    if (s.skateMarks) this.marks = new SkateMarks(1024);
    this.rink = new RinkMesh(theme, { reflect: s.reflections, marks: this.marks?.texture ?? null, metal: getRinkTextures(), crowdAnim: s.crowdAnim });
    rig.setTheme(theme);
    this.group.add(this.rink.group);
    const st = sim.st;
    const numbers = [88, 9, 4, 31, 17, 22, 7, 44, 13, 66];
    for (const id of st.order) {
      const sk = st.skaters[id];
      const team = st.teams[sk.team];
      let mesh: SkaterMesh | SkaterRig;
      if (rigsReady()) {
        const idx = st.order.indexOf(id);
        const tpl = rigTemplate(sk.isGoalie);
        const spec = jerseySpecFor(team.color, sk.team, team.name, team.short, sk.isGoalie ? 1 : numbers[idx % numbers.length], sk.name.split(' ').pop());
        mesh = new SkaterRig(id, tpl, sk.isGoalie, spec);
      } else {
        mesh = new SkaterMesh(id, team.color, sk.isGoalie, sk.team === 0 ? '#151520' : '#f2f2f2');
      }
      mesh.snap(sk);
      this.skaters.set(id, mesh);
      this.group.add(mesh.group);
      if (mesh instanceof SkaterRig && this.access.nameTags !== 'off') mesh.makeTag(sk.name, sk.team === 0 ? '#ffffff' : team.color);
    }
    this.puck.snap(st.puck);
    this.puck.addTo(rig.scene);
    this.group.add(this.particles.mesh);
    rig.scene.add(this.group);
    this.cam = new FollowCamera(rig.camera);
    this.cam.snapTo(0, 0);
    this.director = new Director(rig.camera);
    // aim reticle on the goal mouth
    this.reticle = new THREE.Group();
    this.reticleRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthTest: false }));
    this.reticleHigh = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.9, depthTest: false }));
    this.reticleHigh.position.y = 0.45;
    this.reticle.add(this.reticleRing, this.reticleHigh);
    this.reticle.visible = false;
    this.reticle.renderOrder = 10;
    this.group.add(this.reticle);
    // pass lanes
    const laneGeo = new THREE.BoxGeometry(1, 0.02, 0.14);
    laneGeo.translate(0.5, 0, 0);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(laneGeo, new THREE.MeshBasicMaterial({ color: 0x3fff7a, transparent: true, opacity: 0.6, depthTest: false }));
      l.visible = false;
      l.renderOrder = 9;
      l.frustumCulled = false;
      this.lanes.push(l);
      this.group.add(l);
    }
    // shockwave ring
    this.shockRing = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 40), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.shockRing.rotation.x = -Math.PI / 2;
    this.shockRing.position.y = 0.1;
    this.shockRing.visible = false;
    this.group.add(this.shockRing);
    // one-timer timing ring
    this.otRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, depthTest: false }));
    this.otRing.rotation.x = -Math.PI / 2;
    this.otRing.position.y = 0.05;
    this.otRing.visible = false;
    this.otRing.renderOrder = 9;
    this.group.add(this.otRing);
    this.hud = new Hud(uiRoot, humanTeam, perkNames);
    if (humanTeam !== null) sfx.startCrowd();
  }

  /** Training marker: glowing ring + beacon on the ice, or null to hide. */
  setMarker(pos: Vec2 | null): void {
    if (!this.markerMesh) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthTest: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.25, 4, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      beacon.position.y = 2;
      g.add(ring, beacon);
      this.group.add(g);
      this.markerMesh = g;
    }
    this.markerMesh.visible = pos !== null;
    if (pos) this.markerMesh.position.set(pos.x, 0, pos.y);
  }

  /** Enable intro/replay/mvp beats. Call right after construction for human matches. */
  enablePresentation(): void {
    this.presentation = true;
    const st = this.sim.st;
    const human = st.teams.find((t) => t.isHuman);
    const cap = human?.controlledId ? st.skaters[human.controlledId] : null;
    st.phaseTimer = 999; // held until the intro shot ends
    this.director.intro(cap ? { x: cap.pos.x, y: cap.pos.y } : null, 4.6);
    this.introBeats = 0;
  }

  /** True while the sim should not advance (intro / replay / mvp shots). */
  get holdSim(): boolean {
    const k = this.director.kind;
    return k === 'intro' || k === 'replay' || k === 'mvp' || k === 'reel';
  }
  get timeScale(): number {
    return this.director.kind === 'hit' ? this.director.timeScale : 1;
  }

  skipCinematic(): void {
    const k = this.director.kind;
    if (!k) return;
    if (this.reel) {
      this.reel = null;
      this.reelDone = true;
    }
    this.endReplay();
    this.director.stop();
    if (k === 'intro') this.sim.st.phaseTimer = 0.2;
    this.hud.tag(null);
  }

  private markClip(kind: 'goal' | 'hit' | 'save' | 'ankle' | 'fight', pos: Vec2, scoredOn: 0 | 1 | null, label: string): void {
    if (this.access.reducedMotion) return;
    this.pendingClips.push({ kind, pos: { x: pos.x, y: pos.y }, scoredOn, label, after: 28 });
  }

  /** Pick up to 6 clips: goals first, then the rest in order. */
  private reelClips(): typeof this.clips {
    const goals = this.clips.filter((c) => c.kind === 'goal').slice(-4);
    const rest = this.clips.filter((c) => c.kind !== 'goal');
    return [...goals, ...rest].slice(0, 6);
  }

  private startReelClip(): void {
    const list = this.reelClips();
    if (!this.reel || this.reel.idx >= list.length) {
      this.reel = null;
      this.reelDone = true;
      this.endReplay();
      this.director.stop();
      this.hud.tag(null);
      return;
    }
    const c = list[this.reel.idx];
    const st = this.sim.st;
    this.replay = { frames: c.frames, pos: 0, skaters: structuredClone(st.skaters), puck: structuredClone(st.puck) };
    const dur = c.frames.length / 60 / 0.6 + 0.2;
    this.director.reelShot(c.kind, c.pos, c.scoredOn, dur);
    this.hud.tag(`HIGHLIGHTS ${this.reel.idx + 1}/${list.length} · ${c.label}`);
    for (const id of st.order) this.skaters.get(id)?.snap(this.replay.skaters[id]);
  }

  private startReplay(team: 0 | 1, pos: Vec2): void {
    const frames = this.replayBuf.snapshot();
    if (frames.length < 60) return;
    // start ~2.6s before the goal, run ~0.5s past it
    const start = Math.max(0, frames.length - 1 - 156 - 30);
    const st = this.sim.st;
    this.replay = { frames, pos: start, skaters: structuredClone(st.skaters), puck: structuredClone(st.puck) };
    const dur = ((frames.length - start) / 60) / 0.45 + 0.4;
    this.director.replay(team, pos, dur);
    this.hud.tag('REPLAY');
    for (const id of st.order) this.skaters.get(id)?.snap(this.replay.skaters[id]);
  }
  private endReplay(): void {
    if (!this.replay) return;
    this.replay = null;
    const st = this.sim.st;
    for (const id of st.order) this.skaters.get(id)?.snap(st.skaters[id]);
    this.puck.snap(st.puck);
    this.hud.tag(null);
  }

  dispose(): void {
    this.marks?.dispose();
    this.rig.scene.remove(this.group);
    this.rig.scene.remove(this.puck.mesh, this.puck.shadow, this.puck.glow);
    this.hud.destroy();
    sfx.stopCrowd();
  }

  /** Call after each sim step with produced events. */
  afterStep(events: MatchEvent[]): void {
    const st = this.sim.st;
    this.lastEvents = events;
    if (st.phase === 'play' || st.phase === 'shootout' || st.phase === 'fight' || st.phase === 'goal') this.replayBuf.push(captureFrame(st));
    for (let i = this.pendingClips.length - 1; i >= 0; i--) {
      const pc = this.pendingClips[i];
      if (--pc.after > 0) continue;
      this.pendingClips.splice(i, 1);
      const frames = this.replayBuf.snapshot().slice(-130);
      if (frames.length < 60) continue;
      this.clips.push({ kind: pc.kind, pos: pc.pos, scoredOn: pc.scoredOn, frames, label: pc.label });
    }
    for (const id of st.order) this.skaters.get(id)?.snapshot(st.skaters[id]);
    this.puck.snapshot(st.puck);
    if (st.phase !== this.lastPhase) {
      if (st.phase === 'faceoff') {
        for (const id of st.order) this.skaters.get(id)?.snap(st.skaters[id]);
        this.puck.snap(st.puck);
      }
      this.lastPhase = st.phase;
    }
    for (const e of events) this.handleEvent(e, st);

  }

  private handleEvent(e: MatchEvent, st: MatchState): void {
    const sfx = this.silent ? SILENT : realSfx;
    switch (e.type) {
      case 'goal': {
        const scorer = st.skaters[e.scorer];
        const team = st.teams[e.team];
        for (const id of team.skaters) {
          const r = this.skaters.get(id);
          if (r instanceof SkaterRig) r.celebrate();
        }
        this.hud.announce('GOAL!', 'gold', `${scorer?.name ?? team.name}${e.value > 1 ? ` · ${e.value} PTS` : ''}`);
        this.lastAnnounce = `GOAL ${team.short}`;
        if (!this.access.reducedMotion) this.hud.flash();
        if (!this.silent) this.access.rumble(0.6, 0.9, 400);
        this.rink.flashGoal(defendGoal(e.team === 0 ? 1 : 0).team);
        this.particles.spawn({ x: e.pos.x, y: e.pos.y, count: 90, color: [0xffd23f, 0xffffff, parseInt(team.color.slice(1), 16)], speed: 9, life: 1.6, size: 0.16, up: 7 });
        sfx.goal();
        this.excite = 1;
        this.rink.arena.flash(team.color, this.access.reducedMotion ? 0.6 : 2.6);
        if (!this.silent) {
          this.rig.punch(0.8);
          this.rig.hitStopHandler?.(5);
          if (team.isHuman) sfx.chant(9, 0.45);
        }
        if (this.presentation) {
          this.pendingReplay = { team: e.team === 0 ? 1 : 0, pos: { ...e.pos }, at: this.time + 0.9 };
          this.markClip('goal', e.pos, e.team === 0 ? 1 : 0, `GOAL · ${scorer?.name ?? team.name}`);
        }
        break;
      }
      case 'hit': {
        const dir = { x: st.skaters[e.victim].pos.x - st.skaters[e.hitter].pos.x, y: st.skaters[e.victim].pos.y - st.skaters[e.hitter].pos.y };
        this.particles.spawn({ x: e.pos.x, y: e.pos.y, z: 0.8, count: e.big ? 40 : 12, color: e.big ? [0xffffff, 0xffd23f, 0xff5a00] : [0xffffff, 0xbfe0ff], speed: e.big ? 7 : 4, life: e.big ? 0.8 : 0.4, size: e.big ? 0.14 : 0.08, dir, spread: 2.2, up: e.big ? 5 : 2 });
        sfx.hit(e.big);
        if (e.big) {
          this.hud.announce('BIG HIT!', 'red', st.skaters[e.hitter].name);
          this.lastAnnounce = `BIG HIT ${st.skaters[e.hitter].name.split(' ').pop()?.toUpperCase()}`;
          if (!this.silent) {
            this.rig.punch(1);
            this.rig.hitStopHandler?.(4);
            this.cam.roll = this.access.reducedMotion ? 0 : (Math.random() < 0.5 ? -1 : 1) * 0.05;
            this.access.rumble(0.9, 0.5, 220);
          }
          if (this.presentation) this.markClip('hit', e.pos, null, `BIG HIT · ${st.skaters[e.hitter].name}`);
          if (this.presentation && st.skaters[e.hitter].onFire > 0 && !this.director.active) {
            const h = st.skaters[e.hitter];
            this.director.hit(e.pos, { x: e.pos.x - h.pos.x, y: e.pos.y - h.pos.y });
          }
          this.excite = Math.max(this.excite, 0.7);
          sfx.crowdBurst(0.5);
        }
        break;
      }
      case 'shot':
        if (e.oneTimer && st.skaters[e.shooter]?.controlled) this.hud.announce('PERFECT!', 'gold', 'ONE-TIMER');
        sfx.slapshot(e.power);
        this.particles.spawn({ x: e.pos.x, y: e.pos.y, z: 0.1, count: 6, color: 0xdff4ff, speed: 2, life: 0.35, size: 0.07, up: 1.5 });
        break;
      case 'bigSave':
        this.hud.announce('BIG SAVE!', 'gold', st.skaters[e.goalie].name);
        if (this.presentation) this.markClip('save', e.pos, null, `BIG SAVE · ${st.skaters[e.goalie].name}`);
        this.particles.spawn({ x: e.pos.x, y: e.pos.y, z: 0.6, count: 30, color: [0xffffff, 0xffd23f], speed: 5, life: 0.7, size: 0.12, up: 4 });
        sfx.crowdBurst(0.7);
        this.excite = Math.max(this.excite, 0.7);
        break;
      case 'ankleBreaker':
        this.hud.announce('ANKLE BREAKER!', 'fire', st.skaters[e.skater].name);
        if (this.presentation) this.markClip('ankle', st.skaters[e.victim].pos, null, `ANKLE BREAKER · ${st.skaters[e.skater].name}`);
        this.particles.spawn({ x: st.skaters[e.victim].pos.x, y: st.skaters[e.victim].pos.y, z: 0.3, count: 16, color: [0xff7a1a, 0xffd23f], speed: 3, life: 0.5, size: 0.1, up: 2 });
        sfx.crowdBurst(0.5);
        break;
      case 'divePrompt':
        if (st.teams[e.team].isHuman) this.hud.prompt(this.access.fill('DIVE!  {pass} / A  +  {up}/{down}'), GOALIE.diveWindow, 'dive');
        break;
      case 'goaliePulled':
        this.hud.announce(e.pulled ? 'GOALIE PULLED' : 'GOALIE BACK', e.pulled ? 'red' : '', e.pulled ? 'EXTRA ATTACKER' : '');
        break;
      case 'saucer':
        sfx.pass();
        break;
      case 'fightOffer': {
        this.hud.announce('DROP THE GLOVES?', 'red', this.access.fill('{shoot} = FIGHT  ·  {pass} = WALK AWAY'));
        sfx.crowdBurst(0.6);
        this.excite = 1;
        const a = st.skaters[e.a],
          b = st.skaters[e.b];
        if (!this.silent) this.director.fight(a.pos, b.pos, 40);
        break;
      }
      case 'fightStart': {
        this.hud.announce('FIGHT!', 'fire');
        sfx.crowdBurst(1);
        for (const id of [e.a, e.b]) {
          const r = this.skaters.get(id);
          if (r instanceof SkaterRig) r.fightStance = true;
        }
        break;
      }
      case 'fightHit': {
        const ra = this.skaters.get(e.attacker);
        const rd = this.skaters.get(e.defender);
        if (ra instanceof SkaterRig) ra.punch(e.dmg > 20);
        if (rd instanceof SkaterRig) rd.stagger();
        const d = st.skaters[e.defender];
        this.particles.spawn({ x: d.pos.x, y: d.pos.y, z: 1.4, count: e.counter ? 22 : 10, color: e.counter ? [0xffd23f, 0xffffff] : [0xffffff, 0xff5a5a], speed: 3, life: 0.4, size: 0.08, up: 2 });
        sfx.hit(e.counter);
        if (!this.silent) this.rig.punch(e.counter ? 0.6 : 0.3);
        break;
      }
      case 'fightEnd': {
        for (const id of [e.a, e.b]) {
          const r = this.skaters.get(id);
          if (r instanceof SkaterRig) r.fightStance = false;
        }
        this.hud.fight(false);
        if (e.winner) {
          this.hud.announce(st.skaters[e.winner].name.toUpperCase(), 'gold', 'WINS THE FIGHT · LOSER SITS');
          if (this.presentation) this.markClip('fight', st.skaters[e.winner].pos, null, `K.O. · ${st.skaters[e.winner].name}`);
          const r = this.skaters.get(e.winner);
          if (r instanceof SkaterRig) r.celebrate();
          sfx.crowdBurst(1);
        } else if (this.director.kind === 'fight') {
          this.hud.announce('NO FIGHT', '', 'PLAY ON');
        }
        if (this.director.kind === 'fight') this.director.stop();
        break;
      }
      case 'special': {
        const sk = st.skaters[e.skater];
        const label = { laser: 'LASER SHOT', shockwave: 'SHOCKWAVE', afterburner: 'AFTERBURNER', blink: 'BLINK PASS', brickwall: 'BRICK WALL', bulldoze: 'BULLDOZE', phantom: 'PHANTOM' }[e.kind];
        if (sk.controlled || st.teams[sk.team].isHuman) this.hud.announce(label, 'fire', sk.name);
        else this.hud.announce(label, 'red', sk.name);
        if (e.kind === 'shockwave') {
          this.shockT = 0.7;
          this.shockRing.position.set(e.pos.x, 0.1, e.pos.y);
          this.particles.spawn({ x: e.pos.x, y: e.pos.y, z: 0.2, count: 60, color: [0xff7a1a, 0xffd23f, 0xffffff], speed: 8, life: 0.7, size: 0.14, up: 4 });
          if (!this.silent) {
            this.rig.punch(1);
            this.rig.hitStopHandler?.(4);
          }
          sfx.hit(true);
        } else if (e.kind === 'blink') {
          this.particles.spawn({ x: e.pos.x, y: e.pos.y, z: 0.4, count: 30, color: [0x7fa6ff, 0xffffff], speed: 4, life: 0.5, size: 0.1, up: 3, gravity: 0 });
          const to = st.puck.owner ? st.skaters[st.puck.owner] : null;
          if (to) this.particles.spawn({ x: to.pos.x, y: to.pos.y, z: 0.4, count: 30, color: [0x7fa6ff, 0xffffff], speed: 4, life: 0.5, size: 0.1, up: 3, gravity: 0 });
        } else {
          this.particles.spawn({ x: e.pos.x, y: e.pos.y, z: 0.6, count: 36, color: e.kind === 'laser' ? [0xff2d3a, 0xffffff] : e.kind === 'afterburner' ? [0xff7a1a, 0xffc400] : e.kind === 'bulldoze' ? [0xffd23f, 0x8a8f99] : e.kind === 'phantom' ? [0xc56bff, 0xffffff] : [0xffffff, 0x7fa6ff], speed: 5, life: 0.6, size: 0.12, up: 4, gravity: 2 });
        }
        sfx.onFire();
        break;
      }
      case 'specialReady':
        if (st.teams[e.team].isHuman) {
          this.hud.prompt(this.access.fill('SPECIAL READY · {special} / Y'), 2.2);
          sfx.cash();
        }
        break;
      case 'shootoutStart':
        this.hud.announce('SHOOTOUT', 'red', `BEST OF ${e.rounds}`);
        sfx.whistle();
        sfx.crowdBurst(0.8);
        this.excite = 1;
        break;
      case 'shootoutAttempt': {
        const sh = st.skaters[e.shooter];
        this.hud.announce(sh.name.toUpperCase(), st.teams[e.team].isHuman ? 'gold' : 'red', e.suddenDeath ? 'SUDDEN DEATH' : `ROUND ${e.round}`);
        break;
      }
      case 'shootoutResult':
        this.hud.announce(e.scored ? 'GOAL!' : 'NO GOAL', e.scored ? 'gold' : '', st.skaters[e.shooter].name);
        if (e.scored) {
          sfx.goal();
          this.rink.flashGoal(defendGoal(e.team === 0 ? 1 : 0).team);
        } else sfx.save();
        break;
      case 'shootoutEnd':
        this.hud.announce(`${st.teams[e.winner].short} WIN`, 'gold', `SHOOTOUT ${e.goals[0]} - ${e.goals[1]}`);
        this.excite = 1;
        break;
      case 'bossPhase':
        this.hud.announce(e.label, 'red', e.desc);
        this.lastAnnounce = e.label;
        sfx.crowdBurst(0.8);
        if (!this.silent) this.rig.punch(0.5);
        break;
      case 'teamFire':
        this.hud.announce('TEAM ON FIRE!', 'fire', st.teams[e.team].name.toUpperCase());
        for (const id of st.teams[e.team].skaters) {
          const k = st.skaters[id];
          this.particles.spawn({ x: k.pos.x, y: k.pos.y, z: 0.6, count: 30, color: [0xff5a00, 0xffc400], speed: 4, life: 0.9, size: 0.12, up: 5, gravity: 2 });
        }
        sfx.onFire();
        sfx.crowdBurst(1);
        this.excite = 1;
        break;
      case 'save':
        sfx.save();
        this.particles.spawn({ x: e.pos.x, y: e.pos.y, z: 0.5, count: 10, color: 0xffffff, speed: 3, life: 0.4, size: 0.08, up: 2 });
        break;
      case 'post':
        sfx.post();
        this.particles.spawn({ x: e.pos.x, y: e.pos.y, z: 0.6, count: 8, color: 0xff6666, speed: 3, life: 0.4, size: 0.08 });
        break;
      case 'pass':
        sfx.pass();
        break;
      case 'boards':
        sfx.boards(e.speed);
        this.particles.spawn({ x: e.pos.x, y: e.pos.y, z: 0.15, count: 4, color: 0xdff4ff, speed: 1.5, life: 0.3, size: 0.06, up: 1 });
        break;
      case 'onFire':
        this.hud.announce('ON FIRE!', 'fire', st.skaters[e.skater].name);
        this.particles.spawn({ x: st.skaters[e.skater].pos.x, y: st.skaters[e.skater].pos.y, z: 0.6, count: 50, color: [0xff5a00, 0xffc400, 0xff2020], speed: 5, life: 1.0, size: 0.14, up: 6, gravity: 3 });
        sfx.onFire();
        this.excite = Math.max(this.excite, 0.8);
        break;
      case 'faceoff':
        if (st.t > 2) sfx.whistle();
        break;
      case 'faceoffWon':
        sfx.faceoffDrop();
        break;
      case 'period':
        this.marks?.clear();
        this.hud.announce(e.overtime ? 'OVERTIME' : `PERIOD ${e.period}`, e.overtime ? 'red' : '', e.overtime ? 'SUDDEN DEATH' : '');
        break;
      case 'periodEnd':
        sfx.whistle();
        this.hud.announce('END OF PERIOD', '');
        break;
      case 'turbo': {
        const sk = st.skaters[e.skater];
        if (sk.controlled) sfx.turbo(e.on);
        break;
      }
      case 'knockdown':
        sfx.knockdown();
        break;
      case 'over': {
        sfx.whistle();
        this.hud.announce('FINAL', 'gold');
        this.excite = 1;
        if (this.presentation) {
          let best: Skater | null = null;
          let bs = -1;
          for (const id of st.order) {
            const k = st.skaters[id];
            const sc = k.goals * 3 + k.assists * 2 + k.bigHits * 2 + k.hits * 0.3 + k.saves * 0.6;
            if (sc > bs) {
              bs = sc;
              best = k;
            }
          }
          if (best) this.pendingMvp = { at: this.time + 1.2, id: best.id };
        }
        break;
      }
      default:
        break;
    }
  }

  render(alpha: number, dt: number): void {
    const st = this.sim.st;
    this.time += dt;
    this.excite = Math.max(0, this.excite - dt * 0.35);
    // pending cinematic triggers
    if (this.pendingReplay && this.time >= this.pendingReplay.at) {
      const p = this.pendingReplay;
      this.pendingReplay = null;
      if (!this.director.active) this.startReplay(p.team, p.pos);
    }
    if (this.presentation && st.phase === 'over' && !this.reel && !this.reelDone && !this.pendingMvp && !this.director.active && this.reelClips().length > 0) {
      this.reel = { idx: 0 };
      this.startReelClip();
    }
    if (this.pendingMvp && this.time >= this.pendingMvp.at) {
      const m = this.pendingMvp;
      this.pendingMvp = null;
      const k = st.skaters[m.id];
      if (k) {
        this.director.mvp({ x: k.pos.x, y: k.pos.y }, 6);
        this.hud.announce(k.name.toUpperCase(), 'gold', 'PLAYER OF THE GAME');
        const r = this.skaters.get(m.id);
        if (r instanceof SkaterRig) r.celebrate();
      }
    }
    // intro beats
    if (this.director.kind === 'intro') {
      const p = this.director.progress;
      const [a, b] = st.teams;
      if (this.introBeats === 0 && p > 0.03) {
        this.introBeats = 1;
        this.hud.announce(a.name.toUpperCase(), 'gold', 'HOME');
      } else if (this.introBeats === 1 && p > 0.42) {
        this.introBeats = 2;
        this.hud.announce(b.name.toUpperCase(), 'red', 'VISITORS');
      } else if (this.introBeats === 2 && p > 0.76) {
        this.introBeats = 3;
        const cap = a.controlledId ? st.skaters[a.controlledId] : null;
        if (cap) this.hud.announce(cap.name.toUpperCase(), '', 'CAPTAIN');
      }
    }
    if (this.replay) {
      const rp = this.replay;
      rp.pos += dt * 60 * this.director.timeScale;
      const i = Math.min(rp.frames.length - 1, Math.floor(rp.pos));
      const j = Math.min(rp.frames.length - 1, i + 1);
      const frac = Math.min(1, rp.pos - i);
      for (const id of st.order) {
        const fa = rp.frames[i].skaters[id],
          fb = rp.frames[j].skaters[id];
        if (fa && fb) applyFrameToSkater(rp.skaters[id], fb, fa, frac);
      }
      applyFrameToPuck(rp.puck, rp.frames[j].puck, rp.frames[i].puck, frac);
      for (const id of st.order) {
        const r = this.skaters.get(id);
        if (!r) continue;
        r.snap(rp.skaters[id]);
        if (r instanceof SkaterRig) r.lookAt(rp.skaters[id], rp.puck.pos.x, rp.puck.pos.y);
        r.update(rp.skaters[id], 1, dt, this.time);
      }
      this.puck.snap(rp.puck);
      this.puck.update(rp.puck, 1, this.time);
      if (rp.pos >= rp.frames.length - 1 || !this.director.active) {
        if (this.reel) {
          this.reel.idx++;
          this.director.stop();
          this.startReelClip();
        } else {
          this.endReplay();
          this.director.stop();
        }
      }
    } else {
      for (const id of st.order) {
        const r = this.skaters.get(id);
        if (!r) continue;
        if (r instanceof SkaterRig) {
          r.lookAt(st.skaters[id], st.puck.pos.x, st.puck.pos.y);
          r.tagVisible(this.access.nameTags === 'all' || (this.access.nameTags === 'controlled' && st.skaters[id].controlled));
        }
        r.update(st.skaters[id], alpha, dt, this.time);
      }
      this.puck.update(st.puck, alpha, this.time);
    }
    // turbo trails
    for (const id of st.order) {
      const sk = st.skaters[id];
      if (sk.turboActive && Math.random() < 0.6) {
        this.particles.spawn({ x: sk.pos.x - Math.cos(sk.facing) * 0.4, y: sk.pos.y - Math.sin(sk.facing) * 0.4, z: 0.1, count: 1, color: sk.onFire > 0 ? 0xff5a00 : 0x9fd3ff, speed: 0.6, life: 0.35, size: 0.12, up: 0.5, gravity: 1 });
      }
      if (sk.onFire > 0 && Math.random() < 0.5) {
        this.particles.spawn({ x: sk.pos.x, y: sk.pos.y, z: 0.9, count: 1, color: [0xff5a00, 0xffc400], speed: 0.5, life: 0.5, size: 0.1, up: 2.5, gravity: -1 });
      }
    }
    this.particles.update(dt);
    this.rink.update(this.time, dt, this.excite);
    if (this.markerMesh?.visible) {
      this.markerMesh.children[0].scale.setScalar(1 + Math.sin(this.time * 5) * 0.12);
      this.markerMesh.rotation.y += dt;
    }
    {
      const [a, b] = st.teams;
      const c = Math.max(0, st.clock);
      const clock = `${Math.floor(c / 60)}:${Math.floor(c % 60).toString().padStart(2, '0')}`;
      this.rink.arena.drawScreen([{ text: `${a.short}  ${a.score} - ${b.score}  ${b.short}`, size: 54, color: '#ffd23f' }, { text: `${clock}  ·  ${st.overtime ? 'OT' : 'P' + st.period}`, size: 44 }, { text: this.lastAnnounce, size: 36, color: '#ff4b57' }], this.time);
    }
    if (this.marks) {
      for (const id of st.order) {
        const sk = st.skaters[id];
        const sp = Math.hypot(sk.vel.x, sk.vel.y);
        if (sp < 1.2 || sk.knockdown > 0) continue;
        const ang = Math.atan2(sk.vel.y, sk.vel.x);
        const side = { x: -Math.sin(sk.facing) * 0.16, y: Math.cos(sk.facing) * 0.16 };
        const len = Math.min(0.9, sp * dt * 1.4 + 0.15);
        const w = sk.turboActive ? 0.09 : 0.06;
        this.marks.stamp(sk.pos.x + side.x, sk.pos.y + side.y, ang, len, w);
        this.marks.stamp(sk.pos.x - side.x, sk.pos.y - side.y, ang, len, w);
      }
      this.marks.render(this.rig.renderer);
    }
    // camera: follow puck, biased toward controlled skater
    const p = st.puck;
    let fx = p.pos.x,
      fy = p.pos.y;
    let spread = 0;
    for (const t of st.teams) {
      if (t.isHuman && t.controlledId) {
        const c = st.skaters[t.controlledId];
        fx = (fx * 1.3 + c.pos.x) / 2.3;
        fy = (fy * 1.3 + c.pos.y) / 2.3;
        spread = Math.abs(c.pos.x - p.pos.x);
      }
    }
    // dynamic framing
    const carrier = p.owner ? st.skaters[p.owner] : null;
    let mode: 'neutral' | 'zone' | 'breakaway' = Math.abs(p.pos.x) > 13 ? 'zone' : 'neutral';
    let lead = { x: 0, y: 0 };
    if (carrier && !carrier.isGoalie) {
      const dir = carrier.team === 0 ? 1 : -1;
      const opp = st.teams[carrier.team === 0 ? 1 : 0];
      let clear = true;
      for (const id of opp.skaters) {
        const o = st.skaters[id];
        if ((o.pos.x - carrier.pos.x) * dir > -1 && Math.hypot(o.pos.x - carrier.pos.x, o.pos.y - carrier.pos.y) < 7) clear = false;
      }
      if (clear && carrier.vel.x * dir > 5 && Math.abs(carrier.pos.x) < 14) {
        mode = 'breakaway';
        lead = { x: dir * 4, y: 0 };
      }
    }
    this.cam.mode = mode;
    this.cam.lead.x += (lead.x - this.cam.lead.x) * Math.min(1, dt * 2);
    this.cam.lead.y = 0;
    const directing = this.director.update(dt);
    if (directing) {
      this.lastCam = 'director';
    } else {
      if (this.lastCam === 'director') {
        // resume follow cam smoothly from the current focus
        this.cam.snapTo(fx, fy);
        this.lastCam = 'follow';
        if (this.director.kind === null && st.phase === 'intro' && st.phaseTimer > 100) st.phaseTimer = 0.2;
        this.hud.tag(null);
      }
      this.cam.update(dt, fx, fy, st.shake * this.shakeMul, this.time, spread);
    }
    if (directing && this.director.kind === 'replay') this.hud.tag('REPLAY');
    if (directing && this.director.kind === 'reel' && !this.reel) this.hud.tag(null);
    // shootout tracker
    if (st.shootout) {
      const so = st.shootout;
      const res: [boolean[], boolean[]] = [so.attempts.filter((a) => a.team === 0).map((a) => a.scored), so.attempts.filter((a) => a.team === 1).map((a) => a.scored)];
      this.hud.shootout(true, res, so.rounds, [st.teams[0].short, st.teams[1].short]);
    } else this.hud.shootout(false);
    // fight overlay
    if (st.fight) {
      const f = st.fight;
      const A = st.skaters[f.a],
        B = st.skaters[f.b];
      let cue = '',
        cls = '';
      if (f.stage === 'offer') {
        cue = 'DROP THE GLOVES?';
      } else if (f.stage === 'duel' && f.cue && !f.cue.done) {
        const mine = st.teams[(f.cue.target === 0 ? A : B).team].isHuman;
        cls = f.cue.kind;
        const F = this.access.fill;
        cue = f.cue.kind === 'high' ? (mine ? F('HIGH ▲  {shoot}') : 'HIGH ▲') : f.cue.kind === 'low' ? (mine ? F('LOW ▼  {deke}') : 'LOW ▼') : f.cue.kind === 'feint' ? (mine ? F('FEINT ◆ BLOCK  {pass}') : 'FEINT ◆') : mine ? F('MASH ●  {shoot}!') : 'RECOVER ●';
      } else if (f.stage === 'result') {
        cue = f.winner === null ? 'DRAW' : 'K.O.';
        cls = 'feint';
      }
      this.hud.fight(true, [A.name, B.name], f.hp, cue, cls);
    }
    // shockwave ring
    if (this.shockT > 0) {
      this.shockT -= dt;
      const k = 1 - this.shockT / 0.7;
      this.shockRing.visible = true;
      this.shockRing.scale.setScalar(0.3 + k * 4.5);
      (this.shockRing.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    } else this.shockRing.visible = false;
    // snow spray on hard stops / cuts, fast-puck trail
    for (const id of st.order) {
      const k = st.skaters[id];
      const pv = this.prevVel.get(id);
      const sp = Math.hypot(k.vel.x, k.vel.y);
      if (pv && k.knockdown === 0) {
        const psp = Math.hypot(pv.x, pv.y);
        const decel = psp - sp;
        const dot = psp > 0.1 && sp > 0.1 ? (pv.x * k.vel.x + pv.y * k.vel.y) / (psp * sp) : 1;
        if ((decel > 2.2 && psp > 4) || (dot < 0.5 && psp > 4)) {
          const n = Math.min(14, Math.round(4 + psp));
          this.particles.spawn({ x: k.pos.x, y: k.pos.y, z: 0.05, count: n, color: [0xffffff, 0xdff4ff], speed: 1.2 + psp * 0.15, life: 0.45, size: 0.07, up: 1.4, gravity: 6, dir: { x: pv.x, y: pv.y }, spread: 1.6 });
        }
      }
      this.prevVel.set(id, { x: k.vel.x, y: k.vel.y });
    }
    if (!st.puck.owner && !st.puck.laser) {
      const ps = Math.hypot(st.puck.vel.x, st.puck.vel.y);
      if (ps > 13) this.particles.spawn({ x: st.puck.pos.x, y: st.puck.pos.y, z: st.puck.z + 0.08, count: 1, color: [0x9fd3ff, 0xffffff], speed: 0.3, life: 0.22, size: 0.07, up: 0.2, gravity: 0 });
    }
    // laser puck trail + afterburner flames
    if (st.puck.laser && !st.puck.owner) {
      this.laserTrail += dt;
      this.particles.spawn({ x: st.puck.pos.x, y: st.puck.pos.y, z: st.puck.z + 0.1, count: 3, color: [0xff2d3a, 0xffffff], speed: 0.5, life: 0.35, size: 0.1, up: 0.3, gravity: 0 });
    }
    for (const id of st.order) {
      const k = st.skaters[id];
      if (k.specialTimer > 0 && k.specialKind === 'afterburner') this.particles.spawn({ x: k.pos.x - Math.cos(k.facing) * 0.5, y: k.pos.y - Math.sin(k.facing) * 0.5, z: 0.5, count: 2, color: [0xff7a1a, 0xffc400], speed: 1.5, life: 0.4, size: 0.14, up: 1, gravity: 0 });
      if (k.specialTimer > 0 && k.specialKind === 'phantom' && Math.random() < 0.6) this.particles.spawn({ x: k.pos.x, y: k.pos.y, z: 0.8, count: 1, color: [0xc56bff, 0xffffff], speed: 0.6, life: 0.5, size: 0.1, up: 1.2, gravity: -0.5 });
      if (k.specialTimer > 0 && k.specialKind === 'bulldoze' && Math.random() < 0.5) this.particles.spawn({ x: k.pos.x, y: k.pos.y, z: 0.15, count: 1, color: [0xffd23f, 0xffffff], speed: 1.5, life: 0.35, size: 0.09, up: 1, gravity: 4 });
      if (k.specialTimer > 0 && k.specialKind === 'laser' && k.hasPuck && Math.random() < 0.5) this.particles.spawn({ x: st.puck.pos.x, y: st.puck.pos.y, z: 0.15, count: 1, color: 0xff2d3a, speed: 0.4, life: 0.3, size: 0.08, up: 0.6, gravity: 0 });
    }
    // aim reticle, pass lanes, one-timer ring for the controlled carrier
    this.reticle.visible = false;
    for (const l of this.lanes) l.visible = false;
    this.otRing.visible = false;
    if (!this.silent && !this.replay) {
      for (const t of st.teams) {
        if (!t.isHuman || !t.controlledId) continue;
        const c = st.skaters[t.controlledId];
        if (!c.hasPuck || c.isGoalie) continue;
        const goal = attackGoal(c.team);
        const dGoal = Math.abs(goal.lineX - c.pos.x);
        if (dGoal < 22 && Math.sign(goal.lineX - c.pos.x) === goal.dir) {
          const aim = this.humanInput?.aim ?? { x: 0, y: 0 };
          const oppGoalie = st.teams[c.team === 0 ? 1 : 0].goalie;
          const gk = oppGoalie ? st.skaters[oppGoalie] : null;
          let post: number;
          if (Math.hypot(aim.x, aim.y) > 0.25) post = Math.max(-1, Math.min(1, aim.y * 1.3));
          else post = gk ? -Math.sign(gk.pos.y || 1) * 0.85 : 0;
          const charge = c.charging ? c.shotCharge : 0;
          const high = charge > 0.6;
          this.reticle.position.set(goal.lineX - goal.dir * 0.15, high ? 0.95 : 0.3, post * (RINK.goalWidth / 2) * 0.82);
          this.reticle.rotation.y = goal.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
          this.reticleHigh.visible = high;
          (this.reticleRing.material as THREE.MeshBasicMaterial).color.setHex(high ? 0xff7a1a : 0xffd23f);
          this.reticleRing.scale.setScalar(1 + charge * 0.6);
          this.reticle.visible = true;
        }
        // lanes
        const range = c.stats.hands >= 8 ? 30 : 18;
        let li = 0;
        for (const id of t.skaters) {
          if (id === c.id || li >= this.lanes.length) continue;
          const m = st.skaters[id];
          const d = Math.hypot(m.pos.x - c.pos.x, m.pos.y - c.pos.y);
          if (d > range || m.knockdown > 0) continue;
          const blocked = laneBlocked(st, c, m);
          const lane = this.lanes[li];
          lane.position.set(c.pos.x, 0.06, c.pos.y);
          lane.rotation.y = -Math.atan2(m.pos.y - c.pos.y, m.pos.x - c.pos.x);
          lane.scale.set(d, 1, 1);
          const [openC, blockedC] = lanePalette(this.access.colorblind);
          (lane.material as THREE.MeshBasicMaterial).color.setHex(blocked ? blockedC : openC);
          lane.scale.y = blocked ? 0.6 : 1;
          (lane.material as THREE.MeshBasicMaterial).opacity = blocked ? 0.35 : 0.55;
          lane.visible = true;
          li++;
        }
        // one-timer ring
        const since = st.t - c.receivedAt;
        if (since < PUCK.oneTimerWindow && st.puck.prevTouch && st.skaters[st.puck.prevTouch]?.team === c.team) {
          const k = 1 - since / PUCK.oneTimerWindow;
          this.otRing.position.set(c.pos.x, 0.05, c.pos.y);
          this.otRing.scale.setScalar(0.6 + k * 0.9);
          this.otRing.visible = true;
        }
      }
      // pull-goalie hint late in regulation
      const human = st.teams.find((t) => t.isHuman);
      if (human && st.phase === 'play' && !st.overtime && st.clock <= GOALIE.pullClock && !human.pulled && st.period >= st.mods.periods) {
        this.pullHint += dt;
        if (this.pullHint > 8) {
          this.pullHint = 0;
          this.hud.prompt(this.access.fill('HOLD {pass} / A TO PULL THE GOALIE'), 2.5, 'quiet');
        }
      }
    }
    // controlled skater skate audio
    for (const t of st.teams) {
      if (t.isHuman && t.controlledId && !this.silent) {
        const c = st.skaters[t.controlledId];
        sfx.skate(dt, Math.hypot(c.vel.x, c.vel.y), c.turboActive);
      }
    }
    this.hud.update(st, dt);
    let turbo = 0;
    for (const t of st.teams) if (t.isHuman && t.controlledId) turbo = st.skaters[t.controlledId].turboActive ? 1 : 0;
    this.rig.setTurbo(turbo);
    this.rig.render(dt);
  }
}
