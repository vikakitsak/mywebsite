const W = 1920, H = 1080, FPS = 60, DUR = 11;
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
const easeInCubic = t => clamp(t) ** 3;
const spring = (t, f = 9, d = 6) => t < 0 ? 0 : Math.exp(-d * t) * Math.sin(f * t);
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const SLANT = Math.atan2(-0.764, 0.645);

// ---------- geometry (logo space, 1024 grid) ----------
const LOGO = new Path2D('M169 320H323V486L463 320H640L479 512L554 601L681 451H854L640 704H461L398 626C384 609 372 600 356 600C337 600 323 615 323 638V704H169Z');
const KGEO = new Path2D('M169 320H323V486L463 320H640L479 512L641 704H461L398 626C384 609 372 600 356 600C337 600 323 615 323 638V704H169Z');
const VGEO = new Path2D('M277 486H457L554 601L651 486H824L640 704H461Z');
const IBAND = new Path2D('M681 451H854L640 704H468Z');
const DOT = [769, 385, 65], FLOOR = 704;
const BOX = { K: [169, 320, 641, 704], V: [277, 486, 824, 704], i: [468, 320, 854, 704] };
const SEP = { K: -400, V: 0, i: 420 };

// ---------- timeline (120 BPM) ----------
const T = { nameIn: 0.1, fall: 1.5, pair: [1.8, 2.25], gather: [3.45, 4.05], morph: [4.05, 4.55], kMerge: [4.62, 5.0], iMerge: [5.12, 5.5], stamp: 6.0,
  hopUp: 6.5, hopLand: 7.0, lock: [7.5, 8.15], name2: 7.85, tag: 8.6, pairHops: [[2.6, 2.9, 38], [3.1, 3.38, 24]] };

// ---------- camera ----------
// screen = (world - (cx,cy)) * s rotated + (sx,sy)
function camAt(t) {
  let s = lerp(0.97, 1.0, sstep(0, 4.6, t)), cx = 521, cy = 545, rot = 0.012 * Math.sin(t * 0.9) * (1 - sstep(5.4, 6.0, t));
  // push-ins on merges
  s *= 1 + 0.03 * spring(t - T.kMerge[1], 14, 5) + 0.03 * spring(t - T.iMerge[1], 14, 5);
  // settle on the finished logo
  const fin = easeInOutCubic((t - 5.5) / 0.6); s = lerp(s, 1080 / 1024 * 0.95, fin); cx = lerp(cx, 511.5, fin); cy = lerp(cy, 512, fin);
  const shake = spring(t - T.kMerge[1], 45, 10) * 9 + spring(t - T.iMerge[1], 45, 10) * 7 + spring(t - T.stamp, 45, 9) * 8 + spring(t - T.hopLand, 45, 9) * 9;
  rot += 0.012 * spring(t - T.hopLand, 30, 7);
  let sx = W / 2, sy = H / 2;
  const L = easeInOutQuint((t - T.lock[0]) / (T.lock[1] - T.lock[0]));
  if (L > 0) { sx = lerp(sx, layout.logoCX, L); sy = lerp(sy, layout.cy, L); s = lerp(s, layout.K, L); }
  s *= 1 + 0.015 * sstep(T.lock[1], DUR, t);
  return { s, cx, cy: cy - shake / s, rot, sx, sy };
}
function applyCam(ctx, cam) { ctx.translate(cam.sx, cam.sy); ctx.rotate(cam.rot); ctx.scale(cam.s, cam.s); ctx.translate(-cam.cx, -cam.cy); }

// ---------- name & glyph mapping ----------
const NAME = 'Viktoriia Kitsak'; const FS = 168;
const KEEP = { 0: 'V', 1: 'i', 10: 'K', 11: 'i' }; // indices in NAME
let layout = null;
function computeLayout() {
  c.font = `800 ${FS}px "Inter Display"`;
  const ws = [...NAME].map(ch => c.measureText(ch).width); const total = ws.reduce((a, b) => a + b, 0);
  // world coords for S1 (camera ~identity, s=1 at center (521,545))
  let x = 521 - total / 2; const base = 545 + FS * 0.36;
  const letters = [...NAME].map((ch, i) => { const L = { ch, i, x, base, w: ws[i] }; x += ws[i]; return L; });
  const PAIR_MS = 1.3;
  // centered pair "Vi  Ki" (bigger), used as a held beat
  const MS = 1.3; const pairStr = ['V', 'i', ' ', 'K', 'i']; const pw = pairStr.map(ch => c.measureText(ch).width * MS); const ptot = pw.reduce((a, b) => a + b, 0) + 40;
  let px = 521 - ptot / 2; const pmap = {}; [0, 1, null, 10, 11].forEach((idx, j) => { if (idx !== null) pmap[idx] = px; px += pw[j] + (j === 2 ? 40 : 0); });
  // ink boxes for kept glyphs
  for (const L of letters) if (KEEP[L.i] !== undefined) { const m = c.measureText(L.ch === 'i' ? 'ı' : L.ch); L.ink = { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent }; }
  // lockup
  c.font = `800 116px "Inter Display"`; const w1 = c.measureText('Vıktorııa').width, w2 = c.measureText('Kıtsak').width;
  const K = 0.68, logoW = 685 * K, logoH = 384 * K, gap = 70, total2 = logoW + gap + Math.max(w1, w2);
  const left = W / 2 - total2 / 2, cy = H / 2 - 30, top = cy - logoH / 2, nameX = left + logoW + gap;
  const lk = [], tit = [];
  ['Vıktorııa', 'Kıtsak'].forEach((word, li) => { let xx = nameX; const b = top + 86 + li * 122 + 4;
    for (const ch of word) { const w = c.measureText(ch).width; lk.push({ ch, x: xx, base: b, li }); if (ch === 'ı') tit.push({ x: xx + w / 2, base: b }); xx += w; } });
  layout = { letters, pmap, MS, K, logoCX: left + logoW / 2, cy, lk, tit, tagY: top + logoH + 92 };
}
// glyph target transform: map glyph ink box onto geometric box (separated position)
function glyphTarget(L) { const key = KEEP[L.i]; const [x0, y0, x1, y1] = BOX[key]; const dx = SEP[key];
  const gw = L.ink.l + L.ink.r, gh = L.ink.a;
  if (key === 'i') { const sx = 173 / gw; return { x: 468 + dx + L.ink.l * sx, base: y1, sx, sy: (704 - 451) / gh, key }; }
  return { x: x0 + dx + L.ink.l * ((x1 - x0) / gw), base: y1, sx: (x1 - x0) / gw, sy: (y1 - y0) / gh, key }; }

// ---------- dot ----------
function dotOffset(t) { // vertical offset of dot (logo space), squash
  let y = 0, sq = 0;
  const ant = T.hopUp - t; if (ant > 0 && ant < 0.25) sq = -Math.sin((1 - ant / 0.25) * Math.PI / 2) * 0.32;
  if (t >= T.hopUp && t < T.hopLand) { const u = (t - T.hopUp) / (T.hopLand - T.hopUp); y = -330 * 4 * u * (1 - u); }
  const l0 = T.lock[0] + 0.05; if (t >= l0 && t < l0 + 0.4) { const u = (t - l0) / 0.4; y = -60 * 4 * u * (1 - u); }
  for (const [tc, k] of [[T.iMerge[1], 0.5], [T.hopLand, 1], [l0 + 0.4, 0.35]]) { const d = t - tc; if (d >= 0 && d < 0.14) sq = Math.max(sq, k * Math.sin(d / 0.14 * Math.PI) * Math.exp(-d * 6)); }
  return { y, sq };
}
function drawDot(ctx, t, dx = 0) {
  const { y, sq } = dotOffset(t); const [x, cy, r] = DOT; const v = (dotOffset(t + 1 / 240).y - y) * 240; const st = sq === 0 ? Math.min(0.3, Math.abs(v) / 7000) : 0;
  ctx.save(); ctx.translate(x + dx, cy + r + y);
  if (sq > 0) ctx.scale(1 + sq * 0.45, 1 - sq * 0.4); else if (sq < 0) ctx.scale(1 - sq * 0.45, 1 + sq * 0.5); else ctx.scale(1 / (1 + st), 1 + st);
  ctx.beginPath(); ctx.arc(0, -r, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

// ---------- particles ----------
const bursts = []; const pr = rng(31);
for (const [tc, k, x, y] of [[T.kMerge[1], 0.8, 470, 600], [T.iMerge[1], 0.8, 700, 520], [T.stamp, 1.0, 511, 512], [T.hopLand, 1.1, 769, 451]]) {
  const n = Math.round(11 * k);
  for (let i = 0; i < n; i++) { const a = (tc === T.stamp ? 0 : Math.PI) + (i + 0.5) / n * Math.PI * (tc === T.stamp ? 2 : 1) + (pr() - .5) * 0.3; const sp = (280 + pr() * 340) * k;
    bursts.push({ t0: tc, x, y, vx: Math.cos(a) * sp * (tc === T.stamp ? 1.6 : 1), vy: Math.sin(a) * sp, r: 6 + pr() * 9, kind: pr() < 0.5 ? 'para' : 'dot', spin: (pr() - .5) * 8 }); }
}
function drawBursts(ctx, t) {
  for (const p of bursts) { const d = t - p.t0; if (d < 0 || d > 0.6) continue; const e = 1 - Math.pow(1 - d / 0.6, 3);
    const px = p.x + p.vx * 0.6 * e, py = p.y + p.vy * 0.6 * e + 240 * d * d; const k = 1 - sstep(0.28, 0.6, d);
    ctx.save(); ctx.translate(px, py); ctx.rotate(p.spin * d + SLANT);
    if (p.kind === 'dot') { ctx.beginPath(); ctx.arc(0, 0, p.r * k, 0, Math.PI * 2); ctx.fill(); }
    else { const w = p.r * 2.2 * k, h = p.r * 0.9 * k; ctx.beginPath(); ctx.moveTo(-w / 2 + h * 0.6, -h / 2); ctx.lineTo(w / 2 + h * 0.6, -h / 2); ctx.lineTo(w / 2 - h * 0.6, h / 2); ctx.lineTo(-w / 2 - h * 0.6, h / 2); ctx.fill(); }
    ctx.restore(); }
}

// ---------- geometric letters ----------
function partDX(key, t) {
  if (key === 'K') { const u = clamp((t - T.kMerge[0]) / (T.kMerge[1] - T.kMerge[0])); return SEP.K * (1 - (easeInCubic(u) * 0.6 + u * u * 0.4)) + spring(t - T.kMerge[1], 22, 8) * 22; }
  if (key === 'i') { const u = clamp((t - T.iMerge[0]) / (T.iMerge[1] - T.iMerge[0])); return SEP.i * (1 - (easeInCubic(u) * 0.6 + u * u * 0.4)) - spring(t - T.iMerge[1], 22, 8) * 22; }
  return spring(t - T.kMerge[1], 22, 8) * 10 - spring(t - T.iMerge[1], 22, 8) * 10; // V gets nudged
}
function drawGeo(ctx, t, key, fillA, strokeP, strokeA, dxOverride) {
  const dx = dxOverride ?? partDX(key, t);
  ctx.save(); ctx.translate(dx, 0);
  // squash on impact (V receives, K/i compress)
  const imp = key === 'V' ? spring(t - T.kMerge[1], 20, 7) * 0.03 + spring(t - T.iMerge[1], 20, 7) * 0.03 : 0;
  ctx.translate(511, FLOOR); ctx.scale(1 + imp, 1 - imp); ctx.translate(-511, -FLOOR);
  const path = key === 'K' ? KGEO : key === 'V' ? VGEO : IBAND;
  if (fillA > 0) { ctx.globalAlpha = fillA; ctx.fill(path); if (key === 'i') drawDot(ctx, t); }
  if (strokeA > 0 && strokeP > 0) { ctx.globalAlpha = strokeA; ctx.lineWidth = 5; ctx.lineJoin = 'round';
    const L = 2600; ctx.setLineDash([L * strokeP, L]); ctx.stroke(path);
    if (key === 'i') { ctx.beginPath(); ctx.arc(DOT[0], DOT[1] + dotOffset(t).y, DOT[2], -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * strokeP); ctx.stroke(); }
    ctx.setLineDash([]); }
  ctx.restore(); ctx.globalAlpha = 1;
}

// ---------- scene ----------
function drawScene(t) {
  if (!layout) computeLayout();
  const cam = camAt(t);
  c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = LIME; c.fillRect(0, 0, W, H);
  c.save(); applyCam(c, cam); c.fillStyle = INK; c.strokeStyle = INK;

  // --- S1/S2: the name, then Vi + Ki gather and morph ---
  const morphU = clamp((t - T.morph[0]) / (T.morph[1] - T.morph[0]));
  if (t < T.morph[1]) {
    c.font = `800 ${FS}px "Inter Display"`; c.textBaseline = 'alphabetic';
    for (const L of layout.letters) {
      if (L.ch === ' ') continue;
      const ti = T.nameIn + L.i * 0.045; const u = clamp((t - ti) / 0.45); if (u <= 0) continue;
      const pop = easeOutBack(u, 2.6);
      c.save();
      if (KEEP[L.i] === undefined) {
        // others fall away with gravity, staggered
        const tf = T.fall + (L.i % 7) * 0.035 + (L.i > 9 ? 0.05 : 0); const d = Math.max(0, t - tf);
        const y = 2600 * d * d + (d > 0 ? -60 * d : 0); const rot = d * ((L.i % 2 ? 1 : -1) * (2 + (L.i % 3)));
        if (y > 1200) { c.restore(); continue; }
        c.translate(L.x + L.w / 2, L.base + y - FS * 0.35 * (1 - pop) * 0); c.rotate(rot); c.translate(-L.w / 2, 0);
        c.translate(0, (1 - pop) * 60); c.globalAlpha = clamp(u * 3); c.fillText(L.ch, 0, 0);
      } else {
        const g = glyphTarget(L); const key = KEEP[L.i]; const gd = { V: 0, i: 0.06, K: 0.12 }[key];
        const ant = spring(t - T.fall, 18, 7) * 0.06;
        // stage A: slide into the centered pair "Vi Ki" (bigger)
        const mA = easeInOutCubic((t - T.pair[0] - (L.i > 9 ? 0.05 : 0)) / (T.pair[1] - T.pair[0]));
        const ax = lerp(L.x, layout.pmap[L.i], mA), abase = lerp(L.base, 545 + FS * 0.36 * layout.MS, mA), as = lerp(1, layout.MS, mA);
        // pair pulse on the held beat (Vi + Ki side by side)
        const beat = spring(t - T.pair[1], 16, 6) * 0.06;
        // stage B: to geometric targets
        const m = easeInOutQuint((t - T.gather[0] - gd) / (T.gather[1] - T.gather[0] - 0.12));
        const lift = { K: -260, V: 120, i: -60 }[key] * Math.sin(Math.PI * clamp(m)); const base = lerp(abase, g.base, m) + lift;
        const sx = lerp(as, g.sx, m), sy = lerp(as, g.sy, m);
        c.translate(lerp(ax, g.x - L.ink.l * g.sx, m) + L.ink.l * sx, base);
        if (key === 'i') c.transform(1, 0, -0.843 * m, 1, 0, 0);
        c.scale(sx * (1 + ant + beat), sy * (1 - ant + beat)); c.translate(-L.ink.l, (1 - pop) * 40);
        const ga = clamp(u * 3) * (1 - sstep(0.15, 0.7, morphU)); c.globalAlpha = ga; c.fillText(L.ch === 'i' ? 'ı' : L.ch, 0, 0);
        if (L.ch === 'i') { c.restore(); c.save(); c.globalAlpha = ga;
          const mA2 = easeInOutCubic((t - T.pair[0] - (L.i > 9 ? 0.05 : 0)) / (T.pair[1] - T.pair[0])); const sc = lerp(1, layout.MS, mA2) * (1 + spring(t - T.pair[1], 16, 6) * 0.06);
          const r0 = FS * 0.088 * sc, x0 = lerp(L.x + L.w / 2, layout.pmap[L.i] + L.w * layout.MS / 2, mA2), y0 = lerp(L.base, 545 + FS * 0.36 * layout.MS, mA2) - FS * 0.765 * sc + r0;
          const dm = easeOutBack(clamp((t - T.gather[0] - 0.06) / (T.gather[1] - T.gather[0] - 0.12)), 1.4);
          const arcY = -120 * Math.sin(Math.PI * clamp(dm));
          let ph = 0, psq = 0; for (const [h0, h1, hh] of T.pairHops) { if (t >= h0 && t < h1) { const v = (t - h0) / (h1 - h0); ph = -hh * 4 * v * (1 - v); } const d = t - h1; if (d >= 0 && d < 0.1) psq = Math.sin(d / 0.1 * Math.PI) * 0.3; }
          if (psq > 0) { const cxp = lerp(x0, DOT[0] + SEP.i, dm), cyp = lerp(y0, DOT[1], dm) + arcY + r0; c.translate(cxp, cyp); c.scale(1 + psq * 0.5, 1 - psq * 0.4); c.translate(-cxp, -cyp); }
          c.beginPath(); c.arc(lerp(x0, DOT[0] + SEP.i, dm), lerp(y0, DOT[1], dm) + arcY + ph, lerp(r0, DOT[2], clamp(dm)), 0, Math.PI * 2); c.fill(); }
      }
      c.restore();
    }
  }
  // --- S3/S4: geometric letters (outlined, tinted), merging ---
  if (t >= T.morph[0] && t < T.stamp + 0.2) {
    const solid = sstep(T.stamp - 0.08, T.stamp, t);
    const tint = lerp(0.22, 1, solid) * sstep(0.2, 0.8, morphU);
    const sA = (1 - solid);
    // echoes while sliding
    for (const [lag, al] of [[0.07, 0.45], [0.14, 0.22]]) {
      if (t > T.kMerge[0] && t < T.kMerge[1] + 0.12) drawGeo(c, t - lag, 'K', 0, 1, al);
      if (t > T.iMerge[0] && t < T.iMerge[1] + 0.12) drawGeo(c, t - lag, 'i', 0, 1, al);
    }
    for (const key of ['V', 'K', 'i']) drawGeo(c, t, key, tint, easeInOutCubic(morphU * 1.1), sA);
  }
  // --- S5+: the finished logo (single solid shape) ---
  if (t >= T.stamp) {
    const k = t - T.stamp; const pulse = spring(k, 16, 6); const jelly = spring(t - T.hopLand, 18, 6);
    c.save(); c.translate(511, FLOOR); c.scale(1 + pulse * 0.05 + jelly * 0.05, 1 - pulse * 0.04 - jelly * 0.07); c.translate(-511, -FLOOR);
    c.fill(LOGO); c.lineWidth = 2; c.stroke(LOGO); drawDot(c, t); c.restore();
    // speed lines on the hop
    const sl = sstep(T.hopUp, T.hopUp + 0.08, t) * (1 - sstep(T.hopUp + 0.2, T.hopUp + 0.35, t)) + sstep(T.hopLand - 0.18, T.hopLand - 0.1, t) * (1 - sstep(T.hopLand - 0.02, T.hopLand + 0.05, t));
    if (sl > 0) { c.save(); c.globalAlpha = sl; c.lineWidth = 9; c.lineCap = 'round'; const dy = DOT[1] + DOT[2] + dotOffset(t).y; const up = t < (T.hopUp + T.hopLand) / 2;
      for (const o of [-50, 0, 50]) { c.beginPath(); c.moveTo(769 + o, dy + (up ? 40 : -200)); c.lineTo(769 + o, dy + (up ? 130 + Math.abs(o) : -290 + Math.abs(o))); c.stroke(); } c.restore(); }
  }
  drawBursts(c, t);
  c.restore();

  // --- lockup text (screen space) ---
  if (t > T.name2 - 0.05) {
    c.save(); c.font = `800 116px "Inter Display"`; c.fillStyle = INK;
    layout.lk.forEach((L, i) => { const j = L.li === 0 ? i : i - 9; const first = j <= 1; const t0 = first ? T.name2 + j * 0.06 + L.li * 0.1 : T.name2 + 0.42 + (j - 2) * 0.04 + L.li * 0.06; const u = clamp((t - t0) / 0.5); if (u <= 0) return;
      const e = easeOutBack(u, 2.4); c.save(); c.beginPath(); c.rect(L.x - 20, L.base - 128, 162, 162); c.clip();
      c.translate(L.x, L.base + (1 - e) * 122); c.rotate((1 - easeOutExpo(u)) * 0.25); c.fillText(L.ch, 0, 0); c.restore(); });
    layout.tit.forEach((d, i) => { const t0 = (i === 0 || i === 3) ? T.name2 + 0.2 + (i === 3 ? 0.1 : 0) : T.name2 + 0.7 + (i - 1) * 0.1; if (t < t0) return; const u = clamp((t - t0) / 0.42);
      const r = 116 * 0.088, restY = d.base - 116 * 0.765; let y;
      if (u < 0.55) { const v = u / 0.55; y = lerp(restY - 140, restY, v * v); } else { const v = (u - 0.55) / 0.45; y = restY - 26 * 4 * v * (1 - v); }
      const sq = (u > 0.53 && u < 0.66) ? Math.sin((u - 0.53) / 0.13 * Math.PI) * 0.35 : 0;
      c.save(); c.translate(d.x, y + r); c.scale(1 + sq * 0.5, 1 - sq * 0.4); c.beginPath(); c.arc(0, -r, r, 0, Math.PI * 2); c.fill(); c.restore(); });
    const tg = clamp((t - T.tag) / 0.7);
    if (tg > 0) { c.font = '500 34px "Inter Display"'; const track = lerp(26, 6, easeOutExpo(tg)); c.globalAlpha = sstep(0, 0.4, tg);
      const chars = [...'Graphic Design  ·  3D']; const ws = chars.map(ch => c.measureText(ch).width); const tot = ws.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
      let x = W / 2 - tot / 2; chars.forEach((ch, i) => { c.fillText(ch, x, layout.tagY); x += ws[i] + track; }); }
    c.restore();
  }
}

const EV = [T.kMerge[1], T.iMerge[1], T.stamp, T.hopUp, T.hopLand, T.lock[0] + 0.05, T.lock[0] + 0.45];
window.renderFrame = (i, n = 10) => {
  const t = i / FPS; const shutter = 0.5 / FPS;
  for (let k = 0; k < n; k++) { let ts = t + (k / (n - 1) - 0.5) * shutter; for (const e of EV) if ((ts - e) * (t - e) < 0) ts = t;
    drawScene(Math.max(0, ts)); out.globalAlpha = 1 / (k + 1); out.drawImage(buf, 0, 0); }
  out.globalAlpha = 1;
};
window.grab = () => cv.toDataURL('image/png');
document.fonts.load('800 168px "Inter Display"').then(() => document.fonts.load('600 34px "Inter Display"')).then(() => document.fonts.load('500 34px "Inter Display"')).then(() => { window.ready = true; });
