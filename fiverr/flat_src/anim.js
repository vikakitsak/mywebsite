// Flat 2D portfolio reel — Ki → NOVA → FLORIS → ADORA → ASANI → AURA → Ki (seamless loop)
const W = 1920, H = 1080, FPS = 60, DUR = 32.5;
const cv = document.getElementById('c'), out = cv.getContext('2d');
const fr = document.createElement('canvas'); fr.width = W; fr.height = H; const F = fr.getContext('2d');
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutBack = (t, s = 2.0) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
const easeInOutCubic = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const easeInOutSine = t => -(Math.cos(Math.PI * clamp(t)) - 1) / 2;
const easeOutCubic = t => 1 - Math.pow(1 - clamp(t), 3);
const easeInQuart = t => clamp(t) ** 4;
const easeOutQuart = t => 1 - (1 - clamp(t)) ** 4;
const easeOutExpo = t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t));
const spring = (t, f = 9, d = 6) => t < 0 ? 0 : Math.exp(-d * t) * Math.sin(f * t);
const hop = (u, t0, t1, h) => (u >= t0 && u < t1) ? h * 4 * ((u - t0) / (t1 - t0)) * (1 - (u - t0) / (t1 - t0)) : 0;
const squash = (u, tc, k = 1, d = 0.14) => { const x = u - tc; return x >= 0 && x < d ? k * Math.sin(x / d * Math.PI) * Math.exp(-x * 6) : 0; };
function hex2rgb(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }
function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], clamp(t)))).join(',')})`; }
function mixHex(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], clamp(t))).toString(16).padStart(2, '0')).join(''); }

let V = null; const P = {}, SUB = {};
async function loadAll() { V = await (await fetch('vec.json')).json();
  for (const n in V) { P[n] = V[n].comps.map(c => new Path2D(c.d)); SUB[n] = V[n].comps.map(c => c.subs.map(s => new Path2D(s.d))); } }

// ---------- camera ----------
const K = 2.45;           // image px -> screen px for portfolio logos (image centre 512,384)
function applyCam(ctx, cam, k = K) { ctx.translate(W / 2, H / 2); ctx.rotate(cam.rot || 0); ctx.scale(k * cam.s, k * cam.s); ctx.translate(-cam.cx, -cam.cy); }
// exponential dive / emerge
const logLerp = (a, b, t) => Math.exp(lerp(Math.log(a), Math.log(b), t));
function dive(cam, u, u0, u1, px, py, sEnd) { const k = clamp((u - u0) / (u1 - u0)); if (k <= 0) return cam; const e = easeInQuart(k);
  return { s: logLerp(cam.s, sEnd, e), cx: lerp(cam.cx, px, Math.min(1, Math.sqrt(e) * 1.2)), cy: lerp(cam.cy, py, Math.min(1, Math.sqrt(e) * 1.2)), rot: cam.rot * (1 - e) + e * 0.25 }; }
function emerge(cam, u, u1, px, py, sStart) { const k = clamp((u - 0.08) / u1); if (k >= 1) return cam; const e = easeOutQuart(k);
  return { s: logLerp(sStart, cam.s, e), cx: lerp(px, cam.cx, Math.min(1, e * e * 1.1)), cy: lerp(py, cam.cy, Math.min(1, e * e * 1.1)), rot: lerp(-0.25, cam.rot, e) }; }

// ---------- drawing helpers ----------
function comp(ctx, n, i, o = {}) {
  const c = V[n].comps[i]; const ax = o.ax ?? c.x + c.w / 2, ay = o.ay ?? c.y + c.h / 2;
  ctx.save(); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.translate(ax + (o.tx || 0), ay + (o.ty || 0)); if (o.rot) ctx.rotate(o.rot); ctx.scale(o.sx ?? 1, o.sy ?? 1); ctx.translate(-ax, -ay);
  if (o.clip) { ctx.beginPath(); o.clip(ctx, c); ctx.clip(); }
  ctx.fillStyle = o.color || c.color;
  if (o.subs) { const p = new Path2D(); o.subs.forEach(j => p.addPath(SUB[n][i][j])); ctx.fill(p, 'evenodd'); } else ctx.fill(P[n][i], 'evenodd');
  ctx.restore();
}
function bgFill(ctx, col) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }

// ================= SCENES (u = local time) =================
// ---- Ki ----
const LIME = '#c8ff2e', INK = '#14210a';
const KI_STEM = new Path2D('M169 320H323V704H169Z'), KI_ARM = new Path2D('M323 486L463 320H640L479 512L554 601L468 704H461L398 626C384 609 372 600 356 600C337 600 323 615 323 638Z'), KI_BAND = new Path2D('M681 451H854L640 704H468Z');
const KK = 0.95;
function drawKi(ctx, cam, u, hopT) {
  bgFill(ctx, LIME); ctx.save(); applyCam(ctx, cam, KK); ctx.fillStyle = INK;
  const land = hopT + 0.4, jel = spring(u - land, 16, 6);
  ctx.save(); ctx.translate(511, 704); ctx.scale(1 + jel * 0.04, 1 - jel * 0.05); ctx.translate(-511, -704); ctx.fill(KI_STEM); ctx.fill(KI_ARM); ctx.fill(KI_BAND); ctx.restore();
  const ant = hopT - u; let sq = squash(u, land, 1); const y = hop(u, hopT, land, 140) * (1 - jel * 0); const pre = ant > 0 && ant < 0.2 ? Math.sin((1 - ant / 0.2) * Math.PI / 2) * 0.3 : 0;
  ctx.save(); ctx.translate(769, 450 - y + 1); const sx = sq > 0 ? 1 + sq * 0.45 : (pre ? 1 + pre * 0.4 : 1), sy = sq > 0 ? 1 - sq * 0.4 : (pre ? 1 - pre * 0.35 : 1);
  ctx.scale(sx, sy); ctx.beginPath(); ctx.arc(0, -65, 65, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.restore();
}
function sKiStart(ctx, u) { let cam = { s: 1, cx: 511.5, cy: 512, rot: 0 }; cam.s = 1 + 0.02 * u; cam = dive(cam, u, 1.55, 2.5, 769, 385, 60); drawKi(ctx, cam, u, 0.55); }
function sKiEnd(ctx, u) { let cam = { s: 1, cx: 511.5, cy: 512, rot: 0 }; cam = emerge(cam, u, 1.2, 769, 385, 60); drawKi(ctx, cam, u, 1.45); }

// ---- NOVA (tea bar: leaves drift down like tea leaves) ----
// comps: N0 V1 A2 Obox3 leafO4 leafA5
function sNova(ctx, u) {
  const bg = mixHex(mixHex('#445123', '#2f3a17', sstep(2.85, 3.4, u)), '#445123', sstep(4.0, 4.6, u)); bgFill(ctx, bg);
  const lo = V.nova.comps[4], la = V.nova.comps[5];
  // leaf O: emerges at (470,230), drifts down swaying, lands in O at 1.6; lifts out at 4.4
  const fall = clamp((u - 0.55) / 1.05); const ef = easeInOutSine(fall);
  const homeO = [lo.x + lo.w / 2, lo.y + lo.h / 2]; const start = [470, 240];
  let lx = lerp(start[0], homeO[0], ef) + Math.sin(fall * Math.PI * 2.2) * 26 * (1 - ef), ly = lerp(start[1], homeO[1], ef), lrot = Math.sin(fall * Math.PI * 2.2 + 0.6) * 0.55 * (1 - ef);
  const lift = easeInOutCubic((u - 4.35) / 0.55); ly -= lift * 260; lx += lift * 30; lrot += lift * 0.6;
  // camera: follow leaf closely, then pull back
  let cam = { s: lerp(3.0, 1.0, easeInOutCubic((u - 1.3) / 1.4)), cx: lerp(lx, 512, easeInOutCubic((u - 1.2) / 1.4)), cy: lerp(ly, 384, easeInOutCubic((u - 1.2) / 1.4)), rot: lerp(0.06, 0, easeInOutCubic((u - 0.8) / 2)) + 0.012 * Math.sin(u * 0.9) };
  cam.s *= 1 + 0.025 * sstep(2.8, 4.3, u);
  cam = emerge(cam, u, 0.6, start[0], start[1], 60);
  const cO = V.nova.comps[3]; cam = dive(cam, u, 4.6, 5.5, cO.x + cO.w / 2, cO.y + cO.h / 2 + 2, 55);
  ctx.save(); applyCam(ctx, cam);
  const wave = i => hop(u, 3.7 + i * 0.09, 4.0 + i * 0.09, 7);
  // O box opens to receive the leaf
  const ob = easeOutBack((u - 1.0) / 0.45, 2.4); const osq = squash(u, 1.6, 0.7);
  if (u > 1.0) comp(ctx, 'nova', 3, { ay: cO.y + cO.h, sx: ob * (1 + osq * 0.12), sy: ob * (1 - osq * 0.12), ty: -wave(1) });
  // N from left, V from top, A from bottom
  const cN = V.nova.comps[0], cV = V.nova.comps[1], cA = V.nova.comps[2];
  const nv = easeOutBack((u - 1.7) / 0.5, 1.6); if (u > 1.7) comp(ctx, 'nova', 0, { tx: (1 - nv) * -260, ty: -wave(0), clip: x => x.rect(cN.x - 400 + (1 - 1) * 0, 0, 2000, 2000) });
  const vv = easeOutBack((u - 1.85) / 0.5, 1.8); if (u > 1.85) comp(ctx, 'nova', 1, { ty: (1 - vv) * -200 - wave(2), alpha: sstep(0, 0.15, u - 1.85) });
  const av = easeOutBack((u - 2.0) / 0.5, 1.8); const asq = squash(u, 2.95, 0.7);
  if (u > 2.0) comp(ctx, 'nova', 2, { ty: (1 - av) * 200 - wave(3), ay: cA.y + cA.h, sx: 1 + asq * 0.1, sy: 1 - asq * 0.1, alpha: sstep(0, 0.15, u - 2.0) });
  // leaf A: drifts in from upper right, lands at 2.95
  const fa = clamp((u - 2.0) / 0.95); const ea = easeInOutSine(fa); const homeA = [la.x + la.w / 2, la.y + la.h / 2];
  if (u > 2.0) comp(ctx, 'nova', 5, { tx: lerp(60, 0, ea) + Math.sin(fa * Math.PI * 2) * 18 * (1 - ea), ty: lerp(-170, 0, ea) - wave(3), rot: Math.sin(fa * Math.PI * 2 + 0.5) * 0.5 * (1 - ea) + Math.sin(u * 2.1) * 0.05 * sstep(3, 3.5, u), alpha: sstep(0, 0.2, fa) });
  // leaf O
  const sway = Math.sin(u * 2.3) * 0.05 * sstep(1.8, 2.4, u) * (1 - lift);
  comp(ctx, 'nova', 4, { tx: lx - homeO[0], ty: ly - homeO[1] - wave(1) * (1 - lift), rot: lrot + sway });
  ctx.restore();
}
// ---- FLORIS (flowers: stem grows, letters sprout, leaves on R unfurl) ----
// comps: F0, L+bar+R 1 (subs: 0 outer, 1 bowl, 2 leaf small, 3 leaf tall), O2 (subs 0 outer,1 counter), S3
function sFloris(ctx, u) {
  const bg = mixHex(mixHex('#5c161e', '#8a2637', sstep(2.75, 3.2, u)), '#5c161e', sstep(4.0, 4.5, u)); bgFill(ctx, bg);
  const cO = V.floris.comps[2], cB = V.floris.comps[1]; const oc = [cO.x + cO.w / 2, cO.y + cO.h / 2];
  const grow = easeInOutCubic((u - 0.55) / 0.9); const frontX = lerp(cB.x - 5, cB.x + cB.w + 5, grow);
  const leafC = [597, 366];
  let cam = { s: 1, cx: 512, cy: 384, rot: 0.01 * Math.sin(u * 0.8) };
  // follow stem front, pull back, close-up on R leaves, pull back
  const fol = 1 - sstep(1.3, 2.0, u); cam.s = lerp(1, 1.9, fol); cam.cx = lerp(512, lerp(oc[0], frontX, sstep(0.5, 0.8, u)), fol); cam.cy = lerp(384, oc[1] + 10, fol);
  const cu = sstep(2.25, 2.85, u) * (1 - sstep(3.35, 3.95, u)); cam.s = lerp(cam.s, 4.2, cu); cam.cx = lerp(cam.cx, leafC[0], cu); cam.cy = lerp(cam.cy, leafC[1], cu); cam.rot += cu * -0.05;
  cam = emerge(cam, u, 0.6, oc[0], oc[1] + 2, 50);
  cam = dive(cam, u, 4.6, 5.5, 598.5, 374.5, 70);
  ctx.save(); applyCam(ctx, cam);
  const base = cB.y + cB.h;
  // stem (L+bar+R) grows left->right
  if (grow > 0) comp(ctx, 'floris', 1, { subs: [0, 1], clip: x => x.rect(0, 0, frontX, 2000) });
  // R leaves unfurl (cut-outs grow from their base)
  [[2, 2.55], [3, 2.7]].forEach(([j, t0]) => { const s = V.floris.comps[1].subs[j]; const v = easeOutBack((u - t0) / 0.5, 2.0); if (grow < 1) return;
    ctx.save(); const bx = s.x + (j === 2 ? 0 : s.w * 0.6), by = s.y + s.h; ctx.translate(bx, by); ctx.rotate((1 - clamp(v)) * (j === 2 ? -0.9 : 0.9)); ctx.scale(v, v); ctx.translate(-bx, -by);
    ctx.fillStyle = bg; ctx.fill(SUB.floris[1][j]); ctx.restore(); });
  // O floats, then settles onto the stem
  const settle = easeOutBack((u - 1.15) / 0.4, 2.2); const osq = squash(u, 1.55, 0.8);
  comp(ctx, 'floris', 2, { ty: (1 - clamp(settle)) * -40 - (u < 1.15 ? Math.sin(u * 3) * 6 : 0) - hop(u, 3.9, 4.25, 18), ay: cO.y + cO.h, sx: 1 + osq * 0.1, sy: 1 - osq * 0.12 });
  // F and S sprout from the baseline
  [[0, 1.45], [3, 1.65]].forEach(([i, t0]) => { const v = easeOutBack((u - t0) / 0.5, 2.2); if (u < t0) return; const c = V.floris.comps[i];
    comp(ctx, 'floris', i, { ay: base, sy: v, sx: lerp(0.7, 1, clamp(v)), rot: Math.sin((u - t0) * 9) * 0.06 * Math.exp(-(u - t0) * 4) }); });
  ctx.restore();
}
// ---- ADORA (face care: symbol opens into four petals and closes) ----
// comps: symbol0, A1 D2 R3 A4 Oleft5 Oright6 star7
function sAdora(ctx, u) {
  const bg = mixHex(mixHex('#3b0f13', '#5b2a35', sstep(1.75, 2.3, u)), '#3b0f13', sstep(4.0, 4.5, u)); bgFill(ctx, bg);
  const cS = V.adora.comps[0], cx0 = cS.x + cS.w / 2, cy0 = cS.y + cS.h / 2; const hole = V.adora.comps[0].subs[2]; const hp = [hole.x + hole.w / 2, hole.y + hole.h / 2];
  let cam = { s: lerp(2.3, 1.0, easeInOutCubic((u - 0.6) / 1.9)), cx: lerp(cx0, 512, easeInOutCubic((u - 1.2) / 1.5)), cy: lerp(cy0, 384, easeInOutCubic((u - 1.2) / 1.5)), rot: lerp(-0.08, 0, easeInOutCubic((u - 0.5) / 1.8)) };
  cam.s *= 1 + 0.02 * sstep(2.6, 4.4, u);
  cam = emerge(cam, u, 0.6, hp[0], hp[1], 55);
  const st = V.adora.comps[7]; cam = dive(cam, u, 4.6, 5.5, st.x + st.w / 2, st.y + st.h / 2, 140);
  ctx.save(); applyCam(ctx, cam);
  // petals: open 0.6-1.3, close with a click at 1.75; breathe again 4.0-4.4
  const open = sstep(0.6, 1.3, u) * (1 - easeOutBack((u - 1.35) / 0.4, 2.5)) + hop(u, 3.95, 4.45, 0.35);
  const symRot = easeInOutCubic((u - 2.6) / 1.3) * Math.PI / 2;
  for (let q = 0; q < 4; q++) { const a = -Math.PI / 2 + q * Math.PI / 2; const d = open * 34;
    comp(ctx, 'adora', 0, { ax: cx0, ay: cy0, tx: Math.cos(a + symRot) * d, ty: Math.sin(a + symRot) * d, rot: symRot + open * 0.18 * (q % 2 ? 1 : -1),
      clip: x => { x.moveTo(cx0, cy0); x.arc(cx0, cy0, 400, a - Math.PI / 4, a + Math.PI / 4); x.closePath(); } }); }
  // wordmark rises letter by letter; O halves meet; star spins in
  const letters = [[1, 1.85], [2, 1.95], [3, 2.25], [4, 2.35]];
  const baseY = 527;
  for (const [i, t0] of letters) { const v = easeOutBack((u - t0) / 0.5, 1.6); if (u < t0) continue;
    comp(ctx, 'adora', i, { ty: (1 - v) * 70, clip: x => x.rect(0, 0, 2000, baseY + 2) }); }
  const ov = easeOutBack((u - 2.05) / 0.5, 1.8); if (u > 2.05) { comp(ctx, 'adora', 5, { tx: (1 - ov) * -40, alpha: sstep(0, 0.2, u - 2.05) }); comp(ctx, 'adora', 6, { tx: (1 - ov) * 40, alpha: sstep(0, 0.2, u - 2.05) }); }
  const sv = easeOutBack((u - 2.15) / 0.6, 2.2); if (u > 2.15) comp(ctx, 'adora', 7, { sx: sv, sy: sv, rot: (1 - clamp(sv)) * Math.PI + easeInOutCubic((u - 4.1) / 0.6) * Math.PI / 2 });
  ctx.restore();
}
// ---- ASANI (yoga studio: one flowing line, then a breath) ----
function sAsani(ctx, u) {
  const bg = mixHex(mixHex('#040404', '#15292c', sstep(2.6, 3.1, u)), '#040404', sstep(3.6, 4.3, u)); bgFill(ctx, bg);
  const cM = V.asani.comps[0], cI = V.asani.comps[1]; const ic = [cI.x + cI.w / 2, cI.y + cI.h / 2];
  const flow = easeInOutCubic((u - 0.55) / 1.25); const front = lerp(cM.x + cM.w + 10, cM.x - 30, flow);
  let cam = { s: 1, cx: 512, cy: 384, rot: 0 };
  const fol = 1 - sstep(1.6, 2.4, u); cam.s = lerp(1, 2.1, fol); cam.cx = lerp(512, lerp(ic[0], front + 70, sstep(0.45, 0.8, u)), fol); cam.cy = lerp(384, 384, fol); cam.rot = 0.04 * fol + 0.01 * Math.sin(u * 0.8);
  const iHop = hop(u, 4.3, 4.75, 30);
  cam = emerge(cam, u, 0.6, ic[0], ic[1], 140);
  cam = dive(cam, u, 4.6, 5.5, ic[0], ic[1] - iHop * 0, 140);
  ctx.save(); applyCam(ctx, cam);
  // breathing: inhale (tall), exhale (wide)
  const inh = easeInOutSine((u - 2.45) / 0.6) * (1 - easeInOutSine((u - 3.05) / 0.6)); const exh = easeInOutSine((u - 3.05) / 0.6) * (1 - easeInOutSine((u - 3.65) / 0.6));
  const sx = 1 - 0.06 * inh + 0.05 * exh, sy = 1 + 0.12 * inh - 0.07 * exh; const baseY = cM.y + cM.h;
  ctx.save(); ctx.translate(512, baseY); ctx.scale(sx, sy); ctx.translate(-512, -baseY);
  if (u > 0.55) comp(ctx, 'asani', 0, { clip: (x, c) => { x.moveTo(3000, -500); x.lineTo(3000, 1500); x.lineTo(front, 1500);
    for (let y = 1500; y >= -500; y -= 8) x.lineTo(front + Math.sin(y / 9 + u * 6) * 9 * (1 - flow), y); x.closePath(); } });
  comp(ctx, 'asani', 1, { ty: -iHop, ay: cI.y + cI.h, sy: 1 + squash(u, 4.75, 0.3) * -0.6 });
  ctx.restore(); ctx.restore();
}
// ---- AURA (sushi: fish heads swim in, salmon lands in the U) ----
// comps: U0 R1 A2(right) A1(left)=3, eyeR4, eyeL5, salmon 6..10 (orange)
function sAura(ctx, u) {
  const bg = mixHex(mixHex('#040404', '#0b2233', sstep(2.85, 3.4, u)), '#040404', sstep(4.0, 4.5, u)); bgFill(ctx, bg);
  const eL = V.aura.comps[5], eR = V.aura.comps[4]; const pL = [eL.x + eL.w / 2, eL.y + eL.h / 2], pR = [eR.x + eR.w / 2, eR.y + eR.h / 2];
  const c3 = V.aura.comps[3], c2 = V.aura.comps[2];
  // left fish swims in from the left
  const sl = clamp((u - 0.5) / 1.1); const esl = easeOutCubic(sl); const lx = lerp(-150, 0, esl), ly = Math.sin(sl * Math.PI * 3) * 10 * (1 - esl), lr = Math.sin(sl * Math.PI * 3 + 1) * 0.12 * (1 - esl);
  const sr = clamp((u - 2.15) / 0.9); const esr = easeOutCubic(sr); const rx = lerp(220, 0, esr), ry = Math.sin(sr * Math.PI * 3) * 10 * (1 - esr), rr = Math.sin(sr * Math.PI * 3 + 1) * 0.12 * (1 - esr);
  const nodL = Math.sin(u * 6) * 0.05 * sstep(3.0, 3.3, u) * (1 - sstep(3.9, 4.2, u)), nodR = Math.sin(u * 6 + 1.6) * 0.05 * sstep(3.0, 3.3, u) * (1 - sstep(3.9, 4.2, u));
  let cam = { s: lerp(2.6, 1.0, easeInOutCubic((u - 0.9) / 1.6)), cx: lerp(pL[0] + lx * 0.5, 512, easeInOutCubic((u - 1.0) / 1.5)), cy: lerp(pL[1], 384, easeInOutCubic((u - 1.0) / 1.5)), rot: lerp(0.05, 0, easeInOutCubic((u - 0.5) / 1.8)) + 0.01 * Math.sin(u) };
  cam.s *= 1 + 0.025 * sstep(2.6, 4.4, u);
  cam = emerge(cam, u, 0.6, pL[0] - 150, pL[1], 140);
  cam = dive(cam, u, 4.6, 5.5, pR[0], pR[1], 140);
  ctx.save(); applyCam(ctx, cam);
  const blink = (t0) => { const d = u - t0; return d > 0 && d < 0.2 ? 1 - 0.9 * Math.sin(d / 0.2 * Math.PI) : 1; };
  // left fish head + eye
  comp(ctx, 'aura', 3, { tx: lx, ty: ly, rot: lr + nodL, ax: c3.x + c3.w / 2, ay: c3.y + c3.h });
  ctx.save(); ctx.translate(c3.x + c3.w / 2 + lx, c3.y + c3.h + ly); ctx.rotate(lr + nodL); ctx.translate(-(c3.x + c3.w / 2), -(c3.y + c3.h));
  comp(ctx, 'aura', 5, { sy: blink(1.25) * blink(3.75) }); ctx.restore();
  // U drops in, salmon slice lands in it, R pops
  const cU = V.aura.comps[0]; const uv = clamp((u - 1.45) / 0.35); const usq = squash(u, 1.8, 0.8) + squash(u, 2.12, 0.5);
  if (u > 1.45) comp(ctx, 'aura', 0, { ty: -(1 - uv * uv) * 260, ay: cU.y + cU.h, sx: 1 + usq * 0.1, sy: 1 - usq * 0.12, alpha: sstep(0, 0.1, u - 1.45) });
  const svv = clamp((u - 1.8) / 0.32); if (u > 1.8) for (let i = 6; i <= 10; i++) comp(ctx, 'aura', i, { ty: -(1 - svv * svv) * 180 - hop(u, 3.6, 3.85, 6), sy: 1 - squash(u, 2.12, 0.6) * 0.25, ay: 410, alpha: sstep(0, 0.1, u - 1.8) });
  const rv = easeOutBack((u - 1.95) / 0.4, 2.4); if (u > 1.95) comp(ctx, 'aura', 1, { sx: rv, sy: rv, ay: V.aura.comps[1].y + V.aura.comps[1].h });
  // right fish swims in from the right
  if (u > 2.15) { comp(ctx, 'aura', 2, { tx: rx, ty: ry, rot: rr + nodR, ax: c2.x + c2.w / 2, ay: c2.y + c2.h, alpha: sstep(0, 0.15, u - 2.15) });
    ctx.save(); ctx.translate(c2.x + c2.w / 2 + rx, c2.y + c2.h + ry); ctx.rotate(rr + nodR); ctx.translate(-(c2.x + c2.w / 2), -(c2.y + c2.h));
    comp(ctx, 'aura', 4, { sy: blink(3.3) * blink(4.25), alpha: sstep(0, 0.15, u - 2.15) }); ctx.restore(); }
  ctx.restore();
}

// ================= TIMELINE =================
// each boundary: A dives into an element (colour cA); B emerges from an element (colour cB); a short colour morph hides the cut
const SCENES = [
  [0.0, 2.5, sKiStart, null, INK],
  [2.5, 8.0, sNova, '#ffffff', '#445123'],
  [8.0, 13.5, sFloris, '#5c161e', '#5c161e'],
  [13.5, 19.0, sAdora, '#3b0f13', '#ebddc9'],
  [19.0, 24.5, sAsani, '#ffffff', '#ffffff'],
  [24.5, 30.0, sAura, '#ffffff', '#ffffff'],
  [30.0, 32.5, sKiEnd, INK, null],
];
function drawFrame(ctx, t) {
  for (let k = 0; k < SCENES.length; k++) { const [a, b, fn, inCol] = SCENES[k]; if (t < b || k === SCENES.length - 1) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; fn(ctx, t - a);
    // colour morph at the start of a scene: from previous scene's dive colour to this scene's emerge colour
    const prevOut = k > 0 ? SCENES[k - 1][4] : null; const m = (t - a) / 0.14;
    const outCol = SCENES[k][4]; const e2 = (t - (b - 0.12)) / 0.12;
    if (outCol && k < SCENES.length - 1 && e2 > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = easeInOutCubic(e2); ctx.fillStyle = outCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (prevOut && m < 1) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1 - easeInOutCubic(m); ctx.fillStyle = prevOut; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    return; } }
}
const CUTS = SCENES.slice(1).map(s => s[0]);
window.renderFrame = (i, n0 = 8) => {
  const t = Math.round(i / FPS * 1e6) / 1e6; const shutter = 0.5 / FPS;
  const nearCut = SCENES.some(([a0, b0]) => (t > b0 - 0.95 && t < b0 + 0.85) && b0 < DUR); const n = nearCut ? 28 : n0;
  for (let k = 0; k < n; k++) { let ts = t + (n === 1 ? 0 : (k / (n - 1) - 0.5) * shutter); for (const e of CUTS) if ((t >= e) !== (ts >= e)) ts = t;
    drawFrame(F, Math.max(0, ts)); out.globalAlpha = 1 / (k + 1); out.drawImage(fr, 0, 0); }
  out.globalAlpha = 1;
};
window.grab = () => cv.toDataURL('image/jpeg', 0.94);
loadAll().then(() => { window.ready = true; });
