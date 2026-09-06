import * as THREE from 'three/webgpu';
import type { Puck } from '../sim/types';

export class PuckMesh {
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  glow: THREE.Mesh;
  prev = { x: 0, y: 0, z: 0 };
  cur = { x: 0, y: 0, z: 0 };
  constructor() {
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 }));
    this.mesh.castShadow = true;
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.011;
    // This is a locating cue, not the physical puck: keep it readable through
    // skates and hit spray, with a dark edge on bright ice and yellow jerseys.
    this.glow = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.42, 32), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    this.glow.renderOrder = 21;
    const outline = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.47, 32), new THREE.MeshBasicMaterial({ color: 0x151520, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    outline.renderOrder = 20;
    this.glow.add(outline);
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 0.012;
  }
  addTo(scene: THREE.Scene): void {
    scene.add(this.mesh, this.shadow, this.glow);
  }
  snapshot(p: Puck): void {
    this.prev = { ...this.cur };
    this.cur = { x: p.pos.x, y: p.pos.y, z: p.z };
  }
  snap(p: Puck): void {
    this.cur = { x: p.pos.x, y: p.pos.y, z: p.z };
    this.prev = { ...this.cur };
  }
  update(p: Puck, alpha: number, time: number, reducedMotion = false): void {
    const x = this.prev.x + (this.cur.x - this.prev.x) * alpha;
    const y = this.prev.y + (this.cur.y - this.prev.y) * alpha;
    const z = this.prev.z + (this.cur.z - this.prev.z) * alpha;
    this.mesh.position.set(x, 0.03 + z, y);
    this.shadow.position.set(x, 0.011, y);
    this.shadow.scale.setScalar(Math.max(0.5, 1 - z * 0.4));
    this.glow.position.set(x, 0.012, y);
    this.glow.visible = !p.owner;
    this.glow.scale.setScalar(reducedMotion ? 1 : 1 + Math.sin(time * 8) * 0.15);
    const speed = Math.hypot(p.vel.x, p.vel.y);
    this.mesh.rotation.y += speed * 0.01;
  }
}
