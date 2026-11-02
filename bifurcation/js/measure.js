// The final product, measured from the drawn struts (design §7.5) — and the checks the steps make on the way.
import { A, axis, CARINA, OSTIUM } from './scene/anatomy.js';
import { lumenRadius, lumenSDF } from './scene/vessel.js';
import { pushFn } from './devices/push.js';
import { stentFrameAt, stentRadius, cellAtVessel, stentLines } from './devices/stent.js';
import { ladPath, ladFrameOf } from './devices/paths.js';
import { sbStentLines } from './devices/sb-stent.js';
import { stentSheet } from './devices/sheet.js';
import { wirePath } from './devices/wires.js';

const SB = axis('sb').dir, sbProj = (p) => p[0] * SB[0] + p[1] * SB[1];

// max ÷ min diameter of the deployed stent's cross-section where the LAD axis passes x (struts within ±0.4 mm of the plane
// perpendicular to the axis there, measured in that plane)
export function ellipticity(lines, x) {
  let lo = -14, hi = 18;
  for (let it = 0; it < 50; it++) { const m = (lo + hi) / 2; if (ladPath(m).p[0] < x) lo = m; else hi = m; }
  const f = ladPath((lo + hi) / 2), b = [0, 0, 1];
  const pts = [];
  for (const p of lines.flat()) { const v = [p[0] - f.p[0], p[1] - f.p[1], p[2] - f.p[2]];
    if (Math.abs(v[0] * f.t[0] + v[1] * f.t[1] + v[2] * f.t[2]) < 0.4) pts.push([v[0] * f.n[0] + v[1] * f.n[1] + v[2] * f.n[2], v[2]]); }
  if (pts.length < 8) return NaN;
  let mnW = Infinity, mxW = 0;
  for (let a = 0; a < 180; a += 2) {
    const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180);
    let mn = Infinity, mx = -Infinity;
    for (const q of pts) { const w = q[0] * c + q[1] * s; mn = Math.min(mn, w); mx = Math.max(mx, w); }
    mnW = Math.min(mnW, mx - mn); mxW = Math.max(mxW, mx - mn);
  }
  return mxW / mnW;
}
// the widest gap between a strut and the vessel wall behind it on the pMV between x0 and x1 (malapposition)
export function wallGap(lines, pose, ctx, x0, x1) {
  let g = 0;
  for (const p of lines.flat()) {
    if (p[0] < x0 || p[0] > x1 || p[0] > 0) continue;
    const th = Math.atan2(p[2], p[1]), r = Math.hypot(p[1], p[2]);
    g = Math.max(g, lumenRadius('pmv', p[0], th, pose, 0) - r);
  }
  return g;
}
// the share of the D1 ostium that is not one open window, seen down D1's axis: 1 − (largest strut-free region ÷ the disk)
export function ostiumObstruction(lines, opts = {}) {
  return obstructionAlong(lines, SB, sbProj(OSTIUM.heel) - 2, sbProj(OSTIUM.centre) + 1.5, A.SB_R, opts);
}
// the same over the distal LAD's origin, seen down its axis (the culotte's D1 stent crosses it), from 2.5 mm before the
// carina tip's place on that axis to 1.5 mm past it
const DMV = axis('dmv').dir, S_TIP_D = CARINA.tip[0] * DMV[0] + CARINA.tip[1] * DMV[1];
export function openingObstruction(lines, branch = 'sb', opts = {}) {
  return branch === 'dmv' ? obstructionAlong(lines, DMV, S_TIP_D - 2.5, S_TIP_D + 1.5, A.DMV_R, opts) : ostiumObstruction(lines, opts);
}
function obstructionAlong(lines, dir, sLo, sHi, R, { step = 0.025, half = 0.04 } = {}) {
  const proj = (p) => p[0] * dir[0] + p[1] * dir[1];
  const n = [-dir[1], dir[0], 0];                                  // in-plane, across the branch
  const segs = [];
  for (const l of lines) for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i];
    const near = (p) => { const s = proj(p); const u = p[0] * n[0] + p[1] * n[1]; return s > sLo && s < sHi && Math.hypot(u, p[2]) < R + 0.3; };
    if (!near(a) && !near(b)) continue;
    segs.push([[a[0] * n[0] + a[1] * n[1], a[2]], [b[0] * n[0] + b[1] * n[1], b[2]]]);
  }
  const N = Math.ceil(2 * R / step), grid = new Uint8Array(N * N);   // 0 outside the disk, 1 free, 2 metal
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = -R + (i + 0.5) * step, v = -R + (j + 0.5) * step;
    if (u * u + v * v > R * R) continue;
    let metal = false;
    for (const [a, b] of segs) {
      const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(u - a[0] - t * dx, v - a[1] - t * dy) < half) { metal = true; break; }
    }
    grid[j * N + i] = metal ? 2 : 1;
  }
  let disk = 0, best = 0; const seen = new Uint8Array(N * N), stack = [];
  for (let k = 0; k < N * N; k++) if (grid[k]) disk++;
  for (let k = 0; k < N * N; k++) {
    if (grid[k] !== 1 || seen[k]) continue;
    let size = 0; stack.push(k); seen[k] = 1;
    while (stack.length) { const q = stack.pop(); size++; const i = q % N, j = (q - i) / N;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N) continue;
        const r = b * N + a; if (grid[r] === 1 && !seen[r]) { seen[r] = 1; stack.push(r); } } }
    best = Math.max(best, size);
  }
  return 1 - best / disk;
}
// strut points hanging in the lumen (≥ 0.25 mm from every wall) at the flow divider — within 3 mm of the carina tip and nearer
// it than D1's heel (struts left over the heel side of the ostium are a partly jailed ostium, not a neo-carina): a metal
// neo-carina
export function neoCarina(lines, pose, ctx) {
  const push = pushFn(pose, ctx), t = CARINA.tip, h = OSTIUM.heel; let n = 0;
  for (const p of lines.flat()) {
    const dt = Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]), dh = Math.hypot(p[0] - h[0], p[1] - h[1], p[2] - h[2]);
    if (dt < 3 && dt < dh && lumenSDF(p, pose, push) < -0.25) n++;
  }
  return n;
}
// where a path crosses the stent's surface, and through which cell
export function crossings(path, lines, graph, pose, ctx) {
  const out = [], f = (p) => { const q = stentFrameAt(p, pose, ctx); return { q, d: q.r - q.stentR }; };
  const u0 = stentFrameAt(lines[0][0], pose, ctx).u - 0.2, u1 = u0 + 22.4;
  let prev = null;
  for (const p of path) {
    const cur = { p, ...f(p) };
    if (prev && cur.q.u > u0 && cur.q.u < u1 && prev.q.u > u0 && prev.q.u < u1 && (prev.d < 0) !== (cur.d < 0)) {
      let a = prev.p, b = cur.p, da = prev.d;
      for (let it = 0; it < 30; it++) { const m = [0, 1, 2].map(k => (a[k] + b[k]) / 2), dm = f(m).d; if ((dm < 0) === (da < 0)) { a = m; da = dm; } else b = m; }
      const q = f(a).q; out.push({ point: a, cell: cellAtVessel(graph, q.th, q.z) });
    }
    prev = cur;
  }
  return out;
}

// ── Phase 2: sheets crossed, layers stacked, the final product ──
// triangles of every sheet binned in a 0.4 mm grid (once per set of sheets)
const BIN = 0.4, binCache = new WeakMap();
function binned(sheets) {
  if (binCache.has(sheets)) return binCache.get(sheets);
  const map = new Map(), tris = [];
  for (const [name, sh] of Object.entries(sheets)) {
    if (!sh) continue;
    const P = sh.position, I = sh.index;
    for (let t = 0; t < I.length; t += 3) {
      const v = [I[t], I[t + 1], I[t + 2]].map(i => [P[3 * i], P[3 * i + 1], P[3 * i + 2]]), id = tris.length;
      tris.push({ name, v });
      const lo = [0, 1, 2].map(c => Math.floor(Math.min(v[0][c], v[1][c], v[2][c]) / BIN)), hi = [0, 1, 2].map(c => Math.floor(Math.max(v[0][c], v[1][c], v[2][c]) / BIN));
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) {
        const k = `${x},${y},${z}`; let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(id);
      }
    }
  }
  const out = { map, tris };
  binCache.set(sheets, out);
  return out;
}
// segment a→b against a triangle (Möller–Trumbore): t ∈ [0, 1] along the segment, or null
function hitTri(a, b, v) {
  const e1 = [0, 1, 2].map(c => v[1][c] - v[0][c]), e2 = [0, 1, 2].map(c => v[2][c] - v[0][c]), dir = [0, 1, 2].map(c => b[c] - a[c]);
  const p = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]];
  const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
  if (Math.abs(det) < 1e-14) return null;
  const tv = [0, 1, 2].map(c => a[c] - v[0][c]), u = (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / det;
  if (u < 0 || u > 1) return null;
  const q = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]];
  const w = (dir[0] * q[0] + dir[1] * q[1] + dir[2] * q[2]) / det;
  if (w < 0 || u + w > 1) return null;
  const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det;
  return t >= 0 && t <= 1 ? t : null;
}
// where a path crosses the sheets: [{ sheet, point }] in order along it; hits on one sheet within 0.02 mm merge. With
// minCos, only crossings that meet the sheet within acos(minCos) of face-on count (a stacked layer, not a graze).
export function sheetCrossings(path, sheets, { minCos = 0 } = {}) {
  const { map, tris } = binned(sheets), hits = [];
  let base = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const lo = [0, 1, 2].map(c => Math.floor(Math.min(a[c], b[c]) / BIN)), hi = [0, 1, 2].map(c => Math.floor(Math.max(a[c], b[c]) / BIN)), seen = new Set();
    if ((hi[0] - lo[0] + 1) * (hi[1] - lo[1] + 1) * (hi[2] - lo[2] + 1) < 4000)
      for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) {
        for (const id of map.get(`${x},${y},${z}`) || []) {
          if (seen.has(id)) continue; seen.add(id);
          const t = hitTri(a, b, tris[id].v);
          if (t !== null && minCos > 0) { const v = tris[id].v, e1 = [0, 1, 2].map(c => v[1][c] - v[0][c]), e2 = [0, 1, 2].map(c => v[2][c] - v[0][c]);
            const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], dir = [0, 1, 2].map(c => b[c] - a[c]);
            if (Math.abs(n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2]) < minCos * Math.hypot(...n) * Math.hypot(...dir)) continue; }
          if (t !== null) hits.push({ sheet: tris[id].name, at: base + t * L, point: [0, 1, 2].map(c => a[c] + t * (b[c] - a[c])) });
        }
      }
    base += L;
  }
  hits.sort((p, q) => p.at - q.at);
  const out = [];
  for (const h of hits) if (!out.some(o => o.sheet === h.sheet && Math.abs(o.at - h.at) < 0.02)) out.push(h);
  return out.map(({ sheet, point }) => ({ sheet, point }));
}
const SBX = axis('sb').dir, sbAtX = (s) => [SBX[0] * s, SBX[1] * s, 0];
// the wall's normal at a point: radial from the LAD path's axis on or inside the LAD's wall (within 2.1 mm of its axis:
// the LAD stent, crushed metal, struts across the D1 mouth), from D1's axis beyond it
function wallNormal(p) {
  const { f } = ladFrameOf(p), v = [p[0] - f.p[0], p[1] - f.p[1], p[2] - f.p[2]], rl = Math.hypot(...v);
  const s = sbProj(p), q = sbAtX(s), w = [p[0] - q[0], p[1] - q[1], p[2] - q[2]], rd = Math.hypot(...w);
  const use = s > 0 && rl > 2.1 ? [w, rd] : [v, rl];
  return use[1] > 1e-9 ? use[0].map(c => c / use[1]) : [0, 1, 0];
}
// per strut point, how many layers a short ray along the wall's normal crosses face-on (within 60°; 0.35 mm inside to
// 0.30 outside): the LAD stent counts once, the D1 stent at most twice (its two walls, once crushed) — where a kiss's
// opening folds a sheet against itself at the carina a real stent's struts lie side by side, not stacked. A strut is at
// least its own stent's layer (where its own sheet is torn or met edge-on, the other stent's still adds).
// { mv, sb: [Int8Array per line] | null, max }
export function layerMap(lines, sheets, ctx) {
  const out = { max: 0 };
  for (const name of ['mv', 'sb']) {
    if (!lines[name]) { out[name] = null; continue; }
    out[name] = lines[name].map(l => Int8Array.from(l, (p) => {
      const n = wallNormal(p), a = [0, 1, 2].map(c => p[c] - 0.35 * n[c]), b = [0, 1, 2].map(c => p[c] + 0.30 * n[c]);
      const h = sheetCrossings([a, b], sheets, { minCos: 0.5 }), own = (s) => (s === name ? 1 : 0);
      const mv = Math.max(own('mv'), h.filter(x => x.sheet === 'mv').length), sb = Math.max(own('sb'), h.filter(x => x.sheet === 'sb').length);
      const k = Math.min(1, mv) + Math.min(2, sb); if (k > out.max) out.max = k; return k;
    }));
  }
  return out;
}
// how far along the LAD (x) the points on its D1 side with ≥ k layers reach, mm
export function bandLength(lines, counts, k) {
  let lo = Infinity, hi = -Infinity;
  for (const name of ['mv', 'sb']) {
    if (!lines[name] || !counts[name]) continue;
    lines[name].forEach((l, i) => l.forEach((p, j) => {
      if (counts[name][i][j] < k || p[0] > CARINA.cutX + 0.3) return;
      const { f } = ladFrameOf(p), un = (p[0] - f.p[0]) * f.n[0] + (p[1] - f.p[1]) * f.n[1];
      if (un <= 0 || Math.hypot(un, p[2]) > 2.4) return;
      lo = Math.min(lo, p[0]); hi = Math.max(hi, p[0]);
    }));
  }
  return hi > lo ? hi - lo : 0;
}
// Phase 3: two layers all round the proximal LAD (the culotte's overlap) — the longest run along x, in 0.25 mm slices up to
// the carina, where ≥ 90 % of the LAD stent's struts on each side (D1's and the far side) read k layers or more, mm
export function ringLength(lines, counts, k = 2) {
  if (!lines.mv || !counts.mv) return 0;
  const B = new Map();
  lines.mv.forEach((l, i) => l.forEach((p, j) => {
    if (p[0] > CARINA.cutX) return;
    const { f } = ladFrameOf(p), un = (p[0] - f.p[0]) * f.n[0] + (p[1] - f.p[1]) * f.n[1];
    if (Math.hypot(un, p[2]) > 2.4) return;
    const key = Math.floor(p[0] / 0.25), side = un > 0 ? 1 : 0;
    let b = B.get(key); if (!b) { b = [[0, 0], [0, 0]]; B.set(key, b); }
    b[side][0]++; if (counts.mv[i][j] >= k) b[side][1]++;
  }));
  let best = 0, run = 0;
  for (const key of [...B.keys()].sort((a, b) => a - b)) {
    const b = B.get(key), full = b.every(([n, m]) => n > 0 && m >= 0.9 * n), prev = B.has(key - 1);
    run = full ? (prev ? run + 1 : 1) : 0; best = Math.max(best, run);
  }
  return best * 0.25;
}
// the layers stacked at the carina: the most any strut within 0.6 mm of the carina tip reads (0 if none there)
export function carinaLayers(lines, counts) {
  const t = CARINA.tip; let m = 0;
  for (const name of ['mv', 'sb']) if (lines[name] && counts[name]) lines[name].forEach((l, i) => l.forEach((p, j) => {
    if (Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]) < 0.6) m = Math.max(m, counts[name][i][j]); }));
  return m;
}
// how much of D1's heel a D1 stent leaves bare: from the heel to the D1 stent's nearest strut on the heel side (within 35° of
// the heel's direction about D1's axis), along D1, mm; 0 if covered (Phase 3: TAP covers it, a plain T at 50° does not)
export function heelGap(sbLines) {
  const n = [-SB[1], SB[0], 0], sH = sbProj(OSTIUM.heel); let m = Infinity;
  for (const p of sbLines.flat()) { const s = sbProj(p), v = [p[0] - SB[0] * s, p[1] - SB[1] * s, p[2]];
    if (Math.abs(Math.atan2(v[2], v[0] * n[0] + v[1] * n[1])) <= 35 * Math.PI / 180) m = Math.min(m, s); }
  return m === Infinity ? Infinity : Math.max(0, m - sH);
}
// how far from the carina tip the metal hanging at the flow divider reaches (neoCarina's points), mm; 0 if none
export function neoCarinaLength(lines, pose, ctx) {
  const push = pushFn(pose, ctx), t = CARINA.tip, h = OSTIUM.heel; let m = 0;
  for (const p of lines.flat()) {
    const dt = Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]), dh = Math.hypot(p[0] - h[0], p[1] - h[1], p[2] - h[2]);
    if (dt < 3 && dt < dh && lumenSDF(p, pose, push) < -0.25) m = Math.max(m, dt);
  }
  return m;
}
// the final product (design §7.5): measured on the Done pose, except the layers the last wire crossed, measured on the
// state just after the technique's last rewire (by Done the final kiss has opened that cell). Phase 4: and D1's heel left
// bare (null without a D1 stent)
const linesOf = (pose, ctx) => ({ mv: pose.st_shown ? stentLines(ctx.graph, pose, ctx) : null, sb: pose.ss_shown ? sbStentLines(ctx.graph, pose, ctx) : null });
const sheetsOf = (pose, ctx) => ({ mv: pose.st_shown ? stentSheet('mv', ctx.graph, pose, ctx) : null, sb: pose.ss_shown ? stentSheet('sb', ctx.graph, pose, ctx) : null });
export function finalProduct(done, ctx, { rewirePose = null, wire = 'A' } = {}) {
  const L = linesOf(done, ctx), map = layerMap(L, sheetsOf(done, ctx), ctx), all = [...(L.mv || []), ...(L.sb || [])];
  const across = rewirePose ? sheetCrossings(wirePath(rewirePose, wire, ctx), sheetsOf(rewirePose, ctx)).length : 0;
  return { acrossLayers: across, ostiumCovered: ostiumObstruction(all), maxLayers: map.max, band2: bandLength(L, map, 2), band3: bandLength(L, map, 3),
    neoCarina: neoCarinaLength(all, done, ctx), ring2: ringLength(L, map, 2), carinaLayers: carinaLayers(L, map),
    heelGap: L.sb ? heelGap(L.sb) : null, map, lines: L };
}
