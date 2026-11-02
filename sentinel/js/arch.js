// The Arch window: the aortic root, arch and branches cut open toward the viewer (arch.glb, one anatomy with the video),
// and in it what the baked frame holds — catheter, sheaths, wire, both filters, pigtail, delivery catheter, debris — or,
// on the table, the filters out of the body. Tubes are rebuilt only when what they are cut from changes.
import { smooth, tubeArrays } from './render/tube.js';
import { geometry, deliveryRadius, DEVICE } from './seq.js';

export const COLORS = Object.freeze({
  wall: '#a9443f', wallOut: '#963b36', wallCut: '#d99484', leaflet: '#e6d3bd', calcium: '#f3efe4',
  outer_sheath: '#2a2c31', shaft: '#8e9298', art_sheath: '#2f5fd0', wire: '#d7dbe2', hoop: '#c9a960', bag: '#f4f7fb',
  core: '#6b7079', tip: '#3c4048', pigtail: '#7fc4bf', delivery: '#c9d1da', drape: '#2f6fa8', drapeEdge: '#285f92', glow: '#ffb020',
  thrombus: '#8c3a3a', wallDebris: '#e2cc9c', valveDebris: '#f1e8d6', foreign: '#a8b8d0',
});
// "What's inside": what each legend button lights
export const PARTS = [
  { id: 'wire', label: 'Wire', objs: ['wire'] },
  { id: 'catheter', label: 'Catheter', objs: ['outer_sheath', 'shaft'] },
  { id: 'proximal', label: 'Proximal filter', objs: ['ph', 'pb'] },
  { id: 'articulating', label: 'Articulating sheath', objs: ['art_sheath'] },
  { id: 'distal', label: 'Distal filter', objs: ['dh', 'db', 'dc', 'dt'] },
  { id: 'pigtail', label: 'Pigtail', objs: ['pigtail'] },
  { id: 'delivery', label: 'TAVR delivery catheter', objs: ['delivery'] },
  { id: 'debris', label: 'Debris', objs: ['debris'] },
];
const DEBRIS_COLOR = { thrombus: 'thrombus', wall: 'wallDebris', valve: 'valveDebris', foreign: 'foreign' };

export function createArch(THREE, view, model, seq, labelBox) {
  const root = new THREE.Group(); view.scene.add(root);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0, ...o });

  // the anatomy: normals per material, so the cut band keeps its edge against the inner and outer wall
  const anatomy = model; root.add(anatomy);
  const WALL = { wall: std(COLORS.wall, { roughness: 0.42 }), wall_out: std(COLORS.wallOut, { roughness: 0.5 }),
    wall_cut: std(COLORS.wallCut, { roughness: 0.6 }), leaflet: std(COLORS.leaflet, { roughness: 0.55, side: THREE.DoubleSide }),
    calcium: std(COLORS.calcium, { roughness: 0.85 }) };
  anatomy.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeVertexNormals();
    o.material = WALL[o.material?.name] || WALL.wall;
  });

  // the device: one mesh per part, each with its own material (the legend lights them one by one)
  const mats = {
    outer_sheath: std(COLORS.outer_sheath, { roughness: 0.3 }), shaft: std(COLORS.shaft, { roughness: 0.35 }),
    art_sheath: std(COLORS.art_sheath, { roughness: 0.3 }), wire: std(COLORS.wire, { roughness: 0.22, metalness: 0.9, emissive: '#3a3d42' }),
    ph: std(COLORS.hoop, { roughness: 0.28, metalness: 1 }), dh: std(COLORS.hoop, { roughness: 0.28, metalness: 1 }),
    pb: std(COLORS.bag, { roughness: 0.45, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }),
    db: std(COLORS.bag, { roughness: 0.45, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }),
    dc: std(COLORS.core, { roughness: 0.3, metalness: 0.6 }), dt: std(COLORS.tip, { roughness: 0.3, metalness: 0.5 }),
    pigtail: std(COLORS.pigtail, { roughness: 0.35 }), delivery: std(COLORS.delivery, { roughness: 0.3 }),
  };
  const R = seq.radius;
  const radius = { outer_sheath: R.outer_sheath, shaft: R.shaft, art_sheath: R.art_sheath, wire: R.wire, pigtail: R.pigtail,
    ph: R.hoop, dh: R.hoop, dc: R.core, dt: R.tip };
  const objs = {}, keys = {};
  const meshOf = (name, parent = root) => {
    if (!objs[name]) { objs[name] = new THREE.Mesh(new THREE.BufferGeometry(), mats[name]); objs[name].visible = false; parent.add(objs[name]); }
    return objs[name];
  };
  const toGeom = (a) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(a.position, 3)); g.setAttribute('normal', new THREE.BufferAttribute(a.normal, 3));
    g.setIndex(new THREE.BufferAttribute(a.index, 1)); return g;
  };
  function setMesh(mesh, g) { mesh.geometry.dispose(); mesh.geometry = g; mesh.visible = true; }
  // a tube along points (a list of [x, y, z]); closed loops are drawn through their first point again
  function tubeGeom(pts, r, { closed = false, sides = 12 } = {}) {
    const P = closed ? [...pts, pts[0]] : smooth(pts, 0.4);
    let rad = r;
    if (typeof r === 'function') { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); rad = r(L); }
    return toGeom(tubeArrays(P, rad, { sides, caps: !closed }));
  }
  const triples = (X) => { const o = []; for (let i = 0; i < X.length; i += 3) o.push([X[i], X[i + 1], X[i + 2]]); return o; };
  // a filter bag: quads between its rings and a fan to its apex; `open` drops the half facing that way (on the table)
  function bagGeom(X, n, open = null) {
    const rings = X.length / 3 / n, pos = new Float32Array(X.length + 3), idx = [];
    pos.set(X);
    let cx = 0, cy = 0, cz = 0;
    for (let k = 0; k < n; k++) { const j = 3 * ((rings - 1) * n + k); cx += X[j]; cy += X[j + 1]; cz += X[j + 2]; }
    pos.set([cx / n, cy / n, cz / n], X.length);
    const centre = (r) => { let a = 0, b = 0, c = 0; for (let k = 0; k < n; k++) { const j = 3 * (r * n + k); a += X[j]; b += X[j + 1]; c += X[j + 2]; } return [a / n, b / n, c / n]; };
    for (let r = 0; r < rings - 1; r++) {
      const c = open ? centre(r) : null;
      for (let k = 0; k < n; k++) {
        const a = r * n + k, b = r * n + (k + 1) % n;
        if (open) {
          let d = 0; for (const v of [a, b, b + n, a + n]) for (let e = 0; e < 3; e++) d += (X[3 * v + e] / 4 - c[e] / 4) * open[e];
          if (d > 0) continue;
        }
        idx.push(a, b, b + n, a, b + n, a + n);
      }
    }
    const apex = rings * n;
    for (let k = 0; k < n; k++) idx.push((rings - 1) * n + k, (rings - 1) * n + (k + 1) % n, apex);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  // debris: small irregular flakes, one material per kind, drawn at the bake's size (5× life, as the video)
  const debrisRoot = new THREE.Group(); root.add(debrisRoot);
  const debMats = Object.fromEntries(Object.entries(DEBRIS_COLOR).map(([k, c]) =>
    [k, std(COLORS[c], { roughness: 0.65, emissive: COLORS[c], emissiveIntensity: 0.3 })]));
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  function flake(r, kind) {
    const g = new THREE.SphereGeometry(1, 8, 6), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const s = 0.72 + 0.28 * rnd(); p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, debMats[kind]); m.scale.setScalar(r); m.visible = false; return m;
  }
  const flakes = seq.debris.map((d) => { const m = flake(d.r, d.kind); debrisRoot.add(m); return m; });

  // on the table: the tray, the device's end as on the bench, both filters cut open, what they caught
  const table = new THREE.Group(); table.visible = false; root.add(table);
  { const T = seq.table;
    table.add(backTable(lowest(T)));
    for (const [k, mat, r] of [['shaft', 'outer_sheath', R.outer_sheath], ['core', 'shaft', R.shaft], ['art', 'art_sheath', R.art_sheath]])
      table.add(new THREE.Mesh(tubeGeom(triples(T[k]), r), mats[mat]));
    for (const [k, mat, r] of [['ph', 'ph', R.hoop], ['dh', 'dh', R.hoop]]) if (T[k]) table.add(new THREE.Mesh(tubeGeom(triples(T[k]), r, { closed: true, sides: 8 }), mats[mat]));
    for (const [k, mat, r] of [['dc', 'dc', R.core], ['dt', 'dt', R.tip]]) if (T[k]) table.add(new THREE.Mesh(tubeGeom(triples(T[k]), r), mats[mat]));
    for (const [k, mat] of [['pb', 'pb'], ['db', 'db']]) if (T[k]) table.add(new THREE.Mesh(bagGeom(T[k], seq.nRing, T.open), mats[mat]));
    for (const [i, p] of T.deb) { const m = flake(seq.debris[i].r, seq.debris[i].kind); m.position.set(p[0], p[1], p[2]); m.visible = true; table.add(m); }
  }

  // the cath-lab back table under the device (Saro: "it is not clear that the device is on the cath lab table"): a blue
  // sterile drape falling over the table's front edge, a steel saline bowl, folded towels, gauze, a syringe. The drape's
  // top is just under the device's lowest point, so the device lies on it. Layout: x along the device, z toward the viewer.
  function lowest(T) {
    let y = Infinity;
    for (const [k, v] of Object.entries(T)) if (v && v.length && typeof v[0] === 'number') for (let i = 1; i < v.length; i += 3) y = Math.min(y, v[i]);
    for (const [, p] of T.deb) y = Math.min(y, p[1]);
    return y - 0.6;
  }
  function backTable(top) {
    const g = new THREE.Group();
    const drape = std(COLORS.drape, { roughness: 0.9 }), drapeEdge = std(COLORS.drapeEdge, { roughness: 0.9 });
    const steel = std('#c9ced6', { metalness: 0.85, roughness: 0.28, side: THREE.DoubleSide }), white = std('#f2f3f1', { roughness: 0.95 });
    const top_ = new THREE.Mesh(new THREE.BoxGeometry(340, 2, 210), drape); top_.position.set(-10, top - 1, -20); g.add(top_);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(340, 70, 2), drapeEdge); skirt.position.set(-10, top - 36, 85); g.add(skirt);
    for (const x of [-120, -55, 15, 85]) {                                   // the drape's soft folds over the edge
      const f = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 70, 8), drapeEdge); f.position.set(x, top - 36, 86.5); g.add(f);
    }
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(42, 33, 26, 40, 1, true), steel); bowl.position.set(-125, top + 13, -60); g.add(bowl);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(33, 33, 1.5, 40), steel); base.position.set(-125, top + 0.8, -60); g.add(base);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(43.5, 43.5, 2.2, 40, 1, true), steel); rim.position.set(-125, top + 26, -60); g.add(rim);
    const saline = new THREE.Mesh(new THREE.CylinderGeometry(39, 39, 0.5, 40),
      std('#bcd7ea', { roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55 })); saline.position.set(-125, top + 19, -60); g.add(saline);
    for (const [y, dx] of [[0, 0], [7, 3], [14, -2]]) {                       // a stack of folded towels
      const t = new THREE.Mesh(new THREE.BoxGeometry(80, 6.5, 52), white); t.position.set(115 + dx, top + 3.3 + y, -70); g.add(t);
    }
    for (const [x, z, a] of [[95, 40, 0.25], [118, 52, -0.18], [104, 62, 0.5]]) {   // gauze squares
      const q = new THREE.Mesh(new THREE.BoxGeometry(40, 1, 40), white); q.position.set(x, top + 0.6, z); q.rotation.y = a; g.add(q);
    }
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 70, 24), std('#e8f0f6', { roughness: 0.15, transparent: true, opacity: 0.7 }));
    barrel.rotation.z = Math.PI / 2; barrel.position.set(-85, top + 7, 55); g.add(barrel);
    const plunger = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 45, 12), white);
    plunger.rotation.z = Math.PI / 2; plunger.position.set(-35, top + 7, 55); g.add(plunger);
    return g;
  }

  let shownParts = [];
  function update(F) {
    const G = geometry(seq, F);
    anatomy.visible = !G.tab; table.visible = G.tab;
    const vis = new Set();
    if (G.tab) {
      for (const o of Object.values(objs)) o.visible = false;
      for (const m of flakes) m.visible = false;
      shownParts = ['proximal', 'distal', 'articulating', 'catheter', 'debris'];
      view.markDirty(); return;
    }
    for (const name of [...DEVICE, 'pigtail', 'delivery']) {
      const P = G.tubes[name], mesh = meshOf(name);
      if (!P) { mesh.visible = false; keys[name] = null; continue; }
      vis.add(name);
      const key = name === 'pigtail' ? F.pig : name === 'delivery' ? F.del : `${F.g.id}:${F.c[name]}`;
      if (key === keys[name]) { mesh.visible = true; continue; }
      keys[name] = key;
      setMesh(mesh, tubeGeom(P, name === 'delivery' ? (L) => deliveryRadius(L, R.delivery) : radius[name], { sides: name === 'delivery' ? 20 : 12 }));
    }
    for (const k of ['ph', 'dh', 'pb', 'db', 'dc', 'dt']) {
      const X = G[k], mesh = meshOf(k);
      if (!X) { mesh.visible = false; keys[k] = null; continue; }
      vis.add(k);
      if (keys[k] === X) { mesh.visible = true; continue; }
      keys[k] = X;
      if (k === 'pb' || k === 'db') setMesh(mesh, bagGeom(X, seq.nRing));
      else setMesh(mesh, tubeGeom(triples(X), radius[k], k === 'ph' || k === 'dh' ? { closed: true, sides: 8 } : {}));
    }
    const on = new Set();
    for (const d of G.debris) { const m = flakes[d.i]; m.position.set(d.p[0], d.p[1], d.p[2]); m.visible = true; on.add(d.i); }
    flakes.forEach((m, i) => { if (!on.has(i)) m.visible = false; });
    if (on.size) vis.add('debris');
    shownParts = PARTS.filter((p) => p.objs.some((o) => vis.has(o))).map((p) => p.id);
    view.markDirty();
  }
  // a legend part lit in the window until it is tapped again or the step changes
  function glow(id) {
    const want = new Set((PARTS.find((p) => p.id === id)?.objs) || []);
    for (const [k, m] of Object.entries(mats)) { m.emissive.set(want.has(k) ? COLORS.glow : (k === 'wire' ? '#3a3d42' : '#000000')); m.emissiveIntensity = want.has(k) ? 0.55 : 1; }
    for (const m of Object.values(debMats)) m.emissiveIntensity = want.has('debris') ? 1.2 : 0.3;
    view.markDirty();
  }

  // vessel names just outside each wall, on the side away from the arch (as in the video); hidden on the table
  const labels = (seq.views.labels || []).map((L) => {
    const el = document.createElement('span'); el.className = 'vlabel'; el.textContent = L.name; el.dataset.side = String(L.side);
    labelBox.appendChild(el); return { el, p: new THREE.Vector3(...L.p) };
  });
  const v = new THREE.Vector3();
  function placeLabels() {
    const w = labelBox.clientWidth, h = labelBox.clientHeight;
    for (const L of labels) {
      if (table.visible) { L.el.hidden = true; continue; }
      v.copy(L.p).project(view.camera);
      const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h;
      const tw = L.w || (L.w = L.el.offsetWidth || 90), side = Number(L.el.dataset.side);
      const x0 = side < 0 ? x - tw : x, x1 = side < 0 ? x : x + tw;     // the whole name in the window, or none of it
      L.el.hidden = !(v.z < 1 && x0 > 4 && x1 < w - 4 && y > 14 && y < h - 10);
      L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }
  return { root, update, glow, placeLabels, visibleParts: () => shownParts, objects: () => objs, flakes };
}
