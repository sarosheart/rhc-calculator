// The angle pad: the whole C-arm range as a plane (RAO 120 … LAO 120 across, CAU 50 … CRA 50 up). Dotted outlines are each
// standard view's usual range; soft shading is where the real angiograms in CARDIAG were taken; the dot is the current
// angle. With a segment selected, the plane is coloured by how well that segment is seen (green clean → red). Tap or drag
// anywhere to go there.
import { bestMap, bestAngle, segmentName, scoreColour } from './segments.js';

const L0 = -120, L1 = 120, C0 = -50, C1 = 50;
// The map and the best angle follow the variant on screen (dominance, ramus); a graft has its own map.
export function createPad(canvas, state, D, { caption, bestBtn, onUser = () => {} }) {
  const g = canvas.getContext('2d');
  let density = null, W = 0, H = 0, dpr = 1, raf = 0, mapCache = { key: null, m: null };
  const opts = (s) => ({ ramus: !!s.ramus });
  const mapFor = (s) => { const key = `${s.dom}|${s.ramus}|${s.sel}`; if (mapCache.key !== key) mapCache = { key, m: bestMap(D, s.dom, s.sel, opts(s)) }; return mapCache.m; };
  fetch('data/cardiag/density.json').then(r => r.ok ? r.json() : null).then(d => { density = d; schedule(); }).catch(() => {});

  // a zone's short label; "RCA" stays on with both systems shown, where "RAO cranial" would otherwise name two zones
  const zoneLabel = (z, sys) => (sys === 'both' ? z.name : z.name.replace(/^RCA /, '')).replace(' (spider)', '').replace(' (right lateral)', '');
  const X = (lao) => (lao - L0) / (L1 - L0) * W, Y = (cra) => (C1 - cra) / (C1 - C0) * H;
  const zones = () => D.views.views.map(v => {
    const pad = (r) => r[0] === r[1] ? [r[0] - 4, r[1] + 4] : [r[0] - 1, r[1] + 1];
    const [a, b] = pad(v.range.lao), [c, d] = pad(v.range.cra);
    return { id: v.id, name: v.name, side: v.side === 'right' ? 'right' : 'left', lao: [a, b], cra: [c, d] };
  });

  // labels: the pad's ink over a halo of its ground, so they read on any shading; each one drawn this frame is kept,
  // with its box in canvas pixels and its colour (for the legibility test)
  let drawn = [], ink = '#e8ecf2', halo = '#0b1322';
  function put(t, x, y) {
    g.save(); g.lineWidth = 3 * dpr; g.lineJoin = 'round'; g.strokeStyle = halo; g.setLineDash([]); g.strokeText(t, x, y); g.restore();
    g.fillStyle = ink; g.fillText(t, x, y);
    const m = g.measureText(t);
    drawn.push({ t, colour: g.fillStyle, x: x - m.actualBoundingBoxLeft, y: y - m.actualBoundingBoxAscent,
      w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight, h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent });
  }
  function draw() {
    raf = 0; const s = state.get();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth || 600, ch = canvas.clientHeight || 250;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    W = canvas.width; H = canvas.height;
    // the pad is a dark panel in both themes: its own colours (CSS --pad-*), not the page theme's
    const css = getComputedStyle(canvas), P = (k, d) => css.getPropertyValue(k).trim() || d;
    ink = P('--pad-ink', '#e8ecf2'); halo = P('--pad-halo', '#0b1322');
    const line = P('--pad-line', 'rgba(255,255,255,0.1)'), axis = P('--pad-axis', 'rgba(232,236,242,0.45)');
    g.clearRect(0, 0, W, H); drawn = [];
    // the segment map, or the real-angiogram density
    if (s.sel) {
      const m = mapFor(s);
      for (let j = 0; j < m.nC; j++) for (let i = 0; i < m.nL; i++) {
        const x = m.data[j * m.nL + i]; if (!(x >= 0)) continue;
        const lao = m.lao.min + i * m.lao.step, cra = m.cra.min + j * m.cra.step, [r, gg, b] = scoreColour(x);
        g.fillStyle = `rgba(${r},${gg},${b},0.75)`;
        g.fillRect(X(lao - m.lao.step / 2), Y(cra + m.cra.step / 2), X(m.lao.step) - X(0) + 0.5, Y(-m.cra.step) - Y(0) + 0.5);
      }
    } else if (density) {
      const sides = s.sys === 'both' ? ['left', 'right'] : [s.sys], gr = density.grid;
      const nL = Math.round((gr.lao.max - gr.lao.min) / gr.lao.step) + 1, nC = Math.round((gr.cra.max - gr.cra.min) / gr.cra.step) + 1;
      const sum = new Float32Array(nL * nC); let max = 0;
      for (const sd of sides) for (let j = 0; j < nC; j++) for (let i = 0; i < nL; i++) { sum[j * nL + i] += density.counts[sd][j][i]; max = Math.max(max, sum[j * nL + i]); }
      for (let j = 0; j < nC; j++) for (let i = 0; i < nL; i++) {
        const c = sum[j * nL + i]; if (!c) continue;
        const lao = gr.lao.min + i * gr.lao.step, cra = gr.cra.min + j * gr.cra.step;
        g.fillStyle = `rgba(110,176,247,${(0.12 + 0.5 * Math.sqrt(c / max)).toFixed(3)})`;
        g.fillRect(X(lao - gr.lao.step / 2), Y(cra + gr.cra.step / 2), X(gr.lao.step) - X(0) + 0.5, Y(-gr.cra.step) - Y(0) + 0.5);
      }
    }
    // grid
    g.strokeStyle = line; g.lineWidth = dpr; g.font = `${11 * dpr}px system-ui, sans-serif`;
    for (let l = -90; l <= 90; l += 30) { g.beginPath(); g.moveTo(X(l), 0); g.lineTo(X(l), H); g.stroke(); }
    for (let c = -45; c <= 45; c += 15) { g.beginPath(); g.moveTo(0, Y(c)); g.lineTo(W, Y(c)); g.stroke(); }
    g.strokeStyle = axis; g.beginPath(); g.moveTo(X(0), 0); g.lineTo(X(0), H); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.stroke();
    g.textBaseline = 'bottom'; g.textAlign = 'center';
    for (const [l, t] of [[-90, 'RAO 90'], [-45, 'RAO 45'], [0, 'AP'], [45, 'LAO 45'], [90, 'LAO 90']]) put(t, X(l), H - 3 * dpr);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    for (const [c, t] of [[30, 'CRA 30'], [-30, 'CAU 30']]) put(t, 4 * dpr, Y(c) - 7 * dpr);
    // standard-view zones: the shown system's outlined and labelled, the other system's faint
    g.setLineDash([3 * dpr, 3 * dpr]);
    for (const z of zones()) {
      const mine = s.sys === 'both' || z.side === s.sys;
      g.strokeStyle = mine ? 'rgba(232,236,242,0.85)' : 'rgba(154,163,179,0.3)'; g.lineWidth = (mine ? 1.3 : 1) * dpr;
      const xa = X(z.lao[0]), xb = X(z.lao[1]), ya = Y(z.cra[1]), yb = Y(z.cra[0]);
      const x = Math.min(xa, xb), y = Math.min(ya, yb), w = Math.abs(xb - xa), h = Math.abs(yb - ya);
      g.beginPath(); g.roundRect(x, y, w, h, Math.min(w, h) / 2.5); g.stroke();
      if (mine && !s.sel) { g.textAlign = 'center'; g.textBaseline = 'bottom';
        put(zoneLabel(z, s.sys), x + w / 2, y - 2 * dpr); }
    }
    g.setLineDash([]);
    // current angle
    const cx = X(s.lao), cy = Y(s.cra);
    g.fillStyle = 'rgba(240,166,58,0.3)'; g.beginPath(); g.arc(cx, cy, 10 * dpr, 0, 7); g.fill();
    g.fillStyle = '#f0a63a'; g.strokeStyle = '#111'; g.lineWidth = 1.5 * dpr; g.beginPath(); g.arc(cx, cy, 5 * dpr, 0, 7); g.fill(); g.stroke();

    canvas.setAttribute('aria-label', `Angle pad: the current angle is marked. ${s.sel ? `Shaded by how well ${segmentName(D.views, s.sel)} is seen.` : ''} Tap or drag to change the angle.`);
    if (caption) caption.textContent = s.sel
      ? `Shaded: where ${segmentName(D.views, s.sel)} is seen best — green clean, amber 25%, red foreshortened or overlapped by half or more.`
      : `Blue shading: where ${density ? `the ${(s.sys === 'both' ? ['left', 'right'] : [s.sys]).reduce((t, k) => t + density.n[k], 0)}` : 'the'} real angiogram frames of a published dataset were taken. Dotted outlines: each standard view's usual range. Select a segment to see where it is seen best.`;
    if (bestBtn) bestBtn.hidden = !s.sel || !bestAngle(D, s.dom, s.sel, opts(s));
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };

  const angleAt = (e) => { const b = canvas.getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), fy = Math.min(1, Math.max(0, (e.clientY - b.top) / b.height));
    return { lao: Math.round(L0 + fx * (L1 - L0)), cra: Math.round(C1 - fy * (C1 - C0)) }; };
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { onUser(); drag = e.pointerId; canvas.setPointerCapture(e.pointerId); state.set({ ...angleAt(e), view: null }); e.preventDefault(); });
  canvas.addEventListener('pointermove', (e) => { if (drag === e.pointerId) state.set({ ...angleAt(e), view: null }); });
  canvas.addEventListener('pointerup', () => { drag = null; }); canvas.addEventListener('pointercancel', () => { drag = null; });
  bestBtn?.addEventListener('click', () => { onUser(); const s = state.get(); if (!s.sel) return; const b = bestAngle(D, s.dom, s.sel, opts(s)); if (b) state.set({ lao: b.lao, cra: b.cra, view: null }); });
  state.subscribe(schedule); new ResizeObserver(schedule).observe(canvas); draw();

  return {
    // for tests: CSS-pixel position of an angle; zone list; the map's best/worst cells; the drawn colour at an angle
    toScreen(lao, cra) { const b = canvas.getBoundingClientRect(); return { x: b.left + (lao - L0) / (L1 - L0) * b.width, y: b.top + (C1 - cra) / (C1 - C0) * b.height }; },
    zones, zoneLabels() { const s = state.get(); return zones().map(z => zoneLabel(z, s.sys)); },
    cells() { const m = mapFor(state.get()), out = [];
      for (let j = 0; j < m.nC; j++) for (let i = 0; i < m.nL; i++) { const x = m.data[j * m.nL + i]; if (x >= 0) out.push({ lao: m.lao.min + i * m.lao.step, cra: m.cra.min + j * m.cra.step, score: x }); }
      return out; },
    best() { const s = state.get(); return bestAngle(D, s.dom, s.sel, opts(s)); },
    worst() { const m = mapFor(state.get()); let w = null;
      for (let j = 0; j < m.nC; j++) for (let i = 0; i < m.nL; i++) { const x = m.data[j * m.nL + i]; if (x >= 0 && (!w || x > w.x)) w = { x, lao: m.lao.min + i * m.lao.step, cra: m.cra.min + j * m.cra.step }; }
      return w; },
    // located with the INPUT mapping (where a tap at this angle lands), not with X()/Y(), so a drawing mirrored or
    // flipped against the touch mapping is caught
    labels() { draw(); return drawn.map(l => ({ ...l })); },
    pixelAt(lao, cra) { draw(); const x = (lao - L0) / (L1 - L0) * W, y = (C1 - cra) / (C1 - C0) * H;
      const d = g.getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0], d[1], d[2], d[3]]; },
  };
}
