// Game controller: modes (menu backdrop, placement, battle, results), input, camera,
// fixed-step simulation loop with render interpolation, campaign / sandbox / gauntlet flow.
import * as THREE from 'three';
import { Stage } from './render/scene.js';
import { CamCtl } from './render/camera.js';
import { drawUnit, drawHealthBar } from './render/unitdraw.js';
import { setupPortraits, pumpPortraits, warmPortraits } from './render/portraits.js';
import { world, hooks, step, resetWorld, beginBattle } from './sim/world.js';
import { terrain } from './sim/terrain.js';
import { UNITS, FACTIONS, unitsOf } from './data/factions.js';
import { LEVELS, allowedUnits, starsFor, layout, randomArmy, randomBiome, encodeBattle, decodeBattle, levelUnlocked } from './data/levels.js';
import { audio } from './audio.js';
import { save, persist } from './save.js';
import * as ui from './ui/ui.js';
import { DT, clamp, fmtMoney } from './util.js';

const $ = ui.$;
const ALL_UNITS = Object.keys(UNITS);

const G = {
  mode: 'boot',
  kind: null, // menu | campaign | sandbox | gauntlet
  level: null,
  chapter: 0,
  budget: Infinity,
  placeTeam: 0,
  selected: null,
  faction: FACTIONS[0].id,
  placed: [[], []],
  speed: 1,
  slow: false,
  hover: null,
  possessed: null,
  gauntletRound: 1,
  endAt: -1,
  resultsShown: false,
  map: { biome: 'grass', seed: 7, hilly: 0.6 },
  battleSeed: 1,
  uiHidden: false,
  spent: 0,
  prevScreen: 'scr-menu',
};

let stage, cam, canvas;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const frustum = new THREE.Frustum();
const projM = new THREE.Matrix4();
const sphere = new THREE.Sphere();
const tmpV = new THREE.Vector3(), tmpR = new THREE.Vector3();
const mouse = { x: 0, y: 0, inside: false, left: false, right: false, drag: null };
let Gb; // shared body-part batches
let hudT = 0, fpsT = 0, fpsN = 0, fpsLast = 0;

// ================================================================ boot
export async function boot() {
  canvas = $('game');
  ui.setBoot(0.1);
  stage = new Stage(canvas);
  cam = new CamCtl(stage.camera);
  const U = stage.units;
  Gb = { torso: U.geo('torso', stage.geoms.torso), cube: U.geo('cube', stage.geoms.cube), limb: U.geo('limb', stage.geoms.limb), head: U.geo('head', stage.geoms.head), bar: stage.fxb.geo('bar', stage.geoms.cube, true) };
  setupPortraits(stage.geoms);
  applySettings();
  wireHooks();
  wireInput();
  ui.buildLogo();
  ui.bindSettings(applySettings);
  ui.bindActions(actions);
  ui.setBoot(0.4);
  // first terrain + portraits
  terrain.gen(7, 'grass', 0.6);
  stage.applyBiome();
  warmPortraits();
  ui.setBoot(0.8);
  window.addEventListener('resize', () => stage.resize());
  window.WW = { G, world, terrain, stage, cam, advance: (n) => advance(n) }; // console debugging handle
  requestAnimationFrame(loop);
  toMenu();
  ui.setBoot(1);
  setTimeout(ui.hideBoot, 150);
}

function applySettings() {
  const s = save.settings;
  stage.setQuality(s.quality, s.shadows);
  audio.setVolume(s.volume);
  world.unitCap = s.unitCap;
  world.corpseCap = s.corpses;
  $('fps').classList.toggle('hidden', !s.fps);
  persist();
}

function wireHooks() {
  hooks.fx = (name, a, b, c, d, e, f, g, h) => stage.fx.emit(name, a, b, c, d, e, f, g, h);
  hooks.sound = (name, x, y, z, vol = 1) => audio.play(name, x, y, z, vol * (G.kind === 'menu' ? 0.35 : 1));
  hooks.shake = (x, y, z, r) => {
    const d = stage.camera.position.distanceTo(tmpV.set(x, y, z));
    cam.shake(Math.max(0, r * 0.25 - d * 0.012));
  };
  hooks.event = (ev) => {
    if (ev.type === 'kill') {
      if (G.kind !== 'menu') ui.feed(ev);
      if (ev.victim === G.possessed) releasePossess();
    } else if (ev.type === 'end') onBattleEnd(ev.winner);
  };
}

// ================================================================ setup
function setTerrain(biome, seed, hilly, force = false) {
  const changed = force || terrain.biomeKey !== biome || terrain.seed !== seed || terrain.hilly !== hilly;
  if (changed) {
    terrain.gen(seed, biome, hilly);
    stage.applyBiome();
  }
  G.map = { biome, seed, hilly };
}

function spawnPlaced() {
  resetWorld();
  stage.fx.clear();
  for (let team = 0; team < 2; team++) {
    for (const rec of G.placed[team]) {
      const u = world.addUnit(rec[0], team, rec[1], rec[2], undefined, true);
      if (u) u.rec = rec;
    }
  }
}

function setupBattle(opt) {
  releasePossess();
  G.kind = opt.kind;
  G.level = opt.level || null;
  G.budget = opt.budget ?? Infinity;
  G.placeTeam = 0;
  G.resultsShown = false;
  G.endAt = -1;
  G.speed = 1; G.slow = false;
  setTerrain(opt.biome, opt.seed, opt.hilly, true);
  if (opt.enemyGroups) opt.enemy = layout(opt.enemyGroups, 1);
  G.placed = [opt.player || [], opt.enemy || []];
  spawnPlaced();
  world.battleOn = false;
  G.mode = 'place';
  ui.clearFeed();
  ui.show(null);
  $('hud').classList.remove('hidden');
  const facs = paletteFactions();
  if (!facs.includes(G.faction)) G.faction = facs[facs.length - 1];
  const pool = unitsOf(G.faction);
  G.selected = pool[0] ? pool[0].key : null;
  refreshPalette();
  cam.frame(0);
  setHud();
}

function paletteFactions() {
  if (G.kind === 'campaign' && G.level) return FACTIONS.slice(0, G.level.chapter + 1).map((f) => f.id);
  return FACTIONS.map((f) => f.id);
}

function refreshPalette() {
  ui.renderPalette({
    factions: paletteFactions(),
    faction: G.faction,
    units: unitsOf(G.faction).filter((u) => G.kind !== 'campaign' || allowedUnits(G.level).includes(u.key)),
    selected: G.selected,
    budgetLeft: budgetLeft(),
    onSelect: (k) => { G.selected = k; audio.play('ui'); refreshPalette(); },
    onFaction: (f) => { G.faction = f; const p = unitsOf(f); G.selected = p[0].key; audio.play('ui'); refreshPalette(); },
  });
}

const spentOf = (team) => G.placed[team].reduce((s, r) => s + UNITS[r[0]].cost, 0);
const budgetLeft = () => (G.budget === Infinity ? Infinity : G.budget - spentOf(0));

function setHud() {
  const hud = $('hud');
  hud.classList.toggle('mode-place', G.mode === 'place');
  hud.classList.toggle('mode-battle', G.mode !== 'place');
  hud.classList.toggle('is-sandbox', G.kind === 'sandbox');
  let title = '', sub = '';
  if (G.kind === 'campaign') { title = G.level.name; sub = G.level.tip; }
  else if (G.kind === 'sandbox') { title = 'Sandbox'; sub = 'Build both armies. Unlimited gold.'; }
  else if (G.kind === 'gauntlet') { title = `Gauntlet · Round ${G.gauntletRound}`; sub = `Best: round ${save.gauntletBest || 0}. One loss ends the run.`; }
  $('hud-title').textContent = title;
  $('hud-sub').textContent = sub;
  stage.showZones(G.mode === 'place' ? (G.kind === 'sandbox' ? 'both' : 0) : null);
  $('hint').textContent = G.mode === 'place'
    ? 'Click / drag to deploy · Right-click to remove · Right-drag to look · WASD to fly · Space to start'
    : 'Click a unit to follow · F to take control · C cinematic · T slow-mo · R reset';
  updateBudgetChip();
}

function updateBudgetChip() {
  const el = $('budget');
  if (G.budget === Infinity) {
    el.textContent = `Blue ${fmtMoney(spentOf(0))} · Red ${fmtMoney(spentOf(1))}`;
    el.classList.remove('over');
  } else {
    const left = budgetLeft();
    el.textContent = `${fmtMoney(left)} / ${fmtMoney(G.budget)}`;
    el.classList.toggle('over', left < 0);
  }
}

// ================================================================ modes
function toMenu() {
  releasePossess();
  G.kind = 'menu';
  G.mode = 'menu';
  $('hud').classList.add('hidden');
  ui.show('scr-menu');
  const best = save.gauntletBest ? ` · Gauntlet best: ${save.gauntletBest}` : '';
  const stars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  $('menu-stats').textContent = `★ ${stars} stars${best}`;
  startAttract();
}

function startAttract() {
  const biome = randomBiome();
  setTerrain(biome, (Math.random() * 1e6) | 0, 0.5 + Math.random() * 0.5, true);
  const f1 = FACTIONS[(Math.random() * FACTIONS.length) | 0].id, f2 = FACTIONS[(Math.random() * FACTIONS.length) | 0].id;
  const pool = (f) => unitsOf(f).map((u) => u.key);
  G.placed = [layout(randomArmy(2600, pool(f1)), 0), layout(randomArmy(2600, pool(f2)), 1)];
  spawnPlaced();
  stage.showZones(null);
  G.battleSeed = (Math.random() * 1e9) | 0;
  beginBattle(G.battleSeed);
  G.endAt = -1;
  G.speed = 1;
  cam.mode = 'cine';
}

function startBattle() {
  if (G.mode !== 'place') return;
  if (!G.placed[0].length) { ui.toast('Deploy some units first'); audio.play('error'); return; }
  if (G.kind === 'sandbox' && !G.placed[1].length) { ui.toast('Red needs units too'); audio.play('error'); return; }
  if (budgetLeft() < 0) { ui.toast('Over budget'); audio.play('error'); return; }
  G.spent = spentOf(0);
  G.battleSeed = (Math.random() * 1e9) | 0;
  beginBattle(G.battleSeed);
  G.mode = 'battle';
  G.endAt = -1;
  G.resultsShown = false;
  setSpeed(1);
  setHud();
  audio.play('start');
}

function resetBattle() {
  if (G.kind === 'menu') return;
  releasePossess();
  setTerrain(G.map.biome, G.map.seed, G.map.hilly, true);
  spawnPlaced();
  world.battleOn = false;
  G.mode = 'place';
  G.endAt = -1;
  G.resultsShown = false;
  ui.show(null);
  ui.clearFeed();
  setHud();
  refreshPalette();
}

function onBattleEnd(winner) {
  G.endAt = performance.now();
  G.endWinner = winner;
  if (G.kind === 'menu') return;
  G.slowEnd = true;
}

function showResults() {
  G.resultsShown = true;
  G.mode = 'results';
  const winner = G.endWinner;
  const dead = (team) => world.units.filter((u) => u.team === team && !u.alive && !u.raised).length;
  const pool = world.units.filter((u) => G.kind === 'sandbox' || u.team === 0);
  const mvp = pool.reduce((b, u) => (u.kills > (b ? b.kills : 0) ? u : b), null);
  const t = Math.round(world.battleTime);
  const stats = [['Battle time', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`]];
  if (G.kind === 'campaign') {
    const win = winner === 0;
    let stars = null;
    if (win) {
      stars = starsFor(G.spent, G.budget);
      const id = G.level.id;
      save.stars[id] = Math.max(save.stars[id] || 0, stars);
      persist();
    }
    const next = nextLevel();
    stats.unshift(['Gold spent', `${fmtMoney(G.spent)} / ${fmtMoney(G.budget)}`], ['Enemies defeated', dead(1)], ['Units lost', dead(0)]);
    ui.showResults({ title: win ? 'VICTORY' : 'DEFEAT', cls: win ? 'win' : 'lose', stars, stats, mvp: win ? mvp : null, next: win && next, leaveLabel: 'Levels' });
    audio.play(win ? 'win' : 'lose');
  } else if (G.kind === 'gauntlet') {
    const win = winner === 0;
    if (!win) { save.gauntletBest = Math.max(save.gauntletBest || 0, G.gauntletRound - 1); persist(); }
    stats.unshift(['Enemies defeated', dead(1)], ['Units lost', dead(0)]);
    if (!win) stats.unshift(['Rounds cleared', G.gauntletRound - 1], ['Best ever', save.gauntletBest]);
    ui.showResults({ title: win ? `ROUND ${G.gauntletRound} CLEARED` : 'RUN OVER', cls: win ? 'win' : 'lose', stars: null, stats, mvp, next: win, nextLabel: 'Next round', retryLabel: win ? 'Replay' : 'New run', leaveLabel: 'Menu' });
    audio.play(win ? 'win' : 'lose');
  } else {
    stats.unshift(['Blue lost', dead(0)], ['Red lost', dead(1)]);
    ui.showResults({ title: winner === 0 ? 'BLUE WINS' : winner === 1 ? 'RED WINS' : 'DRAW', cls: winner === 0 ? 'blue' : 'red', stars: null, stats, mvp, next: false, leaveLabel: 'Menu', retryLabel: 'Edit armies' });
    audio.play('win');
  }
}

function nextLevel() {
  if (!G.level) return null;
  const i = LEVELS.indexOf(G.level);
  const n = LEVELS[i + 1];
  return n && levelUnlocked(n, save.stars) ? n : null;
}

function startLevel(lv) {
  G.chapter = lv.chapter;
  G.faction = FACTIONS[lv.chapter].id;
  setupBattle({ kind: 'campaign', level: lv, biome: lv.biome, seed: lv.seed, hilly: lv.hilly, budget: lv.budget, enemyGroups: lv.enemy });
}

function startSandbox(code) {
  if (code) {
    setupBattle({ kind: 'sandbox', biome: code.biome, seed: code.seed, hilly: code.hilly, player: code.units.filter((u) => u[1] === 0).map(([t, , x, z]) => [t, x, z]), enemy: code.units.filter((u) => u[1] === 1).map(([t, , x, z]) => [t, x, z]) });
    return;
  }
  setupBattle({ kind: 'sandbox', biome: G.map.biome || 'grass', seed: (Math.random() * 1e6) | 0, hilly: 0.6 });
}

function startGauntlet(round) {
  G.gauntletRound = round;
  const eb = 600 + round * 550;
  const fac = FACTIONS[(Math.random() * FACTIONS.length) | 0].id;
  const pool = Math.random() < 0.5 ? unitsOf(fac).map((u) => u.key) : ALL_UNITS;
  const groups = randomArmy(eb, pool);
  const real = groups.reduce((s, g) => s + UNITS[g[0]].cost * g[1], 0);
  setupBattle({ kind: 'gauntlet', biome: randomBiome(), seed: (Math.random() * 1e6) | 0, hilly: 0.3 + Math.random() * 0.8, budget: Math.round((real * 1.12) / 50) * 50, enemyGroups: groups });
}

// ================================================================ placement
function pickGround(cx, cy) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, stage.camera);
  const o = raycaster.ray.origin, d = raycaster.ray.direction;
  const t = terrain.raycast(o.x, o.y, o.z, d.x, d.y, d.z, 500);
  if (t < 0) return null;
  return { x: o.x + d.x * t, y: o.y + d.y * t, z: o.z + d.z * t };
}

function canPlace(type, team, x, z) {
  if (!terrain.inZone(team, x, z)) return 'Place units inside your zone';
  if (terrain.water !== null && terrain.heightAt(x, z) < terrain.water - 0.9) return 'Too deep';
  if (team === 0 && G.budget !== Infinity && UNITS[type].cost > budgetLeft()) return 'Not enough gold';
  if (world.units.length >= world.unitCap) return `Unit limit reached (${world.unitCap})`;
  for (const u of world.units) {
    const min = (u.def.machine || UNITS[type].machine ? 2.2 : 0.55) * Math.max(u.size, UNITS[type].size);
    if (u.team === team && Math.hypot(u.ax - x, u.az - z) < min) return 'blocked';
  }
  return null;
}

function placeAt(x, z, quiet) {
  const type = G.selected;
  if (!type || type === 'erase') return false;
  const team = G.placeTeam;
  const err = canPlace(type, team, x, z);
  if (err) { if (!quiet && err !== 'blocked') { ui.toast(err); audio.play('error'); } return false; }
  const rec = [type, x, z];
  const u = world.addUnit(type, team, x, z, undefined, true);
  if (!u) return false;
  u.rec = rec;
  G.placed[team].push(rec);
  audio.play('place');
  stage.fx.emit('dust', x, terrain.heightAt(x, z), z, 0.5);
  updateBudgetChip();
  ui.updateAfford(budgetLeft());
  return true;
}

function removeNear(x, z, radius = 1.4) {
  let best = null, bd = radius;
  for (const u of world.units) {
    if (!u.rec) continue;
    if (G.kind !== 'sandbox' && u.team !== 0) continue;
    if (G.kind === 'sandbox' && u.team !== G.placeTeam) continue;
    const d = Math.hypot(u.ax - x, u.az - z) - (u.def.machine ? 1.5 : 0);
    if (d < bd) { bd = d; best = u; }
  }
  if (!best) return false;
  const list = G.placed[best.team];
  const i = list.indexOf(best.rec);
  if (i >= 0) list.splice(i, 1);
  world.removeUnit(best);
  audio.play('remove');
  updateBudgetChip();
  ui.updateAfford(budgetLeft());
  return true;
}

// ================================================================ possession
function lockPointer() {
  try { const p = canvas.requestPointerLock?.(); if (p && p.catch) p.catch(() => {}); } catch { /* not allowed right now */ }
}

function possess(u) {
  if (!u || !u.alive || u.sink) return;
  if (G.kind !== 'sandbox' && u.team !== 0) { ui.toast('You can only control your own units'); return; }
  releasePossess();
  G.possessed = u;
  u.player = { mx: 0, mz: 0, aimYaw: u.yaw, aimPitch: 0, fire: false, jump: false };
  cam.mode = 'possess';
  cam.follow = u;
  cam.yaw = u.yaw;
  cam.pitch = -0.12;
  lockPointer();
  const hint = $('possess-hint');
  hint.innerHTML = `Controlling <b>${u.def.name}</b> · WASD move · Mouse aim · Click attack · Space leap · F release`;
  hint.classList.remove('hidden');
}

function releasePossess() {
  const u = G.possessed;
  if (!u) return;
  u.player = null;
  G.possessed = null;
  if (document.pointerLockElement) document.exitPointerLock?.();
  $('possess-hint').classList.add('hidden');
  if (cam.mode === 'possess') cam.setFree(true);
}

function updatePossessInput() {
  const u = G.possessed;
  if (!u) return;
  const k = cam.keys;
  const fx = Math.cos(cam.yaw), fz = Math.sin(cam.yaw);
  let mx = 0, mz = 0;
  if (k.w) { mx += fx; mz += fz; }
  if (k.s) { mx -= fx; mz -= fz; }
  if (k.a) { mx += fz; mz -= fx; }
  if (k.d) { mx -= fz; mz += fx; }
  const l = Math.hypot(mx, mz);
  if (l > 0) { mx /= l; mz /= l; }
  const p = u.player;
  p.mx = mx; p.mz = mz;
  p.aimYaw = cam.yaw;
  p.aimPitch = clamp(cam.pitch + 0.12, -0.9, 0.9);
  p.fire = mouse.left;
}

// ================================================================ hover / picking
function pickUnit(cx, cy, maxPx = 34) {
  const r = canvas.getBoundingClientRect();
  let best = null, bd = maxPx;
  for (const u of world.units) {
    if (u.sink) continue;
    tmpV.set(u.cx(), u.cy() + 0.2 * u.size, u.cz()).project(stage.camera);
    if (tmpV.z > 1) continue;
    const sx = (tmpV.x * 0.5 + 0.5) * r.width + r.left, sy = (-tmpV.y * 0.5 + 0.5) * r.height + r.top;
    const d = Math.hypot(sx - cx, sy - cy) - (u.alive ? 6 : 0);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function updateTooltip() {
  const tip = $('tooltip');
  const u = G.hover;
  if (!u || G.possessed || !mouse.inside || G.mode === 'menu') { tip.classList.add('hidden'); return; }
  const f = Math.max(0, u.hp / u.maxHp);
  const col = u.team ? '#e04545' : '#3d7fe0';
  tip.innerHTML = `${u.def.name}${u.alive ? '' : ' (down)'}${u.kills ? ` · ${u.kills} kill${u.kills > 1 ? 's' : ''}` : ''}<div class="hpb"><i style="width:${f * 100}%;background:${col}"></i></div>`;
  tip.style.left = mouse.x + 'px';
  tip.style.top = mouse.y + 'px';
  tip.classList.remove('hidden');
}

// ================================================================ input
function wireInput() {
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    audio.init();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic or already-released pointer */ }
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (G.possessed) { if (e.button === 0) mouse.left = true; if (!document.pointerLockElement) lockPointer(); return; }
    mouse.drag = { btn: e.button, x0: e.clientX, y0: e.clientY, moved: false, last: null };
    if (e.button === 0) mouse.left = true;
    if (e.button === 2) mouse.right = true;
    if (G.mode === 'place' && e.button === 0) {
      const p = pickGround(e.clientX, e.clientY);
      if (p) {
        if (G.selected === 'erase') removeNear(p.x, p.z);
        else if (placeAt(p.x, p.z, false)) mouse.drag.last = p;
        mouse.drag.painting = true;
      }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const dx = e.clientX - mouse.x, dy = e.clientY - mouse.y;
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.inside = true;
    if (G.possessed && document.pointerLockElement === canvas) {
      cam.yaw += e.movementX * 0.0026;
      cam.pitch = clamp(cam.pitch - e.movementY * 0.0026, -1.1, 0.8);
      return;
    }
    const d = mouse.drag;
    if (!d) return;
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) d.moved = true;
    const look = d.btn === 2 || d.btn === 1 || (d.btn === 0 && !d.painting && G.mode !== 'place');
    if (look && d.moved) { cam.dragging = true; cam.look2(dx * 0.0045, dy * 0.0045); }
    if (d.painting && G.mode === 'place') {
      const p = pickGround(e.clientX, e.clientY);
      if (!p) return;
      if (G.selected === 'erase') removeNear(p.x, p.z);
      else {
        const sp = UNITS[G.selected] ? Math.max(1.2, 1.25 * UNITS[G.selected].size) * (UNITS[G.selected].machine ? 3 : 1) : 1.2;
        if (!d.last || Math.hypot(p.x - d.last.x, p.z - d.last.z) >= sp) { if (placeAt(p.x, p.z, true)) d.last = p; }
      }
    }
  });
  const up = (e) => {
    const d = mouse.drag;
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
    cam.dragging = false;
    mouse.drag = null;
    if (!d || G.possessed) return;
    if (!d.moved && d.btn === 2 && G.mode === 'place') {
      const p = pickGround(e.clientX, e.clientY);
      if (p) removeNear(p.x, p.z);
    }
    if (!d.moved && d.btn === 0 && G.mode !== 'place' && G.mode !== 'menu') {
      const u = pickUnit(e.clientX, e.clientY);
      if (u) { cam.startFollow(u); audio.play('ui'); }
      else if (cam.mode === 'follow') cam.setFree(true);
    }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { mouse.inside = false; });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.zoom(clamp(e.deltaY / 100, -3, 3)); }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    audio.init();
    const k = e.key.toLowerCase();
    if ('wasdqe'.includes(k) && k.length === 1) { cam.keys[k] = true; if (G.mode !== 'menu' && cam.mode === 'cine') cam.setFree(true); }
    if (k === 'arrowup') cam.keys.w = true;
    if (k === 'arrowdown') cam.keys.s = true;
    if (k === 'arrowleft') cam.keys.a = true;
    if (k === 'arrowright') cam.keys.d = true;
    if (k === 'shift') cam.boost = true;
    if (e.repeat) return;
    if (G.mode === 'menu') return;
    if (k === ' ') {
      e.preventDefault();
      if (G.possessed) { G.possessed.player.jump = true; return; }
      if (G.mode === 'place') startBattle();
      else if (G.mode === 'battle' || G.mode === 'results') setSpeed(G.speed === 0 ? 1 : 0);
    }
    if (G.mode === 'place') {
      const n = parseInt(k, 10);
      if (n >= 1 && n <= 9) {
        const list = unitsOf(G.faction);
        if (list[n - 1]) { G.selected = list[n - 1].key; refreshPalette(); }
      }
      if (k === 'x') { G.selected = 'erase'; refreshPalette(); }
    }
    if (k === 't') setSpeed(G.speed === 0.25 ? 1 : 0.25);
    if (k === 'c' && G.mode !== 'place') toggleCine();
    if (k === 'r') resetBattle();
    if (k === 'h') { G.uiHidden = !G.uiHidden; $('hud').classList.toggle('ui-hidden', G.uiHidden); }
    if (k === 'f' && (G.mode === 'battle' || G.mode === 'results')) {
      if (G.possessed) releasePossess();
      else possess(cam.mode === 'follow' ? cam.follow : G.hover);
    }
    if (k === 'escape') {
      if (G.possessed) releasePossess();
      else if (cam.mode === 'follow') cam.setFree(true);
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if ('wasdqe'.includes(k) && k.length === 1) cam.keys[k] = false;
    if (k === 'arrowup') cam.keys.w = false;
    if (k === 'arrowdown') cam.keys.s = false;
    if (k === 'arrowleft') cam.keys.a = false;
    if (k === 'arrowright') cam.keys.d = false;
    if (k === 'shift') cam.boost = false;
    if (k === ' ' && G.possessed) G.possessed.player.jump = false;
  });
  window.addEventListener('blur', () => { cam.keys = {}; cam.boost = false; mouse.left = mouse.right = false; });
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && G.possessed) { /* keep control; click re-locks */ }
  });

  $('team-switch').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-team]');
    if (!b) return;
    G.placeTeam = +b.dataset.team;
    for (const x of $('team-switch').children) x.classList.toggle('on', x === b);
    audio.play('ui');
  });
  $('speed-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-speed]');
    if (b) setSpeed(+b.dataset.speed);
  });
  $('map-hills').addEventListener('change', (e) => {
    setTerrain(G.map.biome, G.map.seed, +e.target.value, true);
    spawnPlaced();
  });
}

function setSpeed(s) {
  G.speed = s;
  for (const b of $('speed-seg').children) b.classList.toggle('on', +b.dataset.speed === s);
  audio.timeScale = s;
}

function toggleCine() {
  if (cam.mode === 'cine') cam.setFree(true);
  else { releasePossess(); cam.mode = 'cine'; }
  $('btn-cine').classList.toggle('blue', cam.mode === 'cine');
}

// ================================================================ actions (buttons)
const actions = {
  campaign: () => {
    audio.init(); audio.play('ui');
    // jump to the furthest unlocked chapter
    let ch = 0;
    FACTIONS.forEach((f, i) => { if (levelUnlocked(LEVELS.find((l) => l.chapter === i && l.index === 0), save.stars)) ch = i; });
    G.chapter = ch;
    showCampaign();
  },
  sandbox: () => { audio.init(); audio.play('ui'); startSandbox(); },
  gauntlet: () => { audio.init(); audio.play('ui'); startGauntlet(1); },
  settings: () => { G.prevScreen = 'scr-menu'; ui.show('scr-settings'); },
  howto: () => { G.prevScreen = 'scr-menu'; ui.show('scr-howto'); },
  back: () => ui.show(G.prevScreen),
  menu: () => { audio.play('ui'); toMenu(); },
  exit: () => {
    audio.play('ui');
    if (G.kind === 'campaign') { toMenu(); showCampaign(); }
    else toMenu();
  },
  start: () => startBattle(),
  clear: () => {
    const team = G.kind === 'sandbox' ? G.placeTeam : 0;
    G.placed[team] = [];
    spawnPlaced();
    updateBudgetChip();
    refreshPalette();
    audio.play('remove');
  },
  random: () => {
    const team = G.placeTeam;
    G.placed[team] = layout(randomArmy(2000 + Math.random() * 5000, ALL_UNITS), team);
    spawnPlaced();
    updateBudgetChip();
    audio.play('place');
  },
  map: () => { ui.renderBiomes(G.map.biome, pickBiome); $('map-hills').value = G.map.hilly; ui.overlay('scr-map', true); },
  closemap: () => ui.overlay('scr-map', false),
  reroll: () => { setTerrain(G.map.biome, (Math.random() * 1e6) | 0, G.map.hilly, true); spawnPlaced(); },
  code: () => {
    const units = [...G.placed[0].map(([t, x, z]) => [t, 0, x, z]), ...G.placed[1].map(([t, x, z]) => [t, 1, x, z])];
    $('code-box').value = encodeBattle({ biome: G.map.biome, seed: G.map.seed, hilly: G.map.hilly, units });
    ui.overlay('scr-code', true);
  },
  closecode: () => ui.overlay('scr-code', false),
  copycode: () => {
    const box = $('code-box');
    box.select();
    navigator.clipboard?.writeText(box.value).then(() => ui.toast('Copied', true), () => ui.toast('Select and copy the code'));
  },
  loadcode: () => {
    const b = decodeBattle($('code-box').value);
    if (!b) { ui.toast('That code does not look right'); return; }
    ui.overlay('scr-code', false);
    startSandbox(b);
    ui.toast('Battle loaded', true);
  },
  pause: () => setSpeed(G.speed === 0 ? 1 : 0),
  cine: () => toggleCine(),
  reset: () => resetBattle(),
  retry: () => {
    if (G.kind === 'gauntlet' && G.endWinner !== 0) { startGauntlet(1); return; }
    resetBattle();
  },
  watch: () => { ui.show(null); G.mode = 'battle'; setHud(); },
  next: () => {
    if (G.kind === 'gauntlet') { startGauntlet(G.gauntletRound + 1); return; }
    const n = nextLevel();
    if (n) startLevel(n);
  },
  leave: () => {
    if (G.kind === 'campaign') { toMenu(); showCampaign(); }
    else toMenu();
  },
};

function pickBiome(k) {
  setTerrain(k, G.map.seed, G.map.hilly, true);
  spawnPlaced();
  ui.renderBiomes(k, pickBiome);
}

function showCampaign() {
  ui.renderCampaign(G.chapter, (lv) => { audio.play('ui'); startLevel(lv); }, (ch) => { G.chapter = ch; audio.play('ui'); showCampaign(); });
  ui.show('scr-campaign');
}

// ================================================================ loop
let last = performance.now(), acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  frame(now);
}
// Debug/testing: advance n frames of simulated time (works when rAF is throttled).
function advance(n = 60) { for (let i = 0; i < n; i++) frame(last + 1000 / 60); }

function frame(now) {
  let dt = (now - last) / 1000;
  if (dt < 0) return; // clock went backwards (debug advance ran ahead)
  last = now;
  if (dt > 0.1) dt = 0.1;

  // time scale: pause, slow-mo, the dramatic final-kill slowdown
  let ts = G.speed;
  if (G.endAt > 0 && G.kind !== 'menu') {
    const since = (now - G.endAt) / 1000;
    if (since < 1.4) ts = Math.min(ts || 1, 0.3);
    if (since > 2.4 && !G.resultsShown && G.mode === 'battle') showResults();
  }
  if (G.kind === 'menu' && G.endAt > 0 && (now - G.endAt) / 1000 > 4) startAttract();
  if (G.possessed) updatePossessInput();

  acc += dt * ts;
  let steps = 0;
  while (acc >= DT && steps < 4) {
    step();
    acc -= DT;
    steps++;
    if (G.possessed) G.possessed.player && (G.possessed.player.jump = false);
  }
  if (steps === 4) acc = 0; // too slow: drop time rather than spiral
  const alpha = clamp(acc / DT, 0, 1);

  stage.fx.update(dt * ts);
  cam.update(dt);
  stage.camera.updateMatrixWorld();
  const cp = stage.camera.position;
  const camR = tmpR.setFromMatrixColumn(stage.camera.matrixWorld, 0);
  audio.listener(cp.x, cp.y, cp.z, camR.x, camR.z);

  // hover pick (cheap screen-space test)
  if (mouse.inside && !mouse.drag && G.mode !== 'menu') G.hover = pickUnit(mouse.x, mouse.y);
  else if (!mouse.inside) G.hover = null;
  updateTooltip();

  render(alpha, dt);
  pumpPortraits(3);
  stage.autoTune(dt);

  hudT -= dt;
  if (hudT <= 0) { hudT = 0.12; updateHud(); }
  fpsN++; fpsT += dt;
  if (fpsT > 0.5) {
    if (save.settings.fps) {
      const info = stage.renderer.info.render;
      $('fps').textContent = `${Math.round(fpsN / fpsT)} fps · ${world.alive.length}/${world.units.length} units · ${info.calls} draws · ${stage.qualityKey}`;
    }
    fpsLast = fpsN / fpsT; fpsN = 0; fpsT = 0;
  }
}

const camRight = [0, 0, 0], camUp = [0, 0, 0], camFwd = [0, 0, 0];
function render(alpha) {
  const camM = stage.camera.matrixWorld.elements;
  camRight[0] = camM[0]; camRight[1] = camM[1]; camRight[2] = camM[2];
  camUp[0] = camM[4]; camUp[1] = camM[5]; camUp[2] = camM[6];
  camFwd[0] = camM[8]; camFwd[1] = camM[9]; camFwd[2] = camM[10];
  projM.multiplyMatrices(stage.camera.projectionMatrix, stage.camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projM);
  const U = stage.units, F = stage.fxb;
  U.begin(); F.begin();
  const bars = save.settings.healthBars && G.mode !== 'menu';
  const cp = stage.camera.position;
  for (const u of world.units) {
    const s = u.size;
    sphere.center.set(u.p[6], u.p[7], u.p[8]);
    sphere.radius = 2.2 * s + (u.def.machine ? 3 : 0);
    if (!frustum.intersectsSphere(sphere)) continue;
    drawUnit(U, Gb, u, alpha);
    if (bars && u.alive && u.hp < u.maxHp && sphere.center.distanceToSquared(cp) < 3600) drawHealthBar(Gb, u, alpha, camRight, camUp, camFwd);
  }
  stage.fx.drawProjectiles(F, world.projectiles, alpha, camRight);
  stage.fx.draw(F, null, alpha, camRight);
  U.end(); F.end();

  // marker: placement cursor / followed unit
  const mk = stage.marker;
  mk.visible = false;
  if (G.mode === 'place' && mouse.inside && !mouse.drag && G.selected && G.selected !== 'erase') {
    const p = pickGround(mouse.x, mouse.y);
    if (p) {
      const err = canPlace(G.selected, G.placeTeam, p.x, p.z);
      mk.visible = true;
      mk.position.set(p.x, p.y + 0.1, p.z);
      const s = UNITS[G.selected].size * (UNITS[G.selected].machine ? 2.5 : 1);
      mk.scale.set(s, 1, s);
      mk.material.color.set(err && err !== 'blocked' ? '#ff5050' : '#ffffff');
    }
  } else if ((cam.mode === 'follow' || cam.mode === 'possess') && cam.follow && !cam.follow.sink) {
    const u = cam.follow;
    mk.visible = true;
    mk.position.set(u.p[6], terrain.surfaceAt(u.p[6], u.p[8]) + 0.1, u.p[8]);
    mk.scale.set(u.size, 1, u.size);
    mk.material.color.set('#ffc83a');
  }

  stage.syncTerrain();
  stage.animateWater(performance.now() / 1000);
  stage.animateClouds(1 / 60);
  stage.render();
}

function updateHud() {
  if (G.mode === 'menu') return;
  const a = world.teamAlive[0].length, b = world.teamAlive[1].length;
  $('army0').textContent = a;
  $('army1').textContent = b;
  const va = world.teamAlive[0].reduce((s, u) => s + u.def.cost * (u.hp / u.maxHp), 0);
  const vb = world.teamAlive[1].reduce((s, u) => s + u.def.cost * (u.hp / u.maxHp), 0);
  $('army-fill').style.width = `${va + vb > 0 ? (va / (va + vb)) * 100 : 50}%`;
  const t = Math.floor(world.battleTime);
  $('battle-time').textContent = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  if (G.mode === 'place') updateBudgetChip();
}

export { G };
