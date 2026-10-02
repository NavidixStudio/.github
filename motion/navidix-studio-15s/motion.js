/* Navidix Studio — 15 second brand motion.
 *
 * Story (the studio's own line, "۰۱ یک جمله · ۰۲ یک مدل · ۰۳ یک نما"):
 *   0.0 – 3.0   one sentence : a prompt is typed into the studio's input bar
 *   3.0 – 5.0   one model    : the sentence dissolves into particles that build the hexagon
 *   5.0 – 7.5   outputs      : chat / image / video / agent cards fly out of the mark
 *   7.5 – 10.9  one shot     : the image card opens into a full cinematic shot
 *  10.9 – 15.0  lockup       : shutter closes on a red line, the mark lands with the tagline
 *
 * render(t) is a pure function of time: every frame can be drawn independently,
 * which is what lets the renderer split frames across several pages.
 */
'use strict';
(function () {
const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 1920), H = +(Q.get('h') || 1080);
const DUR = 15;
const PORTRAIT = H > W;
const S = Math.min(W, H) / 1080;           // one "design pixel"

const cvs = document.getElementById('c');
cvs.width = W; cvs.height = H;
const ctx = cvs.getContext('2d');

/* ---------- brand ---------- */
const C = {
  red: '#E4323F', redHover: '#F04C57', redPress: '#B81B27', redInk: '#FF8F93',
  black: '#06080C', surface: '#0D1117', surface2: '#131923', surface3: '#1A2130',
  blue: '#6E9AE0', blueDeep: '#1E2C42', blueBright: '#7FB8FF', violet: '#8B5CF6',
  steel: '#7E8CA0', text: '#F4F7FC', text2: '#C9D2E0', muted: '#A2ADBF', dim: '#7E8AA0', ok: '#4FB286',
};
const FA = (w, px) => `${w} ${px * S}px Estedad`;
const MONO = (w, px) => `${w} ${px * S}px "DM Mono"`;

/* ---------- math ---------- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  inOutCubic: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inCubic: x => x * x * x,
  outQuint: x => 1 - Math.pow(1 - x, 5),
  outExpo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
  inExpo: x => x <= 0 ? 0 : Math.pow(2, 10 * x - 10),
  inOutExpo: x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
};
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const rng = mulberry32(1337);
const NT = new Float32Array(2048); for (let i = 0; i < NT.length; i++) NT[i] = rng();
function vnoise(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return NT[i & 2047] + (NT[(i + 1) & 2047] - NT[i & 2047]) * u; }
function fbm(x, oct = 4) { let s = 0, a = .5, fr = 1; for (let k = 0; k < oct; k++) { s += a * vnoise(x * fr + k * 37.13); fr *= 2.03; a *= .5; } return s / (1 - Math.pow(.5, oct)); }
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

/* ---------- timeline ---------- */
const T = {
  barIn: 0.30, typeStart: 1.0, send: 3.0,
  impact1: 5.0,
  zoom0: 7.0, zoom1: 7.55,
  shutter0: 10.35, shutter1: 10.9,
  impact2: 11.0,
};
const PROMPT = 'شفق قطبی بر فراز دماوند';
const TYPE_TIMES = (() => {
  const r = mulberry32(7); const out = []; let t = T.typeStart;
  for (const ch of PROMPT) { out.push(t); t += 0.052 + r() * 0.03 + (ch === ' ' ? 0.045 : 0); }
  return out;
})();

/* ---------- layout ---------- */
const CX = W / 2, CY = H / 2;
const Lay = PORTRAIT ? {
  barW: Math.min(W - 90 * S, 940 * S), barH: 96 * S, promptPx: 38,
  logoR: 230 * S,
  cards: [
    { key: 'chat',  label: 'گفتگو', meta: 'CHAT',        x: CX + 205 * S, y: CY - 520 * S, w: 380, h: 210, tilt: -1, t: 5.25 },
    { key: 'image', label: 'تصویر', meta: 'IMAGE · 4K',  x: CX - 205 * S, y: CY - 470 * S, w: 380, h: 250, tilt: 1,  t: 5.625 },
    { key: 'video', label: 'ویدیو', meta: 'VIDEO · 10S', x: CX + 205 * S, y: CY + 480 * S, w: 380, h: 250, tilt: -1, t: 6.0 },
    { key: 'agent', label: 'ایجنت', meta: 'AGENT',       x: CX - 205 * S, y: CY + 530 * S, w: 380, h: 210, tilt: 1,  t: 6.375 },
  ],
  hudY: 120 * S, letterbox: 300 * S,
  lock: { lx: CX, ly: H * 0.27, lR: 200 * S, align: 'center', tx: CX,
          y1: H * 0.43, y2: H * 0.475, y3: H * 0.565, y4: H * 0.635, y5: H * 0.72, yUrl: H * 0.93, big: 104 },
} : {
  barW: 1000 * S, barH: 96 * S, promptPx: 40,
  logoR: 230 * S,
  cards: [
    { key: 'chat',  label: 'گفتگو', meta: 'CHAT',        x: CX + 590 * S, y: CY - 190 * S, w: 370, h: 210, tilt: -1, t: 5.25 },
    { key: 'image', label: 'تصویر', meta: 'IMAGE · 4K',  x: CX - 590 * S, y: CY - 180 * S, w: 400, h: 250, tilt: 1,  t: 5.625 },
    { key: 'video', label: 'ویدیو', meta: 'VIDEO · 10S', x: CX + 590 * S, y: CY + 195 * S, w: 400, h: 250, tilt: -1, t: 6.0 },
    { key: 'agent', label: 'ایجنت', meta: 'AGENT',       x: CX - 590 * S, y: CY + 200 * S, w: 370, h: 210, tilt: 1,  t: 6.375 },
  ],
  hudY: 64 * S, letterbox: (H - W / 2.39) / 2,
  lock: { lx: W * 0.285, ly: H * 0.515, lR: 210 * S, align: 'right', tx: W * 0.875,
          y1: H * 0.285, y2: H * 0.372, y3: H * 0.505, y4: H * 0.648, y5: H * 0.785, yUrl: H * 0.915, big: 112 },
};

/* ---------- prebuilt assets ---------- */
let grain = [], dust = [], bokeh = [], stars = [], sparks = [], parts = [];
let vignette, bloomA, bloomB, shotCanvas, shotStatic, auroraC, auroraGlow, rayImg = [], thumbC, videoC, pixC;

function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

function buildAssets() {
  for (let k = 0; k < 6; k++) {
    const g = canvas(256, 256), gc = g.getContext('2d'), id = gc.createImageData(256, 256), r = mulberry32(100 + k);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    gc.putImageData(id, 0, 0); grain.push(g);
  }
  for (let i = 0; i < 260; i++) dust.push({ x: rng(), y: rng(), z: .15 + .85 * rng(), ph: rng() * 6.28, vx: (rng() - .5) * .012, vy: -(.004 + rng() * .014), red: rng() < .16 });
  for (let i = 0; i < 9; i++) bokeh.push({ x: rng(), y: rng(), r: (40 + rng() * 120), ph: rng() * 6.28, red: rng() < .45 });
  for (let i = 0; i < 700; i++) { const b = rng(); stars.push({ x: rng(), y: Math.pow(rng(), 1.25) * .78, s: .5 + Math.pow(rng(), 3) * 2.2, b: .25 + .75 * b * b, f: 1.5 + rng() * 4, ph: rng() * 6.28 }); }
  for (let i = 0; i < 150; i++) { const a = rng() * Math.PI * 2; sparks.push({ a, v: 500 + rng() * 1500, k: 2.2 + rng() * 2.5, life: .45 + rng() * .8, red: rng(), w: .8 + rng() * 2.2 }); }

  // vignette
  vignette = canvas(W, H); { const v = vignette.getContext('2d'); const g = v.createRadialGradient(CX, CY, Math.min(W, H) * .35, CX, CY, Math.hypot(W, H) * .62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.62)'); v.fillStyle = g; v.fillRect(0, 0, W, H); }
  bloomA = canvas(W / 4, H / 4); bloomB = canvas(W / 10, H / 10);

  // aurora strips: 1px wide vertical gradients, stretched per column
  const strip = (stops) => { const c = canvas(1, 256), g = c.getContext('2d'), gr = g.createLinearGradient(0, 256, 0, 0); for (const [o, col] of stops) gr.addColorStop(o, col); g.fillStyle = gr; g.fillRect(0, 0, 1, 256); return c; };
  rayImg = [
    strip([[0, 'rgba(150,255,190,0)'], [0.025, 'rgba(190,255,205,1)'], [0.10, 'rgba(80,245,150,.95)'], [0.32, 'rgba(30,205,125,.6)'], [0.6, 'rgba(50,110,190,.3)'], [0.82, 'rgba(139,92,246,.14)'], [1, 'rgba(139,92,246,0)']]),
    strip([[0, 'rgba(190,160,255,0)'], [0.04, 'rgba(190,160,255,.8)'], [0.25, 'rgba(139,92,246,.55)'], [0.6, 'rgba(228,50,63,.22)'], [1, 'rgba(228,50,63,0)']]),
    strip([[0, 'rgba(228,50,63,0)'], [1, 'rgba(255,90,140,.75)']]),
  ];
  buildStreaks();
  shotCanvas = canvas(W, H); shotStatic = canvas(W, H);
  auroraC = canvas(W / 3, H / 3); auroraGlow = canvas(W / 8, H / 8);
  pixC = canvas(128, 128);
}

/* ---------- shapes ---------- */
function hexPath(c, x, y, r) {
  c.beginPath();
  for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + k * Math.PI / 3; const px = x + r * Math.cos(a), py = y + r * Math.sin(a); k ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.closePath();
}
function rrect(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function poly(c, pts, R, ox = 0, oy = 0) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x * R + ox, y * R + oy) : c.moveTo(x * R + ox, y * R + oy)); c.closePath(); }

// The N, in units of the hexagon radius (traced from the studio's mark).
const N_SHAPES = {
  L: [[-0.40, -0.42], [-0.16, -0.42], [-0.16, 0.50], [-0.40, 0.50]],
  R: [[0.16, -0.48], [0.40, -0.48], [0.40, 0.42], [0.16, 0.42]],
  D: [[-0.40, -0.48], [-0.10, -0.48], [0.40, 0.50], [0.10, 0.50]],
};

function drawExtruded(c, pts, R, d, side, faceGrad, highlight) {
  // depth: the polygon swept along d
  c.fillStyle = side;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    c.beginPath(); c.moveTo(a[0] * R, a[1] * R); c.lineTo(b[0] * R, b[1] * R); c.lineTo(b[0] * R + d[0], b[1] * R + d[1]); c.lineTo(a[0] * R + d[0], a[1] * R + d[1]); c.closePath(); c.fill();
  }
  poly(c, pts, R, d[0], d[1]); c.fill();
  poly(c, pts, R); c.fillStyle = faceGrad; c.fill();
  if (highlight) { c.strokeStyle = highlight; c.lineWidth = R * 0.007; c.beginPath(); c.moveTo(pts[0][0] * R, pts[0][1] * R); c.lineTo(pts[1][0] * R, pts[1][1] * R); c.stroke(); }
}

function drawN(c, R, phi) {
  const d = [R * (0.022 - 0.05 * Math.sin(phi)), R * 0.03];
  let g = c.createLinearGradient(0, -R * .5, 0, R * .5); g.addColorStop(0, '#C8202D'); g.addColorStop(1, '#86101B');
  drawExtruded(c, N_SHAPES.L, R, d, '#3d070c', g, 'rgba(255,150,160,.55)');
  g = c.createLinearGradient(0, -R * .5, 0, R * .5); g.addColorStop(0, '#DA2A37'); g.addColorStop(1, '#93141F');
  drawExtruded(c, N_SHAPES.R, R, d, '#3d070c', g, 'rgba(255,150,160,.55)');
  c.save();
  c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = R * 0.09; c.shadowOffsetX = R * 0.03; c.shadowOffsetY = R * 0.01;
  g = c.createLinearGradient(-R * .4, -R * .5, R * .4, R * .5); g.addColorStop(0, '#FF5D67'); g.addColorStop(.45, '#E8343F'); g.addColorStop(1, '#B51C28');
  drawExtruded(c, N_SHAPES.D, R, d, '#4a0910', g, null);
  c.restore();
  // edge light along the diagonal
  c.strokeStyle = 'rgba(255,190,195,.75)'; c.lineWidth = R * 0.008;
  c.beginPath(); c.moveTo(-0.40 * R, -0.48 * R); c.lineTo(0.10 * R, 0.50 * R); c.stroke();
  c.strokeStyle = 'rgba(255,190,195,.6)';
  c.beginPath(); c.moveTo(-0.40 * R, -0.48 * R); c.lineTo(-0.10 * R, -0.48 * R); c.stroke();
}

/** The Navidix hexagon mark. o: {alpha, phi (y-rotation), glow, sweep (0..1)} */
function drawLogo(c, x, y, R, o = {}) {
  const a = o.alpha == null ? 1 : o.alpha; if (a <= 0.001) return;
  const phi = o.phi || 0, par = Math.sin(phi);
  c.save(); c.globalAlpha *= a; c.translate(x, y);
  if (o.glow) {
    const g = c.createRadialGradient(0, 0, R * .2, 0, 0, R * 2.1);
    g.addColorStop(0, `rgba(228,50,63,${.42 * o.glow})`); g.addColorStop(.45, `rgba(228,50,63,${.12 * o.glow})`); g.addColorStop(1, 'rgba(228,50,63,0)');
    c.fillStyle = g; c.fillRect(-R * 2.2, -R * 2.2, R * 4.4, R * 4.4);
  }
  c.scale(Math.cos(phi) * 0.98 + 0.02, 1);
  // thickness of the frame (visible when turned)
  hexPath(c, -par * R * 0.10, R * 0.015, R); c.fillStyle = '#0a0e16'; c.fill();
  // outer frame
  hexPath(c, 0, 0, R);
  let g = c.createLinearGradient(-R, -R, R, R); g.addColorStop(0, '#2d3e5c'); g.addColorStop(.5, '#1b2639'); g.addColorStop(1, '#0d121c');
  c.fillStyle = g; c.fill();
  c.lineJoin = 'round';
  g = c.createLinearGradient(0, -R, 0, R); g.addColorStop(0, 'rgba(200,218,245,.6)'); g.addColorStop(1, 'rgba(200,218,245,.06)');
  c.strokeStyle = g; c.lineWidth = R * 0.016; hexPath(c, 0, 0, R * 0.992); c.stroke();
  // well
  const p1 = par * R * 0.025;
  hexPath(c, p1, 0, R * 0.86); c.fillStyle = '#04060a'; c.fill();
  c.strokeStyle = C.red; c.lineWidth = R * 0.028; hexPath(c, p1, 0, R * 0.845); c.stroke();
  g = c.createLinearGradient(-R, -R, R, R); g.addColorStop(0, '#B9C6DC'); g.addColorStop(.6, '#7987a0'); g.addColorStop(1, '#4b566b');
  c.strokeStyle = g; c.lineWidth = R * 0.032; hexPath(c, par * R * 0.04, 0, R * 0.79); c.stroke();
  hexPath(c, par * R * 0.04, 0, R * 0.773);
  g = c.createRadialGradient(0, -R * .25, 0, 0, 0, R * .85); g.addColorStop(0, '#161d2b'); g.addColorStop(1, '#06080d');
  c.fillStyle = g; c.fill();
  // N floats in front of the well
  c.save(); c.translate(par * R * 0.09, 0); drawN(c, R, phi); c.restore();
  // light sweep
  if (o.sweep > 0 && o.sweep < 1) {
    c.save(); hexPath(c, 0, 0, R); c.clip(); c.globalCompositeOperation = 'lighter';
    c.rotate(-0.42);
    const bx = lerp(-1.7 * R, 1.7 * R, E.inOutSine(o.sweep));
    const sg = c.createLinearGradient(bx - R * .3, 0, bx + R * .3, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,235,235,.38)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sg; c.fillRect(-R * 2.5, -R * 2.5, R * 5, R * 5);
    c.restore();
  }
  c.restore();
}

/** The mark drawn as strokes being traced (act 2). p: 0..1 */
function drawLogoTrace(c, x, y, R, p, alpha) {
  if (alpha <= 0 || p <= 0) return;
  c.save(); c.translate(x, y); c.globalAlpha *= alpha; c.lineJoin = 'round'; c.lineCap = 'round';
  c.globalCompositeOperation = 'lighter';
  const dash = (len, q) => { c.setLineDash([len * q, len * 2]); };
  c.lineWidth = 1.6 * S; c.strokeStyle = 'rgba(127,184,255,.55)';
  dash(6 * R, E.inOutCubic(prog(p, 0, .8))); hexPath(c, 0, 0, R); c.stroke();
  c.lineWidth = 2 * S; c.strokeStyle = 'rgba(255,80,90,.75)';
  dash(6 * .845 * R, E.inOutCubic(prog(p, .15, .95))); hexPath(c, 0, 0, R * .845); c.stroke();
  c.lineWidth = 1.8 * S; c.strokeStyle = 'rgba(255,110,120,.85)';
  for (const k of ['L', 'R', 'D']) {
    const pts = N_SHAPES[k]; let len = 0;
    for (let i = 0; i < 4; i++) { const a = pts[i], b = pts[(i + 1) % 4]; len += Math.hypot(a[0] - b[0], a[1] - b[1]) * R; }
    dash(len, E.inOutCubic(prog(p, .3, 1))); poly(c, pts, R); c.stroke();
  }
  c.restore();
}

/* ---------- background ---------- */
function drawBackground(t, mood) {
  ctx.fillStyle = C.black; ctx.fillRect(-40, -40, W + 80, H + 80);
  // red glow low-left, blue glow high-right (as on the studio's cover)
  const pulse = 1 + 0.08 * Math.sin(t * 1.3);
  let g = ctx.createRadialGradient(W * .12, H * 1.05, 0, W * .12, H * 1.05, Math.max(W, H) * .75);
  g.addColorStop(0, `rgba(228,50,63,${.22 * mood.red * pulse})`); g.addColorStop(.5, `rgba(150,25,40,${.07 * mood.red})`); g.addColorStop(1, 'rgba(228,50,63,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W * .9, -H * .05, 0, W * .9, -H * .05, Math.max(W, H) * .7);
  g.addColorStop(0, `rgba(110,154,224,${.13 * mood.blue})`); g.addColorStop(1, 'rgba(110,154,224,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (mood.core > 0) {
    g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 700 * S);
    g.addColorStop(0, `rgba(228,50,63,${.20 * mood.core})`); g.addColorStop(.4, `rgba(110,60,160,${.06 * mood.core})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // faint perspective floor grid
  if (mood.grid > 0) {
    ctx.save(); ctx.globalAlpha = mood.grid; ctx.strokeStyle = 'rgba(158,180,214,.07)'; ctx.lineWidth = 1 * S;
    const hy = H * .62, vx = CX;
    for (let i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(vx + i * 40 * S, hy); ctx.lineTo(vx + i * 420 * S, H + 10); ctx.stroke(); }
    for (let j = 0; j < 9; j++) { const z = ((j + (t * .35) % 1) / 9); const y = hy + Math.pow(z, 2.2) * (H - hy + 20); ctx.globalAlpha = mood.grid * z; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
  }
}

function drawDust(t, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const b of bokeh) {
    const x = ((b.x + t * .006 * (b.red ? 1 : -1)) % 1 + 1) % 1 * W, y = (b.y + .02 * Math.sin(t * .5 + b.ph)) * H, r = b.r * S;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col = b.red ? '228,50,63' : '110,154,224';
    g.addColorStop(0, `rgba(${col},${.05 * alpha})`); g.addColorStop(.7, `rgba(${col},${.025 * alpha})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (const d of dust) {
    const x = ((d.x + d.vx * t * d.z) % 1 + 1) % 1 * W, y = ((d.y + d.vy * t * d.z) % 1 + 1) % 1 * H;
    const a = alpha * (.12 + .55 * d.z) * (.55 + .45 * Math.sin(t * 2.2 + d.ph));
    ctx.fillStyle = d.red ? `rgba(255,90,100,${a})` : `rgba(170,200,240,${a * .8})`;
    const s = (.6 + 1.9 * d.z) * S;
    ctx.beginPath(); ctx.arc(x, y, s, 0, 6.283); ctx.fill();
  }
  ctx.restore();
}

/* ---------- act 1 : one sentence ---------- */
const promptX = () => CX + Lay.barW / 2 - 46 * S;
function setPromptFont(c) { c.font = FA(500, Lay.promptPx); c.direction = 'rtl'; c.textAlign = 'right'; c.textBaseline = 'middle'; }

function typedCount(t) { let n = 0; while (n < TYPE_TIMES.length && TYPE_TIMES[n] <= t) n++; return n; }

function drawPromptBar(t) {
  const appear = E.outExpo(prog(t, T.barIn, T.barIn + .75));
  const collapse = E.inOutCubic(prog(t, 3.12, 3.55));
  const alpha = prog(t, T.barIn - .05, T.barIn + .25) * (1 - prog(t, 3.35, 3.6));
  if (alpha <= 0) return;
  const bh = Lay.barH;
  const bw = lerp(bh, Lay.barW, appear * (1 - collapse));
  const x = CX - bw / 2, y = CY - bh / 2;

  ctx.save(); ctx.globalAlpha = alpha;
  // glow under the bar
  let g = ctx.createRadialGradient(CX, CY + 30 * S, 0, CX, CY + 30 * S, bw * .6 + 100 * S);
  g.addColorStop(0, 'rgba(228,50,63,.16)'); g.addColorStop(1, 'rgba(228,50,63,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // body
  ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 40 * S; ctx.shadowOffsetY = 14 * S;
  rrect(ctx, x, y, bw, bh, bh / 2);
  g = ctx.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, 'rgba(26,33,48,.96)'); g.addColorStop(1, 'rgba(13,17,23,.96)');
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  const typingNow = t > T.typeStart && t < TYPE_TIMES[TYPE_TIMES.length - 1] + .15;
  ctx.lineWidth = 1.5 * S;
  ctx.strokeStyle = typingNow || (t > 2.8 && t < 3.2) ? 'rgba(228,50,63,.55)' : 'rgba(174,200,236,.30)';
  ctx.stroke();
  // top sheen
  rrect(ctx, x + 2 * S, y + 2 * S, bw - 4 * S, bh * .5, bh / 2);
  g = ctx.createLinearGradient(0, y, 0, y + bh * .5); g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fill();

  // contents only once the bar is wide
  const inner = prog(appear * (1 - collapse), .55, .9);
  if (inner > 0) {
    ctx.save(); rrect(ctx, x, y, bw, bh, bh / 2); ctx.clip(); ctx.globalAlpha = alpha * inner;
    // send button (left side, RTL)
    const press = t > 2.92 && t < 3.15 ? 1 - Math.sin(prog(t, 2.92, 3.15) * Math.PI) * .12 : 1;
    const hot = prog(t, 2.6, 2.9);
    const bx = x + 48 * S, by = CY, br = 31 * S * press;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, 6.283);
    ctx.fillStyle = hot > 0 ? C.red : 'rgba(228,50,63,.35)'; ctx.globalAlpha = alpha * inner * (.55 + .45 * hot); ctx.fill();
    ctx.globalAlpha = alpha * inner;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.2 * S; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by + 12 * S); ctx.lineTo(bx, by - 12 * S); ctx.moveTo(bx - 10 * S, by - 2 * S); ctx.lineTo(bx, by - 12 * S); ctx.lineTo(bx + 10 * S, by - 2 * S); ctx.stroke();
    // placeholder
    setPromptFont(ctx);
    const ph = prog(t, .75, .95) * (1 - prog(t, T.typeStart - .04, T.typeStart));
    if (ph > 0) { ctx.globalAlpha = alpha * inner * ph; ctx.fillStyle = C.dim; ctx.fillText('یک جمله بنویس…', promptX(), CY + 2 * S); ctx.globalAlpha = alpha * inner; }
    // typed text (peeled away from the right in act 2)
    const n = typedCount(t);
    const txt = PROMPT.slice(0, n);
    const tw = ctx.measureText(txt).width;
    ctx.save();
    if (t > T.send) { const front = lerp(promptX() + 4 * S, promptX() - tw - 4 * S, prog(t, 3.05, 3.65)); ctx.beginPath(); ctx.rect(0, 0, front, H); ctx.clip(); }
    ctx.fillStyle = C.text; ctx.fillText(txt, promptX(), CY + 2 * S);
    ctx.restore();
    // caret
    const typing = t >= T.typeStart && t <= TYPE_TIMES[TYPE_TIMES.length - 1] + .1;
    const blinkOn = typing || Math.floor(t * 2.6) % 2 === 0;
    if (blinkOn && t < T.send + .05 && t > .7) {
      const cx = promptX() - tw - (n ? 8 * S : -2 * S);
      ctx.fillStyle = C.red; ctx.shadowColor = C.red; ctx.shadowBlur = 14 * S;
      ctx.fillRect(cx - 1.5 * S, CY - 22 * S, 3 * S, 44 * S); ctx.shadowBlur = 0;
    }
    ctx.restore();
  }
  ctx.restore();

  // chips under the bar
  const chipA = prog(t, 1.25, 1.6) * (1 - prog(t, 3.0, 3.25));
  if (chipA > 0) {
    const chips = [['ویدیو', true], ['۴K', false], ['۱۰ ثانیه', false]];
    ctx.save(); ctx.font = FA(600, 22); ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let xr = CX + Lay.barW / 2 - 18 * S; const cy = CY + bh / 2 + 44 * S;
    chips.forEach(([label, on], i) => {
      const a = chipA * prog(t, 1.25 + i * .08, 1.5 + i * .08);
      const w = ctx.measureText(label).width + 40 * S, hgt = 42 * S;
      const dy = (1 - E.outCubic(prog(t, 1.25 + i * .08, 1.6 + i * .08))) * 14 * S;
      ctx.globalAlpha = a;
      rrect(ctx, xr - w, cy - hgt / 2 + dy, w, hgt, hgt / 2);
      ctx.fillStyle = on ? 'rgba(228,50,63,.14)' : 'rgba(19,25,35,.9)'; ctx.fill();
      ctx.strokeStyle = on ? 'rgba(228,50,63,.5)' : 'rgba(174,200,236,.18)'; ctx.lineWidth = 1.2 * S; ctx.stroke();
      ctx.fillStyle = on ? C.redInk : C.muted; ctx.fillText(label, xr - w / 2, cy + 1 * S + dy);
      xr -= w + 12 * S;
    });
    ctx.restore();
  }
  // send ripple
  if (t > T.send && t < T.send + .8) {
    const p = prog(t, T.send, T.send + .8);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(228,50,63,${.7 * (1 - p)})`; ctx.lineWidth = 3 * S * (1 - p) + .5;
    ctx.beginPath(); ctx.arc(x + 48 * S, CY, 31 * S + p * 160 * S, 0, 6.283); ctx.stroke();
    ctx.restore();
  }
}

/* ---------- act 2 : particles ---------- */
function buildParticles() {
  const oc = canvas(W, H), o = oc.getContext('2d', { willReadFrequently: true });
  setPromptFont(o); o.fillStyle = '#fff'; o.fillText(PROMPT, promptX(), CY + 2 * S);
  let d = o.getImageData(0, 0, W, H).data;
  const src = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 110) src.push([x, y]);
  o.clearRect(0, 0, W, H);
  drawLogo(o, CX, CY, Lay.logoR, {});
  d = o.getImageData(0, 0, W, H).data;
  const tgt = [];
  const st = Math.max(3, Math.round(4 * S));
  for (let y = 0; y < H; y += st) for (let x = 0; x < W; x += st) {
    const i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
    if (a > 200 && (.3 * r + .59 * g + .11 * b) > 26) tgt.push([x, y, (r > 130 && g < 110) ? 0 : 1]);
  }
  for (let i = tgt.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [tgt[i], tgt[j]] = [tgt[j], tgt[i]]; }
  let minX = Infinity, maxX = -Infinity; for (const p of src) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); }
  const N = Math.min(tgt.length, 3200);
  for (let i = 0; i < N; i++) {
    const s = src[Math.floor(rng() * src.length)], g = tgt[i];
    const st0 = 3.05 + 0.6 * (maxX - s[0]) / (maxX - minX + 1) + rng() * .05;
    parts.push({ sx: s[0] + (rng() - .5) * 2, sy: s[1] + (rng() - .5) * 2, tx: g[0], ty: g[1], g: g[2], st: st0, du: .95 + rng() * .32,
                 curl: (.25 + rng() * .55) * (rng() < .5 ? -1 : 1), lift: (40 + rng() * 160) * S, ph: rng() * 6.28 });
  }
}

function partPos(p, t) {
  const u = clamp((t - p.st) / p.du), e = E.inOutCubic(u);
  const dx = p.tx - p.sx, dy = p.ty - p.sy;
  const cx = (p.sx + p.tx) / 2 - dy * p.curl, cy = (p.sy + p.ty) / 2 + dx * p.curl - p.lift;
  const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
  const wob = Math.sin(Math.PI * u) * 5 * S;
  return [a * p.sx + b * cx + c * p.tx + Math.sin(t * 11 + p.ph) * wob, a * p.sy + b * cy + c * p.ty + Math.cos(t * 9 + p.ph) * wob, u];
}

function drawParticles(t) {
  const fade = 1 - prog(t, T.impact1, T.impact1 + .3);
  if (fade <= 0) return;
  const burst = E.outCubic(prog(t, T.impact1, T.impact1 + .35));
  const paths = [new Path2D(), new Path2D(), new Path2D()]; // white, red, steel
  const dots = [new Path2D(), new Path2D()];
  for (const p of parts) {
    if (t < p.st) continue;
    let [x, y, u] = partPos(p, t);
    let [px, py] = partPos(p, t - .045);
    if (burst > 0) { const k = burst * .35; x += (x - CX) * k; y += (y - CY) * k; px += (px - CX) * k * .7; py += (py - CY) * k * .7; }
    if (u >= 1 && burst === 0) { dots[p.g].rect(x - 1.1 * S, y - 1.1 * S, 2.2 * S, 2.2 * S); continue; }
    const grp = u < .3 ? 0 : p.g + 1;
    paths[grp].moveTo(px, py); paths[grp].lineTo(x, y);
  }
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  ctx.globalAlpha = fade;
  ctx.lineWidth = 1.7 * S;
  ctx.strokeStyle = 'rgba(255,235,235,.85)'; ctx.stroke(paths[0]);
  ctx.strokeStyle = 'rgba(255,70,82,.9)'; ctx.stroke(paths[1]);
  ctx.strokeStyle = 'rgba(127,184,255,.75)'; ctx.stroke(paths[2]);
  ctx.fillStyle = 'rgba(255,80,90,.9)'; ctx.fill(dots[0]);
  ctx.fillStyle = 'rgba(140,180,240,.7)'; ctx.fill(dots[1]);
  ctx.restore();
  // gathering core
  const core = prog(t, 4.0, 5.0);
  if (core > 0 && t < T.impact1) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = 380 * S * E.inCubic(core) + 30 * S;
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, r);
    g.addColorStop(0, `rgba(255,200,205,${.35 * core})`); g.addColorStop(.3, `rgba(228,50,63,${.25 * core})`); g.addColorStop(1, 'rgba(228,50,63,0)');
    ctx.fillStyle = g; ctx.fillRect(CX - r, CY - r, r * 2, r * 2); ctx.restore();
  }
  drawLogoTrace(ctx, CX, CY, Lay.logoR, prog(t, 3.7, 4.95), (1 - prog(t, T.impact1, T.impact1 + .15)) * .9);
}

/* ---------- act 3 : the mark + outputs ---------- */
function drawOrbits(t, a, front) {
  if (a <= 0) return;
  const R = Lay.logoR, rx = R * 1.62, ry = R * .40, rot = -.16;
  const sc = lerp(.7, 1, E.outCubic(prog(t, 5.0, 5.7)));
  ctx.save(); ctx.translate(CX, CY); ctx.rotate(rot); ctx.scale(sc, sc);
  ctx.globalAlpha = a * (front ? .9 : .45);
  ctx.strokeStyle = 'rgba(158,180,214,.35)'; ctx.lineWidth = 1.2 * S; ctx.setLineDash([2 * S, 7 * S]);
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(228,50,63,.35)';
  ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.18, ry * 1.3, .3, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); ctx.stroke();
  for (let k = 0; k < 4; k++) {
    const th = t * (.9 + k * .13) + k * 1.57;
    const s = Math.sin(th);
    if ((s > 0) !== front) continue;
    const big = k % 2 === 0;
    const x = Math.cos(th) * (big ? rx : rx * 1.18), y = s * (big ? ry : ry * 1.3);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, 14 * S);
    g.addColorStop(0, k === 1 ? 'rgba(127,184,255,.95)' : 'rgba(255,90,100,.95)'); g.addColorStop(1, 'rgba(255,90,100,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 14 * S, y - 14 * S, 28 * S, 28 * S);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

function cardState(cd, t) {
  const p = prog(t, cd.t, cd.t + .62);
  const e = E.outBack(p), m = E.outCubic(p);
  const fl = Math.sin(t * 1.3 + cd.t * 3) * 6 * S * prog(t, cd.t + .5, cd.t + 1.2);
  return {
    x: lerp(CX, cd.x, m), y: lerp(CY, cd.y, m) + fl,
    s: lerp(.25, 1, e), a: prog(t, cd.t, cd.t + .18),
    tilt: cd.tilt * lerp(2.2, 1, m),
  };
}

function cardThumbRect(cd) {
  const w = cd.w * S, h = cd.h * S;
  return { x: -w / 2 + 12 * S, y: -h / 2 + 58 * S, w: w - 24 * S, h: h - 70 * S };
}

function coverDraw(c, img, x, y, w, h) {
  const ia = img.width / img.height, ra = w / h;
  let sw = img.width, sh = img.height, sx = 0, sy = 0;
  if (ra > ia) { sh = img.width / ra; sy = (img.height - sh) * .5; } else { sw = img.height * ra; sx = (img.width - sw) * .5; }
  c.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawCard(cd, t, st, chromeA = 1) {
  const w = cd.w * S, h = cd.h * S;
  ctx.save();
  ctx.translate(st.x, st.y);
  ctx.transform(.955, st.tilt * .045, 0, 1, 0, 0);
  ctx.scale(st.s, st.s);
  ctx.globalAlpha = st.a;
  // body
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 50 * S; ctx.shadowOffsetY = 20 * S;
  rrect(ctx, -w / 2, -h / 2, w, h, 18 * S);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, 'rgba(24,31,45,.94)'); g.addColorStop(1, 'rgba(11,15,22,.94)');
  ctx.fillStyle = g; ctx.fill(); ctx.shadowColor = 'transparent';
  const hot = 1 - prog(t, cd.t + .3, cd.t + 1.1);
  ctx.strokeStyle = `rgba(${hot > 0 ? '228,50,63' : '174,200,236'},${hot > 0 ? .25 + .5 * hot : .2})`; ctx.lineWidth = 1.4 * S; ctx.stroke();
  ctx.globalAlpha = st.a * chromeA;
  // header
  ctx.font = FA(700, 21); ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.redInk;
  ctx.fillText(cd.label, w / 2 - 22 * S, -h / 2 + 30 * S);
  ctx.font = MONO(500, 14); ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.fillStyle = C.dim; ctx.letterSpacing = `${2 * S}px`;
  ctx.fillText(cd.meta, -w / 2 + 22 * S, -h / 2 + 31 * S);
  const mw = ctx.measureText(cd.meta).width; ctx.letterSpacing = '0px';
  ctx.beginPath(); ctx.arc(-w / 2 + 22 * S + mw + 10 * S, -h / 2 + 30 * S, 3.5 * S, 0, 6.283);
  ctx.fillStyle = (t - cd.t) % .8 < .5 ? C.red : 'rgba(228,50,63,.3)'; ctx.fill();
  ctx.globalAlpha = st.a;
  CARD_BODY[cd.key](cd, t, w, h);
  ctx.restore();
}

const CARD_BODY = {
  chat(cd, t, w, h) {
    const t0 = cd.t;
    ctx.font = FA(500, 19); ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(PROMPT).width;
    const bx = w / 2 - 20 * S, by = -h / 2 + 76 * S, bw = tw + 30 * S, bh = 42 * S;
    rrect(ctx, bx - bw, by, bw, bh, 14 * S); ctx.fillStyle = 'rgba(228,50,63,.16)'; ctx.fill();
    ctx.strokeStyle = 'rgba(228,50,63,.45)'; ctx.lineWidth = 1 * S; ctx.stroke();
    ctx.fillStyle = C.text; ctx.fillText(PROMPT, bx - 15 * S, by + bh / 2 + 1 * S);
    // reply: typing dots, then lines
    const ry = by + bh + 24 * S;
    const dotsA = prog(t, t0 + .3, t0 + .4) * (1 - prog(t, t0 + .65, t0 + .72));
    if (dotsA > 0) for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = dotsA * (.35 + .65 * (0.5 + 0.5 * Math.sin(t * 12 - k)));
      ctx.beginPath(); ctx.arc(-w / 2 + 34 * S + k * 16 * S, ry + 8 * S, 4.5 * S, 0, 6.283); ctx.fillStyle = C.text2; ctx.fill();
    }
    ctx.globalAlpha = 1;
    const widths = [.86, .72, .48];
    widths.forEach((f, k) => {
      const p = E.outCubic(prog(t, t0 + .7 + k * .14, t0 + 1.05 + k * .14));
      if (p <= 0) return;
      const lw = (w - 44 * S) * f * p;
      rrect(ctx, w / 2 - 22 * S - lw, ry + k * 22 * S, lw, 10 * S, 5 * S);
      ctx.fillStyle = k === 0 ? 'rgba(201,210,224,.34)' : 'rgba(201,210,224,.2)'; ctx.fill();
    });
  },
  image(cd, t, w, h) {
    const r = cardThumbRect(cd);
    drawImageThumb(cd, t, r);
  },
  video(cd, t, w, h) {
    const r = cardThumbRect(cd);
    if (!videoC) videoC = canvas(r.w, r.h);
    const vc = videoC.getContext('2d');
    drawShot(vc, videoC.width, videoC.height, 1.2 + (t - cd.t) * 1.0, { zoom: 1.65, panX: -.06, panY: .02 }, true);
    ctx.save(); rrect(ctx, r.x, r.y, r.w, r.h, 10 * S); ctx.clip();
    ctx.drawImage(videoC, r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(4,6,10,.28)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    // play
    const pr = 26 * S, pa = 1 - prog(t, cd.t + .7, cd.t + 1.0) * .6;
    ctx.globalAlpha = pa;
    ctx.beginPath(); ctx.arc(0, r.y + r.h / 2 - 6 * S, pr, 0, 6.283); ctx.fillStyle = 'rgba(6,8,12,.55)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.5 * S; ctx.stroke();
    ctx.beginPath(); const py = r.y + r.h / 2 - 6 * S; ctx.moveTo(-8 * S, py - 12 * S); ctx.lineTo(13 * S, py); ctx.lineTo(-8 * S, py + 12 * S); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.globalAlpha = 1;
    // progress + timecode
    const pg = clamp((t - cd.t) / 3.2) * .9 + .05;
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(r.x + 14 * S, r.y + r.h - 18 * S, r.w - 28 * S, 4 * S);
    ctx.fillStyle = C.red; ctx.fillRect(r.x + 14 * S, r.y + r.h - 18 * S, (r.w - 28 * S) * pg, 4 * S);
    ctx.font = MONO(500, 13); ctx.direction = 'ltr'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(244,247,252,.85)';
    const sec = Math.floor(pg * 10);
    ctx.fillText(`00:0${Math.min(9, sec)} / 00:10`, r.x + 14 * S, r.y + r.h - 34 * S);
    ctx.restore();
  },
  agent(cd, t, w, h) {
    const rows = [['جست‌وجو و خواندن منابع', .25], ['ساخت تصویر ۴K', .45], ['ذخیره در پروژه', .62]];
    ctx.font = FA(500, 19); ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    rows.forEach(([label, dt], k) => {
      const y = -h / 2 + 88 * S + k * 42 * S;
      const done = t > cd.t + dt, active = !done && t > cd.t + dt - .35;
      const ra = prog(t, cd.t + .1 + k * .08, cd.t + .3 + k * .08);
      ctx.globalAlpha = ra;
      const dx = w / 2 - 34 * S;
      if (done) {
        const p = E.outBack(prog(t, cd.t + dt, cd.t + dt + .25));
        ctx.beginPath(); ctx.arc(dx, y, 11 * S * p, 0, 6.283); ctx.fillStyle = C.ok; ctx.fill();
        ctx.strokeStyle = '#06110c'; ctx.lineWidth = 2.6 * S; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(dx - 5 * S * p, y); ctx.lineTo(dx - 1 * S * p, y + 4 * S * p); ctx.lineTo(dx + 5.5 * S * p, y - 4 * S * p); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(dx, y, 10 * S, 0, 6.283); ctx.strokeStyle = 'rgba(126,140,160,.5)'; ctx.lineWidth = 2 * S; ctx.stroke();
        if (active) { ctx.beginPath(); ctx.arc(dx, y, 10 * S, t * 9, t * 9 + 1.8); ctx.strokeStyle = C.red; ctx.stroke(); }
      }
      ctx.fillStyle = done ? C.text : C.muted; ctx.fillText(label, dx - 24 * S, y + 1 * S);
      ctx.globalAlpha = 1;
    });
    ctx.globalAlpha = 1;
  },
};

/** The image card: the shot "develops" from coarse pixels to full detail. */
function drawImageThumb(cd, t, r) {
  const t0 = cd.t + .15, t1 = cd.t + .95;
  const scan = E.inOutSine(prog(t, t0, t1));
  ctx.save(); rrect(ctx, r.x, r.y, r.w, r.h, 10 * S); ctx.clip();
  ctx.fillStyle = '#05070b'; ctx.fillRect(r.x, r.y, r.w, r.h);
  if (scan < 1) {
    const lev = [6, 10, 18, 32, 60][Math.min(4, Math.floor(scan * 5))];
    const pw = lev, ph = Math.max(2, Math.round(lev * r.h / r.w));
    pixC.width = pw; pixC.height = ph;
    const pc = pixC.getContext('2d'); coverDraw(pc, shotStatic, 0, 0, pw, ph);
    ctx.imageSmoothingEnabled = false; ctx.globalAlpha = .9;
    ctx.drawImage(pixC, r.x, r.y, r.w, r.h);
    ctx.imageSmoothingEnabled = true; ctx.globalAlpha = 1;
  }
  const sy = r.y + r.h * scan;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, sy - r.y); ctx.clip();
  coverDraw(ctx, shotStatic, r.x, r.y, r.w, r.h); ctx.restore();
  if (scan > 0 && scan < 1) {
    const g = ctx.createLinearGradient(0, sy - 24 * S, 0, sy + 2 * S);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,170,175,.75)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(r.x, sy - 24 * S, r.w, 26 * S);
    ctx.globalCompositeOperation = 'source-over';
  }
  // label
  ctx.font = FA(600, 15); ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  const lab = 'تصویر · ۴K', lw = ctx.measureText(lab).width + 20 * S;
  ctx.globalAlpha = prog(t, t1, t1 + .2);
  rrect(ctx, r.x + r.w - lw - 10 * S, r.y + r.h - 38 * S, lw, 28 * S, 8 * S); ctx.fillStyle = 'rgba(6,8,12,.6)'; ctx.fill();
  ctx.fillStyle = C.text; ctx.fillText(lab, r.x + r.w - 20 * S, r.y + r.h - 23 * S);
  ctx.restore();
}

function drawHero(t) {
  const out = E.inOutCubic(prog(t, T.zoom0, T.zoom0 + .45));  // everything but the image card leaves
  const heroA = 1 - out;
  const R = Lay.logoR;
  const ringsA = prog(t, 5.0, 5.4) * heroA;
  // beams from the mark to each card as it lands
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const cd of Lay.cards) {
    const p = prog(t, cd.t, cd.t + .7); if (p <= 0 || p >= 1) continue;
    const st = cardState(cd, t);
    const g = ctx.createLinearGradient(CX, CY, st.x, st.y);
    g.addColorStop(0, 'rgba(228,50,63,0)'); g.addColorStop(.6, `rgba(255,80,90,${.55 * (1 - p)})`); g.addColorStop(1, `rgba(255,200,205,${.8 * (1 - p)})`);
    ctx.strokeStyle = g; ctx.lineWidth = 2.2 * S; ctx.beginPath(); ctx.moveTo(CX, CY); ctx.lineTo(st.x, st.y); ctx.stroke();
  }
  ctx.restore();
  drawOrbits(t, ringsA, false);
  // the mark
  const land = prog(t, T.impact1, T.impact1 + .9);
  const phi = Math.sin(t * 1.15) * .13 * prog(t, 5.3, 6.2);
  const sc = lerp(1.0, .82, out);
  drawLogo(ctx, CX, CY, R * sc * (1 + .05 * (1 - E.outCubic(land))), { alpha: heroA, phi, glow: 1 + .8 * (1 - land), sweep: prog(t, 5.12, 5.85) });
  drawOrbits(t, ringsA, true);
  // cards (image card last: it becomes the shot)
  for (const cd of Lay.cards) {
    if (t < cd.t || cd.key === 'image') continue;
    const st = cardState(cd, t);
    const dir = Math.sign(cd.x - CX) || 1;
    st.a *= heroA; st.x += dir * out * 120 * S; st.s *= lerp(1, .92, out);
    if (st.a > 0) drawCard(cd, t, st);
  }
  const ic = Lay.cards.find(c => c.key === 'image');
  if (t >= ic.t) {
    const st = cardState(ic, t);
    if (t < T.zoom0) drawCard(ic, t, st);
    else drawZoom(ic, t, st);
  }
}

/** Image card opening into the full frame. */
function drawZoom(cd, t, st) {
  const z = E.inOutExpo(prog(t, T.zoom0, T.zoom1));
  const r0 = cardThumbRect(cd);
  // card-space rect -> screen rect (ignore the slight skew; it eases out)
  const sx = st.x + r0.x * st.s * .955, sy = st.y + r0.y * st.s, sw = r0.w * st.s * .955, sh = r0.h * st.s;
  const x = lerp(sx, 0, z), y = lerp(sy, 0, z), w = lerp(sw, W, z), h = lerp(sh, H, z);
  // fading card chrome
  const chromeA = 1 - prog(t, T.zoom0, T.zoom0 + .18);
  if (chromeA > 0) drawCard(cd, T.zoom0, { ...st, a: st.a * chromeA }, 1);
  ctx.save(); rrect(ctx, x, y, w, h, lerp(10 * S, 0, z)); ctx.clip();
  coverDraw(ctx, shotStatic, x, y, w, h);
  ctx.restore();
  // edge glow while moving
  if (z > 0 && z < 1) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,90,100,${.6 * Math.sin(z * Math.PI)})`; ctx.lineWidth = 3 * S;
    rrect(ctx, x, y, w, h, lerp(10 * S, 0, z)); ctx.stroke(); ctx.restore();
  }
}

/* ---------- the shot: aurora over Damavand, mirrored in a still lake ---------- */
// Heights are fractions of the frame height; horizontal distances from the peak are in frame heights too,
// so the mountain keeps its shape at any aspect ratio.
const SHOT = { peakY: .505, horizon: .757, cone: .62, coneH: .245 };
function ridgeY(dx) {
  const d = Math.abs(dx), { peakY, cone, coneH } = SHOT;
  let y;
  if (d < .02) y = peakY + d * .1;                                     // crater rim
  else if (d < cone) y = peakY + .002 + coneH * (1 - Math.pow(1 - (d - .02) / (cone - .02), 1.65));
  else y = peakY + .002 + coneH + .004 * Math.sin(d * 7);               // foothills
  if (dx > .18 && dx < .42) y -= .012 * Math.sin((dx - .18) / .24 * Math.PI); // eastern shoulder
  y += .007 * (fbm(dx * 16 + 3) - .5) * Math.min(1, d * 8) + .0025 * (fbm(dx * 70 + 11) - .5);
  return Math.min(y, SHOT.horizon);
}
let streaks = null;
function buildStreaks() {
  const r = mulberry32(31);
  streaks = [];
  for (let i = 0; i < 340; i++) {
    const b = (r() * 2 - 1) * 1.02;
    const center = 1 - Math.min(1, Math.abs(b));
    const long = fbm(b * 9 + 2, 3);
    streaks.push({ b, L: .07 + .55 * Math.pow(r(), 1.7) * (.35 + .65 * center) * (.5 + long), w: 1 + r() * 6, a: .18 + r() * .42, bend: (r() - .5) * .03 });
  }
}
let aurSmall = null;

/** Draws the shot into context c (w x h). tau: seconds of shot motion. */
function drawShot(c, w, h, tau, cam = {}, small = false) {
  const zoom = cam.zoom || 1, panX = cam.panX || 0, panY = cam.panY || 0;
  const u = h / 1080;
  const peakX = (PORTRAIT && !small) ? .5 : .55;
  const px = w * peakX;
  const tf = (f) => { const z = 1 + (zoom - 1) * f; return { z, ty: h * .5 + panY * f * h, tx: w / 2 + panX * f * w }; };
  const layer = (f, fn) => {
    const { z, tx, ty } = tf(f);
    c.save(); c.translate(tx, ty); c.scale(z, z); c.translate(-w / 2, -h * .5); fn(); c.restore();
  };
  const hyOf = f => { const { z, ty } = tf(f); return ty + (SHOT.horizon * h - h * .5) * z; };

  // sky
  let g = c.createLinearGradient(0, 0, 0, h * SHOT.horizon);
  g.addColorStop(0, '#02040a'); g.addColorStop(.4, '#06112a'); g.addColorStop(.75, '#0c1f3c'); g.addColorStop(1, '#16304a');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // stars
  layer(.25, () => {
    for (const s of stars) {
      const a = s.b * (.6 + .4 * Math.sin(tau * s.f + s.ph));
      const x = s.x * w * 1.1 - w * .05, y = s.y * h * .85, sz = s.s * Math.max(u, .5);
      c.globalAlpha = a; c.fillStyle = s.s > 2 ? '#fff4f0' : '#dfe8ff'; c.fillRect(x, y, sz, sz);
      if (s.s > 2.3 && !small) { c.globalAlpha = a * .3; c.fillRect(x - 6 * u, y + sz / 2 - .5 * u, 12 * u + sz, 1 * u); c.fillRect(x + sz / 2 - .5 * u, y - 6 * u, 1 * u, 12 * u + sz); }
    }
    c.globalAlpha = 1;
  });
  // aurora: curtains whose lower edge snakes across the sky; folds seen edge-on burn brighter
  const tt = tau + 3.0, aspect = w / h;
  const curtains = [
    { img: rayImg[1], y0: .27, a1: .06, f1: 5.0, p1: 2.2, a2: .022, f2: 13, hh: .17, alpha: .55, sp: .10, x0: -.05, x1: .78 },
    { img: rayImg[0], y0: .395, a1: .075, f1: 6.3, p1: .4, a2: .028, f2: 15, hh: .25, alpha: .95, sp: .13, x0: .06, x1: 1.08 },
  ];
  const drawAurora = (tc, aw, ah) => {
    tc.clearRect(0, 0, aw, ah);
    for (const L of curtains) {
      const base = x => L.y0 + L.a1 * Math.sin(x * L.f1 + L.p1 + tt * L.sp) + L.a2 * Math.sin(x * L.f2 - tt * L.sp * 2.2) + .03 * (fbm(x * 2.5 + tt * .04, 2) - .5);
      for (let i = 0; i < aw; i++) {
        const x = i / aw;
        const env = clamp((x - L.x0) / .14) * clamp((L.x1 - x) / .14);
        if (env <= 0) continue;
        const by = base(x), slope = Math.abs(base(x + .004) - by) / .004 / aspect;
        const fold = .75 + 1.0 * Math.min(1, slope * 3.2);
        const stri = .2 + .8 * Math.pow(fbm(x * 150 + tt * .9, 2), 1.6);
        const pulse = .35 + .65 * fbm(x * 6 - tt * .45, 2);
        const hgt = L.hh * (.45 + .75 * fbm(x * 9 + 4 + tt * .12, 3)) * (.75 + .25 * fold);
        const a = L.alpha * env * stri * pulse * fold * .74;
        if (a < .01) continue;
        tc.globalAlpha = Math.min(1, a);
        tc.drawImage(L.img, i, (by - hgt) * ah, 1.35, hgt * ah);
        tc.globalAlpha = Math.min(1, a * .55);
        tc.drawImage(rayImg[2], i, by * ah, 1.35, .022 * ah);          // magenta fringe under the edge
      }
    }
    tc.globalAlpha = 1;
  };
  layer(.45, () => {
    let src;
    if (!small) {
      const a2 = auroraC.getContext('2d'); drawAurora(a2, auroraC.width, auroraC.height); src = auroraC;
      const gl = auroraGlow.getContext('2d'); gl.clearRect(0, 0, auroraGlow.width, auroraGlow.height);
      gl.filter = `blur(${Math.max(1, 3 * u)}px)`; gl.drawImage(auroraC, 0, 0, auroraGlow.width, auroraGlow.height); gl.filter = 'none';
    } else {
      if (!aurSmall || aurSmall.width !== Math.round(w / 2)) aurSmall = canvas(w / 2, h / 2);
      drawAurora(aurSmall.getContext('2d'), aurSmall.width, aurSmall.height); src = aurSmall;
    }
    c.globalCompositeOperation = 'lighter';
    c.drawImage(src, 0, 0, w, h);
    if (!small) { c.globalAlpha = .85; c.drawImage(auroraGlow, 0, 0, w, h); c.globalAlpha = 1; }
    // sky glow the aurora throws down onto the horizon
    g = c.createRadialGradient(px, h * .62, 0, px, h * .62, w * .7);
    g.addColorStop(0, 'rgba(60,220,170,.13)'); g.addColorStop(.5, 'rgba(60,120,200,.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
  });
  // distant range, hazy with aurora light
  layer(.8, () => {
    c.beginPath(); c.moveTo(-w * .2, h * SHOT.horizon + 2);
    for (let x = -.2; x <= 1.2; x += small ? .02 : .004) c.lineTo(x * w, h * (.705 + .035 * (fbm(x * 4.5 + 70, 4) - .5) + .02 * Math.abs(Math.sin(x * 3.1))));
    c.lineTo(w * 1.2, h * SHOT.horizon + 2); c.closePath();
    g = c.createLinearGradient(0, h * .66, 0, h * SHOT.horizon); g.addColorStop(0, '#1a3048'); g.addColorStop(1, '#0b1626');
    c.fillStyle = g; c.fill();
  });
  // Damavand
  layer(1, () => {
    const step = small ? .008 : .0025, pts = [];
    for (let dx = -1.6; dx <= 1.6; dx += step) pts.push([px + dx * h, ridgeY(dx) * h, dx]);
    const hy = SHOT.horizon * h + 1;
    const body = new Path2D(); body.moveTo(pts[0][0], hy); for (const p of pts) body.lineTo(p[0], p[1]); body.lineTo(pts[pts.length - 1][0], hy); body.closePath();
    g = c.createLinearGradient(0, h * SHOT.peakY, 0, hy); g.addColorStop(0, '#152238'); g.addColorStop(.6, '#0b1322'); g.addColorStop(1, '#070b14');
    c.fillStyle = g; c.fill(body);
    c.save(); c.clip(body);
    // snow: streaks fanning down the gullies from the summit, solid near the top
    const sx = px, sy = ridgeY(0) * h;
    g = c.createLinearGradient(0, sy, 0, sy + SHOT.coneH * h * .75);
    g.addColorStop(0, 'rgba(205,232,232,.92)'); g.addColorStop(.35, 'rgba(160,200,210,.75)'); g.addColorStop(1, 'rgba(100,140,165,.35)');
    c.fillStyle = g;
    c.beginPath(); c.ellipse(sx, sy, h * .045, h * .018, 0, 0, 6.283); c.fill();
    for (const st of streaks) {
      const bx = px + st.b * SHOT.cone * h, by = hy;
      const ex = lerp(sx, bx, st.L), ey = lerp(sy, by, st.L);
      const dx = bx - sx, dy = by - sy, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      const ww = st.w * u, mx = (sx + ex) / 2 + nx * st.bend * h, my = (sy + ey) / 2 + ny * st.bend * h;
      c.globalAlpha = st.a;
      c.beginPath();
      c.moveTo(sx - nx * 1.5 * u, sy - ny * 1.5 * u);
      c.quadraticCurveTo(mx - nx * ww * .6, my - ny * ww * .6, ex - nx * ww * .3, ey - ny * ww * .3);
      c.lineTo(ex + nx * ww * .3, ey + ny * ww * .3);
      c.quadraticCurveTo(mx + nx * ww * .6, my + ny * ww * .6, sx + nx * 1.5 * u, sy + ny * 1.5 * u);
      c.closePath(); c.fill();
    }
    c.globalAlpha = 1;
    // form shading: the eastern flank turns away from the light
    g = c.createLinearGradient(px - h * .06, 0, px + h * .6, 0);
    g.addColorStop(0, 'rgba(2,5,12,0)'); g.addColorStop(.3, 'rgba(2,5,12,.42)'); g.addColorStop(1, 'rgba(2,5,12,.7)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    g = c.createLinearGradient(px - h * .7, 0, px + h * .1, 0);
    g.addColorStop(0, 'rgba(80,240,180,0)'); g.addColorStop(.75, 'rgba(80,240,180,.07)'); g.addColorStop(1, 'rgba(80,240,180,0)');
    c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(0, 0, w, h);
    g = c.createRadialGradient(sx, sy, 0, sx, sy, h * .22);
    g.addColorStop(0, 'rgba(150,255,215,.12)'); g.addColorStop(1, 'rgba(150,255,215,0)');
    c.fillStyle = g; c.fillRect(sx - h * .25, sy - h * .25, h * .5, h * .5);
    c.globalCompositeOperation = 'source-over';
    // haze at the foot
    g = c.createLinearGradient(0, hy - h * .08, 0, hy);
    g.addColorStop(0, 'rgba(40,70,110,0)'); g.addColorStop(1, 'rgba(40,70,110,.35)');
    c.fillStyle = g; c.fillRect(0, hy - h * .08, w, h * .08);
    c.restore();
    // rim light along the ridge
    g = c.createLinearGradient(px - h * .7, 0, px + h * .7, 0);
    g.addColorStop(0, 'rgba(160,255,215,0)'); g.addColorStop(.46, 'rgba(190,255,230,.6)'); g.addColorStop(.56, 'rgba(190,255,230,.35)'); g.addColorStop(1, 'rgba(160,255,215,0)');
    c.strokeStyle = g; c.lineWidth = 1.5 * u; c.beginPath();
    pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke();
  });
  // the lake: the sky and mountain, mirrored and darkened, broken by slow ripples
  {
    const hyS = Math.round(hyOf(1)), rh = Math.min(h - hyS, hyS);
    if (rh > 2) {
      c.save();
      c.translate(0, 2 * hyS); c.scale(1, -1);
      c.globalAlpha = .82; if (!small) c.filter = `blur(${1.4 * u}px)`;
      c.drawImage(c.canvas, 0, hyS - rh, w, rh, 0, hyS - rh, w, rh);
      c.restore();
      g = c.createLinearGradient(0, hyS, 0, hyS + rh);
      g.addColorStop(0, 'rgba(3,6,14,.12)'); g.addColorStop(1, 'rgba(2,4,10,.7)');
      c.fillStyle = g; c.fillRect(0, hyS, w, h - hyS);
      if (!small) {
        for (let k = 0; k < 46; k++) {
          const ry = hyS + 3 * u + Math.pow(hash(k * 3.3), 1.4) * rh, x0 = (hash(k * 7.1) * 1.2 - .1 + tau * .004 * (1 + hash(k))) * w;
          const lw = (.02 + hash(k * 1.9) * .12) * w * (.4 + (ry - hyS) / rh);
          c.fillStyle = hash(k * 5.7) < .45 ? `rgba(150,230,210,${.03 + .05 * hash(k)})` : `rgba(1,3,8,${.12 + .15 * hash(k)})`;
          c.fillRect(x0, ry, lw, Math.max(1, u * (1 + (ry - hyS) / rh * 1.5)));
        }
      }
      // shoreline glint
      g = c.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, 'rgba(120,220,200,0)'); g.addColorStop(peakX, 'rgba(150,240,215,.35)'); g.addColorStop(1, 'rgba(120,220,200,0)');
      c.fillStyle = g; c.fillRect(0, hyS - .5 * u, w, 1.2 * u);
    }
  }
  // foreground: dark rock framing the lake
  const fg = (f, pts, col) => layer(f, () => {
    c.beginPath(); c.moveTo(-w * .3, h * 1.3);
    for (let x = -.3; x <= 1.3; x += small ? .02 : .004) c.lineTo(x * w, h * pts(x));
    c.lineTo(w * 1.3, h * 1.3); c.closePath(); c.fillStyle = col; c.fill();
  });
  const ss = (a, b, x) => { const q = clamp((x - a) / (b - a)); return q * q * (3 - 2 * q); };
  const bank = x => Math.min(.70 + .175 * ss(-.02, .34, x), .735 + .14 * (1 - ss(.74, 1.02, x)), .885) + .012 * (fbm(x * 9 + 5, 4) - .5) + .005 * (fbm(x * 40 + 1, 2) - .5);
  fg(1.25, bank, '#020409');
  fg(1.55, x => .93 + .02 * (fbm(x * 7 + 57, 4) - .5), '#010204');
  // grade
  g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(4,6,14,.3)'); g.addColorStop(.35, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.2)');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}

function drawShotPhase(t) {
  if (t >= T.zoom1 && t < T.shutter1 + .02) {
    const tau = t - T.zoom1;
    const sc = shotCanvas.getContext('2d');
    drawShot(sc, W, H, tau, { zoom: 1 + .085 * E.inOutSine(prog(t, T.zoom1, T.shutter1)), panY: -.012 * prog(t, T.zoom1, T.shutter1) });
    ctx.drawImage(shotCanvas, 0, 0);
  }
  // letterbox, closing like a shutter at the end
  const open = E.inOutCubic(prog(t, 7.35, 7.95));
  const close = E.inCubic(prog(t, T.shutter0, T.shutter1));
  let bar = Lay.letterbox * open;
  bar = lerp(bar, H / 2 + 2, close);
  if (bar > 0 && t < T.impact2) {
    ctx.fillStyle = '#000';
    ctx.fillRect(-40, -40, W + 80, bar + 40); ctx.fillRect(-40, H - bar, W + 80, bar + 40);
    // red seam as the shutter shuts
    const seam = prog(t, 10.55, T.shutter1) * (t < T.impact2 ? 1 : 0);
    if (seam > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, 'rgba(228,50,63,0)'); g.addColorStop(.5, `rgba(255,90,100,${seam})`); g.addColorStop(1, 'rgba(228,50,63,0)');
      ctx.fillStyle = g; ctx.fillRect(0, CY - 1.5 * S, W, 3 * S);
      const g2 = ctx.createRadialGradient(CX, CY, 0, CX, CY, 500 * S);
      g2.addColorStop(0, `rgba(228,50,63,${.35 * seam})`); g2.addColorStop(1, 'rgba(228,50,63,0)');
      ctx.save(); ctx.translate(CX, CY); ctx.scale(1.8, .12); ctx.translate(-CX, -CY); ctx.fillStyle = g2; ctx.fillRect(CX - 500 * S, CY - 500 * S, 1000 * S, 1000 * S); ctx.restore();
      ctx.restore();
    }
  }
  // caption: the sentence that made the shot
  const capA = prog(t, 8.05, 8.6) * (1 - prog(t, 10.05, 10.4));
  if (capA > 0) {
    const y = H - Lay.letterbox / 2;
    ctx.save(); ctx.globalAlpha = capA;
    ctx.font = FA(500, 30); ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const rise = (1 - E.outCubic(prog(t, 8.05, 8.7))) * 14 * S;
    ctx.fillStyle = C.text; ctx.fillText(`«${PROMPT}»`, CX, y + rise);
    ctx.font = MONO(500, 14); ctx.direction = 'ltr'; ctx.fillStyle = C.dim; ctx.letterSpacing = `${3 * S}px`;
    ctx.textAlign = PORTRAIT ? 'center' : 'left';
    if (!PORTRAIT) ctx.fillText('SHOT 01 · 4K', 60 * S, y + 1 * S);
    ctx.textAlign = 'right';
    if (!PORTRAIT) { ctx.fillText('NAVIDIX STUDIO', W - 80 * S, y + 1 * S); ctx.beginPath(); ctx.arc(W - 62 * S, y, 5 * S, 0, 6.283); ctx.fillStyle = Math.floor(t * 2) % 2 ? C.red : 'rgba(228,50,63,.35)'; ctx.fill(); }
    ctx.letterSpacing = '0px';
    ctx.restore();
  }
}

/* ---------- lockup ---------- */
const SCRAMBLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function decode(str, t, t0, per) {
  let s = '';
  for (let i = 0; i < str.length; i++) {
    const ti = t0 + i * per;
    if (str[i] === ' ') s += ' ';
    else if (t >= ti + .18) s += str[i];
    else if (t >= ti) s += SCRAMBLE[Math.floor(hash(i * 13.1 + Math.floor(t * 40)) * SCRAMBLE.length)];
    else s += ' ';
  }
  return s;
}

function revealLine(t, t0, draw, clipY, clipH, dist) {
  const p = E.outExpo(prog(t, t0, t0 + .9));
  if (p <= 0) return;
  ctx.save(); ctx.beginPath(); ctx.rect(-50, clipY, W + 100, clipH); ctx.clip();
  ctx.translate(0, (1 - p) * dist); ctx.globalAlpha = prog(t, t0, t0 + .25);
  draw(); ctx.restore();
}

function drawLockup(t) {
  const Lk = Lay.lock;
  const t0 = T.impact2;
  // the mark spins in, then settles into place
  const spin = prog(t, t0, t0 + .95);
  const move = E.inOutCubic(prog(t, t0 + .45, t0 + 1.2));
  const x = lerp(CX, Lk.lx, move), y = lerp(CY, Lk.ly, move);
  const R = lerp(Lay.logoR * 1.06, Lk.lR, move) * lerp(1.3, 1, E.outExpo(spin));
  const phi = lerp(-1.35, 0, E.outBack(spin)) + Math.sin(t * 1.05) * .1 * prog(t, t0 + 1.2, t0 + 2.2);
  drawLogo(ctx, x, y, R, { alpha: prog(t, t0, t0 + .08), phi, glow: 1 + .9 * (1 - spin), sweep: prog(t, 12.15, 12.85) });

  const right = Lk.align === 'right';
  const tx = Lk.tx;
  const set = (font, dir, align) => { ctx.font = font; ctx.direction = dir; ctx.textAlign = right ? 'right' : 'center'; if (align) ctx.textAlign = align; ctx.textBaseline = 'middle'; };
  // NAVIDIX STUDIO
  if (t > 11.45) {
    ctx.save(); set(MONO(500, 24), 'ltr'); ctx.letterSpacing = `${9 * S}px`; ctx.fillStyle = C.redInk;
    ctx.fillText(decode('NAVIDIX STUDIO', t, 11.45, .035), tx + (right ? 9 * S : 4.5 * S), Lk.y1);
    ctx.restore();
  }
  revealLine(t, 11.6, () => { set(FA(700, 50), 'rtl'); ctx.fillStyle = C.text2; ctx.fillText('استودیو نویدیکس', tx, Lk.y2); }, Lk.y2 - 40 * S, 80 * S, 50 * S);
  revealLine(t, 11.78, () => { set(FA(900, Lk.big), 'rtl'); ctx.fillStyle = C.text; ctx.fillText('از یک جمله،', tx, Lk.y3); }, Lk.y3 - Lk.big * .85 * S, Lk.big * 1.7 * S, Lk.big * 1.1 * S);
  revealLine(t, 11.96, () => {
    set(FA(900, Lk.big), 'rtl'); ctx.fillStyle = C.text; ctx.fillText('تا یک نما.', tx, Lk.y4);
  }, Lk.y4 - Lk.big * .85 * S, Lk.big * 1.7 * S, Lk.big * 1.1 * S);
  // pills
  const pills = ['گفتگو', 'تصویر', 'ویدیو', 'ایجنت'];
  ctx.save(); ctx.font = FA(700, 26); ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ph = 54 * S, pad = 24 * S, gap = 14 * S;
  const widths = pills.map(p => ctx.measureText(p).width + pad * 2);
  const total = widths.reduce((a, b) => a + b, 0) + gap * (pills.length - 1);
  let xr = right ? tx : CX + total / 2;
  pills.forEach((p, i) => {
    const pt = 12.35 + i * .1, a = prog(t, pt, pt + .15);
    if (a > 0) {
      const s = E.outBack(prog(t, pt, pt + .4)), w = widths[i];
      ctx.save(); ctx.globalAlpha = a; ctx.translate(xr - w / 2, Lk.y5); ctx.scale(s, s);
      rrect(ctx, -w / 2, -ph / 2, w, ph, 15 * S); ctx.fillStyle = 'rgba(19,25,35,.92)'; ctx.fill();
      ctx.strokeStyle = 'rgba(174,200,236,.22)'; ctx.lineWidth = 1.3 * S; ctx.stroke();
      ctx.fillStyle = C.text; ctx.fillText(p, 0, 2 * S);
      ctx.restore();
    }
    xr -= widths[i] + gap;
  });
  ctx.restore();
  // url
  const ua = prog(t, 12.85, 13.3);
  if (ua > 0) {
    ctx.save(); ctx.globalAlpha = ua; set(MONO(500, 25), 'ltr'); ctx.fillStyle = C.muted; ctx.letterSpacing = `${1 * S}px`;
    ctx.fillText('navidixstudio.com', tx, Lk.yUrl); ctx.restore();
  }
  // top red line, like the studio's cover
  const line = E.outExpo(prog(t, t0, t0 + 1.4));
  if (line > 0) {
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, 'rgba(228,50,63,0)'); g.addColorStop(.5, 'rgba(228,50,63,.95)'); g.addColorStop(1, 'rgba(228,50,63,0)');
    ctx.fillStyle = g; const lw = W * line; ctx.fillRect(CX - lw / 2, 0, lw, 4 * S);
  }
}

/* ---------- impacts ---------- */
function drawImpact(t, t0, x, y, strength) {
  const dt = t - t0; if (dt < 0 || dt > 1.4) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  // flash
  const fl = Math.pow(1 - prog(dt, 0, .45), 2) * strength;
  if (fl > 0) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * .8);
    g.addColorStop(0, `rgba(255,235,235,${.85 * fl})`); g.addColorStop(.18, `rgba(255,70,80,${.45 * fl})`); g.addColorStop(1, 'rgba(228,50,63,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // shockwaves
  for (const [delay, col, wmax, reach] of [[0, '255,90,100', 26, 1.25], [.08, '127,184,255', 10, 1.0], [.16, '255,200,205', 5, .8]]) {
    const p = prog(dt, delay, delay + .9); if (p <= 0 || p >= 1) continue;
    const r = E.outCubic(p) * Math.max(W, H) * .75 * reach;
    ctx.strokeStyle = `rgba(${col},${.7 * (1 - p) * strength})`; ctx.lineWidth = Math.max(.5, wmax * S * (1 - p));
    ctx.beginPath(); ctx.ellipse(x, y, r, r * .92, 0, 0, 6.283); ctx.stroke();
  }
  // sparks
  ctx.lineCap = 'round';
  for (const s of sparks) {
    if (dt > s.life) continue;
    const pos = d => s.v * S * (1 - Math.exp(-s.k * d)) / s.k;
    const r1 = pos(dt) + 60 * S, r0 = pos(Math.max(0, dt - .05)) + 60 * S;
    const a = (1 - dt / s.life) * strength;
    ctx.strokeStyle = s.red < .6 ? `rgba(255,${80 + s.red * 120 | 0},90,${a})` : `rgba(255,240,235,${a})`;
    ctx.lineWidth = s.w * S;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(s.a) * r0, y + Math.sin(s.a) * r0); ctx.lineTo(x + Math.cos(s.a) * r1, y + Math.sin(s.a) * r1); ctx.stroke();
  }
  ctx.restore();
}

/* ---------- HUD: 01 one sentence · 02 one model · 03 one shot ---------- */
function drawHUD(t) {
  const a = prog(t, .45, .9) * (1 - prog(t, 10.2, 10.5));
  if (a <= 0) return;
  const items = [['01', 'یک جمله', .45, 3.0], ['02', 'یک مدل', 3.0, 5.0], ['03', 'یک نما', 5.0, 10.3]];
  const spacing = (PORTRAIT ? 320 : 270) * S;
  ctx.save(); ctx.globalAlpha = a; ctx.textBaseline = 'middle';
  items.forEach(([num, label, a0, a1], i) => {
    const cx = CX + (1 - i) * spacing;
    const active = t >= a0 && t < a1, done = t >= a1;
    ctx.font = MONO(500, 20); ctx.direction = 'ltr'; const nw = ctx.measureText(num).width;
    ctx.font = FA(600, 27); ctx.direction = 'rtl'; const lw = ctx.measureText(label).width;
    const tw = nw + 12 * S + lw, xr = cx + tw / 2;
    const k = active ? 1 : done ? .55 : .32;
    ctx.globalAlpha = a * k;
    ctx.font = MONO(500, 20); ctx.direction = 'ltr'; ctx.textAlign = 'right'; ctx.fillStyle = active || done ? C.red : C.dim;
    ctx.fillText(num, xr, Lay.hudY + 1 * S);
    ctx.font = FA(600, 27); ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillStyle = C.text;
    ctx.fillText(label, xr - nw - 12 * S, Lay.hudY + 2 * S);
    // progress rule
    const p = active ? E.inOutSine(prog(t, a0, a1)) : done ? 1 : 0;
    ctx.globalAlpha = a * .25; ctx.fillStyle = C.text2; ctx.fillRect(cx - tw / 2, Lay.hudY + 26 * S, tw, 2 * S);
    if (p > 0) { ctx.globalAlpha = a * (active ? 1 : .6); ctx.fillStyle = C.red; ctx.fillRect(xr - tw * p, Lay.hudY + 26 * S, tw * p, 2 * S); }
  });
  ctx.restore();
}

/* ---------- post ---------- */
function post(t, f) {
  // bloom: bright-pass by brightness/contrast, blurred at low resolution
  for (const [cv, blur, alpha] of [[bloomA, 4, .55], [bloomB, 9, .7]]) {
    const b = cv.getContext('2d');
    b.globalCompositeOperation = 'copy'; b.filter = `brightness(.58) contrast(2.8) blur(${blur}px)`;
    b.drawImage(cvs, 0, 0, cv.width, cv.height); b.filter = 'none';
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.drawImage(cv, 0, 0, W, H); ctx.restore();
  }
  ctx.drawImage(vignette, 0, 0);
  // grain
  ctx.save();
  const pat = ctx.createPattern(grain[f % grain.length], 'repeat');
  pat.setTransform(new DOMMatrix().translate(hash(f) * 256, hash(f + 9) * 256));
  ctx.fillStyle = pat; ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .07; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .018; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // fade in from black
  const fi = 1 - prog(t, 0, .45);
  if (fi > 0) { ctx.fillStyle = `rgba(0,0,0,${fi})`; ctx.fillRect(0, 0, W, H); }
}

/* ---------- frame ---------- */
function render(t) {
  t = clamp(t, 0, DUR);
  const f = Math.round(t * 60);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.save();
  // camera: shake + punch on the two impacts
  let sh = 0, punch = 0;
  for (const ti of [T.impact1, T.impact2]) if (t >= ti && t < ti + .8) { sh += 16 * S * Math.exp(-(t - ti) * 7); punch += .03 * Math.exp(-(t - ti) * 5); }
  const ox = (hash(f * 1.7) - .5) * 2 * sh, oy = (hash(f * 3.1 + 2) - .5) * 2 * sh;
  ctx.translate(CX + ox, CY + oy); ctx.scale(1 + punch, 1 + punch); ctx.translate(-CX, -CY);

  const mood = {
    red: t < 3 ? .5 : t < 5 ? lerp(.5, 1.1, prog(t, 3, 5)) : 1,
    blue: t < 11 ? .7 : 1,
    core: t < 3 ? 0 : t < 7.5 ? prog(t, 3.2, 5) * (1 - prog(t, 7, 7.5)) : 0,
    grid: t < 5 ? 0 : t < 7.5 ? prog(t, 5, 5.8) * (1 - prog(t, 7, 7.4)) : prog(t, 11.2, 12.4) * .7,
  };
  drawBackground(t, mood);
  drawDust(t, t < 11 ? .8 : 1);
  if (t < 3.65) drawPromptBar(t);
  if (t >= 3.0 && t < 5.4) drawParticles(t);
  if (t >= T.impact1 && t < T.zoom1 + .02) drawHero(t);
  if (t >= 7.3 && t < T.impact2) drawShotPhase(t); // letterbox begins during the zoom
  if (t >= T.impact2) drawLockup(t);
  drawImpact(t, T.impact1, CX, CY, 1);
  drawImpact(t, T.impact2, CX, CY, 1.1);
  ctx.restore();
  drawHUD(t);
  post(t, f);
}

/* ---------- boot ---------- */
async function loadFonts() {
  const list = [
    new FontFace('Estedad', 'url(assets/estedad-var.woff2)', { weight: '100 900' }),
    new FontFace('DM Mono', 'url(assets/dmmono-400.woff2)', { weight: '400' }),
    new FontFace('DM Mono', 'url(assets/dmmono-500.woff2)', { weight: '500' }),
    new FontFace('Archivo Black', 'url(assets/archivo-black.woff2)'),
  ];
  for (const f of list) { await f.load(); document.fonts.add(f); }
  await document.fonts.ready;
}

const ready = (async () => {
  await loadFonts();
  buildAssets();
  drawShot(shotStatic.getContext('2d'), W, H, 0, {});
  buildParticles();
  render(0);
})();

window.NVX = { ready, render, DUR, W, H, T, TYPE_TIMES, canvas: cvs };
})();
