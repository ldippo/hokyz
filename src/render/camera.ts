import * as THREE from 'three/webgpu';
import { RINK } from '../sim/constants';

export class FollowCamera {
  focus = new THREE.Vector2(0, 0);
  private vel = new THREE.Vector2();
  shake = 0;
  height = 14.5;
  back = 16;
  lookAhead = 0;
  zoom = 1;
  constructor(private cam: THREE.PerspectiveCamera) {}

  snapTo(x: number, y: number): void {
    this.focus.set(x, y);
    this.vel.set(0, 0);
  }

  update(dt: number, tx: number, ty: number, shakeIn: number, time: number, spread = 0): void {
    // clamp focus so we don't stare at empty space beyond boards
    const maxX = RINK.length / 2 - 11;
    tx = Math.max(-maxX, Math.min(maxX, tx));
    ty = Math.max(-4, Math.min(4, ty * 0.5));
    // spring follow
    const k = 9,
      d = 2 * Math.sqrt(k);
    const ax = (tx - this.focus.x) * k - this.vel.x * d;
    const ay = (ty - this.focus.y) * k - this.vel.y * d;
    this.vel.x += ax * dt;
    this.vel.y += ay * dt;
    this.focus.x += this.vel.x * dt;
    this.focus.y += this.vel.y * dt;
    this.shake = Math.max(this.shake, shakeIn);
    this.shake = Math.max(0, this.shake - dt * 3);
    const s = this.shake * this.shake * 0.5;
    const sx = Math.sin(time * 61) * s,
      sy = Math.cos(time * 53) * s,
      sz = Math.sin(time * 47) * s * 0.5;
    const zoomOut = 1 + Math.min(0.35, spread / 40);
    this.cam.position.set(this.focus.x + sx, this.height * zoomOut + sy, this.focus.y + this.back * zoomOut + sz);
    this.cam.lookAt(this.focus.x + sx, 0.5 + sy * 0.5, this.focus.y - 1.5);
  }
}
