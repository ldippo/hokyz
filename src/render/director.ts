import * as THREE from 'three/webgpu';
import { GOALS } from '../sim/rink';
import type { TeamId, Vec2 } from '../sim/types';

/**
 * Cinematic camera director. Owns the camera while a shot is active; the follow
 * camera resumes when `active` is false. Shots are keyframed in sim-space then
 * converted to world (x, y-up, z = sim y).
 */
export type ShotKind = 'intro' | 'replay' | 'hit' | 'mvp' | 'fight' | null;

interface Key {
  t: number;
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov?: number;
}

export interface ShotState {
  kind: ShotKind;
  t: number;
  duration: number;
  keys: Key[];
  /** playback rate for the sim/replay while this shot runs */
  timeScale: number;
  label?: string;
  sub?: string;
}

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const smooth = (t: number) => t * t * (3 - 2 * t);

export class Director {
  shot: ShotState | null = null;
  private baseFov: number;
  constructor(private cam: THREE.PerspectiveCamera) {
    this.baseFov = cam.fov;
  }
  get active(): boolean {
    return this.shot !== null;
  }
  get kind(): ShotKind {
    return this.shot?.kind ?? null;
  }
  get progress(): number {
    return this.shot ? Math.min(1, this.shot.t / this.shot.duration) : 0;
  }
  get timeScale(): number {
    return this.shot?.timeScale ?? 1;
  }

  stop(): void {
    this.shot = null;
    this.cam.fov = this.baseFov;
    this.cam.updateProjectionMatrix();
  }

  /** Arena fly-in: high wide → sweep down to center ice. */
  intro(humanCaptain: Vec2 | null, duration = 4.6): void {
    const keys: Key[] = [
      { t: 0, pos: v3(-30, 22, 34), look: v3(0, 2, 0), fov: 60 },
      { t: 0.45, pos: v3(-8, 12, 22), look: v3(0, 1, 0), fov: 52 },
      { t: 0.7, pos: v3(6, 3.2, 9), look: v3(0, 1, 0), fov: 46 },
    ];
    if (humanCaptain) {
      keys.push({ t: 0.78, pos: v3(humanCaptain.x + 2.6, 1.5, humanCaptain.y + 2.2), look: v3(humanCaptain.x, 1.1, humanCaptain.y), fov: 40 });
      keys.push({ t: 1, pos: v3(humanCaptain.x + 3.4, 1.7, humanCaptain.y + 2.8), look: v3(humanCaptain.x, 1.1, humanCaptain.y), fov: 40 });
    } else {
      keys.push({ t: 1, pos: v3(8, 4, 10), look: v3(0, 1, 0), fov: 46 });
    }
    this.shot = { kind: 'intro', t: 0, duration, keys, timeScale: 0 };
  }

  /** Goal replay from behind the beaten net, low, slow-mo. */
  replay(scoredOn: TeamId, goalPos: Vec2, duration: number): void {
    const g = GOALS[scoredOn];
    const side = goalPos.y >= 0 ? 1 : -1;
    const behind = g.backX + g.dir * 4.5;
    const keys: Key[] = [
      { t: 0, pos: v3(behind, 1.4, side * 5.5), look: v3(g.lineX - g.dir * 4, 0.6, 0), fov: 44 },
      { t: 1, pos: v3(behind + g.dir * 0.5, 1.1, side * 2.5), look: v3(g.lineX - g.dir * 2.5, 0.5, 0), fov: 40 },
    ];
    this.shot = { kind: 'replay', t: 0, duration, keys, timeScale: 0.45, label: 'REPLAY' };
  }

  /** Big-hit cut-in: close low cam on the collision, brief slow-mo. */
  hit(pos: Vec2, dir: Vec2, duration = 0.7): void {
    const len = Math.hypot(dir.x, dir.y) || 1;
    const nx = dir.x / len,
      ny = dir.y / len;
    // camera to the side of the hit direction
    const sx = -ny,
      sy = nx;
    const keys: Key[] = [
      { t: 0, pos: v3(pos.x + sx * 4.5 - nx * 1.5, 1.3, pos.y + sy * 4.5 - ny * 1.5), look: v3(pos.x, 0.9, pos.y), fov: 38 },
      { t: 1, pos: v3(pos.x + sx * 3.8 + nx * 1.0, 1.1, pos.y + sy * 3.8 + ny * 1.0), look: v3(pos.x + nx * 0.5, 0.8, pos.y + ny * 0.5), fov: 36 },
    ];
    this.shot = { kind: 'hit', t: 0, duration, keys, timeScale: 0.22 };
  }

  /** Fight: side-on low cam between two skaters, slow drift. */
  fight(a: Vec2, b: Vec2, duration = 30): void {
    const mx = (a.x + b.x) / 2,
      my = (a.y + b.y) / 2;
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const sx = -dy / len,
      sy = dx / len;
    const side = sy > 0 ? 1 : -1; // prefer the camera side (+y)
    const keys: Key[] = [
      { t: 0, pos: v3(mx + sx * side * 4.6, 1.5, my + sy * side * 4.6), look: v3(mx, 1.0, my), fov: 40 },
      { t: 1, pos: v3(mx + sx * side * 4.0 + dx * 0.15, 1.3, my + sy * side * 4.0 + dy * 0.15), look: v3(mx, 1.0, my), fov: 38 },
    ];
    this.shot = { kind: 'fight', t: 0, duration, keys, timeScale: 1, label: 'FIGHT' };
  }

  /** Slow orbit around the player of the game. */
  mvp(pos: Vec2, duration = 6): void {
    const keys: Key[] = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const a = -0.9 + (i / n) * 1.8;
      keys.push({ t: i / n, pos: v3(pos.x + Math.cos(a) * 4.2, 1.6, pos.y + Math.sin(a) * 4.2), look: v3(pos.x, 1.0, pos.y), fov: 42 });
    }
    this.shot = { kind: 'mvp', t: 0, duration, keys, timeScale: 0, label: 'PLAYER OF THE GAME' };
  }

  /** Advance; returns true while active. */
  update(dt: number): boolean {
    const s = this.shot;
    if (!s) return false;
    s.t += dt;
    const p = Math.min(1, s.t / s.duration);
    // find key segment
    const keys = s.keys;
    let i = 0;
    while (i < keys.length - 2 && p > keys[i + 1].t) i++;
    const a = keys[i],
      b = keys[Math.min(keys.length - 1, i + 1)];
    const span = Math.max(1e-6, b.t - a.t);
    const k = smooth(Math.min(1, Math.max(0, (p - a.t) / span)));
    const pos = a.pos.clone().lerp(b.pos, k);
    const look = a.look.clone().lerp(b.look, k);
    const fov = (a.fov ?? this.baseFov) + ((b.fov ?? this.baseFov) - (a.fov ?? this.baseFov)) * k;
    this.cam.position.copy(pos);
    this.cam.lookAt(look);
    if (Math.abs(this.cam.fov - fov) > 0.01) {
      this.cam.fov = fov;
      this.cam.updateProjectionMatrix();
    }
    if (p >= 1) {
      this.stop();
      return false;
    }
    return true;
  }
}
