// The real angiograms (CARDIAG key frames, data/cardiag/): which frame is nearest the current angle, and which of the
// experts' SYNTAX outlines a point on a frame falls in. Pure functions; real.js draws the panel.
import { detectorDir } from './geometry.js';

// degrees between the two beams — RAO 30 and LAO 30 at CRA 45 are closer than 60° apart, because the beam is
export function beamAngle(lao1, cra1, lao2, cra2) {
  const a = detectorDir(lao1, cra1), b = detectorDir(lao2, cra2);
  return Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180 / Math.PI;
}

// frames for the injected artery (both: every frame), nearest first; equal distances in id order
export function rankFrames(frames, lao, cra, sys) {
  return frames.filter(f => sys === 'both' || f.side === sys).map(frame => ({ frame, dist: beamAngle(lao, cra, frame.lao, frame.cra) }))
    .sort((p, q) => p.dist - q.dist || (p.frame.id < q.frame.id ? -1 : p.frame.id > q.frame.id ? 1 : 0));
}

const inside = (poly, x, y) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const area = (poly) => { let s = 0; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]; return Math.abs(s) / 2; };

// the segment whose outline holds the point (the smallest, where outlines nest), or null
export function segmentAt(overlay, x, y) {
  let best = null, bestA = Infinity;
  for (const [seg, polys] of Object.entries(overlay)) for (const p of polys) {
    if (p.length < 3 || !inside(p, x, y)) continue;
    const a = area(p); if (a < bestA) { bestA = a; best = seg; }
  }
  return best;
}

// where to put a segment's number: inside its largest outline, as near its middle as the outline allows (a vessel that
// bends round has its centroid outside it)
export function labelPoint(polys) {
  const P = polys.reduce((m, p) => (area(p) > area(m) ? p : m), polys[0]);
  const cx = P.reduce((s, q) => s + q[0], 0) / P.length, cy = P.reduce((s, q) => s + q[1], 0) / P.length;
  if (inside(P, cx, cy)) return [cx, cy];
  const xs = P.map(q => q[0]), ys = P.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let best = null, bd = Infinity;
  for (let i = 0; i <= 24; i++) for (let j = 0; j <= 24; j++) {
    const x = x0 + (x1 - x0) * i / 24, y = y0 + (y1 - y0) * j / 24, d = (x - cx) ** 2 + (y - cy) ** 2;
    if (d < bd && inside(P, x, y)) { bd = d; best = [x, y]; }
  }
  return best || P.reduce((m, q) => ((q[0] - cx) ** 2 + (q[1] - cy) ** 2 < (m[0] - cx) ** 2 + (m[1] - cy) ** 2 ? q : m), P[0]);
}
