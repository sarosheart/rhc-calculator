// A stent's sheet: its surface as a grid of 64 angles × one row per 0.35 mm, every node pushed through the same pipeline
// as that stent's struts (stent.js mvPointFn, sb-stent.js sbPointFn), so a sheet bends, crushes and opens exactly as its
// struts do. Triangles stretched past 3 × their undeformed length (the wrapped grid before any crush or opening) are
// dropped: an opened cell is a hole. measure.js counts layers and crossings on sheets, never on pixels.
// (Its own module: stent.js cannot import sb-stent.js, which imports it.)
import { STENT } from './kinds.js';
import { mvPointFn, memo, MV_FIELDS } from './stent.js';
import { sbPointFn, SB_FIELDS, sbLength } from './sb-stent.js';

const NA = 64, DZ = 0.35, TEAR = 3;
const d = (P, a, b) => Math.hypot(P[3 * a] - P[3 * b], P[3 * a + 1] - P[3 * b + 1], P[3 * a + 2] - P[3 * b + 2]);
// { position: Float64Array (x, y, z per node), index: Uint32Array (three per kept triangle) } — memoised per pose
export function stentSheet(which, graph, pose, ctx) {
  return memo(ctx, `sheet_${which}`, which === 'mv' ? MV_FIELDS : SB_FIELDS, pose, () => {
    const len = which === 'mv' ? STENT.len : sbLength(pose), nz = Math.round(len / DZ) + 1;
    const fn = (stage) => (which === 'mv' ? mvPointFn(graph, pose, ctx, stage)
      : ((f) => (th, z) => f(th, z).p)(sbPointFn(graph, pose, ctx, stage)));
    const at = fn(6), rest = fn(1), P = new Float64Array(NA * nz * 3), R = new Float64Array(NA * nz * 3);
    for (let j = 0; j < nz; j++) for (let i = 0; i < NA; i++) {
      const th = i * 2 * Math.PI / NA, z = j * len / (nz - 1), k = 3 * (j * NA + i);
      P.set(at(th, z), k); R.set(rest(th, z), k);
    }
    const idx = [];
    const keep = (a, b, c) => d(P, a, b) <= TEAR * d(R, a, b) + 1e-9 && d(P, b, c) <= TEAR * d(R, b, c) + 1e-9 && d(P, a, c) <= TEAR * d(R, a, c) + 1e-9;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < NA; i++) {
      const a = j * NA + i, b = j * NA + (i + 1) % NA, c = (j + 1) * NA + i, e = (j + 1) * NA + (i + 1) % NA;
      if (keep(a, b, c)) idx.push(a, b, c);
      if (keep(b, e, c)) idx.push(b, e, c);
    }
    return { position: P, index: Uint32Array.from(idx) };
  });
}
