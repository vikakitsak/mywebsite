/* =========================================================
   FLORIS — bouquet catalogue
   Edit this list to add or change bouquets. Photos live in assets/photos/.
   ========================================================= */
(function () {
  'use strict';

  const COLLECTIONS = {
    velvet: { name: 'Velvet', desc: 'Deep burgundy and wine tones — for bold feelings.', bg: 'bg-velvet', palette: 'velvet' },
    blush:  { name: 'Blush', desc: 'Soft powder roses and peonies, like morning light.', bg: 'bg-blush', palette: 'blush' },
    amber:  { name: 'Amber', desc: 'Warm peach, coral and berry accents — a little sunset in your hands.', bg: 'bg-amber', palette: 'peach' },
  };

  const PRODUCTS = [
    { id: 'velvet-night', name: 'Velvet Night', coll: 'velvet', price: 2450, tag: 'Bestseller',
      photo: 'assets/photos/velvet-night.webp',
      desc: 'Burgundy chrysanthemums and pink spray roses in a wine-coloured wrap.',
      comp: 'Chrysanthemum, spray rose, peony rose, eucalyptus' },
    { id: 'cherry-garden', name: 'Cherry Garden', coll: 'velvet', price: 2100,
      photo: 'assets/photos/cherry-garden.webp',
      desc: 'Rich cherry chrysanthemums with blush garden roses.',
      comp: 'Chrysanthemum, garden rose, spray rose, greenery' },
    { id: 'wine-peach', name: 'Wine & Peach', coll: 'velvet', price: 2650, tag: 'New',
      photo: 'assets/photos/wine-peach.webp',
      desc: 'Generous round bouquet of wine chrysanthemums and peach roses.',
      comp: 'Chrysanthemum, spray rose, white wrap' },
    { id: 'first-breath', name: 'First Breath', coll: 'blush', price: 1980, tag: 'Bestseller',
      photo: 'assets/photos/first-breath.webp',
      desc: 'Tall and airy: blush roses, cream carnations and delicate stems.',
      comp: 'Garden rose, carnation, lisianthus, greenery' },
    { id: 'powder-cloud', name: 'Powder Cloud', coll: 'blush', price: 2250,
      photo: 'assets/photos/powder-cloud.webp',
      desc: 'Ruffled pink carnations and white chrysanthemums in a cloud of tulle.',
      comp: 'Carnation, chrysanthemum, matthiola, eucalyptus' },
    { id: 'rose-whisper', name: 'Rose Whisper', coll: 'blush', price: 2350, tag: 'New',
      photo: 'assets/photos/rose-whisper.webp',
      desc: 'Pink peony roses meet burgundy chrysanthemums — tender with a twist.',
      comp: 'Peony rose, chrysanthemum, carnation, eucalyptus' },
    { id: 'winter-berry', name: 'Winter Berry', coll: 'amber', price: 1890,
      photo: 'assets/photos/winter-berry.webp',
      desc: 'Bright orange ilex berries with white spray roses.',
      comp: 'Ilex berry, spray rose, chrysanthemum' },
    { id: 'peach-sunset', name: 'Peach Sunset', coll: 'amber', price: 2550, tag: 'Bestseller',
      photo: 'assets/photos/peach-sunset.webp',
      desc: 'Peach chrysanthemums, burgundy accents and soft pink roses.',
      comp: 'Chrysanthemum, rose, carnation, dried grasses' },
    { id: 'autumn-ember', name: 'Autumn Ember', coll: 'amber', price: 2750,
      photo: 'assets/photos/autumn-ember.webp',
      desc: 'Wine chrysanthemums, peach carnations and glowing berries.',
      comp: 'Chrysanthemum, carnation, ilex berry, eucalyptus' },
  ];

  const SIZES = {
    S: { label: 'S', note: 'compact', k: 0.8 },
    M: { label: 'M', note: 'classic', k: 1 },
    L: { label: 'L', note: 'lush', k: 1.4 },
  };

  window.FLORIS_DATA = { COLLECTIONS, PRODUCTS, SIZES };
})();
