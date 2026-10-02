# Navidix Studio — 15s brand motion

موشن گرافیک ۱۵ ثانیه‌ای استودیو نویدیکس، با صدا — «از یک جمله، تا یک نما.»

| File | |
|---|---|
| `navidix-studio-15s.mp4` | 1920×1080, 60 fps, H.264 + AAC 256k, −14 LUFS |
| `navidix-studio-15s-vertical.mp4` | 1080×1920 (Reels / Stories / Shorts), same picture and score |
| `poster.jpg` | cover frame (t = 13.8s) |

## Story

The studio's own line — **۰۱ یک جمله · ۰۲ یک مدل · ۰۳ یک نما** — told in 15 seconds:

| Time | Picture | Sound |
|---|---|---|
| 0.0 – 3.0 | The studio's input bar opens; «شفق قطبی بر فراز دماوند» is typed | Dm pad, a key click per letter |
| 3.0 – 5.0 | Send. The sentence lifts off letter by letter and swirls into the hexagon | Riser, reverse swell, a cut to silence |
| 5.0 – 7.0 | Impact: the mark lands; chat / image / video / agent cards fly out | Boom, pulse and arpeggio, a bell for each card |
| 7.0 – 10.9 | The image card opens into the full shot: aurora over Damavand, letterboxed | Wide Bb – F – C pads, delayed bell melody |
| 10.9 – 15.0 | Shutter closes on a red line → the mark spins in, tagline, pills, URL | Final impact, three-note sonic logo on D minor |

Brand colours, the Estedad typeface and the hexagon mark are taken from navidixstudio.com.

## How it is made

Everything is code — no stock footage, no samples:

- `motion.js` draws every frame on a canvas; `render(t)` is a pure function of time.
- `audio.js` synthesises the score and sound design with Web Audio (`OfflineAudioContext`), cued to the same timeline.
- `render.js` drives headless Chromium (Playwright), renders frames in parallel, normalises the mix to −14 LUFS and encodes with ffmpeg.

```sh
node render.js                       # 16:9  → out/navidix-studio-15s.mp4
node render.js --w 1080 --h 1920     # 9:16  → out/navidix-studio-15s-vertical.mp4
node render.js --stills 2.5,8,13.5   # single frames → out/stills/
node render.js --reuse-frames        # re-mix the audio / re-encode without redrawing
```

To watch it live in a browser, serve this folder and open `index.html?preview`, then click once to start with sound.
