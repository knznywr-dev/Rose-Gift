/* ════════════════════════════════════════════════════════════════════════
   ROSE SCENE
   ────────────────────────────────────────────────────────────────────────
   Everything 3D lives here: renderer, camera, lights, the procedural rose,
   petals, particles, the bloom choreography and the render loop.

   The rose is built from scratch — no models or images — using curved petal
   surfaces swept along an arc. The public API is returned at the bottom so
   interactions.js can tap/hover the flower without knowing Three.js.
   ════════════════════════════════════════════════════════════════════════ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const clamp = THREE.MathUtils.clamp;
const smooth = (x, a, b) => THREE.MathUtils.smoothstep(x, a, b);

/* Small deterministic PRNG so each petal's "randomness" is stable. */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* A tube that tapers along its length (THREE.TubeGeometry cannot). */
function taperedTube(curve, radiusAt, tubularSegments = 48, radialSegments = 8) {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const p = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, p);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = radiusAt(t);
    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);
      const nx = cos * N.x + sin * B.x;
      const ny = cos * N.y + sin * B.y;
      const nz = cos * N.z + sin * B.z;
      positions.push(p.x + r * nx, p.y + r * ny, p.z + r * nz);
      normals.push(nx, ny, nz);
      uvs.push(j / radialSegments, t);
    }
  }
  for (let i = 1; i <= tubularSegments; i++) {
    for (let j = 1; j <= radialSegments; j++) {
      const a = (radialSegments + 1) * (i - 1) + (j - 1);
      const b = (radialSegments + 1) * i + (j - 1);
      const c = (radialSegments + 1) * i + j;
      const d = (radialSegments + 1) * (i - 1) + j;
      indices.push(a, b, d, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

/* Build a palette from the two editable rose colours. `tone` keeps inner
   layers a little darker, which gives the bloom depth. */
function petalPalette(tone, config) {
  const base = new THREE.Color(config.roseColor);
  const tip = new THREE.Color(config.roseTipColor);
  return {
    colorBase: base.clone().multiplyScalar(0.16),
    colorMid: base.clone().multiplyScalar(0.55 + 0.45 * tone),
    colorTip: tip.clone().multiplyScalar(0.62 + 0.25 * tone).lerp(base, 0.18 + 0.16 * (1 - tone)),
  };
}

/* A petal is a grid surface swept along an outward-leaning arc, with a
   cupped cross-section, a softly ruffled tip and a base-to-tip gradient. */
function createPetalGeometry(opts) {
  const {
    length, width, tilt, curl, cup = 0.24,
    segU = 22, segV = 16, seed = 1,
    colorBase, colorMid, colorTip,
  } = opts;

  const rnd = mulberry32(seed);
  const phase = rnd() * Math.PI * 2;
  const ds = length / segU;

  const centres = [];
  let cx = 0;
  let cy = 0;
  for (let i = 0; i <= segU; i++) {
    if (i > 0) {
      const tm = (i - 0.5) / segU;
      const ang = tilt + curl * Math.pow(tm, 1.65);
      cx += Math.sin(ang) * ds;
      cy += Math.cos(ang) * ds;
    }
    centres.push({ x: cx, y: cy, t: i / segU });
  }

  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const col = new THREE.Color();

  for (let i = 0; i <= segU; i++) {
    const { x, y, t } = centres[i];
    const ang = tilt + curl * Math.pow(t, 1.65);
    const envelope = Math.pow(Math.sin(Math.PI * (0.13 + 0.76 * t)), 0.42);
    const half = 0.5 * width * envelope;

    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * 2 - 1;
      const vv = v * v;
      const edge = Math.abs(v);

      const tipCurl = smooth(t, 0.58, 1);
      let px = x - cup * vv * half * 0.9;
      let py = y + (0.55 * cup + 0.45 * cup * tipCurl) * vv * half;
      const pz = v * half;

      if (t > 0.6) {
        const k = (t - 0.6) / 0.4;
        const ext = 0.05 * Math.pow(1 - vv, 1.6) * k * k * (0.7 + 0.5 * length);
        px += Math.sin(ang) * ext;
        py += Math.cos(ang) * ext;
      }

      positions.push(px, py, pz);
      uvs.push((v + 1) * 0.5, t);

      const k = clamp(Math.pow(t, 0.9) * 0.9 + edge * 0.18, 0, 1);
      col.copy(colorBase).lerp(colorMid, clamp(k * 1.65, 0, 1));
      col.lerp(colorTip, smooth(k, 0.55, 1) * 0.52);
      const shade = 0.58 + 0.42 * smooth(t, 0.02, 0.3);
      col.multiplyScalar(shade * (0.94 + 0.06 * Math.cos(v * Math.PI + phase)));
      colors.push(col.r, col.g, col.b);
    }
  }

  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = (i + 1) * (segV + 1) + j;
      const c = (i + 1) * (segV + 1) + j + 1;
      const d = i * (segV + 1) + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.userData.center = geo.boundingSphere.center.clone();
  return geo;
}

/* Leaf blade: pointed, folded along the midrib, arching downward. */
function createLeafGeometry(length, width, seed = 3) {
  const rnd = mulberry32(seed);
  const segU = 16;
  const segV = 8;
  const ds = length / segU;
  const centres = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i <= segU; i++) {
    if (i > 0) {
      const tm = (i - 0.5) / segU;
      const ang = 0.38 - 1.25 * Math.pow(tm, 1.35);
      x += Math.cos(ang) * ds;
      y += Math.sin(ang) * ds;
    }
    centres.push({ x, y, t: i / segU });
  }

  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const col = new THREE.Color();
  const dark = new THREE.Color(0x264a2a);
  const mid = new THREE.Color(0x4d8046);
  const light = new THREE.Color(0x94b96d);
  const phase = rnd() * 6;

  for (let i = 0; i <= segU; i++) {
    const { x: px0, y: py0, t } = centres[i];
    const envelope = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.82)), 0.75);
    const half = 0.5 * width * envelope;

    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * 2 - 1;
      const vv = v * v;
      const edge = Math.abs(v);
      const px = px0;
      const py = py0 - 0.5 * vv * half + 0.05 * Math.pow(1 - edge, 5) * half;
      const pz = v * half;
      positions.push(px, py, pz);
      uvs.push((v + 1) * 0.5, t);

      col.copy(dark).lerp(mid, 0.3 + 0.62 * t);
      col.lerp(light, edge * 0.18 + Math.pow(1 - edge, 4) * 0.16 + t * 0.16);
      col.multiplyScalar(0.88 + 0.12 * Math.sin(t * 9 + phase));
      colors.push(col.r, col.g, col.b);
    }
  }

  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = (i + 1) * (segV + 1) + j;
      const c = (i + 1) * (segV + 1) + j + 1;
      const d = i * (segV + 1) + j + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/* Easing helpers used when GSAP is unavailable. */
function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function createRoseScene({
  canvas,
  config,
  gsap = null,
  mobile = false,
  reducedMotion = false,
  onContextLost = null,
}) {
  /* ── 1 · Renderer ──────────────────────────────────────────────────── */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !mobile,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch (err) {
    const error = new Error("WebGL renderer could not be created.");
    error.code = "WEBGL_INIT_FAILED";
    error.cause = err;
    throw error;
  }

  const maxPixelRatio = mobile ? 1.6 : 2;
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, maxPixelRatio);
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearAlpha(0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 60);

  const TARGET = new THREE.Vector3(0, 0.35, 0);
  const CAM_DIR = new THREE.Vector3(2.25, 0.72, 4.38);
  const frameScale = () => {
    const aspect = window.innerWidth / window.innerHeight;
    if (aspect < 0.85) return 1.16;
    if (window.innerHeight < 560) return 1.22;
    return 1;
  };
  const fovFor = (aspect) => (aspect < 0.85 ? 54 : 45);

  camera.fov = fovFor(window.innerWidth / window.innerHeight);
  camera.updateProjectionMatrix();
  camera.position.copy(TARGET).add(CAM_DIR.clone().multiplyScalar(frameScale()));

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = false;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  controls.minDistance = 3.15;
  controls.maxDistance = 8.0;
  controls.minPolarAngle = 0.38;
  controls.maxPolarAngle = 1.78;
  controls.update();

  let userHasOrbited = false;
  controls.addEventListener("start", () => {
    userHasOrbited = true;
    intro.active = false;
  });

  /* ── 2 · Lights + procedural studio environment ───────────────────── */
  const hemi = new THREE.HemisphereLight(0x7a4d95, 0x32141f, 0.95);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffe3d2, 1.45);
  key.position.set(3.2, 5.6, 3.4);
  key.target.position.set(0, 0.2, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 14;
  key.shadow.camera.left = -3.4;
  key.shadow.camera.right = 3.4;
  key.shadow.camera.top = 3.4;
  key.shadow.camera.bottom = -3.4;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  scene.add(key, key.target);

  const rim = new THREE.DirectionalLight(0x9d6cff, 1.15);
  rim.position.set(-4.5, 2.2, -3.5);
  scene.add(rim);

  const glowLight = new THREE.PointLight(0xff6f92, 9, 9, 2);
  glowLight.position.set(1.2, 1.35, 1.5);
  scene.add(glowLight);

  const under = new THREE.PointLight(0x7b3bb5, 4, 8, 2);
  under.position.set(-1.4, -1.1, 1.2);
  scene.add(under);

  const fill = new THREE.PointLight(0xffc4c0, 4, 10, 2);
  fill.position.set(-1.1, 1.9, 3.0);
  scene.add(fill);

  const bounce = new THREE.PointLight(0xffa8a4, 5, 7, 2);
  bounce.position.set(-0.4, -0.15, 2.5);
  scene.add(bounce);

  function makeEnvironment() {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, "#25112f");
    g.addColorStop(0.38, "#6b3766");
    g.addColorStop(0.52, "#43203f");
    g.addColorStop(0.72, "#2a1028");
    g.addColorStop(1.0, "#0d0510");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);

    const lights = [
      [380, 52, 90, "rgba(255, 216, 186, 0.85)"],
      [120, 90, 110, "rgba(255, 128, 170, 0.40)"],
      [300, 168, 120, "rgba(158, 92, 255, 0.30)"],
    ];
    for (const [x, y, r, color] of lights) {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, color);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    return env;
  }
  scene.environment = makeEnvironment();

  /* ── 3 · Procedural textures (no external assets) ──────────────────── */
  function canvasTexture(w, h, draw, srgb = false) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  const petalBump = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      const spread = (i / 25 - 0.5) * 1.6;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 1.02);
      ctx.bezierCurveTo(
        w * (0.5 + spread * 0.18), h * 0.62,
        w * (0.5 + spread * 0.62), h * 0.24,
        w * (0.5 + spread), h * -0.04
      );
      ctx.lineWidth = i % 4 === 0 ? 2.2 : 1.1;
      ctx.stroke();
    }
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 6 + Math.random() * 26;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(255,255,255,${0.015 + Math.random() * 0.03})`);
      rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });

  const leafBump = canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = "#7d7d7d";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.lineCap = "round";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h);
    ctx.quadraticCurveTo(w * 0.46, h * 0.45, w * 0.5, 0);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.4;
    for (let i = 1; i < 14; i++) {
      const y = h * (1 - i / 15);
      const reach = Math.sin((i / 15) * Math.PI) * w * 0.46;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, y);
      ctx.quadraticCurveTo(w * 0.5 - reach * 0.4, y - h * 0.035, w * 0.5 - reach, y - h * 0.10);
      ctx.moveTo(w * 0.5, y);
      ctx.quadraticCurveTo(w * 0.5 + reach * 0.4, y - h * 0.035, w * 0.5 + reach, y - h * 0.10);
      ctx.stroke();
    }
  });

  const sparkTexture = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.18, "rgba(255,240,245,0.95)");
    g.addColorStop(0.42, "rgba(255,180,205,0.35)");
    g.addColorStop(1, "rgba(255,160,190,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, true);

  const glowTexture = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(255,140,170,0.55)");
    g.addColorStop(0.35, "rgba(255,90,130,0.20)");
    g.addColorStop(1, "rgba(255,60,110,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, true);

  const contactShadowTex = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(6,0,10,0.72)");
    g.addColorStop(0.35, "rgba(8,1,12,0.38)");
    g.addColorStop(0.7, "rgba(8,1,12,0.10)");
    g.addColorStop(1, "rgba(8,1,12,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, true);

  const petalSpriteTex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-0.35);
    const g = ctx.createLinearGradient(0, -54, 0, 54);
    g.addColorStop(0, "rgba(255, 214, 226, 0.95)");
    g.addColorStop(0.5, "rgba(255, 142, 172, 0.92)");
    g.addColorStop(1, "rgba(207, 50, 91, 0.85)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 52);
    ctx.bezierCurveTo(-40, 24, -46, -30, 0, -50);
    ctx.bezierCurveTo(46, -30, 40, 24, 0, 52);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.20)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 48);
    ctx.quadraticCurveTo(-2, 0, 0, -44);
    ctx.stroke();
  }, true);

  /* ── 4 · Materials ─────────────────────────────────────────────────── */
  const petalMaterial = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    color: 0xffffff,
    roughness: 0.64,
    metalness: 0.0,
    clearcoat: 0.2,
    clearcoatRoughness: 0.6,
    sheen: 0.65,
    sheenColor: new THREE.Color(0xff9aad),
    sheenRoughness: 0.55,
    specularIntensity: 0.55,
    side: THREE.DoubleSide,
    bumpMap: petalBump,
    bumpScale: 0.018,
    envMapIntensity: 0.65,
  });

  const leafMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.58,
    metalness: 0.0,
    side: THREE.DoubleSide,
    bumpMap: leafBump,
    bumpScale: 0.022,
    envMapIntensity: 0.5,
  });

  const stemMaterial = new THREE.MeshStandardMaterial({
    color: 0x4c7a43,
    roughness: 0.7,
    metalness: 0.02,
    side: THREE.DoubleSide,
    envMapIntensity: 0.4,
  });

  const sepalMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.72,
    metalness: 0.0,
    side: THREE.DoubleSide,
    envMapIntensity: 0.35,
  });

  const thornMaterial = new THREE.MeshStandardMaterial({
    color: 0x5b4a2e,
    roughness: 0.6,
    metalness: 0.0,
  });

  /* ── 5 · The rose assembly ─────────────────────────────────────────── */
  const ROSE_Y = -1.4;
  const roseRoot = new THREE.Group();
  roseRoot.position.y = ROSE_Y;
  scene.add(roseRoot);

  const stemCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(0.0, 0.02, 0.0),
      new THREE.Vector3(-0.10, 0.55, 0.06),
      new THREE.Vector3(0.09, 1.1, -0.05),
      new THREE.Vector3(-0.05, 1.6, 0.04),
      new THREE.Vector3(0.0, 1.92, 0.0),
    ],
    false,
    "catmullrom",
    0.5
  );

  const stemRadius = (t) => 0.036 + 0.012 * (1 - t) + 0.011 * Math.pow(t, 10);

  const stem = new THREE.Mesh(taperedTube(stemCurve, stemRadius, 56, 9), stemMaterial);
  stem.castShadow = true;
  stem.receiveShadow = true;
  roseRoot.add(stem);

  /* thorns */
  [0.22, 0.48, 0.71].forEach((t, i) => {
    const point = stemCurve.getPointAt(t);
    const tangent = stemCurve.getTangentAt(t).normalize();
    const side = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 0, 1)).normalize();
    if (i % 2 === 1) side.negate();
    const r = stemRadius(t);
    const dir = side.clone().add(new THREE.Vector3(0, 0.5, 0)).normalize();
    const thorn = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.075, 5), thornMaterial);
    thorn.position.copy(point).addScaledVector(side, r * 0.55).addScaledVector(dir, 0.028);
    thorn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    thorn.castShadow = true;
    roseRoot.add(thorn);
  });

  /* leaves + little curved petioles */
  function addLeaf(t, angle, scale) {
    const base = stemCurve.getPointAt(t);
    const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

    const p0 = base.clone().addScaledVector(outward, 0.02);
    const p1 = base.clone().addScaledVector(outward, 0.13 * scale).add(new THREE.Vector3(0, 0.035 * scale, 0));
    const p2 = base.clone().addScaledVector(outward, 0.26 * scale).add(new THREE.Vector3(0, 0.075 * scale, 0));
    const petioleCurve = new THREE.CatmullRomCurve3([p0, p1, p2]);
    const petiole = new THREE.Mesh(
      taperedTube(petioleCurve, () => 0.0085 * scale, 12, 5),
      stemMaterial
    );
    petiole.castShadow = true;
    roseRoot.add(petiole);

    const leaf = new THREE.Mesh(createLeafGeometry(0.82 * scale, 0.4 * scale, Math.floor(t * 100)), leafMaterial);
    leaf.position.copy(p2);
    leaf.rotation.y = -angle;
    leaf.rotation.z = 0.22;
    leaf.rotation.x = Math.sin(angle * 3) * 0.08;
    leaf.castShadow = true;
    roseRoot.add(leaf);
  }
  addLeaf(0.33, 0.72, 1.0);
  addLeaf(0.57, -2.35, 0.88);
  addLeaf(0.77, 2.5, 0.62);

  const bloom = new THREE.Group();
  bloom.position.set(0, 1.92, 0);
  bloom.rotation.x = 0.15;
  roseRoot.add(bloom);

  const receptacle = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 10), stemMaterial);
  receptacle.position.y = -0.03;
  receptacle.scale.set(1, 1.45, 1);
  receptacle.castShadow = true;
  bloom.add(receptacle);

  const heartMat = new THREE.MeshStandardMaterial({ color: 0x4d0513, roughness: 0.8, metalness: 0 });
  const roseHeart = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), heartMat);
  roseHeart.position.y = 0.07;
  roseHeart.scale.set(1, 1.5, 1);
  bloom.add(roseHeart);

  /* sepals — small green leaves cupping the base of the bloom */
  const sepalPalette = {
    colorBase: new THREE.Color(0x203a1f),
    colorMid: new THREE.Color(0x3d6a36),
    colorTip: new THREE.Color(0x719356),
  };
  for (let i = 0; i < 5; i++) {
    const geo = createPetalGeometry({
      length: 0.44 + (i % 2) * 0.05,
      width: 0.16,
      tilt: 1.5,
      curl: 0.55,
      cup: 0.2,
      seed: 500 + i,
      ...sepalPalette,
    });
    const yaw = (i / 5) * Math.PI * 2 + 0.4;
    const pivot = new THREE.Group();
    pivot.rotation.y = yaw;
    pivot.position.y = -0.02;
    bloom.add(pivot);
    const tiltPivot = new THREE.Group();
    tiltPivot.position.x = 0.042;
    pivot.add(tiltPivot);
    const mesh = new THREE.Mesh(geo, sepalMaterial);
    mesh.castShadow = true;
    tiltPivot.add(mesh);
  }

  /* ── 6 · Petals ────────────────────────────────────────────────────── */
  const LAYERS = [
    { count: 4,  len: 0.40, wid: 0.28, tilt: 0.05, curl: 0.22, r0: 0.014, y: 0.090, cup: 0.46 },
    { count: 6,  len: 0.52, wid: 0.36, tilt: 0.14, curl: 0.28, r0: 0.024, y: 0.076, cup: 0.42 },
    { count: 8,  len: 0.64, wid: 0.44, tilt: 0.25, curl: 0.34, r0: 0.036, y: 0.058, cup: 0.38 },
    { count: 10, len: 0.75, wid: 0.52, tilt: 0.36, curl: 0.40, r0: 0.050, y: 0.036, cup: 0.34 },
    { count: 12, len: 0.85, wid: 0.58, tilt: 0.47, curl: 0.46, r0: 0.066, y: 0.010, cup: 0.30 },
    { count: 14, len: 0.93, wid: 0.64, tilt: 0.58, curl: 0.52, r0: 0.082, y: -0.020, cup: 0.26 },
    { count: 17, len: 1.00, wid: 0.68, tilt: 0.68, curl: 0.56, r0: 0.100, y: -0.052, cup: 0.23 },
  ];

  const petals = [];
  const petalMeshes = [];
  const layerCount = LAYERS.length;
  const segU = mobile ? 18 : 22;
  const segV = mobile ? 12 : 16;

  LAYERS.forEach((layer, li) => {
    const tone = 0.68 + 0.32 * (li / (layerCount - 1));
    const palette = petalPalette(tone, config);
    const layerOffset = li * 0.72 + 0.2;

    for (let i = 0; i < layer.count; i++) {
      const rnd = mulberry32(li * 1000 + i * 37 + 11);
      const yaw = (i / layer.count) * Math.PI * 2 + layerOffset + (mulberry32(li * 41 + i)() - 0.5) * 0.16;

      const geo = createPetalGeometry({
        length: layer.len * (0.9 + rnd() * 0.2),
        width: layer.wid * (0.9 + rnd() * 0.16),
        tilt: layer.tilt + (rnd() - 0.5) * 0.16,
        curl: layer.curl + (rnd() - 0.5) * 0.1,
        cup: layer.cup,
        seed: li * 97 + i * 13 + 5,
        segU,
        segV,
        ...palette,
      });

      const yawPivot = new THREE.Group();
      yawPivot.rotation.y = yaw;
      yawPivot.position.y = layer.y + (rnd() - 0.5) * 0.05;
      bloom.add(yawPivot);

      const tiltPivot = new THREE.Group();
      yawPivot.add(tiltPivot);

      const mesh = new THREE.Mesh(geo, petalMaterial);
      mesh.castShadow = li >= 3;
      tiltPivot.add(mesh);

      const closedZ = layer.tilt + layer.curl * 0.52 + (rnd() - 0.5) * 0.04;
      const closedR = layer.r0 * 0.42;
      const baseTwist = (rnd() - 0.5) * 0.3;
      tiltPivot.position.x = closedR;
      tiltPivot.rotation.z = closedZ;
      mesh.rotation.x = baseTwist;
      mesh.scale.setScalar(0.86);

      petals.push({
        mesh,
        yawPivot,
        tiltPivot,
        baseYaw: yaw,
        baseTwist,
        openR: layer.r0,
        closedR,
        closedZ,
        layerIndex: li,
        state: { open: 0 },
        flutter: 0,
        flutterVel: 0,
        phase: rnd() * Math.PI * 2,
        speed: 0.55 + rnd() * 0.7,
        center: geo.userData.center.clone(),
      });
      petalMeshes.push(mesh);
    }
  });

  /* ── 7 · Grounding: soft contact shadow + warm puddle ──────────────── */
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.7),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = ROSE_Y - 0.012;
  scene.add(contactShadow);

  const puddle = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 4.6),
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.55,
    })
  );
  puddle.rotation.x = -Math.PI / 2;
  puddle.position.y = ROSE_Y - 0.008;
  scene.add(puddle);

  /* ── 8 · Particles ─────────────────────────────────────────────────── */
  const SPARKLE_COUNT = mobile ? 120 : 240;
  const FALL_COUNT = mobile ? 8 : 14;
  const BURST_COUNT = mobile ? 100 : 180;

  const sparklePositions = new Float32Array(SPARKLE_COUNT * 3);
  const sparkleColors = new Float32Array(SPARKLE_COUNT * 3);
  const sparkleSizes = new Float32Array(SPARKLE_COUNT);
  const sparklePhases = new Float32Array(SPARKLE_COUNT);
  const sparklePalette = [0xffd9bd, 0xff9db6, 0xffeaf1, 0xffb7c9, 0xffc98f];
  const tmpColor = new THREE.Color();

  for (let i = 0; i < SPARKLE_COUNT; i++) {
    const near = i < SPARKLE_COUNT * 0.38;
    const radius = near ? 0.9 + Math.random() * 1.5 : 1.5 + Math.random() * 3.2;
    const angle = Math.random() * Math.PI * 2;
    const x = Math.cos(angle) * radius * (0.85 + Math.random() * 0.35);
    const z = Math.sin(angle) * radius;
    const y = near ? 0.1 + Math.random() * 1.9 : -1.3 + Math.random() * 3.9;
    sparklePositions.set([x, y, z], i * 3);

    tmpColor.setHex(sparklePalette[(Math.random() * sparklePalette.length) | 0]);
    sparkleColors.set([tmpColor.r, tmpColor.g, tmpColor.b], i * 3);

    sparkleSizes[i] = near ? 1.3 + Math.random() * 2.2 : 0.9 + Math.random() * 2.6;
    sparklePhases[i] = Math.random() * Math.PI * 2;
  }

  const sparkleGeo = new THREE.BufferGeometry();
  sparkleGeo.setAttribute("position", new THREE.BufferAttribute(sparklePositions, 3));
  sparkleGeo.setAttribute("aColor", new THREE.BufferAttribute(sparkleColors, 3));
  sparkleGeo.setAttribute("aSize", new THREE.BufferAttribute(sparkleSizes, 1));
  sparkleGeo.setAttribute("aPhase", new THREE.BufferAttribute(sparklePhases, 1));

  const sparkleMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uPixelRatio;
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec3 p = position;
        float s = uTime * 0.35 + aPhase;
        p.y += sin(s) * 0.20 + sin(uTime * 0.11 + aPhase * 2.0) * 0.08;
        p.x += cos(s * 0.7 + aPhase) * 0.13;
        p.z += sin(s * 0.9 + aPhase) * 0.13;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPixelRatio * (4.2 / -mv.z);

        float twinkle = pow(0.5 + 0.5 * sin(uTime * 1.7 + aPhase * 4.0), 2.0);
        vAlpha = 0.22 + 0.78 * twinkle;
        vColor = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        /* Correctly ordered edges: 1 at the centre, 0 at the rim. */
        float core = 1.0 - smoothstep(0.0, 0.5, d);
        float glow = pow(core, 2.2);
        float alpha = glow * vAlpha;
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(vColor, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const sparkles = new THREE.Points(sparkleGeo, sparkleMat);
  scene.add(sparkles);

  /* slow-falling petals */
  const fallDummy = new THREE.Object3D();
  const fallState = [];
  const fallGeo = new THREE.PlaneGeometry(0.17, 0.13);
  const fallMat = new THREE.MeshBasicMaterial({
    map: petalSpriteTex,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const fallingPetals = new THREE.InstancedMesh(fallGeo, fallMat, FALL_COUNT);
  fallingPetals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fallingPetals.frustumCulled = false;
  fallingPetals.visible = !reducedMotion;
  scene.add(fallingPetals);

  for (let i = 0; i < FALL_COUNT; i++) {
    fallState.push({
      x: (Math.random() - 0.5) * 5.2,
      y: -1.2 + Math.random() * 3.8,
      z: -1.8 + Math.random() * 3.2,
      speed: 0.09 + Math.random() * 0.13,
      rotX: Math.random() * Math.PI * 2,
      rotY: Math.random() * Math.PI * 2,
      rotZ: Math.random() * Math.PI * 2,
      spinX: (Math.random() - 0.5) * 0.6,
      spinY: (Math.random() - 0.5) * 0.5,
      spinZ: (Math.random() - 0.5) * 0.4,
      sway: Math.random() * Math.PI * 2,
      swayAmp: 0.25 + Math.random() * 0.55,
      scale: 0.65 + Math.random() * 0.8,
    });
  }

  function updateFallingPetals(dt) {
    for (let i = 0; i < FALL_COUNT; i++) {
      const p = fallState[i];
      p.y -= p.speed * dt;
      p.sway += dt * 0.5;
      p.rotX += p.spinX * dt;
      p.rotY += p.spinY * dt;
      p.rotZ += p.spinZ * dt;
      if (p.y < -1.4) {
        p.y = 2.6 + Math.random() * 0.4;
        p.x = (Math.random() - 0.5) * 5.2;
        p.z = -1.8 + Math.random() * 3.2;
      }
      fallDummy.position.set(p.x + Math.sin(p.sway) * p.swayAmp, p.y, p.z + Math.cos(p.sway * 0.7) * 0.18);
      fallDummy.rotation.set(p.rotX, p.rotY, p.rotZ);
      fallDummy.scale.setScalar(p.scale);
      fallDummy.updateMatrix();
      fallingPetals.setMatrixAt(i, fallDummy.matrix);
    }
    fallingPetals.instanceMatrix.needsUpdate = true;
  }
  updateFallingPetals(0);

  /* pooled sparkle burst for taps / Send Love / the surprise */
  const burstPositions = new Float32Array(BURST_COUNT * 3);
  const burstColors = new Float32Array(BURST_COUNT * 3);
  const burstVelocities = new Float32Array(BURST_COUNT * 3);
  const burstGeo = new THREE.BufferGeometry();
  burstGeo.setAttribute("position", new THREE.BufferAttribute(burstPositions, 3));
  burstGeo.setAttribute("color", new THREE.BufferAttribute(burstColors, 3));

  const burstMat = new THREE.PointsMaterial({
    size: 0.034,
    map: sparkTexture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    toneMapped: false,
  });
  const burst = new THREE.Points(burstGeo, burstMat);
  burst.frustumCulled = false;
  burst.visible = false;
  scene.add(burst);

  const burstState = { active: false, life: 0, duration: 1.9 };
  const burstPalette = [0xffe6c9, 0xffb0c5, 0xffffff, 0xff7f9f, 0xffcf9f];

  function triggerBurst(origin, strength = 1, count = BURST_COUNT) {
    const n = Math.min(count, BURST_COUNT);
    for (let i = 0; i < BURST_COUNT; i++) {
      const i3 = i * 3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const rs = Math.random() * 0.16;
      burstPositions[i3] = origin.x + Math.sin(phi) * Math.cos(theta) * rs;
      burstPositions[i3 + 1] = origin.y + Math.cos(phi) * rs;
      burstPositions[i3 + 2] = origin.z + Math.sin(phi) * Math.sin(theta) * rs;

      if (i < n) {
        const s = (0.55 + Math.pow(Math.random(), 1.8) * 2.2) * strength;
        const dirX = Math.sin(phi) * Math.cos(theta);
        const dirY = Math.abs(Math.cos(phi)) * 0.85 + 0.25;
        const dirZ = Math.sin(phi) * Math.sin(theta);
        burstVelocities[i3] = dirX * s;
        burstVelocities[i3 + 1] = dirY * s + 0.25;
        burstVelocities[i3 + 2] = dirZ * s;
        tmpColor.setHex(burstPalette[(Math.random() * burstPalette.length) | 0]);
        burstColors[i3] = tmpColor.r;
        burstColors[i3 + 1] = tmpColor.g;
        burstColors[i3 + 2] = tmpColor.b;
      } else {
        burstVelocities[i3] = burstVelocities[i3 + 1] = burstVelocities[i3 + 2] = 0;
        burstColors[i3] = burstColors[i3 + 1] = burstColors[i3 + 2] = 0;
      }
    }
    burstGeo.attributes.position.needsUpdate = true;
    burstGeo.attributes.color.needsUpdate = true;
    burstState.active = true;
    burstState.life = 0;
    burstState.duration = 1.7 + strength * 0.4;
    burst.visible = true;
    burstMat.opacity = 1;
  }

  function updateBurst(dt) {
    if (!burstState.active) return;
    burstState.life += dt;
    const drag = Math.pow(0.16, dt);
    for (let i = 0; i < BURST_COUNT; i++) {
      const i3 = i * 3;
      burstVelocities[i3] *= drag;
      burstVelocities[i3 + 1] = burstVelocities[i3 + 1] * drag + 0.34 * dt;
      burstVelocities[i3 + 2] *= drag;
      burstPositions[i3] += burstVelocities[i3] * dt;
      burstPositions[i3 + 1] += burstVelocities[i3 + 1] * dt;
      burstPositions[i3 + 2] += burstVelocities[i3 + 2] * dt;
    }
    burstGeo.attributes.position.needsUpdate = true;

    const k = burstState.life / burstState.duration;
    burstMat.opacity = Math.max(0, 1 - k) * Math.min(1, k * 6);
    if (k >= 1) {
      burstState.active = false;
      burst.visible = false;
    }
  }

  /* ── 9 · Idle motion + render loop ─────────────────────────────────── */
  const clock = new THREE.Clock();
  const idle = reducedMotion ? 0.12 : 1;
  let time = 0;
  let zoomBusy = false;
  let disposed = false;
  let running = false;
  let started = false;

  const intro = { active: false, t: 0, duration: 3.4, from: new THREE.Vector3(), to: new THREE.Vector3() };
  let punch = null;
  const bloomState = { glow: 0 };
  let bloomActive = false;
  let manualBloom = false;
  let bloomStart = 0;

  function updatePetals(dt) {
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];

      p.flutterVel += (-p.flutter * 34 - p.flutterVel * 5.2) * dt;
      p.flutter += p.flutterVel * dt;

      const open = p.state.open;
      const breath = Math.sin(time * p.speed + p.phase) * 0.011 * idle;
      const microYaw = Math.sin(time * p.speed * 0.7 + p.phase * 1.3) * 0.008 * idle;

      p.tiltPivot.rotation.z = THREE.MathUtils.lerp(p.closedZ, 0, open) + p.flutter * 0.55 + breath;
      p.tiltPivot.position.x = THREE.MathUtils.lerp(p.closedR, p.openR, open);
      p.yawPivot.rotation.y = p.baseYaw + microYaw + p.flutter * 0.06;
      p.mesh.rotation.x = p.baseTwist + Math.sin(time * p.speed * 0.8 + p.phase) * 0.02 * idle + p.flutter * 0.12;
      p.mesh.scale.setScalar(0.86 + 0.14 * Math.min(open, 1.15) + Math.sin(time * 1.2 + p.phase) * 0.003);
    }
  }

  function updateManualBloom(elapsed) {
    if (!bloomActive) return;
    const duration = reducedMotion ? 0.95 : config.bloomDuration;
    const petalDur = reducedMotion ? 0.55 : clamp(duration * 0.5, 1.1, 2.1);
    const spread = Math.max(0, duration - petalDur);

    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      const outerFirst = (LAYERS.length - 1 - p.layerIndex) / (LAYERS.length - 1);
      const delay = 0.55 + outerFirst * spread + (i % 9) * 0.02;
      const t = clamp((elapsed - delay) / petalDur, 0, 1);
      p.state.open = reducedMotion ? easeOutCubic(t) : easeOutBack(t);
    }

    const glowT = clamp((elapsed - 0.55) / Math.max(0.4, duration), 0, 1);
    bloomState.glow = easeOutCubic(glowT);

    if (elapsed > duration + 0.9) bloomActive = false;
  }

  function updateCamera(dt) {
    if (intro.active) {
      intro.t += dt;
      const k = clamp(intro.t / intro.duration, 0, 1);
      const eased = easeOutCubic(k);
      camera.position.lerpVectors(intro.from, intro.to, eased);
      if (k >= 1) intro.active = false;
      return true;
    }
    if (punch) {
      punch.t += dt;
      const inDur = 0.75;
      const hold = 0.3;
      const outDur = 1.3;
      if (punch.t < inDur) {
        const k = easeInOutCubic(clamp(punch.t / inDur, 0, 1));
        camera.position.lerpVectors(punch.from, punch.to, k);
      } else if (punch.t < inDur + hold) {
        camera.position.copy(punch.to);
      } else if (punch.t < inDur + hold + outDur) {
        const k = easeInOutCubic(clamp((punch.t - inDur - hold) / outDur, 0, 1));
        camera.position.lerpVectors(punch.to, punch.from, k);
      } else {
        camera.position.copy(punch.from);
        punch = null;
        zoomBusy = false;
        controls.enabled = true;
        controls.update();
      }
      return true;
    }
    return false;
  }

  function animate() {
    if (disposed) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;

    const cameraBusy = updateCamera(dt);
    if (!cameraBusy) controls.update();

    if (manualBloom && bloomActive) updateManualBloom(performance.now() / 1000 - bloomStart);

    updatePetals(dt);

    roseRoot.rotation.z = Math.sin(time * 0.52) * 0.022 * idle + Math.sin(time * 0.21 + 1.3) * 0.009 * idle;
    roseRoot.rotation.x = Math.sin(time * 0.43 + 0.7) * 0.014 * idle;
    roseRoot.position.y = ROSE_Y + Math.sin(time * 0.9) * 0.008 * idle;
    bloom.scale.setScalar(1 + Math.sin(time * 1.15 + 0.6) * 0.006 * idle);

    glowLight.intensity = 4 + bloomState.glow * 5 + Math.sin(time * 1.1) * 1.2 * idle;
    puddle.material.opacity = 0.48 + Math.sin(time * 0.8) * 0.06 * idle;

    if (!reducedMotion) {
      sparkleMat.uniforms.uTime.value = time;
      updateFallingPetals(dt);
    }
    updateBurst(dt);

    renderer.render(scene, camera);
  }

  /* ── 10 · Camera intro / punch ─────────────────────────────────────── */
  function startCameraIntro() {
    const destination = TARGET.clone().add(CAM_DIR.clone().multiplyScalar(frameScale()));
    intro.from.copy(TARGET).add(CAM_DIR.clone().multiplyScalar(frameScale() * 1.3));
    intro.to.copy(destination);
    intro.t = 0;
    intro.active = !reducedMotion;
    if (reducedMotion) camera.position.copy(destination);
  }

  function cameraPunch() {
    if (punch || reducedMotion) return;
    if (intro.active) intro.active = false;
    const from = camera.position.clone();
    const target = controls.target.clone();
    const dir = from.clone().sub(target);
    const dist = dir.length();
    const toDist = Math.max(controls.minDistance * 0.97, dist * 0.8);
    const to = target.clone().add(dir.setLength(toDist));
    punch = { from, to, t: 0 };
    zoomBusy = true;
    controls.enabled = false;
  }

  /* ── 11 · Petal interaction helpers ────────────────────────────────── */
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const petalCenter = new THREE.Vector3();
  const burstOrigin = new THREE.Vector3();

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hit = raycaster.intersectObjects(petalMeshes, false)[0];
    return hit ? hit.point.clone() : null;
  }

  function ripple(point, strength = 1) {
    roseRoot.updateMatrixWorld(true);
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      petalCenter.copy(p.center).applyMatrix4(p.mesh.matrixWorld);
      const d = petalCenter.distanceTo(point);
      const falloff = Math.max(0, 1 - d / 1.85);
      if (falloff <= 0.01) continue;
      const f = falloff * falloff;
      p.flutterVel -= strength * f * (0.85 + Math.random() * 0.3) * 1.1;
    }
  }

  function bloomPosition() {
    bloom.getWorldPosition(burstOrigin);
    burstOrigin.y += 0.18;
    return burstOrigin.clone();
  }

  function burstAtBloom(strength = 1, count = BURST_COUNT) {
    triggerBurst(bloomPosition(), strength, count);
  }

  function celebrate(strength = 1.15) {
    const origin = bloomPosition();
    triggerBurst(origin, strength);
    ripple(origin, 2.4);
    cameraPunch();
  }

  /* ── 12 · Bloom choreography ───────────────────────────────────────── */
  function startBloom() {
    bloomStart = performance.now() / 1000;
    const duration = reducedMotion ? 0.95 : config.bloomDuration;

    if (gsap && !reducedMotion) {
      manualBloom = false;
      bloomActive = false;
      const petalDur = clamp(duration * 0.5, 1.1, 2.1);
      const spread = Math.max(0, duration - petalDur);
      const tl = gsap.timeline({ delay: 0.55 });
      petals.forEach((p, i) => {
        const outerFirst = (LAYERS.length - 1 - p.layerIndex) / (LAYERS.length - 1);
        const delay = outerFirst * spread + (i % 9) * 0.02;
        tl.to(p.state, { open: 1, duration: petalDur, ease: "back.out(1.25)" }, delay);
      });
      gsap.to(bloomState, { glow: 1, duration, ease: "power2.out", delay: 0.55 });
    } else {
      /* No GSAP (or reduced motion): the render loop drives the same
         per-petal stagger with a mathematically identical easing. */
      manualBloom = true;
      bloomActive = true;
    }
  }

  /* ── 13 · Resize / visibility / cleanup ────────────────────────────── */
  let resizeTimer = 0;
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;

    camera.aspect = aspect;
    camera.fov = fovFor(aspect);
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(w, h, false);
    sparkleMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();

    controls.minDistance = aspect < 0.85 ? 3.4 : 3.15;
    controls.maxDistance = 8.0;

    if (!userHasOrbited && !intro.active && !punch) {
      camera.position.copy(TARGET).add(CAM_DIR.clone().multiplyScalar(frameScale()));
      controls.update();
    }
  }

  function handleResize() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(onResize, 120);
  }

  function onOrientation() {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(onResize, 280);
  }

  function onVisibility() {
    if (document.hidden) {
      renderer.setAnimationLoop(null);
      running = false;
    } else if (started && !running && !disposed) {
      clock.getDelta();
      renderer.setAnimationLoop(animate);
      running = true;
    }
  }

  function onContextLost(event) {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    running = false;
    if (typeof onContextLost === "function") onContextLost();
  }

  window.addEventListener("resize", handleResize, { passive: true });
  window.addEventListener("orientationchange", onOrientation, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onContextLost, false);

  /* ── 14 · Public API ───────────────────────────────────────────────── */
  function start() {
    if (disposed) return;
    renderer.render(scene, camera);
    startCameraIntro();
    startBloom();
    clock.getDelta();
    renderer.setAnimationLoop(animate);
    started = true;
    running = true;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    running = false;
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("orientationchange", onOrientation);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    controls.dispose();

    if (gsap) {
      petals.forEach((p) => gsap.killTweensOf(p.state));
      gsap.killTweensOf(bloomState);
    }

    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
    scene.environment?.dispose();
    petalBump.dispose();
    leafBump.dispose();
    sparkTexture.dispose();
    glowTexture.dispose();
    contactShadowTex.dispose();
    petalSpriteTex.dispose();
    renderer.dispose();
  }

  return {
    start,
    dispose,
    pick,
    ripple,
    burstAtBloom,
    celebrate,
    cameraPunch,
    getTime: () => time,
  };
}
