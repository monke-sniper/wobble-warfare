'use strict';
// Unit brains: pick a target, advance / hold / kite, aim, fire. Medics heal.
(function (G) {
  const I = G.ragdoll.IDX;
  const AI = (G.ai = {});

  function pickTarget(u) {
    const nk = u.pts[I.NECK];
    let best = null, bs = Infinity;
    for (const e of G.units) {
      if (!e.alive || e.team === u.team) continue;
      const c = e.pts[I.PELVIS];
      let d = Math.abs(c.x - nk.x) + Math.abs(c.y - nk.y) * 0.5;
      if (u.def.prefer === 'value' && d < u.w.range) d -= e.def.cost * 0.6;
      if (u.def.prefer === 'big') d -= e.def.cost * 0.15;
      d *= G.rand(0.92, 1.08);
      if (d < bs) { bs = d; best = e; }
    }
    return best;
  }

  function findInjured(u) {
    const nk = u.pts[I.NECK];
    let best = null, bd = 650;
    for (const a of G.units) {
      // Medics don't heal each other, otherwise two medic-only armies would never finish.
      if (a === u || !a.alive || a.team !== u.team || a.def.ai === 'medic' || a.hp >= a.maxHp * 0.92) continue;
      const d = Math.abs(a.pts[I.PELVIS].x - nk.x);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  // Launch velocity (px/step) to land at (tx, ty), plus flight time in steps.
  function lobVel(ox, oy, tx, ty) {
    const N = G.clamp(Math.abs(tx - ox) / 7.5, 30, 85);
    return { x: (tx - ox) / N, y: (ty - oy - 0.5 * G.GRAV * N * N) / N, N };
  }

  AI.think = function (u, dt) {
    if (u.balance < 0.4) { u.moveX = 0; return; }
    if (u.def.ai === 'medic' && medic(u, dt)) return;
    u.healing = null;
    u.retarget -= dt;
    if (!u.target || !u.target.alive || u.retarget <= 0) {
      u.target = pickTarget(u);
      u.retarget = G.rand(0.5, 0.9);
    }
    if (!u.target) { u.moveX = 0; return; }
    engage(u, u.target, dt);
  };

  function engage(u, t, dt) {
    const w = u.w, d = u.def, s = d.size;
    const nk = u.pts[I.NECK];
    const c = t.chest();
    const dx = c.x - nk.x, dy = c.y - nk.y;
    const hx = Math.abs(dx), dist = Math.hypot(dx, dy);

    let desired;
    if (w.kind === 'lob') {
      const h = u.pts[I.RHAND], tp = t.pts[I.PELVIS];
      const tx = tp.x + (tp.x - tp.px) * 40 + G.rand(-22, 22);
      u.lobV = lobVel(h.x, h.y, tx, G.terrain.heightAt(tx) - 8);
      desired = Math.atan2(u.lobV.y, u.lobV.x);
    } else if (w.kind === 'rocket') {
      const N = dist / (w.speed / 60);
      desired = Math.atan2(dy - 0.5 * G.GRAV * w.grav * N * N, dx);
    } else desired = Math.atan2(dy, dx);
    u.aim = G.approachAngle(u.aim, desired, (d.turn || 8) * dt);

    if (w.kind === 'melee') {
      const reach = w.reach * s + t.def.size * 8;
      u.moveX = hx > reach * 0.7 ? Math.sign(dx) : 0;
      if (u.cool <= 0 && hx < reach && Math.abs(dy) < 45 * Math.max(s, t.def.size)) G.fire(u);
      return;
    }

    const range = w.range * u.rangeMul;
    if (hx > range) u.moveX = Math.sign(dx);
    else if (d.ai === 'kite' && hx < w.range * 0.35) u.moveX = -Math.sign(dx);
    else u.moveX = 0;
    if (u.cool <= 0 && !u.burstLeft && dist < w.range * 1.05 && Math.abs(G.angDiff(u.aim, desired)) < 0.2) G.fire(u);
  }

  function medic(u, dt) {
    u.healT = (u.healT || 0) - dt;
    if (u.healT <= 0 || !u.heal || !u.heal.alive || u.heal.hp >= u.heal.maxHp) {
      u.heal = findInjured(u);
      u.healT = 0.6;
    }
    const h = u.heal;
    if (!h) { u.healing = null; return false; }
    const nk = u.pts[I.NECK], c = h.chest();
    const dx = c.x - nk.x, dy = c.y - nk.y, dist = Math.hypot(dx, dy);
    u.aim = G.approachAngle(u.aim, Math.atan2(dy, dx), 10 * dt);
    u.moveX = Math.abs(dx) > 80 ? Math.sign(dx) : 0;
    if (dist < 150) {
      h.hp = Math.min(h.maxHp, h.hp + u.def.heal * dt);
      u.healing = h;
      if (Math.random() < dt * 8) G.fx.sparkle(c.x, c.y);
      if (Math.random() < dt * 1.5) G.audio.play('heal', c.x, 0.35);
    } else u.healing = null;
    return true;
  }
})(window.WW);
