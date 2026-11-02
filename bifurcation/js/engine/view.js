// One 3D window: renderer, scene, lights, camera with orbit controls. Sized from its container (never from the canvas's
// own height attribute), refitted to the current camera preset on resize until the user turns or zooms it; a double
// tap (or double click) puts the preset back. Draws only when something changed.

export function createView(THREE, canvas, { background = '#0a0e15', fov = 32, pixelRatio = 2 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(background);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pmrem.dispose();
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight('#e8eefc', '#3a2a22', 0.55));
  const key = new THREE.DirectionalLight('#ffffff', 1.7); key.position.set(-40, 90, 120); scene.add(key);
  const rim = new THREE.DirectionalLight('#9fb6ff', 0.55); rim.position.set(80, 40, -100); scene.add(rim);

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.2, 5000);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.12; controls.screenSpacePanning = true;
  controls.zoomSpeed = 0.9; controls.rotateSpeed = 0.8;

  let preset = { target: [0, 0, 0], dir: [0, 0, 1], radius: 50 }, userMoved = false, dirty = true, w = 0, h = 0, fly = null;
  controls.addEventListener('start', () => { userMoved = true; fly = null; });
  controls.addEventListener('change', () => { dirty = true; });

  function placement(p) {
    const vfov = camera.fov * Math.PI / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const d = p.radius / Math.sin(Math.min(vfov, hfov) / 2);
    const n = Math.hypot(...p.dir), dir = p.dir.map(v => v / n);
    return { pos: p.target.map((v, i) => v + dir[i] * d), target: p.target };
  }
  function fit(p = preset, ms = 0) {
    preset = p;
    const to = placement(p);
    if (ms > 0) fly = { from: { pos: camera.position.toArray(), target: controls.target.toArray() }, to, t0: performance.now(), ms };
    else { camera.position.set(...to.pos); controls.target.set(...to.target); fly = null; }
    controls.update(); dirty = true;
  }
  // a new preset (the step moved on) takes the camera back from wherever the user left it
  function setPreset(p, ms = 700) { userMoved = false; fit(p, ms); }

  function resize() {
    const box = canvas.parentElement;                                  // its inside, not counting the border
    const nw = Math.max(1, box.clientWidth), nh = Math.max(1, box.clientHeight);
    if (nw === w && nh === h) return;
    w = nw; h = nh;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatio));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (!userMoved) fit(preset); dirty = true;
  }

  let lastTap = 0;
  const reset = () => { userMoved = false; fit(preset, 400); };
  canvas.addEventListener('dblclick', reset);
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType !== 'touch') return;
    const now = performance.now(); if (now - lastTap < 300) reset(); lastTap = now;
  });

  function frame(now = performance.now()) {
    if (fly) {
      const t = Math.min(1, (now - fly.t0) / fly.ms), e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      camera.position.set(...fly.from.pos.map((v, i) => v + (fly.to.pos[i] - v) * e));
      controls.target.set(...fly.from.target.map((v, i) => v + (fly.to.target[i] - v) * e));
      if (t >= 1) fly = null; dirty = true;
    }
    if (controls.update()) dirty = true;
    if (!dirty) return false;
    renderer.render(scene, camera); dirty = false; return true;
  }
  return { THREE, renderer, scene, camera, controls, resize, fit, setPreset, frame,
    markDirty: () => { dirty = true; }, get userMoved() { return userMoved; }, get preset() { return preset; } };
}
