// Boot for the Angio Views page: load data, build the state from the URL, pick a renderer, keep the URL in step.
import * as THREE from '../vendor/three/three-angio.min.js';
import { createState, parseHash, toHash } from './state.js';
import { loadAll, vesselsFor, ensureVariant, graftsFor } from './data.js';
import { createAngio } from './render-angio.js';
import { createAngio2D } from './render-angio-2d.js';
import { createHeart } from './render-heart.js';
import { mountControls } from './ui-controls.js';
import { angleName } from './geometry.js';
import { createOverlay } from './overlay.js';
import { mountDetails } from './details.js';
import { createPad } from './pad.js';
import { mountAnatomy } from './anatomy.js';
import { mountReal } from './real.js';
import { createRoom } from './render-room.js';
import { classify, segmentMidpoint, shownIds } from './segments.js';
import { chooseTier, probeGPU, createPacer } from './tier.js';

const DEBUG = new URLSearchParams(location.search).has('debug');
const track = (...a) => { try { window.cmTrack?.(...a); } catch (e) { /* analytics never breaks the page */ } };
// a failed load says so (a flaky phone connection otherwise leaves an empty grey box), then stops
const status = document.querySelector('[data-role="status"]');
function failed(e) {
  if (status) { status.setAttribute('role', 'alert'); status.textContent = 'The model could not load. Check the connection and reload the page.'; }
  throw e;
}
// performance tier, before any model loads: low takes the lite meshes and 1× pixels (?tier=low|high overrides the probe)
let tier = chooseTier({ ...probeGPU(), override: new URLSearchParams(location.search).get('tier') });
const D = await loadAll('data/', fetch, { tier }).catch(failed);
// shared links: an unknown view id is dropped; a known one with no angles opens that view
const VIEWS = new Map((D.views.views || []).map(v => [v.id, v]));
function fromHash(h) {
  const p = parseHash(h), v = VIEWS.get(p.view);
  if (p.view && !v) delete p.view;
  if (v && p.lao === undefined && p.cra === undefined) { p.lao = v.lao; p.cra = v.cra; if (!p.sys) p.sys = v.side === 'right' ? 'right' : 'left'; }
  return p;
}
// A variant (dominance, ramus, grafts) changes only once its data is here, so no panel ever reads a table that is missing:
// a shared link waits for it before the first picture; the anatomy controls go through setVariant().
const variantOf = (s) => ({ dom: s.dom || 'right', ramus: !!s.ramus, grafts: s.grafts || [] });
const fromLink = fromHash(location.hash);
await ensureVariant(D, variantOf(fromLink)).catch(failed);
// a selection must be something shown (a stale one would glow alone in 3D and shade the pad for a hidden vessel)
const state = createState({ lao: 0, cra: 0, sys: 'left', labels: false, colour: false, ...fromLink },
  { normalize: (n) => { if (!D.trees[n.dom]) n.dom = 'right'; if (n.sel && !shownIds(D, n).includes(n.sel)) n.sel = null; return n; } });
// the current dominance's tree, and everything one dominance draws (every vessel incl. the ramus, its grafts, the metal)
const T = () => D.trees[state.get().dom];
// metal: the sternal wires (any graft) then the clips on that heart's LIMA (with a LIMA) — ids marker0, marker1, …
const markersOf = (dom) => [...(D.grafts.markers || []), ...(D.grafts.clips_by_dominance?.[dom] || [])];
const anatomy = (dom) => ({ vessels: vesselsFor(D.trees[dom], 'both', { ramus: true }), grafts: D.grafts.by_dominance[dom] || [], markers: markersOf(dom) });
// Taps can come faster than the data: every request merges into ONE pending change, the data for that merged change is
// loaded, and only the newest request applies it — so Left-then-Ramus loads the left heart's ramus table, and the last tap
// wins even if an earlier load finishes later. A failed load leaves the page as it was and says so.
let pending = null, variantSeq = 0, anat = null;
const variantView = () => ({ ...state.get(), ...(pending || {}) });         // what the controls build on
async function setVariant(patch) {
  const my = ++variantSeq;
  pending = { ...(pending || {}), ...patch };
  const want = variantOf({ ...state.get(), ...pending });
  anat?.busy(true); anat?.error(null);
  try { await ensureVariant(D, want); }
  catch (e) { if (my === variantSeq) { pending = null; anat?.busy(false); anat?.error('could not load'); } console.warn('angio: variant data did not load', e); return false; }
  if (my !== variantSeq) return false;                                     // a newer request applies the merged change
  const p = pending; pending = null; anat?.busy(false);
  state.set(p); return true;
}
if (location.hash && toHash(state.get()) !== location.hash) history.replaceState(null, '', toHash(state.get()));   // tidy a shared link

const loader = new THREE.GLTFLoader();
// each model is fetched ONCE: the X-ray takes copies of its geometry, the 3D heart panel uses the scenes themselves
const [heartG, thoraxG, epiG] = await Promise.all([D.heartUrl, D.thoraxUrl, D.epiUrl].map(u => loader.loadAsync(u))).catch(failed);
const geoms = (g, keep) => { const out = [];
  g.scene.traverse(o => { if (o.isMesh && (!keep || keep.includes(o.name))) { o.updateWorldMatrix(true, false); out.push(o.geometry.clone().applyMatrix4(o.matrixWorld)); } });
  return out; };
const bone = geoms(thoraxG, ['ribs', 'spine', 'sternum', 'clavicles', 'costal_cartilage']);
// soft tissue: the FILLED heart (the chamber walls are thin shells and cast hollow rings), great vessels, diaphragm
const tissue = [geoms(epiG), geoms(heartG, ['aortic_root', 'ascending_aorta', 'pulmonary_trunk']), geoms(thoraxG, ['diaphragm'])].flat();

let canvas = document.getElementById('angio');
// WebGL2 with float targets when the device has it; otherwise — or if the context is ever lost — the 2D drawing.
function fallback(reason) {
  const fresh = canvas.cloneNode(false); canvas.replaceWith(fresh); canvas = fresh;   // a canvas keeps its first context type
  const note = document.querySelector('[data-role="fallback-note"]') || Object.assign(document.createElement('p'), {});
  note.dataset.role = 'fallback-note'; note.className = 'fallback-note';
  note.textContent = reason === 'context lost'
    ? 'Simplified drawing: the graphics processor stopped responding, so bone and heart shadows are not shown. Reload the page to bring them back.'
    : 'Simplified drawing: this device has no 3D graphics, so bone and heart shadows are not shown.';
  if (!note.isConnected) canvas.after(note);
  console.info('angio: 2D fallback (' + reason + ')');
  return createAngio2D(canvas, anatomy(state.get().dom));
}
let angio;
try { angio = createAngio(canvas, THREE, { ...anatomy(state.get().dom), bone, tissue, maxDpr: tier === 'low' ? 1 : 2 }); }
catch (e) { angio = fallback(e.message); }
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); angio = fallback('context lost'); render(); });
// what is drawn: the system's vessels (the ramus if shown), the grafts shown with it, and the metal after bypass surgery
const shownGrafts = (s) => graftsFor(D, s.dom, s.sys, s.grafts);
// metal shows in every frame whatever is injected: the wires once any graft is in, the LIMA's clips with a LIMA
const visible = (s) => new Set([...vesselsFor(D.trees[s.dom], s.sys, s).map(v => v.id), ...shownGrafts(s).map(g => g.id),
  ...markersOf(s.dom).map((m, i) => (m.kind === 'clip' ? s.grafts.includes('LIMA') : s.grafts.length > 0) ? `marker${i}` : null).filter(Boolean)]);
let heart = null;
// labels, colour, highlight and tap-to-select, drawn over whichever renderer is live
const overlayCanvas = document.querySelector('[data-role="overlay"]');
const overlay = overlayCanvas && createOverlay(overlayCanvas, { views: D.views, onPick: (sel) => state.set({ sel }) });
// the 3D heart is not drawn while another viewer has its place (it catches up when shown again)
let heartHidden = false;
// frames that come too slowly while the reader drags or sweeps step the page down once, to 1× pixels (meshes stay:
// fetching the lite ones mid-session would cost more than it saves)
const pacer = createPacer();
let room = null;                                    // the room view, built when first shown (below)
let paceQueued = false;
function stepDown() {
  if (tier === 'low') return;
  tier = 'low'; angio.setMaxDpr?.(1); heart?.setMaxDpr(1); room?.setMaxDpr(1);
  render(); track('tool_action', { action: 'tier_low' });
}
const pace = (ms) => { if (pacer.sample(ms) === 'slow') stepDown(); };
const render = () => { const s = state.get(), v = visible(s); angio.draw(s, v); overlay?.draw(s, angio, { tree: T(), grafts: shownGrafts(s) }); if (!heartHidden) heart?.draw(s, v);
  // time the frame after this render: one vsync on a fast device, longer while the GPU is still busy with it
  if (!paceQueued) { paceQueued = true; requestAnimationFrame((t0) => requestAnimationFrame((t1) => { paceQueued = false; pace(t1 - t0); })); } };
// 3D heart panel — only with WebGL; otherwise a static note (no blank box)
const heartCanvas = document.getElementById('heart');
if (heartCanvas) {
  if (angio.kind === 'webgl') {
    heart = await createHeart(heartCanvas, THREE, { heartScene: heartG.scene, thoraxScene: thoraxG.scene, ...anatomy(state.get().dom), tree: T(), tier });
  } else {
    const note = document.createElement('p'); note.className = 'fallback-note';
    note.textContent = 'The 3D heart needs 3D graphics, which this device does not offer. The angiogram above works without it.';
    heartCanvas.replaceWith(note);
  }
}
// URL hash follows the state at most 4 times a second (a drag fires dozens of updates), and always lands on the last one
let hashLast = 0, hashTimer = null;
const writeHash = () => { hashTimer = null; hashLast = performance.now(); const h = toHash(state.get()); if (h !== location.hash) history.replaceState(null, '', h); };
// a new dominance swaps the whole vessel set in every renderer before anything redraws
state.subscribe((s, prev) => {
  if (prev && s.dom !== prev.dom) { const a = anatomy(s.dom); angio.setAnatomy?.(a); heart?.setAnatomy?.({ ...a, tree: D.trees[s.dom] }); }
  render();
  if (hashTimer) return;
  hashTimer = setTimeout(writeHash, Math.max(0, 250 - (performance.now() - hashLast)));
});
const controlsRoot = document.getElementById('controls');
const ctl = controlsRoot && mountControls(controlsRoot, state, D.views, { sysRoot: document.getElementById('sys-switch'),
  onCard: (id) => track('tool_action', { action: 'view_card', target: id }) });
const teach = document.querySelector('.pane-teach');
if (teach) mountDetails(teach, state, D, { onView: (id) => ctl?.goTo(id) });
const anatRoot = document.querySelector('[data-role="anatomy"]');
if (anatRoot) anat = mountAnatomy(anatRoot, state, { names: D.views.graft_names, setVariant, view: variantView,
  graftArtery: (dom, id) => D.visibility.index.graftArtery?.[dom]?.[id] || 'left' });
// a panel that loads or draws only while it is on screen (shown in the viewer, its fold open, scrolled into view)
function whenShown(el, fn) {
  if (!el) return;
  if (!('IntersectionObserver' in window)) { fn(true); return; }
  new IntersectionObserver((es) => fn(es[es.length - 1].isIntersecting)).observe(el);
}
// the real angiogram near this angle (CARDIAG frames, loaded when first shown)
const bytes = (f) => fetch('data/cardiag/' + f).then(r => { if (!r.ok) throw new Error('could not load ' + f); return r; });
const realRoot = document.querySelector('[data-role="real"]');
const real = realRoot && mountReal(realRoot, state, {
  load: { index: () => bytes('index.json').then(r => r.json()), overlays: () => bytes('overlays.json').then(r => r.json()),
          image: (f) => bytes(f).then(r => r.arrayBuffer()).then(b => new Blob([b], { type: 'image/webp' })) },
  has: (seg) => shownIds(D, state.get()).includes(seg),
  onGo: (f) => { ctl?.stop(); state.set({ lao: Math.round(f.lao), cra: Math.round(f.cra), view: null }); track('tool_action', { action: 'real_go' }); },
  onPick: (sel) => state.set({ sel }) });
whenShown(realRoot, (on) => real?.setActive(on));
// the heart column's viewer (laptop and tablet): the 3D heart or the real angiogram beside the simulated one
for (const b of document.querySelectorAll('button[data-viewer]')) b.addEventListener('click', () => {
  const v = b.dataset.viewer; paneHeart.dataset.show = v;
  document.querySelectorAll('button[data-viewer]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  heartHidden = v !== 'heart' && !phone.matches; if (!heartHidden) render();
  track('tool_action', { action: 'viewer_' + v });
});
// the room: built the first time it is shown (a third 3D context only for readers who open it); not without WebGL
const roomRoot = document.querySelector('[data-role="room"]');
function bounds(gs) {
  const b = { minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity, halfWidth: 0 };
  for (const g of gs) { const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) { b.halfWidth = Math.max(b.halfWidth, Math.abs(p[i])); b.minY = Math.min(b.minY, p[i + 1]); b.maxY = Math.max(b.maxY, p[i + 1]);
      b.minZ = Math.min(b.minZ, p[i + 2]); b.maxZ = Math.max(b.maxZ, p[i + 2]); } }
  return b;
}
whenShown(roomRoot, (on) => {
  if (on && !room && !roomRoot.dataset.off) {
    if (angio.kind !== 'webgl') {
      roomRoot.dataset.off = '1';
      roomRoot.querySelector('.room-box').replaceWith(Object.assign(document.createElement('p'), { className: 'fallback-note',
        textContent: 'The room view needs 3D graphics, which this device does not offer. The angiogram works without it.' }));
      roomRoot.querySelector('.room-tools')?.remove(); roomRoot.querySelector('[data-role="room-hint"]')?.remove();
      return;
    }
    room = createRoom(roomRoot.querySelector('[data-role="room-canvas"]'), THREE, { heartScene: epiG.scene, body: bounds(bone), tier,
      onUser: () => { ctl?.stop(); track('tool_action', { action: 'room_drag' }, 'room_drag'); },
      onDrag: (lao, cra) => state.set({ lao: Math.round(lao), cra: Math.round(cra), view: null }) });
    room.setLock(document.querySelector('button[data-lock][aria-pressed="true"]')?.dataset.lock || 'angulation');
    room.draw(state.get());
    const roomCanvas = roomRoot.querySelector('[data-role="room-canvas"]'), roomSize = new ResizeObserver(() => room?.draw(state.get()));
    roomSize.observe(roomCanvas);
    // the graphics processor gave up on the room: a note in its place; the angiogram and the heart carry on
    roomCanvas.addEventListener('webglcontextlost', () => {
      roomSize.disconnect(); room?.dispose(); room = null; roomRoot.dataset.off = '1';
      roomRoot.querySelector('.room-box').replaceWith(Object.assign(document.createElement('p'), { className: 'fallback-note',
        textContent: 'The room view stopped: the graphics processor stopped responding. Reload the page to bring it back.' }));
      roomRoot.querySelector('.room-tools')?.remove(); roomRoot.querySelector('[data-role="room-hint"]')?.remove();
    }, { once: true });
  }
  room?.setActive(on);
});
state.subscribe((s) => room?.draw(s));
// each view starts with the motion it shows best: from the side a drag tilts (angulation), from the feet it rotates
const NATURAL = { side: 'angulation', feet: 'rotation' };
const pressOnly = (attr, v) => document.querySelectorAll(`button[data-${attr}]`).forEach(x => x.setAttribute('aria-pressed', String(x.dataset[attr] === v)));
document.querySelectorAll('button[data-lock]').forEach(b => b.addEventListener('click', () => { room?.setLock(b.dataset.lock); pressOnly('lock', b.dataset.lock); }));
document.querySelectorAll('button[data-cam]').forEach(b => b.addEventListener('click', () => {
  const v = b.dataset.cam; room?.preset(v); pressOnly('cam', v); room?.setLock(NATURAL[v]); pressOnly('lock', NATURAL[v]); }));
const padCanvas = document.querySelector('[data-role="pad"]');
const pad = padCanvas && createPad(padCanvas, state, D, { onUser: () => ctl?.stop(), caption: document.querySelector('[data-role="pad-caption"]'),
  bestBtn: document.querySelector('[data-role="pad-best"]') });
track('module_view', { module_id: state.get().view || 'angio_views', via: 'load' });

// caption under the angiogram: the angle, and the standard view's name when one is selected
const caption = document.querySelector('[data-role="caption"]');
function updateCaption(s) {
  if (!caption) return;
  const v = VIEWS.get(s.view), at = v && Math.abs(v.lao - s.lao) <= 2 && Math.abs(v.cra - s.cra) <= 2;
  caption.replaceChildren(Object.assign(document.createElement('strong'), { textContent: angleName(s.lao, s.cra) }));
  if (at) caption.append(' · ' + v.name);
}
state.subscribe(updateCaption); updateCaption(state.get());

// angiogram overlay toggles
for (const [role, key] of [['labels', 'labels'], ['colour', 'colour']]) {
  const b = document.querySelector(`[data-role="${role}"]`); if (!b) continue;
  b.addEventListener('click', () => state.set({ [key]: !state.get()[key] }));
  const sync = (s) => b.setAttribute('aria-pressed', String(!!s[key])); state.subscribe(sync); sync(state.get());
}

// heart panel buttons
const seeBtn = document.querySelector('[data-role="see-through"]'), detBtn = document.querySelector('[data-role="detector-view"]');
if (heart) {
  seeBtn?.addEventListener('click', () => { const on = !heart.seeThrough; heart.setSeeThrough(on); seeBtn.setAttribute('aria-pressed', String(on)); });
  detBtn?.addEventListener('click', () => heart.detectorView());
  for (const [role, m] of [['fs-mode', 'fs'], ['centrelines', 'centrelines'], ['heart-labels', 'labels'], ['planes', 'planes']]) {
    const b = document.querySelector(`[data-role="${role}"]`); if (!b) continue;
    b.addEventListener('click', () => { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); heart.setMode(m, on); });
  }
} else { document.querySelector('.heart-tools')?.remove(); document.querySelector('[data-role="swap"]')?.remove(); }

// phone: the heart becomes a corner thumbnail inside the sticky angiogram stage; tapping it swaps the two
const stage = document.querySelector('[data-role="stage"]'), heartBox = document.querySelector('[data-role="heart-box"]');
const paneHeart = document.querySelector('.pane-heart'), phone = matchMedia('(max-width: 700px)');
function layout() {
  heartHidden = (paneHeart?.dataset.show || 'heart') !== 'heart' && !phone.matches;   // a phone shows every viewer as a fold
  if (!stage || !heartBox || !heart) return;
  if (phone.matches && heartBox.parentElement !== stage) stage.append(heartBox);
  if (!phone.matches && heartBox.parentElement !== paneHeart) { stage.classList.remove('swapped'); paneHeart.prepend(heartBox); }
  render();
}
phone.addEventListener('change', layout); layout();
// folds: on a phone the 3D heart and the angle pad start folded; on wider screens every fold is open (no fold header)
function folds() {
  for (const [sel, phoneOpen] of [['.heart-fold', false], ['[data-fold="pad"]', false], ['[data-fold="teach"]', true], ['[data-fold="anatomy"]', false], ['[data-fold="real"]', false], ['[data-fold="room"]', false]]) {
    const f = document.querySelector(sel); if (f) f.open = phone.matches ? phoneOpen : true;
  }
}
phone.addEventListener('change', folds); folds();
document.querySelector('[data-role="swap"]')?.addEventListener('click', () => { stage.classList.toggle('swapped'); render(); });

// theme: dark by default; the site-wide key cathmath_dark ('0' = light)
const modeBtn = document.getElementById('modeToggle');
function syncMode() { const light = document.body.classList.contains('light');
  modeBtn.textContent = light ? 'Dark Mode' : 'Light Mode'; modeBtn.setAttribute('aria-pressed', String(light));
  modeBtn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode'); }
modeBtn?.addEventListener('click', () => { const light = !document.body.classList.contains('light');
  document.body.classList.toggle('light', light); try { localStorage.setItem('cathmath_dark', light ? '0' : '1'); } catch (e) {}
  syncMode(); render(); });
if (modeBtn) syncMode();
// a link edited by hand or the back button: anything it leaves out is the default (dominance right, no ramus, no grafts)
window.addEventListener('hashchange', () => { ctl?.stop();
  setVariant({ view: null, sel: null, dom: 'right', ramus: false, grafts: [], ...fromHash(location.hash) }); });
const ro = new ResizeObserver(() => render()); ro.observe(canvas); if (heartCanvas) ro.observe(heartCanvas);
render();
status?.remove();

// ── debug/test hooks (only with ?debug) ──────────────────────────────────────────────────────────────────────────────
function pointAt(pts, s) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const t = s * L[L.length - 1]; let i = 1; while (i < L.length - 1 && L[i] < t) i++;
  const f = (t - L[i - 1]) / Math.max(1e-9, L[i] - L[i - 1]); return pts[i - 1].map((v, k) => v + (pts[i][k] - v) * f);
}
// a vessel of the current tree, a graft of the current dominance, or a metal marker (marker0 …)
const pathOf = (id) => T().vessels.find(x => x.id === id)?.pts || (D.grafts.by_dominance[state.get().dom] || []).find(g => g.id === id)?.pts
  || (/^marker\d+$/.test(id) ? markersOf(state.get().dom)[+id.slice(6)]?.pts : null);
if (DEBUG) window.__angio = {
  get tier() { return tier; },
  // feed frame durations (ms) to the pacer as if they had been measured; returns the tier after
  pace(ms) { for (const d of ms) pace(d); return tier; },
  ready: true, get kind() { return angio.kind; }, state, layers: { bone: bone.length, tissue: tissue.map(g => g.attributes.position.count) },
  // For each [vessel, arc fraction]: the pixel geometry.js projects it to, and the mean grey of the 3×3 block THERE.
  // Inside a vessel that block is dark; a mirrored or shifted image puts it on background (half a 2 mm OM is ~3 px).
  probe(list) {
    const img = angio.readAll(), n = angio.size;
    return list.map(([id, s]) => {
      const P = pathOf(id); if (!P) return { id, s, inside: false, missing: true };
      const [ex, ey] = angio.toPixel(pointAt(P, s));
      let sum = 0, k = 0;
      for (let y = Math.round(ey) - 1; y <= Math.round(ey) + 1; y++) for (let x = Math.round(ex) - 1; x <= Math.round(ex) + 1; x++)
        if (x >= 0 && y >= 0 && x < n && y < n) { sum += img[(y * n + x) * 4] / 255; k++; }
      return { id, s, ex, ey, at: k ? sum / k : 1, inside: k > 0 };
    });
  },
  // mean grey of the 3×3 block at the pixel a 3D point projects to (or at a vessel/graft/marker id + arc fraction)
  sample(pOrId, s) { const p = typeof pOrId === 'string' ? pointAt(pathOf(pOrId), s) : pOrId; const img = angio.readAll(), n = angio.size, [ex, ey] = angio.toPixel(p);
    let sum = 0, k = 0;
    for (let y = Math.round(ey) - 1; y <= Math.round(ey) + 1; y++) for (let x = Math.round(ex) - 1; x <= Math.round(ex) + 1; x++)
      if (x >= 0 && y >= 0 && x < n && y < n) { sum += img[(y * n + x) * 4] / 255; k++; }
    return k ? sum / k : null; },
  stats() { const img = angio.readAll(); const g = []; for (let i = 0; i < img.length; i += 4 * 7) g.push(img[i] / 255); g.sort((a, b) => a - b);
    return { bg: g[Math.floor(g.length / 2)], vesselMin: g[0] }; },
  // vessel mask on an n×n grid: pixels clearly darker than the median grey
  mask(n) { const img = angio.readAll(), S = angio.size, g = []; for (let i = 0; i < img.length; i += 4 * 7) g.push(img[i]); g.sort((a, b) => a - b);
    const bg = g[Math.floor(g.length / 2)] / 255, out = new Array(n * n).fill(0);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (img[(y * S + x) * 4] / 255 < bg - 0.2) out[Math.floor(y * n / S) * n + Math.floor(x * n / S)] = 1;
    return out; },
  get heart() { return heart; },
  // direction from one vessel point to another, in the angiogram and in the 3D heart: cosine between the two
  alignment(a, b) {
    const pa = pointAt(pathOf(a[0]), a[1]), pb = pointAt(pathOf(b[0]), b[1]);
    const [ax, ay] = angio.toPixel(pa), [bx, by] = angio.toPixel(pb), [hx, hy] = heart.screen(pa), [kx, ky] = heart.screen(pb);
    const u = [bx - ax, by - ay], w = [kx - hx, ky - hy], n = Math.hypot(...u) * Math.hypot(...w);
    return { cos: (u[0] * w[0] + u[1] * w[1]) / n, angio: u, heart: w };
  },
  readAll: () => angio.readAll(),
  get pad() { return pad; },
  segmentMid3D: (id) => segmentMidpoint(T(), id),
  // CSS-pixel position on the angiogram of a vessel/graft point (for taps in tests)
  screenOf(id, s) { const b = canvas.getBoundingClientRect(), [x, y] = angio.toPixel(pointAt(pathOf(id), s));
    return { x: b.left + x * b.width / angio.size, y: b.top + y * b.height / angio.size }; },
  get real() { return real?.debug(); },
  get room() { return room ? room.debug : null; },
  setVariant, D, pathPoint: (id, s) => { const P = pathOf(id); return P ? pointAt(P, s) : null; },
  classify: () => { const s = state.get(); return classify(D, s.dom, s.sys, s.lao, s.cra, s); },
  overlayPixels: () => overlay.pixels(), overlayLabels: () => overlay.labels(), segmentScreen: (id) => overlay.screen(id),
  setBackdrop(on) { angio.setBackdrop?.(on); render(); },
  hash() { const img = angio.readAll(); let h = 0; for (let i = 0; i < img.length; i += 4 * 97) h = (h * 31 + img[i]) >>> 0; return h; },
};
