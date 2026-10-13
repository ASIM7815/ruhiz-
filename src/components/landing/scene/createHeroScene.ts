import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type Quality = "high" | "low";
export interface SceneHandle {
  dispose: () => void;
}

/**
 * NASA "Earth" 3D model (NASA 3D Resources, public domain), recompressed to ~370 KB.
 * Served from /public so it needs no extra CSP entries.
 */
const EARTH_URL = "/models/earth.glb";
/** Radius of the globe in scene units (camera sits ~12.5 units away). */
const EARTH_RADIUS = 3.2;
/** Spin speed in radians per second (0.45 is one full turn about every 14 s, so it reads as clearly alive). */
const SPIN_SPEED = 0.45;
/** Longitude (radians, about the Y axis) that faces the viewer when the page loads. */
const START_ROTATION_Y = 0;

/** Soft blue atmospheric rim, drawn on a slightly larger back-facing sphere. */
function atmosphere(radius: number) {
  const geo = new THREE.SphereGeometry(radius * 1.09, 64, 48);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader:
      "varying vec3 vN; void main(){ float i = pow(max(0.62 - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), 3.2); gl_FragColor = vec4(0.35, 0.66, 1.0, 1.0) * i * 1.15; }",
  });
  return { mesh: new THREE.Mesh(geo, mat), geo, mat };
}

export async function createHeroScene(host: HTMLElement, opts: { quality: Quality; onLost?: () => void }): Promise<SceneHandle> {
  const high = opts.quality === "high";

  // Load the model first. If it fails (or the caller unmounts meanwhile) no WebGL resources exist yet.
  const gltf = await new GLTFLoader().loadAsync(EARTH_URL);
  const model = gltf.scene;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: high, powerPreference: "high-performance" });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, high ? 1.75 : 1.25);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0); // fully transparent background
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  camera.position.set(0, 0, 12.5);

  /* Lighting: a warm "sun" from the upper left, a cool rim from behind, and a little ambient so the night side stays readable. */
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x1a2a5e, 1.5));
  const sun = new THREE.DirectionalLight(0xfff4e6, 4.6);
  sun.position.set(-4, 2.5, 7);
  const rim = new THREE.DirectionalLight(0x5b9bff, 2.2);
  rim.position.set(5, -1, -3);
  scene.add(sun, rim);

  /* Normalise the model to a known radius and centre it. */
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const k = (EARTH_RADIUS * 2) / Math.max(size.x, size.y, size.z);
  model.scale.setScalar(k);
  model.position.copy(centre).multiplyScalar(-k);

  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), high ? 8 : 4);
  const owned: { dispose: () => void }[] = [];
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    owned.push(m.geometry);
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.metalness = 0;
    mat.roughness = 0.78;
    mat.envMapIntensity = 0;
    if (mat.map) {
      // Self-lit layer: keeps the deep oceans and the shadow side readable against the dark page.
      mat.emissive = new THREE.Color(0xffffff);
      mat.emissiveMap = mat.map;
      mat.emissiveIntensity = 0.55;
      mat.map.anisotropy = maxAniso;
      mat.map.minFilter = THREE.LinearMipmapLinearFilter;
      mat.map.magFilter = THREE.LinearFilter;
      mat.map.needsUpdate = true;
      owned.push(mat.map);
    }
    owned.push(mat);
  });

  const root = new THREE.Group(); // pointer + scroll movement
  const tilt = new THREE.Group(); // Earth's axial tilt
  const spin = new THREE.Group(); // rotation about its own axis
  tilt.rotation.z = THREE.MathUtils.degToRad(-23.4);
  spin.rotation.y = START_ROTATION_Y;
  spin.add(model);
  tilt.add(spin);
  root.add(tilt);

  const atmo = atmosphere(EARTH_RADIUS);
  root.add(atmo.mesh);
  scene.add(root);

  /* Sizing, interaction and the render loop. */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onPointer = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    pointer.tx = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width - 0.5) * 2, -1.2, 1.2);
    pointer.ty = THREE.MathUtils.clamp(((e.clientY - r.top) / r.height - 0.5) * 2, -1.2, 1.2);
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  const resize = () => {
    const w = Math.max(host.clientWidth, 1);
    const h = Math.max(host.clientHeight, 1);
    renderer.setSize(w, h, false);
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    camera.aspect = w / h;
    camera.position.z = camera.aspect < 0.9 ? 14.5 : camera.aspect < 1.2 ? 13 : 12.5;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    schedule();
  }, { threshold: 0 });
  io.observe(host);
  const onVis = () => schedule();
  document.addEventListener("visibilitychange", onVis);

  const onLost = (e: Event) => {
    e.preventDefault();
    opts.onLost?.();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  const clock = new THREE.Clock();
  let raf = 0;
  let running = false;
  let frames = 0;
  let slow = 0;
  let last = performance.now();

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = now - last;
    last = now;
    // Adaptive quality: if the first second of frames is slow, drop to a lighter pixel ratio once.
    if (frames < 90) {
      frames++;
      if (dt > 30) slow++;
      if (frames === 90 && slow > 45 && pixelRatio > 1) {
        pixelRatio = 1;
        renderer.setPixelRatio(1);
        resize();
      }
    }

    const t = clock.getElapsedTime();
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    const scroll = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1.5);

    spin.rotation.y = START_ROTATION_Y + t * SPIN_SPEED;
    root.rotation.y = pointer.x * 0.2 + scroll * 0.3;
    root.rotation.x = pointer.y * 0.14 - scroll * 0.08;
    root.position.y = -scroll * 0.8 + Math.sin(t * 0.8) * 0.06;
    renderer.render(scene, camera);
  };

  function schedule() {
    const shouldRun = visible && !document.hidden;
    if (shouldRun && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }
  schedule();
  // Draw one frame immediately so the canvas is never blank when it fades in.
  renderer.render(scene, camera);

  return {
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onLost);
      owned.forEach((d) => d.dispose());
      atmo.geo.dispose();
      atmo.mat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
