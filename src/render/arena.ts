import * as THREE from 'three/webgpu';
import { normalView, positionView, float, pow, clamp, dot, normalize, uniform } from 'three/tsl';
import type { RinkTheme } from '../run/meta';
import { RINK } from '../sim/constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

/** Jumbotron, spotlights with volumetric cones, rafters and banners. */
export class Arena {
  group = new THREE.Group();
  /** Roof and suspended scoreboard appear only in low cinematic camera views. */
  overhead = new THREE.Group();
  private screenTex: THREE.CanvasTexture;
  private screenCanvas: HTMLCanvasElement;
  private lastDraw = -1;
  private cones: THREE.Mesh[] = [];
  private spotAmount = uniform(0.35);
  private spots: THREE.SpotLight[] = [];
  private coneMat: THREE.MeshBasicNodeMaterial | null = null;
  private baseSpot = new THREE.Color(0xfff2dd);
  private flashT = 0;
  private flashDur = 0;
  private flashColor = new THREE.Color(0xffffff);

  constructor(theme: RinkTheme) {
    this.group.add(this.overhead);
    // --- rafters ---
    const rafterMat = new THREE.MeshStandardMaterial({ color: 0x1a1d28, roughness: 0.9, metalness: 0.3 });
    for (let i = -2; i <= 2; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, RINK.width + 26), rafterMat);
      beam.position.set(i * 12, 17, 0);
      this.overhead.add(beam);
    }
    for (const z of [-14, 14]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(RINK.length + 30, 0.8, 0.5), rafterMat);
      beam.position.set(0, 17, z);
      this.overhead.add(beam);
    }
    // --- jumbotron ---
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 512;
    this.screenCanvas.height = 256;
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(7, 3.6, 7), new THREE.MeshStandardMaterial({ color: 0x0c0e16, roughness: 0.6, metalness: 0.5 }));
    frame.position.set(0, 12.5, 0);
    this.overhead.add(frame);
    const screenMat = new THREE.MeshStandardMaterial({ map: this.screenTex, emissiveMap: this.screenTex, emissive: 0xffffff, emissiveIntensity: 1.6, color: 0x000000, roughness: 0.4 });
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.1), screenMat);
      const ang = (i / 4) * Math.PI * 2;
      s.position.set(Math.sin(ang) * 3.52, 12.5, Math.cos(ang) * 3.52);
      s.rotation.y = ang;
      this.overhead.add(s);
    }
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), rafterMat);
    cable.position.set(0, 15.8, 0);
    this.overhead.add(cable);
    // --- banners ---
    const texts: string[] = theme.banners;
    texts.forEach((t: string, i: number) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 512;
      const g = c.getContext('2d')!;
      g.fillStyle = i % 2 ? '#d8262f' : '#1c4fd6';
      g.fillRect(0, 0, 256, 512);
      g.fillStyle = '#ffffff';
      g.fillRect(16, 16, 224, 480);
      g.fillStyle = i % 2 ? '#d8262f' : '#1c4fd6';
      g.font = 'bold 44px Impact, "Arial Black", sans-serif';
      g.textAlign = 'center';
      const words = t.split(' ');
      words.forEach((w: string, k: number) => g.fillText(w, 128, 120 + k * 70));
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.4), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
      const x = -18 + i * 12;
      b.position.set(x, 13.5, -13.6);
      this.group.add(b);
    });
    // --- spotlights + volumetric cones ---
    const spotColor = new THREE.Color(theme.spot);
    const coneMat = new THREE.MeshBasicNodeMaterial();
    this.coneMat = coneMat;
    this.baseSpot.copy(spotColor);
    coneMat.transparent = true;
    coneMat.depthWrite = false;
    coneMat.blending = THREE.AdditiveBlending;
    coneMat.side = THREE.DoubleSide;
    coneMat.color = spotColor.clone().multiplyScalar(0.35);
    const viewDir: N = normalize(positionView.negate());
    const rim: N = pow(clamp(dot(normalView, viewDir), 0, 1), float(1.8));
    // fade toward the wide end (uv.y ≈ 0 at base for ConeGeometry)
    coneMat.opacityNode = rim.mul(this.spotAmount).mul(float(0.035));
    const corners = [
      [-20, -12],
      [20, -12],
      [-20, 12],
      [20, 12],
    ];
    for (const [x, z] of corners) {
      const light = new THREE.SpotLight(spotColor, 90, 60, Math.PI / 7, 0.6, 1.4);
      light.position.set(x, 16.5, z);
      light.target.position.set(x * 0.35, 0, z * 0.35);
      this.group.add(light, light.target);
      this.spots.push(light);
      const h = 16.5;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(4.2, h, 20, 1, true), coneMat);
      const dir = new THREE.Vector3(x * 0.35 - x, -h, z * 0.35 - z);
      const mid = new THREE.Vector3(x, 16.5, z).add(dir.clone().multiplyScalar(0.5));
      cone.position.copy(mid);
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
      this.group.add(cone);
      this.cones.push(cone);
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.9, 10), rafterMat);
      housing.position.set(x, 16.3, z);
      this.group.add(housing);
    }
  }

  /** Draw the jumbotron: score/clock or arbitrary lines. Cheap; call at ~10 Hz. */
  drawScreen(lines: { text: string; color?: string; size?: number }[], time: number): void {
    if (time - this.lastDraw < 0.1) return;
    this.lastDraw = time;
    const g = this.screenCanvas.getContext('2d')!;
    const W = this.screenCanvas.width,
      H = this.screenCanvas.height;
    g.fillStyle = '#05070f';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#1c4fd6';
    g.fillRect(0, 0, W, 10);
    g.fillRect(0, H - 10, W, 10);
    g.textAlign = 'center';
    let y = 20;
    for (const l of lines) {
      const size = l.size ?? 48;
      g.font = `bold ${size}px Impact, "Arial Black", sans-serif`;
      g.fillStyle = l.color ?? '#ffffff';
      y += size;
      g.fillText(l.text, W / 2, y);
      y += 10;
    }
    this.screenTex.needsUpdate = true;
  }

  setSpotAmount(v: number): void {
    this.spotAmount.value = v;
  }

  /** Goal light show: spots + cones strobe in the scoring team's color. */
  flash(color: string | number, seconds = 2.5): void {
    this.flashColor.set(color);
    this.flashT = 0;
    this.flashDur = seconds;
  }

  update(dt: number): void {
    if (this.flashDur <= 0) return;
    this.flashT += dt;
    const k = this.flashT / this.flashDur;
    if (k >= 1) {
      this.flashDur = 0;
      for (const l of this.spots) {
        l.color.copy(this.baseSpot);
        l.intensity = 90;
      }
      if (this.coneMat) this.coneMat.color.copy(this.baseSpot).multiplyScalar(0.35);
      this.spotAmount.value = 0.35;
      return;
    }
    const strobe = 0.5 + 0.5 * Math.sin(this.flashT * 22);
    const c = this.baseSpot.clone().lerp(this.flashColor, 0.8 * (1 - k));
    for (const l of this.spots) {
      l.color.copy(c);
      l.intensity = 90 + 160 * strobe * (1 - k);
    }
    if (this.coneMat) this.coneMat.color.copy(c).multiplyScalar(0.35 + 0.5 * strobe * (1 - k));
    this.spotAmount.value = 0.35 + 0.9 * strobe * (1 - k);
  }
}
