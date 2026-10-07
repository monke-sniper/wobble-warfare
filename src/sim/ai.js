// Unit brains: targeting, movement, aiming (incl. ballistic arcs with lead), attacking,
// healing, siege crews, dashes and charges. Possessed units read player input instead.
import { world } from './world.js';
import { terrain } from './terrain.js';
import { startAttack, ballistic, origin, MUZZLE } from './combat.js';
import { impulseAll, P } from './body.js';
import { rr, rnd, angDiff, approachAngle } from '../util.js';

const O = [0, 0, 0];

function pickTarget(u) {
  const enemies = world.teamAlive[u.team ^ 1];
  const melee = u.w.kind === 'melee';
  let best = null, bs = Infinity;
  for (const e of enemies) {
    const dx = e.ax - u.ax, dz = e.az - u.az;
    let d = Math.sqrt(dx * dx + dz * dz);
    if (melee) d += e.engaged * 1.4; // spread melee attackers out
    if (u.def.prefer === 'value' && d < u.w.range) d -= e.def.cost * 0.012;
    if (u.def.prefer === 'big') d -= e.def.cost * 0.004;
    if (u.def.machine) d += Math.abs(angDiff(u.myaw, Math.atan2(dz, dx))) * 6; // prefer what the engine already faces
    d *= rr(0.93, 1.07);
    if (d < bs) { bs = d; best = e; }
  }
  return best;
}

function findInjured(u) {
  let best = null, bs = 40;
  for (const a of world.teamAlive[u.team]) {
    if (a === u || a.def.ai === 'healer' || a.hp >= a.maxHp * 0.9) continue;
    const d = Math.hypot(a.ax - u.ax, a.az - u.az) - (1 - a.hp / a.maxHp) * 8;
    if (d < bs) { bs = d; best = a; }
  }
  return best;
}

// Aim at target t: sets aimYaw / aimPitch (ballistic for arcing projectiles, with lead).
function aimAt(u, t) {
  const w = u.w;
  origin(u, O);
  let tx = t.cx(), ty = t.cy(), tz = t.cz();
  if (w.kind === 'proj' || w.kind === 'gun') {
    const v = w.kind === 'gun' ? w.speed : w.proj.speed;
    const d0 = Math.hypot(tx - O[0], tz - O[2]);
    let tt = d0 / v;
    if (w.arcing) tt *= w.high ? 2.2 : 1.25;
    tx += t.vx * tt; tz += t.vz * tt;
    if (w.kind === 'proj' && w.proj.radius) ty = terrain.heightAt(tx, tz) + 0.3;
  }
  const dx = tx - O[0], dy = ty - O[1], dz = tz - O[2];
  const d = Math.hypot(dx, dz) || 0.01;
  const yaw = Math.atan2(dz, dx);
  let pitch;
  if (w.kind === 'proj' && w.proj.grav > 0) pitch = ballistic(d, dy, w.proj.speed, 9.81 * w.proj.grav, !!w.high);
  else if (w.kind === 'gun') pitch = Math.atan2(dy + 9.81 * 0.05 * (d / w.speed) ** 2 * 0.5, d);
  else pitch = Math.atan2(dy, d);
  u.aimYaw = approachAngle(u.aimYaw, yaw, 9 * 0.0167);
  u.aimPitch += (pitch - u.aimPitch) * 0.3;
  return Math.abs(angDiff(u.aimYaw, yaw));
}

export function think(u, dt) {
  if (u.player) return playerControl(u, dt);
  const ai = u.def.ai || (u.w.kind === 'melee' ? 'melee' : 'ranged');
  if (ai === 'healer' && healer(u, dt)) return;

  u.retarget -= dt;
  if (!u.target || !u.target.alive || u.retarget <= 0) {
    u.target = pickTarget(u);
    u.retarget = rr(0.4, 0.8);
  }
  const t = u.target;
  if (!t) { u.bowUp *= 0.9; return; }

  const w = u.w, s = u.size;
  const dx = t.ax - u.ax, dz = t.az - u.az;
  const dist = Math.hypot(dx, dz) || 0.01;
  const nx = dx / dist, nz = dz / dist;
  const speed = u.def.speed;

  if (ai === 'siege') return siege(u, t, dist);

  u.faceYaw = Math.atan2(dz, dx);
  const err = aimAt(u, t);

  if (w.kind === 'melee') {
    const reach = w.range * s + 0.32 * t.size + 0.15;
    // arrive: ease off as we get into reach instead of overshooting into a hug
    const want = Math.min(speed, Math.max(0, (dist - reach * 0.75) * 2.5));
    if (want > 0.05) { u.mvx = nx * want; u.mvz = nz * want; }
    else if (dist < reach * 0.45) { u.mvx = -nx * speed * 0.4; u.mvz = -nz * speed * 0.4; }
    // dash / charge to close the gap
    if (u.def.dash && u.dashCd <= 0 && dist > 3 && dist < 9) {
      u.dashCd = rr(3.5, 5);
      impulseAll(u, nx * 7 * Math.sqrt(u.def.mass), 4.5 * Math.sqrt(u.def.mass), nz * 7 * Math.sqrt(u.def.mass));
      u.stagger = Math.max(u.stagger, 0.2);
    }
    if (u.def.charge && u.dashCd <= 0 && dist > 4 && dist < 14) { u.chargeT = 1.6; u.dashCd = 6; }
    if (u.cool <= 0 && u.atkT < 0 && dist < reach && err < 0.6) startAttack(u);
    return;
  }

  if (w.kind === 'summon') {
    const keep = 10;
    if (dist < keep * 0.7) { u.mvx = -nx * speed; u.mvz = -nz * speed; }
    else if (dist > keep * 1.6) { u.mvx = nx * speed; u.mvz = nz * speed; }
    if (u.cool <= 0 && u.atkT < 0) startAttack(u);
    return;
  }

  // ranged
  const range = w.range * u.rangeMul;
  if (dist > range) { u.mvx = nx * speed; u.mvz = nz * speed; }
  else if (ai === 'kite' && dist < range * 0.4) { u.mvx = -nx * speed * 0.9; u.mvz = -nz * speed * 0.9; }
  if (u.def.dash && ai === 'kite' && u.dashCd <= 0 && dist < range * 0.3) {
    u.dashCd = rr(4, 6);
    impulseAll(u, -nx * 6, 4, -nz * 6);
  }
  const inRange = dist < w.range * 1.02;
  if (w.hold === 'bow') u.bowUp += ((inRange ? 1 : 0) - u.bowUp) * 0.12;
  if (w.spinup) u.spinup = Math.min(1, Math.max(0, u.spinup + (inRange ? dt : -dt) / w.spinup));
  if (w.spinup && u.spinup < 1) return;
  if (u.cool <= 0 && u.atkT < 0 && u.burstLeft <= 0 && inRange && err < 0.25) startAttack(u);
}

function siege(u, t, dist) {
  // crew walks back behind the machine if knocked away
  const bx = u.mx - Math.cos(u.myaw) * 1.4, bz = u.mz - Math.sin(u.myaw) * 1.4;
  const ox = bx - u.ax, oz = bz - u.az, od = Math.hypot(ox, oz);
  if (od > 0.4) { u.mvx = (ox / od) * 2.5; u.mvz = (oz / od) * 2.5; }
  const w = u.w;
  const dx = t.ax - u.mx, dz = t.az - u.mz;
  // rotate the engine toward the target
  u.myaw = approachAngle(u.myaw, Math.atan2(dz, dx), 0.6 * 0.0167);
  u.faceYaw = u.myaw;
  aimAt(u, t);
  u.aimYaw = u.myaw;
  const md = Math.hypot(dx, dz);
  if (od < 1.3 && u.cool <= 0 && u.atkT < 0 && u.burstLeft <= 0 && md < w.range && md > (w.minRange || 0)) {
    if (w.spinup) { u.spinup = Math.min(1, u.spinup + 0.0167 / w.spinup); if (u.spinup < 1) return; }
    startAttack(u);
  } else if (w.spinup) u.spinup = Math.max(0, u.spinup - 0.01);
}

function healer(u, dt) {
  u.healT = (u.healT || 0) - dt;
  if (u.healT <= 0 || !u.heal || !u.heal.alive || u.heal.hp >= u.heal.maxHp) {
    u.heal = findInjured(u);
    u.healT = 0.5;
  }
  const h = u.heal;
  u.healing = false;
  if (!h) {
    // follow the army from behind
    const allies = world.teamAlive[u.team];
    let cx = 0, cz = 0, n = 0;
    for (const a of allies) if (a !== u && a.def.ai !== 'healer') { cx += a.ax; cz += a.az; n++; }
    if (!n) return false;
    cx /= n; cz /= n;
    const back = u.team === 0 ? -4 : 4;
    const dx = cx + back - u.ax, dz = cz - u.az, d = Math.hypot(dx, dz);
    if (d > 3) { u.mvx = (dx / d) * u.def.speed; u.mvz = (dz / d) * u.def.speed; u.faceYaw = Math.atan2(dz, dx); }
    return true;
  }
  const dx = h.ax - u.ax, dz = h.az - u.az, d = Math.hypot(dx, dz) || 0.01;
  u.faceYaw = Math.atan2(dz, dx);
  aimAt(u, h);
  if (d > u.w.range * 0.7) { u.mvx = (dx / d) * u.def.speed; u.mvz = (dz / d) * u.def.speed; }
  if (d < u.w.range) {
    h.hp = Math.min(h.maxHp, h.hp + u.w.heal * dt);
    u.healing = true;
    u.casting = 1;
  }
  return true;
}

// Possessed unit: input = { mx, mz (world move dir), aimYaw, aimPitch, fire, jump }
function playerControl(u, dt) {
  const inp = u.player;
  const sp = u.def.speed * 1.1;
  u.mvx = inp.mx * sp; u.mvz = inp.mz * sp;
  u.faceYaw = inp.aimYaw;
  u.aimYaw = inp.aimYaw;
  u.aimPitch = inp.aimPitch;
  const w = u.w;
  if (w.hold === 'bow') u.bowUp += ((inp.fire || u.atkT >= 0 ? 1 : 0.4) - u.bowUp) * 0.15;
  if (u.def.machine) { u.myaw = approachAngle(u.myaw, inp.aimYaw, 1.2 * dt); u.mvx = u.mvz = 0; }
  if (w.spinup) u.spinup = Math.min(1, Math.max(0, u.spinup + (inp.fire ? dt : -dt) / w.spinup));
  if (inp.jump && u.dashCd <= 0) {
    u.dashCd = 1.2;
    impulseAll(u, inp.mx * 5, 6, inp.mz * 5);
  }
  if (w.kind === 'heal') {
    if (inp.fire) {
      // heal the ally closest to the aim ray
      let best = null, bd = w.range;
      for (const a of world.teamAlive[u.team]) {
        if (a === u) continue;
        const d = Math.hypot(a.ax - u.ax, a.az - u.az);
        if (d < bd) { bd = d; best = a; }
      }
      if (best) { best.hp = Math.min(best.maxHp, best.hp + w.heal * dt); u.heal = best; u.healing = true; u.casting = 1; }
    }
    return;
  }
  if (inp.fire && u.cool <= 0 && u.atkT < 0 && u.burstLeft <= 0 && (!w.spinup || u.spinup >= 1)) {
    if (w.kind === 'lightning' || w.kind === 'summon') u.target = nearestToAim(u) || u.target;
    startAttack(u);
  }
}

function nearestToAim(u) {
  let best = null, bs = Infinity;
  const fx = Math.cos(u.aimYaw), fz = Math.sin(u.aimYaw);
  for (const e of world.teamAlive[u.team ^ 1]) {
    const dx = e.ax - u.ax, dz = e.az - u.az, d = Math.hypot(dx, dz);
    if (d > u.w.range) continue;
    const off = d - (dx * fx + dz * fz);
    if (off < bs) { bs = off; best = e; }
  }
  return best;
}

export { MUZZLE, P, rnd };
