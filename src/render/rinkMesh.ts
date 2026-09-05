import * as THREE from 'three/webgpu';
import { RINK } from '../sim/constants';
import { GOALS } from '../sim/rink';
import type { RinkTheme } from '../run/meta';
import { makeIceMaterial, makeScratchTextures, type IceMaterial } from './iceMaterial';
import { Crowd } from './crowd';
import { Arena } from './arena';
import { RINK_THEMES } from '../run/meta';

export function roundedRectPath(hx: number, hy: number, r: number, segs = 10): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= segs; i++) {
      const a = a0 + (i / segs) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  corner(hx - r, hy - r, 0);
  corner(-hx + r, hy - r, Math.PI / 2);
  corner(-hx + r, -hy + r, Math.PI);
  corner(hx - r, -hy + r, Math.PI * 1.5);
  return pts;
}

function makeIceTexture(): THREE.CanvasTexture {
  const W = 2080,
    H = 1040; // 40 px per meter
  const s = W / RINK.length;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#eef6ff');
  grad.addColorStop(0.5, '#f7fbff');
  grad.addColorStop(1, '#e6f0fb');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  const cx = W / 2,
    cy = H / 2;
  const X = (m: number) => cx + m * s;
  const Y = (m: number) => cy + m * s;
  const line = (x: number, color: string, w: number) => {
    g.fillStyle = color;
    g.fillRect(X(x) - w / 2, 0, w, H);
  };
  line(-RINK.goalLineX, '#d8262f', 5);
  line(RINK.goalLineX, '#d8262f', 5);
  line(-RINK.blueLineX, '#1c4fd6', 14);
  line(RINK.blueLineX, '#1c4fd6', 14);
  line(0, '#d8262f', 14);
  g.fillStyle = '#fff';
  for (let y = 0; y < H; y += 40) g.fillRect(cx - 3, y, 6, 20);
  const circle = (x: number, y: number, rM: number, color: string, w: number) => {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.beginPath();
    g.arc(X(x), Y(y), rM * s, 0, Math.PI * 2);
    g.stroke();
  };
  const dot = (x: number, y: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    g.arc(X(x), Y(y), 0.3 * s, 0, Math.PI * 2);
    g.fill();
  };
  circle(0, 0, 4.5, '#1c4fd6', 6);
  dot(0, 0, '#1c4fd6');
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      circle(sx * RINK.faceoffDotX, sy * RINK.faceoffDotY, 4.5, '#d8262f', 6);
      dot(sx * RINK.faceoffDotX, sy * RINK.faceoffDotY, '#d8262f');
    }
  for (const gl of GOALS) {
    g.fillStyle = 'rgba(80,140,255,0.35)';
    g.beginPath();
    const a0 = gl.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.arc(X(gl.lineX), Y(0), RINK.creaseRadius * s, a0, a0 + Math.PI);
    g.fill();
    g.strokeStyle = '#d8262f';
    g.lineWidth = 5;
    g.stroke();
  }
  g.save();
  g.translate(cx, cy);
  g.font = 'bold 150px Impact, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(28,79,214,0.22)';
  g.fillText('HOKYZ', 0, 0);
  g.restore();
  g.font = 'bold 64px Impact, "Arial Black", sans-serif';
  g.fillStyle = 'rgba(216,38,47,0.18)';
  g.textAlign = 'center';
  for (const x of [-12, 12]) {
    g.fillText('BIG HITZ', X(x), Y(-9));
    g.fillText('TURBO', X(x), Y(9));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.flipY = false;
  return tex;
}

/** Ad strip for the boards: repeating panels, 6 m each, 6 panels per texture repeat. */
function makeAdTexture(theme: RinkTheme): THREE.CanvasTexture {
  const panels = [
    ['HOKYZ', '#ffffff', '#1c4fd6'],
    ['BIG HITZ', '#ffd23f', '#111111'],
    ['RAGE FUEL', '#ffffff', '#d8262f'],
    ['ZAMBONI CO.', '#111111', '#e8e8e8'],
    ['TURBO', '#ffffff', '#ff7a1a'],
    ['ICE BATH', '#0b1c3a', '#9fd3ff'],
  ];
  const PW = 512,
    PH = 128;
  const c = document.createElement('canvas');
  c.width = PW * panels.length;
  c.height = PH;
  const g = c.getContext('2d')!;
  panels.forEach(([text, fg, bg], i) => {
    g.fillStyle = bg;
    g.fillRect(i * PW, 0, PW, PH);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(i * PW, 0, 6, PH);
    g.fillStyle = fg;
    g.font = `bold ${PH * 0.62}px Impact, "Arial Black", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, i * PW + PW / 2, PH / 2 + 4);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  void theme;
  return tex;
}

/** Vertical ribbon along a closed 2D path. u = distance / uMeters, v = 0..1 bottom→top. Normals face the origin. */
function ribbon(path: THREE.Vector2[], y0: number, y1: number, uMeters: number, inset = 0): THREE.BufferGeometry {
  const n = path.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  let dist = 0;
  for (let i = 0; i <= n; i++) {
    const p = path[i % n];
    if (i > 0) dist += p.distanceTo(path[(i - 1) % n]);
    const len = Math.hypot(p.x, p.y) || 1;
    const nx = -p.x / len,
      nz = -p.y / len;
    const px = p.x + nx * inset,
      pz = p.y + nz * inset;
    pos.push(px, y0, pz, px, y1, pz);
    nor.push(nx, 0, nz, nx, 0, nz);
    const u = dist / uMeters;
    uvs.push(u, 0, u, 1);
    if (i < n) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  return geo;
}

export interface RinkOpts {
  reflect: boolean;
  marks: THREE.Texture | null;
  metal: { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture } | null;
  crowdAnim: boolean;
}

let scratchCache: ReturnType<typeof makeScratchTextures> | null = null;
let linesCache: THREE.CanvasTexture | null = null;

export class RinkMesh {
  group = new THREE.Group();
  crowd: Crowd;
  arena: Arena;
  goalLights: THREE.PointLight[] = [];
  ice: IceMaterial;

  constructor(theme: RinkTheme = RINK_THEMES.classic, opts: RinkOpts = { reflect: false, marks: null, metal: null, crowdAnim: false }) {
    const hx = RINK.length / 2,
      hy = RINK.width / 2;
    // --- ice ---
    const shape = new THREE.Shape(roundedRectPath(hx, hy, RINK.cornerRadius));
    const iceGeo = new THREE.ShapeGeometry(shape, 12);
    scratchCache ??= makeScratchTextures(1024);
    linesCache ??= makeIceTexture();
    this.ice = makeIceMaterial({ lines: linesCache, marks: opts.marks, reflect: opts.reflect, scratch: scratchCache });
    const ice = new THREE.Mesh(iceGeo, this.ice.material);
    ice.rotation.x = Math.PI / 2; // shape (x,y) → world (x, z): sim y = world z
    ice.receiveShadow = true;
    this.group.add(ice);
    if (this.ice.reflectorTarget) {
      this.ice.reflectorTarget.rotation.x = -Math.PI / 2; // mirror plane normal +Y
      this.ice.reflectorTarget.position.y = 0.001;
      this.group.add(this.ice.reflectorTarget);
    }

    // outer floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    this.group.add(floor);

    // --- boards as ribbons: kick plate (metal), ad boards, cap rail, glass ---
    const path = roundedRectPath(hx + 0.15, hy + 0.15, RINK.cornerRadius + 0.15, 12);
    const kickColor = new THREE.Color(theme?.kick ?? 0xe8b021);
    const kickMat = opts.metal
      ? new THREE.MeshStandardMaterial({ map: opts.metal.color, normalMap: opts.metal.normal, roughnessMap: opts.metal.rough, color: kickColor, roughness: 0.6, metalness: 0.35 })
      : new THREE.MeshStandardMaterial({ color: kickColor, roughness: 0.5, metalness: 0.3 });
    if (opts.metal) {
      for (const t of [opts.metal.color, opts.metal.normal, opts.metal.rough]) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
      }
    }
    const kick = new THREE.Mesh(ribbon(path, 0, 0.24, 1.5), kickMat);
    kick.castShadow = true;
    kick.receiveShadow = true;
    this.group.add(kick);
    const ads = new THREE.Mesh(ribbon(path, 0.24, 1.05, 36), new THREE.MeshStandardMaterial({ map: makeAdTexture(theme ?? ({} as RinkTheme)), roughness: 0.5, metalness: 0.05 }));
    ads.castShadow = true;
    ads.receiveShadow = true;
    this.group.add(ads);
    const rail = new THREE.Mesh(ribbon(path, 1.05, 1.12, 10, -0.06), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.4, metalness: 0.1 }));
    this.group.add(rail);
    const glass = new THREE.Mesh(ribbon(path, 1.12, 2.7, 10, -0.02), new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.2 }));
    this.group.add(glass);
    // glass stanchions
    const stanchionGeo = new THREE.BoxGeometry(0.05, 1.6, 0.05);
    const stanchionMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.4, metalness: 0.8 });
    let acc = 0;
    for (let i = 0; i < path.length; i++) {
      const a = path[i],
        b = path[(i + 1) % path.length];
      acc += a.distanceTo(b);
      if (acc >= 2.4) {
        acc = 0;
        const m = new THREE.Mesh(stanchionGeo, stanchionMat);
        m.position.set(a.x, 1.12 + 0.8, a.y);
        this.group.add(m);
      }
    }

    // --- nets ---
    const postMat = new THREE.MeshStandardMaterial({ color: 0xe03030, roughness: 0.35, metalness: 0.4 });
    const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, roughness: 1 });
    for (const gl of GOALS) {
      const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.25, 10);
      for (const p of gl.posts) {
        const m = new THREE.Mesh(postGeo, postMat);
        m.position.set(p.x, 0.62, p.y);
        m.castShadow = true;
        this.group.add(m);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, RINK.goalWidth, 10), postMat);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(gl.lineX, 1.22, 0);
      this.group.add(bar);
      const net = new THREE.Mesh(new THREE.BoxGeometry(RINK.goalDepth, 1.2, RINK.goalWidth), netMat);
      net.position.set((gl.lineX + gl.backX) / 2, 0.6, 0);
      this.group.add(net);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(net.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
      edges.position.copy(net.position);
      this.group.add(edges);
      const light = new THREE.PointLight(0xff2020, 0, 14, 2);
      light.position.set(gl.backX + gl.dir * 1.2, 1.8, 0);
      this.group.add(light);
      this.goalLights.push(light);
    }

    // --- crowd + arena ---
    this.crowd = new Crowd(theme.crowd, opts.crowdAnim);
    this.group.add(this.crowd.group);
    this.arena = new Arena(theme);
    this.group.add(this.arena.group);
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const pts = roundedRectPath(hx + 3.0 + r * 1.2, hy + 3.0 + r * 1.2, RINK.cornerRadius + 2.6 + r, 6);
      const standShape = new THREE.Shape(pts);
      const inner = roundedRectPath(hx + 1.8 + r * 1.2, hy + 1.8 + r * 1.2, RINK.cornerRadius + 1.6 + r, 6);
      standShape.holes.push(new THREE.Path(inner.reverse()));
      const geo = new THREE.ExtrudeGeometry(standShape, { depth: 0.35 + r * 0.75, bevelEnabled: false });
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1b1b26, roughness: 1 }));
      m.rotation.x = Math.PI / 2;
      m.position.y = 0.35 + r * 0.75;
      this.group.add(m);
    }
  }

  update(time: number, dt: number, excite: number): void {
    this.crowd.update(dt, excite);
    this.arena.update(dt);
    for (const l of this.goalLights) l.intensity = Math.max(0, l.intensity - dt * 25);
    void time;
  }

  flashGoal(team: 0 | 1): void {
    this.goalLights[team].intensity = 40;
    this.crowd.startWave();
  }
}
