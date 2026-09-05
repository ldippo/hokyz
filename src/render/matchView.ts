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
import { defendGoal } from '../sim/rink';
import { RINK_THEMES, type RinkTheme } from '../run/meta';

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
  private replay: { frames: Frame[]; pos: number; skaters: Record<string, Skater>; puck: Puck } | null = null;
  private pendingReplay: { team: 0 | 1; pos: Vec2; at: number } | null = null;
  private pendingMvp: { at: number; id: string } | null = null;
  private introBeats = 0;
  private lastCam: 'follow' | 'director' = 'follow';
  cam: FollowCamera;
  hud: Hud;
  time = 0;
  excite = 0;
  private group = new THREE.Group();
  private lastPhase: MatchState['phase'] = 'intro';
  private lastAnnounce = 'WELCOME TO THE BARN';
  /** attract mode: no sfx */
  silent = false;

  constructor(public rig: SceneRig, public sim: MatchSim, uiRoot: HTMLElement, humanTeam: 0 | 1 | null, perkNames: string[] = [], theme: RinkTheme = RINK_THEMES.classic) {
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
    }
    this.puck.snap(st.puck);
    this.puck.addTo(rig.scene);
    this.group.add(this.particles.mesh);
    rig.scene.add(this.group);
    this.cam = new FollowCamera(rig.camera);
    this.cam.snapTo(0, 0);
    this.director = new Director(rig.camera);
    this.hud = new Hud(uiRoot, humanTeam, perkNames);
    if (humanTeam !== null) sfx.startCrowd();
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
    return k === 'intro' || k === 'replay' || k === 'mvp';
  }
  get timeScale(): number {
    return this.director.kind === 'hit' ? this.director.timeScale : 1;
  }

  skipCinematic(): void {
    const k = this.director.kind;
    if (!k) return;
    this.endReplay();
    this.director.stop();
    if (k === 'intro') this.sim.st.phaseTimer = 0.2;
    this.hud.tag(null);
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
    if (st.phase === 'play') this.replayBuf.push(captureFrame(st));
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
        this.hud.flash();
        this.rink.flashGoal(defendGoal(e.team === 0 ? 1 : 0).team);
        this.particles.spawn({ x: e.pos.x, y: e.pos.y, count: 90, color: [0xffd23f, 0xffffff, parseInt(team.color.slice(1), 16)], speed: 9, life: 1.6, size: 0.16, up: 7 });
        sfx.goal();
        this.excite = 1;
        if (!this.silent) {
          this.rig.punch(0.8);
          this.rig.hitStopHandler?.(5);
        }
        if (this.presentation) this.pendingReplay = { team: e.team === 0 ? 1 : 0, pos: { ...e.pos }, at: this.time + 0.9 };
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
            this.cam.roll = (Math.random() < 0.5 ? -1 : 1) * 0.05;
          }
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
        sfx.slapshot(e.power);
        this.particles.spawn({ x: e.pos.x, y: e.pos.y, z: 0.1, count: 6, color: 0xdff4ff, speed: 2, life: 0.35, size: 0.07, up: 1.5 });
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
        this.endReplay();
        this.director.stop();
      }
    } else {
      for (const id of st.order) {
        const r = this.skaters.get(id);
        if (!r) continue;
        if (r instanceof SkaterRig) r.lookAt(st.skaters[id], st.puck.pos.x, st.puck.pos.y);
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
      this.cam.update(dt, fx, fy, st.shake, this.time, spread);
    }
    if (directing && this.director.kind === 'replay') this.hud.tag('REPLAY');
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
