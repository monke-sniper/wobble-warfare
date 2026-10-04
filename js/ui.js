'use strict';
// DOM menus, HUD, unit palette, level select, results, save data.
(function (G) {
  const $ = (id) => document.getElementById(id);
  const I = G.ragdoll.IDX;
  const UI = (G.ui = { tool: null, team: 0 });
  const TYPES = Object.keys(G.UNITS);
  const SCREENS = ['scr-menu', 'scr-levels', 'scr-howto', 'scr-results'];
  UI.save = G.loadSave();
  G.audio.on = UI.save.sound;

  function show(id) { for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id); }
  function hud(on) { $('hud').classList.toggle('hidden', !on); }
  const cards = () => document.querySelectorAll('.ucard');

  UI.showMenu = () => { show('scr-menu'); hud(false); updateSoundBtn(); };
  UI.showLevels = () => { buildLevels(); show('scr-levels'); hud(false); };
  UI.showHowto = () => { show('scr-howto'); hud(false); };

  UI.showPlace = function () {
    show(null);
    hud(true);
    const h = $('hud');
    h.classList.add('mode-place');
    h.classList.remove('mode-battle');
    h.classList.toggle('is-sandbox', G.mode === 'sandbox');
    if (G.mode === 'campaign') {
      const L = G.level();
      $('hud-title').textContent = `${G.levelIdx + 1}. ${L.name}`;
      $('hud-sub').textContent = L.tip;
      UI.team = 0;
    } else {
      $('hud-title').textContent = 'Sandbox';
      $('hud-sub').textContent = 'Build both armies. Unlimited budget.';
    }
    $('hint').textContent = 'Click or drag to place · Right-click to remove · Right-drag / WASD to pan · Wheel to zoom · Space to start';
    setTeam(UI.team);
    UI.selectTool(UI.tool);
  };

  UI.showBattle = function () {
    show(null);
    hud(true);
    const h = $('hud');
    h.classList.remove('mode-place');
    h.classList.add('mode-battle');
    $('unit-info').classList.add('hidden');
    $('hint').textContent = 'Space pause · T slow-mo · C auto-cam · Click a unit to follow · R reset';
    UI.refreshButtons();
    UI.tick();
  };

  UI.refresh = function () {
    const b = $('budget');
    if (G.mode === 'campaign') {
      const left = G.level().budget - G.spent(0);
      b.textContent = `$${left} left`;
      b.classList.toggle('over', left < 100);
      for (const el of cards()) {
        const d = G.UNITS[el.dataset.type];
        el.classList.toggle('poor', !!d && d.cost > left);
      }
    } else {
      b.textContent = `Blue $${G.spent(0)} · Red $${G.spent(1)}`;
      b.classList.remove('over');
      for (const el of cards()) el.classList.remove('poor');
    }
  };

  UI.tick = function () {
    let a = 0, c = 0;
    for (const u of G.units) if (u.alive) { if (u.team) c++; else a++; }
    $('army0').textContent = a;
    $('army1').textContent = c;
    $('army-fill').style.width = (a + c ? (a / (a + c)) * 100 : 50) + '%';
  };

  UI.refreshButtons = function () {
    const p = $('btn-pause');
    p.classList.toggle('on', G.paused);
    p.textContent = G.paused ? 'Resume' : 'Pause';
    $('btn-slow').classList.toggle('on', G.slowmo);
    $('btn-cine').classList.toggle('on', G.cam.auto);
  };

  UI.showResults = function () {
    const panel = document.querySelector('#scr-results .panel');
    const w = G.winner;
    panel.className = 'panel result';
    let title;
    if (G.mode === 'campaign') {
      const win = w === 0, L = G.level();
      title = win ? 'VICTORY' : 'DEFEAT';
      panel.classList.add(win ? 'win' : 'lose');
      let stars = 0;
      if (win) {
        stars = G.starsFor(G.stats.spent, L.budget);
        if (stars > (UI.save.stars[L.id] || 0)) { UI.save.stars[L.id] = stars; G.writeSave(UI.save); }
      }
      $('res-stars').innerHTML = win ? [1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">★</span>`).join('') : '';
      $('res-next').classList.toggle('hidden', !(win && G.levelIdx < G.LEVELS.length - 1));
      $('res-leave').textContent = 'Levels';
      $('res-retry').textContent = win ? 'Replay' : 'Retry';
    } else {
      title = w === 0 ? 'BLUE WINS' : w === 1 ? 'RED WINS' : 'DRAW';
      panel.classList.add(w === 1 ? 'red' : 'blue');
      $('res-stars').innerHTML = '';
      $('res-next').classList.add('hidden');
      $('res-leave').textContent = 'Menu';
      $('res-retry').textContent = 'Edit armies';
    }
    $('res-title').textContent = title;

    const lost = [0, 0], total = [0, 0];
    let mvp = null;
    for (const u of G.units) {
      total[u.team]++;
      if (!u.alive) lost[u.team]++;
      if (!mvp || u.kills > mvp.kills) mvp = u;
    }
    const lines = [`Blue lost <b>${lost[0]}/${total[0]}</b> · Red lost <b>${lost[1]}/${total[1]}</b> · <b>${G.stats.duration.toFixed(1)}s</b>`];
    if (G.mode === 'campaign') {
      const L = G.level();
      lines.push(`Spent <b>$${G.stats.spent}</b> of $${L.budget} <span class="muted">(★★★ at ≤ $${Math.floor(L.budget * 0.6)})</span>`);
    }
    if (mvp && mvp.kills) lines.push(`MVP: <b>${G.TEAMS[mvp.team].name} ${mvp.def.name}</b> with ${mvp.kills} kill${mvp.kills > 1 ? 's' : ''}`);
    $('res-stats').innerHTML = lines.join('<br>');
    hud(false);
    show('scr-results');
    G.audio.play(G.mode === 'campaign' && w !== 0 ? 'lose' : 'win');
  };

  let toastT = 0;
  UI.toast = (msg) => {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('show'), 1600);
  };

  function buildLevels() {
    const grid = $('level-grid');
    grid.innerHTML = '';
    let total = 0;
    G.LEVELS.forEach((L, i) => {
      const st = UI.save.stars[L.id] || 0;
      total += st;
      const unlocked = i === 0 || (UI.save.stars[G.LEVELS[i - 1].id] || 0) > 0;
      const b = document.createElement('button');
      b.className = 'lvl' + (unlocked ? '' : ' locked');
      b.innerHTML = `<div class="num">LEVEL ${i + 1}${unlocked ? '' : ' · LOCKED'}</div><div class="nm">${L.name}</div>` +
        `<div class="meta"><span>Budget $${L.budget}</span><span class="st">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></span></div>`;
      if (unlocked) b.addEventListener('click', () => { G.audio.init(); G.audio.play('ui'); UI.selectTool(null); G.startLevel(i); });
      grid.appendChild(b);
    });
    $('star-total').textContent = `★ ${total} / ${G.LEVELS.length * 3}`;
  }

  function buildPalette() {
    const pal = $('palette');
    pal.innerHTML = '';
    TYPES.forEach((t, i) => {
      const d = G.UNITS[t];
      const el = document.createElement('div');
      el.className = 'ucard';
      el.dataset.type = t;
      el.innerHTML = `<span class="key">${i + 1}</span><canvas width="128" height="128"></canvas><div class="nm">${d.name}</div><div class="cost">$${d.cost}</div>`;
      el.addEventListener('click', () => { G.audio.init(); G.audio.play('ui'); UI.selectTool(UI.tool === t ? null : t); });
      el.addEventListener('mouseenter', () => showInfo(t));
      el.addEventListener('mouseleave', () => showInfo(UI.tool));
      pal.appendChild(el);
    });
    const er = document.createElement('div');
    er.className = 'ucard erase';
    er.dataset.type = 'erase';
    er.innerHTML = '<span class="key">X</span><div class="icon">✕</div><div class="nm">Remove</div><div class="cost">&nbsp;</div>';
    er.addEventListener('click', () => { G.audio.play('ui'); UI.selectTool(UI.tool === 'erase' ? null : 'erase'); });
    pal.appendChild(er);
  }

  function drawPortrait(cv, type, team) {
    const u = new G.Unit(type, team, 1000);
    const was = G.battleOn;
    G.battleOn = false;
    for (let i = 0; i < 40; i++) u.update(G.DT);
    G.battleOn = was;
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(cv.width / 2, cv.height * 0.9, cv.width * 0.28, cv.height * 0.05, 0, 0, G.TAU);
    c.fill();
    const s = u.def.size, sc = (cv.width * 0.8) / (80 * s);
    const pel = u.pts[I.PELVIS];
    c.setTransform(sc, 0, 0, sc, cv.width / 2 - pel.x * sc, cv.height * 0.5 - (pel.y - 12 * s) * sc);
    G.ragdoll.draw(c, u);
  }
  function drawPortraits() {
    for (const cv of document.querySelectorAll('.ucard canvas')) drawPortrait(cv, cv.parentNode.dataset.type, UI.team);
  }

  function setTeam(t) {
    UI.team = t;
    for (const b of document.querySelectorAll('#team-switch button')) b.classList.toggle('on', +b.dataset.team === t);
    drawPortraits();
    UI.refresh();
  }

  UI.selectTool = function (t) {
    UI.tool = t;
    for (const el of cards()) el.classList.toggle('sel', el.dataset.type === t);
    showInfo(t);
  };

  function showInfo(t) {
    const box = $('unit-info');
    if (!t || t === 'erase' || G.state !== 'place') { box.classList.add('hidden'); return; }
    const d = G.UNITS[t], w = G.WEAPONS[d.weapon];
    const range = w.kind === 'melee' ? 'Melee' : w.range;
    box.innerHTML = `<h3>${d.name} <span style="color:var(--gold)">$${d.cost}</span></h3><p>${d.desc}</p>` +
      `<div class="stats"><span>HP <b>${d.hp}</b></span><span>Range <b>${range}</b></span><span>Speed <b>${d.speed}</b></span></div>`;
    box.classList.remove('hidden');
  }

  function updateSoundBtn() { $('btn-sound').textContent = `Sound: ${G.audio.on ? 'on' : 'off'}`; }

  UI.act = function (a) {
    const cam = G.cam;
    switch (a) {
      case 'campaign': G.ensureAttract(); UI.showLevels(); break;
      case 'sandbox': UI.selectTool(null); G.startSandbox(); break;
      case 'howto': UI.showHowto(); break;
      case 'menu': G.ensureAttract(); UI.showMenu(); break;
      case 'sound':
        G.audio.on = !G.audio.on;
        UI.save.sound = G.audio.on;
        G.writeSave(UI.save);
        updateSoundBtn();
        break;
      case 'exit': case 'leave': G.exitToMenu(); break;
      case 'start': G.startBattle(); break;
      case 'clear': G.clearPlaced(); break;
      case 'random': G.randomSandbox(); break;
      case 'newmap': G.newSandboxMap(); break;
      case 'pause': G.paused = !G.paused; UI.refreshButtons(); break;
      case 'slow': G.slowmo = !G.slowmo; UI.refreshButtons(); break;
      case 'cine': cam.auto = !cam.auto; cam.follow = null; UI.refreshButtons(); break;
      case 'reset': case 'retry': G.resetBattle(); break;
      case 'next': UI.selectTool(null); G.startLevel(G.levelIdx + 1); break;
      case 'zoomin': cam.zoomAt(cam.w / 2, cam.h / 2, 1.25); break;
      case 'zoomout': cam.zoomAt(cam.w / 2, cam.h / 2, 0.8); break;
      case 'fit': cam.auto = false; cam.fit(); UI.refreshButtons(); break;
    }
  };

  UI.init = function () {
    buildPalette();
    $('ui').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b) {
        b.blur();
        G.audio.init();
        G.audio.play('ui');
        UI.act(b.dataset.act);
        return;
      }
      const tb = e.target.closest('[data-team]');
      if (tb) { tb.blur(); G.audio.init(); setTeam(+tb.dataset.team); }
    });
    updateSoundBtn();
  };
})(window.WW);
