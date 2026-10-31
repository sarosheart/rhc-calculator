// Paths that bend with what the user does: the guidewire, the procedural sheath and the device's flexible distal sheath.
// Each follows one TRACK: down the 45° tract from outside the skin, through the arteriotomy, then cranially along the lumen.
import { W, tractPoint } from './world.js';

export const TRACT_LEN = (W.SKIN_Y - W.WALL_OUT_Y) / Math.sin(W.ANGLE * Math.PI / 180);   // 42.4 mm
const RUN_Y = W.VESSEL_CY + 0.9;                       // a wire or sheath in the lumen rides a little above the axis
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// the track as a polyline from `outside` mm beyond the skin to `inside` mm cranial of the hole
export function track(outside = 280, inside = 90) {
  const pts = [];
  for (let s = TRACT_LEN + outside; s > 2; s -= 4) pts.push(tractPoint(s));
  pts.push(tractPoint(2), tractPoint(0), tractPoint(-1.6));                       // through the wall
  pts.push([-3.4, -32.6, 0], [-6.0, RUN_Y + 0.15, 0], [-8.5, RUN_Y, 0]);           // the bend into the lumen
  for (let x = -12; x >= -8.5 - inside; x -= 4) pts.push([x, RUN_Y, 0]);
  return pts;
}
export function arcs(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + dist(pts[i], pts[i - 1])); return L; }
export function pointAt(pts, L, s) {
  if (s <= 0) return pts[0]; const end = L[L.length - 1]; if (s >= end) return pts[pts.length - 1];
  let i = 1; while (L[i] < s) i++;
  const t = (s - L[i - 1]) / Math.max(1e-12, L[i] - L[i - 1]);
  return pts[i - 1].map((v, k) => v + (pts[i][k] - v) * t);
}
export function piece(pts, L, s0, s1) {
  const a = Math.max(0, s0), b = Math.min(L[L.length - 1], s1); if (b - a < 1e-6) return null;
  const out = [pointAt(pts, L, a)];
  for (let i = 0; i < pts.length; i++) if (L[i] > a + 1e-6 && L[i] < b - 1e-6) out.push(pts[i]);
  out.push(pointAt(pts, L, b)); return out;
}

const TRACK = track(), TL = arcs(TRACK);
const S_HOLE = (() => { let i = TRACK.findIndex(q => q[1] <= W.WALL_OUT_Y + 1e-9); return TL[i]; })();
// arc length along the track of the arteriotomy (outer wall) and of the skin
export const TRACK_AT = Object.freeze({ skin: 280, hole: S_HOLE });

// the guidewire: from `outside` mm beyond the skin to `inside` mm into the vessel
export const wirePath = (outside = 90, inside = 70) => piece(TRACK, TL, 280 - outside, S_HOLE + inside);
// the procedural sheath: its tip `inside` mm past the hole, its hub `outside` mm beyond the skin
export const sheathPath = (inside = 14, outside = 12) => piece(TRACK, TL, 280 - outside, S_HOLE + inside);

// the device's distal sheath: from where it leaves the distal guide (world point p0) along the track, `length` mm in all
export function distalSheathPath(p0, length) {
  let best = 0, bd = Infinity;
  for (let s = 0; s <= TL[TL.length - 1]; s += 0.25) { const d = dist(pointAt(TRACK, TL, s), p0); if (d < bd) { bd = d; best = s; } }
  const join = Math.min(best + 2.5, TL[TL.length - 1]);
  const pts = [p0, ...piece(TRACK, TL, join, TL[TL.length - 1])];
  const L = arcs(pts);
  return piece(pts, L, 0, length);
}

// a catheter path torn where it crosses the arteriotomy: the part outside, and the tip left in the vessel, 2 mm apart
export function tornAt(path) {
  const L = arcs(path); let k = 0, best = Infinity;
  for (let i = 0; i < path.length; i++) { const d = Math.abs(path[i][1] - (W.WALL_OUT_Y - W.WALL_T)); if (d < best) { best = d; k = i; } }
  return [piece(path, L, 0, L[k] - 1), piece(path, L, L[k] + 1, L[L.length - 1])];
}

// the track itself, for devices that ride it (Angio-Seal's sheath, anchor, carrier): a point and the direction at arc s
export const TRACK_HOLE = S_HOLE;
export const trackPoint = (s) => pointAt(TRACK, TL, s);
export function trackDir(s) {
  const a = pointAt(TRACK, TL, s - 0.5), b = pointAt(TRACK, TL, s + 0.5), d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const n = Math.hypot(...d) || 1; return d.map(v => v / n);
}
