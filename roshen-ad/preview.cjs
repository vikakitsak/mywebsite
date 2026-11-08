// node preview.mjs outdir t1 t2 ... -> JPEG stills for review
(async () => {
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const dir = __dirname;
const [outDir, ...ts] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
p.on('console', m => console.log('page:', m.text())); p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('file://' + dir + '/index.html?render'); await p.evaluate(() => window.ready);
for (const t of ts) {
  const t0 = Date.now();
  const d = await p.evaluate(t => window.grabFrame(t, 0.9), +t);
  fs.writeFileSync(path.join(outDir, `t${(+t).toFixed(2).padStart(5, '0')}.jpg`), Buffer.from(d.split(',')[1], 'base64'));
  console.log(t, Date.now() - t0, 'ms');
}
await b.close();
})();
