'use strict';
// Procedural WebAudio sound effects — no audio files.
(function (G) {
  const A = (G.audio = { ctx: null, on: true, last: {}, vol: 1 });
  const GAPS = { minigun: 0.05, rifle: 0.02, pistol: 0.03, hit: 0.04, oof: 0.05, boom: 0.04, tink: 0.06, heal: 0.15, clang: 0.04, swoosh: 0.04 };

  A.init = function () {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (A.ctx = new AC());
    A.master = ctx.createGain();
    A.master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 6;
    A.master.connect(comp);
    comp.connect(ctx.destination);
    const len = ctx.sampleRate * 1.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noiseBuf = buf;
  };

  function env(g, t, a, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + decay);
  }
  function noise(t, dur, type, freq, q, peak, decay, dest, freqEnd) {
    const c = A.ctx;
    const src = c.createBufferSource();
    src.buffer = A.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    env(g, t, 0.003, peak, decay);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }
  function tone(t, type, f0, f1, peak, a, decay, dest) {
    const c = A.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + decay);
    const g = c.createGain();
    env(g, t, a, peak, decay);
    o.connect(g); g.connect(dest);
    o.start(t);
    o.stop(t + a + decay + 0.05);
  }

  const SFX = {
    rifle(t, o, pm) { noise(t, 0.12, 'bandpass', 1700 * pm, 0.9, 0.55, 0.09, o); tone(t, 'sine', 160 * pm, 50, 0.4, 0.002, 0.07, o); },
    pistol(t, o, pm) { noise(t, 0.1, 'bandpass', 2400 * pm, 1, 0.4, 0.07, o); tone(t, 'square', 300 * pm, 90, 0.07, 0.002, 0.05, o); },
    shotgun(t, o, pm) { noise(t, 0.35, 'lowpass', 2600 * pm, 0.7, 0.8, 0.28, o, 400); tone(t, 'sine', 110 * pm, 40, 0.6, 0.002, 0.18, o); },
    sniper(t, o, pm) { tone(t, 'sawtooth', 2200 * pm, 180, 0.22, 0.002, 0.35, o); noise(t, 0.3, 'highpass', 3000, 0.7, 0.3, 0.2, o); tone(t, 'sine', 90 * pm, 40, 0.5, 0.002, 0.25, o); },
    minigun(t, o, pm) { noise(t, 0.06, 'bandpass', 1400 * pm, 1.2, 0.35, 0.04, o); tone(t, 'sine', 120 * pm, 60, 0.15, 0.002, 0.04, o); },
    rocket(t, o, pm) { noise(t, 0.7, 'bandpass', 600 * pm, 0.8, 0.5, 0.6, o, 2400); tone(t, 'sawtooth', 90 * pm, 220, 0.1, 0.01, 0.5, o); },
    throw(t, o, pm) { noise(t, 0.2, 'bandpass', 900 * pm, 2, 0.25, 0.15, o, 2600); },
    boom(t, o, pm) {
      noise(t, 1.4, 'lowpass', 1200 * pm, 0.6, 1.0, 1.1, o, 90);
      tone(t, 'sine', 75 * pm, 28, 1.0, 0.005, 0.9, o);
      noise(t, 0.2, 'highpass', 2000, 0.5, 0.35, 0.1, o);
    },
    hit(t, o, pm) { noise(t, 0.05, 'bandpass', 3200 * pm, 3, 0.25, 0.03, o); },
    clang(t, o, pm) { tone(t, 'triangle', 1250 * pm, 1100, 0.22, 0.001, 0.25, o); tone(t, 'triangle', 1870 * pm, 1700, 0.13, 0.001, 0.2, o); noise(t, 0.05, 'highpass', 4000, 0.5, 0.2, 0.03, o); },
    bonk(t, o, pm) { tone(t, 'sine', 420 * pm, 120, 0.6, 0.002, 0.18, o); noise(t, 0.06, 'lowpass', 1500, 0.8, 0.3, 0.05, o); },
    slash(t, o, pm) { noise(t, 0.18, 'bandpass', 3500 * pm, 4, 0.35, 0.15, o, 1200); tone(t, 'sawtooth', 900 * pm, 300, 0.07, 0.005, 0.12, o); },
    swoosh(t, o, pm) { noise(t, 0.2, 'bandpass', 800 * pm, 3, 0.22, 0.16, o, 2800); },
    tink(t, o, pm) { tone(t, 'triangle', 2400 * pm, 2200, 0.08, 0.001, 0.06, o); },
    heal(t, o, pm) { tone(t, 'sine', 660 * pm, 990, 0.1, 0.01, 0.18, o); tone(t + 0.06, 'sine', 990 * pm, 1320, 0.07, 0.01, 0.15, o); },
    oof(t, o, pm) {
      const c = A.ctx;
      const base = G.rand(140, 300) * pm;
      const osc = c.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(base * 1.4, t);
      osc.frequency.exponentialRampToValueAtTime(base * 0.72, t + 0.3);
      const lfo = c.createOscillator();
      lfo.frequency.value = G.rand(6, 11);
      const lg = c.createGain();
      lg.gain.value = base * 0.06;
      lfo.connect(lg); lg.connect(osc.frequency);
      const f1 = c.createBiquadFilter();
      f1.type = 'bandpass';
      f1.Q.value = 3;
      f1.frequency.setValueAtTime(G.rand(650, 950), t);
      f1.frequency.exponentialRampToValueAtTime(380, t + 0.3);
      const g = c.createGain();
      env(g, t, 0.025, 1.0, 0.3);
      osc.connect(f1); f1.connect(g); g.connect(o);
      osc.start(t); lfo.start(t);
      osc.stop(t + 0.4); lfo.stop(t + 0.4);
    },
    place(t, o) { tone(t, 'sine', 420, 780, 0.28, 0.005, 0.09, o); },
    remove(t, o) { tone(t, 'sine', 600, 240, 0.22, 0.005, 0.1, o); },
    ui(t, o) { tone(t, 'triangle', 900, 1150, 0.12, 0.002, 0.05, o); },
    error(t, o) { tone(t, 'square', 180, 140, 0.1, 0.005, 0.14, o); },
    start(t, o) {
      [196, 247, 294, 392].forEach((f) => tone(t, 'sawtooth', f, f * 1.01, 0.06, 0.04, 0.8, o));
      noise(t, 0.6, 'bandpass', 500, 1, 0.2, 0.5, o, 1800);
    },
    win(t, o) { [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.12, 'square', f, f, 0.1, 0.01, 0.32, o)); },
    lose(t, o) { [392, 330, 262, 196].forEach((f, i) => tone(t + i * 0.18, 'triangle', f, f * 0.97, 0.18, 0.01, 0.38, o)); },
  };

  A.play = function (name, x, vol = 1) {
    if (!A.ctx || !A.on || A.ctx.state !== 'running') return;
    const now = A.ctx.currentTime;
    const gap = GAPS[name] ?? 0.025;
    if (A.last[name] && now - A.last[name] < gap) return;
    A.last[name] = now;
    let v = vol * A.vol;
    let pan = 0;
    if (x != null) {
      const cam = G.cam;
      const dx = (x - cam.x) * cam.z;
      v *= G.clamp(1.15 - Math.abs(dx) / 1400, 0.12, 1);
      pan = G.clamp(dx / (cam.w * 0.6), -0.8, 0.8);
    }
    const out = A.ctx.createGain();
    out.gain.value = v;
    if (pan && A.ctx.createStereoPanner) {
      const p = A.ctx.createStereoPanner();
      p.pan.value = pan;
      out.connect(p);
      p.connect(A.master);
    } else out.connect(A.master);
    const pm = G.timeScale < 0.6 && G.timeScale > 0 ? 0.6 : 1;
    try { SFX[name] && SFX[name](now, out, pm); } catch (e) { /* ignore audio scheduling errors */ }
  };
})(window.WW);
