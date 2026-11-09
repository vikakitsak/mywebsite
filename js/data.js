/* =========================================================
   FLORIS — каталог букетів
   Щоб додати/змінити букет — відредагуйте цей список.
   ========================================================= */
(function () {
  'use strict';

  const COLLECTIONS = {
    velvet: { name: 'Velvet', ua: 'Оксамит', desc: 'Глибокі бордові та винні відтінки — для сміливих почуттів.', bg: 'bg-velvet' },
    blush:  { name: 'Blush', ua: 'Пудра', desc: 'Ніжні пудрові півонії та троянди, як ранкове світло.', bg: 'bg-blush' },
    wild:   { name: 'Wild', ua: 'Польові', desc: 'Вільні, яскраві композиції, наче щойно з луки.', bg: 'bg-wild' },
    mono:   { name: 'Mono', ua: 'Моно', desc: 'Один сорт — максимум виразності.', bg: 'bg-mono' },
  };

  const PRODUCTS = [
    { id: 'velvet-night', name: 'Оксамитова ніч', coll: 'velvet', price: 2450, tag: 'Хіт',
      desc: 'Бордові троянди, ранункулюси та евкаліпт у чорному крафті.',
      comp: 'Троянда «Ред Наомі», ранункулюс, евкаліпт, гіпсофіла',
      art: { seed: 3, palette: 'velvet', flower: 'mix', count: 11, wrap: 'black', ribbon: '#f0b9bd' } },
    { id: 'bordeaux', name: 'Бордо', coll: 'velvet', price: 1890,
      desc: 'Класика в глибокому винному кольорі. Сміливо й елегантно.',
      comp: 'Троянда «Ред Наомі» — 9 шт, евкаліпт',
      art: { seed: 11, palette: 'velvet', flower: 'rose', count: 9, wrap: 'wine', ribbon: '#f7ede8' } },
    { id: 'cherry-garden', name: 'Вишневий сад', coll: 'velvet', price: 2100, tag: 'Новинка',
      desc: 'Вишневі півонії з бордовими акцентами та зеленню.',
      comp: 'Півонія «Ред Чарм», троянда, рускус',
      art: { seed: 21, palette: 'velvet', flower: 'peony', count: 9, wrap: 'cream', ribbon: '#5c161e' } },
    { id: 'first-breath', name: 'Перший подих', coll: 'blush', price: 2650, tag: 'Хіт',
      desc: 'Пишні пудрові півонії — найніжніший букет студії.',
      comp: 'Півонія «Сара Бернар» — 7 шт, евкаліпт',
      art: { seed: 5, palette: 'blush', flower: 'peony', count: 7, wrap: 'cream', ribbon: '#7a1f2b' } },
    { id: 'powder', name: 'Пудра', coll: 'blush', price: 1750,
      desc: 'Кремові та рожеві троянди з гіпсофілою.',
      comp: 'Кущова троянда, троянда «Квіксанд», гіпсофіла',
      art: { seed: 14, palette: 'blush', flower: 'rose', count: 13, wrap: 'blush', ribbon: '#5c161e' } },
    { id: 'morning-dew', name: 'Ранкова роса', coll: 'blush', price: 1980,
      desc: 'Легкий мікс ранункулюсів і троянд у пастельних тонах.',
      comp: 'Ранункулюс, троянда, евкаліпт, гіпсофіла',
      art: { seed: 27, palette: 'blush', flower: 'mix', count: 13, wrap: 'cream', ribbon: '#b8394b' } },
    { id: 'field-melody', name: 'Польова мелодія', coll: 'wild', price: 1450,
      desc: 'Яскравий мікс, що пахне літом і свободою.',
      comp: 'Ранункулюс, тюльпан, троянда, сезонна зелень',
      art: { seed: 8, palette: 'wild', flower: 'mix', count: 13, wrap: 'kraft', ribbon: '#5c161e' } },
    { id: 'honey-lavender', name: 'Лаванда і мед', coll: 'wild', price: 1600, tag: 'Новинка',
      desc: 'Бузкові та медові відтінки у крафтовій упаковці.',
      comp: 'Ранункулюс, півонія, евкаліпт',
      art: { seed: 33, palette: 'wild', flower: 'ranunculus', count: 11, wrap: 'kraft', ribbon: '#8d6bb5' } },
    { id: 'sunny-leaf', name: 'Захід сонця', coll: 'wild', price: 1350,
      desc: 'Персикові та коралові квіти — тепло в руках.',
      comp: 'Ранункулюс, троянда «Пітч», рускус',
      art: { seed: 41, palette: 'sunset', flower: 'mix', count: 11, wrap: 'cream', ribbon: '#5c161e' } },
    { id: 'roses-25', name: '25 троянд', coll: 'mono', price: 4900,
      desc: 'Розкішний моно-букет із бордових троянд.',
      comp: 'Троянда «Ред Наомі» — 25 шт',
      art: { seed: 17, palette: 'velvet', flower: 'rose', count: 25, wrap: 'black', ribbon: '#b8394b' } },
    { id: 'white-peony', name: 'Білі півонії', coll: 'mono', price: 3200,
      desc: 'Чистота й легкість: білосніжні півонії.',
      comp: 'Півонія «Дюшес де Немур» — 9 шт',
      art: { seed: 9, palette: 'snow', flower: 'peony', count: 9, wrap: 'wine', ribbon: '#f7ede8' } },
    { id: 'spring-tulips', name: 'Тюльпани весни', coll: 'mono', price: 1250,
      desc: 'Білі тюльпани в бордовій упаковці.',
      comp: 'Тюльпан — 15 шт, евкаліпт',
      art: { seed: 2, palette: 'snow', flower: 'tulip', count: 15, wrap: 'wine', ribbon: '#f0b9bd' } },
  ];

  const SIZES = {
    S: { label: 'S', note: 'компактний', k: 0.8 },
    M: { label: 'M', note: 'класичний', k: 1 },
    L: { label: 'L', note: 'пишний', k: 1.4 },
  };

  window.FLORIS_DATA = { COLLECTIONS, PRODUCTS, SIZES };
})();
