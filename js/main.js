/* =========================================================
   FLORIS — логіка сайту
   ========================================================= */
(function () {
  'use strict';

  /* ---------- НАЛАШТУВАННЯ: змініть на свої дані ---------- */
  const CONFIG = {
    address: 'вул. Квіткова, 12, Київ',
    phone: '+380 00 000 00 00',
    email: 'hello@floris.example',
    hours: 'Щодня 08:00 – 21:00',
    instagram: '#',
    telegram: '#',
    // Щоб отримувати заявки на пошту, вставте сюди адресу форми (наприклад, з formspree.io)
    formEndpoint: '',
  };

  const body = document.body;
  const page = body.dataset.page || 'home';
  const { PRODUCTS = [], COLLECTIONS = {}, SIZES = {} } = window.FLORIS_DATA || {};
  const art = (o) => (window.FLORIS_ART ? window.FLORIS_ART.bouquetSVG(o) : '');
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const money = (n) => Math.round(n).toLocaleString('uk-UA') + ' ₴';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* приватний режим */ } },
  };
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- іконки ---------- */
  const I = {
    arrow: '<svg class="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17 19 7"/></svg>',
    insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".9" fill="currentColor"/></svg>',
    tg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M21 4 3 11l6 2.2L19 7l-7.6 7.4L17 20l4-16Z"/></svg>',
    flower: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1.6 2.2 1.6 4.4 0 6.4-1.6-2-1.6-4.2 0-6.4Zm0 13.6c1.6 2 1.6 4.2 0 6.4-1.6-2.2-1.6-4.4 0-6.4ZM2 12c2.2-1.6 4.4-1.6 6.4 0-2 1.6-4.2 1.6-6.4 0Zm13.6 0c2-1.6 4.2-1.6 6.4 0-2.2 1.6-4.4 1.6-6.4 0Z"/><circle cx="12" cy="12" r="2.2"/></svg>',
  };

  const NAV = [
    ['index.html', 'Головна', 'home'],
    ['shop.html', 'Букети', 'shop'],
    ['builder.html', 'Конструктор', 'builder'],
    ['about.html', 'Про нас', 'about'],
    ['contact.html', 'Контакти', 'contact'],
  ];

  /* ---------- каркас: шапка, меню, футер, кошик, модалки ---------- */
  function shell() {
    const links = NAV.map(([h, t, id]) => `<li><a href="${h}"${id === page ? ' aria-current="page"' : ''}>${t}</a></li>`).join('');
    document.body.insertAdjacentHTML('afterbegin', `
      <div class="scroll-progress" aria-hidden="true"></div>
      <header class="site-header"><nav class="container nav" aria-label="Головне меню">
        <a class="nav__logo" href="index.html" aria-label="FLORIS — на головну"><img src="assets/logo-white.svg" alt="FLORIS" width="120" height="29"></a>
        <ul class="nav__links">${links}</ul>
        <div class="nav__actions">
          <a class="btn btn--sm nav__cta" href="builder.html">Створити букет ${I.arrow}</a>
          <button class="icon-btn" type="button" data-cart-open aria-label="Відкрити кошик">${I.bag}<span class="cart-count">0</span></button>
          <button class="icon-btn burger" type="button" aria-label="Меню" aria-expanded="false"><span></span><span></span><span></span></button>
        </div>
      </nav></header>
      <div class="mobile-menu" aria-hidden="true">
        ${NAV.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}
        <div class="mobile-menu__foot">${CONFIG.phone}<br>${CONFIG.hours}</div>
      </div>
      <div class="cursor-ring" aria-hidden="true"><span></span></div><div class="cursor-dot" aria-hidden="true"></div>
    `);

    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <img class="footer-logo" src="assets/logo-white.svg" alt="FLORIS" width="190" height="46">
            <p class="muted" style="max-width:34ch;font-size:14px">Квіткова студія, де кожна пелюстка — на своєму місці. Збираємо букети вручну та доставляємо з любов'ю.</p>
            <div class="socials">
              <a class="icon-btn" href="${CONFIG.instagram}" aria-label="Instagram">${I.insta}</a>
              <a class="icon-btn" href="${CONFIG.telegram}" aria-label="Telegram">${I.tg}</a>
            </div>
          </div>
          <div><h4>Букети</h4><ul>
            ${Object.entries(COLLECTIONS).map(([k, c]) => `<li><a class="link-u" href="shop.html?c=${k}">${c.name} · ${c.ua}</a></li>`).join('')}
            <li><a class="link-u" href="builder.html">Конструктор букета</a></li>
          </ul></div>
          <div><h4>Студія</h4><ul>
            <li><a class="link-u" href="about.html">Про нас</a></li>
            <li><a class="link-u" href="about.html#subscription">Квіткова підписка</a></li>
            <li><a class="link-u" href="contact.html?topic=event">Весілля та події</a></li>
            <li><a class="link-u" href="contact.html#faq">Питання та відповіді</a></li>
          </ul></div>
          <div><h4>Контакти</h4><ul>
            <li>${CONFIG.address}</li><li>${CONFIG.phone}</li><li>${CONFIG.email}</li><li>${CONFIG.hours}</li>
          </ul></div>
        </div>
        <div class="footer-bottom"><span>© ${new Date().getFullYear()} FLORIS. Усі права захищені.</span><span>Зроблено з ✿ та трішки 3D</span></div>
      </div>`;
    document.body.appendChild(footer);

    document.body.insertAdjacentHTML('beforeend', `
      <div class="overlay" data-close></div>
      <aside class="drawer" aria-label="Кошик" aria-hidden="true">
        <div class="drawer__head"><h3>Кошик</h3><button class="icon-btn" type="button" data-close aria-label="Закрити">${I.close}</button></div>
        <div class="drawer__body"></div>
        <div class="drawer__foot"></div>
      </aside>
      <div class="modal" id="product-modal" role="dialog" aria-modal="true" aria-label="Букет"><div class="modal__box"></div></div>
      <div class="modal" id="checkout-modal" role="dialog" aria-modal="true" aria-label="Оформлення замовлення"><div class="modal__box modal__box--sm"></div></div>
      <div class="toasts" aria-live="polite"></div>
    `);
  }

  /* ---------- перехід між сторінками ---------- */
  function transitions() {
    const reveal = () => requestAnimationFrame(() => body.classList.add('is-loaded'));
    if (body.classList.contains('is-first')) {
      try { sessionStorage.setItem('floris-visited', '1'); } catch (e) { /* */ }
      setTimeout(reveal, 1100);
    } else reveal();
    addEventListener('pageshow', (e) => { if (e.persisted) { body.classList.remove('is-leaving'); body.classList.add('is-loaded'); } });
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin && location.protocol !== 'file:') return;
      if (url.pathname === location.pathname && url.hash) return;
      e.preventDefault();
      body.classList.remove('menu-open');
      body.classList.add('is-leaving');
      setTimeout(() => { location.href = a.href; }, reduceMotion ? 50 : 650);
    });
  }

  /* ---------- шапка, меню, прогрес ---------- */
  function headerUI() {
    const header = $('.site-header');
    const bar = $('.scroll-progress');
    let last = 0;
    const onScroll = () => {
      const y = scrollY;
      header.classList.toggle('is-scrolled', y > 30);
      header.classList.toggle('is-hidden', y > last && y > 400 && !body.classList.contains('menu-open'));
      last = y;
      const h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${h > 0 ? y / h : 0})`;
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    const burger = $('.burger');
    burger.addEventListener('click', () => {
      const open = body.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', open);
      $('.mobile-menu').setAttribute('aria-hidden', !open);
    });
  }

  /* ---------- кастомний курсор ---------- */
  function cursor() {
    if (!finePointer) return;
    const dot = $('.cursor-dot'), ring = $('.cursor-ring'), label = ring.querySelector('span');
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; dot.style.transform = `translate(${x}px,${y}px)`; }, { passive: true });
    (function tick() {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      ring.style.transform = `translate(${rx}px,${ry}px)`;
      requestAnimationFrame(tick);
    })();
    document.addEventListener('pointerover', (e) => {
      const lbl = e.target.closest('[data-cursor]');
      const hov = e.target.closest('a,button,label,summary,input,select,textarea');
      body.classList.toggle('cursor-label', !!lbl);
      body.classList.toggle('cursor-hover', !lbl && !!hov);
      if (lbl) label.textContent = lbl.dataset.cursor;
    });
  }

  /* ---------- поява елементів ---------- */
  function splitText() {
    $$('[data-split]').forEach((el) => {
      let i = 0;
      const walk = (node) => {
        [...node.childNodes].forEach((n) => {
          if (n.nodeType === 3) {
            const frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach((w) => {
              if (!w) return;
              if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
              const o = document.createElement('span'); o.className = 'w';
              const s = document.createElement('span'); s.textContent = w; s.style.setProperty('--i', i++);
              o.appendChild(s); frag.appendChild(o);
            });
            n.replaceWith(frag);
          } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
        });
      };
      walk(el);
    });
  }
  function reveals() {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
    }), { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    $$('[data-reveal],[data-split]').forEach((el) => io.observe(el));
  }
  function counters() {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el = en.target, to = parseFloat(el.dataset.count), dec = (el.dataset.count.split('.')[1] || '').length;
      const suf = el.dataset.suffix || '', t0 = performance.now(), dur = 1800;
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
        el.textContent = (to * e).toLocaleString('uk-UA', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }), { threshold: 0.5 });
    $$('[data-count]').forEach((el) => io.observe(el));
  }

  /* ---------- 3D-нахил карток і магнітні кнопки ---------- */
  function tilt(root = document) {
    if (!finePointer) return;
    $$('[data-tilt]', root).forEach((el) => {
      if (el._tilt) return; el._tilt = true;
      const max = parseFloat(el.dataset.tilt) || 10;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.transform = `perspective(1000px) rotateX(${(0.5 - py) * max}deg) rotateY(${(px - 0.5) * max}deg) translateZ(0)`;
        el.style.setProperty('--gx', px * 100 + '%'); el.style.setProperty('--gy', py * 100 + '%');
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }
  function magnetic() {
    if (!finePointer) return;
    $$('.btn, .round-btn').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- ефекти прокрутки ---------- */
  function scrollFX() {
    const marquees = $$('[data-marquee]');
    const heroLogo = $('.hero__logo');
    const parallax = $$('[data-parallax]');
    const update = () => {
      const vh = innerHeight;
      marquees.forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        const p = (vh - r.top) / (vh + r.height);
        el.style.transform = `translate3d(${(p - 0.5) * parseFloat(el.dataset.marquee)}%,0,0)`;
      });
      if (heroLogo) {
        const p = Math.min(1, scrollY / vh);
        heroLogo.style.transform = `translate3d(0,${p * -60}px,0) scale(${1 + p * 0.35})`;
        heroLogo.style.opacity = String(1 - p * 1.1);
        heroLogo.style.filter = `blur(${p * 8}px)`;
      }
      parallax.forEach((el) => {
        const r = el.getBoundingClientRect();
        const p = (r.top + r.height / 2 - vh / 2) / vh;
        el.style.transform = `translate3d(0,${p * parseFloat(el.dataset.parallax)}px,0)`;
      });
    };
    let ticking = false;
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { update(); ticking = false; }); } }, { passive: true });
    addEventListener('resize', update);
    update();
  }

  /* ---------- тости ---------- */
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.innerHTML = `<i></i>${esc(msg)}`;
    $('.toasts').appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 500); }, 2600);
  }

  /* ---------- модалки та шухляда ---------- */
  let lastFocus = null;
  function openLayer(el) {
    lastFocus = document.activeElement;
    $('.overlay').classList.add('is-open');
    el.classList.add('is-open'); el.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(() => { const f = el.querySelector('input,button:not([data-close]),select,textarea') || el.querySelector('button'); f && f.focus({ preventScroll: true }); }, 350);
  }
  function closeLayers() {
    $$('.drawer.is-open,.modal.is-open').forEach((el) => { el.classList.remove('is-open'); el.setAttribute('aria-hidden', 'true'); });
    $('.overlay').classList.remove('is-open');
    document.documentElement.style.overflow = '';
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }
  function layers() {
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]') || e.target.classList.contains('modal')) closeLayers();
      if (e.target.closest('[data-cart-open]')) { renderCart(); openLayer($('.drawer')); }
    });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeLayers(); body.classList.remove('menu-open'); } });
  }

  /* ---------- кошик ---------- */
  let cart = store.get('floris-cart', []);
  const saveCart = () => { store.set('floris-cart', cart); updateCount(); };
  const findProduct = (id) => PRODUCTS.find((p) => p.id === id);
  function itemArt(it) { return it.art || (findProduct(it.id) || {}).art || {}; }
  function itemBg(it) {
    const p = findProduct(it.id);
    if (p) return COLLECTIONS[p.coll].bg;
    return 'bg-' + (itemArt(it).palette || 'velvet');
  }
  function updateCount(bump) {
    const n = cart.reduce((s, i) => s + i.qty, 0);
    $$('.cart-count').forEach((c) => {
      c.textContent = n; c.classList.toggle('has-items', n > 0);
      if (bump) { c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
    });
  }
  function addToCart(item) {
    const key = item.key || `${item.id}|${item.size || 'M'}|${item.note || ''}`;
    const ex = cart.find((i) => i.key === key);
    if (ex) ex.qty += item.qty || 1;
    else cart.push(Object.assign({ qty: 1, size: 'M' }, item, { key }));
    saveCart(); updateCount(true);
    toast(`«${item.name}» у кошику`);
    if (window.FLORIS_SCENE) window.FLORIS_SCENE.burst(0.6, 0.6);
  }
  const cartTotal = () => cart.reduce((s, i) => s + i.price * i.qty, 0);
  const DELIVERY_FREE_FROM = 2000, DELIVERY = 150;
  function renderCart() {
    const bodyEl = $('.drawer__body'), foot = $('.drawer__foot');
    if (!cart.length) {
      bodyEl.innerHTML = `<div class="cart-empty">${I.bag}<p>Кошик поки порожній.<br>Час обрати квіти ✿</p><a class="btn btn--sm" href="shop.html" style="margin-top:14px">До букетів ${I.arrow}</a></div>`;
      foot.innerHTML = '';
      return;
    }
    bodyEl.innerHTML = cart.map((it, idx) => `
      <div class="cart-item">
        <div class="cart-item__art ${itemBg(it)}">${art(Object.assign({}, itemArt(it), { title: it.name }))}</div>
        <div><h4>${esc(it.name)}</h4><small>Розмір ${esc(it.size)}${it.note ? ' · листівка' : ''}${it.detail ? ' · ' + esc(it.detail) : ''}</small>
          <div class="qty"><button type="button" data-qty="${idx}" data-d="-1" aria-label="Менше">−</button><span>${it.qty}</span><button type="button" data-qty="${idx}" data-d="1" aria-label="Більше">+</button></div></div>
        <div class="cart-item__right"><b>${money(it.price * it.qty)}</b><button class="remove" type="button" data-remove="${idx}">Видалити</button></div>
      </div>`).join('');
    const sub = cartTotal(), del = sub >= DELIVERY_FREE_FROM ? 0 : DELIVERY;
    foot.innerHTML = `
      <div class="total-row"><span>Букети</span><span>${money(sub)}</span></div>
      <div class="total-row"><span>Доставка${del ? ` <small>(безкоштовно від ${money(DELIVERY_FREE_FROM)})</small>` : ''}</span><span>${del ? money(del) : 'безкоштовно'}</span></div>
      <div class="total-row big"><span>Разом</span><span>${money(sub + del)}</span></div>
      <button class="btn btn--block" type="button" data-checkout>Оформити замовлення ${I.arrow}</button>`;
  }
  document.addEventListener('click', (e) => {
    const q = e.target.closest('[data-qty]');
    if (q) { const it = cart[+q.dataset.qty]; it.qty = Math.max(0, it.qty + +q.dataset.d); if (!it.qty) cart.splice(+q.dataset.qty, 1); saveCart(); renderCart(); }
    const rm = e.target.closest('[data-remove]');
    if (rm) { cart.splice(+rm.dataset.remove, 1); saveCart(); renderCart(); }
    if (e.target.closest('[data-checkout]')) { closeLayers(); setTimeout(openCheckout, 300); }
    const add = e.target.closest('[data-add]');
    if (add) { const p = findProduct(add.dataset.add); if (p) addToCart({ id: p.id, name: p.name, price: p.price, size: 'M' }); }
    const view = e.target.closest('[data-view]');
    if (view) openProduct(view.dataset.view);
  });

  /* ---------- картка товару ---------- */
  function productCard(p) {
    const c = COLLECTIONS[p.coll];
    return `<article class="product" data-tilt="6" data-reveal>
      ${p.tag ? `<span class="tag">${p.tag}</span>` : ''}
      <div class="product__art ${c.bg}" data-view="${p.id}" data-cursor="Дивитись" role="button" tabindex="0" aria-label="Деталі: ${esc(p.name)}">${art(Object.assign({}, p.art, { title: p.name }))}</div>
      <div class="product__body">
        <h3 class="product__name">${p.name}</h3>
        <p class="product__desc">${p.desc}</p>
        <div class="product__foot"><span class="price">${money(p.price)}</span>
          <button class="add-btn" type="button" data-add="${p.id}" aria-label="Додати «${esc(p.name)}» у кошик">${I.plus}</button></div>
      </div></article>`;
  }
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-view]')) { e.preventDefault(); openProduct(e.target.dataset.view); }
  });

  function openProduct(id) {
    const p = findProduct(id); if (!p) return;
    const c = COLLECTIONS[p.coll];
    const m = $('#product-modal');
    m.querySelector('.modal__box').innerHTML = `
      <button class="icon-btn modal__close" type="button" data-close aria-label="Закрити">${I.close}</button>
      <div class="pmodal">
        <div class="pmodal__art ${c.bg}">${art(Object.assign({}, p.art, { title: p.name }))}</div>
        <form class="modal__pad" id="pform">
          <span class="eyebrow">${c.name} · ${c.ua}</span>
          <h3>${p.name}</h3>
          <p class="muted" style="margin:0">${p.desc}</p>
          <p style="font-size:13px;margin:14px 0 0"><span class="muted">Склад:</span> ${p.comp}</p>
          <span class="opt-label">Розмір</span>
          <div class="seg">${Object.entries(SIZES).map(([k, s], i) => `<input type="radio" name="size" id="sz${k}" value="${k}"${k === 'M' ? ' checked' : ''}><label for="sz${k}">${s.label} — ${money(p.price * s.k)}<small>${s.note}</small></label>`).join('')}</div>
          <span class="opt-label">Листівка (необов'язково)</span>
          <div class="field"><textarea name="note" maxlength="160" placeholder="Напишіть кілька теплих слів…" style="min-height:80px"></textarea></div>
          <div style="display:flex;gap:10px;align-items:center;margin-top:24px;flex-wrap:wrap">
            <div class="qty" style="margin:0"><button type="button" data-pq="-1" aria-label="Менше">−</button><span id="pq">1</span><button type="button" data-pq="1" aria-label="Більше">+</button></div>
            <button class="btn" type="submit" style="flex:1;justify-content:center">У кошик · <span id="ptotal">${money(p.price)}</span></button>
          </div>
        </form>
      </div>`;
    const form = m.querySelector('#pform');
    let qty = 1;
    const calc = () => { const s = SIZES[form.size.value]; form.querySelector('#ptotal').textContent = money(p.price * s.k * qty); form.querySelector('#pq').textContent = qty; };
    form.addEventListener('change', calc);
    form.addEventListener('click', (e) => { const b = e.target.closest('[data-pq]'); if (b) { qty = Math.max(1, Math.min(20, qty + +b.dataset.pq)); calc(); } });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const s = SIZES[form.size.value];
      addToCart({ id: p.id, name: p.name, price: Math.round(p.price * s.k), size: form.size.value, note: form.note.value.trim(), qty });
      closeLayers();
    });
    openLayer(m);
  }

  /* ---------- валідація форм ---------- */
  function validate(form) {
    let ok = true;
    $$('[required],[data-phone],[type=email]', form).forEach((el) => {
      const f = el.closest('.field'); if (!f) return;
      let valid = el.checkValidity() && (!el.required || el.value.trim() !== '');
      if (el.dataset.phone !== undefined && el.value.trim()) valid = el.value.replace(/\D/g, '').length >= 10;
      f.classList.toggle('is-invalid', !valid);
      if (!valid && ok) { el.focus(); ok = false; }
    });
    return ok;
  }
  function phoneMask(root = document) {
    $$('[data-phone]', root).forEach((el) => {
      el.addEventListener('focus', () => { if (!el.value) el.value = '+380 '; });
      el.addEventListener('input', () => {
        let d = el.value.replace(/\D/g, '');
        if (d.startsWith('3800')) d = '380' + d.slice(4);      // +380 0XX… → +380 XX…
        else if (d.startsWith('380')) { /* вже правильно */ }
        else if (d.startsWith('0')) d = '38' + d;               // 0XX… → 380XX…
        else d = '380' + d;
        d = d.slice(0, 12);
        const p = [d.slice(0, 3), d.slice(3, 5), d.slice(5, 8), d.slice(8, 10), d.slice(10, 12)].filter(Boolean);
        el.value = '+' + p[0] + (p[1] ? ' ' + p[1] : '') + (p[2] ? ' ' + p[2] : '') + (p[3] ? ' ' + p[3] : '') + (p[4] ? ' ' + p[4] : '');
      });
    });
    root.addEventListener && root.addEventListener('input', (e) => { const f = e.target.closest && e.target.closest('.field.is-invalid'); if (f) f.classList.remove('is-invalid'); });
  }
  async function send(type, data) {
    const all = store.get('floris-requests', []);
    all.push(Object.assign({ type, at: new Date().toISOString() }, data));
    store.set('floris-requests', all);
    if (CONFIG.formEndpoint) {
      try { await fetch(CONFIG.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(Object.assign({ type }, data)) }); } catch (e) { /* офлайн */ }
    }
  }
  const successHTML = (title, text) => `<div class="success"><div class="success__icon">${I.check}</div><h3 class="h-2">${title}</h3><p class="muted">${text}</p></div>`;

  /* ---------- оформлення замовлення ---------- */
  function openCheckout() {
    if (!cart.length) { toast('Кошик порожній'); return; }
    const m = $('#checkout-modal');
    const today = new Date(); const iso = (d) => d.toISOString().slice(0, 10);
    const sub = cartTotal(), del = sub >= DELIVERY_FREE_FROM ? 0 : DELIVERY;
    m.querySelector('.modal__box').innerHTML = `
      <button class="icon-btn modal__close" type="button" data-close aria-label="Закрити">${I.close}</button>
      <div class="modal__pad">
        <span class="eyebrow">Оформлення</span>
        <h3 class="h-2" style="margin:12px 0 24px">Куди везти квіти?</h3>
        <form class="form" id="cform" novalidate>
          <div class="form-row">
            <div class="field"><label for="c-name">Ваше ім'я</label><input id="c-name" name="name" required autocomplete="name"><span class="err">Вкажіть ім'я</span></div>
            <div class="field"><label for="c-phone">Телефон</label><input id="c-phone" name="phone" type="tel" required data-phone autocomplete="tel" placeholder="+380"><span class="err">Перевірте номер</span></div>
          </div>
          <div class="field"><label for="c-to">Ім'я отримувача (якщо це сюрприз)</label><input id="c-to" name="recipient"></div>
          <div class="field"><label for="c-addr">Адреса доставки</label><input id="c-addr" name="address" required autocomplete="street-address" placeholder="Вулиця, будинок, квартира"><span class="err">Вкажіть адресу</span></div>
          <div class="form-row">
            <div class="field"><label for="c-date">Дата</label><input id="c-date" name="date" type="date" required min="${iso(today)}" value="${iso(today)}"><span class="err">Оберіть дату</span></div>
            <div class="field"><label for="c-time">Час</label><select id="c-time" name="time">${['09:00–12:00', '12:00–15:00', '15:00–18:00', '18:00–21:00'].map((t) => `<option>${t}</option>`).join('')}</select></div>
          </div>
          <span class="opt-label" style="margin:6px 0 0">Оплата</span>
          <div class="radio-cards">
            <input type="radio" name="pay" id="pay1" value="card" checked><label for="pay1">Карткою при отриманні</label>
            <input type="radio" name="pay" id="pay2" value="cash"><label for="pay2">Готівкою</label>
          </div>
          <div class="total-row big" style="margin-top:10px"><span>До сплати</span><span>${money(sub + del)}</span></div>
          <button class="btn btn--block" type="submit">Підтвердити замовлення ${I.arrow}</button>
        </form>
      </div>`;
    const form = m.querySelector('#cform');
    phoneMask(form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate(form)) return;
      const num = 'FL-' + Math.floor(1000 + Math.random() * 9000);
      const data = Object.fromEntries(new FormData(form));
      await send('order', Object.assign(data, { number: num, items: cart, total: sub + del }));
      cart = []; saveCart();
      form.parentElement.innerHTML = successHTML(`Дякуємо! Замовлення ${num}`, `Ми зателефонуємо вам протягом 15 хвилин, щоб підтвердити деталі. Перед відправкою надішлемо фото букета.`) + `<div style="text-align:center;margin-top:20px"><button class="btn" type="button" data-close>Чудово</button></div>`;
      if (window.FLORIS_SCENE) { window.FLORIS_SCENE.burst(0, 0); window.FLORIS_SCENE.burst(-0.5, 0.3); window.FLORIS_SCENE.burst(0.5, -0.3); }
    });
    openLayer(m);
  }

  /* =========================================================
     СТОРІНКИ
     ========================================================= */
  function initHome() {
    // колекції
    const cg = $('#collections-grid');
    if (cg) {
      const pick = { velvet: 'velvet-night', blush: 'first-breath', wild: 'field-melody' };
      cg.innerHTML = Object.entries(pick).map(([k, id], i) => {
        const c = COLLECTIONS[k], p = findProduct(id);
        return `<a class="coll-card ${c.bg}" href="shop.html?c=${k}" data-tilt="8" data-reveal style="--d:${i * 0.12}s" data-cursor="Відкрити">
          <div class="coll-card__art">${art(Object.assign({}, p.art, { title: c.name }))}</div>
          <span class="tag">${c.ua}</span><span class="round-btn" aria-hidden="true">${I.up}</span>
          <h3>${c.name}</h3><p>${c.desc}</p><div class="coll-card__glare"></div></a>`;
      }).join('');
    }
    const fg = $('#featured-grid');
    if (fg) fg.innerHTML = PRODUCTS.filter((p) => p.tag).slice(0, 4).map(productCard).join('');
    const tz = $('#teaser-art');
    if (tz) {
      const variants = [
        { palette: 'velvet', flower: 'rose', wrap: 'black', ribbon: '#f0b9bd' },
        { palette: 'blush', flower: 'peony', wrap: 'cream', ribbon: '#7a1f2b' },
        { palette: 'sunset', flower: 'mix', wrap: 'kraft', ribbon: '#5c161e' },
        { palette: 'snow', flower: 'tulip', wrap: 'wine', ribbon: '#f7ede8' },
      ];
      let v = 0;
      const draw = () => { tz.innerHTML = `<div class="art-swap" style="height:100%">${art(Object.assign({ seed: v * 5 + 2, count: 11 }, variants[v % variants.length]))}</div>`; v++; };
      draw(); setInterval(draw, 2600);
    }

    // закріплена секція «як ми працюємо»
    const proc = $('.process');
    if (proc) {
      const steps = $$('.process__step', proc), nums = $$('.process__num span', proc), bars = $$('.process__bar b', proc);
      const n = steps.length;
      const upd = () => {
        const r = proc.getBoundingClientRect();
        const p = Math.min(0.9999, Math.max(0, -r.top / (r.height - innerHeight)));
        const idx = Math.floor(p * n);
        steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
        nums.forEach((s, i) => { s.style.transform = `translateY(${(i - idx) * 100}%)`; s.style.opacity = i === idx ? 1 : 0; });
        bars.forEach((b, i) => b.style.setProperty('--p', Math.min(1, Math.max(0, p * n - i))));
      };
      addEventListener('scroll', upd, { passive: true }); upd();
    }

    // відгуки
    const rv = $$('.review');
    if (rv.length) {
      let i = 0, timer;
      const show = (k) => { i = (k + rv.length) % rv.length; rv.forEach((r, j) => r.classList.toggle('is-active', j === i)); };
      const auto = () => { clearInterval(timer); timer = setInterval(() => show(i + 1), 6000); };
      $('[data-rev="prev"]').addEventListener('click', () => { show(i - 1); auto(); });
      $('[data-rev="next"]').addEventListener('click', () => { show(i + 1); auto(); });
      show(0); auto();
    }
  }

  function initShop() {
    const grid = $('#shop-grid'); if (!grid) return;
    const params = new URLSearchParams(location.search);
    let coll = COLLECTIONS[params.get('c')] ? params.get('c') : 'all', q = '', sort = 'pop';
    const chips = $('#chips');
    chips.innerHTML = `<button class="chip" data-c="all">Усі</button>` + Object.entries(COLLECTIONS).map(([k, c]) => `<button class="chip" data-c="${k}">${c.name} · ${c.ua}</button>`).join('');
    const render = () => {
      $$('.chip', chips).forEach((c) => c.classList.toggle('is-active', c.dataset.c === coll));
      let list = PRODUCTS.filter((p) => (coll === 'all' || p.coll === coll) && (!q || (p.name + p.desc + p.comp).toLowerCase().includes(q)));
      if (sort === 'asc') list = list.slice().sort((a, b) => a.price - b.price);
      if (sort === 'desc') list = list.slice().sort((a, b) => b.price - a.price);
      grid.innerHTML = list.length ? list.map(productCard).join('') : `<div class="empty"><p>Нічого не знайшли 🥀<br>Спробуйте інший запит або <a class="link-u accent" href="builder.html">зберіть свій букет</a>.</p></div>`;
      $('#shop-count').textContent = list.length;
      tilt(grid);
      requestAnimationFrame(() => $$('[data-reveal]', grid).forEach((el, i) => { el.style.setProperty('--d', (i % 4) * 0.07 + 's'); requestAnimationFrame(() => el.classList.add('is-in')); }));
      window.FLORIS_SCENE && window.FLORIS_SCENE.refresh();
    };
    chips.addEventListener('click', (e) => {
      const c = e.target.closest('.chip'); if (!c) return;
      coll = c.dataset.c; render();
      const u = new URL(location.href); coll === 'all' ? u.searchParams.delete('c') : u.searchParams.set('c', coll); history.replaceState(null, '', u);
    });
    $('#search').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); render(); });
    $('#sort').addEventListener('change', (e) => { sort = e.target.value; render(); });
    render();
    const open = params.get('p'); if (open) setTimeout(() => openProduct(open), 900);
  }

  function initBuilder() {
    const form = $('#builder'); if (!form) return;
    const stage = $('#stage'), priceEl = $('#b-price'), detailEl = $('#b-detail');
    const STEM = { rose: 95, peony: 180, tulip: 65, ranunculus: 110, mix: 120 };
    const WRAP = { black: 150, kraft: 100, blush: 150, cream: 120, wine: 150 };
    const NAMES = { rose: 'троянди', peony: 'півонії', tulip: 'тюльпани', ranunculus: 'ранункулюси', mix: 'мікс' };
    const RIBBON = { velvet: '#f0b9bd', blush: '#7a1f2b', snow: '#5c161e', sunset: '#5c161e', wild: '#5c161e' };
    let seed = 7;
    const state = () => Object.fromEntries(new FormData(form));
    const price = (s) => STEM[s.flower] * +s.count + WRAP[s.wrap] + (s.note.trim() ? 50 : 0);
    const draw = (animate) => {
      const s = state();
      stage.className = 'builder__stage bg-' + s.palette;
      stage.querySelector('.art-holder').innerHTML = `<div class="${animate ? 'art-swap' : ''}">${art({ seed, palette: s.palette, flower: s.flower, count: +s.count, wrap: s.wrap, ribbon: RIBBON[s.palette], title: 'Ваш букет' })}</div>`;
      priceEl.textContent = money(price(s));
      detailEl.textContent = `${s.count} шт · ${NAMES[s.flower]}`;
      $('#note-count').textContent = `${s.note.length}/120`;
      if (window.FLORIS_SCENE) window.FLORIS_SCENE.setPalette(s.palette);
    };
    form.addEventListener('change', (e) => draw(e.target.name !== 'note'));
    form.addEventListener('input', (e) => { if (e.target.name === 'note') draw(false); });
    $('#shuffle').addEventListener('click', () => { seed = Math.floor(Math.random() * 1000); draw(true); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const s = state();
      addToCart({
        key: `custom-${Date.now()}`, id: 'custom', name: 'Ваш букет', price: price(s), size: s.count + ' шт', note: s.note.trim(),
        detail: NAMES[s.flower],
        art: { seed, palette: s.palette, flower: s.flower, count: +s.count, wrap: s.wrap, ribbon: RIBBON[s.palette] },
      });
      seed = Math.floor(Math.random() * 1000);
    });
    draw(false);
    document.addEventListener('floris:scene-ready', () => draw(false));
  }

  function initContact() {
    const form = $('#contact-form'); if (!form) return;
    phoneMask(form);
    const topic = new URLSearchParams(location.search).get('topic');
    if (topic && form.topic.querySelector(`option[value="${topic}"]`)) form.topic.value = topic;
    const d = form.querySelector('[name=date]'); if (d) d.min = new Date().toISOString().slice(0, 10);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate(form)) return;
      await send('request', Object.fromEntries(new FormData(form)));
      form.innerHTML = successHTML('Заявку отримано!', 'Наша флористка зв\'яжеться з вами найближчим часом. Гарного дня ✿');
      window.FLORIS_SCENE && window.FLORIS_SCENE.burst(0.3, 0);
    });
  }

  function subscribeForms() {
    $$('.subscribe').forEach((f) => f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const inp = f.querySelector('input');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value.trim())) { toast('Перевірте, будь ласка, email'); inp.focus(); return; }
      await send('subscribe', { email: inp.value.trim() });
      inp.value = ''; toast('Дякуємо! Ви підписані на квіткові новини ✿');
      window.FLORIS_SCENE && window.FLORIS_SCENE.burst(0, -0.2);
    }));
  }

  function smoothAnchors() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]'); if (!a) return;
      const t = document.querySelector(a.getAttribute('href')); if (!t) return;
      e.preventDefault(); t.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---------- старт ---------- */
  shell();
  transitions();
  headerUI();
  layers();
  updateCount();
  $$('[data-cfg]').forEach((el) => { el.textContent = CONFIG[el.dataset.cfg] || ''; });
  splitText();
  if (page === 'home') initHome();
  if (page === 'shop') initShop();
  if (page === 'builder') initBuilder();
  if (page === 'contact') initContact();
  subscribeForms();
  smoothAnchors();
  reveals();
  counters();
  tilt();
  magnetic();
  scrollFX();
  cursor();
  phoneMask();
  if (location.hash) setTimeout(() => { const t = document.querySelector(location.hash); t && t.scrollIntoView(); }, 300);
})();
