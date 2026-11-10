const W = 1920, H = 1080, FPS = 60, DUR = 8;
const LIME = '#C8FF2E', INK = '#14210A';
const cv = document.getElementById('c'), out = cv.getContext('2d');
const buf = document.createElement('canvas'); buf.width = W; buf.height = H; const c = buf.getContext('2d');
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutBack = (t, s = 2.2) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
const easeOutExpo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t));
const easeInOutCubic = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeInOutQuint = t => { t = clamp(t); return t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2; };
const spring = (t, f = 9, d = 6) => t < 0 ? 0 : Math.exp(-d * t) * Math.sin(f * t);
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const D2R = Math.PI / 180;

const FLOOR = 704, R = 65, STEM_TOP = 320;
const ARM = new Path2D('M323 486L463 320H640L479 512L554 601L468 704H461L398 626C384 609 372 600 356 600C337 600 323 615 323 638Z');
const BAND = new Path2D('M681 451H854L640 704H468Z');
const BAND_DIR = [0.647, -0.762];
const SLANT = Math.atan2(-0.764, 0.645); // logo diagonal

// ---------- timeline (120 BPM) ----------
const T = { cut: 0.12, open: [0.3, 0.62], fall0: 0.42, hit0: 1.0, launch: 1.25, armIn: [1.38, 1.7], land1: 1.75, fling: 1.86, bandIn: [1.98, 2.25], land2: 2.25, hop1: 2.5, hop2: 2.7,
  dr: [[3.0, 3.25, 30], [3.25, 3.5, 46]], bigUp: 4.0, bigLand: 4.5, lock: [5.0, 5.65], name: 5.35, tag: 6.1 };
const stemGrow = t => t < T.hit0 ? 0 : easeOutBack((t - T.hit0) / (T.launch - T.hit0 + 0.06), 1.7);
// arm: drawbridge about floor pivot (323,704); angle from +90deg (down/hidden) to 0, plus seesaw on dot landing
const armAngle = t => { const u = clamp((t - T.armIn[0]) / (T.armIn[1] - T.armIn[0])); const base = (1 - easeOutBack(u, 2.0)) * 88;
  return base + spring(t - T.land1, 16, 7) * 6 - spring(t - T.bigLand - 0.05, 20, 7) * 2.5; };
const bandK = t => easeOutBack((t - T.bandIn[0]) / (T.bandIn[1] - T.bandIn[0]), 1.3);

function arc(t, t0, t1, x0, y0, x1, y1, h) {
  const u = clamp((t - t0) / (t1 - t0)); const top = Math.min(y0, y1) - h; const cy = 2 * top - (y0 + y1) / 2;
  return [lerp(x0, x1, u), (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * y1];
}
// arm top point where dot lands, following arm rotation
function armPoint(t, px, py) { const a = armAngle(t) * D2R; const dx = px - 323, dy = py - FLOOR; return [323 + dx * Math.cos(a) - dy * Math.sin(a), FLOOR + dx * Math.sin(a) + dy * Math.cos(a)]; }
function dotAt(t) {
  if (t < T.fall0) return [246, -400];
  if (t < T.hit0) { const u = (t - T.fall0) / (T.hit0 - T.fall0); return [246, lerp(-200, FLOOR, u * u)]; }
  if (t < T.launch) return [246, FLOOR - 384 * stemGrow(t)];
  if (t < T.land1) return arc(t, T.launch, T.land1, 246, FLOOR - 384 * stemGrow(T.launch), 560, STEM_TOP, 230);
  if (t < T.fling) return armPoint(t, 560, STEM_TOP);           // rides the seesaw down
  if (t < T.land2) { const [fx, fy] = armPoint(T.fling, 560, STEM_TOP); return arc(t, T.fling, T.land2, fx, fy, 769, 451, 170); }
  const yb = 451 - (bandK(t) - 1) * 252 - bandDip(t);
  if (t < T.hop1) { const u = (t - T.land2) / (T.hop1 - T.land2); return [769, yb - 70 * 4 * u * (1 - u)]; }
  if (t < T.hop2) { const u = (t - T.hop1) / (T.hop2 - T.hop1); return [769, yb - 22 * 4 * u * (1 - u)]; }
  for (const [h0, h1, hh] of T.dr) if (t >= h0 && t < h1) { const u = (t - h0) / (h1 - h0); return [769, yb - hh * 4 * u * (1 - u)]; }
  if (t >= T.bigUp && t < T.bigLand) { const u = (t - T.bigUp) / (T.bigLand - T.bigUp); return [769, 451 - 320 * 4 * u * (1 - u)]; }
  // follow-through hop during lockup slide
  if (t >= T.lock[0] + 0.05 && t < T.lock[0] + 0.45) { const u = (t - T.lock[0] - 0.05) / 0.4; return [769, yb - 60 * 4 * u * (1 - u)]; }
  return [769, yb];
}
const bandDip = t => spring(t - T.land2, 24, 8) * 10 + spring(t - T.hop1, 24, 8) * 5 + T.dr.reduce((a, d) => a + spring(t - d[1], 24, 8) * 4, 0);
const CONTACTS = [[T.hit0, 1.0], [T.land1, 0.8], [T.land2, 0.8], [T.hop1, 0.45], [T.hop2, 0.25], [T.dr[0][1], 0.3], [T.dr[1][1], 0.4], [T.bigLand, 1.0], [T.lock[0] + 0.45, 0.35]];
function squashAt(t) { let s = 0; for (const [tc, k] of CONTACTS) { const d = t - tc; if (d >= -0.005 && d < 0.14) s = Math.max(s, k * Math.sin(clamp(d / 0.14) * Math.PI) * Math.exp(-d * 6)); } return s; }
function anticip(t) { const d = T.bigUp - t; return d > 0 && d < 0.25 ? Math.sin((1 - d / 0.25) * Math.PI / 2) * 0.35 * (d > 0.02 ? 1 : d / 0.02) : 0; }
const EV = [T.fall0, T.hit0, T.launch, T.land1, T.fling, T.land2, T.hop1, T.hop2, 3.0, 3.25, 3.5, T.bigUp, T.bigLand, T.lock[0] + 0.05, T.lock[0] + 0.45];

// ---------- name lockup ----------
const NAME = ['Vıktorııa', 'Kıtsak']; const FS = 116, LINE = 122; const TAG = 'Graphic Design  ·  3D';
let layout = null;
function computeLayout() {
  c.font = `800 ${FS}px "Inter Display"`; const w1 = c.measureText(NAME[0]).width, w2 = c.measureText(NAME[1]).width;
  const K = 0.68, logoW = 685 * K, logoH = 384 * K, gap = 70, nameW = Math.max(w1, w2);
  const total = logoW + gap + nameW; const left = W / 2 - total / 2; const cy = H / 2 - 30;
  const logoCX = left + logoW / 2; const nameX = left + logoW + gap; const top = cy - logoH / 2;
  // per-letter positions and dotless-i tittles
  const letters = []; const tittles = [];
  NAME.forEach((word, li) => { let x = nameX; const base = top + 86 + li * LINE + 4;
    for (const ch of word) { const w = c.measureText(ch).width; letters.push({ ch, x, base, li }); if (ch === 'ı') tittles.push({ x: x + w / 2, base, li }); x += w; } });
  layout = { K, logoCX, cy, nameX, top, letters, tittles, logoH, tagY: top + logoH + 92 };
}

// ---------- camera / logo placement ----------
function camAt(t) {
  const [dx, dy] = dotAt(Math.max(T.fall0, t - 0.06));
  const follow = 1 - sstep(1.7, 2.8, t);
  let cx = lerp(511.5, lerp(dx, 511.5, 0.3), follow), cy = lerp(512, lerp(Math.max(dy - 40, -40), 512, 0.3), follow);
  let s = lerp(1, 1.9, follow) * (1080 / 1024);
  s *= 1 + 0.045 * sstep(3.6, 4.2, t) * (1 - sstep(4.5, 5.0, t));
  let rot = -0.09 * follow + 0.014 * spring(t - T.bigLand, 30, 7) + 0.02 * spring(t - T.hit0, 25, 7);
  const shake = spring(t - T.bigLand, 45, 9) * 10 + spring(t - T.hit0, 45, 9) * 8 + spring(t - T.land2, 45, 10) * 4;
  // lockup: move logo left and scale down
  const L = easeInOutQuint((t - T.lock[0]) / (T.lock[1] - T.lock[0]));
  const sx = lerp(W / 2, layout.logoCX, L), sy = lerp(H / 2, layout.cy, L);
  s = lerp(s, layout.K, L);
  const drift = 1 + 0.015 * sstep(T.lock[1], DUR, t);
  return { cx, cy: cy - shake / s, s: s * drift, rot, sx, sy };
}

// ---------- particles ----------
const bursts = []; const pr = rng(21);
for (const [tc, k, x, y] of [[T.hit0, 1, 246, FLOOR], [T.land1, .8, 560, STEM_TOP], [T.land2, .8, 769, 451], [T.bigLand, 1.25, 769, 451]]) {
  const n = Math.round(10 * k);
  for (let i = 0; i < n; i++) { const a = Math.PI + (i + 0.5) / n * Math.PI + (pr() - .5) * 0.25; const sp = (260 + pr() * 320) * k;
    bursts.push({ t0: tc, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 6 + pr() * 9, kind: pr() < 0.5 ? 'para' : 'dot', spin: (pr() - .5) * 8 }); }
}

// ---------- piece drawing (with transforms + echoes) ----------
function stemXf(t) { // returns {top, sx}
  const g = stemGrow(t); const over = Math.max(0, g - 1);
  const jelly = spring(t - T.bigLand, 18, 6) * 0.07 + spring(t - T.launch, 20, 7) * 0.05;
  return { g, sx: 1 + over * 0.6 + jelly * 0.8, sy: 1 - jelly };
}
function drawStem(ctx, t) { const { g, sx, sy } = stemXf(t); if (g <= 0) return; const h = 384 * g * sy;
  ctx.save(); ctx.translate(246, FLOOR); ctx.scale(sx, 1); ctx.fillRect(-77, -h, 154, h); ctx.lineWidth = 2.2; ctx.strokeRect(-77, -h, 154, h); ctx.restore(); }
function drawArm(ctx, t, mode) { if (t < T.armIn[0]) return; const a = armAngle(t);
  const jelly = spring(t - T.bigLand - 0.05, 18, 6) * 0.07;
  ctx.save(); ctx.beginPath(); ctx.rect(323, -3000, 4000, 3000 + FLOOR); ctx.clip();
  ctx.translate(323, FLOOR); ctx.rotate(a * D2R); ctx.scale(1 + jelly * 0.5, 1 - jelly); ctx.translate(-323, -FLOOR);
  if (mode === 'stroke') ctx.stroke(ARM); else { ctx.fill(ARM); ctx.lineWidth = 2.2; ctx.stroke(ARM); } ctx.restore(); }
function drawBand(ctx, t, mode) { if (t < T.bandIn[0]) return; const b = bandK(t); const off = (1 - b) * 330;
  const jelly = spring(t - T.bigLand - 0.1, 18, 6) * 0.07; const skew = spring(t - T.land2, 20, 6) * 0.08 + spring(t - T.hop1, 20, 7) * 0.03;
  ctx.save(); ctx.beginPath(); ctx.rect(-3000, -3000, 8000, 3000 + FLOOR); ctx.clip();
  ctx.translate(-BAND_DIR[0] * off, -BAND_DIR[1] * off + bandDip(t));
  ctx.translate(661, FLOOR); ctx.transform(1, 0, skew, 1 - jelly, 0, 0); ctx.scale(1 + jelly * 0.5, 1); ctx.translate(-661, -FLOOR);
  if (mode === 'stroke') ctx.stroke(BAND); else { ctx.fill(BAND); ctx.lineWidth = 2.2; ctx.stroke(BAND); } ctx.restore(); }
function drawDot(ctx, t) {
  const [x, yb] = dotAt(t); if (yb < -300) return; const [x2, yb2] = dotAt(t + 1 / 240);
  const vx = (x2 - x) * 240, vy = (yb2 - yb) * 240; const sp = Math.hypot(vx, vy);
  const sq = squashAt(t) + anticip(t); const st = Math.min(0.3, sp / 7000) * (sq > 0.05 ? 0 : 1);
  ctx.save(); ctx.translate(x, yb);
  if (sq > 0.001) { ctx.scale(1 + sq * 0.45, 1 - sq * 0.4); ctx.beginPath(); ctx.arc(0, -R, R, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.translate(0, -R); ctx.rotate(Math.atan2(vy, vx)); ctx.scale(1 + st, 1 / (1 + st)); ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawScene(t) {
  if (!layout) computeLayout();
  const cam = camAt(t);
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = LIME; c.fillRect(0, 0, W, H);
  c.save(); c.translate(cam.sx, cam.sy); c.rotate(cam.rot); c.scale(cam.s, cam.s); c.translate(-cam.cx, -cam.cy);
  // whole-logo squash on lockup start (anticipation) 
  c.fillStyle = INK; c.strokeStyle = INK; c.lineJoin = 'round';
  // echoes: thin outlines trailing moving pieces
  c.lineWidth = 4 / cam.s;
  for (const [lag, al] of [[0.09, 0.55], [0.18, 0.28]]) {
    c.globalAlpha = al;
    const te = t - lag;
    if (t > T.armIn[0] && t < T.armIn[1] + 0.25) drawArm(c, te, 'stroke');
    if (t > T.bandIn[0] && t < T.bandIn[1] + 0.25) drawBand(c, te, 'stroke');
  }
  c.globalAlpha = 1;
  // speed lines on big hop
  const sl = sstep(T.bigUp, T.bigUp + 0.08, t) * (1 - sstep(T.bigUp + 0.2, T.bigUp + 0.35, t)) + sstep(T.bigLand - 0.18, T.bigLand - 0.1, t) * (1 - sstep(T.bigLand - 0.02, T.bigLand + 0.05, t));
  if (sl > 0) { c.save(); c.globalAlpha = sl; c.lineWidth = 9; c.lineCap = 'round'; const [, dy] = dotAt(t); const up = t < (T.bigUp + T.bigLand) / 2;
    for (const o of [-50, 0, 50]) { c.beginPath(); c.moveTo(769 + o, dy + (up ? 40 : -200)); c.lineTo(769 + o, dy + (up ? 130 + Math.abs(o) : -290 + Math.abs(o))); c.stroke(); } c.restore(); }
  drawStem(c, t); drawArm(c, t); drawBand(c, t); drawDot(c, t);
  // bursts
  for (const p of bursts) { const d = t - p.t0; if (d < 0 || d > 0.6) continue; const e = 1 - Math.pow(1 - d / 0.6, 3);
    const px = p.x + p.vx * 0.6 * e, py = p.y + p.vy * 0.6 * e + 240 * d * d; const k = 1 - sstep(0.28, 0.6, d);
    c.save(); c.translate(px, py); c.rotate(p.spin * d + SLANT);
    if (p.kind === 'dot') { c.beginPath(); c.arc(0, 0, p.r * k, 0, Math.PI * 2); c.fill(); }
    else { const w = p.r * 2.2 * k, h = p.r * 0.9 * k; c.beginPath(); c.moveTo(-w / 2 + h * 0.6, -h / 2); c.lineTo(w / 2 + h * 0.6, -h / 2); c.lineTo(w / 2 - h * 0.6, h / 2); c.lineTo(-w / 2 - h * 0.6, h / 2); c.fill(); }
    c.restore(); }
  c.restore();

  // name lockup (screen space)
  if (t > T.name - 0.05) {
    c.save(); c.font = `800 ${FS}px "Inter Display"`; c.fillStyle = INK; c.textBaseline = 'alphabetic';
    layout.letters.forEach((L, i) => { const t0 = T.name + i * 0.035 + L.li * 0.08; const u = clamp((t - t0) / 0.5); if (u <= 0) return;
      const e = easeOutBack(u, 2.4); c.save(); c.beginPath(); c.rect(L.x - 20, L.base - FS * 1.1, FS * 1.4, FS * 1.1 + 34); c.clip();
      c.translate(L.x, L.base + (1 - e) * FS * 1.05); c.rotate((1 - easeOutExpo(u)) * 0.25); c.fillText(L.ch, 0, 0); c.restore(); });
    // tittles: little dots drop and bounce onto dotless i's
    layout.tittles.forEach((d, i) => { const t0 = T.name + 0.45 + i * 0.12; const u = clamp((t - t0) / 0.42); if (t < t0) return;
      const r = FS * 0.088; const restY = d.base - FS * 0.765; let y;
      if (u < 0.55) { const v = u / 0.55; y = lerp(restY - 140, restY, v * v); } else { const v = (u - 0.55) / 0.45; y = restY - 26 * 4 * v * (1 - v); }
      const sq = (u > 0.53 && u < 0.66) ? Math.sin((u - 0.53) / 0.13 * Math.PI) * 0.35 : 0;
      c.save(); c.translate(d.x, y + r); c.scale(1 + sq * 0.5, 1 - sq * 0.4); c.beginPath(); c.arc(0, -r, r, 0, Math.PI * 2); c.fill(); c.restore(); });
    // tagline
    const tg = clamp((t - T.tag) / 0.7);
    if (tg > 0) { c.font = `500 34px "Inter Display"`; const track = lerp(26, 6, easeOutExpo(tg)); c.globalAlpha = sstep(0, 0.4, tg);
      const chars = [...TAG]; const widths = chars.map(ch => c.measureText(ch).width); const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
      let x = W / 2 - total / 2; chars.forEach((ch, i) => { c.fillText(ch, x, layout.tagY); x += widths[i] + track; }); }
    c.restore();
  }

  // opening: ink screen sliced along the logo diagonal
  if (t < T.open[1] + 0.05) {
    const u = easeInOutCubic((t - T.open[0]) / (T.open[1] - T.open[0])); const cut = easeOutExpo((t - T.cut) / 0.25);
    c.save(); c.translate(W / 2, H / 2); c.rotate(SLANT + Math.PI / 2); c.fillStyle = INK;
    const gap = u * 1400; c.fillRect(-3000, -3000, 3000 - gap / 2, 6000); c.fillRect(gap / 2, -3000, 3000, 6000);
    if (u <= 0 && cut > 0) { c.fillStyle = LIME; const L = cut * 2600; c.fillRect(-4, -L / 2, 8, L); }
    c.restore();
  }
}

window.renderFrame = (i, n = 10) => {
  const t = i / FPS; const shutter = 0.5 / FPS;
  for (let k = 0; k < n; k++) { let ts = t + (k / (n - 1) - 0.5) * shutter; for (const e of EV) if ((ts - e) * (t - e) < 0) ts = t;
    drawScene(Math.max(0, ts)); out.globalAlpha = 1 / (k + 1); out.drawImage(buf, 0, 0); }
  out.globalAlpha = 1;
};
window.grab = () => cv.toDataURL('image/png');
document.fonts.load('800 116px "Inter Display"').then(() => document.fonts.load('500 34px "Inter Display"')).then(() => { window.ready = true; });
