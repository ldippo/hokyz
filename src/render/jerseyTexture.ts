import * as THREE from 'three/webgpu';

export type StripePattern = 0 | 1 | 2 | 3;
export type LogoShape = 'circle' | 'shield' | 'diamond' | 'star' | 'hex';

export interface JerseySpec {
  primary: string;
  secondary: string;
  accent: string;
  pattern: StripePattern;
  logo: LogoShape;
  initial: string;
  number: number;
  name?: string;
}

const cache = new Map<string, THREE.CanvasTexture>();

function drawLogo(g: CanvasRenderingContext2D, x: number, y: number, r: number, spec: JerseySpec): void {
  g.save();
  g.translate(x, y);
  g.lineWidth = r * 0.14;
  g.strokeStyle = spec.accent;
  g.fillStyle = spec.secondary;
  g.beginPath();
  switch (spec.logo) {
    case 'circle':
      g.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case 'shield':
      g.moveTo(-r, -r * 0.8);
      g.lineTo(r, -r * 0.8);
      g.lineTo(r, r * 0.2);
      g.quadraticCurveTo(r, r * 0.9, 0, r * 1.05);
      g.quadraticCurveTo(-r, r * 0.9, -r, r * 0.2);
      g.closePath();
      break;
    case 'diamond':
      g.moveTo(0, -r * 1.1);
      g.lineTo(r * 1.1, 0);
      g.lineTo(0, r * 1.1);
      g.lineTo(-r * 1.1, 0);
      g.closePath();
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? r * 1.15 : r * 0.5;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      break;
    case 'hex':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      break;
  }
  g.fill();
  g.stroke();
  g.fillStyle = spec.primary;
  g.font = `bold ${Math.round(r * 1.3)}px Impact, "Arial Black", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(spec.initial.slice(0, 2).toUpperCase(), 0, r * 0.05);
  g.restore();
}

/** UV layout from build_skater.py: back half u∈[0,0.5], front half u∈[0.5,1], v = height (0 hem → 1 collar). */
export function jerseyTexture(spec: JerseySpec): THREE.CanvasTexture {
  const key = JSON.stringify(spec);
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 512;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = spec.primary;
  g.fillRect(0, 0, S, S);
  // canvas y grows down; v=1 (collar) is top of the canvas because flipY stays true for CanvasTexture
  const V = (v: number) => (1 - v) * S;
  g.fillStyle = spec.secondary;
  switch (spec.pattern) {
    case 0: // hem + collar bands
      g.fillRect(0, V(0.22), S, S * 0.08);
      g.fillRect(0, V(1), S, S * 0.06);
      g.fillStyle = spec.accent;
      g.fillRect(0, V(0.14), S, S * 0.03);
      break;
    case 1: // chest band
      g.fillRect(0, V(0.62), S, S * 0.14);
      g.fillStyle = spec.accent;
      g.fillRect(0, V(0.64), S, S * 0.02);
      g.fillRect(0, V(0.5), S, S * 0.02);
      break;
    case 2: // diagonal sash on front, plain back
      g.save();
      g.beginPath();
      g.rect(S / 2, 0, S / 2, S);
      g.clip();
      g.beginPath();
      g.moveTo(S * 0.5, V(0.75));
      g.lineTo(S, V(0.35));
      g.lineTo(S, V(0.2));
      g.lineTo(S * 0.5, V(0.6));
      g.closePath();
      g.fill();
      g.restore();
      g.fillRect(0, V(0.1), S, S * 0.06);
      break;
    case 3: // yoke (shoulders) + hem
      g.fillRect(0, V(1), S, S * 0.2);
      g.fillStyle = spec.accent;
      g.fillRect(0, V(0.8), S, S * 0.025);
      g.fillStyle = spec.secondary;
      g.fillRect(0, V(0.08), S, S * 0.08);
      break;
  }
  // subtle fabric weave
  g.globalAlpha = 0.06;
  for (let y = 0; y < S; y += 3) {
    g.fillStyle = y % 6 ? '#000' : '#fff';
    g.fillRect(0, y, S, 1);
  }
  g.globalAlpha = 1;
  // front logo (u 0.5..1) centered on chest
  drawLogo(g, S * 0.75, V(0.62), S * 0.11, spec);
  // back number (u 0..0.5)
  g.fillStyle = spec.accent;
  g.strokeStyle = spec.secondary;
  g.lineWidth = 8;
  g.font = `bold ${Math.round(S * 0.34)}px Impact, "Arial Black", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.strokeText(String(spec.number), S * 0.25, V(0.5));
  g.fillText(String(spec.number), S * 0.25, V(0.5));
  if (spec.name) {
    g.font = `bold ${Math.round(S * 0.07)}px Impact, "Arial Black", sans-serif`;
    g.fillStyle = spec.accent;
    g.fillText(spec.name.toUpperCase().slice(0, 12), S * 0.25, V(0.82));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

/** Derive secondary/accent from a team primary color. */
export function teamPalette(primary: string): { secondary: string; accent: string } {
  const col = new THREE.Color(primary);
  const hsl = { h: 0, s: 0, l: 0 };
  col.getHSL(hsl);
  const light = hsl.l > 0.55;
  const secondary = light ? '#101018' : '#f4f4f4';
  const acc = new THREE.Color().setHSL((hsl.h + 0.5) % 1, Math.min(1, hsl.s + 0.2), light ? 0.35 : 0.6);
  return { secondary, accent: '#' + acc.getHexString() };
}
