// The only three.js the Angio Views page loads: the classes it names, plus the two addons it uses, bundled, tree-shaken
// and minified by scripts/build-three-vendor.sh from the pinned npm release (three@0.186.1, MIT — see LICENSE).
// Named exports (not `export *`) so the bundler can drop what the page never touches; add a name here before using it.
export {
  WebGLRenderer, WebGLRenderTarget, Scene, PerspectiveCamera, OrthographicCamera,
  Mesh, Line, BufferGeometry, Float32BufferAttribute, PlaneGeometry,
  MeshStandardMaterial, MeshBasicMaterial, LineDashedMaterial, LineBasicMaterial, ShaderMaterial, CircleGeometry,
  HemisphereLight, DirectionalLight, Vector2, Vector3, Matrix4, Quaternion,
  DoubleSide, GreaterDepth, CustomBlending, AddEquation, OneFactor, HalfFloatType, RGBAFormat,
  Group, BoxGeometry, CylinderGeometry, SphereGeometry, CapsuleGeometry, Raycaster,
} from 'three';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
