// Drawn over the angiogram, in the angiogram's own pixels: segment colours by family, SYNTAX labels, the selected
// segment's highlight, and tap-to-select. Every point goes through the renderer's toPixel() — the same projectPoint()
// the image is made with — so it works on the WebGL image and on the 2D fallback alike.
import { vesselsFor } from './data.js';
import { segmentsShown, segmentPolyline } from './segments.js';
import { projectPoint } from './geometry.js';
import { SID, SOD, DET_MM } from './xray-config.js';

const FAMILY = (id) => id === 'LM' ? '#e8ecf2'
  : /^(LIMA|SVG_OM|SVG_PDA)$/.test(id) ? '#34d399'
  : /^(LAD|D\d|S\d)$/.test(id) ? '#f0a63a'
  : /^(LCX|OM\d|IM|L_PDA|L_PLA)$/.test(id) ? '#b48cff' : '#5aa9ff';

function midpoint(pts) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  const t = L[L.length - 1] / 2; let i = 1; while (i < L.length - 1 && L[i] < t) i++;
  return i;
}
const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy); };

export function createOverlay(canvas, { views, onPick }) {
  const g = canvas.getContext('2d');
  let size = 0, labels = [], proj = new Map(), scale = 1;     // proj: segment id → projected polyline (image px)

  // ctx: { tree, grafts } — the current dominance's tree and the grafts shown with this system
  let pts3 = new Map();                                        // id → 3D polyline (segments and grafts), for midpoints
  function draw(state, angio, { tree, grafts = [] }) {
    size = angio.size; if (!size) return;
    if (canvas.width !== size) canvas.width = canvas.height = size;
    scale = size / Math.max(1, canvas.clientWidth || size);   // image px per CSS px
    g.clearRect(0, 0, size, size);
    const toPx = (p) => angio.toPixel(p);
    const pxPerMm = size / DET_MM;
    pts3 = new Map([...segmentsShown(tree, state.sys, state).map(id => [id, segmentPolyline(tree, id)]), ...grafts.map(g => [g.id, g.pts])]);
    proj = new Map([...pts3].map(([id, P]) => [id, P.map(toPx)]));

    if (state.colour) {
      g.globalAlpha = 0.55; g.lineCap = 'round'; g.lineJoin = 'round';
      for (const v of [...vesselsFor(tree, state.sys, state), ...grafts]) {
        g.strokeStyle = FAMILY(v.id);
        for (let i = 1; i < v.pts.length; i++) {
          const mag = projectPoint(v.pts[i], state.lao, state.cra, { sid: SID, sod: SOD }).mag;
          const [ax, ay] = toPx(v.pts[i - 1]), [bx, by] = toPx(v.pts[i]);
          g.lineWidth = Math.max(1, 1.5 * (v.r[i] + v.r[i - 1]) / 2 * mag * pxPerMm);    // 75 % of the vessel width
          g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        }
      }
      g.globalAlpha = 1;
    }
    if (state.sel && proj.has(state.sel)) {
      const P = proj.get(state.sel);
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [w, col] of [[7 * scale, 'rgba(240,166,58,0.55)'], [2.5 * scale, '#fff4dd']]) {
        g.strokeStyle = col; g.lineWidth = w; g.beginPath(); P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
      }
    }
    labels = [];
    if (state.labels || state.sel) {
      const font = Math.round(11 * scale), padX = 5 * scale, h = font + 6 * scale;
      g.font = `600 ${font}px system-ui, -apple-system, sans-serif`; g.textBaseline = 'middle'; g.textAlign = 'center';
      const ids = state.labels ? [...proj.keys()] : [state.sel];
      // the selected segment is placed first so it always gets a label
      ids.sort((a, b) => (b === state.sel) - (a === state.sel));
      for (const id of ids) {
        const P = proj.get(id); if (!P || P.length < 2) continue;
        // anchor at the middle of the part in view (a graft's halfway point can be high in the chest, outside the field)
        const inView = P.map(([x, y], i) => x > 8 && y > 8 && x < size - 8 && y < size - 8 ? i : -1).filter(i => i >= 0);
        if (!inView.length) continue;
        const whole = midpoint(pts3.get(id)), k = inView.includes(whole) ? whole : inView[inView.length >> 1];
        const [mx, my] = P[k], text = id.replace('_', '-');
        const [ax, ay] = P[Math.max(0, k - 1)], [bx, by] = P[Math.min(P.length - 1, k + 1)];
        let nx = -(by - ay), ny = bx - ax; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        const w = g.measureText(text).width + 2 * padX;
        let spot = null;
        for (const d of [16, 26, 38, 52]) for (const sgn of [1, -1]) {
          if (spot) break;
          const cx = mx + sgn * nx * d * scale, cy = my + sgn * ny * d * scale, r = { x: cx - w / 2, y: cy - h / 2, w, h };
          if (r.x < 2 || r.y < 2 || r.x + w > size - 2 || r.y + h > size - 2) continue;
          if (labels.some(q => r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h)) continue;
          spot = { ...r, id, cx, cy };
        }
        if (!spot) continue;
        labels.push(spot);
        g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = Math.max(1, scale);
        g.beginPath(); g.moveTo(mx, my); g.lineTo(spot.cx, spot.cy); g.stroke();
        g.fillStyle = id === state.sel ? '#f0a63a' : 'rgba(11,19,34,0.86)';
        g.beginPath(); g.roundRect(spot.x, spot.y, w, h, h / 2); g.fill();
        g.fillStyle = id === state.sel ? '#111' : '#fff'; g.fillText(text, spot.cx, spot.cy + scale * 0.5);
      }
    }
  }

  // tap: nearest shown segment within 14 CSS px, else clear
  canvas.addEventListener('click', (e) => {
    const b = canvas.getBoundingClientRect(), x = (e.clientX - b.left) * size / b.width, y = (e.clientY - b.top) * size / b.height;
    // a tap on a label pill selects that label's segment (pills sit 16–52 px off their vessel)
    const pill = labels.find(l => x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h);
    if (pill) { onPick(pill.id); return; }
    let best = null;
    for (const [id, P] of proj) for (let i = 1; i < P.length; i++) {
      const d = segDist(x, y, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]);
      if (!best || d < best.d) best = { id, d };
    }
    onPick(best && best.d <= 14 * size / b.width ? best.id : null);
  });

  return {
    draw,
    labels: () => labels.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })),
    // CSS-pixel position of a segment's projected midpoint (for tests)
    screen(id) { const P = proj.get(id); if (!P) return null; const b = canvas.getBoundingClientRect();
      const [x, y] = P[Math.min(midpoint(pts3.get(id)), P.length - 1)]; return { x: b.left + x * b.width / size, y: b.top + y * b.height / size }; },
    pixels() { const d = g.getImageData(0, 0, size, size).data, a = new Uint8Array(size * size); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3]; return { size, alpha: a }; },
  };
}
