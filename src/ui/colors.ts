/** Colorblind-safe helpers. Simulation matrices after Machado et al. (approximate). */
export type CbMode = 'off' | 'deuteranopia' | 'protanopia' | 'tritanopia';

const M: Record<Exclude<CbMode, 'off'>, number[]> = {
  protanopia: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  deuteranopia: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  tritanopia: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
};

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function simulate(hex: string, mode: CbMode): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  if (mode === 'off') return [r, g, b];
  const m = M[mode];
  return [m[0] * r + m[1] * g + m[2] * b, m[3] * r + m[4] * g + m[5] * b, m[6] * r + m[7] * g + m[8] * b];
}
/** Perceptual-ish distance (weighted RGB). */
export function colorDistance(a: string, b: string, mode: CbMode): number {
  const p = simulate(a, mode),
    q = simulate(b, mode);
  const rm = (p[0] + q[0]) / 2;
  const dr = p[0] - q[0],
    dg = p[1] - q[1],
    db = p[2] - q[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
/** Safe alternates tried in order when two team colors collide under a mode. */
export const SAFE_AWAY = ['#ffd23f', '#ffffff', '#111111', '#ff8c00', '#00b8d4', '#c56bff'];
export const COLLISION_THRESHOLD = 230;
export function awayColorFor(home: string, away: string, mode: CbMode, threshold = COLLISION_THRESHOLD): string {
  if (colorDistance(home, away, mode) >= threshold) return away;
  for (const c of SAFE_AWAY) if (colorDistance(home, c, mode) >= threshold && colorDistance(away, c, mode) > 40) return c;
  return '#ffffff';
}
/** Lane / cue palette per mode: [open, blocked]. */
export function lanePalette(mode: CbMode): [number, number] {
  return mode === 'off' ? [0x3fff7a, 0xff3b3b] : [0x4dc3ff, 0xff9500];
}
