// Smooth tubes along polylines (sutures, wire, sheaths): centripetal Catmull-Rom resampling, parallel-transport frames
// so the tube never twists, per-sample radius, analytic normals, capped ends. Returns plain typed arrays.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// centripetal Catmull-Rom through pts, sampled about every `step` mm; corners closer than `step` are kept
export function smooth(pts, step = 0.3) {
  const P = pts.filter((q, i) => i === 0 || dist(q, pts[i - 1]) > 1e-6);
  if (P.length < 3) return P.length === 2 ? resampleLine(P[0], P[1], step) : P.slice();
  const out = [P[0]];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const n = Math.max(1, Math.ceil(dist(p1, p2) / step));
    const t01 = Math.sqrt(dist(p0, p1)) || 1e-4, t12 = Math.sqrt(dist(p1, p2)) || 1e-4, t23 = Math.sqrt(dist(p2, p3)) || 1e-4;
    for (let k = 1; k <= n; k++) {
      const u = k / n, q = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const m1 = (p2[c] - p1[c]) + t12 * ((p1[c] - p0[c]) / t01 - (p2[c] - p0[c]) / (t01 + t12));
        const m2 = (p2[c] - p1[c]) + t12 * ((p3[c] - p2[c]) / t23 - (p3[c] - p1[c]) / (t12 + t23));
        const a = 2 * (p1[c] - p2[c]) + m1 + m2, b = -3 * (p1[c] - p2[c]) - m1 - m1 - m2;
        q[c] = a * u * u * u + b * u * u + m1 * u + p1[c];
      }
      out.push(q);
    }
  }
  return out;
}
function resampleLine(a, b, step) {
  const n = Math.max(1, Math.ceil(dist(a, b) / step)), out = [];
  for (let k = 0; k <= n; k++) out.push([0, 1, 2].map(c => a[c] + (b[c] - a[c]) * k / n));
  return out;
}

// radius: a number, or a function of arc length s (mm from the first point) → radius
export function tubeArrays(pts, radius, { sides = 10, caps = true } = {}) {
  const n = pts.length;
  if (n < 2) return { position: new Float32Array(0), normal: new Float32Array(0), index: new Uint32Array(0) };
  const S = [0]; for (let i = 1; i < n; i++) S.push(S[i - 1] + dist(pts[i], pts[i - 1]));
  const R = (i) => (typeof radius === 'function' ? radius(S[i]) : radius);
  const T = pts.map((p, i) => nrm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])));
  const N = [], B = [];
  const ref = Math.abs(T[0][2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  N[0] = nrm(crs(T[0], ref)); B[0] = crs(T[0], N[0]);
  for (let i = 1; i < n; i++) {                                // parallel transport: project the last normal onto the new plane
    const v = sub(N[i - 1], T[i].map(c => c * dot(N[i - 1], T[i])));
    N[i] = Math.hypot(...v) > 1e-6 ? nrm(v) : N[i - 1]; B[i] = crs(T[i], N[i]);
  }
  const pos = [], nor = [], idx = [], uvs = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < sides; k++) {
    const a = (k / sides) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), r = R(i);
    const d = [N[i][0] * c + B[i][0] * s, N[i][1] * c + B[i][1] * s, N[i][2] * c + B[i][2] * s];
    pos.push(pts[i][0] + d[0] * r, pts[i][1] + d[1] * r, pts[i][2] + d[2] * r); nor.push(...d); uvs.push(k / sides, S[i]);
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < sides; k++) {
    const a = i * sides + k, b = i * sides + (k + 1) % sides, c = (i + 1) * sides + k, d = (i + 1) * sides + (k + 1) % sides;
    idx.push(a, b, c, b, d, c);
  }
  if (caps) for (const [i, sgn] of [[0, -1], [n - 1, 1]]) {   // flat caps with their own vertices, so normals stay crisp
    const base = pos.length / 3, t = T[i].map(c => c * sgn), r = R(i);
    pos.push(...pts[i]); nor.push(...t); uvs.push(0.5, S[i]);
    for (let k = 0; k < sides; k++) { const v = i * sides + k; pos.push(pos[3 * v], pos[3 * v + 1], pos[3 * v + 2]); nor.push(...t); uvs.push(k / sides, S[i]); }
    for (let k = 0; k < sides; k++) { const a = base + 1 + k, b = base + 1 + (k + 1) % sides;
      if (sgn < 0) idx.push(base, b, a); else idx.push(base, a, b); }
    if (r <= 0) continue;
  }
  return { position: new Float32Array(pos), normal: new Float32Array(nor), uv: new Float32Array(uvs), index: new Uint32Array(idx) };
}
