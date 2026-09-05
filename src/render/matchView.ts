import * as THREE from 'three';
import { MatchSim } from '../sim/match';
import type { MatchEvent, MatchState } from '../sim/types';
import { SceneRig } from './scene';
import { RinkMesh } from './rinkMesh';
import { SkaterMesh } from './skaterMesh';
import { PuckMesh } from './puckMesh';
import { Particles } from './effects';
import { FollowCamera } from './camera';
import { Hud } from '../ui/hud';
import { sfx as realSfx } from '../audio/sfx';
const sfx = realSfx;
const SILENT = new Proxy({}, { get: () => () => {} }) as typeof realSfx;
import { defendGoal } from '../sim/rink';
import { RINK_THEMES, type RinkTheme } from '../run/meta';

/** Binds a MatchSim to the renderer + HUD + audio. */
export class MatchView {
  rink: RinkMesh;
  skaters = new Map<string, SkaterMesh>();
  puck = new PuckMesh();
  particles = new Particles();
  cam: FollowCamera;
  hud: Hud;
  time = 0;
  excite = 0;
  private group = new THREE.Group();
  private lastPhase: MatchState['phase'] = 'intro';
  /** attract mode: no sfx */
  silent = false;

  constructor(public rig: SceneRig, public sim: MatchSim, uiRoot: HTMLElement, humanTeam: 0 | 1 | null, perkNames: string[] = [], theme: RinkTheme = RINK_THEMES.classic) {
    this.rink = new RinkMesh(theme);
    rig.setTheme(theme);
    this.group.add(this.rink.group);
    const st = sim.st;
    for (const id of st.order) {
      const sk = st.skaters[id];
      const team = st.teams[sk.team];
      const mesh = new SkaterMesh(id, team.color, sk.isGoalie, sk.team === 0 ? '#151520' : '#f2f2f2');
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
    this.hud = new Hud(uiRoot, humanTeam, perkNames);
    if (humanTeam !== null) sfx.startCrowd();
  }

  dispose(): void {
    this.rig.scene.remove(this.group);
    this.rig.scene.remove(this.puck.mesh, this.puck.shadow, this.puck.glow);
    this.hud.destroy();
    sfx.stopCrowd();
  }

  /** Call after each sim step with produced events. */
  afterStep(events: MatchEvent[]): void {
    const st = this.sim.st;
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
        this.hud.announce('GOAL!', 'gold', `${scorer?.name ?? team.name}${e.value > 1 ? ` · ${e.value} PTS` : ''}`);
        this.hud.flash();
        this.rink.flashGoal(defendGoal(e.team === 0 ? 1 : 0).team);
        this.particles.spawn({ x: e.pos.x, y: e.pos.y, count: 90, color: [0xffd23f, 0xffffff, parseInt(team.color.slice(1), 16)], speed: 9, life: 1.6, size: 0.16, up: 7 });
        sfx.goal();
        this.excite = 1;
        break;
      }
      case 'hit': {
        const dir = { x: st.skaters[e.victim].pos.x - st.skaters[e.hitter].pos.x, y: st.skaters[e.victim].pos.y - st.skaters[e.hitter].pos.y };
        this.particles.spawn({ x: e.pos.x, y: e.pos.y, z: 0.8, count: e.big ? 40 : 12, color: e.big ? [0xffffff, 0xffd23f, 0xff5a00] : [0xffffff, 0xbfe0ff], speed: e.big ? 7 : 4, life: e.big ? 0.8 : 0.4, size: e.big ? 0.14 : 0.08, dir, spread: 2.2, up: e.big ? 5 : 2 });
        sfx.hit(e.big);
        if (e.big) {
          this.hud.announce('BIG HIT!', 'red', st.skaters[e.hitter].name);
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
    for (const id of st.order) this.skaters.get(id)?.update(st.skaters[id], alpha, dt, this.time);
    this.puck.update(st.puck, alpha, this.time);
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
    this.cam.update(dt, fx, fy, st.shake, this.time, spread);
    this.hud.update(st, dt);
    this.rig.render();
  }
}
