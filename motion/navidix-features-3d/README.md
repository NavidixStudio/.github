# Navidix Studio — 3D features, 15s

موشن گرافیک سه‌بعدی ۱۵ ثانیه‌ای از امکانات استودیو نویدیکس، با لوگو و لوگوتایپ اصلی برند.

| File | |
|---|---|
| `navidix-features-3d.mp4` | 1920×1080, 60 fps, H.264 + AAC 256k, −14 LUFS |
| `navidix-features-3d-vertical.mp4` | 1080×1920 for Reels / Stories / Shorts |
| `poster.jpg` | cover frame |

## Story

| Time | Picture | Sound |
|---|---|---|
| 0.0 – 2.6 | Macro over the mark's circuit board; one spark spreads light along the traces | Low drone, crackle, the spark's zap |
| 2.6 – 3.75 | The camera pulls back; the three N pieces slam into place; the neon border flickers on | Three metal hits, neon buzz cut frame by frame, impact |
| 3.75 – 4.7 | Hero shot of the mark | Impact tail, Dm chord |
| 4.7 – 12.2 | One orbit around the mark, a station per feature: گفتگو · تصویر · ویدیو · ایجنت‌ها | 128 BPM groove, Dm – Bb – F – C, a whoosh per camera move, cues per feature |
| 12.2 – 15 | Home: the mark, the NAVIDIX logotype, «استودیو هوش مصنوعی، به فارسی», the address | Final impact, three-note sonic logo |

The mark is built in real 3D from the homepage logo (hexagon body, double neon border, circuit traces, three extruded N pieces).
The NAVIDIX logotype, the style images and the video thumbnails come from navidixstudio.com.

## How it is made

- `scene.js` — Three.js scene; `render(t)` is a pure function of time.
- `audio.js` — the score and sound design, synthesised with Web Audio on the same timeline.
- `render.js` — renders frames in headless Chromium (SwiftShader WebGL), masters the mix to −14 LUFS, encodes with ffmpeg.

```sh
npm install
node render.js                       # 16:9 → out/navidix-features-3d.mp4
node render.js --w 1080 --h 1920     # 9:16 → out/navidix-features-3d-vertical.mp4
node render.js --stills 4.2,8,14.5   # single frames → out/stills/
node render.js --audio-only          # just the score
```

Serve the folder and open `index.html?preview` to watch it live in a browser (click once to start, with sound).
