// Turns ragdoll points into instanced body parts + gear. Positions are interpolated between
// the last two physics steps (Verlet keeps the previous position for free).
import { P, NP, DIM } from '../sim/body.js';
import { writeBasis, writeSegment, frame } from './batcher.js';
import { headModel, chestModel, backModel, shieldModel, weaponModel, projModel, machineModel, TEAM_COLORS } from './models.js';
import { terrain } from '../sim/terrain.js';
import { rgb, mixc } from '../util.js';

const Q = new Float64Array(NP * 3);
const GRAY = rgb('#7a7d85'), WHITE = [1, 1, 1], ICE = rgb('#9ff3ff'), POISON = rgb('#7dff5a');
const TX = [0, 0, 0], TY = [0, 0, 0], TZ = [0, 0, 0];
const AX = [0, 0, 0], AY = [0, 0, 0], AZ = [0, 0, 0];

function colours(u) {
  const look = u.def.look, tc = TEAM_COLORS[u.team];
  const res = (c) => rgb(c === 'team' ? tc.team : c === 'teamDark' ? tc.teamDark : c === 'teamLight' ? tc.teamLight : c);
  return { shirt: res(look.shirt), pants: res(look.pants), skin: res(look.skin), boots: res(look.boots), hand: res(look.skin) };
}

function tint(c, u, out) {
  let r = c[0], g = c[1], b = c[2];
  if (!u.alive) { r += (GRAY[0] - r) * 0.35; g += (GRAY[1] - g) * 0.35; b += (GRAY[2] - b) * 0.35; }
  else {
    if (u.freezeT > 0) { r += (ICE[0] - r) * 0.45; g += (ICE[1] - g) * 0.45; b += (ICE[2] - b) * 0.45; }
    if (u.poison > 0) { r += (POISON[0] - r) * 0.25; g += (POISON[1] - g) * 0.25; b += (POISON[2] - b) * 0.25; }
    if (u.hitFlash > 0) { const k = Math.min(1, u.hitFlash / 0.12) * 0.7; r += (1 - r) * k; g += (1 - g) * k; b += (1 - b) * k; }
  }
  out[0] = r; out[1] = g; out[2] = b;
  return out;
}

function renderData(u) {
  if (u.rc) return u.rc;
  const d = u.def, w = u.w;
  u.rc = {
    col: colours(u),
    head: headModel(d, u.team),
    chest: chestModel(d, u.team),
    back: backModel(d, u.team),
    shield: shieldModel(d.shield, u.team),
    weapon: weaponModel(w.model, u.team),
    off: weaponModel(w.off, u.team),
    arrow: w.hold === 'bow' ? projModel('arrow', u.team) : null,
    machine: d.machine ? machineModel(d.machine) : null,
    t: [0, 0, 0],
  };
  return u.rc;
}

function putModel(B, key, model, col, X, Y, Z, s, px, py, pz) {
  if (!model) return;
  const pair = B.model(key, model);
  for (let k = 0; k < 2; k++) {
    const bt = pair[k];
    if (!bt) continue;
    const o = bt.alloc(col[0], col[1], col[2]);
    writeBasis(bt.M, o, X, Y, Z, s, s, s, px, py, pz);
  }
}

const c3 = [0, 0, 0], c4 = [0, 0, 0];

// Draw one unit. alpha: interpolation factor between previous and current physics step.
export function drawUnit(B, G, u, alpha) {
  const rc = renderData(u);
  const s = u.size, look = u.def.look;
  const p = u.p, o = u.o;
  const a = u.asleep ? 1 : alpha;
  for (let i = 0; i < NP * 3; i++) Q[i] = o[i] + (p[i] - o[i]) * a;
  const q = (i) => i * 3;

  // torso frame
  const ls = q(P.LSHO), rs = q(P.RSHO), nk = q(P.NECK), pv = q(P.PELVIS), hd = q(P.HEAD);
  frame(Q[nk] - Q[pv], Q[nk + 1] - Q[pv + 1], Q[nk + 2] - Q[pv + 2], Q[rs] - Q[ls], Q[rs + 1] - Q[ls + 1], Q[rs + 2] - Q[ls + 2]);
  // frame() returns Y=spine, X=right; copy
  copyFrame(TX, TY, TZ);
  const bulk = look.bulk || 1;
  const col = rc.col;
  const tc = rc.t;
  const tl = Math.hypot(Q[nk] - Q[pv], Q[nk + 1] - Q[pv + 1], Q[nk + 2] - Q[pv + 2]);
  const mx = (Q[nk] + Q[pv]) / 2 + TY[0] * 0.03 * s, my = (Q[nk + 1] + Q[pv + 1]) / 2 + TY[1] * 0.03 * s, mz = (Q[nk + 2] + Q[pv + 2]) / 2 + TY[2] * 0.03 * s;
  // torso
  let bt = G.torso;
  let off = bt.alloc(...tint(col.shirt, u, tc));
  writeBasis(bt.M, off, TX, TY, TZ, (DIM.shoW * 2 + 0.1) * s * bulk, tl + 0.14 * s, 0.3 * s * bulk, mx, my, mz);
  // hips block
  bt = G.cube;
  off = bt.alloc(...tint(col.pants, u, tc));
  writeBasis(bt.M, off, TX, TY, TZ, (DIM.hipW * 2 + 0.2) * s * Math.min(bulk, 1.15), 0.22 * s, 0.27 * s * bulk, Q[pv] - TY[0] * 0.02 * s, Q[pv + 1] - TY[1] * 0.02 * s, Q[pv + 2] - TY[2] * 0.02 * s);

  // team belt so off-colour outfits (ninja, monk, skeleton...) still read as blue / red
  if (look.shirt !== 'team') {
    const tcol = tint(rgb(TEAM_COLORS[u.team].team), u, [0, 0, 0]);
    off = bt.alloc(tcol[0], tcol[1], tcol[2]);
    writeBasis(bt.M, off, TX, TY, TZ, (DIM.hipW * 2 + 0.26) * s * Math.min(bulk, 1.2), 0.09 * s, 0.33 * s * bulk, Q[pv] + TY[0] * 0.1 * s, Q[pv + 1] + TY[1] * 0.1 * s, Q[pv + 2] + TY[2] * 0.1 * s);
  }

  // limbs
  const L = G.limb;
  const pants = tint(col.pants, u, [0, 0, 0]);
  const shirt = tint(col.shirt, u, [0, 0, 0]);
  const skin = tint(col.skin, u, [0, 0, 0]);
  const boots = tint(col.boots, u, [0, 0, 0]);
  const seg = (A, Bp, th, c) => writeSegment(L, c, Q[q(A)], Q[q(A) + 1], Q[q(A) + 2], Q[q(Bp)], Q[q(Bp) + 1], Q[q(Bp) + 2], th * s, th * s, TX[0], TX[1], TX[2]);
  seg(P.LHIP, P.LKNEE, 0.19, pants); seg(P.LKNEE, P.LFOOT, 0.16, pants);
  seg(P.RHIP, P.RKNEE, 0.19, pants); seg(P.RKNEE, P.RFOOT, 0.16, pants);
  seg(P.LSHO, P.LELB, 0.15 * bulk, shirt); seg(P.LELB, P.LHAND, 0.13 * bulk, shirt);
  seg(P.RSHO, P.RELB, 0.15 * bulk, shirt); seg(P.RELB, P.RHAND, 0.13 * bulk, shirt);
  // hands & boots
  const C = G.cube;
  const flat = frame(0, 1, 0, TX[0], 0, TX[2]);
  for (const hi of [P.LHAND, P.RHAND]) {
    off = C.alloc(skin[0], skin[1], skin[2]);
    writeBasis(C.M, off, TX, TY, TZ, 0.12 * s, 0.12 * s, 0.12 * s, Q[q(hi)], Q[q(hi) + 1], Q[q(hi) + 2]);
  }
  for (const fi of [P.LFOOT, P.RFOOT]) {
    off = C.alloc(boots[0], boots[1], boots[2]);
    const fx = flat[2];
    writeBasis(C.M, off, flat[0], flat[1], flat[2], 0.15 * s, 0.11 * s, 0.27 * s, Q[q(fi)] - fx[0] * 0.05 * s, Q[q(fi) + 1] - 0.01 * s, Q[q(fi) + 2] - fx[2] * 0.05 * s);
  }

  // head
  frame(Q[hd] - Q[nk], Q[hd + 1] - Q[nk + 1], Q[hd + 2] - Q[nk + 2], TX[0], TX[1], TX[2]);
  copyFrame(AX, AY, AZ);
  const hr = DIM.headR * s;
  bt = G.head;
  off = bt.alloc(skin[0], skin[1], skin[2]);
  writeBasis(bt.M, off, AX, AY, AZ, hr, hr * 1.02, hr, Q[hd], Q[hd + 1], Q[hd + 2]);
  const gearCol = u.alive ? (u.hitFlash > 0 ? [1.6, 1.6, 1.6] : WHITE) : [0.72, 0.72, 0.75];
  putModel(B, 'h' + u.type + u.team, rc.head, gearCol, AX, AY, AZ, s, Q[hd], Q[hd + 1], Q[hd + 2]);

  // torso gear
  putModel(B, 'c' + look.chest + u.team, rc.chest, gearCol, TX, TY, TZ, s * bulk, mx, my, mz);
  putModel(B, 'b' + look.back + u.team, rc.back, gearCol, TX, TY, TZ, s * bulk, mx, my, mz);

  // shield
  if (rc.shield) {
    const lh = q(P.LHAND);
    putModel(B, 's' + u.def.shield + u.team, rc.shield, gearCol, TX, TY, TZ, s, Q[lh], Q[lh + 1], Q[lh + 2]);
  }

  // weapons
  const w = u.w;
  if (rc.weapon && showWeapon(u, w)) {
    const hi = w.hold === 'bow' ? P.LHAND : P.RHAND;
    const j = q(hi);
    let dx = u.wd[0], dy = u.wd[1], dz = u.wd[2];
    if (!u.alive) { const e = q(hi === P.LHAND ? P.LELB : P.RELB); dx = Q[j] - Q[e]; dy = Q[j + 1] - Q[e + 1]; dz = Q[j + 2] - Q[e + 2]; }
    frame(dx, dy, dz, TX[0], TX[1], TX[2]);
    copyFrame(AX, AY, AZ);
    putModel(B, 'w' + w.model + u.team, rc.weapon, gearCol, AX, AY, AZ, s, Q[j], Q[j + 1], Q[j + 2]);
  }
  if (rc.off) {
    const j = q(P.LHAND);
    let dx = u.wd2[0], dy = u.wd2[1], dz = u.wd2[2];
    if (!u.alive) { const e = q(P.LELB); dx = Q[j] - Q[e]; dy = Q[j + 1] - Q[e + 1]; dz = Q[j + 2] - Q[e + 2]; }
    frame(dx, dy, dz, TX[0], TX[1], TX[2]);
    copyFrame(AX, AY, AZ);
    putModel(B, 'w' + w.off + u.team, rc.off, gearCol, AX, AY, AZ, s, Q[j], Q[j + 1], Q[j + 2]);
  }
  // nocked arrow while drawing a bow
  if (rc.arrow && u.alive && u.bowUp > 0.5 && u.atkT >= 0 && u.atkT < w.windup) {
    const j = q(P.RHAND);
    const cp = Math.cos(u.aimPitch);
    const ax = Math.cos(u.aimYaw) * cp, ay = Math.sin(u.aimPitch), az = Math.sin(u.aimYaw) * cp;
    frame(ax, ay, az, TX[0], TX[1], TX[2]);
    copyFrame(AX, AY, AZ);
    putModel(B, 'arrow' + u.team, rc.arrow, WHITE, AX, AY, AZ, s, Q[j] + ax * 0.38 * s, Q[j + 1] + ay * 0.38 * s, Q[j + 2] + az * 0.38 * s);
  }

  // siege engine
  if (rc.machine) {
    u.mfire *= 0.92;
    const fx = Math.cos(u.myaw), fz = Math.sin(u.myaw);
    c4[0] = -fz; c4[1] = 0; c4[2] = fx;
    c3[0] = 0; c3[1] = 1; c3[2] = 0;
    const MZ = [-fx, 0, -fz];
    const kick = u.mfire * 0.25;
    putModel(B, 'm' + u.def.machine, rc.machine, u.alive ? WHITE : [0.6, 0.6, 0.62], c4, c3, MZ, 1, u.mx - fx * kick, terrain.heightAt(u.mx, u.mz), u.mz - fz * kick);
  }
}

function showWeapon(u, w) {
  if (w.hold !== 'throw') return true;
  if (u.atkT >= w.windup) return false;
  if (u.atkT < 0 && u.cool > w.cd * 0.6) return false;
  return true;
}

// frame() writes into shared scratch vectors; copy them out before the next call.
function copyFrame(X, Y, Z) {
  X[0] = F[0][0]; X[1] = F[0][1]; X[2] = F[0][2];
  Y[0] = F[1][0]; Y[1] = F[1][1]; Y[2] = F[1][2];
  Z[0] = F[2][0]; Z[1] = F[2][1]; Z[2] = F[2][2];
}
const F = frame(0, 1, 0, 1, 0, 0); // frame() returns its shared scratch vectors

// Billboard health bars for damaged living units.
export function drawHealthBar(G, u, alpha, camRight, camUp, camFwd) {
  if (!u.alive || u.hp >= u.maxHp) return;
  const j = P.HEAD * 3, s = u.size;
  const x = u.o[j] + (u.p[j] - u.o[j]) * alpha, y = u.o[j + 1] + (u.p[j + 1] - u.o[j + 1]) * alpha + 0.42 * s + 0.1, z = u.o[j + 2] + (u.p[j + 2] - u.o[j + 2]) * alpha;
  const w = 0.7 * Math.max(1, s * 0.8), h = 0.08;
  const f = u.hp / u.maxHp;
  const bt = G.bar;
  let o = bt.alloc(0.02, 0.02, 0.03);
  writeBasis(bt.M, o, camRight, camUp, camFwd, w + 0.05, h + 0.05, 0.01, x, y, z);
  const tc = u.team ? [1, 0.25, 0.22] : [0.25, 0.55, 1];
  o = bt.alloc(tc[0], tc[1], tc[2]);
  const fw = w * f;
  writeBasis(bt.M, o, camRight, camUp, camFwd, fw, h, 0.02, x - camRight[0] * (w - fw) / 2 - camFwd[0] * 0.01, y - camRight[1] * (w - fw) / 2, z - camRight[2] * (w - fw) / 2 - camFwd[2] * 0.01);
}

export { mixc };
