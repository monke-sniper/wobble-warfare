// Attacks, projectiles, hit detection, shields, explosions, damage and death.
import { world, hooks, gridQuery } from './world.js';
import { terrain } from './terrain.js';
import { Unit } from './unit.js';
import { P, NP, RAD, impulse, impulseAll } from './body.js';
import { rr, rnd, segSphere, DT, clamp } from '../util.js';

const SHIELD_R = { hide: 0.42, kite: 0.48, heater: 0.45, tower: 0.75, hoplon: 0.55, round: 0.5, riot: 0.7 };
const SHIELD_BLOCK = { hide: 0.75, kite: 0.9, heater: 0.92, tower: 1, hoplon: 0.9, round: 0.85, riot: 1 };
// Machine muzzle offsets: [forward, up] in metres from the machine origin.
export const MUZZLE = { catapult: [-0.4, 2.3], ballista: [1.1, 1.05], cannon: [1.55, 0.62], hwacha: [0.5, 1.25], gatling: [1.25, 0.95] };

const tmp = [];

// ---------------------------------------------------------------- helpers
export function aimDir(u, out) {
  const cp = Math.cos(u.aimPitch);
  out[0] = Math.cos(u.aimYaw) * cp; out[1] = Math.sin(u.aimPitch); out[2] = Math.sin(u.aimYaw) * cp;
  return out;
}

export function origin(u, out) {
  const w = u.w, s = u.size;
  if (u.def.machine) {
    const m = MUZZLE[u.def.machine];
    out[0] = u.mx + Math.cos(u.myaw) * m[0]; out[1] = terrain.heightAt(u.mx, u.mz) + m[1]; out[2] = u.mz + Math.sin(u.myaw) * m[0];
    return out;
  }
  const hi = w.hold === 'bow' ? P.LHAND : (w.hold === 'dual' && u.atkSide ? P.LHAND : P.RHAND);
  const wd = hi === P.LHAND && w.hold === 'dual' ? u.wd2 : u.wd;
  const len = w.kind === 'gun' ? (w.hold === 'pistol' || w.hold === 'dual' ? 0.32 : w.hold === 'heavy' ? 1.0 : 0.75) * s : 0.1 * s;
  const j = hi * 3;
  if (w.hold === 'bow' || w.hold === 'throw' || w.hold === 'staff') {
    out[0] = u.p[j]; out[1] = u.p[j + 1] + (w.hold === 'staff' ? 0.6 * s : 0); out[2] = u.p[j + 2];
  } else {
    out[0] = u.p[j] + wd[0] * len; out[1] = u.p[j + 1] + wd[1] * len; out[2] = u.p[j + 2] + wd[2] * len;
  }
  return out;
}

// Launch pitch to hit a point dx,dy,dz away with speed v under gravity g (rad).
export function ballistic(d, dy, v, g, high) {
  if (g <= 0) return Math.atan2(dy, d);
  const v2 = v * v;
  const disc = v2 * v2 - g * (g * d * d + 2 * dy * v2);
  if (disc < 0) return Math.PI / 4;
  const s = Math.sqrt(disc);
  return Math.atan((v2 + (high ? s : -s)) / (g * d));
}

export function startAttack(u) {
  const w = u.w;
  u.atkT = 0;
  u.released = false;
  u.cool = w.cd * rr(0.9, 1.1);
  if (w.hold === 'dual' || w.hold === 'fists') u.atkSide ^= 1;
  if (w.hold === 'staff') u.casting = 1;
}

// ---------------------------------------------------------------- release (attack lands / fires)
export function release(u, fromBurst) {
  if (!u.alive) return;
  const w = u.w;
  if (!fromBurst && w.burst) { u.burstLeft = w.burst - 1; u.burstT = w.gap; }
  switch (w.kind) {
    case 'melee': return melee(u);
    case 'gun': return shoot(u);
    case 'proj': return launch(u);
    case 'lightning': return lightning(u);
    case 'summon': return summon(u);
  }
}
Unit.prototype.onRelease = release;

function melee(u) {
  const w = u.w, s = u.size;
  const reach = w.range * s + 0.25;
  const fx = Math.cos(u.aimYaw), fz = Math.sin(u.aimYaw);
  const ox = u.ax, oz = u.az, oy = u.cy();
  const cands = gridQuery(ox, oz, reach + 2.5, tmp);
  const hits = [];
  for (const t of cands) {
    if (!t.alive || t.team === u.team) continue;
    const dx = t.ax - ox, dz = t.az - oz;
    const d = Math.hypot(dx, dz);
    const tr = 0.32 * t.size;
    if (d - tr > reach) continue;
    if (Math.abs(t.cy() - oy) > 1.6 * Math.max(s, t.size)) continue;
    if (d > 0.3) {
      const cos = (dx * fx + dz * fz) / d;
      if (cos < Math.cos(w.arc)) continue;
    }
    hits.push({ t, d });
  }
  hits.sort((a, b) => a.d - b.d);
  const n = Math.min(hits.length, w.cleave || 1);
  const hx = u.px(w.hold === 'dual' && u.atkSide ? P.LHAND : P.RHAND), hy = u.py(P.RHAND), hz = u.pz(P.RHAND);
  if (!n) { hooks.sound('swoosh', hx, hy, hz, 0.5); return; }
  for (let i = 0; i < n; i++) {
    const t = hits[i].t;
    let dx = t.ax - ox, dz = t.az - oz;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    let dmg = w.dmg * (s > 1 ? 1 + (s - 1) * 0.3 : 1);
    let knock = w.knock * (0.8 + s * 0.35);
    if (t.def.shield && facing(t, -dx, -dz) > 0.35) {
      dmg *= 0.35; knock *= 0.6;
      hooks.sound('clang', t.cx(), t.cy(), t.cz());
      hooks.fx('sparks', t.px(P.LHAND), t.py(P.LHAND), t.pz(P.LHAND), -dx, 0.3, -dz, '#ffe08a', 6);
    } else hooks.sound(w.snd || 'hit', t.cx(), t.cy(), t.cz());
    const idx = w.hold === 'headbutt' || rnd() < 0.4 ? P.HEAD : P.NECK;
    damage(t, dmg, u, dx, 0.35, dz, knock, idx);
    if (knock < 0) continue;
  }
}

function facing(t, dx, dz) { return Math.cos(t.yaw) * dx + Math.sin(t.yaw) * dz; }

const O = [0, 0, 0], D = [0, 0, 0];
function shoot(u) {
  const w = u.w;
  origin(u, O);
  aimDir(u, D);
  const n = w.pellets || 1;
  for (let i = 0; i < n; i++) {
    const sp = w.spread || 0;
    let dx = D[0] + (rnd() + rnd() - 1) * sp, dy = D[1] + (rnd() + rnd() - 1) * sp * 0.6, dz = D[2] + (rnd() + rnd() - 1) * sp;
    const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
    if (w.rail) { rail(u, O, dx, dy, dz); continue; }
    const v = w.speed * (n > 1 ? rr(0.85, 1.1) : 1);
    spawn({
      type: 'bullet', x: O[0], y: O[1], z: O[2], vx: dx * v, vy: dy * v, vz: dz * v, grav: 0.05,
      team: u.team, src: u, dmg: w.dmg, knock: w.knock, pierce: w.pierce || 1, life: (w.range * 1.4) / v,
      color: w.tracer || '#fff1b0',
    });
  }
  u.recoil = 1;
  impulse(u, P.RHAND, -D[0] * 1.5, 0.3, -D[2] * 1.5);
  hooks.fx('muzzle', O[0], O[1], O[2], D[0], D[1], D[2], w.tracer || '#ffd36b', w.smoke || 0);
  hooks.sound(w.snd, O[0], O[1], O[2]);
}

function rail(u, o, dx, dy, dz) {
  const w = u.w, len = w.range * 1.3;
  const ex = o[0] + dx * len, ey = o[1] + dy * len, ez = o[2] + dz * len;
  const hitList = [];
  let pierce = w.pierce || 1, stopT = 1;
  // walk the beam in chunks so the grid query stays local
  for (let s = 0; s < len && pierce > 0; s += 6) {
    const ax = o[0] + dx * s, ay = o[1] + dy * s, az = o[2] + dz * s;
    const bx = o[0] + dx * (s + 6), by = o[1] + dy * (s + 6), bz = o[2] + dz * (s + 6);
    const gt = terrain.raycast(ax, ay, az, dx, dy, dz, 6);
    let segEnd = 1;
    if (gt >= 0) segEnd = gt / 6;
    const pr = { team: u.team, hitList };
    for (let k = 0; k < 4 && pierce > 0; k++) {
      const h = hitTest(pr, ax, ay, az, ax + (bx - ax) * segEnd, ay + (by - ay) * segEnd, az + (bz - az) * segEnd);
      if (!h) break;
      hitList.push(h.u);
      if (h.shield) { pierce = 0; stopT = (s + h.t * 6 * segEnd) / len; hooks.sound('clang', h.x, h.y, h.z); break; }
      damage(h.u, w.dmg, u, dx, dy + 0.2, dz, w.knock, h.i);
      hooks.fx('blood', h.x, h.y, h.z, dx, dy, dz, h.u);
      pierce--;
      if (!pierce) stopT = (s + h.t * 6 * segEnd) / len;
    }
    if (gt >= 0) { stopT = Math.min(stopT, (s + gt) / len); hooks.fx('dust', ax + dx * gt, ay + dy * gt, az + dz * gt, 1); break; }
  }
  hooks.fx('beam', o[0], o[1], o[2], o[0] + (ex - o[0]) * stopT, o[1] + (ey - o[1]) * stopT, o[2] + (ez - o[2]) * stopT, w.tracer);
}

function launch(u) {
  const w = u.w, pj = w.proj;
  origin(u, O);
  aimDir(u, D);
  const sp = w.spread || 0.015;
  let dx = D[0] + (rnd() - 0.5) * sp * 2, dy = D[1] + (rnd() - 0.5) * sp, dz = D[2] + (rnd() - 0.5) * sp * 2;
  const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
  const v = pj.speed * rr(0.97, 1.03);
  spawn({
    type: pj.type, x: O[0], y: O[1], z: O[2], vx: dx * v, vy: dy * v, vz: dz * v, grav: pj.grav ?? 1,
    team: u.team, src: u, dmg: w.dmg, knock: w.knock, pierce: pj.pierce || 1, life: pj.life || 8,
    radius: pj.radius || 0, fuse: pj.fuse || 0, bounce: !!pj.bounce, stick: !!pj.stick, len: pj.len || 0.6,
    color: pj.color, size: pj.size || 0.25, homing: pj.homing || 0, target: u.target, freeze: pj.freeze || 0, poison: pj.poison || 0,
    spin: rnd() * 6,
  });
  if (u.def.machine) { u.mfire = 1; hooks.fx('muzzle', O[0], O[1], O[2], dx, dy, dz, '#ffcf6b', u.def.machine === 'cannon' ? 2.5 : 0.6); }
  if (pj.type === 'rocket') hooks.fx('muzzle', O[0], O[1], O[2], -dx, -dy, -dz, '#ffb060', 1.2);
  hooks.sound(w.snd, O[0], O[1], O[2]);
}

function lightning(u) {
  const t = u.target;
  if (!t || !t.alive) return;
  const x = t.ax + rr(-0.5, 0.5), z = t.az + rr(-0.5, 0.5), y = terrain.heightAt(x, z);
  origin(u, O);
  hooks.fx('lightning', x, y, z, O[0], O[1], O[2]);
  hooks.sound('thunder', x, y, z);
  explode(x, y + 0.5, z, u.w.radius, u.w.dmg, u.w.knock, u, { noCrater: false, color: '#bfe8ff', small: true });
}

function summon(u) {
  let best = null, bd = u.w.range;
  for (const c of world.units) {
    if (c.alive || c.sink || c.def.mech || c.def.machine || c.raised) continue;
    const d = Math.hypot(c.p[6] - u.ax, c.p[8] - u.az);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return;
  best.raised = true;
  const x = best.p[6], z = best.p[8];
  best.sink = 1; // corpse crumbles away
  const sk = world.addUnit(best.def.size > 1.3 ? 'skeleton' : 'skeleton', u.team, x, z, u.yaw, true);
  if (sk) {
    sk.stagger = 1.4; sk.ctrl = 0;
    world.stats.raised[u.team]++;
  }
  hooks.fx('summon', x, terrain.heightAt(x, z), z);
  hooks.sound('summon', x, 0, z);
}

// ---------------------------------------------------------------- projectiles
export function spawn(pr) {
  pr.px = pr.x; pr.py = pr.y; pr.pz = pr.z;
  pr.hitList = null;
  pr.age = 0;
  pr.dead = false;
  world.projectiles.push(pr);
  return pr;
}

const H = { u: null, t: 0, i: 0, shield: false, x: 0, y: 0, z: 0 };
function hitTest(pr, ax, ay, az, bx, by, bz) {
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  const half = Math.hypot(bx - ax, bz - az) / 2;
  const cands = gridQuery(mx, mz, half + 3, tmp);
  let best = null, bestT = 2;
  const ddx = bx - ax, ddz = bz - az, dl = Math.hypot(ddx, by - ay, ddz) || 1;
  for (const u of cands) {
    if (!u.alive || u.team === pr.team) continue;
    if (pr.hitList && pr.hitList.includes(u)) continue;
    const s = u.size;
    if (segSphere(ax, ay, az, bx, by, bz, u.cx(), u.cy(), u.cz(), 1.3 * s) < 0) continue;
    if (u.def.shield) {
      const fx = Math.cos(u.yaw), fz = Math.sin(u.yaw);
      if ((ddx * fx + ddz * fz) / dl < -0.25) {
        const j = P.LHAND * 3;
        const t = segSphere(ax, ay, az, bx, by, bz, u.p[j] + fx * 0.12 * s, u.p[j + 1], u.p[j + 2] + fz * 0.12 * s, SHIELD_R[u.def.shield] * s);
        if (t >= 0 && t < bestT && rnd() < SHIELD_BLOCK[u.def.shield]) { bestT = t; best = u; H.shield = true; H.i = P.LHAND; }
      }
    }
    for (let i = 0; i < NP; i++) {
      const j = i * 3;
      const r = RAD[i] * s * (i === P.HEAD ? 1.15 : 1.9);
      const t = segSphere(ax, ay, az, bx, by, bz, u.p[j], u.p[j + 1], u.p[j + 2], r);
      if (t >= 0 && t < bestT) { bestT = t; best = u; H.shield = false; H.i = i; }
    }
  }
  if (!best) return null;
  H.u = best; H.t = bestT;
  H.x = ax + (bx - ax) * bestT; H.y = ay + (by - ay) * bestT; H.z = az + (bz - az) * bestT;
  return H;
}

export function updateProjectiles() {
  const list = world.projectiles;
  for (let k = list.length - 1; k >= 0; k--) {
    const pr = list[k];
    stepProjectile(pr);
    if (pr.dead) { list[k] = list[list.length - 1]; list.pop(); }
  }
}

function stepProjectile(pr) {
  const dt = DT;
  pr.age += dt;
  pr.px = pr.x; pr.py = pr.y; pr.pz = pr.z;
  if (pr.homing && pr.target && pr.target.alive) {
    const t = pr.target;
    let dx = t.cx() - pr.x, dy = t.cy() - pr.y, dz = t.cz() - pr.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const sp = Math.hypot(pr.vx, pr.vy, pr.vz);
    const k = Math.min(1, pr.homing * dt);
    pr.vx += ((dx / d) * sp - pr.vx) * k; pr.vy += ((dy / d) * sp - pr.vy) * k + Math.sin(pr.age * 9 + pr.spin) * 0.3; pr.vz += ((dz / d) * sp - pr.vz) * k;
  }
  pr.vy -= 9.81 * pr.grav * dt;
  pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;
  pr.spin += dt * 12;
  pr.life -= dt;

  if (pr.type === 'rocket' || pr.type === 'firework') { if (Math.random() < 0.7) hooks.fx('trail', pr.x, pr.y, pr.z, pr.type === 'rocket' ? 1 : 0.5); }
  if (pr.type === 'magic' && Math.random() < 0.6) hooks.fx('magictrail', pr.x, pr.y, pr.z, pr.color);
  if ((pr.type === 'bomb' || pr.type === 'dynamite') && Math.random() < 0.5) hooks.fx('fuse', pr.x, pr.y + 0.25, pr.z);

  // fuse explosives
  if (pr.fuse) {
    pr.fuse -= dt;
    if (pr.fuse <= 0) return detonate(pr, pr.x, pr.y, pr.z);
  }

  // units
  if (pr.type !== 'boulder' || pr.vy < 0 || pr.age > 0.3) {
    const h = hitTest(pr, pr.px, pr.py, pr.pz, pr.x, pr.y, pr.z);
    if (h) {
      const u = h.u;
      if (!h.shield && u.def.deflect && !pr.radius && rnd() < u.def.deflect && u.ctrl > 0.6 && facing(u, -pr.vx, -pr.vz) > 0.2) {
        // batted away
        pr.vx = -pr.vx * 0.7 + rr(-3, 3); pr.vy = Math.abs(pr.vy) * 0.5 + 3; pr.vz = -pr.vz * 0.7 + rr(-3, 3);
        pr.team = u.team; pr.src = u; pr.x = h.x; pr.y = h.y; pr.z = h.z;
        hooks.fx('sparks', h.x, h.y, h.z, pr.vx, pr.vy, pr.vz, '#bff6ff', 5);
        hooks.sound('tink', h.x, h.y, h.z);
        return;
      }
      if (pr.radius) return detonate(pr, h.x, h.y, h.z);
      const sp = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
      const nx = pr.vx / sp, ny = pr.vy / sp, nz = pr.vz / sp;
      if (h.shield) {
        hooks.sound(u.def.shield === 'riot' ? 'zap' : 'thunk', h.x, h.y, h.z, 0.7);
        hooks.fx('sparks', h.x, h.y, h.z, -nx, -ny, -nz, u.def.shield === 'riot' ? '#9fe8ff' : '#ffe08a', 4);
        impulse(u, P.LHAND, nx * pr.knock * 0.6, 0, nz * pr.knock * 0.6);
        if (pr.stick) hooks.fx('stick', pr, u, P.LHAND, h.x, h.y, h.z);
        pr.dead = true;
        return;
      }
      const k = pr.type === 'harpoon' ? pr.knock : pr.knock;
      damage(u, pr.dmg, pr.src, nx, ny + 0.15, nz, k, h.i);
      if (pr.freeze) { u.freezeT = Math.max(u.freezeT, pr.freeze); hooks.fx('ice', h.x, h.y, h.z); }
      if (pr.poison) u.poison += pr.poison;
      if (pr.type === 'bullet') hooks.fx('blood', h.x, h.y, h.z, nx, ny, nz, u);
      else hooks.sound(pr.type === 'rock' ? 'bonk' : 'thunk', h.x, h.y, h.z);
      if (pr.stick && pr.pierce <= 1) hooks.fx('stick', pr, u, h.i, h.x, h.y, h.z);
      if (--pr.pierce <= 0) { pr.dead = true; return; }
      (pr.hitList || (pr.hitList = [])).push(u);
    }
  }

  // ground / water
  const g = terrain.heightAt(pr.x, pr.z);
  if (pr.y <= g) {
    if (pr.radius && !pr.fuse) return detonate(pr, pr.x, g, pr.z);
    if (pr.bounce && Math.hypot(pr.vx, pr.vy, pr.vz) > 2.5) {
      pr.y = g + 0.05;
      pr.vy = Math.abs(pr.vy) * 0.38; pr.vx *= 0.62; pr.vz *= 0.62;
      if (pr.type === 'rock' || pr.type === 'boulder') hooks.fx('dust', pr.x, g, pr.z, 0.6);
      if (pr.type === 'rock' && pr.age > 0.2) { pr.dmg *= 0.6; }
      return;
    }
    if (pr.bounce) { pr.y = g + 0.05; pr.vx = pr.vy = pr.vz = 0; pr.grav = 0; if (!pr.fuse) pr.dead = true; return; }
    if (pr.stick) hooks.fx('stickground', pr, pr.x, g, pr.z);
    else if (pr.type === 'bullet') hooks.fx('dust', pr.x, g, pr.z, 0.25);
    else hooks.fx('dust', pr.x, g, pr.z, 0.5);
    pr.dead = true;
    return;
  }
  if (terrain.water !== null && pr.y < terrain.water && pr.py >= terrain.water) hooks.fx('splash', pr.x, terrain.water, pr.z, 0.6);
  if (pr.life <= 0 || pr.y < -60) pr.dead = true;
}

function detonate(pr, x, y, z) {
  pr.dead = true;
  const small = pr.type === 'firework' || pr.type === 'potion';
  explode(x, y, z, pr.radius, pr.dmg, pr.knock, pr.src, { color: pr.color, small, noCrater: pr.type === 'potion' || pr.type === 'magic', potion: pr.type === 'potion' });
}

// ---------------------------------------------------------------- damage & explosions
export function explode(x, y, z, radius, dmg, knock, src, opt = {}) {
  const r2 = radius * 1.7;
  for (const u of world.units) {
    if (u.sink) continue;
    const dx = u.cx() - x, dy = u.cy() - y, dz = u.cz() - z;
    const d = Math.hypot(dx, dy, dz);
    if (d > r2) continue;
    const f = 1 - d / r2;
    const nl = d || 1;
    const nx = dx / nl, ny = dy / nl, nz = dz / nl;
    if (u.alive) {
      const ff = src && u.team === src.team ? 0.5 : 1;
      if (d < radius) damage(u, dmg * (0.35 + 0.65 * f) * ff, src, nx, Math.max(0.5, ny + 0.6), nz, knock * f * 1.6, -1);
      else damage(u, 0, src, nx, 0.8, nz, knock * f, -1);
    } else {
      impulseAll(u, nx * knock * f * 1.6, (ny + 0.9) * knock * f * 1.6, nz * knock * f * 1.6);
    }
  }
  if (!opt.noCrater && terrain.inPlay(x, z, 20)) terrain.crater(x, z, radius * 0.55, radius * 0.11);
  hooks.fx(opt.potion ? 'potion' : 'explosion', x, y, z, radius, opt.color, opt.small);
  hooks.sound(opt.potion ? 'splat' : opt.small ? 'pop' : 'boom', x, y, z, opt.small ? 0.7 : 1);
  hooks.shake(x, y, z, opt.small ? radius * 0.4 : radius);
}

export function damage(u, dmg, src, dx, dy, dz, knock, idx) {
  if (!u.alive) return;
  const def = u.def;
  dmg *= 1 - (def.armor || 0);
  u.hp -= dmg;
  if (dmg > 0) { u.hitFlash = 0.12; world.lastDamage = world.battleTime; }
  if (src && src !== u) src.dmgDealt += Math.min(dmg, u.hp + dmg);
  const m = Math.max(0.6, Math.sqrt(def.mass));
  const k = knock;
  u.stagger += (Math.abs(k) * 0.075) / m;
  if (idx >= 0) impulse(u, idx, dx * k * 2.2, dy * Math.abs(k) * 2.2, dz * k * 2.2);
  impulseAll(u, dx * k * 0.45, dy * Math.abs(k) * 0.45, dz * k * 0.45);
  if (u.hp <= 0) kill(u, src);
}

export function kill(u, src) {
  if (!u.alive) return;
  u.alive = false;
  u.hp = 0;
  u.ctrl = 0;
  u.deathT = world.time;
  u.atkT = -1;
  if (src && src !== u && src.team !== u.team) src.kills++;
  world.stats.lost[u.team] += u.def.cost;
  hooks.event({ type: 'kill', killer: src, victim: u });
  hooks.sound(u.def.mech ? 'clang' : 'oof', u.cx(), u.cy(), u.cz(), u.def.skeleton ? 0.5 : 1);
  if (u.def.skeleton) hooks.fx('bones', u.cx(), u.cy(), u.cz());
  impulseAll(u, rr(-1, 1), 1.5, rr(-1, 1));
  if (u.def.deathBoom) world.pendingBooms.push({ u, t: world.time + 0.8 });
}

// Per-step statuses: poison, regen, lava, falling out of the world.
export function statuses(u) {
  if (!u.alive) return;
  const dt = DT;
  if (u.poison > 0) {
    const d = Math.min(u.poison, 14 * dt);
    u.poison -= d; u.hp -= d;
    if (Math.random() < dt * 4) hooks.fx('poison', u.cx(), u.cy(), u.cz());
    if (u.hp <= 0) return kill(u, null);
  }
  if (u.def.regen && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.def.regen * dt);
  const pel = P.PELVIS * 3;
  const py = u.p[pel + 1];
  if (terrain.lava && py < terrain.water + 0.3) {
    u.hp -= 90 * dt; u.stagger += dt * 0.5;
    if (Math.random() < dt * 10) hooks.fx('fire', u.p[pel], terrain.water, u.p[pel + 2]);
    if (u.hp <= 0) return kill(u, null);
  }
  if (py < terrain.heightAt(u.p[pel], u.p[pel + 2]) - 6 || Math.abs(u.p[pel]) > terrain.HALF - 2 || Math.abs(u.p[pel + 2]) > terrain.HALF - 2) kill(u, null);
  u.hp = clamp(u.hp, 0, u.maxHp);
}
