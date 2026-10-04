'use strict';
// Pan / zoom / follow / auto-frame camera with screen shake.
(function (G) {
  const I = G.ragdoll.IDX;
  const C = (G.cam = {
    x: 1000, y: 450, z: 0.7, tx: 1000, ty: 450, tz: 0.7,
    shake: 0, shx: 0, shy: 0, follow: null, auto: false, w: 1, h: 1, keys: {},
  });

  C.resize = (w, h) => { C.w = w; C.h = h; };

  C.fit = function (instant) {
    const W = G.world.W;
    C.tz = G.clamp(C.w / (W + 160), 0.3, 1.1);
    C.tx = W / 2;
    // Too narrow to show the whole field (phones): frame the blue zone and the front line instead.
    if (C.w / (W + 160) < 0.45) {
      C.tz = G.clamp(C.w / 950, 0.3, 1.1);
      C.tx = G.world.zones[0][1] - 950 / 2 + 120;
    }
    let avg = 0, n = 0;
    for (let x = 0; x <= W; x += 100) { avg += G.terrain.heightAt(x); n++; }
    avg /= n;
    C.ty = avg - (C.h * 0.2) / C.tz;
    C.follow = null;
    if (instant) { C.x = C.tx; C.y = C.ty; C.z = C.tz; }
  };

  C.zoomAt = function (sx, sy, factor) {
    const nz = G.clamp(C.tz * factor, 0.25, 2.6);
    const wx = (sx - C.w / 2) / C.tz + C.tx, wy = (sy - C.h / 2) / C.tz + C.ty;
    C.tz = nz;
    if (!C.follow) {
      C.tx = wx - (sx - C.w / 2) / nz;
      C.ty = wy - (sy - C.h / 2) / nz;
    }
  };

  C.addShake = (a) => { C.shake = Math.min(26, C.shake + a); };

  function autoFrame() {
    let minX = Infinity, maxX = -Infinity, sy = 0, n = 0;
    for (const u of G.units) {
      if (!u.alive) continue;
      const p = u.pts[I.PELVIS];
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      sy += p.y; n++;
    }
    if (!n) return;
    C.tx = (minX + maxX) / 2;
    C.tz = G.clamp(C.w / (maxX - minX + 520), 0.32, 1.15);
    C.ty = sy / n - (C.h * 0.12) / C.tz;
  }

  C.update = function (dt) {
    const k = C.keys, sp = (800 / C.z) * dt;
    let manual = false;
    if (k.a || k.arrowleft) { C.tx -= sp; manual = true; }
    if (k.d || k.arrowright) { C.tx += sp; manual = true; }
    if (k.w || k.arrowup) { C.ty -= sp; manual = true; }
    if (k.s || k.arrowdown) { C.ty += sp; manual = true; }
    if (manual) { C.follow = null; C.auto = false; }

    if (C.follow) {
      if (!C.follow.alive && G.time - C.follow.deathTime > 2.5) C.follow = null;
      else { const c = C.follow.chest(); C.tx = c.x; C.ty = c.y - 30; }
    } else if (C.auto) autoFrame();

    const W = G.world.W;
    C.tx = G.clamp(C.tx, -300, W + 300);
    C.ty = G.clamp(C.ty, -500, 1100);
    const kk = Math.min(1, dt * (C.follow ? 6 : C.auto ? 2.5 : 12));
    C.x += (C.tx - C.x) * kk;
    C.y += (C.ty - C.y) * kk;
    C.z += (C.tz - C.z) * Math.min(1, dt * (C.auto ? 2.5 : 10));

    C.shake = Math.max(0, C.shake - dt * 40);
    C.shx = (Math.random() - 0.5) * 2 * C.shake;
    C.shy = (Math.random() - 0.5) * 2 * C.shake;
  };

  C.apply = (ctx, dpr) => {
    ctx.setTransform(dpr * C.z, 0, 0, dpr * C.z, dpr * (C.w / 2 - C.x * C.z + C.shx), dpr * (C.h / 2 - C.y * C.z + C.shy));
  };
  C.toWorld = (sx, sy) => ({ x: (sx - C.w / 2) / C.z + C.x, y: (sy - C.h / 2) / C.z + C.y });
})(window.WW);
