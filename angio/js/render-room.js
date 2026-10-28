// The room view: the patient on the table, the C-arm round them and the X-ray beam through the heart — DICOM LPS mm with
// the isocentre at the origin, so +y is DOWN (posterior) for a supine patient and +z is toward the head.
// The C-arm is built the way it moves: an outer group turns about the patient's long axis (rotation, LAO/RAO) and an inner
// one tilts within the C toward head or feet (angulation, CRA/CAU) — the order geometry.js composes them in. In the inner
// frame the detector face is SID − SOD above the isocentre, the focal spot SOD below it, and the arc passes the head end
// through the carriage. Drag the detector to move the C-arm (dragStep); drag anything else to turn the room.
// Drawn only when something changed and only while shown (setActive).
import { carmPoint, dragStep } from './geometry.js';
import { tubeGeometry } from './tubes.js';
import { SID, SOD, DET_MM } from './xray-config.js';

const DET = SID - SOD;          // isocentre → detector face, mm
const ARC = 780;                // radius of the C
const D2R = Math.PI / 180;

// the two cameras: the operator's side (the patient's right; head on screen left) and from the foot of the table
export const PRESETS = { side: { pos: [-3500, -1500, 200], target: [0, 120, 250] }, feet: { pos: [0, -1250, -3900], target: [0, 150, 0] } };
// where a point fixed to the C-arm (its own frame) shows on a w × h canvas through this camera, at any angles
export function roomProjector(THREE, camera, local, w, h) {
  const v = new THREE.Vector3();
  return (lao, cra) => { v.set(...carmPoint(local, lao, cra)).project(camera); return [(v.x * 0.5 + 0.5) * w, (0.5 - v.y * 0.5) * h]; };
}

// body: the thorax bones' extent { minY, maxY, minZ, maxZ, halfWidth } (mm), so the patient and table fit the anatomy
// tier 'low' (tier.js): no antialiasing, 1× pixels
export function createRoom(canvas, THREE, { heartScene, body, onDrag = () => {}, onUser = () => {}, tier = 'high' }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: tier !== 'low', alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier === 'low' ? 1 : 2));
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3442, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(-1500, -2500, 800); scene.add(key);
  const camera = new THREE.PerspectiveCamera(32, 1, 50, 20000); camera.up.set(0, -1, 0);
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
  const at = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };

  // table and floor
  const top = body.maxY + 25, floor = top + 880;
  const zHead = body.maxZ + 380, zFoot = body.minZ - 1250, tLen = zHead - zFoot;
  const tableMat = mat(0x3d4654, { roughness: 0.8 });
  scene.add(at(new THREE.BoxGeometry(540, 45, tLen), tableMat, 0, top + 22, (zHead + zFoot) / 2));
  scene.add(at(new THREE.BoxGeometry(300, floor - top - 45, 420), tableMat, 0, (top + 45 + floor) / 2, zFoot + 520));
  const fl = at(new THREE.CylinderGeometry(2600, 2600, 10, 64), mat(0x161d29, { roughness: 1 }), 0, floor + 5, 200); scene.add(fl);

  // the patient, translucent, with the heart inside
  const skin = mat(0xc9d3df, { transparent: true, opacity: 0.4, depthWrite: false });
  const front = body.minY - 30, hw = body.halfWidth + 25, hd = (top - front) / 2, cy = (top + front) / 2;
  const zSh = body.maxZ + 20, zHip = body.minZ - 330;
  const limb = (r, x, y, z0, z1) => { const g = new THREE.CapsuleGeometry(r, Math.abs(z0 - z1), 6, 16); const m = at(g, skin, x, y, (z0 + z1) / 2);
    m.rotation.x = Math.PI / 2; return m; };
  const torso = limb(hw, 0, cy, zSh - hw, zHip + hw); torso.scale.set(1, 1, hd / hw); scene.add(torso);   // flattened front to back
  scene.add(at(new THREE.SphereGeometry(95, 24, 16), skin, 0, top - 105, zSh + 190));
  scene.add(limb(55, 0, top - 95, zSh - 10, zSh + 100));
  for (const sx of [-1, 1]) {
    scene.add(limb(68, sx * 105, top - 72, zHip, zHip - 820));
    scene.add(limb(42, sx * (hw + 55), top - 55, zSh - 40, zHip - 120));
  }
  heartScene.traverse(o => { if (o.isMesh) o.material = mat(0xc0392b, { roughness: 0.5, emissive: 0x3a0d0a }); });
  scene.add(heartScene);

  // the C-arm: carm (rotation about z) ⊃ orbit (angulation about x); stand and L-arm fixed to the floor beyond the head
  const steel = mat(0xd5dbe3, { roughness: 0.35, metalness: 0.2 }), dark = mat(0x55606e, { roughness: 0.5 });
  const carm = new THREE.Group(), orbit = new THREE.Group(); carm.add(orbit); scene.add(carm);
  const arcPts = []; for (let i = 0; i <= 64; i++) { const t = Math.PI * i / 64; arcPts.push([0, -ARC * Math.cos(t), ARC * Math.sin(t)]); }
  orbit.add(new THREE.Mesh(tubeGeometry(THREE, arcPts, arcPts.map(() => 42), { sides: 14 }), steel));
  carm.add(at(new THREE.BoxGeometry(200, 260, 170), dark, 0, 0, ARC + 40));                            // carriage on the C
  const zL = ARC + 620;
  scene.add(at(new THREE.CylinderGeometry(80, 80, zL - ARC - 120, 24).rotateX(Math.PI / 2), dark, 0, 0, (ARC + 120 + zL) / 2));   // L-arm
  scene.add(at(new THREE.BoxGeometry(260, floor, 260), dark, 0, floor / 2, zL));                       // stand to the floor
  // detector: housing with an amber field on its face; the arm to the end of the C
  const detParts = new THREE.Group(); orbit.add(detParts);
  detParts.add(at(new THREE.BoxGeometry(420, 110, 420), steel, 0, -DET - 55, 0));
  const face = at(new THREE.PlaneGeometry(DET_MM, DET_MM), new THREE.MeshBasicMaterial({ color: 0xf0a63a, transparent: true, opacity: 0.75, side: THREE.DoubleSide }), 0, -DET + 0.5, 0);
  face.rotation.x = Math.PI / 2; detParts.add(face);
  detParts.add(at(new THREE.CylinderGeometry(34, 34, ARC - DET - 110, 16), steel, 0, -(ARC + DET + 110) / 2, 0));
  // X-ray tube under the table, at the other end of the C
  orbit.add(at(new THREE.BoxGeometry(260, 190, 300), steel, 0, SOD + 70, 0));
  orbit.add(at(new THREE.CylinderGeometry(95, 95, 330, 24).rotateZ(Math.PI / 2), dark, 0, SOD + 60, 0));
  // the beam: focal spot → the DET_MM field at the detector plane, through the heart
  const h = DET_MM / 2, bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute([0, SOD, 0, -h, -DET, -h, h, -DET, -h, h, -DET, h, -h, -DET, h], 3));
  bg.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 1]);
  const beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xf0a63a, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
  beam.renderOrder = 3; orbit.add(beam);

  // labels over the canvas
  const host = canvas.parentElement, label = (t) => { const e = document.createElement('span'); e.className = 'room-label'; e.textContent = t;
    e.setAttribute('aria-hidden', 'true'); host.append(e); return e; };
  const lDet = label('Detector'), lTube = label('X-ray tube');

  // cameras: the operator's side (the patient's right; head on screen left) and from the foot of the table
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enablePan = false; controls.minDistance = 1200; controls.maxDistance = 7000;
  function preset(name) { const p = PRESETS[name] || PRESETS.side; camera.position.set(...p.pos); camera.up.set(0, -1, 0);
    controls.target.set(...p.target); controls.update(); render(); }

  let active = false, dirty = true, renders = 0, size = 0;
  function resize() {
    const w = Math.max(64, Math.round(canvas.clientWidth || 400)), hh = Math.max(64, Math.round(canvas.clientHeight || w));
    if (w * 10000 + hh === size) return; size = w * 10000 + hh;
    renderer.setSize(w, hh, false); camera.aspect = w / hh; camera.updateProjectionMatrix();
  }
  const world = (o, p) => { o.updateWorldMatrix(true, false); return new THREE.Vector3(...p).applyMatrix4(o.matrixWorld); };
  function screen(p) { const v = new THREE.Vector3(...p).project(camera); return [(v.x * 0.5 + 0.5) * canvas.clientWidth, (0.5 - v.y * 0.5) * canvas.clientHeight]; }
  function place(e, p, dy) { const [x, y] = screen(p); e.style.left = `${x}px`; e.style.top = `${y + dy}px`; }
  function render() {
    if (!active) { dirty = true; return; }
    dirty = false; resize(); renderer.render(scene, camera); renders++;
    const d = world(orbit, [0, -DET - 130, 0]), t = world(orbit, [0, SOD + 190, 0]);
    place(lDet, d.toArray(), -14); place(lTube, t.toArray(), 14);
  }
  let last = null;
  function draw(state) { last = state; carm.rotation.z = state.lao * D2R; orbit.rotation.x = -state.cra * D2R; render(); }

  // dragging the detector: each pointer move goes through dragStep with the grabbed point's own projection
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let lock = 'both', drag = null;
  const pick = (e) => { const b = canvas.getBoundingClientRect(); ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera); return ray; };
  const onDetector = (e) => !!pick(e).intersectObject(detParts, true).length;
  const toLocal = (p) => { orbit.updateWorldMatrix(true, false); return orbit.worldToLocal(p.clone()).toArray(); };
  // capture: runs before the orbit controls' own handler on the same canvas, so a grab of the detector never also turns the room
  canvas.addEventListener('pointerdown', (e) => {
    if (!last || drag || e.button > 0) return;
    const hit = pick(e).intersectObject(detParts, true)[0]; if (!hit) return;
    e.stopImmediatePropagation(); e.preventDefault(); controls.enabled = false; canvas.setPointerCapture?.(e.pointerId);
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, cur: { lao: last.lao, cra: last.cra },
      project: roomProjector(THREE, camera, toLocal(hit.point), canvas.clientWidth, canvas.clientHeight) };
    onUser(); canvas.style.cursor = 'grabbing';
  }, { capture: true });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) { if (e.pointerType === 'mouse' && last) canvas.style.cursor = onDetector(e) ? 'grab' : ''; return; }
    if (e.pointerId !== drag.id) return;
    drag.cur = dragStep(drag.project, drag.cur, [e.clientX - drag.x, e.clientY - drag.y], { lock });
    drag.x = e.clientX; drag.y = e.clientY; onDrag(drag.cur.lao, drag.cur.cra);
  });
  const end = (e) => { if (!drag || e.pointerId !== drag.id) return; drag = null; controls.enabled = true; canvas.style.cursor = ''; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  // on a phone a vertical swipe scrolls the page (OrbitControls had set touch-action: none); a touch on the detector does not
  canvas.style.touchAction = 'pan-y';
  canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t && last && onDetector(t)) e.preventDefault(); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });
  controls.addEventListener('change', render);
  preset('side');

  return {
    draw, preset, setLock(m) { lock = m; },
    setMaxDpr(n) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, n)); size = 0; render(); },
    setActive(on) { active = on; if (on && dirty) render(); },
    debug: {
      ready: true, get renders() { return renders; },
      detector: () => world(orbit, [0, -DET, 0]).toArray(), source: () => world(orbit, [0, SOD, 0]).toArray(),
      head: () => [0, top - 105, zSh + 190], camera: () => camera.position.toArray(),
      // the 3D point of the detector under page CSS pixel (x, y), or null
      pickAt(x, y) { const h = pick({ clientX: x, clientY: y }).intersectObject(detParts, true)[0]; return h ? h.point.toArray() : null; },
      // page CSS pixels of a 3D point (for pointer tests)
      screen(p) { const b = canvas.getBoundingClientRect(), [x, y] = screen(p); return { x: b.left + x, y: b.top + y }; },
    },
    dispose() { controls.dispose(); renderer.dispose(); lDet.remove(); lTube.remove(); },
  };
}
