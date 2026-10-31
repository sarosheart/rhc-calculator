// Where the Angio-Seal parts are for a pose, in the world frame (mm): the insertion sheath along the track, the anchor
// (a bar along the vessel, its hub up), the collagen (a plug in the tract, then a mound on the outer wall), the suture
// (anchor hub → through the collagen → slipknot above it → up the tract to the device).
// Sizes are ESTIMATES where Terumo publishes none (plans/closure/research/angioseal_fig8.md §1A): anchor ≈ 10 × 1.2 mm,
// compacted collagen ≈ 6 × 4 mm, 6F sheath ≈ 2.7 mm across, inlet hole 15 mm behind the tip.
import { W, tractPoint } from '../scene/world.js';
import { TRACK_HOLE, trackPoint, trackDir, TRACT_LEN } from '../scene/paths.js';

export const AS = Object.freeze({ SHEATH_LEN: 120, SHEATH_R: 1.35, INLET_BACK: 15, LOCATOR_TIP: 3, ANCHOR_LEN: 10, ANCHOR_W: 1.2,
  ANCHOR_T: 0.8, MOUND_W: 6, MOUND_H: 4, PLUG_LEN: 8, PLUG_R: 1.5, TAMPER_R: 1.3, DEVICE_BACK: 30 });
export { TRACK_HOLE, trackPoint };

const SQ = Math.SQRT1_2, IN_WALL = W.WALL_OUT_Y - W.WALL_T;
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const norm = (v) => { const n = Math.hypot(...v) || 1; return v.map(x => x / n); };
const rotZ = (v, deg) => { const a = deg * Math.PI / 180; return [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]]; };

// the anchor at each stage: 1 just out of the sheath, along the vessel; 2 caught on the sheath tip (a T, tilted 15° —
// figure-derived, VERIFY); 3 flat against the inner anterior wall, centred under the hole, along the vessel
function stageFrame(k, tipArc) {
  if (k <= 1) return { center: trackPoint(tipArc + 6), axis: norm(trackDir(tipArc + 6)) };
  if (k === 2) return { center: trackPoint(tipArc + 1.0), axis: norm(rotZ(trackDir(tipArc + 1.0), 15)) };
  return { center: [-0.4, IN_WALL - AS.ANCHOR_T / 2, 0], axis: [-1, 0, 0] };
}
export function anchorFrame(p) {
  if (p.anchorStage <= 0) return null;
  let center, axis, bend = 0;
  if (p.anchorOutside) {           // released from a tip in the wall: it lies on the outside of the wall, in the tract
    center = [-0.8, W.WALL_OUT_Y + AS.ANCHOR_T / 2 + 0.1, 0]; axis = [-1, 0, 0];
  } else if (p.backWall) {         // forced: driven down into the back wall at 35°
    const tip0 = trackPoint(p.tipArc), tip = [tip0[0] - 4, W.VESSEL_CY - W.LUMEN_R + 0.2, 0];
    axis = norm([-Math.cos(35 * Math.PI / 180), -Math.sin(35 * Math.PI / 180), 0]);
    center = tip.map((v, i) => v - axis[i] * AS.ANCHOR_LEN / 2);
  } else {
    const k = Math.min(3, p.anchorStage), k0 = Math.floor(k), k1 = Math.min(3, k0 + 1), t = k - k0;
    const a = stageFrame(Math.max(1, k0), p.tipArc), b = stageFrame(Math.max(1, k1), p.tipArc);
    center = lerp(a.center, b.center, t); axis = norm(lerp(a.axis, b.axis, t));
    if (p.oblique) axis = norm(rotZ(trackDir(p.tipArc + 1.0), 40));
    if (p.bent) { bend = 0.8; center = [center[0], center[1] + bend, center[2]]; }
  }
  const up = norm([-axis[1], axis[0], 0].map((v, i) => (axis[0] < 0 ? -v : v)));   // toward the wall side
  const hub = center.map((v, i) => v + up[i] * (AS.ANCHOR_T / 2 + 0.3));
  return { center, axis, up, hub, bend, len: AS.ANCHOR_LEN };
}

// the collagen: 1 a plug in the tract just outside the hole, 2 a mound pressed onto the outer wall (and in between)
export function collagenShape(p) {
  if (p.collagen <= 0) return null;
  const t = Math.min(1, Math.max(0, p.collagen - 1));
  const plugC = tractPoint(1 + AS.PLUG_LEN / 2), moundC = [0, W.WALL_OUT_Y + AS.MOUND_H / 2, 0];
  let center = lerp(plugC, moundC, t);
  const width = AS.PLUG_R * 2 + (AS.MOUND_W - AS.PLUG_R * 2) * t, height = AS.PLUG_LEN * SQ + (AS.MOUND_H - AS.PLUG_LEN * SQ) * t;
  let kind = t >= 1 ? 'mound' : 'plug', below = 0;
  if (p.collagenIn) { center = [center[0], W.WALL_OUT_Y - W.WALL_T - 0.3, 0]; kind = 'intraluminal'; }
  const bottom = center[1] - height / 2, top = center[1] + height / 2;
  if (p.collagenIn) below = Math.max(0, Math.min(1, (IN_WALL - bottom) / height));
  if (p.split) kind = 'split';
  return { kind, center, width, height, bottom, top, belowWallFraction: below, axis: t < 1 ? [SQ, SQ, 0] : [1, 0, 0] };
}

// the suture: anchor hub → through the collagen → slipknot above it → up the tract to the device, or cut
export function suturePath(p) {
  const A = anchorFrame(p); if (!A) return null;
  const C = collagenShape(p);
  const pts = [A.hub, [A.hub[0] * 0.5, W.WALL_OUT_Y - 0.3, 0]];
  let knot = null;
  if (C) {
    pts.push([C.center[0] - 0.4, C.center[1], 0.2]);                       // woven through the sponge
    const sTop = (C.top - W.WALL_OUT_Y) / SQ + 0.6; knot = tractPoint(Math.max(sTop, 1)); pts.push(knot);
  }
  const outEnd = p.cutSkin ? TRACT_LEN - 3 : p.cutTop ? TRACT_LEN + 25 : p.suturePaid ? TRACT_LEN + AS.DEVICE_BACK + 40 : null;
  if (outEnd !== null) {
    const s0 = knot ? (knot[1] - W.WALL_OUT_Y) / SQ + 0.5 : 1;
    for (let s = s0; s < outEnd; s += 4) pts.push(tractPoint(s));
    pts.push(tractPoint(outEnd));
  } else {
    // still inside the sheath and carrier: up to the sheath tip
    pts.push(trackPoint(Math.min(p.tipArc, TRACK_HOLE + 1.4)));
  }
  return { pts: pts.filter((q, i) => i === 0 || Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1], q[2] - pts[i - 1][2]) > 1e-6), knot,
    clearStopAt: p.clearStop ? tractPoint(TRACT_LEN + AS.DEVICE_BACK + 30) : null,
    markerAt: p.blackMarker ? tractPoint(TRACT_LEN + 12) : null };
}
