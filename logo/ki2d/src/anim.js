const W = 1920, H = 1080, FPS = 60, DUR = 6;
const LIME = '#C8FF2E', LIME2 = '#BDF21F', INK = '#14210A';
const cv = document.getElementById('c'), out = cv.getContext('2d');
const buf = document.createElement('canvas'); buf.width = W; buf.height = H; const c = buf.getContext('2d');
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutBack = (t, s = 2.2) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
const easeOutCubic = t => 1 - Math.pow(1 - clamp(t), 3);
const easeInOutCubic = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const spring = (t, f = 9, d = 6) => t < 0 ? 0 : Math.exp(-d * t) * Math.sin(f * t);
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const STEM_TOP = 320, FLOOR = 704, R = 65;
const ARM = new Path2D('M323 486L463 320H640L479 512L554 601L468 704H461L398 626C384 609 372 600 356 600C337 600 323 615 323 638Z');
const BAND = new Path2D('M681 451H854L640 704H468Z');
const ARM_DIR = [0.645, -0.764], BAND_DIR = [0.647, -0.762];

// ---------- timeline ----------
const T = { hit0: 0.5, launch: 0.75, land1: 1.25, armIn: [0.98, 1.2], bandIn: [1.48, 1.75], land2: 1.75, hop1: 2.0, hop2: 2.2, bigUp: 3.5, bigLand: 4.0 };
const stemGrow = t => t < T.hit0 ? 0 : easeOutBack((t - T.hit0) / (T.launch - T.hit0 + 0.05), 1.6);
const armK = t => easeOutBack((t - T.armIn[0]) / (T.armIn[1] - T.armIn[0]), 1.4);
const bandK = t => easeOutBack((t - T.bandIn[0]) / (T.bandIn[1] - T.bandIn[0]), 1.2);

// parabola between (t0,x0,y0) and (t1,x1,y1) with apex height h above higher endpoint
function arc(t, t0, t1, x0, y0, x1, y1, h) {
  const u = clamp((t - t0) / (t1 - t0)); const top = Math.min(y0, y1) - h;
  // quadratic bezier through apex-ish: control so that max height ~ top
  const cy = 2 * top - (y0 + y1) / 2; const x = lerp(x0, x1, u);
  const y = (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * y1; return [x, y];
}
// dot: returns bottom-contact point (x, yb)
function dotAt(t) {
  if (t < T.hit0) { const u = t / T.hit0; return [246, lerp(-260, FLOOR, u * u)]; }
  if (t < T.launch) { const g = stemGrow(t); return [246, FLOOR - 384 * g]; }
  if (t < T.land1) { const [x, y] = arc(t, T.launch, T.land1, 246, FLOOR - 384 * stemGrow(T.launch), 552, STEM_TOP, 230); return [x, y]; }
  if (t < T.land2) return arc(t, T.land1, T.land2, 552, STEM_TOP, 769, 451, 150);
  const bandOff = (bandK(t) - 1) * 252; // overshoot lifts
  const yb = 451 - bandOff;
  if (t < T.hop1) { const u = (t - T.land2) / (T.hop1 - T.land2); return [769, yb - 70 * 4 * u * (1 - u)]; }
  if (t < T.hop2) { const u = (t - T.hop1) / (T.hop2 - T.hop1); return [769, yb - 22 * 4 * u * (1 - u)]; }
  for (const [h0, h1, hh] of [[2.5, 2.75, 30], [2.75, 3.0, 48]]) if (t >= h0 && t < h1) { const u = (t - h0) / (h1 - h0); return [769, yb - hh * 4 * u * (1 - u)]; }
  if (t >= T.bigUp && t < T.bigLand) { const u = (t - T.bigUp) / (T.bigLand - T.bigUp); return [769, 451 - 300 * 4 * u * (1 - u)]; }
  return [769, yb];
}
const CONTACTS = [[T.hit0, 1.0], [T.land1, 0.8], [T.land2, 0.75], [T.hop1, 0.45], [T.hop2, 0.25], [2.75, 0.3], [3.0, 0.4], [T.bigLand, 1.0]];
function squashAt(t) { let s = 0; for (const [tc, k] of CONTACTS) { const d = t - tc; if (d >= -0.005 && d < 0.14) s = Math.max(s, k * Math.sin(clamp(d / 0.14) * Math.PI) * Math.exp(-d * 6)); } return s; }
// pre-launch anticipation squash on big hop
function anticip(t) { const d = T.bigUp - t; return d > 0 && d < 0.25 ? Math.sin((1 - d / 0.25) * Math.PI / 2) * 0.35 * (d > 0.02 ? 1 : d / 0.02) : 0; }

// ---------- camera ----------
function camAt(t) {
  const [dx, dy] = dotAt(Math.max(0, t - 0.06));
  const follow = 1 - sstep(1.2, 2.3, t);
  const cx = lerp(511.5, lerp(dx, 511.5, 0.25), follow), cy = lerp(512, lerp(Math.max(dy - 40, -40), 512, 0.3), follow);
  let s = lerp(1, 2.0, follow) * (1080 / 1024);
  s *= 1 + 0.05 * sstep(3.2, 3.75, t) * (1 - sstep(4.0, 4.6, t));
  const rot = -0.1 * follow + 0.012 * spring(t - T.bigLand, 30, 7);
  const shake = spring(t - T.bigLand, 45, 9) * 10 + spring(t - T.hit0, 45, 9) * 8;
  return { cx, cy: cy - shake / s, s, rot };
}

// ---------- particles (bursts at contacts) ----------
const bursts = [];
const pr = rng(21);
for (const [tc, k, x, y, dir] of [[T.hit0, 1, 246, FLOOR, -1], [T.land1, .8, 552, STEM_TOP, -1], [T.land2, .8, 769, 451, -1], [T.bigLand, 1.2, 769, 451, -1]]) {
  const n = Math.round(9 * k);
  for (let i = 0; i < n; i++) { const a = Math.PI + (i + 0.5) / n * Math.PI + (pr() - .5) * 0.25; const sp = (260 + pr() * 320) * k;
    bursts.push({ t0: tc, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 7 + pr() * 9, kind: pr() < 0.45 ? 'dash' : 'dot' }); }
}
// background stripes (parallax)
const stripes = []; const sr = rng(5); for (let i = 0; i < 9; i++) stripes.push({ off: (i - 4) * 360 + sr() * 120, w: 90 + sr() * 160 });
const SL_ANGLE = Math.atan2(ARM_DIR[1], ARM_DIR[0]);

function drawScene(t) {
  const cam = camAt(t);
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = LIME; c.fillRect(0, 0, W, H);
  // background stripes: parallax 0.35, fade out for clean final
  const sa = 1 - sstep(2.0, 2.8, t) + 0.9 * sstep(3.3, 3.6, t) * (1 - sstep(4.1, 4.9, t));
  if (sa > 0.001) {
    c.save(); c.translate(W / 2, H / 2); c.rotate(cam.rot * 0.5); c.scale(cam.s * 0.55, cam.s * 0.55); c.translate(-cam.cx * 0.35, -cam.cy * 0.35);
    c.rotate(SL_ANGLE + Math.PI / 2); c.globalAlpha = sa; c.fillStyle = LIME2;
    for (const s of stripes) { const slide = (t * 140) % 360; c.fillRect(s.off + slide - 1800, -3000, s.w, 6000); }
    c.restore();
  }
  // world
  c.save(); c.translate(W / 2, H / 2); c.rotate(cam.rot); c.scale(cam.s, cam.s); c.translate(-cam.cx, -cam.cy);
  // whole-logo squash on big landing (anchored at floor)
  const ls = spring(t - T.bigLand, 18, 6);
  c.translate(511.5, FLOOR); c.scale(1 + ls * 0.06, 1 - ls * 0.08); c.translate(-511.5, -FLOOR);
  c.fillStyle = INK;
  // speed lines on big hop
  const sl = sstep(T.bigUp, T.bigUp + 0.08, t) * (1 - sstep(T.bigUp + 0.2, T.bigUp + 0.35, t)) + sstep(T.bigLand - 0.18, T.bigLand - 0.1, t) * (1 - sstep(T.bigLand - 0.02, T.bigLand + 0.05, t));
  if (sl > 0) { c.save(); c.globalAlpha = sl; c.lineWidth = 9; c.lineCap = 'round'; c.strokeStyle = INK; const [dx, dy] = dotAt(t);
    for (const o of [-48, 0, 48]) { c.beginPath(); c.moveTo(769 + o, dy + (t < 3.75 ? 30 : -200) ); c.lineTo(769 + o, dy + (t < 3.75 ? 120 + Math.abs(o) : -280 + Math.abs(o))); c.stroke(); } c.restore(); }
  // stem
  const g = stemGrow(t); const landDip = spring(t - T.land1, 22, 9) * 0; 
  if (g > 0) { const top = FLOOR - 384 * g; c.fillRect(169, top, 154, FLOOR - top); }
  // arm: emerges from stem's right edge
  const a = armK(t);
  if (t > T.armIn[0]) { c.save(); c.beginPath(); c.rect(323, -2000, 4000, 2000 + FLOOR); c.clip();
    const off = (1 - a) * 300; const dip = spring(t - T.land1, 24, 8) * 14;
    c.translate(-ARM_DIR[0] * off, -ARM_DIR[1] * off + dip); c.fill(ARM); c.restore(); }
  // band: rises from floor
  const b = bandK(t);
  if (t > T.bandIn[0]) { c.save(); c.beginPath(); c.rect(-2000, -2000, 6000, 2000 + FLOOR); c.clip();
    const off = (1 - b) * 330; const dip = spring(t - T.land2, 24, 8) * 12 + spring(t - T.hop1, 24, 8) * 6;
    c.translate(-BAND_DIR[0] * off, -BAND_DIR[1] * off + dip); c.fill(BAND); c.restore(); }
  // dot with squash & stretch along velocity
  const [x, yb] = dotAt(t); const [x2, yb2] = dotAt(t + 1 / 240);
  const vx = (x2 - x) * 240, vy = (yb2 - yb) * 240; const sp = Math.hypot(vx, vy);
  const sq = squashAt(t) + anticip(t);
  const st = Math.min(0.3, sp / 7000) * (sq > 0.05 ? 0 : 1);
  c.save(); c.translate(x, yb);
  if (sq > 0.001) { c.scale(1 + sq * 0.45, 1 - sq * 0.4); c.beginPath(); c.arc(0, -R, R, 0, Math.PI * 2); c.fill(); }
  else { c.translate(0, -R); c.rotate(Math.atan2(vy, vx)); c.scale(1 + st, 1 / (1 + st)); c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill(); }
  c.restore();
  // bursts
  for (const p of bursts) { const d = t - p.t0; if (d < 0 || d > 0.55) continue; const e = 1 - Math.pow(1 - d / 0.55, 3);
    const px = p.x + p.vx * 0.55 * e, py = p.y + p.vy * 0.55 * e + 220 * d * d; const k = 1 - sstep(0.25, 0.55, d);
    c.save(); c.translate(px, py);
    if (p.kind === 'dot') { c.beginPath(); c.arc(0, 0, p.r * k, 0, Math.PI * 2); c.fill(); }
    else { c.rotate(Math.atan2(p.vy, p.vx)); c.fillRect(-p.r * 1.6 * k, -4 * k, p.r * 3.2 * k, 8 * k); }
    c.restore(); }
  c.restore();
}

window.renderFrame = (i, n = 10) => {
  const t = i / FPS; const shutter = 0.5 / FPS;
  const EV = [T.hit0, T.launch, T.land1, T.land2, T.hop1, T.hop2, 2.5, 2.75, 3.0, T.bigUp, T.bigLand];
  for (let k = 0; k < n; k++) { let ts = t + (k / (n - 1) - 0.5) * shutter; for (const e of EV) if ((ts - e) * (t - e) < 0) ts = t; drawScene(Math.max(0, ts)); out.globalAlpha = 1 / (k + 1); out.drawImage(buf, 0, 0); }
  out.globalAlpha = 1;
};
window.grab = q => cv.toDataURL('image/png');
window.ready = true;
