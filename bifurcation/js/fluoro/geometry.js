// angio/js/geometry.js — C-arm geometry in DICOM patient LPS (+x patient-left, +y posterior, +z head), mm.
// Primary angle (LAO+) then secondary (CRA+), as the DICOM XA Positioner Module defines them. This is the convention
// the 2026-08 audit verified on the old page; scripts/test-angio-geometry.mjs pins it to that page's output.
const R = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function detectorDir(lao, cra) {
  const a = lao * R, b = cra * R;
  return [Math.sin(a) * Math.cos(b), -Math.cos(a) * Math.cos(b), Math.sin(b)];
}
export function imageBasis(lao, cra) {
  const a = lao * R, b = cra * R;
  const d = detectorDir(lao, cra);
  const up = [-Math.sin(a) * Math.sin(b), Math.cos(a) * Math.sin(b), Math.cos(b)];
  const right = cross([-d[0], -d[1], -d[2]], up);
  return { d, right, up };
}
// depth = distance from the X-ray SOURCE along the beam, in both projections (they had opposite signs — review M12).
export function projectOrtho(p, lao, cra) {
  const { d, right, up } = imageBasis(lao, cra);
  return { u: dot(p, right), v: dot(p, up), depth: dot(p, d) };
}
export function projectPoint(p, lao, cra, { sid = 1000, sod = 750 } = {}) {
  const { d, right, up } = imageBasis(lao, cra);
  const along = sod + dot(p, d);              // distance from the source along the beam axis
  const mag = sid / along;
  return { u: dot(p, right) * mag, v: dot(p, up) * mag, depth: along, mag };
}
export function foreshortening(poly, lao, cra) {
  let L = 0, Lp = 0;
  for (let i = 1; i < poly.length; i++) {
    const s = sub(poly[i], poly[i - 1]); L += Math.hypot(...s);
    const a = projectOrtho(poly[i], lao, cra), b = projectOrtho(poly[i - 1], lao, cra);
    Lp += Math.hypot(a.u - b.u, a.v - b.v);
  }
  return L > 0 ? Math.min(1, Math.max(0, 1 - Lp / L)) : 0;
}
export function angleName(lao, cra) {
  const L = Math.round(lao), C = Math.round(cra);
  const a = L === 0 ? 'AP' : (L > 0 ? 'LAO ' + L : 'RAO ' + -L);
  const b = C === 0 ? '' : (C > 0 ? ' CRA ' + C : ' CAU ' + -C);
  return a === 'AP' && b ? 'AP' + b : a + b;
}

// An X-ray source camera whose perspective image IS projectPoint(): source at −sod·d, looking at the isocentre, image up
// as its up vector, vertical field of view spanning `detector_mm` at the detector distance `sid`. The WebGL angiogram and
// the 3D heart's detector view are built from this, so they cannot disagree with the tables or the 2D fallback.
export function cameraFor(lao, cra, { sid = 1000, sod = 750, detector_mm = 250 } = {}) {
  const { d, up } = imageBasis(lao, cra);
  return { position: [-sod * d[0], -sod * d[1], -sod * d[2]], target: [0, 0, 0], up,
           fovDeg: 2 * Math.atan(detector_mm / 2 / sid) * 180 / Math.PI, near: 10, far: sid * 2 };
}

// A point fixed to the C-arm (in its own frame, isocentre at the origin) at these angles: tilt about x by −CRA, then turn
// about z by LAO — the composition detectorDir() follows, so carmPoint([0, −d, 0], a, b) = d · detectorDir(a, b).
export function carmPoint([x, y0, z0], lao, cra) {
  const a = lao * R, b = -cra * R, y = y0 * Math.cos(b) - z0 * Math.sin(b), z = y0 * Math.sin(b) + z0 * Math.cos(b);
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];
}
// One pointer move while dragging the detector in the room view. project(lao, cra) → [x, y] is where the grabbed point
// shows on screen; delta is the pointer's move (px). The move is mapped through the screen-space Jacobian of the two
// angles (damped least squares, so an axis this view barely shows — rotation seen from the side, angulation from the feet —
// moves gently instead of wildly), at most `cap` degrees a move, in sub-steps of ≤ 2°. An axis at its stop that the move
// pushes on stays there, and that push is taken out of the move first, so it can never drive the other axis (an off-axis
// grab pushed past a stop would otherwise swing the C-arm round). A lock keeps one axis fixed.
export function dragStep(project, cur, delta, { lock = 'both', limits = { lao: 120, cra: 50 }, cap = 10 } = {}) {
  // a big move is taken in sub-steps of ≤ 2°, each with its own Jacobian (one 10° linear step can bend backward)
  const first = dragLinear(project, cur, delta, lock, limits), size = Math.hypot(first.lao - cur.lao, first.cra - cur.cra);
  const n = Math.min(10, Math.max(1, Math.ceil(size / 2)));
  if (n === 1 && size <= cap) return first;
  // walk the sub-steps; stop part-way through the one that would pass `cap` degrees in all (cut along the path, not across it)
  let at = cur, used = 0;
  for (let i = 0; i < n; i++) {
    const nx = dragLinear(project, at, [delta[0] / n, delta[1] / n], lock, limits), step = Math.hypot(nx.lao - at.lao, nx.cra - at.cra);
    if (used + step > cap) { const f = (cap - used) / step; return { lao: at.lao + (nx.lao - at.lao) * f, cra: at.cra + (nx.cra - at.cra) * f }; }
    used += step; at = nx;
  }
  return at;
}
function dragLinear(project, cur, delta, lock, limits) {
  const h = 0.5, dot = (u, v) => u[0] * v[0] + u[1] * v[1];
  const col = (dl, dc) => { const p = project(cur.lao + dl, cur.cra + dc), q = project(cur.lao - dl, cur.cra - dc); return [(p[0] - q[0]) / (2 * h), (p[1] - q[1]) / (2 * h)]; };
  const J = { lao: col(h, 0), cra: col(0, h) }, g2 = Math.max(dot(J.lao, J.lao), dot(J.cra, J.cra));
  const free = { lao: lock !== 'angulation', cra: lock !== 'rotation' };
  let d = [...delta];
  // damping only where the view's weaker direction moves the point less than 0.3× the stronger
  const solve = () => {
    const ks = ['lao', 'cra'].filter(k => free[k]), out = { lao: 0, cra: 0 };
    if (ks.length === 1) { const j = J[ks[0]], jj = dot(j, j), lam = Math.max(0, 0.09 * g2 - jj); if (jj + lam > 0) out[ks[0]] = dot(j, d) / (jj + lam); return out; }
    if (ks.length === 2) {
      const a = dot(J.lao, J.lao), b = dot(J.lao, J.cra), c = dot(J.cra, J.cra);
      const lam = Math.max(0, 0.09 * g2 - ((a + c) / 2 - Math.sqrt(((a - c) / 2) ** 2 + b * b)));
      const A = a + lam, C = c + lam, det = A * C - b * b, p = dot(J.lao, d), q = dot(J.cra, d);
      if (det > 1e-12) { out.lao = (C * p - b * q) / det; out.cra = (A * q - b * p) / det; }
    }
    return out;
  };
  let s = solve(), stopped = false;
  for (const k of ['lao', 'cra']) if (free[k] && Math.abs(cur[k]) >= limits[k] - 1e-9 && s[k] * cur[k] > 0) {
    free[k] = false; stopped = true;
    const n = Math.hypot(...J[k]); if (n > 0) { const u = [J[k][0] / n, J[k][1] / n], p = dot(d, u); d = [d[0] - p * u[0], d[1] - p * u[1]]; }
    s = solve();
  }
  // after a stop, the other axis follows only a move that is clearly along the stop (≥ 30° off the push into it) — a push
  // nearly straight into the stop holds both — and never carries the detector back against the move
  if (stopped && (Math.hypot(...d) < 0.5 * Math.hypot(...delta) ||
      (J.lao[0] * s.lao + J.cra[0] * s.cra) * delta[0] + (J.lao[1] * s.lao + J.cra[1] * s.cra) * delta[1] < 0)) s = { lao: 0, cra: 0 };
  // a step that would cross a stop is shortened to land on it, keeping its direction (clamping one axis would bend it)
  let t = 1;
  for (const k of ['lao', 'cra']) if (Math.abs(cur[k] + s[k]) > limits[k]) t = Math.min(t, Math.max(0, (Math.sign(s[k]) * limits[k] - cur[k]) / s[k]));
  const clamp = (v, L) => Math.min(L, Math.max(-L, v));
  return { lao: clamp(cur.lao + s.lao * t, limits.lao), cra: clamp(cur.cra + s.cra * t, limits.cra) };
}
