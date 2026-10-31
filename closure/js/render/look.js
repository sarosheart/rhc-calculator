// Colours and small procedural parts shared by both windows.
import { W, tractPoint } from '../scene/world.js';
import { TRACT_LEN } from '../scene/paths.js';

export const COLORS = Object.freeze({
  skin: '#d39b80', artery: '#c4675c', intima: '#e7b1a8', media: '#a8443f', blood: '#4a0710',
  vein: '#7a5872', veinIntima: '#b994ad', veinMedia: '#5e3d57', venousBlood: '#2c0610', silk: '#2a211c',
  suture: '#2747c9',          // ProGlide's monofilament polypropylene is blue
  whiteTip: '#f4f4f2', link: '#f2f2ee', steel: '#c9ced6', wire: '#a9b1bb',
  sheath: '#3f7f86', procSheath: '#dfe7f1', hub: '#2f6db5', hubCap: '#1d2633',
  trimmer: '#eef0f3', trimLever: '#d23b33', arrow: '#ffd166', glow: '#ffb020',
});

// the device's distal sheath tapers to its tip; geom.sheathProfile = [[s, r], …] from where it leaves the distal guide
export function sheathRadius(geom) {
  const P = geom.sheathProfile;
  return (s) => {
    if (s <= P[0][0]) return P[0][1];
    for (let i = 1; i < P.length; i++) if (s <= P[i][0]) {
      const t = (s - P[i - 1][0]) / (P[i][0] - P[i - 1][0]); return P[i - 1][1] + t * (P[i][1] - P[i - 1][1]);
    }
    return P[P.length - 1][1];
  };
}

// the procedural sheath's hub and side arm, outside the skin at the end of its shaft, along the tract
export function buildHub(THREE, outside = 14) {
  const g = new THREE.Group();
  const a = W.ANGLE * Math.PI / 180, dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.0, 14, 32), new THREE.MeshStandardMaterial({ color: COLORS.hub, roughness: 0.35 }));
  body.position.y = 7; g.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 4, 32), new THREE.MeshStandardMaterial({ color: COLORS.hubCap, roughness: 0.5 }));
  cap.position.y = 15.5; g.add(cap);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 22, 16), new THREE.MeshStandardMaterial({ color: '#e8ecf0', roughness: 0.3, transparent: true, opacity: 0.85 }));
  arm.position.set(4, 9, 0); arm.rotation.z = -1.05; g.add(arm);
  g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.position.set(...tractPoint(TRACT_LEN + outside));
  return g;
}

// a fat arrow (shaft + cone) pointing along dir, its tip at `tip`
export function makeArrow(THREE, length = 22) {
  const mat = new THREE.MeshBasicMaterial({ color: COLORS.arrow, transparent: true, opacity: 0.92, depthTest: false });
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, length * 0.62, 16), mat); shaft.position.y = -length * 0.31 - length * 0.38;
  const head = new THREE.Mesh(new THREE.ConeGeometry(2.6, length * 0.38, 24), mat); head.position.y = -length * 0.19;
  g.add(shaft, head); g.renderOrder = 10; shaft.renderOrder = head.renderOrder = 10;
  const up = new THREE.Vector3(0, 1, 0);
  g.point = (tip, dir) => { const d = new THREE.Vector3(...dir).normalize(); g.quaternion.setFromUnitVectors(up, d); g.position.set(...tip); };
  return g;
}
