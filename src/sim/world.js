// Simulation state + fixed-step update. Render-agnostic: visuals and audio are requested
// through `hooks`, which the renderer fills in. Keeping this boundary clean is what makes
// a future lockstep / server-authoritative multiplayer mode possible.
import { terrain } from './terrain.js';
import { Unit, resetIds } from './unit.js';
import { think } from './ai.js';
import { updateProjectiles, statuses, explode } from './combat.js';
import { P } from './body.js';
import { DT, seedSim, clamp } from '../util.js';
import { UNITS } from '../data/factions.js';

const noop = () => {};
export const hooks = { fx: noop, sound: noop, event: noop, shake: noop };

export const world = {
  units: [],
  alive: [],
  teamAlive: [[], []],
  projectiles: [],
  pendingBooms: [],
  time: 0,
  battleOn: false,
  battleTime: 0,
  lastDamage: 0,
  over: false,
  winner: -1,
  corpseCap: 250,
  unitCap: 400,
  stats: { lost: [0, 0], raised: [0, 0] },
  addUnit,
  removeUnit,
};

// ---------------------------------------------------------------- spatial grid (alive units)
const GC = 4, GN = 64, GOFF = (GN * GC) / 2;
const cellStart = new Int32Array(GN * GN + 1);
const cellCount = new Int32Array(GN * GN);
let cellItems = new Int32Array(1024);
let gridList = [];
const cellOf = (x, z) => clamp(((x + GOFF) / GC) | 0, 0, GN - 1) + clamp(((z + GOFF) / GC) | 0, 0, GN - 1) * GN;

function gridRebuild(list) {
  gridList = list;
  cellCount.fill(0);
  if (cellItems.length < list.length) cellItems = new Int32Array(list.length * 2);
  for (let i = 0; i < list.length; i++) { const u = list[i]; u._cell = cellOf(u.ax, u.az); cellCount[u._cell]++; }
  let s = 0;
  for (let c = 0; c < GN * GN; c++) { cellStart[c] = s; s += cellCount[c]; }
  cellStart[GN * GN] = s;
  cellCount.fill(0);
  for (let i = 0; i < list.length; i++) { const c = list[i]._cell; cellItems[cellStart[c] + cellCount[c]++] = i; }
}

// Alive units whose anchor cell overlaps the circle. `out` is reused (caller must not hold it).
export function gridQuery(x, z, r, out) {
  out.length = 0;
  const x0 = clamp(((x - r + GOFF) / GC) | 0, 0, GN - 1), x1 = clamp(((x + r + GOFF) / GC) | 0, 0, GN - 1);
  const z0 = clamp(((z - r + GOFF) / GC) | 0, 0, GN - 1), z1 = clamp(((z + r + GOFF) / GC) | 0, 0, GN - 1);
  for (let gz = z0; gz <= z1; gz++) {
    for (let gx = x0; gx <= x1; gx++) {
      const c = gx + gz * GN;
      const e = cellStart[c] + cellCount[c];
      for (let k = cellStart[c]; k < e; k++) out.push(gridList[cellItems[k]]);
    }
  }
  return out;
}

// ---------------------------------------------------------------- unit management
function addUnit(type, team, x, z, yaw, force) {
  if (!UNITS[type]) return null;
  if (!force && world.units.length - corpseCount() >= world.unitCap) return null;
  const u = new Unit(type, team, x, z, yaw);
  world.units.push(u);
  return u;
}

function removeUnit(u) {
  const i = world.units.indexOf(u);
  if (i >= 0) world.units.splice(i, 1);
}

function corpseCount() {
  let n = 0;
  for (const u of world.units) if (!u.alive) n++;
  return n;
}

export function resetWorld() {
  world.units.length = 0;
  world.alive.length = 0;
  world.teamAlive[0].length = 0;
  world.teamAlive[1].length = 0;
  world.projectiles.length = 0;
  world.pendingBooms.length = 0;
  world.time = 0;
  world.battleOn = false;
  world.battleTime = 0;
  world.lastDamage = 0;
  world.over = false;
  world.winner = -1;
  world.stats = { lost: [0, 0], raised: [0, 0] };
  resetIds();
}

export function beginBattle(seed) {
  seedSim(seed);
  world.battleOn = true;
  world.battleTime = 0;
  world.lastDamage = 0;
  world.over = false;
  world.winner = -1;
}

// ---------------------------------------------------------------- step
const near = [];
export function step() {
  world.time += DT;
  const fighting = world.battleOn && !world.over;
  if (fighting) world.battleTime += DT;

  const alive = world.alive, A0 = world.teamAlive[0], A1 = world.teamAlive[1];
  alive.length = 0; A0.length = 0; A1.length = 0;
  for (const u of world.units) {
    if (!u.alive) continue;
    alive.push(u);
    (u.team ? A1 : A0).push(u);
    u.engaged = 0;
  }
  for (const u of alive) if (u.target && u.target.alive) u.target.engaged++;
  gridRebuild(alive);

  for (const u of world.units) u.update(fighting, think);
  collide(alive);
  updateProjectiles();
  for (const u of alive) statuses(u);

  // delayed mech explosions
  for (let i = world.pendingBooms.length - 1; i >= 0; i--) {
    const b = world.pendingBooms[i];
    if (world.time >= b.t) {
      world.pendingBooms.splice(i, 1);
      explode(b.u.cx(), b.u.cy(), b.u.cz(), 4.5 * b.u.size * 0.6, 180, 20, b.u, {});
    }
  }

  manageCorpses();
  if (fighting) checkEnd();
}

function collide(alive) {
  for (const u of alive) {
    const ru = 0.34 * u.size;
    gridQuery(u.ax, u.az, ru + 1.6, near);
    for (const v of near) {
      if (v.id <= u.id) continue;
      const minD = ru + 0.34 * v.size;
      let dx = v.ax - u.ax, dz = v.az - u.az;
      const d2 = dx * dx + dz * dz;
      if (d2 >= minD * minD) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-4) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d = Math.hypot(dx, dz); }
      const push = (minD - d) / d;
      const mu = u.def.mass, mv = v.def.mass, tot = mu + mv;
      const ku = (push * mv) / tot * 0.5, kv = (push * mu) / tot * 0.5;
      u.ax -= dx * ku; u.az -= dz * ku;
      v.ax += dx * kv; v.az += dz * kv;
      shove(u, -dx * ku, -dz * ku);
      shove(v, dx * kv, dz * kv);
    }
    // props, machines
    for (const s of terrain.solids) {
      const dx = u.ax - s.x, dz = u.az - s.z, m = s.r + ru;
      const d2 = dx * dx + dz * dz;
      if (d2 < m * m && d2 > 1e-6) { const d = Math.sqrt(d2), k = (m - d) / d; u.ax += dx * k; u.az += dz * k; }
    }
  }
  // siege engines block living units
  for (const m of world.units) {
    if (!m.def.machine) continue;
    gridQuery(m.mx, m.mz, 2.5, near);
    for (const u of near) {
      const dx = u.ax - m.mx, dz = u.az - m.mz, r = 0.9 + 0.34 * u.size;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2), k = (r - d) / d; u.ax += dx * k; u.az += dz * k; }
    }
  }
}

function shove(u, dx, dz) {
  const p = u.p;
  for (const i of [P.PELVIS, P.NECK, P.LHIP, P.RHIP]) { p[i * 3] += dx * 0.6; p[i * 3 + 2] += dz * 0.6; }
}

function manageCorpses() {
  let n = 0;
  for (let i = world.units.length - 1; i >= 0; i--) {
    const u = world.units[i];
    if (u.alive) continue;
    if (u.sink) {
      u.sink += DT;
      u.asleep = true;
      for (let k = 1; k < u.p.length; k += 3) { u.p[k] -= DT * 0.5; u.o[k] = u.p[k]; }
      if (u.sink > 2.5) { world.units.splice(i, 1); }
      continue;
    }
    n++;
    if (n > world.corpseCap) u.sink = 0.001;
  }
}

function checkEnd() {
  const a = world.teamAlive[0].length, b = world.teamAlive[1].length;
  // stalemate guard: nobody has hurt anybody for 30 s, or the battle drags past 5 minutes
  if (a && b && world.battleTime < 300 && world.battleTime - world.lastDamage < 30) return;
  world.over = true;
  if (a && b) {
    // stalemate: side with more value standing wins
    const v = (L) => L.reduce((s, u) => s + u.def.cost * (u.hp / u.maxHp), 0);
    world.winner = v(world.teamAlive[0]) >= v(world.teamAlive[1]) ? 0 : 1;
  } else world.winner = a ? 0 : b ? 1 : -1;
  hooks.event({ type: 'end', winner: world.winner });
}
