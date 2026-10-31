// The Hands window's groin, shared by every device: the same world as Inside, seen from where the operator stands (the
// patient's right), with the skin whole so only what is outside the body shows — the drape, the guidewire and the procedure
// sheath. A device mode adds its layer; the part the next move works on can glow, and an arrow shows the move.
import { W } from '../scene/world.js';
import { wirePath, sheathPath, TRACT_LEN } from '../scene/paths.js';
import { makeStrand } from './strands.js';
import { COLORS, buildHub, makeArrow } from './look.js';

const SQ = Math.SQRT1_2;

// the skin of the groin, whole, with the puncture where the tract comes out
function skinSurface(THREE) {
  const ex = TRACT_LEN * Math.cos(W.ANGLE * Math.PI / 180), rx = W.TRACT_R / Math.sin(W.ANGLE * Math.PI / 180), rz = W.TRACT_R;
  const xs = [], zs = [];
  for (let x = -160; x <= 280; x += x > ex - 12 && x < ex + 12 ? 0.5 : 4) xs.push(x);
  for (let z = -150; z <= 150; z += Math.abs(z) < 12 ? 0.5 : 4) zs.push(z);
  const pos = [], uv = [], idx = [], nz = zs.length;
  for (const x of xs) for (const z of zs) {
    // a gentle dome: the thigh falls away laterally and caudally
    const y = -0.0018 * (z - 10) ** 2 * (z > 10 ? 1 : 0.35) - 0.0004 * Math.max(0, x - 60) ** 2;
    pos.push(x, Math.max(-40, y), z); uv.push(x / 40, z / 40);
  }
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < nz - 1; j++) {
    const a = i * nz + j, b = a + nz, c = b + 1, d = a + 1;
    const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
    if (((cx - ex) / rx) ** 2 + (cz / rz) ** 2 < 1) continue;
    idx.push(a, c, b, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

export function createHands(view) {
  const { THREE, scene } = view;
  const skin = new THREE.Mesh(skinSurface(THREE), new THREE.MeshPhysicalMaterial({ color: COLORS.skin, roughness: 0.6, sheen: 0.45,
    sheenColor: '#ffe0d0' }));
  scene.add(skin);
  // a sterile drape round the field, so the device reads against something
  const drape = new THREE.Mesh(new THREE.RingGeometry(95, 400, 64, 1), new THREE.MeshStandardMaterial({ color: '#2d5a8c', roughness: 0.9 }));
  drape.rotation.x = -Math.PI / 2; drape.position.set(TRACT_LEN * SQ + 20, -1.5, 0); scene.add(drape);
  const wire = makeStrand(THREE, { color: COLORS.wire, radius: 0.48, sides: 10, metal: 0.9, rough: 0.28 });
  const sheath = makeStrand(THREE, { color: COLORS.procSheath, radius: 1.3, sides: 16, rough: 0.3, physical: true });
  for (const s of [wire, sheath]) scene.add(s.group);
  const hub = buildHub(THREE); scene.add(hub);
  const arrow = makeArrow(THREE, 24); arrow.visible = false; scene.add(arrow);

  // target: { nodes: [names], tip, dir }; resolve(name) → an Object3D of the current device layer
  let glowing = [], focused = [];
  function focus(target, resolve = () => null) {
    for (const m of glowing) { m.emissive?.set('#000000'); m.emissiveIntensity = 0; }
    glowing = []; focused = []; arrow.visible = false;
    if (!target) { view.markDirty(); return; }
    const objs = target.nodes.flatMap((n) => (n === 'wire' ? wire.group : n === 'sheath' ? hub : resolve(n, target))).filter(Boolean);
    focused = objs;
    for (const o of objs) o.traverse((m) => { if (m.isMesh && m.material.emissive) { m.material.emissive.set(COLORS.glow); m.material.emissiveIntensity = 0.16; glowing.push(m.material); } });
    if (target.tip && target.dir) { arrow.point(target.tip, target.dir); arrow.visible = true; }
    view.markDirty();
  }
  function update(shared) {
    wire.update(shared.wireShown ? wirePath(140, 70) : null);
    sheath.update(shared.sheathShown ? sheathPath(14, 14) : null);
    hub.visible = shared.sheathShown > 0;
    view.markDirty();
  }
  return { update, focus, focused: () => focused };
}
