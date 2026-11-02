// The Hands window's groin, shared by every device: the same world as Inside, seen from where the operator stands (the
// patient's right), with the skin whole so only what is outside the body shows — the drape, the guidewire and the procedure
// sheath. A device mode adds its layer; the part the next move works on can glow, and an arrow shows the move.
import { W } from '../scene/world.js';
import { wirePath, sheathPath, TRACT_LEN } from '../scene/paths.js';
import { makeStrand } from './strands.js';
import { COLORS, buildHub, makeArrow } from './look.js';

const SQ = Math.SQRT1_2;

// the skin of the groin, whole: a gentle dome — the thigh falls away laterally and caudally. The puncture is not cut out
// of it: a hole showed the empty window behind the skin as a jagged black patch whenever nothing was in the tract (Saro:
// "also wtf?"). A wire or sheath simply goes into the skin; the puncture itself is a small dark nick on it (below).
export const skinY = (x, z) => Math.max(-40, -0.0018 * (z - 10) ** 2 * (z > 10 ? 1 : 0.35) - 0.0004 * Math.max(0, x - 60) ** 2);
export function skinSurface(THREE) {
  const xs = [], zs = [];
  for (let x = -160; x <= 280; x += 4) xs.push(x);
  for (let z = -150; z <= 150; z += 4) zs.push(z);
  const pos = [], uv = [], idx = [], nz = zs.length;
  for (const x of xs) for (const z of zs) { pos.push(x, skinY(x, z), z); uv.push(x / 40, z / 40); }
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < nz - 1; j++) {
    const a = i * nz + j, b = a + nz, c = b + 1, d = a + 1;
    idx.push(a, c, b, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
// where the tract meets the skin, and the nick's half-length along the tract (its width is 0.7 of that): 1.3 mm for a 5–8F
// puncture unless the mode says (shared.puncture); it shrinks as the stitch gathers the tissue
export const PUNCTURE = Object.freeze([TRACT_LEN * Math.cos(W.ANGLE * Math.PI / 180), 0, 0]);
export function nickSize(shared) {
  const r = shared.puncture || 1.3, closed = Math.min(1, Math.max(shared.gather || 0, shared.tractClose || 0));
  return [r * (1 - 0.45 * closed), 0.7 * r * (1 - 0.45 * closed)];
}
function punctureNick(THREE) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(70,18,16,1)'); grad.addColorStop(0.55, 'rgba(110,40,32,0.92)'); grad.addColorStop(1, 'rgba(150,70,58,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.RingGeometry(0, 1, 40, 1), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.set(PUNCTURE[0], skinY(PUNCTURE[0], 0) + 0.02, 0); m.renderOrder = 1;
  return m;
}

export function createHands(view) {
  const { THREE, scene } = view;
  const skin = new THREE.Mesh(skinSurface(THREE), new THREE.MeshPhysicalMaterial({ color: COLORS.skin, roughness: 0.6, sheen: 0.45,
    sheenColor: '#ffe0d0' }));
  scene.add(skin);
  const nick = punctureNick(THREE); scene.add(nick);
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
    wire.update(shared.wireShown ? (shared.wire || wirePath(140, 70)) : null);   // a device on the wire routes it (exit port)
    sheath.update(shared.sheathShown ? sheathPath(14, 14) : null);
    hub.visible = shared.sheathShown > 0;
    const [rx, rz] = nickSize(shared); nick.scale.set(rx, rz, 1);
    view.markDirty();
  }
  return { update, focus, focused: () => focused };
}
