import * as THREE from 'three/webgpu';
import type { Skater } from '../sim/types';
import { SKATER } from '../sim/constants';

const bodyGeo = new THREE.CapsuleGeometry(0.34, 0.55, 4, 10);
const goalieBodyGeo = new THREE.CapsuleGeometry(0.42, 0.5, 4, 10);
const headGeo = new THREE.SphereGeometry(0.22, 12, 10);
const visorGeo = new THREE.BoxGeometry(0.3, 0.1, 0.24);
const stickGeo = new THREE.BoxGeometry(1.25, 0.05, 0.05);
const bladeGeo = new THREE.BoxGeometry(0.32, 0.06, 0.05);
const padGeo = new THREE.BoxGeometry(0.18, 0.7, 0.32);
const shadowGeo = new THREE.CircleGeometry(0.55, 16);
const ringGeo = new THREE.TorusGeometry(0.6, 0.06, 6, 24);
const arrowGeo = new THREE.ConeGeometry(0.22, 0.4, 8);
const flameGeo = new THREE.ConeGeometry(0.28, 0.9, 6);
const skateGeo = new THREE.BoxGeometry(0.35, 0.08, 0.12);

const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
const stickMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.7 });
const bladeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
const visorMat = new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.2, metalness: 0.6 });
const skateMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.4 });
const ringMatHome = new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.9 });
const flameMats = [
  new THREE.MeshBasicMaterial({ color: 0xff5a00, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  new THREE.MeshBasicMaterial({ color: 0xffc400, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
];

export class SkaterMesh {
  group = new THREE.Group();
  pivot = new THREE.Group(); // lean / fall
  body: THREE.Mesh;
  head: THREE.Mesh;
  shadow: THREE.Mesh;
  ring: THREE.Mesh;
  arrow: THREE.Mesh;
  flames: THREE.Mesh[] = [];
  stick: THREE.Group;
  jerseyMat: THREE.MeshStandardMaterial;
  fall = 0; // 0 upright .. 1 flat
  spin = 0;
  prev = { x: 0, y: 0, facing: 0 };
  cur = { x: 0, y: 0, facing: 0 };
  private bobT = 0;

  constructor(public id: string, color: string, isGoalie: boolean, helmetColor = '#1a1a1a') {
    this.jerseyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.55 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(helmetColor), roughness: 0.35, metalness: 0.2 });
    this.body = new THREE.Mesh(isGoalie ? goalieBodyGeo : bodyGeo, this.jerseyMat);
    this.body.position.y = 0.72;
    this.body.castShadow = true;
    this.head = new THREE.Mesh(headGeo, helmetMat);
    this.head.position.y = 1.32;
    this.head.castShadow = true;
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0.14, 1.3, 0);
    // stripe on jersey
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
    stripe.position.y = 0.55;
    this.pivot.add(this.body, this.head, visor, stripe);
    // skates
    for (const z of [-0.14, 0.14]) {
      const sk = new THREE.Mesh(skateGeo, skateMat);
      sk.position.set(0, 0.05, z);
      this.pivot.add(sk);
    }
    // stick: extends forward (+x) and to the right (+z)
    this.stick = new THREE.Group();
    const shaft = new THREE.Mesh(stickGeo, stickMat);
    shaft.position.set(0.55, 0.45, 0.35);
    shaft.rotation.z = 0.55;
    shaft.rotation.y = -0.15;
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(SKATER.possessionOffset + 0.05, 0.04, 0.42);
    blade.rotation.y = 0.5;
    this.stick.add(shaft, blade);
    this.pivot.add(this.stick);
    if (isGoalie) {
      for (const z of [-0.3, 0.3]) {
        const pad = new THREE.Mesh(padGeo, new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.8 }));
        pad.position.set(0.1, 0.38, z);
        this.pivot.add(pad);
      }
    }
    this.group.add(this.pivot);
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.012;
    this.group.add(this.shadow);
    this.ring = new THREE.Mesh(ringGeo, ringMatHome);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.visible = false;
    this.group.add(this.ring);
    this.arrow = new THREE.Mesh(arrowGeo, ringMatHome);
    this.arrow.rotation.x = Math.PI;
    this.arrow.position.y = 1.95;
    this.arrow.visible = false;
    this.group.add(this.arrow);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(flameGeo, flameMats[i % 2]);
      f.visible = false;
      this.pivot.add(f);
      this.flames.push(f);
    }
  }

  snapshot(sk: Skater): void {
    this.prev.x = this.cur.x;
    this.prev.y = this.cur.y;
    this.prev.facing = this.cur.facing;
    this.cur.x = sk.pos.x;
    this.cur.y = sk.pos.y;
    this.cur.facing = sk.facing;
  }
  /** Teleport (faceoff) — avoid interpolating across the rink. */
  snap(sk: Skater): void {
    this.cur.x = this.prev.x = sk.pos.x;
    this.cur.y = this.prev.y = sk.pos.y;
    this.cur.facing = this.prev.facing = sk.facing;
  }

  update(sk: Skater, alpha: number, dt: number, time: number): void {
    const x = this.prev.x + (this.cur.x - this.prev.x) * alpha;
    const y = this.prev.y + (this.cur.y - this.prev.y) * alpha;
    let df = this.cur.facing - this.prev.facing;
    while (df > Math.PI) df -= Math.PI * 2;
    while (df < -Math.PI) df += Math.PI * 2;
    const facing = this.prev.facing + df * alpha;
    this.group.position.set(x, 0, y);
    this.group.rotation.y = -facing;

    const speed = Math.hypot(sk.vel.x, sk.vel.y);
    // fall
    const targetFall = sk.knockdown > 0 ? 1 : 0;
    this.fall += (targetFall - this.fall) * Math.min(1, dt * (targetFall ? 14 : 6));
    // spin (deke)
    if (sk.deke > 0) this.spin += dt * 16;
    else this.spin += (Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2 - this.spin) * Math.min(1, dt * 12);
    // lean forward with speed, extra during lunge
    const lean = Math.min(0.45, speed * 0.035) + (sk.lunge > 0 ? 0.5 : 0) + (sk.stumble > 0 ? 0.3 : 0);
    this.bobT += dt * (2 + speed * 1.4);
    const bob = speed > 0.5 ? Math.sin(this.bobT) * 0.035 : 0;
    this.pivot.rotation.set(0, this.spin, -lean - this.fall * (Math.PI / 2 - lean));
    this.pivot.position.set(this.fall * 0.3, bob + this.fall * 0.3, 0);
    if (sk.isGoalie) {
      const bf = sk.butterfly > 0 ? 1 : 0;
      this.pivot.scale.set(1 + bf * 0.35, 1 - bf * 0.3, 1 + bf * 0.6);
    }
    // stick wobble when charging shot
    this.stick.rotation.y = sk.charging ? -0.9 * sk.shotCharge : 0;
    this.stick.rotation.z = sk.charging ? -0.5 * sk.shotCharge : 0;
    // controlled indicator
    this.ring.visible = sk.controlled;
    this.arrow.visible = sk.controlled;
    if (sk.controlled) this.arrow.position.y = 1.9 + Math.sin(time * 6) * 0.08;
    // on fire flames
    const onFire = sk.onFire > 0;
    this.flames.forEach((f, i) => {
      f.visible = onFire;
      if (onFire) {
        const ph = time * 14 + i * 2.1;
        f.position.set(-0.25 + Math.sin(ph) * 0.12, 0.9 + i * 0.25 + Math.sin(ph * 1.3) * 0.1, (i - 1) * 0.22);
        f.scale.set(0.8 + Math.sin(ph) * 0.3, 1 + Math.abs(Math.sin(ph * 0.7)) * 0.8, 0.8 + Math.cos(ph) * 0.3);
        f.rotation.z = -0.4;
      }
    });
    // shadow larger when down
    this.shadow.scale.setScalar(1 + this.fall * 0.9);
    // hp tint
    const hurt = sk.hp < 30;
    this.jerseyMat.emissive.setHex(hurt ? 0x330000 : onFire ? 0x662200 : 0x000000);
  }
}
