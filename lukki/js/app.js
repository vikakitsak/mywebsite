/* =========================================================
   Lukki — page interactions
   ========================================================= */
(function () {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const ICON = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-8-5.2-8-11a4.8 4.8 0 0 1 8-3.5A4.8 4.8 0 0 1 20 10c0 5.8-8 11-8 11Z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-opacity=".3"/><path d="M7 12.5l3.5 3.5L17 9"/></svg>',
  };

  /* ---------- goods (edit here) ---------- */
  const GOODS = [
    { id: 'tee', name: 'Organic Tee', note: 'Soft organic cotton with an embroidered logo', price: 29, img: 'assets/img/tee-logo.webp', tag: 'Bestseller' },
    { id: 'tote', name: 'Everyday Tote', note: 'Reusable cotton bag for groceries & travel', price: 18, img: 'assets/img/tote-bag.webp', pos: '55% 50%' },
    { id: 'box', name: 'Gift Box', note: 'Cotton-paper box with the Lukki pattern', price: 12, img: 'assets/img/gift-box.webp', pos: '35% 45%' },
    { id: 'notebook', name: 'Field Notebook', note: 'Forest-green hardcover, recycled pages', price: 14, img: 'assets/img/brandbook.webp', pos: '45% 55%', tag: 'New' },
    { id: 'stickers', name: 'Sticker Set', note: 'Round stickers to seal & decorate', price: 6, img: 'assets/img/stickers.webp' },
    { id: 'cards', name: 'Thank-you Cards', note: 'A set of 6 cards on textured paper', price: 9, img: 'assets/img/postcards.webp', pos: '50% 45%' },
  ];

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('.toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- nav ---------- */
  const burger = $('.nav__burger');
  burger.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', open);
    $('.mobile-menu').setAttribute('aria-hidden', !open);
  });
  $$('.mobile-menu a').forEach((a) => a.addEventListener('click', () => { document.body.classList.remove('menu-open'); burger.setAttribute('aria-expanded', false); }));
  const links = $$('.nav__links a');
  const spy = new IntersectionObserver((ents) => ents.forEach((en) => {
    if (en.isIntersecting) links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['story', 'why', 'goods', 'impact', 'join'].forEach((id) => { const el = document.getElementById(id); el && spy.observe(el); });

  /* ---------- reveal ---------- */
  const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.15 });
  $$('[data-in]').forEach((el) => io.observe(el));

  /* ---------- manifesto: split into words ---------- */
  const mf = $('[data-words]');
  const words = [];
  if (mf) {
    const out = document.createDocumentFragment();
    [...mf.childNodes].forEach((n) => {
      const hl = n.nodeType === 1 && n.tagName === 'MARK';
      (n.textContent || '').split(/(\s+)/).forEach((w) => {
        if (!w) return;
        if (/^\s+$/.test(w)) { out.appendChild(document.createTextNode(' ')); return; }
        const s = document.createElement('span'); s.textContent = w; if (hl) s.className = 'hl';
        out.appendChild(s); words.push(s);
      });
    });
    mf.textContent = ''; mf.appendChild(out);
  }

  /* ---------- horizontal scroll ---------- */
  const hs = $('.hscroll'), track = $('.hscroll__track'), hsBar = $('.hscroll__bar i');
  function sizeH() {
    if (!hs) return;
    const extra = Math.max(0, track.scrollWidth - innerWidth);
    hs.style.height = innerHeight + extra + 'px';
  }

  /* ---------- scroll-driven effects ---------- */
  const prog = $('.progress');
  function onScroll() {
    const y = scrollY, vh = innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    prog.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

    if (mf) {
      const sec = $('.manifesto'), r = sec.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / (r.height - vh) * 1.15));
      const n = Math.round(p * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    }
    if (hs) {
      const r = hs.getBoundingClientRect();
      const range = hs.offsetHeight - vh;
      const p = range > 0 ? Math.min(1, Math.max(0, -r.top / range)) : 0;
      track.style.transform = `translate3d(${-p * Math.max(0, track.scrollWidth - innerWidth)}px,0,0)`;
      hsBar.style.transform = `scaleX(${p})`;
    }
  }
  let ticking = false;
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { onScroll(); ticking = false; }); } }, { passive: true });
  addEventListener('resize', () => { sizeH(); onScroll(); });
  addEventListener('load', () => { sizeH(); onScroll(); });
  sizeH(); onScroll();

  /* ---------- slogans ---------- */
  const sl = $('.slogan'), dots = $('.slogan-dots');
  if (sl) {
    const list = JSON.parse(sl.dataset.slogans);
    let cur = -1, timer;
    dots.innerHTML = list.map((s, i) => `<button type="button" aria-label="Slogan ${i + 1}"></button>`).join('');
    const render = (txt) => {
      sl.innerHTML = '';
      let i = 0;
      txt.split(' ').forEach((word, wi) => {
        const w = document.createElement('span'); w.style.whiteSpace = 'nowrap';
        [...word].forEach((c) => { const s = document.createElement('span'); s.className = 'ch'; s.textContent = c; s.style.setProperty('--i', i++); w.appendChild(s); });
        sl.appendChild(w);
        if (wi < txt.split(' ').length - 1) sl.appendChild(document.createTextNode(' '));
      });
      sl.setAttribute('aria-label', txt);
    };
    const show = (k) => {
      k = (k + list.length) % list.length; if (k === cur) return;
      const chars = $$('.ch', sl);
      chars.forEach((c) => c.classList.add('out'));
      setTimeout(() => render(list[k]), chars.length && !reduce ? 380 : 0);
      cur = k;
      $$('button', dots).forEach((b, i) => b.classList.toggle('on', i === k));
    };
    const auto = () => { clearInterval(timer); timer = setInterval(() => show(cur + 1), 3800); };
    dots.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { show($$('button', dots).indexOf(b)); auto(); } });
    show(0); auto();

    // floating objects follow the mouse at different depths
    const fl = $$('.floater');
    const sec = $('.slogans');
    let mx = 0, my = 0, cx = 0, cy = 0;
    sec.addEventListener('pointermove', (e) => { const r = sec.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5; });
    (function tick() {
      cx += (mx - cx) * 0.06; cy += (my - cy) * 0.06;
      const r = sec.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) {
        const sp = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        fl.forEach((f, i) => {
          const d = parseFloat(f.dataset.depth);
          f.style.transform = `translate3d(${cx * 80 * d}px, ${cy * 60 * d + sp * -120 * d}px, 0) rotate(${(i % 2 ? 1 : -1) * (6 + cx * 10 * d)}deg)`;
        });
      }
      requestAnimationFrame(tick);
    })();
  }

  /* ---------- goods carousel (drag with inertia) ---------- */
  let saved = store.get('lukki-saved', []);
  const gt = $('#goods-track');
  if (gt) {
    gt.innerHTML = GOODS.map((g) => `
      <article class="good" data-id="${g.id}">
        <div class="good__img">${g.tag ? `<span class="good__tag">${g.tag}</span>` : ''}<img src="${g.img}" alt="${g.name}" loading="lazy" style="object-position:${g.pos || '50% 50%'}" draggable="false"></div>
        <div class="good__row"><div><h3>${g.name}</h3><p>$${g.price} · ${g.note}</p></div>
          <button type="button" data-open="${g.id}" aria-label="View ${g.name}">${ICON.plus}</button></div>
      </article>`).join('');
    const car = $('.carousel');
    let x = 0, v = 0, dragging = false, startX = 0, startPos = 0, moved = 0, lastX = 0, lastT = 0;
    const maxX = () => Math.min(0, car.clientWidth - gt.scrollWidth);
    car.addEventListener('pointerdown', (e) => {
      dragging = true; moved = 0; startX = lastX = e.clientX; startPos = x; v = 0; lastT = performance.now();
      car.classList.add('dragging');
    });
    addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const now = performance.now();
      x = startPos + (e.clientX - startX);
      v = (e.clientX - lastX) / Math.max(1, now - lastT) * 16;
      lastX = e.clientX; lastT = now; moved = Math.max(moved, Math.abs(e.clientX - startX));
    });
    addEventListener('pointerup', () => { if (dragging) { dragging = false; car.classList.remove('dragging'); } });
    car.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    $$('[data-car]').forEach((b) => b.addEventListener('click', () => { v = 0; target = Math.max(maxX(), Math.min(0, x - +b.dataset.car * (gt.firstElementChild.offsetWidth + 20) * 1.5)); }));
    let target = null;
    (function tick() {
      if (!dragging) {
        if (target !== null) { x += (target - x) * 0.12; if (Math.abs(target - x) < 0.5) { x = target; target = null; } }
        else { x += v; v *= 0.93; }
        const mn = maxX();
        if (x > 0) { x *= 0.85; v = 0; } else if (x < mn) { x = mn + (x - mn) * 0.85; v = 0; }
      }
      gt.style.transform = `translate3d(${x}px,0,0)`;
      requestAnimationFrame(tick);
    })();
  }

  /* ---------- product modal ---------- */
  const modal = $('#modal');
  function openGood(id) {
    const g = GOODS.find((x) => x.id === id); if (!g) return;
    const isSaved = saved.includes(id);
    $('.modal__box', modal).innerHTML = `
      <button class="modal__close" type="button" aria-label="Close">${ICON.close}</button>
      <div class="modal__img"><img src="${g.img}" alt="${g.name}" style="object-position:${g.pos || '50% 50%'}"></div>
      <div class="modal__body">
        <span class="kicker">Lukki goods</span>
        <h3>${g.name}</h3>
        <span class="price">$${g.price}</span>
        <p style="margin:0;opacity:.8">${g.note}. Packed in cotton paper made from textile waste — zero plastic, as always.</p>
        <button class="btn btn--forest" type="button" data-save="${id}" style="justify-content:center">${isSaved ? 'Saved to wishlist ✓' : 'Save to wishlist'}</button>
        <form class="field" id="notify" novalidate style="margin-top:6px"><label for="n-email">Get notified when it drops</label>
          <div style="display:flex;gap:8px"><input id="n-email" type="email" placeholder="you@email.com" required><button class="btn" type="submit">Notify</button></div>
          <span class="err">Please check your email</span></form>
      </div>`;
    modal.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(() => $('.modal__close', modal).focus(), 50);
    $('#notify', modal).addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.currentTarget, inp = $('input', f);
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value.trim());
      f.classList.toggle('bad', !ok); if (!ok) return;
      const list = store.get('lukki-notify', []); list.push({ id, email: inp.value.trim(), at: new Date().toISOString() }); store.set('lukki-notify', list);
      f.innerHTML = `<p style="margin:0;font-weight:700;color:var(--olive)">You're on the list — we'll email you when ${g.name} drops 🌿</p>`;
    });
  }
  function closeModal() { modal.classList.remove('open'); document.documentElement.style.overflow = ''; }
  document.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]'); if (o) openGood(o.dataset.open);
    if (e.target === modal || e.target.closest('.modal__close')) closeModal();
    const s = e.target.closest('[data-save]');
    if (s) {
      const id = s.dataset.save;
      saved = saved.includes(id) ? saved.filter((x) => x !== id) : saved.concat(id);
      store.set('lukki-saved', saved);
      const on = saved.includes(id);
      s.textContent = on ? 'Saved to wishlist ✓' : 'Save to wishlist';
      toast(on ? `Saved · ${saved.length} in your wishlist` : 'Removed from wishlist');
    }
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); document.body.classList.remove('menu-open'); } });

  /* ---------- impact calculator ---------- */
  const items = $('#items');
  if (items) {
    const fmt = (n, d = 0) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
    const shown = { l: 0, b: 0, y: 0 }; let raf;
    const calc = () => {
      const n = +items.value, per = +$('input[name=kind]:checked').value;
      const litres = n * per;
      $('#items-out').textContent = n;
      items.style.setProperty('--p', ((n - items.min) / (items.max - items.min)) * 100 + '%');
      const target = { l: litres, b: litres / 150, y: litres / 2 / 365 };
      cancelAnimationFrame(raf);
      const step = () => {
        let done = true;
        for (const k in target) { shown[k] += (target[k] - shown[k]) * 0.18; if (Math.abs(target[k] - shown[k]) > 0.05) done = false; else shown[k] = target[k]; }
        $('#r-litres').textContent = fmt(shown.l);
        $('#r-baths').textContent = fmt(shown.b);
        $('#r-years').textContent = fmt(shown.y, 1);
        if (!done) raf = requestAnimationFrame(step);
      };
      step();
      const drops = Math.min(60, Math.round(target.b / 3));
      const box = $('.drops');
      while (box.children.length < drops) box.appendChild(document.createElement('i'));
      while (box.children.length > drops) box.lastChild.remove();
    };
    items.addEventListener('input', calc);
    $$('input[name=kind]').forEach((r) => r.addEventListener('change', calc));
    calc();
  }

  /* ---------- join form ---------- */
  const jf = $('#join-form');
  if (jf) {
    let role = 'shopper';
    $$('.tabs button', jf).forEach((b) => b.addEventListener('click', () => {
      role = b.dataset.role;
      $$('.tabs button', jf).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
      jf.classList.toggle('partner', role === 'partner');
      $('button[type=submit]', jf).textContent = role === 'partner' ? 'Apply as a brand' : 'Join the waitlist';
    }));
    jf.addEventListener('input', (e) => { const f = e.target.closest('.field'); f && f.classList.remove('bad'); });
    jf.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;
      const check = (sel, valid) => { const el = $(sel, jf); const f = el.closest('.field'); f.classList.toggle('bad', !valid); if (!valid && ok) { el.focus(); ok = false; } };
      check('#j-name', $('#j-name', jf).value.trim().length > 1);
      check('#j-email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('#j-email', jf).value.trim()));
      if (role === 'partner') check('#j-brand', $('#j-brand', jf).value.trim().length > 1);
      if (!ok) return;
      const data = Object.fromEntries(new FormData(jf)); data.role = role; data.at = new Date().toISOString();
      const list = store.get('lukki-join', []); list.push(data); store.set('lukki-join', list);
      jf.innerHTML = `<div class="done">${ICON.check}<h3>${role === 'partner' ? 'Application received' : "You're in!"}</h3><p style="margin:0;opacity:.8">${role === 'partner' ? 'Our curators will review your brand and get back to you within a week.' : 'Welcome to the Lukki community. Watch your inbox for the first drop 🌿'}</p></div>`;
    });
  }

  const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();
})();
