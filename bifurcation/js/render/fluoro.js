// The fluoro window (WebGL2), Angio Views' method (angio/js/render-angio.js): one pass sums the path length (mm) through each
// material into a half-float target — R contrast (the tree outside the window, the lumen inside it moved with the pose, at
// the road-map level 0.2 between puffs; an inflated balloon's contrast at 60 %), G metal (struts, markers, the guide's
// braid), B wire A, A wire B — and a second turns it into a cine-like grey image, I = I0·exp(−Σ μ·L), with grain and a
// vignette; each wire's pixels are tinted toward its colour. The local scene sits in a group whose matrix is the frame
// (local → the tree's LPS axes), so this image and the cut-open window draw the same geometry.
// LAO 15 / CRA 33, a 120 mm field centred on the bifurcation; Stent boost: a 40 mm field, metal × 4, no contrast, less grain.
import { makeXrayCamera, aimXrayCamera } from '../fluoro/xray-camera.js';
import { projectPoint } from '../fluoro/geometry.js';
import { tubeGeometry } from '../fluoro/tubes.js';
import { MU, I0, SOD, SID } from '../fluoro/xray-config.js';
import { A, axisDist } from '../scene/anatomy.js';
import { buildLumenAsync, bindVerticesAsync, deformVertices } from '../scene/vessel.js';
import { pushFn } from '../devices/push.js';
import { stentLines } from '../devices/stent.js';
import { sbStentLines } from '../devices/sb-stent.js';
import { balloonPlace } from '../devices/balloon.js';
import { wirePath } from '../devices/wires.js';
import { TIP_LEN, WIRE_R } from '../devices/kinds.js';
import { treeLocal } from '../devices/paths.js';
import { tubeArrays } from '../engine/tube.js';
import { COLORS } from './look.js';

export const FIELD = 120, BOOST_FIELD = 40, LAO = 15, CRA = 33;
const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

export async function createFluoro(canvas, THREE, ctx, { maxDpr = 2 } = {}) {
  const probe = document.createElement('canvas').getContext('webgl2');
  if (!probe || !(probe.getExtension('EXT_color_buffer_float') || probe.getExtension('EXT_color_buffer_half_float'))) throw new Error('webgl2-float-unavailable');
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
  const gl = renderer.getContext(); renderer.setPixelRatio(1);
  let size = 0, rt = null, boost = false, field = FIELD;
  const scene = new THREE.Scene(), post = new THREE.Scene();
  const camera = makeXrayCamera(THREE, LAO, CRA, { sid: SID, sod: SOD, detector_mm: FIELD });

  const pathMat = (channel, w = 1) => new THREE.ShaderMaterial({
    uniforms: { uSign: { value: -1 }, uRef: { value: SOD }, uW: { value: w } },
    vertexShader: `varying float vZ; void main(){ vec4 v = modelViewMatrix * vec4(position,1.0); vZ = -v.z; gl_Position = projectionMatrix * v; }`,
    fragmentShader: `uniform float uSign; uniform float uRef; uniform float uW; varying float vZ;
      void main(){ float d = (vZ - uRef) * (gl_FrontFacing ? -1.0 : 1.0) * uSign * uW; gl_FragColor = vec4(${channel}); }`,
    side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  });
  const CH = { R: 'd, 0.0, 0.0, 0.0', G: '0.0, d, 0.0, 0.0', B: '0.0, 0.0, d, 0.0', A: '0.0, 0.0, 0.0, d' };
  const local = new THREE.Group(); local.matrixAutoUpdate = false;
  const { x, y, z } = ctx.tree.frame;
  local.matrix.set(x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, 0, 0, 0, 1); local.updateMatrixWorld(true);
  scene.add(local);

  // ── the tree outside the window (world coordinates), contrast ──
  const vesselMat = pathMat(CH.R, 0.2);
  const outside = (v) => {
    if (v.id === 'LAD') return [v.s.map(s => s < -A.WIN.pmv + 0.25), v.s.map(s => s > A.WIN.dmv - 0.25)];
    if (v.id === 'D1') return [v.s.map(s => s > A.WIN.sb - 0.25)];
    return [v.pts.map(() => true)];
  };
  for (const v of ctx.tree.vessels) for (const keep of outside(v)) {
    const pts = v.pts.filter((_, i) => keep[i]), r = v.r.filter((_, i) => keep[i]);
    if (pts.length < 2) continue;
    const m = new THREE.Mesh(tubeGeometry(THREE, pts, r, { sides: 12 }), vesselMat); m.frustumCulled = false; scene.add(m);
  }
  // ── the lumen inside the window (local), moved with the pose ──
  const L = await buildLumenAsync(), lrest = L.position.slice(), lbind = await bindVerticesAsync(lrest, L.part);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lrest.slice(), 3)); lg.setIndex(new THREE.BufferAttribute(L.index, 1));
  const lumen = new THREE.Mesh(lg, vesselMat); lumen.frustumCulled = false; local.add(lumen);
  // ── the guide: a 6F catheter back from the left main ostium (its braid shows faintly) ──
  { const T = treeLocal(ctx), p0 = T.lm.pts[0], p1 = T.lm.pts[Math.min(6, T.lm.pts.length - 1)];
    const d = [0, 1, 2].map(k => p0[k] - p1[k]), dl = Math.hypot(...d), pts = [];
    for (let s = 0; s <= 45; s += 3) pts.push([0, 1, 2].map(k => p0[k] + d[k] / dl * s + (k === 2 ? 0.004 * s * s : 0)));
    const g = new THREE.Mesh(tubeGeometry(THREE, pts, pts.map(() => 1.0), { sides: 10 }), pathMat(CH.G, 0.12)); g.frustumCulled = false; local.add(g); }

  // ── dynamic meshes (local) ──
  const dyn = (channel, w) => { const m = new THREE.Mesh(new THREE.BufferGeometry(), pathMat(channel, w)); m.frustumCulled = false; local.add(m); return m; };
  const setArrays = (m, a) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
    g.setIndex(new THREE.BufferAttribute(a.index, 1)); m.geometry.dispose(); m.geometry = g; };
  const struts = dyn(CH.G, 1), balloons = { A: dyn(CH.R, 0), B: dyn(CH.R, 0) };
  const wires = { A: { body: dyn(CH.B, 0.35), tip: dyn(CH.B, 1) }, B: { body: dyn(CH.A, 0.35), tip: dyn(CH.A, 1) } };
  const markerGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.0, 16, 1, false); markerGeo.rotateZ(Math.PI / 2);   // along x
  const markers = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(markerGeo, pathMat(CH.G, 1)); m.frustumCulled = false; local.add(m); return m; });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { tPath: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uMetal: { value: 1 }, uContrast: { value: 1 }, uGrain: { value: 0.04 },
      uColA: { value: new THREE.Vector3(...hex(COLORS.wireA)) }, uColB: { value: new THREE.Vector3(...hex(COLORS.wireB)) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tPath; uniform vec2 uRes; uniform float uMetal; uniform float uContrast; uniform float uGrain;
      uniform vec3 uColA; uniform vec3 uColB; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 L = max(texture2D(tPath, vUv), 0.0);
        float I = ${I0.toFixed(3)} * exp(-(${MU.vessel.toFixed(4)} * L.r * uContrast + ${MU.metal.toFixed(4)} * (L.g * uMetal + L.b + L.a)));
        float r = length(vUv - 0.5) * 1.41421;
        I *= mix(1.0, 0.82, smoothstep(0.35, 1.0, r));
        I += (hash(floor(vUv * uRes)) - 0.5) * uGrain;
        vec3 c = vec3(clamp(I, 0.0, 1.0));
        c = mix(c, uColA * (0.35 + 0.65 * c), 0.55 * clamp(L.b * 4.0, 0.0, 1.0));
        c = mix(c, uColB * (0.35 + 0.65 * c), 0.55 * clamp(L.a * 4.0, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  }));
  post.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // the image is the largest square the window's box holds; its CSS size is set here, never read back from the canvas
  // (a canvas sized by its own buffer fed back into the layout: clipped on dpr-3 phones, stretched on iPads)
  let cssSize = 0;
  function resize() {
    const box = canvas.parentElement;
    const css = Math.max(64, Math.floor(Math.min(box.clientWidth, box.clientHeight) || 512));
    if (css !== cssSize) { cssSize = css; canvas.style.width = canvas.style.height = `${css}px`; }
    const px = Math.round(css * Math.min(window.devicePixelRatio || 1, maxDpr));
    if (px === size) return false;
    size = px; renderer.setSize(px, px, false);
    rt?.dispose(); rt = new THREE.WebGLRenderTarget(px, px, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false });
    quad.material.uniforms.uRes.value.set(px, px);
    return true;
  }
  const mmPerPx = () => field * (SOD / SID) / Math.max(1, size);          // at the isocentre
  let last = null, lumenKey = '';
  function update(pose) {
    // the lumen
    const key = ['st_shown', 'st_exp', 'st_potR', 'st_cell', 'st_open', 'st_ellip', 'v_predLAD', 'v_predD1', 'bA_kind', 'bA_dist', 'bA_inf', 'bB_kind',
      'bB_dist', 'bB_inf', 'wA_route', 'wB_route', 'ss_shown', 'ss_exp', 'ss_s0', 'ss_flare', 'ss_crushR', 'ss_cell', 'ss_open', 'ss_kind', 'ss_potR',
      'v_diss'].map(k => (+pose[k]).toFixed(3)).join('|');
    if (key !== lumenKey) { lumenKey = key; deformVertices(lbind, lrest, pose, pushFn(pose, ctx), lg.attributes.position.array); lg.attributes.position.needsUpdate = true; }
    vesselMat.uniforms.uW.value = Math.max(0.2, pose.puff || 0);
    // struts, widened to half a pixel with their weight scaled so each still blocks as much X-ray as a 0.08 mm strut
    struts.visible = !!pose.st_shown || !!pose.ss_shown;
    if (struts.visible) {
      const lines = [...(pose.st_shown ? stentLines(ctx.graph, pose, ctx) : []), ...(pose.ss_shown ? sbStentLines(ctx.graph, pose, ctx) : [])];
      const rd = Math.max(0.045, 0.5 * mmPerPx()), parts = lines.map(l => tubeArrays(l, rd, { sides: 4, caps: true }));
      setArrays(struts, merge(parts)); struts.material.uniforms.uW.value = (0.045 / rd) ** 2;
    }
    // balloons: contrast in proportion to inflation
    let mi = 0;
    for (const w of ['A', 'B']) {
      const b = balloonPlace(pose, w, ctx), m = balloons[w];
      m.visible = !!b && b.inf > 0.02;
      if (m.visible) { const S0 = b.s[0]; setArrays(m, tubeArrays(b.path, (s) => Math.max(0.02, b.radiusAt(S0 + s)), { sides: 14, caps: true }));
        m.material.uniforms.uW.value = 0.6; }
      if (b) for (const q of b.markers) { const mk = markers[mi++]; mk.visible = true; mk.position.set(...q);
        const k = b.markers[1].map((v, i) => v - b.markers[0][i]), kl = Math.hypot(...k) || 1;
        mk.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(k[0] / kl, k[1] / kl, k[2] / kl)); }
      // wires: the body faint, the 30 mm tip dense
      const path = wirePath(pose, w, ctx), Wm = wires[w];
      const Ls = [0]; for (let i = 1; i < path.length; i++) Ls.push(Ls[i - 1] + Math.hypot(...[0, 1, 2].map(k => path[i][k] - path[i - 1][k])));
      const cut = (Ls[Ls.length - 1] || 0) - TIP_LEN, body = path.filter((_, i) => Ls[i] <= cut + 0.2), tip = path.filter((_, i) => Ls[i] >= cut);
      Wm.body.visible = body.length > 1; Wm.tip.visible = tip.length > 1;
      if (Wm.body.visible) setArrays(Wm.body, tubeArrays(body, WIRE_R, { sides: 6, caps: true }));
      if (Wm.tip.visible) setArrays(Wm.tip, tubeArrays(tip, WIRE_R, { sides: 6, caps: true }));
    }
    while (mi < 4) markers[mi++].visible = false;
  }
  function render() {
    resize();
    aimXrayCamera(THREE, camera, LAO, CRA, { sid: SID, sod: SOD, detector_mm: field });
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    quad.material.uniforms.tPath.value = rt.texture;
    renderer.setRenderTarget(null); renderer.render(post, postCam);
  }
  function draw(pose) { last = pose; if (resize()) lumenKey = ''; update(pose); render(); }
  function setBoost(on) {
    boost = !!on; field = boost ? BOOST_FIELD : FIELD;
    const u = quad.material.uniforms; u.uMetal.value = boost ? 4 : 1; u.uContrast.value = boost ? 0 : 1; u.uGrain.value = boost ? 0.02 : 0.04;
    if (last) draw(last);
  }
  // world point → canvas pixel [x, y] (rows from the top)
  function toPixel(w) { const q = projectPoint(w, LAO, CRA, { sid: SID, sod: SOD }); const half = field / 2;
    return [(q.u / half * 0.5 + 0.5) * size, (0.5 - q.v / half * 0.5) * size]; }
  function readAll() {
    const px = new Uint8Array(size * size * 4); gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const out = new Uint8Array(px.length), row = size * 4;
    for (let yy = 0; yy < size; yy++) out.set(px.subarray((size - 1 - yy) * row, (size - yy) * row), yy * row);
    return out;
  }
  return { kind: 'webgl', draw, setBoost, toPixel, readAll, get size() { return size; }, get boost() { return boost; }, redraw: () => last && draw(last),
    dispose() { renderer.dispose(); rt?.dispose(); } };
}

function merge(parts) {
  const nv = parts.reduce((s, a) => s + a.position.length, 0), ni = parts.reduce((s, a) => s + a.index.length, 0);
  const position = new Float32Array(nv), index = new Uint32Array(ni);
  let o = 0, oi = 0;
  for (const a of parts) { position.set(a.position, o); for (let i = 0; i < a.index.length; i++) index[oi + i] = a.index[i] + o / 3; o += a.position.length; oi += a.index.length; }
  return { position, index };
}
