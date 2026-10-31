// The Inside window's groin, shared by every device: the right groin cut along the tract (head to the left), the femoral
// artery cut lengthwise with its arteriotomy, blood in the lumen, the guidewire and the procedure sheath. Each device mode
// adds its own layer (its parts, its strands) on top.
import { W, tractPoint } from '../scene/world.js';
import { tissueGeometry, fatTexture, normalMap } from '../scene/tissue.js';
import { vesselGeometry } from '../scene/vessel.js';
import { wirePath, sheathPath, TRACT_LEN } from '../scene/paths.js';
import { makeStrand } from './strands.js';
import { COLORS, buildHub } from './look.js';

export const geo = (THREE, a) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.position, 3)); g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
  if (a.uv) g.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
  g.setIndex(new THREE.BufferAttribute(a.index, 1));
  for (const gr of a.groups || []) g.addGroup(gr.start, gr.count, gr.materialIndex);
  return g;
};

// the upper tract squeezed shut by a figure-of-8 (`close` 0–1): fat filling the tract's band on the cut face, from the skin
// down to `depth` mm, `close` of its width
function tractPlug(close, depth = 15, r = W.TRACT_R) {
  const a = W.ANGLE * Math.PI / 180, n1 = [-Math.sin(a), Math.cos(a), 0], S = 16, from = TRACT_LEN - depth * Math.SQRT2;
  const pos = [], nrm = [], uv = [], idx = [];
  for (let i = 0; i <= S; i++) {
    const c = tractPoint(from + (TRACT_LEN - from) * i / S);
    for (const s of [-1, 1]) { pos.push(...c.map((v, j) => v + s * n1[j] * r * close)); nrm.push(0, 0, 1); uv.push(c[0] / 40 + s * 0.05, c[1] / 40); }
  }
  for (let i = 0; i < S; i++) { const p = 2 * i; idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3); }
  return { position: new Float32Array(pos), normal: new Float32Array(nrm), uv: new Float32Array(uv), index: new Uint32Array(idx) };
}

// the tract's own wall behind the cut face: a half channel (z <= 0) seen from inside
function tractChannel(THREE, from = 0, to = TRACT_LEN, r = W.TRACT_R) {
  const a = W.ANGLE * Math.PI / 180, n1 = [-Math.sin(a), Math.cos(a), 0], n2 = [0, 0, -1];
  const pos = [], nrm = [], idx = [], S = 40, K = 12;
  for (let i = 0; i <= S; i++) {
    const c = tractPoint(from + (to - from) * i / S);
    for (let k = 0; k <= K; k++) { const f = Math.PI * k / K, d = [0, 1, 2].map(j => n1[j] * Math.cos(f) + n2[j] * Math.sin(f));
      pos.push(...c.map((v, j) => v + d[j] * r)); nrm.push(...d.map(v => -v)); }
  }
  for (let i = 0; i < S; i++) for (let k = 0; k < K; k++) { const p = i * (K + 1) + k, q = p + K + 1; idx.push(p, q, q + 1, p, q + 1, p + 1); }
  return { position: new Float32Array(pos), normal: new Float32Array(nrm), index: new Uint32Array(idx) };
}

export function createInside(view) {
  const { THREE, scene } = view;
  // tissue
  const T = tissueGeometry();
  const ft = fatTexture(7), tex = new THREE.DataTexture(ft.data, ft.width, ft.height);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.needsUpdate = true;
  const nt = new THREE.DataTexture(normalMap(ft), ft.width, ft.height); nt.wrapS = nt.wrapT = THREE.RepeatWrapping; nt.needsUpdate = true;
  const fatMat = new THREE.MeshPhysicalMaterial({ map: tex, normalMap: nt, roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.4,
    side: THREE.DoubleSide });
  // the cut surfaces sit a hair behind the cut plane, so a strand or needle crossing the wall in that plane stays in view
  const CUT_Z = -0.32;
  const fat = new THREE.Mesh(geo(THREE, T.fat), fatMat); fat.position.z = CUT_Z; scene.add(fat);
  const skin = new THREE.Mesh(geo(THREE, T.skin), new THREE.MeshPhysicalMaterial({ color: COLORS.skin, roughness: 0.55,
    sheen: 0.4, sheenColor: '#ffd9c8', side: THREE.DoubleSide })); skin.position.z = CUT_Z; scene.add(skin);
  const channel = new THREE.Mesh(geo(THREE, tractChannel(THREE)), new THREE.MeshStandardMaterial({ color: '#a8603f', roughness: 0.6, side: THREE.DoubleSide }));
  channel.position.z = CUT_Z; scene.add(channel);
  const plug = new THREE.Mesh(new THREE.BufferGeometry(), fatMat); plug.position.z = CUT_Z + 0.02; plug.visible = false; scene.add(plug);
  let plugKey = '';
  // the artery, rebuilt when the hole closes
  const wallMats = [
    new THREE.MeshPhysicalMaterial({ color: COLORS.artery, roughness: 0.5, clearcoat: 0.3, side: THREE.DoubleSide }),       // adventitia
    new THREE.MeshPhysicalMaterial({ color: COLORS.intima, roughness: 0.3, clearcoat: 0.6, side: THREE.DoubleSide }),        // intima
    new THREE.MeshStandardMaterial({ color: COLORS.media, roughness: 0.55, side: THREE.DoubleSide }),                        // the cut wall
  ];
  const vessel = new THREE.Mesh(new THREE.BufferGeometry(), wallMats); vessel.position.z = CUT_Z; scene.add(vessel);
  let vkey = '';
  // blood in the lumen: a translucent sheet on the cut plane in front of the back half
  const blood = new THREE.Mesh(new THREE.PlaneGeometry(120, 2 * W.LUMEN_R), new THREE.MeshStandardMaterial({ color: COLORS.blood,
    roughness: 0.3, transparent: true, opacity: 0.42, depthWrite: false }));
  blood.position.set(0, W.VESSEL_CY, CUT_Z + 0.02); scene.add(blood);
  // wire, the procedure sheath with its hub
  const wire = makeStrand(THREE, { color: COLORS.wire, radius: 0.48, sides: 10, metal: 0.9, rough: 0.28 }); scene.add(wire.group);
  const sheath = makeStrand(THREE, { color: COLORS.procSheath, radius: 1.3, sides: 16, rough: 0.3, physical: true }); scene.add(sheath.group);
  const hub = buildHub(THREE); scene.add(hub);

  // shared: { holeOpen, gather, bites: [xA, xP], wireShown, sheathShown, topView? } — every mode's pose carries these
  function update(shared) {
    const top = (shared.topView || 0) >= 0.5, vein = (shared.venous || 0) >= 0.5;
    if (vein !== wallMats.vein) {                                     // the femoral vein: darker, bluer wall and blood
      wallMats.vein = vein;
      wallMats[0].color.set(vein ? COLORS.vein : COLORS.artery); wallMats[1].color.set(vein ? COLORS.veinIntima : COLORS.intima);
      wallMats[2].color.set(vein ? COLORS.veinMedia : COLORS.media); blood.material.color.set(vein ? COLORS.venousBlood : COLORS.blood);
    }
    fat.visible = skin.visible = channel.visible = !top;              // seen from above, the skin and fat would hide the artery
    const close = Math.min(1, Math.max(0, shared.tractClose || 0)), pk = close.toFixed(2);
    if (pk !== plugKey) { plugKey = pk; plug.geometry.dispose(); plug.geometry = close > 0.01 ? geo(THREE, tractPlug(close)) : new THREE.BufferGeometry(); }
    plug.visible = !top && close > 0.01;
    const vk = `${shared.holeOpen.toFixed(2)}|${shared.gather.toFixed(2)}|${shared.bites.join(',')}|${top}`;
    if (vk !== vkey) { vkey = vk; vessel.geometry.dispose(); vessel.geometry = geo(THREE, vesselGeometry({ ...shared, frontWall: top ? 1 : 0 })); }
    wire.update(shared.wireShown ? wirePath(140, 70) : null);
    sheath.update(shared.sheathShown ? sheathPath(14, 14) : null);
    hub.visible = shared.sheathShown > 0;
    view.markDirty();
  }
  // a part picked in the legend glows (its own materials; a strand's material is its own)
  let glowing = [];
  function glow(objs) {
    for (const m of glowing) { m.emissive?.set('#000000'); m.emissiveIntensity = 0; }
    glowing = [];
    for (const o of objs) o.traverse((m) => { if (m.isMesh && m.material.emissive) { m.material.emissive.set(COLORS.glow); m.material.emissiveIntensity = 0.3; glowing.push(m.material); } });
    view.markDirty();
  }
  return { update, glow, debug: () => ({ tractClosed: plug.visible ? Number(plugKey) : 0, glowing: glowing.length }) };
}
