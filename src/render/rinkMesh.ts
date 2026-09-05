import * as THREE from 'three';
import { RINK } from '../sim/constants';
import { GOALS } from '../sim/rink';
import type { RinkTheme } from '../run/meta';

function roundedRectPath(hx: number, hy: number, r: number, segs = 10): THREE.Vector2[] {
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
  // ice base
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#eef6ff');
  grad.addColorStop(0.5, '#f7fbff');
  grad.addColorStop(1, '#e6f0fb');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // subtle scratches
  g.strokeStyle = 'rgba(180,200,225,0.25)';
  g.lineWidth = 1;
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * W,
      y = Math.random() * H;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (Math.random() - 0.5) * 120, y + (Math.random() - 0.5) * 40);
    g.stroke();
  }
  const cx = W / 2,
    cy = H / 2;
  const X = (m: number) => cx + m * s;
  const Y = (m: number) => cy + m * s;
  const line = (x: number, color: string, w: number) => {
    g.fillStyle = color;
    g.fillRect(X(x) - w / 2, 0, w, H);
  };
  // goal lines, blue lines, center
  line(-RINK.goalLineX, '#d8262f', 5);
  line(RINK.goalLineX, '#d8262f', 5);
  line(-RINK.blueLineX, '#1c4fd6', 14);
  line(RINK.blueLineX, '#1c4fd6', 14);
  line(0, '#d8262f', 14);
  // dashed white on center line
  g.fillStyle = '#fff';
  for (let y = 0; y < H; y += 40) g.fillRect(cx - 3, y, 6, 20);
  // circles
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
  // creases
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
  // center logo
  g.save();
  g.translate(cx, cy);
  g.font = 'bold 150px Impact, "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(28,79,214,0.22)';
  g.fillText('HOKYZ', 0, 0);
  g.restore();
  // sponsor stripes near boards
  g.font = 'bold 64px Impact, "Arial Black", sans-serif';
  g.fillStyle = 'rgba(216,38,47,0.18)';
  g.textAlign = 'center';
  for (const x of [-12, 12]) {
    g.fillText('BIG HITZ', X(x), Y(-9));
    g.fillText('TURBO', X(x), Y(9));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.anisotropy = 8;
  return tex;
}

export class RinkMesh {
  group = new THREE.Group();
  crowd: THREE.InstancedMesh;
  crowdBase: Float32Array;
  crowdExcite = 0;
  goalLights: THREE.PointLight[] = [];
  private tmp = new THREE.Object3D();

  constructor(theme?: RinkTheme) {
    const hx = RINK.length / 2,
      hy = RINK.width / 2;
    // --- ice ---
    const shape = new THREE.Shape(roundedRectPath(hx, hy, RINK.cornerRadius));
    const iceGeo = new THREE.ShapeGeometry(shape, 12);
    const tex = makeIceTexture();
    // ShapeGeometry uv = xy in local units → remap to 0..1
    const uv = iceGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) / RINK.length + 0.5, uv.getY(i) / RINK.width + 0.5);
    }
    const iceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide });
    const ice = new THREE.Mesh(iceGeo, iceMat);
    ice.rotation.x = Math.PI / 2; // shape (x,y) → world (x, z): sim y = world z
    ice.receiveShadow = true;
    this.group.add(ice);

    // outer floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    this.group.add(floor);

    // --- boards + glass ---
    const path = roundedRectPath(hx + 0.15, hy + 0.15, RINK.cornerRadius + 0.15, 8);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.6 });
    const kickMat = new THREE.MeshStandardMaterial({ color: theme?.kick ?? 0xe8b021, roughness: 0.5 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
    const boardGeo = new THREE.BoxGeometry(1, 1.05, 0.25);
    const kickGeo = new THREE.BoxGeometry(1, 0.22, 0.27);
    const glassGeo = new THREE.BoxGeometry(1, 1.6, 0.06);
    for (let i = 0; i < path.length; i++) {
      const a = path[i],
        b = path[(i + 1) % path.length];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const L = Math.hypot(dx, dy) + 0.02;
      if (L < 0.01) continue;
      const ang = Math.atan2(dy, dx);
      const mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2;
      const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(mx, y, my);
        m.rotation.y = -ang;
        m.scale.x = L;
        m.castShadow = true;
        m.receiveShadow = true;
        this.group.add(m);
      };
      mk(boardGeo, boardMat, 0.52);
      mk(kickGeo, kickMat, 0.11);
      mk(glassGeo, glassMat, 1.05 + 0.8);
    }

    // --- nets ---
    const postMat = new THREE.MeshStandardMaterial({ color: 0xe03030, roughness: 0.4, metalness: 0.3 });
    const netMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, roughness: 1 });
    for (const gl of GOALS) {
      const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.25, 8);
      for (const p of gl.posts) {
        const m = new THREE.Mesh(postGeo, postMat);
        m.position.set(p.x, 0.62, p.y);
        m.castShadow = true;
        this.group.add(m);
      }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, RINK.goalWidth, 8), postMat);
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

    // --- crowd ---
    const rows = 4;
    const perRow: THREE.Vector2[][] = [];
    let total = 0;
    for (let r = 0; r < rows; r++) {
      const pts = roundedRectPath(hx + 2.2 + r * 1.2, hy + 2.2 + r * 1.2, RINK.cornerRadius + 2 + r, 6);
      // resample along path every ~1.1m
      const out: THREE.Vector2[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i],
          b = pts[(i + 1) % pts.length];
        const L = a.distanceTo(b);
        const n = Math.max(1, Math.round(L / 1.1));
        for (let k = 0; k < n; k++) out.push(a.clone().lerp(b, k / n));
      }
      perRow.push(out);
      total += out.length;
    }
    const crowdGeo = new THREE.BoxGeometry(0.6, 0.9, 0.5);
    const crowdMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    this.crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, total);
    this.crowdBase = new Float32Array(total * 3);
    let idx = 0;
    const palette = theme?.crowd ?? [0xd8262f, 0x1c4fd6, 0xffffff, 0x222222, 0xe8b021, 0x2fa84f, 0x8844cc];
    for (let r = 0; r < rows; r++) {
      for (const p of perRow[r]) {
        const y = 0.6 + r * 0.75 + Math.random() * 0.1;
        this.crowdBase[idx * 3] = p.x;
        this.crowdBase[idx * 3 + 1] = y;
        this.crowdBase[idx * 3 + 2] = p.y;
        this.tmp.position.set(p.x, y, p.y);
        this.tmp.rotation.set(0, Math.random() * 0.4 - 0.2, 0);
        this.tmp.updateMatrix();
        this.crowd.setMatrixAt(idx, this.tmp.matrix);
        this.crowd.setColorAt(idx, new THREE.Color(palette[Math.floor(Math.random() * palette.length)]));
        idx++;
      }
    }
    this.crowd.instanceMatrix.needsUpdate = true;
    if (this.crowd.instanceColor) this.crowd.instanceColor.needsUpdate = true;
    this.group.add(this.crowd);
    // stands base
    for (let r = 0; r < rows; r++) {
      const pts = roundedRectPath(hx + 2.2 + r * 1.2, hy + 2.2 + r * 1.2, RINK.cornerRadius + 2 + r, 6);
      const standShape = new THREE.Shape(pts);
      const inner = roundedRectPath(hx + 1.6 + r * 1.2, hy + 1.6 + r * 1.2, RINK.cornerRadius + 1.6 + r, 6);
      standShape.holes.push(new THREE.Path(inner.reverse()));
      const geo = new THREE.ExtrudeGeometry(standShape, { depth: 0.75 * (r + 1) - 0.4, bevelEnabled: false });
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1b1b26, roughness: 1 }));
      m.rotation.x = Math.PI / 2;
      m.position.y = 0.75 * (r + 1) - 0.4;
      this.group.add(m);
    }
  }

  update(time: number, dt: number, excite: number): void {
    this.crowdExcite += (excite - this.crowdExcite) * Math.min(1, dt * 4);
    const n = this.crowd.count;
    const amp = 0.05 + this.crowdExcite * 0.35;
    for (let i = 0; i < n; i++) {
      const bx = this.crowdBase[i * 3],
        by = this.crowdBase[i * 3 + 1],
        bz = this.crowdBase[i * 3 + 2];
      const phase = i * 0.37;
      const bob = Math.abs(Math.sin(time * (3 + this.crowdExcite * 6) + phase)) * amp;
      this.tmp.position.set(bx, by + bob, bz);
      this.tmp.rotation.set(0, Math.sin(phase) * 0.2, 0);
      this.tmp.updateMatrix();
      this.crowd.setMatrixAt(i, this.tmp.matrix);
    }
    this.crowd.instanceMatrix.needsUpdate = true;
    for (const l of this.goalLights) l.intensity = Math.max(0, l.intensity - dt * 25);
  }

  flashGoal(team: 0 | 1): void {
    // light behind the goal that got scored ON: team index = defending team's goal
    this.goalLights[team].intensity = 40;
  }
}
