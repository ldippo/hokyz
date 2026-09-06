/** Frame-independent blend, calibrated to the existing 60Hz pose response.
 * Rate is the former per-second linear blend coefficient (between 0 and 60).
 * Equal elapsed time gives equal progress toward a constant pose target.
 */
export function poseBlend(rate: number, dt: number): number {
  if (dt <= 0) return 0;
  return 1 - Math.pow(1 - Math.min(60, Math.max(0, rate)) / 60, dt * 60);
}
