// The cut-open window: the bifurcation with the front half of its wall removed (vessel.js builds the back half, cut face and
// window ends once; each frame moves its vertices with the lumen), the stent's struts, the balloons (Blender's folded balloon
// with its morph to inflated, stretched to each balloon's length and bent along its wire), their markers, and the two wires
// clipped to the window, each with its 30 mm radiopaque tip in a pale tint of its colour. Two stents: the LAD stent and,
// in the two-stent techniques, the D1 stent (sb-stent.js), the same strut and metal.
import { A, axis, axisDist, CARINA, OSTIUM } from '../scene/anatomy.js';
import { buildVesselAsync, bindVerticesAsync, deformVertices, lumenRadius, flapLift, FLAP, radial } from '../scene/vessel.js';
import { pushFn } from '../devices/push.js';
import { stentLines } from '../devices/stent.js';
import { sbStentLines } from '../devices/sb-stent.js';
import { balloonPlace } from '../devices/balloon.js';
import { wirePath } from '../devices/wires.js';
import { SHOULDER, TIP_LEN, WIRE_R } from '../devices/kinds.js';
import { tubeArrays } from '../engine/tube.js';
import { makeStrand } from '../engine/strands.js';
import { COLORS } from './look.js';

// camera presets: the whole Y while wiring and preparing; then the bifurcation's core, where the stent and balloons work
export const CUT_PRESETS = Object.freeze({
  whole: Object.freeze({ target: [1.5, 0.6, -0.6], dir: [0.0, -0.32, 1], radius: 13.5 }),
  core: Object.freeze({ target: [1.6, 0.8, -0.5], dir: [0.06, -0.42, 1], radius: 7.2 }),
  // the result's end view: from inside the proximal LAD, just proximal of the stent (camera ≈ 8.3 mm back, x ≈ −6.7), down
  // it at the D1 ostium
  end: Object.freeze({ target: [1.6, 0.6, 0], dir: [-1, 0.03, 0], radius: 2.3 }),
});
const smoothstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// inside the window (and a little beyond, so wires meet the cut ends)
const inWindow = (p) => p[0] >= -A.WIN.pmv - 0.3 && axisDist('dmv', p).s <= A.WIN.dmv + 0.3 && axisDist('sb', p).s <= A.WIN.sb + 0.3 &&
  Math.min(axisDist('pmv', p).d, axisDist('dmv', p).d, axisDist('sb', p).d) < 4;

// the wall mesh and its binding, built once per mesh step and shared (Phase 4: Compare's two panes draw the same wall, each
// deformed to its own result; nothing here is written after the build)
const BUILT = new Map();
function vesselFor(step) {
  if (!BUILT.has(step)) BUILT.set(step, (async () => { const V = await buildVesselAsync({ step });
    return { V, bind: await bindVerticesAsync(V.position.slice(), V.part, V.depth) }; })().catch((e) => { BUILT.delete(step); throw e; }));
  return BUILT.get(step);
}
// D1's heel: the side of D1's axis away from the carina, and where it starts along D1 (measure.js heelGap's frame)
const SBD = axis('sb').dir, sbS = (p) => p[0] * SBD[0] + p[1] * SBD[1], HEEL_N = [-SBD[1], SBD[0], 0], S_HEEL = sbS(OSTIUM.heel);

// built in chunks (the wall mesh takes ~1 s on a laptop), so the page stays responsive meanwhile
export async function createCut(view, ctx, models, { step = 0.15 } = {}) {
  const { THREE, scene } = view;
  const group = new THREE.Group(); scene.add(group);
  const col = (h) => new THREE.Color(h);

  // ── the vessel ──
  const { V, bind } = await vesselFor(step), rest = V.position.slice(), n = rest.length / 3;
  const colors = new Float32Array(n * 3), c = new THREE.Color();
  const C = { intima: col(COLORS.intima), plaque: col(COLORS.plaque), cut: col(COLORS.plaqueCut), media: col(COLORS.media),
    adv: col(COLORS.adventitia), outer: col(COLORS.outer) };
  for (let i = 0; i < n; i++) {
    const k = V.part[i];
    if (k === 0) c.copy(C.intima).lerp(C.plaque, smoothstep(0.15, 0.9, V.plaque[i]));
    else if (k === 1) c.copy(C.outer);
    else { const t = V.depth[i], e = V.eem[i], tm = e + (1 - e) * (A.MEDIA_T / (A.MEDIA_T + A.ADV_T));
      if (t < e) c.copy(C.cut).lerp(C.plaque, t / Math.max(e, 1e-3)); else if (t < tm) c.copy(C.media); else c.copy(C.adv); }
    colors.set([c.r, c.g, c.b], 3 * i);
  }
  const baseColors = colors.slice();
  const vg = new THREE.BufferGeometry();
  const vpos = new THREE.BufferAttribute(rest.slice(), 3); vpos.setUsage(35048);       // DYNAMIC_DRAW
  vg.setAttribute('position', vpos); vg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  vg.setIndex(new THREE.BufferAttribute(V.index, 1)); vg.computeVertexNormals();
  const vessel = new THREE.Mesh(vg, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.55, clearcoat: 0.35,
    clearcoatRoughness: 0.35, side: THREE.DoubleSide }));
  vessel.name = 'vessel'; group.add(vessel);
  // on the plane z = 0 the wall's normals have no z part (it is symmetric about it), so the end view's two halves meet smoothly
  const seam = []; for (let i = 0; i < n; i++) if (V.part[i] < 2 && Math.abs(rest[3 * i + 2]) < 0.02) seam.push(i);
  function normals() {
    vg.computeVertexNormals(); const N = vg.attributes.normal.array;
    for (const i of seam) { const l = Math.hypot(N[3 * i], N[3 * i + 1]) || 1; N[3 * i] /= l; N[3 * i + 1] /= l; N[3 * i + 2] = 0; }
    vg.attributes.normal.needsUpdate = true;
  }

  // ── the stents: one tube mesh over every strut line of each; the topology is fixed, so only positions and normals change ──
  const strutMat = models.strut?.clone() || new THREE.MeshStandardMaterial({ color: COLORS.strut, metalness: 1, roughness: 0.22 });
  const makeStent = (name) => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), strutMat); mesh.name = name; group.add(mesh);
    let buf = null;
    return { mesh, draw: (lines) => { buf = drawStent(mesh, buf, lines); } };
  };
  function drawStent(stentMesh, stentBuf, lines) {
    const parts = lines.map(l => tubeArrays(l, 0.045, { sides: 6, caps: false }));
    // the topology is fixed per stent, but the D1 stent's differs by technique (12 rings, or the culotte's 16): rebuild then
    const nv = parts.reduce((s, a) => s + a.position.length, 0);
    if (stentBuf && stentBuf.pos.length !== nv) stentBuf = null;
    if (!stentBuf) {
      const nv = parts.reduce((s, a) => s + a.position.length, 0), ni = parts.reduce((s, a) => s + a.index.length, 0);
      const pos = new Float32Array(nv), nor = new Float32Array(nv), idx = new Uint32Array(ni);
      let o = 0, oi = 0; for (const a of parts) { for (let i = 0; i < a.index.length; i++) idx[oi + i] = a.index[i] + o / 3; o += a.position.length; oi += a.index.length; }
      const g = stentMesh.geometry;
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1)); stentBuf = { pos, nor };
    }
    let o = 0; for (const a of parts) { stentBuf.pos.set(a.position, o); stentBuf.nor.set(a.normal, o); o += a.position.length; }
    const g = stentMesh.geometry; g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true; g.computeBoundingSphere();
    return stentBuf;
  }
  const stents = { mv: makeStent('stent'), sb: makeStent('stentSB') };

  // ── balloons and markers ──
  const bal = models.balloon, base = bal.geometry.attributes.position, morph = bal.geometry.morphAttributes.position[0];
  const rel = bal.geometry.morphTargetsRelative;
  const makeBalloon = () => {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base.count * 3), 3));
    g.setIndex(bal.geometry.index.clone());
    const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: COLORS.balloon, roughness: 0.16, clearcoat: 0.7, clearcoatRoughness: 0.15,
      transparent: true, opacity: 0.62, side: THREE.DoubleSide, depthWrite: false }));
    m.renderOrder = 2; group.add(m); return m;
  };
  const balloons = { A: makeBalloon(), B: makeBalloon() };
  const markerGeo = models.marker.geometry, markerMat = models.marker.material;
  const markers = { A: [0, 1].map(() => { const m = new THREE.Mesh(markerGeo, markerMat); group.add(m); return m; }),
    B: [0, 1].map(() => { const m = new THREE.Mesh(markerGeo, markerMat); group.add(m); return m; }) };
  const X = new THREE.Vector3(1, 0, 0), tmp = new THREE.Vector3();
  function drawBalloon(which, b) {
    const m = balloons[which], mk = markers[which];
    if (!b) { m.visible = false; mk.forEach(q => { q.visible = false; }); return; }
    m.visible = true;
    // the balloon's own path, smoothed, with frames
    const P = b.path, S = b.s, sm = P.map((p, i) => { const a = P[Math.max(0, i - 2)], z = P[Math.min(P.length - 1, i + 2)];
      return [0, 1, 2].map(k => (a[k] + p[k] + z[k] + P[Math.max(0, i - 1)][k] + P[Math.min(P.length - 1, i + 1)][k]) / 5); });
    const frame = (s) => {
      const j = Math.max(1, Math.min(S.length - 1, Math.round((s - S[0]) / (S[1] - S[0])))), p = sm[Math.max(0, Math.min(sm.length - 1, j))];
      const t = [0, 1, 2].map(k => sm[Math.min(sm.length - 1, j + 1)][k] - sm[Math.max(0, j - 1)][k]), tl = Math.hypot(...t) || 1;
      const tt = t.map(v => v / tl); let nn = [-tt[1], tt[0], 0]; const nl = Math.hypot(...nn); nn = nl > 1e-6 ? nn.map(v => v / nl) : [1, 0, 0];
      return { p, t: tt, n: nn, b: [tt[1] * nn[2] - tt[2] * nn[1], tt[2] * nn[0] - tt[0] * nn[2], tt[0] * nn[1] - tt[1] * nn[0]] };
    };
    const pos = m.geometry.attributes.position.array, d = b.spec.d, len = b.spec.len, inf = b.inf;
    for (let i = 0; i < base.count; i++) {
      const x = base.getX(i), y = base.getY(i) + (rel ? morph.getY(i) : morph.getY(i) - base.getY(i)) * inf;
      const z = base.getZ(i) + (rel ? morph.getZ(i) : morph.getZ(i) - base.getZ(i)) * inf;
      const s = Math.abs(x) <= 5 ? b.s0 + (x + 5) / 10 * len : x > 5 ? b.s1 + (x - 5) : b.s0 + (x + 5);
      const f = frame(s);
      for (let k = 0; k < 3; k++) pos[3 * i + k] = f.p[k] + d * (y * f.n[k] + z * f.b[k]);
    }
    m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
    m.material.color.set(COLORS.balloon).lerp(new THREE.Color(COLORS.balloonFull), inf);
    b.markers.forEach((q, k) => { const f = frame(k ? b.s1 : b.s0); mk[k].visible = true; mk[k].position.set(...q);
      mk[k].quaternion.setFromUnitVectors(X, tmp.set(...f.t)); });
  }

  // ── wires: body and radiopaque tip, clipped to the window ──
  const wires = { A: [COLORS.wireA, COLORS.tipA], B: [COLORS.wireB, COLORS.tipB] };
  const strands = Object.fromEntries(Object.entries(wires).map(([w, [cb, ct]]) => {
    const body = makeStrand(THREE, { color: cb, radius: WIRE_R, sides: 8, rough: 0.32, metal: 0.25 });
    const tip = makeStrand(THREE, { color: ct, radius: WIRE_R * 1.02, sides: 8, rough: 0.3, metal: 0.6 });
    group.add(body.group, tip.group); return [w, { body, tip }];
  }));
  const tips = {};
  function drawWire(w, path) {
    const L = [0]; for (let i = 1; i < path.length; i++) L.push(L[i - 1] + Math.hypot(...[0, 1, 2].map(k => path[i][k] - path[i - 1][k])));
    const cut = (L[L.length - 1] || 0) - TIP_LEN, clip = (pts) => pts.filter(inWindow);
    strands[w].body.update(clip(path.filter((_, i) => L[i] <= cut + 0.3)));
    strands[w].tip.update(clip(path.filter((_, i) => L[i] >= cut)));
    tips[w] = path.length ? path[path.length - 1] : null;
  }

  // ── TAP's dissection flap (vessel.js FLAP): a tongue of intima lifted off D1's back wall into the lumen, its free edge
  // distal; the wall itself stays where it is (the fluoro's lumen takes the narrowing) ──
  const FS = 18, FT = 15, flapGeo = new THREE.BufferGeometry(), flapPos = new Float32Array(FS * FT * 3), flapIdx = [];
  for (let i = 0; i < FS - 1; i++) for (let j = 0; j < FT - 1; j++) { const a = i * FT + j; flapIdx.push(a, a + FT, a + 1, a + 1, a + FT, a + FT + 1); }
  flapGeo.setAttribute('position', new THREE.BufferAttribute(flapPos, 3)); flapGeo.setIndex(flapIdx);
  const flap = new THREE.Mesh(flapGeo, new THREE.MeshPhysicalMaterial({ color: new THREE.Color(COLORS.intima).lerp(new THREE.Color(COLORS.plaque), 0.35),
    roughness: 0.6, clearcoat: 0.2, side: THREE.DoubleSide }));
  flap.name = 'flap'; flap.visible = false; group.add(flap);
  let flapKey = '';
  // the flap's points for a pose (null when it lies flat): its surface is the lumen the flap leaves (vessel.js), drawn 0.03 in
  function flapPoints(pose, out) {
    let most = 0; for (let i = 0; i < FS; i++) most = Math.max(most, flapLift(FLAP.s0 + (FLAP.s1 - FLAP.s0) * i / (FS - 1), FLAP.th, pose));
    if (!(most > 0.02)) return null;
    const push = pushFn(pose, ctx), d = axis('sb').dir;
    for (let i = 0; i < FS; i++) for (let j = 0; j < FT; j++) {
      const s = FLAP.s0 + (FLAP.s1 - FLAP.s0) * i / (FS - 1), th = FLAP.th - FLAP.half + 2 * FLAP.half * j / (FT - 1);
      const r = lumenRadius('sb', s, th, pose, push('sb', s, th)) - 0.03, q = radial('sb', th);
      out.set([d[0] * s + q[0] * r, d[1] * s + q[1] * r, q[2] * r], 3 * (i * FT + j));
    }
    return out;
  }
  // keyed on what the wall under it depends on (the lumen's key) and the flap itself
  function drawFlap(pose, lumen) {
    const key = `${lumen}|${(+pose.v_diss).toFixed(3)}`;
    if (key === flapKey) return; flapKey = key;
    flap.visible = !!flapPoints(pose, flapPos);
    if (!flap.visible) return;
    flapGeo.attributes.position.needsUpdate = true; flapGeo.computeVertexNormals(); flapGeo.computeBoundingSphere();
  }
  const sumOf = (P) => (P ? P.reduce((a, v) => a + Math.round(1e4 * v), 0) : null);

  // ── each frame ──
  let lumenKey = '';
  const LUMEN = ['st_shown', 'st_exp', 'st_potR', 'st_cell', 'st_open', 'st_ellip', 'v_predLAD', 'v_predD1', 'bA_kind', 'bA_dist', 'bA_inf',
    'bB_kind', 'bB_dist', 'bB_inf', 'wA_route', 'wB_route', 'ss_shown', 'ss_exp', 'ss_s0', 'ss_flare', 'ss_crushR', 'ss_cell', 'ss_open',
    'ss_kind', 'ss_potR'];
  let drawn = { mv: null, sb: null }, lastPose = null;
  let placed = { A: null, B: null };
  function update(pose) {
    const key = LUMEN.map(k => (+pose[k]).toFixed(3)).join('|');
    if (key !== lumenKey) {
      lumenKey = key;
      deformVertices(bind, rest, { ...pose, v_diss: 0 }, pushFn(pose, ctx), vpos.array);
      vpos.needsUpdate = true; normals();
    }
    drawFlap(pose, key);
    lastPose = pose;
    stents.mv.mesh.visible = !!pose.st_shown; stents.sb.mesh.visible = !!pose.ss_shown;
    drawn = { mv: pose.st_shown ? stentLines(ctx.graph, pose, ctx) : null, sb: pose.ss_shown ? sbStentLines(ctx.graph, pose, ctx) : null };
    if (drawn.mv) stents.mv.draw(drawn.mv);
    if (drawn.sb) stents.sb.draw(drawn.sb);
    for (const w of ['A', 'B']) { placed[w] = balloonPlace(pose, w, ctx); drawBalloon(w, placed[w]); drawWire(w, wirePath(pose, w, ctx)); }
    view.markDirty();
  }
  function node(name) {
    const m = /^marker([AB])([01])$/.exec(name);
    if (m) return placed[m[1]] ? placed[m[1]].markers[+m[2]].slice() : null;
    if (name === 'tipA') return tips.A ? tips.A.slice() : null;
    if (name === 'tipB') return tips.B ? tips.B.slice() : null;
    if (name === 'carina') return CARINA.tip.slice();
    if (name === 'ssProx') { const d = axis('sb').dir, s = lastPose?.ss_s0; return lastPose?.ss_shown ? [d[0] * s, d[1] * s, 0] : null; }
    return null;
  }
  // ── the result's views: 'cut' as drawn; 'end' adds the wall's mirror image (the vessel and everything that holds it are
  // symmetric about the bifurcation plane, so the front half is the back half reflected — no second mesh to build) for a
  // look down the proximal LAD; 'layers' colours every strut by the layers stacked there (measure.js layerMap) on a plain
  // material and dims the wall ──
  let mirror = null, layerMat = null, shownCounts = [], wallIndex = null, endColors = null;
  const fullIndex = vg.index, cutColors = vg.attributes.color;
  function colourStruts(st, lines, counts) {
    const g = st.mesh.geometry, n = g.attributes.position.count;
    let col = g.attributes.color; if (!col || col.count !== n) { col = new THREE.BufferAttribute(new Float32Array(n * 3), 3); g.setAttribute('color', col); }
    const pal = [col1, col1, col2, col3]; let v = 0;
    lines.forEach((l, i) => l.forEach((_, j) => { const k = Math.min(3, counts[i][j]), c = pal[k]; seen.add(Math.min(3, counts[i][j]));
      for (let s = 0; s < 6; s++, v++) col.array.set([c.r, c.g, c.b], 3 * v); }));
    col.needsUpdate = true;
  }
  const col1 = col(COLORS.layer1), col2 = col(COLORS.layer2), col3 = col(COLORS.layer3), seen = new Set();
  // the end view's colours: the cut edge's vertices take their lumen neighbours' colours, so no pale band runs down the middle
  function edgeColors() {
    const keep = wallIndex.array, ec = colors.slice(), sum = new Float32Array(n * 3), cnt = new Uint16Array(n);
    for (let t = 0; t < keep.length; t += 3) for (let a = 0; a < 3; a++) { const v = keep[t + a]; if (V.part[v] < 2) continue;
      for (let b = 0; b < 3; b++) { const u = keep[t + b]; if (V.part[u] !== 0) continue; cnt[v]++; for (let c = 0; c < 3; c++) sum[3 * v + c] += colors[3 * u + c]; } }
    for (let v = 0; v < n; v++) if (cnt[v]) for (let c = 0; c < 3; c++) ec[3 * v + c] = sum[3 * v + c] / cnt[v];
    return new THREE.BufferAttribute(ec, 3);
  }
  // Phase 4 (Compare, the plain T): shade the bare wall at D1's heel — lumen vertices from the heel to `len` mm along D1, within
  // 35° of the heel's side about D1's axis (measure.js heelGap's own window); 0 takes it away. Returns how many it shaded.
  const gapCol = col(COLORS.gap); let gapN = 0;
  function markGap(len = 0) {
    colors.set(baseColors); gapN = 0;
    if (len > 0) for (let i = 0; i < n; i++) {
      if (V.part[i] !== 0) continue;
      const p = [rest[3 * i], rest[3 * i + 1], rest[3 * i + 2]], s = sbS(p);
      if (s < S_HEEL || s > S_HEEL + len) continue;
      const v = [p[0] - SBD[0] * s, p[1] - SBD[1] * s, p[2]];
      if (Math.hypot(...v) > A.SB_R + 0.8 || Math.abs(Math.atan2(v[2], v[0] * HEEL_N[0] + v[1] * HEEL_N[1])) > 35 * Math.PI / 180) continue;
      colors.set([gapCol.r, gapCol.g, gapCol.b], 3 * i); gapN++;
    }
    cutColors.needsUpdate = true;
    endColors = mirror && vg.attributes.color !== cutColors ? edgeColors() : null;
    if (endColors) vg.setAttribute('color', endColors);
    view.markDirty(); return gapN;
  }
  function setView(v, map = null) {
    if (v === 'end' && !mirror) {
      mirror = new THREE.Mesh(vg, vessel.material); mirror.scale.z = -1; mirror.name = 'vesselMirror'; group.add(mirror);
      // without the cut face (the triangles lying in the plane z = 0), which would show as a seam where the two halves meet
      const I = V.index, Z = (i) => Math.abs(rest[3 * i + 2]) < 0.02, keep = [];
      for (let t = 0; t < I.length; t += 3) if (!(Z(I[t]) && Z(I[t + 1]) && Z(I[t + 2]))) keep.push(I[t], I[t + 1], I[t + 2]);
      wallIndex = new THREE.BufferAttribute(Uint32Array.from(keep), 1);
    }
    if (v === 'end' && !endColors) endColors = edgeColors();
    vg.setAttribute('color', v === 'end' ? endColors : cutColors);
    if (mirror) mirror.visible = v === 'end';
    if (vg.index !== (v === 'end' ? wallIndex : fullIndex)) { vg.setIndex(v === 'end' ? wallIndex : fullIndex); normals(); }
    const layers = v === 'layers' && map;
    vessel.material.color.setScalar(layers ? 0.42 : 1);
    if (layers && !layerMat) layerMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.55 });
    seen.clear();
    for (const nm of ['mv', 'sb']) {
      const st = stents[nm];
      if (layers && drawn[nm] && map[nm]) { colourStruts(st, drawn[nm], map[nm]); st.mesh.material = layerMat; } else st.mesh.material = strutMat;
    }
    shownCounts = [...seen].sort((a, b) => a - b);
    view.markDirty();
  }
  return { group, update, node, presetFor: (name) => CUT_PRESETS[name] || CUT_PRESETS.whole, drawn: () => drawn, setView, layerCounts: () => shownCounts,
    markGap, gapShown: () => gapN,
    flapShown: () => flap.visible,
    // the drawn flap's checksum, and the one a pose gives computed afresh
    flapSum: () => (flap.visible ? sumOf(flapPos) : null), flapSumFor: (pose) => sumOf(flapPoints(pose, new Float32Array(flapPos.length))) };
}
