'use strict';
// Shared namespace, constants and small math helpers.
window.WW = window.WW || {};
(function (G) {
  G.TAU = Math.PI * 2;
  G.DT = 1 / 60;
  G.GRAV = 0.4; // px per step^2
  G.world = { W: 2000, zones: [[50, 860], [1140, 1950]] };
  G.TEAMS = [
    { name: 'Blue', main: '#3d9bff', dark: '#1d528f', light: '#a9d4ff', glow: '#6fe3ff' },
    { name: 'Red', main: '#ff4f45', dark: '#8f201b', light: '#ffb3ab', glow: '#ffb14a' },
  ];
  G.time = 0;
  G.realTime = 0;
  G.units = [];
  G.props = [];
  G.projectiles = [];

  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  G.angDiff = (a, b) => {
    let d = (b - a) % G.TAU;
    if (d > Math.PI) d -= G.TAU;
    if (d < -Math.PI) d += G.TAU;
    return d;
  };
  G.approachAngle = (a, b, maxStep) => a + G.clamp(G.angDiff(a, b), -maxStep, maxStep);

  // Closest-approach parameter t (0..1) of point P onto segment AB.
  G.segT = (ax, ay, bx, by, px, py) => {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    if (!l2) return 0;
    return G.clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  };

  G.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  G.hexToRgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  G.mix = (a, b, t) => {
    const A = G.hexToRgb(a), B = G.hexToRgb(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };

  // Rounded rect path with fallback for older canvases.
  G.rrect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  };

  const SAVE_KEY = 'wobble-warfare-v1';
  G.loadSave = () => {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && typeof s === 'object') return { stars: s.stars || {}, sound: s.sound !== false };
    } catch (e) { /* storage unavailable */ }
    return { stars: {}, sound: true };
  };
  G.writeSave = (s) => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* storage unavailable */ }
  };
})(window.WW);
