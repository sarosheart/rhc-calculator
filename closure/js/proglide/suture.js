// The ProGlide suture as drawn: world-space polylines (mm) for a pose.
// Until the knot leaves the device the strand is a CHAIN moving along a fixed ROUTE: from the pre-tied coils across to the
// posterior needle, down its track through the posterior (caudal) bite, along the lumen side under the foot, up through
// the anterior (cranial) bite and up the anterior needle's track through the coils into the device. The chain, from its
// leading end: the anterior cuff, the white link, the posterior cuff with the detached needle tip, then the suture.
// `haul` slides it along the route (plunger out). After that the strand is the KNOT configuration: the loop through the
// two bites, the knot (coils) in the tract, the rail through the knot's centre and the white-tipped strand from its coils.
import { W, computeSeat, deviceFrame, tractPoint } from '../scene/world.js';
import { gatherX } from '../scene/vessel.js';

export const NEEDLE_R = 0.27, STROKE = 4.53, CUFF_LEN = 1.2;
const RAIL_OUT = 120, NONRAIL_OUT = 70, TAIL = 3;
const TRACT_LEN = (W.SKIN_Y - W.WALL_OUT_Y) / Math.sin(W.ANGLE * Math.PI / 180);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addv = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const lerp = (a, b, t) => addv(a, mul(sub(b, a), t));

// local x on the needle line (t, dy, z) where it reaches world height y
const lineAtY = (F, z, y, dy = 0) => F.toWorld([(y - F.origin[1] - z * F.up[1] - dy * F.side[1]) / F.out[1], dy, z]);
export const DEFLECT = 1.2;           // mm a twisted or shallow-angle needle is pushed sideways, off its cuff
export const CATHETER_R = 1.3;        // the device's catheter where it crosses the wall (its taper there, from the model)

// the device frame a pose puts the device in (pivoting on the foot's toe when the angle has been dropped)
export const frameFor = (pose, geom) => deviceFrame(pose, computeSeat(geom), pose.toePivot ? geom.toeLocal : null);

// One needle's path through the wall: where it leaves the housing, crosses the outer and inner surface, and where its tip
// ends at full stroke. dy pushes the line sideways (a deflected needle).
function needleSide(F, geom, z, dy = 0) {
  const housing = F.toWorld([geom.housingFace - z, dy, z]);
  const out = lineAtY(F, z, W.WALL_OUT_Y, dy), inn = lineAtY(F, z, W.WALL_OUT_Y - W.WALL_T, dy);
  const d = sub(inn, housing), cuff = addv(housing, mul(d, STROKE / len(d)));
  return { housing, out, in: inn, cuff, z };
}
// The bites, fixed in tissue once made: the needle lines of the apposed device (or of frame F) through the wall.
export function bites(geom, F = null, dyA = 0, dyP = 0) {
  const F0 = deviceFrame({ insert: 0 }, computeSeat(geom));
  const G = F || F0;
  return { A: needleSide(G, geom, geom.needleZ[0], dyA), P: needleSide(G, geom, geom.needleZ[1], dyP), F0 };
}

// where a needle's tip is for a pose ('A' anterior, 'P' posterior), and the cuff on the foot it should land in
export function needleTip(which, pose, geom) {
  const F = frameFor(pose, geom), z = which === 'A' ? geom.needleZ[0] : geom.needleZ[1];
  const dy = DEFLECT * (which === 'A' ? pose.deflectA : pose.deflectP);
  return F.toWorld([geom.housingFace - z + 0.3 - STROKE * pose.needles, dy, z]);
}
export function cuffPoint(which, pose, geom) {
  const F = frameFor(pose, geom), s = (which === 'A' ? 1 : -1) * geom.cuffS;
  const c = [-Math.SQRT1_2 * s, 0, Math.SQRT1_2 * s], t = geom.footParkedDeg * (1 - pose.foot) * Math.PI / 180;
  return F.toWorld([c[0] * Math.cos(t) + c[2] * Math.sin(t), 0, -c[0] * Math.sin(t) + c[2] * Math.cos(t)]);
}

// the line the knot (and the trimmer riding the rail) travels down: the tract, offset beside whatever still runs down it
// (the device's catheter, then the wire), easing onto the tract line at the wall
export function knotAxis(pose, s) {
  const a = W.ANGLE * Math.PI / 180, n1 = [-Math.sin(a), Math.cos(a), 0];
  const side = pose.besideR ?? (pose.deviceShown ? 2.1 : pose.wireShown ? 1.0 : 0);
  return addv(tractPoint(s), mul(n1, side * Math.min(1, Math.max(0, s) / 3)));
}

export function coilCentre(pose, geom) {
  const F = frameFor(pose, geom);
  return F.toWorld([(geom.coil.x0 + geom.coil.x1) / 2, 0, geom.needleZ[0]]);
}

// polyline helpers: arc lengths, a point at s, and the piece between s0 and s1
function arcs(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + len(sub(pts[i], pts[i - 1]))); return L; }
function at(pts, L, s) {
  if (s <= 0) return pts[0]; if (s >= L[L.length - 1]) return pts[pts.length - 1];
  let i = 1; while (L[i] < s) i++;
  return lerp(pts[i - 1], pts[i], (s - L[i - 1]) / Math.max(1e-12, L[i] - L[i - 1]));
}
function piece(pts, L, s0, s1) {
  const a = Math.max(0, s0), b = Math.min(L[L.length - 1], s1);
  if (b - a < 1e-6) return null;
  const out = [at(pts, L, a)];
  for (let i = 0; i < pts.length; i++) if (L[i] > a + 1e-6 && L[i] < b - 1e-6) out.push(pts[i]);
  out.push(at(pts, L, b));
  return out;
}
const dedupe = (pts) => pts.filter((q, i) => i === 0 || len(sub(q, pts[i - 1])) > 1e-6);

// strands outside the skin: on along the tract, sagging toward −Y unless held taut
function outside(from, dir, length, sag) {
  const n = 16, pts = [];
  for (let i = 1; i <= n; i++) { const t = i / n, p = addv(from, mul(dir, length * t)); p[1] -= sag * 4 * t * (1 - t); pts.push(p); }
  return pts;
}

// the route the chain moves along while the knot is on the anterior needle, and how far plunger-out hauls it
function chainRoute(F, B, geom) {
  const { A, P } = B, zA = geom.needleZ[0], zP = geom.needleZ[1], coilX = (geom.coil.x0 + geom.coil.x1) / 2;
  const coil = F.toWorld([coilX, 0, zA]), coilP = F.toWorld([coilX, 0, zP]);
  const under = [0, W.WALL_OUT_Y - W.WALL_T - 1.35, 0];                        // lumen side, under the foot
  // device-held points move with the device; the bites are fixed in tissue (they only matter once it is apposed)
  const hP = F.toWorld([geom.housingFace - zP, 0, zP]), hA = F.toWorld([geom.housingFace - zA, 0, zA]);
  const route = [coil, coilP, hP, P.out, P.in, P.cuff, under, A.cuff, A.in, A.out, hA, coil, F.toWorld([coilX + 50, 0, zA])];
  const L = arcs(route), idx = (q) => L[route.indexOf(q === P.housing ? hP : q === A.housing ? hA : q)];
  const sCuffP = idx(P.cuff), sCuffA = L[7], linkLen = sCuffA - sCuffP;
  const D = L[L.length - 1] - sCuffA + CUFF_LEN + linkLen + CUFF_LEN;            // haul 1: all ahead of the suture is in the device
  return { route, L, idx, sCuffP, sCuffA, linkLen, D, coil };
}
// mm of chain travel per needle stroke: the front needle comes home while the chain has moved one stroke
export function haulPerStroke(geom) {
  const B = bites(geom); return chainRoute(B.F0, B, geom).D / STROKE;
}

export function suturePaths(pose, geom) {
  const F = frameFor(pose, geom);
  // while the needles work, the bites are where this device's needles go; once the knot is out they are fixed in tissue
  const B = pose.knotS < 0 ? bites(geom, F, DEFLECT * pose.deflectA, DEFLECT * pose.deflectP)
    : bites(geom, pose.roll ? deviceFrame({ insert: 0, roll: pose.roll }, computeSeat(geom)) : null);   // a rolled stitch (pre-close)
  const { A, P } = B, zA = geom.needleZ[0], zP = geom.needleZ[1];
  const coilX = (geom.coil.x0 + geom.coil.x1) / 2;

  if (pose.knotS < 0) {
    // ── the chain on its route, while the knot is still on the anterior needle ──
    const { route, L, idx, sCuffP, sCuffA, linkLen, D, coil } = chainRoute(F, B, geom);
    const chain = [];
    if (pose.haul <= 0) {
      // the suture ends at the posterior needle's tip; the link is still the foot's own (drawn with the model)
      const tip = idx(P.housing) + pose.needles * (sCuffP - idx(P.housing));
      chain.push({ kind: 'suture', pts: piece(route, L, 0, tip) });
    } else {
      const lead = sCuffA + pose.haul * D;
      const parts = [['cuff', lead - CUFF_LEN, lead], ['link', lead - CUFF_LEN - linkLen, lead - CUFF_LEN],
        ['cuff', lead - 2 * CUFF_LEN - linkLen, lead - CUFF_LEN - linkLen], ['suture', 0, lead - 2 * CUFF_LEN - linkLen]];
      for (const [kind, s0, s1] of parts) { const pts = piece(route, L, s0, s1); if (pts) chain.push({ kind, pts }); }
    }
    return { chain: chain.filter(c => c.pts && c.pts.length >= 2), loop: null, rail: null, nonRail: null,
      knot: { at: coil, dir: F.out, cinch: 0 } };
  }

  // ── the knot configuration ──
  const dir = [Math.cos(W.ANGLE * Math.PI / 180), Math.sin(W.ANGLE * Math.PI / 180), 0];
  const g = pose.gather, bx = [Math.hypot(A.out[0], A.out[2]), Math.hypot(P.out[0], P.out[2])];
  // tightening pulls each bite toward the hole along its own line (x only on a straight stitch; x and z when rolled)
  const gx = (q) => { const r = Math.hypot(q[0], q[2]); if (r < 1e-9) return q; const k = Math.abs(gatherX(r, g, [-bx[0], bx[1]])) / r; return [q[0] * k, q[1], q[2] * k]; };
  const tp = (s) => knotAxis(pose, s);
  const K = tp(Math.max(pose.knotS, 0.7));                                        // the coils sit on the adventitia at most
  const half = (geom.coil.x1 - geom.coil.x0) / 2;
  const kBot = addv(K, mul(dir, -half)), kTop = addv(K, mul(dir, half));
  const neck = tp(Math.min(Math.max(pose.knotS, 0.7) - half, 1.2) > 0 ? Math.min(pose.knotS - half, 1.2) : 0.3);
  const dip = pose.dipY ?? (pose.deviceShown ? -33.0 : W.WALL_OUT_Y - W.WALL_T - 0.25);   // under the device's sheath while it is in
  const off = (q, dz) => [q[0], q[1], q[2] + dz];
  let loop;
  if (pose.cinchOnDevice) {
    // tightened with the device in: both bites pulled in against the catheter, the loop wrapped round it under the wall
    const a = W.ANGLE * Math.PI / 180, n1 = [-Math.sin(a), Math.cos(a), 0], n2 = [0, 0, 1], R = CATHETER_R + 0.15;
    const hw = R / Math.sin(a), edge = (y, sgn) => [y - W.WALL_OUT_Y + sgn * hw, y, 0];
    const c = tractPoint(-1.6), ring = [];
    for (let k = 0; k <= 16; k++) { const f = Math.PI / 2 + Math.PI * k / 16;
      ring.push([0, 1, 2].map(i => c[i] + R * (Math.cos(f) * n1[i] + Math.sin(f) * n2[i]))); }
    loop = dedupe([off(kBot, 0.35), off(neck, 0.35), edge(-30, 1), edge(-31, 1), ...ring, edge(-31, -1), edge(-30, -1),
      off(neck, -0.15), kBot, K]);
  } else {
    loop = dedupe([off(kBot, 0.35), off(neck, 0.35), gx(P.out), gx(P.in), [0, dip, 0], gx(A.in), gx(A.out),
      off(neck, -0.15), kBot, K]);
  }
  // the rail: from the knot centre up the tract; harvested → out of the skin and on; trimmed → a short tail
  const skin = tp(TRACT_LEN), toSkin = (q) => q;
  let rail, nonRail;
  const coilEdge = off(kTop, geom.coil.r + 0.15);
  if (pose.trimmed) {
    rail = [K, addv(K, mul(dir, TAIL))];
    nonRail = [coilEdge, addv(coilEdge, mul(dir, TAIL - half))];
  } else {
    const taut = pose.pusherShown || pose.clamped ? 0 : 1;
    // a pre-close suture parked under a hemostat lies off to its side of the field (park: +1 patient's right, −1 left)
    const outDir = pose.park ? (() => { const v = [dir[0] * 0.55, 0.12, pose.park * 0.85], n = Math.hypot(...v); return v.map(x => x / n); })() : dir;
    // twisted trimmer: the rail winds round its shaft just above the knot before it runs on up the tract
    const wrapPts = [];
    if (pose.wrap) {
      const a = W.ANGLE * Math.PI / 180, n1 = [-Math.sin(a), Math.cos(a), 0], s0 = Math.max(pose.knotS, 0.7) + half + 0.8;
      for (let k = 0; k <= 60; k++) { const t = k / 60, s1 = s0 + 10 * t, f = 2.5 * 2 * Math.PI * t, c = tp(s1);
        wrapPts.push([0, 1, 2].map(i => c[i] + 1.45 * (Math.cos(f) * n1[i] + Math.sin(f) * (i === 2 ? 1 : 0)))); }
    }
    rail = dedupe([K, ...wrapPts, toSkin(skin), ...(pose.harvest ? outside(skin, outDir, RAIL_OUT, 14 * taut) : [addv(skin, mul(dir, 2))])]);
    const skinN = off(skin, 0.6);
    nonRail = dedupe([coilEdge, off(tp(Math.max(pose.knotS, 0.7) + half + 2), 0.6), skinN,
      ...(pose.harvest ? outside(skinN, outDir, pose.park ? RAIL_OUT : NONRAIL_OUT, pose.clamped ? 0 : 18) : [addv(skinN, mul(dir, 2))])]);
  }
  return { chain: null, loop, rail, nonRail, knot: { at: K, dir, cinch: pose.lock } };
}
