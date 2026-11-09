/* =========================================================
   FLORIS — генератор ілюстрацій букетів (SVG)
   Кожен букет малюється кодом: квіти, зелень, упаковка, стрічка.
   ========================================================= */
(function () {
  'use strict';

  const FLOWER_PALETTES = {
    velvet: ['#5c161e', '#7a1f2b', '#9e2b3b', '#b8394b', '#4a0d16'],
    blush:  ['#f6d5d4', '#f0b9bd', '#e59aa2', '#fbe8e4', '#f7c9c4'],
    snow:   ['#ffffff', '#f7efe9', '#efe3da', '#fdf9f6', '#ece0d6'],
    sunset: ['#f0a77f', '#e57b5f', '#f6c39a', '#d9604f', '#ffd2a8'],
    wild:   ['#c98bb9', '#8d6bb5', '#f2c46d', '#e9e2f5', '#d66a7b'],
  };
  const WRAPS = {
    black: ['#1d1114', '#2c1a1f', '#3a252b'],
    kraft: ['#c9a27e', '#b38b67', '#dcbb98'],
    blush: ['#f2cfcf', '#e2b2b5', '#f8e2e0'],
    cream: ['#efe4da', '#ddcfc3', '#f8f1ea'],
    wine:  ['#5c161e', '#47101a', '#7a1f2b'],
  };

  function rng(seed) {
    let a = (seed * 2654435761) >>> 0 || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function shade(h, p) {
    const [r, g, b] = hex2rgb(h);
    const t = p < 0 ? 0 : 255, k = Math.abs(p);
    const f = (c) => Math.round(c + (t - c) * k);
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  const n2 = (v) => Math.round(v * 10) / 10;

  let uid = 0;

  function petalPath(r, wide) {
    const w = r * (wide || 0.62);
    return `M0,0 C${n2(w)},${n2(-r * 0.18)} ${n2(w * 1.12)},${n2(-r * 0.92)} 0,${n2(-r)} C${n2(-w * 1.12)},${n2(-r * 0.92)} ${n2(-w)},${n2(-r * 0.18)} 0,0Z`;
  }

  function gradient(defs, id, color) {
    defs.push(`<radialGradient id="${id}" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="${shade(color, 0.28)}"/><stop offset=".55" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, -0.32)}"/></radialGradient>`);
    return `url(#${id})`;
  }

  const FLOWERS = {
    rose(x, y, r, color, rnd, defs, id) {
      const g1 = gradient(defs, id + 'a', color);
      const dark = shade(color, -0.45), mid = shade(color, -0.18), light = shade(color, 0.22);
      const rot = rnd() * 360;
      let s = `<g transform="translate(${n2(x)},${n2(y)}) rotate(${n2(rot)})">`;
      for (let i = 0; i < 6; i++) s += `<path d="${petalPath(r, 0.7)}" transform="rotate(${i * 60 + rnd() * 10})" fill="${g1}" stroke="${dark}" stroke-opacity=".35" stroke-width=".8"/>`;
      for (let i = 0; i < 5; i++) s += `<path d="${petalPath(r * 0.74, 0.72)}" transform="rotate(${i * 72 + 30})" fill="${mid}" stroke="${dark}" stroke-opacity=".3" stroke-width=".8"/>`;
      s += `<circle r="${n2(r * 0.44)}" fill="${shade(color, -0.25)}"/>`;
      const a = r * 0.36;
      s += `<path d="M${n2(-a)},0 A${n2(a)},${n2(a)} 0 1 1 ${n2(a * 0.7)},${n2(a * 0.5)} M${n2(-a * 0.55)},${n2(-a * 0.1)} A${n2(a * 0.55)},${n2(a * 0.55)} 0 1 0 ${n2(a * 0.45)},${n2(-a * 0.35)} M${n2(-a * 0.2)},${n2(a * 0.15)} A${n2(a * 0.25)},${n2(a * 0.25)} 0 1 1 ${n2(a * 0.2)},0" fill="none" stroke="${dark}" stroke-width="${n2(Math.max(1.2, r * 0.045))}" stroke-linecap="round"/>`;
      s += `<path d="M${n2(-a * 0.8)},${n2(-a * 0.5)} A${n2(a)},${n2(a)} 0 0 1 ${n2(a * 0.4)},${n2(-a * 0.9)}" fill="none" stroke="${light}" stroke-opacity=".6" stroke-width="${n2(Math.max(1, r * 0.03))}" stroke-linecap="round"/>`;
      return s + '</g>';
    },
    peony(x, y, r, color, rnd, defs, id) {
      const g1 = gradient(defs, id + 'a', color);
      const dark = shade(color, -0.3);
      let s = `<g transform="translate(${n2(x)},${n2(y)}) rotate(${n2(rnd() * 360)})">`;
      const rings = [[10, 1.08, 0.85], [8, 0.86, 0.9], [7, 0.64, 0.95], [5, 0.42, 1]];
      rings.forEach(([cnt, k, w], ri) => {
        for (let i = 0; i < cnt; i++) {
          const fill = ri % 2 ? shade(color, 0.1 + ri * 0.04) : g1;
          s += `<path d="${petalPath(r * k * (0.92 + rnd() * 0.16), w)}" transform="rotate(${n2((i / cnt) * 360 + ri * 17 + rnd() * 12)})" fill="${fill}" stroke="${dark}" stroke-opacity=".22" stroke-width=".7"/>`;
        }
      });
      s += `<circle r="${n2(r * 0.14)}" fill="#f2c46d" opacity=".85"/>`;
      return s + '</g>';
    },
    ranunculus(x, y, r, color, rnd, defs, id) {
      const dark = shade(color, -0.35);
      let s = `<g transform="translate(${n2(x)},${n2(y)})">`;
      for (let i = 0; i < 7; i++) {
        const k = 1 - i * 0.13;
        s += `<circle r="${n2(r * k)}" cx="${n2((rnd() - 0.5) * r * 0.08)}" cy="${n2((rnd() - 0.5) * r * 0.08)}" fill="${shade(color, i % 2 ? 0.12 : -0.04 * i)}" stroke="${dark}" stroke-opacity=".35" stroke-width=".9"/>`;
      }
      s += `<circle r="${n2(r * 0.13)}" fill="#4f6b45"/>`;
      return s + '</g>';
    },
    tulip(x, y, r, color, rnd, defs, id) {
      const g1 = gradient(defs, id + 'a', color);
      const dark = shade(color, -0.35), light = shade(color, 0.18);
      const rot = (rnd() - 0.5) * 40;
      const R = r * 1.05;
      const cup = `M${n2(-R * 0.55)},${n2(R * 0.1)} C${n2(-R * 0.66)},${n2(-R * 0.8)} ${n2(-R * 0.2)},${n2(-R * 1.05)} 0,${n2(-R * 0.82)} C${n2(R * 0.2)},${n2(-R * 1.05)} ${n2(R * 0.66)},${n2(-R * 0.8)} ${n2(R * 0.55)},${n2(R * 0.1)} C${n2(R * 0.42)},${n2(R * 0.62)} ${n2(-R * 0.42)},${n2(R * 0.62)} ${n2(-R * 0.55)},${n2(R * 0.1)}Z`;
      const front = `M${n2(-R * 0.32)},${n2(R * 0.42)} C${n2(-R * 0.5)},${n2(-R * 0.2)} ${n2(-R * 0.12)},${n2(-R * 0.86)} 0,${n2(-R * 0.95)} C${n2(R * 0.12)},${n2(-R * 0.86)} ${n2(R * 0.5)},${n2(-R * 0.2)} ${n2(R * 0.32)},${n2(R * 0.42)}Z`;
      return `<g transform="translate(${n2(x)},${n2(y + r * 0.2)}) rotate(${n2(rot)})"><path d="${cup}" fill="${g1}" stroke="${dark}" stroke-opacity=".35"/><path d="${front}" fill="${light}" opacity=".85" stroke="${dark}" stroke-opacity=".25"/></g>`;
    },
  };

  function greenery(cx, cy, R, rnd, n) {
    let s = '';
    const greens = ['#6f8f7f', '#8fa597', '#5f7d6c', '#a7b8a8'];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * Math.PI * 1.35;
      const len = R * (0.95 + rnd() * 0.45);
      const ex = cx + Math.cos(a) * len * 1.12, ey = cy + Math.sin(a) * len * 0.92;
      const sx = cx + (rnd() - 0.5) * 20, sy = cy + 70;
      const qx = (sx + ex) / 2 + (rnd() - 0.5) * 50, qy = (sy + ey) / 2;
      const g = greens[Math.floor(rnd() * greens.length)];
      s += `<path d="M${n2(sx)},${n2(sy)} Q${n2(qx)},${n2(qy)} ${n2(ex)},${n2(ey)}" stroke="#4d6656" stroke-width="2" fill="none"/>`;
      const eucalyptus = rnd() < 0.6;
      for (let k = 0.35; k <= 1.001; k += 0.13) {
        const t = k, it = 1 - t;
        const px = it * it * sx + 2 * it * t * qx + t * t * ex;
        const py = it * it * sy + 2 * it * t * qy + t * t * ey;
        if (eucalyptus) {
          const side = (Math.round(k * 10) % 2 ? 1 : -1) * 9;
          s += `<circle cx="${n2(px + side * 0.9)}" cy="${n2(py)}" r="${n2(8 + rnd() * 5)}" fill="${g}" opacity=".95"/>`;
        } else {
          const ang = Math.atan2(ey - sy, ex - sx) * 57.3 + (Math.round(k * 10) % 2 ? 50 : -50);
          s += `<ellipse cx="${n2(px)}" cy="${n2(py)}" rx="15" ry="5.5" transform="rotate(${n2(ang)} ${n2(px)} ${n2(py)})" fill="${g}"/>`;
        }
      }
    }
    return s;
  }

  function gypsophila(cx, cy, R, rnd, n) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * R;
      const x = cx + Math.cos(a) * d * 1.15, y = cy + Math.sin(a) * d * 0.8;
      for (let k = 0; k < 5; k++) s += `<circle cx="${n2(x + (rnd() - 0.5) * 14)}" cy="${n2(y + (rnd() - 0.5) * 14)}" r="${n2(2 + rnd() * 2)}" fill="#fffaf5" opacity=".92"/>`;
    }
    return s;
  }

  /**
   * bouquetSVG({ seed, palette, flower, count, wrap, ribbon })
   * flower: rose | peony | tulip | ranunculus | mix
   */
  function bouquetSVG(opts) {
    const o = Object.assign({ seed: 1, palette: 'velvet', flower: 'rose', count: 9, wrap: 'black', ribbon: '#f0b9bd', title: 'Букет' }, opts || {});
    const rnd = rng(o.seed);
    const id = 'b' + (++uid) + '_';
    const defs = [];
    const pal = FLOWER_PALETTES[o.palette] || FLOWER_PALETTES.velvet;
    const wrap = WRAPS[o.wrap] || WRAPS.black;
    const n = Math.max(3, Math.min(31, o.count));
    const cx = 200, cy = 186;
    const R = Math.min(128, 62 + n * 3.6);
    const headR = Math.max(24, 64 - n * 1.45);

    let s = '';
    // задні аркуші упаковки
    s += `<path d="M150,330 L58,${n2(120 - n)} L196,262Z" fill="${wrap[1]}"/>`;
    s += `<path d="M250,330 L342,${n2(124 - n)} L204,262Z" fill="${wrap[1]}"/>`;
    s += `<path d="M168,320 L120,${n2(84 - n)} L232,258Z" fill="${wrap[2]}" opacity=".9"/>`;

    s += greenery(cx, cy, R, rnd, 7 + Math.round(n / 4));

    // квіти
    const heads = [];
    for (let i = 0; i < n; i++) {
      const k = Math.sqrt((i + 0.5) / n);
      const a = i * 2.39996 + o.seed;
      heads.push({
        x: cx + Math.cos(a) * R * k * 1.05 + (rnd() - 0.5) * 6,
        y: cy + Math.sin(a) * R * k * 0.72 - (1 - k) * 18 + (rnd() - 0.5) * 6,
        r: headR * (0.86 + rnd() * 0.3),
      });
    }
    heads.sort((a, b) => a.y - b.y);
    const kinds = o.flower === 'mix' ? ['rose', 'peony', 'ranunculus', 'rose', 'tulip'] : [o.flower];
    heads.forEach((h, i) => {
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      const color = pal[Math.floor(rnd() * pal.length)];
      const fn = FLOWERS[kind] || FLOWERS.rose;
      s += fn(h.x, h.y, h.r, color, rnd, defs, id + i);
    });
    if (o.palette !== 'snow') s += gypsophila(cx, cy - 10, R * 0.95, rnd, Math.round(n / 3) + 2);

    // передній аркуш
    s += `<path d="M96,262 Q200,306 304,262 L232,468 L168,468Z" fill="${wrap[0]}"/>`;
    s += `<path d="M96,262 Q150,290 200,300 L178,468 L168,468Z" fill="${wrap[2]}" opacity=".55"/>`;
    s += `<path d="M96,262 Q200,306 304,262" fill="none" stroke="${wrap[2]}" stroke-width="2" opacity=".8"/>`;
    // стрічка-бант
    const rb = o.ribbon, rbd = shade(rb, -0.25);
    s += `<g transform="translate(200,392)"><path d="M0,0 C-30,-26 -62,-18 -54,4 C-48,20 -18,10 0,0Z" fill="${rb}"/><path d="M0,0 C30,-26 62,-18 54,4 C48,20 18,10 0,0Z" fill="${rb}"/><path d="M-4,2 L-26,58 L-14,52 L-8,62Z" fill="${rbd}"/><path d="M4,2 L24,60 L12,54 L8,63Z" fill="${rbd}"/><ellipse rx="9" ry="8" fill="${rbd}"/></g>`;

    return `<svg viewBox="0 0 400 480" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${o.title}"><defs>${defs.join('')}</defs>${s}</svg>`;
  }

  window.FLORIS_ART = { bouquetSVG, FLOWER_PALETTES, WRAPS };
})();
