import * as THREE from 'three/webgpu';
import { texture, vec2, vec3, vec4, float, positionWorld, normalView, positionView, reflector, uniform, clamp, pow, dot, normalize, transformNormalToView } from 'three/tsl';
import { RINK } from '../sim/constants';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

/** Procedural scratched-ice height → tangent normal + roughness, baked once to a canvas. */
export function makeScratchTextures(size = 1024): { normal: THREE.CanvasTexture; rough: THREE.CanvasTexture } {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  // soft blotches (frost / resurfacing unevenness)
  for (let i = 0; i < 260; i++) {
    const r = 20 + Math.random() * 90;
    const x = Math.random() * size,
      y = Math.random() * size;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const v = 118 + Math.floor(Math.random() * 20);
    grad.addColorStop(0, `rgba(${v},${v},${v},0.35)`);
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // blade scratches: long thin strokes, mostly along the rink length (x) with curves
  g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size,
      y = Math.random() * size;
    const ang = (Math.random() - 0.5) * 0.9 + (Math.random() < 0.5 ? 0 : Math.PI);
    const len = 20 + Math.random() * 140;
    const bend = (Math.random() - 0.5) * 0.6;
    g.strokeStyle = Math.random() < 0.5 ? `rgba(160,160,160,${0.25 + Math.random() * 0.4})` : `rgba(96,96,96,${0.25 + Math.random() * 0.4})`;
    g.lineWidth = 0.6 + Math.random() * 1.6;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(ang + bend) * len * 0.5, y + Math.sin(ang + bend) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  // height → normal (Sobel)
  const img = g.getImageData(0, 0, size, size);
  const h = (x: number, y: number) => img.data[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;
  const out = g.createImageData(size, size);
  const rough = document.createElement('canvas');
  rough.width = size;
  rough.height = size;
  const rg = rough.getContext('2d')!;
  const rimg = rg.createImageData(size, size);
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const nx = -dx,
        ny = -dy,
        nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      out.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
      // roughness: scratches are rougher than glassy ice
      const dev = Math.abs(h(x, y) - 0.5) * 2;
      const r = Math.min(255, 30 + dev * 420);
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = r;
      rimg.data[i + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  rg.putImageData(rimg, 0, 0);
  const normal = new THREE.CanvasTexture(c);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.colorSpace = THREE.NoColorSpace;
  const roughT = new THREE.CanvasTexture(rough);
  roughT.wrapS = roughT.wrapT = THREE.RepeatWrapping;
  roughT.colorSpace = THREE.NoColorSpace;
  return { normal, rough: roughT };
}

export interface IceMaterialOpts {
  lines: THREE.Texture; // painted lines canvas (uv 0..1 over the rink)
  marks: THREE.Texture | null; // skate-mark accumulation (white = clean)
  reflect: boolean;
  scratch: { normal: THREE.Texture; rough: THREE.Texture };
}

export interface IceMaterial {
  material: THREE.MeshStandardNodeMaterial;
  reflectorTarget: THREE.Object3D | null;
  marksStrength: ReturnType<typeof uniform>;
}

export function makeIceMaterial(o: IceMaterialOpts): IceMaterial {
  const m = new THREE.MeshStandardNodeMaterial();
  m.side = THREE.DoubleSide;
  // world-space uv over the rink (x along length, z across width)
  const rinkUV: N = vec2(positionWorld.x.div(RINK.length).add(0.5), positionWorld.z.div(RINK.width).add(0.5));
  const tileUV: N = vec2(positionWorld.x, positionWorld.z).mul(0.16);
  const linesTex: N = texture(o.lines, rinkUV);
  const scratchN: N = texture(o.scratch.normal, tileUV);
  const scratchR: N = texture(o.scratch.rough, tileUV).r;
  const marksStrength = uniform(o.marks ? 1 : 0);
  const marks: N = o.marks ? texture(o.marks, rinkUV).r : float(1);
  const scuff: N = float(1).sub(marks).mul(marksStrength); // 0 clean → 1 heavy
  // albedo: painted lines, slightly darkened by scuffs
  let color: N = linesTex.rgb.mul(float(1).sub(scuff.mul(0.18)));
  // roughness: glassy base, scratches + scuffs roughen
  const rough: N = clamp(float(0.12).add(scratchR.mul(0.35)).add(scuff.mul(0.45)), 0.05, 0.95);
  m.roughnessNode = rough;
  m.metalnessNode = float(0.0);
  // normal: tangent-space scratch normal (ice is horizontal; tangent frame ≈ world xz)
  const nrm: N = scratchN.rgb.mul(2).sub(1);
  const normalStrength: N = float(0.55).add(scuff.mul(0.8));
  const perturbed: N = normalize(vec3(nrm.x.mul(normalStrength), float(1), nrm.y.mul(normalStrength)));
  // world-space normal → view space
  m.normalNode = transformNormalToView(perturbed);
  let reflectorTarget: THREE.Object3D | null = null;
  if (o.reflect) {
    const refl: N = reflector({ resolutionScale: 0.5, bounces: false });
    reflectorTarget = refl.target;
    // distort reflection by scratches, blur by roughness (cheap: mix toward base with rough)
    refl.uvNode = refl.uvNode.add(nrm.xy.mul(0.012));
    const viewDir: N = normalize(positionView.negate());
    const facing: N = clamp(dot(normalView, viewDir), 0, 1);
    const fresnel: N = pow(float(1).sub(facing), 3.2).mul(0.85).add(0.08);
    const reflAmount: N = fresnel.mul(float(1).sub(rough).mul(1.1)).mul(float(1).sub(scuff.mul(0.6)));
    // add reflection as emissive so it isn't re-lit
    m.emissiveNode = vec3(refl.rgb).mul(reflAmount).mul(0.9);
    color = color.mul(float(1).sub(reflAmount.mul(0.35)));
  }
  m.colorNode = vec4(color, 1);
  return { material: m, reflectorTarget, marksStrength };
}
