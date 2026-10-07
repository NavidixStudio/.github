/* Navidix Studio — 15s, 3D: the studio's features around the Navidix mark.
 *
 * 0.00 – 2.55  macro over the mark's circuit board; a spark spreads light along the traces
 * 2.55 – 3.75  pull back; the three N pieces slam in, the neon border ignites → impact
 * 3.75 – 4.69  hero shot of the mark
 * 4.69 – 12.19 a full orbit around the mark, one station per feature (4 beats each, 128 BPM):
 *              گفتگو · تصویر · ویدیو · ایجنت‌ها
 * 12.19 – 15   the camera comes home: mark, NAVIDIX logotype, tagline, address
 *
 * render(t) is a pure function of time, so frames can be drawn in any order.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const Q = new URLSearchParams(location.search);
const W = +(Q.get('w') || 1920), H = +(Q.get('h') || 1080);
const ASPECT = W / H, PORTRAIT = H > W;
const DUR = 15, B = 60 / 128, DEG = Math.PI / 180;
const T = {
  spark: .2, slam: [6 * B, 6.5 * B, 7 * B], neon: 7.5 * B, boom: 8 * B,
  feat: [10 * B, 14 * B, 18 * B, 22 * B], lock: 26 * B,
};

/* ---------- math ---------- */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  inOutCubic: x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inCubic: x => x * x * x,
  outExpo: x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * x),
  inOutExpo: x => x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  outBack: x => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
  outQuint: x => 1 - Math.pow(1 - x, 5),
};
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const HDR = (r, g, b) => new THREE.Color(r, g, b);

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010206);
scene.fog = new THREE.FogExp2(0x03050b, 0.03);

const FOV = PORTRAIT ? 44 : 30;
const camera = new THREE.PerspectiveCamera(FOV, ASPECT, .02, 300);

/* ---------- text ---------- */
function textCanvas(str, { weight = 800, size = 220, family = 'Estedad', color = '#fff', dir = 'rtl', ls = 0, pad = .2 } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `${weight} ${size}px ${family}`;
  g.font = font; g.letterSpacing = `${ls}px`; g.direction = dir;
  const w = Math.ceil(g.measureText(str).width + size * pad * 2 + Math.abs(ls)), h = Math.ceil(size * 1.6);
  c.width = w; c.height = h;
  g.font = font; g.letterSpacing = `${ls}px`; g.direction = dir; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  g.fillText(str, w / 2 + ls / 2, h * .54);
  return c;
}
function tex(canvasOrImage) {
  const t = canvasOrImage instanceof HTMLCanvasElement ? new THREE.CanvasTexture(canvasOrImage) : new THREE.Texture(canvasOrImage);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  return t;
}
/** A flat text plane; `size` is the font size in world units. */
function textPlane(str, size, opts = {}, mat = {}) {
  const c = textCanvas(str, { size: 200, ...opts });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size * c.width / 200, size * c.height / 200),
    new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false, ...mat }));
  return m;
}
/** Text with real depth: stacked cut-out layers, white face over a red-to-black side. */
function layeredText(str, size, { layers = 14, depth = .075, front = [1, 1, 1], s0 = [.95, .08, .12], s1 = [.12, .01, .02], weight = 900, family = 'Estedad', dir = 'rtl', ls = 0 } = {}) {
  const c = textCanvas(str, { weight, size: 220, family, dir, ls });
  const t = tex(c);
  const geo = new THREE.PlaneGeometry(size * c.width / 220, size * c.height / 220);
  const g = new THREE.Group();
  for (let i = layers; i >= 1; i--) {
    const k = (i - 1) / (layers - 1);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, color: HDR(lerp(s0[0], s1[0], k), lerp(s0[1], s1[1], k), lerp(s0[2], s1[2], k)), alphaTest: .45 }));
    m.position.z = -i * depth / layers; g.add(m);
  }
  g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, color: HDR(...front), alphaTest: .45 })));
  g.userData.width = geo.parameters.width;
  return g;
}
function radialTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); return t;
}
const DOT = () => radialTexture([[0, 'rgba(255,255,255,1)'], [.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]);
function rrectPath(w, h, r, n = 8) {
  const pts = [], hw = w / 2 - r, hh = h / 2 - r;
  const corners = [[hw, hh, 0], [-hw, hh, 90], [-hw, -hh, 180], [hw, -hh, 270]];
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= n; i++) { const a = (a0 + 90 * i / n) * DEG; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
function outline(pts, color, width = .006, closed = true) {
  const pos = [];
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; pos.push(a[0], a[1], a[2] || 0, b[0], b[1], b[2] || 0); }
  const g = new LineSegmentsGeometry(); g.setPositions(pos);
  const m = new LineMaterial({ color, linewidth: width, worldUnits: true, transparent: true });
  m.resolution.set(W, H);
  return new LineSegments2(g, m);
}

/* ---------- environment & sky ---------- */
function buildEnvironment() {
  const env = new THREE.Scene(); env.background = new THREE.Color(0x010204);
  const add = (w, h, col, p) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.copy(p); m.lookAt(0, 0, 0); env.add(m); };
  add(10, 3, HDR(2.4, 2.5, 2.8), V3(0, 7, 3));          // soft box above
  add(2, 10, HDR(3.2, .25, .3), V3(-7, 0, 1.5));          // red strip, left
  add(2, 10, HDR(.4, .65, 1.8), V3(7, 1, -1));            // blue strip, right
  add(7, 1, HDR(1.6, 1.6, 1.7), V3(0, -1.5, 8));          // low front strip
  add(5, 5, HDR(1.8, .12, .18), V3(0, -2, -7));           // red behind
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, .03).texture;
  scene.environmentIntensity = .65;
}

const sky = { stars: null, nebula: null, dust: null };
function buildSky() {
  const neb = new THREE.Mesh(new THREE.SphereGeometry(120, 48, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `
      uniform float uTime; varying vec3 vDir;
      float h(vec3 p){ p = fract(p*.3183099+.1); p *= 17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float n(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float a = fbm(d*2.1 + vec3(0., uTime*.01, 0.));
        float b = fbm(d*3.4 + 7.3);
        vec3 col = vec3(.006,.009,.02);
        col += vec3(.022,.045,.11) * smoothstep(.42,.86,a);
        col += vec3(.07,.006,.014) * smoothstep(.6,.94,b);
        col += vec3(.025,.004,.008) * pow(max(0., 1. - abs(d.y + .1) * 2.4), 3.);
        gl_FragColor = vec4(col, 1.);
      }`,
  }));
  scene.add(neb); sky.nebula = neb;

  const r = mulberry32(9), N = 2600;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), ph = new Float32Array(N), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, rr = 70 + r() * 30, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * rr, u * rr, Math.sin(a) * s * rr], i * 3);
    size[i] = 1 + Math.pow(r(), 6) * 5; ph[i] = r();
    const red = r() < .1;
    col.set(red ? [1, .35, .4] : [.75 + r() * .25, .82 + r() * .18, 1], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 }, uScale: { value: Math.min(W, H) / 1080 } },
    vertexShader: `attribute float aSize; attribute float aPhase; attribute vec3 aColor; uniform float uTime; uniform float uScale;
      varying vec3 vC; void main(){ float tw = .6 + .4*sin(uTime*(1.2+aPhase*3.) + aPhase*40.); vC = aColor*tw;
      gl_PointSize = aSize * uScale; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `varying vec3 vC; void main(){ float d = length(gl_PointCoord-.5); float a = pow(smoothstep(.5,0.,d),2.); gl_FragColor = vec4(vC*a*1.4, a); }`,
  }));
  scene.add(stars); sky.stars = stars;

  // drifting dust between the mark and the stations
  const M = 900, dp = new Float32Array(M * 3), ds = new Float32Array(M), dph = new Float32Array(M), dc = new Float32Array(M * 3);
  for (let i = 0; i < M; i++) {
    const a = r() * Math.PI * 2, rr = 1.6 + Math.pow(r(), .7) * 13;
    dp.set([Math.cos(a) * rr, (r() - .5) * 6, Math.sin(a) * rr], i * 3);
    ds[i] = .02 + r() * .05; dph[i] = r() * 6.28;
    dc.set(r() < .3 ? [1, .25, .3] : [.5, .65, 1], i * 3);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('aSize', new THREE.BufferAttribute(ds, 1));
  dg.setAttribute('aPhase', new THREE.BufferAttribute(dph, 1)); dg.setAttribute('aColor', new THREE.BufferAttribute(dc, 3));
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uScale: { value: H } },
    vertexShader: `attribute float aSize; attribute float aPhase; attribute vec3 aColor; uniform float uTime; uniform float uScale; varying vec3 vC; varying float vA;
      void main(){ vec3 p = position + vec3(sin(uTime*.25+aPhase), cos(uTime*.2+aPhase*1.3)*.6, sin(uTime*.18+aPhase*2.))*.25;
        vec4 mv = modelViewMatrix * vec4(p,1.); float dist = -mv.z; vC = aColor; vA = smoothstep(.4, 2.5, dist) * smoothstep(26., 8., dist);
        gl_PointSize = aSize * uScale / dist; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord-.5); float a = smoothstep(.5,.1,d)*vA*.55; gl_FragColor = vec4(vC*a, a); }`,
  }));
  scene.add(dust); sky.dust = dust;
}

/* ---------- the mark ---------- */
const FACE = .115;
const logo = { group: new THREE.Group(), pieces: [], neon: null, neonDim: null, circuit: null, pads: null, pulses: null, glow: null };
function hexPts(r) { const p = []; for (let k = 0; k < 6; k++) { const a = (90 + 60 * k) * DEG; p.push([r * Math.cos(a), r * Math.sin(a)]); } return p; }
function shapeFrom(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; }
function hexRing(r0, r1) { const s = shapeFrom(hexPts(r1)); const h = new THREE.Path(); hexPts(r0).forEach(([x, y], i) => i ? h.lineTo(x, y) : h.moveTo(x, y)); h.closePath(); s.holes.push(h); return new THREE.ShapeGeometry(s); }
const inHex = (x, y, r) => Math.abs(x) <= r * .8660254 && Math.abs(y) <= r - Math.abs(x) * .5773503;

// The N, traced from the homepage mark (units of the hexagon radius, y up).
const N_PIECES = {
  L: [[-0.499, 0.256], [-0.246, -0.036], [-0.246, -0.574], [-0.499, -0.428]],
  D: [[-0.506, 0.407], [-0.276, 0.548], [0.530, -0.421], [0.308, -0.562]],
  R: [[0.269, 0.580], [0.513, 0.433], [0.513, -0.266], [0.269, 0.016]],
};
const SLAM_FROM = {
  L: { p: V3(-2.6, .4, 2.8), r: V3(.9, -1.4, .7) },
  D: { p: V3(1.6, 2.8, 2.4), r: V3(-1.2, .8, -.9) },
  R: { p: V3(2.8, -1.4, 2.6), r: V3(.6, 1.3, -.8) },
};

function genCircuit() {
  const r = mulberry32(21), lim = .785, segs = [], ends = [], vias = [], paths = [];
  const dirs = []; for (let k = 0; k < 8; k++) dirs.push([Math.cos(k * 45 * DEG), Math.sin(k * 45 * DEG)]);
  for (let b = 0; b < 70; b++) {
    let x, y; do { x = (r() * 2 - 1) * lim; y = (r() * 2 - 1) * lim; } while (!inHex(x, y, lim * .95));
    let d = Math.floor(r() * 4) * 2;                                    // start on an axis
    const pts = [[x, y]], n = 2 + Math.floor(r() * 4);
    for (let s = 0; s < n; s++) {
      const len = .06 + r() * .26;
      const nx = x + dirs[d][0] * len, ny = y + dirs[d][1] * len;
      if (!inHex(nx, ny, lim)) break;
      x = nx; y = ny; pts.push([x, y]);
      d = (d + (r() < .5 ? 1 : 7) * (r() < .75 ? 1 : 0) + 8) % 8;
    }
    if (pts.length < 2) continue;
    const lanes = 1 + Math.floor(r() * 3), gap = .024;
    for (let l = 0; l < lanes; l++) {
      const off = (l - (lanes - 1) / 2) * gap, q = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)], p = pts[i];
        let n1 = [0, 0], n2 = [0, 0];
        if (i > 0) { const dx = p[0] - a[0], dy = p[1] - a[1], L = Math.hypot(dx, dy); n1 = [-dy / L, dx / L]; }
        if (i < pts.length - 1) { const dx = c[0] - p[0], dy = c[1] - p[1], L = Math.hypot(dx, dy); n2 = [-dy / L, dx / L]; }
        if (i === 0) n1 = n2; if (i === pts.length - 1) n2 = n1;
        let mx = n1[0] + n2[0], my = n1[1] + n2[1]; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
        const k = off / Math.max(.4, mx * n2[0] + my * n2[1]);
        q.push([p[0] + mx * k, p[1] + my * k]);
      }
      if (!q.every(([qx, qy]) => inHex(qx, qy, lim + .02))) continue;
      const path = { pts: q, len: 0, seg0: segs.length };
      for (let i = 0; i < q.length - 1; i++) { segs.push([q[i][0], q[i][1], q[i + 1][0], q[i + 1][1]]); path.len += Math.hypot(q[i + 1][0] - q[i][0], q[i + 1][1] - q[i][1]); }
      paths.push(path); ends.push(q[q.length - 1]); if (r() < .6) vias.push(q[0]);
    }
  }
  return { segs, ends, vias, paths };
}

function buildLogo() {
  const g = logo.group; scene.add(g);
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shapeFrom(hexPts(1)), { depth: .16, bevelEnabled: true, bevelThickness: .035, bevelSize: .035, bevelSegments: 4, curveSegments: 1 }).translate(0, 0, -.08),
    new THREE.MeshPhysicalMaterial({ color: 0x07080c, metalness: .75, roughness: .3, clearcoat: 1, clearcoatRoughness: .12 }));
  g.add(body);
  const plateMat = new THREE.MeshPhysicalMaterial({ color: 0x040406, metalness: .2, roughness: .78, clearcoat: .15, clearcoatRoughness: .6 });
  for (const s of [1, -1]) {
    const plate = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(hexPts(.865))), plateMat);
    plate.position.z = s * (FACE + .001); if (s < 0) plate.rotation.y = Math.PI; g.add(plate);
  }
  logo.neon = new THREE.MeshBasicMaterial({ color: HDR(.2, .02, .03), side: THREE.DoubleSide });
  logo.neonDim = new THREE.MeshBasicMaterial({ color: HDR(.15, .01, .02), side: THREE.DoubleSide });
  logo.halo = new THREE.MeshBasicMaterial({ color: HDR(.5, .02, .04), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  logo.halo2 = new THREE.MeshBasicMaterial({ color: HDR(.25, .01, .02), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const s of [1, -1]) {
    const a = new THREE.Mesh(hexRing(.87, .925), logo.neon), b = new THREE.Mesh(hexRing(.815, .832), logo.neonDim);
    const h1 = new THREE.Mesh(hexRing(.845, .95), logo.halo), h2 = new THREE.Mesh(hexRing(.80, 1.0), logo.halo2);
    for (const m of [a, b, h1, h2]) { m.position.z = s * (FACE + .004 + (m === h1 ? .001 : m === h2 ? .0015 : 0)); if (s < 0) m.rotation.y = Math.PI; g.add(m); }
  }
  // circuit traces
  const C = genCircuit(); logo.circuitData = C;
  const pos = []; for (const [x1, y1, x2, y2] of C.segs) pos.push(x1, y1, FACE + .003, x2, y2, FACE + .003);
  const lg = new LineSegmentsGeometry(); lg.setPositions(pos);
  logo.segColors = new Float32Array(C.segs.length * 6); lg.setColors(logo.segColors);
  const lm = new LineMaterial({ vertexColors: true, linewidth: .0046, worldUnits: true }); lm.resolution.set(W, H);
  logo.circuit = new LineSegments2(lg, lm); g.add(logo.circuit);
  const padGeo = new THREE.RingGeometry(.009, .016, 14), viaGeo = new THREE.CircleGeometry(.009, 12);
  const pads = new THREE.InstancedMesh(padGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), C.ends.length);
  const vias = new THREE.InstancedMesh(viaGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), C.vias.length);
  const m4 = new THREE.Matrix4();
  C.ends.forEach(([x, y], i) => { pads.setMatrixAt(i, m4.makeTranslation(x, y, FACE + .0035)); pads.setColorAt(i, HDR(0, 0, 0)); });
  C.vias.forEach(([x, y], i) => { vias.setMatrixAt(i, m4.makeTranslation(x, y, FACE + .0035)); vias.setColorAt(i, HDR(0, 0, 0)); });
  g.add(pads, vias); logo.pads = pads; logo.vias = vias;
  // pulses running along the traces
  const P = 80, pp = new Float32Array(P * 3), pc = new Float32Array(P * 3);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  logo.pulses = new THREE.Points(pg, new THREE.PointsMaterial({ size: .05, map: DOT(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const rp = mulberry32(5); logo.pulseDef = Array.from({ length: P }, () => ({ path: Math.floor(rp() * C.paths.length), ph: rp(), sp: .25 + rp() * .35 }));
  g.add(logo.pulses);
  // the N
  const nMat = new THREE.MeshPhysicalMaterial({ color: 0xe0141f, metalness: .3, roughness: .2, clearcoat: 1, clearcoatRoughness: .06, emissive: 0x6a0610 });
  for (const key of ['L', 'D', 'R']) {
    const geo = new THREE.ExtrudeGeometry(shapeFrom(N_PIECES[key]), { depth: .1, bevelEnabled: true, bevelThickness: .016, bevelSize: .012, bevelSegments: 3 });
    const m = new THREE.Mesh(geo, nMat); m.userData.key = key;
    const holder = new THREE.Group(); holder.add(m); g.add(holder);
    logo.pieces.push(holder);
  }
  // halo
  logo.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture([[0, 'rgba(255,40,55,.8)'], [.35, 'rgba(170,10,30,.28)'], [1, 'rgba(90,0,15,0)']]), color: HDR(1, 1, 1), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
  logo.glow.position.z = -.5; g.add(logo.glow);
  // orbit rings around the mark
  logo.rings = [];
  for (const [rad, tilt, spin] of [[1.55, [70, 0, 18], .35], [1.85, [62, 0, -28], -.22]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, .0045, 6, 220), new THREE.MeshBasicMaterial({ color: HDR(1.6, .12, .18), transparent: true }));
    const holder = new THREE.Group(); holder.rotation.set(tilt[0] * DEG, tilt[1] * DEG, tilt[2] * DEG); holder.add(ring);
    ring.userData.spin = spin; scene.add(holder); logo.rings.push(ring);
  }
  // shockwave
  logo.shock = new THREE.Mesh(new THREE.RingGeometry(.97, 1, 120), new THREE.MeshBasicMaterial({ color: HDR(3, .3, .35), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  logo.shock.position.z = FACE; g.add(logo.shock);
  // sparks
  const S = 180, sp = new Float32Array(S * 3), sc = new Float32Array(S * 3);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  logo.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: .035, map: DOT(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  const rs = mulberry32(77);
  logo.sparkDef = Array.from({ length: S }, () => { const a = rs() * Math.PI * 2, el = (rs() - .3) * 1.2; return { d: V3(Math.cos(a) * Math.cos(el), Math.sin(a) * Math.cos(el), Math.abs(Math.sin(el)) + .2).normalize(), v: 1.5 + rs() * 4, life: .35 + rs() * .6 }; });
  g.add(logo.sparks);
}

function neonLevel(t) {
  if (t < T.neon) return .06 + .25 * prog(t, 2.0, T.neon);
  if (t < T.boom) { const f = Math.floor((t - T.neon) * 60); return [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1][f % 15] ? .9 : .1; }
  return 1 + 1.6 * Math.exp(-(t - T.boom) * 5) + (t > T.lock ? 1.2 * Math.exp(-(t - T.lock) * 4) : 0);
}

function updateLogo(t) {
  const C = logo.circuitData;
  // traces: a wave of light spreading from the first spark
  const ox = -.12, oy = -.22;
  const wave = 1.75 * Math.pow(E.inOutSine(prog(t, T.spark, 2.45)), 1.15);
  const slamFlash = T.slam.reduce((s, ts) => s + (t >= ts ? 1.4 * Math.exp(-(t - ts) * 9) : 0), 0) + (t >= T.boom ? 2 * Math.exp(-(t - T.boom) * 6) : 0);
  const cols = logo.segColors;
  for (let i = 0; i < C.segs.length; i++) {
    const [x1, y1, x2, y2] = C.segs[i];
    const dist = Math.hypot((x1 + x2) / 2 - ox, (y1 + y2) / 2 - oy);
    const lit = clamp((wave - dist) * 7);
    const fresh = lit > 0 ? Math.exp(-(wave - dist) * 5) * 2.2 : 0;
    const k = .04 + lit * (.55 + fresh * .8) + lit * slamFlash * .5;
    const r = 1.25 * k, gg = .05 * k, b = .07 * k;
    cols.set([r, gg, b, r, gg, b], i * 6);
  }
  logo.circuit.geometry.setColors(cols);
  const pk = (x, y) => { const d = Math.hypot(x - ox, y - oy); return clamp((wave - d) * 7); };
  C.ends.forEach(([x, y], i) => { const k = .06 + .8 * pk(x, y); logo.pads.setColorAt(i, HDR(1.4 * k, .07 * k, .09 * k)); });
  C.vias.forEach(([x, y], i) => { const k = .06 + 1.0 * pk(x, y); logo.vias.setColorAt(i, HDR(1.6 * k, .1 * k, .12 * k)); });
  logo.pads.instanceColor.needsUpdate = true; logo.vias.instanceColor.needsUpdate = true;
  // pulses
  const pp = logo.pulses.geometry.attributes.position, pc = logo.pulses.geometry.attributes.color;
  logo.pulseDef.forEach((p, i) => {
    const path = C.paths[p.path]; let s = ((p.ph + t * p.sp / path.len) % 1) * path.len;
    let q = path.pts[0], q2 = path.pts[1];
    for (let j = 0; j < path.pts.length - 1; j++) { const a = path.pts[j], b = path.pts[j + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (s <= L) { q = a; q2 = b; s /= L; break; } s -= L; if (j === path.pts.length - 2) { q = a; q2 = b; s = 1; } }
    const x = lerp(q[0], q2[0], s), y = lerp(q[1], q2[1], s);
    pp.setXYZ(i, x, y, FACE + .006);
    const k = pk(x, y) * (1 + slamFlash * .5);
    pc.setXYZ(i, 3 * k, .5 * k, .5 * k);
  });
  pp.needsUpdate = true; pc.needsUpdate = true;
  // neon
  const nl = neonLevel(t);
  const nc = Math.min(nl, 1.25);
  logo.neon.color.setRGB(1.1 * nc + .25 * Math.max(0, nl - 1.25), .03 * nc + .12 * Math.max(0, nl - 1.25), .045 * nc + .12 * Math.max(0, nl - 1.25));
  logo.neonDim.color.setRGB(.8 * nc, .02 * nc, .03 * nc);
  logo.halo.color.setRGB(.42 * nl, .015 * nl, .03 * nl);
  logo.halo2.color.setRGB(.16 * nl, .006 * nl, .012 * nl);
  logo.glow.material.opacity = clamp(.05 + .2 * Math.min(nl, 2.5));
  logo.glow.scale.setScalar(3.4 + .8 * Math.max(0, nl - 1));
  // N pieces slam in
  logo.pieces.forEach((h, i) => {
    const key = ['L', 'D', 'R'][i], ts = T.slam[i], from = SLAM_FROM[key];
    const p = prog(t, ts - .32, ts), e = E.inCubic(p);
    h.visible = t > ts - .32;
    h.position.set(lerp(from.p.x, 0, e), lerp(from.p.y, 0, e), lerp(from.p.z, 0, e) + FACE + .018);
    const re = 1 - E.outCubic(p);
    h.rotation.set(from.r.x * re, from.r.y * re, from.r.z * re);
    if (t > ts) h.position.z += -.035 * Math.exp(-(t - ts) * 16) * Math.cos((t - ts) * 50);
  });
  // shockwave on the boom and on the lockup hit
  let sh = null;
  if (t >= T.boom && t < T.boom + 1.1) sh = T.boom;
  logo.shock.visible = !!sh;
  if (sh) { const p = prog(t, sh, sh + 1.1); logo.shock.scale.setScalar(1 + E.outCubic(p) * (sh === T.lock ? 3.5 : 7)); logo.shock.material.opacity = (1 - p) * .9; }
  // sparks from each slam and the boom
  const sp = logo.sparks.geometry.attributes.position, sc = logo.sparks.geometry.attributes.color;
  const bursts = [...T.slam, T.boom];
  logo.sparkDef.forEach((s, i) => {
    const ts = bursts[i % 4], dt = t - ts;
    const origin = i % 4 < 3 ? N_CENTER[i % 4] : [0, 0];
    if (dt < 0 || dt > s.life) { sp.setXYZ(i, 0, 0, -50); sc.setXYZ(i, 0, 0, 0); return; }
    const k = 3.5, dd = s.v * (1 - Math.exp(-k * dt)) / k * (i % 4 === 3 ? 1.6 : 1);
    sp.setXYZ(i, origin[0] + s.d.x * dd, origin[1] + s.d.y * dd, FACE + .05 + s.d.z * dd * .6 - dt * dt * .8);
    const a = 1 - dt / s.life; sc.setXYZ(i, 4 * a, (.6 + .8 * (i % 3 === 0)) * a, .4 * a);
  });
  sp.needsUpdate = true; sc.needsUpdate = true;
  // orbit rings
  logo.rings.forEach((ring, i) => {
    ring.rotation.z = t * ring.userData.spin;
    ring.material.opacity = prog(t, T.boom, T.boom + .5) * (i ? .55 : .8);
    ring.parent.visible = t > T.boom;
  });
}
const N_CENTER = [[-.37, -.07], [0, 0], [.39, -.0]];

/* ---------- debris & track ---------- */
const debris = {};
const RS = 5.6;
function buildDebris() {
  const r = mulberry32(3), N = 170;
  const dark = new THREE.InstancedMesh(new THREE.CylinderGeometry(.07, .07, .016, 6), new THREE.MeshPhysicalMaterial({ color: 0x0a0c12, metalness: .8, roughness: .28, clearcoat: 1 }), N);
  const hot = new THREE.InstancedMesh(new THREE.CylinderGeometry(.022, .022, .006, 6), new THREE.MeshBasicMaterial({ color: HDR(3, .25, .3) }), 70);
  debris.def = Array.from({ length: N + 70 }, () => ({ a: r() * Math.PI * 2, rad: 2.1 + Math.pow(r(), .9) * 6.8, y: (r() - .5) * 4.2, sp: (.02 + r() * .05) * (r() < .5 ? 1 : -1), rx: r() * 6, ry: r() * 6, s: .45 + r() * .8, spin: (r() - .5) * 2 }));
  debris.dark = dark; debris.hot = hot; scene.add(dark, hot);
  const track = new THREE.Mesh(new THREE.TorusGeometry(RS, .005, 6, 512), new THREE.MeshBasicMaterial({ color: HDR(.35, .45, .7), transparent: true, opacity: .55 }));
  track.rotation.x = Math.PI / 2; track.position.y = -1.45; scene.add(track); debris.track = track;
  const tp = new Float32Array(720 * 3); for (let i = 0; i < 720; i++) { const a = i / 720 * Math.PI * 2; tp.set([Math.sin(a) * (RS + .14), -1.47, Math.cos(a) * (RS + .14)], i * 3); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
  debris.ticks = new THREE.Points(tg, new THREE.PointsMaterial({ size: .022, color: HDR(.9, .2, .25), map: DOT(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(debris.ticks);
}
function updateDebris(t) {
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = V3(), p = V3();
  const kick = t >= T.boom ? 1.2 * (1 - Math.exp(-(t - T.boom) * 3)) : 0;
  debris.def.forEach((d, i) => {
    const a = d.a + t * d.sp, rad = d.rad + kick * .4 * (1 / d.rad) * 3;
    p.set(Math.sin(a) * rad, d.y + Math.sin(t * .3 + d.rx) * .15, Math.cos(a) * rad);
    e.set(d.rx + t * d.spin, d.ry + t * d.spin * .7, 0); q.setFromEuler(e);
    const near = p.distanceTo(camera.position); s.setScalar(d.s * clamp((near - 1.2) / 3.5));
    m4.compose(p, q, s);
    if (i < 170) debris.dark.setMatrixAt(i, m4); else debris.hot.setMatrixAt(i - 170, m4);
  });
  debris.dark.instanceMatrix.needsUpdate = true; debris.hot.instanceMatrix.needsUpdate = true;
  const vis = prog(t, 2.6, 3.4) * (1 - prog(t, T.lock, T.lock + .6));
  debris.track.material.opacity = .35 * vis; debris.ticks.material.opacity = .8 * vis;
  debris.track.visible = debris.ticks.visible = vis > 0;
}

/* ---------- stations ---------- */
const ST = [
  { key: 'chat', alpha: 75, y: .25, title: 'گفتگو', label: '01 — CHAT', sub: 'با مدل‌های زبانی، به فارسی' },
  { key: 'image', alpha: 165, y: -.2, title: 'تصویر', label: '02 — IMAGE', sub: '۲۶۸ سبک، تا کیفیت ۴K' },
  { key: 'video', alpha: 255, y: .2, title: 'ویدیو', label: '03 — VIDEO', sub: 'کلیپ کوتاه از متن یا تصویر' },
  { key: 'agent', alpha: 345, y: -.15, title: 'ایجنت‌ها', label: '04 — AGENTS', sub: 'کار چندمرحله‌ای را بسپار' },
];
const BOX = { w: 2.95, top: 1.62, bottom: -1.05 };      // station content bounds (local units)
const fitDist = (w, h, margin) => Math.max(h * margin, w * margin / ASPECT) / (2 * Math.tan(FOV / 2 * DEG));
const D_ST = fitDist(BOX.w, BOX.top - BOX.bottom, PORTRAIT ? .98 : 1.14);
function stationPos(k) { const a = (ST[k].alpha + (k % 2 ? 27 : -23)) * DEG; return V3(Math.sin(a) * RS, ST[k].y, Math.cos(a) * RS); }
function stationCam(k) { return { a: ST[k].alpha * DEG, r: RS + D_ST + .35, y: ST[k].y + (BOX.top + BOX.bottom) / 2 + .15, target: stationPos(k).add(V3(0, (BOX.top + BOX.bottom) / 2, 0)) }; }
const poseToPos = p => V3(Math.sin(p.a) * p.r, p.y, Math.cos(p.a) * p.r);

const stations = [];
const IMG = {};

function panel(w, h) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new RoundedBoxGeometry(w, h, .06, 4, .07), new THREE.MeshPhysicalMaterial({ color: 0x0a0e16, metalness: .5, roughness: .22, clearcoat: 1, clearcoatRoughness: .1 }));
  g.add(box);
  const edge = outline(rrectPath(w + .004, h + .004, .07).map(([x, y]) => [x, y, .031]), HDR(.55, .7, 1.25), .006);
  g.add(edge); g.userData.edge = edge;
  return g;
}

function bubble(str, { mine, width }) {
  const c = document.createElement('canvas'), s = 2;
  c.width = Math.round(width * 600); c.height = 150;
  const draw = (txt, dots = 0) => {
    const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    const r = 46, x = 8, y = 18, w = c.width - 16, h = c.height - 36;
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    g.fillStyle = mine ? 'rgba(228,50,63,.24)' : 'rgba(30,38,54,.92)'; g.fill();
    g.lineWidth = 3; g.strokeStyle = mine ? 'rgba(255,110,120,.75)' : 'rgba(174,200,236,.35)'; g.stroke();
    g.font = '600 50px Estedad'; g.direction = 'rtl'; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillStyle = '#F4F7FC';
    if (txt) g.fillText(txt, c.width - 40, c.height / 2 + 2);
    for (let i = 0; i < dots; i++) { g.beginPath(); g.arc(c.width - 60 - i * 34, c.height / 2, 9, 0, 6.283); g.fillStyle = `rgba(201,210,224,${.4 + .6 * ((i + Math.floor(dots * 10)) % 3 === 0)})`; g.fill(); }
  };
  draw(str);
  const t = tex(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * c.height / c.width), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.userData.draw = (txt, dots) => { draw(txt, dots); t.needsUpdate = true; };
  return m;
}

function buildStations() {
  ST.forEach((def, k) => {
    const g = new THREE.Group(); scene.add(g);
    g.position.copy(stationPos(k));
    g.lookAt(poseToPos(stationCam(k)).setY(stationPos(k).y));
    const st = { def, k, group: g, parts: {} };
    // headline
    const label = textPlane(def.label, .095, { weight: 600, family: 'Sora', dir: 'ltr', ls: 34, color: '#FF8F93' });
    label.position.set(0, 1.5, .05); g.add(label);
    const title = layeredText(def.title, .44, {});
    const hinge = new THREE.Group(); hinge.position.set(0, .98, .05); title.position.y = .2; hinge.add(title); g.add(hinge);
    const sub = textPlane(def.sub, .13, { weight: 600, color: '#C9D2E0' });
    sub.position.set(0, .82, .05); g.add(sub);
    st.parts = { label, hinge, title, sub };
    BUILD[def.key](st);
    stations.push(st);
  });
}

const BUILD = {
  chat(st) {
    const p = panel(2.75, 1.55); p.position.set(0, -.25, 0); st.group.add(p); st.parts.panel = p;
    // window dots
    for (let i = 0; i < 3; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(.022, 16), new THREE.MeshBasicMaterial({ color: i ? HDR(.4, .45, .55) : HDR(2.2, .2, .25) })); d.position.set(-1.22 + i * .07, .38, .036); p.add(d); }
    const hdr = textPlane('NAVIDIX · CHAT', .05, { weight: 600, family: 'Sora', dir: 'ltr', ls: 14, color: '#7E8AA0' }); hdr.position.set(1.0, .38, .036); p.add(hdr);
    const u = bubble('یک ایده برای فیلم کوتاه علمی بده', { mine: true, width: 1.95 }); u.position.set(.3, .05, .05); p.add(u);
    const a = bubble('', { mine: false, width: 2.25 }); a.position.set(-.13, -.38, .07); p.add(a);
    const av = new THREE.Group();
    av.add(new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(hexPts(.075))), new THREE.MeshBasicMaterial({ color: 0x07080c })));
    const avr = new THREE.Mesh(hexRing(.06, .075), new THREE.MeshBasicMaterial({ color: HDR(2.5, .2, .25) })); avr.position.z = .001; av.add(avr);
    av.position.set(1.22, -.38, .075); p.add(av);
    st.parts.user = u; st.parts.ai = a; st.parts.avatar = av;
    st.reply = 'سفری از یک سلول تا کهکشان، در شصت ثانیه.';
    st.lastTyped = -1;
  },
  image(st) {
    const names = ['inkwash', 'neon', 'baroque-b', 'isometric', 'gouache-b', 'miniature', 'blueprint', 'film35', 'academic', 'aboriginal', 'miniature-b', 'inkwash-b'];
    const tw = .63, th = .394, gap = .05, tiles = [];
    names.forEach((n, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const holder = new THREE.Group();
      const x = (col - 1.5) * (tw + gap), y = (1 - row) * (th + gap) - .3;
      holder.position.set(x, y, -.2 * Math.pow(x / 1.3, 2));
      const t = IMG[n];
      const face = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: .62, roughness: .45, metalness: .1 }));
      const back = new THREE.Mesh(new THREE.PlaneGeometry(tw, th), new THREE.MeshPhysicalMaterial({ color: 0x0b0e15, metalness: .7, roughness: .3, clearcoat: 1 }));
      back.rotation.y = Math.PI; back.position.z = -.002;
      holder.add(face, back); st.group.add(holder);
      tiles.push({ holder, face, col, row, base: holder.position.clone(), hero: n === 'miniature' });
    });
    st.parts.tiles = tiles;
    const hero = tiles.find(x => x.hero);
    const frame = outline(rrectPath(tw + .03, th + .03, .012).map(([x, y]) => [x, y, .004]), HDR(3, .25, .3), .008);
    hero.holder.add(frame); st.parts.frame = frame;
    const tag = textPlane('4K', .055, { weight: 700, family: 'Sora', dir: 'ltr', ls: 6, color: '#FFFFFF' });
    const chip = new THREE.Mesh(new THREE.PlaneGeometry(.13, .07), new THREE.MeshBasicMaterial({ color: HDR(1.6, .1, .14) }));
    chip.position.set(tw / 2 - .1, th / 2 - .07, .006); tag.position.set(tw / 2 - .1, th / 2 - .068, .008);
    hero.holder.add(chip, tag); st.parts.tag = [chip, tag];
  },
  video(st) {
    const clips = ['WT81llGaYdc', 'kiqO7QZs6X0', 'PuDzaBwam4k', 'imbh6f6kAqA', 'k35mzpMopyg', 'Fg2dXuiQpUQ'];
    // film frames: thumbnail between sprocket bands
    const frameTex = clips.map(id => {
      const img = IMG[id].image, c = document.createElement('canvas'); c.width = 512; c.height = 360;
      const g = c.getContext('2d'); g.fillStyle = '#050608'; g.fillRect(0, 0, 512, 360);
      const sh = img.height * (img.width / img.height > 1.6 ? 1 : .75), sy = (img.height - sh) / 2;
      g.drawImage(img, 0, sy, img.width, sh, 16, 52, 480, 256);
      g.fillStyle = '#1a1d24'; for (let i = 0; i < 12; i++) { g.fillRect(14 + i * 42, 14, 22, 24); g.fillRect(14 + i * 42, 322, 22, 24); }
      return tex(c);
    });
    const strip = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(.62, .436), new THREE.MeshStandardMaterial({ map: frameTex[i % 6], emissiveMap: frameTex[i % 6], emissive: 0xffffff, emissiveIntensity: .5, roughness: .5, side: THREE.DoubleSide }));
      st.group.add(m); strip.push(m);
    }
    st.parts.strip = strip;
    const hero = new THREE.Group(); hero.position.set(0, -.05, .25); st.group.add(hero);
    const ht = IMG['WT81llGaYdc'].clone(); ht.needsUpdate = true; ht.wrapS = ht.wrapT = THREE.ClampToEdgeWrapping;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 1.08), new THREE.MeshStandardMaterial({ map: ht, emissiveMap: ht, emissive: 0xffffff, emissiveIntensity: .75, roughness: .4 }));
    hero.add(screen);
    hero.add(outline(rrectPath(1.95, 1.11, .02).map(([x, y]) => [x, y, .002]), HDR(.6, .75, 1.3), .006));
    const play = new THREE.Group(); play.position.z = .01;
    play.add(new THREE.Mesh(new THREE.CircleGeometry(.14, 40), new THREE.MeshBasicMaterial({ color: 0x06080c, transparent: true, opacity: .6 })));
    const tri = new THREE.Shape(); tri.moveTo(-.04, .06); tri.lineTo(.065, 0); tri.lineTo(-.04, -.06); tri.closePath();
    const triM = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: HDR(1.4, 1.4, 1.4), transparent: true })); triM.position.z = .002; play.add(triM);
    hero.add(play);
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .014), new THREE.MeshBasicMaterial({ color: HDR(.4, .42, .5), transparent: true, opacity: .5 }));
    barBg.position.set(0, -.46, .006); hero.add(barBg);
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(1, .016), new THREE.MeshBasicMaterial({ color: HDR(3, .25, .3) }));
    bar.position.set(-.85, -.46, .008); hero.add(bar);
    st.parts.hero = hero; st.parts.screenTex = ht; st.parts.play = play; st.parts.bar = bar;
  },
  agent(st) {
    const nodes = [
      { p: [0, -.25, .2], label: 'ایجنت', hub: true },
      { p: [-1.12, .22, -.1], label: 'جست‌وجو' },
      { p: [-.72, -.82, .15], label: 'خواندن منابع' },
      { p: [.02, .38, -.3], label: 'ساخت تصویر' },
      { p: [.78, -.85, .12], label: 'ساخت ویدیو' },
      { p: [1.15, .18, -.05], label: 'ساخت سایت' },
    ];
    const shell = new THREE.MeshPhysicalMaterial({ color: 0x141821, metalness: .85, roughness: .22, clearcoat: 1 });
    nodes.forEach((n, i) => {
      const g = new THREE.Group(); g.position.set(...n.p);
      const s = n.hub ? .2 : .12;
      g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), shell));
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(s * .55, 1), new THREE.MeshBasicMaterial({ color: HDR(.3, .03, .04) }));
      core.position.z = s * .7; g.add(core);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT(), color: HDR(2, .2, .25), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      halo.scale.setScalar(s * 3.2); g.add(halo);
      const lab = textPlane(n.label, n.hub ? .12 : .095, { weight: 700, color: '#F4F7FC' });
      lab.position.set(0, -s - .1, .1); g.add(lab);
      st.group.add(g); n.g = g; n.core = core; n.halo = halo; n.lab = lab;
    });
    const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]];
    const spokes = [[0, 3], [0, 4], [0, 5], [0, 2]];
    const mk = ([a, b], color) => {
      const pa = V3(...nodes[a].p), pb = V3(...nodes[b].p), len = pa.distanceTo(pb);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, len, 6), new THREE.MeshBasicMaterial({ color }));
      m.position.copy(pa).add(pb).multiplyScalar(.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), pb.clone().sub(pa).normalize());
      st.group.add(m); return { m, pa, pb };
    };
    st.parts.edges = edges.map(e => mk(e, HDR(.25, .3, .4)));
    spokes.forEach(e => mk(e, HDR(.14, .16, .22)));
    st.parts.nodes = nodes;
    const pulse = new THREE.Sprite(new THREE.SpriteMaterial({ map: DOT(), color: HDR(5, .6, .6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    pulse.scale.setScalar(.16); st.group.add(pulse); st.parts.pulse = pulse;
  },
};

function updateStations(t) {
  stations.forEach(st => {
    const s = T.feat[st.k], u = t - s;
    // fold away as soon as the camera leaves for the next station (or for home)
    const next = st.k < 3 ? T.feat[st.k + 1] : T.lock, away = prog(t, next + .05, next + .5);
    st.group.visible = t > s - .9 && away < 1;
    if (!st.group.visible) return;
    st.group.scale.setScalar(Math.max(.001, 1 - E.inCubic(away)));
    const P = st.parts;
    // headline
    P.label.material.opacity = prog(u, .22, .45);
    const hp = prog(u, .3, .78);
    P.hinge.rotation.x = lerp(-1.45, 0, E.outBack(hp));
    P.hinge.visible = hp > 0;
    P.sub.material.opacity = prog(u, .55, .85);
    P.sub.position.y = .82 - (1 - E.outCubic(prog(u, .55, .95))) * .06;
    UPDATE[st.def.key](st, u, t);
  });
}

const UPDATE = {
  chat(st, u) {
    const P = st.parts, pin = E.outCubic(prog(u, -.5, .3));
    P.panel.scale.setScalar(lerp(.86, 1, pin)); P.panel.rotation.y = lerp(.35, 0, pin);
    const ub = prog(u, .42, .62); P.user.scale.setScalar(E.outBack(ub) * .999 + .001); P.user.visible = ub > 0;
    const ab = prog(u, .66, .84); P.ai.scale.setScalar(E.outBack(ab) * .999 + .001); P.ai.visible = ab > 0; P.avatar.visible = ab > 0;
    const n = Math.floor(clamp((u - .9) / .62) * st.reply.length);
    const dots = u > .66 && u < .9 ? 3 : 0;
    const key = n * 10 + (dots ? 1 + Math.floor(u * 12) % 3 : 0);
    if (key !== st.lastTyped) { P.ai.userData.draw(st.reply.slice(0, n), dots ? 3 + (Math.floor(u * 12) % 3) / 10 : 0); st.lastTyped = key; }
  },
  image(st, u) {
    const P = st.parts, focus = E.inOutCubic(prog(u, 1.0, 1.45));
    P.tiles.forEach(tl => {
      const d = prog(u, .05 + (tl.col + tl.row) * .07, .45 + (tl.col + tl.row) * .07);
      tl.holder.rotation.y = lerp(-Math.PI * .5, 0, E.outBack(d));
      tl.holder.visible = d > 0;
      tl.holder.position.copy(tl.base);
      if (tl.hero) {
        tl.holder.position.z += focus * .55; tl.holder.position.y += focus * .1;
        tl.holder.scale.setScalar(1 + focus * .75);
        tl.face.material.emissiveIntensity = .62 + focus * .25;
      } else {
        tl.face.material.emissiveIntensity = .62 - focus * .38;
        tl.holder.position.z -= focus * .1;
      }
    });
    P.frame.material.opacity = focus; P.frame.visible = focus > 0;
    P.tag.forEach(m => { m.visible = u > 1.3; });
  },
  video(st, u) {
    const P = st.parts;
    P.strip.forEach((m, i) => {
      const span = 10 * .68, x = ((i * .68 + u * .55) % span) - span / 2;
      m.position.set(x, -.96 + .05 * Math.sin(x * 1.5), -.45 - .14 * x * x);
      m.rotation.set(-.25, -x * .28, 0);
      m.visible = Math.abs(x) < 2.2;
    });
    const hin = E.outBack(prog(u, .15, .6));
    P.hero.scale.setScalar(.6 + .4 * hin); P.hero.visible = u > .15;
    const playing = prog(u, .85, 1.0);
    P.play.scale.setScalar(1 + playing * .4); P.play.children.forEach(m => { m.material.opacity = (1 - playing) * (m.material.color.r > 1 ? 1 : .6); });
    P.play.visible = playing < 1;
    const pr = prog(u, .9, 1.85);
    P.bar.scale.x = Math.max(.001, pr * 1.7); P.bar.position.x = -.85 + pr * 1.7 / 2;
    const z = 1 + .12 * prog(u, 0, 1.9);
    P.screenTex.repeat.set(1 / z, 1 / z); P.screenTex.offset.set((1 - 1 / z) * .3, (1 - 1 / z) * .5);
  },
  agent(st, u) {
    const P = st.parts, step = .22, t0 = .38;
    P.nodes.forEach((n, i) => {
      const on = i === 0 ? prog(u, .2, .35) : prog(u, t0 + i * step - .02, t0 + i * step + .08);
      const glow = on * (1 + 1.5 * Math.exp(-Math.max(0, u - (t0 + i * step)) * 6));
      n.core.material.color.setRGB(.3 + 3 * glow, .03 + .3 * glow, .04 + .35 * glow);
      n.halo.material.opacity = .15 + .85 * on;
      n.lab.material.opacity = on;
      n.g.scale.setScalar(.6 + .4 * E.outBack(prog(u, -.1 + i * .05, .3 + i * .05)));
    });
    P.edges.forEach((e, i) => {
      const p = prog(u, t0 + i * step, t0 + (i + 1) * step);
      e.m.material.color.setRGB(p > 0 ? .25 + 2.2 * p : .25, p > 0 ? .3 - .1 * p : .3, p > 0 ? .4 - .2 * p : .4);
    });
    const k = clamp((u - t0) / step, 0, 4.999), seg = Math.floor(k);
    const e = P.edges[seg];
    P.pulse.visible = u > t0 && u < t0 + 5 * step;
    P.pulse.position.copy(e.pa).lerp(e.pb, k - seg);
  },
};

/* ---------- lockup ---------- */
const lock = {};
function buildLock() {
  const g = new THREE.Group(); scene.add(g); lock.group = g;
  const wm = IMG.wordmark, wmW = 2.75, wmH = wmW * wm.image.height / wm.image.width;
  const geo = new THREE.PlaneGeometry(wmW, wmH);
  const word = new THREE.Group();
  for (let i = 16; i >= 1; i--) {
    const k = (i - 1) / 15;
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: wm, color: new THREE.Color().setRGB(lerp(.7, .06, k), lerp(.08, .01, k), lerp(.1, .015, k)), metalness: .6, roughness: .35, alphaTest: .5 }));
    m.position.z = -i * .0055; word.add(m);
  }
  word.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: wm, metalness: .9, roughness: .26, alphaTest: .5, envMapIntensity: 2.2, emissive: 0xffffff, emissiveMap: wm, emissiveIntensity: .32 })));
  const holder = new THREE.Group(); holder.add(word); holder.position.set(0, -1.42, .15); g.add(holder);
  lock.word = holder;
  lock.tag = textPlane('استودیو هوش مصنوعی، به فارسی', .165, { weight: 700, color: '#E6ECF5' });
  lock.tag.position.set(0, -1.98, .15); g.add(lock.tag);
  lock.url = textPlane('NAVIDIXSTUDIO.COM', .07, { weight: 600, family: 'Sora', dir: 'ltr', ls: 40, color: '#FF8F93' });
  lock.url.position.set(0, -2.3, .15); g.add(lock.url);
  lock.sweep = new THREE.PointLight(0xffffff, 0, 6, 2); scene.add(lock.sweep);
}
const LOCK_TARGET = V3(0, -.62, 0);
const D_LOCK = fitDist(2.9, 3.45, PORTRAIT ? 1.18 : 1.3);
function updateLock(t) {
  const u = t - T.lock;
  lock.group.visible = u > 0;
  if (u <= 0) { lock.sweep.intensity = 0; return; }
  const wp = E.outQuint(prog(u, .7, 1.55));
  lock.word.position.y = -1.42 - (1 - wp) * .25;
  lock.word.rotation.set((1 - wp) * -1.2, (1 - wp) * .5, 0);
  lock.word.visible = wp > 0;
  lock.word.scale.setScalar(.85 + .15 * wp);
  lock.tag.material.opacity = prog(u, 1.05, 1.5); lock.tag.position.y = -1.98 - (1 - E.outCubic(prog(u, 1.05, 1.55))) * .08;
  lock.url.material.opacity = prog(u, 1.35, 1.8);
  const sp = prog(u, 1.2, 2.3);
  lock.sweep.intensity = Math.sin(sp * Math.PI) * 5;
  lock.sweep.position.set(lerp(-2.4, 2.4, E.inOutSine(sp)), 1.1 - sp * 2.6, 1.3);
}

/* ---------- camera ---------- */
const UP = V3(0, 1, 0), BOARD_UP = V3(0, 0, 1);
const D_HERO = fitDist(2.2, 2.25, PORTRAIT ? 1.35 : 1.58);
const heroPose = t => ({ a: lerp(-9, 7, prog(t, T.boom, T.feat[0])) * DEG, r: D_HERO * lerp(1.04, .97, prog(t, T.boom, T.feat[0])), y: .32, target: V3(0, 0, 0) });
const MACRO = [V3(-.78, -.86, .42), V3(-.12, -1.02, .56)];
const MACRO_T = [V3(-.22, -.06, FACE), V3(.42, .1, FACE)];
const pullCurve = () => new THREE.CatmullRomCurve3([MACRO[1], V3(-.9, -1.6, 1.6), V3(-1.2, -.6, 4.2), poseToPos(heroPose(T.boom))], false, 'centripetal');
let PULL = null;

function stationHold(k, t) {
  const c = stationCam(k), u = clamp((t - T.feat[k] - .55) / 1.32);
  return { a: c.a + u * 3 * DEG, r: c.r - u * .55, y: c.y + u * .05, target: c.target };
}
function poseAt(t) {
  if (t < T.feat[0]) return heroPose(t);
  for (let k = 3; k >= 0; k--) if (t >= T.feat[k] && (k === 3 ? t < T.lock : t < T.feat[k + 1])) {
    const prev = k === 0 ? heroPose(T.feat[0]) : stationHold(k - 1, T.feat[k]);
    const to = stationHold(k, t);
    const e = E.inOutCubic(prog(t, T.feat[k], T.feat[k] + .55));
    return blendPose(prev, to, e);
  }
  // lockup
  const prev = stationHold(3, T.lock), e = E.inOutCubic(prog(t, T.lock, T.lock + .95));
  const settle = prog(t, T.lock + .95, DUR);
  const to = { a: 360 * DEG + lerp(-4, 0, settle) * DEG, r: D_LOCK * lerp(1.06, .985, E.inOutSine(settle)), y: LOCK_TARGET.y + .25, target: LOCK_TARGET.clone() };
  return blendPose(prev, to, e);
}
function blendPose(a, b, e) {
  return { a: lerp(a.a, b.a, e), r: lerp(a.r, b.r, e) + Math.sin(Math.PI * e) * .8, y: lerp(a.y, b.y, e) + Math.sin(Math.PI * e) * .5, target: a.target.clone().lerp(b.target, e), whip: Math.sin(Math.PI * e) };
}

function updateCamera(t) {
  let pos, target, up = UP.clone(), fov = FOV, roll = 0;
  if (t < 2.55) {
    const k = E.inOutSine(prog(t, 0, 2.55));
    pos = MACRO[0].clone().lerp(MACRO[1], k); target = MACRO_T[0].clone().lerp(MACRO_T[1], k); up = BOARD_UP.clone();
  } else if (t < T.boom) {
    const k = E.inOutCubic(prog(t, 2.55, T.boom));
    pos = PULL.getPoint(k); target = MACRO_T[1].clone().lerp(V3(0, 0, 0), E.outCubic(prog(t, 2.55, 3.4)));
    up = BOARD_UP.clone().lerp(UP, E.inOutCubic(prog(t, 2.55, 3.3))).normalize();
  } else {
    const p = poseAt(t); pos = poseToPos(p); target = p.target;
    if (p.whip) { fov += p.whip * 7; roll = p.whip * 5 * DEG * (Math.floor((t - T.feat[0]) / (4 * B)) % 2 ? -1 : 1); }
  }
  // shake on the hits
  let sh = 0;
  for (const ts of [...T.slam, T.boom, T.lock]) if (t >= ts) sh += (ts === T.boom || ts === T.lock ? .05 : .03) * Math.exp(-(t - ts) * 9);
  const f = Math.round(t * 60);
  pos.add(V3((hash(f) - .5) * sh, (hash(f + 7.1) - .5) * sh, (hash(f + 3.3) - .5) * sh * .5));
  camera.position.copy(pos); camera.up.copy(up); camera.lookAt(target);
  if (roll) camera.rotateZ(roll);
  camera.fov = fov; camera.updateProjectionMatrix();
}

/* ---------- lights & post ---------- */
let bloom, grade;
function buildLights() {
  scene.add(new THREE.HemisphereLight(0x22324f, 0x12040a, .5));
  const key = new THREE.DirectionalLight(0xe6eeff, 1.5); key.position.set(-3, 5, 4); scene.add(key);
  const red = new THREE.PointLight(0xff2a3a, 7, 0, 2); red.position.set(-2.4, -1.4, .6); scene.add(red);
  const rim = new THREE.PointLight(0x5f8dff, 6, 0, 2); rim.position.set(2.6, 2.2, -1.5); scene.add(rim);
  const top = new THREE.PointLight(0xffffff, 4, 0, 2); top.position.set(.8, 2.6, 1.4); scene.add(top);
}
function buildPost() {
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(W, H), .55, .42, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) }, uFade: { value: 1 }, uCA: { value: .5 }, uGrain: { value: .045 }, uFlash: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uTime, uFade, uCA, uGrain, uFlash; uniform vec2 uRes; varying vec2 vUv;
      float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233))) * 43758.5453); }
      void main(){
        vec2 d = vUv - .5; float r2 = dot(d*vec2(uRes.x/uRes.y,1.)*.9, d*vec2(uRes.x/uRes.y,1.)*.9);
        float ca = uCA * .012 * r2;
        vec3 c = vec3(texture2D(tDiffuse, vUv - d*ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d*ca).b);
        c += uFlash * vec3(1., .32, .36) * (1. - smoothstep(0., .6, r2));
        c *= mix(1., .45, smoothstep(.12, .75, r2));
        c += (rnd(vUv*uRes + uTime*97.13) - .5) * uGrain;
        gl_FragColor = vec4(c * uFade, 1.);
      }`,
  });
  composer.addPass(grade);
  return composer;
}

/* ---------- frame ---------- */
let composer;
function render(t) {
  t = clamp(t, 0, DUR);
  updateCamera(t); updateLogo(t); updateDebris(t); updateStations(t); updateLock(t);
  sky.stars.material.uniforms.uTime.value = t; sky.dust.material.uniforms.uTime.value = t; sky.nebula.material.uniforms.uTime.value = t;
  let flash = 0;
  for (const ts of [T.boom, T.lock]) if (t >= ts) flash += 1.1 * Math.exp(-(t - ts) * 7);
  bloom.strength = .55 + flash + T.slam.reduce((s, ts) => s + (t >= ts ? .5 * Math.exp(-(t - ts) * 10) : 0), 0);
  grade.uniforms.uTime.value = Math.round(t * 60) % 997;
  grade.uniforms.uFade.value = prog(t, 0, .35);
  grade.uniforms.uFlash.value = [T.boom, T.lock].reduce((s, ts) => s + (t >= ts ? (ts === T.boom ? .55 : .35) * Math.exp(-(t - ts) * 9) : 0), 0) + T.slam.reduce((s, ts) => s + (t >= ts ? .12 * Math.exp(-(t - ts) * 14) : 0), 0);
  composer.render();
}

/* ---------- boot ---------- */
async function loadFonts() {
  for (const f of [
    new FontFace('Estedad', 'url(assets/estedad-var.woff2)', { weight: '100 900' }),
    new FontFace('Sora', 'url(assets/sora-var.woff2)', { weight: '100 800' }),
  ]) { await f.load(); document.fonts.add(f); }
}
async function loadImages() {
  const L = new THREE.TextureLoader();
  const load = (key, url) => new Promise((res, rej) => L.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; IMG[key] = t; res(); }, undefined, rej));
  const styles = ['aboriginal', 'academic', 'baroque-b', 'blueprint', 'film35', 'gouache-b', 'inkwash-b', 'inkwash', 'isometric', 'miniature-b', 'miniature', 'neon'];
  const clips = ['Fg2dXuiQpUQ', 'PuDzaBwam4k', 'WT81llGaYdc', 'imbh6f6kAqA', 'k35mzpMopyg', 'kiqO7QZs6X0'];
  await Promise.all([...styles.map(n => load(n, `assets/styles/${n}.jpg`)), ...clips.map(n => load(n, `assets/clips/${n}.jpg`)), load('wordmark', 'assets/wordmark.png')]);
}

const ready = (async () => {
  await loadFonts();
  await loadImages();
  buildEnvironment(); buildSky(); buildLights();
  buildLogo(); buildDebris(); buildStations(); buildLock();
  PULL = pullCurve();
  composer = buildPost();
  render(0);
})();

window.NVX = { ready, render, DUR, W, H, T, B, canvas: renderer.domElement };
