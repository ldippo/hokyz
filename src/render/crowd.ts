import * as THREE from 'three/webgpu';
import { positionLocal, vec3, float, uniform, instancedBufferAttribute, time, sin, abs, max, pow } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RINK } from '../sim/constants';
import { roundedRectPath } from './rinkMesh';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

/** Low-poly fan variants built from primitives. Origin at seat level, facing -x (toward rink) after per-instance yaw. */
function fanGeometry(variant: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, rz = 0) => {
    g.rotateZ(rz);
    g.translate(x, y, z);
    parts.push(g);
  };
  const seated = variant === 0;
  const torsoH = seated ? 0.55 : 0.7;
  const base = seated ? 0.45 : 0.0;
  // legs
  if (seated) {
    add(new THREE.BoxGeometry(0.42, 0.18, 0.5), 0.12, base - 0.08, 0);
  } else {
    add(new THREE.BoxGeometry(0.16, 0.8, 0.18), 0, 0.4, -0.11);
    add(new THREE.BoxGeometry(0.16, 0.8, 0.18), 0, 0.4, 0.11);
  }
  // torso
  add(new THREE.BoxGeometry(0.3, torsoH, 0.46), 0, base + torsoH / 2 + (seated ? 0.05 : 0.8), 0);
  // head
  add(new THREE.SphereGeometry(0.16, 8, 6), 0, base + torsoH + (seated ? 0.25 : 1.0), 0);
  // arms
  const shoulderY = base + torsoH + (seated ? 0.0 : 0.72);
  if (variant === 2) {
    add(new THREE.BoxGeometry(0.12, 0.55, 0.12), 0, shoulderY + 0.25, -0.3, 0);
    add(new THREE.BoxGeometry(0.12, 0.55, 0.12), 0, shoulderY + 0.25, 0.3, 0);
  } else {
    add(new THREE.BoxGeometry(0.12, 0.5, 0.12), 0.05, shoulderY - 0.2, -0.3, 0);
    add(new THREE.BoxGeometry(0.12, 0.5, 0.12), 0.05, shoulderY - 0.2, 0.3, 0);
  }
  const merged = mergeGeometries(parts, false)!;
  merged.computeVertexNormals();
  return merged;
}

export class Crowd {
  group = new THREE.Group();
  excite = uniform(0);
  wave = uniform(0);
  private excitement = 0;
  private waveT = -1;
  meshes: THREE.InstancedMesh[] = [];

  constructor(palette: number[], animate: boolean) {
    const hx = RINK.length / 2,
      hy = RINK.width / 2;
    const rows = 5;
    const seats: { x: number; z: number; y: number; yaw: number; angle: number }[] = [];
    for (let r = 0; r < rows; r++) {
      const pts = roundedRectPath(hx + 2.4 + r * 1.2, hy + 2.4 + r * 1.2, RINK.cornerRadius + 2.2 + r, 7);
      let total = 0;
      for (let i = 0; i < pts.length; i++) total += pts[i].distanceTo(pts[(i + 1) % pts.length]);
      let acc = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i],
          b = pts[(i + 1) % pts.length];
        const L = a.distanceTo(b);
        const n = Math.max(1, Math.round(L / 0.95));
        for (let k = 0; k < n; k++) {
          const p = a.clone().lerp(b, k / n);
          const angle = (acc + (k / n) * L) / total;
          if (Math.random() < 0.08) continue; // empty seats
          seats.push({ x: p.x, z: p.y, y: 0.35 + r * 0.75, yaw: Math.atan2(-p.y, -p.x), angle });
        }
        acc += L;
      }
    }
    const geos = [fanGeometry(0), fanGeometry(1), fanGeometry(2)];
    const buckets: number[][] = [[], [], []];
    seats.forEach((_, i) => {
      const rnd = Math.random();
      buckets[rnd < 0.7 ? 0 : rnd < 0.92 ? 1 : 2].push(i);
    });
    const tmp = new THREE.Object3D();
    buckets.forEach((idxs, variant) => {
      if (!idxs.length) return;
      const mat = new THREE.MeshStandardNodeMaterial();
      mat.roughness = 0.95;
      mat.metalness = 0;
      const phaseAttr = new THREE.InstancedBufferAttribute(new Float32Array(idxs.length), 1);
      const angleAttr = new THREE.InstancedBufferAttribute(new Float32Array(idxs.length), 1);
      const mesh = new THREE.InstancedMesh(geos[variant], mat, idxs.length);
      idxs.forEach((si, k) => {
        const s = seats[si];
        tmp.position.set(s.x, s.y, s.z);
        tmp.rotation.set(0, s.yaw + (Math.random() - 0.5) * 0.3, 0);
        tmp.scale.setScalar(0.9 + Math.random() * 0.25);
        tmp.updateMatrix();
        mesh.setMatrixAt(k, tmp.matrix);
        const c = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
        c.multiplyScalar(0.55 + Math.random() * 0.35);
        mesh.setColorAt(k, c);
        phaseAttr.setX(k, Math.random());
        angleAttr.setX(k, s.angle);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      if (animate) {
        const phase: N = instancedBufferAttribute(phaseAttr);
        const angle: N = instancedBufferAttribute(angleAttr);
        // bounce: idle sway + excited jumping; wave travels around the rink once
        const idle: N = sin(time.mul(1.6).add(phase.mul(6.283))).mul(0.015);
        const jump: N = abs(sin(time.mul(float(5.5)).add(phase.mul(6.283)))).mul(this.excite).mul(0.28);
        const wavePos: N = angle.sub(this.wave).mul(6.283);
        const waveLift: N = pow(max(float(0), sin(wavePos.mul(2.0).add(1.57))), float(6)).mul(0.5);
        const lift: N = idle.add(jump).add(waveLift);
        mat.positionNode = positionLocal.add(vec3(float(0), lift.mul(positionLocal.y.mul(0.6).add(0.4)), float(0)));
      }
      this.group.add(mesh);
      this.meshes.push(mesh);
    });
  }

  /** excite 0..1 drives jumping; call startWave() on goals. */
  update(dt: number, exciteTarget: number): void {
    this.excitement += (exciteTarget - this.excitement) * Math.min(1, dt * 3);
    this.excite.value = this.excitement;
    if (this.waveT >= 0) {
      this.waveT += dt * 0.18;
      this.wave.value = this.waveT;
      if (this.waveT > 1.6) {
        this.waveT = -1;
        this.wave.value = -10;
      }
    }
  }
  startWave(): void {
    if (this.waveT < 0) this.waveT = 0;
  }
}
