/* Navidix Studio — 15s score and sound design, synthesized with Web Audio.
 *
 * D minor, 120 BPM (one beat = 0.5s), every cue locked to the picture's timeline:
 *   0.0  ambient Dm pad, the bar blooms open, keystrokes on every typed letter
 *   3.0  send → riser and reverse swell while the sentence becomes particles
 *   5.0  impact as the mark lands; pulse, arpeggio, a bell for each card
 *   7.55 the shot opens: wide Bb – F – C pads, delayed bell melody, low drums
 *  10.35 shutter closes → suck-in → 11.0 final impact, three-note sonic logo on Dm(add9)
 */
'use strict';
(function () {
const SR = 48000, DUR = 15;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

async function renderBuffer() {
  const V = window.NVX;
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
  master.gain.setValueAtTime(.8, 0); master.gain.setValueAtTime(.8, 13.3); master.gain.linearRampToValueAtTime(0, DUR - .01);

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

  /* ================= score ================= */
  // Notes (MIDI): D2 38, A2 45, Bb1 34, Bb2 46, C3 48, D3 50, F3 53, G3 55, A3 57, C4 60, D4 62, E4 64, F4 65, G4 67, A4 69,
  //               C5 72, D5 74, E5 76, F5 77, G5 79, A5 81, C6 84, D6 86, E6 88, F6 89

  // --- act 1: one sentence ---
  air(0, 3.0, .02);
  pad([50, 57, 60, 65, 69], 0.0, 3.1, { vol: .042, attack: 1.4, release: .6, cut0: 380, cut1: 1300 });
  sub(38, .2, 3.0, .08, 1.2, .3);
  whoosh(.18, .65, .12, .4, -.4, 500, 2200);
  bell(86, .34, .05, { dur: 3, pan: .2 });
  bell(81, .34, .03, { dur: 3, pan: -.2 });
  [1.25, 1.33, 1.41].forEach((t, i) => tick(t, 1800 + i * 300, .03, .3 - i * .2));
  V.TYPE_TIMES.forEach(t => keyclick(t, .16 + r() * .06));
  keyclick(2.96, .26); tick(2.98, 1174.66, .05); pluck(74, 2.98, .06, { cut: 4000 });

  // --- act 2: one model (sentence → particles → mark) ---
  whoosh(3.0, .9, .16, .7, -.2, 600, 4200);
  pad([46, 53, 57, 62, 69], 2.95, 4.9, { vol: .06, attack: 1.2, release: .1, cut0: 600, cut1: 4200, q: 2 });
  sub(34, 3.0, 4.9, .12, 1.0, .08);
  riser(3.1, 4.93, .22);
  swell(4.0, 4.95, .22);
  air(3.0, 4.9, .04);
  [3.5, 4.0, 4.25, 4.5, 4.625, 4.75, 4.8125, 4.875].forEach((t, i) => hat(t, .02 + i * .006, .03, (i % 2 ? .3 : -.3)));
  // a sparkle trail as letters lift off (right → left)
  [3.1, 3.2, 3.3, 3.4, 3.5, 3.6].forEach((t, i) => bell([93, 91, 88, 86, 84, 81][i], t, .018, { dur: 1.4, pan: .6 - i * .24, rev: .7, dly: .2 }));

  // --- impact 1: the mark lands ---
  impact(5.0, 1);
  kick(5.0, .8);
  pluck(50, 5.0, .07, { cut: 2500, dur: 1.1, rev: .5, dly: .2 });
  pad([50, 57, 62, 64, 65, 69], 5.0, 5.5, { vol: .07, attack: .01, release: 1.4, cut0: 5000, cut1: 1400, rev: .8 });
  shing(5.18, .07);

  // groove 5.0 – 7.0
  for (let b = 5.5; b < 7.0; b += .5) kick(b, .62);
  for (let b = 5.25; b < 7.0; b += .5) hat(b, .055, .05, .15);
  for (let s = 5.0; s < 7.0; s += .125) if (Math.round((s - 5) / .125) % 2) hat(s, .018, .025, -.25);
  pad([50, 53, 57, 60], 5.0, 6.0, { vol: .05, attack: .3, release: .3, cut0: 900, cut1: 1600 });
  pad([46, 50, 53, 57], 6.0, 7.0, { vol: .05, attack: .2, release: .5, cut0: 1200, cut1: 2200 });
  sub(38, 5.0, 6.0, .15, .05, .1); sub(34, 6.0, 7.0, .15, .05, .3);
  {
    const arpDm = [62, 65, 69, 74, 69, 65, 62, 57], arpBb = [58, 62, 65, 69, 65, 62, 58, 53];
    let i = 0;
    for (let s = 5.0; s < 7.0 - .01; s += .125, i++) {
      const seq = s < 6.0 ? arpDm : arpBb;
      pluck(seq[i % 8], s, .045, { cut: 1600 + (s - 5) * 1600, dur: .22, pan: (i % 2 ? .35 : -.35), dly: .22 });
    }
  }
  // one bell per card (chat, image, video, agent) on the dotted-eighth grid
  [[81, 5.25, .5], [84, 5.625, -.5], [86, 6.0, .5], [88, 6.375, -.5]].forEach(([m, t, p]) => {
    bell(m, t, .07, { dur: 2.2, pan: p, dly: .35 }); whoosh(t - .06, .35, .05, -p * .5, p, 900, 4500);
  });
  // agent checks
  [6.625, 6.825, 6.995].forEach((t, i) => tick(t, [1568, 1760, 2093][i], .045, -.45));

  // --- transition into the shot ---
  whoosh(6.92, .75, .26, -.7, .7, 300, 3800);
  swell(7.05, 7.55, .12);
  // --- the shot: Bb – F – C, wide and slow ---
  impact(7.55, .38);
  tom(7.55, 38, .45);
  pad([34, 46, 53, 57, 62, 72], 7.55, 8.55, { vol: .085, attack: .35, release: 1.1, cut0: 900, cut1: 2600, rev: .8 });
  pad([41, 48, 57, 60, 64, 72], 8.55, 9.55, { vol: .085, attack: .5, release: 1.1, cut0: 1200, cut1: 2800, rev: .8 });
  pad([36, 48, 55, 60, 64, 67, 74], 9.55, 10.42, { vol: .09, attack: .5, release: .25, cut0: 1400, cut1: 4200, rev: .8, q: 1.4 });
  sub(34, 7.55, 8.55, .15, .1, .3); sub(41, 8.55, 9.55, .14, .2, .3); sub(36, 9.55, 10.42, .15, .2, .15);
  shimmer([81, 86, 88], 7.6, 10.35, .014, 6);
  air(7.55, 10.35, .03);
  [[74, 7.55], [77, 7.925], [81, 8.3], [84, 8.55], [81, 8.925], [77, 9.3], [79, 9.55], [76, 9.925], [79, 10.175]]
    .forEach(([m, t], i) => bell(m, t, .065, { dur: 2.4, pan: (i % 2 ? .35 : -.35), dly: .4, rev: .6 }));
  tom(8.55, 36, .4); tom(9.55, 36, .42); tom(10.05, 38, .3); tom(10.2, 41, .3);
  // shutter: suck-in, close, a beat of silence
  riser(10.3, 10.9, .2, 50, 86);
  swell(10.35, 10.96, .28);
  shutter(10.86);

  // --- impact 2: lockup ---
  impact(11.0, 1.15);
  kick(11.0, .85, .5);
  pad([38, 45, 50, 53, 57, 64, 69, 74], 11.0, 15.0, { vol: .085, attack: .04, release: .5, cut0: 3800, cut1: 900, rev: .9, q: .9 });
  sub(38, 11.0, 15.0, .12, .05, .3);
  shimmer([81, 86, 88, 93], 11.3, 15.0, .012, 4.5);
  // sonic logo: A4 → D5 → A5
  [[69, 11.0], [74, 11.19], [81, 11.38]].forEach(([m, t], i) => {
    bell(m, t, .11 - i * .01, { dur: 3.4, pan: [-.25, .25, 0][i], dly: .35, rev: .7 });
    pluck(m, t, .04, { cut: 5000, dur: .5, rev: .5, dly: .2 });
  });
  // NAVIDIX STUDIO decoding
  for (let i = 0; i < 13; i++) tick(11.45 + i * .035, 2600 + (i % 3) * 400, .012, -.2 + i * .03);
  whoosh(11.6, .7, .07, .3, -.3, 600, 2600);
  shing(12.18, .08);
  // pills
  [[86, 12.35], [89, 12.45], [93, 12.55], [98, 12.65]].forEach(([m, t], i) => bell(m, t, .032, { dur: 1.2, pan: .45 - i * .3, rev: .6, dly: .2 }));
  tick(12.88, 1174.66, .025);

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

async function renderWavBase64() {
  const buf = await renderBuffer();
  const bytes = new Uint8Array(encodeWav(buf));
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  let peak = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
  return { b64: btoa(s), peak };
}

window.NVX_AUDIO = { renderBuffer, renderWavBase64 };
})();
