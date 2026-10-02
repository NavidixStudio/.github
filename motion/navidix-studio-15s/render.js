#!/usr/bin/env node
/* Renders the motion to MP4.
 *
 *   node render.js                         full render → out/navidix-studio-15s.mp4
 *   node render.js --stills 1,3.5,5.2      single frames → out/stills/*.png
 *   node render.js --w 1080 --h 1920       vertical cut
 *   options: --fps 60 --workers 4 --out out
 *
 * Needs Playwright (Chromium) and ffmpeg on PATH.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const W = +opt('w', 1920), H = +opt('h', 1080), FPS = +opt('fps', 60), WORKERS = +opt('workers', 4);
const OUT = path.resolve(opt('out', path.join(__dirname, 'out')));
const STILLS = opt('stills', null);
const NAME = opt('name', `navidix-studio-15s${H > W ? '-vertical' : ''}`);
const REUSE = args.includes('--reuse-frames');   // re-mix audio / re-encode without redrawing

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.png': 'image/png' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(__dirname, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(__dirname)) { rsp.writeHead(403); return rsp.end(); }
      fs.readFile(p, (e, d) => { if (e) { rsp.writeHead(404); return rsp.end(); } rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); rsp.end(d); });
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

async function openPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('page error:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('console:', m.text()); });
  await page.goto(url);
  await page.evaluate(() => NVX.ready);
  return page;
}

const grab = (page, t) => page.evaluate(t => { NVX.render(t); return NVX.canvas.toDataURL('image/png').slice(22); }, t);

function run(cmd, a, capture = false) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, a, { stdio: ['ignore', 'inherit', capture ? 'pipe' : 'inherit'] });
    let err = ''; if (capture) p.stderr.on('data', d => { err += d; });
    p.on('exit', c => c === 0 ? res(err) : rej(new Error(`${cmd} exited ${c}\n${err}`)));
  });
}

// Measure EBU R128 loudness, then one gain for the whole mix (so the build-up survives) and a true-peak limiter.
async function master(wav, out) {
  const target = 'I=-14:TP=-1.5:LRA=11';
  const log = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'], true);
  const m = JSON.parse(log.slice(log.lastIndexOf('{'), log.lastIndexOf('}') + 1));
  const gain = -14 - +m.input_i;
  await run('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-af',
    `aresample=192000,volume=${gain.toFixed(2)}dB,alimiter=limit=${Math.pow(10, -1.5 / 20).toFixed(4)}:attack=1:release=40:level=0,aresample=48000`,
    '-c:a', 'pcm_s24le', out]);
  console.log(`audio master: in ${m.input_i} LUFS / ${m.input_tp} dBTP → -14 LUFS`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/index.html?w=${W}&h=${H}`;
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const t0 = Date.now();
  try {
    if (STILLS) {
      const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
      const page = await openPage(browser, url);
      for (const s of STILLS.split(',').map(Number)) {
        const file = path.join(dir, `t${s.toFixed(2).padStart(5, '0')}.png`);
        fs.writeFileSync(file, Buffer.from(await grab(page, s), 'base64'));
        console.log(file);
      }
      return;
    }
    const frames = Math.round(15 * FPS);
    const fdir = path.join(OUT, `frames-${W}x${H}`);
    if (!REUSE) fs.rmSync(fdir, { recursive: true, force: true });
    fs.mkdirSync(fdir, { recursive: true });

    // audio
    const apage = await openPage(browser, url);
    const { b64, peak } = await apage.evaluate(() => NVX_AUDIO.renderWavBase64());
    const wav = path.join(OUT, 'score.wav');
    fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
    console.log(`audio: ${wav} (peak ${peak.toFixed(3)})`);
    await apage.close();

    // frames, split across pages
    const mastered = path.join(OUT, 'score-master.wav');
    await master(wav, mastered);

    let next = REUSE && fs.existsSync(path.join(fdir, `f${String(frames - 1).padStart(5, '0')}.png`)) ? frames : 0, done = 0;
    const pages = next >= frames ? [] : await Promise.all(Array.from({ length: WORKERS }, () => openPage(browser, url)));
    await Promise.all(pages.map(async page => {
      for (;;) {
        const i = next++; if (i >= frames) break;
        const png = await grab(page, i / FPS);
        fs.writeFileSync(path.join(fdir, `f${String(i).padStart(5, '0')}.png`), Buffer.from(png, 'base64'));
        if (++done % 60 === 0) console.log(`frames ${done}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      }
    }));

    // encode: H.264 high quality + AAC
    const mp4 = path.join(OUT, `${NAME}.mp4`);
    await run('ffmpeg', ['-y', '-v', 'error', '-stats',
      '-framerate', String(FPS), '-i', path.join(fdir, 'f%05d.png'), '-i', mastered,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709',
      '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
      '-shortest', '-movflags', '+faststart', mp4]);
    console.log(`video: ${mp4}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  } finally {
    await browser.close(); srv.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
