// node render.cjs <outdir> [workers]  -> outdir/seg_k.mp4 (1080x1920@60, frames i/60)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const [outDir, nw = '3'] = process.argv.slice(2);
const FPS = 60, TOTAL = 1200, NW = +nw;
(async () => {
  const b = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const per = Math.ceil(TOTAL / NW);
  await Promise.all([...Array(NW)].map(async (_, k) => {
    const f0 = k * per, f1 = Math.min(TOTAL, f0 + per);
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
    p.on('pageerror', e => console.log('ERR', e.message));
    await p.goto('file://' + path.join(__dirname, 'index.html') + '?render'); await p.evaluate(() => window.ready);
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', '60', path.join(outDir, `seg_${k}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let i = f0; i < f1; i++) {
      const d = await p.evaluate(t => window.grabFrame(t, 0.96), i / FPS);
      const buf = Buffer.from(d.split(',')[1], 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if ((i - f0) % 100 === 0) console.log(`w${k} frame ${i} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }));
  await b.close(); console.log('done');
})();
