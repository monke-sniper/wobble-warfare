'use strict';
// Weapon definitions, firing, projectiles, hit detection, explosions, damage and death.
(function (G) {
  const R = G.ragdoll, I = R.IDX, F = G.fx;

  // speed in px/s; range in px; cd = seconds between trigger pulls
  G.WEAPONS = {
    rifle: { kind: 'gun', dmg: 12, cd: 1.1, burst: 3, gap: 0.09, speed: 1500, spread: 0.05, knock: 1.6, range: 430, len: 28, grip: 14, tracer: '#ffe27a', snd: 'rifle', recoil: 3 },
    shotgun: { kind: 'gun', dmg: 9, pellets: 8, cd: 1.25, speed: 1250, spread: 0.2, knock: 3.0, range: 190, len: 26, grip: 12, tracer: '#ffcf6b', snd: 'shotgun', recoil: 7, life: 0.3 },
    sniper: { kind: 'gun', dmg: 110, cd: 2.6, speed: 4200, spread: 0.006, knock: 9, range: 1150, len: 44, grip: 20, tracer: '#7ff6ff', snd: 'sniper', recoil: 9, rail: true, pierce: 2 },
    pistol: { kind: 'gun', dmg: 10, cd: 0.75, speed: 1300, spread: 0.06, knock: 1.2, range: 340, len: 11, grip: 2, tracer: '#c6ffd0', snd: 'pistol', recoil: 2 },
    minigun: { kind: 'gun', dmg: 10, cd: 0.05, speed: 1600, spread: 0.09, knock: 1.6, range: 540, len: 40, grip: 8, tracer: '#ffb347', snd: 'minigun', recoil: 1.2 },
    grenade: { kind: 'lob', dmg: 70, radius: 95, cd: 2.4, range: 520, len: 4, snd: 'throw', recoil: 3 },
    rocket: { kind: 'rocket', dmg: 100, radius: 125, cd: 3.0, speed: 720, grav: 0.06, range: 700, len: 30, grip: 4, snd: 'rocket', recoil: 9, spread: 0.03 },
    baton: { kind: 'melee', dmg: 30, cd: 1.0, reach: 40, knock: 7, swing: 0.32, len: 22, snd: 'bonk', cleave: 2 },
    blade: { kind: 'melee', dmg: 42, cd: 0.55, reach: 44, knock: 5.5, swing: 0.26, len: 34, snd: 'slash', dash: 4.5, cleave: 2 },
  };

  G.muzzle = (u) => {
    const h = u.pts[I.RHAND], s = u.def.size, a = u.wAng;
    return { x: h.x + Math.cos(a) * u.w.len * s, y: h.y + Math.sin(a) * u.w.len * s };
  };

  function recoil(u, r) {
    u.recoil = r;
    const a = u.wAng;
    G.phys.impulse(u.pts[I.RHAND], -Math.cos(a) * r * 0.35, -Math.sin(a) * r * 0.35);
    G.phys.impulse(u.pts[I.NECK], -Math.cos(a) * r * 0.1, 0);
  }

  // Pull the trigger once (bursts continue from Unit.update).
  G.fire = function (u) {
    const w = u.w;
    u.cool = w.cd * G.rand(0.9, 1.1);
    if (w.kind === 'melee') { startSwing(u); return; }
    if (w.kind === 'gun') {
      if (w.burst) { u.burstLeft = w.burst - 1; u.burstT = w.gap; }
      G.shootGun(u);
      return;
    }
    const m = G.muzzle(u);
    if (w.kind === 'lob') {
      const v = u.lobV || { x: Math.cos(u.aim) * 8, y: Math.sin(u.aim) * 8, N: 60 };
      G.projectiles.push({ k: 'grenade', x: m.x, y: m.y, vx: v.x, vy: v.y, team: u.team, src: u, life: v.N / 60 + 0.5, dmg: w.dmg, radius: w.radius, rot: 0 });
      recoil(u, w.recoil);
      G.audio.play('throw', m.x);
    } else if (w.kind === 'rocket') {
      const a = u.aim + G.rand(-w.spread, w.spread);
      const sp = w.speed / 60;
      G.projectiles.push({ k: 'rocket', x: m.x, y: m.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, team: u.team, src: u, life: 3, dmg: w.dmg, radius: w.radius, grav: w.grav, color: u.pal.team });
      recoil(u, w.recoil);
      const h = u.pts[I.RHAND];
      F.smoke(h.x - Math.cos(a) * 22, h.y - Math.sin(a) * 22, 6, 9);
      F.light(m.x, m.y, 50, '#ffb060', 0.12);
      G.audio.play('rocket', m.x);
    }
  };

  G.shootGun = function (u) {
    const w = u.w, s = u.def.size, a = u.wAng;
    const m = G.muzzle(u);
    const n = w.pellets || 1;
    for (let i = 0; i < n; i++) {
      const aa = a + (Math.random() + Math.random() - 1) * w.spread;
      const sp = (w.speed / 60) * (n > 1 ? G.rand(0.85, 1.1) : 1);
      G.projectiles.push({
        k: w.rail ? 'rail' : 'bullet', x: m.x, y: m.y, sx: m.x, sy: m.y,
        vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, dmg: w.dmg, knock: w.knock, team: u.team, src: u,
        color: w.tracer, life: w.life || 1.4, pierce: w.pierce || 1, hit: null, w: Math.max(1, s * 0.8),
      });
    }
    recoil(u, w.recoil);
    u.muzzleT = 0.05;
    u.spin = (u.spin || 0) + 0.9;
    F.light(m.x, m.y, 34 * s, w.tracer, 0.07);
    F.sparks(m.x, m.y, 2, a, 0.6, 300, w.tracer);
    if (!w.rail && Math.random() < (n > 1 ? 1 : 0.7)) F.casing(m.x - Math.cos(a) * w.len * s * 0.6, m.y - Math.sin(a) * w.len * s * 0.6, u.facing);
    if (w.rail) F.light(m.x, m.y, 70, '#7ff6ff', 0.15);
    G.audio.play(w.snd, m.x);
  };

  function startSwing(u) {
    u.swing = 0;
    u.swingHit = false;
    G.audio.play('swoosh', u.pts[I.NECK].x, 0.6);
    if (u.w.dash) {
      const f = u.facing, d = u.w.dash;
      for (const q of u.pts) G.phys.impulse(q, f * d * 0.6, -0.8);
      G.phys.impulse(u.pts[I.PELVIS], f * d, 0);
    }
  }

  G.meleeHit = function (u) {
    const w = u.w, s = u.def.size, f = u.facing, nk = u.pts[I.NECK];
    let hits = 0;
    for (const e of G.units) {
      if (!e.alive || e.team === u.team) continue;
      const c = e.chest();
      const dx = (c.x - nk.x) * f, dy = c.y - nk.y;
      if (dx < -10 * s || dx > w.reach * s + e.def.size * 10 || Math.abs(dy) > 42 * Math.max(s, e.def.size)) continue;
      let dmg = w.dmg, knock = w.knock;
      if (e.def.shield && e.facing === -f && e.balance > 0.3) {
        dmg *= 0.35; knock *= 0.6;
        const sg = R.shieldSeg(e);
        F.sparks(sg[0], c.y, 8, f > 0 ? Math.PI : 0, 1.4, 380, '#bfe9ff');
        G.audio.play('clang', c.x, 0.8);
      }
      G.damageUnit(e, dmg, { x: c.x, y: c.y, dx: f, dy: -0.3, knock, pt: I.NECK, src: u });
      for (const q of e.pts) G.phys.impulse(q, f * knock * 0.45, -knock * 0.22);
      e.stagger += (knock * 0.05) / (e.def.mass || 1);
      hits++;
      if (hits >= (w.cleave || 1)) break;
    }
    if (hits) G.audio.play(w.snd, nk.x);
  };

  function segSeg(ax, ay, bx, by, cx, cy, dx, dy) {
    const rX = bx - ax, rY = by - ay, sX = dx - cx, sY = dy - cy;
    const den = rX * sY - rY * sX;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((cx - ax) * sY - (cy - ay) * sX) / den;
    const v = ((cx - ax) * rY - (cy - ay) * rX) / den;
    return t >= 0 && t <= 1 && v >= 0 && v <= 1 ? t : null;
  }

  // First enemy body part (or riot shield) touched by segment A->B.
  G.raycast = function (ax, ay, bx, by, team, skip) {
    let best = null, bestT = 2;
    const minX = Math.min(ax, bx), maxX = Math.max(ax, bx);
    for (const u of G.units) {
      if (!u.alive || u.team === team || (skip && skip.includes(u))) continue;
      const pts = u.pts, pel = pts[I.PELVIS], s = u.def.size;
      if (pel.x < minX - 70 * s || pel.x > maxX + 70 * s) continue;
      const shieldUp = u.def.shield && u.balance > 0.3;
      if (shieldUp) {
        const sg = R.shieldSeg(u);
        const t = segSeg(ax, ay, bx, by, sg[0], sg[1], sg[2], sg[3]);
        if (t !== null && t < bestT) { bestT = t; best = { u, shield: true, x: ax + (bx - ax) * t, y: ay + (by - ay) * t }; }
      }
      for (let i = 0; i <= pts.length; i++) {
        let qx, qy, rad;
        if (i === pts.length) { qx = (pts[I.NECK].x + pel.x) / 2; qy = (pts[I.NECK].y + pel.y) / 2; rad = u.hitR * 1.25; }
        else if (shieldUp && (i === I.LHAND || i === I.LELB)) continue;
        else { qx = pts[i].x; qy = pts[i].y; rad = i === I.HEAD ? u.L.head + 1.5 : u.hitR; }
        const t = G.segT(ax, ay, bx, by, qx, qy);
        if (t >= bestT) continue;
        const cx = ax + (bx - ax) * t, cy = ay + (by - ay) * t;
        const ddx = cx - qx, ddy = cy - qy;
        if (ddx * ddx + ddy * ddy < rad * rad) {
          bestT = t;
          best = { u, shield: false, pt: i === pts.length ? I.NECK : i, head: i === I.HEAD, x: cx, y: cy };
        }
      }
    }
    return best;
  };

  function endRail(p, x, y) {
    if (p.k !== 'rail') return;
    F.beam(p.sx, p.sy, x, y, '#7ff6ff', 2.5, 0.35);
    F.light(x, y, 40, '#7ff6ff', 0.15);
  }

  function stepProj(p) {
    p.life -= G.DT;
    if (p.life <= 0) {
      if (p.k === 'grenade') { G.explode(p.x, p.y, p.radius, p.dmg, p.team, p.src); }
      else endRail(p, p.x, p.y);
      return false;
    }
    const ox = p.x, oy = p.y;
    if (p.k === 'grenade') { p.vy += G.GRAV; p.rot += p.vx * 0.15; }
    else if (p.k === 'rocket') {
      p.vy += G.GRAV * p.grav;
      if (Math.random() < 0.8) {
        const a = Math.atan2(p.vy, p.vx);
        F.smoke(p.x - Math.cos(a) * 10, p.y - Math.sin(a) * 10, 1, 5);
      }
    } else p.vy += G.GRAV * 0.04;
    p.x += p.vx; p.y += p.vy;

    const hit = G.raycast(ox, oy, p.x, p.y, p.team, p.hit);
    if (hit) {
      if (p.k === 'rocket') { G.explode(hit.x, hit.y, p.radius, p.dmg, p.team, p.src); return false; }
      if (p.k === 'grenade') {
        if (hit.shield) { p.x = ox; p.y = oy; p.vx *= -0.4; p.vy *= 0.5; G.audio.play('tink', hit.x, 0.6); return true; }
        G.explode(hit.x, hit.y, p.radius, p.dmg, p.team, p.src);
        return false;
      }
      if (hit.shield) {
        F.sparks(hit.x, hit.y, 6, Math.atan2(-p.vy, -p.vx), 1.3, 350, '#bfe9ff');
        G.audio.play('clang', hit.x, 0.45);
        G.phys.impulse(hit.u.pts[I.LHAND], p.vx * 0.03 * p.knock, 0);
        hit.u.stagger += p.knock * 0.008;
        endRail(p, hit.x, hit.y);
        return false;
      }
      const t = hit.u;
      if (t.def.deflect && p.k === 'bullet' && t.balance > 0.5 && Math.sign(p.vx) === -t.facing && Math.random() < t.def.deflect) {
        // Cyber ninja swats the bullet away with its blade.
        F.sparks(hit.x, hit.y, 7, Math.atan2(-p.vy, -p.vx), 1.4, 420, t.pal.glow);
        G.audio.play('tink', hit.x, 0.6);
        return false;
      }
      G.damageUnit(hit.u, p.dmg * (hit.head ? 1.6 : 1), { x: hit.x, y: hit.y, dx: p.vx, dy: p.vy, knock: p.knock, pt: hit.pt, src: p.src, head: hit.head });
      p.pierce--;
      (p.hit || (p.hit = [])).push(hit.u);
      if (p.pierce <= 0) { endRail(p, hit.x, hit.y); return false; }
    }

    const gy = G.terrain.heightAt(p.x);
    if (p.y >= gy) {
      if (p.k === 'rocket') { G.explode(p.x, gy, p.radius, p.dmg, p.team, p.src); return false; }
      if (p.k === 'grenade') {
        p.y = gy - 1;
        if (p.vy > 2) G.audio.play('tink', p.x, 0.35);
        p.vy *= -0.38; p.vx *= 0.55;
        return true;
      }
      F.dust(p.x, gy - 2, 1, 4);
      F.sparks(p.x, gy - 1, 2, -Math.PI / 2, 1.6, 180, '#d8c8a0');
      endRail(p, p.x, gy);
      return false;
    }
    const W = G.world.W;
    if (p.x < -300 || p.x > W + 300 || p.y < -3000) { endRail(p, p.x, p.y); return false; }
    return true;
  }

  G.updateProjectiles = function () {
    const arr = G.projectiles;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (i >= arr.length) continue; // explosions can't remove items, but stay defensive
      if (!stepProj(arr[i])) { arr[i] = arr[arr.length - 1]; arr.pop(); }
    }
  };

  G.drawProjectiles = function (ctx) {
    ctx.lineCap = 'round';
    for (const p of G.projectiles) {
      if (p.k === 'grenade') {
        ctx.fillStyle = '#3f5f2e';
        ctx.strokeStyle = '#10131c';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.2, 0, G.TAU); ctx.fill(); ctx.stroke();
        if (Math.sin(p.life * 30) > 0) { ctx.fillStyle = '#ff4040'; ctx.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4); }
      } else if (p.k === 'rocket') {
        const a = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(a);
        ctx.fillStyle = '#d9dde3';
        ctx.strokeStyle = '#10131c';
        ctx.lineWidth = 1.2;
        ctx.fillRect(-11, -2.8, 15, 5.6); ctx.strokeRect(-11, -2.8, 15, 5.6);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.moveTo(4, -2.8); ctx.lineTo(10, 0); ctx.lineTo(4, 2.8); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = Math.random() < 0.5 ? '#ffd166' : '#ff8a3c';
        ctx.beginPath(); ctx.arc(-13, 0, G.rand(3, 5.5), 0, G.TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const p of G.projectiles) {
      if (p.k === 'bullet') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 * p.w;
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else if (p.k === 'rail') {
        ctx.strokeStyle = '#7ff6ff';
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 8;
        ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2.2;
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  G.explode = function (x, y, radius, dmg, team, src) {
    const R2 = radius * 1.8;
    for (const u of G.units) {
      const c = u.chest();
      const d = Math.hypot(c.x - x, c.y - y);
      if (d > R2) continue;
      for (const q of u.pts) {
        const dx = q.x - x, dy = q.y - y;
        const dd = Math.hypot(dx, dy) || 1;
        const f = Math.max(0, 1 - dd / R2) * radius * 0.12;
        G.phys.impulse(q, (dx / dd) * f, (dy / dd) * f - f * 0.7);
      }
      if (u.alive && d < radius) {
        const fall = 1 - d / radius;
        const ff = u.team === team ? 0.35 : 1;
        u.stagger += (1.6 * fall) / (u.def.mass || 1) + 0.3;
        G.damageUnit(u, dmg * (0.35 + 0.65 * fall) * ff, { x: c.x, y: c.y, dx: c.x - x, dy: c.y - y - 10, knock: 0, pt: null, src });
      }
    }
    for (const pr of G.props) {
      for (const q of [pr.a, pr.b]) {
        const dx = q.x - x, dy = q.y - y, dd = Math.hypot(dx, dy) || 1;
        if (dd > R2) continue;
        const f = (1 - dd / R2) * radius * 0.1;
        G.phys.impulse(q, (dx / dd) * f, (dy / dd) * f - f * 0.8);
      }
    }
    G.terrain.crater(x, radius * 0.55, radius * 0.13);
    F.light(x, y, radius * 1.8, '#ffb060', 0.35);
    F.ring(x, y, radius * 1.25, '#ffe2b0', 0.4);
    F.fire(x, y, 18, radius * 0.3);
    F.smoke(x, y - 10, 12, radius * 0.28);
    F.debris(x, y - 4, 14, ['#2f6e57', '#1d3b33', '#4a3b2c', '#5ff0a8'], 650);
    F.sparks(x, y, 18, -Math.PI / 2, Math.PI * 1.6, 750, '#ffcf6b');
    const cam = G.cam;
    const dc = Math.abs(x - cam.x) * cam.z;
    cam.addShake(radius * 0.12 * G.clamp(1.2 - dc / 1200, 0.2, 1));
    G.audio.play('boom', x, Math.min(1, radius / 110));
  };

  G.damageUnit = function (u, amt, o) {
    if (!u.alive) return;
    u.hp -= amt;
    u.hitFlash = 0.08;
    const len = Math.hypot(o.dx || 0, o.dy || 0) || 1;
    const nx = (o.dx || 0) / len, ny = (o.dy || 0) / len;
    if (o.pt != null && o.knock) {
      G.phys.impulse(u.pts[o.pt], nx * o.knock, ny * o.knock - o.knock * 0.2);
      G.phys.impulse(u.pts[I.NECK], nx * o.knock * 0.35, 0);
    }
    u.stagger += ((o.knock || 0) * 0.03) / (u.def.mass || 1);
    F.sparks(o.x, o.y, 3, Math.atan2(ny, nx), 1.0, 260, '#ffe6a8');
    F.goo(o.x, o.y, amt > 40 ? 6 : 2, nx * 120, ny * 120 - 80);
    if (u.hp <= 0) G.killUnit(u, o);
    else if (Math.random() < 0.25) G.audio.play('hit', o.x, 0.5);
  };

  const QUIPS = ['OOF', 'ARGH!', 'NOOO', 'WHY?!', 'BONK', 'OW', 'YEET', 'MOM?', 'ugh', 'RIP', '*wobble*', 'not again', 'ouch', 'I regret', 'brb'];

  G.killUnit = function (u, o) {
    u.alive = false;
    u.hp = 0;
    u.balance = 0;
    u.healing = null;
    u.swing = -1;
    u.burstLeft = 0;
    u.deathTime = G.time;
    const hd = u.pts[I.HEAD];
    for (const q of u.pts) G.phys.impulse(q, Math.sign(o.dx || 0) * 1.2, -1.2);
    dropGear(u);
    if (o.head) F.text(hd.x, hd.y - 16, 'HEADSHOT!', '#ffdf5e', 16);
    else if (Math.random() < 0.7) F.text(hd.x, hd.y - 14, G.pick(QUIPS), '#ffffff', 13);
    G.audio.play('oof', hd.x, 0.9);
    if (o.src && o.src !== u) o.src.kills++;
    if (u.def.style === 'mech') {
      const c = u.chest();
      G.explode(c.x, c.y, 150, 70, -1, u);
      F.text(c.x, c.y - 70, 'KABOOM', '#ffb347', 22);
    }
  };

  function dropGear(u) {
    const s = u.def.size, h = u.pts[I.RHAND];
    const vx = h.x - h.px, vy = h.y - h.py;
    if (u.w.kind !== 'lob') {
      const len = u.w.len * s;
      const a = u.wAng;
      G.props.push(new G.phys.Prop('weapon', h.x, h.y, h.x + Math.cos(a) * len, h.y + Math.sin(a) * len,
        vx + G.rand(-1, 1), vy - G.rand(1, 3), { weapon: u.def.weapon, size: s, pal: u.palDead }));
    }
    if (u.def.shield) {
      const sg = R.shieldSeg(u);
      const lh = u.pts[I.LHAND];
      G.props.push(new G.phys.Prop('shield', sg[0], sg[1], sg[2], sg[3], lh.x - lh.px, lh.y - lh.py - 1,
        { size: s, color: u.palDead.team }));
    }
  }

  G.drawProps = function (ctx) {
    for (const pr of G.props) {
      if (pr.kind === 'shield') R.drawShieldProp(ctx, pr);
      else R.drawWeapon(ctx, pr.weapon, pr.a.x, pr.a.y, Math.atan2(pr.b.y - pr.a.y, pr.b.x - pr.a.x), pr.size, pr.pal, null);
    }
  };
})(window.WW);
