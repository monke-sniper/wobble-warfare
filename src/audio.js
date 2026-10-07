// Procedural WebAudio sound effects (no audio files). Positional: volume falls off with
// distance from the camera and pans by the camera's right vector.
const A = { ctx: null, on: true, vol: 0.7, last: {}, lx: 0, ly: 0, lz: 0, rx: 1, rz: 0, timeScale: 1, budget: 0 };
export const audio = A;

const GAPS = { minigun: 0.05, rifle: 0.03, pistol: 0.035, hit: 0.04, oof: 0.06, boom: 0.05, pop: 0.04, tink: 0.06, heal: 0.18, clang: 0.04, swoosh: 0.05,
  slash: 0.035, chop: 0.04, bonk: 0.04, stab: 0.04, punch: 0.04, thunk: 0.03, bow: 0.03, step: 0.02 };

A.init = function () {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const ctx = (A.ctx = new AC());
  A.master = ctx.createGain();
  A.master.gain.value = A.vol;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 6;
  A.master.connect(comp); comp.connect(ctx.destination);
  const len = ctx.sampleRate * 1.5;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  A.noiseBuf = buf;
};
A.setVolume = (v) => { A.vol = v; if (A.master) A.master.gain.value = v; };
A.listener = (x, y, z, rx, rz) => { A.lx = x; A.ly = y; A.lz = z; A.rx = rx; A.rz = rz; };

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
const R = (a, b) => a + Math.random() * (b - a);

const SFX = {
  rifle(t, o, p) { noise(t, 0.12, 'bandpass', 1700 * p, 0.9, 0.55, 0.09, o); tone(t, 'sine', 160 * p, 50, 0.4, 0.002, 0.07, o); },
  pistol(t, o, p) { noise(t, 0.1, 'bandpass', 2400 * p, 1, 0.4, 0.07, o); tone(t, 'square', 300 * p, 90, 0.07, 0.002, 0.05, o); },
  musket(t, o, p) { noise(t, 0.4, 'lowpass', 1800 * p, 0.7, 0.8, 0.32, o, 300); tone(t, 'sine', 120 * p, 45, 0.6, 0.002, 0.2, o); },
  shotgun(t, o, p) { noise(t, 0.35, 'lowpass', 2600 * p, 0.7, 0.8, 0.28, o, 400); tone(t, 'sine', 110 * p, 40, 0.6, 0.002, 0.18, o); },
  rail(t, o, p) { tone(t, 'sawtooth', 2200 * p, 180, 0.22, 0.002, 0.35, o); noise(t, 0.3, 'highpass', 3000, 0.7, 0.3, 0.2, o); tone(t, 'sine', 90 * p, 40, 0.5, 0.002, 0.25, o); },
  minigun(t, o, p) { noise(t, 0.06, 'bandpass', 1400 * p, 1.2, 0.35, 0.04, o); tone(t, 'sine', 120 * p, 60, 0.15, 0.002, 0.04, o); },
  rocket(t, o, p) { noise(t, 0.7, 'bandpass', 600 * p, 0.8, 0.5, 0.6, o, 2400); tone(t, 'sawtooth', 90 * p, 220, 0.1, 0.01, 0.5, o); },
  firework(t, o, p) { noise(t, 0.5, 'bandpass', 1200 * p, 2, 0.35, 0.45, o, 4000); tone(t, 'square', 600 * p, 1800, 0.05, 0.01, 0.3, o); },
  cannon(t, o, p) { noise(t, 1.0, 'lowpass', 900 * p, 0.6, 1.0, 0.8, o, 80); tone(t, 'sine', 60 * p, 28, 1.0, 0.004, 0.6, o); },
  catapult(t, o, p) { tone(t, 'triangle', 140 * p, 70, 0.4, 0.01, 0.25, o); noise(t + 0.05, 0.5, 'bandpass', 400 * p, 1.5, 0.4, 0.4, o, 1400); },
  throw(t, o, p) { noise(t, 0.2, 'bandpass', 900 * p, 2, 0.25, 0.15, o, 2600); },
  bow(t, o, p) { tone(t, 'triangle', 220 * p, 110, 0.35, 0.002, 0.12, o); noise(t, 0.15, 'bandpass', 1800 * p, 2, 0.25, 0.1, o, 900); },
  caw(t, o, p) { tone(t, 'sawtooth', 900 * p, 600, 0.15, 0.01, 0.15, o); tone(t + 0.18, 'sawtooth', 850 * p, 550, 0.12, 0.01, 0.12, o); },
  magic(t, o, p) { tone(t, 'sine', 500 * p, 1400, 0.18, 0.02, 0.35, o); tone(t, 'triangle', 750 * p, 2100, 0.08, 0.02, 0.3, o); },
  summon(t, o, p) { tone(t, 'sawtooth', 110 * p, 55, 0.2, 0.05, 0.8, o); tone(t, 'sine', 330 * p, 165, 0.15, 0.05, 0.7, o); noise(t, 0.8, 'bandpass', 600, 1, 0.2, 0.7, o, 200); },
  thunder(t, o, p) { noise(t, 1.6, 'lowpass', 3000 * p, 0.5, 1.0, 1.4, o, 120); tone(t, 'square', 1800 * p, 200, 0.15, 0.001, 0.15, o); },
  boom(t, o, p) { noise(t, 1.4, 'lowpass', 1200 * p, 0.6, 1.0, 1.1, o, 90); tone(t, 'sine', 75 * p, 28, 1.0, 0.005, 0.9, o); noise(t, 0.2, 'highpass', 2000, 0.5, 0.35, 0.1, o); },
  pop(t, o, p) { noise(t, 0.4, 'lowpass', 2400 * p, 0.8, 0.6, 0.3, o, 300); tone(t, 'sine', 140 * p, 50, 0.5, 0.003, 0.2, o); },
  splat(t, o, p) { noise(t, 0.3, 'bandpass', 700 * p, 1.2, 0.5, 0.25, o, 250); tone(t, 'sine', 400 * p, 120, 0.2, 0.005, 0.2, o); },
  hit(t, o, p) { noise(t, 0.05, 'bandpass', 3200 * p, 3, 0.25, 0.03, o); },
  thunk(t, o, p) { tone(t, 'sine', 260 * p, 90, 0.4, 0.002, 0.09, o); noise(t, 0.05, 'bandpass', 1200, 2, 0.2, 0.04, o); },
  clang(t, o, p) { tone(t, 'triangle', 1250 * p, 1100, 0.22, 0.001, 0.25, o); tone(t, 'triangle', 1870 * p, 1700, 0.13, 0.001, 0.2, o); noise(t, 0.05, 'highpass', 4000, 0.5, 0.2, 0.03, o); },
  bonk(t, o, p) { tone(t, 'sine', 420 * p, 120, 0.6, 0.002, 0.18, o); noise(t, 0.06, 'lowpass', 1500, 0.8, 0.3, 0.05, o); },
  thud(t, o, p) { tone(t, 'sine', 160 * p, 60, 0.6, 0.003, 0.2, o); noise(t, 0.12, 'lowpass', 600, 0.8, 0.4, 0.1, o); },
  punch(t, o, p) { tone(t, 'sine', 200 * p, 80, 0.5, 0.002, 0.08, o); noise(t, 0.04, 'lowpass', 2000, 0.8, 0.3, 0.03, o); },
  slash(t, o, p) { noise(t, 0.18, 'bandpass', 3500 * p, 4, 0.35, 0.15, o, 1200); tone(t, 'sawtooth', 900 * p, 300, 0.07, 0.005, 0.12, o); },
  chop(t, o, p) { noise(t, 0.1, 'bandpass', 1500 * p, 2, 0.4, 0.08, o); tone(t, 'square', 300 * p, 120, 0.12, 0.002, 0.08, o); },
  stab(t, o, p) { noise(t, 0.08, 'bandpass', 2400 * p, 3, 0.35, 0.06, o, 900); },
  saber(t, o, p) { tone(t, 'sawtooth', 160 * p, 120, 0.15, 0.01, 0.2, o); noise(t, 0.2, 'bandpass', 2600 * p, 3, 0.2, 0.18, o, 900); },
  zap(t, o, p) { tone(t, 'square', 1400 * p, 300, 0.12, 0.001, 0.12, o); noise(t, 0.1, 'highpass', 3000, 0.5, 0.2, 0.08, o); },
  strum(t, o, p) { [196, 247, 294, 392].forEach((f, i) => tone(t + i * 0.01, 'triangle', f * p, f * p, 0.12, 0.003, 0.4, o)); tone(t, 'sine', 300, 100, 0.4, 0.002, 0.15, o); },
  swoosh(t, o, p) { noise(t, 0.2, 'bandpass', 800 * p, 3, 0.22, 0.16, o, 2800); },
  tink(t, o, p) { tone(t, 'triangle', 2400 * p, 2200, 0.08, 0.001, 0.06, o); },
  heal(t, o, p) { tone(t, 'sine', 660 * p, 990, 0.1, 0.01, 0.18, o); tone(t + 0.06, 'sine', 990 * p, 1320, 0.07, 0.01, 0.15, o); },
  oof(t, o, p) {
    const c = A.ctx;
    const base = R(140, 300) * p;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * 1.4, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.72, t + 0.3);
    const lfo = c.createOscillator();
    lfo.frequency.value = R(6, 11);
    const lg = c.createGain();
    lg.gain.value = base * 0.06;
    lfo.connect(lg); lg.connect(osc.frequency);
    const f1 = c.createBiquadFilter();
    f1.type = 'bandpass'; f1.Q.value = 3;
    f1.frequency.setValueAtTime(R(650, 950), t);
    f1.frequency.exponentialRampToValueAtTime(380, t + 0.3);
    const g = c.createGain();
    env(g, t, 0.025, 1.0, 0.3);
    osc.connect(f1); f1.connect(g); g.connect(o);
    osc.start(t); lfo.start(t); osc.stop(t + 0.4); lfo.stop(t + 0.4);
  },
  place(t, o) { tone(t, 'sine', 420, 780, 0.28, 0.005, 0.09, o); },
  remove(t, o) { tone(t, 'sine', 600, 240, 0.22, 0.005, 0.1, o); },
  ui(t, o) { tone(t, 'triangle', 900, 1150, 0.12, 0.002, 0.05, o); },
  error(t, o) { tone(t, 'square', 180, 140, 0.1, 0.005, 0.14, o); },
  start(t, o) { [196, 247, 294, 392].forEach((f) => tone(t, 'sawtooth', f, f * 1.01, 0.06, 0.04, 0.8, o)); noise(t, 0.6, 'bandpass', 500, 1, 0.2, 0.5, o, 1800); },
  win(t, o) { [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.12, 'square', f, f, 0.1, 0.01, 0.32, o)); },
  lose(t, o) { [392, 330, 262, 196].forEach((f, i) => tone(t + i * 0.18, 'triangle', f, f * 0.97, 0.18, 0.01, 0.38, o)); },
};

// x === undefined -> non-positional UI sound.
A.play = function (name, x, y, z, vol = 1) {
  if (!A.ctx || !A.on || A.ctx.state !== 'running') return;
  const now = A.ctx.currentTime;
  const gap = GAPS[name] ?? 0.025;
  if (A.last[name] && now - A.last[name] < gap) return;
  // global voice budget so 300-unit brawls don't melt the audio thread
  if (x !== undefined) {
    if (A.budgetT !== (now * 20 | 0)) { A.budgetT = now * 20 | 0; A.budget = 0; }
    if (++A.budget > 7) return;
  }
  A.last[name] = now;
  let v = vol;
  let pan = 0;
  if (x !== undefined) {
    const dx = x - A.lx, dy = (y || 0) - A.ly, dz = z - A.lz;
    const d = Math.hypot(dx, dy, dz);
    v *= Math.max(0.05, Math.min(1, 14 / (d + 6)));
    if (!(v >= 0.06)) return; // also rejects NaN
    if (!Number.isFinite(dx + dz)) return;
    pan = Math.max(-0.8, Math.min(0.8, ((dx * A.rx + dz * A.rz) / (d + 1)) * 0.9));
  }
  const out = A.ctx.createGain();
  out.gain.value = v;
  if (pan && A.ctx.createStereoPanner) {
    const p = A.ctx.createStereoPanner();
    p.pan.value = pan;
    out.connect(p); p.connect(A.master);
  } else out.connect(A.master);
  const pm = A.timeScale < 0.6 && A.timeScale > 0 ? 0.6 : 1;
  try { SFX[name] && SFX[name](now, out, pm); } catch { /* ignore scheduling errors */ }
};
