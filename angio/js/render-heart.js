// The 3D heart panel: BodyParts3D heart and chest, the coronary tree as tubes, an X-ray beam indicator, orbit controls.
// See-through is the default: BodyParts3D's right atrium bulges over the AV groove, so on an opaque heart the RCA (which
// IS in the groove) would be hidden from the front. With the heart opaque, the parts of the arteries it hides are drawn
// faintly through it, so the RCA stays findable (instead of carving the groove into the atlas mesh).
// Teaching modes: Foreshortening (vessels coloured by how end-on they lie to the beam), Centrelines, Labels, Planes
// (AV-groove and interventricular planes fitted to the arteries, planes.js) and the selected segment's glow.
// "Detector view" puts the camera on the detector side of the C-arm looking at the patient — the cath-lab monitor's point
// of view — so the 3D heart lines up with the angiogram (a plain camera from the detector side needs no mirror).
import { imageBasis } from './geometry.js';
import { tubeGeometry } from './tubes.js';
import { anatomyPlanes } from './planes.js';
import { segmentsShown, segmentPolyline, segmentMidpoint, polylineMidpoint, scoreColour, GRAFT_IDS } from './segments.js';
import { MARKER_R } from './xray-config.js';

const COLORS = { left: 0xf0a63a, right: 0x5aa9ff, graft: 0x34d399, metal: 0xb8c0cc, heart: 0x8a3b45, bone: 0xd8d2c0 };
const RIGHT = new Set(['RCA', 'R_PDA', 'R_PLA', 'CONUS']);
const colourOf = (id) => GRAFT_IDS.includes(id) ? COLORS.graft : id.startsWith('marker') ? COLORS.metal : RIGHT.has(id) ? COLORS.right : COLORS.left;
const labelOf = (id) => id.replace('_', '-');

// tier 'low' (tier.js): no antialiasing, 1× pixels
export async function createHeart(canvas, THREE, { heartScene, thoraxScene, vessels, grafts = [], markers = [], tree, tier = 'high' }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier === 'low' ? 1 : 2));
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-200, -400, 300); scene.add(key);
  const camera = new THREE.PerspectiveCamera(30, 1, 5, 4000);

  const heartMats = [];
  heartScene.traverse(o => { if (o.isMesh) {
    o.material = new THREE.MeshStandardMaterial({ color: COLORS.heart, roughness: 0.75, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false });
    heartMats.push(o.material); } });
  thoraxScene.traverse(o => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: COLORS.bone, transparent: true, opacity: 0.12, depthWrite: false, roughness: 0.9 }); });
  scene.add(thoraxScene, heartScene);
  const SIDES = 10, tubes = new Map(), lines = new Map(), ghosts = new Map(), tangents = new Map(), radii = new Map(), paths = new Map();
  let PL = null, graftDefs = [];
  const planeMeshes = [];
  // the arteries, grafts and metal markers of one dominance (rebuilt when the dominance changes), and its anatomy planes
  function setAnatomy({ vessels, grafts = [], markers = [], tree: t }) {
    for (const m of [...tubes.values(), ...ghosts.values(), ...lines.values(), ...planeMeshes]) { scene.remove(m); m.material.dispose(); }
    for (const m of [...tubes.values(), ...lines.values(), ...planeMeshes]) m.geometry.dispose();
    for (const M of [tubes, ghosts, lines, tangents, radii, paths]) M.clear();
    planeMeshes.length = 0;
    tree = t; graftDefs = grafts; highlightId = undefined;
    const add = (id, pts, r) => {
      const geo = tubeGeometry(THREE, pts, r, { sides: SIDES }), col = colourOf(id);
      geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3).fill(1), 3));
      const metal = id.startsWith('marker');
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: metal ? 0.3 : 0.45, metalness: metal ? 0.8 : 0.05 }));
      m.renderOrder = 2; tubes.set(id, m); scene.add(m);
      // drawn only where something (the opaque heart) is IN FRONT of the vessel: a faint trace of the hidden course
      const gh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false, depthFunc: THREE.GreaterDepth }));
      gh.renderOrder = 3; gh.visible = false; ghosts.set(id, gh); scene.add(gh);
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))), new THREE.LineBasicMaterial({ color: col }));
      ln.visible = false; ln.renderOrder = 2; lines.set(id, ln); scene.add(ln);
      const n = pts.length; paths.set(id, pts); radii.set(id, r);
      tangents.set(id, pts.map((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(...d) || 1; return d.map(x => x / l); }));
    };
    for (const v of vessels) add(v.id, v.pts, v.r);
    for (const g of grafts) add(g.id, g.pts, g.r);
    markers.forEach((k, i) => add(`marker${i}`, k.pts, k.pts.map(() => MARKER_R[k.kind] || 0.5)));
    // anatomy planes, as translucent discs
    PL = tree ? anatomyPlanes(tree) : null;
    if (PL) for (const [k, col] of [['av', 0x2dd4bf], ['iv', 0xf472b6]]) {
      const p = PL[k], m = new THREE.Mesh(new THREE.CircleGeometry(Math.max(45, p.radius), 64),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
      m.position.set(...p.centre); m.lookAt(p.centre[0] + p.normal[0], p.centre[1] + p.normal[1], p.centre[2] + p.normal[2]);
      m.visible = false; m.renderOrder = 4; planeMeshes.push(m); scene.add(m);
    }
    fsApplied = !mode.fs;                                     // re-apply the foreshortening colours to the new tubes
    if (last) draw(last);
  }
  let highlight = null, highlightId = null;
  const mode = { fs: false, centrelines: false, labels: false, planes: false };
  // HTML labels over the canvas (segments + plane names)
  const host = canvas.parentElement, labelEls = new Map();
  const pill = (key, text, cls) => { let e = labelEls.get(key); if (!e) { e = document.createElement('span'); e.className = 'heart-label ' + (cls || '');
    e.textContent = text; e.setAttribute('aria-hidden', 'true'); if (!key.startsWith('plane-')) e.dataset.seg = key; host?.append(e); labelEls.set(key, e); } return e; };
  // beam: source → detector through the isocentre, and the detector as a small square
  const beamGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const beam = new THREE.Line(beamGeo, new THREE.LineDashedMaterial({ color: 0xf0a63a, dashSize: 12, gapSize: 8 }));
  const det = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshBasicMaterial({ color: 0xf0a63a, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
  scene.add(beam, det);

  // orientation marker: the patient's axes as lettered arms (L/R, A/P, H/F), turned with the camera, so after any orbit
  // the reader still knows head from feet and left from right. DICOM LPS: +x left, +y posterior, +z head.
  const AXES = [['L', [1, 0, 0], '#f0a63a'], ['R', [-1, 0, 0], '#f0a63a'], ['P', [0, 1, 0], '#5aa9ff'],
                ['A', [0, -1, 0], '#5aa9ff'], ['H', [0, 0, 1], '#e8ecf2'], ['F', [0, 0, -1], '#e8ecf2']];
  const orient = document.createElement('canvas'); orient.className = 'orient'; orient.dataset.role = 'orient';
  orient.setAttribute('aria-hidden', 'true'); canvas.parentElement?.append(orient);
  const inv = new THREE.Quaternion();
  function orientLabels() {
    inv.copy(camera.quaternion).invert(); const out = {};
    for (const [k, v] of AXES) { const q = new THREE.Vector3(...v).applyQuaternion(inv); out[k] = [q.x, -q.y, q.z]; }
    return out;                                               // screen x right, y DOWN, z toward the viewer; unit length
  }
  function drawOrient() {
    const px = Math.round(64 * Math.min(window.devicePixelRatio || 1, 2)); if (orient.width !== px) orient.width = orient.height = px;
    const g = orient.getContext('2d'), c = px / 2, R = px * 0.3, L = orientLabels();
    g.clearRect(0, 0, px, px);
    for (const [k, , col] of [...AXES].sort((a, b) => L[a[0]][2] - L[b[0]][2])) {   // far arms first
      const [x, y, z] = L[k], ex = c + x * R, ey = c + y * R, a = z < -0.2 ? 0.45 : 1;
      g.globalAlpha = a; g.strokeStyle = col; g.lineWidth = px / 40;
      g.beginPath(); g.moveTo(c, c); g.lineTo(ex, ey); g.stroke();
      g.fillStyle = 'rgba(11,19,34,.85)'; g.beginPath(); g.arc(c + x * R * 1.28, c + y * R * 1.28, px * 0.105, 0, 7); g.fill();
      g.fillStyle = col; g.font = `700 ${Math.round(px * 0.15)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(k, c + x * R * 1.28, c + y * R * 1.28 + px * 0.008);
    }
    g.globalAlpha = 1;
  }
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.minDistance = 180; controls.maxDistance = 1200; controls.target.set(0, 0, 0);
  let seeThrough = true, last = null, size = 0;
  camera.position.set(260, -420, 160); camera.up.set(0, 0, 1); camera.lookAt(0, 0, 0);

  function resize() {
    const w = Math.max(64, Math.round(canvas.clientWidth || 400)), h = Math.max(64, Math.round(canvas.clientHeight || w));
    if (w * 10000 + h === size) return; size = w * 10000 + h;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  // the detector square sits between the eye and the heart when looking down the beam: fade it so it does not tint the view
  const dv = new THREE.Vector3();
  function placeLabels() {
    const show = new Set();
    if (last && tree && (mode.labels || last.sel)) {
      dv.copy(camera.position).normalize();
      const placed = [];
      // the selected segment first, so it always gets its label; others nudged up/down off each other, else left out
      // all segments with Labels on; the selected one always (as on the angiogram)
      const shownGrafts = graftDefs.filter(g => lastVisible?.has(g.id)).map(g => g.id);
      const ids = (mode.labels ? [...segmentsShown(tree, last.sys, last), ...shownGrafts] : [last.sel]).sort((a, b) => (b === last.sel) - (a === last.sel));
      for (const id of ids) {
        const p = GRAFT_IDS.includes(id) ? polylineMidpoint(paths.get(id) || []) : segmentMidpoint(tree, id); if (!p) continue;
        // with the heart opaque, a label on the far side of the heart would float over the wrong vessel: hide it
        if (!seeThrough && p[0] * dv.x + p[1] * dv.y + p[2] * dv.z < -10) continue;
        const [x, y] = api.screen(p), w = 9 + 7 * labelOf(id).length, h = 17;
        const spot = [0, -18, 18, -36, 36].map(dy => ({ x, y: y + dy }))
          .find(c => !placed.some(q => Math.abs(q.x - c.x) < (q.w + w) / 2 + 2 && Math.abs(q.y - c.y) < h + 1));
        if (!spot) continue;
        placed.push({ ...spot, w });
        const e = pill(id, labelOf(id)); e.style.left = `${spot.x}px`; e.style.top = `${spot.y}px`; e.classList.toggle('sel', id === last.sel); show.add(id);
      }
    }
    if (PL && mode.planes) for (const [k, t] of [['av', 'AV groove plane'], ['iv', 'Interventricular plane']]) {
      const c = PL[k].centre, [x, y] = api.screen(c), e = pill('plane-' + k, t, 'plane-' + k);
      e.style.left = `${x}px`; e.style.top = `${y}px`; show.add('plane-' + k);
    }
    for (const [k, e] of labelEls) e.style.display = show.has(k) ? '' : 'none';
  }
  function frame() { resize();
    if (last) { const { d } = imageBasis(last.lao, last.cra); dv.copy(camera.position).normalize();
      det.material.opacity = dv.x * d[0] + dv.y * d[1] + dv.z * d[2] > 0.9 ? 0.05 : 0.25; }
    renderer.render(scene, camera); drawOrient(); placeLabels(); }
  // per-sample colour by foreshortening of the vessel element at this beam: 1 − sin(angle to the beam)
  const fsOf = (t, d) => { const c = Math.abs(t[0] * d[0] + t[1] * d[1] + t[2] * d[2]); return 1 - Math.sqrt(Math.max(0, 1 - c * c)); };
  let fsApplied = false;
  function applyColours(state) {
    if (!mode.fs && !fsApplied) return;                      // nothing to do: no per-draw material recompiles
    const { d } = imageBasis(state.lao, state.cra), switching = mode.fs !== fsApplied; fsApplied = mode.fs;
    for (const [id, m] of tubes) {
      if (id.startsWith('marker')) continue;                   // metal is metal-coloured in every mode
      if (switching) { m.material.vertexColors = mode.fs; m.material.color.set(mode.fs ? 0xffffff : colourOf(id)); m.material.needsUpdate = true; }
      if (!mode.fs) continue;
      const T = tangents.get(id), col = m.geometry.attributes.color, n = T.length;
      for (let i = 0; i < n; i++) { const [r, g, b] = scoreColour(fsOf(T[i], d));
        for (let k = 0; k < SIDES; k++) col.setXYZ(i * SIDES + k, r / 255, g / 255, b / 255); }
      const [r0, g0, b0] = scoreColour(fsOf(T[0], d)), [r1, g1, b1] = scoreColour(fsOf(T[n - 1], d));
      col.setXYZ(n * SIDES, r0 / 255, g0 / 255, b0 / 255); col.setXYZ(n * SIDES + 1, r1 / 255, g1 / 255, b1 / 255);
      col.needsUpdate = true;
    }
  }
  function applySelection(state) {
    if (highlightId === state.sel) return;
    if (highlight) { scene.remove(highlight); highlight.geometry.dispose(); highlight = null; }
    highlightId = state.sel;
    if (!state.sel) return;
    let pts, r;
    if (GRAFT_IDS.includes(state.sel)) { pts = paths.get(state.sel); r = radii.get(state.sel); }
    else if (tree?.syntax_index[state.sel]) { const s = tree.syntax_index[state.sel], v = tree.vessels.find(x => x.id === s.vessel);
      pts = segmentPolyline(tree, state.sel); r = v?.r.slice(s.from, s.to + 1); }
    if (!pts || !r || pts.length < 2) return;
    highlight = new THREE.Mesh(tubeGeometry(THREE, pts, r.map(x => x * 1.45 + 0.4), { sides: 12 }),
      new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xf0a63a, emissiveIntensity: 0.9, transparent: true, opacity: 0.85, depthWrite: false }));
    highlight.renderOrder = 5; scene.add(highlight);
  }
  function applyVisibility(visibleIds) {
    for (const [id, m] of tubes) {
      const on = !visibleIds || visibleIds.has(id);
      m.visible = on && !mode.centrelines; lines.get(id).visible = on && mode.centrelines;
      ghosts.get(id).visible = on && !seeThrough && !mode.centrelines;
    }
    planeMeshes.forEach(m => { m.visible = mode.planes; });
  }
  let lastVisible = null;
  function draw(state, visibleIds) {
    last = state; if (visibleIds) lastVisible = visibleIds;
    applyVisibility(lastVisible); applyColours(state); applySelection(state);
    const { d } = imageBasis(state.lao, state.cra);
    beamGeo.setFromPoints([new THREE.Vector3(-d[0] * 380, -d[1] * 380, -d[2] * 380), new THREE.Vector3(d[0] * 330, d[1] * 330, d[2] * 330)]);
    beam.computeLineDistances();
    det.position.set(d[0] * 330, d[1] * 330, d[2] * 330); det.lookAt(0, 0, 0);
    frame();
  }
  setAnatomy({ vessels, grafts, markers, tree });
  controls.addEventListener('change', frame);
  (function loop() { if (controls.update()) frame(); requestAnimationFrame(loop); })();

  const api = {
    ready: true, seeThroughDefault: true, seeThrough: true, draw, resize: frame, setAnatomy,
    // the low tier's step down: 1× pixels from the next frame
    setMaxDpr(n) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, n)); size = 0; frame(); },
    has: (id) => tubes.has(id) && tubes.get(id).visible,
    setSeeThrough(on) {
      seeThrough = on; this.seeThrough = on;
      for (const m of heartMats) { m.opacity = on ? 0.32 : 1; m.transparent = on; m.depthWrite = !on; m.needsUpdate = true; }
      applyVisibility(lastVisible); frame();
    },
    setMode(name, on) { mode[name] = on; if (last) draw(last); },
    modeState() { const any = (m) => [...m.values()].some(x => x.visible);
      return { tubesVisible: any(tubes), linesVisible: any(lines), planesVisible: planeMeshes.some(m => m.visible), highlighted: highlight ? highlightId : null, ghosts: any(ghosts) }; },
    // for tests: each sample's drawn colour class vs the class its own foreshortening calls for
    fsSamples() { const { d } = imageBasis(last.lao, last.cra), cls = ([r, g]) => g > r + 40 ? 'green' : r > g + 60 ? 'red' : 'amber', out = [];
      for (const [id, m] of tubes) { if (!m.visible || id.startsWith('marker')) continue; const T = tangents.get(id), col = m.geometry.attributes.color;
        for (let i = 2; i < T.length - 2; i += 12) out.push({ id, i, colour: cls([col.getX(i * SIDES) * 255, col.getY(i * SIDES) * 255]), expected: cls(scoreColour(fsOf(T[i], d))) }); }
      return out; },
    detectorView() {
      const { d, up } = imageBasis(last.lao, last.cra);
      const dist = camera.position.length();
      camera.position.set(d[0] * dist, d[1] * dist, d[2] * dist); camera.up.set(...up); camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0); controls.update(); frame();
    },
    orientLabels,
    // screen position (pixels, y down) of a 3D point — for the alignment test
    screen(p) { const v = new THREE.Vector3(...p).project(camera); return [(v.x * 0.5 + 0.5) * canvas.clientWidth, (0.5 - v.y * 0.5) * canvas.clientHeight]; },
    // mean brightness of the central third of the panel (one pixel can land on a vessel, which see-through leaves alone)
    centrePixel() {
      frame(); const gl = renderer.getContext(), W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
      const w = Math.floor(W / 3), h = Math.floor(H / 3), px = new Uint8Array(w * h * 4);
      gl.readPixels(w, h, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let sum = 0; for (let i = 0; i < px.length; i += 4) sum += (px[i] + px[i + 1] + px[i + 2]) / (3 * 255) * (px[i + 3] / 255);
      return sum / (w * h);
    },
    dispose() { controls.dispose(); renderer.dispose(); },
  };
  return api;
}
