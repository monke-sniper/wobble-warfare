'use strict';
// Stick-figure ragdoll: skeleton, balance/walk controller, and drawing.
(function (G) {
  const R = (G.ragdoll = {});
  const HEAD = 0, NECK = 1, PELVIS = 2, LELB = 3, LHAND = 4, RELB = 5, RHAND = 6, LKNEE = 7, LFOOT = 8, RKNEE = 9, RFOOT = 10;
  R.IDX = { HEAD, NECK, PELVIS, LELB, LHAND, RELB, RHAND, LKNEE, LFOOT, RKNEE, RFOOT };
  const OUT = '#10131c';

  R.build = function (u, x, gy) {
    const s = u.def.size, m = u.def.mass || 1, f = u.facing;
    const mech = u.def.style === 'mech';
    const L = (u.L = {
      head: (mech ? 6.5 : 8.5) * s, neck: (mech ? 10 : 13) * s, torso: (mech ? 22 : 25) * s,
      upper: 12 * s, fore: 12 * s, thigh: 15 * s, shin: 15 * s,
    });
    const hipY = gy - (L.thigh + L.shin) * 0.92;
    const neckY = hipY - L.torso;
    const P = G.phys.Point;
    const defs = [
      [x + f * 1.5 * s, neckY - L.neck, L.head, 0.7],
      [x, neckY, 4 * s, 1.3],
      [x, hipY, 5 * s, 1.5],
      [x + f * 3 * s, neckY + L.upper * 0.8, 3 * s, 0.6],
      [x + f * 18 * s, neckY + 6 * s, 3 * s, 0.5],
      [x + f * 2 * s, neckY + L.upper * 0.8, 3 * s, 0.6],
      [x + f * 12 * s, neckY + 5 * s, 3 * s, 0.5],
      [x - 2 * s, hipY + L.thigh * 0.9, 3.5 * s, 0.9],
      [x - 4 * s, gy - 3.5 * s, 3.5 * s, 0.9],
      [x + 4 * s, hipY + L.thigh * 0.9, 3.5 * s, 0.9],
      [x + 4 * s, gy - 3.5 * s, 3.5 * s, 0.9],
    ];
    const pts = (u.pts = defs.map((d) => new P(d[0], d[1], d[2], d[3] * m)));
    const link = (a, b, len, k = 1) => ({ a: pts[a], b: pts[b], len, k });
    u.cons = [
      link(HEAD, NECK, L.neck), link(NECK, PELVIS, L.torso),
      link(NECK, LELB, L.upper), link(LELB, LHAND, L.fore),
      link(NECK, RELB, L.upper), link(RELB, RHAND, L.fore),
      link(PELVIS, LKNEE, L.thigh), link(LKNEE, LFOOT, L.shin),
      link(PELVIS, RKNEE, L.thigh), link(RKNEE, RFOOT, L.shin),
      link(HEAD, PELVIS, L.neck + L.torso, 0.25),
    ];
    u.hitR = 6 * s;
  };

  function pull(p, tx, ty, k) { p.x += (tx - p.x) * k; p.y += (ty - p.y) * k; }

  // Active balance: keeps a living unit upright, walks its legs and poses its arms.
  R.control = function (u) {
    const p = u.pts, L = u.L, s = u.def.size, T = G.terrain;
    const b = u.balance * u.balance;
    const pel = p[PELVIS], nk = p[NECK], hd = p[HEAD];
    const f = Math.cos(u.aim) >= 0 ? 1 : -1;
    u.facing = f;

    // Pose pulls must not push the whole body sideways; remember the horizontal centre of mass.
    let sx0 = 0, sm = 0, svx = 0;
    for (const q of p) { const m = 1 / q.im; sx0 += q.x * m; svx += (q.x - q.px) * m; sm += m; }

    // Walking drive acts on the whole body's centre of mass.
    const vx = svx / sm;
    const tvx = u.moveX * u.def.speed * G.DT;
    const dv = (tvx - vx) * 0.25 * b;
    for (const q of p) q.px -= dv;
    const damp = (q, k) => { q.px += (q.x - q.px - vx) * k; q.py += (q.y - q.py) * k; };

    const speed = Math.abs(vx);
    const moving = Math.min(1, speed / (0.45 * s));
    u.walkPhase += speed / (L.thigh * 0.5);
    const dir = u.moveX ? Math.sign(u.moveX) : vx > 0.05 ? 1 : vx < -0.05 ? -1 : f;

    const gy = T.heightAt(pel.x);
    const standH = (L.thigh + L.shin) * 0.9;
    const ty = gy - standH + Math.abs(Math.cos(u.walkPhase)) * 2 * s * moving;
    pel.y += (ty - pel.y) * 0.3 * b;
    pel.py += (pel.y - pel.py) * 0.2 * b;

    const lean = dir * 0.12 * moving - f * u.recoil * 0.015 + u.leanX;
    pull(nk, pel.x + Math.sin(lean) * L.torso, pel.y - Math.cos(lean) * L.torso, 0.3 * b);
    nk.py += (nk.y - nk.py) * 0.15 * b;
    pull(hd, nk.x + f * 1.5 * s + Math.sin(lean) * L.neck, nk.y - Math.cos(lean) * L.neck, 0.3 * b);
    hd.py += (hd.y - hd.py) * 0.1 * b;

    for (let i = 0; i < 2; i++) {
      const foot = p[i ? RFOOT : LFOOT], knee = p[i ? RKNEE : LKNEE];
      const ph = u.walkPhase + i * Math.PI;
      const stride = 12 * s * moving;
      const fx = pel.x + Math.sin(ph) * stride * dir + (i ? 4 : -4) * s * (1 - moving);
      const lift = Math.max(0, Math.cos(ph)) * 9 * s * moving;
      pull(foot, fx, T.heightAt(fx) - foot.r - lift, 0.4 * b);
      damp(foot, 0.3 * b);
      pull(knee, (pel.x + foot.x) / 2 + f * 7 * s, (pel.y + foot.y) / 2, 0.25 * b);
    }

    // arms + weapon angle
    const w = u.w;
    let wa = u.aim;
    if (w.kind === 'melee') {
      let la;
      if (u.swing >= 0) la = G.lerp(-2.4, 0.9, 1 - Math.pow(1 - u.swing, 3));
      else la = -1.0 + Math.sin(G.time * 3 + u.id) * 0.08;
      wa = f > 0 ? la : Math.PI - la;
    }
    u.wAng = wa;
    const ca = Math.cos(wa), sa = Math.sin(wa);
    const armL = L.upper + L.fore;
    let rx, ry, lx, ly;
    if (w.kind === 'melee') {
      rx = nk.x + ca * armL * 0.9; ry = nk.y + 3 * s + sa * armL * 0.9;
    } else {
      const reach = armL * 0.55 - u.recoil * 0.5;
      rx = nk.x + ca * reach; ry = nk.y + 5 * s + sa * reach;
    }
    if (u.def.shield) { lx = nk.x + f * 15 * s; ly = nk.y + 8 * s; }
    else if (w.kind === 'melee') { lx = nk.x + f * 7 * s; ly = nk.y + 15 * s; }
    else if (w.kind === 'lob') { lx = nk.x + f * 9 * s; ly = nk.y + 12 * s; }
    else { const g = (w.grip || 12) * s; lx = rx + ca * g; ly = ry + sa * g; }
    pull(p[RHAND], rx, ry, 0.4 * b); damp(p[RHAND], 0.25 * b);
    pull(p[LHAND], lx, ly, 0.35 * b); damp(p[LHAND], 0.25 * b);
    pull(p[RELB], (nk.x + p[RHAND].x) / 2 - f * 3 * s, (nk.y + p[RHAND].y) / 2 + 5 * s, 0.25 * b);
    pull(p[LELB], (nk.x + p[LHAND].x) / 2 - f * 2 * s, (nk.y + p[LHAND].y) / 2 + 5 * s, 0.25 * b);

    // Cancel any net sideways displacement/momentum the pose pulls introduced (only the drive may move us).
    let sx1 = 0, sv1 = 0;
    for (const q of p) { const m = 1 / q.im; sx1 += q.x * m; sv1 += (q.x - q.px) * m; }
    const shift = (sx1 - sx0) / sm;
    const vfix = (sv1 - svx) / sm - shift - dv;
    for (const q of p) { q.x -= shift; q.px += vfix; }
  };

  R.step = function (u) {
    const pts = u.pts, cons = u.cons, P = G.phys;
    const dmp = u.alive ? 0.985 : 0.993;
    for (const p of pts) P.integrate(p, dmp);
    if (u.alive && u.balance > 0.02) R.control(u);
    for (let it = 0; it < 5; it++) {
      for (const c of cons) P.solve(c);
      for (const p of pts) P.collide(p);
    }
    // Living feet are placed by the controller, so ground drag only applies while stunned.
    const keep = u.alive ? G.lerp(0.6, 1, u.balance) : 0.8;
    for (const p of pts) P.friction(p, keep);
  };

  R.shieldSeg = (u) => {
    const h = u.pts[LHAND], s = u.def.size, x = h.x + u.facing * 6 * s;
    return [x, h.y - 34 * s, x, h.y + 20 * s];
  };

  // ---------- drawing ----------
  function limb(ctx, p, a, b, c, col, w) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(p[a].x, p[a].y);
    ctx.lineTo(p[b].x, p[b].y);
    ctx.lineTo(p[c].x, p[c].y);
    ctx.stroke();
  }
  function dot(ctx, x, y, r, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, G.TAU);
    ctx.fill();
  }

  R.draw = function (ctx, u, alpha = 1) {
    const p = u.pts, s = u.def.size, mech = u.def.style === 'mech';
    const pal = u.alive ? u.pal : u.palDead;
    const fl = u.hitFlash > 0;
    const main = fl ? '#ffffff' : pal.main, dark = fl ? '#e6e6e6' : pal.dark;
    const lw = (mech ? 7.5 : 5.2) * s, ow = lw + 3.4;
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // back leg + back arm
    limb(ctx, p, PELVIS, LKNEE, LFOOT, OUT, ow);
    limb(ctx, p, PELVIS, LKNEE, LFOOT, dark, lw);
    dot(ctx, p[LFOOT].x, p[LFOOT].y + 0.5, lw * 0.75, '#1b1f2a');
    limb(ctx, p, NECK, LELB, LHAND, OUT, ow);
    limb(ctx, p, NECK, LELB, LHAND, dark, lw);

    // torso
    if (mech) drawMechTorso(ctx, u, pal, fl);
    else {
      const tw = 11 * s;
      ctx.strokeStyle = OUT; ctx.lineWidth = tw + 3.4;
      ctx.beginPath(); ctx.moveTo(p[NECK].x, p[NECK].y); ctx.lineTo(p[PELVIS].x, p[PELVIS].y); ctx.stroke();
      ctx.strokeStyle = main; ctx.lineWidth = tw; ctx.stroke();
      // chest plate highlight
      const f = u.facing;
      ctx.strokeStyle = fl ? '#fff' : pal.light;
      ctx.globalAlpha = alpha * 0.45;
      ctx.lineWidth = tw * 0.32;
      ctx.beginPath();
      ctx.moveTo(p[NECK].x + f * 2 * s, p[NECK].y + 3 * s);
      ctx.lineTo(G.lerp(p[NECK].x, p[PELVIS].x, 0.6) + f * 2 * s, G.lerp(p[NECK].y, p[PELVIS].y, 0.6));
      ctx.stroke();
      ctx.globalAlpha = alpha;
      // belt
      dot(ctx, p[PELVIS].x, p[PELVIS].y, tw * 0.5, dark);
    }

    // front leg
    limb(ctx, p, PELVIS, RKNEE, RFOOT, OUT, ow);
    limb(ctx, p, PELVIS, RKNEE, RFOOT, main, lw);
    dot(ctx, p[RFOOT].x, p[RFOOT].y + 0.5, lw * 0.75, '#1b1f2a');
    if (mech) {
      dot(ctx, p[RKNEE].x, p[RKNEE].y, lw * 0.6, pal.team);
      dot(ctx, p[LKNEE].x, p[LKNEE].y, lw * 0.5, G.mix(pal.team, '#000000', 0.35));
    }

    drawHead(ctx, u, pal, fl);

    if (u.alive) {
      if (u.w.kind === 'melee' && u.swing > 0.15 && u.swing < 0.85) drawSwingTrail(ctx, u, pal);
      R.drawWeapon(ctx, u.def.weapon, p[RHAND].x, p[RHAND].y, u.wAng, s, pal, u);
    }

    // front arm
    limb(ctx, p, NECK, RELB, RHAND, OUT, ow);
    limb(ctx, p, NECK, RELB, RHAND, main, lw);
    dot(ctx, p[RHAND].x, p[RHAND].y, lw * 0.62, fl ? '#fff' : pal.light);
    dot(ctx, p[LHAND].x, p[LHAND].y, lw * 0.55, fl ? '#fff' : pal.light);

    if (u.def.shield && u.alive) drawShield(ctx, u, pal);
    ctx.globalAlpha = 1;
  };

  function drawMechTorso(ctx, u, pal, fl) {
    const p = u.pts, s = u.def.size, nk = p[NECK], pel = p[PELVIS];
    const ang = Math.atan2(pel.y - nk.y, pel.x - nk.x) - Math.PI / 2;
    const h = u.L.torso + 14 * s, w = 19 * s;
    ctx.save();
    ctx.translate((nk.x + pel.x) / 2, (nk.y + pel.y) / 2);
    ctx.rotate(ang);
    ctx.scale(u.facing, 1);
    G.rrect(ctx, -w / 2, -h / 2, w, h, 5 * s);
    ctx.fillStyle = fl ? '#fff' : pal.main;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.fillStyle = pal.team;
    ctx.fillRect(-w / 2 + 2, -h * 0.12, w - 4, 4 * s);
    ctx.fillStyle = pal.dark;
    for (let i = 0; i < 3; i++) ctx.fillRect(-w * 0.35, h * 0.12 + i * 4 * s, w * 0.5, 1.6 * s);
    // shoulder pad
    G.rrect(ctx, -w * 0.62, -h / 2 - 3 * s, w * 0.75, 9 * s, 3 * s);
    ctx.fillStyle = pal.dark;
    ctx.fill();
    ctx.stroke();
    // reactor
    ctx.globalCompositeOperation = 'lighter';
    dot(ctx, w * 0.18, -h * 0.28, 3.2 * s, pal.glow);
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
  }

  function drawHead(ctx, u, pal, fl) {
    const p = u.pts, hd = p[HEAD], nk = p[NECK], r = u.L.head;
    const ang = Math.atan2(hd.y - nk.y, hd.x - nk.x) + Math.PI / 2;
    const dark = fl ? '#ddd' : pal.dark;
    const glow = u.alive ? pal.glow : '#3a3d44';
    ctx.save();
    ctx.translate(hd.x, hd.y);
    ctx.rotate(ang);
    ctx.scale(u.facing, 1);
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = OUT;
    const circle = (x, y, rr, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, rr, 0, G.TAU); ctx.fill(); ctx.stroke(); };
    const dome = (rr, col, oy = -0.08) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, r * oy, rr, Math.PI * 0.98, Math.PI * 2.02);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    const visor = (x, y, w, h, col) => {
      G.rrect(ctx, x, y, w, h, h * 0.45);
      ctx.fillStyle = '#0b1622';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.fillRect(x + w * 0.2, y + h * 0.25, w * 0.6, Math.max(1.2, h * 0.22));
      ctx.lineWidth = 2.4;
    };
    const skin = fl ? '#fff' : pal.skin;

    switch (u.def.hat) {
      case 'helmet':
        circle(0, 0, r, skin);
        dome(r * 1.15, dark);
        ctx.beginPath(); ctx.moveTo(-r * 1.2, -r * 0.08); ctx.lineTo(r * 1.3, -r * 0.08); ctx.stroke();
        visor(r * 0.1, -r * 0.02, r * 0.95, r * 0.42, glow);
        break;
      case 'cap':
        circle(0, 0, r, skin);
        dome(r * 1.05, dark, -0.12);
        ctx.fillStyle = dark;
        ctx.fillRect(r * 0.4, -r * 0.3, r * 1.1, r * 0.22);
        ctx.strokeRect(r * 0.4, -r * 0.3, r * 1.1, r * 0.22);
        if (u.alive) circle(r * 0.5, r * 0.12, r * 0.13, OUT);
        else {
          ctx.beginPath();
          ctx.moveTo(r * 0.35, 0); ctx.lineTo(r * 0.65, r * 0.3);
          ctx.moveTo(r * 0.65, 0); ctx.lineTo(r * 0.35, r * 0.3);
          ctx.stroke();
        }
        // bandana
        ctx.fillStyle = fl ? '#fff' : pal.main;
        ctx.fillRect(-r * 0.2, r * 0.35, r * 1.15, r * 0.5);
        break;
      case 'ninja': {
        circle(0, 0, r, fl ? '#fff' : '#1b1d29');
        ctx.fillStyle = glow;
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillRect(r * 0.05, -r * 0.25, r * 1.0, r * 0.26);
        ctx.globalCompositeOperation = 'source-over';
        const wave = Math.sin(G.time * 12 + u.id) * r * 0.35;
        ctx.strokeStyle = pal.main;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.8, -r * 0.45);
        ctx.quadraticCurveTo(-r * 1.8, -r * 0.6 + wave, -r * 2.6, -r * 0.2 + wave);
        ctx.moveTo(-r * 0.8, -r * 0.35);
        ctx.quadraticCurveTo(-r * 1.6, -r * 0.1 - wave * 0.5, -r * 2.3, r * 0.3 - wave * 0.5);
        ctx.stroke();
        break;
      }
      case 'medic':
        circle(0, 0, r, skin);
        dome(r * 1.12, fl ? '#fff' : u.alive ? '#eef2f6' : '#9a9da3');
        ctx.fillStyle = u.alive ? '#ff3b4a' : '#6a4a4d';
        ctx.fillRect(-r * 0.32, -r * 0.88, r * 0.24, r * 0.62);
        ctx.fillRect(-r * 0.51, -r * 0.69, r * 0.62, r * 0.24);
        visor(r * 0.1, -r * 0.02, r * 0.95, r * 0.42, '#7dffb0');
        break;
      case 'gasmask':
        circle(0, 0, r, skin);
        dome(r * 1.1, dark);
        circle(r * 0.55, r * 0.35, r * 0.42, '#2b3138');
        ctx.fillStyle = '#4a525c';
        ctx.fillRect(r * 0.7, r * 0.55, r * 0.5, r * 0.45);
        ctx.strokeRect(r * 0.7, r * 0.55, r * 0.5, r * 0.45);
        circle(r * 0.5, -r * 0.18, r * 0.27, u.alive ? '#ffb347' : '#555');
        break;
      case 'riot':
        circle(0, 0, r, skin);
        dome(r * 1.22, dark);
        ctx.strokeStyle = 'rgba(190,230,255,0.9)';
        ctx.fillStyle = 'rgba(160,215,255,0.28)';
        ctx.beginPath();
        ctx.arc(r * 0.1, 0, r * 1.25, -1.25, 0.95);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = OUT;
        break;
      case 'hood':
        circle(-r * 0.1, -r * 0.05, r * 1.15, fl ? '#fff' : '#2a2f3c');
        circle(r * 0.35, r * 0.1, r * 0.66, '#11141b');
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = u.alive ? '#7ff6ff' : '#333';
        ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.02, r * 0.22, 0, G.TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'antenna':
        circle(0, 0, r, skin);
        ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.9); ctx.lineTo(-r * 1.0, -r * 2.3); ctx.stroke();
        dome(r * 1.15, dark);
        visor(r * 0.1, -r * 0.02, r * 0.95, r * 0.42, glow);
        if (u.alive && Math.sin(G.time * 6 + u.id) > 0) {
          ctx.fillStyle = '#ff5a5a';
          ctx.beginPath(); ctx.arc(-r * 1.0, -r * 2.3, 2, 0, G.TAU); ctx.fill();
        }
        break;
      case 'mech':
        G.rrect(ctx, -r * 1.2, -r * 1.0, r * 2.5, r * 1.9, r * 0.4);
        ctx.fillStyle = fl ? '#fff' : pal.main;
        ctx.fill();
        ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = glow;
        ctx.fillRect(r * 0.0, -r * 0.45, r * 1.15, r * 0.42);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = pal.team;
        ctx.fillRect(-r * 1.1, r * 0.4, r * 2.3, r * 0.25);
        break;
      default:
        circle(0, 0, r, skin);
    }
    ctx.restore();
  }

  function drawSwingTrail(ctx, u, pal) {
    const nk = u.pts[NECK], s = u.def.size, f = u.facing;
    const rad = (u.L.upper + u.L.fore) * 0.9 + u.w.len * s * 0.8;
    const a0 = G.lerp(-2.4, 0.9, 1 - Math.pow(1 - Math.max(0, u.swing - 0.3), 3));
    const a1 = G.lerp(-2.4, 0.9, 1 - Math.pow(1 - u.swing, 3));
    const toW = (a) => (f > 0 ? a : Math.PI - a);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = pal.glow;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    if (f > 0) ctx.arc(nk.x, nk.y, rad, toW(a0), toW(a1));
    else ctx.arc(nk.x, nk.y, rad, toW(a1), toW(a0));
    ctx.stroke();
    ctx.restore();
  }

  function drawShield(ctx, u, pal) {
    const sg = R.shieldSeg(u), s = u.def.size;
    const w = 7 * s;
    G.rrect(ctx, sg[0] - w / 2, sg[1], w, sg[3] - sg[1], 3 * s);
    ctx.fillStyle = 'rgba(150,215,255,0.35)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = pal.team;
    ctx.stroke();
    ctx.fillStyle = 'rgba(220,240,255,0.55)';
    ctx.fillRect(sg[0] - w * 0.15, sg[1] + 5 * s, w * 0.3, (sg[3] - sg[1]) * 0.35);
  }

  // Weapons are drawn in local space: origin at the gripping hand, +x along the barrel.
  R.drawWeapon = function (ctx, kind, x, y, ang, s, pal, u) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(s, Math.cos(ang) < 0 ? -s : s);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = OUT;
    const box = (bx, by, bw, bh, c) => { ctx.fillStyle = c; ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh); };
    const glow = pal.glow;
    const loaded = !u || u.cool < u.w.cd * 0.6;
    switch (kind) {
      case 'rifle':
        box(-12, -2, 8, 5, '#2c3240');
        box(-5, -3.5, 22, 6.5, '#363d4d');
        box(16, -1.8, 12, 3.6, '#1d2129');
        box(3, 3, 4.5, 6, '#262b36');
        ctx.fillStyle = glow; ctx.fillRect(-2, -2.4, 10, 1.6);
        break;
      case 'shotgun':
        box(-12, -2.5, 9, 6, '#4a3326');
        box(-4, -4, 26, 7, '#30343f');
        box(6, 3, 10, 3.5, '#5a3e2c');
        box(20, -3, 6, 3, '#1d2129');
        break;
      case 'sniper':
        box(-14, -2.5, 12, 5.5, '#2a2f3a');
        box(-3, -3, 26, 6, '#3b4252');
        box(22, -1.6, 22, 3.2, '#1d2129');
        box(3, -8, 13, 4, '#1d2129');
        ctx.fillStyle = loaded ? '#7ff6ff' : '#2d5560';
        for (let i = 0; i < 4; i++) ctx.fillRect(25 + i * 4.5, -2.4, 1.6, 4.8);
        ctx.fillRect(15, -7.5, 2, 3);
        break;
      case 'pistol':
        box(-2, -2.5, 13, 5, '#3b4252');
        box(-1, 1.5, 4, 6, '#262b36');
        ctx.fillStyle = '#7dffb0'; ctx.fillRect(2, -1.6, 6, 1.2);
        break;
      case 'minigun': {
        box(-12, -7, 26, 14, '#4a5160');
        ctx.fillStyle = pal.team; ctx.fillRect(-10, -2, 22, 3);
        const ph = (u ? u.spin || 0 : 0);
        ctx.lineWidth = 2.6;
        ctx.strokeStyle = '#1d2129';
        ctx.beginPath();
        for (let k = 0; k < 3; k++) {
          const oy = Math.sin(ph + (k * G.TAU) / 3) * 3.5;
          ctx.moveTo(14, oy); ctx.lineTo(40, oy);
        }
        ctx.stroke();
        ctx.lineWidth = 1.5;
        box(36, -5, 4, 10, '#30343f');
        break;
      }
      case 'grenade':
        if (loaded) {
          ctx.fillStyle = '#3f5f2e';
          ctx.beginPath(); ctx.arc(3, 0, 4.2, 0, G.TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#c8d0d8'; ctx.fillRect(1.5, -6, 3, 2.2);
        }
        break;
      case 'rocket':
        box(-16, -5, 44, 10, '#3d4a3f');
        box(-18, -6, 4, 12, '#2a332b');
        box(26, -6, 4, 12, '#2a332b');
        box(-1, 4, 4, 6, '#262b36');
        ctx.fillStyle = '#e8c547'; ctx.fillRect(-8, -5, 3, 10);
        if (loaded) {
          ctx.fillStyle = pal.team;
          ctx.beginPath(); ctx.moveTo(30, -4); ctx.lineTo(37, 0); ctx.lineTo(30, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        break;
      case 'baton':
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#1d2129';
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(22, 0); ctx.stroke();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#9fd8ff';
        ctx.beginPath(); ctx.arc(22, 0, 3, 0, G.TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        break;
      case 'blade':
        box(-4, -2, 8, 4, '#222');
        box(3.5, -4, 2, 8, '#555');
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.strokeStyle = glow;
        ctx.globalAlpha *= 0.4;
        ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(34, 0); ctx.stroke();
        ctx.globalAlpha /= 0.4;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.4;
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        break;
    }
    if (u && u.muzzleT > 0 && u.w.len) {
      const L = u.w.len;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffe9a0';
      ctx.beginPath();
      ctx.moveTo(L, 0); ctx.lineTo(L + 5, -4.5); ctx.lineTo(L + 16, 0); ctx.lineTo(L + 5, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath(); ctx.arc(L + 2, 0, 4, 0, G.TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  };

  R.drawShieldProp = function (ctx, pr) {
    const ang = Math.atan2(pr.b.y - pr.a.y, pr.b.x - pr.a.x);
    const len = pr.c.len, w = 7 * pr.size;
    ctx.save();
    ctx.translate(pr.a.x, pr.a.y);
    ctx.rotate(ang);
    G.rrect(ctx, 0, -w / 2, len, w, 3);
    ctx.fillStyle = 'rgba(150,200,230,0.35)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = pr.color;
    ctx.stroke();
    ctx.restore();
  };
})(window.WW);
