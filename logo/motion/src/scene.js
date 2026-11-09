import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const W = 1920, H = 1080, FPS = 60, DUR = 12;
const ORANGE = 0xff5b3a, VIOLET = 0x7c5cff;

// ---------- helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutExpo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
const easeOutBack = (t, s = 2.2) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
const easeInOutCubic = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
// damped spring response for impacts
const spring = (t, f = 9, d = 6) => t < 0 ? 0 : Math.exp(-d * t) * Math.sin(f * t);

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
const glCanvas = renderer.domElement;
const out = document.createElement('canvas'); out.width = W; out.height = H; document.body.appendChild(out);
const octx = out.getContext('2d');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0a12);
scene.fog = new THREE.Fog(0x0b0a12, 22, 60);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200);

scene.add(new THREE.AmbientLight(0x6655aa, 0.35));
const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(-6, 8, 10); scene.add(key);
const rim = new THREE.DirectionalLight(0x8f7bff, 2.5); rim.position.set(8, 2, -8); scene.add(rim);
const sweep = new THREE.SpotLight(0xffffff, 0, 40, 0.25, 0.6); sweep.position.set(-14, 4, 12); scene.add(sweep); scene.add(sweep.target);

// ---------- letter shapes (from vk SVG, 1000-unit space) ----------
const toW = ([X, Y]) => new THREE.Vector2((X - 570) / 100, -(Y - 500) / 100);
const Vpts = [[215,300],[325,300],[400,560],[475,300],[585,300],[455,700],[345,700]].map(toW);
const Kpts = [[600,300],[700,300],[700,455],[805,300],[920,300],[780,490],[925,700],[805,700],[700,540],[700,700],[600,700]].map(toW);
const DEPTH = 1.0;
function extrude(pts) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.05, bevelSegments: 3, curveSegments: 1 });
  g.translate(0, 0, -DEPTH); return g;
}
// code texture for side faces
function codeTexture() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const x = c.getContext('2d');
  x.fillStyle = '#1a1033'; x.fillRect(0, 0, 1024, 1024);
  const toks = ['const','vk','=','render(','shape',')','{','}','=>','extrude(','depth:','1.0','</>','design','3d','code','fn','let','<VK/>','0x7c5cff','import','return','pen.draw()','anchors','[]','mesh','.map(','light'];
  const r = rng(7); x.font = '600 30px "JetBrains Mono"'; x.textBaseline = 'top';
  for (let row = 0; row < 26; row++) {
    let cx = 20 + Math.floor(r() * 4) * 40;
    while (cx < 1000) {
      const t = toks[Math.floor(r() * toks.length)];
      const p = r(); x.fillStyle = p < .15 ? '#ff7a5c' : p < .45 ? '#b8a6ff' : p < .55 ? '#5ad1ff' : '#efeaff';
      x.fillText(t, cx, row * 39 + 8); cx += x.measureText(t + ' ').width;
    }
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(0.35, 0.35); tex.anisotropy = 8; return tex;
}
const codeTex = codeTexture();
const frontMat = new THREE.MeshPhysicalMaterial({ color: 0xcfc6ff, roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06, iridescence: 0.6, iridescenceIOR: 1.6, envMapIntensity: 0.7, transparent: true });
const sideMat = new THREE.MeshPhysicalMaterial({ color: 0x3a22a8, roughness: 0.35, metalness: 0.2, clearcoat: 0.6, emissive: 0xffffff, emissiveMap: codeTex, emissiveIntensity: 0, transparent: true });
const logo = new THREE.Group(); scene.add(logo);
const letterGroup = new THREE.Group(); logo.add(letterGroup);
const vMesh = new THREE.Mesh(extrude(Vpts), [frontMat, sideMat]);
const kMesh = new THREE.Mesh(extrude(Kpts), [frontMat, sideMat]);
letterGroup.add(vMesh, kMesh);

// brackets
function chevron(dir) {
  // thick chevron "<" as polygon, dir=-1 for "<", +1 for ">"
  const s = new THREE.Shape(); const w = 0.55, hgt = 1.9, d = 1.25;
  const pts = [[d, hgt], [d + w, hgt], [w * 0.9 , 0], [d + w, -hgt], [d, -hgt], [-w * 0.15, 0]].map(([x, y]) => new THREE.Vector2(dir < 0 ? x - d / 2 : -(x - d / 2), y));
  if (dir > 0) pts.reverse();
  s.setFromPoints(pts);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 4 });
  g.translate(0, 0, -0.6); return g;
}
const brMat = new THREE.MeshPhysicalMaterial({ color: 0xff5b3a, roughness: 0.25, metalness: 0.25, clearcoat: 1, emissive: ORANGE, emissiveIntensity: 0.0 });
const brL = new THREE.Mesh(chevron(-1), brMat), brR = new THREE.Mesh(chevron(1), brMat);
logo.add(brL, brR);

// orange dot = the pen point
const dot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(ORANGE).multiplyScalar(2.2) }));
scene.add(dot);
const dotLight = new THREE.PointLight(ORANGE, 0, 9, 1.6); scene.add(dotLight);

// outline lines (pen drawing)
const lineMat = new LineMaterial({ color: ORANGE, linewidth: 4, resolution: new THREE.Vector2(W, H), transparent: true });
lineMat.color.multiplyScalar(1.6);
function polyPath(pts) { const p = pts.map(v => new THREE.Vector3(v.x, v.y, 0.02)); p.push(p[0].clone()); return p; }
const vPath = polyPath(Vpts), kPath = polyPath(Kpts);
function pathLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += p[i].distanceTo(p[i - 1]); return L; }
function partial(p, f) { // first fraction f of path
  const L = pathLen(p) * f; const r = [p[0].clone()]; let acc = 0;
  for (let i = 1; i < p.length; i++) { const d = p[i].distanceTo(p[i - 1]);
    if (acc + d >= L) { r.push(p[i - 1].clone().lerp(p[i], (L - acc) / d)); return r; } acc += d; r.push(p[i].clone()); }
  return r;
}
const vLine = new Line2(new LineGeometry(), lineMat), kLine = new Line2(new LineGeometry(), lineMat);
scene.add(vLine, kLine);
function setLine(l, pts) {
  if (pts.length < 2) { l.visible = false; return; } l.visible = true;
  const g = new LineGeometry(); g.setPositions(pts.flatMap(v => [v.x, v.y, v.z])); l.geometry.dispose(); l.geometry = g; l.computeLineDistances();
}
// anchor squares
function squareTex(fill) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = fill ? '#ff5b3a' : '#0b0a12'; x.fillRect(10, 10, 44, 44); x.lineWidth = 7; x.strokeStyle = '#ff5b3a'; x.strokeRect(10, 10, 44, 44);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const sqTex = squareTex(false);
const anchors = [];
const DRAW_V = [0.25, 1.05], DRAW_K = [1.1, 1.9];
function addAnchors(path, [t0, t1]) {
  const L = pathLen(path); let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    if (i > 0) acc += path[i].distanceTo(path[i - 1]);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sqTex, transparent: true, depthTest: false }));
    s.position.copy(path[i]).setZ(0.05); s.userData.t = lerp(t0, t1, acc / L); s.renderOrder = 10; scene.add(s); anchors.push(s);
  }
}
addAnchors(vPath, DRAW_V); addAnchors(kPath, DRAW_K);
function drawFrac(t, [t0, t1]) { const u = clamp((t - t0) / (t1 - t0)); return u < .5 ? 2 * u * u * 0.9 + u * 0.1 : u; }
function penTip(t) {
  if (t < DRAW_V[0]) return vPath[0].clone();
  if (t <= DRAW_V[1]) { const p = partial(vPath, smoothDraw(t, DRAW_V)); return p[p.length - 1]; }
  if (t < DRAW_K[0]) return vPath[0].clone().lerp(kPath[0], sstep(DRAW_V[1], DRAW_K[0], t));
  if (t <= DRAW_K[1]) { const p = partial(kPath, smoothDraw(t, DRAW_K)); return p[p.length - 1]; }
  return kPath[0].clone();
}
function smoothDraw(t, [t0, t1]) { const u = clamp((t - t0) / (t1 - t0)); return u * u * (3 - 2 * u) * 0.35 + u * 0.65; }

// ---------- environment layers ----------
// far dot grid with ripple shader
const gridN = 90, gpos = [];
for (let i = 0; i < gridN; i++) for (let j = 0; j < 56; j++) gpos.push((i - gridN / 2) * 1.1, (j - 28) * 1.1, 0);
const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
const gMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uAmp: { value: 1 } },
  vertexShader: `uniform float uT; uniform float uAmp; varying float vA; void main(){ vec3 p=position; float r=length(p.xy);
    float w=uT-r*0.055; float wave=(w>0.0)? sin(w*16.0)*exp(-w*3.0)*uAmp : 0.0; p.z+=wave*1.6; vA=0.35+0.65*clamp(abs(wave)*2.0,0.0,1.0);
    vec4 mv=modelViewMatrix*vec4(p,1.0); gl_PointSize= 70.0/ -mv.z; gl_Position=projectionMatrix*mv; }`,
  fragmentShader: `varying float vA; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor=vec4(0.62,0.55,1.0, vA*0.55*smoothstep(0.5,0.2,d)); }` });
const grid = new THREE.Points(gGeo, gMat); grid.position.z = -16; scene.add(grid);

// construction guides
const guideMat = new LineMaterial({ color: 0x5ad1ff, linewidth: 1.2, resolution: new THREE.Vector2(W, H), transparent: true, opacity: 0.5 });
const guides = [];
const gy = [2, -2, 0.0], gx = [-3.55, 3.55, 0.15, 0.3];
gy.forEach((y, i) => { const l = new Line2(new LineGeometry(), guideMat); l.userData = { kind: 'h', v: y, t: 0.15 + i * 0.12 }; scene.add(l); guides.push(l); });
gx.forEach((x, i) => { const l = new Line2(new LineGeometry(), guideMat); l.userData = { kind: 'v', v: x, t: 0.3 + i * 0.1 }; scene.add(l); guides.push(l); });

// foreground wireframe cubes
const cubes = []; const cr = rng(3);
for (let i = 0; i < 9; i++) {
  const sz = 0.3 + cr() * 0.7; const g = new THREE.BoxGeometry(sz, sz, sz);
  const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: 0x8f7bff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.25, clearcoat: 1 }));
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0xb9a8ff, transparent: true, opacity: 0.7 }));
  m.add(e);
  const ang = cr() * Math.PI * 2, rad = 7 + cr() * 6;
  m.userData = { base: new THREE.Vector3(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.55, -4 + cr() * 12), spin: new THREE.Vector3(cr(), cr(), cr()).multiplyScalar(1.2), ph: cr() * 6 };
  scene.add(m); cubes.push(m);
}

// code glyph particles
const glyphs = []; const chars = ['{', '}', ';', '</>', '0', '1', '=>', '()', '[]', '<', '>', '/', '*', 'fn', '#'];
const glyphTex = {};
for (const ch of chars) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128; const x = c.getContext('2d');
  x.font = '700 64px "JetBrains Mono"'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = '#ffffff'; x.fillText(ch, 64, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; glyphTex[ch] = t;
}
const pr = rng(11);
for (let i = 0; i < 140; i++) {
  const ch = chars[Math.floor(pr() * chars.length)];
  const col = pr() < .25 ? ORANGE : pr() < .6 ? 0xb9a8ff : 0xffffff;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTex[ch], color: col, transparent: true, depthWrite: false }));
  const src = new THREE.Vector3((pr() - .5) * 7, (pr() - .5) * 4, -0.5);
  const dir = new THREE.Vector3(src.x * 0.6 + (pr() - .5) * 3, src.y * 0.6 + (pr() - .5) * 2.5, 2 + pr() * 7);
  s.userData = { src, dir, t0: 5.6 + pr() * 1.8, life: 1.4 + pr() * 1.2, size: 0.35 + pr() * 0.5 };
  s.visible = false; scene.add(s); glyphs.push(s);
}

// ---------- camera path ----------
// keyframes: t, pos, target
const K = [
  [0.0, [-2.4, -2.6, 8.8], null],
  [1.0, [-1.2, -1.2, 10.8], null],
  [1.9, [1.0, -2.0, 13.8], null],
  [2.6, [-6.5, -2.6, 12.5], [0, 0, 0]],
  [4.0, [-1.0, 3.8, 13.0], [0.2, 0, 0]],
  [5.5, [9.0, 1.2, 8.0], [0.5, 0, -0.5]],
  [6.8, [4.0, 2.4, 14.5], [0.2, 0.1, 0]],
  [8.0, [0.4, 0.6, 20.0], [0, -0.55, 0]],
  [12.0, [-0.3, 0.25, 18.8], [0, -0.6, 0]],
];
function hermite(t, idx) { // idx 1 = pos
  const n = K.length; if (t <= K[0][0]) return new THREE.Vector3(...K[0][1]); if (t >= K[n - 1][0]) return new THREE.Vector3(...K[n - 1][1]);
  let i = 0; while (K[i + 1][0] < t) i++;
  const P = j => new THREE.Vector3(...K[clamp(j, 0, n - 1)][1]);
  const T = j => K[clamp(j, 0, n - 1)][0];
  const m = j => (j <= 0 || j >= n - 1) ? new THREE.Vector3() : P(j + 1).sub(P(j - 1)).divideScalar(T(j + 1) - T(j - 1));
  const h = T(i + 1) - T(i), s = (t - T(i)) / h;
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
  return P(i).multiplyScalar(h00).add(m(i).multiplyScalar(h10 * h)).add(P(i + 1).multiplyScalar(h01)).add(m(i + 1).multiplyScalar(h11 * h));
}
function camTarget(t) {
  // smoothed pen tip in S1, then key targets
  let tip = new THREE.Vector3(); for (let k = 0; k < 6; k++) tip.add(penTip(t - k * 0.035)); tip.divideScalar(6);
  const keyT = t < 2.6 ? new THREE.Vector3(0, 0, 0) : (() => { // interpolate targets among keyframes with targets
    const ks = K.filter(k => k[2]); let i = 0; while (i < ks.length - 2 && ks[i + 1][0] < t) i++;
    const a = ks[i], b = ks[i + 1]; const s = easeInOutCubic(clamp((t - a[0]) / (b[0] - a[0]))); return new THREE.Vector3(...a[2]).lerp(new THREE.Vector3(...b[2]), s); })();
  return tip.lerp(keyT, 0.4 + 0.6 * sstep(1.3, 2.6, t));
}

// ---------- dot path ----------
const FINAL_DOT = new THREE.Vector3(3.9, 2.42, 0.3);
function dotPos(t) {
  if (t < 1.95) return penTip(t).setZ(0.15);
  const orbit = (tt) => { const a = (tt - 2.0) * 1.9 + Math.PI * 0.6; return new THREE.Vector3(Math.cos(a) * 5.4, Math.sin(a * 1.0) * 2.6 + Math.sin(tt * 2.3) * 0.4, Math.sin(a) * 3.2 + 0.6); };
  if (t < 2.3) return kPath[0].clone().setZ(0.15).lerp(orbit(t), sstep(1.95, 2.3, t));
  if (t < 7.3) return orbit(t);
  if (t < 8.0) { const u = clamp((t - 7.3) / 0.7); const e = u * u * (3 - 2 * u); const a = orbit(t); const ctrl = new THREE.Vector3(5.5, 5.5, 3);
    const p = a.clone().multiplyScalar((1 - e) ** 2).add(ctrl.multiplyScalar(2 * (1 - e) * e)).add(FINAL_DOT.clone().multiplyScalar(e * e)); return p; }
  return FINAL_DOT.clone().add(new THREE.Vector3(0, spring(t - 8.0, 22, 7) * 0.25, 0));
}
const trail = new Line2(new LineGeometry(), new LineMaterial({ color: 0xff7a5c, linewidth: 3, resolution: new THREE.Vector2(W, H), transparent: true, opacity: 0.85 }));
trail.material.color.multiplyScalar(1.4); scene.add(trail);

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.setPixelRatio(1); composer.setSize(W, H);
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 14, aperture: 0.00025, maxblur: 0.008 });
composer.addPass(bokeh);
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.4, 0.45, 0.92); composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- state at time t ----------
function setState(t) {
  // camera
  const pos = hermite(t);
  // impact shakes
  const shake = spring(t - 2.0, 40, 9) * 0.18 + spring(t - 6.5, 40, 10) * 0.08 + spring(t - 7.0, 40, 10) * 0.08 + spring(t - 8.0, 30, 9) * 0.05;
  pos.x += shake * 0.6; pos.y += shake;
  camera.position.copy(pos);
  const tgt = camTarget(t); camera.lookAt(tgt);
  camera.rotateZ(Math.sin(t * 0.9) * 0.03 * (1 - sstep(7.5, 9, t)) + (t < 2 ? -0.08 * (1 - t / 2) : 0));
  camera.fov = lerp(30, 34, sstep(0, 2.5, t)) - sstep(7.6, 9, t) * 2; camera.updateProjectionMatrix();
  bokeh.uniforms.focus.value = camera.position.distanceTo(t < 2 ? penTip(t) : new THREE.Vector3(0, 0, 0));
  bokeh.uniforms.aperture.value = lerp(0.0004, 0.00012, sstep(7.5, 9, t));

  // outlines
  const fv = smoothDraw(t, DRAW_V), fk = smoothDraw(t, DRAW_K);
  setLine(vLine, t < DRAW_V[0] ? [] : partial(vPath, fv));
  setLine(kLine, t < DRAW_K[0] ? [] : partial(kPath, fk));
  lineMat.opacity = 1 - sstep(2.0, 2.5, t);
  for (const a of anchors) { const u = (t - a.userData.t) / 0.18; const sc = u < 0 ? 0 : easeOutBack(u, 3) * 0.32 * (1 - sstep(2.0, 2.35, t)); a.scale.set(sc, sc, 1); a.visible = sc > 0.001; }
  for (const g of guides) {
    const { kind, v, t: gt } = g.userData; const u = easeOutExpo(clamp((t - gt) / 0.6)); const L = 30 * u;
    const p = kind === 'h' ? [-L, v, -0.3, L, v, -0.3] : [v, -L * 0.6, -0.3, v, L * 0.6, -0.3];
    if (u <= 0) { g.visible = false; continue; } g.visible = true; const geo = new LineGeometry(); geo.setPositions(p); g.geometry.dispose(); g.geometry = geo;
  }
  guideMat.opacity = 0.45 * (1 - sstep(4.5, 6.0, t));

  // letters: fill + extrude
  const fill = sstep(1.88, 2.02, t);
  letterGroup.visible = fill > 0;
  frontMat.opacity = fill; sideMat.opacity = fill;
  const ex = t < 2.0 ? 0.02 : lerp(0.02, 1, easeOutBack(clamp((t - 2.0) / 0.55), 2.6));
  letterGroup.scale.set(1, 1, Math.max(0.02, ex));
  frontMat.emissive = new THREE.Color(ORANGE); frontMat.emissiveIntensity = (1 - sstep(1.95, 2.35, t)) * 0.8 * fill;
  // recoil from bracket slams
  letterGroup.position.x = spring(t - 6.5, 18, 8) * 0.12 - spring(t - 7.0, 18, 8) * 0.12;
  letterGroup.rotation.y = Math.sin(t * 0.7) * 0.04 * (1 - sstep(7.5, 8.5, t));
  // code reveal on sides (scan)
  sideMat.emissiveIntensity = sstep(5.4, 6.0, t) * (1.5 - 0.6 * sstep(8.0, 9.5, t)) + 0.02;
  codeTex.offset.set(t * 0.05, -t * 0.25 * sstep(5.4, 6.0, t));

  // brackets
  const bl = easeOutExpo(clamp((t - 6.25) / 0.3)), brr = easeOutExpo(clamp((t - 6.75) / 0.3));
  brL.visible = t > 5.9; brR.visible = t > 6.4;
  brL.position.set(lerp(-14, -5.95, bl), lerp(-3, 0, bl), lerp(9, 0, bl)); brL.rotation.set(0, lerp(-1.6, 0, bl) + spring(t - 6.55, 20, 7) * 0.15, lerp(0.8, 0, bl));
  brR.position.set(lerp(14, 5.95, brr), lerp(3, 0, brr), lerp(9, 0, brr)); brR.rotation.set(0, lerp(1.6, 0, brr) - spring(t - 7.05, 20, 7) * 0.15, lerp(-0.8, 0, brr));
  brMat.emissiveIntensity = 0.12 + Math.abs(spring(t - 6.55, 30, 6)) * 0.6 + Math.abs(spring(t - 7.05, 30, 6)) * 0.6;

  // dot + trail
  const dp = dotPos(t); dot.position.copy(dp);
  const pop = t < 0.25 ? easeOutBack(t / 0.25, 3) : 1; const sq = 1 + spring(t - 8.0, 22, 7) * 0.5;
  dot.scale.set(pop * sq, pop / sq, pop * sq);
  dotLight.position.copy(dp).add(new THREE.Vector3(0, 0, 0.6)); dotLight.intensity = (12 + 18 * sstep(2, 3, t)) * (1 - 0.75 * sstep(7.8, 8.6, t));
  const tr = []; const span = t < 2 ? 0 : 0.55 * (1 - sstep(7.7, 8.0, t));
  if (span > 0.01) { for (let k = 0; k <= 40; k++) { const p = dotPos(t - span * k / 40); tr.push(p.x, p.y, p.z); } const g = new LineGeometry(); g.setPositions(tr); trail.geometry.dispose(); trail.geometry = g; trail.visible = true; }
  else trail.visible = false;

  // grid ripple
  gMat.uniforms.uT.value = Math.max(0, t - 2.0) + (t > 8 ? 0 : 0);
  gMat.uniforms.uAmp.value = 1;
  grid.rotation.set(-0.15 + t * 0.01, 0.1 - t * 0.012, 0);

  // cubes
  for (const c of cubes) { const { base, spin, ph } = c.userData; c.position.copy(base).add(new THREE.Vector3(Math.sin(t * 0.6 + ph) * 0.5, Math.cos(t * 0.5 + ph) * 0.4, 0));
    c.position.x += spring(t - 2.0, 6, 3) * base.x * 0.12; c.position.y += spring(t - 2.0, 6, 3) * base.y * 0.12;
    const push = 1 + 0.45 * sstep(7.5, 9.5, t); c.position.x *= push; c.position.y *= push; c.rotation.set(spin.x * t + ph, spin.y * t, spin.z * t); }

  // glyph particles
  for (const s of glyphs) { const { src, dir, t0, life, size } = s.userData; const u = (t - t0) / life;
    if (u < 0 || u > 1) { s.visible = false; continue; } s.visible = true;
    const e = 1 - Math.pow(1 - u, 2); s.position.copy(src).addScaledVector(dir, e);
    s.material.opacity = sstep(0, 0.1, u) * (1 - sstep(0.7, 1, u)); s.scale.setScalar(size); }

  // light sweep
  const sw = clamp((t - 10.2) / 1.1);
  sweep.intensity = sw > 0 && sw < 1 ? Math.sin(sw * Math.PI) * 320 : 0;
  sweep.position.set(lerp(-14, 14, sw), 5, 10); sweep.target.position.set(lerp(-6, 6, sw), 0, 0);
}

// ---------- 2D overlay ----------
const grain = [];
for (let i = 0; i < 6; i++) { const c = document.createElement('canvas'); c.width = 480; c.height = 270; const x = c.getContext('2d'); const d = x.createImageData(480, 270); const r = rng(100 + i);
  for (let p = 0; p < d.data.length; p += 4) { const v = r() * 255; d.data[p] = d.data[p + 1] = d.data[p + 2] = v; d.data[p + 3] = 16; } x.putImageData(d, 0, 0); grain.push(c); }
function project(v) { const p = v.clone().project(camera); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; }

function overlay(t) {
  const c = octx;
  // HUD next to pen in S1
  const hudA = sstep(0.2, 0.4, t) * (1 - sstep(1.85, 2.0, t));
  if (hudA > 0) {
    const tip = penTip(t); const [x, y] = project(tip);
    c.save(); c.globalAlpha = hudA; c.font = '500 22px "JetBrains Mono"';
    const X = Math.round((tip.x * 100 + 570)), Y = Math.round(500 - tip.y * 100);
    const label = `x ${X}  y ${Y}`; const w = c.measureText(label).width + 24;
    c.fillStyle = '#ff5b3a'; c.beginPath(); c.roundRect(x + 26, y + 18, w, 38, 8); c.fill();
    c.fillStyle = '#0b0a12'; c.fillText(label, x + 38, y + 45); c.restore();
  }
  // name
  const name = 'VIKTORIA KITSAK';
  const nA = sstep(8.25, 8.7, t);
  if (nA > 0) {
    c.save(); c.textBaseline = 'alphabetic';
    const size = 76; c.font = `800 ${size}px "Inter Display"`;
    const finalTrack = 10; const u = easeOutExpo(clamp((t - 8.25) / 1.0)); const track = lerp(90, finalTrack, u);
    const widths = [...name].map(ch => c.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + track * (name.length - 1);
    let x = W / 2 - total / 2; const y = 812 + (1 - u) * 30;
    [...name].forEach((ch, i) => { const li = clamp((t - 8.25 - i * 0.03) / 0.5);
      c.globalAlpha = sstep(0, 1, li); c.filter = `blur(${(1 - easeOutExpo(li)) * 14}px)`;
      c.fillStyle = '#f5f1ea'; c.fillText(ch, x, y + (1 - easeOutExpo(li)) * 40); x += widths[i] + track; });
    c.restore();
  }
  // tagline typed
  const tg = [['Graphic Design', '#f5f1ea'], ['  ·  ', '#6b6390'], ['3D', '#9b83ff'], ['  ·  ', '#6b6390'], ['Code', '#ff5b3a']];
  const full = tg.map(s => s[0]).join('');
  const nChars = Math.floor(clamp((t - 9.25) / 1.05) * full.length);
  if (t > 9.15) {
    c.save(); c.font = '500 38px "JetBrains Mono"'; const fw = c.measureText(full).width; let x = W / 2 - fw / 2; const y = 885; let shown = 0;
    for (const [s, col] of tg) { const vis = s.slice(0, Math.max(0, nChars - shown)); c.fillStyle = col; c.fillText(vis, x, y); x += c.measureText(vis).width; shown += s.length; }
    if (Math.floor(t * 2) % 2 === 0 || nChars < full.length) { c.fillStyle = '#ff5b3a'; c.fillRect(x + 4, y - 31, 18, 38); }
    c.restore();
  }
  // vignette + grain
  const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'overlay'; c.drawImage(grain[Math.floor(t * 24) % 6], 0, 0, W, H); c.globalCompositeOperation = 'source-over';
}

// ---------- frame render with subframe motion blur ----------
function camSpeed(t) { const a = hermite(t), b = hermite(t + 1 / FPS); const ta = camTarget(t), tb = camTarget(t + 1 / FPS); return a.distanceTo(b) + ta.distanceTo(tb) * 1.5; }
window.renderFrame = (i, maxSub = 6) => {
  const t = i / FPS;
  const fast = (t > 6.2 && t < 7.2) || (t > 0.2 && t < 2.5) || (t > 7.3 && t < 8.1);
  const n = Math.max(1, Math.min(maxSub, Math.ceil(camSpeed(t) * 14 + (fast ? 4 : 0))));
  const shutter = 0.5 / FPS;
  for (let k = 0; k < n; k++) {
    const ts = t + (n === 1 ? 0 : (k / (n - 1) - 0.5) * shutter);
    setState(ts); composer.render();
    octx.globalAlpha = 1 / (k + 1); octx.drawImage(glCanvas, 0, 0);
  }
  octx.globalAlpha = 1; overlay(t);
  return n;
};
window.grab = (q) => out.toDataURL('image/jpeg', q ?? 0.95);
document.fonts.load('800 76px "Inter Display"').then(() => document.fonts.load('500 30px "JetBrains Mono"')).then(() => { codeTex.needsUpdate = true; window.ready = true; });
