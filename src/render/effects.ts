import * as THREE from 'three/webgpu';

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  gravity: number;
  color: THREE.Color;
}

export class Particles {
  mesh: THREE.InstancedMesh;
  private parts: Particle[] = [];
  private tmp = new THREE.Object3D();
  private max: number;
  constructor(max = 900) {
    this.max = max;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  spawn(opts: { x: number; y: number; z?: number; count: number; color: number | number[]; speed: number; life: number; size?: number; gravity?: number; dir?: { x: number; y: number }; spread?: number; up?: number }): void {
    const colors = Array.isArray(opts.color) ? opts.color : [opts.color];
    for (let i = 0; i < opts.count; i++) {
      if (this.parts.length >= this.max) this.parts.shift();
      let vx: number, vy: number;
      if (opts.dir) {
        const a = Math.atan2(opts.dir.y, opts.dir.x) + (Math.random() - 0.5) * (opts.spread ?? 1.2);
        const s = opts.speed * (0.4 + Math.random() * 0.8);
        vx = Math.cos(a) * s;
        vy = Math.sin(a) * s;
      } else {
        const a = Math.random() * Math.PI * 2;
        const s = opts.speed * (0.3 + Math.random() * 0.9);
        vx = Math.cos(a) * s;
        vy = Math.sin(a) * s;
      }
      const life = opts.life * (0.6 + Math.random() * 0.6);
      this.parts.push({
        x: opts.x,
        y: opts.y,
        z: (opts.z ?? 0.3) + Math.random() * 0.2,
        vx,
        vy,
        vz: (opts.up ?? 3) * (0.3 + Math.random()),
        life,
        maxLife: life,
        size: (opts.size ?? 0.12) * (0.6 + Math.random() * 0.8),
        gravity: opts.gravity ?? 9,
        color: new THREE.Color(colors[Math.floor(Math.random() * colors.length)]),
      });
    }
  }

  update(dt: number): void {
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      p.vz -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.z < 0.02) {
        p.z = 0.02;
        p.vz = -p.vz * 0.4;
        p.vx *= 0.8;
        p.vy *= 0.8;
      }
      const t = p.life / p.maxLife;
      this.tmp.position.set(p.x, p.z, p.y);
      this.tmp.scale.setScalar(p.size * (0.3 + t));
      this.tmp.rotation.set(p.life * 5, p.life * 7, 0);
      this.tmp.updateMatrix();
      this.mesh.setMatrixAt(n, this.tmp.matrix);
      this.mesh.setColorAt(n, p.color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
