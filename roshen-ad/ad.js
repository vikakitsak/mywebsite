'use strict';
/* «Відкуси чорничну ніч» — концепт-реклама, 1080×1920, 60 fps, 20 с.
   Власний детермінований таймлайн: renderFrame(t) малює кадр для будь-якого t (cold seek). */

const W = 1080, H = 1920, FPS = 60, DUR = 20, FOCAL = 1150;
const TAU = Math.PI * 2, DEG = Math.PI / 180;

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, x) => a + (b - a) * x;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutCubic = x => 1 - Math.pow(1 - clamp(x), 3);
const easeInCubic = x => Math.pow(clamp(x), 3);
const easeInOut = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOutBack = (x, s = 1.7) => { x = clamp(x); const c3 = s + 1; return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const spring = (x, f = 9, d = 5) => x <= 0 ? 0 : 1 - Math.exp(-d * x) * Math.cos(f * x);
const bump = (a, b, c, x) => x < a || x > c ? 0 : x < b ? smooth(a, b, x) : 1 - smooth(b, c, x);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerpV = (a, b, x) => [lerp(a[0], b[0], x), lerp(a[1], b[1], x), lerp(a[2], b[2], x)];
const rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]; };
const rotX = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]]; };
const rotZ = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]]; };
const rgb = (r, g, b, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const mixC = (c1, c2, x) => [lerp(c1[0], c2[0], x), lerp(c1[1], c2[1], x), lerp(c1[2], c2[2], x)];

// Hermite spline with non-uniform keys (velocity-continuous camera)
function spline(keys, t) {
  const n = keys.length;
  if (t <= keys[0].t) return keys[0].v.slice();
  if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
  let i = 0; while (t > keys[i + 1].t) i++;
  const k0 = keys[i], k1 = keys[i + 1], h = k1.t - k0.t, s = (t - k0.t) / h;
  const tan = j => {
    const a = keys[Math.max(0, j - 1)], b = keys[Math.min(n - 1, j + 1)];
    return b.v.map((bv, q) => (bv - a.v[q]) / (b.t - a.t));
  };
  const m0 = tan(i), m1 = tan(i + 1);
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  return k0.v.map((v0, q) => h00 * v0 + h10 * h * m0[q] + h01 * k1.v[q] + h11 * h * m1[q]);
}

// ---------- camera ----------
function makeCam(pos, tgt, upHint, rollDeg, focus, ap) {
  const f = norm(sub(tgt, pos));
  let r = norm(cross(upHint, f)); let u = cross(f, r);
  const ro = rollDeg * DEG, c = Math.cos(ro), s = Math.sin(ro);
  const r2 = add(mul(r, c), mul(u, s)), u2 = sub(mul(u, c), mul(r, s));
  return { pos, f, r: r2, u: u2, focal: FOCAL, focus, ap };
}
function proj(cam, p) {
  const d = sub(p, cam.pos); const z = dot(d, cam.f);
  if (z < 0.08) return null;
  const s = cam.focal / z;
  return { x: W / 2 + dot(d, cam.r) * s, y: H / 2 - dot(d, cam.u) * s, z, s };
}
function orbit(el, az, R, T) {
  el *= DEG; az *= DEG;
  const o = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
  const up = [-Math.sin(az) * Math.sin(el), Math.cos(el), Math.cos(az) * Math.sin(el)];
  return { pos: add(T, mul(o, R)), tgt: T, up };
}
const coc = (cam, z) => cam.ap * cam.focal * (1 / cam.focus - 1 / z);

// ---------- canvases ----------
const out = document.getElementById('c');
const octx = out.getContext('2d');
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
const acc = mk(W, H), actx = acc.getContext('2d');
const subc = mk(W, H), sctx = subc.getContext('2d');
const tmpc = mk(W, H), tctx = tmpc.getContext('2d');
const LAYERS = { 1: [mk(W, H), mk(W, H)], 0.5: [mk(W / 2, H / 2), mk(W / 2, H / 2)], 0.25: [mk(W / 4, H / 4), mk(W / 4, H / 4)] };
const groundC = mk(360, 640), gctx = groundC.getContext('2d');
const groundImg = gctx.createImageData(360, 640);

// ---------- DOF compositor ----------
const BIN_EDGES = [-1e9, -26, -13, -6, -2, 2, 6, 13, 26, 1e9];
const BIN_BLUR = [34, 18, 9, 3.5, 0, 3.5, 9, 18, 34];
function drawDOF(ctx, items, cam) {
  const bins = BIN_BLUR.map(() => []);
  for (const it of items) {
    const c = it.noDOF ? 0 : coc(cam, it.z) * (it.dofMul || 1);
    let b = 0; while (c > BIN_EDGES[b + 1]) b++;
    bins[b].push(it);
  }
  for (let b = bins.length - 1; b >= 0; b--) {
    const list = bins[b]; if (!list.length) continue;
    list.sort((p, q) => q.z - p.z);
    const blur = BIN_BLUR[b];
    if (blur < 1) { for (const it of list) { ctx.save(); it.draw(ctx, 1); ctx.restore(); } continue; }
    const s = blur > 14 ? 0.25 : 0.5;
    const [L, T] = LAYERS[s], lc = L.getContext('2d'), tc = T.getContext('2d');
    lc.setTransform(1, 0, 0, 1, 0, 0); lc.clearRect(0, 0, L.width, L.height);
    for (const it of list) { lc.save(); lc.setTransform(s, 0, 0, s, 0, 0); it.draw(lc, s); lc.restore(); }
    tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, T.width, T.height);
    tc.filter = `blur(${(blur * s).toFixed(2)}px)`; tc.drawImage(L, 0, 0); tc.filter = 'none';
    ctx.drawImage(T, 0, 0, W, H);
  }
}

// ---------- primitives ----------
// blueberry: dusty bloom, crown (calyx), soft key + rim
function drawBerry(ctx, cam, c, r, opt = {}) {
  const p = proj(cam, c); if (!p) return;
  const R = r * p.s; if (R < 0.4 || p.x < -R * 2 || p.x > W + R * 2 || p.y < -R * 2 || p.y > H + R * 2) return;
  const lx = opt.lx ?? -0.38, ly = opt.ly ?? -0.42;
  ctx.save();
  if (opt.clipY != null) { ctx.beginPath(); ctx.rect(-50, -50, W + 100, opt.clipY + 50); ctx.clip(); }
  const tint = opt.tint || [0, 0, 0];
  const g = ctx.createRadialGradient(p.x + lx * R, p.y + ly * R, R * 0.05, p.x, p.y, R);
  g.addColorStop(0, rgb(110 + tint[0], 122 + tint[1], 196 + tint[2]));
  g.addColorStop(0.28, rgb(58 + tint[0], 66 + tint[1], 146 + tint[2]));
  g.addColorStop(0.72, rgb(28 + tint[0], 30 + tint[1], 92 + tint[2]));
  g.addColorStop(1, rgb(10, 11, 40));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
  // waxy bloom at the silhouette
  const b = ctx.createRadialGradient(p.x, p.y, R * 0.55, p.x, p.y, R);
  b.addColorStop(0, 'rgba(150,165,225,0)'); b.addColorStop(0.85, 'rgba(150,165,225,0.10)'); b.addColorStop(1, 'rgba(170,185,240,0.28)');
  ctx.fillStyle = b; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
  // rim light from opposite side
  if (opt.rim !== false) {
    ctx.strokeStyle = opt.rimColor || 'rgba(160,180,255,0.45)'; ctx.lineWidth = Math.max(0.6, R * 0.07);
    const a0 = Math.atan2(-ly, -lx);
    ctx.beginPath(); ctx.arc(p.x, p.y, R * 0.965, a0 - 0.9, a0 + 0.9); ctx.stroke();
  }
  // specular
  const sp = ctx.createRadialGradient(p.x + lx * R * 1.05, p.y + ly * R * 1.05, 0, p.x + lx * R, p.y + ly * R, R * 0.32);
  sp.addColorStop(0, `rgba(255,255,255,${opt.spec ?? 0.55})`); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
  // crown
  const cd = opt.crown || [0.25, 0.85, -0.45];
  const cn = norm(cd), facing = dot(cn, norm(sub(cam.pos, c)));
  if (facing > 0.05 && R > 3) {
    const cp = proj(cam, add(c, mul(cn, r * 0.93)));
    if (cp) {
      const ang = Math.atan2(cp.y - p.y, cp.x - p.x);
      ctx.translate(cp.x, cp.y); ctx.rotate(ang); ctx.scale(Math.max(0.25, facing), 1);
      const cr = R * 0.3;
      ctx.fillStyle = 'rgba(14,14,40,0.95)'; ctx.beginPath();
      for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, rr = k % 2 ? cr * 0.42 : cr; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(120,130,190,0.35)'; ctx.beginPath(); ctx.arc(0, 0, cr * 0.3, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
// berry in screen space (for typography)
function drawBerry2D(ctx, x, y, R) {
  const g = ctx.createRadialGradient(x - .38 * R, y - .42 * R, R * .05, x, y, R);
  g.addColorStop(0, '#7a86cc'); g.addColorStop(.28, '#3a4292'); g.addColorStop(.72, '#1c1f5c'); g.addColorStop(1, '#0a0b28');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  const sp = ctx.createRadialGradient(x - .4 * R, y - .44 * R, 0, x - .4 * R, y - .44 * R, R * .35);
  sp.addColorStop(0, 'rgba(255,255,255,.6)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(12,12,36,.9)'; ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU, rr = k % 2 ? R * .12 : R * .28; ctx.lineTo(x + R * .3 + Math.cos(a) * rr * .6, y - R * .45 + Math.sin(a) * rr * .5); }
  ctx.fill();
}

function leafPoly(cam, L) {
  const side = norm(cross(L.normal, L.axis));
  const pts = [], mid = [];
  const N = 9;
  for (let i = 0; i <= N; i++) {
    const u = i / N, w = L.width * Math.pow(Math.sin(Math.PI * u), 0.75) * (1 - 0.25 * u);
    const base = add(add(L.pos, mul(L.axis, u * L.length)), mul(L.normal, u * u * L.curl));
    pts.push(add(base, mul(side, w)));
    mid.push(base);
  }
  for (let i = N; i >= 0; i--) {
    const u = i / N, w = L.width * Math.pow(Math.sin(Math.PI * u), 0.75) * (1 - 0.25 * u);
    const base = add(add(L.pos, mul(L.axis, u * L.length)), mul(L.normal, u * u * L.curl));
    pts.push(sub(base, mul(side, w)));
  }
  const pp = pts.map(p => proj(cam, p)); if (pp.some(q => !q)) return null;
  const mp = mid.map(p => proj(cam, p));
  return { pp, mp };
}
function leafItem(cam, L, light, palette) {
  const center = add(L.pos, mul(L.axis, L.length * 0.5));
  const pc = proj(cam, center); if (!pc) return null;
  if (pc.x < -900 || pc.x > W + 900 || pc.y < -900 || pc.y > H + 900) return null;
  return {
    z: pc.z, draw(ctx) {
      const lp = leafPoly(cam, L); if (!lp) return;
      const v = norm(sub(cam.pos, center));
      const n = dot(L.normal, v) < 0 ? mul(L.normal, -1) : L.normal;
      const d = clamp(dot(n, light) * 0.8 + 0.25);
      const col = mixC(palette[0], palette[1], d);
      const p0 = lp.pp[0], p1 = lp.mp[lp.mp.length - 1];
      const g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
      g.addColorStop(0, rgb(...mixC(col, [0, 0, 0], 0.35))); g.addColorStop(1, rgb(...col));
      ctx.fillStyle = g; ctx.beginPath();
      for (const q of lp.pp) ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.fill();
      // vein + rim
      ctx.strokeStyle = rgb(...mixC(col, [200, 230, 210], 0.25), 0.55); ctx.lineWidth = Math.max(0.7, 0.025 * pc.s);
      ctx.beginPath(); for (const q of lp.mp) if (q) ctx.lineTo(q.x, q.y); ctx.stroke();
      ctx.strokeStyle = rgb(...palette[2], 0.35); ctx.lineWidth = Math.max(0.6, 0.012 * pc.s);
      ctx.beginPath(); for (const q of lp.pp) ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.stroke();
    }
  };
}
function stemItem(cam, pts, width, color) {
  const pp = pts.map(p => proj(cam, p));
  const vis = pp.filter(Boolean); if (vis.length < 2) return null;
  const z = vis.reduce((a, q) => a + q.z, 0) / vis.length;
  return {
    z, draw(ctx) {
      ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 0; i < pp.length - 1; i++) {
        const a = pp[i], b = pp[i + 1]; if (!a || !b) continue;
        ctx.lineWidth = Math.max(0.8, width * (a.s + b.s) / 2);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
  };
}
function glowItem(cam, p, r, color, a) {
  const q = proj(cam, p); if (!q) return null;
  const R = Math.max(1.5, r * q.s);
  return {
    z: q.z, draw(ctx) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, R);
      g.addColorStop(0, rgb(...color, a)); g.addColorStop(0.25, rgb(...color, a * 0.45)); g.addColorStop(1, rgb(...color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, R, 0, TAU); ctx.fill();
    }
  };
}
function poly(ctx, pts, fill, stroke = true) {
  ctx.fillStyle = fill; ctx.beginPath(); for (const q of pts) ctx.lineTo(q.x, q.y); ctx.closePath(); ctx.fill();
  if (stroke) { ctx.strokeStyle = fill; ctx.lineWidth = 0.8; ctx.stroke(); }
}

// ---------- world A: bush (S1) ----------
const HERO = [0, 0, 0], HERO_R = 0.5, SURF_Y = -12;
const bush = (() => {
  const R = rng(7);
  const leaves = [], berries = [], stems = [], flies = [];
  const branch = (P0, P1, P2, P3, leafEvery, berryProb) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const s = i / 14, a = (1 - s) ** 3, b = 3 * (1 - s) ** 2 * s, c = 3 * (1 - s) * s * s, d = s ** 3;
      pts.push([a * P0[0] + b * P1[0] + c * P2[0] + d * P3[0], a * P0[1] + b * P1[1] + c * P2[1] + d * P3[1], a * P0[2] + b * P1[2] + c * P2[2] + d * P3[2]]);
    }
    stems.push({ pts, w: 0.06 });
    for (let i = 3; i < pts.length; i += leafEvery) {
      const p = pts[i]; const dir = norm(sub(pts[Math.min(14, i + 1)], pts[i - 1]));
      const sideSign = (i % 2) ? 1 : -1;
      const out = norm(add(mul(norm(cross(dir, [0, 0, 1])), sideSign), [R() * 0.6 - 0.3, 0.45, R() * 0.6 - 0.3]));
      const nrm = norm(cross(out, add(dir, [R() - 0.5, 0, R() - 0.5])));
      if (len(sub(p, HERO)) < 1.25) continue;
      leaves.push({ pos: p, axis: out, normal: nrm, length: 0.95 + R() * 0.5, width: 0.32 + R() * 0.14, curl: 0.15 + R() * 0.2 });
      if (R() < berryProb) {
        const n = 2 + (R() * 3 | 0);
        for (let k = 0; k < n; k++) {
          const c = add(p, [R() * 0.9 - 0.45, -0.35 - R() * 0.4, R() * 0.9 - 0.45]);
          if (len(sub(c, HERO)) < 1.15) continue;
          if (Math.hypot(c[0], c[2]) < 0.9 && c[1] < 0) continue;
          berries.push({ c, r: 0.3 + R() * 0.14, crown: [R() - 0.5, 0.6 + R() * 0.4, R() - 0.8] });
        }
      }
    }
  };
  // hero branch
  branch([2.6, -6, 3.2], [2.2, -1, 2.0], [1.4, 2.2, 0.6], [-1.6, 2.4, 0.4], 2, 0.4);
  // cluster around hero
  [[-0.95, 0.35, 0.45, 0.42], [0.92, 0.55, 0.5, 0.4], [-0.35, 1.05, 0.75, 0.36], [1.5, -0.2, 1.1, 0.38], [-1.6, -0.35, 1.3, 0.37]].forEach(b => berries.push({ c: [b[0], b[1], b[2]], r: b[3], crown: [0.3, 0.8, -0.6] }));
  const sp = [[-5.4, 0.4], [-3.4, 2.4], [-1.6, 5.2], [3.4, 1.4], [5.2, 4.0], [0.6, 7.5], [-4.2, 8.5], [6.5, 9], [2.4, 12], [-7, 4]];
  for (const [bx, bz] of sp) {
    const tip = [bx + R() * 3 - 1.5, 1.2 + R() * 2.6, bz + R() * 2 - 1];
    branch([bx, -6.5, bz + 0.5], [bx + R() - 0.5, -2, bz], [lerp(bx, tip[0], 0.6), tip[1] - 0.6, lerp(bz, tip[2], 0.6)], tip, 2, 0.55);
  }
  // foreground leaves that sweep past the lens
  const FG = [[-1.0, 3.1, -9.6], [-3.9, 1.0, -9.0], [-0.2, -0.5, -7.6], [1.6, 2.4, -6.4], [-2.6, 2.9, -7.0], [1.9, -0.6, -5.4]];
  for (const p of FG) leaves.push({ pos: p, axis: norm([R() - 0.5, R() * 0.6 - 0.1, 0.3]), normal: norm([R() - 0.5, 0.3, -1]), length: 1.4 + R() * 0.5, width: 0.5 + R() * 0.15, curl: 0.25, fg: true });
  // pedicel of hero
  const ped = [[0.45, 1.75, 0.38], [0.3, 1.25, 0.2], [0.08, 0.72, 0.05], [0.02, 0.48, 0.0]];
  for (let i = 0; i < 46; i++) flies.push({ p: [R() * 18 - 9, R() * 9 - 4, R() * 26 - 6], w: [0.5 + R(), 0.4 + R(), 0.6 + R()], ph: R() * TAU, br: 0.4 + R() * 0.6 });
  // far spruce silhouettes
  const trees = [];
  for (const [z, n, col] of [[140, 34, '#0e1638'], [80, 30, '#070b20']]) {
    const row = []; for (let i = 0; i < n; i++) row.push({ x: -130 + i * (260 / n) + R() * 4, h: 9 + R() * 18, w: 2.6 + R() * 2.2 });
    trees.push({ z, col, row });
  }
  const stars = []; for (let i = 0; i < 160; i++) { const az = R() * 1.6 - 0.8, el = 0.04 + R() * 0.7; stars.push({ d: [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)], b: R() * 0.8 + 0.2, ph: R() * TAU }); }
  return { leaves, berries, stems, ped, flies, trees, stars };
})();

// hero berry trajectory
function heroPos(t) {
  if (t < 3) {
    const dip = -0.06 * smooth(2.55, 2.98, t);
    const sway = 0.04 * Math.sin(t * 2.3);
    return [sway, dip, 0];
  }
  const tau = t - 3;
  if (t < 4) return [0.06 * tau, -11.5 * tau * tau, 0];
  const s = t - 4;
  return [0.06, -11.5 - 1.3 * easeOutCubic(s / 0.35), 0];
}

// ---------- chocolate surface (per-pixel normal-mapped) ----------
function surfH(x, z, t) {
  let h = 0.07 * Math.sin(0.55 * x + 0.8 * t) + 0.06 * Math.sin(0.33 * z - 1.1 * t + 0.4 * x) + 0.03 * Math.sin(1.3 * x - 0.7 * z + 1.7 * t);
  const tau = t - 4;
  if (tau > 0) {
    const r = Math.hypot(x - 0.06, z), A = 0.32 * Math.exp(-tau * 0.55);
    for (let k = 0; k < 3; k++) {
      const front = 2.6 * tau - k * 0.9;
      if (front <= 0) continue;
      const dr = r - front;
      h += A * (1 - k * 0.28) * Math.cos(dr * 3.6) * Math.exp(-dr * dr / (0.9 + 0.6 * tau)) / (1 + 0.25 * r);
    }
    h -= 0.35 * Math.exp(-r * r * 3) * bump(4.0, 4.12, 4.45, t);
  }
  const calm = 1 - smooth(7.0, 8.2, t);
  return h * calm;
}
const KEY = norm([-0.5, 0.75, -0.45]), SOFTBOX = norm([-0.35, 0.82, 0.45]), RIMV = norm([0.65, 0.35, 0.7]);
function drawGround(ctx, cam, t, alpha) {
  if (alpha <= 0.002) return;
  const gw = groundC.width, gh = groundC.height, sx = W / gw, sy = H / gh;
  const d = groundImg.data, P = cam.pos;
  const e = 0.05;
  const base = [62, 30, 15], haze = [40, 21, 13];
  for (let j = 0; j < gh; j++) {
    const Y = (H / 2 - (j + 0.5) * sy) / cam.focal;
    for (let i = 0; i < gw; i++) {
      const X = ((i + 0.5) * sx - W / 2) / cam.focal;
      const dx = cam.f[0] + cam.r[0] * X + cam.u[0] * Y, dy = cam.f[1] + cam.r[1] * X + cam.u[1] * Y, dz = cam.f[2] + cam.r[2] * X + cam.u[2] * Y;
      const o = (j * gw + i) * 4;
      if (dy >= -1e-4) { d[o + 3] = 0; continue; }
      const k = (SURF_Y - P[1]) / dy; const x = P[0] + dx * k, z = P[2] + dz * k;
      const dl = Math.hypot(dx, dy, dz), dist = k * dl;
      const h0 = surfH(x, z, t), hx = surfH(x + e, z, t), hz = surfH(x, z + e, t);
      let nx = -(hx - h0) / e, ny = 1, nz = -(hz - h0) / e; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      const vx = -dx / dl, vy = -dy / dl, vz = -dz / dl;
      const ndl = Math.max(0, nx * KEY[0] + ny * KEY[1] + nz * KEY[2]);
      let hxv = KEY[0] + vx, hyv = KEY[1] + vy, hzv = KEY[2] + vz; const hl = Math.hypot(hxv, hyv, hzv);
      const ndh = Math.max(0, (nx * hxv + ny * hyv + nz * hzv) / hl);
      const ndv = nx * vx + ny * vy + nz * vz;
      const rx = 2 * ndv * nx - vx, ry = 2 * ndv * ny - vy, rz = 2 * ndv * nz - vz;
      const sb = rx * SOFTBOX[0] + ry * SOFTBOX[1] + rz * SOFTBOX[2];
      const soft = sb > 0.955 ? Math.min(1, (sb - 0.955) / 0.03) : 0;
      const rimv = Math.max(0, rx * RIMV[0] + ry * RIMV[1] + rz * RIMV[2]);
      const fres = 0.08 + 0.92 * Math.pow(1 - Math.max(0, ndv), 5);
      const spec = Math.pow(ndh, 140) * 0.9 + soft * 0.42 * (0.3 + fres) + Math.pow(rimv, 30) * 0.12;
      let r = base[0] * (0.35 + 0.75 * ndl) + 255 * spec, g = base[1] * (0.35 + 0.75 * ndl) + 222 * spec, b = base[2] * (0.35 + 0.75 * ndl) + 186 * spec;
      r += Math.pow(rimv, 10) * 18; b += Math.pow(rimv, 10) * 22;
      const fog = clamp((dist - 10) / 34);
      r = lerp(r, haze[0], fog); g = lerp(g, haze[1], fog); b = lerp(b, haze[2], fog);
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255 * alpha * (1 - smooth(0.92, 1, fog));
    }
  }
  gctx.putImageData(groundImg, 0, 0);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(groundC, 0, 0, W, H); ctx.restore();
}

// ---------- splash ----------
const splashDrops = (() => { const R = rng(21), a = []; for (let i = 0; i < 46; i++) { const ang = R() * TAU; a.push({ ang, t0: 0.05 + R() * 0.12, vr: 1.4 + R() * 2.6, vy: 3.8 + R() * 4.2, r: 0.04 + R() * 0.07 }); } return a; })();
function chocoBlob(ctx, x, y, R, alpha = 1) {
  const g = ctx.createRadialGradient(x - R * .35, y - R * .4, R * .05, x, y, R);
  g.addColorStop(0, `rgba(250,220,190,${alpha})`); g.addColorStop(0.2, `rgba(128,70,40,${alpha})`); g.addColorStop(1, `rgba(40,18,9,${alpha})`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
}
function splashItems(cam, t, items) {
  const tau = t - 4; if (tau < 0 || tau > 1.6) return;
  const O = [0.06, SURF_Y, 0];
  // crown sheet as segments
  if (tau < 0.6) {
    const N = 40, k = clamp(tau / 0.6), rc = 0.5 + 1.9 * Math.sqrt(tau), hc = 1.15 * Math.sin(Math.PI * Math.pow(k, 0.7)) * (1 - 0.4 * k);
    const jag = (i) => 0.75 + 0.45 * Math.abs(Math.sin(i * 1.93 + 0.7) * Math.sin(i * 0.71 + 2.1));
    for (let i = 0; i < N; i++) {
      const a0 = i / N * TAU, a1 = (i + 1) / N * TAU, am = (a0 + a1) / 2, fl = 1.32;
      const b0 = add(O, [Math.cos(a0) * rc, 0, Math.sin(a0) * rc]), b1 = add(O, [Math.cos(a1) * rc, 0, Math.sin(a1) * rc]);
      const h0 = hc * jag(i), h1 = hc * jag(i + 1);
      const t0 = add(O, [Math.cos(a0) * rc * fl, h0, Math.sin(a0) * rc * fl]), t1 = add(O, [Math.cos(a1) * rc * fl, h1, Math.sin(a1) * rc * fl]);
      const ps = [b0, b1, t1, t0].map(p => proj(cam, p)); if (ps.some(q => !q)) continue;
      const nrm = norm([Math.cos(am), -0.35, Math.sin(am)]);
      const facing = dot(nrm, norm(sub(cam.pos, O)));
      const lit = clamp(dot(nrm, KEY) * 0.6 + 0.45);
      const zc = (ps[0].z + ps[2].z) / 2 - (facing > 0 ? 0.3 : -0.3);
      const tip = i % 3 === 0 ? proj(cam, add(O, [Math.cos(a0) * rc * (fl + 0.05), h0 + 0.12, Math.sin(a0) * rc * (fl + 0.05)])) : null;
      items.push({ z: zc, draw(ctx) {
        const g = ctx.createLinearGradient(0, ps[0].y, 0, ps[3].y);
        const c0 = facing > 0 ? mixC([40, 19, 9], [96, 52, 28], lit) : [30, 14, 7];
        g.addColorStop(0, rgb(...c0)); g.addColorStop(0.75, rgb(...mixC(c0, [150, 90, 55], facing > 0 ? 0.5 : 0.2))); g.addColorStop(1, rgb(...mixC(c0, [240, 205, 170], facing > 0 ? 0.55 : 0.15)));
        poly(ctx, ps, g, false); ctx.strokeStyle = rgb(...c0); ctx.lineWidth = 0.8; ctx.stroke();
        if (tip && tau > 0.08) chocoBlob(ctx, tip.x, tip.y, Math.max(1.5, 0.07 * tip.s));
      } });
    }
  }
  // droplets (analytic ballistics)
  for (const s of splashDrops) {
    const tt = tau - s.t0; if (tt < 0) continue;
    const rr = 0.6 + 0.4 * Math.sqrt(s.t0 * 8) + s.vr * tt, y = SURF_Y + 0.6 + s.vy * tt - 12 * tt * tt;
    if (y < SURF_Y - 0.05) continue;
    const p = add(O, [Math.cos(s.ang) * rr, y - SURF_Y, Math.sin(s.ang) * rr]); const q = proj(cam, p); if (!q) continue;
    const vy = s.vy - 24 * tt;
    items.push({ z: q.z, draw(ctx) { const R = Math.max(1.2, s.r * q.s); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(Math.atan2(-vy, s.vr) * 0.3); ctx.scale(1, 1 + Math.min(1.2, Math.abs(vy) * 0.08)); chocoBlob(ctx, 0, 0, R); ctx.restore(); } });
  }
  // Worthington jet
  const jt = (tau - 0.32) / 0.9;
  if (jt > 0 && jt < 1) {
    const hj = 2.6 * Math.sin(Math.PI * jt);
    const pb = proj(cam, O), pt = proj(cam, add(O, [0, hj, 0]));
    if (pb && pt) items.push({
      z: pb.z - 0.05, draw(ctx) {
        const wb = 0.42 * pb.s, wt = 0.12 * pt.s;
        const g = ctx.createLinearGradient(pb.x - wb, 0, pb.x + wb, 0);
        g.addColorStop(0, '#2a1209'); g.addColorStop(0.28, '#9a5a35'); g.addColorStop(0.36, '#f0d2b4'); g.addColorStop(0.5, '#6a3720'); g.addColorStop(1, '#1d0c06');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(pb.x - wb, pb.y);
        ctx.bezierCurveTo(pb.x - wb * 0.4, lerp(pb.y, pt.y, 0.4), pt.x - wt, lerp(pb.y, pt.y, 0.7), pt.x - wt, pt.y);
        ctx.lineTo(pt.x + wt, pt.y);
        ctx.bezierCurveTo(pt.x + wt, lerp(pb.y, pt.y, 0.7), pb.x + wb * 0.4, lerp(pb.y, pt.y, 0.4), pb.x + wb, pb.y);
        ctx.closePath(); ctx.fill();
        chocoBlob(ctx, pt.x, pt.y - wt * 0.6, Math.max(2, 0.17 * pt.s));
      }
    });
    // detached drop at the top
    if (jt > 0.5) {
      const dt = (jt - 0.5) * 0.9, y = 1.9 + 1.2 * dt - 12 * dt * dt;
      if (y > 0) { const q = proj(cam, add(O, [0, y + 0.25, 0])); if (q) items.push({ z: q.z, draw(ctx) { chocoBlob(ctx, q.x, q.y, Math.max(2, 0.14 * q.s)); } }); }
    }
  }
}

// ---------- chocolate bar ----------
const BAR = { w: 4.8, l: 9.6, th: 1.0, tile: 1.6, cols: 3, rows: 6 };
const sectionNoise = (() => { const R = rng(99), a = []; for (let i = 0; i <= 24; i++) a.push([R() * 0.07 - 0.035, R() * 0.06 - 0.03, R() * 0.06 - 0.03]); return a; })();
const speckles = (() => { const R = rng(55), a = []; for (let i = 0; i < 120; i++) a.push({ x: R() * 4.6 - 2.3, y: 0.22 + R() * 0.52, r: 0.025 + R() * 0.05, c: R() < 0.55 ? [44, 16, 62] : R() < 0.6 ? [214, 176, 238] : [70, 40, 130] }); return a; })();
function shadeChoc(n, cam, p, k = 1) {
  const v = norm(sub(cam.pos, p));
  const dif = Math.max(0, dot(n, KEY)), hv = norm(add(KEY, v)), sp = Math.pow(Math.max(0, dot(n, hv)), 40);
  const rim = Math.pow(Math.max(0, dot(n, RIMV)), 2);
  const base = [72, 37, 20];
  return [base[0] * (0.28 + 0.85 * dif) * k + 190 * sp + 30 * rim, base[1] * (0.28 + 0.85 * dif) * k + 150 * sp + 14 * rim, base[2] * (0.28 + 0.85 * dif) * k + 120 * sp + 40 * rim];
}
// half: z0..z1 local, section at z = 0 (secSign: normal of section face), xf: local->world, rot: local normal->world
function barHalfItem(cam, z0, z1, secSign, xf, rot, showSection, alpha = 1) {
  const center = xf([0, 0.5, (z0 + z1) / 2]);
  const pc = proj(cam, center); if (!pc) return null;
  return {
    z: pc.z, draw(ctx) {
      ctx.globalAlpha = alpha;
      const polys = [];
      const hw = BAR.w / 2;
      const face = (pts, n, kind, extra) => {
        const wn = rot(n), wp = pts.map(xf), c = wp.reduce((a, q) => add(a, q), [0, 0, 0]).map(x => x / pts.length);
        if (dot(wn, sub(cam.pos, c)) <= 0) return;
        const pp = wp.map(q => proj(cam, q)); if (pp.some(q => !q)) return;
        polys.push({ pp, wn, c, kind, extra, z: dot(sub(c, cam.pos), cam.f) });
      };
      // body
      face([[-hw, 0, z0], [hw, 0, z0], [hw, 0, z1], [-hw, 0, z1]], [0, -1, 0], 'b');
      face([[-hw, 0, z0], [-hw, 1, z0], [-hw, 1, z1], [-hw, 0, z1]], [-1, 0, 0], 'b');
      face([[hw, 0, z0], [hw, 0, z1], [hw, 1, z1], [hw, 1, z0]], [1, 0, 0], 'b');
      const zo = secSign > 0 ? z0 : z1; // outer end
      face([[-hw, 0, zo], [hw, 0, zo], [hw, 1, zo], [-hw, 1, zo]], [0, 0, secSign > 0 ? -1 : 1], 'b');
      const order = polys.length; // body first
      face([[-hw, 1, z0], [hw, 1, z0], [hw, 1, z1], [-hw, 1, z1]], [0, 1, 0], 'groove');
      // tiles
      const T = BAR.tile, ins = 0.07, top = 0.13, bev = 0.26;
      const tz0 = Math.min(z0, z1);
      const nr = Math.round(Math.abs(z1 - z0) / T);
      const tiles = [];
      for (let ci = 0; ci < BAR.cols; ci++) for (let ri = 0; ri < nr; ri++) {
        const x0 = -hw + ci * T + ins, x1 = -hw + (ci + 1) * T - ins, a0 = tz0 + ri * T + ins, a1 = tz0 + (ri + 1) * T - ins;
        const X0 = x0 + bev, X1 = x1 - bev, A0 = a0 + bev, A1 = a1 - bev, y1 = 1 + top;
        tiles.push([[[x0, 1, a0], [X0, y1, A0], [X1, y1, A0], [x1, 1, a0]], norm([0, bev, -top])]);
        tiles.push([[[x1, 1, a0], [X1, y1, A0], [X1, y1, A1], [x1, 1, a1]], norm([top, bev, 0])]);
        tiles.push([[[x1, 1, a1], [X1, y1, A1], [X0, y1, A1], [x0, 1, a1]], norm([0, bev, top])]);
        tiles.push([[[x0, 1, a1], [X0, y1, A1], [X0, y1, A0], [x0, 1, a0]], norm([-top, bev, 0])]);
        tiles.push([[[X0, y1, A0], [X1, y1, A0], [X1, y1, A1], [X0, y1, A1]], [0, 1, 0]]);
      }
      // section
      if (showSection) {
        const N = 24, zs = 0, row = (y, k) => { const pts = []; for (let i = 0; i <= N; i++) { const nz = sectionNoise[i]; pts.push([-hw + i / N * BAR.w, y + nz[k], zs + nz[0] * 0.5]); } return pts; };
        const n = [0, 0, secSign];
        const L0 = row(0, 2), L1 = row(0.2, 1), L2 = row(0.76, 2), L3 = row(1, 1);
        const band = (A, B) => A.concat(B.slice().reverse());
        face(band(L0, L1), n, 'shell'); face(band(L1, L2), n, 'nougat'); face(band(L2, L3), n, 'shell');
      }
      const body = polys.slice(0, order), rest = polys.slice(order);
      const groove = rest.filter(p => p.kind === 'groove'), sec = rest.filter(p => p.kind !== 'groove');
      const draw = (p) => {
        if (p.kind === 'nougat') {
          const v = norm(sub(cam.pos, p.c)), dif = Math.max(0, dot(p.wn, KEY));
          const top = p.pp[0], bot = p.pp[p.pp.length - 1];
          const g = ctx.createLinearGradient(0, Math.min(...p.pp.map(q => q.y)), 0, Math.max(...p.pp.map(q => q.y)));
          const k = 0.55 + 0.6 * dif;
          g.addColorStop(0, rgb(170 * k, 120 * k, 205 * k)); g.addColorStop(0.5, rgb(132 * k, 84 * k, 176 * k)); g.addColorStop(1, rgb(96 * k, 58 * k, 140 * k));
          poly(ctx, p.pp, g);
          // speckles
          for (const s of speckles) {
            const q = proj(cam, xf([s.x, s.y, 0.005 * secSign])); if (!q) continue;
            ctx.fillStyle = rgb(...s.c, 0.9); ctx.beginPath(); ctx.ellipse(q.x, q.y, s.r * q.s, s.r * q.s * 0.8, 0.3, 0, TAU); ctx.fill();
          }
          void top; void bot; void v;
          return;
        }
        if (p.kind === 'shell') { poly(ctx, p.pp, rgb(...shadeChoc(p.wn, cam, p.c, 0.8).map(x => x * 0.9))); return; }
        poly(ctx, p.pp, rgb(...shadeChoc(p.wn, cam, p.c, p.kind === 'groove' ? 0.7 : 1)));
      };
      body.sort((a, b) => b.z - a.z).forEach(draw);
      groove.forEach(draw);
      const tp = [];
      for (const [pts, n] of tiles) {
        const wn = rot(n), wp = pts.map(xf), c = wp.reduce((a, q) => add(a, q), [0, 0, 0]).map(x => x / 4);
        if (dot(wn, sub(cam.pos, c)) <= 0) continue;
        const pp = wp.map(q => proj(cam, q)); if (pp.some(q => !q)) continue;
        tp.push({ pp, wn, c, kind: 't', z: dot(sub(c, cam.pos), cam.f) });
      }
      tp.sort((a, b) => b.z - a.z).forEach(draw);
      sec.forEach(draw);
      ctx.globalAlpha = 1;
    }
  };
}
// transforms of the halves during S3
function halfXf(which, t) {
  const tau = t - 9;
  const rise = -0.38 * (1 - easeOutCubic((t - 7.65) / 0.7));
  const piv = [0, SURF_Y - 1 + rise, 0];
  let pitch = 0, yaw = 0, tr = [0, 0, 0];
  const pre = bump(8.6, 8.95, 9.0, t) * 1.5 * DEG;
  if (which === 'B') {
    pitch = (tau > 0 ? (24 * easeOutCubic(tau / 0.3) - 10 * smooth(0.3, 1.6, tau)) * DEG : 0) - pre;
    yaw = tau > 0 ? -22 * DEG * easeInOut(tau / 2.2) - 4 * DEG * smooth(2.2, 4, tau) : 0;
    tr = tau > 0 ? [0.25 * easeOutCubic(tau / 1.5), 0.45 * easeOutCubic(tau / 1.2), 1.0 * easeOutBack(tau / 0.8, 1.2) + 0.15 * tau] : [0, 0, 0];
  } else {
    pitch = (tau > 0 ? -(22 * easeOutCubic(tau / 0.3) - 4 * smooth(0.3, 1.6, tau)) * DEG : 0) + pre;
    yaw = tau > 0 ? 28 * DEG * easeInOut(tau / 2.0) : 0;
    tr = tau > 0 ? mul([-1.9, -1.1, -2.7], easeOutCubic(tau / 1.3)) : [0, 0, 0];
    if (tau > 0) tr = add(tr, [-0.12 * tau, -0.1 * tau, -0.08 * tau]);
  }
  const R = v => rotY(rotX(v, pitch), yaw);
  return { xf: l => add(add(piv, tr), R(l)), rot: R };
}
function sectionB(t) { const h = halfXf('B', t); return h.xf([0, 0.5, 0]); }

const crumbs = (() => { const R = rng(31), a = []; for (let i = 0; i < 44; i++) a.push({ x: R() * 4.6 - 2.3, y: R() * 1, v: [R() * 4 - 2, 1.5 + R() * 4.5, R() * 5 - 2.5], r: 0.04 + R() * 0.11, spin: R() * 20 - 10, ph: R() * TAU, nougat: R() < 0.35, sides: 5 + (R() * 3 | 0) }); return a; })();
function crumbItems(cam, t, items) {
  const tau = t - 9; if (tau < 0 || tau > 3.2) return;
  for (const c of crumbs) {
    const p = [c.x + c.v[0] * tau, SURF_Y - 1 + c.y + c.v[1] * tau - 7 * tau * tau, c.v[2] * tau];
    const q = proj(cam, p); if (!q) continue;
    const R = c.r * q.s, ang = c.ph + c.spin * tau;
    items.push({
      z: q.z, draw(ctx) {
        ctx.translate(q.x, q.y); ctx.rotate(ang);
        ctx.fillStyle = c.nougat ? '#9a68c4' : '#5a2d17'; ctx.beginPath();
        for (let k = 0; k < c.sides; k++) { const a = k / c.sides * TAU, rr = R * (0.7 + 0.3 * Math.sin(k * 2.7 + c.ph)); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.fill(); ctx.fillStyle = c.nougat ? 'rgba(230,200,255,.5)' : 'rgba(200,140,100,.45)'; ctx.beginPath(); ctx.arc(-R * .25, -R * .25, R * .3, 0, TAU); ctx.fill();
      }
    });
  }
}

// ---------- camera timeline A (0..13) ----------
function keyLA(t, pos, tgt, up = [0, 1, 0], roll = 0) { return { t, v: [...pos, ...tgt, ...up, roll] }; }
function keyOrb(t, el, az, R, T, roll = 0) { const o = orbit(el, az, R, T); return keyLA(t, o.pos, o.tgt, o.up, roll); }
const SB = t => sectionB(t);
const CAM_A = [
  keyLA(0.0, [-3.7, 2.6, -13.2], [0.9, 0.75, 0], [0, 1, 0], -4),
  keyLA(1.0, [-2.6, 2.05, -10.3], [0.55, 0.5, 0], [0, 1, 0], -2.5),
  keyLA(2.0, [-1.0, 1.25, -7.4], [0.2, 0.2, 0], [0, 1, 0], 0),
  keyLA(2.8, [0.25, 0.62, -5.3], [0.0, 0.02, 0], [0, 1, 0], 1.5),
  keyLA(3.3, [0.6, -0.45, -4.9], [0.0, -1.5, 0], [0, 1, 0], 1.2),
  keyLA(3.65, [0.9, -4.0, -5.5], [0.03, -5.3, 0], [0, 1, 0], 0.6),
  keyOrb(4.0, 11.8, 10.3, 6.85, [0, -11.7, 0]),
  keyOrb(4.6, 13, 14, 7.2, [0, -11.4, 0]),
  keyOrb(5.6, 15, 20, 7.8, [0, -11.4, 0]),
  keyOrb(6.8, 22, 27, 9.0, [0, -11.6, 0]),
  keyOrb(7.6, 46, 21, 10.6, [0, -11.9, 0]),
  keyOrb(8.3, 80, 8, 12.0, [0, -12.4, 0]),
  keyOrb(8.9, 86, 4, 11.4, [0, -12.4, 0]),
  keyOrb(9.6, 56, 20, 9.0, lerpV([0, -12.4, 0], SB(9.6), 0.6)),
  keyOrb(10.4, 30, 33, 6.9, SB(10.4)),
  keyOrb(11.5, 19, 40, 5.7, SB(11.5)),
  keyOrb(12.4, 15, 46, 5.2, SB(12.4)),
  keyOrb(13.0, 10, 51, 4.8, add(SB(13.0), [0, 7, 0])),
];
function camA(t) {
  const v = spline(CAM_A, t);
  let focusP;
  if (t < 4) focusP = heroPos(t); else if (t < 8.4) focusP = [0, -11.5, 0]; else focusP = lerpV([0, -12.4, 0], SB(t), smooth(9.0, 10.2, t));
  const pos = v.slice(0, 3), tgt = v.slice(3, 6), up = v.slice(6, 9);
  const focus = Math.max(1, dot(sub(focusP, pos), norm(sub(tgt, pos))));
  const ap = t < 4 ? 0.06 : t < 8.6 ? 0.035 : 0.07;
  return makeCam(pos, tgt, up, v[9], focus, ap);
}

// ---------- world A background ----------
function horizonY(cam) {
  const fh = [cam.f[0], 0, cam.f[2]]; if (len(fh) < 0.15) return null;
  const q = proj(cam, add(cam.pos, mul(norm(fh), 1000))); return q ? q.y : null;
}
function bgA(ctx, cam, t) {
  const night = (1 - smooth(3.25, 3.95, t)) * smooth(-8.5, -2.0, cam.pos[1]);
  const hy = horizonY(cam) ?? -2000;
  // cocoa studio
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#120a10'); g.addColorStop(clamp((hy - 300) / H), '#2a1610'); g.addColorStop(clamp(hy / H + 0.001), '#3a2014'); g.addColorStop(1, '#0d0605');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.25, H * 0.2, 0, W * 0.25, H * 0.2, H * 0.6);
  glow.addColorStop(0, 'rgba(120,70,140,0.32)'); glow.addColorStop(1, 'rgba(120,70,140,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  if (night <= 0) return;
  ctx.globalAlpha = night;
  g = ctx.createLinearGradient(0, 0, 0, H);
  const hn = clamp(hy / H, 0.02, 0.98);
  g.addColorStop(0, '#04050f'); g.addColorStop(hn * 0.7, '#0b1230'); g.addColorStop(hn, '#1b2552'); g.addColorStop(Math.min(1, hn + 0.02), '#0a0f26'); g.addColorStop(1, '#03040b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // stars
  for (const s of bush.stars) {
    const q = proj(cam, add(cam.pos, mul(s.d, 500))); if (!q) continue;
    const tw = 0.6 + 0.4 * Math.sin(t * 3 + s.ph);
    ctx.fillStyle = `rgba(220,225,255,${0.55 * s.b * tw})`; ctx.fillRect(q.x, q.y, 2, 2);
  }
  // moon
  const mq = proj(cam, add(cam.pos, mul(norm([0.22, 0.2, 1]), 400)));
  if (mq) {
    const R = 120;
    const mg = ctx.createRadialGradient(mq.x, mq.y, R * 0.6, mq.x, mq.y, R * 5);
    mg.addColorStop(0, 'rgba(190,200,255,0.35)'); mg.addColorStop(1, 'rgba(120,130,220,0)');
    ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H);
    const md = ctx.createRadialGradient(mq.x - R * 0.3, mq.y - R * 0.3, R * 0.1, mq.x, mq.y, R);
    md.addColorStop(0, '#fbf6e8'); md.addColorStop(1, '#cfd3ea');
    ctx.fillStyle = md; ctx.beginPath(); ctx.arc(mq.x, mq.y, R, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(150,155,190,0.25)';
    [[-0.3, -0.1, 0.22], [0.25, 0.3, 0.15], [0.1, -0.4, 0.1], [-0.2, 0.42, 0.12]].forEach(([a, b, c]) => { ctx.beginPath(); ctx.arc(mq.x + a * R, mq.y + b * R, c * R, 0, TAU); ctx.fill(); });
  }
  // spruce silhouettes (two depth rows, tiered)
  for (const layer of bush.trees) {
    ctx.fillStyle = layer.col; ctx.beginPath(); let started = false;
    for (const tr of layer.row) {
      const z = layer.z, b0 = -12;
      const P = (x, y) => proj(cam, [tr.x + x, b0 + y, z]);
      const pts = [[-tr.w, 0]];
      for (let k = 0; k < 5; k++) { const y0 = tr.h * k / 5, y1 = tr.h * (k + 1) / 5, ww = tr.w * (1 - k / 5); pts.push([-ww * 0.45, y0 + 1.5], [-ww * 0.95, y1 * 0.98 + 1.2]); }
      pts.push([0, tr.h + 6]);
      for (let k = 4; k >= 0; k--) { const y0 = tr.h * k / 5, y1 = tr.h * (k + 1) / 5, ww = tr.w * (1 - k / 5); pts.push([ww * 0.95, y1 * 0.98 + 1.2], [ww * 0.45, y0 + 1.5]); }
      pts.push([tr.w, 0]);
      const pp = pts.map(([x, y]) => P(x, y)); if (pp.some(q => !q)) continue;
      if (!started) { ctx.moveTo(pp[0].x, H + 10); started = true; }
      for (const q of pp) ctx.lineTo(q.x, q.y);
    }
    if (started) { ctx.lineTo(W + 10, H + 10); ctx.closePath(); ctx.fill(); }
    const mq2 = proj(cam, add([cam.pos[0], -8, cam.pos[2]], mul(norm([cam.f[0], 0, cam.f[2]]), layer.z)));
    if (mq2) { const mg2 = ctx.createLinearGradient(0, mq2.y - 220, 0, mq2.y + 60); mg2.addColorStop(0, 'rgba(60,72,130,0)'); mg2.addColorStop(1, 'rgba(60,72,130,0.22)'); ctx.fillStyle = mg2; ctx.fillRect(0, mq2.y - 220, W, 280); }
  }
  // ground darkness under the bush
  const gq = proj(cam, add([cam.pos[0], -6, cam.pos[2]], mul(norm([cam.f[0], 0, cam.f[2]]), 30)));
  if (gq) { const gg = ctx.createLinearGradient(0, gq.y - 200, 0, gq.y + 300); gg.addColorStop(0, 'rgba(3,5,14,0)'); gg.addColorStop(1, 'rgba(3,5,14,1)'); ctx.fillStyle = gg; ctx.fillRect(0, gq.y - 200, W, H - gq.y + 200 + 1000); }
  ctx.globalAlpha = 1;
}

// ---------- typography helpers ----------
function layoutLine(ctx, text, font, cx, y, spacing = 0) {
  ctx.font = font;
  const chars = [...text], widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2; const out = [];
  chars.forEach((c, i) => { out.push({ c, x: x + widths[i] / 2, y, w: widths[i] }); x += widths[i] + spacing; });
  return out;
}
const S1_LINES = [['Коли ліс', 430], ['засинає…', 575]];
function textS1(ctx, cam, t) {
  if (t > 3.6) return;
  const font = 'italic 700 150px Cormorant';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const R = rng(5);
  let idx = 0;
  const px = -(cam.pos[0] + 3.7) * 14, py = (cam.pos[1] - 2.6) * 10;
  for (const [txt, y] of S1_LINES) {
    const L = layoutLine(ctx, txt, font, W / 2, y, 2);
    for (const g of L) {
      if (g.c === ' ') { idx++; continue; }
      const sx = 120 + R() * 840, sy = 900 + R() * 700, cx = lerp(sx, g.x, 0.5) + (R() - 0.5) * 500, cy = lerp(sy, g.y, 0.5) - 300 - R() * 200;
      const t0 = 0.25 + idx * 0.085, p = clamp((t - t0) / 0.95), e = easeInOut(p);
      const ex = clamp((t - 2.85 - idx * 0.03) / 0.6), ee = easeInCubic(ex);
      const bx = (1 - e) ** 2 * sx + 2 * (1 - e) * e * cx + e * e * g.x, by = (1 - e) ** 2 * sy + 2 * (1 - e) * e * cy + e * e * (g.y - 50);
      const fx = bx + px + Math.sin(t * 1.3 + idx) * 3 * e, fy = by + py - ee * (260 + idx * 12) + Math.cos(t * 1.1 + idx) * 3 * e;
      // firefly dot
      const dotA = (1 - smooth(0.85, 1, p)) * (p > 0 ? 1 : 0) + ee * (1 - ex) * 0.8;
      if (dotA > 0.01) {
        ctx.globalCompositeOperation = 'lighter';
        const gr = ctx.createRadialGradient(fx, fy, 0, fx, fy, 34);
        gr.addColorStop(0, `rgba(255,236,170,${dotA})`); gr.addColorStop(0.3, `rgba(255,200,110,${dotA * 0.4})`); gr.addColorStop(1, 'rgba(255,190,90,0)');
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(fx, fy, 34, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      const la = smooth(0.82, 1, p) * (1 - smooth(0.0, 0.8, ex));
      if (la > 0.01) {
        ctx.save(); ctx.translate(fx, fy + 50); const sc = lerp(0.6, 1, smooth(0.8, 1, p)) * (1 + ee * 0.3); ctx.scale(sc, sc);
        ctx.font = font; ctx.shadowColor = 'rgba(255,210,140,0.9)'; ctx.shadowBlur = 40 * (1 - smooth(0.9, 1.6, (t - t0)));
        ctx.fillStyle = `rgba(246,238,222,${la})`; ctx.fillText(g.c, 0, 0);
        ctx.shadowBlur = 0; ctx.restore();
      }
      idx++;
    }
  }
}
// S2: letters rise out of chocolate, dipped
const lineC = mk(W, 300), lctx = lineC.getContext('2d');
const S2_LINES = [['чорниця пірнає', 330, 'italic 700 132px Cormorant', 0], ['в шоколад', 480, '800 104px Unbounded', 4]];
function textS2(ctx, t) {
  if (t < 4.55 || t > 8.0) return;
  let idx = 0;
  S2_LINES.forEach(([txt, y, font, sp], li) => {
    lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, W, 300);
    lctx.textAlign = 'center'; lctx.textBaseline = 'alphabetic';
    const base = 200; const L = layoutLine(lctx, txt, font, W / 2, base, sp);
    const liquid = base + 62;
    lctx.save(); lctx.beginPath(); lctx.rect(0, 0, W, liquid); lctx.clip();
    const offs = [];
    for (const g of L) {
      const t0 = 4.6 + li * 0.35 + idx * 0.035, p = clamp((t - t0) / 0.55);
      const outp = clamp((t - 7.15 - idx * 0.02) / 0.45);
      const yoff = (1 - easeOutBack(p, 2.2)) * 190 + easeInCubic(outp) * 220;
      offs.push(yoff);
      lctx.font = font; lctx.fillStyle = '#f6ecdf'; lctx.fillText(g.c, g.x, base + yoff);
      idx++;
    }
    lctx.restore();
    // chocolate coat on lower part of glyphs
    lctx.globalCompositeOperation = 'source-atop';
    const cg = lctx.createLinearGradient(0, base - 30, 0, base + 12);
    cg.addColorStop(0, '#f2d2b0'); cg.addColorStop(0.18, '#a8643a'); cg.addColorStop(0.5, '#6e3a1f'); cg.addColorStop(1, '#4a2412');
    lctx.fillStyle = cg; lctx.beginPath(); lctx.moveTo(0, 300);
    for (let x = 0; x <= W; x += 12) { const i = Math.min(L.length - 1, L.reduce((bi, g, k) => Math.abs(g.x - x) < Math.abs(L[bi].x - x) ? k : bi, 0)); lctx.lineTo(x, base - (li ? 22 : 14) + offs[i] + 6 * Math.sin(x * 0.045 + t * 2.4) + 4 * Math.sin(x * 0.11 - t * 1.3)); }
    lctx.lineTo(W, 300); lctx.closePath(); lctx.fill();
    lctx.globalCompositeOperation = 'source-over';
    // drips
    L.forEach((g, k) => {
      if (g.c === ' ' || (k * 7 + li * 3) % 3) return;
      const t0 = 4.6 + li * 0.35 + k * 0.035 + 0.5, dt = t - t0; if (dt < 0) return;
      const yo = offs[k]; if (yo > 40) return;
      const Ld = Math.min(60, dt * 55) * (1 - smooth(7.1, 7.4, t));
      const x = g.x + ((k * 37) % 20 - 10), y0 = base + yo - 2;
      lctx.fillStyle = '#6e3a1f'; lctx.beginPath(); lctx.moveTo(x - 7, y0); lctx.quadraticCurveTo(x - 5, y0 + Ld * 0.7, x, y0 + Ld); lctx.quadraticCurveTo(x + 5, y0 + Ld * 0.7, x + 7, y0); lctx.fill();
      lctx.beginPath(); lctx.arc(x, y0 + Ld, 6.5, 0, TAU); lctx.fill();
      const fall = (dt % 1.1); if (dt > 1.1 && fall < 0.5) { lctx.beginPath(); lctx.arc(x, y0 + 60 + fall * fall * 700, 5, 0, TAU); lctx.fill(); }
    });
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    ctx.drawImage(lineC, 0, y - base); ctx.restore();
  });
}
// S3: word splits with the bar
const nougatPat = (() => { const c = mk(256, 256), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#c9a2f0'); g.addColorStop(1, '#8a56be'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); const R = rng(8); for (let i = 0; i < 160; i++) { x.fillStyle = R() < 0.6 ? 'rgba(52,18,74,0.9)' : 'rgba(240,220,255,0.8)'; x.beginPath(); x.arc(R() * 256, R() * 256, 1.5 + R() * 4, 0, TAU); x.fill(); } return c; })();
function textS3(ctx, t) {
  const tau = t - 9; if (tau < 0 || t > 13.1) return;
  const crack = 420;
  const sep = easeOutBack(tau / 0.7, 1.6), st = 1 + 0.45 * Math.exp(-tau * 4) * Math.sin(tau * 14 + 0.3);
  const fly = easeInCubic((t - 12.45) / 0.5);
  const spread = 22 * easeOutCubic(tau / 1.4);
  const a = smooth(0, 0.12, tau);
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  // line 1
  ctx.save(); ctx.translate(W / 2, crack - 30 * sep - fly * 900); ctx.scale(1, st * lerp(0.1, 1, clamp(sep))); ctx.translate(-W / 2, 0);
  const L1 = layoutLine(ctx, 'ЧОРНИЧНА', '800 112px Unbounded', W / 2, 0, spread * 0.4);
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 24; ctx.fillStyle = '#efe2ff';
  for (const g of L1) ctx.fillText(g.c, g.x, 0);
  ctx.restore();
  // line 2 (nougat texture)
  ctx.save(); ctx.translate(W / 2, crack + 30 + 160 * sep - fly * 900); const st2 = 2 - st; ctx.scale(1, st2 * lerp(0.1, 1, clamp(sep))); ctx.translate(-W / 2, 0);
  const L2 = layoutLine(ctx, 'НУГА', '800 220px Unbounded', W / 2, 0, spread);
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, W, 300); lctx.textAlign = 'center'; lctx.font = '800 220px Unbounded';
  for (const g of L2) lctx.fillText(g.c, g.x, 240);
  lctx.globalCompositeOperation = 'source-in'; lctx.fillStyle = lctx.createPattern(nougatPat, 'repeat'); lctx.fillRect(0, 0, W, 300); lctx.globalCompositeOperation = 'source-over';
  ctx.shadowColor = 'rgba(20,0,30,.6)'; ctx.shadowBlur = 30;
  ctx.drawImage(lineC, 0, -240);
  ctx.restore();
  ctx.restore();
}

// ---------- world B: packshot (13..20) ----------
const PK = { w: 5.6, h: 10, d: 0.45 };
let pkgTex = null, pkgBack = null;
function buildPackage() {
  const TW = 1120, TH = 2000, c = mk(TW, TH), x = c.getContext('2d');
  let g = x.createLinearGradient(0, 0, 0, TH); g.addColorStop(0, '#1b1550'); g.addColorStop(0.55, '#2c1a5c'); g.addColorStop(1, '#140c30');
  x.fillStyle = g; x.fillRect(0, 0, TW, TH);
  const R = rng(3);
  for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(230,225,255,${0.2 + R() * 0.5})`; x.beginPath(); x.arc(R() * TW, R() * TH * 0.5, 1 + R() * 2.5, 0, TAU); x.fill(); }
  // moon
  const mg = x.createRadialGradient(860, 230, 40, 860, 230, 300); mg.addColorStop(0, 'rgba(255,240,200,0.4)'); mg.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = mg; x.fillRect(0, 0, TW, 700);
  x.fillStyle = '#f6e8c4'; x.beginPath(); x.arc(860, 230, 92, 0, TAU); x.fill();
  // gold frame
  x.strokeStyle = '#d9b46a'; x.lineWidth = 6; x.strokeRect(40, 40, TW - 80, TH - 80); x.lineWidth = 2; x.strokeRect(62, 62, TW - 124, TH - 124);
  // wordmark
  x.textAlign = 'center'; x.textBaseline = 'alphabetic';
  x.font = '800 190px Unbounded'; x.fillStyle = '#f3dfb0';
  const wl = layoutLine(x, 'ROSHEN', '800 190px Unbounded', TW / 2, 500, 14);
  x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = 20; for (const q of wl) x.fillText(q.c, q.x, 500); x.shadowBlur = 0;
  x.fillStyle = '#d9b46a'; x.fillRect(260, 560, TW - 520, 4);
  const sl = layoutLine(x, 'ШОКОЛАД', '500 64px Unbounded', TW / 2, 680, 22); x.fillStyle = '#efe4ff'; for (const q of sl) x.fillText(q.c, q.x, 680);
  x.font = 'italic 700 128px Cormorant'; x.fillStyle = '#d7b6ff'; x.fillText('з чорничною', TW / 2, 840); x.fillText('нугою', TW / 2, 960);
  // chocolate wave with a broken piece
  x.save();
  x.beginPath(); x.moveTo(0, 1500); x.bezierCurveTo(300, 1380, 640, 1600, TW, 1420); x.lineTo(TW, TH); x.lineTo(0, TH); x.closePath();
  g = x.createLinearGradient(0, 1380, 0, TH); g.addColorStop(0, '#8a4b29'); g.addColorStop(0.08, '#f0d2b0'); g.addColorStop(0.16, '#5c2e18'); g.addColorStop(1, '#2a1209'); x.fillStyle = g; x.fill();
  x.restore();
  // bar chunk with nougat
  x.save(); x.translate(330, 1560); x.rotate(-0.18);
  x.fillStyle = '#4a2413'; x.fillRect(-230, -150, 460, 300);
  x.fillStyle = '#6a3a20'; for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) x.fillRect(-215 + i * 225, -135 + j * 140, 205, 125);
  x.fillStyle = '#3a1a0c'; x.fillRect(-230, 150, 460, 34);
  g = x.createLinearGradient(0, 184, 0, 290); g.addColorStop(0, '#c9a2f0'); g.addColorStop(1, '#7c4bb0'); x.fillStyle = g; x.fillRect(-230, 184, 460, 100);
  for (let i = 0; i < 40; i++) { x.fillStyle = R() < 0.6 ? '#3a1250' : '#efd9ff'; x.beginPath(); x.arc(-220 + R() * 440, 192 + R() * 86, 3 + R() * 6, 0, TAU); x.fill(); }
  x.fillStyle = '#3a1a0c'; x.fillRect(-230, 284, 460, 30);
  x.restore();
  // berries + leaves illustration
  const leaf = (lx, ly, a, s) => { x.save(); x.translate(lx, ly); x.rotate(a); x.scale(s, s); const lg = x.createLinearGradient(0, -40, 0, 40); lg.addColorStop(0, '#4f8a6e'); lg.addColorStop(1, '#1f4a3a'); x.fillStyle = lg; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(60, -60, 180, -50, 240, 0); x.bezierCurveTo(180, 50, 60, 60, 0, 0); x.fill(); x.strokeStyle = 'rgba(200,240,210,.5)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 0); x.lineTo(230, 0); x.stroke(); x.restore(); };
  leaf(640, 1250, -0.5, 1.1); leaf(700, 1300, 0.4, 0.9); leaf(560, 1320, -2.6, 0.85);
  [[720, 1340, 92], [860, 1300, 80], [800, 1430, 84], [640, 1420, 70], [940, 1410, 64], [560, 1480, 56]].forEach(([bx, by, br]) => drawBerry2D(x, bx, by, br));
  x.font = '500 30px Unbounded'; x.fillStyle = 'rgba(240,228,255,.75)'; x.fillText('КОНЦЕПТ-ДИЗАЙН', TW / 2, TH - 100);
  pkgTex = c;
  const b = mk(560, 1000), bx2 = b.getContext('2d'); g = bx2.createLinearGradient(0, 0, 0, 1000); g.addColorStop(0, '#1b1550'); g.addColorStop(1, '#120a2a'); bx2.fillStyle = g; bx2.fillRect(0, 0, 560, 1000);
  bx2.strokeStyle = '#d9b46a'; bx2.lineWidth = 3; bx2.strokeRect(20, 20, 520, 960);
  for (let i = 0; i < 12; i++) { bx2.strokeStyle = 'rgba(217,180,106,.18)'; bx2.beginPath(); bx2.arc(280, 500, 40 + i * 30, 0, TAU); bx2.stroke(); }
  pkgBack = b;
}
function pkgYaw(t) {
  const s = (t - 13) / 1.7;
  return lerp(100, -5, easeOutBack(s, 1.4)) * DEG + lerp(0, 7, smooth(14.6, 20, t)) * DEG;
}
function packageItem(cam, t) {
  const yaw = pkgYaw(t), pitch = -3 * DEG;
  const C = [0, 0.4, 0];
  const R = v => rotY(rotX(v, pitch), yaw);
  const X = l => add(C, R(l));
  const hw = PK.w / 2, hh = PK.h / 2, hd = PK.d / 2;
  const pc = proj(cam, C); if (!pc) return null;
  return {
    z: pc.z, draw(ctx, s) {
      const faces = [];
      const f = (pts, n, kind) => { const wn = R(n), wp = pts.map(X), c = wp.reduce((a, q) => add(a, q), [0, 0, 0]).map(v => v / 4); if (dot(wn, sub(cam.pos, c)) <= 0) return; faces.push({ wp, wn, c, kind, z: dot(sub(c, cam.pos), cam.f) }); };
      f([[-hw, hh, -hd], [hw, hh, -hd], [hw, -hh, -hd], [-hw, -hh, -hd]], [0, 0, -1], 'front');
      f([[hw, hh, hd], [-hw, hh, hd], [-hw, -hh, hd], [hw, -hh, hd]], [0, 0, 1], 'back');
      f([[hw, hh, -hd], [hw, hh, hd], [hw, -hh, hd], [hw, -hh, -hd]], [1, 0, 0], 'side');
      f([[-hw, hh, hd], [-hw, hh, -hd], [-hw, -hh, -hd], [-hw, -hh, hd]], [-1, 0, 0], 'side');
      f([[-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd]], [0, 1, 0], 'side');
      f([[-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd]], [0, -1, 0], 'side');
      faces.sort((a, b) => b.z - a.z);
      const L = norm([-0.45, 0.5, -0.75]);
      for (const F of faces) {
        const pp = F.wp.map(q => proj(cam, q)); if (pp.some(q => !q)) continue;
        const lit = clamp(0.45 + 0.65 * dot(F.wn, L));
        if (F.kind === 'side') { poly(ctx, pp, rgb(40 * lit + 20, 26 * lit + 12, 80 * lit + 26)); ctx.strokeStyle = 'rgba(217,180,106,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); pp.forEach(q => ctx.lineTo(q.x, q.y)); ctx.closePath(); ctx.stroke(); continue; }
        const tex = F.kind === 'front' ? pkgTex : pkgBack, TW = tex.width, TH = tex.height;
        // perspective via vertical strips (affine each)
        const N = 40;
        const P = (u, v) => { // u,v in 0..1 over the face: corners 0:TL 1:TR 2:BR 3:BL
          const top = lerpV(F.wp[0], F.wp[1], u), bot = lerpV(F.wp[3], F.wp[2], u); return proj(cam, lerpV(top, bot, v));
        };
        ctx.save(); ctx.beginPath(); pp.forEach(q => ctx.lineTo(q.x, q.y)); ctx.closePath(); ctx.clip();
        for (let i = 0; i < N; i++) {
          const u0 = i / N, u1 = (i + 1) / N, TL = P(u0, 0), TR = P(u1, 0), BL = P(u0, 1); if (!TL || !TR || !BL) continue;
          const sx0 = u0 * TW, sw = TW / N;
          const a = (TR.x - TL.x) / sw, b = (TR.y - TL.y) / sw, c = (BL.x - TL.x) / TH, d = (BL.y - TL.y) / TH;
          ctx.setTransform(a * s, b * s, c * s, d * s, (TL.x - a * sx0) * s, (TL.y - b * sx0) * s);
          ctx.drawImage(tex, sx0, 0, sw + 1.5, TH, sx0, 0, sw + 1.5, TH);
        }
        ctx.setTransform(s, 0, 0, s, 0, 0);
        ctx.fillStyle = `rgba(0,0,10,${clamp(0.5 - lit * 0.5)})`; ctx.fillRect(-10, -10, W + 20, H + 20);
        if (F.kind === 'front') {
          // gloss sweep
          const gx = lerp(-300, W + 300, clamp((yaw / DEG + 20) / 120));
          const sg = ctx.createLinearGradient(gx - 260, 0, gx + 260, H * 0.3);
          sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,245,230,0.22)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = sg; ctx.fillRect(-10, -10, W + 20, H + 20);
          const sheen = ctx.createLinearGradient(0, pp[0].y, 0, pp[3].y); sheen.addColorStop(0, 'rgba(255,255,255,0.10)'); sheen.addColorStop(0.3, 'rgba(255,255,255,0)'); ctx.fillStyle = sheen; ctx.fillRect(-10, -10, W + 20, H + 20);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();
      }
    }
  };
}
const worldB = (() => {
  const R = rng(77), berries = [], leaves = [], dust = [];
  [[-1.7, -7.2, -2.9, 0.42], [-0.9, -7.7, -2.2, 0.46], [-2.6, -7.8, -1.8, 0.4], [2.6, -7.3, -2.0, 0.44], [3.4, -6.6, -1.0, 0.38], [1.9, -7.9, -1.4, 0.4], [3.1, -8.0, -2.7, 0.35], [-3.9, -0.6, 0.6, 0.36], [3.9, -1.8, 0.9, 0.34], [-3.5, 3.6, 1.5, 0.4], [3.8, 2.4, 2.0, 0.42]].forEach(b => berries.push({ c: b.slice(0, 3), r: b[3], crown: [R() - 0.5, 0.7, -0.7] }));
  // foreground (lens-near) and deep background
  [[-3.2, -3.9, -5.6, 0.45], [3.6, 1.2, -6.0, 0.55], [-2.9, 4.6, -5.5, 0.5], [2.9, -5.6, -5.0, 0.55]].forEach(b => berries.push({ c: b.slice(0, 3), r: b[3], crown: [0.2, 0.8, -0.6] }));
  for (let i = 0; i < 26; i++) berries.push({ c: [R() * 30 - 15, R() * 22 - 10, 8 + R() * 22], r: 0.4 + R() * 0.3, crown: [0.2, 0.8, -0.6] });
  [[-1.6, -8.2, -2.5, -0.9], [2.4, -8.0, -1.6, 0.6], [-2.6, -8.4, -1.2, -1.6], [3.4, -7.8, -2.4, 0.2]].forEach(([x, y, z, a]) => leaves.push({ pos: [x, y, z], axis: norm([Math.cos(a), 0.5, Math.sin(a) * 0.4]), normal: norm([0.2, 0.6, -0.8]), length: 1.4, width: 0.48, curl: 0.25 }));
  [[-4.2, 0.5, -6.8, 0.5], [4.0, -3.4, -7.0, 2.4], [-3.6, -6, -6.2, -0.4]].forEach(([x, y, z, a]) => leaves.push({ pos: [x, y, z], axis: norm([Math.cos(a), Math.sin(a), 0.2]), normal: norm([0, 0.3, -1]), length: 1.8, width: 0.6, curl: 0.3 }));
  for (let i = 0; i < 60; i++) dust.push({ p: [R() * 24 - 12, R() * 20 - 10, R() * 30 - 6], ph: R() * TAU, warm: R() < 0.5 });
  return { berries, leaves, dust };
})();
const CAM_B = [
  keyLA(13.0, [-4.6, -2.4, -7.6], [0, -0.4, 0], [0, 1, 0], 7),
  keyLA(14.4, [-2.0, -0.7, -9.8], [0, -0.6, 0], [0, 1, 0], 2.5),
  keyLA(15.8, [0.6, 0.15, -11.2], [0, -0.8, 0], [0, 1, 0], 0.5),
  keyLA(17.2, [1.25, 0.4, -11.7], [0, -0.9, 0], [0, 1, 0], 0),
  keyLA(20.0, [1.55, 0.5, -11.95], [0.02, -0.92, 0], [0, 1, 0], 0),
];
function camB(t) {
  const v = spline(CAM_B, t), pos = v.slice(0, 3), tgt = v.slice(3, 6);
  const focus = dot(sub([0, 0, 0], pos), norm(sub(tgt, pos)));
  return makeCam(pos, tgt, v.slice(6, 9), v[9], focus, 0.05);
}
function bgB(ctx, cam, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#05061a'); g.addColorStop(0.5, '#120f3a'); g.addColorStop(1, '#07051a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const mq = proj(cam, add(cam.pos, mul(norm([0.35, 0.55, 1]), 400)));
  if (mq) { const mg = ctx.createRadialGradient(mq.x, mq.y, 0, mq.x, mq.y, 900); mg.addColorStop(0, 'rgba(170,150,255,0.35)'); mg.addColorStop(1, 'rgba(120,100,220,0)'); ctx.fillStyle = mg; ctx.fillRect(0, 0, W, H); }
  const wg = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, 800); wg.addColorStop(0, 'rgba(120,70,180,0.25)'); wg.addColorStop(1, 'rgba(60,30,120,0)'); ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H);
}
function worldBItems(cam, t) {
  const items = [];
  const pk = packageItem(cam, t); if (pk) items.push(pk);
  const light = norm([-0.4, 0.7, -0.6]);
  for (const b of worldB.berries) { const q = proj(cam, b.c); if (!q) continue; items.push({ z: q.z, draw(ctx) { drawBerry(ctx, cam, b.c, b.r, { crown: b.crown, rimColor: 'rgba(200,170,255,.5)' }); } }); }
  for (const L of worldB.leaves) { const it = leafItem(cam, L, light, [[18, 46, 40], [70, 128, 100], [170, 220, 190]]); if (it) items.push(it); }
  // bar half with nougat section facing the camera
  const yaw = -28 * DEG, pitch = 14 * DEG, roll = -8 * DEG;
  const Rb = v => rotY(rotZ(rotX(v, pitch), roll), yaw);
  const piv = [-2.4, -8.6, -2.6];
  const bh = barHalfItem(cam, 0, 3.2, -1, l => add(piv, Rb(mul(l, 0.6))), Rb, true);
  if (bh) { bh.z -= 0.3; items.push(bh); }
  for (const d of worldB.dust) {
    const p = add(d.p, [0.2 * Math.sin(t * 0.7 + d.ph), 0.25 * Math.sin(t * 0.5 + d.ph * 2), 0]);
    const it = glowItem(cam, p, 0.09, d.warm ? [255, 214, 150] : [180, 170, 255], 0.55 + 0.3 * Math.sin(t * 2 + d.ph)); if (it) items.push(it);
  }
  return items;
}
function textS5(ctx, t) {
  if (t < 16.9) return;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const lines = [['Відкуси', 1405, '#f4ecff'], ['чорничну ніч', 1515, '#f4ecff']];
  let wi = 0;
  for (const [txt, y] of lines) {
    const words = txt.split(' ');
    const font = 'italic 700 118px Cormorant';
    ctx.font = font;
    const sp = ctx.measureText(' ').width, ws = words.map(w => ctx.measureText(w).width), tot = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    let x = W / 2 - tot / 2;
    words.forEach((w, k) => {
      const t0 = 17.0 + wi * 0.16, p = easeOutCubic((t - t0) / 0.7);
      ctx.save(); ctx.beginPath(); ctx.rect(0, y - 135, W, 190); ctx.clip();
      ctx.font = font; ctx.fillStyle = w === 'ніч' ? '#c9a3ff' : '#f4ecff';
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 24;
      ctx.globalAlpha = smooth(0, 0.4, p);
      ctx.fillText(w, x + ws[k] / 2, y + (1 - p) * 130);
      ctx.restore();
      if (w === 'ніч') {
        // the period is a small blueberry that drops in on 18.0
        const bx = x + ws[k] + 30, by0 = y - 18; const tt = t - 17.6;
        if (tt > 0) {
          let by;
          if (t < 18) by = by0 - 520 * (1 - (tt / 0.4) ** 2);
          else { const u = t - 18; by = by0 - Math.abs(Math.sin(u * 10)) * 40 * Math.exp(-u * 7); }
          const sq = t >= 18 ? 1 - 0.25 * Math.exp(-(t - 18) * 20) : 1;
          ctx.save(); ctx.translate(bx, by + 14); ctx.scale(1 / sq, sq); drawBerry2D(ctx, 0, -16, 22); ctx.restore();
        }
      }
      x += ws[k] + sp; wi++;
    });
  }
  ctx.restore();
}

// ---------- scene assembly ----------
function renderScene(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  if (t < 13) {
    const cam = camA(t);
    bgA(ctx, cam, t);
    drawGround(ctx, cam, t, (t < 4 ? smooth(-2.6, -7.5, cam.pos[1]) : 1) * (1 - smooth(8.15, 8.7, t)));
    { const hy = horizonY(cam), ga = (t < 4 ? smooth(-2.6, -7.5, cam.pos[1]) : 1) * (1 - smooth(8.15, 8.7, t));
      if (hy != null && ga > 0) { const hg = ctx.createLinearGradient(0, hy - 140, 0, hy + 120); hg.addColorStop(0, 'rgba(58,30,24,0)'); hg.addColorStop(0.55, `rgba(58,30,22,${0.9 * ga})`); hg.addColorStop(1, 'rgba(48,24,14,0)'); ctx.fillStyle = hg; ctx.fillRect(0, hy - 140, W, 260); } }
    const items = [];
    const light = norm([0.55, 0.6, -0.4]);
    if (cam.pos[1] > -9) {
      for (const L of bush.leaves) { const it = leafItem(cam, L, light, [[10, 26, 30], [52, 96, 92], [150, 180, 255]]); if (it) items.push(it); }
      for (const s of bush.stems) { const it = stemItem(cam, s.pts, 0.06, '#251a2c'); if (it) items.push(it); }
      for (const b of bush.berries) { const q = proj(cam, b.c); if (q) items.push({ z: q.z, draw(c) { drawBerry(c, cam, b.c, b.r, { crown: b.crown, lx: 0.38, ly: -0.42 }); } }); }
      for (const f of bush.flies) {
        const p = add(f.p, [0.5 * Math.sin(t * f.w[0] + f.ph), 0.4 * Math.sin(t * f.w[1] + f.ph * 2), 0.5 * Math.cos(t * f.w[2] + f.ph)]);
        const it = glowItem(cam, p, 0.16, [255, 214, 130], f.br * (0.5 + 0.5 * Math.sin(t * 2.5 + f.ph))); if (it) items.push(it);
      }
      // hero pedicel (snaps at 3.0 and recoils)
      const hp = heroPos(t);
      const ped = bush.ped.map((p, i) => {
        if (t < 3) return i === 3 ? add(hp, [0.02, 0.48, 0]) : p;
        const k = (t - 3), rec = Math.exp(-k * 5) * Math.cos(k * 26);
        return add(p, [0, i / 3 * 0.35 * (1 - rec) * (i > 0 ? 1 : 0), 0]);
      });
      const st = stemItem(cam, ped, 0.045, '#2c2034'); if (st) items.push(st);
    }
    // hero berry
    const hp = heroPos(t), hq = proj(cam, hp);
    if (hq && t < 4.45) {
      const surf = proj(cam, [hp[0], SURF_Y, hp[2]]);
      items.push({ z: hq.z, draw(c) { drawBerry(c, cam, hp, HERO_R, { crown: [0.15, 0.95, -0.3], lx: t < 3.6 ? 0.38 : -0.3, ly: -0.42, spec: 0.7, clipY: t > 3.9 && surf ? surf.y : null }); } });
    }
    splashItems(cam, t, items);
    // cocoa dust
    if (cam.pos[1] < -5) { const R = rng(13); for (let i = 0; i < 40; i++) { const p = [R() * 22 - 11, -12 + R() * 7, R() * 26 - 6]; p[1] += 0.3 * Math.sin(t * 0.6 + i); const it = glowItem(cam, p, 0.08, [255, 200, 150], 0.35); if (it) items.push(it); } }
    // bar
    if (t > 7.6) {
      const a = smooth(7.65, 8.25, t), broken = t >= 9;
      const B = halfXf('B', t), A = halfXf('A', t);
      if (!broken) {
        const it = barHalfItem(cam, -4.8, 4.8, 1, B.xf, B.rot, false, a); if (it) items.push(it);
      } else {
        const ib = barHalfItem(cam, 0, 4.8, -1, B.xf, B.rot, true); if (ib) items.push(ib);
        const ia = barHalfItem(cam, -4.8, 0, 1, A.xf, A.rot, true); if (ia) items.push(ia);
      }
      crumbItems(cam, t, items);
    }
    drawDOF(ctx, items, cam);
    textS1(ctx, cam, t); textS2(ctx, t); textS3(ctx, t);
  } else {
    const cam = camB(t);
    bgB(ctx, cam, t);
    drawDOF(ctx, worldBItems(cam, t), cam);
    textS5(ctx, t);
  }
}

// ---------- frame: motion blur, zoom blur, grade ----------
function samplesAt(t) {
  if ((t > 2.95 && t < 4.75) || (t > 8.95 && t < 9.8) || (t > 12.35 && t < 14.8)) return 6;
  return 3;
}
const grain = (() => { const c = mk(512, 512), x = c.getContext('2d'), im = x.createImageData(512, 512), R = rng(1); for (let i = 0; i < im.data.length; i += 4) { const v = 128 + (R() - 0.5) * 70; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); return c; })();
function renderFrame(t, opts = {}) {
  const K = opts.samples ?? samplesAt(t);
  const shutter = (K > 3 ? 0.7 : 0.5) / FPS;
  const [a, b] = t < 13 ? [0, 13 - 1e-4] : [13, DUR];
  for (let i = 0; i < K; i++) {
    const ts = clamp(t + (K > 1 ? (i / (K - 1) - 0.5) * shutter : 0), a, b);
    renderScene(sctx, ts);
    actx.globalAlpha = 1 / (i + 1); actx.drawImage(subc, 0, 0);
  }
  actx.globalAlpha = 1;
  // radial (zoom) blur around the whip cut
  const zb = bump(12.45, 13.0, 13.4, t) * 0.16;
  if (zb > 0.004) {
    tctx.globalAlpha = 1; tctx.drawImage(acc, 0, 0);
    const N = 8;
    for (let i = 1; i < N; i++) {
      const s = 1 + zb * i / N; actx.globalAlpha = 1 / (i + 1);
      actx.drawImage(tmpc, W / 2 - W * s / 2, H * 0.45 - H * s * 0.45, W * s, H * s);
    }
    actx.globalAlpha = 1;
  }
  octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalAlpha = 1; octx.globalCompositeOperation = 'source-over';
  octx.drawImage(acc, 0, 0);
  // vignette + grain
  const vg = octx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  octx.fillStyle = vg; octx.fillRect(0, 0, W, H);
  octx.globalCompositeOperation = 'overlay'; octx.globalAlpha = 0.07;
  const f = Math.round(t * FPS), ox = (f * 173) % 512, oy = (f * 311) % 512;
  octx.fillStyle = octx.createPattern(grain, 'repeat'); octx.translate(-ox, -oy); octx.fillRect(0, 0, W + 512, H + 512);
  octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalAlpha = 1; octx.globalCompositeOperation = 'source-over';
  // fade from/to black at the very ends
  const fade = Math.max(1 - smooth(0, 0.35, t), smooth(19.55, 20, t));
  if (fade > 0) { octx.fillStyle = `rgba(0,0,0,${fade})`; octx.fillRect(0, 0, W, H); }
}

// ---------- boot ----------
window.ready = (async () => {
  await Promise.all(['300 20px Unbounded', '500 20px Unbounded', '800 20px Unbounded', 'italic 500 20px Cormorant', 'italic 700 20px Cormorant'].map(f => document.fonts.load(f, 'ЧОРНИЧНА чорниця ROSHEN Відкуси…')));
  buildPackage();
  if (new URLSearchParams(location.search).has('render')) document.body.classList.add('render');
  renderFrame(0);
  return true;
})();
window.renderFrame = renderFrame;
window.grabFrame = (t, q = 0.95) => { renderFrame(t); return out.toDataURL('image/jpeg', q); };

// interactive preview (real-time; the MP4 is rendered frame-by-frame)
(() => {
  const btn = document.getElementById('play'), sc = document.getElementById('scrub'), tc = document.getElementById('tc');
  let playing = false, t0 = 0, start = 0;
  const show = t => { renderFrame(t, { samples: 1 }); sc.value = t; tc.textContent = t.toFixed(2); };
  sc.addEventListener('input', () => { playing = false; btn.textContent = '▶︎ Відтворити'; show(+sc.value); });
  btn.addEventListener('click', () => { playing = !playing; btn.textContent = playing ? '❚❚ Пауза' : '▶︎ Відтворити'; start = performance.now(); t0 = +sc.value >= DUR - 0.05 ? 0 : +sc.value; if (playing) requestAnimationFrame(loop); });
  function loop(now) { if (!playing) return; const t = t0 + (now - start) / 1000; if (t >= DUR) { playing = false; btn.textContent = '▶︎ Відтворити'; show(DUR - 1 / FPS); return; } show(t); requestAnimationFrame(loop); }
})();
