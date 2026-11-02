// A technique's result as the page shows it (Phase 4): the Done pose, measure.js's numbers and layer map, and the words.
// The page's own result (after the last step) and Compare both read it, so the two can never disagree.
import { finalProduct } from './measure.js';

// what Compare can show: the five techniques, and the plain T — TAP's sequence with the D1 stent placed with no
// protrusion (design §6.2: shown beside TAP, with the gap it leaves at D1's heel at this angle)
export const CHOICES = Object.freeze([
  { id: 'provisional', label: 'Provisional', mode: 'provisional' },
  { id: 'dk-crush', label: 'DK crush', mode: 'dk-crush' },
  { id: 'mini-crush', label: 'Mini-crush', mode: 'mini-crush' },
  { id: 'culotte', label: 'Culotte', mode: 'culotte' },
  { id: 'tap', label: 'TAP', mode: 'tap' },
  { id: 'plain-t', label: 'Plain T', mode: 'tap', opts: Object.freeze({ plainT: true }) },
].map(Object.freeze));
// until the reader picks, Compare shows the technique on top beside this one
export const PARTNER = Object.freeze({ provisional: 'dk-crush', 'dk-crush': 'mini-crush', 'mini-crush': 'dk-crush', culotte: 'dk-crush', tap: 'plain-t' });

// walk the technique to its end; the layers the last wire crossed are taken as its last rewire left them
export function productOf(mode, ctx, opts = {}) {
  const M = mode.machine; let s = M.initialState(), a, rw = null;
  while ((a = M.nextAction(s))) { s = M.apply(s, a); if (a === mode.lastRewire.action) rw = mode.poseOf(s, ctx, opts); }
  const done = mode.poseOf(s, ctx, opts);
  const { map, lines, ...num } = finalProduct(done, ctx, { rewirePose: rw, wire: mode.lastRewire.wire });
  return { done, num, map };
}

// the result's lines: the opening (layers the last wire crossed, the largest window the struts leave clear seen down D1),
// the LAD wall (the culotte's overlap all round), the metal at the carina; with `heel`, D1's heel (where a D1 stent is)
export function resultLines(n, { heel = false } = {}) {
  const k = n.acrossLayers, layers = ['one layer', 'one layer', 'two layers', 'three layers'][Math.min(3, n.carinaLayers || 1)];
  const out = [`D1 opening: crossed ${k} layer${k === 1 ? '' : 's'}; largest clear window ${Math.round((1 - n.ostiumCovered) * 100)} %`,
    n.ring2 > 0 ? `Proximal LAD: two layers all round over ${n.ring2.toFixed(1)} mm`
      : n.maxLayers <= 1 ? 'LAD wall, D1 side: one layer throughout' : `LAD wall, D1 side: up to ${n.maxLayers} layers; 2+ over ${n.band2.toFixed(1)} mm`,
    n.neoCarina > 0 ? `Metal at the carina: ${layers}, up to ${n.neoCarina.toFixed(1)} mm from its tip` : 'Metal at the carina: none'];
  if (heel && n.heelGap !== null && n.heelGap !== undefined) out.push(n.heelGap > 0 ? `D1’s heel: ${n.heelGap.toFixed(1)} mm bare` : 'D1’s heel: covered');
  return out;
}
