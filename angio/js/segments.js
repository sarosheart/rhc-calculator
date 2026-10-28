// The teaching model: for the exact angle on screen, how every shown segment is seen — and, for one segment, where on the
// angle plane it is seen best. Pure functions over the Phase 1 data (visibility tables + views.json); no DOM.
// Variants (Phase 4): `dom` picks the tree; { ramus, grafts } pick the ramus-shown table and the graft rows.
// Overlap in the tables is counted within ONE coronary system (each artery is injected on its own), so "Both" shows the
// two systems' own overlaps, not one system hiding the other.
import { segmentVisibility, graftVisibility, vesselsFor, graftsFor } from './data.js';
import { detectorDir } from './geometry.js';

const SYNTAX_ID = /^[0-9]{1,2}[ab]?$/;

export const GRAFT_IDS = ['LIMA', 'SVG_OM', 'SVG_PDA'];

// "6 · proximal LAD" for a SYNTAX segment; a plain name for the extra branches ("septal branch") and grafts ("LIMA to LAD")
export function segmentName(views, id) {
  const g = views.graft_names?.[id]; if (g) return g;
  const n = views.segment_names?.[id];
  if (!n) return String(id);
  return SYNTAX_ID.test(id) ? `${id} · ${n}` : n;
}

// SYNTAX segments whose vessel is drawn for this system; the ramus (12) only when shown
export function segmentsShown(tree, sys, { ramus = false } = {}) {
  const drawn = new Set(vesselsFor(tree, sys, { ramus }).map(v => v.id));
  return Object.entries(tree.syntax_index).filter(([, s]) => drawn.has(s.vessel)).map(([id]) => id);
}

// everything that can be selected on this page right now: native segments plus the grafts shown
export function shownIds(D, s) {
  const t = D.trees[s.dom]; if (!t) return [];
  return [...segmentsShown(t, s.sys, s), ...graftsFor(D, s.dom, s.sys, s.grafts || []).map(g => g.id)];
}

export function graftPolyline(D, dom, id) { return (D.grafts.by_dominance[dom] || []).find(g => g.id === id)?.pts || []; }

export function segmentPolyline(tree, id) {
  const s = tree.syntax_index[id]; if (!s) return [];
  const v = tree.vessels.find(x => x.id === s.vessel);
  return v ? v.pts.slice(s.from, s.to + 1) : [];
}

// Seen best / foreshortened / overlapped at this exact angle. A segment past both limits goes to the worse of the two.
// Grafts shown join the same groups (kind 'graft'). If a table the variant needs has not arrived, those rows are left out
// and `pending` is set, so the panel can say so instead of printing anything wrong.
export function classify(D, dom, sys, lao, cra, { ramus = false, grafts = [] } = {}) {
  const fsLim = D.views.fs_limit ?? 0.25, ovLim = D.views.overlap_limit ?? 0.25;
  const out = { best: [], foreshortened: [], overlapped: [], pending: false };
  const add = (id, v, kind) => {
    const row = { id, kind, name: segmentName(D.views, id), fs: v.foreshortening, ov: v.overlap,
                  with: v.overlap > 0.02 && v.overlapper ? segmentName(D.views, v.overlapper) : null };
    if (row.fs < fsLim && row.ov < ovLim) out.best.push(row);
    else (row.fs >= row.ov ? out.foreshortened : out.overlapped).push(row);
  };
  const tree = D.trees[dom];
  if (!tree) { out.pending = true; return out; }
  for (const id of segmentsShown(tree, sys, { ramus })) {
    const v = segmentVisibility(D.visibility, dom, id, lao, cra, { ramus });
    if (v) add(id, v, 'segment'); else if (D.visibility.index.segments[dom]?.includes(id)) out.pending = true;
  }
  for (const g of graftsFor(D, dom, sys, grafts)) {
    const v = graftVisibility(D.visibility, dom, g.id, lao, cra);
    if (v) add(g.id, v, 'graft'); else out.pending = true;
  }
  const worst = (r) => Math.max(r.fs, r.ov);
  out.best.sort((a, b) => worst(a) - worst(b));
  out.foreshortened.sort((a, b) => b.fs - a.fs); out.overlapped.sort((a, b) => b.ov - a.ov);
  return out;
}

// The standard view whose beam is closest to this one (angle between beam directions), among the cards for this system
export function nearestView(views, lao, cra, sys) {
  const d = detectorDir(lao, cra); let best = null;
  for (const v of views.views) {
    if (sys !== 'both' && (v.side === 'right') !== (sys === 'right')) continue;
    const e = detectorDir(v.lao, v.cra), c = Math.min(1, Math.max(-1, d[0] * e[0] + d[1] * e[1] + d[2] * e[2]));
    const deg = Math.acos(c) * 180 / Math.PI;
    if (!best || deg < best.distance) best = { view: v, distance: deg };
  }
  return best;
}

// max(foreshortening, overlap) of one segment (or graft) on the whole table grid — 0 is a clean view, 1 the worst; NaN
// where there is nothing (unknown id, table not loaded)
export function bestMap(D, dom, id, { ramus = false } = {}) {
  const idx = D.visibility.index, graft = GRAFT_IDS.includes(id);
  const segs = (graft ? idx.grafts?.[dom] : idx.segments[dom]) || [], s = segs.indexOf(String(id));
  const nL = Math.round((idx.lao.max - idx.lao.min) / idx.lao.step) + 1, nC = Math.round((idx.cra.max - idx.cra.min) / idx.cra.step) + 1;
  const data = new Float32Array(nL * nC).fill(NaN);
  const bin = D.visibility.bins[graft ? `grafts-${dom}` : ramus ? `${dom}-ramus` : dom];
  if (s >= 0 && bin) { const nS = segs.length;
    for (let j = 0; j < nC; j++) for (let i = 0; i < nL; i++) {
      const o = ((j * nL + i) * nS + s) * 3; data[j * nL + i] = Math.max(bin[o], bin[o + 1]) / 255; } }
  return { data, nL, nC, lao: idx.lao, cra: idx.cra };
}

// the grid angle with the lowest score; ties go to the least steep angle (closest to AP)
export function bestAngle(D, dom, id, opts = {}) {
  const m = bestMap(D, dom, id, opts); let best = null;
  for (let j = 0; j < m.nC; j++) for (let i = 0; i < m.nL; i++) {
    const x = m.data[j * m.nL + i]; if (!(x >= 0)) continue;
    const lao = m.lao.min + i * m.lao.step, cra = m.cra.min + j * m.cra.step, steep = Math.hypot(lao, cra);
    if (!best || x < best.score - 1e-9 || (Math.abs(x - best.score) <= 1e-9 && steep < best.steep)) best = { lao, cra, score: x, steep };
  }
  return best && { lao: best.lao, cra: best.cra, score: best.score };
}

// arc-length midpoint of a segment (labels, tests)
export function segmentMidpoint(tree, id) { return polylineMidpoint(segmentPolyline(tree, id)); }
export function polylineMidpoint(P) {
  if (P.length < 2) return P[0] || null;
  const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]));
  const t = L[L.length - 1] / 2; let i = 1; while (i < L.length - 1 && L[i] < t) i++;
  const f = (t - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]); return P[i - 1].map((v, k) => v + (P[i][k] - v) * f);
}

// clean → amber at the 25 % limit → red at 50 %+ (the pad, the 3D heart's foreshortening mode)
export function scoreColour(x) {
  const stops = [[0, [52, 199, 120]], [0.1, [52, 199, 120]], [0.25, [240, 166, 58]], [0.5, [229, 72, 77]], [1, [229, 72, 77]]];
  for (let i = 1; i < stops.length; i++) if (x <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i], t = (x - a) / ((b - a) || 1);
    return ca.map((c, k) => Math.round(c + (cb[k] - c) * t));
  }
  return stops[stops.length - 1][1];
}
