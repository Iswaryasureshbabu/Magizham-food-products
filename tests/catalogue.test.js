// Catalogue integrity against the Tamil pamphlet. Run: npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const sb = {};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'products.js'), 'utf8'), sb);
const cats = sb.products;
const all = Object.entries(cats).flatMap(([slug, c]) => c.products.map((p) => ({ ...p, slug })));

// Transcribed from the pamphlet: [Tamil name, pack, price] per category.
const PAMPHLET = {
  podi: [
    ['இட்லி பொடி', '100g', 45], ['சாம்பார் பொடி', '100g', 60], ['ரசம் பொடி', '100g', 75], ['சாதம் பொடி', '100g', 60],
    ['முருங்கை பொடி', '100g', 75], ['கறிவேப்பிலை பொடி', '100g', 75], ['பிரண்டை பொடி', '100g', 75], ['கொள்ளு பொடி', '100g', 75],
    ['கொள்ளு ரசம் பொடி', '100g', 75], ['பூண்டு பொடி', '100g', 75], ['சுண்டைக்காய் பொடி', '100g', 75], ['முடக்கத்தான் பொடி', '100g', 75],
    ['கரம் மசாலா', '100g', 75], ['குழம்பு மிலகாய் தூள்', '100g', 60], ['தாளிப்பு வடகம்', '100g', 75], ['65 மசாலா', '100g', 25],
    ['வல்லாரை பொடி', '100g', 75], ['தூதுவளை பொடி', '100g', 75], ['ஆவாரம் பூ பொடி', '100g', 75], ['வேப்பம் பூ பொடி', '100g', 75],
    ['கருப்பு உளுந்து பொடி', '100g', 75], ['புளி சாதம் பொடி', '100g', 75], ['லெமன் சாதம் பொடி', '100g', 75]
  ],
  soup: [['முருங்கை கீரை சூப்', '100g', 120], ['முடவாட்டுகால் சூப்', '50g', 120]],
  kanji: [['கருப்புகவுனி கஞ்சி', '250g', 100], ['மாப்பிள்ளை சம்பா', '250g', 90], ['கொள்ளு கஞ்சி', '250g', 100], ['கருப்பு உளுந்து கஞ்சி', '100g', 75]],
  kulambu: [['பூண்டு மிளகு குழம்பு', '200g', 150], ['வத்தக்குழம்பு', '200g', 150]],
  malt: [['ABC மால்ட்', '100g', 120], ['பீட்ரூட் மால்ட்', '100g', 120], ['ராகி சாக்கோ மால்ட்', '100g', 120]]
};
// Pickles: [Tamil name, 100g price, 200g price]
const PICKLES = [
  ['தக்காளி ஊறுகாய்', 60, 120], ['பூண்டு ஊறுகாய்', 70, 140], ['சுண்டைக்காய் ஊறுகாய்', 70, 140], ['மா இஞ்சி ஊறுகாய்', 70, 140],
  ['பிரண்டை தொக்கு', 75, 150], ['கறிவேப்பிலை தொக்கு', 60, 120], ['சின்ன வெங்காய தொக்கு', 70, 140], ['மாங்காய் ஊறுகாய்', 60, 120],
  ['எலுமிச்சை ஊறுகாய்', 60, 120], ['நார்த்தங்காய் ஊறுகாய்', 70, 140]
];
const price = (p) => Number(String(p.price).replace(/[^\d.]/g, ''));

test('exactly the six official categories, in pamphlet order', () => {
  assert.deepStrictEqual(Object.keys(cats), ['podi', 'soup', 'kanji', 'pickles', 'kulambu', 'malt']);
  const ta = Object.values(cats).map((c) => c.nameTa);
  assert.deepStrictEqual(ta, ['பொடி வகைகள்', 'சூப் வகைகள்', 'கஞ்சி மிக்ஸ்', 'ஊறுகாய் வகைகள்', 'குழம்பு வகைகள்', 'மால்ட் வகைகள்']);
});

test('44 pamphlet items + 10 extra pickle sizes = 54 products', () => {
  assert.strictEqual(all.length, 54);
});

for (const [slug, rows] of Object.entries(PAMPHLET)) {
  test(`${slug}: every pamphlet row has the right Tamil name, pack and price`, () => {
    const got = cats[slug].products;
    assert.strictEqual(got.length, rows.length, 'row count');
    rows.forEach(([name, pack, pr], i) => {
      assert.strictEqual(got[i].nameTa, name, `name #${i + 1}`);
      assert.strictEqual(got[i].weight, pack, `pack of ${name}`);
      assert.strictEqual(price(got[i]), pr, `price of ${name}`);
    });
  });
}

test('pickles: a separate 100g and 200g row for every pickle, each with its pamphlet price', () => {
  const list = cats.pickles.products;
  assert.strictEqual(list.length, 20);
  PICKLES.forEach(([name, p100, p200]) => {
    const a = list.find((p) => p.nameTa === `${name} (100கி)`);
    const b = list.find((p) => p.nameTa === `${name} (200கி)`);
    assert.ok(a && b, `both sizes of ${name}`);
    assert.deepStrictEqual([a.weight, price(a)], ['100g', p100]);
    assert.deepStrictEqual([b.weight, price(b)], ['200g', p200]);
  });
});

test('ids are unique; original ids 1-44 are kept; new 200g rows use 45-54', () => {
  const ids = all.map((p) => p.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (let i = 1; i <= 44; i++) assert.ok(ids.includes(i), `id ${i} present`);
  assert.deepStrictEqual(all.filter((p) => p.weight === '200g' && p.slug === 'pickles').map((p) => p.id).sort((a, b) => a - b),
    [45, 46, 47, 48, 49, 50, 51, 52, 53, 54]);
});

test('no duplicate English or Tamil names inside a category (seed slugs stay unique)', () => {
  for (const [slug, c] of Object.entries(cats)) {
    assert.strictEqual(new Set(c.products.map((p) => p.name)).size, c.products.length, `${slug} English`);
    assert.strictEqual(new Set(c.products.map((p) => p.nameTa)).size, c.products.length, `${slug} Tamil`);
  }
});

test('every product has English + Tamil name, and no invented descriptions', () => {
  all.forEach((p) => {
    assert.ok(p.name && p.nameTa, `names for id ${p.id}`);
    assert.strictEqual(p.desc, '', `desc of id ${p.id}`);
    assert.strictEqual(p.descTa, '', `descTa of id ${p.id}`);
  });
});

test('every image path points at a file that exists', () => {
  all.forEach((p) => assert.ok(fs.existsSync(path.join(ROOT, 'images', p.image)), `${p.image} (id ${p.id})`));
});

test('no flat colour tiles are used as product images', () => {
  // These files are plain coloured tiles with a text label, not product photos.
  const flat = ['chilli-powder.jpg', 'garlic-pickle.jpg', 'garlic-podi.jpg', 'lemon-pickle.jpg', 'paruppu-podi.jpg', 'pickle.jpg', 'rasam.jpg', 'tomato-pickle.jpg', 'turmeric-powder.jpg'];
  all.forEach((p) => assert.ok(!flat.includes(p.image), `id ${p.id} uses ${p.image}`));
});

test('category banner sentences are empty (they were unverified marketing / medicinal claims)', () => {
  for (const [slug, c] of Object.entries(cats)) {
    assert.strictEqual(c.banner, '', `${slug} banner`);
    assert.strictEqual(c.bannerTa, '', `${slug} bannerTa`);
  }
});
