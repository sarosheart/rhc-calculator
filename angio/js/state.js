// One state object for the Angio Views page, mirrored to the URL hash so any view can be shared as a link.
// Hash keys: a = rotation (LAO +, RAO −), b = angulation (CRA +, CAU −), sys = left|right|both, v = standard-view id,
// sel = selected SYNTAX segment or graft, dom = r|l|co (dominance; right is the default and left out), ramus = 1,
// g = grafts shown (lima, svgom, svgpda).
// Junk in a shared link is ignored or clamped — never NaN, never a broken page.
const LIM = { lao: [-120, 120], cra: [-50, 50] };
const SYS = new Set(['left', 'right', 'both']);
const DOM = { r: 'right', l: 'left', co: 'co' }, DOM_KEY = { right: 'r', left: 'l', co: 'co' };
const GRAFT = { lima: 'LIMA', svgom: 'SVG_OM', svgpda: 'SVG_PDA' }, GRAFT_KEY = { LIMA: 'lima', SVG_OM: 'svgom', SVG_PDA: 'svgpda' };
const GRAFT_ORDER = ['LIMA', 'SVG_OM', 'SVG_PDA'];
export const canonGrafts = (list) => GRAFT_ORDER.filter(g => (list || []).includes(g));
const clamp = (x, [lo, hi]) => Math.min(hi, Math.max(lo, x));
const half = (x) => Math.round(x * 2) / 2;

export function parseHash(str) {
  const out = {};
  const q = new URLSearchParams(String(str || '').replace(/^#/, ''));
  const num = (k) => { const s = q.get(k); if (s === null || s.trim() === '') return null; const x = Number(s); return Number.isFinite(x) ? x : null; };
  const a = num('a'), b = num('b');
  if (a !== null) out.lao = half(clamp(a, LIM.lao));
  if (b !== null) out.cra = half(clamp(b, LIM.cra));
  const s = q.get('sys'); if (SYS.has(s)) out.sys = s;
  const v = q.get('v'); if (v && /^[a-z0-9-]{1,40}$/.test(v)) out.view = v;
  const sel = q.get('sel');
  if (sel && /^([1-9]|1[0-6])[ab]?$/.test(sel)) out.sel = sel;                                  // a SYNTAX segment id
  else if (sel && GRAFT[sel]) out.sel = GRAFT[sel];                                            // or a graft
  const d = q.get('dom'); if (DOM[d]) out.dom = DOM[d];
  const r = q.get('ramus'); if (r === '1' || r === '0') out.ramus = r === '1';
  const g = q.get('g'); if (g !== null) { const list = canonGrafts(g.split(',').map(x => GRAFT[x]).filter(Boolean)); if (list.length) out.grafts = list; }
  return out;
}

export function toHash(st) {
  const p = [`a=${half(st.lao)}`, `b=${half(st.cra)}`, `sys=${st.sys}`];
  if (st.view) p.push(`v=${st.view}`);
  if (st.dom && st.dom !== 'right') p.push(`dom=${DOM_KEY[st.dom]}`);
  if (st.ramus) p.push('ramus=1');
  if (st.grafts?.length) p.push('g=' + canonGrafts(st.grafts).map(x => GRAFT_KEY[x]).join(','));
  if (st.sel) p.push(`sel=${GRAFT_KEY[st.sel] || st.sel}`);
  return '#' + p.join('&');
}

// normalize(next) may correct a new state before anyone sees it (e.g. drop a selection the shown system does not have)
export function createState(initial = {}, { normalize = (x) => x } = {}) {
  let s = normalize({ lao: 0, cra: 0, sys: 'left', dom: 'right', ramus: false, grafts: [], view: null, sel: null, seeThrough: true, ...initial });
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) ? a.join() === b.join() : a === b;
  const subs = new Set();
  return {
    get: () => s,
    set(patch) {
      const next = { ...s, ...patch };
      if (patch.lao !== undefined) next.lao = clamp(patch.lao, LIM.lao);
      if (patch.cra !== undefined) next.cra = clamp(patch.cra, LIM.cra);
      if (patch.grafts !== undefined) next.grafts = canonGrafts(patch.grafts);
      normalize(next);
      if (Object.keys(next).every(k => same(next[k], s[k]))) return;
      const prev = s; s = next; subs.forEach(fn => fn(s, prev));
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
