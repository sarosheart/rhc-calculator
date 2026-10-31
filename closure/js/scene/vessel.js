// The common femoral artery cut lengthwise: the back half (z <= 0) of a thick-walled tube along x, with the
// arteriotomy in its anterior wall. The opening shrinks with holeOpen; gather pulls the wall between the two suture
// bites toward the hole (and puckers it outward a little), which is what tightening the stitch does.
import { W } from './world.js';

function nodes(spans) {            // [[from, to, step], …] → sorted unique stops
  const v = [];
  for (const [a, b, s] of spans) for (let x = a; x < b - 1e-9; x += s) v.push(+x.toFixed(6));
  v.push(spans[spans.length - 1][1]);
  return [...new Set(v)].sort((p, q) => p - q);
}
const XS = nodes([[-60, -8, 1], [-8, 8, 0.1], [8, 60, 1]]);
const TS0 = nodes([[0, 0.7, 0.025], [0.7, Math.PI, 0.0815]]);   // angle from the anterior midline, 0 … π (posterior)
const TSF = nodes([[-1.0, 0.7, 0.025], [0.7, Math.PI, 0.0815]]); // … with the front wall on the near side of the cut (a view from above)

// how far a point x on the anterior wall moves toward the hole at full gather
function pull(x, B) {
  const ax = Math.abs(x), h = W.HOLE_R;
  if (ax <= h) return x;                                     // the hole's rim closes onto x = 0
  const fall = Math.max(0, 1 - (ax - h) / (B + 2 - h));
  return Math.sign(x) * h * fall;
}

// where a point x on the anterior wall's top ends up at a given gather (the suture follows the same tissue)
export const gatherX = (x, gather, bites = [-4, 4]) => x - gather * pull(x, Math.max(Math.abs(bites[0]), Math.abs(bites[1])));

export function vesselGeometry({ holeOpen = 1, gather = 0, bites = [-4, 4], frontWall = 0 } = {}) {
  const TS = frontWall ? TSF : TS0;
  const B = Math.max(Math.abs(bites[0]), Math.abs(bites[1]));
  const rHole = W.HOLE_R * holeOpen;
  const pos = [], nrm = [], idx = [];
  const nx = XS.length, nt = TS.length, cy = W.VESSEL_CY, t0 = TS[0];

  // one vertex: radius r at (x, θ), with gather applied to the anterior wall
  const at = (x, t, r) => {
    const front = Math.max(0, Math.cos(t));                  // 1 on the anterior midline, 0 from the sides back (t may be < 0 in front)
    const w = front * front;
    const xg = x - gather * w * pull(x, B);
    const bump = Math.abs(x) < B ? 0.35 * gather * w * Math.cos(Math.PI * x / (2 * B)) ** 2 : 0;
    return [xg, cy + r * Math.cos(t) + bump, -r * Math.sin(t)];
  };
  const inHole = (p, t) => rHole > 0 && Math.abs(t) < 1.0 && Math.hypot(p[0], p[2]) < rHole;

  // a grid surface: rows over x, columns over θ; triangles whose centroid lies in the hole are dropped
  function surface(r, sign) {
    const base = pos.length / 3;
    for (const x of XS) for (const t of TS) {
      const p = at(x, t, r); pos.push(...p);
      nrm.push(0, sign * Math.cos(t), -sign * Math.sin(t));
    }
    for (let i = 0; i < nx - 1; i++) for (let j = 0; j < nt - 1; j++) {
      const a = base + i * nt + j, b = a + nt, c = b + 1, d = a + 1;
      const tc = (TS[j] + TS[j + 1]) / 2, xc = (XS[i] + XS[i + 1]) / 2;
      if (inHole(at(xc, tc, r), tc)) continue;
      if (sign > 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c);
    }
  }
  const groups = [], mark = (m) => { const start = groups.length ? groups[groups.length - 1].start + groups[groups.length - 1].count : 0;
    groups.push({ start, count: idx.length - start, materialIndex: m }); };
  surface(W.LUMEN_R + W.WALL_T, +1); mark(0);   // outer surface (adventitia), facing out
  surface(W.LUMEN_R, -1); mark(1);              // inner surface (intima), facing the lumen

  // the cut faces at z = 0: the anterior wall's edge (θ = 0) and the posterior wall's edge (θ = π)
  for (const t of [t0, Math.PI]) {
    const base = pos.length / 3;
    for (const x of XS) for (const r of [W.LUMEN_R, W.LUMEN_R + W.WALL_T]) {
      const p = at(x, t, r); pos.push(p[0], p[1], t === t0 ? p[2] : 0); nrm.push(0, 0, 1);
    }
    for (let i = 0; i < nx - 1; i++) {
      const a = base + 2 * i, b = a + 1, c = a + 3, d = a + 2;
      const xc = (XS[i] + XS[i + 1]) / 2;
      if (t === t0 && inHole(at(xc, t0, W.LUMEN_R + 0.5 * W.WALL_T), t0)) continue;
      idx.push(a, d, c, a, c, b);
    }
  }
  mark(2);                                       // the cut wall
  return { position: new Float32Array(pos), normal: new Float32Array(nrm), index: new Uint32Array(idx), groups };
}
