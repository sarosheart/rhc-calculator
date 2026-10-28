// "Real angiogram near this angle": the CARDIAG key frame nearest the current C-arm angle for the injected artery, its
// recorded angle and how far that is from here, the next nearest on Farther (or a swipe), the experts' SYNTAX outlines on
// demand (tap one to select that segment), and Go to this angle. Nothing loads until the panel is shown (setActive), and
// only the newest request for a frame is ever drawn, so a slow frame cannot land over a newer one.
import { rankFrames, segmentAt, labelPoint } from './cardiag.js';
import { angleName } from './geometry.js';

const RIGHT = /^(1|2|3|4|16[a-c]?)$/;                     // CARDIAG's right-coronary segments; the rest are left
const COL = { left: '240,166,58', right: '90,169,255' };   // the page's family colours (amber left, blue right)
const FAR = 15;                                            // degrees: beyond this, say no frame was taken near here

// load: { index() → {frames}, overlays() → {frames: {id: {seg: polys}}}, image(file) → Blob }; has(seg): this heart shows it
export function mountReal(root, state, { load, has = () => true, onGo = () => {}, onPick = () => {} }) {
  root.innerHTML = `<div class="real-box" data-role="real-box">
      <img data-role="real-img" alt="" draggable="false">
      <canvas data-role="real-outlines" aria-hidden="true"></canvas>
      <p class="real-msg" data-role="real-msg" role="status"></p>
    </div>
    <div class="real-tools" role="group" aria-label="Real angiogram">
      <button type="button" class="tool-btn small" data-role="real-nearer">‹ Nearer</button>
      <button type="button" class="tool-btn small" data-role="real-farther">Farther ›</button>
      <button type="button" class="tool-btn small" data-role="real-outlines-btn" aria-pressed="false">Outlines</button>
      <button type="button" class="tool-btn small" data-role="real-go">Go to this angle</button>
    </div>
    <p class="real-caption" data-role="real-caption"></p>
    <p class="real-note">A real key frame from the CARDIAG dataset (Lau et al. 2026, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>), from a different patient, so the
      branches differ in detail. Swipe or use Farther for the next nearest. Outlines are the dataset's expert SYNTAX labels.</p>`;
  const $ = (r) => root.querySelector(`[data-role="${r}"]`);
  const box = $('real-box'), img = $('real-img'), cv = $('real-outlines'), msg = $('real-msg'), cap = $('real-caption');
  const nearer = $('real-nearer'), farther = $('real-farther'), olBtn = $('real-outlines-btn'), go = $('real-go');

  let active = false, frames = null, loading = null, list = [], k = 0, key = '', seq = 0, url = null;
  let shown = null, outlinesOn = false, overlays = null, olLoading = null;
  const say = (t) => { msg.textContent = t; msg.hidden = !t; };
  say('');

  function load_() {
    if (frames || loading) return;
    say('Loading the real angiograms…');
    loading = load.index().then(j => { frames = j.frames; loading = null; say(''); update(state.get()); })
      .catch(() => { loading = null; say('The real angiograms could not load. Check the connection; they will try again when shown.'); });
  }
  function update(s) {
    if (!active || !frames) return;
    const kk = `${s.lao}|${s.cra}|${s.sys}`;
    if (kk !== key) { key = kk; list = rankFrames(frames, s.lao, s.cra, s.sys); k = 0; }
    const want = list[k]; if (!want) return;
    // already on screen: cancel any frame still loading (it was asked for before the reader came back to this one)
    if (shown && shown.frame.id === want.frame.id) { ++seq; shown = want; caption(); draw(); return; }
    const my = ++seq;
    load.image(want.frame.file).then(blob => {
      if (my !== seq) return;                               // a newer frame was asked for while this one loaded
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob); img.src = url; img.dataset.id = want.frame.id;
      img.alt = `Real coronary angiogram, ${want.frame.side} coronary, ${angleName(want.frame.lao, want.frame.cra)}`;
      shown = want; say(''); caption(); draw();
    }).catch(() => { if (my === seq) say('This frame could not load. Check the connection.'); });
  }
  function caption() {
    const f = shown.frame, d = shown.dist, n = list.length;
    const far = list[0] && list[0].dist > FAR ? ` No frame in this set was taken within ${FAR}° of this angle.` : '';
    cap.innerHTML = `<strong>${angleName(f.lao, f.cra)}</strong> · ${d < 1 ? 'at this angle' : `${Math.round(d)}° from this angle`} · ${f.side} coronary` +
      ` · ${k + 1} of ${n} by distance.${far}`;
    nearer.disabled = k === 0; farther.disabled = k >= n - 1;
  }
  // the outlines, scaled from the 512-px frame to the box; the selected segment heavier; segment numbers on top
  let highlighted = null;
  function draw() {
    const w = box.clientWidth, dpr = Math.min(window.devicePixelRatio || 1, 2), px = Math.round(w * dpr);
    if (cv.width !== px) cv.width = cv.height = px;
    const g = cv.getContext('2d'); g.clearRect(0, 0, px, px); highlighted = null;
    const ov = outlinesOn && overlays && shown ? overlays[shown.frame.id] : null; if (!ov) return;
    const sc = px / 512, sel = state.get().sel;
    g.lineJoin = 'round';
    for (const [seg, polys] of Object.entries(ov)) {
      const c = COL[RIGHT.test(seg) ? 'right' : 'left'], on = seg === sel; if (on) highlighted = seg;
      for (const p of polys) {
        g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x * sc, y * sc) : g.moveTo(x * sc, y * sc))); g.closePath();
        g.fillStyle = `rgba(${c},${on ? 0.42 : 0.16})`; g.fill();
        g.strokeStyle = on ? '#ffe2b0' : `rgba(${c},0.95)`; g.lineWidth = (on ? 3 : 1.4) * dpr; g.stroke();
      }
    }
    g.font = `700 ${Math.round(11 * dpr)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [seg, polys] of Object.entries(ov)) {
      const [x, y] = labelPoint(polys), t = seg, tw = g.measureText(t).width + 8 * dpr, th = 15 * dpr;
      g.fillStyle = seg === sel ? '#f0a63a' : 'rgba(11,19,34,.82)'; g.beginPath(); g.roundRect?.(x * sc - tw / 2, y * sc - th / 2, tw, th, th / 2); g.fill();
      g.fillStyle = seg === sel ? '#111' : '#fff'; g.fillText(t, x * sc, y * sc + dpr * 0.5);
    }
  }
  function setOutlines(on) {
    outlinesOn = on; olBtn.setAttribute('aria-pressed', String(on));
    if (on && !overlays && !olLoading) olLoading = load.overlays().then(j => { overlays = j.frames; olLoading = null; draw(); })
      .catch(() => { olLoading = null; outlinesOn = false; olBtn.setAttribute('aria-pressed', 'false'); say('The outlines could not load. Check the connection and try again.'); });
    draw();
  }
  const step = (dk) => { const n = k + dk; if (!list[n]) return; k = n; update(state.get()); };
  nearer.addEventListener('click', () => step(-1));
  farther.addEventListener('click', () => step(1));
  olBtn.addEventListener('click', () => setOutlines(!outlinesOn));
  go.addEventListener('click', () => { if (shown) onGo(shown.frame); });
  // a sideways swipe steps through the frames; a tap on an outline selects that segment (when this heart has it)
  let down = null;
  box.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  box.addEventListener('pointerup', (e) => {
    if (!down) return; const dx = e.clientX - down.x, dy = e.clientY - down.y; down = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { step(dx < 0 ? 1 : -1); return; }
    if (Math.hypot(dx, dy) > 8 || !outlinesOn || !overlays || !shown) return;
    const b = box.getBoundingClientRect(), seg = segmentAt(overlays[shown.frame.id] || {}, (e.clientX - b.left) * 512 / b.width, (e.clientY - b.top) * 512 / b.height);
    if (seg && has(seg)) { say(''); onPick(seg); } else if (seg) say(`Segment ${seg} is not shown in this heart.`);
  });
  box.addEventListener('pointercancel', () => { down = null; });

  const unsub = state.subscribe((s) => { update(s); if (outlinesOn) draw(); });
  return {
    setActive(on) { active = on; if (on) { load_(); update(state.get()); draw(); } },
    debug: () => ({ ready: !!frames, id: shown?.frame.id ?? null, dist: shown?.dist ?? null, k, n: list.length, outlines: outlinesOn && !!overlays, highlighted }),
    dispose() { unsub(); if (url) URL.revokeObjectURL(url); root.replaceChildren(); },
  };
}
