// Compare (design §4.2): two techniques' results side by side in the same view, turning together; stacked on a phone. Each
// pane is one of the page's own 3D views (engine/view.js) drawing one result through render/cut.js — the same wall, struts,
// End view and Layers as the result after the last step. Whichever pane was grabbed last leads: the other copies its camera
// (position and target, so zoom too) on every change, and again after a resize. Without WebGL, or if a pane cannot draw,
// each pane still names its technique and lists its numbers.
const PRESET = (v) => (v === 'end' ? 'end' : 'core');

export async function createCompare(root, { gl, THREE, createView, createCut, ctx, models, step, pixelRatio }) {
  const panes = [...root.querySelectorAll('.cmp-pane')].map((el) => ({ el, win: el.querySelector('.cmp-win'), canvas: el.querySelector('canvas'),
    label: el.querySelector('.win-label'), legend: el.querySelector('.legend'), key: el.querySelector('.gap-key'), list: el.querySelector('.final'),
    view: null, cut: null, map: null, shown: null }));
  const notice = (p, text) => { p.win.classList.add('no-webgl'); const n = document.createElement('p'); n.className = 'notice'; n.textContent = text; p.win.appendChild(n); };
  let view = 'cut', leader = null;
  for (const p of panes) {
    if (!gl) { notice(p, 'This view needs WebGL, which this browser has turned off.'); continue; }
    try { p.view = createView(THREE, p.canvas, { pixelRatio }); p.cut = await createCut(p.view, ctx, models, { step }); }
    catch (e) { console.warn(e); p.view = null; p.cut = null; notice(p, 'This view could not be drawn on this device.'); }
  }
  const live = () => panes.filter((p) => p.cut);
  // the follower takes the leader's camera; a follower still coasting from its own drag stops first (OrbitControls clears its
  // damping when an update runs without damping)
  const follow = (from, to) => { const c = to.view.controls;
    to.view.camera.position.copy(from.view.camera.position); c.target.copy(from.view.controls.target);
    c.enableDamping = false; c.update(); c.enableDamping = true; to.view.markDirty(); };
  // OrbitControls reports a move only once it passes its own epsilon (1e-3 mm), so a leader still coasting from a drag can creep
  // ahead of its follower unreported: each frame the follower is checked against it
  const apart = (a, b) => a.view.camera.position.distanceToSquared(b.view.camera.position) > 1e-18 || a.view.controls.target.distanceToSquared(b.view.controls.target) > 1e-18;
  // on a phone a vertical swipe on a pane scrolls the page and a sideways drag turns both (OrbitControls sets touch-action
  // none on its canvas, inline, so it is set here)
  const narrow = matchMedia('(max-width: 700px)'), touch = () => { for (const p of live()) p.canvas.style.touchAction = narrow.matches ? 'pan-y' : 'none'; };
  narrow.addEventListener?.('change', touch);
  for (const p of live()) {
    p.view.controls.addEventListener('start', () => { leader = p; for (const q of live()) if (q !== p) follow(p, q); });
    p.view.controls.addEventListener('change', () => { if (leader === p) for (const q of live()) if (q !== p) follow(p, q); });
    p.view.resize(); p.view.fit(p.cut.presetFor(PRESET(view)));
  }
  touch();

  // one result in pane i: its name, its numbers, its drawing (and the plain T's bare heel shaded, with its key)
  function setPane(i, { id, label, done, map, lines, gap = 0 }) {
    const p = panes[i];
    p.label.textContent = label; p.list.textContent = '';
    for (const t of lines) { const li = document.createElement('li'); li.textContent = t; p.list.appendChild(li); }
    p.key.hidden = !(gap > 0); p.map = map; p.shown = id;
    if (p.cut) { p.cut.update(done); p.cut.markGap(gap); p.cut.setView(view, map); }
  }
  // both panes on the same view, and that view's camera
  function setView(v) {
    view = v;
    for (const p of panes) {
      p.legend.hidden = v !== 'layers' || !p.cut;
      if (!p.cut) continue;
      p.cut.setView(v, p.map); p.view.setPreset(p.cut.presetFor(PRESET(v)));
    }
  }
  function frame(now) {
    if (leader) { leader.view.frame(now); for (const q of live()) if (q !== leader) { if (apart(leader, q)) follow(leader, q); q.view.frame(now); } }
    else for (const p of live()) p.view.frame(now);
  }
  function resize() { for (const p of live()) p.view.resize(); if (leader) for (const q of live()) if (q !== leader) follow(leader, q); }
  // spread of the rendered pixels of pane i, and how many pixels are the bare-heel shading's violet (for the tests)
  function read(i) {
    const p = panes[i]; if (!p.cut) return null;
    p.view.markDirty(); p.view.frame();
    const g = p.view.renderer.getContext(), w = g.drawingBufferWidth, h = g.drawingBufferHeight, px = new Uint8Array(w * h * 4);
    g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px);
    return { w, h, px };
  }
  function stats(i) {
    const r = read(i); if (!r) return null; const vals = [];
    for (let a = 1; a < 16; a++) for (let b = 1; b < 16; b++) { const k = (Math.floor(r.h * b / 16) * r.w + Math.floor(r.w * a / 16)) * 4; vals.push(0.299 * r.px[k] + 0.587 * r.px[k + 1] + 0.114 * r.px[k + 2]); }
    const mean = vals.reduce((x, y) => x + y, 0) / vals.length;
    return { mean, sd: Math.sqrt(vals.reduce((x, y) => x + (y - mean) ** 2, 0) / vals.length) };
  }
  function violet(i) {
    const r = read(i); if (!r) return 0; let c = 0;
    for (let k = 0; k < r.px.length; k += 4) if (r.px[k] > r.px[k + 1] + 15 && r.px[k + 2] > r.px[k + 1] + 30) c++;
    return c;
  }
  const debug = () => ({ ready: true, view, shown: panes.map((p) => p.shown), cams: live().map((p) => [p.view.camera.position.toArray(), p.view.controls.target.toArray()]),
    counts: panes.map((p) => p.cut?.layerCounts() || []), gap: panes.map((p) => p.cut?.gapShown() || 0) });
  return { setPane, setView, frame, resize, debug, stats, violet };
}
