// The motion, baked by tools/sentinel/bake.py from the same timeline, device paths and debris as the preview video
// (data/sequence.json). decode() turns it into one full frame per sample; frameAt(x) is the frame at a position along the
// moves (x = 2.5: half-way through the third move), blended between two samples only where the bake checked the blend
// against the vessel walls — the same device track, the same scene. geometry() turns a frame into what is drawn.
// Coordinates are three.js's (y up), in mm. Pure: no three.js, no DOM.

const POINTS = new Set(['ph', 'pb', 'dh', 'db', 'dc', 'dt']);

function points(L, q) {                     // first point, then steps: back to positions
  const out = new Float64Array(L.length); let x = 0, y = 0, z = 0;
  for (let i = 0; i < L.length; i += 3) { x += L[i]; y += L[i + 1]; z += L[i + 2]; out[i] = x * q; out[i + 1] = y * q; out[i + 2] = z * q; }
  return out;
}
export function track(P) {                  // a polyline and the arc length at each vertex
  const n = P.length / 3, S = new Float64Array(n);
  for (let i = 1; i < n; i++) S[i] = S[i - 1] + Math.hypot(P[3 * i] - P[3 * i - 3], P[3 * i + 1] - P[3 * i - 2], P[3 * i + 2] - P[3 * i - 1]);
  return { P, S };
}
function concat(a, b) { const o = new Float64Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; }

export function decode(data) {
  const { q, qs } = data;
  const arm = points(data.static.arm, q);
  const statics = { pig: track(points(data.static.pig, q)), del: track(points(data.static.del, q)) };
  const debris = data.debris.map((d) => ({ r: d.r, kind: d.kind, t0: d.t0, t1: d.t1, path: track(points(d.path, q)) }));
  const moves = []; let cur = null, gid = 0;
  for (const m of data.moves) {
    const frames = [];
    for (const f of m.frames) {
      const next = cur ? { ...cur } : {};
      for (const [k, v] of Object.entries(f)) {
        if (k === 'g') next.g = { id: ++gid, ...track(concat(arm, points(v, q))) };
        else if (POINTS.has(k)) next[k] = v === null ? null : points(v, q);
        else if (k === 'deb') next.deb = new Map(v.map((d) => [d[0], points(d.slice(1), q)]));
        else if (k === 'c') next.c = Object.fromEntries(Object.entries(v).map(([n, [a, b]]) => [n, [a * qs, b * qs]]));
        else if (k === 'h') next.h = v.map((x) => x * qs);
        else if (k === 'pig' || k === 'del') next[k] = v === null ? null : v * qs;
        else next[k] = v;                                           // tab, dv, tm
      }
      frames.push(next); cur = next;
    }
    moves.push({ step: m.step, label: m.label, control: m.control, arrow: m.arrow, ms: m.ms, frames });
  }
  return { steps: data.steps, views: data.views, radius: data.radius, nRing: data.nRing, table: decodeTable(data.table, q),
    statics, debris, moves };
}

function decodeTable(t, q) {
  const out = { open: t.open, deb: t.deb.map((d) => [d[0], points(d.slice(1), q)]) };
  for (const [k, v] of Object.entries(t)) if (k !== 'open' && k !== 'deb') out[k] = points(v, q);
  return out;
}

const lerp = (a, b, w) => a + (b - a) * w;
function lerpArr(A, B, w) { const o = new Float64Array(A.length); for (let i = 0; i < A.length; i++) o[i] = A[i] + (B[i] - A[i]) * w; return o; }
// a filter bag coming out of (or going into) its sheath: the rings it does not have yet sit on its last one
function padRings(X, n, nRing) {
  if (X.length >= n) return X;
  const o = new Float64Array(n); o.set(X); const last = X.subarray(X.length - 3 * nRing);
  for (let i = X.length; i < n; i += 3 * nRing) o.set(last, i);
  return o;
}

// the frame at position x along the moves (0 … number of moves)
export function frameAt(seq, x) {
  const M = seq.moves.length;
  x = Math.min(Math.max(x, 0), M);
  const m = Math.min(Math.floor(x), M - 1), mv = seq.moves[m], n = mv.frames.length - 1;
  const pos = (x - m) * n, i = Math.min(Math.floor(pos), n - 1), w = pos - i;
  return blend(seq, mv.frames[i], mv.frames[i + 1], w);
}

export function blend(seq, A, B, w) {
  if (w <= 1e-9) return A;                                           // on a sample (to rounding): that sample, exactly
  if (w >= 1 - 1e-9) return B;
  const near = w < 0.5 ? A : B;
  if (A.g.id !== B.g.id || A.tab !== B.tab) return near;           // the track reshapes: hold the nearer sample
  const F = { ...near, tm: lerp(A.tm, B.tm, w), h: A.h.map((v, k) => lerp(v, B.h[k], w)), c: {} };
  for (const k of new Set([...Object.keys(A.c), ...Object.keys(B.c)])) {
    if (A.c[k] && B.c[k]) F.c[k] = [lerp(A.c[k][0], B.c[k][0], w), lerp(A.c[k][1], B.c[k][1], w)];
    else if (near.c[k]) F.c[k] = near.c[k];
  }
  for (const k of ['pig', 'del']) if (A[k] !== null && B[k] !== null) F[k] = lerp(A[k], B[k], w);
  for (const k of POINTS) {
    let a = A[k], b = B[k];
    if (!a || !b) continue;                                          // appearing or gone: the nearer sample's
    if ((k === 'pb' || k === 'db') && a.length !== b.length) {
      const n = Math.max(a.length, b.length); a = padRings(a, n, seq.nRing); b = padRings(b, n, seq.nRing);
    }
    if (a.length === b.length) F[k] = lerpArr(a, b, w);
  }
  // resting debris: blended where both samples hold it, else drawn where the one that holds it has it (a particle
  // landing or folding away never blinks out between two samples); debrisAt() puts one still in flight on its path
  const deb = new Map();
  for (const [i, p] of B.deb) deb.set(i, A.deb.has(i) ? lerpArr(A.deb.get(i), p, w) : p);
  for (const [i, p] of A.deb) if (!B.deb.has(i)) deb.set(i, p);
  F.deb = deb;
  return F;
}

// ── what a frame draws ──
// a stretch of a track from arc length a to b: its two ends and every vertex between
export function cut({ P, S }, a, b) {
  const n = S.length; a = Math.max(a, S[0]); b = Math.min(b, S[n - 1]);
  if (b - a < 1e-6) return null;
  const out = [pointAt(P, S, a)];
  for (let i = 0; i < n; i++) if (S[i] > a && S[i] < b) out.push([P[3 * i], P[3 * i + 1], P[3 * i + 2]]);
  out.push(pointAt(P, S, b));
  return out;
}
export function pointAt(P, S, s) {
  const n = S.length;
  if (s <= S[0]) return [P[0], P[1], P[2]];
  if (s >= S[n - 1]) return [P[3 * n - 3], P[3 * n - 2], P[3 * n - 1]];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (S[mid] <= s) lo = mid; else hi = mid; }
  const t = (s - S[lo]) / ((S[hi] - S[lo]) || 1);
  return [P[3 * lo] + t * (P[3 * hi] - P[3 * lo]), P[3 * lo + 1] + t * (P[3 * hi + 1] - P[3 * lo + 1]), P[3 * lo + 2] + t * (P[3 * hi + 2] - P[3 * lo + 2])];
}
const smoothstep = (x) => { x = Math.min(Math.max(x, 0), 1); return x * x * (3 - 2 * x); };

// debris: in flight along its path by the clock, else where the frame rests it
export function debrisAt(seq, F) {
  const out = [];
  if (!F.dv) return out;
  seq.debris.forEach((d, i) => {
    if (d.t0 <= F.tm && F.tm < d.t1) {
      const { P, S } = d.path, w = smoothstep((F.tm - d.t0) / (d.t1 - d.t0));
      out.push({ i, p: pointAt(P, S, w * S[S.length - 1]) });
    } else if (F.deb.has(i)) {
      const p = F.deb.get(i); out.push({ i, p: [p[0], p[1], p[2]] });
    }
  });
  return out;
}

// the delivery catheter's nose: 3 mm across, tapering over its last 18 mm to 1 mm (as the video draws it)
export function deliveryRadius(L, R = 3.0) {
  return (s) => (s > L - 18 ? R - (R - 1.0) * smoothstep((s - (L - 18)) / 18) : R);
}

export const DEVICE = ['outer_sheath', 'shaft', 'art_sheath', 'wire'];

// everything a frame draws, as plain arrays: tubes as point lists, filters and debris as positions
export function geometry(seq, F) {
  if (F.tab) return { tab: true };
  const tubes = {};
  for (const k of DEVICE) if (F.c[k]) { const P = cut(F.g, F.c[k][0], F.c[k][1]); if (P && P.length > 1) tubes[k] = P; }
  if (F.pig !== null && F.pig !== undefined) { const P = cut(seq.statics.pig, 0, F.pig); if (P) tubes.pigtail = P; }
  if (F.del !== null && F.del !== undefined) { const P = cut(seq.statics.del, 0, F.del); if (P && P.length > 1) tubes.delivery = P; }
  return { tab: false, tubes, ph: F.ph, pb: F.pb, dh: F.dh, db: F.db, dc: F.dc, dt: F.dt, debris: debrisAt(seq, F) };
}
