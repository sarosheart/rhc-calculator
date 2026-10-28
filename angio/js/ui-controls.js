// The C-arm controls: rotation ruler (RAO 120 … LAO 120), angulation scale (CAU 50 … CRA 50), typed angles, arrow keys,
// the standard-view cards and the Left / Right / Both switch. Every control writes ONLY through state.set and redraws
// from state.subscribe, so a shared link, a key press and a drag all land on the same picture.
// Nothing is hover-only: the scales take drag, tap and keys; the cards are buttons.
import { angleName } from './geometry.js';

const ROT = [-120, 120], ANG = [-50, 50];
const rotText = (a) => { const r = Math.round(a); return r === 0 ? 'AP 0°' : (r > 0 ? `LAO ${r}°` : `RAO ${-r}°`); };
const angText = (b) => { const r = Math.round(b); return r === 0 ? '0°' : (r > 0 ? `CRA ${r}°` : `CAU ${-r}°`); };
const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === 'class' ? (e.className = v) : k === 'text' ? (e.textContent = v) : e.setAttribute(k, v);
  e.append(...kids); return e; };

// "LAO 45", "rao30", "-30", "45" → signed degrees (LAO/CRA positive); null for anything else
export function parseAngle(str, pos, neg) {
  const m = String(str).trim().toUpperCase().match(/^([A-Z]+)?\s*([+-]?\d+(?:\.\d+)?)\s*°?$/);
  if (!m) return null;
  const x = Number(m[2]); if (!Number.isFinite(x)) return null;
  if (!m[1]) return x;
  if (m[1] === pos) return Math.abs(x);
  if (m[1] === neg) return -Math.abs(x);
  if (m[1] === 'AP' || m[1] === 'STRAIGHT') return x === 0 ? 0 : null;
  return null;
}

// A draggable scale. Horizontal or vertical is read from its own box (wider than tall → horizontal), so the same control
// becomes a horizontal bar under the ruler on a phone by CSS alone. Value grows to the right / upward.
function scale({ role, label, range, ticks, labels, text, onValue }) {
  const track = el('div', { class: 'scale-track', 'data-role': role, role: 'slider', tabindex: '0', 'aria-label': label,
    'aria-valuemin': String(range[0]), 'aria-valuemax': String(range[1]) });
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('class', 'scale-ticks'); svg.setAttribute('aria-hidden', 'true');
  const thumb = el('div', { class: 'scale-thumb', 'aria-hidden': 'true' });
  track.append(svg, thumb);
  const horiz = () => track.clientWidth >= track.clientHeight;
  const frac = (v) => (v - range[0]) / (range[1] - range[0]);
  function drawTicks() {
    const w = track.clientWidth, h = track.clientHeight; if (!w || !h) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.replaceChildren();
    const H = horiz(), len = H ? w : h;
    const at = new Set(); for (let v = range[0]; v <= range[1]; v += ticks) at.add(v);
    for (const l of labels) { at.add(l); at.add(-l); }                       // labelled angles need not be tick multiples (45)
    for (const v of [...at].filter(v => v >= range[0] && v <= range[1]).sort((a, b) => a - b)) {
      const t = frac(v) * len, big = labels.includes(Math.abs(v)), q = H ? t : len - t;
      const ln = document.createElementNS(svgNS, 'line');
      const cross = H ? h : w, a = big ? 0.15 : 0.32, b = big ? 0.62 : 0.5;
      if (H) { ln.setAttribute('x1', q); ln.setAttribute('x2', q); ln.setAttribute('y1', cross * a); ln.setAttribute('y2', cross * b); }
      else { ln.setAttribute('y1', q); ln.setAttribute('y2', q); ln.setAttribute('x1', cross * a); ln.setAttribute('x2', cross * b); }
      ln.setAttribute('class', big ? 'tick big' : 'tick'); svg.append(ln);
      if (big) { const tx = document.createElementNS(svgNS, 'text'); tx.textContent = text(v, true);
        if (H) { const edge = q < 24 ? 'start' : q > w - 24 ? 'end' : 'middle';      // end labels sit inside the bar
          tx.setAttribute('x', edge === 'start' ? 4 : edge === 'end' ? w - 4 : q); tx.setAttribute('y', cross * 0.92); tx.setAttribute('text-anchor', edge); }
        else { tx.setAttribute('x', cross * 0.6); tx.setAttribute('y', Math.min(len - 3, Math.max(11, q + 4))); }
        tx.setAttribute('class', 'tick-label'); svg.append(tx); }
    }
  }
  function show(v) {
    const f = frac(v);
    if (horiz()) { thumb.style.left = `${f * 100}%`; thumb.style.top = ''; } else { thumb.style.top = `${(1 - f) * 100}%`; thumb.style.left = ''; }
    track.setAttribute('aria-valuenow', String(v)); track.setAttribute('aria-valuetext', text(v));
  }
  const valueAt = (e) => { const b = track.getBoundingClientRect();
    const f = horiz() ? (e.clientX - b.left) / b.width : 1 - (e.clientY - b.top) / b.height;
    return Math.round(range[0] + Math.min(1, Math.max(0, f)) * (range[1] - range[0])); };
  let dragging = null;
  track.addEventListener('pointerdown', (e) => { dragging = e.pointerId; track.setPointerCapture(e.pointerId); onValue(valueAt(e), true); e.preventDefault(); });
  track.addEventListener('pointermove', (e) => { if (dragging === e.pointerId) onValue(valueAt(e), true); });
  const end = (e) => { if (dragging === e.pointerId) { dragging = null; onValue(valueAt(e), false); } };
  track.addEventListener('pointerup', end); track.addEventListener('pointercancel', () => { dragging = null; });
  new ResizeObserver(() => { track.setAttribute('aria-orientation', horiz() ? 'horizontal' : 'vertical'); drawTicks(); show(Number(track.getAttribute('aria-valuenow') || 0)); }).observe(track);
  return { track, show };
}

export function mountControls(root, state, views, { sysRoot = null, onCard = () => {} } = {}) {
  const list = views.views || views;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let anim = 0;
  const stop = () => { cancelAnimationFrame(anim); anim = 0; };
  const manual = (patch) => { stop(); state.set({ ...patch, view: null }); };

  // ── rotation + angulation ──
  // no aria-live: these change every frame of a drag or a card animation; the sliders' aria-valuetext carries the angle
  const rotReadout = el('div', { class: 'readout', 'data-role': 'rot-readout' });
  const angReadout = el('div', { class: 'readout', 'data-role': 'ang-readout' });
  const ruler = scale({ role: 'ruler', label: 'C-arm rotation, RAO to LAO', range: ROT, ticks: 10, labels: [0, 45, 90],
    text: (v, short) => short ? (v === 0 ? 'AP' : (v > 0 ? `LAO ${v}` : `RAO ${-v}`)) : rotText(v), onValue: (v) => manual({ lao: v }) });
  let angul = null;
  angul = scale({ role: 'angulation', label: 'C-arm angulation, caudal to cranial', range: ANG, ticks: 10, labels: [0, 30, 50],
    text: (v, short) => short ? (horizAng() ? (v === 0 ? '0' : (v > 0 ? `CRA ${v}` : `CAU ${-v}`)) : String(Math.abs(v))) : angText(v), onValue: (v) => manual({ cra: v }) });
  const typed = (role, label, pos, neg, key) => {
    const inp = el('input', { type: 'text', inputmode: 'text', enterkeyhint: 'go', 'data-role': role, 'aria-label': label, autocomplete: 'off', spellcheck: 'false', class: 'angle-input' });
    const apply = () => { const x = parseAngle(inp.value, pos, neg);
      if (x === null) { if (inp.value.trim()) inp.setAttribute('aria-invalid', 'true'); return false; }
      inp.removeAttribute('aria-invalid'); manual({ [key]: Math.round(x * 2) / 2 }); return true; };
    inp.addEventListener('input', () => inp.removeAttribute('aria-invalid'));
    // iOS "Done" (and Tab) leave the field without Enter: a valid entry still applies, then the box clears
    inp.addEventListener('blur', () => { apply(); inp.removeAttribute('aria-invalid'); inp.value = ''; });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') apply(); });
    return inp;
  };
  const rotIn = typed('rot-input', 'Type a rotation, e.g. LAO 45 or RAO 30, then press Enter', 'LAO', 'RAO', 'lao');
  const angIn = typed('ang-input', 'Type an angulation, e.g. CRA 30 or CAU 20, then press Enter', 'CRA', 'CAU', 'cra');
  const rotBox = el('div', { class: 'ctl-rot' }, el('div', { class: 'readout-k', text: 'Rotation' }),
    el('div', { class: 'readout-row' }, rotReadout, rotIn), ruler.track);
  const horizAng = () => !!angul && angul.track.clientWidth >= angul.track.clientHeight;
  const angBox = el('div', { class: 'ctl-ang' }, el('div', { class: 'readout-k', text: 'Angulation' }),
    el('div', { class: 'readout-row' }, angReadout, angIn),
    el('div', { class: 'ang-end', 'aria-hidden': 'true', text: 'CRA' }), angul.track, el('div', { class: 'ang-end', 'aria-hidden': 'true', text: 'CAU' }));

  // ── system switch ──
  const sysBtns = ['left', 'right', 'both'].map(k => {
    const b = el('button', { type: 'button', class: 'seg', 'data-sys': k, 'aria-pressed': 'false', text: k[0].toUpperCase() + k.slice(1) });
    b.addEventListener('click', () => state.set({ sys: k })); return b; });
  const sysBox = el('div', { class: 'ctl-sys', role: 'group', 'aria-label': 'Coronary system shown' }, ...sysBtns);

  // ── view cards ──
  function go(v) {
    const sys = v.side === 'right' ? 'right' : (state.get().sys === 'both' ? 'both' : 'left');
    stop(); state.set({ sys, view: v.id });
    const s0 = state.get(), a0 = s0.lao, b0 = s0.cra, t0 = performance.now();
    if (reduced()) { state.set({ lao: v.lao, cra: v.cra }); return; }
    const step = (t) => { const f = Math.min(1, (t - t0) / 400), e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
      state.set({ lao: a0 + (v.lao - a0) * e, cra: b0 + (v.cra - b0) * e });
      anim = f < 1 ? requestAnimationFrame(step) : 0; };
    anim = requestAnimationFrame(step);
  }
  const cards = new Map();
  const group = (title, side) => el('section', { class: 'view-group', 'aria-label': title }, el('h3', { text: title }),
    el('div', { class: 'view-cards' }, ...list.filter(v => (v.side === 'right') === (side === 'right')).map(v => {
      const b = el('button', { type: 'button', class: 'view-card', 'data-view': v.id, 'aria-pressed': 'false' },
        el('span', { class: 'vc-name', text: v.name }), el('span', { class: 'vc-angle', text: angleName(v.lao, v.cra) }));
      b.addEventListener('click', () => { onCard(v.id); go(v); }); cards.set(v.id, { b, v }); return b; })));
  const viewBox = el('div', { class: 'ctl-views' }, group('Left coronary', 'left'), group('Right coronary', 'right'));

  // the system switch can live elsewhere (under the angiogram on the full page)
  if (sysRoot) { sysRoot.replaceChildren(sysBox); root.replaceChildren(el('div', { class: 'ctl-angles' }, rotBox, angBox), viewBox); }
  else root.replaceChildren(el('div', { class: 'ctl-angles' }, rotBox, angBox), sysBox, viewBox);

  // ── keys: anywhere except text entry ──
  const app = root.closest('.app') || root;
  const onKey = (e) => {
    const t = e.target; if (t && (t.closest?.('input, textarea, select, [contenteditable="true"]'))) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const d = e.shiftKey ? 5 : 1, s = state.get();
    // a focused scale takes the arrows (and Home/End/PageUp/PageDown) for its OWN axis, whatever its orientation
    const own = t?.dataset?.role === 'ruler' ? ['lao', ROT] : t?.dataset?.role === 'angulation' ? ['cra', ANG] : null;
    if (own) {
      const [k, [lo, hi]] = own, v = s[k];
      const next = { ArrowRight: v + d, ArrowUp: v + d, ArrowLeft: v - d, ArrowDown: v - d, PageUp: v + 10, PageDown: v - 10, Home: lo, End: hi }[e.key];
      if (next === undefined) return;
      e.preventDefault(); manual({ [k]: next }); return;
    }
    // elsewhere: only while the app is on screen and the reader is not in the text below it — arrows scroll the About
    if (t && t !== document.body && !app.contains(t)) return;
    const r = app.getBoundingClientRect(); if (r.bottom < 80 || r.top > innerHeight - 80) return;
    const patch = { ArrowRight: { lao: s.lao + d }, ArrowLeft: { lao: s.lao - d }, ArrowUp: { cra: s.cra + d }, ArrowDown: { cra: s.cra - d } }[e.key];
    if (!patch) return;
    e.preventDefault(); manual(patch);
  };
  document.addEventListener('keydown', onKey);

  // ── state → controls ──
  function sync(s) {
    ruler.show(s.lao); angul.show(s.cra);
    rotReadout.textContent = rotText(s.lao); angReadout.textContent = angText(s.cra);
    if (document.activeElement !== rotIn) rotIn.value = ''; if (document.activeElement !== angIn) angIn.value = '';
    rotIn.placeholder = rotText(s.lao).replace('°', ''); angIn.placeholder = angText(s.cra).replace('°', '');
    sysBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sys === s.sys)));
    // highlight: the named view if it is still at its angle; otherwise any view of this system within 2°
    const near = [...cards.values()].filter(({ v }) => Math.abs(v.lao - s.lao) <= 2 && Math.abs(v.cra - s.cra) <= 2);
    const named = near.filter(({ v }) => v.id === s.view);
    const on = new Set((named.length ? named : near.filter(({ v }) => s.sys === 'both' || (v.side === 'right') === (s.sys === 'right'))).map(({ v }) => v.id));
    for (const [id, { b }] of cards) b.setAttribute('aria-pressed', String(on.has(id)));
  }
  const unsub = state.subscribe(sync); sync(state.get());
  return { stop, goTo(id) { const c = cards.get(id); if (c) go(c.v); }, dispose() { stop(); unsub(); document.removeEventListener('keydown', onKey); root.replaceChildren(); sysRoot?.replaceChildren(); } };
}
