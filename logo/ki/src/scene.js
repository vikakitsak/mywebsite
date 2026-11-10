import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 1920, H = 1080, FPS = 60, DUR = 10;
const LIME = '#C8FF2E', INK = '#14210A';
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutBack = (t, s = 1.8) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
const easeInOutCubic = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeInCubic = t => t * t * t;
const spring = (t, f = 9, d = 6) => t < 0 ? 0 : Math.exp(-d * t) * Math.sin(f * t);
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const glCanvas = renderer.domElement;
const out = document.createElement('canvas'); out.width = W; out.height = H; document.body.appendChild(out);
const octx = out.getContext('2d');

const scene = new THREE.Scene();
scene.background = new THREE.Color(LIME);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 3000);

const hemi = new THREE.HemisphereLight(0xffffff, 0x9fd11a, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfffbe8, 2.4); sun.position.set(-6, 9, 12); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 18, bottom: -18, near: 1, far: 50 });
sun.shadow.radius = 6; sun.shadow.bias = -0.0005; scene.add(sun);
const rimL = new THREE.DirectionalLight(0xe8ff9a, 1.6); rimL.position.set(8, -2, -3); scene.add(rimL);

// ---------- geometry from vectorized logo (px -> world: 100px = 1u) ----------
const X = px => (px - 511.5) / 100, Y = py => -(py - 512) / 100;
const DEPTH = 1.1, WALLZ = -DEPTH - 0.02;
function shapeFrom(cmds) { const s = new THREE.Shape(); for (const c of cmds) { const [k, ...a] = c;
  if (k === 'M') s.moveTo(X(a[0]), Y(a[1])); else if (k === 'L') s.lineTo(X(a[0]), Y(a[1]));
  else if (k === 'C') s.bezierCurveTo(X(a[0]), Y(a[1]), X(a[2]), Y(a[3]), X(a[4]), Y(a[5])); } return s; }
const PIECES = {
  stem: [['M',169,320],['L',323,320],['L',323,704],['L',169,704]],
  arm: [['M',323,486],['L',463,320],['L',640,320],['L',479,512],['L',554,601],['L',468,704],['L',461,704],['L',398,626],['C',384,609,372,600,356,600],['C',337,600,323,615,323,638]],
  band: [['M',681,451],['L',854,451],['L',640,704],['L',468,704]],
};
const inkMat = new THREE.MeshPhysicalMaterial({ color: INK, roughness: 0.32, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.12, emissive: INK, emissiveIntensity: 0 });
const parts = {};
for (const [name, cmds] of Object.entries(PIECES)) {
  const g = new THREE.ExtrudeGeometry(shapeFrom(cmds), { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.045, bevelSegments: 4, curveSegments: 24 });
  g.translate(0, 0, -DEPTH); g.computeBoundingBox(); const c = new THREE.Vector3(); g.boundingBox.getCenter(c); c.z = 0; g.translate(-c.x, -c.y, 0);
  const m = new THREE.Mesh(g, inkMat); m.castShadow = m.receiveShadow = true; m.userData.home = c; scene.add(m); parts[name] = m;
}
const BALL_HOME = new THREE.Vector3(X(769), Y(385), -DEPTH / 2), BALL_R = 0.65;
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 64, 32), inkMat); ball.castShadow = ball.receiveShadow = true; scene.add(ball);

// backdrop wall (receives shadow), flat lime when emissive takes over
const wallMat = new THREE.MeshStandardMaterial({ color: LIME, roughness: 0.9, emissive: LIME, emissiveIntensity: 0.5 });
const wall = new THREE.Mesh(new THREE.PlaneGeometry(4000, 3000), wallMat); wall.position.z = WALLZ - 0.01; wall.receiveShadow = true; scene.add(wall);

// foreground/midground floating dots (brand echo)
const dots = []; const dr = rng(4);
for (let i = 0; i < 10; i++) {
  const r = 0.12 + dr() * 0.35; const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16), inkMat); m.castShadow = true;
  const a = dr() * Math.PI * 2, rad = 4.5 + dr() * 5;
  m.userData = { base: new THREE.Vector3(Math.cos(a) * rad * 1.3, Math.sin(a) * rad * 0.6, 0.5 + dr() * 6), ph: dr() * 6, r };
  scene.add(m); dots.push(m);
}

// ---------- assembly choreography ----------
const EXPLODE = {
  stem: { p: new THREE.Vector3(-3.6, 0.9, 2.2), r: new THREE.Euler(0.35, 0.9, -0.25), land: 2.0 },
  arm: { p: new THREE.Vector3(1.0, 3.4, 1.0), r: new THREE.Euler(-0.6, -0.5, 0.5), land: 2.5 },
  band: { p: new THREE.Vector3(4.6, -2.2, 3.0), r: new THREE.Euler(0.5, -0.9, -0.4), land: 3.0 },
};
const FLY = 0.42;
function partPose(name, t) {
  const m = parts[name], { p, r, land } = EXPLODE[name]; const home = m.userData.home;
  // idle drift in exploded state
  const drift = new THREE.Vector3(Math.sin(t * 0.9 + land) * 0.25, Math.cos(t * 0.7 + land * 2) * 0.2, Math.sin(t * 0.5 + land) * 0.2);
  const start = p.clone().add(drift);
  const u = clamp((t - (land - FLY)) / FLY); const e = easeInCubic(u) * 0.35 + u * u * 0.65; // accelerating into landing (weight)
  const pos = start.clone().lerp(home, Math.min(1, e));
  const rot = new THREE.Euler(lerp(r.x + t * 0.15, 0, e), lerp(r.y + t * 0.1, 0, e), lerp(r.z, 0, e));
  // landing recoil (pushed into wall, bounce back)
  const rec = spring(t - land, 26, 9);
  pos.z -= rec * 0.18; rot.x += rec * 0.05;
  return { pos, rot };
}
// ball: falls at 3.5, bounces on band top surface, rolls to home
function bandTopY(x) { return Y(451); }
function ballState(t) {
  const startX = X(845), homeX = BALL_HOME.x; const restY = Y(451) + BALL_R;
  if (t < 3.45) return { pos: new THREE.Vector3(X(850), Y(-200), -DEPTH / 2), sq: 1, vis: false };
  // bounce schedule
  const hits = [3.9, 4.25, 4.47, 4.6]; const heights = [0, 1.6, 0.55, 0.12];
  let y, sq = 1;
  if (t < hits[0]) { const u = (t - 3.45) / (hits[0] - 3.45); y = lerp(Y(-120), restY, u * u); }
  else if (t < hits[3]) { let i = 0; while (t >= hits[i + 1]) i++; const u = (t - hits[i]) / (hits[i + 1] - hits[i]); y = restY + heights[i + 1] * 4 * u * (1 - u); }
  else y = restY;
  for (const h of hits.slice(0, 3)) { const d = t - h; if (d >= 0 && d < 0.09) sq = Math.min(sq, 1 - 0.28 * Math.sin(d / 0.09 * Math.PI) * (h === hits[0] ? 1 : 0.6)); }
  const ux = clamp((t - 3.45) / 1.35); const x = lerp(startX + 0.4, homeX, 1 - Math.pow(1 - ux, 2.2));
  return { pos: new THREE.Vector3(x, y, -DEPTH / 2), sq, vis: true, rollA: -(x - startX) / BALL_R };
}

// ---------- camera (spherical keyframes, dolly zoom) ----------
// t, az, el, frameH, target
const CK = [
  [0.0, -62, -14, 2.6, [-3.2, 0.6, 2.0]],
  [1.0, -48, -10, 5.0, [-2.0, 0.6, 1.4]],
  [2.0, -34, -6, 11.0, [-0.6, 0.3, 0.6]],
  [3.0, -18, 6, 12.0, [0.0, 0.2, 0.0]],
  [4.3, 16, 14, 9.0, [1.6, 0.9, -0.4]],
  [5.4, 14, 8, 11.0, [0.3, 0.2, -0.5]],
  [7.3, 0, 0, 10.24, [0, 0, WALLZ]],
  [10.0, 0, 0, 10.24, [0, 0, WALLZ]],
];
function herm(t, get) {
  const n = CK.length; if (t <= CK[0][0]) return get(CK[0]); if (t >= CK[n - 1][0]) return get(CK[n - 1]);
  let i = 0; while (CK[i + 1][0] < t) i++;
  const P = j => get(CK[clamp(j, 0, n - 1)]), T = j => CK[clamp(j, 0, n - 1)][0];
  const m = j => (j <= 0 || j >= n - 2) ? 0 : (P(j + 1) - P(j - 1)) / (T(j + 1) - T(j - 1));
  const h = T(i + 1) - T(i), s = (t - T(i)) / h;
  return (2*s**3-3*s**2+1) * P(i) + (s**3-2*s**2+s) * h * m(i) + (-2*s**3+3*s**2) * P(i + 1) + (s**3-s**2) * h * m(i + 1);
}
function fovAt(t) { // degrees; log-space collapse 5.4 -> 7.3
  const base = lerp(34, 40, sstep(0, 3, t));
  const u = easeInOutCubic(clamp((t - 5.4) / 1.9));
  return Math.exp(lerp(Math.log(base), Math.log(0.8), u));
}
function camAt(t) {
  const az = THREE.MathUtils.degToRad(herm(t, k => k[1])), el = THREE.MathUtils.degToRad(herm(t, k => k[2]));
  const h = herm(t, k => k[3]); const tgt = new THREE.Vector3(herm(t, k => k[4][0]), herm(t, k => k[4][1]), herm(t, k => k[4][2]));
  const fov = fovAt(t); const d = h / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  return { pos: tgt.clone().addScaledVector(dir, d), tgt, fov, d };
}

// ---------- post ----------
const composer = new EffectComposer(renderer); composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 10, aperture: 0.0, maxblur: 0.01 }); composer.addPass(bokeh);
composer.addPass(new OutputPass());

// flatten progress
const flatK = t => sstep(6.4, 7.35, t);      // lighting -> flat
const pressK = t => easeInOutCubic(clamp((t - 6.1) / 1.2)); // depth collapse into wall

function setState(t) {
  const c = camAt(t);
  const shake = spring(t - 2.0, 38, 10) * 0.05 + spring(t - 2.5, 38, 10) * 0.03 + spring(t - 3.0, 38, 10) * 0.03 + spring(t - 3.9, 40, 10) * 0.025;
  camera.position.copy(c.pos); camera.position.y += shake * c.d * 0.1 * (1 - sstep(5, 6, t));
  camera.fov = c.fov; camera.near = Math.max(0.05, c.d - 40); camera.far = c.d + 40; camera.updateProjectionMatrix();
  camera.lookAt(c.tgt); camera.rotateZ((1 - sstep(4.5, 6.5, t)) * Math.sin(t * 0.8) * 0.05 + (t < 2 ? 0.1 * (1 - t / 2) : 0));
  // DOF: strong in macro, off when flat
  const focusP = t < 2 ? parts.stem.position : new THREE.Vector3(0, 0, -0.5);
  bokeh.uniforms.focus.value = camera.position.distanceTo(focusP);
  bokeh.uniforms.aperture.value = lerp(0.0025, 0.0004, sstep(0.5, 2.5, t)) * (1 - sstep(4.8, 5.6, t)) / Math.max(1, c.d / 15);

  const press = pressK(t), flat = flatK(t);
  for (const name of Object.keys(parts)) {
    const m = parts[name]; const { pos, rot } = partPose(name, t);
    m.position.copy(pos); m.rotation.copy(rot);
    // collapse depth: back face stays on wall -> scale z around wall
    const sz = lerp(1, 0.015, press); m.scale.set(1, 1, sz); m.position.z = lerp(pos.z, WALLZ + DEPTH * sz, press);
    m.position.z = Math.min(m.position.z, m.position.z); 
  }
  // pieces geometry: back at -DEPTH*sz relative -> front at position.z; keep back on wall
  for (const m of Object.values(parts)) { const sz = m.scale.z; if (press > 0) m.position.z = lerp(m.position.z, WALLZ + DEPTH * sz, press); }

  const b = ballState(t); ball.visible = b.vis; ball.position.copy(b.pos);
  const bz = lerp(1, 0.02, press); ball.position.z = lerp(b.pos.z, WALLZ + BALL_R * bz, press);
  ball.scale.set(1 / Math.sqrt(b.sq), b.sq, bz / Math.sqrt(b.sq)); ball.rotation.z = b.rollA || 0;

  // floating dots: drift, then get pulled into the wall and vanish before flatten
  for (const d of dots) { const { base, ph } = d.userData; const out = sstep(4.6, 5.6, t);
    d.position.set(base.x * (1 + out * 1.5) + Math.sin(t * 0.7 + ph) * 0.3, base.y * (1 + out * 1.5) + Math.cos(t * 0.6 + ph) * 0.3, base.z);
    d.visible = out < 0.999; }

  // lighting -> flat
  const lit = 1 - flat;
  sun.intensity = 2.4 * lit; rimL.intensity = 1.6 * lit; hemi.intensity = 1.0 * lit;
  inkMat.emissiveIntensity = flat; inkMat.envMapIntensity = lit; inkMat.clearcoat = lit;
  wallMat.emissiveIntensity = lerp(0.5, 1, flat); wallMat.color.set(LIME).multiplyScalar(0.32 * lit);
  scene.environment = lit > 0.001 ? envTex : null;
}
const envTex = scene.environment;

// ---------- exact 2D logo ----------
const LOGO_PATH = new Path2D('M169 320H323V486L463 320H640L479 512L554 601L681 451H854L640 704H461L398 626C384 609 372 600 356 600C337 600 323 615 323 638V704H169Z');
const S2 = 1080 / 1024 * 1.0; // logo scale so frame height matches source square
function draw2D(t, alpha) {
  const c = octx; c.save(); c.globalAlpha = alpha;
  c.fillStyle = LIME; c.fillRect(0, 0, W, H);
  // stamp pulse: squash/overshoot around logo center
  const k = t - 7.5; const pulse = k > 0 ? spring(k, 16, 5.5) : 0;
  const sx = 1 + pulse * 0.05, sy = 1 - pulse * 0.04;
  c.translate(W / 2, H / 2); c.scale(sx * S2, sy * S2); c.translate(-511.5, -512);
  c.fillStyle = INK; c.fill(LOGO_PATH);
  // dot secondary bounce (2D): leaves later, lands at 7.95
  const db = k > 0.05 && k < 0.5 ? Math.sin((k - 0.05) / 0.45 * Math.PI) * 26 : 0;
  const dsq = (k > 0.5 && k < 0.6) ? 1 - 0.18 * Math.sin((k - 0.5) / 0.1 * Math.PI) : 1;
  c.save(); c.translate(769, 450 - db); c.scale(1 / dsq, dsq); c.beginPath(); c.arc(0, -65, 65, 0, Math.PI * 2); c.fill(); c.restore();
  c.restore();
}
const grain = [];
for (let i = 0; i < 6; i++) { const c = document.createElement('canvas'); c.width = 480; c.height = 270; const x = c.getContext('2d'); const d = x.createImageData(480, 270); const r = rng(50 + i);
  for (let p = 0; p < d.data.length; p += 4) { const v = r() * 255; d.data[p] = d.data[p + 1] = d.data[p + 2] = v; d.data[p + 3] = 14; } x.putImageData(d, 0, 0); grain.push(c); }

function overlay(t) {
  const g3 = 1 - sstep(6.8, 7.4, t);
  if (g3 > 0) { // vignette + grain only while 3D
    const c = octx; c.save(); c.globalAlpha = g3;
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H); g.addColorStop(0, 'rgba(20,33,10,0)'); g.addColorStop(1, 'rgba(20,33,10,0.35)');
    c.fillStyle = g; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'overlay'; c.drawImage(grain[Math.floor(t * 24) % 6], 0, 0, W, H); c.restore();
  }
  const a2 = sstep(7.3, 7.45, t); if (a2 > 0) draw2D(t, a2);
}

function camSpeed(t) { const a = camAt(t), b = camAt(t + 1 / FPS); return a.pos.distanceTo(b.pos) / Math.max(1, a.d / 12) + a.tgt.distanceTo(b.tgt) * 1.5; }
window.renderFrame = (i, maxSub = 6) => {
  const t = i / FPS;
  if (t >= 7.45) { overlay(t); return 0; }
  const fast = (t > 1.55 && t < 3.15) || (t > 3.8 && t < 4.65);
  const n = Math.max(1, Math.min(maxSub, Math.ceil(camSpeed(t) * 12 + (fast ? 4 : 0))));
  const shutter = 0.5 / FPS;
  for (let k = 0; k < n; k++) { const ts = t + (n === 1 ? 0 : (k / (n - 1) - 0.5) * shutter); setState(ts); composer.render(); octx.globalAlpha = 1 / (k + 1); octx.drawImage(glCanvas, 0, 0); }
  octx.globalAlpha = 1; overlay(t); return n;
};
window.grab = q => out.toDataURL('image/jpeg', q ?? 0.95);
window.ready = true;
