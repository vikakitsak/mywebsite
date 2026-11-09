/* =========================================================
   Lukki — hero 3D scene
   1) The Lukki logo, extruded into 3D. A small vertex shader makes it
      wobble like liquid and "melt" towards the cursor.
   2) A wall of organic pattern shapes behind it (like embossed paper)
      that lift up and light up where the cursor passes.
   ========================================================= */
(function () {
  'use strict';
  const THREE = window.THREE;
  const LOGO = window.LUKKI_LOGO;
  const host = document.querySelector('[data-3d]');
  if (!THREE || !LOGO || !host) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'l3d';
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
  catch (e) { canvas.remove(); return; }
  document.documentElement.classList.add('js-3d');
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 16);

  scene.add(new THREE.HemisphereLight(0xf3f4ec, 0x2c3c18, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-4, 6, 9); scene.add(key);
  const rim = new THREE.DirectionalLight(0xf2c222, 1.4); rim.position.set(6, -3, -4); scene.add(rim);
  const spot = new THREE.PointLight(0xfff6d8, 30, 14, 2); spot.position.set(0, 0, 4); scene.add(spot);

  /* ---------- 1. the logo ---------- */
  function shapesFromPath(d) {
    const sp = new THREE.ShapePath();
    const re = /([MLCZ])([^MLCZ]*)/g;
    let m;
    while ((m = re.exec(d))) {
      const n = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (m[1] === 'M') sp.moveTo(n[0], -n[1]);
      else if (m[1] === 'L') for (let i = 0; i < n.length; i += 2) sp.lineTo(n[i], -n[i + 1]);
      else if (m[1] === 'C') for (let i = 0; i < n.length; i += 6) sp.bezierCurveTo(n[i], -n[i + 1], n[i + 2], -n[i + 3], n[i + 4], -n[i + 5]);
    }
    // every outline in the logo is a solid letter (no holes), so each becomes its own shape
    // drop near-duplicate points: zero-length edges make the bevel shoot out long spikes
    return sp.subPaths.map((sub) => {
      const pts = [];
      for (const p of sub.getPoints(14)) if (!pts.length || p.distanceTo(pts[pts.length - 1]) > 1.5) pts.push(p);
      if (pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 1.5) pts.pop();
      return new THREE.Shape(pts);
    });
  }
  const logoGeo = new THREE.ExtrudeGeometry(shapesFromPath(LOGO.d), {
    depth: 70, bevelEnabled: true, bevelThickness: 16, bevelSize: 5, bevelSegments: 5, curveSegments: 14,
  });
  logoGeo.center();

  const uniforms = { uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(9999, 9999) }, uPush: { value: 0 }, uPulse: { value: 0 } };
  const logoMat = new THREE.MeshStandardMaterial({ color: 0xc8cdb9, roughness: 0.42, metalness: 0.05 });
  logoMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = 'uniform float uTime; uniform vec2 uMouse; uniform float uPush; uniform float uPulse;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       // liquid wobble — slow waves travelling through the letters
       float w = sin(transformed.x * 0.011 + uTime * 1.5) * 9.0 + sin(transformed.y * 0.018 - uTime * 1.1) * 6.0;
       transformed.z += w * (0.6 + uPulse);
       transformed.y += sin(transformed.x * 0.008 + uTime * 0.9) * 7.0 * (1.0 + uPulse * 2.0);
       // "melt" towards the cursor
       vec2 dm = transformed.xy - uMouse;
       float infl = exp(-dot(dm, dm) / 22000.0);
       transformed.z += infl * uPush * 70.0;
       transformed.xy -= dm * infl * uPush * 0.18;`
    );
  };
  const logo = new THREE.Mesh(logoGeo, logoMat);
  const logoPivot = new THREE.Group();
  logoPivot.add(logo);
  scene.add(logoPivot);

  /* ---------- 2. the living pattern wall ---------- */
  function squiggle(len, amp, wid, waves) {
    // a thick wavy stroke with rounded ends — like the shapes in the Lukki pattern
    const N = 26, left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = (t - 0.5) * len, y = Math.sin(t * Math.PI * waves) * amp;
      const dy = Math.cos(t * Math.PI * waves) * amp * Math.PI * waves / len;
      const nl = Math.hypot(1, dy), nx = -dy / nl, ny = 1 / nl;
      const w = wid * (0.7 + 0.45 * Math.sin(Math.PI * t));
      left.push([x + nx * w, y + ny * w]); right.push([x - nx * w, y - ny * w]);
    }
    const s = new THREE.Shape();
    s.moveTo(...left[0]);
    left.forEach((p) => s.lineTo(...p));
    const e = right[N], b = left[N];
    s.quadraticCurveTo(b[0] + (b[0] - e[0]) * 0.1 + wid * 1.1, (b[1] + e[1]) / 2, e[0], e[1]);
    for (let i = N; i >= 0; i--) s.lineTo(...right[i]);
    const f = left[0], g = right[0];
    s.quadraticCurveTo(g[0] - wid * 1.1, (f[1] + g[1]) / 2, f[0], f[1]);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3, curveSegments: 6 });
    geo.center();
    return geo;
  }
  const variants = [squiggle(1.5, 0.22, 0.17, 2), squiggle(1.1, 0.15, 0.19, 1.5), squiggle(1.8, 0.28, 0.15, 3)];
  const COLS = coarse ? 10 : 18, ROWS = coarse ? 12 : 10;
  const cells = [];
  const fields = variants.map((g) => {
    const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0 }), Math.ceil((COLS * ROWS) / variants.length) + 1);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(m.count * 3), 3);
    m.count = 0;
    scene.add(m);
    return m;
  });
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    const v = (i * 7 + j * 3) % variants.length;
    cells.push({ i, j, v, slot: fields[v].count++, rot: Math.random() * Math.PI * 2, jx: Math.random() - 0.5, jy: Math.random() - 0.5, lift: 0, seed: Math.random() * 10 });
  }
  const baseCol = new THREE.Color('#44562a'), hotCol = new THREE.Color('#c8cdb9'), sunCol = new THREE.Color('#f2c222');

  /* ---------- layout ---------- */
  const view = { w: 10, h: 6 };
  const WALL_Z = -4;
  function resize() {
    const r = host.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    view.h = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    view.w = view.h * camera.aspect;
    const s = Math.min(view.w * 0.66, view.h * 1.05) / LOGO.w;
    logo.scale.setScalar(s);
    logoPivot.position.y = view.h * (r.width < 760 ? 0.1 : 0.07);
  }
  addEventListener('resize', resize);
  resize();

  /* ---------- input ---------- */
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, on: false };
  host.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    mouse.on = true;
  });
  host.addEventListener('pointerleave', () => { mouse.on = false; });
  let pulseV = 0;
  host.addEventListener('pointerdown', (e) => { if (!e.target.closest('a,button')) pulseV += 0.9; });

  let visible = true;
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) requestAnimationFrame(loop); }).observe(host);

  /* ---------- loop ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const planeLogo = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), planeWall = new THREE.Plane(new THREE.Vector3(0, 0, 1), -WALL_Z);
  const hit = new THREE.Vector3(), wallHit = new THREE.Vector3(9999, 9999, 0), local = new THREE.Vector3();
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1), C = new THREE.Color();
  const clock = new THREE.Clock();
  let t = 0, pulse = 0, push = 0;

  function loop() {
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt * (reduce ? 0.3 : 1);
    const k = 1 - Math.exp(-dt * 5);
    mouse.sx += (mouse.x - mouse.sx) * k;
    mouse.sy += (mouse.y - mouse.sy) * k;

    // scroll: the logo tilts back and drifts up as you leave the hero
    const r = host.getBoundingClientRect();
    const sp = Math.min(1, Math.max(0, -r.top / r.height));

    logoPivot.rotation.y = mouse.sx * 0.45;
    logoPivot.rotation.x = -mouse.sy * 0.3 - sp * 0.9;
    logoPivot.position.z = sp * -4;

    // jelly pulse on click (a damped spring)
    pulseV += -pulse * 60 * dt; pulseV *= Math.exp(-dt * 4); pulse += pulseV * dt * 6;
    uniforms.uPulse.value = Math.max(-0.4, Math.min(1.2, pulse));
    uniforms.uTime.value = t;

    // cursor in logo space
    ndc.set(mouse.sx, mouse.sy);
    ray.setFromCamera(ndc, camera);
    push += ((mouse.on && !coarse ? 1 : 0) - push) * k * 0.6;
    uniforms.uPush.value = push;
    if (ray.ray.intersectPlane(planeLogo, hit)) {
      local.copy(hit); logo.worldToLocal(local);
      uniforms.uMouse.value.set(local.x, local.y);
    }
    if (ray.ray.intersectPlane(planeWall, wallHit) === null) wallHit.set(9999, 9999, 0);

    spot.position.set(hit.x, hit.y, 4);
    spot.intensity += ((mouse.on ? 40 : 12) - spot.intensity) * k;

    // pattern wall
    const cw = (view.w * 1.55) / COLS, ch = (view.h * 1.55) / ROWS;
    for (const c of cells) {
      const x = (c.i - (COLS - 1) / 2) * cw + c.jx * cw * 0.4;
      const y = (c.j - (ROWS - 1) / 2) * ch + c.jy * ch * 0.4;
      const d = Math.hypot(x - wallHit.x, y - wallHit.y);
      const target = mouse.on && !coarse ? Math.max(0, 1 - d / 2.4) : 0;
      c.lift += (target - c.lift) * (1 - Math.exp(-dt * 6));
      const wave = Math.sin(x * 0.6 + t * 0.9 + c.seed) * 0.15 + Math.sin(y * 0.8 - t * 0.7) * 0.1 + sp * Math.sin(x * 0.9 + t * 3) * 0.6;
      P.set(x, y + sp * 2, WALL_Z + wave + c.lift * 1.6);
      E.set(Math.sin(t * 0.6 + c.seed) * 0.15 + c.lift * 0.5, Math.cos(t * 0.5 + c.seed) * 0.15 - c.lift * 0.4, c.rot + c.lift * 0.6);
      Q.setFromEuler(E);
      S.setScalar(cw * 0.7 + c.lift * 0.25);
      M.compose(P, Q, S);
      const f = fields[c.v];
      f.setMatrixAt(c.slot, M);
      C.copy(baseCol).lerp(hotCol, c.lift * 0.85);
      if (c.lift > 0.6) C.lerp(sunCol, (c.lift - 0.6) * 0.8);
      f.instanceColor.setXYZ(c.slot, C.r, C.g, C.b);
    }
    for (const f of fields) { f.instanceMatrix.needsUpdate = true; f.instanceColor.needsUpdate = true; }

    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
