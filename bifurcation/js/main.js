// Bifurcation Stenting page: builds the two windows, loads a technique (its code once) and the models, runs its steps
// (Show me / Undo / Restart / jump to a step), each action playing its keyframes and, where an operator would check, a puff
// of contrast; both windows draw the same pose. The technique is in the address (#provisional; none = Provisional).
// With ?debug, window.__bif exposes hooks for the tests.
import * as THREE from '../vendor/three/three-bifurcation.min.js';
import { createView } from './engine/view.js';
import { createAnimator } from './engine/anim.js';
import { createCut } from './render/cut.js';
import { createFluoro } from './render/fluoro.js';
import { MODES, modeFromHash, loadMode } from './modes/index.js';
import { readGraph, stentLines } from './devices/stent.js';
import { sbStentLines } from './devices/sb-stent.js';
import { makeFrame, OSTIUM } from './scene/anatomy.js';
import { CHOICES, PARTNER, productOf, resultLines } from './compare.js';
import { createCompare } from './render/compare-view.js';
import { FLAP } from './scene/vessel.js';
import { createUI } from './ui.js';
import { createScrubber } from './scrub.js';
import { correctPath, courseMarks, poseAlong } from './course.js';

// theme: dark by default; the site-wide key cathmath_dark ('0' = light)
const modeBtn = document.getElementById('modeToggle');
function syncMode() { const light = document.body.classList.contains('light');
  modeBtn.textContent = light ? 'Dark Mode' : 'Light Mode'; modeBtn.setAttribute('aria-pressed', String(light));
  modeBtn.setAttribute('aria-label', light ? 'Switch to dark mode' : 'Switch to light mode'); }
modeBtn?.addEventListener('click', () => { const light = !document.body.classList.contains('light');
  document.body.classList.toggle('light', light); try { localStorage.setItem('cathmath_dark', light ? '0' : '1'); } catch (e) {}
  syncMode(); });
if (modeBtn) syncMode();

const params = new URLSearchParams(location.search), debug = params.has('debug');
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function webglOK() {
  try { const c = document.createElement('canvas'); const g = c.getContext('webgl2'); g?.getExtension('WEBGL_lose_context')?.loseContext(); return !!g; }
  catch (e) { return false; }
}
function pixelRatio() {
  if (params.get('tier') === 'low') return 1;
  if (params.get('tier') === 'high') return 2;
  try {
    const g = document.createElement('canvas').getContext('webgl2'), info = g.getExtension('WEBGL_debug_renderer_info');
    const r = String(g.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : g.RENDERER) || '');
    g.getExtension('WEBGL_lose_context')?.loseContext();
    if (/swiftshader|llvmpipe|softpipe|software/i.test(r) || navigator.connection?.saveData) return 1;
  } catch (e) { return 1; }
  return 2;
}
const fetched = new Set();
async function fetchBuf(path) { fetched.add(path); const r = await fetch(path); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r.arrayBuffer(); }
const parseGLB = (buf) => new Promise((res, rej) => new THREE.GLTFLoader().parse(buf, '', (g) => res(g.scene), rej));

// ── the run ──
let mode = null, M = null, state, history = [], queue = [], working = false, anim, ui, ctx = null;
let cv = null, cut = null, fl = null, gl = false, loading = false, modeSerial = 0, switching = Promise.resolve(), trace = null, windowsReady = false;
// the scrub bar: the technique's correct path (course[k] = after k actions), the action under way (for the thumb), where it is
let scrub = null, course = [], moveBar = null, barX = 0;
const poseOf = (s) => mode.poseOf(s, ctx);
function draw(p) {
  if (!p) return;
  if (scrub && !scrub.dragging() && mode) setBar(moveBar ? moveBar.from + (moveBar.to - moveBar.from)
    * Math.min(1, (performance.now() - moveBar.t0) / Math.max(1, moveBar.ms)) : state ? state.done : 0);
  cut?.update(p); fl?.draw(p);
}
// a new step puts the camera back on its preset, and a drag holds until then (design §4.1: "a drag takes over until the
// next step"); a jump, a restart or a new technique always does; while the scrub bar is dragged only a preset that changed
// does (a camera restarted on every pointer move would never get anywhere)
const presetKey = (q) => (q ? [q.target, q.dir, q.radius].flat().map((v) => Math.round(v * 2) / 2).join(',') : '');
let shownPreset = '', shownStep = -1;
function refresh(scrubbing = false, force = false) {
  const next = M.nextAction(state), si = M.stepIndex(state);
  ui.show({ stepIndex: si, next, available: M.available(state), canUndo: history.length > 0 });
  if (cv && cut) { const q = cut.presetFor(mode.cutPreset(Math.min(si, mode.steps.length - 1))), key = presetKey(q);
    if (force || key !== shownPreset || (!scrubbing && si !== shownStep)) cv.setPreset(q);
    shownPreset = key; shownStep = si; }
  showResult();
}

// ── the result: after the last step, its views (Cut open, End view, Layers) and three measured numbers (design §4.2, §7.5),
// computed once per technique (measure.js finalProduct: the layers the last wire crossed are taken as that rewire left
// them); leaving the end (Undo, a jump, Restart, another technique) takes them away ──
const finals = new Map();          // by choice id (compare.js CHOICES): a technique's own result is the choice of its id
let fp = null, fpView = 'cut', fpSerial = 0;
const $fp = () => ({ views: document.getElementById('fpviews'), legend: document.querySelector('#cut .legend'), list: document.querySelector('#guide .final') });
function finalFor(m, c = { id: m.id }) {
  if (!finals.has(c.id)) finals.set(c.id, productOf(m, ctx, c.opts));
  return finals.get(c.id);
}

// ── Compare (Phase 4, design §4.2): two results side by side, turning together (render/compare-view.js). The picks follow the
// technique on top — it beside its partner (compare.js PARTNER: T / TAP beside the plain T) — until the reader picks; each
// result is measured in its own task, and a pane shows only its newest pick. Built when the section nears the screen. ──
let cmp = null, cmpBuilding = false, cmpPicks = ['provisional', 'dk-crush'], cmpPicked = false, cmpView = 'cut';
const cmpSerial = [0, 0], cmpSelects = () => [document.getElementById('cmpA'), document.getElementById('cmpB')];
// never while a move plays: measuring a result takes ~0.15 s on a laptop and building the panes longer, which would stall the
// top windows mid-move (Final I2)
const idle = async () => { while (working || anim?.busy()) await new Promise((r) => setTimeout(r, 50)); };
async function cmpShow(i, id) {
  const serial = ++cmpSerial[i], c = CHOICES.find((x) => x.id === id);
  let m; try { m = await loadMode(c.mode); } catch (e) { console.warn(e); return; }
  await new Promise((r) => setTimeout(r, 0));
  await idle();
  if (serial !== cmpSerial[i] || !cmp) return;
  const P = finalFor(m, c);
  cmp.setPane(i, { id, label: c.label, done: P.done, map: P.map, lines: resultLines(P.num, { heel: true }), gap: P.num.heelGap || 0 });
}
function cmpSet(i, id) {
  if (!CHOICES.some((c) => c.id === id)) return;
  cmpPicks[i] = id; cmpSelects()[i].value = id;
  if (cmp) cmpShow(i, id);
}
function cmpFollow() { if (cmpPicked || !mode) return; [mode.id, PARTNER[mode.id]].forEach((id, i) => { if (cmpPicks[i] !== id) cmpSet(i, id); }); }
function cmpSetView(v) {
  cmpView = v;
  for (const b of document.querySelectorAll('#cmpViews [data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
  cmp?.setView(v);
}
function setFpView(v) {
  fpView = v; const { views, legend } = $fp();
  for (const b of views.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
  legend.hidden = v !== 'layers';
  document.querySelector('#cut .win-label').textContent = { cut: 'Cut open', end: 'End view', layers: 'Layers' }[v];
  cut?.setView(v, fp?.map);
  if (cv && cut) cv.setPreset(cut.presetFor(v === 'end' ? 'end' : mode.cutPreset(Math.min(M.stepIndex(state), mode.steps.length - 1))));
}
function showResult() {
  const { views, legend, list } = $fp();
  if (M.stepIndex(state) < mode.steps.length) {
    fpSerial++;
    if (fp || !views.hidden || !list.hidden) { fp = null; views.hidden = true; list.hidden = true; legend.hidden = true; if (fpView !== 'cut') setFpView('cut'); }
    return;
  }
  if (fp) return;
  const serial = ++fpSerial, m = mode;
  // after the end's text has painted and the last move has played: the measurement takes a moment (~0.15 s on a laptop),
  // which would stall the move's frames
  setTimeout(function measure() {
    if (serial !== fpSerial || m !== mode || M.stepIndex(state) < mode.steps.length || !ctx) return;
    if (working || anim?.busy()) { setTimeout(measure, 50); return; }
    fp = finalFor(m);
    list.textContent = ''; for (const t of resultLines(fp.num)) { const li = document.createElement('li'); li.textContent = t; list.appendChild(li); }
    list.hidden = false; views.hidden = !cut;
  }, 30);
}
// a puff of contrast over pose p; abandoned (nothing more drawn) once the run moves on — Undo, Restart, a jump, a new technique
async function puff(p) {
  if (reducedMotion() || !gl) return;
  const serial = modeSerial;
  await anim.to({ ...p, puff: 1 }, 600);
  if (serial === modeSerial) await anim.to({ ...p, puff: 0 }, 900);
}
async function work() {
  if (working) return; working = true;
  const serial = modeSerial;
  while (queue.length && serial === modeSerial) {
    const a = queue.shift();
    if (!M.available(state).includes(a)) continue;
    const ks = M.keyframes(state, a), from = state.done;
    history.push(state); state = ks[ks.length - 1]; refresh();
    moveBar = { from, to: state.done, t0: performance.now(), ms: ks.reduce((t, _, i) => t + (reducedMotion() || !gl ? 0 : mode.duration(a, i)), 0) };
    for (let i = 0; i < ks.length && serial === modeSerial; i++) { trace?.push([a, i]); await anim.to(poseOf(ks[i]), mode.duration(a, i)); }
    if (serial === modeSerial) { moveBar = null; if (!scrub?.dragging()) setBar(state.done); }
    if (serial === modeSerial && mode.puffAfter.has(a)) { trace?.push([a, 'puff']); await puff(poseOf(state)); }
  }
  working = false;
}
const act = (a) => { if (loading) return Promise.resolve(); queue.push(a); return work(); };
function showMe() {
  if (loading) return Promise.resolve();
  let s = state; for (const a of queue) if (M.available(s).includes(a)) s = M.apply(s, a);
  const n = M.nextAction(s); return n ? act(n) : Promise.resolve();
}
function settleNow() { queue = []; modeSerial++; working = false; moveBar = null; anim.finish(); }
function undo() { settleNow(); if (!history.length) return; state = history.pop(); anim.set(poseOf(state)); refresh(); }
function restart() { settleNow(); history = []; state = M.initialState(); anim.set(poseOf(state)); refresh(false, true); puff(poseOf(state)); }
function jump(i) {
  settleNow(); let s = M.initialState(); const h = [];
  while (M.stepIndex(s) < i && M.nextAction(s)) { h.push(s); s = M.apply(s, M.nextAction(s)); }
  history = h; state = s; anim.set(poseOf(state)); refresh(false, true);
}
// the scrub bar: dragging runs the correct path to that point — the in-between pose, the guide and the camera follow — and
// stops what was running (the action under way, its puff); letting go settles on the nearest state, with the history
// rebuilt so Undo steps back along the path
function setBar(x) { barX = x; scrub?.set(x); }
const poseAt = (x) => poseAlong(course, M, poseOf, mode.duration, mode.switches, x);
function scrubTo(x) {
  if (loading || !course.length) return;
  settleNow();
  const n = course.length - 1, k = Math.min(Math.floor(Math.max(x, 0)), n);
  state = course[k]; history = course.slice(0, k);
  barX = x; anim.set(poseAt(x)); refresh(true);
}
function scrubEnd(x) {
  if (loading || !course.length) return;
  settleNow();
  const k = Math.min(Math.max(Math.round(x), 0), course.length - 1);
  state = course[k]; history = course.slice(0, k); anim.set(poseOf(state)); setBar(k); refresh();
}
const stepName = (i) => (i >= mode.steps.length ? mode.done.title : `Step ${i + 1}: ${mode.steps[i].title}`);

function setMode(id) {
  switching = switching.then(async () => {
    if (mode?.id === id) return;
    const serial = ++modeSerial; queue = []; anim?.finish();
    let next;
    loading = true; ui.loading(true);
    try { next = await loadMode(id); }
    catch (e) { console.warn(e); loading = false; ui.loading(false); if (mode) refresh(); ui.notice('That technique could not load. Check the connection and tap it again.'); return; }
    loading = false; ui.loading(false);
    if (serial !== modeSerial) return;
    mode = next; M = mode.machine;
    anim = createAnimator({ reduced: () => !gl || reducedMotion(), onFrame: draw, switches: mode.switches });
    ui.setMode(mode);
    for (const b of document.querySelectorAll('#modes [data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode.id));
    history = []; state = M.initialState(); moveBar = null;
    course = correctPath(M); scrub.setMarks(course.length - 1, courseMarks(M, course, mode.steps, mode.phases));
    anim.set(poseOf(state)); setBar(0); refresh(false, true);
    if (cv && cut) cv.fit(cut.presetFor(mode.cutPreset(0)));
    puff(poseOf(state));
    const want = mode.id === MODES[0].id ? '' : `#${mode.id}`;
    if (location.hash !== want) try { window.history.replaceState(null, '', location.pathname + location.search + want); } catch (e) {}
    cmpFollow();
  });
  return switching;
}

async function boot() {
  gl = webglOK();
  ui = createUI({ steps: [], actions: {}, done: { title: '', text: '' } }, {
    onAction: act, onShowMe: showMe, onUndo: undo, onRestart: restart, onJump: jump,
    onExpand: (id) => { ui.expand(id); cv?.resize(); } });
  // Compare's picks: listed now, measured and drawn once the section nears the screen
  cmpSelects().forEach((sel, i) => {
    for (const c of CHOICES) { const o = document.createElement('option'); o.value = c.id; o.textContent = c.label; sel.appendChild(o); }
    sel.value = cmpPicks[i]; sel.addEventListener('change', () => { cmpPicked = true; cmpSet(i, sel.value); });
  });
  for (const b of document.querySelectorAll('#cmpViews [data-view]')) b.addEventListener('click', () => cmpSetView(b.dataset.view));
  scrub = createScrubber(document.querySelector('#scrub'), { onScrub: scrubTo, onRelease: scrubEnd,
    text: (x) => (M && course.length ? stepName(M.stepIndex(course[Math.min(Math.floor(x), course.length - 1)])) : '') });
  const [stentBuf, balloonBuf, treeText] = await Promise.all([fetchBuf('models/stent.glb'), fetchBuf('models/balloon.glb'),
    fetchBuf('data/tree.json').then(b => new TextDecoder().decode(b))]);
  const [stentScene, balloonScene] = await Promise.all([parseGLB(stentBuf), parseGLB(balloonBuf)]);
  const tree = JSON.parse(treeText);
  ctx = { graph: readGraph(stentScene), tree, frame: makeFrame(tree) };
  // the technique first: its steps, the guide and the buttons work while the windows build
  for (const b of document.querySelectorAll('#modes [data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));
  window.addEventListener('hashchange', () => setMode(modeFromHash(location.hash)));
  await setMode(modeFromHash(location.hash));
  for (const b of document.querySelectorAll('#fpviews [data-view]')) b.addEventListener('click', () => { if (fp) setFpView(b.dataset.view); });
  // Stent boost: a page setting, not a step (Undo and jumps leave it as it is)
  const boostBtn = document.getElementById('boost');
  boostBtn.addEventListener('click', () => { const on = boostBtn.getAttribute('aria-pressed') !== 'true';
    boostBtn.setAttribute('aria-pressed', String(on)); fl?.setBoost(on); });
  // then the windows, each on its own: one that cannot draw shows a line and the rest of the page carries on
  const models = { strut: stentScene.getObjectByName('StentRef')?.material, balloon: balloonScene.getObjectByName('Balloon'),
    marker: balloonScene.getObjectByName('Marker') };
  const step = window.innerWidth <= 700 || (gl && pixelRatio() === 1) ? 0.2 : 0.15;
  if (gl) {
    const fault = debug ? params.get('fault') : null;
    try {
      if (fault === 'cut') throw new Error('test fault: cut');
      cv = createView(THREE, document.querySelector('#cut canvas'), { pixelRatio: pixelRatio() });
      cut = await createCut(cv, ctx, models, { step });
    } catch (e) { console.warn(e); cut = null; cv = null; noticeIn(document.querySelector('#cut'), 'This view could not be drawn on this device.'); }
    try {
      if (fault === 'fluoro') throw new Error('test fault: fluoro');
      fl = await createFluoro(document.querySelector('#fluoro canvas'), THREE, ctx, { maxDpr: pixelRatio() });
    } catch (e) { fl = null; noticeIn(document.querySelector('#fluoro'), 'This view needs a graphics feature this device does not have.'); }
    const ro = new ResizeObserver(() => { cv?.resize(); fl?.redraw(); });
    ro.observe(document.querySelector('#cut')); ro.observe(document.querySelector('#fluoro')); cv?.resize();
    if (cut && cv && mode) cv.fit(cut.presetFor(mode.cutPreset(Math.min(M.stepIndex(state), mode.steps.length - 1))));
    if (anim?.pose) draw(anim.pose);
    const loop = (now) => { anim?.tick(now); cv?.frame(now); cmp?.frame(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  } else {
    for (const w of document.querySelectorAll('.win')) noticeIn(w, 'This view needs WebGL, which this browser has turned off.');
  }
  if (!fl) boostBtn.hidden = true;
  windowsReady = true;
  // a result measured before the cut window existed (the end reached while it built) gets its views now
  if (fp && cut) $fp().views.hidden = false;
  // Compare, once the section comes within 100 px of the screen (after the top windows, so it never competes with them; at
  // load it sits ~280–300 px below the fold on a 390 × 844 phone and a 1440 × 900 laptop)
  const cmpRoot = document.getElementById('compare');
  const buildCompare = async () => {
    if (cmp || cmpBuilding) return; cmpBuilding = true;
    await idle();
    try { cmp = await createCompare(cmpRoot, { gl, THREE, createView, createCut, ctx, models, step, pixelRatio: gl ? pixelRatio() : 1 }); }
    catch (e) { console.warn(e); return; }
    cmp.setView(cmpView); cmpPicks.forEach((id, i) => cmpShow(i, id));
    if (gl) { const ro = new ResizeObserver(() => cmp.resize()); for (const w of cmpRoot.querySelectorAll('.cmp-win')) ro.observe(w); }
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); buildCompare(); } }, { rootMargin: '100px 0px' });
    io.observe(cmpRoot);
  } else buildCompare();

  window.__bif = { ready: true };
  if (debug) Object.assign(window.__bif, {
    windowsReady: () => windowsReady, mode: () => mode.id, state: () => state, pose: () => anim.pose, poseOf: (s) => poseOf(s), nextAction: () => M.nextAction(state),
    busy: () => working || anim.busy(), act, showMe, undo, restart, jump,
    scrubTo, scrubEnd, bar: () => barX, courseLength: () => course.length - 1, courseState: (k) => course[k], historyLength: () => history.length,
    poseAt: (x) => poseAt(x),
    instant: (a) => { settleNow(); history.push(state); state = M.apply(state, a); anim.set(poseOf(state)); refresh(); },
    // apply actions until `a` is next; with k, show its k-th keyframe (the state is left before it)
    trace: (start) => { if (start) trace = []; return trace ? trace.slice() : []; },
    walkTo: (a, k = null) => { settleNow(); while (M.nextAction(state) && M.nextAction(state) !== a) { history.push(state); state = M.apply(state, M.nextAction(state)); }
      anim.set(poseOf(k === null ? state : M.keyframes(state, a)[k])); refresh(); },
    node: (name) => cut?.node(name), redraw: () => { cv?.markDirty(); cv?.frame(); fl?.redraw(); },
    stats: () => [cv ? pixelStats(cv) : null, fl ? greyStats(fl) : null], fetched: () => [...fetched],
    compare: () => (cmp ? (({ shown, ...d }) => ({ ...d, shown, picks: cmpPicks.slice(), view: cmpView, ready: shown.join() === cmpPicks.join() }))(cmp.debug()) : null),
    comparePick: (i, id) => { cmpPicked = true; cmpSet(i, id); }, compareStats: () => (cmp ? [0, 1].map((i) => cmp.stats(i)) : null),
    compareViolet: (i) => (cmp ? cmp.violet(i) : null),
    fpView: (v) => { if (v && fp) setFpView(v); return fpView; }, flap: () => !!cut?.flapShown(), flapSums: () => ({ drawn: cut?.flapSum() ?? null, expected: cut?.flapSumFor(poseOf(state)) ?? null }), final: () => (fp ? { ...fp.num } : null), layerCounts: () => cut?.layerCounts() || [],
    camera: () => { const c = cv.camera, q = new THREE.Vector3(...OSTIUM.centre).project(c); return { pos: c.position.toArray(), ostium: [q.x, q.y], userMoved: cv.userMoved }; },
    // checksums of the struts the cut window last drew and of the struts the current state's pose gives, the latter computed
    // afresh (a new ctx has empty caches), so a field missing from a cache's key shows as a difference
    strutSums: () => { const sum = (L) => (L ? L.map(l => l.reduce((a, p) => a + Math.round(1e4 * (p[0] + p[1] + p[2])), 0)) : null), p = poseOf(state), d = cut?.drawn() || {};
      const fresh = { graph: ctx.graph, tree: ctx.tree, frame: ctx.frame };
      return { drawn: { mv: sum(d.mv), sb: sum(d.sb) }, expected: { mv: sum(p.st_shown ? stentLines(ctx.graph, p, fresh) : null), sb: sum(p.ss_shown ? sbStentLines(ctx.graph, p, fresh) : null) } }; },
    toPixel: (name) => { const p = cut?.node(name); return p && fl ? fl.toPixel(ctx.frame.toWorld(p)) : null; },
    fluoroRead: () => ({ size: fl.size, px: fl.readAll() }),
    // the mean grey (0–255) the fluoro shows over the D1 axis ('d1') or over the stent's struts ('stent'), with the current pose
    // changed by `over`; the current pose is drawn again after
    fluoroMean: (what, over = {}) => fluoroMean(what, over),
    chordPx: () => { const a = fl.toPixel(ctx.frame.toWorld([0, 0, 0])), b = fl.toPixel(ctx.frame.toWorld([-10, 0, 0])); return Math.hypot(a[0] - b[0], a[1] - b[1]); },
  });
}

const stentLinesFor = (p) => stentLines(ctx.graph, p, ctx);
function noticeIn(w, text) {
  w.classList.add('no-webgl');
  const n = document.createElement('p'); n.className = 'notice'; n.textContent = text; w.appendChild(n);
}
function greyStats(f) {
  f.redraw(); const px = f.readAll(), n = f.size, vals = [];
  for (let i = 1; i < 16; i++) for (let j = 1; j < 16; j++) { const k = (Math.floor(n * j / 16) * n + Math.floor(n * i / 16)) * 4; vals.push(0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2]); }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { mean, sd: Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length), size: n };
}
function fluoroMean(what, over) {
  const pose = { ...anim.pose, ...over }, pts = [];
  if (what === 'd1') for (let s = 4; s <= 16; s += 0.5) pts.push([Math.cos(Math.PI / 6) * s, Math.sin(Math.PI / 6) * s, 0]);
  if (what === 'flap') for (let s = FLAP.s0 + 1.5; s <= FLAP.s1; s += 0.1) pts.push([Math.cos(Math.PI / 6) * s, Math.sin(Math.PI / 6) * s, 0]);
  if (what === 'stent') for (const l of stentLinesFor(anim.pose)) for (let k = 0; k < l.length; k += 4) pts.push(l[k]);
  fl.draw(pose);
  const px = fl.readAll(), n = fl.size; let sum = 0, c = 0;
  for (const p of pts) { const [x, y] = fl.toPixel(ctx.frame.toWorld(p)).map(Math.round); if (x < 0 || y < 0 || x >= n || y >= n) continue;
    const k = (y * n + x) * 4; sum += 0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2]; c++; }
  fl.draw(anim.pose);
  return sum / Math.max(1, c);
}
// spread of the rendered pixels (a blank canvas is flat): render now and read back a grid of samples
function pixelStats(view) {
  view.markDirty(); view.frame();
  const g = view.renderer.getContext(), w = g.drawingBufferWidth, h = g.drawingBufferHeight, px = new Uint8Array(4), vals = [];
  for (let i = 1; i < 16; i++) for (let j = 1; j < 16; j++) {
    g.readPixels(Math.floor(w * i / 16), Math.floor(h * j / 16), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
    vals.push(0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2]);
  }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { mean, sd: Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length), width: w, height: h };
}

boot().catch((e) => { console.error(e); window.__bif = { ready: true, error: String(e) }; });
