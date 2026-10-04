'use strict';
// Heightmap terrain (deformable), parallax sci-fi sky, ground and decor drawing.
(function (G) {
  const T = (G.terrain = {});
  const STEP = 8;
  T.STEP = STEP;
  T.BASE = 640;

  T.generate = function (seed, hilly) {
    const rng = G.mulberry32(seed * 9973 + 17);
    const W = G.world.W;
    const n = Math.ceil(W / STEP) + 3;
    const h = new Float32Array(n);
    const oct = [
      { w: 900 + rng() * 500, a: 70 },
      { w: 380 + rng() * 160, a: 34 },
      { w: 140 + rng() * 50, a: 10 },
      { w: 55, a: 2.5 },
    ].map((o) => ({ ...o, p: rng() * G.TAU, p2: rng() * G.TAU }));
    for (let i = 0; i < n; i++) {
      const x = i * STEP;
      let y = 0;
      for (const o of oct) {
        const k = (x / o.w) * G.TAU;
        y += (Math.sin(k + o.p) * 0.65 + Math.sin(k * 1.73 + o.p2) * 0.35) * o.a;
      }
      const e = Math.abs(x / W - 0.5) * 2;
      h[i] = T.BASE - y * hilly - e * e * 50 * hilly;
    }
    T.h = h;
    T.orig = Float32Array.from(h);
    T.n = n;
    T.seed = seed;

    T.decor = [];
    for (let x = 8; x < W; x += 8 + rng() * 22) T.decor.push({ x, k: 'tuft', s: 0.6 + rng() * 0.8 });
    for (let i = 0; i < 16; i++) {
      const s = 0.6 + rng() * 1.1;
      const shape = [];
      const m = 5 + ((rng() * 3) | 0);
      for (let j = 0; j < m; j++) {
        const a = Math.PI + (j / (m - 1)) * Math.PI;
        const r = (5 + rng() * 4) * s;
        shape.push(Math.cos(a) * r * 1.3, Math.sin(a) * r);
      }
      T.decor.push({ x: rng() * W, k: 'rock', s, shape });
    }
    for (let i = 0; i < 4; i++) T.decor.push({ x: 120 + rng() * (W - 240), k: 'pylon', s: 1, ph: rng() * 6 });
    T.bg = makeBg(rng);
  };

  // Undo craters (used when resetting a battle).
  T.restore = function () { T.h.set(T.orig); };

  T.heightAt = function (x) {
    const f = x / STEP;
    const i = Math.floor(f);
    if (i < 0) return T.h[0];
    if (i >= T.n - 1) return T.h[T.n - 1];
    const t = f - i;
    return T.h[i] + (T.h[i + 1] - T.h[i]) * t;
  };

  T.crater = function (x, r, depth) {
    const i0 = Math.max(0, Math.floor((x - r) / STEP));
    const i1 = Math.min(T.n - 1, Math.ceil((x + r) / STEP));
    for (let i = i0; i <= i1; i++) {
      const d = (i * STEP - x) / r;
      if (d * d < 1) T.h[i] = Math.min(T.h[i] + depth * (1 - d * d), T.orig[i] + 80);
    }
  };

  function makeBg(rng) {
    const stars = [];
    for (let i = 0; i < 170; i++) stars.push({ x: rng(), y: rng() * 0.62, r: rng() < 0.88 ? 1 : 2, tw: rng() * 6.28, sp: 0.5 + rng() * 2 });
    const far = [], mid = [];
    const p1 = rng() * 6, p2 = rng() * 6, p3 = rng() * 6;
    for (let x = -2600; x <= 4600; x += 40) {
      far.push(x, 130 + Math.sin(x * 0.0021 + p1) * 60 + Math.sin(x * 0.0057 + p2) * 35 + rng() * 12);
      mid.push(x, 40 + Math.sin(x * 0.0034 + p3) * 26 + Math.sin(x * 0.011 + p1) * 10);
    }
    const city = [];
    for (let x = -2600; x < 4600;) {
      const w = 30 + rng() * 70;
      const h = 40 + rng() * rng() * 230;
      const wins = [];
      for (let i = 0; i < 14; i++) if (rng() < 0.6) wins.push(rng() * (w - 8) + 3, rng() * (h - 10) + 5, rng() < 0.75 ? 0 : 1);
      city.push({ x, w, h, wins, ant: rng() < 0.25 });
      x += w + rng() * 45;
    }
    return { stars, far, mid, city, planet: 0.15 + rng() * 0.7 };
  }

  const layerZ = (cam, p) => cam.z * G.lerp(0.55, 1, p);
  const layerX = (lx, cam, p, w, zl) => w / 2 + (lx - cam.x * p - (G.world.W / 2) * (1 - p)) * zl;
  const layerHorizon = (cam, p, h) => h / 2 + (T.BASE - 30 - cam.y) * cam.z * G.lerp(0.45, 1, p);

  function ridge(ctx, arr, cam, p, w, h, color) {
    const zl = layerZ(cam, p), hy = layerHorizon(cam, p, h);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-10, h + 10);
    for (let i = 0; i < arr.length; i += 2) {
      const sx = layerX(arr[i], cam, p, w, zl);
      if (sx < -120 || sx > w + 120) continue;
      ctx.lineTo(sx, hy - arr[i + 1] * zl);
    }
    ctx.lineTo(w + 10, h + 10);
    ctx.fill();
    return hy;
  }

  T.drawSky = function (ctx, cam, w, h) {
    const bg = T.bg;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#060920');
    g.addColorStop(0.42, '#1b1847');
    g.addColorStop(0.7, '#552c63');
    g.addColorStop(0.88, '#c2566c');
    g.addColorStop(1, '#f39a6b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // stars
    ctx.fillStyle = '#fff';
    const span = w * 1.4;
    for (const s of bg.stars) {
      const x = (((s.x * span - cam.x * 0.03) % span) + span) % span - w * 0.2;
      ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(G.realTime * s.sp + s.tw));
      ctx.fillRect(x, s.y * h, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // ringed planet
    const pr = Math.min(w, h) * 0.12 + 30;
    const px = w * bg.planet - (cam.x - G.world.W / 2) * 0.04, py = h * 0.24;
    const halo = ctx.createRadialGradient(px, py, pr * 0.8, px, py, pr * 2.4);
    halo.addColorStop(0, 'rgba(255,140,190,0.22)');
    halo.addColorStop(1, 'rgba(255,140,190,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(px - pr * 2.5, py - pr * 2.5, pr * 5, pr * 5);
    ctx.lineWidth = pr * 0.07;
    ctx.strokeStyle = 'rgba(255,215,190,0.5)';
    ctx.beginPath();
    ctx.ellipse(px, py, pr * 1.9, pr * 0.42, -0.28, Math.PI, G.TAU);
    ctx.stroke();
    const body = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
    body.addColorStop(0, '#ffd2a1');
    body.addColorStop(0.55, '#c25a7c');
    body.addColorStop(1, '#3a1f4a');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, G.TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px, py, pr * 1.9, pr * 0.42, -0.28, 0, Math.PI);
    ctx.stroke();
    // small moon
    ctx.fillStyle = '#d9d4ee';
    ctx.beginPath();
    ctx.arc(px - pr * 2.6, py + pr * 0.5, pr * 0.16, 0, G.TAU);
    ctx.fill();

    ridge(ctx, bg.far, cam, 0.12, w, h, '#2a1d4d');

    // city skyline
    const p = 0.3, zl = layerZ(cam, p), hy = layerHorizon(cam, p, h) + 20 * zl;
    for (const b of bg.city) {
      const sx = layerX(b.x, cam, p, w, zl), bw = b.w * zl;
      if (sx + bw < 0 || sx > w) continue;
      const top = hy - b.h * zl;
      ctx.fillStyle = '#1a1536';
      ctx.fillRect(sx, top, bw, h - top + 10);
      if (b.ant) {
        ctx.fillRect(sx + bw * 0.5 - 1, top - 22 * zl, 2, 22 * zl);
        if (Math.sin(G.realTime * 3 + b.x) > 0.3) {
          ctx.fillStyle = '#ff5a5a';
          ctx.fillRect(sx + bw * 0.5 - 2, top - 24 * zl, 4, 4);
        }
      }
      for (let i = 0; i < b.wins.length; i += 3) {
        ctx.fillStyle = b.wins[i + 2] ? 'rgba(120,235,255,0.75)' : 'rgba(255,210,110,0.7)';
        ctx.fillRect(sx + b.wins[i] * zl, top + b.wins[i + 1] * zl, 3 * zl, 4 * zl);
      }
    }

    const mh = ridge(ctx, bg.mid, cam, 0.55, w, h, '#141a33');
    const haze = ctx.createLinearGradient(0, mh - 260 * cam.z, 0, mh + 40);
    haze.addColorStop(0, 'rgba(240,120,120,0)');
    haze.addColorStop(1, 'rgba(240,120,120,0.16)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, mh - 260 * cam.z, w, h);
  };

  let groundGrad = null;
  T.drawGround = function (ctx, x0, x1) {
    const h = T.h, n = T.n;
    const i0 = Math.max(0, Math.floor(x0 / STEP) - 1);
    const i1 = Math.min(n - 1, Math.ceil(x1 / STEP) + 1);
    const pts = [];
    if (x0 < 0) pts.push(x0 - 200, h[0]);
    for (let i = i0; i <= i1; i++) pts.push(i * STEP, h[i]);
    if (x1 > i1 * STEP) pts.push(x1 + 200, h[i1]);

    if (!groundGrad) {
      groundGrad = ctx.createLinearGradient(0, T.BASE - 180, 0, T.BASE + 420);
      groundGrad.addColorStop(0, '#2b6e5b');
      groundGrad.addColorStop(0.3, '#1b4342');
      groundGrad.addColorStop(1, '#091318');
    }
    ctx.fillStyle = groundGrad;
    ctx.beginPath();
    ctx.moveTo(pts[0], 4000);
    for (let k = 0; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
    ctx.lineTo(pts[pts.length - 2], 4000);
    ctx.closePath();
    ctx.fill();

    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let k = 2; k < pts.length; k += 2) ctx.lineTo(pts[k], pts[k + 1]);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 26;
    ctx.stroke();
    ctx.strokeStyle = '#14392f';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = '#5ff0a8';
    ctx.lineWidth = 3;
    ctx.stroke();
  };

  T.drawDecor = function (ctx, x0, x1) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(95,240,168,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const d of T.decor) {
      if (d.k !== 'tuft' || d.x < x0 - 20 || d.x > x1 + 20) continue;
      const y = T.heightAt(d.x) + 1, s = d.s * 6;
      ctx.moveTo(d.x - s * 0.5, y); ctx.lineTo(d.x - s * 0.8, y - s);
      ctx.moveTo(d.x, y); ctx.lineTo(d.x + s * 0.1, y - s * 1.3);
      ctx.moveTo(d.x + s * 0.5, y); ctx.lineTo(d.x + s * 0.9, y - s * 0.9);
    }
    ctx.stroke();

    for (const d of T.decor) {
      if (d.x < x0 - 60 || d.x > x1 + 60) continue;
      const y = T.heightAt(d.x);
      if (d.k === 'rock') {
        ctx.fillStyle = '#22343a';
        ctx.strokeStyle = '#10181c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(d.x + d.shape[0], y + 3);
        for (let i = 0; i < d.shape.length; i += 2) ctx.lineTo(d.x + d.shape[i], y + 3 + d.shape[i + 1]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (d.k === 'pylon') {
        ctx.fillStyle = '#2d3442';
        ctx.fillRect(d.x - 2.5, y - 56, 5, 58);
        ctx.fillStyle = '#3c4557';
        ctx.fillRect(d.x - 7, y - 62, 14, 9);
        const on = Math.sin(G.realTime * 2.5 + d.ph) > 0;
        if (on) {
          ctx.globalCompositeOperation = 'lighter';
          const gl = ctx.createRadialGradient(d.x, y - 58, 0, d.x, y - 58, 26);
          gl.addColorStop(0, 'rgba(255,90,90,0.8)');
          gl.addColorStop(1, 'rgba(255,90,90,0)');
          ctx.fillStyle = gl;
          ctx.fillRect(d.x - 26, y - 84, 52, 52);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fillStyle = on ? '#ff8080' : '#5a2a2a';
        ctx.fillRect(d.x - 3, y - 61, 6, 6);
      }
    }

    // energy fences at world edges
    ctx.globalCompositeOperation = 'lighter';
    for (const ex of [0, G.world.W]) {
      if (ex < x0 - 40 || ex > x1 + 40) continue;
      const gy = T.heightAt(ex);
      const a = 0.25 + Math.sin(G.realTime * 4) * 0.08;
      const gr = ctx.createLinearGradient(0, gy - 500, 0, gy);
      gr.addColorStop(0, 'rgba(110,220,255,0)');
      gr.addColorStop(1, `rgba(110,220,255,${a})`);
      ctx.fillStyle = gr;
      ctx.fillRect(ex - 6, gy - 500, 12, 500);
    }
    ctx.globalCompositeOperation = 'source-over';
  };
})(window.WW);
