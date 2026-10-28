// The angiogram without a GPU (Canvas 2D) — the guarantee AngioView lacks: no WebGL, still a usable picture.
// Every centreline is projected with geometry.projectPoint() (the same function the WebGL camera is built from), each
// vessel drawn into its own layer with 'darken' so its own segment joints do not double up, then multiplied onto the
// image so CROSSING vessels darken each other, as contrast does. No bone or heart shadow — the note under the image says so.
import { projectPoint } from './geometry.js';
import { MU, I0, SOD, SID, DET_MM, MARKER_R } from './xray-config.js';

export function createAngio2D(canvas, { vessels, grafts = [], markers = [] }) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const layer = document.createElement('canvas'), lctx = layer.getContext('2d');
  let size = 0, last = null, lastVisible = null, items = [];
  // vessels and grafts are contrast; sternal wires and clips are metal
  function setAnatomy({ vessels, grafts = [], markers = [] }) {
    items = [...vessels.map(v => ({ id: v.id, pts: v.pts, r: v.r, mu: MU.vessel })), ...grafts.map(g => ({ id: g.id, pts: g.pts, r: g.r, mu: MU.vessel })),
             ...markers.map((k, i) => ({ id: `marker${i}`, pts: k.pts, r: k.pts.map(() => MARKER_R[k.kind] || 0.5), mu: MU.metal }))];
  }
  setAnatomy({ vessels, grafts, markers });
  function resize() {
    const css = Math.max(64, Math.round(canvas.clientWidth || 512));
    const px = Math.round(css * Math.min(window.devicePixelRatio || 1, 2));
    if (px === size) return;
    size = px; canvas.width = canvas.height = layer.width = layer.height = px;
  }
  const toPixel = (p, st) => { const q = projectPoint(p, st.lao, st.cra, { sid: SID, sod: SOD });
    return [(q.u / (DET_MM / 2) * 0.5 + 0.5) * size, (0.5 - q.v / (DET_MM / 2) * 0.5) * size, q.mag]; };
  function draw(state, visibleIds) {
    resize(); last = state; if (visibleIds) lastVisible = visibleIds;
    const g0 = Math.round(I0 * 255);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgb(${g0},${g0},${g0})`; ctx.fillRect(0, 0, size, size);
    const pxPerMm = size / DET_MM;
    for (const v of items) {
      if (lastVisible && !lastVisible.has(v.id)) continue;
      lctx.globalCompositeOperation = 'source-over'; lctx.fillStyle = '#fff'; lctx.fillRect(0, 0, size, size);
      lctx.globalCompositeOperation = 'darken'; lctx.lineCap = 'round';
      const P = v.pts.map(p => toPixel(p, state));
      for (let i = 1; i < P.length; i++) {
        const r = (v.r[i] + v.r[i - 1]) / 2, t = Math.round(255 * Math.exp(-v.mu * 2 * r));   // centre-line chord (full diameter), as the X-ray image is darkest there
        lctx.strokeStyle = `rgb(${t},${t},${t})`; lctx.lineWidth = Math.max(1, 2 * r * P[i][2] * pxPerMm);
        lctx.beginPath(); lctx.moveTo(P[i - 1][0], P[i - 1][1]); lctx.lineTo(P[i][0], P[i][1]); lctx.stroke();
      }
      ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(layer, 0, 0);
    }
    const vg = ctx.createRadialGradient(size / 2, size / 2, size * 0.25, size / 2, size / 2, size * 0.71);
    vg.addColorStop(0, 'rgba(255,255,255,1)'); vg.addColorStop(1, 'rgba(209,209,209,1)');
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = vg; ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }
  return {
    kind: '2d', draw, setAnatomy, get size() { return size; },
    toPixel: (p) => toPixel(p, last).slice(0, 2),
    readAll: () => ctx.getImageData(0, 0, size, size).data,
    dispose() {},
  };
}
