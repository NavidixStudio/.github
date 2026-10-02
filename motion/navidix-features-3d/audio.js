/* Navidix Studio — 3D features, 15s score. Synthesised with Web Audio, cued to scene.js.
 *
 * 128 BPM, D minor. Every hit lands on a picture event:
 *   0.20  first spark on the circuit board; energy spreads with the light (to 2.45)
 *   2.81 · 3.05 · 3.28  the three N pieces slam in
 *   3.52  neon flicker (buzz gated frame by frame) → 3.75 impact
 *   4.69 · 6.56 · 8.44 · 10.31  one station per beat-group: Dm · Bb · F · C, with a whoosh for each camera whip
 *  12.19  homecoming impact; three-note sonic logo as the NAVIDIX logotype lands
 */
'use strict';
(function () {
const SR = 48000, DUR = 15;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

async function renderBuffer(V) {
  const T = V.T, B = V.B;
  const ac = new OfflineAudioContext(2, Math.ceil(DUR * SR), SR);
  const r = mulberry32(4242);

  const noise = ac.createBuffer(1, SR * 2, SR);
  { const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }

  /* ---- master: glue compressor → limiter, fade at the end ---- */
  const master = ac.createGain();
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = .006; comp.release.value = .2;
  const lim = ac.createDynamicsCompressor();
  lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .08;
  master.connect(comp); comp.connect(lim); lim.connect(ac.destination);
  master.gain.setValueAtTime(.8, 0); master.gain.setValueAtTime(.8, 13.6); master.gain.linearRampToValueAtTime(0, DUR - .01);

  /* ---- reverb: generated stereo hall ---- */
  const rev = ac.createConvolver();
  {
    const len = Math.floor(4.4 * SR), b = ac.createBuffer(2, len, SR), rr = mulberry32(77);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len, k = .35 + .55 * x;          // darker as it decays
        lp = lp * k + (rr() * 2 - 1) * (1 - k);
        d[i] = lp * Math.pow(1 - x, 2.4) * Math.min(1, i / (SR * .015));
      }
    }
    rev.buffer = b;
  }
  const revIn = ac.createGain(), revHP = ac.createBiquadFilter(), revOut = ac.createGain();
  revHP.type = 'highpass'; revHP.frequency.value = 200; revOut.gain.value = .8;
  revIn.connect(revHP); revHP.connect(rev); rev.connect(revOut); revOut.connect(master);

  /* ---- ping-pong delay, dotted eighth ---- */
  const dIn = ac.createGain(), dL = ac.createDelay(1), dR = ac.createDelay(1), fbk = ac.createGain(), dLP = ac.createBiquadFilter(), mrg = ac.createChannelMerger(2), dOut = ac.createGain();
  dL.delayTime.value = .375; dR.delayTime.value = .375; fbk.gain.value = .42; dLP.type = 'lowpass'; dLP.frequency.value = 4200; dOut.gain.value = .38;
  dIn.connect(dL); dL.connect(dR); dR.connect(dLP); dLP.connect(fbk); fbk.connect(dL);
  dL.connect(mrg, 0, 0); dR.connect(mrg, 0, 1); mrg.connect(dOut); dOut.connect(master); dOut.connect(revIn);

  function bus({ gain = 1, pan = 0, rev = 0, dly = 0 } = {}) {
    const g = ac.createGain(), p = ac.createStereoPanner();
    g.gain.value = gain; p.pan.value = clamp(pan, -1, 1);
    g.connect(p); p.connect(master);
    if (rev) { const s = ac.createGain(); s.gain.value = rev; p.connect(s); s.connect(revIn); }
    if (dly) { const s = ac.createGain(); s.gain.value = dly; p.connect(s); s.connect(dIn); }
    return g;
  }
  function noiseSrc(t0, t1) { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.start(t0, r() * 1.5); s.stop(t1); return s; }
  function softClip(k) { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }

  /* ---- instruments ---- */
  function pad(midis, t0, t1, o = {}) {
    const { vol = .08, attack = .8, release = 1.2, cut0 = 600, cut1 = 1800, q = .7, spread = .8, rev = .55, dly = 0, type = 'sawtooth' } = o;
    const out = bus({ rev, dly });
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = q;
    f.frequency.setValueAtTime(cut0, t0); f.frequency.exponentialRampToValueAtTime(cut1, t1);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.setValueAtTime(vol, t1); g.gain.setTargetAtTime(0, t1, release / 4);
    f.connect(g); g.connect(out);
    midis.forEach((m, i) => {
      for (const det of [-10, 0, 10]) {
        const osc = ac.createOscillator(); osc.type = type; osc.frequency.value = mtof(m); osc.detune.value = det + (r() - .5) * 5;
        const p = ac.createStereoPanner();
        p.pan.value = clamp(((midis.length > 1 ? i / (midis.length - 1) : .5) * 2 - 1) * spread * .6 + det / 10 * spread * .4, -1, 1);
        const og = ac.createGain(); og.gain.value = 1 / Math.sqrt(midis.length * 3);
        osc.connect(og); og.connect(p); p.connect(f);
        osc.start(t0); osc.stop(t1 + release * 1.8);
      }
    });
  }
  function sub(m, t0, t1, vol = .3, attack = .25, release = .4) {
    const out = bus();
    const o = ac.createOscillator(); o.frequency.value = mtof(m);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.setValueAtTime(vol, t1); g.gain.setTargetAtTime(0, t1, release / 4);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t1 + release * 2);
  }
  function keyclick(t, vol = .2) {
    const out = bus({ pan: (r() - .5) * .5, rev: .1 });
    const n = noiseSrc(t, t + .07), bp = ac.createBiquadFilter(), g = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 2400 + r() * 2200; bp.Q.value = 1.3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .0012); g.gain.exponentialRampToValueAtTime(.0004, t + .05);
    n.connect(bp); bp.connect(g); g.connect(out);
    const o = ac.createOscillator(), og = ac.createGain();
    o.frequency.setValueAtTime(240 + r() * 70, t); o.frequency.exponentialRampToValueAtTime(130, t + .045);
    og.gain.setValueAtTime(vol * .8, t); og.gain.exponentialRampToValueAtTime(.0004, t + .055);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + .07);
  }
  function tick(t, freq, vol = .06, pan = 0) {
    const out = bus({ pan, rev: .25, dly: .15 });
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .002); g.gain.exponentialRampToValueAtTime(.0003, t + .09);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + .1);
  }
  function riser(t0, t1, vol = .25, from = 38, to = 74) {
    const out = bus({ rev: .35 });
    const n = noiseSrc(t0, t1 + .05), bp = ac.createBiquadFilter(), g = ac.createGain();
    bp.type = 'bandpass'; bp.Q.value = 1.6; bp.frequency.setValueAtTime(300, t0); bp.frequency.exponentialRampToValueAtTime(9500, t1);
    g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t1 - .02); g.gain.linearRampToValueAtTime(0, t1 + .02);
    n.connect(bp); bp.connect(g); g.connect(out);
    const lp = ac.createBiquadFilter(), tg = ac.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(500, t0); lp.frequency.exponentialRampToValueAtTime(6000, t1); lp.Q.value = 4;
    tg.gain.setValueAtTime(.0001, t0); tg.gain.exponentialRampToValueAtTime(vol * .32, t1 - .02); tg.gain.linearRampToValueAtTime(0, t1 + .02);
    lp.connect(tg); tg.connect(out);
    for (const oct of [0, 12, 19]) {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(mtof(from + oct), t0); o.frequency.exponentialRampToValueAtTime(mtof(to + oct), t1);
      o.connect(lp); o.start(t0); o.stop(t1 + .05);
    }
  }
  function swell(t0, t1, vol = .2) { // reverse-cymbal style suck-in
    const out = bus({ rev: .2 });
    const n = noiseSrc(t0, t1 + .02), hp = ac.createBiquadFilter(), g = ac.createGain();
    hp.type = 'highpass'; hp.frequency.setValueAtTime(1800, t0); hp.frequency.exponentialRampToValueAtTime(5000, t1);
    const c = new Float32Array(64); for (let i = 0; i < 64; i++) c[i] = vol * Math.pow(i / 63, 4) + .00001;
    g.gain.setValueCurveAtTime(c, t0, t1 - t0 - .005); g.gain.linearRampToValueAtTime(0, t1 + .01);
    n.connect(hp); hp.connect(g); g.connect(out);
  }
  function impact(t, size = 1) {
    const out = bus({ rev: .35 }), outWet = bus({ rev: 1.1 });
    // boom with saturation
    const o = ac.createOscillator(), g = ac.createGain(), sh = ac.createWaveShaper(), lp = ac.createBiquadFilter();
    o.frequency.setValueAtTime(175, t); o.frequency.exponentialRampToValueAtTime(46, t + .42); o.frequency.exponentialRampToValueAtTime(33, t + 2.6);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1.6 * size, t + .003); g.gain.exponentialRampToValueAtTime(.6 * size, t + .3); g.gain.exponentialRampToValueAtTime(.0008, t + 2.8);
    sh.curve = softClip(2.5); lp.type = 'lowpass'; lp.frequency.value = 1100;
    const og = ac.createGain(); og.gain.value = .55;
    o.connect(g); g.connect(sh); sh.connect(lp); lp.connect(og); og.connect(out); o.start(t); o.stop(t + 2.9);
    // noise body + crash tail
    const n = noiseSrc(t, t + 2.4), nlp = ac.createBiquadFilter(), ng = ac.createGain();
    nlp.type = 'lowpass'; nlp.frequency.setValueAtTime(10000, t); nlp.frequency.exponentialRampToValueAtTime(220, t + 1.9);
    ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(.42 * size, t + .002); ng.gain.exponentialRampToValueAtTime(.0005, t + 2.2);
    n.connect(nlp); nlp.connect(ng); ng.connect(outWet);
    // transient
    const c = noiseSrc(t, t + .03), chp = ac.createBiquadFilter(), cg = ac.createGain();
    chp.type = 'highpass'; chp.frequency.value = 2500; cg.gain.setValueAtTime(.5 * size, t); cg.gain.exponentialRampToValueAtTime(.0005, t + .025);
    c.connect(chp); chp.connect(cg); cg.connect(out);
    // sub drop
    const s = ac.createOscillator(), sg = ac.createGain();
    s.frequency.setValueAtTime(62, t); s.frequency.exponentialRampToValueAtTime(34, t + 3);
    sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(.42 * size, t + .02); sg.gain.exponentialRampToValueAtTime(.0005, t + 3.4);
    s.connect(sg); sg.connect(out); s.start(t); s.stop(t + 3.5);
  }
  function kick(t, vol = .7, decay = .36, revAmt = .05) {
    const out = bus({ rev: revAmt });
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(47, t + .09);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .002); g.gain.exponentialRampToValueAtTime(.0004, t + decay);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + decay + .05);
    const n = noiseSrc(t, t + .02), hp = ac.createBiquadFilter(), ng = ac.createGain();
    hp.type = 'highpass'; hp.frequency.value = 3200; ng.gain.setValueAtTime(vol * .22, t); ng.gain.exponentialRampToValueAtTime(.0004, t + .012);
    n.connect(hp); hp.connect(ng); ng.connect(out);
  }
  function tom(t, m, vol = .5) {
    const out = bus({ rev: .6 });
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(mtof(m) * 1.6, t); o.frequency.exponentialRampToValueAtTime(mtof(m), t + .08);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .004); g.gain.exponentialRampToValueAtTime(.0005, t + .9);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 1);
    const n = noiseSrc(t, t + .2), bp = ac.createBiquadFilter(), ng = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = .8; ng.gain.setValueAtTime(vol * .35, t); ng.gain.exponentialRampToValueAtTime(.0004, t + .15);
    n.connect(bp); bp.connect(ng); ng.connect(out);
  }
  function hat(t, vol = .05, decay = .035, pan = 0) {
    const out = bus({ pan, rev: .08 });
    const n = noiseSrc(t, t + decay + .02), hp = ac.createBiquadFilter(), g = ac.createGain();
    hp.type = 'highpass'; hp.frequency.value = 7800;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .001); g.gain.exponentialRampToValueAtTime(.0003, t + decay);
    n.connect(hp); hp.connect(g); g.connect(out);
  }
  function bell(m, t, vol = .1, o = {}) {
    const { dur = 2.6, pan = 0, rev = .55, dly = .3 } = o;
    const out = bus({ pan, rev, dly });
    const f = mtof(m);
    for (const [ratio, amp, dec] of [[1, 1, 1], [2, .32, .55], [2.76, .26, .4], [5.4, .11, .22], [8.93, .05, .12]]) {
      const osc = ac.createOscillator(), g = ac.createGain(); osc.frequency.value = f * ratio;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * amp, t + .002); g.gain.exponentialRampToValueAtTime(.00005, t + dur * dec);
      osc.connect(g); g.connect(out); osc.start(t); osc.stop(t + dur * dec + .05);
    }
  }
  function pluck(m, t, vol = .08, o = {}) {
    const { cut = 3200, dur = .32, pan = 0, rev = .2, dly = .25 } = o;
    const out = bus({ pan, rev, dly });
    const lp = ac.createBiquadFilter(), g = ac.createGain();
    lp.type = 'lowpass'; lp.Q.value = 3; lp.frequency.setValueAtTime(cut, t); lp.frequency.exponentialRampToValueAtTime(260, t + dur * .9);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .003); g.gain.exponentialRampToValueAtTime(.0003, t + dur);
    lp.connect(g); g.connect(out);
    for (const [type, det] of [['sawtooth', -6], ['square', 7]]) {
      const osc = ac.createOscillator(); osc.type = type; osc.frequency.value = mtof(m); osc.detune.value = det;
      const og = ac.createGain(); og.gain.value = type === 'square' ? .5 : 1;
      osc.connect(og); og.connect(lp); osc.start(t); osc.stop(t + dur + .05);
    }
  }
  function whoosh(t0, dur, vol = .2, panFrom = -.6, panTo = .6, f0 = 380, f1 = 2800) {
    const out = ac.createGain(), p = ac.createStereoPanner();
    out.connect(p); p.connect(master); const s = ac.createGain(); s.gain.value = .4; p.connect(s); s.connect(revIn);
    p.pan.setValueAtTime(panFrom, t0); p.pan.linearRampToValueAtTime(panTo, t0 + dur);
    const n = noiseSrc(t0, t0 + dur + .05), bp = ac.createBiquadFilter(), g = ac.createGain();
    bp.type = 'bandpass'; bp.Q.value = 1.1;
    const fc = new Float32Array(32), gc = new Float32Array(32);
    for (let i = 0; i < 32; i++) { const x = i / 31, hump = Math.sin(Math.PI * Math.pow(x, .8)); fc[i] = f0 + (f1 - f0) * hump; gc[i] = vol * Math.pow(hump, 1.6) + .00001; }
    bp.frequency.setValueCurveAtTime(fc, t0, dur); g.gain.setValueCurveAtTime(gc, t0, dur);
    n.connect(bp); bp.connect(g); g.connect(out);
  }
  function shutter(t) {
    const out = bus({ rev: .15 });
    for (const [dt, v] of [[0, .32], [.045, .22]]) {
      const n = noiseSrc(t + dt, t + dt + .03), hp = ac.createBiquadFilter(), g = ac.createGain();
      hp.type = 'highpass'; hp.frequency.value = 1500; g.gain.setValueAtTime(v, t + dt); g.gain.exponentialRampToValueAtTime(.0004, t + dt + .018);
      n.connect(hp); hp.connect(g); g.connect(out);
    }
    const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(60, t + .06);
    g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.0004, t + .08); o.connect(g); g.connect(out); o.start(t); o.stop(t + .1);
  }
  function shimmer(midis, t0, t1, vol = .02, rate = 5.5) {
    const out = bus({ rev: .9, dly: .2 });
    const g = ac.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 1.2); g.gain.setValueAtTime(vol, t1); g.gain.setTargetAtTime(0, t1, .3);
    const trem = ac.createGain(); trem.gain.value = .6; const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = rate; lg.gain.value = .4; lfo.connect(lg); lg.connect(trem.gain); lfo.start(t0); lfo.stop(t1 + 1.5);
    trem.connect(g); g.connect(out);
    midis.forEach((m, i) => { const o = ac.createOscillator(); o.frequency.value = mtof(m); o.detune.value = (i % 2 ? 4 : -4); o.connect(trem); o.start(t0); o.stop(t1 + 1.5); });
  }
  function air(t0, t1, vol = .03) {
    const out = bus({ rev: .6 });
    const n = noiseSrc(t0, t1 + .5), bp = ac.createBiquadFilter(), g = ac.createGain();
    bp.type = 'bandpass'; bp.Q.value = 2.5; bp.frequency.setValueAtTime(3000, t0);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .35; lg.gain.value = 1800; lfo.connect(lg); lg.connect(bp.frequency); lfo.start(t0); lfo.stop(t1 + .5);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + .8); g.gain.setValueAtTime(vol, t1); g.gain.linearRampToValueAtTime(0, t1 + .4);
    n.connect(bp); bp.connect(g); g.connect(out);
  }
  function shing(t, vol = .09) {
    whoosh(t, .55, vol, -.5, .5, 3500, 11000);
    bell(98, t + .12, .025, { dur: 2, rev: .8, dly: .4 });
  }

  /* ---- extra instruments ---- */
  function metalHit(t, vol = .3, base = 220, pan = 0) {   // N piece landing: inharmonic ring + crack + thump
    const out = bus({ pan, rev: .45 });
    for (const [ratio, amp, dec] of [[1, 1, .7], [1.47, .6, .5], [2.09, .45, .4], [2.56, .3, .3], [3.43, .2, .22], [4.9, .12, .15]]) {
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = base * ratio;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * amp * .35, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + dec);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + .05);
    }
    const n = noiseSrc(t, t + .25), bp = ac.createBiquadFilter(), ng = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = .7;
    ng.gain.setValueAtTime(vol * .9, t); ng.gain.exponentialRampToValueAtTime(.0004, t + .18);
    n.connect(bp); bp.connect(ng); ng.connect(out);
    kick(t, vol * 1.6, .45, .1);
  }
  function zap(t, vol = .12) {
    const out = bus({ rev: .5, dly: .25 });
    const n = noiseSrc(t, t + .12), hp = ac.createBiquadFilter(), g = ac.createGain();
    hp.type = 'highpass'; hp.frequency.setValueAtTime(6000, t); hp.frequency.exponentialRampToValueAtTime(1500, t + .1);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0003, t + .1);
    n.connect(hp); hp.connect(g); g.connect(out);
    const o = ac.createOscillator(), og = ac.createGain(); o.type = 'triangle';
    o.frequency.setValueAtTime(2400, t); o.frequency.exponentialRampToValueAtTime(600, t + .15);
    og.gain.setValueAtTime(vol * .6, t); og.gain.exponentialRampToValueAtTime(.0003, t + .18);
    o.connect(og); og.connect(out); o.start(t); o.stop(t + .2);
  }
  function crackle(t0, t1, density, vol) {                // sparse electrical clicks, deterministic
    const rr = mulberry32(Math.floor(t0 * 1000));
    for (let t = t0; t < t1; t += (.5 + rr()) / density) {
      const out = bus({ pan: rr() * 1.6 - .8, rev: .15 });
      const n = noiseSrc(t, t + .02), hp = ac.createBiquadFilter(), g = ac.createGain();
      hp.type = 'highpass'; hp.frequency.value = 3000 + rr() * 5000;
      g.gain.setValueAtTime(vol * (.4 + rr() * .6), t); g.gain.exponentialRampToValueAtTime(.0003, t + .008 + rr() * .01);
      n.connect(hp); hp.connect(g); g.connect(out);
    }
  }
  function buzz(t0, t1, pattern, fps, vol) {              // neon hum gated by the picture's flicker
    const out = bus({ rev: .2 });
    const o = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = 100; o2.type = 'square'; o2.frequency.value = 150;
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    const o2g = ac.createGain(); o2g.gain.value = .35;
    o.connect(lp); o2.connect(o2g); o2g.connect(lp); lp.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t0);
    for (let f = 0; t0 + f / fps < t1; f++) { const t = t0 + f / fps; g.gain.setValueAtTime(pattern[f % pattern.length] ? vol : vol * .05, t); }
    g.gain.setValueAtTime(0, t1);
    o.start(t0); o2.start(t0); o.stop(t1 + .05); o2.stop(t1 + .05);
  }
  function blip(t, m, vol = .06, pan = 0) {
    const out = bus({ pan, rev: .3, dly: .25 });
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'square';
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500;
    o.frequency.setValueAtTime(mtof(m), t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .003); g.gain.exponentialRampToValueAtTime(.0003, t + .12);
    o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(t + .14);
  }
  function pop(t, f0, f1, vol = .1, pan = 0) {
    const out = bus({ pan, rev: .25 });
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + .07);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .004); g.gain.exponentialRampToValueAtTime(.0003, t + .12);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + .14);
  }
  function clap(t, vol = .12) {
    const out = bus({ rev: .3 });
    for (const dt of [0, .011, .022]) {
      const n = noiseSrc(t + dt, t + dt + .2), bp = ac.createBiquadFilter(), g = ac.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.1;
      g.gain.setValueAtTime(vol * (dt ? .6 : 1), t + dt); g.gain.exponentialRampToValueAtTime(.0003, t + dt + (dt === .022 ? .16 : .02));
      n.connect(bp); bp.connect(g); g.connect(out);
    }
  }
  function bass(m, t, dur, vol = .12, cut = 900) {
    const out = bus({ pan: 0 });
    const lp = ac.createBiquadFilter(), g = ac.createGain();
    lp.type = 'lowpass'; lp.Q.value = 6; lp.frequency.setValueAtTime(cut * 2.4, t); lp.frequency.exponentialRampToValueAtTime(cut * .35, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .004); g.gain.setValueAtTime(vol, t + dur * .6); g.gain.exponentialRampToValueAtTime(.0004, t + dur);
    lp.connect(g); g.connect(out);
    for (const [type, det, oct] of [['sawtooth', -7, 0], ['sawtooth', 7, 0], ['sine', 0, -12]]) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = mtof(m + oct); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + .02);
    }
  }

  /* ================= score ================= */
  const S = T.feat, L = T.lock;

  // --- intro: the board wakes ---
  pad([26, 38, 45, 50, 53], 0, 2.6, { vol: .05, attack: 1.6, release: .4, cut0: 180, cut1: 900, q: 3 });
  sub(26, .1, 2.7, .12, 1.4, .3);
  air(0, 2.6, .022);
  zap(T.spark, .16); bell(98, T.spark + .01, .03, { dur: 2.5, rev: .8, dly: .4 }); kick(T.spark, .25, .5, .4);
  crackle(.3, 2.5, 6, .05); crackle(1.4, 2.6, 14, .045);
  swell(.6, 2.55, .08);
  [0, 1, 2, 3, 4].forEach(i => blip(.5 + i * B, [74, 77, 81, 84, 86][i], .022, i % 2 ? .4 : -.4));
  tom(2 * B, 26, .18); tom(4 * B, 26, .2);

  // --- assembly: pull back, three pieces, neon, impact ---
  whoosh(2.45, 1.05, .28, -.7, .6, 250, 3200);
  riser(2.6, T.boom - .03, .18, 38, 74);
  metalHit(T.slam[0], .34, 196, -.35);
  metalHit(T.slam[1], .36, 233, .35);
  metalHit(T.slam[2], .4, 262, 0);
  buzz(T.neon, T.boom, [1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1], 60, .07);
  crackle(T.neon, T.boom, 40, .07);
  swell(T.neon - .25, T.boom - .01, .2);

  impact(T.boom, 1.05);
  kick(T.boom, .85, .5);
  pad([38, 45, 50, 53, 57, 64, 69], T.boom, S[0] + .2, { vol: .075, attack: .02, release: .6, cut0: 5000, cut1: 1500, rev: .9 });
  shimmer([81, 86, 88], T.boom + .1, S[0] + .3, .012, 5);
  sub(26, T.boom, S[0], .14, .02, .2);

  // --- the orbit: four stations, i – VI – III – VII ---
  const CH = [
    { root: 38, pad: [50, 53, 57, 60], arp: [62, 65, 69, 74], bell: 81 },   // Dm
    { root: 34, pad: [46, 50, 53, 57], arp: [58, 62, 65, 69], bell: 84 },   // Bb
    { root: 41, pad: [53, 57, 60, 64], arp: [65, 69, 72, 77], bell: 86 },   // F
    { root: 36, pad: [48, 52, 55, 59], arp: [60, 64, 67, 72], bell: 88 },   // C
  ];
  CH.forEach((c, k) => {
    const s = S[k], e = k < 3 ? S[k + 1] : L;
    whoosh(s - .06, .62, .2, k % 2 ? .7 : -.7, k % 2 ? -.6 : .6, 350, 4200);
    tom(s, c.root - 12 + 12, .3);
    pad(c.pad, s, e, { vol: .045, attack: .12, release: .25, cut0: 900, cut1: 2600, q: 1.2 });
    for (let b = 0; b < 4; b++) { const tb = s + b * B; kick(tb, b === 0 ? .7 : .58, .32); hat(tb + B / 2, .05, .05, .2); if (b % 2) clap(tb, .1); }
    for (let i = 0; i < 16; i++) { const tb = s + i * B / 4; if (i % 4 !== 0) hat(tb, .016, .02, -.3); bass(c.root - 12 + (i % 8 === 6 ? 12 : 0), tb, B / 4 * .9, .085, 500 + i * 40); }
    for (let i = 0; i < 8; i++) pluck(c.arp[i % 4] + (i >= 4 ? 12 : 0), s + .25 + i * B / 2, .035, { cut: 2200 + i * 300, dur: .25, pan: i % 2 ? .4 : -.4, dly: .25 });
    bell(c.bell, s + .3, .06, { dur: 2, pan: k % 2 ? -.3 : .3, dly: .35 });
  });
  // chat: two bubbles pop, the reply types
  pop(S[0] + .42, 700, 1100, .09, .3); pop(S[0] + .66, 520, 820, .08, -.3);
  for (let t = S[0] + .9; t < S[0] + 1.52; t += .045) keyclick(t, .05);
  // image: tiles flip in a diagonal wave, the miniature comes forward
  for (let c = 0; c < 4; c++) for (let rw = 0; rw < 3; rw++) { const t = S[1] + .05 + (c + rw) * .07 + .15; blip(t, 79 + (c + rw) * 2 - (c + rw > 3 ? 5 : 0), .012, (c - 1.5) * .3); }
  whoosh(S[1] + 1.0, .5, .08, -.3, .3, 1200, 6000); bell(93, S[1] + 1.3, .05, { dur: 2, dly: .4 });
  // video: projector chatter, then play
  crackle(S[2] + .15, S[2] + .85, 30, .035);
  pop(S[2] + .85, 300, 180, .12); for (let t = S[2] + .9; t < S[2] + 1.85; t += 1 / 24) hat(t, .008, .012, .1);
  // agents: one blip per node as the task passes through
  blip(S[3] + .2, 69, .05);
  [74, 77, 79, 81, 84].forEach((m, i) => blip(S[3] + .38 + (i + 1) * .22, m, .05, -.5 + i * .25));

  // --- homecoming ---
  whoosh(L - .1, 1.0, .26, .7, -.5, 250, 3500);
  swell(L - .45, L - .01, .18);
  impact(L, 1.1);
  kick(L, .8, .5);
  pad([38, 45, 50, 53, 57, 64, 69, 74], L, DUR, { vol: .085, attack: .05, release: .5, cut0: 3600, cut1: 900, rev: .9, q: .9 });
  sub(26, L, DUR, .13, .05, .3);
  shimmer([81, 86, 88, 93], L + .3, DUR, .012, 4.5);
  [[69, .75], [74, .94], [81, 1.13]].forEach(([m, dt], i) => {
    bell(m, L + dt, .11 - i * .01, { dur: 3.2, pan: [-.25, .25, 0][i], dly: .35, rev: .7 });
    pluck(m, L + dt, .04, { cut: 5000, dur: .5, rev: .5, dly: .2 });
  });
  shing(L + 1.25, .07);
  tick(L + 1.38, 1174.66, .025);

  return ac.startRendering();
}

function encodeWav(buf) {
  const ch = buf.numberOfChannels, len = buf.length, out = new ArrayBuffer(44 + len * ch * 2), v = new DataView(out);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, len * ch * 2, true);
  const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  const d = mulberry32(5);
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
    const s = clamp(data[c][i] + (d() - d()) / 32768, -1, 1);
    v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true); o += 2;
  }
  return out;
}

async function renderWavBase64(V) {
  const buf = await renderBuffer(V);
  const bytes = new Uint8Array(encodeWav(buf));
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  let peak = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
  return { b64: btoa(s), peak };
}

window.NVX_AUDIO = { renderBuffer, renderWavBase64 };
})();
