// Closure Devices page: builds the two windows, loads a device mode (its code and models on first use), runs its steps
// (Show me / Undo / Restart / jump to a step, and the wrong moves it offers) and keeps both windows on the same pose.
// The mode is in the address (#angioseal; none = ProGlide). With ?debug, window.__closure exposes hooks for the tests.
import * as THREE from '../vendor/three/three-closure.min.js';
import { createView } from './render/view.js';
import { createInside } from './render/inside.js';
import { createHands } from './render/hands.js';
import { MODES, modeFromHash, loadMode } from './modes/index.js';
import { createAnimator } from './anim.js';
import { createUI } from './ui.js';

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
  try { const c = document.createElement('canvas'); const gl = c.getContext('webgl2'); gl?.getExtension('WEBGL_lose_context')?.loseContext(); return !!gl; }
  catch (e) { return false; }
}
// pixels: 2× unless the GPU is software or the link asks for the low tier
function pixelRatio() {
  if (params.get('tier') === 'low') return 1;
  if (params.get('tier') === 'high') return 2;
  try {
    const gl = document.createElement('canvas').getContext('webgl2'), info = gl.getExtension('WEBGL_debug_renderer_info');
    const r = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (/swiftshader|llvmpipe|softpipe|software/i.test(r) || navigator.connection?.saveData) return 1;
  } catch (e) { return 1; }
  return 2;
}
// each model file is fetched once for the life of the page
const glbCache = new Map();
function loadGLB(name) {
  if (!glbCache.has(name)) glbCache.set(name, (async () => {
    const res = await fetch(`models/${name}`); if (!res.ok) throw new Error(`${name}: ${res.status}`);
    const buf = await res.arrayBuffer();
    return new Promise((resolve, reject) => new THREE.GLTFLoader().parse(buf, '', (g) => resolve(g.scene), reject));
  })().catch((e) => { glbCache.delete(name); throw e; }));
  return glbCache.get(name);
}

// ── the run: the mode, its states, history, a queue so taps during a move are kept in order ──
let mode = null, M = null, geom = null, models = [], state, history = [], queue = [], working = false, anim, ui;
let iv = null, hv = null, inside = null, hands = null, inLayer = null, handLayer = null, inRoot = null, handRoot = null, gl = false;
let switching = Promise.resolve(), modeSerial = 0, loading = false, picked = null;

const pose = (s) => mode.poseOf(s, geom);
function draw(p) {
  if (!mode || !p) return;
  if (inside) { inside.update(mode.shared(p, geom)); inLayer?.update(p); }
  if (hands) { hands.update(mode.shared(p, geom)); handLayer?.update(p); }
  if (ui && gl) ui.showParts((mode.parts || []).filter((pt) => partObjs(pt).some(shown)).map((pt) => pt.id));
}
// a legend part's objects in both windows; an object is in view when it and every parent are visible
const ALL = { device: 'both' };
const flat = (o) => [o].flat(Infinity).filter(Boolean);
const partObjs = (pt) => [...flat(inLayer?.resolve?.(pt.id, ALL)), ...flat(handLayer?.resolve?.(pt.id, ALL))];
const shown = (o) => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
// tapping a part lights it in both windows until it is tapped again or the step changes
function pickPart(id) {
  const pt = picked === id ? null : (mode.parts || []).find((q) => q.id === id) || null;
  picked = pt?.id || null; ui.pick(picked);
  if (!pt) { inside?.glow([]); focusStep(); return; }
  inside?.glow(flat(inLayer?.resolve?.(pt.id, ALL)));
  hands?.focus({ nodes: [pt.id], device: 'both' }, handLayer.resolve);
}
function focusStep() {
  const next = M.nextAction(state);
  if (hands && handLayer) hands.focus(next ? mode.focusFor(next, pose(state), handLayer) : null, handLayer.resolve);
}
function refresh() {
  const next = M.nextAction(state), si = M.stepIndex(state), last = mode.steps.length - 1;
  ui.show({ stepIndex: si, next, available: M.available(state), failed: state.failed ? mode.mistakes[state.failed] : null,
    canUndo: history.length > 0 });
  if (iv) iv.setPreset(mode.insidePreset(Math.min(si, last)));
  if (hv && handLayer) hv.setPreset(mode.handsPreset(Math.min(si, last), pose(state), handLayer));
  if (picked) { picked = null; ui.pick(null); inside?.glow([]); }
  focusStep();
}
async function work() {
  if (working) return; working = true;
  const serial = modeSerial;
  while (queue.length && serial === modeSerial) {
    const a = queue.shift();
    if (!M.available(state).includes(a)) continue;        // judged when its turn comes: right moves advance, wrong ones fail
    history.push(state); state = M.apply(state, a); refresh();
    await anim.to(pose(state), mode.duration(a));
  }
  working = false;
}
const act = (a) => { if (loading) return Promise.resolve(); queue.push(a); return work(); };
// Show me: the action after everything already queued, so five quick taps are five steps
function showMe() {
  if (loading) return Promise.resolve();
  let s = state; for (const a of queue) if (M.available(s).includes(a)) s = M.apply(s, a);
  const n = M.nextAction(s); return n ? act(n) : Promise.resolve();
}
function settleNow() { queue = []; anim.finish(); }
function undo() {
  settleNow(); if (!history.length) return;
  state = history.pop(); anim.set(pose(state)); refresh();
}
function restart() { settleNow(); history = []; state = M.initialState(geom); anim.set(pose(state)); refresh(); }
function jump(i) {
  settleNow(); let s = M.initialState(geom); const h = [];
  while (M.stepIndex(s) < i && M.nextAction(s)) { h.push(s); s = M.apply(s, M.nextAction(s)); }
  history = h; state = s; anim.set(pose(state)); refresh();
}

// a device mode: its code and models (once each), new layers in both windows, its first step
function setMode(id) {
  switching = switching.then(async () => {
    if (mode?.id === id) return;
    const serial = ++modeSerial; queue = []; anim?.finish();
    let next, mods;
    loading = true; ui.loading(true);
    try {
      next = await loadMode(id);
      mods = gl ? await Promise.all(next.models.map(loadGLB)) : next.models.map(() => null);
    } catch (e) {
      console.warn(e); loading = false; ui.loading(false); if (mode) refresh();
      ui.notice('That device could not load. Check the connection and tap it again.');
      return;
    }
    loading = false; ui.loading(false);
    if (serial !== modeSerial) return;
    mode = next; M = mode.machine; models = mods; geom = mode.readGeom(models); picked = null; inside?.glow([]);
    for (const [root, view] of [[inRoot, iv], [handRoot, hv]]) if (root) { view.scene.remove(root); }
    if (gl) {
      inRoot = new THREE.Group(); handRoot = new THREE.Group(); iv.scene.add(inRoot); hv.scene.add(handRoot);
      inLayer = mode.insideLayer(iv, inRoot, models, geom); handLayer = mode.handsLayer(hv, handRoot, models, geom);
    }
    ui.setMode(mode);
    for (const b of document.querySelectorAll('#modes [data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode.id));
    history = []; state = M.initialState(geom); anim.set(pose(state)); refresh();
    if (gl) { iv.fit(iv.preset); hv.fit(hv.preset); }
    const want = mode.id === MODES[0].id ? '' : `#${mode.id}`;
    if (location.hash !== want) try { history_.replaceState(null, '', location.pathname + location.search + want); } catch (e) {}
  });
  return switching;
}
const history_ = window.history;
// the hands layer's named strands (they have no object names), for the debug hooks
const handLayerNames = () => Object.fromEntries(['rail', 'nonRail', 'trimmer', 'silk', 'needle', 'sheath'].map((n) => [n, handLayer?.resolve?.(n, ALL)]));

async function boot() {
  gl = webglOK();
  anim = createAnimator({ reduced: () => !gl || reducedMotion(), onFrame: draw });   // no WebGL: nothing ticks, so moves land at once
  ui = createUI({ steps: [], actions: {}, done: { title: '', text: '' } }, {
    onAction: act, onShowMe: showMe, onUndo: undo, onRestart: restart, onJump: jump,
    onExpand: (id) => { ui.expand(id); iv?.resize(); hv?.resize(); }, onPick: pickPart });
  if (gl) {
    const pr = pixelRatio();
    iv = createView(THREE, document.querySelector('#inside canvas'), { pixelRatio: pr });
    hv = createView(THREE, document.querySelector('#hands canvas'), { pixelRatio: pr });
    inside = createInside(iv); hands = createHands(hv);
    const ro = new ResizeObserver(() => { iv.resize(); hv.resize(); });
    ro.observe(document.querySelector('#inside')); ro.observe(document.querySelector('#hands'));
    iv.resize(); hv.resize();
    const loop = (now) => { anim.tick(now); iv.frame(now); hv.frame(now); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  } else {
    for (const w of document.querySelectorAll('.win')) {
      w.classList.add('no-webgl');
      const n = document.createElement('p'); n.className = 'notice'; n.textContent = 'This view needs WebGL, which this browser has turned off.'; w.appendChild(n);
    }
  }
  for (const b of document.querySelectorAll('#modes [data-mode]')) b.addEventListener('click', () => setMode(b.dataset.mode));
  window.addEventListener('hashchange', () => setMode(modeFromHash(location.hash)));
  await setMode(modeFromHash(location.hash));

  window.__closure = { ready: true };
  if (debug) Object.assign(window.__closure, {
    mode: () => mode.id, setMode, state: () => state, pose: () => anim.pose, nextAction: () => M.nextAction(state),
    available: () => M.available(state), poseOf: (s) => pose(s), busy: () => working || anim.busy(),
    act, showMe, undo, restart, jump,
    instant: (a) => { settleNow(); history.push(state); state = M.apply(state, a); anim.set(pose(state)); refresh(); },
    nodeWorld: (name) => { const o = inLayer?.node(name); if (!o) return null; o.updateWorldMatrix(true, false);
      const v = new THREE.Vector3(); o.getWorldPosition(v); return v.toArray(); },
    knotWorld: () => inLayer?.knotWorld?.(anim.pose),
    stats: () => [iv, hv].map((v) => v ? pixelStats(v) : null),
    geom: () => geom, fetched: () => [...glbCache.keys()],
    insideDebug: () => inside?.debug?.(),
    focusNames: () => (hands?.focused() || []).map((o) => o.name || Object.entries(handLayerNames()).find(([, v]) => flat(v).includes(o))?.[0]).filter(Boolean),
    focusDevice: () => [...new Set((hands?.focused() || []).map((o) => { let x = o; while (x && !x.userData.device) x = x.parent; return x?.userData.device; }).filter(Boolean))],
  });
}

// spread of the rendered pixels (a blank canvas is flat): render now and read back a grid of samples
function pixelStats(view) {
  view.markDirty(); view.frame();
  const g = view.renderer.getContext(), w = g.drawingBufferWidth, h = g.drawingBufferHeight, px = new Uint8Array(4);
  const vals = [];
  for (let i = 1; i < 16; i++) for (let j = 1; j < 16; j++) {
    g.readPixels(Math.floor(w * i / 16), Math.floor(h * j / 16), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
    vals.push(0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2]);
  }
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { mean, sd: Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length), width: w, height: h };
}

boot().catch((e) => { console.error(e); window.__closure = { ready: true, error: String(e) }; });
