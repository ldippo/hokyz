import * as THREE from 'three/webgpu';
import { RINK } from '../sim/constants';

/** Accumulates blade scuffs into a render target mapped over the rink (white = clean). */
export class SkateMarks {
  rt: THREE.RenderTarget;
  private scene = new THREE.Scene();
  private cam: THREE.OrthographicCamera;
  private mesh: THREE.InstancedMesh;
  private tmp = new THREE.Object3D();
  private pending: { x: number; y: number; ang: number; len: number; w: number }[] = [];
  private needsClear = true;
  readonly max = 96;

  constructor(width = 1024) {
    const height = Math.round((width * RINK.width) / RINK.length);
    this.rt = new THREE.RenderTarget(width, height, { depthBuffer: false, format: THREE.RGBAFormat, type: THREE.UnsignedByteType, generateMipmaps: false });
    this.rt.texture.minFilter = THREE.LinearFilter;
    this.rt.texture.magFilter = THREE.LinearFilter;
    this.cam = new THREE.OrthographicCamera(-RINK.length / 2, RINK.length / 2, RINK.width / 2, -RINK.width / 2, 0.1, 10);
    this.cam.position.set(0, 5, 0);
    this.cam.up.set(0, 0, -1);
    this.cam.lookAt(0, 0, 0);
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x8a94a8, transparent: true, opacity: 0.16, depthTest: false, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  get texture(): THREE.Texture {
    return this.rt.texture;
  }

  /** Queue a scuff at sim position (x,y), oriented along ang (rad). */
  stamp(x: number, y: number, ang: number, len: number, w = 0.06): void {
    if (this.pending.length < this.max) this.pending.push({ x, y, ang, len, w });
  }

  clear(): void {
    this.needsClear = true;
  }

  render(renderer: THREE.WebGPURenderer): void {
    if (!this.needsClear && this.pending.length === 0) return;
    const prevTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    renderer.setRenderTarget(this.rt);
    if (this.needsClear) {
      renderer.setClearColor(0xffffff, 1);
      renderer.clear();
      this.needsClear = false;
    }
    renderer.autoClear = false;
    let n = 0;
    for (const p of this.pending) {
      this.tmp.position.set(p.x, 0, p.y);
      this.tmp.rotation.set(0, -p.ang, 0);
      this.tmp.scale.set(p.len, 1, p.w);
      this.tmp.updateMatrix();
      this.mesh.setMatrixAt(n++, this.tmp.matrix);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.pending.length = 0;
    if (n > 0) renderer.render(this.scene, this.cam);
    renderer.autoClear = prevAutoClear;
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(0x000000, 1);
  }

  dispose(): void {
    this.rt.dispose();
  }
}
