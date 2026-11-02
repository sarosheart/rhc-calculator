// The ProGlide's distal end as ONE flexible path (Saro: "i need you to also fix this weird curve on the perclose"): the
// black distal guide from the hinge, then the teal catheter, with the wire inside the catheter from its tip to the exit
// port. The guide used to be a rigid 45° arc in the model, so outside the vessel its tip sat 10 mm off the wire's line and
// pointed 45° away from it, and the catheter had to kink or swing back. Now the page draws it, and only the vessel bends it:
//   · hinge above the arteriotomy (outside the vessel): straight down the tract, on the wire's line, then bent into the
//     lumen at the arteriotomy along the track's own bend (one arc), the wire with it;
//   · hinge in the vessel (apposed, or deeper at the mark): one bend from the hinge toward the vessel's axis (cranially),
//     the model's own radius (10 mm) by apposition, eased from the track's bend at the arteriotomy so the two agree where
//     they meet, and no lower than the back wall allows; then straight along the lumen.
// The white link, which loops along the guide, is bent the same way (rig.js, with the frames from here). Pure; node-tested.
import { W, tractPoint } from '../scene/world.js';
import { arcs, piece, pointAt, TRACK_AT, TRACK_RUN_Y } from '../scene/paths.js';
import { frameFor } from './suture.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const n = Math.hypot(...a) || 1; return a.map((v) => v / n); };
const clamp01 = (t) => Math.min(1, Math.max(0, t));

const SQ = Math.SQRT1_2, OUT = [SQ, SQ, 0], HOLE = tractPoint(0);
// the track's own bend at the arteriotomy, as a radius: from the hole (heading down the tract) to the lumen run
const BEND_DEG = W.ANGLE, R_TRACK = (W.WALL_OUT_Y - TRACK_RUN_Y) / (1 - Math.cos(BEND_DEG * Math.PI / 180));
const R_MIN = 6, FLOOR = W.VESSEL_CY - W.LUMEN_R;          // tightest bend the back wall can force; the lumen's floor

// the guide as modelled (proglide.py): from x0 on the axis to the hinge, an arc of radius R toward 12 o'clock through deg,
// then straight for run (mm, device frame)
export const GUIDE_DEFAULT = Object.freeze({ x0: 0.6, R: 10, deg: 45, run: 10, r: 1.35 });
export const guideLen = (G = GUIDE_DEFAULT) => G.x0 + G.R * G.deg * Math.PI / 180 + G.run;
// the rest shape (device frame), sampled every ~0.1 mm; the link's offsets are read against it
export function restGuide(G = GUIDE_DEFAULT, step = 0.1) {
  const pts = [];
  for (let x = G.x0; x > 0; x -= step) pts.push([x, 0, 0]);
  const n = Math.ceil(G.R * G.deg * Math.PI / 180 / step);
  for (let k = 0; k <= n; k++) { const a = G.deg * Math.PI / 180 * k / n; pts.push([-G.R * Math.sin(a), 0, G.R * (1 - Math.cos(a))]); }
  const end = pts[pts.length - 1], dir = norm([-Math.cos(G.deg * Math.PI / 180), 0, Math.sin(G.deg * Math.PI / 180)]);
  for (let s = step; s <= G.run + 1e-9; s += step) pts.push(add(end, mul(dir, s)));
  return pts;
}

// a device frame's own coordinates of a world point
export const toDevice = (F, p) => { const d = sub(p, F.origin); return [dot(d, F.out), dot(d, F.side), dot(d, F.up)]; };
// how far a world point is up the tract from the arteriotomy
const along = (p) => dot(sub(p, HOLE), OUT);

// straight from p0 along d0 to bendAt (on that line), then one arc of radius R turning from d0 to the vessel's axis (−X),
// then straight along it — `total` mm in all, sampled every 0.5 mm (an even spacing, so the drawn tube's smoothing adds no
// wobble: its turning keeps one sign)
const VESSEL = [-1, 0, 0];
function bentPath(p0, d0, bendAt, R, total) {
  const th = Math.acos(Math.max(-1, Math.min(1, dot(d0, VESSEL))));
  const nrm = th < 1e-6 ? [0, 1, 0] : norm(sub(VESSEL, mul(d0, dot(VESSEL, d0))));    // in the bend's plane, the way it turns
  const L1 = Math.max(0, dot(sub(bendAt, p0), d0)), L2 = R * th, end = add(add(p0, mul(d0, L1)), add(mul(d0, R * Math.sin(th)), mul(nrm, R * (1 - Math.cos(th)))));
  const at = (s) => {
    if (s <= L1) return add(p0, mul(d0, s));
    if (s <= L1 + L2) { const t = (s - L1) / R; return add(add(p0, mul(d0, L1)), add(mul(d0, R * Math.sin(t)), mul(nrm, R * (1 - Math.cos(t))))); }
    return add(end, mul(VESSEL, s - L1 - L2));
  };
  const pts = []; for (let s = 0; s < total; s += 0.5) pts.push(at(s)); pts.push(at(total));
  return { pts, th, R, L1 };
}
// the whole distal path for a pose, in the world: { pts, L (arc lengths), guide: arc where the catheter starts, total,
// onTrack: true when it runs down the tract (the wire's line), F, R }
function shape(pose, geom) {
  const G = geom.guide || GUIDE_DEFAULT, F = frameFor(pose, geom);
  const g0 = F.toWorld([G.x0, 0, 0]), hinge = F.toWorld([0, 0, 0]), a = along(hinge), d0 = mul(F.out, -1);
  const onLine = Math.abs(dot(F.out, OUT) - 1) < 1e-9;      // the device's axis along the tract (45°, not pivoted)
  if (onLine && a >= 0) return { F, G, g0, d0, bendAt: HOLE, R: R_TRACK, onTrack: true };
  // in the vessel: the bend starts at the hinge — eased from the track's own radius at the arteriotomy to the model's by
  // apposition, and no lower than the back wall lets the catheter go
  const th = Math.acos(Math.max(-1, Math.min(1, dot(d0, VESSEL))));
  const R0 = R_TRACK + (G.R - R_TRACK) * clamp01(-a / 2);
  const room = (hinge[1] - (FLOOR + geom.sheathProfile[0][1])) / Math.max(1e-6, 1 - Math.cos(th));
  return { F, G, g0, d0, bendAt: hinge, R: th < 1e-6 ? G.R : Math.max(R_MIN, Math.min(R0, room)), onTrack: false };
}
export function distalPath(pose, geom, extra = 0) {
  const S = shape(pose, geom), LG = guideLen(S.G), total = LG + geom.sheathLen;
  const B = bentPath(S.g0, S.d0, S.bendAt, S.R, total + extra);
  return { pts: B.pts, L: arcs(B.pts), guide: LG, total, onTrack: S.onTrack, F: S.F, R: S.R, th: B.th };
}
// the guide's piece and the catheter's piece of the path
export const guidePiece = (D) => piece(D.pts, D.L, 0, D.guide);
export const sheathPiece = (D) => piece(D.pts, D.L, D.guide, D.total);
// where the wire exit port is: portArc along the catheter
export const portPoint = (D, geom) => pointAt(D.pts, D.L, D.guide + geom.portArc);

// the wire while the device rides it (backload, re-wired, coming out): the same path as the catheter from the exit port
// on, past its tip and on into the vessel; at the port out through the catheter's wall on the 12 o'clock side, then
// alongside the device and away from it (5°) to the hand. null when the default wire (the track) is right.
export const WIRE_R = 0.48, WIRE_SPLAY = Math.tan(5 * Math.PI / 180);
export function wireRoute(pose, geom, wireOut = 140, wireIn = 70) {
  if (!pose.wireShown || !pose.deviceShown) return null;
  const S = shape(pose, geom); if (!S.onTrack) return null;
  const toHole = along(S.g0), D = distalPath(pose, geom, Math.max(0, toHole + wireIn - guideLen(S.G) - geom.sheathLen));
  const sPort = D.guide + geom.portArc, P = pointAt(D.pts, D.L, sPort);
  const inner = piece(D.pts, D.L, sPort, toHole + wireIn);
  const up = D.F.up, rOut = geom.sheathProfile[0][1] + WIRE_R + 0.15;
  const reach = Math.max(4, TRACK_AT.hole - TRACK_AT.skin + wireOut - along(P));   // to wireOut mm beyond the skin, along the tract
  const ls = [0.8, 2, 4]; for (let l = 6; l < reach; l += 6) ls.push(l);
  const outer = ls.filter((l) => l < reach).concat([reach]).map((l) => add(P, add(mul(OUT, l), mul(up, Math.min(1, l / 2) * rOut + WIRE_SPLAY * l))));
  return [...outer.reverse(), ...inner];
}

// ── bending the white link with the guide (rig.js) ──
// parallel-transport frames along a polyline, starting from (t0, b0): [{ t, n, b }]
export function frames(pts, t0, b0) {
  const out = []; let t = norm(t0), b = norm(sub(b0, mul(t, dot(b0, t))));
  for (let i = 0; i < pts.length; i++) {
    const tn = i < pts.length - 1 ? norm(sub(pts[i + 1], pts[i])) : t;
    const ax = cross(t, tn), s = Math.hypot(...ax), c = dot(t, tn);
    if (s > 1e-9) { const k = norm(ax), ang = Math.atan2(s, c);              // rotate b about k by ang (Rodrigues)
      b = add(add(mul(b, Math.cos(ang)), mul(cross(k, b), Math.sin(ang))), mul(k, dot(k, b) * (1 - Math.cos(ang)))); }
    t = tn; out.push({ t, b, n: cross(b, t) });
  }
  return out;
}
// a bender: given points in the device frame at rest, map them onto the guide's current shape (device frame), each
// keeping its place along the guide and its offset from it in the guide's own frame
export function makeBender(points, G = GUIDE_DEFAULT) {
  const rest = restGuide(G), RL = arcs(rest), rf = frames(rest, [-1, 0, 0], [0, 1, 0]);
  const recs = points.map((p) => {
    let best = 0, bd = Infinity;
    for (let i = 0; i < rest.length; i++) { const d = Math.hypot(...sub(p, rest[i])); if (d < bd) { bd = d; best = i; } }
    const o = sub(p, rest[best]), f = rf[best];
    return { s: RL[best], o: [dot(o, f.t), dot(o, f.n), dot(o, f.b)] };
  });
  // now: the guide's current centreline in the device frame (from x0), at least as long as the rest one
  return function bend(now) {
    const NL = arcs(now), nf = frames(now, [-1, 0, 0], [0, 1, 0]);
    let i = 0;
    return recs.map(({ s, o }) => {
      while (i > 0 && NL[i] > s) i--;
      while (i < now.length - 1 && NL[i + 1] <= s) i++;
      const j = Math.min(now.length - 1, i + 1), u = j > i ? clamp01((s - NL[i]) / ((NL[j] - NL[i]) || 1)) : 0;
      const at = add(now[i], mul(sub(now[j], now[i]), u)), f = nf[i];
      return add(at, add(mul(f.t, o[0]), add(mul(f.n, o[1]), mul(f.b, o[2]))));
    });
  };
}
