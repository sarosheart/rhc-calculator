// A strand (suture, link, wire, sheath) as a mesh that is rebuilt only when its points change.
import { smooth, tubeArrays } from './tube.js';

export function makeStrand(THREE, { color, radius, sides = 8, step = 0.25, rough = 0.42, metal = 0, tipColor = null,
  tipLen = 6, opacity = 1, physical = false, map = null } = {}) {
  const M = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const mat = new M({ color, roughness: rough, metalness: metal, transparent: opacity < 1, opacity, ...(map ? { map } : {}),
    ...(physical ? { clearcoat: 0.6, clearcoatRoughness: 0.25 } : {}) });
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BufferGeometry(), mat); group.add(body);
  let tip = null;
  if (tipColor) { tip = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: tipColor, roughness: 0.5 })); group.add(tip); }
  let key = '';
  const set = (mesh, a) => {
    mesh.geometry.dispose(); const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a.position, 3)); g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
    if (a.uv) g.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
    g.setIndex(new THREE.BufferAttribute(a.index, 1)); mesh.geometry = g;
  };
  function update(pts) {
    if (!pts || pts.length < 2) { group.visible = false; return false; }
    group.visible = true;
    const k = pts.map(q => q.map(v => v.toFixed(2)).join(',')).join(';') + '|' + radius;
    if (k === key) return false; key = k;
    const sm = smooth(pts, step);
    set(body, tubeArrays(sm, radius, { sides }));
    if (tip) {                                                        // the last tipLen mm in the tip colour, a hair thicker
      const L = [0]; for (let i = 1; i < sm.length; i++) L.push(L[i - 1] + Math.hypot(...sm[i].map((v, j) => v - sm[i - 1][j])));
      const from = L[L.length - 1] - tipLen, tail = sm.filter((_, i) => L[i] >= from);
      tip.visible = L[L.length - 1] > 2 * tipLen;              // a strand trimmed short has lost its tip
      if (tip.visible && tail.length >= 2) set(tip, tubeArrays(tail, (typeof radius === 'number' ? radius : radius(0)) * 1.25, { sides }));
    }
    return true;
  }
  return { group, update, material: mat };
}

// the pre-tied knot as drawn once it has left the device: coils of the suture round the rail at `at`, along `dir`
export function coilPoints(at, dir, { turns = 8, length = 3.1, radius = 0.46, cinch = 0 } = {}) {
  const n = Math.hypot(...dir), d = dir.map(v => v / n);
  const ref = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(d, ref)), v = cross(d, u), r = radius * (1 - 0.35 * cinch), L = length * (1 - 0.2 * cinch);
  const pts = [], N = turns * 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N, a = t * turns * 2 * Math.PI, s = (t - 0.5) * L;
    pts.push([0, 1, 2].map(k => at[k] + d[k] * s + (u[k] * Math.cos(a) + v[k] * Math.sin(a)) * r));
  }
  return pts;
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map(x => x / l); };
