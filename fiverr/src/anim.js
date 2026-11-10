// Fiverr gig video — Logo Design by Viktoriia Kitsak
const W = 1920, H = 1080, FPS = 60, DUR = 38;
const LIME = '#C8FF2E', INK = '#14210A';
const cv = document.getElementById('c'), out = cv.getContext('2d');
const mk = () => { const b = document.createElement('canvas'); b.width = W; b.height = H; return [b, b.getContext('2d')]; };
const [frame, F] = mk(), [bufA, A] = mk(), [bufB, B] = mk(), [lbuf, L] = mk();
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutBack = (t, s = 2.2) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
const easeOutExpo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t));
const easeInExpo = t => t <= 0 ? 0 : Math.pow(2, 10 * clamp(t) - 10);
const easeInOutCubic = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeInOutQuint = t => { t = clamp(t); return t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2; };
const easeOutCubic = t => 1 - Math.pow(1 - clamp(t), 3);
const spring = (t, f = 9, d = 6) => t < 0 ? 0 : Math.exp(-d * t) * Math.sin(f * t);
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------- assets ----------
const NAMES = ['nova', 'adora', 'floris', 'asani', 'aura'];
const IMG = {}; let META = null;
function load(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; }); }
async function loadAll() {
  META = await (await fetch('assets/logos.json')).json();
  for (const n of NAMES) {
    IMG[n + '_bg'] = await load(`assets/${n}_bg.png`);
    IMG[n] = []; for (let i = 0; i < META[n].comps.length; i++) IMG[n].push(await load(`assets/${n}_c${i}.png`));
  }
}
// logo placement: S = screen px per 4x-logo px; origin = top-left of logo bbox on screen
const TARGET = { nova: { w: 860 }, adora: { h: 640 }, floris: { w: 860 }, asani: { w: 860 }, aura: { w: 860 } };
function place(n) { const b = META[n].bbox, bw = (b[2] - b[0]) * 4, bh = (b[3] - b[1]) * 4; const tg = TARGET[n];
  const S = tg.w ? tg.w / bw : tg.h / bh; return { S, bw, bh, ox: W / 2 - bw * S / 2, oy: H / 2 - bh * S / 2 }; }
// draw component i of logo n. o: {tx,ty (4x px), rot, sx, sy, ax, ay (anchor 0..1), alpha, clip(fn(ctx,c))}
function comp(ctx, n, i, o = {}) {
  const c = META[n].comps[i], img = IMG[n][i]; const ax = o.ax ?? 0.5, ay = o.ay ?? 0.5;
  ctx.save(); ctx.globalAlpha *= (o.alpha ?? 1);
  ctx.translate(c.x + ax * c.w + (o.tx || 0), c.y + ay * c.h + (o.ty || 0));
  if (o.rot) ctx.rotate(o.rot); ctx.scale(o.sx ?? 1, o.sy ?? 1);
  ctx.translate(-ax * c.w, -ay * c.h);
  if (o.clip) { ctx.beginPath(); o.clip(ctx, c); ctx.clip(); }
  ctx.drawImage(img, 0, 0); ctx.restore();
}
function withLogo(ctx, n, cam, fn) { const p = place(n); ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(cam.rot || 0); ctx.scale(cam.s || 1, cam.s || 1);
  ctx.translate(-W / 2 + (cam.x || 0), -H / 2 + (cam.y || 0)); ctx.translate(p.ox, p.oy); ctx.scale(p.S, p.S); fn(p); ctx.restore(); }

// background photo covering frame. cam: {s, x, y, rot, blur, dark}
function bg(ctx, n, cam) {
  const img = IMG[n + '_bg']; const base = Math.max(W / img.width, H / img.height);
  ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (cam.blur > 0.3) ctx.filter = `blur(${cam.blur.toFixed(1)}px)`;
  ctx.translate(W / 2 + (cam.x || 0), H / 2 + (cam.y || 0)); ctx.rotate(cam.rot || 0); const s = base * (cam.s || 1.1); ctx.scale(s, s);
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, -img.width / 2, -img.height / 2); ctx.restore();
  if (cam.dark) { ctx.fillStyle = `rgba(0,0,0,${cam.dark})`; ctx.fillRect(0, 0, W, H); }
}
// soft bokeh / dust sprites
const sprites = {};
function sprite(color, hard = 0.0) { const k = color + hard; if (sprites[k]) return sprites[k]; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, color); g.addColorStop(hard, color); g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return sprites[k] = c; }
function particles(ctx, u, seed, n, color, rMin, rMax, vx, vy, parallax, cam, hard = 0) {
  const r = rng(seed); const sp = sprite(color, hard);
  for (let i = 0; i < n; i++) { const x0 = r() * (W + 400) - 200, y0 = r() * (H + 400) - 200, rad = lerp(rMin, rMax, r() ** 2), ph = r() * 6.28, sp2 = 0.6 + r() * 0.8;
    let x = x0 + vx * u * sp2 + Math.sin(u * 0.7 + ph) * 20 + (cam.x || 0) * parallax, y = y0 + vy * u * sp2 + Math.cos(u * 0.5 + ph) * 16 + (cam.y || 0) * parallax;
    x = ((x + 200) % (W + 400) + W + 400) % (W + 400) - 200; y = ((y + 200) % (H + 400) + H + 400) % (H + 400) - 200;
    ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(u * 1.3 + ph)); ctx.drawImage(sp, x - rad, y - rad, rad * 2, rad * 2); }
  ctx.globalAlpha = 1;
}
// sheen across logo: draw fn into L, add gradient band with source-atop, composite
function sheen(ctx, drawFn, k, angle = -0.5, color = 'rgba(255,255,255,0.75)') {
  L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, W, H); drawFn(L);
  if (k > 0 && k < 1) { L.save(); L.globalCompositeOperation = 'source-atop'; L.translate(W / 2, H / 2); L.rotate(angle);
    const x = lerp(-1300, 1300, k); const g = L.createLinearGradient(x - 160, 0, x + 160, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, color); g.addColorStop(1, 'rgba(255,255,255,0)');
    L.fillStyle = g; L.fillRect(-2000, -2000, 4000, 4000); L.restore(); }
  ctx.drawImage(lbuf, 0, 0);
}
// film grain
const grain = []; for (let i = 0; i < 6; i++) { const c = document.createElement('canvas'); c.width = 640; c.height = 360; const x = c.getContext('2d'); const d = x.createImageData(640, 360); const r = rng(70 + i);
  for (let p = 0; p < d.data.length; p += 4) { const v = r() * 255; d.data[p] = d.data[p + 1] = d.data[p + 2] = v; d.data[p + 3] = 12; } x.putImageData(d, 0, 0); grain.push(c); }
function vignette(ctx, a = 0.45) { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }

// ---------- Ki mark ----------
const KI_LOGO = new Path2D('M169 320H323V486L463 320H640L479 512L554 601L681 451H854L640 704H461L398 626C384 609 372 600 356 600C337 600 323 615 323 638V704H169Z');
const KI_STEM = new Path2D('M169 320H323V704H169Z');
const KI_ARM = new Path2D('M323 486L463 320H640L479 512L554 601L468 704H461L398 626C384 609 372 600 356 600C337 600 323 615 323 638Z');
const KI_BAND = new Path2D('M681 451H854L640 704H468Z');
function kiDot(ctx, x, yb, sq = 0, st = 0, r = 65) { ctx.save(); ctx.translate(x, yb); if (sq > 0) ctx.scale(1 + sq * 0.45, 1 - sq * 0.4); else if (st > 0) ctx.scale(1 / (1 + st), 1 + st); ctx.beginPath(); ctx.arc(0, -r, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
function squash(u, tc, k = 1) { const d = u - tc; return d >= 0 && d < 0.14 ? k * Math.sin(d / 0.14 * Math.PI) * Math.exp(-d * 6) : 0; }

// ================= SCENES =================
// --- 0 · Intro (0–3.5) ---
function sIntro(ctx, u) {
  ctx.fillStyle = LIME; ctx.fillRect(0, 0, W, H); ctx.fillStyle = INK;
  const K = 0.62, logoW = 685 * K; ctx.font = '800 150px "Inter Display"'; const tw = ctx.measureText('Design').width;
  const total = logoW + 80 + tw; const left = W / 2 - total / 2, top = H / 2 - 384 * K / 2 - 20;
  const exit = easeInExpo((u - 2.75) / 0.4);
  // logo body
  const land = 0.5; const st = u < land ? 0 : easeOutBack((u - land) / 0.35, 2.6);
  const jel = spring(u - land, 16, 6);
  ctx.save(); ctx.translate(left - 169 * K, top - 320 * K); ctx.scale(K, K);
  ctx.translate(511, 704); ctx.scale(st * (1 + jel * 0.06) * (1 - exit), st * (1 - jel * 0.08) * (1 - exit)); ctx.translate(-511, -704);
  if (st > 0) { ctx.fill(KI_STEM); ctx.fill(KI_ARM); ctx.fill(KI_BAND); }
  ctx.restore();
  // the dot: falls, lands on band, later hops out and drops off-frame
  ctx.save(); ctx.translate(left - 169 * K, top - 320 * K); ctx.scale(K, K);
  let dy, dx = 769, sq = squash(u, land, 1) + squash(u, 1.0, 0.4), stt = 0;
  if (u < land) { const v = u / land; dy = lerp(-700, 451, v * v); stt = 0.3 * v; }
  else if (u < 1.0) { const v = (u - land) / 0.5; dy = 451 - 120 * 4 * v * (1 - v); }
  else if (u < 2.75) dy = 451;
  else { const v = (u - 2.75) / 0.5; dy = 451 - 260 * 4 * v * (1 - v) + (v > 0.5 ? (v - 0.5) ** 2 * 3000 : 0); dx = lerp(769, 520, v); stt = v > 0.5 ? 0.3 : 0; }
  const ant = 2.75 - u; if (ant > 0 && ant < 0.2) sq = -Math.sin((1 - ant / 0.2) * Math.PI / 2) * 0.3;
  if (sq < 0) { ctx.save(); ctx.translate(dx, dy); ctx.scale(1 - sq * 0.45, 1 + sq * 0.5); ctx.beginPath(); ctx.arc(0, -65, 65, 0, 7); ctx.fill(); ctx.restore(); }
  else kiDot(ctx, dx, dy, sq, stt);
  ctx.restore();
  // text: "Logo" / "Design" rise from masks, then "by Viktoriia Kitsak"
  const tx = left + logoW + 80; const lines = [['Logo', 0.85, top + 128], ['Design', 1.05, top + 268]];
  for (const [w, t0, y] of lines) { const v = easeOutBack((u - t0) / 0.45, 1.6); if (u < t0) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(tx - 20, y - 150, 900, 175); ctx.clip(); ctx.font = '800 150px "Inter Display"';
    ctx.fillText(w, tx, y + (1 - v) * 170 + exit * 200); ctx.restore(); }
  const bv = clamp((u - 1.5) / 0.5); if (bv > 0) { ctx.save(); ctx.globalAlpha = sstep(0, 0.6, bv) * (1 - exit); ctx.font = '500 40px "Inter Display"';
    const tr = lerp(18, 2, easeOutExpo(bv)); let x = tx; for (const ch of 'by Viktoriia Kitsak') { ctx.fillText(ch, x, top + 340); x += ctx.measureText(ch).width + tr; } ctx.restore(); }
}
// powder burst transition (dot impact) — returns coverage
const burst = []; { const r = rng(9); for (let i = 0; i < 700; i++) { const a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.9, sp = 300 + r() ** 0.7 * 1900; const big = i < 120; burst.push({ a, sp, r: big ? 90 + r() * 160 : 8 + r() ** 2 * 50, hard: big ? 0.15 : 0.5, c: ['rgba(96,128,44,1)', 'rgba(118,150,58,1)', 'rgba(78,104,36,1)', 'rgba(150,180,90,1)', 'rgba(70,95,30,1)'][i % 5], d: r() * 0.1, g: 300 + r() * 900 }); } }
function powder(ctx, u, x0, y0) { // u from impact
  for (const p of burst) { const v = clamp((u - p.d) / 0.55); if (v <= 0) continue; const e = easeOutExpo(v);
    const x = x0 + Math.cos(p.a) * p.sp * e, y = y0 + Math.sin(p.a) * p.sp * e * 0.8 + p.g * (u - p.d) ** 2; const fade = 1 - sstep(0.45, 1.0, (u - 0.2) / 0.6);
    const rad = p.r * (0.4 + 1.4 * e) * (0.3 + 0.7 * fade); ctx.globalAlpha = fade; ctx.drawImage(sprite(p.c, p.hard), x - rad, y - rad, rad * 2, rad * 2); }
  ctx.globalAlpha = 1;
}

// --- 1 · NOVA (3.5–9) ---
function sNova(ctx, u) {
  const cam = { s: lerp(1.28, 1.12, easeOutCubic(u / 5.5)), x: lerp(40, -40, u / 5.5), y: lerp(-20, 10, u / 5.5), rot: lerp(0.035, 0, easeOutCubic(u / 5)), blur: lerp(5, 0, sstep(0, 1.1, u)), dark: 0.18 };
  bg(ctx, 'nova', cam); vignette(ctx, 0.5);
  particles(ctx, u, 3, 26, 'rgba(160,190,90,0.5)', 2, 7, 18, -10, 0.2, cam);
  const lc = { s: lerp(0.94, 1.0, easeOutCubic(u / 4)), x: cam.x * 0.3, y: cam.y * 0.3, rot: cam.rot * 0.3 };
  // order by x: N(1) O(2) leafO(4) V(0) A(3) leafA(5)
  const letters = [[1, 0.5], [2, 0.75], [0, 1.0], [3, 1.25]];
  sheen(ctx, Lc => withLogo(Lc, 'nova', lc, () => {
    for (const [i, t0] of letters) { const v = clamp((u - t0) / 0.5); if (v <= 0) continue; const e = easeOutBack(v, 1.8); const c = META.nova.comps[i];
      comp(Lc, 'nova', i, { ty: (1 - e) * (c.h + 40), sy: 1 + spring(u - t0 - 0.35, 18, 7) * 0.08, ay: 1, clip: (x, cc) => x.rect(-50, -400, cc.w + 100, cc.h + 400) }); }
    for (const [i, t0] of [[4, 1.75], [5, 2.0]]) { const v = clamp((u - t0) / 0.5); if (v <= 0) continue; const e = easeOutBack(v, 2.6);
      comp(Lc, 'nova', i, { ax: 0.5, ay: 1, sx: e, sy: e, rot: (1 - e) * -0.7 + Math.sin((u - t0) * 2.4 + i) * 0.09 * sstep(0.6, 1.4, u - t0) }); }
  }), u < 4.0 ? clamp((u - 2.4) / 0.9) : clamp((u - 4.2) / 0.9), -0.4, 'rgba(255,255,255,0.55)');
  // powder puffs at each letter base
  withLogo(ctx, 'nova', lc, () => { for (const [i, t0] of letters) { const d = u - t0 - 0.3; if (d < 0 || d > 0.8) continue; const c = META.nova.comps[i]; const r = rng(i * 13 + 1);
    for (let k = 0; k < 16; k++) { const a = Math.PI + r() * Math.PI, sp = 120 + r() * 260, e = easeOutExpo(d / 0.8); const rad = (14 + r() * 26) * (0.5 + e);
      ctx.globalAlpha = (1 - d / 0.8) * 0.7; ctx.drawImage(sprite('rgba(190,214,130,0.9)'), c.x + c.w / 2 + Math.cos(a) * sp * e - rad, c.y + c.h + Math.sin(a) * sp * e * 0.4 - rad, rad * 2, rad * 2); } }
    ctx.globalAlpha = 1; });
  particles(ctx, u, 4, 9, 'rgba(170,200,100,0.35)', 18, 46, 40, -12, 1.4, cam);
}
// --- 2 · ADORA (9–14.5) ---
function sAdora(ctx, u, zoomOut = 0) {
  const cam = { s: lerp(1.12, 1.24, u / 5.5), x: lerp(-30, 30, u / 5.5), rot: lerp(-0.03, 0.02, u / 5.5), blur: lerp(4, 1.2, sstep(0, 1.4, u)), dark: 0.22 };
  bg(ctx, 'adora', cam); vignette(ctx, 0.5);
  particles(ctx, u, 5, 16, 'rgba(240,226,200,0.45)', 3, 9, -12, -6, 0.3, cam);
  const lc = { s: lerp(0.95, 1.0, easeOutCubic(u / 4)) * (1 + zoomOut), x: cam.x * 0.25, rot: 0 };
  const sym = 0, letters = [[1, 1.7], [2, 1.78], [3, 1.86], [7, 1.94], [4, 1.94], [5, 2.02], [6, 2.1]];
  const c0 = META.adora.comps[sym]; const cx = c0.x + c0.w / 2, cy = c0.y + c0.h / 2;
  const spin = lerp(-0.45, 0, easeOutCubic((u - 0.3) / 1.6)) + zoomOut * 1.6 + 0.035 * Math.max(0, u - 1.9);
  sheen(ctx, Lc => withLogo(Lc, 'adora', lc, () => {
    const rv = easeInOutCubic((u - 0.3) / 1.3);
    if (rv > 0) comp(Lc, 'adora', sym, { rot: spin, sx: lerp(0.88, 1, easeOutCubic(rv)), sy: lerp(0.88, 1, easeOutCubic(rv)), clip: (x, c) => { x.moveTo(c.w / 2, c.h / 2); x.arc(c.w / 2, c.h / 2, c.w, -Math.PI / 2 - spin, -Math.PI / 2 - spin + Math.PI * 2 * rv); x.closePath(); } });
    const midX = 602;
    for (const [i, t0] of letters) { const v = clamp((u - t0) / 0.7); if (v <= 0) continue; const c = META.adora.comps[i]; const e = easeOutExpo(v);
      const spread = (c.x + c.w / 2 - midX) * 0.45 * (1 - e);
      comp(Lc, 'adora', i, { tx: spread, ty: (1 - e) * 40, alpha: sstep(0, 0.7, v), rot: i === 7 ? (1 - e) * Math.PI : 0 }); }
  }), clamp((u - 2.8) / 1.0), -0.9, 'rgba(255,250,235,0.6)');
  // star flares on the symbol's four stars + centre
  withLogo(ctx, 'adora', lc, () => { const R = c0.w * 0.335; const pts = [[0, -R], [R, 0], [0, R], [-R, 0], [0, 0]];
    pts.forEach(([px, py], k) => { const t1 = 1.55 + k * 0.12 + (k === 4 ? 0.1 : 0), t2 = 3.6 + [0, 2, 1, 3, 4][k] * 0.14; const t0 = u < t2 ? t1 : t2; const d = u - t0; if (d < 0 || d > 0.7) return; const a = Math.sin(clamp(d / 0.7) * Math.PI);
      const rx = Math.cos(spin) * px - Math.sin(spin) * py + cx, ry = Math.sin(spin) * px + Math.cos(spin) * py + cy;
      ctx.save(); ctx.translate(rx, ry); ctx.rotate(d * 1.5); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(255,248,230,1)'; const L1 = 150 * a, w = 7;
      ctx.beginPath(); ctx.moveTo(0, -L1); ctx.lineTo(w, 0); ctx.lineTo(0, L1); ctx.lineTo(-w, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-L1, 0); ctx.lineTo(0, w); ctx.lineTo(L1, 0); ctx.lineTo(0, -w); ctx.closePath(); ctx.fill();
      ctx.drawImage(sprite('rgba(255,245,220,0.9)'), -50 * a, -50 * a, 100 * a, 100 * a); ctx.restore(); }); });
  particles(ctx, u, 6, 7, 'rgba(250,240,215,0.28)', 30, 70, -30, -10, 1.5, cam);
}
// --- 3 · FLORIS (14.5–20) ---
function sFloris(ctx, u, zoomIn = 0) {
  const cam = { s: lerp(1.2, 1.1, easeOutCubic(u / 5.5)) * (1 + zoomIn * 1.5), x: lerp(60, -60, u / 5.5), y: 0, rot: lerp(0.02, -0.015, u / 5.5), blur: lerp(4, 0, sstep(0, 1.0, u)) + zoomIn * 6, dark: 0.15 };
  bg(ctx, 'floris', cam); vignette(ctx, 0.55);
  particles(ctx, u, 7, 8, 'rgba(220,90,110,0.18)', 60, 140, 30, 4, 0.5, cam);
  const lc = { s: (1 + zoomIn * 2.2) * lerp(0.95, 1, easeOutCubic(u / 4)), x: cam.x * 0.25 };
  // comps: F(0), bar L..R(1), O(2), S(3)
  sheen(ctx, Lc => withLogo(Lc, 'floris', lc, () => {
    const bw = easeInOutCubic((u - 0.35) / 0.9); if (bw > 0) comp(Lc, 'floris', 1, { clip: (x, c) => x.rect(-10, -10, (c.w + 20) * bw, c.h + 20) });
    const fv = clamp((u - 0.55) / 0.55); if (fv > 0) comp(Lc, 'floris', 0, { tx: (1 - easeOutBack(fv, 1.5)) * -500, alpha: sstep(0, 0.3, fv) });
    const sv = clamp((u - 1.0) / 0.55); if (sv > 0) comp(Lc, 'floris', 3, { tx: (1 - easeOutBack(sv, 1.5)) * 500, alpha: sstep(0, 0.3, sv) });
    const ov = clamp((u - 1.25) / 0.4); if (ov > 0) { const c = META.floris.comps[2]; const hv = clamp((u - 3.5) / 0.4); const y = -(1 - ov * ov) * 520 - 90 * 4 * hv * (1 - hv); const sq = squash(u, 1.65, 1) + squash(u, 3.9, 0.6);
      comp(Lc, 'floris', 2, { ty: y, ay: 1, sx: 1 + sq * 0.12, sy: 1 - sq * 0.15, alpha: sstep(0, 0.2, ov) }); }
  }), u < 4.0 ? clamp((u - 2.1) / 1.1) : clamp((u - 4.1) / 1.0), -0.25, 'rgba(255,225,230,0.7)');
  particles(ctx, u, 8, 6, 'rgba(255,170,180,0.16)', 80, 170, 60, -8, 1.6, cam);
}
// --- 4 · ASANI (20–25.5) ---
function sAsani(ctx, u, sink = 0) {
  const cam = { s: lerp(1.16, 1.08, easeOutCubic(u / 5.5)), x: 0, y: lerp(-50, 30, easeInOutCubic(u / 5.5)), rot: 0, blur: lerp(4, 0.5, sstep(0, 1.2, u)), dark: 0.25 + sink * 0.75 };
  bg(ctx, 'asani', cam); vignette(ctx, 0.55);
  particles(ctx, u, 9, 18, 'rgba(230,235,240,0.35)', 2, 5, 0, 30, 0.3, cam);
  const lc = { s: lerp(0.95, 1, easeOutCubic(u / 4)), y: cam.y * 0.3 + sink * 260 };
  const main = META.asani.comps[0];
  withLogo(ctx, 'asani', lc, () => {
    ctx.globalAlpha = 1 - sink;
    // liquid fill: clip below a wavy surface rising from bottom to top
    const lv = easeInOutCubic((u - 0.35) / 1.5);
    if (lv > 0) comp(ctx, 'asani', 0, { clip: (x, c) => { const top = lerp(c.h + 30, -60, lv); const amp = 26 * (1 - lv) + 4; x.moveTo(-20, c.h + 40);
      for (let px = -20; px <= c.w + 20; px += 20) x.lineTo(px, top + Math.sin(px / 90 + u * 7) * amp + Math.sin(px / 37 - u * 5) * amp * 0.4); x.lineTo(c.w + 20, c.h + 40); x.closePath(); } });
    // falling i with splash
    const iv = clamp((u - 1.9) / 0.35); if (iv > 0) { const hv = clamp((u - 3.75) / 0.5); const sq = squash(u, 2.25, 1) + squash(u, 4.25, 0.7); comp(ctx, 'asani', 1, { ty: -(1 - iv * iv) * 700 - 160 * 4 * hv * (1 - hv), ay: 1, sx: 1 + sq * 0.25, sy: 1 - sq * 0.25 + (iv < 1 ? 0.2 * iv : 0) }); }
    // ripples & droplets at the landing spot (base of i)
    const ic = META.asani.comps[1]; const bx = ic.x + ic.w / 2, by = ic.y + ic.h;
    for (let k = 0; k < 6; k++) { const d = u - (k < 3 ? 2.25 : 4.25) - (k % 3) * 0.18; if (d < 0 || d > 1.4) continue; const e = easeOutCubic(d / 1.4);
      ctx.save(); ctx.globalAlpha = (1 - e) * 0.7 * (1 - sink); ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 * (1 - e) + 1; ctx.beginPath(); ctx.ellipse(bx, by + 30, 40 + e * 420, (40 + e * 420) * 0.22, 0, 0, 7); ctx.stroke(); ctx.restore(); }
    const r = rng(17); for (let k = 0; k < 12; k++) { const d = u - 2.25; if (d < 0 || d > 0.6) break; const a = -Math.PI / 2 + (r() - 0.5) * 2.2, sp = 260 + r() * 420;
      const x = bx + Math.cos(a) * sp * d, y = by + Math.sin(a) * sp * d + 1800 * d * d; ctx.fillStyle = '#fff'; ctx.globalAlpha = 1 - d / 0.6; ctx.beginPath(); ctx.arc(x, y, 9 + r() * 8, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
  });
  particles(ctx, u, 10, 6, 'rgba(240,245,250,0.18)', 40, 90, 0, 60, 1.5, cam);
}
// --- 5 · AURA (25.5–31) ---
function sAura(ctx, u, bite = 0) {
  const light = sstep(0.6, 1.0, u);
  const cam = { s: lerp(1.2, 1.1, easeOutCubic(u / 5.5)), x: lerp(-40, 40, u / 5.5), rot: lerp(-0.02, 0.01, u / 5.5), blur: lerp(6, 1.0, sstep(0.6, 1.6, u)), dark: 0.2 + 0.8 * (1 - light) };
  bg(ctx, 'aura', cam); vignette(ctx, 0.6);
  particles(ctx, u, 11, 10, 'rgba(255,150,60,0.35)', 6, 16, 10, -14, 0.3, cam);
  const lc = { s: lerp(0.95, 1.0, easeOutCubic(u / 4)) * (1 + spring(u - 3.2, 16, 6) * 0.03), x: cam.x * 0.25 };
  // comps: A1(0) U(1) R(2) A2(3) eye2(4) eye1(5) teeth 6..10
  const blink = t0 => { const d = u - t0; return d > 0 && d < 0.22 ? 1 - 0.9 * Math.sin(d / 0.22 * Math.PI) : 1; };
  const eyeS = blink(0.5) * blink(2.6) * blink(4.3);
  const chomp = spring(u - 3.2, 18, 6);
  withLogo(ctx, 'aura', lc, () => {
    const letters = [[0, 0.75], [1, 0.9], [2, 1.05], [3, 1.2]];
    for (const [i, t0] of letters) { const v = clamp((u - t0) / 0.38); if (v <= 0) continue; const c = META.aura.comps[i];
      const y = -(1 - v * v) * 600 * (v < 1 ? 1 : 0); const sq = squash(u, t0 + 0.38, 1);
      comp(ctx, 'aura', i, { ty: y, ay: 1, sx: 1 + sq * 0.18 + chomp * 0.04, sy: 1 - sq * 0.2 - chomp * 0.05, alpha: sstep(0, 0.15, v) }); }
    // teeth pop one by one (hang from the top of the mouth)
    [6, 8, 10, 9, 7].sort((a, b) => META.aura.comps[a].x - META.aura.comps[b].x).forEach((i, k) => { const v = clamp((u - 1.5 - k * 0.07) / 0.3); if (v <= 0) return;
      comp(ctx, 'aura', i, { ay: 0, sy: easeOutBack(v, 3) * (1 - chomp * 0.25), sx: 1 + chomp * 0.05 }); });
    for (const [i, t0] of [[5, 0.1], [4, 0.2]]) { const v = clamp((u - t0) / 0.25); if (v <= 0) continue; comp(ctx, 'aura', i, { sx: easeOutBack(v, 3), sy: easeOutBack(v, 3) * eyeS, ty: 0 }); }
  });
  particles(ctx, u, 12, 6, 'rgba(255,120,50,0.2)', 50, 110, 30, -10, 1.6, cam);
}
// --- 6 · Reel of works (31–33.75) ---
function tile(ctx, n, x, y, w, h, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 26); ctx.clip();
  const img = IMG[n + '_bg']; const s = Math.max(w / img.width, h / img.height) * 1.05; ctx.drawImage(img, -img.width * s / 2, -img.height * s / 2, img.width * s, img.height * s);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(-w / 2, -h / 2, w, h);
  const p = place(n); const k = (n === 'adora' ? 0.72 : 0.62) * w / W * (W / (p.bw * p.S)) * (n === 'adora' ? 0.45 : 1);
  ctx.scale(k * p.S, k * p.S); ctx.translate(-p.bw / 2, -p.bh / 2); META[n].comps.forEach((c, i) => ctx.drawImage(IMG[n][i], c.x, c.y));
  ctx.restore();
}
function sReel(ctx, u) {
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
  const w = 600, h = 380, gap = 50; const stack = easeInOutQuint((u - 2.0) / 0.45);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.1 * (1 - stack));
  const scroll = lerp(700, -700, easeInOutCubic(u / 2.1));
  NAMES.forEach((n, i) => { const v = easeOutBack((u - i * 0.07) / 0.5, 1.6); const x0 = (i - 2) * (w + gap) + scroll, y0 = (1 - v) * 700 + (i % 2 ? 40 : -40);
    const x = lerp(x0, (i - 2) * 14, stack), y = lerp(y0, (i - 2) * -10, stack); tile(ctx, n, x, y, w, h, lerp((i - 2) * 0.03, (i - 2) * 0.04, stack)); });
  ctx.restore();
  // top card becomes lime and fills the frame
  const g = easeInOutQuint((u - 2.35) / 0.4); if (g > 0) { ctx.save(); ctx.translate(W / 2, H / 2); const sw = lerp(w, W + 40, g), sh = lerp(h, H + 40, g);
    ctx.fillStyle = LIME; ctx.globalAlpha = sstep(0, 0.15, g); ctx.beginPath(); ctx.roundRect(-sw / 2, -sh / 2, sw, sh, lerp(26, 0, g)); ctx.fill(); ctx.restore(); }
}
// --- 7 · Outro (33.75–38) ---
function sOutro(ctx, u) {
  ctx.fillStyle = LIME; ctx.fillRect(0, 0, W, H); ctx.fillStyle = INK;
  const K = 0.6; ctx.font = '800 104px "Inter Display"'; const nameW = Math.max(ctx.measureText('Viktoriia').width, ctx.measureText('Kitsak').width);
  const logoW = 685 * K, total = logoW + 70 + nameW, left = W / 2 - total / 2, top = 300; const drift = 1 + 0.012 * u;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(drift, drift); ctx.translate(-W / 2, -H / 2);
  ctx.save(); ctx.translate(left - 169 * K, top - 320 * K); ctx.scale(K, K);
  for (const [path, t0] of [[KI_STEM, 0.05], [KI_ARM, 0.2], [KI_BAND, 0.35]]) { const v = clamp((u - t0) / 0.35); if (v <= 0) continue; const e = easeOutBack(v, 2.2);
    ctx.save(); ctx.translate(511, 704); ctx.scale(1, e); ctx.translate(-511, -704); ctx.fill(path); ctx.lineWidth = 2; ctx.stroke(path); ctx.restore(); }
  { let dy; const v = clamp((u - 0.45) / 0.3); if (u > 0.45) { dy = u < 0.75 ? lerp(-500, 451, v * v) : (u < 1.05 ? 451 - 90 * 4 * ((u - 0.75) / 0.3) * (1 - (u - 0.75) / 0.3) : 451);
      kiDot(ctx, 769, dy, squash(u, 0.75, 1) + squash(u, 1.05, 0.4), u < 0.75 ? 0.25 : 0); } }
  ctx.restore();
  const tx = left + logoW + 70; ctx.font = '800 104px "Inter Display"';
  [['Viktoriia', top + 92], ['Kitsak', top + 202]].forEach(([word, y], li) => { let x = tx; [...word].forEach((ch, j) => { const t0 = 0.6 + li * 0.12 + j * 0.035; const v = clamp((u - t0) / 0.45);
    const w = ctx.measureText(ch).width; if (v > 0) { ctx.save(); ctx.beginPath(); ctx.rect(x - 10, y - 110, w + 40, 140); ctx.clip(); ctx.fillText(ch, x, y + (1 - easeOutBack(v, 2.2)) * 120); ctx.restore(); } x += w; }); });
  const lv = clamp((u - 1.25) / 0.5); if (lv > 0) { ctx.save(); ctx.globalAlpha = sstep(0, 0.5, lv); ctx.font = '500 40px "Inter Display"'; const tr = lerp(16, 3, easeOutExpo(lv));
    let x = tx; for (const ch of 'Logo Design  ·  Graphic Design  ·  3D') { ctx.fillText(ch, x, top + 268); x += ctx.measureText(ch).width + tr; } ctx.restore(); }
  // CTA pill
  const cv2 = clamp((u - 1.6) / 0.5); if (cv2 > 0) { const e = easeOutBack(cv2, 2.4); const label = "Let's create your logo"; ctx.font = '700 52px "Inter Display"'; const lw = ctx.measureText(label).width;
    const pw = lw + 200, ph = 112, px = W / 2, py = top + 450; const nudge = [2.0, 2.5, 3.0, 3.5].reduce((a, t0) => a + spring(u - t0, 18, 7) * 14, 0);
    ctx.save(); ctx.translate(px, py); ctx.scale(e, e); ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = LIME; ctx.fillText(label, -pw / 2 + 56, 18); ctx.save(); ctx.translate(pw / 2 - 86 + nudge, 0); ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = LIME;
    ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(22, 0); ctx.moveTo(6, -16); ctx.lineTo(22, 0); ctx.lineTo(6, 16); ctx.stroke(); ctx.restore(); ctx.restore(); }
  ctx.restore();
}

// ================= TIMELINE & TRANSITIONS =================
const SC = { intro: [0, 3.5], nova: [3.5, 9], adora: [9, 14.5], floris: [14.5, 20], asani: [20, 25.5], aura: [25.5, 31], reel: [31, 33.75], outro: [33.75, 38] };
function drawFrame(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
  // T0: intro -> NOVA with powder burst at dot impact (3.25)
  if (t < 3.25) { sIntro(ctx, t); return; }
  if (t < 4.2) { sNova(ctx, t - 3.5); powder(ctx, t - 3.25, W / 2 - 60, H * 0.62); grainV(ctx, t); return; }
  // T1: whip-pan NOVA -> ADORA (8.8–9.2)
  if (t < 8.8) { sNova(ctx, t - 3.5); grainV(ctx, t); return; }
  if (t < 9.2) { const k = easeInOutQuint((t - 8.8) / 0.4); A.setTransform(1, 0, 0, 1, 0, 0); sNova(A, t - 3.5); B.setTransform(1, 0, 0, 1, 0, 0); sAdora(B, t - 9);
    ctx.drawImage(bufA, -k * W, 0); ctx.drawImage(bufB, W - k * W, 0); grainV(ctx, t); return; }
  // T2: zoom-through ADORA -> FLORIS (14.2–14.7)
  if (t < 14.2) { sAdora(ctx, t - 9); grainV(ctx, t); return; }
  if (t < 14.7) { const k = (t - 14.2) / 0.5; const zin = easeInExpo(clamp(k / 0.55)); const zout = 1 - easeOutExpo(clamp((k - 0.4) / 0.6));
    A.setTransform(1, 0, 0, 1, 0, 0); sAdora(A, t - 9, zin * 4); B.setTransform(1, 0, 0, 1, 0, 0); sFloris(B, t - 14.5, zout);
    ctx.drawImage(bufA, 0, 0); ctx.globalAlpha = sstep(0.38, 0.6, k); ctx.drawImage(bufB, 0, 0); ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(255,250,240,${Math.sin(clamp((k - 0.3) / 0.35) * Math.PI) * 0.5})`; ctx.fillRect(0, 0, W, H); grainV(ctx, t); return; }
  // T3: split along the bar FLORIS -> ASANI (19.6–20.2)
  if (t < 19.6) { sFloris(ctx, t - 14.5); grainV(ctx, t); return; }
  if (t < 20.2) { const k = (t - 19.6) / 0.6; const lineW = easeOutExpo(clamp(k / 0.35)); const open = easeInOutQuint(clamp((k - 0.3) / 0.7));
    const p = place('floris'); const yb = p.oy + (META.floris.comps[1].y + META.floris.comps[1].h - 30) * p.S;
    B.setTransform(1, 0, 0, 1, 0, 0); sAsani(B, t - 20); A.setTransform(1, 0, 0, 1, 0, 0); sFloris(A, t - 14.5);
    ctx.drawImage(bufB, 0, 0);
    const gapH = open * H; ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, yb); ctx.clip(); ctx.drawImage(bufA, 0, -gapH * (yb / H)); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0, yb, W, H - yb); ctx.clip(); ctx.drawImage(bufA, 0, gapH * (1 - yb / H)); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 1 - open; const lw = W * lineW; ctx.fillRect(W / 2 - lw / 2, yb - 5 - gapH * (yb / H), lw, 10); ctx.fillRect(W / 2 - lw / 2, yb - 5 + gapH * (1 - yb / H), lw, 10); ctx.globalAlpha = 1;
    grainV(ctx, t); return; }
  // T4: ASANI sinks into darkness -> AURA eyes (25.0–25.5)
  if (t < 25.0) { sAsani(ctx, t - 20); grainV(ctx, t); return; }
  if (t < 25.5) { sAsani(ctx, t - 20, easeInOutCubic((t - 25.0) / 0.45)); grainV(ctx, t); return; }
  // T5: jaws close AURA -> reel (30.7–31.1)
  if (t < 30.75) { sAura(ctx, t - 25.5); grainV(ctx, t); return; }
  if (t < 31.25) { const k = (t - 30.75) / 0.5; const close = k < 0.5 ? easeInExpo(k / 0.5) : 1 - easeOutExpo((k - 0.5) / 0.5);
    if (k < 0.5) sAura(ctx, t - 25.5); else sReel(ctx, t - 31);
    jaws(ctx, close); return; }
  if (t < 33.75) { sReel(ctx, t - 31); return; }
  sOutro(ctx, t - 33.75);
}
function jaws(ctx, c) { const hgt = c * H / 2; const tooth = 80; ctx.fillStyle = INK;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, hgt); for (let x = W; x >= 0; x -= tooth) { ctx.lineTo(x - tooth * 0.2, hgt); ctx.lineTo(x - tooth * 0.5, hgt + 40 * c); ctx.lineTo(x - tooth * 0.8, hgt); } ctx.lineTo(0, hgt); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.lineTo(W, H - hgt); for (let x = W + tooth / 2; x >= -tooth; x -= tooth) { ctx.lineTo(x - tooth * 0.2, H - hgt); ctx.lineTo(x - tooth * 0.5, H - hgt - 40 * c); ctx.lineTo(x - tooth * 0.8, H - hgt); } ctx.lineTo(0, H - hgt); ctx.closePath(); ctx.fill(); }
function grainV(ctx, t) { ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.drawImage(grain[Math.floor(t * 24) % 6], 0, 0, W, H); ctx.restore(); }

// discontinuities: don't blur across cuts
const CUTS = [3.25, 4.2, 8.8, 9.2, 14.2, 14.7, 19.6, 20.2, 25.0, 25.5, 30.75, 31.0, 31.25, 33.75];
window.renderFrame = (i, n = 6) => {
  const t = Math.round(i / FPS * 1e6) / 1e6; const shutter = 0.5 / FPS;
  for (let k = 0; k < n; k++) { let ts = t + (n === 1 ? 0 : (k / (n - 1) - 0.5) * shutter); for (const e of CUTS) if ((t >= e) !== (ts >= e)) ts = t;
    drawFrame(F, Math.max(0, ts)); out.globalAlpha = 1 / (k + 1); out.drawImage(frame, 0, 0); }
  out.globalAlpha = 1;
};
window.grab = () => cv.toDataURL('image/jpeg', 0.93);
loadAll().then(() => document.fonts.load('800 150px "Inter Display"')).then(() => document.fonts.load('500 40px "Inter Display"')).then(() => document.fonts.load('700 52px "Inter Display"')).then(() => { window.ready = true; });
