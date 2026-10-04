'use strict';
// Particles, stains, floating text, shockwave rings, beams and light flashes.
(function (G) {
  const F = (G.fx = {});
  const MAX = 1600;
  let parts = [], texts = [], rings = [], beams = [], stains = [], lights = [];

  F.clear = () => { parts = []; texts = []; rings = []; beams = []; stains = []; lights = []; };
  F.count = () => parts.length;

  function add(t, x, y, vx, vy, life, size, color, extra) {
    if (parts.length >= MAX) return null;
    const p = { t, x, y, vx, vy, life, max: life, size, color, rot: Math.random() * 6, vr: 0, g: 0, drag: 0, add: false, bounce: false, stain: false };
    if (extra) Object.assign(p, extra);
    parts.push(p);
    return p;
  }

  F.sparks = (x, y, n, ang, spread, speed, color = '#ffd27a') => {
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - 0.5) * spread;
      const sp = speed * G.rand(0.35, 1);
      add('spark', x, y, Math.cos(a) * sp, Math.sin(a) * sp, G.rand(0.12, 0.38), G.rand(1, 2.2), color, { g: 900, drag: 2, add: true });
    }
  };
  F.smoke = (x, y, n, size = 12, color = '120,118,140') => {
    for (let i = 0; i < n; i++) {
      add('smoke', x + G.rand(-size, size) * 0.5, y + G.rand(-size, size) * 0.5, G.rand(-40, 40), G.rand(-70, -10),
        G.rand(0.8, 1.8), size * G.rand(0.7, 1.3), color, { drag: 1.6, g: -25 });
    }
  };
  F.dust = (x, y, n, size = 6) => F.smoke(x, y, n, size, '150,140,125');
  F.fire = (x, y, n, size) => {
    const cols = ['#fff2a8', '#ffcc55', '#ff8a3c', '#ff5a2a'];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * G.TAU, sp = G.rand(30, 260);
      add('fire', x, y, Math.cos(a) * sp, Math.sin(a) * sp - 60, G.rand(0.25, 0.6), size * G.rand(0.5, 1.1), G.pick(cols), { drag: 3.5, g: -220, add: true });
    }
  };
  F.debris = (x, y, n, colors, speed) => {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + G.rand(-1.2, 1.2), sp = speed * G.rand(0.3, 1);
      add('chunk', x, y, Math.cos(a) * sp, Math.sin(a) * sp, G.rand(1.2, 2.4), G.rand(2.5, 6), G.pick(colors), { g: 1500, drag: 0.4, vr: G.rand(-14, 14), bounce: true });
    }
  };
  F.casing = (x, y, f) => {
    add('casing', x, y, -f * G.rand(50, 140), G.rand(-230, -120), 1.3, 2.2, '#e8b04a', { g: 1500, vr: G.rand(-25, 25), bounce: true });
  };
  F.goo = (x, y, n, vx, vy, color = '#16121c') => {
    for (let i = 0; i < n; i++) {
      add('goo', x, y, vx + G.rand(-90, 90), vy + G.rand(-120, 30), 2, G.rand(1.5, 3), color, { g: 1400, drag: 0.3, stain: true });
    }
  };
  F.sparkle = (x, y, color = '#7dffb0') => {
    add('sparkle', x + G.rand(-8, 8), y + G.rand(-8, 8), G.rand(-15, 15), G.rand(-60, -25), G.rand(0.4, 0.8), G.rand(1.5, 3), color, { add: true });
  };
  F.text = (x, y, str, color = '#fff', size = 13) => texts.push({ x, y, str, color, size, life: 1.2, max: 1.2 });
  F.ring = (x, y, r, color = '#ffd9a0', life = 0.4) => rings.push({ x, y, r, color, life, max: life });
  F.beam = (x1, y1, x2, y2, color, width, life) => beams.push({ x1, y1, x2, y2, color, width, life, max: life });
  F.light = (x, y, r, color, life) => { if (lights.length < 60) lights.push({ x, y, r, color, life, max: life }); };

  function addStain(x, size, color) {
    if (stains.length > 260) stains.shift();
    stains.push({ x, r: size * G.rand(1.6, 2.6), color, life: 22 });
  }

  function decay(arr, dt) {
    for (let i = arr.length - 1; i >= 0; i--) {
      arr[i].life -= dt;
      if (arr[i].life <= 0) { arr[i] = arr[arr.length - 1]; arr.pop(); }
    }
  }

  F.update = function (dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      p.vy += p.g * dt;
      if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.bounce || p.stain) {
        const gy = G.terrain.heightAt(p.x);
        if (p.y > gy) {
          if (p.stain) { addStain(p.x, p.size, p.color); parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
          p.y = gy; p.vy *= -0.35; p.vx *= 0.6; p.vr *= 0.6;
        }
      }
    }
    for (const t of texts) t.y -= 38 * dt;
    decay(texts, dt); decay(rings, dt); decay(beams, dt); decay(lights, dt);
    for (const s of stains) s.life -= dt;
    while (stains.length && stains[0].life <= 0) stains.shift();
  };

  F.drawStains = function (ctx) {
    for (const s of stains) {
      ctx.globalAlpha = Math.min(1, s.life / 5) * 0.75;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.ellipse(s.x, G.terrain.heightAt(s.x) + 1, s.r, s.r * 0.35, 0, 0, G.TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  F.draw = function (ctx) {
    // normal-blend particles
    for (const p of parts) {
      if (p.add) continue;
      const a = p.life / p.max;
      if (p.t === 'smoke') {
        ctx.globalAlpha = a * 0.42;
        ctx.fillStyle = 'rgb(' + p.color + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.7 - a), 0, G.TAU);
        ctx.fill();
      } else if (p.t === 'goo') {
        ctx.globalAlpha = 1;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, G.TAU);
        ctx.fill();
      } else {
        ctx.globalAlpha = Math.min(1, a * 3);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.t === 'casing') ctx.fillRect(-p.size, -p.size * 0.45, p.size * 2, p.size * 0.9);
        else ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;

    // additive layer
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const a = l.life / l.max;
      const r = l.r * (0.6 + 0.4 * a);
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, r);
      g.addColorStop(0, l.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a * 0.55;
      ctx.fillStyle = g;
      ctx.fillRect(l.x - r, l.y - r, r * 2, r * 2);
    }
    ctx.lineCap = 'round';
    for (const p of parts) {
      if (!p.add) continue;
      const a = p.life / p.max;
      ctx.globalAlpha = a;
      if (p.t === 'spark') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.t === 'fire' ? 0.4 + 0.6 * a : 1), 0, G.TAU);
        ctx.fill();
      }
    }
    for (const r of rings) {
      const a = r.life / r.max, t = 1 - a;
      ctx.globalAlpha = a * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2 + 6 * a;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r * (1 - Math.pow(1 - t, 3)), 0, G.TAU);
      ctx.stroke();
    }
    for (const b of beams) {
      const a = b.life / b.max;
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = a * 0.3;
      ctx.lineWidth = b.width * 4;
      ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
      ctx.globalAlpha = a;
      ctx.lineWidth = b.width * a;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  F.drawTexts = function (ctx, zoom) {
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const t of texts) {
      const a = t.life / t.max, age = t.max - t.life;
      const pop = age < 0.12 ? 1 + (0.12 - age) * 4 : 1;
      const size = (t.size * pop) / Math.max(0.6, zoom);
      ctx.globalAlpha = Math.min(1, a * 2.5);
      ctx.font = `800 ${size.toFixed(1)}px Rubik, system-ui, sans-serif`;
      ctx.lineWidth = size * 0.28;
      ctx.strokeStyle = '#0b0d16';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  };
})(window.WW);
