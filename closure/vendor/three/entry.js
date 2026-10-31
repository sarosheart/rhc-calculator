// The only three.js the Closure Devices page loads: the classes it names, plus the addons it uses, bundled, tree-shaken
// and minified by scripts/build-three-vendor.sh closure from the pinned npm release (three@0.186.1, MIT — see LICENSE).
// Named exports (not `export *`) so the bundler can drop what the page never touches; add a name here before using it.
export {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, BufferGeometry, BufferAttribute,
  Float32BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute, MeshStandardMaterial, MeshPhysicalMaterial,
  MeshBasicMaterial, LineBasicMaterial, Line, HemisphereLight, DirectionalLight, AmbientLight, Vector2, Vector3, Matrix4,
  Quaternion, Euler, Color, Box3, Sphere, TubeGeometry, CatmullRomCurve3, CylinderGeometry, SphereGeometry, BoxGeometry,
  PlaneGeometry, ConeGeometry, RingGeometry, CanvasTexture, DataTexture, RepeatWrapping, SRGBColorSpace, ACESFilmicToneMapping,
  PMREMGenerator, DoubleSide, FrontSide, MathUtils, Raycaster, Clock,
} from 'three';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
