// Loads the Phase 1 data (angio/data/) and answers "how is this segment seen at this angle?" from the precomputed tables.
// Only what the default page needs loads up front: the right-dominant tree and its table. The left and co trees, their
// tables, the ramus-shown tables and the graft tables load when the reader asks for them (ensureVariant), once each.
const RIGHT_VESSELS = new Set(['RCA', 'R_PDA', 'R_PLA', 'CONUS']);

// The low performance tier (tier.js) takes the lite heart and chest meshes: same parts, a quarter of the triangles.
export async function loadAll(base = 'data/', fetchFn = fetch, { tier = 'high' } = {}) {
  const j = async (f) => { const r = await fetchFn(base + f); if (!r.ok) throw new Error('could not load ' + f); return r.json(); };
  const b = async (f) => { const r = await fetchFn(base + f); if (!r.ok) throw new Error('could not load ' + f); return new Uint8Array(await r.arrayBuffer()); };
  const [right, views, vidx, grafts, vr] = await Promise.all([
    j('coronary-right.json'), j('views.json'), j('visibility.json'), j('grafts.json'), b('visibility-right.bin')]);
  // graft names read as plain names ("LIMA to LAD", "Vein graft to PDA"), from the data, beside the segment names
  views.graft_names = Object.fromEntries(grafts.grafts.map(g => { const n = g.segments?.[0]?.name || g.id; return [g.id, n[0].toUpperCase() + n.slice(1)]; }));
  const lite = tier === 'low' ? '-lite' : '';
  return { heartUrl: base + `heart${lite}.glb`, thoraxUrl: base + `thorax${lite}.glb`, epiUrl: base + 'epicardium.glb', trees: { right }, views, grafts,
           visibility: { index: vidx, bins: { right: vr } }, _load: { j, b, pending: new Map() } };
}

// the tables a variant needs: '{dom}' (ramus hidden), '{dom}-ramus' (ramus shown), 'grafts-{dom}'
const needs = ({ dom = 'right', ramus = false, grafts = [] }) =>
  [['tree', dom], ['bin', ramus ? `${dom}-ramus` : dom], ...(grafts.length ? [['bin', `grafts-${dom}`]] : [])];
const have = (D, [kind, key]) => kind === 'tree' ? !!D.trees[key] : !!D.visibility.bins[key];

export function hasVariant(D, v) { return needs(v).every(n => have(D, n)); }

// Load whatever the variant still lacks; each file is fetched once however often this is asked.
export function ensureVariant(D, v) {
  return Promise.all(needs(v).filter(n => !have(D, n)).map(([kind, key]) => {
    const id = kind + ':' + key;
    // a failed fetch is forgotten, so the next request tries again instead of failing at once forever
    if (!D._load.pending.has(id)) D._load.pending.set(id, (kind === 'tree'
      ? D._load.j(`coronary-${key}.json`).then(t => { D.trees[key] = t; })
      : D._load.b(`visibility-${key}.bin`).then(t => { D.visibility.bins[key] = t; }))
      .catch(e => { D._load.pending.delete(id); throw e; }));
    return D._load.pending.get(id);
  }));
}

// Bilinear lookup at the EXACT angle (the tables are on a 4° grid; review M6: never round to a cell). Angles outside the
// table (it stops at ±48° angulation) clamp to its edge.
function lookup(idx, bin, nS, s, occluders, lao, cra) {
  const nL = Math.round((idx.lao.max - idx.lao.min) / idx.lao.step) + 1, nC = Math.round((idx.cra.max - idx.cra.min) / idx.cra.step) + 1;
  const fi = Math.min(nL - 1, Math.max(0, (lao - idx.lao.min) / idx.lao.step)), fj = Math.min(nC - 1, Math.max(0, (cra - idx.cra.min) / idx.cra.step));
  const i0 = Math.floor(fi), j0 = Math.floor(fj), i1 = Math.min(nL - 1, i0 + 1), j1 = Math.min(nC - 1, j0 + 1), ti = fi - i0, tj = fj - j0;
  const at = (i, j, k) => bin[((j * nL + i) * nS + s) * 3 + k];
  const bil = (k) => ((at(i0, j0, k) * (1 - ti) + at(i1, j0, k) * ti) * (1 - tj) + (at(i0, j1, k) * (1 - ti) + at(i1, j1, k) * ti) * tj) / 255;
  const near = at(Math.round(fi), Math.round(fj), 2);
  return { foreshortening: bil(0), overlap: bil(1), overlapper: near === 255 ? null : occluders[near] };
}

// A native segment. With the ramus shown, the ramus-shown table (where the ramus crosses left segments). Returns null for
// a segment the tree does not have, or while its table has not arrived.
export function segmentVisibility(vis, dom, seg, lao, cra, { ramus = false } = {}) {
  const idx = vis.index, segs = idx.segments[dom], s = segs ? segs.indexOf(String(seg)) : -1, bin = vis.bins[ramus ? `${dom}-ramus` : dom];
  if (s < 0 || !bin) return null;
  return lookup(idx, bin, segs.length, s, idx.occluders[dom], lao, cra);
}

// A graft (LIMA, SVG_OM, SVG_PDA): overlapped only by the artery it was grafted to. Null if absent or not loaded.
export function graftVisibility(vis, dom, id, lao, cra) {
  const idx = vis.index, ids = idx.grafts?.[dom], s = ids ? ids.indexOf(id) : -1, bin = vis.bins[`grafts-${dom}`];
  if (s < 0 || !bin) return null;
  return lookup(idx, bin, ids.length, s, idx.occluders[dom], lao, cra);
}

// The vessels drawn for an injected system; the ramus only when shown.
export function vesselsFor(tree, sys, { ramus = false } = {}) {
  return tree.vessels.filter(v => (ramus || v.variant !== 'ramus') &&
    (sys === 'both' || (sys === 'right') === RIGHT_VESSELS.has(v.id)));
}

// The grafts of a dominance that show with this system: a graft belongs to the artery it was grafted to.
export function graftsFor(D, dom, sys, ids = []) {
  return (D.grafts.by_dominance[dom] || []).filter(g => ids.includes(g.id) &&
    (sys === 'both' || (sys === 'right') === RIGHT_VESSELS.has(g.target.vessel)));
}
