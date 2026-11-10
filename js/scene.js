/* =========================================================
   FLORIS — 3D-пелюстки (three.js)
   Пелюстки змінюють форму під час прокрутки (data-form на секціях),
   розлітаються від курсора й реагують на швидкість гортання.
   ========================================================= */
(function () {
'use strict';
const THREE = window.THREE;
if (!THREE) return;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const small = () => innerWidth < 760;

const canvas = document.createElement('canvas');
canvas.className = 'petal-canvas';
canvas.setAttribute('aria-hidden', 'true');
document.body.prepend(canvas);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  canvas.remove();
  document.documentElement.classList.add('no-webgl');
}
if (!renderer) return;

const N = small() || coarse ? 240 : 520;
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 0, 12);
const group = new THREE.Group();
scene.add(group);

/* ---------- lights ---------- */
scene.add(new THREE.HemisphereLight(0xffe9e6, 0x2b0b10, 0.75));
const key = new THREE.DirectionalLight(0xfff1ea, 1.7); key.position.set(4, 6, 8); scene.add(key);
const rim = new THREE.DirectionalLight(0xff5a78, 2.2); rim.position.set(-6, 2, -5); scene.add(rim);
const pointer = new THREE.PointLight(0xffc4cc, 40, 12, 2); pointer.position.set(0, 0, 3); scene.add(pointer);

/* ---------- геометрія пелюстки ----------
   Форма й прожилки — з текстур пелюсток із ваших 3D-матеріалів (js/petal-textures.js).
   Площина вигнута «чашечкою», краї текстури обрізаються прозорістю. */
function petalGeometry(aspect) {
  const SU = 10, SV = 14, W = aspect;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= SV; j++) {
    const v = j / SV;
    for (let i = 0; i <= SU; i++) {
      const u = (i / SU) * 2 - 1;
      const x = u * W * 0.5;
      const z = 0.3 * u * u * W - 0.24 * v * v + 0.02 * Math.sin(u * 6 + v * 3) * v;
      pos.push(x, v, z);
      uv.push(i / SU, v);
    }
  }
  for (let j = 0; j < SV; j++) for (let i = 0; i < SU; i++) {
    const a = j * (SU + 1) + i, b = a + 1, c = a + SU + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.translate(0, -0.12, 0);
  g.computeVertexNormals();
  return g;
}

const TEX = (window.FLORIS_PETAL_TEX && window.FLORIS_PETAL_TEX.length) ? window.FLORIS_PETAL_TEX : [{ w: 2, h: 3, src: null }];
const loader = new THREE.TextureLoader();
const meshes = TEX.map((t, k) => {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd2d2d2, roughness: 0.6, metalness: 0,
    side: THREE.DoubleSide, alphaTest: 0.35, alphaToCoverage: true, // smooth petal edges
  });
  if (t.src) {
    const tex = loader.load(t.src, () => { mat.needsUpdate = true; });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    mat.map = tex;
  }
  const count = Math.ceil((N - k) / TEX.length);
  const m = new THREE.InstancedMesh(petalGeometry(t.w / t.h), mat, count);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  group.add(m);
  return m;
});
const K = meshes.length;

/* ---------- per-petal random seeds ---------- */
const R = new Float32Array(N * 8);
for (let i = 0; i < R.length; i++) R[i] = Math.random();
const r = (i, k) => R[i * 8 + k];

/* ---------- палітри ---------- */
const PALETTES = {
  velvet: ['#3a0710', '#5c161e', '#6e1a26', '#8a2433', '#a8334a', '#c25a68'],
  blush:  ['#f6d5d4', '#f0b9bd', '#e59aa2', '#fbe8e4', '#d98490', '#fff4f0'],
  cream:  ['#ffffff', '#f7efe9', '#f3dcd2', '#e9d6cf', '#fdf9f6', '#f0c9c4'],
  amber:  ['#e8632b', '#f08a3c', '#c9442a', '#fbe9dc', '#ffffff', '#a8331f'],
  peach:  ['#f6c39a', '#f0a77f', '#e88a6c', '#7a1f2b', '#ffd9b8', '#fbe2d0'],
};
PALETTES.snow = PALETTES.cream; PALETTES.sunset = PALETTES.peach; PALETTES.wild = PALETTES.amber;
const FLOWER_COUNT = Math.min(N, small() ? 70 : 96);
const colors = new Float32Array(N * 3);
const targetColors = new Float32Array(N * 3);
function paletteColor(pal, i) {
  // внутрішні пелюстки квітки — темніші, зовнішні — світліші
  if (i < FLOWER_COUNT) {
    const k = i / FLOWER_COUNT;
    const t = Math.min(pal.length - 3, Math.floor(k * (pal.length - 2) + r(i, 7) * 1.2));
    return pal[Math.max(0, t)];
  }
  return pal[Math.floor(r(i, 7) * pal.length)];
}
function setPalette(name, instant = false) {
  const pal = PALETTES[name] || PALETTES.velvet;
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    c.set(paletteColor(pal, i));
    targetColors[i * 3] = c.r; targetColors[i * 3 + 1] = c.g; targetColors[i * 3 + 2] = c.b;
  }
  if (instant) colors.set(targetColors);
  colorsDirty = true;
}
let colorsDirty = true;
setPalette(document.body.dataset.palette || 'velvet', true);

/* ---------- формації ---------- */
const ctx = { hw: 6, hh: 4, cx: 0, scale: 1 };
const E = new THREE.Euler();
const Q1 = new THREE.Quaternion(), Q2 = new THREE.Quaternion();
const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);
const flowerQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();

function tumble(i, t, q) {
  const s = reduceMotion ? 0.2 : 1;
  E.set(r(i, 0) * 6.28 + t * (r(i, 1) - 0.5) * 1.6 * s, r(i, 2) * 6.28 + t * (r(i, 3) - 0.5) * 1.2 * s, r(i, 4) * 6.28 + t * 0.3 * s);
  return q.setFromEuler(E);
}

// кожна формація: (i, t, out{p, q, s, w}) — позиція, орієнтація, масштаб, вага орієнтації
const F = {
  // пелюстки падають і кружляють на вітрі
  drift(i, t, o) {
    const H = ctx.hh * 2.8;
    o.p.set(
      ctx.cx + (r(i, 0) * 2 - 1) * ctx.hw * 1.15 + Math.sin(t * 0.45 + r(i, 1) * 6.28) * 0.7,
      ctx.hh * 1.4 - ((r(i, 2) * H + t * (0.22 + r(i, 3) * 0.32)) % H),
      (r(i, 4) * 2 - 1) * 3.2 - 0.5,
    );
    o.s = (0.5 + r(i, 5) * 0.4) * ctx.scale; o.w = 0;
  },
  // вихор-галактика навколо логотипа
  swirl(i, t, o) {
    // еліптичне кільце, що обрамлює логотип (центр лишається читабельним)
    const rr = 3.7 + Math.pow(r(i, 0), 0.8) * 4.6;
    const a = r(i, 1) * 6.283 + t * (0.5 / (0.5 + rr * 0.3));
    o.p.set(
      ctx.cx + Math.cos(a) * rr * 1.38 * ctx.scale,
      (Math.sin(a) * rr * 0.44 + (r(i, 2) - 0.5) * 0.7 + Math.sin(t * 0.8 + i) * 0.08 - 0.12) * ctx.scale + (small() ? ctx.hh * 0.3 : 0), // on phones the logo sits higher
      // the lower half of the ring comes towards the viewer, so petals fill the bottom of the screen as much as the top
      -Math.sin(a) * rr * 0.7 - 1.2,
    );
    o.s = (0.3 + r(i, 5) * 0.4) * ctx.scale; o.w = 0;
  },
  // пелюстки збираються в одну велику квітку (філотаксис, «золотий кут»)
  bloom(i, t, o) {
    if (i < FLOWER_COUNT) {
      const k = i / FLOWER_COUNT;
      const th = i * 2.39996;
      // внутрішні пелюстки — вертикальні й щільні (бутон), зовнішні — розкриті
      const rad = 0.04 + 0.62 * Math.pow(k, 0.75);
      const tilt = 0.08 + 1.38 * Math.pow(k, 1.15) + Math.sin(t * 1.2 + i) * 0.04 * k;
      tmpV.set(Math.cos(th) * rad, -0.28 * k + 0.1, Math.sin(th) * rad);
      Q1.setFromAxisAngle(AX, tilt);
      Q2.setFromAxisAngle(AY, Math.PI / 2 - th);
      o.q.copy(Q2).multiply(Q1);
      const fs = 1.2 * ctx.scale;
      tmpV.multiplyScalar(fs).applyQuaternion(flowerQ);
      o.q.premultiply(flowerQ);
      o.p.set(ctx.cx + tmpV.x, tmpV.y - 0.2, tmpV.z);
      o.s = (0.5 + 0.95 * Math.pow(k, 0.6)) * fs; o.w = 1;
    } else {
      // дрібний «пилок» кружляє позаду квітки
      const a = r(i, 1) * 6.283 + t * (0.12 + r(i, 2) * 0.12);
      const rr = (2.4 + r(i, 0) * 2.2) * ctx.scale;
      o.p.set(ctx.cx + Math.cos(a) * rr * 0.9, Math.sin(a) * rr * 0.8 + (r(i, 3) - 0.5) * 0.8, -2.5 - r(i, 4) * 3);
      o.s = (0.18 + r(i, 5) * 0.22) * ctx.scale; o.w = 0;
    }
  },
  // кільце-орбіта, як німб
  halo(i, t, o) {
    const a = (i / N) * 6.283 * 3 + t * 0.18;
    const rr = (3.1 + Math.sin(i * 1.7) * 0.35 + r(i, 0) * 0.5) * ctx.scale;
    o.p.set(ctx.cx + Math.cos(a) * rr, Math.sin(a) * rr * 0.38 + (r(i, 2) - 0.5) * 0.35 + Math.cos(a) * 0.6, Math.sin(a) * rr * 0.6 - 1);
    o.s = (0.35 + r(i, 5) * 0.35) * ctx.scale; o.w = 0;
  },
  // хвиля-стрічка через увесь екран
  wave(i, t, o) {
    const u = i / N;
    const ph = u * 9 + t * 0.7;
    o.p.set(
      ctx.cx + (u * 2 - 1) * ctx.hw * 1.35,
      Math.sin(ph) * 1.1 * ctx.scale + Math.cos(u * 4 - t * 0.4) * 0.6 + (r(i, 1) - 0.5) * 0.7,
      Math.cos(ph) * 1.6 + (r(i, 2) - 0.5) * 1.4 - 0.8,
    );
    o.s = (0.38 + r(i, 5) * 0.32) * ctx.scale; o.w = 0;
  },
  // пелюстки по краях, щоб не заважати контенту
  edges(i, t, o) {
    const side = r(i, 0) < 0.5 ? -1 : 1;
    o.p.set(
      ctx.cx * 0.2 + side * (ctx.hw * 0.78 + r(i, 1) * ctx.hw * 0.42),
      (r(i, 2) * 2 - 1) * ctx.hh * 1.15 + Math.sin(t * 0.5 + i) * 0.25,
      (r(i, 3) - 0.5) * 3 - 0.8,
    );
    o.s = (0.4 + r(i, 5) * 0.35) * ctx.scale; o.w = 0;
  },
  // серце, що «б'ється»
  heart(i, t, o) {
    const a = r(i, 0) * 6.283;
    const f = 0.5 + 0.5 * Math.sqrt(r(i, 1)); // більше пелюсток по контуру — чіткіша форма
    const beat = 1 + (reduceMotion ? 0 : Math.pow(Math.max(0, Math.sin(t * 2.6)), 12) * 0.06);
    const sc = 0.19 * f * beat * ctx.scale;
    const x = 16 * Math.pow(Math.sin(a), 3);
    const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    o.p.set(ctx.cx + x * sc, y * sc + 0.45 * ctx.scale, (r(i, 2) - 0.5) * 0.5);
    E.set((r(i, 3) - 0.5) * 0.7, (r(i, 4) - 0.5) * 0.7, r(i, 6) * 6.283);
    o.q.setFromEuler(E);
    o.s = (0.2 + r(i, 5) * 0.2) * ctx.scale; o.w = 0.9;
  },
};

/* ---------- прив'язка до секцій сторінки ---------- */
let anchors = [];
function collectAnchors() {
  const els = [...document.querySelectorAll('[data-form]')];
  anchors = els.map((el) => {
    const rect = el.getBoundingClientRect();
    const top = rect.top + scrollY;
    return {
      form: el.dataset.form in F ? el.dataset.form : 'drift',
      fx: parseFloat(el.dataset.fx || '0'),
      fy: parseFloat(el.dataset.fy || '0'),
      y: top + Math.min(rect.height, innerHeight * 1.2) / 2,
    };
  });
  if (!anchors.length) anchors = [{ form: 'drift', fx: 0, fy: 0, y: 0 }];
}

// Scroll position → one continuous "progress" number: 2.0 = exactly the 3rd shape,
// 2.5 = halfway between the 3rd and 4th. Smoothing this single number (not a pair + t)
// keeps petals from jumping ahead to the next shape and back when you pass a section.
function targetProgress() {
  const c = scrollY + innerHeight / 2;
  if (anchors.length < 2 || c <= anchors[0].y) return 0;
  let j = 0;
  while (j < anchors.length - 1 && anchors[j + 1].y <= c) j++;
  if (j >= anchors.length - 1) return anchors.length - 1;
  let t = (c - anchors[j].y) / (anchors[j + 1].y - anchors[j].y);
  t = Math.min(1, Math.max(0, (t - 0.35) / 0.55)); // hold the shape, then flow to the next one
  return j + t * t * (3 - 2 * t);
}

/* ---------- миша / дотик ---------- */
const mouse = { x: 0, y: 0, sx: 0, sy: 0, vx: 0, vy: 0, active: false };
addEventListener('pointermove', (e) => {
  const nx = (e.clientX / innerWidth) * 2 - 1, ny = -(e.clientY / innerHeight) * 2 + 1;
  mouse.vx += (nx - mouse.x) * 0.5; mouse.vy += (ny - mouse.y) * 0.5;
  mouse.x = nx; mouse.y = ny; mouse.active = true;
}, { passive: true });
document.addEventListener('pointerleave', () => { mouse.active = false; });

const burstQueue = [];
addEventListener('pointerdown', (e) => {
  if (e.target.closest('a,button,input,select,textarea,label,[data-no-burst]')) return;
  burstQueue.push({ x: ((e.clientX / innerWidth) * 2 - 1), y: -(e.clientY / innerHeight) * 2 + 1 });
});

let lastScroll = scrollY, scrollVel = 0;

/* ---------- розмір ---------- */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  ctx.hh = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  ctx.hw = ctx.hh * camera.aspect;
  ctx.scale = small() ? 0.62 : Math.min(1.1, Math.max(0.75, camera.aspect / 1.6));
  collectAnchors();
}
addEventListener('resize', resize);
addEventListener('load', collectAnchors);
new ResizeObserver(() => collectAnchors()).observe(document.body);
resize();

/* ---------- анімаційний цикл ---------- */
const offs = new Float32Array(N * 3);   // зміщення від курсора
const spin = new Float32Array(N);       // додаткове обертання від поштовху
const oa = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1, w: 0 };
const ob = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: 1, w: 0 };
const qt = new THREE.Quaternion(), qx = new THREE.Quaternion();
const P = new THREE.Vector3(), S = new THREE.Vector3(), M = new THREE.Matrix4();
const clock = new THREE.Clock();
let time = 0, running = true, smoothP = -1, smoothFx = 0, smoothFy = 0;

document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  if (running) { clock.getDelta(); requestAnimationFrame(loop); }
});

function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

function loop() {
  if (!running) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  // scrolling makes the petals swirl a little faster (smoothly — no jumps)
  const sv = scrollY - lastScroll; lastScroll = scrollY;
  scrollVel += (Math.abs(sv) - scrollVel) * (1 - Math.exp(-dt * 4));
  time += dt * (reduceMotion ? 0.35 : 1 + Math.min(scrollVel / 60, 1.2));

  mouse.sx += (mouse.x - mouse.sx) * 0.06;
  mouse.sy += (mouse.y - mouse.sy) * 0.06;
  mouse.vx *= 0.85; mouse.vy *= 0.85;

  const goal = targetProgress();
  if (smoothP < 0) smoothP = goal;
  smoothP += (goal - smoothP) * (1 - Math.exp(-dt * 3.2));
  const jj = Math.min(anchors.length - 1, Math.floor(smoothP));
  const A = anchors[jj], B = anchors[Math.min(jj + 1, anchors.length - 1)];
  const t = smoothP - jj, smoothT = t;
  const kF = 1 - Math.exp(-dt * 3.6);
  const fxTarget = (A.fx + (B.fx - A.fx) * ease(t)) * (small() ? 0.15 : 1);
  smoothFx += (fxTarget - smoothFx) * kF;
  ctx.cx = smoothFx * ctx.hw;
  const fyTarget = (A.fy + (B.fy - A.fy) * ease(t)) * (small() ? 0.5 : 1);
  smoothFy += (fyTarget - smoothFy) * kF;
  group.position.y = smoothFy * ctx.hh;

  // квітка повертається за курсором і повільно обертається
  E.set(0.62 - mouse.sy * 0.35, time * 0.12 + mouse.sx * 0.6, mouse.sx * -0.12);
  flowerQ.setFromEuler(E);

  group.rotation.y += (mouse.sx * 0.12 - group.rotation.y) * 0.05;
  group.rotation.x += (-mouse.sy * 0.08 - group.rotation.x) * 0.05;
  camera.position.x += (mouse.sx * 0.5 - camera.position.x) * 0.04;
  camera.position.y += (mouse.sy * 0.35 - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);

  const mx = mouse.x * ctx.hw, my = mouse.y * ctx.hh - group.position.y;
  pointer.position.set(mx, my, 3.2);
  pointer.intensity += ((mouse.active ? 46 : 10) - pointer.intensity) * 0.05;

  // клік → вибух пелюсток
  const bursts = burstQueue.splice(0);

  const fa = F[A.form], fb = F[B.form];
  const repR = small() ? 1.4 : 1.8;
  for (let i = 0; i < N; i++) {
    // кожна пелюстка переходить зі своєю затримкою — виглядає живіше
    const ti = ease(Math.min(1, Math.max(0, smoothT * 1.45 - r(i, 6) * 0.45)));

    oa.w = 0; ob.w = 0;
    fa(i, time, oa); if (oa.w < 1) { tumble(i, time, qt); oa.w === 0 ? oa.q.copy(qt) : oa.q.slerp(qt, 1 - oa.w); }
    if (fb !== fa && ti > 0) { fb(i, time, ob); if (ob.w < 1) { tumble(i, time, qt); ob.w === 0 ? ob.q.copy(qt) : ob.q.slerp(qt, 1 - ob.w); } }
    else { ob.p.copy(oa.p); ob.q.copy(oa.q); ob.s = oa.s; }

    P.lerpVectors(oa.p, ob.p, ti);
    qx.slerpQuaternions(oa.q, ob.q, ti);
    let sc = oa.s + (ob.s - oa.s) * ti;

    // відштовхування курсором
    const k3 = i * 3;
    let tx = 0, ty = 0, tz = 0;
    if (mouse.active && !coarse) {
      const dx = P.x - mx, dy = P.y - my;
      const d = Math.hypot(dx, dy) + 1e-4;
      if (d < repR) {
        const f = Math.pow(1 - d / repR, 2) * 1.6;
        tx = (dx / d) * f + mouse.vx * f * 2.5;
        ty = (dy / d) * f + mouse.vy * f * 2.5;
        tz = f * 0.9;
        spin[i] += f * 0.06;
      }
    }
    for (const b of bursts) {
      const dx = P.x - b.x * ctx.hw, dy = P.y - (b.y * ctx.hh - group.position.y);
      const d = Math.hypot(dx, dy) + 1e-4;
      if (d < 3.2) {
        const f = (1 - d / 3.2) * 3.2;
        offs[k3] += (dx / d) * f; offs[k3 + 1] += (dy / d) * f; offs[k3 + 2] += f * 0.8;
        spin[i] += f * 0.5;
      }
    }
    offs[k3] += (tx - offs[k3]) * 0.09;
    offs[k3 + 1] += (ty - offs[k3 + 1]) * 0.09;
    offs[k3 + 2] += (tz - offs[k3 + 2]) * 0.09;
    spin[i] *= 0.96;

    P.x += offs[k3];
    P.y += offs[k3 + 1];
    P.z += offs[k3 + 2];

    if (spin[i] > 0.001) {
      E.set(spin[i] * 2, spin[i] * 1.3, 0);
      qt.setFromEuler(E);
      qx.multiply(qt);
    }

    S.setScalar(sc);
    M.compose(P, qx, S);
    meshes[i % K].setMatrixAt(Math.floor(i / K), M);
  }
  for (const m of meshes) m.instanceMatrix.needsUpdate = true;

  if (colorsDirty) {
    let diff = 0;
    for (let i = 0; i < colors.length; i++) {
      const d = targetColors[i] - colors[i];
      colors[i] += d * 0.06; diff += Math.abs(d);
    }
    for (let i = 0; i < N; i++) {
      const arr = meshes[i % K].instanceColor.array, o3 = Math.floor(i / K) * 3;
      arr[o3] = colors[i * 3]; arr[o3 + 1] = colors[i * 3 + 1]; arr[o3 + 2] = colors[i * 3 + 2];
    }
    for (const m of meshes) m.instanceColor.needsUpdate = true;
    if (diff < 0.01) colorsDirty = false;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

window.FLORIS_SCENE = {
  setPalette(name) { setPalette(name); },
  burst(x = 0, y = 0) { burstQueue.push({ x, y }); },
  refresh: collectAnchors,
  progress: () => smoothP,
};
document.dispatchEvent(new CustomEvent('floris:scene-ready'));
})();
