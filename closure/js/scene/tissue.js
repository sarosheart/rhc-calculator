// The tissue block around the artery: skin on top, subcutaneous fat below, cut by the plane z = 0 along the tract.
// The artery's own wall is drawn by vessel.js; here the vessel's channel and the tract are left open.
import { W } from './world.js';

const SQ = Math.SQRT1_2;
const tractDist = (x, y) => Math.abs(x - (y - W.WALL_OUT_Y)) * SQ;     // distance from the 45° tract line through (0, -30)
const inVessel = (y, z) => Math.hypot(y - W.VESSEL_CY, z) < W.VESSEL_OUT_R;

// grid patch on a plane: (u, v) → point; triangles dropped where keep() is false; returns its own arrays
function patch(us, vs, point, normal, uv, keep) {
  const pos = [], nrm = [], tex = [], idx = [];
  for (const u of us) for (const v of vs) { const p = point(u, v); pos.push(...p); nrm.push(...normal); tex.push(...uv(p)); }
  const nv = vs.length;
  for (let i = 0; i < us.length - 1; i++) for (let j = 0; j < nv - 1; j++) {
    const a = i * nv + j, b = a + nv, c = b + 1, d = a + 1;
    const q = [a, b, c, d].map(k => [pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]]);
    const cen = [0, 1, 2].map(k => (q[0][k] + q[1][k] + q[2][k] + q[3][k]) / 4);
    if (keep(cen)) idx.push(a, b, c, a, c, d);
  }
  return compact({ pos, nrm, tex, idx });
}
// drop the vertices no triangle uses
function compact({ pos, nrm, tex, idx }) {
  const map = new Map(), P = [], N = [], T = [], I = [];
  for (const k of idx) {
    if (!map.has(k)) { map.set(k, P.length / 3); P.push(pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]);
      N.push(nrm[3 * k], nrm[3 * k + 1], nrm[3 * k + 2]); T.push(tex[2 * k], tex[2 * k + 1]); }
    I.push(map.get(k));
  }
  return { pos: P, nrm: N, tex: T, idx: I };
}
function merge(parts) {
  const out = { pos: [], nrm: [], tex: [], idx: [] };
  for (const p of parts) {
    const base = out.pos.length / 3;
    out.pos.push(...p.pos); out.nrm.push(...p.nrm); out.tex.push(...p.tex); for (const k of p.idx) out.idx.push(base + k);
  }
  return { position: new Float32Array(out.pos), normal: new Float32Array(out.nrm), uv: new Float32Array(out.tex),
    index: new Uint32Array(out.idx) };
}
const range = (a, b, s) => { const v = []; for (let x = a; x < b - 1e-9; x += s) v.push(+x.toFixed(6)); v.push(b); return v; };
const fine = (a, b, lo, hi, s0, s1) => [...new Set([...range(a, lo, s0), ...range(lo, hi, s1), ...range(hi, b, s0)])].sort((p, q) => p - q);

// a flat convex polygon (points in order) on a plane, fanned from its first corner
function polygon(points, normal, uv) {
  const pos = [], nrm = [], tex = [], idx = [];
  for (const p of points) { pos.push(...p); nrm.push(...normal); tex.push(...uv(p)); }
  for (let k = 1; k < points.length - 1; k++) idx.push(0, k, k + 1);
  return { pos, nrm, tex, idx };
}

export function tissueGeometry() {
  const T = W.TISSUE, top = W.SKIN_Y, skinBase = W.SKIN_Y - W.SKIN_T, R = W.TRACT_R;
  const exitX = W.SKIN_Y - W.WALL_OUT_Y;                                 // the tract meets the skin at x = 30
  const uvCut = (p) => [p[0] / 24, p[1] / 24], uvTop = (p) => [p[0] / 24, p[2] / 24];
  const xs = fine(T.x0, T.x1, exitX - 6, exitX + 6, 2, 0.25);
  // the tract cuts the face as a straight 45° band; its edges at height y, either side
  const hw = R / Math.sin(W.ANGLE * Math.PI / 180);                     // half-width of the band along x
  const edge = (y, side) => [(y - W.WALL_OUT_Y) + side * hw, y, 0];
  const Z = [0, 0, 1];
  const cutBand = (y0, y1) => [                                         // the face between y0 and y1, left and right of the band
    polygon([[T.x0, y0, 0], edge(y0, -1), edge(y1, -1), [T.x0, y1, 0]], Z, uvCut),
    polygon([edge(y0, 1), [T.x1, y0, 0], [T.x1, y1, 0], edge(y1, 1)], Z, uvCut),
  ];

  // skin: its top surface (with the tract's exit) and its edge on the cut face
  const skinTop = patch(xs, fine(T.z0, 0, -4, 0, 2, 0.25), (x, z) => [x, top, z], [0, 1, 0], uvTop,
    (c) => Math.hypot((c[0] - exitX) / hw * R, c[2]) >= R);
  // fat: the cut face above and below the artery, and the block's back, bottom and side faces
  const below = polygon([[T.x0, T.y0, 0], [T.x1, T.y0, 0], [T.x1, W.VESSEL_CY - W.VESSEL_OUT_R, 0], [T.x0, W.VESSEL_CY - W.VESSEL_OUT_R, 0]], Z, uvCut);
  const back = polygon([[T.x0, T.y0, T.z0], [T.x0, top, T.z0], [T.x1, top, T.z0], [T.x1, T.y0, T.z0]], [0, 0, -1], uvCut);
  const bottom = polygon([[T.x0, T.y0, T.z0], [T.x1, T.y0, T.z0], [T.x1, T.y0, 0], [T.x0, T.y0, 0]], [0, -1, 0], uvTop);
  const sides = [T.x0, T.x1].map((x) => patch(range(T.y0, skinBase, 0.5), range(T.z0, 0, 0.5), (y, z) => [x, y, z],
    [Math.sign(x), 0, 0], (p) => [p[2] / 20, p[1] / 20], (c) => !inVessel(c[1], c[2])));
  return { skin: merge([skinTop, ...cutBand(skinBase, top)]), fat: merge([...cutBand(W.WALL_OUT_Y, skinBase), below, back, bottom, ...sides]) };
}

// Subcutaneous fat on the cut face: small yellow lobules (~1.5 mm) packed inside larger lobules whose fibrous septa are
// paler and thicker, a little colour from lobule to lobule, and a height map (lobules domed, septa sunk) for the light.
// Deterministic per seed; every distance wraps, so the texture tiles. Returns RGBA pixels and a matching height field.
export function fatTexture(seed = 7, size = 256) {
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const cellsOf = (n) => Array.from({ length: n }, () => ({ x: rnd() * size, y: rnd() * size, tone: rnd(), warm: rnd() }));
  const big = cellsOf(10), small = cellsOf(150);
  const near2 = (cells, px, py) => {
    let d1 = Infinity, d2 = Infinity, c1 = null;
    for (const c of cells) {
      let dx = Math.abs(px - c.x), dy = Math.abs(py - c.y); dx = Math.min(dx, size - dx); dy = Math.min(dy, size - dy);
      const d = dx * dx + dy * dy; if (d < d1) { d2 = d1; d1 = d; c1 = c; } else if (d < d2) d2 = d;
    }
    return { e: Math.sqrt(d2) - Math.sqrt(d1), d: Math.sqrt(d1), c: c1 };
  };
  const data = new Uint8Array(size * size * 4), height = new Float32Array(size * size);
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const B = near2(big, px, py), S = near2(small, px, py);
    const septBig = 1 - smooth(1.2, 3.2, B.e), septSmall = 1 - smooth(0.4, 1.4, S.e);
    const dome = Math.min(1, S.d / 13);
    const tone = 0.9 + 0.1 * S.c.tone, warm = S.c.warm;
    // lobule: yellow, a touch orange in some, brighter at the centre
    let r = (238 + 10 * warm) * tone * (1 - 0.12 * dome), g = (200 - 18 * warm) * tone * (1 - 0.14 * dome), b = (96 - 20 * warm) * tone * (1 - 0.2 * dome);
    // septa: pale pink-white, the big ones more so
    const sp = Math.max(septSmall * 0.7, septBig);
    r = r * (1 - sp) + 232 * sp; g = g * (1 - sp) + 205 * sp; b = b * (1 - sp) + 190 * sp;
    const k = 4 * (py * size + px);
    data[k] = Math.round(Math.min(255, r)); data[k + 1] = Math.round(Math.min(255, g)); data[k + 2] = Math.round(Math.min(255, b)); data[k + 3] = 255;
    height[py * size + px] = (1 - dome * dome) * (1 - sp) - 0.6 * septBig;
  }
  return { width: size, height: size, data, heightField: height };
}

// a tangent-space normal map (RGBA) from a wrapping height field
export function normalMap({ width, height, heightField }, strength = 2.2) {
  const out = new Uint8Array(width * height * 4), H = (x, y) => heightField[((y + height) % height) * width + ((x + width) % width)];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1);
    const k = 4 * (y * width + x);
    out[k] = Math.round((-dx / l * 0.5 + 0.5) * 255); out[k + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255); out[k + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); out[k + 3] = 255;
  }
  return out;
}
