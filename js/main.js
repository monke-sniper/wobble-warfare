'use strict';
// Game state machine, fixed-step loop, rendering and input.
(function (G) {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const cam = G.cam, I = G.ragdoll.IDX, UI = G.ui;
  const MAX_PER_TEAM = 120;
  let dpr = 1, acc = 0, last = performance.now(), attractRestart = 0, uiTick = 0, lastFail = -9;
  let snapshot = null;

  G.mode = 'attract'; // attract | campaign | sandbox
  G.state = 'battle'; // place | battle | over
  G.levelIdx = 0;
  G.paused = false;
  G.slowmo = false;
  G.timeScale = 1;
  G.winner = null;
  G.armies = {}; // last player army per campaign level (this session)
  G.stats = { spent: 0, startTime: 0, duration: 0 };

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    cam.resize(innerWidth, innerHeight);
  }

  // ---------- world helpers ----------
  G.level = () => G.LEVELS[G.levelIdx];
  G.spent = (team) => { let s = 0; for (const u of G.units) if (u.team === team) s += u.def.cost; return s; };
  G.inZone = (team, x) => { const z = G.world.zones[team]; return x >= z[0] && x <= z[1]; };
  G.clearWorld = () => {
    G.units.length = 0;
    G.props.length = 0;
    G.projectiles.length = 0;
    G.fx.clear();
    cam.follow = null;
  };
  G.spawn = (type, team, x) => { const u = new G.Unit(type, team, x); G.units.push(u); return u; };
  const canEdit = (team) => G.mode === 'sandbox' || team === 0;

  function fail(msg) {
    if (G.realTime - lastFail > 0.6) { UI.toast(msg); G.audio.play('error'); lastFail = G.realTime; }
    return false;
  }

  G.tryPlace = function (type, team, x) {
    const d = G.UNITS[type];
    if (!G.inZone(team, x)) return fail(team ? 'Place red units in the red zone' : 'Place units inside the blue zone');
    let count = 0;
    for (const u of G.units) if (u.team === team) count++;
    if (count >= MAX_PER_TEAM) return fail('Unit limit reached');
    if (G.mode === 'campaign' && G.spent(0) + d.cost > G.level().budget) return fail('Not enough budget');
    G.spawn(type, team, x);
    G.audio.play('place', x, 0.7);
    UI.refresh();
    return true;
  };

  G.removeAt = function (wx, wy) {
    let best = -1, bd = 45;
    G.units.forEach((u, i) => {
      if (!canEdit(u.team)) return;
      const c = u.chest();
      const d = Math.hypot(c.x - wx, c.y - wy);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0) return false;
    G.units.splice(best, 1);
    G.audio.play('remove', wx, 0.7);
    UI.refresh();
    return true;
  };

  G.randomArmy = function (team, budget) {
    const z = G.world.zones[team];
    const types = Object.keys(G.UNITS).filter((t) => G.UNITS[t].cost <= budget * 0.6);
    let left = budget;
    for (let guard = 0; guard < 200; guard++) {
      const opts = types.filter((t) => G.UNITS[t].cost <= left);
      if (!opts.length) break;
      const t = G.pick(opts);
      left -= G.UNITS[t].cost;
      const depth = G.clamp(G.UNITS[t].role + G.rand(-0.2, 0.2), 0, 1) * (z[1] - z[0]) * 0.8;
      G.spawn(t, team, team === 0 ? z[1] - 15 - depth : z[0] + 15 + depth);
    }
  };

  // ---------- flow ----------
  G.startAttract = function () {
    G.mode = 'attract';
    G.terrain.generate((Math.random() * 1e6) | 0, G.rand(0.5, 1.1));
    G.clearWorld();
    G.randomArmy(0, 1600);
    G.randomArmy(1, 1600);
    G.state = 'battle';
    G.paused = false;
    G.slowmo = false;
    G.resultsShown = false;
    G.winner = null;
    G.stats = { spent: 0, startTime: G.time, duration: 0 };
    attractRestart = 0;
    cam.fit(true);
    cam.auto = true;
    G.audio.vol = 0.25;
  };
  G.ensureAttract = () => { if (G.mode !== 'attract') G.startAttract(); };

  function enterPlace() {
    G.state = 'place';
    G.paused = false;
    G.slowmo = false;
    G.resultsShown = false;
    snapshot = null;
    G.audio.vol = 1;
    cam.auto = false;
    cam.fit(true);
    UI.showPlace();
  }

  G.startLevel = function (i) {
    G.mode = 'campaign';
    G.levelIdx = i;
    const L = G.LEVELS[i];
    G.terrain.generate(L.seed, L.hilly);
    G.clearWorld();
    for (const [t, x] of L.enemy) G.spawn(t, 1, x);
    for (const a of G.armies[L.id] || []) G.spawn(a.type, 0, a.x);
    enterPlace();
  };

  G.startSandbox = function () {
    G.mode = 'sandbox';
    G.terrain.generate((Math.random() * 1e6) | 0, G.rand(0.4, 1.2));
    G.clearWorld();
    UI.team = 0;
    enterPlace();
  };

  G.clearPlaced = function () {
    for (let i = G.units.length - 1; i >= 0; i--) if (canEdit(G.units[i].team)) G.units.splice(i, 1);
    UI.refresh();
  };

  G.randomSandbox = function () {
    G.clearWorld();
    const budget = G.pick([1200, 2000, 3000, 4500]);
    G.randomArmy(0, budget);
    G.randomArmy(1, budget);
    G.audio.play('place');
    UI.refresh();
  };

  G.newSandboxMap = function () {
    const list = G.units.map((u) => ({ type: u.type, team: u.team, x: u.spawnX }));
    G.terrain.generate((Math.random() * 1e6) | 0, G.rand(0.4, 1.3));
    G.clearWorld();
    for (const s of list) G.spawn(s.type, s.team, s.x);
    cam.fit(true);
  };

  G.startBattle = function () {
    if (G.state !== 'place') return;
    let a = 0, b = 0;
    for (const u of G.units) { if (u.team) b++; else a++; }
    if (!a || !b) {
      fail(!a ? (G.mode === 'sandbox' ? 'Blue army is empty' : 'Place some units first!') : 'Red army is empty');
      return;
    }
    snapshot = G.units.map((u) => ({ type: u.type, team: u.team, x: u.spawnX }));
    if (G.mode === 'campaign') G.armies[G.level().id] = snapshot.filter((s) => s.team === 0);
    G.stats = { spent: G.spent(0), startTime: G.time, duration: 0 };
    G.state = 'battle';
    G.winner = null;
    G.resultsShown = false;
    G.paused = false;
    G.audio.play('start');
    UI.showBattle();
  };

  G.resetBattle = function () {
    if (!snapshot || G.mode === 'attract') return;
    const snap = snapshot;
    G.terrain.restore();
    G.clearWorld();
    for (const s of snap) G.spawn(s.type, s.team, s.x);
    G.state = 'place';
    G.paused = false;
    G.slowmo = false;
    G.resultsShown = false;
    cam.auto = false;
    UI.showPlace();
  };

  G.exitToMenu = function () {
    const wasCampaign = G.mode === 'campaign';
    G.startAttract();
    if (wasCampaign) UI.showLevels();
    else UI.showMenu();
  };

  // ---------- simulation ----------
  function checkEnd() {
    let a = 0, b = 0;
    for (const u of G.units) if (u.alive) { if (u.team) b++; else a++; }
    const stale = G.mode === 'attract' && G.time - G.stats.startTime > 80;
    if (a && b && !stale) return;
    G.state = 'over';
    G.winner = a && !b ? 0 : b && !a ? 1 : -1;
    G.slowUntil = G.realTime + 2.2;
    G.stats.duration = G.time - G.stats.startTime;
  }

  function step() {
    G.time += G.DT;
    G.battleOn = G.state === 'battle' || G.state === 'over';
    for (let i = 0; i < G.units.length; i++) G.units[i].update(G.DT);
    if (G.battleOn) G.updateProjectiles();
    for (const pr of G.props) G.phys.updateProp(pr);
    if (G.props.length > 80) G.props.splice(0, G.props.length - 80);
    G.fx.update(G.DT);
    if (G.state === 'battle') checkEnd();
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    G.realTime += dt;
    let ts = G.paused ? 0 : G.slowmo ? 0.25 : 1;
    if (G.state === 'over' && G.realTime < G.slowUntil) ts = Math.min(ts, 0.3);
    G.timeScale = ts;
    acc += dt * ts;
    let n = 0;
    while (acc >= G.DT && n < 4) { step(); acc -= G.DT; n++; }
    if (n >= 4) acc = 0;

    if (G.state === 'over' && !G.resultsShown && G.realTime >= G.slowUntil) {
      G.resultsShown = true;
      if (G.mode === 'attract') attractRestart = G.realTime + 1.5;
      else UI.showResults();
    }
    if (G.mode === 'attract' && attractRestart && G.realTime > attractRestart) G.startAttract();

    cam.update(dt);
    uiTick -= dt;
    if (uiTick <= 0) {
      uiTick = 0.2;
      if (G.mode !== 'attract' && G.state !== 'place') UI.tick();
    }
    render();
    requestAnimationFrame(frame);
  }

  // ---------- rendering ----------
  function drawZones(tl, br) {
    for (const t of [0, 1]) {
      const z = G.world.zones[t], col = G.TEAMS[t].main;
      const active = G.mode === 'sandbox' ? UI.team === t : t === 0;
      ctx.globalAlpha = active ? 0.13 : 0.05;
      ctx.fillStyle = col;
      ctx.fillRect(z[0], tl.y - 50, z[1] - z[0], br.y - tl.y + 100);
      ctx.globalAlpha = active ? 0.75 : 0.3;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2 / cam.z;
      ctx.setLineDash([10 / cam.z, 8 / cam.z]);
      ctx.beginPath();
      ctx.moveTo(z[0], tl.y - 50); ctx.lineTo(z[0], br.y + 50);
      ctx.moveTo(z[1], tl.y - 50); ctx.lineTo(z[1], br.y + 50);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

  function drawHealBeams() {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#7dffb0';
    for (const u of G.units) {
      if (!u.alive || !u.healing) continue;
      const m = G.muzzle(u), c = u.healing.chest();
      const dx = c.x - m.x, dy = c.y - m.y, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      for (const [wd, al] of [[6, 0.25], [2, 0.9]]) {
        ctx.lineWidth = wd;
        ctx.globalAlpha = al;
        ctx.beginPath();
        for (let i = 0; i <= 14; i++) {
          const t = i / 14;
          const off = Math.sin(t * 14 - G.time * 22) * 3 * Math.sin(t * Math.PI);
          const x = m.x + dx * t + nx * off, y = m.y + dy * t + ny * off;
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawBars() {
    for (const u of G.units) {
      if (!u.alive || u.hp >= u.maxHp) continue;
      const hd = u.pts[I.HEAD];
      const w = 24 * Math.max(1, u.def.size * 0.8);
      const y = hd.y - u.L.head - 13;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(hd.x - w / 2 - 1, y - 1, w + 2, 5);
      ctx.fillStyle = G.TEAMS[u.team].main;
      ctx.fillRect(hd.x - w / 2, y, (w * Math.max(0, u.hp)) / u.maxHp, 3);
    }
  }

  function drawFollowMarker() {
    const u = cam.follow, hd = u.pts[I.HEAD];
    const y = hd.y - u.L.head - 26 + Math.sin(G.realTime * 6) * 3;
    ctx.fillStyle = '#5ff0a8';
    ctx.beginPath();
    ctx.moveTo(hd.x - 6, y - 8); ctx.lineTo(hd.x + 6, y - 8); ctx.lineTo(hd.x, y);
    ctx.closePath();
    ctx.fill();
  }

  let ghost = null, ghostKey = '';
  function drawGhost() {
    const t = UI.tool;
    if (!t || !ptr.over || (ptr.down && ptr.btn !== 0)) return;
    const wp = cam.toWorld(ptr.x, ptr.y);
    const gy = G.terrain.heightAt(wp.x);
    if (t === 'erase') {
      ctx.strokeStyle = '#ff4f45';
      ctx.lineWidth = 2 / cam.z;
      ctx.beginPath(); ctx.arc(wp.x, wp.y, 45, 0, G.TAU); ctx.stroke();
      return;
    }
    const team = G.mode === 'sandbox' ? UI.team : 0;
    const ok = G.inZone(team, wp.x) && (G.mode !== 'campaign' || G.spent(0) + G.UNITS[t].cost <= G.level().budget);
    const key = t + team;
    if (!ghost || ghostKey !== key) { ghost = new G.Unit(t, team, wp.x); ghostKey = key; }
    G.ragdoll.build(ghost, wp.x, gy);
    ghost.wAng = ghost.w.kind === 'melee' ? (team ? Math.PI + 1 : -1) : ghost.aim;
    ctx.fillStyle = ok ? 'rgba(95,240,168,0.45)' : 'rgba(255,79,69,0.5)';
    ctx.beginPath();
    ctx.ellipse(wp.x, gy, 18 * ghost.def.size, 5, 0, 0, G.TAU);
    ctx.fill();
    G.ragdoll.draw(ctx, ghost, ok ? 0.55 : 0.3);
  }

  function render() {
    const w = cam.w, h = cam.h;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    G.terrain.drawSky(ctx, cam, w, h);
    cam.apply(ctx, dpr);
    const tl = cam.toWorld(0, 0), br = cam.toWorld(w, h);
    if (G.state === 'place') drawZones(tl, br);
    G.terrain.drawGround(ctx, tl.x, br.x);
    G.terrain.drawDecor(ctx, tl.x, br.x);
    G.fx.drawStains(ctx);
    G.drawProps(ctx);
    const x0 = tl.x - 120, x1 = br.x + 120;
    for (const u of G.units) { const x = u.pts[I.PELVIS].x; if (!u.alive && x > x0 && x < x1) G.ragdoll.draw(ctx, u); }
    for (const u of G.units) { const x = u.pts[I.PELVIS].x; if (u.alive && x > x0 && x < x1) G.ragdoll.draw(ctx, u); }
    drawHealBeams();
    G.drawProjectiles(ctx);
    G.fx.draw(ctx);
    drawBars();
    if (cam.follow) drawFollowMarker();
    if (G.state === 'place') drawGhost();
    G.fx.drawTexts(ctx, cam.z);
  }

  // ---------- input ----------
  const ptr = { down: false, btn: 0, sx: 0, sy: 0, x: 0, y: 0, moved: false, lastPaint: null, over: false, camX: 0, camY: 0 };

  function applyTool() {
    const wp = cam.toWorld(ptr.x, ptr.y);
    if (UI.tool === 'erase') { G.removeAt(wp.x, wp.y); return; }
    const d = G.UNITS[UI.tool];
    if (ptr.lastPaint !== null && Math.abs(wp.x - ptr.lastPaint) < 14 * d.size + 8) return;
    const team = G.mode === 'sandbox' ? UI.team : 0;
    if (G.tryPlace(UI.tool, team, wp.x)) ptr.lastPaint = wp.x;
  }

  function pickFollow(wp) {
    let best = null, bd = 60;
    for (const u of G.units) {
      const c = u.chest();
      const d = Math.hypot(c.x - wp.x, c.y - wp.y);
      if (d < bd) { bd = d; best = u; }
    }
    cam.follow = best;
    if (best) cam.auto = false;
    UI.refreshButtons();
  }

  canvas.addEventListener('pointerenter', () => { ptr.over = true; });
  canvas.addEventListener('pointerleave', () => { ptr.over = false; });
  canvas.addEventListener('pointerdown', (e) => {
    G.audio.init();
    if (G.mode === 'attract') return;
    canvas.setPointerCapture(e.pointerId);
    Object.assign(ptr, { down: true, btn: e.button, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false, lastPaint: null, camX: cam.tx, camY: cam.ty, over: true });
    if (G.state === 'place' && e.button === 0 && UI.tool) applyTool();
  });
  canvas.addEventListener('pointermove', (e) => {
    ptr.x = e.clientX;
    ptr.y = e.clientY;
    ptr.over = true;
    if (!ptr.down) return;
    if (Math.hypot(ptr.x - ptr.sx, ptr.y - ptr.sy) > 6) ptr.moved = true;
    if (G.state === 'place' && ptr.btn === 0 && UI.tool) applyTool();
    else if (ptr.moved) {
      cam.follow = null;
      cam.auto = false;
      cam.tx = ptr.camX - (ptr.x - ptr.sx) / cam.z;
      cam.ty = ptr.camY - (ptr.y - ptr.sy) / cam.z;
      cam.x = cam.tx;
      cam.y = cam.ty;
    }
  });
  canvas.addEventListener('pointerup', () => {
    if (!ptr.down) return;
    ptr.down = false;
    if (ptr.moved) { UI.refreshButtons(); return; }
    const wp = cam.toWorld(ptr.x, ptr.y);
    if (G.state === 'place' && ptr.btn === 2) G.removeAt(wp.x, wp.y);
    else if (G.state !== 'place' && ptr.btn === 0) pickFollow(wp);
  });
  canvas.addEventListener('pointercancel', () => { ptr.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (G.mode === 'attract') return;
    cam.auto = false;
    cam.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  const PAN_KEYS = ['w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'];
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (G.mode === 'attract') return;
    if (PAN_KEYS.includes(k)) { cam.keys[k] = true; if (k.startsWith('arrow')) e.preventDefault(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (k === ' ') {
      e.preventDefault();
      if (G.state === 'place') G.startBattle();
      else { G.paused = !G.paused; UI.refreshButtons(); }
    } else if (k === 't') { G.slowmo = !G.slowmo; UI.refreshButtons(); }
    else if (k === 'r') G.resetBattle();
    else if (k === 'c' && G.state !== 'place') UI.act('cine');
    else if (k === 'escape') { if (cam.follow) cam.follow = null; else if (UI.tool) UI.selectTool(null); }
    else if (k === 'x' && G.state === 'place') UI.selectTool(UI.tool === 'erase' ? null : 'erase');
    else if (/^[1-9]$/.test(k) && G.state === 'place') {
      const t = Object.keys(G.UNITS)[+k - 1];
      if (t) UI.selectTool(UI.tool === t ? null : t);
    } else if (k === '=' || k === '+') UI.act('zoomin');
    else if (k === '-') UI.act('zoomout');
  });
  window.addEventListener('keyup', (e) => { cam.keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { cam.keys = {}; });

  // ---------- boot ----------
  resize();
  window.addEventListener('resize', resize);
  G.terrain.generate(1, 0.8);
  UI.init();
  G.startAttract();
  UI.showMenu();
  requestAnimationFrame((t) => { last = t; frame(t); });
})(window.WW);
