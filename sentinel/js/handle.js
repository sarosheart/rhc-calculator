// The Handle window: the SENTINEL handle as in the guide's photos (handle.glb), posed from the frame's handle numbers —
// the gap between front and rear handles IS the sheath pull-back — with the control to work lit in its own colour and an
// arrow showing which way it moves. Sizes are estimates from the guide's photos (About the models).
import { tubeArrays } from './render/tube.js';

// which meshes light for each control (the rear-handle moves light the rear handle and the knob riding on it)
export const CONTROL_OBJ = Object.freeze({ slider1: ['Slider1Tab'], knob2: ['Knob2Band'], rear_handle: ['RearHandle', 'Knob2Band'],
  rear_turn: ['RearHandle', 'Knob2Band'], slider3: ['Slider3Cap'], wire: ['Torquer'], r_lock: ['RearLock'], device: ['FrontHandle'] });
// where each control sits along the handle (mm from its nose), for the camera and the arrow; the ones on the rear handle
// ride back with the gap
export const HANDLE_X = Object.freeze({ slider1: 75, knob2: 226, rear_handle: 300, rear_turn: 250, slider3: 480, wire: 540,
  r_lock: 444, device: 140 });
const ON_REAR = new Set(['knob2', 'rear_handle', 'rear_turn', 'slider3', 'wire', 'r_lock']);
const ANCHOR = { slider1: 'ANCHOR_slider1', knob2: 'ANCHOR_knob2', rear_handle: 'ANCHOR_rear_handle', rear_turn: 'ANCHOR_rear_turn',
  slider3: 'ANCHOR_slider3', wire: 'ANCHOR_wire', r_lock: 'ANCHOR_r_lock', device: 'ANCHOR_device' };
export const VIEW_DIR = Object.freeze([0, 330, 700]);      // from the operator's side and a little above, as in the video

// a window of width hw centred near hx that does not cut the printed name (lo–hi) in half: slid the shorter way
export function clearOf(hx, hw, [lo, hi], margin = 6) {
  for (const edge of [hx - hw / 2, hx + hw / 2]) {
    if (lo - margin < edge && edge < hi + margin) {
      const a = (lo - margin) - edge, b = (hi + margin) - edge;
      return hx + (Math.abs(a) <= Math.abs(b) ? a : b);
    }
  }
  return hx;
}
// the camera for the control to work next (none: the whole handle). The window shows hw mm of the handle across its
// width: the shared view fits a sphere to the window's SHORT side, so for a wide window the sphere is shrunk to match
// (aspect = width ÷ height, vfov in degrees).
export function handlePreset(control, gap, nameSpan, aspect = 1, vfov = 32) {
  const hw = !control ? 600 : control === 'device' ? 330 : 280;
  const hx = !control ? 255 : HANDLE_X[control] + (ON_REAR.has(control) ? gap : 0);
  const v = vfov * Math.PI / 360, hf = Math.atan(Math.tan(v) * aspect);
  const d = (hw / 2) / Math.tan(hf);                            // distance that shows hw across
  const radius = Math.max(d * Math.sin(Math.min(v, hf)), 45);   // what the view's sphere fit needs for that distance
  return { target: [clearOf(hx, hw, nameSpan), 0, 0], dir: [...VIEW_DIR], radius };
}

export function createHandle(THREE, view, model) {
  view.scene.add(model);
  const node = (n) => model.getObjectByName(n);
  const N = { Slider1: node('Slider1'), Rear: node('Rear'), Knob2: node('Knob2'), Slider3: node('Slider3'), Torquer: node('TorquerAt') };
  for (const [k, v] of Object.entries(N)) if (!v) throw new Error(`handle.glb has no ${k}`);
  // the printed name's span along the handle (the camera never cuts it in half)
  const box = new THREE.Box3().setFromObject(node('SentinelText')); const nameSpan = [box.min.x, box.max.x];
  // each lit mesh gets its own material, so lighting one never lights another that shared it
  const lit = {};
  for (const names of Object.values(CONTROL_OBJ)) for (const n of names) {
    const o = node(n); if (!o || lit[n]) continue;
    const meshes = []; o.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); meshes.push(m); } });
    lit[n] = meshes;
  }
  // the wire from the back of Slider 3's rod to the torquer, drawn here (its length changes with the wire)
  const wireMat = new THREE.MeshStandardMaterial({ color: '#d7dbe2', metalness: 0.9, roughness: 0.22, emissive: '#3a3d42' });
  const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1, 10), wireMat);
  wire.rotation.z = Math.PI / 2; N.Rear.add(wire);
  // the arrow: a straight one for slides, a ring for turns, pointing down at the lock for the lock
  const arrowMat = new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.95, depthTest: false });
  const arrow = new THREE.Group(); arrow.renderOrder = 10; arrow.visible = false; model.add(arrow);
  const geom = (a) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a.position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3)); g.setIndex(new THREE.BufferAttribute(a.index, 1)); return g; };
  const straight = new THREE.Group(); {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 34, 16), arrowMat); shaft.rotation.z = Math.PI / 2; shaft.position.x = -6;
    const head = new THREE.Mesh(new THREE.ConeGeometry(5.5, 14, 24), arrowMat); head.rotation.z = -Math.PI / 2; head.position.x = 17;
    straight.add(shaft, head); }
  const turn = new THREE.Group(); {
    const pts = []; for (let k = 0; k <= 40; k++) { const a = (-0.15 + 1.25 * k / 40) * Math.PI; pts.push([0, 20 * Math.cos(a), 20 * Math.sin(a)]); }
    turn.add(new THREE.Mesh(geom(tubeArrays(pts, 1.8, { sides: 10 })), arrowMat));
    const a = 1.1 * Math.PI, head = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 20), arrowMat);
    head.position.set(0, 20 * Math.cos(a), 20 * Math.sin(a));
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -Math.sin(a), Math.cos(a)));
    turn.add(head); }
  const down = new THREE.Group(); {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 16, 16), arrowMat); shaft.position.y = 12;
    const head = new THREE.Mesh(new THREE.ConeGeometry(5.5, 12, 24), arrowMat); head.rotation.z = Math.PI; head.position.y = 0;
    down.add(shaft, head); }
  arrow.add(straight, turn, down);
  for (const o of [straight, turn, down]) o.traverse((m) => { m.renderOrder = 10; });

  let h = [0, 0, 0, 0, 0, 0], focused = null, pulse = 0;
  function update(nums) {
    h = nums;
    const [gap, s1, knob, roll, s3, w] = nums;
    N.Slider1.position.x = s1; N.Rear.position.x = gap;
    N.Rear.rotation.x = roll * Math.PI / 180; N.Knob2.rotation.x = knob * Math.PI / 180;
    N.Slider3.position.x = -s3;
    const tx = 585 - 0.5 * Math.max(w, -5); N.Torquer.position.x = tx;
    const x0 = 506, x1 = tx - 7; wire.scale.y = Math.max(0.1, x1 - x0); wire.position.set((x0 + x1) / 2, 0, 0);
    if (focused) place(focused);
    view.markDirty();
  }
  const tmp = new THREE.Vector3();
  function place({ control, arrow: kind }) {
    const a = node(ANCHOR[control]); if (!a) return;
    model.updateMatrixWorld(true); a.getWorldPosition(tmp); model.worldToLocal(tmp);
    straight.visible = kind === 'left' || kind === 'right'; turn.visible = kind === 'turn'; down.visible = kind === 'lock';
    if (kind === 'turn') arrow.position.set(tmp.x, 0, 0);           // a ring round the handle's axis
    else arrow.position.set(tmp.x, tmp.y + 22, tmp.z);
    arrow.rotation.set(0, 0, 0);
    if (kind === 'left') arrow.rotation.y = Math.PI;
    arrow.visible = !!kind;
  }
  // the control to work (a move: {control, arrow}) lit and arrowed; null: nothing
  function focus(move) {
    focused = move && move.control ? move : null;
    for (const [n, meshes] of Object.entries(lit)) {
      const on = !!focused && (CONTROL_OBJ[focused.control] || []).includes(n);
      for (const m of meshes) { m.material.emissive.copy(m.material.color); m.material.emissiveIntensity = on ? 0.5 : 0; }
    }
    if (focused) place(focused); else arrow.visible = false;
    since = 0; view.markDirty();
  }
  // a gentle pulse on the lit control, redrawn about 12 times a second; steady with reduced motion or off screen
  let since = 0;
  function tick(dt, { reduced = false, visible = true } = {}) {
    if (!focused) return;
    pulse += dt; since += dt;
    if (reduced || !visible) {
      if (reduced && since > 0) { since = -Infinity; glowAll(0.5); }
      return;
    }
    if (since < 0.08) return;
    since = 0;
    glowAll(0.38 + 0.22 * Math.sin(pulse * 3.2));
  }
  function glowAll(k) {
    for (const n of CONTROL_OBJ[focused.control] || []) for (const m of lit[n] || []) m.material.emissiveIntensity = k;
    view.markDirty();
  }
  const preset = (control) => handlePreset(control, h[0], nameSpan, view.camera.aspect || 1, view.camera.fov);
  return { update, focus, tick, nameSpan, preset, focused: () => focused,
    node };
}
