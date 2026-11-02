// Sentinel page: the Arch and Handle windows on one baked sequence (the preview video's motion, checked against the vessel
// walls frame by frame), the guide's moves one tap at a time, Play / Undo / Restart / jump to a step. With ?debug,
// window.__sentinel exposes hooks for the tests.
import * as THREE from '../vendor/three/three-sentinel.min.js';
import { createView } from './render/view.js';
import { createAnimator } from './anim.js';
import { createPlayer } from './play.js';
import { createUI } from './ui.js';
import { decode, frameAt, geometry } from './seq.js';
import { createMachine, stepLabel } from './machine.js';
import { createArch, PARTS } from './arch.js';
import { createHandle } from './handle.js';
import { createScrubber } from './scrub.js';

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
async function fetchOK(url) { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r; }
async function loadGLB(name) {
  const buf = await (await fetchOK(`models/${name}`)).arrayBuffer();
  return new Promise((resolve, reject) => new THREE.GLTFLoader().parse(buf, '', (g) => resolve(g.scene), reject));
}

// ── the run: moves made so far, history for Undo, a queue so taps during a move are kept in order ──
let seq, M, state, history = [], queue = [], working = false, moving = null, anim, ui, gl = false;
let av = null, hv = null, arch = null, handle = null, picked = null, archKey = null, handleKey = null;
let handleOnScreen = true, renders = { arch: 0, handle: 0 }, scrub = null;
const pose = (s) => ({ x: s.k });
let frame = null;
function draw(p) {
  if (!seq || !p) return;
  frame = frameAt(seq, p.x);
  arch?.update(frame); handle?.update(frame.h); scrub?.set(p.x);
  if (ui && arch) ui.showParts(arch.visibleParts());
}
// the step the guide shows: the one being moved through, else the one whose move comes next
const shownStep = () => (moving !== null ? seq.moves[moving].step : Math.min(M.stepIndex(state), seq.steps.length - 1));
function refresh() {
  const next = M.nextAction(state), si = shownStep();
  ui.show({ stepIndex: si, next: next === null ? null : { id: next, label: seq.moves[M.index(next)].label }, locks: M.locksAt(moving ?? state.k),
    canUndo: history.length > 0 });
  // the cameras go back to a preset only when the framing changes (a new step, a new control): a view the user turned
  // or zoomed stays put through the moves of a step, as on Closure
  const st = seq.steps[si], V = seq.views, key = V.archFor[st.id], pr = V.arch[key];
  if (av && key !== archKey) { archKey = key; av.setPreset({ target: pr.target, dir: pr.dir || V.dir, radius: pr.radius }); }
  const focus = moving !== null ? seq.moves[moving] : next !== null ? seq.moves[M.index(next)] : null;
  if (handle) {
    handle.focus(focus);
    const hk = `${focus?.control || ''}:${Math.round(frame?.h?.[0] || 0)}`;
    if (hk !== handleKey) { handleKey = hk; hv.setPreset(handle.preset(focus?.control || null)); }
  }
  if (picked) { picked = null; ui.pick(null); arch?.glow(null); }
}
let running = Promise.resolve();
function work() {
  if (working) return running;
  working = true;
  running = (async () => {
    while (queue.length) {
      const a = queue.shift();
      if (!M.available(state).includes(a)) continue;
      history.push(state); state = M.apply(state, a); moving = M.index(a); refresh();
      await anim.to(pose(state), M.duration(a));
      moving = null; refresh();
    }
    working = false;
  })();
  return running;
}
const act = (a) => { queue.push(a); return work(); };
let pace = 1;                                                  // ?debug: the tests shorten the pauses
const player = createPlayer({
  next: () => (M ? M.nextAction(state) : null),
  stepIndex: () => M.stepIndex(state),
  words: () => { const s = seq.steps[M.stepIndex(state)]; return s ? [s.text, s.cue].filter(Boolean).join(' ') : ''; },
  perform: (a) => act(a),
  wait: (ms) => new Promise((r) => setTimeout(r, ms * pace)),
  onChange: (on) => ui?.playing(on),
});
function togglePlay() {
  if (!player.playing() && M && M.nextAction(state) === null) restart();   // at the end: again from the start
  return player.toggle();
}
function settleNow() { player.stop(); queue = []; anim.finish(); moving = null; }
// Undo, Restart and a jump put both cameras back on their preset, as on Closure
const resetViews = () => { archKey = handleKey = null; };
function undo() { settleNow(); if (!history.length) return; state = history.pop(); anim.set(pose(state)); resetViews(); refresh(); }
function restart() { settleNow(); history = []; state = M.initialState(); anim.set(pose(state)); resetViews(); refresh(); }
function jump(i) {
  settleNow(); const k = M.startOf(i), h = [];
  for (let j = 0; j < k; j++) h.push({ k: j });
  history = h; state = { k }; anim.set(pose(state)); resetViews(); refresh();
}
// the scrub bar: dragging runs the sequence to that point (the guide follows); letting go settles on the nearest move
const pastTo = (k) => Array.from({ length: k }, (_, j) => ({ k: j }));
function scrubTo(x) {
  player.stop(); queue = []; if (anim.busy()) anim.finish();
  const k = Math.min(Math.floor(x), M.count);
  state = { k }; history = pastTo(k); moving = x < M.count && x - k > 1e-6 ? k : null;
  anim.set({ x }); refresh();
}
function scrubEnd(x) {
  const k = Math.min(Math.max(Math.round(x), 0), M.count);
  player.stop(); queue = []; moving = null; state = { k }; history = pastTo(k);
  anim.set({ x: k }); refresh();
}
function pickPart(id) {
  picked = picked === id ? null : id; ui.pick(picked); arch?.glow(picked);
}

async function boot() {
  gl = webglOK();
  anim = createAnimator({ reduced: () => !gl || reducedMotion(), onFrame: draw });   // no WebGL: moves land at once
  const [data, archModel, handleModel] = await Promise.all([
    fetchOK('data/sequence.json').then((r) => r.json()),
    gl ? loadGLB('arch.glb') : null, gl ? loadGLB('handle.glb') : null]);
  seq = decode(data); M = createMachine(seq);
  ui = createUI({ steps: seq.steps, label: (i) => stepLabel(seq.steps, i), done: seq.steps[seq.steps.length - 1] }, {
    onAction: (a) => { player.stop(); return act(a); }, onPlay: togglePlay, onUndo: undo, onRestart: restart, onJump: jump,
    onExpand: (id) => { ui.expand(id); av?.resize(); hv?.resize(); }, onPick: pickPart });
  ui.setParts(PARTS);
  const SHORT = { Position: 'Position', Deployment: 'Deployment', 'During TAVR': 'TAVR', Retrieval: 'Retrieval', 'On the table': 'Table' };
  scrub = createScrubber(document.querySelector('#scrub'), { onScrub: scrubTo, onRelease: scrubEnd,
    text: (x) => { const i = Math.min(M.stepIndex({ k: Math.min(Math.floor(x), M.count) }), seq.steps.length - 1);
      return `${stepLabel(seq.steps, i)}: ${seq.steps[i].title}`; } });
  scrub.setMarks(M.count, seq.steps.map((st, i) => ({ at: M.startOf(i),
    group: i === 0 || seq.steps[i - 1].group !== st.group ? SHORT[st.group] || st.group : null })));
  if (gl) {
    const pr = pixelRatio();
    av = createView(THREE, document.querySelector('#arch canvas'), { pixelRatio: pr });
    hv = createView(THREE, document.querySelector('#handle canvas'), { pixelRatio: pr });
    arch = createArch(THREE, av, archModel, seq, document.querySelector('#arch .labels'));
    handle = createHandle(THREE, hv, handleModel);
    // the handle's framing depends on its window's shape: refit it when the window changes (unless the user moved it)
    const ro = new ResizeObserver(() => { av.resize(); hv.resize(); if (!hv.userMoved) hv.fit(handle.preset(handle.focused()?.control || null)); });
    ro.observe(document.querySelector('#arch')); ro.observe(document.querySelector('#handle'));
    av.resize(); hv.resize();
    let last = performance.now();
    // the lit control's pulse only while the Handle window is on screen (and never with reduced motion)
    new IntersectionObserver((es) => { handleOnScreen = es[0].isIntersecting; }).observe(document.querySelector('#handle'));
    const loop = (now) => {
      anim.tick(now); handle.tick((now - last) / 1000, { reduced: reducedMotion(), visible: handleOnScreen }); last = now;
      if (av.frame(now)) { arch.placeLabels(); renders.arch++; }
      if (hv.frame(now)) renders.handle++;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else {
    for (const w of document.querySelectorAll('.win')) {
      w.classList.add('no-webgl');
      const n = document.createElement('p'); n.className = 'notice'; n.textContent = 'This view needs WebGL, which this browser has turned off.'; w.appendChild(n);
    }
  }
  state = M.initialState(); anim.set(pose(state)); refresh();
  if (gl) { av.fit(av.preset); hv.fit(hv.preset); }

  window.__sentinel = { ready: true };
  if (debug) Object.assign(window.__sentinel, {
    state: () => state, x: () => anim.pose.x, moves: () => seq.moves.length, steps: () => seq.steps.map((s) => s.id),
    stepIndex: () => M.stepIndex(state), shownStep, busy: () => working || anim.busy(), playing: () => player.playing(),
    pace: (k) => { pace = k; }, act, undo, restart, jump, next: () => M.nextAction(state),
    instant: (k) => { settleNow(); state = { k }; history = Array.from({ length: k }, (_, j) => ({ k: j })); anim.set(pose(state)); resetViews(); refresh(); },
    renders: () => ({ ...renders }),
    frame: () => { const G = geometry(seq, frame); return { tab: G.tab, tubes: G.tab ? [] : Object.keys(G.tubes),
      filters: G.tab ? [] : ['ph', 'pb', 'dh', 'db'].filter((k) => G[k]), debris: G.tab ? 0 : G.debris.length, h: frame.h }; },
    focus: () => handle?.focused()?.control || null, parts: () => arch?.visibleParts() || [],
    stats: () => [av, hv].map((v) => v ? pixelStats(v) : null),
    camera: (w) => { const v = w === 'handle' ? hv : av; return v ? { target: v.controls.target.toArray(), pos: v.camera.position.toArray() } : null; },
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

boot().catch((e) => { console.error(e); window.__sentinel = { ready: true, error: String(e) }; });
