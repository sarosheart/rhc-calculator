// Naive surface nets: the zero set of a field F (negative inside) on a regular grid, as a closed-where-the-field-is-closed
// triangle mesh. One vertex per grid cell the surface passes through (the mean of its edge crossings), one quad per grid
// edge that changes sign, wound so the normal points out (toward F > 0).

const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

// Run a builder written as a generator: at once, or yielding to the browser whenever a chunk has run ~40 ms (so a page stays
// responsive while a mesh builds).
export const run = (g) => { let r; while (!(r = g.next()).done); return r.value; };
export async function runAsync(g, budget = 40) {
  let r, t = performance.now();
  while (!(r = g.next()).done) if (performance.now() - t > budget) { await new Promise((res) => setTimeout(res, 0)); t = performance.now(); }
  return r.value;
}

// box = { min: [x, y, z], max: [x, y, z] }, step in mm → { position: Float32Array, index: Uint32Array }
export const meshSurface = (F, box, step) => run(meshSurfaceSteps(F, box, step));
export function* meshSurfaceSteps(F, box, step) {
  const n = [0, 1, 2].map(k => Math.ceil((box.max[k] - box.min[k]) / step) + 1);
  const [nx, ny, nz] = n, o = box.min, vals = new Float32Array(nx * ny * nz), p = [0, 0, 0];
  const at = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) { p[0] = o[0] + i * step; p[1] = o[1] + j * step; p[2] = o[2] + k * step; vals[at(i, j, k)] = F(p); }
    yield;
  }
  yield;
  const cx = nx - 1, cy = ny - 1, cz = nz - 1, cell = new Int32Array(cx * cy * cz).fill(-1), pos = [];
  const cAt = (i, j, k) => i + cx * (j + cy * k), v = new Float64Array(8);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const d = CORNERS[c]; v[c] = vals[at(i + d[0], j + d[1], k + d[2])]; if (v[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, m = 0;
    for (const [a, b] of EDGES) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]), A = CORNERS[a], B = CORNERS[b];
      sx += A[0] + t * (B[0] - A[0]); sy += A[1] + t * (B[1] - A[1]); sz += A[2] + t * (B[2] - A[2]); m++;
    }
    cell[cAt(i, j, k)] = pos.length / 3;
    pos.push(o[0] + (i + sx / m) * step, o[1] + (j + sy / m) * step, o[2] + (k + sz / m) * step);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const s0 = vals[at(i, j, k)] < 0;
    const inJ = j > 0 && j < cy, inK = k > 0 && k < cz, inI = i > 0 && i < cx;   // the four cells round an edge exist
    if (i < cx && inJ && inK && s0 !== (vals[at(i + 1, j, k)] < 0))                                // x edge: cells in (y, z)
      quad(cell[cAt(i, j - 1, k - 1)], cell[cAt(i, j, k - 1)], cell[cAt(i, j, k)], cell[cAt(i, j - 1, k)], !s0);
    if (j < cy && inI && inK && s0 !== (vals[at(i, j + 1, k)] < 0))                                // y edge: cells in (z, x)
      quad(cell[cAt(i - 1, j, k - 1)], cell[cAt(i - 1, j, k)], cell[cAt(i, j, k)], cell[cAt(i, j, k - 1)], !s0);
    if (k < cz && inI && inJ && s0 !== (vals[at(i, j, k + 1)] < 0))                                // z edge: cells in (x, y)
      quad(cell[cAt(i - 1, j - 1, k)], cell[cAt(i, j - 1, k)], cell[cAt(i, j, k)], cell[cAt(i - 1, j, k)], !s0);
  }
  return { position: new Float32Array(pos), index: new Uint32Array(idx) };
}
