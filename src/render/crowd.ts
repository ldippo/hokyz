import * as THREE from 'three/webgpu';
import { positionLocal, vec3, float, uniform, instancedBufferAttribute, time, sin, abs, max, pow, attribute, mix } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RINK } from '../sim/constants';
import { roundedRectPath } from './rinkMesh';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

/** Rounded, instanced spectator silhouettes with separate apparel and skin. */
function fanGeometry(variant: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, color: number, clothing = false, rz = 0) => {
    g.rotateZ(rz);
    g.translate(x, y, z);
    const n = g.getAttribute('position').count, c = new THREE.Color(color);
    const colors = new Float32Array(n * 3), mask = new Float32Array(n);
    for (let i = 0; i < n; i++) { c.toArray(colors, i * 3); mask[i] = clothing ? 1 : 0; }
    g.setAttribute('fanColor', new THREE.BufferAttribute(colors, 3));
    g.setAttribute('apparel', new THREE.BufferAttribute(mask, 1));
    parts.push(g);
  };
  const seated = variant === 0;
  const skin = [0xaf8064, 0x76503c, 0xd1a087][variant];
  const hip = seated ? 0.5 : 0.8, shoulder = hip + 0.48;
  const capsule = (r: number, length: number) => new THREE.CapsuleGeometry(r, length, 3, 8);
  for (const side of [-1, 1]) {
    if (seated) {
      add(capsule(0.09, 0.26), -0.14, hip, side * 0.11, 0x202635, false, Math.PI / 2);
      add(capsule(0.075, 0.3), -0.3, 0.26, side * 0.11, 0x202635);
    } else add(capsule(0.085, 0.61), 0, 0.4, side * 0.11, 0x202635);
    add(new THREE.SphereGeometry(0.1, 8, 6).scale(1.5, 0.65, 0.85), seated ? -0.35 : -0.04, 0.07, side * 0.11, 0x10151e);
    const raised = variant === 2;
    add(capsule(0.075, 0.34), 0, shoulder + (raised ? 0.14 : -0.18), side * 0.25, 0xffffff, true);
    add(new THREE.SphereGeometry(0.075, 8, 6), 0, shoulder + (raised ? 0.39 : -0.43), side * 0.25, skin);
  }
  add(new THREE.SphereGeometry(1, 10, 8).scale(0.19, 0.34, 0.25), 0, hip + 0.25, 0, 0xffffff, true);
  add(capsule(0.07, 0.08), 0, shoulder + 0.13, 0, skin);
  add(new THREE.SphereGeometry(0.15, 10, 8).scale(0.9, 1.15, 1), 0, shoulder + 0.3, 0, skin);
  add(new THREE.SphereGeometry(0.153, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.9, 1.15, 1), 0, shoulder + 0.33, 0, 0x30261f);
  const merged = mergeGeometries(parts, false)!;
  parts.forEach(part => part.dispose());
  return merged;
}

export class Crowd {
  group = new THREE.Group();
  excite = uniform(0);
  wave = uniform(0);
  waveActive = uniform(0);
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
      const tintAttr = new THREE.InstancedBufferAttribute(new Float32Array(idxs.length * 3), 3);
      mat.colorNode = mix(attribute('fanColor', 'vec3'), instancedBufferAttribute(tintAttr, 'vec3'), attribute('apparel', 'float'));
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
        c.lerp(new THREE.Color(0x344052), 0.55).multiplyScalar(0.45 + Math.random() * 0.3);
        tintAttr.setXYZ(k, c.r, c.g, c.b);
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
        const waveLift: N = pow(max(float(0), sin(wavePos.mul(2.0).add(1.57))), float(6)).mul(0.5).mul(this.waveActive);
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
        this.waveActive.value = 0;
      }
    }
  }
  startWave(): void {
    if (this.waveT < 0) {
      this.waveT = 0;
      this.wave.value = 0;
      this.waveActive.value = 1;
    }
  }
}
