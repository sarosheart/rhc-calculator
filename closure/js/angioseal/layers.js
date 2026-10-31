// Angio-Seal VIP in both windows: the insertion sheath (lettered A N G I O • S E A L) riding the track, the locator with
// its drip hole, the device cap and sleeve, the anchor, the collagen, the tamper tube and the suture with its clear stop
// and black marker. Parts come from closure/models/angioseal.glb; shafts and the suture are drawn by the page.
import { W, tractPoint } from '../scene/world.js';
import { piece, arcs, track, TRACT_LEN } from '../scene/paths.js';
import { trackPoint, trackDir } from '../scene/paths.js';
import { anchorFrame, collagenShape, suturePath, AS } from './geometry.js';
import { makeStrand } from '../render/strands.js';

const SQ = Math.SQRT1_2, OUT = [SQ, SQ, 0];
const TRACK = track(), TL = arcs(TRACK);

// the sheath's printed letters, about 1 cm apart along it (the texture repeats every 100 mm)
function lettering(THREE) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 1024;
  const g = c.getContext('2d'); g.fillStyle = '#e6e8e4'; g.fillRect(0, 0, 64, 1024);
  g.fillStyle = '#3a3f44'; g.font = 'bold 40px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  [...'ANGIO•SEAL'].forEach((ch, i) => { for (const u of [16, 48]) { g.save(); g.translate(u, 60 + i * 96); g.rotate(-Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); } });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 0.01); return t;
}
// place a model part: its +X along `x`, its +Y (Blender +Z, up) toward `y`, origin at `at`
function place(THREE, obj, at, x, y) {
  const X = new THREE.Vector3(...x).normalize(), Y0 = new THREE.Vector3(...y);
  const Y = Y0.sub(X.clone().multiplyScalar(Y0.dot(X))).normalize(), Z = new THREE.Vector3().crossVectors(X, Y);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); obj.position.set(...at);
}
const part = (model, name) => { const o = model.getObjectByName(name).clone(true); o.position.set(0, 0, 0); o.quaternion.identity(); return o; };

// the parts both windows share, posed for a pose
function common(THREE, root, model, { lettered }) {
  const P = {};
  for (const n of ['Anchor', 'CollagenPlug', 'CollagenMound', 'TamperTube']) { P[n] = part(model, n); root.add(P[n]); }
  P.mound2 = part(model, 'CollagenMound'); root.add(P.mound2);
  const sheath = makeStrand(THREE, { color: '#ffffff', radius: AS.SHEATH_R, sides: 18, rough: 0.4, step: 1.0, map: lettered ? lettering(THREE) : null,
    physical: true });
  const locTip = makeStrand(THREE, { color: '#f2f4f1', radius: (s) => Math.max(0.35, 0.95 - Math.max(0, s - 5) * 0.2), sides: 14, step: 0.5 });
  const suture = makeStrand(THREE, { color: '#f4f4f0', radius: 0.15, sides: 8 });
  for (const s of [sheath, locTip, suture]) root.add(s.group);
  function update(p) {
    sheath.update(p.insShown ? piece(TRACK, TL, p.tipArc - AS.SHEATH_LEN, p.tipArc) : null);
    locTip.update(p.insShown && p.locatorShown ? piece(TRACK, TL, p.tipArc - 5, p.tipArc + AS.LOCATOR_TIP) : null);
    const A = anchorFrame(p);
    P.Anchor.visible = !!A; if (A) place(THREE, P.Anchor, A.center, A.axis, A.up);
    if (A && A.bend) P.Anchor.scale.set(1, 1, 1);
    const C = collagenShape(p), t = C ? Math.min(1, Math.max(0, p.collagen - 1)) : 0;
    P.CollagenPlug.visible = !!C && t < 0.6 && !p.collagenIn && !p.split;
    if (P.CollagenPlug.visible) { place(THREE, P.CollagenPlug, C.center, OUT, [-SQ, SQ, 0]); P.CollagenPlug.scale.set(1 - 0.5 * t, 1, 1); }
    const moundOn = !!C && (t >= 0.6 || p.collagenIn || p.split);
    P.CollagenMound.visible = moundOn; P.mound2.visible = moundOn && !!p.split;
    if (moundOn) {
      const k = p.split ? 0.62 : 0.7 + 0.3 * Math.min(1, (t - 0.6) / 0.4 || 1);
      const base = [C.center[0] - (p.split ? 1.9 : 0), C.bottom, 0];
      place(THREE, P.CollagenMound, base, [1, 0, 0], [0, 1, 0]); P.CollagenMound.scale.setScalar(k);
      if (p.split) { place(THREE, P.mound2, [C.center[0] + 1.9, C.bottom + 0.3, 0], [1, 0, 0], [0.2, 1, 0]); P.mound2.scale.setScalar(0.55); }
    }
    P.TamperTube.visible = p.tamperShown > 0;
    if (p.tamperShown) place(THREE, P.TamperTube, tractPoint(p.tamperS), OUT, [-SQ, SQ, 0]);
    const S = suturePath(p); suture.update(S ? S.pts : null);
    return { A, C, S };
  }
  return { update, P };
}

export function angiosealInside(view, root, [model]) {
  const { THREE } = view, c = common(THREE, root, model, { lettered: false });
  const resolve = (n) => (n === 'collagen' ? [c.P.CollagenPlug, c.P.CollagenMound, c.P.mound2] : c.P[n] || null);
  return { update: (p) => c.update(p), node: (n) => c.P[n] || null, resolve };
}

export function angiosealHands(view, root, [model]) {
  const { THREE } = view, c = common(THREE, root, model, { lettered: true });
  const H = {};
  for (const n of ['SheathHub', 'LocatorHub', 'DeviceCap', 'Sleeve']) { H[n] = part(model, n); H[n].traverse(o => { if (o.isMesh) o.material = o.material.clone(); }); root.add(H[n]); }
  // blood dripping from the drip hole, and the two markers on the suture outside
  const drops = new THREE.Group(); root.add(drops);
  for (let k = 0; k < 3; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.9 - 0.15 * k, 16, 12), new THREE.MeshPhysicalMaterial({ color: '#7a0b14', roughness: 0.15, clearcoat: 1 }));
    d.position.set(0, -2.2 - 3.4 * k, 0); drops.add(d); }
  const clear = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3, 20), new THREE.MeshPhysicalMaterial({ color: '#dfe9ee', roughness: 0.1, transmission: 0.6, thickness: 1 }));
  const black = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 5, 16), new THREE.MeshStandardMaterial({ color: '#111214', roughness: 0.5 }));
  root.add(clear, black);
  const up = [-SQ, SQ, 0];
  function update(p) {
    const r = c.update(p);
    const hubAt = trackPoint(p.tipArc - AS.SHEATH_LEN), out = trackDir(p.tipArc - AS.SHEATH_LEN).map(v => -v);
    const along = (d) => hubAt.map((v, i) => v + out[i] * d);
    H.SheathHub.visible = p.insShown > 0; if (p.insShown) place(THREE, H.SheathHub, hubAt, out, up);
    H.LocatorHub.visible = p.insShown > 0 && p.locatorShown > 0; if (H.LocatorHub.visible) place(THREE, H.LocatorHub, along(17), out, up);
    const dev = p.insShown > 0 && p.deviceShown > 0;
    H.Sleeve.visible = dev; if (dev) place(THREE, H.Sleeve, along(17), out, up);
    H.DeviceCap.visible = dev; if (dev) place(THREE, H.DeviceCap, along(17 + 3 + 11 * p.capBack), out, up);
    drops.visible = p.drip > 0;
    if (drops.visible) { const dh = H.LocatorHub.getObjectByName('DripHole'); dh.updateWorldMatrix(true, false);
      const v = new THREE.Vector3(); dh.getWorldPosition(v); drops.position.copy(v); }
    clear.visible = !!(r.S && r.S.clearStopAt) && !p.cutTop; if (clear.visible) { clear.position.set(...r.S.clearStopAt); clear.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...OUT)); }
    black.visible = !!(r.S && r.S.markerAt) && p.blackMarker > 0; if (black.visible) { black.position.set(...r.S.markerAt); black.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...OUT)); }
  }
  const resolve = (n) => (n === 'collagen' ? [c.P.CollagenPlug, c.P.CollagenMound, c.P.mound2] : H[n] || c.P[n] || null);
  return { update, resolve, hubs: H };
}
