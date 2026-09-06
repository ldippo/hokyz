import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import type { Skater } from '../sim/types';
import { poseBlend } from './poseDamping';
import { jerseyTexture, teamPalette, type JerseySpec, type LogoShape, type StripePattern } from './jerseyTexture';

/** Model-space axes (Y-up glTF): forward +X, up +Y, side +Z. */
const AX_X = new THREE.Vector3(1, 0, 0);
const AX_Y = new THREE.Vector3(0, 1, 0);
const AX_Z = new THREE.Vector3(0, 0, 1);

export interface RigTemplates {
  skater: THREE.Object3D;
  goalie: THREE.Object3D;
}

let templates: RigTemplates | null = null;
let loading: Promise<RigTemplates> | null = null;

export function loadRigs(base = '/models/'): Promise<RigTemplates> {
  if (templates) return Promise.resolve(templates);
  if (loading) return loading;
  const loader = new GLTFLoader();
  loading = Promise.all([loader.loadAsync(base + 'skater.glb'), loader.loadAsync(base + 'goalie.glb')]).then(([s, g]) => {
    templates = { skater: s.scene, goalie: g.scene };
    return templates;
  });
  return loading;
}
export const rigsReady = (): boolean => templates !== null;

const shadowGeo = new THREE.CircleGeometry(0.55, 16);
const ringGeo = new THREE.TorusGeometry(0.6, 0.06, 6, 24);
const arrowGeo = new THREE.ConeGeometry(0.22, 0.4, 8);
const flameGeo = new THREE.ConeGeometry(0.28, 0.9, 6);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.9 });
const flameMats = [
  new THREE.MeshBasicMaterial({ color: 0xff5a00, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
  new THREE.MeshBasicMaterial({ color: 0xffc400, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
];

interface BoneRef {
  bone: THREE.Bone;
  restLocal: THREE.Quaternion;
  /** inverse of rest orientation in model space; converts model-space axes to bone-local */
  invRestWorld: THREE.Quaternion;
}

const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const ikS = new THREE.Vector3(),
  ikT = new THREE.Vector3(),
  ikE = new THREE.Vector3(),
  ikD = new THREE.Vector3(),
  ikP = new THREE.Vector3(),
  ikPerp = new THREE.Vector3(),
  ikRest = new THREE.Vector3(),
  ikQ = new THREE.Quaternion(),
  ikParent = new THREE.Quaternion(),
  ikCur = new THREE.Vector3();

/** Skinned skater driven procedurally from sim state. Same interface as SkaterMesh. */
export class SkaterRig {
  group = new THREE.Group();
  pivot = new THREE.Group();
  model: THREE.Object3D;
  bones = new Map<string, BoneRef>();
  shadow: THREE.Mesh;
  ring: THREE.Mesh;
  arrow: THREE.Mesh;
  flames: THREE.Mesh[] = [];
  jerseyMat: THREE.MeshStandardMaterial | null = null;
  fall = 0;
  spin = 0;
  prev = { x: 0, y: 0, facing: 0 };
  cur = { x: 0, y: 0, facing: 0 };
  private stride = 0;
  private prevFacing = 0;
  private turnRate = 0;
  private snapT = 0;
  private wasCharging = false;
  private celebrateT = 0;
  private fallSeed = 0;
  private headYaw = 0;
  private lean = 0;
  private roll = 0;
  /** fight animation: stance while >0, punch/stagger timers */
  fightStance = false;
  private tag: THREE.Sprite | null = null;
  /** IK: hand grip offsets in the stick bone's rest local frame + arm segment lengths */
  private grips: { side: 'L' | 'R'; offset: THREE.Vector3; upper: number; fore: number }[] = [];
  private bladeContacts: { bone: THREE.Bone; points: THREE.Vector3[] }[] = [];
  private stickContacts: THREE.Vector3[] = [];
  ikEnabled = true;
  private punchT = 0;
  private punchHigh = true;
  private staggerT = 0;

  constructor(public id: string, tpl: THREE.Object3D, public isGoalie: boolean, spec: JerseySpec) {
    this.model = skeletonClone(tpl);
    this.model.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        const b = o as THREE.Bone;
        this.bones.set(b.name, { bone: b, restLocal: b.quaternion.clone(), invRestWorld: new THREE.Quaternion() });
      }
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
        m.frustumCulled = false;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((mat, i) => {
          if (mat.name === 'jersey') {
            const jm = (mat as THREE.MeshStandardMaterial).clone();
            jm.map = jerseyTexture(spec);
            jm.color.set('#ffffff');
            jm.roughness = 0.78;
            this.jerseyMat = jm;
            if (Array.isArray(m.material)) m.material[i] = jm;
            else m.material = jm;
          } else if (mat.name === 'sleeve') {
            const sm = (mat as THREE.MeshStandardMaterial).clone();
            sm.color.set(spec.primary);
            sm.roughness = 0.8;
            if (Array.isArray(m.material)) m.material[i] = sm;
            else m.material = sm;
          } else if (mat.name === 'pants' || mat.name === 'helmet') {
            const pm = (mat as THREE.MeshStandardMaterial).clone();
            pm.color.set(spec.secondary === '#f4f4f4' ? '#141420' : spec.primary).multiplyScalar(0.55);
            if (Array.isArray(m.material)) m.material[i] = pm;
            else m.material = pm;
          }
        });
      }
    });
    // rest world orientations (model space)
    this.model.updateMatrixWorld(true);
    for (const ref of this.bones.values()) {
      ref.bone.getWorldQuaternion(ref.invRestWorld);
      ref.invRestWorld.invert();
    }
    // Cache the actual blade underside in foot-local space once, not mesh
    // vertices every frame. Keep asset dimensions out of the animation code.
    this.model.traverse(o => {
      const mesh = o as THREE.SkinnedMesh;
      if (!mesh.isSkinnedMesh || Array.isArray(mesh.material) || mesh.material.name !== 'blade') return;
      const position = mesh.geometry.attributes.position, skin = mesh.geometry.attributes.skinIndex;
      for (let i = 0; i < position.count; i++) {
        const bone = mesh.skeleton.bones[skin.getX(i)];
        if (!bone || !['footL', 'footR'].includes(bone.name)) continue;
        const point = mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3()));
        // The underside is the lowest millimeter of the rest-pose blade.
        if (point.y > 0.001) continue;
        bone.worldToLocal(point);
        let contact = this.bladeContacts.find(c => c.bone === bone);
        if (!contact) { contact = { bone, points: [] }; this.bladeContacts.push(contact); }
        if (!contact.points.some(p => p.distanceToSquared(point) < 1e-10)) contact.points.push(point);
      }
    });
    const stick = this.bones.get('stick')?.bone;
    if (stick) {
      const bounds = new THREE.Box3();
      this.model.traverse(o => {
        const mesh = o as THREE.SkinnedMesh;
        if (!mesh.isSkinnedMesh || Array.isArray(mesh.material) || mesh.material.name !== 'tape') return;
        const skin = mesh.geometry.attributes.skinIndex;
        for (let i = 0; i < skin.count; i++) {
          if (mesh.skeleton.bones[skin.getX(i)] !== stick) continue;
          bounds.expandByPoint(mesh.localToWorld(mesh.getVertexPosition(i, new THREE.Vector3())));
        }
      });
      if (!bounds.isEmpty()) for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        this.stickContacts.push(stick.worldToLocal(new THREE.Vector3(x, y, z)));
      }
      for (const side of ['L'] as const) {
        const ua = this.bones.get(`upperArm${side}`)?.bone;
        const fa = this.bones.get(`foreArm${side}`)?.bone;
        const hand = this.bones.get(`hand${side}`)?.bone;
        if (!ua || !fa || !hand) continue;
        const S = ua.getWorldPosition(new THREE.Vector3());
        const E = fa.getWorldPosition(new THREE.Vector3());
        const H = hand.getWorldPosition(new THREE.Vector3());
        const offset = stick.worldToLocal(H.clone());
        this.grips.push({ side, offset, upper: S.distanceTo(E), fore: E.distanceTo(H) });
      }
    }
    this.pivot.add(this.model);
    this.group.add(this.pivot);
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.012;
    this.group.add(this.shadow);
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.visible = false;
    this.group.add(this.ring);
    this.arrow = new THREE.Mesh(arrowGeo, ringMat);
    this.arrow.rotation.x = Math.PI;
    this.arrow.position.y = 2.15;
    this.arrow.visible = false;
    this.group.add(this.arrow);
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(flameGeo, flameMats[i % 2]);
      f.visible = false;
      this.pivot.add(f);
      this.flames.push(f);
    }
    this.fallSeed = Math.random() * 100;
  }

  /** Additive rotation about a model-space axis, on top of the rest pose. */
  private rot(name: string, axis: THREE.Vector3, angle: number, reset = false): void {
    const ref = this.bones.get(name.replace('.', ''));
    if (!ref) return;
    if (reset) ref.bone.quaternion.copy(ref.restLocal);
    if (angle === 0) return;
    tmpV.copy(axis).applyQuaternion(ref.invRestWorld).normalize();
    tmpQ.setFromAxisAngle(tmpV, angle);
    ref.bone.quaternion.multiply(tmpQ);
  }
  private resetBones(): void {
    for (const ref of this.bones.values()) ref.bone.quaternion.copy(ref.restLocal);
  }

  snapshot(sk: Skater): void {
    this.prev.x = this.cur.x;
    this.prev.y = this.cur.y;
    this.prev.facing = this.cur.facing;
    this.cur.x = sk.pos.x;
    this.cur.y = sk.pos.y;
    this.cur.facing = sk.facing;
  }
  snap(sk: Skater): void {
    this.cur.x = this.prev.x = sk.pos.x;
    this.cur.y = this.prev.y = sk.pos.y;
    this.cur.facing = this.prev.facing = sk.facing;
    this.prevFacing = sk.facing;
  }
  celebrate(): void {
    this.celebrateT = 1.6;
  }
  /** Name tag sprite above the head. */
  makeTag(name: string, color = '#ffffff'): void {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(10,17,29,0.94)';
    g.fillRect(0, 8, 256, 48);
    g.fillStyle = color;
    g.fillRect(10, 25, 12, 12);
    g.font = 'bold 26px "Segoe UI", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#eaf3ff';
    g.fillText(name.toUpperCase().slice(0, 16), 138, 33, 214);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false });
    this.tag = new THREE.Sprite(m);
    this.tag.scale.set(2.2, 0.55, 1);
    this.tag.position.y = 2.35;
    this.tag.renderOrder = 11;
    this.group.add(this.tag);
  }
  tagVisible(on: boolean): void {
    if (this.tag) this.tag.visible = on;
  }
  /** A small vertical lane keeps nearby labels distinct without hiding names. */
  tagLane(lane: number): void {
    if (this.tag) this.tag.position.y = 2.35 + lane * 0.8;
  }
  tagBounds(camera: THREE.PerspectiveCamera): { left: number; right: number; top: number; bottom: number } | null {
    if (!this.tag?.visible) return null;
    const center = this.tag.getWorldPosition(new THREE.Vector3());
    const depth = -center.clone().applyMatrix4(camera.matrixWorldInverse).z;
    if (depth <= 0) return null;
    const scale = this.tag.getWorldScale(new THREE.Vector3());
    center.project(camera);
    const halfWidth = scale.x * camera.projectionMatrix.elements[0] / (2 * depth);
    const halfHeight = scale.y * camera.projectionMatrix.elements[5] / (2 * depth);
    return { left: center.x - halfWidth, right: center.x + halfWidth, top: center.y + halfHeight, bottom: center.y - halfHeight };
  }
  punch(high: boolean): void {
    this.punchT = 0.32;
    this.punchHigh = high;
  }
  stagger(): void {
    this.staggerT = 0.4;
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
    const fwd = { x: Math.cos(facing), y: Math.sin(facing) };
    const fwdSpeed = sk.vel.x * fwd.x + sk.vel.y * fwd.y; // signed along facing
    // turn rate (rad/s), smoothed
    let dfa = facing - this.prevFacing;
    while (dfa > Math.PI) dfa -= Math.PI * 2;
    while (dfa < -Math.PI) dfa += Math.PI * 2;
    this.prevFacing = facing;
    if (dt > 0) this.turnRate += ((dfa / dt) - this.turnRate) * poseBlend(10, dt);

    // fall / spin / lean state
    const targetFall = sk.knockdown > 0 ? 1 : 0;
    this.fall += (targetFall - this.fall) * poseBlend(targetFall ? 14 : 6, dt);
    if (sk.deke > 0 && !sk.isGoalie && sk.dekeKind === 'spin') this.spin += dt * 16;
    else this.spin += (Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2 - this.spin) * poseBlend(12, dt);
    const targetLean = Math.min(0.62, Math.min(0.4, speed * 0.035) + (sk.lunge > 0 ? 0.45 : 0) + (sk.stumble > 0 ? 0.3 : 0));
    this.lean += (targetLean - this.lean) * poseBlend(8, dt);
    const targetRoll = THREE.MathUtils.clamp(-this.turnRate * 0.12 * Math.min(1, speed / 6), -0.45, 0.45);
    this.roll += (targetRoll - this.roll) * poseBlend(8, dt);
    this.celebrateT = Math.max(0, this.celebrateT - dt);
    if (sk.charging) this.wasCharging = true;
    else if (this.wasCharging) {
      this.wasCharging = false;
      this.snapT = 0.35;
    }
    this.snapT = Math.max(0, this.snapT - dt);

    // stride phase from distance travelled
    this.stride += (Math.abs(fwdSpeed) * 1.9 + (speed > 0.3 ? 0.6 : 0)) * dt;
    const amp = THREE.MathUtils.clamp(speed / 9, 0, 1) * (sk.turboActive ? 1.15 : 1);
    const bob = speed > 0.5 ? Math.sin(this.stride * 2) * 0.03 * amp : 0;

    // pivot: fall + spin + lean/roll. fall forward = pitch about model Z (negative), body then lies along +X
    const fallAng = this.fall * (Math.PI / 2);
    this.pivot.rotation.set(this.roll * (1 - this.fall), this.spin, -(this.lean * (1 - this.fall) + fallAng));
    this.pivot.position.set(this.fall * 0.35, bob + this.fall * 0.25 - (sk.isGoalie && sk.butterfly > 0 ? 0.28 : 0), 0);

    // ---------- bones ----------
    this.resetBones();
    const s = this.stride;
    const L = Math.sin(s),
      R = Math.sin(s + Math.PI);
    if (!sk.isGoalie || sk.butterfly === 0) {
      // legs: swing about side axis (Z), splay outward about forward axis (X), knee bend on backswing
      const swing = 0.55 * amp;
      this.rot('thigh.L', AX_Z, L * swing);
      this.rot('thigh.R', AX_Z, R * swing);
      this.rot('thigh.L', AX_X, Math.max(0, -L) * 0.35 * amp);
      this.rot('thigh.R', AX_X, -Math.max(0, -R) * 0.35 * amp);
      this.rot('shin.L', AX_Z, -Math.max(0, -L) * 0.9 * amp - 0.15 * amp);
      this.rot('shin.R', AX_Z, -Math.max(0, -R) * 0.9 * amp - 0.15 * amp);
      // keep blades flat
      this.rot('foot.L', AX_Z, -(L * swing - Math.max(0, -L) * 0.9 * amp - 0.15 * amp));
      this.rot('foot.R', AX_Z, -(R * swing - Math.max(0, -R) * 0.9 * amp - 0.15 * amp));
      // idle crouch
      const crouch = 0.12 + 0.18 * amp;
      this.rot('thigh.L', AX_Z, crouch);
      this.rot('thigh.R', AX_Z, crouch);
      this.rot('shin.L', AX_Z, -crouch * 1.4);
      this.rot('shin.R', AX_Z, -crouch * 1.4);
      this.rot('foot.L', AX_Z, crouch * 0.4);
      this.rot('foot.R', AX_Z, crouch * 0.4);
      // Ankles counter the whole-body forward lean so the support blade lies
      // along the ice instead of pitching its toe beneath it.
      if (!sk.isGoalie && this.fall < 0.02) {
        this.rot('foot.L', AX_Z, this.lean);
        this.rot('foot.R', AX_Z, this.lean);
      }
    } else {
      // goalie butterfly: knees drop, pads flare outward
      this.rot('thigh.L', AX_X, 1.1);
      this.rot('thigh.R', AX_X, -1.1);
      this.rot('thigh.L', AX_Z, 0.9);
      this.rot('thigh.R', AX_Z, 0.9);
      this.rot('shin.L', AX_Z, -1.8);
      this.rot('shin.R', AX_Z, -1.8);
    }
    // torso
    const twist = sk.charging ? -0.55 * sk.shotCharge : this.snapT > 0 ? 0.7 * (this.snapT / 0.35) : 0;
    this.rot('spine', AX_Z, -this.lean * 0.4);
    this.rot('chest', AX_Z, -this.lean * 0.5);
    this.rot('chest', AX_Y, twist + Math.sin(s) * 0.05 * amp);
    this.rot('chest', AX_X, this.roll * 0.3);
    // arms: subtle counter-swing while skating, raise on lunge, up on celebrate
    const armSwing = 0.18 * amp;
    this.rot('upperArm.L', AX_Z, R * armSwing);
    this.rot('upperArm.R', AX_Z, L * armSwing);
    if (sk.lunge > 0) {
      this.rot('upperArm.L', AX_Z, -1.1);
      this.rot('upperArm.R', AX_Z, -1.1);
      this.rot('foreArm.L', AX_Z, 0.6);
      this.rot('foreArm.R', AX_Z, 0.6);
    }
    if (this.celebrateT > 0) {
      const c = Math.min(1, this.celebrateT * 3);
      this.rot('upperArm.L', AX_Z, -2.3 * c);
      this.rot('upperArm.R', AX_Z, -2.3 * c);
      this.rot('upperArm.L', AX_X, 0.5 * c);
      this.rot('upperArm.R', AX_X, -0.5 * c);
    }
    // fight: guard stance, punches, staggers
    this.punchT = Math.max(0, this.punchT - dt);
    this.staggerT = Math.max(0, this.staggerT - dt);
    if (this.fightStance) {
      this.rot('upperArm.L', AX_Z, -1.5);
      this.rot('upperArm.R', AX_Z, -1.6);
      this.rot('upperArm.L', AX_X, 0.35);
      this.rot('upperArm.R', AX_X, -0.35);
      this.rot('foreArm.L', AX_Z, 1.4);
      this.rot('foreArm.R', AX_Z, 1.5);
      this.rot('chest', AX_Z, -0.15);
      this.rot('stick', AX_Z, 1.2);
      if (this.punchT > 0) {
        const k = Math.sin((this.punchT / 0.32) * Math.PI);
        this.rot('upperArm.R', AX_Z, -0.9 * k + (this.punchHigh ? -0.3 : 0.4) * k);
        this.rot('foreArm.R', AX_Z, -1.3 * k);
        this.rot('chest', AX_Y, -0.5 * k);
      }
      if (this.staggerT > 0) {
        const k = Math.sin((this.staggerT / 0.4) * Math.PI);
        this.rot('chest', AX_Z, 0.6 * k);
        this.rot('head', AX_Z, 0.5 * k);
        this.rot('head', AX_Y, 0.4 * k);
      }
    }
    // shockwave / laser windup poses
    if (sk.specialTimer > 0 && sk.specialKind === 'shockwave') {
      const k = Math.min(1, sk.specialTimer / 0.6);
      this.rot('chest', AX_Z, -0.9 * k);
      this.rot('upperArm.L', AX_Z, -2.4 * k);
      this.rot('upperArm.R', AX_Z, -2.4 * k);
    }
    // head tracks the puck direction (set externally via lookAt) — small yaw
    this.rot('head', AX_Y, this.headYaw);
    // knockdown: splay limbs
    if (this.fall > 0.02) {
      const f = this.fall;
      const n = this.fallSeed;
      this.rot('upperArm.L', AX_Z, -1.4 * f);
      this.rot('upperArm.R', AX_Z, -0.9 * f);
      this.rot('upperArm.L', AX_X, 0.8 * f);
      this.rot('upperArm.R', AX_X, -1.0 * f);
      this.rot('thigh.L', AX_X, (0.4 + Math.sin(n) * 0.3) * f);
      this.rot('thigh.R', AX_X, -(0.5 + Math.cos(n) * 0.3) * f);
      this.rot('shin.L', AX_Z, -0.6 * f);
      this.rot('head', AX_Z, -0.5 * f);
    }
    // wind-up while charging and toe-drag sweeps move the bottom hand (the stick follows it)
    if (sk.charging) {
      this.rot('upperArm.R', AX_Y, -0.11 * sk.shotCharge);
      this.rot('upperArm.R', AX_Z, 0.12 * sk.shotCharge);
    }
    if (sk.deke > 0 && sk.dekeKind !== 'spin') {
      const k = Math.sin(Math.min(1, sk.deke / 0.45) * Math.PI);
      // Positive Three.js Y rotation turns +X toward -Z; simulation left is
      // +y (render +Z). Mirror the rig sweep to follow the actual puck drag.
      const side = sk.dekeKind === 'dragL' ? -1 : 1;
      // With both gloves on the shaft, torso rotation carries the drag. Large
      // shoulder sweeps fold the correctly gripped stick behind the body.
      const armSweep = 0.15;
      this.rot('upperArm.R', AX_Y, side * 0.8 * k * armSweep);
      this.rot('foreArm.R', AX_Y, side * 0.3 * k * armSweep);
      this.rot('chest', AX_Y, side * 0.35 * k);
      this.rot('chest', AX_X, -side * 0.25 * k);
    }

    // Ground the lowest blade during normal skating; leave falls, lunges and
    // goalie butterfly poses free. Indicators remain on the simulation origin.
    if (!sk.isGoalie && this.fall < 0.02 && sk.lunge <= 0 && !this.fightStance && this.bladeContacts.length) {
      this.group.updateMatrixWorld(true);
      let low = Infinity;
      for (const { bone, points } of this.bladeContacts) for (const point of points) {
        low = Math.min(low, bone.localToWorld(tmpV.copy(point)).y);
      }
      this.pivot.position.y += 0.003 - low;
    }

    // stick-hand IK: keep both hands on the stick unless the arms are busy
    const armsFree = this.ikEnabled && !this.fightStance && this.celebrateT <= 0 && this.fall < 0.3 && sk.lunge <= 0 && !(sk.specialTimer > 0 && sk.specialKind === 'shockwave');
    if (armsFree && this.grips.length) {
      if (!sk.isGoalie && this.fall < 0.02) this.clearStickFromIce();
      this.solveArms();
    }
    // indicators
    this.ring.visible = sk.controlled;
    this.arrow.visible = sk.controlled;
    if (sk.controlled) this.arrow.position.y = 2.1 + Math.sin(time * 6) * 0.08;
    const onFire = sk.onFire > 0;
    this.flames.forEach((f, i) => {
      f.visible = onFire;
      if (onFire) {
        const ph = time * 14 + i * 2.1;
        f.position.set(-0.3 + Math.sin(ph) * 0.12, 1.0 + i * 0.25 + Math.sin(ph * 1.3) * 0.1, (i - 1) * 0.25);
        f.scale.set(0.8 + Math.sin(ph) * 0.3, 1 + Math.abs(Math.sin(ph * 0.7)) * 0.8, 0.8 + Math.cos(ph) * 0.3);
        f.rotation.z = -0.4;
      }
    });
    this.shadow.scale.setScalar(1 + this.fall * 0.9);
    if (this.jerseyMat) this.jerseyMat.emissive.setHex(sk.hp < 30 ? 0x330000 : onFire ? 0x552200 : 0x000000);
  }

  /** Lift the stick through its carrying arm, preserving the right-hand parent
   * grip. The left-hand IK follows afterward. Only correct penetration, leaving
   * intentionally lifted charge/deke poses alone.
   */
  private clearStickFromIce(): void {
    const arm = this.bones.get('upperArmR')?.bone, stick = this.bones.get('stick')?.bone;
    if (!arm || !stick || !this.stickContacts.length) return;
    this.group.updateMatrixWorld(true);
    const height = () => {
      let low = Infinity;
      for (const point of this.stickContacts) low = Math.min(low, stick.localToWorld(tmpV.copy(point)).y);
      return low;
    };
    if (height() >= 0.003) return;
    const base = arm.quaternion.clone();
    const pose = (angle: number) => {
      arm.quaternion.copy(base);
      this.rot('upperArm.R', AX_Z, angle);
      arm.updateMatrixWorld(true);
    };
    let low = 0, high = 1.2;
    pose(high);
    if (height() < 0.003) { pose(0); return; }
    for (let i = 0; i < 8; i++) {
      const mid = (low + high) / 2;
      pose(mid);
      if (height() < 0.003) low = mid;
      else high = mid;
    }
    pose(high);
  }

  /** Two-bone IK: rotate upper/fore arm so the hand lands on its grip point of the stick. */
  private solveArms(): void {
    const stick = this.bones.get('stick')?.bone;
    if (!stick) return;
    this.model.updateMatrixWorld(true);
    for (const g of this.grips) {
      const ua = this.bones.get(`upperArm${g.side}`);
      const fa = this.bones.get(`foreArm${g.side}`);
      const hand = this.bones.get(`hand${g.side}`)?.bone;
      if (!ua || !fa || !hand) continue;
      ua.bone.getWorldPosition(ikS);
      ikT.copy(g.offset);
      stick.localToWorld(ikT);
      ikD.subVectors(ikT, ikS);
      const maxReach = g.upper + g.fore - 0.01;
      let d = ikD.length();
      if (d < 1e-4) continue;
      if (d > maxReach) {
        ikD.multiplyScalar(maxReach / d);
        d = maxReach;
        ikT.addVectors(ikS, ikD);
      }
      ikD.divideScalar(d);
      // pole: out to the side and back, slightly down (in world, from the model's yaw)
      const yaw = this.group.rotation.y;
      const sideSign = g.side === 'L' ? -1 : 1; // Blender +Y (left) → glTF -Z
      ikP.set(-Math.sin(yaw) * sideSign * 0.7 - Math.cos(yaw) * 0.5, -0.35, -Math.cos(yaw) * sideSign * 0.7 + Math.sin(yaw) * 0.5).normalize();
      ikPerp.copy(ikP).addScaledVector(ikD, -ikP.dot(ikD));
      if (ikPerp.lengthSq() < 1e-6) ikPerp.set(0, -1, 0).addScaledVector(ikD, -ikD.y);
      ikPerp.normalize();
      const cosA = THREE.MathUtils.clamp((g.upper * g.upper + d * d - g.fore * g.fore) / (2 * g.upper * d), -1, 1);
      const a = Math.acos(cosA);
      ikE.copy(ikS).addScaledVector(ikD, g.upper * Math.cos(a)).addScaledVector(ikPerp, g.upper * Math.sin(a));
      // two passes: the first places the elbow, the second corrects drift from the parent chain
      for (let pass = 0; pass < 2; pass++) {
        this.aimBone(ua.bone, fa.bone, ikE);
        this.aimBone(fa.bone, hand, ikT);
      }
    }
  }
  /** Rotate `bone` (in place, minimal twist) so that `child`'s world position points at `target`. */
  private aimBone(bone: THREE.Bone, child: THREE.Bone, target: THREE.Vector3): void {
    bone.getWorldPosition(ikS);
    child.getWorldPosition(ikCur);
    ikRest.subVectors(ikCur, ikS).normalize();
    ikD.subVectors(target, ikS).normalize();
    ikQ.setFromUnitVectors(ikRest, ikD);
    // world delta → local: q_local' = inv(parentWorld) * delta * parentWorld * q_local
    const parent = bone.parent as THREE.Object3D;
    parent.getWorldQuaternion(ikParent);
    tmpQ.copy(ikParent).invert().multiply(ikQ).multiply(ikParent);
    bone.quaternion.premultiply(tmpQ);
    bone.updateMatrixWorld(true);
  }

  /** Aim the head toward a world point (sim coords). */
  lookAt(sk: Skater, px: number, py: number): void {
    const ang = Math.atan2(py - sk.pos.y, px - sk.pos.x);
    let d = ang - sk.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.headYaw = THREE.MathUtils.clamp(-d, -0.9, 0.9);
  }
}

/** Build a jersey spec for a team + player. */
export function jerseySpecFor(teamColor: string, teamIndex: number, logoSeed: string, initial: string, number: number, name?: string, logoOverride?: string): JerseySpec {
  const { secondary, accent } = teamPalette(teamColor);
  const shapes: LogoShape[] = ['circle', 'shield', 'diamond', 'star', 'hex'];
  let hsh = 0;
  for (let i = 0; i < logoSeed.length; i++) hsh = (hsh * 31 + logoSeed.charCodeAt(i)) >>> 0;
  const logo = logoOverride && (shapes as string[]).includes(logoOverride) ? (logoOverride as LogoShape) : shapes[hsh % shapes.length];
  return { primary: teamColor, secondary, accent, pattern: ((hsh >> 2) % 4) as StripePattern, logo, initial, number, name };
}
void teamPalette;
