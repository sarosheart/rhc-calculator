// The only three.js the Bifurcation Stenting page loads: the classes it names, plus the addons it uses, bundled, tree-shaken
// and minified by scripts/build-three-vendor.sh bifurcation from the pinned npm release (three@0.186.1, MIT — see LICENSE).
// Named exports (not `export *`) so the bundler can drop what the page never touches; add a name here before using it.
export {
  WebGLRenderer, WebGLRenderTarget, Scene, PerspectiveCamera, OrthographicCamera, Group, Mesh, InstancedMesh, BufferGeometry,
  BufferAttribute, Float32BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute, MeshStandardMaterial,
  MeshPhysicalMaterial, MeshBasicMaterial, ShaderMaterial, LineBasicMaterial, Line, HemisphereLight, DirectionalLight,
  AmbientLight, Vector2, Vector3, Matrix4, Quaternion, Euler, Color, Box3, Sphere, CylinderGeometry, SphereGeometry,
  BoxGeometry, PlaneGeometry, ConeGeometry, RingGeometry, CanvasTexture, DataTexture, RepeatWrapping, SRGBColorSpace,
  ACESFilmicToneMapping, PMREMGenerator, DoubleSide, FrontSide, BackSide, MathUtils, Raycaster, Clock, HalfFloatType,
  RGBAFormat, CustomBlending, AddEquation, OneFactor, NoBlending,
} from 'three';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
