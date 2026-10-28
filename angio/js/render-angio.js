// The X-ray angiogram (WebGL2). One pass draws every closed mesh into a half-float target with additive blending, adding
// eye-space depth for back faces and subtracting it for front faces: per pixel that sums the PATH LENGTH (mm) through
// each material — contrast in the vessels and grafts (R), bone (G), soft tissue (B), metal wires and clips (A) — so crossing
// vessels darken like real contrast.
// A second pass turns path lengths into a cine-like grey image: I = I0·exp(−Σ μ·L), plus fixed grain and a vignette.
// The camera is makeXrayCamera() — built from geometry.js, mirrored to the monitor — so this image and projectPoint()
// agree to the pixel (scripts/test-angio-page.mjs checks it at six angles).
import { makeXrayCamera, aimXrayCamera } from './xray-camera.js';
import { tubeGeometry } from './tubes.js';
import { projectPoint } from './geometry.js';

import { MU, I0, SOD, SID, DET_MM, MARKER_R } from './xray-config.js';

export function createAngio(canvas, THREE, { vessels, grafts = [], markers = [], bone = [], tissue = [], maxDpr = 2 }) {
  // Probe on a throwaway canvas first: asking three.js for a context the device cannot give logs console errors.
  const probe = document.createElement('canvas').getContext('webgl2');
  // the path-length target is HALF float: either extension makes it renderable (some iOS builds expose only the half one)
  if (!probe || !(probe.getExtension('EXT_color_buffer_float') || probe.getExtension('EXT_color_buffer_half_float'))) throw new Error('webgl2-float-unavailable');
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false });
  const gl = renderer.getContext();
  renderer.setPixelRatio(1);
  let size = 0, rt = null;
  const scene = new THREE.Scene(), post = new THREE.Scene();
  const camera = makeXrayCamera(THREE, 0, 0, { sid: SID, sod: SOD, detector_mm: DET_MM });

  const pathMat = (channel) => new THREE.ShaderMaterial({
    uniforms: { uSign: { value: -1 }, uRef: { value: SOD } },
    vertexShader: `varying float vZ; void main(){ vec4 v = modelViewMatrix * vec4(position,1.0); vZ = -v.z; gl_Position = projectionMatrix * v; }`,
    fragmentShader: `uniform float uSign; uniform float uRef; varying float vZ;
      void main(){ float d = (vZ - uRef) * (gl_FrontFacing ? -1.0 : 1.0) * uSign; gl_FragColor = vec4(${channel}); }`
      .replace('${channel}', channel),
    side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  });
  // the mirrored X-ray camera flips winding (xray-camera.js), so front/back swap: uSign = −1
  const mats = { vessel: pathMat('d, 0.0, 0.0, 0.0'), bone: pathMat('0.0, d, 0.0, 0.0'), tissue: pathMat('0.0, 0.0, d, 0.0'),
                 metal: pathMat('0.0, 0.0, 0.0, d') };

  // the contrast-filled vessels and grafts, and the metal markers — all swapped together when the dominance changes
  const vesselMeshes = new Map();
  function setAnatomy({ vessels, grafts = [], markers = [] }) {
    for (const m of vesselMeshes.values()) { scene.remove(m); m.geometry.dispose(); }
    vesselMeshes.clear();
    const add = (id, pts, r, mat) => { const m = new THREE.Mesh(tubeGeometry(THREE, pts, r, { sides: 12 }), mat); m.frustumCulled = false;
      m.userData.id = id; vesselMeshes.set(id, m); scene.add(m); };
    for (const v of vessels) add(v.id, v.pts, v.r, mats.vessel);
    for (const g of grafts) add(g.id, g.pts, g.r, mats.vessel);
    markers.forEach((k, i) => add(`marker${i}`, k.pts, k.pts.map(() => MARKER_R[k.kind] || 0.5), mats.metal));
  }
  setAnatomy({ vessels, grafts, markers });
  const backdrop = [];
  for (const g of bone) { const m = new THREE.Mesh(g, mats.bone); m.frustumCulled = false; scene.add(m); backdrop.push(m); }
  for (const g of tissue) { const m = new THREE.Mesh(g, mats.tissue); m.frustumCulled = false; scene.add(m); backdrop.push(m); }

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { tPath: { value: null }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D tPath; uniform vec2 uRes; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec4 L = max(texture2D(tPath, vUv), 0.0);
        float I = ${I0.toFixed(3)} * exp(-(${MU.vessel.toFixed(4)} * L.r + ${MU.bone.toFixed(4)} * L.g + ${MU.tissue.toFixed(4)} * L.b + ${MU.metal.toFixed(4)} * L.a));
        float r = length(vUv - 0.5) * 1.41421;
        I *= mix(1.0, 0.82, smoothstep(0.35, 1.0, r));
        I += (hash(floor(vUv * uRes)) - 0.5) * 0.04;
        gl_FragColor = vec4(vec3(clamp(I, 0.0, 1.0)), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  }));
  post.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function resize() {
    const css = Math.max(64, Math.round(canvas.clientWidth || 512));
    const px = Math.round(css * Math.min(window.devicePixelRatio || 1, maxDpr));
    if (px === size) return;
    size = px; renderer.setSize(px, px, false);
    rt?.dispose(); rt = new THREE.WebGLRenderTarget(px, px, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false });
    quad.material.uniforms.uRes.value.set(px, px);
  }
  let last = null, lastVisible = null;
  function draw(state, visibleIds) {
    resize();
    aimXrayCamera(THREE, camera, state.lao, state.cra, { sid: SID, sod: SOD, detector_mm: DET_MM });
    if (visibleIds) { lastVisible = visibleIds; }
    for (const [id, m] of vesselMeshes) m.visible = !lastVisible || lastVisible.has(id);
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    quad.material.uniforms.tPath.value = rt.texture;
    renderer.setRenderTarget(null); renderer.render(post, postCam);
    last = state;
  }

  // ── test/debug hooks ────────────────────────────────────────────────────────────────────────────────────────────
  // RGBA, rows TOP to bottom (gl.readPixels returns bottom-up)
  function readAll() {
    const px = new Uint8Array(size * size * 4); gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const out = new Uint8Array(px.length), row = size * 4;
    for (let y = 0; y < size; y++) out.set(px.subarray((size - 1 - y) * row, (size - y) * row), y * row);
    return out;
  }
  function toPixel(p) { const q = projectPoint(p, last.lao, last.cra, { sid: SID, sod: SOD });
    return [(q.u / (DET_MM / 2) * 0.5 + 0.5) * size, (0.5 - q.v / (DET_MM / 2) * 0.5) * size]; }
  return {
    kind: 'webgl', draw, toPixel, setAnatomy, get size() { return size; },
    // the low tier draws at 1× pixels (the next draw resizes)
    setMaxDpr(n) { maxDpr = n; },
    setBackdrop(on) { backdrop.forEach(m => { m.visible = on; }); },
    readAll, dispose() { renderer.dispose(); rt?.dispose(); },
  };
}
