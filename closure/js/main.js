// Closure Devices page: builds the two windows, loads a device mode (its code and models on first use), runs its steps
// (Show me / Play / Undo / Restart / jump to a step, the scrub bar, and the wrong moves it offers) and keeps both windows on
// the same pose.
// The mode is in the address (#angioseal; none = ProGlide). With ?debug, window.__closure exposes hooks for the tests.
import * as THREE from '../vendor/three/three-closure.min.js';
import { createView } from './render/view.js';
import { createInside } from './render/inside.js';
import { createHands } from './render/hands.js';
import { MODES, modeFromHash, loadMode } from './modes/index.js';
import { createAnimator } from './anim.js';
import { createPlayer } from './play.js';
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
// the scrub bar: the mode's correct path (course[k] = after k correct moves), the move under way (for the thumb), where it is
let scrub = null, course = [], moveBar = null, barX = 0;
// let go between two moves, the page stays there (Saro, 2026-11-02: "if i drag to the middle of the two points it doesnt
// stay there it goes back to the prior step"): parkX is that point; the state is the one before the move under way
let parkX = null;

const pose = (s) => mode.poseOf(s, geom);
function draw(p) {
  if (!mode || !p) return;
  if (scrub && !scrub.dragging()) setBar(moveBar ? moveBar.from + (moveBar.to - moveBar.from)
    * Math.min(1, (performance.now() - moveBar.t0) / moveBar.ms) : parkX !== null ? parkX : state ? state.done : 0);
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
function focusStep(along = null) {
  const next = M.nextAction(state);
  if (hands && handLayer) hands.focus(next ? mode.focusFor(next, pose(state), handLayer, along) : null, handLayer.resolve);
}
// each move puts both cameras back on the step's preset; while the scrub bar is dragged only a preset that changed does
// (a camera restarted on every pointer move would never get anywhere). Between two moves on the bar (dragged or let go)
// the mode is also handed the pose drawn there (along), so a camera that rides along with a move can follow it.
const presetKey = (q) => (q ? [q.target, q.dir, q.radius].flat().map((v) => Math.round(v * 2) / 2).join(',') : '');
let shownPresets = ['', ''];
function refresh(scrubbing = false, along = null) {
  const next = M.nextAction(state), si = M.stepIndex(state), last = mode.steps.length - 1;
  ui.show({ stepIndex: si, next, available: M.available(state), failed: state.failed ? mode.mistakes[state.failed] : null,
    canUndo: history.length > 0 || parkX !== null });
  const ip = iv ? mode.insidePreset(Math.min(si, last), pose(state), along) : null;
  const hp = hv && handLayer ? mode.handsPreset(Math.min(si, last), pose(state), handLayer, along) : null;
  // a preset may say how long its camera flies (one that rides along with a move flies as long as the move)
  if (ip && (!scrubbing || presetKey(ip) !== shownPresets[0])) iv.setPreset(ip, ip.ms);
  if (hp && (!scrubbing || presetKey(hp) !== shownPresets[1])) hv.setPreset(hp, hp.ms);
  shownPresets = [presetKey(ip), presetKey(hp)];
  if (picked) { picked = null; ui.pick(null); inside?.glow([]); }
  focusStep(along);
}
// resolves once the queue is empty and its last move has played
let running = Promise.resolve();
function work() {
  if (working) return running;
  working = true;
  running = (async () => {
    const serial = modeSerial;
    while (queue.length && serial === modeSerial) {
      const a = queue.shift();
      if (!M.available(state).includes(a)) continue;        // judged when its turn comes: right moves advance, wrong ones fail
      // the move under way where the bar was let go runs on from that point, for the time it has left
      const resume = parkX !== null && Math.floor(parkX) === state.done && !state.failed && a === M.nextAction(state);
      const from = resume ? parkX : state.done, ms = mode.duration(a) * (resume ? 1 - (parkX - state.done) : 1);
      parkX = null;
      history.push(state); state = M.apply(state, a); refresh();
      moveBar = { from, to: state.done, t0: performance.now(), ms };
      await anim.to(pose(state), ms);
      moveBar = null; if (state && !scrub?.dragging()) setBar(state.done);
    }
    working = false;
  })();
  return running;
}
const act = (a) => { if (loading) return Promise.resolve(); queue.push(a); return work(); };
// Play: the correct moves in a row, paced by play.js; anything else the user does stops it (the move under way finishes)
let pace = 1;                                                  // ?debug: the tests shorten the pauses
const player = createPlayer({
  next: () => (loading || !M ? null : M.nextAction(state)),
  stepIndex: () => M.stepIndex(state),
  words: () => { const s = mode.steps[M.stepIndex(state)]; return s ? [s.text, s.cue].filter(Boolean).join(' ') : ''; },
  perform: (a) => act(a),
  wait: (ms) => new Promise((r) => setTimeout(r, ms * pace)),
  onChange: (on) => ui?.playing(on),
});
function togglePlay() {
  if (!player.playing() && M && !M.nextAction(state) && !state.failed) restart();   // at the end: again from the first step
  return player.toggle();
}
// Show me: the action after everything already queued, so five quick taps are five steps
function showMe() {
  player.stop();
  if (loading) return Promise.resolve();
  let s = state; for (const a of queue) if (M.available(s).includes(a)) s = M.apply(s, a);
  const n = M.nextAction(s); return n ? act(n) : Promise.resolve();
}
function settleNow() { player.stop(); queue = []; moveBar = null; parkX = null; anim.finish(); }
// Undo from a point between two moves goes back to the start of the move under way; from a move's end, one move back
function undo() {
  const parked = parkX !== null; settleNow();
  if (parked) { anim.set(pose(state)); setBar(state.done); refresh(); return; }
  if (!history.length) return;
  state = history.pop(); anim.set(pose(state)); refresh();
}
function restart() { settleNow(); history = []; state = M.initialState(geom); anim.set(pose(state)); refresh(); }
function jump(i) {
  settleNow(); let s = M.initialState(geom); const h = [];
  while (M.stepIndex(s) < i && M.nextAction(s)) { h.push(s); s = M.apply(s, M.nextAction(s)); }
  history = h; state = s; anim.set(pose(state)); refresh();
}
// the scrub bar: dragging runs the correct path to that point — the in-between pose, the guide and the camera follow —
// and stops Play; letting go leaves the page there — between two moves, the in-between pose with the state before the move
// under way (parkX) — with the history rebuilt so Undo steps back along the path. From a wrong move it comes back onto the
// correct path.
function setBar(x) { barX = x; scrub?.set(x); }
function scrubTo(x) {
  if (loading || !course.length) return;
  player.stop(); queue = []; moveBar = null; parkX = null; if (anim.busy()) anim.finish();
  const n = course.length - 1, k = Math.min(Math.floor(Math.max(x, 0)), n);
  state = course[k]; history = course.slice(0, k);
  const p = poseAlong(course, pose, x);
  barX = x; anim.set(p); refresh(true, x > k && k < n ? p : null);
}
function scrubEnd(x) {
  if (loading || !course.length) return;
  const n = course.length - 1, X = Math.min(Math.max(x, 0), n), k = Math.min(Math.floor(X + 1e-6), n);
  player.stop(); queue = []; moveBar = null; if (anim.busy()) anim.finish();
  state = course[k]; history = course.slice(0, k); parkX = X - k > 1e-6 ? X : null;
  const p = parkX === null ? null : poseAlong(course, pose, X);
  anim.set(p || pose(state)); setBar(parkX === null ? k : X); refresh(false, p);
}
const stepName = (i) => { const st = mode.steps[Math.min(i, mode.steps.length - 1)]; return i >= mode.steps.length ? mode.done.title : `Step ${i + 1}: ${st.title}`; };

// the old layers leave the GPU with their mode: geometry and materials (a cached model used again is uploaded again; the
// textures stay, few and shared with the cache)
function release(root) { root.traverse((o) => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) m.dispose(); }); }
// a device mode: its code and models (once each), new layers in both windows, its first step
function setMode(id) {
  switching = switching.then(async () => {
    if (mode?.id === id) return;
    const serial = ++modeSerial; player.stop(); queue = []; anim?.finish();
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
    for (const [root, view] of [[inRoot, iv], [handRoot, hv]]) if (root) { view.scene.remove(root); release(root); }
    if (gl) {
      inRoot = new THREE.Group(); handRoot = new THREE.Group(); iv.scene.add(inRoot); hv.scene.add(handRoot);
      inLayer = mode.insideLayer(iv, inRoot, models, geom); handLayer = mode.handsLayer(hv, handRoot, models, geom);
    }
    ui.setMode(mode);
    for (const b of document.querySelectorAll('#modes [data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === mode.id));
    history = []; state = M.initialState(geom); moveBar = null; parkX = null;
    course = correctPath(M, geom); scrub.setMarks(course.length - 1, courseMarks(M, course, mode.steps, mode.phases));
    anim.set(pose(state)); setBar(0); refresh();
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
    onAction: (a) => { player.stop(); return act(a); }, onShowMe: showMe, onPlay: togglePlay, onUndo: undo, onRestart: restart, onJump: jump,
    onExpand: (id) => { ui.expand(id); iv?.resize(); hv?.resize(); }, onPick: pickPart });
  scrub = createScrubber(document.querySelector('#scrub'), { onScrub: scrubTo, onRelease: scrubEnd,
    text: (x) => (M && course.length ? stepName(M.stepIndex(course[Math.min(Math.floor(x), course.length - 1)])) : '') });
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
    playing: () => player.playing(), pace: (k) => { pace = k; },
    act, showMe, undo, restart, jump, scrubTo, scrubEnd, bar: () => barX, courseLength: () => course.length - 1,
    poseAt: (x) => poseAlong(course, pose, x),
    courseState: (k) => course[k],
    historyLength: () => history.length,
    instant: (a) => { settleNow(); history.push(state); state = M.apply(state, a); anim.set(pose(state)); refresh(); },
    nodeWorld: (name) => { const o = inLayer?.node(name); if (!o) return null; o.updateWorldMatrix(true, false);
      const v = new THREE.Vector3(); o.getWorldPosition(v); return v.toArray(); },
    knotWorld: () => inLayer?.knotWorld?.(anim.pose),
    stats: () => [iv, hv].map((v) => v ? pixelStats(v) : null),
    geom: () => geom, fetched: () => [...glbCache.keys()],
    // geometries and textures each window's renderer holds on the GPU now
    gpu: () => [iv, hv].map((v) => (v ? { ...v.renderer.info.memory } : null)),
    // objects whose visible is not a boolean: three.js hides only visible === false, so a 0 is drawn (wherever it was left)
    badVisible: () => { const out = []; for (const v of [iv, hv]) v?.scene.traverse((o) => { if (typeof o.visible !== 'boolean') out.push(o.name || o.type); }); return out; },
    // the colour drawn where a world point lands in a window (camera settled first)
    pixelAt: (w, p) => { const v = w === 'hands' ? hv : iv; if (!v) return null; v.fit(v.preset); v.markDirty(); v.frame();
      const q = new THREE.Vector3(...p).project(v.camera), g = v.renderer.getContext(), px = new Uint8Array(4);
      g.readPixels(Math.round((q.x + 1) / 2 * g.drawingBufferWidth), Math.round((q.y + 1) / 2 * g.drawingBufferHeight), 1, 1, g.RGBA, g.UNSIGNED_BYTE, px);
      return [px[0], px[1], px[2]]; },
    // where a world point is on a window's screen now (−1…1 across), and how far its camera stands from what it looks at
    ndc: (w, p) => { const v = w === 'hands' ? hv : iv; if (!v) return null; const q = new THREE.Vector3(...p).project(v.camera); return [q.x, q.y]; },
    camDist: (w) => { const v = w === 'hands' ? hv : iv; return v ? v.camera.position.distanceTo(v.controls.target) : null; },
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
