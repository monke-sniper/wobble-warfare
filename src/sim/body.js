// 3D Verlet "active ragdoll": 15 point masses + distance constraints.
// While alive, every step builds an animated target pose (walk cycle with procedural foot
// placement, weapon-specific arm poses, attack swings) and pulls the points toward it with
// a strength scaled by the unit's balance. Low balance = floppy, zero = full ragdoll.
import { terrain } from './terrain.js';
import { clamp, smooth, DT } from '../util.js';

export const P = { HEAD: 0, NECK: 1, PELVIS: 2, LSHO: 3, RSHO: 4, LHIP: 5, RHIP: 6, LELB: 7, LHAND: 8, RELB: 9, RHAND: 10, LKNEE: 11, LFOOT: 12, RKNEE: 13, RFOOT: 14 };
export const NP = 15;
const { HEAD, NECK, PELVIS, LSHO, RSHO, LHIP, RHIP, LELB, LHAND, RELB, RHAND, LKNEE, LFOOT, RKNEE, RFOOT } = P;
const GRAV = 9.81 * DT * DT;

// Canonical standing pose (size 1) facing +X, right = +Z. [forward, up, right]
const C = [];
C[HEAD] = [0.02, 1.70, 0]; C[NECK] = [0.04, 1.44, 0]; C[PELVIS] = [-0.02, 0.9, 0];
C[LSHO] = [0, 1.38, -0.23]; C[RSHO] = [0, 1.38, 0.23];
C[LHIP] = [0, 0.9, -0.12]; C[RHIP] = [0, 0.9, 0.12];
C[LELB] = [0, 1.08, -0.26]; C[LHAND] = [0, 0.79, -0.27];
C[RELB] = [0, 1.08, 0.26]; C[RHAND] = [0, 0.79, 0.27];
C[LKNEE] = [0, 0.5, -0.12]; C[LFOOT] = [0, 0.08, -0.12];
C[RKNEE] = [0, 0.5, 0.12]; C[RFOOT] = [0, 0.08, 0.12];

export const DIM = { hip: 0.9, thigh: 0.4, shin: 0.42, torso: 0.54, shoW: 0.23, hipW: 0.12, uarm: 0.3, farm: 0.29, neckHead: 0.26, headR: 0.21 };
const ARM = DIM.uarm + DIM.farm;

// [a, b, stiffness, minOnly]
const CONS = [
  [NECK, LSHO, 1], [NECK, RSHO, 1], [LSHO, RSHO, 1], [PELVIS, LHIP, 1], [PELVIS, RHIP, 1], [LHIP, RHIP, 1],
  [LSHO, LHIP, 1], [RSHO, RHIP, 1], [LSHO, RHIP, 1], [RSHO, LHIP, 1], [NECK, PELVIS, 1], [NECK, LHIP, 1], [NECK, RHIP, 1],
  [PELVIS, LSHO, 1], [PELVIS, RSHO, 1],
  [HEAD, NECK, 1], [HEAD, LSHO, 0.5], [HEAD, RSHO, 0.5],
  [LSHO, LELB, 1], [LELB, LHAND, 1], [RSHO, RELB, 1], [RELB, RHAND, 1],
  [LHIP, LKNEE, 1], [LKNEE, LFOOT, 1], [RHIP, RKNEE, 1], [RKNEE, RFOOT, 1],
  [LHIP, LFOOT, 1, 0.55], [RHIP, RFOOT, 1, 0.55], [LSHO, LHAND, 1, 0.5], [RSHO, RHAND, 1, 0.5],
  [LKNEE, RKNEE, 1, 0.3], [LFOOT, RFOOT, 1, 0.3], [HEAD, PELVIS, 1, 0.95],
];
const NC = CONS.length;
const CA = new Int8Array(NC), CB = new Int8Array(NC), CS = new Float32Array(NC), CMIN = new Float32Array(NC), CREST = new Float32Array(NC);
CONS.forEach(([a, b, s, mn], i) => {
  CA[i] = a; CB[i] = b; CS[i] = s;
  const d = Math.hypot(C[a][0] - C[b][0], C[a][1] - C[b][1], C[a][2] - C[b][2]);
  CREST[i] = d;
  CMIN[i] = mn ? mn : 0; // fraction of rest length below which a min-only constraint pushes
});

const MASS = [6, 8, 12, 6, 6, 6, 6, 2.5, 1.5, 2.5, 1.5, 4, 3, 4, 3];
export const RAD = [0.21, 0.12, 0.13, 0.1, 0.1, 0.1, 0.1, 0.07, 0.06, 0.07, 0.06, 0.08, 0.07, 0.08, 0.07];
const PULL = [0.2, 0.3, 0.32, 0.26, 0.26, 0.26, 0.26, 0.1, 0.32, 0.1, 0.32, 0.16, 0.5, 0.16, 0.5];
const T = new Float64Array(NP * 3); // pose target scratch

export function buildBody(u, x, z, yaw) {
  const s = u.size;
  u.p = new Float64Array(NP * 3);
  u.o = new Float64Array(NP * 3);
  u.im = new Float32Array(NP);
  u.rest = new Float32Array(NC);
  for (let i = 0; i < NC; i++) u.rest[i] = CREST[i] * s;
  for (let i = 0; i < NP; i++) u.im[i] = 1 / MASS[i];
  u.yaw = yaw;
  u.ax = x; u.az = z;
  const gy = terrain.heightAt(x, z);
  const f = [Math.cos(yaw), Math.sin(yaw)], r = [-Math.sin(yaw), Math.cos(yaw)];
  for (let i = 0; i < NP; i++) {
    const c = C[i];
    const px = x + (f[0] * c[0] + r[0] * c[2]) * s;
    const pz = z + (f[1] * c[0] + r[1] * c[2]) * s;
    const py = gy + c[1] * s;
    u.p[i * 3] = u.o[i * 3] = px; u.p[i * 3 + 1] = u.o[i * 3 + 1] = py; u.p[i * 3 + 2] = u.o[i * 3 + 2] = pz;
  }
  const hw = DIM.hipW * s;
  u.feet = [
    { x: x - r[0] * hw, z: z - r[1] * hw, y: gy, lift: 0, sx: 0, sz: 0, ex: 0, ez: 0, t: -1 },
    { x: x + r[0] * hw, z: z + r[1] * hw, y: gy, lift: 0, sx: 0, sz: 0, ex: 0, ez: 0, t: -1 },
  ];
  u.sleep = 0;
  u.asleep = false;
  u.wd = [Math.cos(yaw) * 0.6, 0.8, Math.sin(yaw) * 0.6];
  u.wd2 = [u.wd[0], u.wd[1], u.wd[2]];
}

// Velocity change in m/s applied to one point (spread to neighbours by constraints).
export function impulse(u, i, vx, vy, vz) {
  const k = DT / Math.max(0.3, u.def.mass);
  u.o[i * 3] -= vx * k; u.o[i * 3 + 1] -= vy * k; u.o[i * 3 + 2] -= vz * k;
  u.asleep = false; u.sleep = 0;
}
export function impulseAll(u, vx, vy, vz) {
  const k = DT / Math.max(0.3, u.def.mass);
  for (let i = 0; i < NP; i++) { u.o[i * 3] -= vx * k; u.o[i * 3 + 1] -= vy * k; u.o[i * 3 + 2] -= vz * k; }
  u.asleep = false; u.sleep = 0;
}

// ---------------------------------------------------------------- pose
function set(i, x, y, z) { T[i * 3] = x; T[i * 3 + 1] = y; T[i * 3 + 2] = z; }

// Two-bone IK helper: place joint j between a and end e, bending toward (bx,by,bz).
function ik(a, e, j, len1, len2, bx, by, bz) {
  const ax = T[a * 3], ay = T[a * 3 + 1], az = T[a * 3 + 2];
  let ex = T[e * 3], ey = T[e * 3 + 1], ez = T[e * 3 + 2];
  let dx = ex - ax, dy = ey - ay, dz = ez - az;
  let d = Math.hypot(dx, dy, dz) || 1e-4;
  const max = (len1 + len2) * 0.995;
  if (d > max) { const k = max / d; dx *= k; dy *= k; dz *= k; d = max; ex = ax + dx; ey = ay + dy; ez = az + dz; set(e, ex, ey, ez); }
  const half = d / 2;
  const h = Math.sqrt(Math.max(0, len1 * len1 - half * half));
  // remove the component of the bend hint along the limb
  const nx = dx / d, ny = dy / d, nz = dz / d;
  const proj = bx * nx + by * ny + bz * nz;
  let px = bx - nx * proj, py = by - ny * proj, pz = bz - nz * proj;
  const pl = Math.hypot(px, py, pz) || 1;
  px /= pl; py /= pl; pz /= pl;
  set(j, ax + dx * 0.5 + px * h, ay + dy * 0.5 + py * h, az + dz * 0.5 + pz * h);
}

const A = [0, 0, 0], WD = [0, 0, 0], WD2 = [0, 0, 0];

function hand(i, sho, fx, fy, fz) { // hand at shoulder + offset (offset already scaled)
  set(i, T[sho * 3] + fx, T[sho * 3 + 1] + fy, T[sho * 3 + 2] + fz);
}

// Keyframed swing curve: returns 0 (idle/ready) -> 1 (wound up) -> 2 (strike) -> 0.
function swingPhase(u) {
  if (u.atkT < 0) return { a: 0, b: 0 };
  const w = u.w;
  const wind = Math.max(0.08, w.windup);
  const t = u.atkT;
  if (t < wind) return { a: smooth(t / wind), b: 0 };
  const st = (t - wind) / 0.12;
  if (st < 1) return { a: 1 - st, b: smooth(st) };
  const rec = (t - wind - 0.12) / 0.3;
  return { a: 0, b: Math.max(0, 1 - smooth(Math.min(1, rec))) };
}

function buildPose(u, speed) {
  const s = u.size, L = ARM * s;
  const fx = Math.cos(u.yaw), fz = Math.sin(u.yaw);
  const rx = -fz, rz = fx;
  // aim direction
  const cp = Math.cos(u.aimPitch);
  A[0] = Math.cos(u.aimYaw) * cp; A[1] = Math.sin(u.aimPitch); A[2] = Math.sin(u.aimYaw) * cp;

  const feet = u.feet;
  const gA = terrain.heightAt(u.ax, u.az);
  const gy = gA * 0.5 + (feet[0].y + feet[1].y) * 0.25 - 0.07 * s * 0.5;
  const moving = Math.min(1, speed / 2.2);
  u.phase += speed * DT * 3.2 / Math.sqrt(s);
  const bob = moving * Math.abs(Math.sin(u.phase)) * 0.05 * s + (1 - moving) * Math.sin(u.t * 2 + u.id) * 0.008 * s;
  const crouch = u.crouch || 0;
  const py = Math.max(gy, gA - 0.2 * s) + (DIM.hip * 0.97 - crouch * 0.25) * s + bob;

  let lean = moving * 0.16 + (u.leanExtra || 0);
  const sw = swingPhase(u);
  const hold = u.w.hold;
  if (hold === 'headbutt') lean += sw.a * -0.35 + sw.b * 0.7;
  else if (hold === 'two' || hold === 'carry') lean += sw.a * -0.15 + sw.b * 0.3;
  else lean += sw.b * 0.12;
  // torso up vector
  let ux = fx * lean, uy = 1, uz = fz * lean;
  const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  // slight twist toward aim for ranged holds
  const tw = (hold === 'bow' || hold === 'rifle' || hold === 'pistol' || hold === 'shoulder') ? 0.25 : 0.1;

  const ax = u.ax, az = u.az;
  set(PELVIS, ax, py, az);
  const hw = DIM.hipW * s;
  set(LHIP, ax - rx * hw, py, az - rz * hw);
  set(RHIP, ax + rx * hw, py, az + rz * hw);
  const tl = DIM.torso * s;
  const nx = ax + ux * tl + fx * 0.04 * s, ny = py + uy * tl, nz = az + uz * tl + fz * 0.04 * s;
  set(NECK, nx, ny, nz);
  // shoulders (twisted toward aim a little)
  const bw = DIM.shoW * s * (u.def.look.bulk || 1);
  const trx = rx + A[0] * tw * 0.3, trz = rz + A[2] * tw * 0.3;
  set(LSHO, nx - trx * bw - ux * 0.06 * s, ny - uy * 0.06 * s, nz - trz * bw - uz * 0.06 * s);
  set(RSHO, nx + trx * bw - ux * 0.06 * s, ny - uy * 0.06 * s, nz + trz * bw - uz * 0.06 * s);
  let hfx = fx * 0.03, hfz = fz * 0.03;
  if (hold === 'headbutt') { hfx = fx * (-0.18 * sw.a + 0.4 * sw.b); hfz = fz * (-0.18 * sw.a + 0.4 * sw.b); }
  const hn = DIM.neckHead * s;
  set(HEAD, nx + ux * hn + hfx * s, ny + uy * hn, nz + uz * hn + hfz * s);

  // ---- feet & knees
  for (let k = 0; k < 2; k++) {
    const ft = feet[k], idx = k ? RFOOT : LFOOT;
    set(idx, ft.x, ft.y + RAD[idx] * s, ft.z);
  }
  const kb = 1; // knee bend hint forward
  ik(LHIP, LFOOT, LKNEE, DIM.thigh * s, DIM.shin * s, fx * kb - rx * 0.1, 0, fz * kb - rz * 0.1);
  ik(RHIP, RFOOT, RKNEE, DIM.thigh * s, DIM.shin * s, fx * kb + rx * 0.1, 0, fz * kb + rz * 0.1);

  // ---- arms (per hold)
  const swingArm = Math.sin(u.phase) * moving * 0.25 * L;
  let wdx = fx * 0.6, wdy = 0.8, wdz = fz * 0.6; // weapon direction target
  let w2x = wdx, w2y = wdy, w2z = wdz;
  const rec = u.recoil || 0;
  const LS = LSHO, RS = RSHO;

  const idleLeft = () => hand(LHAND, LS, fx * (0.1 * L - swingArm) - rx * 0.06 * L, -0.92 * L, fz * (0.1 * L - swingArm) - rz * 0.06 * L);
  const shieldLeft = () => hand(LHAND, LS, fx * 0.5 * L + rx * 0.22 * L, -0.3 * L, fz * 0.5 * L + rz * 0.22 * L);

  switch (hold) {
    case 'fists':
    case 'headbutt': {
      if (hold === 'headbutt') {
        hand(RHAND, RS, fx * (0.1 * L + swingArm) + rx * 0.08 * L, -0.9 * L, fz * (0.1 * L + swingArm) + rz * 0.08 * L);
        if (u.def.shield) shieldLeft(); else idleLeft();
        break;
      }
      const side = u.atkSide;
      const guard = (sho, sgn) => hand(sho === RS ? RHAND : LHAND, sho, fx * 0.45 * L - rx * sgn * 0.15 * L, -0.25 * L, fz * 0.45 * L - rz * sgn * 0.15 * L);
      guard(RS, 1); guard(LS, -1);
      const pi = side ? LHAND : RHAND, ps = side ? LS : RS;
      const ext = sw.b * 0.95 - sw.a * 0.1;
      if (ext !== 0) hand(pi, ps, A[0] * (0.4 + ext * 0.55) * L, (-0.2 + A[1]) * L * 0.6, A[2] * (0.4 + ext * 0.55) * L);
      if (u.def.shield) shieldLeft();
      break;
    }
    case 'one':
    case 'dual': {
      const dual = hold === 'dual';
      const strikeRight = !dual || !u.atkSide;
      const pose = (hi, sho, sgn, active) => {
        const a = active ? sw.a : 0, b = active ? sw.b : 0;
        // idle: forward-low; wound: up-back; strike: forward along aim
        let ox = fx * 0.35 * L + rx * sgn * 0.12 * L, oy = -0.45 * L, oz = fz * 0.35 * L + rz * sgn * 0.12 * L;
        ox += (-fx * 0.45 * L + rx * sgn * 0.05 * L - ox) * a; oy += (0.55 * L - oy) * a; oz += (-fz * 0.45 * L + rz * sgn * 0.05 * L - oz) * a;
        ox += (A[0] * 0.95 * L - rx * sgn * 0.1 * L - ox) * b; oy += ((A[1] - 0.15) * 0.9 * L - oy) * b; oz += (A[2] * 0.95 * L - rz * sgn * 0.1 * L - oz) * b;
        if (!active && !dual) { ox += fx * swingArm * 0.3; oz += fz * swingArm * 0.3; }
        hand(hi, sho, ox, oy, oz);
        // weapon direction
        let dx = fx * 0.55, dy = 0.85, dz = fz * 0.55;
        dx += (-fx * 0.8 - dx) * a; dy += (0.6 - dy) * a; dz += (-fz * 0.8 - dz) * a;
        dx += (A[0] - dx) * b; dy += (A[1] - 0.55 - dy) * b; dz += (A[2] - dz) * b;
        return [dx, dy, dz];
      };
      [wdx, wdy, wdz] = pose(RHAND, RS, 1, strikeRight);
      if (dual) [w2x, w2y, w2z] = pose(LHAND, LS, -1, !strikeRight);
      else if (u.def.shield) shieldLeft();
      else idleLeft();
      break;
    }
    case 'two':
    case 'carry': {
      const a = sw.a, b = sw.b;
      let ox = fx * 0.42 * L - rx * 0.12 * L, oy = -0.42 * L, oz = fz * 0.42 * L - rz * 0.12 * L;
      if (hold === 'carry') { oy = -0.2 * L; ox = fx * 0.5 * L - rx * 0.05 * L; oz = fz * 0.5 * L - rz * 0.05 * L; }
      ox += (fx * -0.15 * L - rx * 0.15 * L - ox) * a; oy += (0.75 * L - oy) * a; oz += (fz * -0.15 * L - rz * 0.15 * L - oz) * a;
      ox += (A[0] * 0.85 * L - rx * 0.2 * L - ox) * b; oy += ((A[1] - 0.3) * 0.85 * L - oy) * b; oz += (A[2] * 0.85 * L - rz * 0.2 * L - oz) * b;
      hand(RHAND, RS, ox, oy, oz);
      if (hold === 'carry') { wdx = 0; wdy = 1; wdz = 0; wdx += A[0] * b; wdz += A[2] * b; }
      else {
        wdx = fx * 0.45; wdy = 0.9; wdz = fz * 0.45;
        wdx += (-fx * 0.9 - wdx) * a; wdy += (0.4 - wdy) * a; wdz += (-fz * 0.9 - wdz) * a;
        wdx += (A[0] - wdx) * b; wdy += (A[1] - 0.6 - wdy) * b; wdz += (A[2] - wdz) * b;
      }
      const wl = Math.hypot(wdx, wdy, wdz) || 1;
      const g = (hold === 'carry' ? 0 : 0.28) * s;
      const rh = RHAND * 3;
      if (hold === 'carry') set(LHAND, T[rh] - rx * 0.4 * s, T[rh + 1], T[rh + 2] - rz * 0.4 * s);
      else set(LHAND, T[rh] + (wdx / wl) * g, T[rh + 1] + (wdy / wl) * g, T[rh + 2] + (wdz / wl) * g);
      break;
    }
    case 'spear': {
      const k = -sw.a * 0.3 + sw.b * 0.45;
      hand(RHAND, RS, A[0] * (0.2 + k) * L + fx * 0.1 * L, -0.35 * L + A[1] * 0.4 * L, A[2] * (0.2 + k) * L + fz * 0.1 * L);
      const rh = RHAND * 3, g = 0.45 * s;
      set(LHAND, T[rh] + A[0] * g - rx * 0.05 * s, T[rh + 1] + A[1] * g + 0.03 * s, T[rh + 2] + A[2] * g - rz * 0.05 * s);
      wdx = A[0]; wdy = A[1] + 0.05; wdz = A[2];
      if (u.def.shield) shieldLeft();
      break;
    }
    case 'throw': {
      const a = sw.a, b = sw.b;
      let ox = fx * 0.15 * L + rx * 0.2 * L, oy = -0.55 * L, oz = fz * 0.15 * L + rz * 0.2 * L;
      ox += (-A[0] * 0.55 * L + rx * 0.15 * L - ox) * a; oy += (0.6 * L - oy) * a; oz += (-A[2] * 0.55 * L + rz * 0.15 * L - oz) * a;
      ox += (A[0] * 0.95 * L - ox) * b; oy += ((A[1] + 0.1) * 0.8 * L - oy) * b; oz += (A[2] * 0.95 * L - oz) * b;
      hand(RHAND, RS, ox, oy, oz);
      wdx = A[0] * 0.3 + (a > 0 ? -A[0] : 0); wdy = 1; wdz = A[2] * 0.3 + (a > 0 ? -A[2] : 0);
      if (u.def.shield) shieldLeft();
      else hand(LHAND, LS, A[0] * 0.6 * L * (a + 0.3), -0.5 * L + a * 0.5 * L, A[2] * 0.6 * L * (a + 0.3));
      break;
    }
    case 'bow': {
      const raise = u.bowUp;
      // bow hand extended toward aim when raised, lowered otherwise
      const lx = A[0] * 0.95 * L, ly = A[1] * 0.95 * L, lz = A[2] * 0.95 * L;
      hand(LHAND, LS, lx * raise + fx * 0.3 * L * (1 - raise), ly * raise - 0.6 * L * (1 - raise), lz * raise + fz * 0.3 * L * (1 - raise));
      const lh = LHAND * 3, dr = u.draw * raise;
      const cx = T[NECK * 3] + rx * 0.08 * s - ux * 0.06 * s, cy = T[NECK * 3 + 1] + 0.02 * s, cz = T[NECK * 3 + 2] + rz * 0.08 * s;
      const sx0 = T[lh] - A[0] * 0.15 * s, sy0 = T[lh + 1] - A[1] * 0.15 * s, sz0 = T[lh + 2] - A[2] * 0.15 * s;
      if (raise > 0.3) set(RHAND, sx0 + (cx - sx0) * dr, sy0 + (cy - sy0) * dr, sz0 + (cz - sz0) * dr);
      else hand(RHAND, RS, fx * 0.1 * L, -0.9 * L, fz * 0.1 * L);
      // bow stands vertical-ish, perpendicular to aim
      wdx = -A[0] * A[1] * raise; wdy = 1 - A[1] * A[1] * raise; wdz = -A[2] * A[1] * raise;
      break;
    }
    case 'rifle':
    case 'shoulder':
    case 'pistol': {
      if (hold === 'pistol') {
        hand(RHAND, RS, A[0] * (0.92 - rec * 0.3) * L, A[1] * 0.92 * L, A[2] * (0.92 - rec * 0.3) * L);
        idleLeft();
      } else {
        const back = hold === 'shoulder' ? 0.12 : 0.32;
        hand(RHAND, RS, A[0] * (back - rec * 0.25) * L - rx * 0.06 * L, (A[1] * back - 0.05) * L + (hold === 'shoulder' ? 0.12 * L : 0), A[2] * (back - rec * 0.25) * L - rz * 0.06 * L);
        const rh = RHAND * 3, g = (hold === 'shoulder' ? 0.32 : 0.42) * s;
        set(LHAND, T[rh] + A[0] * g - rx * 0.03 * s, T[rh + 1] + A[1] * g - 0.04 * s, T[rh + 2] + A[2] * g - rz * 0.03 * s);
      }
      wdx = A[0]; wdy = A[1]; wdz = A[2];
      break;
    }
    case 'heavy': {
      const pr = PELVIS * 3;
      set(RHAND, T[pr] + rx * 0.2 * s + fx * 0.35 * s - A[0] * rec * 0.1, T[pr + 1] + 0.32 * s, T[pr + 2] + rz * 0.2 * s + fz * 0.35 * s - A[2] * rec * 0.1);
      const rh = RHAND * 3;
      set(LHAND, T[rh] + A[0] * 0.35 * s - rx * 0.1 * s, T[rh + 1] + A[1] * 0.35 * s + 0.05 * s, T[rh + 2] + A[2] * 0.35 * s - rz * 0.1 * s);
      wdx = A[0]; wdy = A[1]; wdz = A[2];
      break;
    }
    case 'staff': {
      const cast = Math.max(sw.a, sw.b, u.casting || 0);
      hand(RHAND, RS, fx * (0.3 + 0.55 * cast) * L + rx * 0.15 * L, (-0.5 + 0.75 * cast) * L, fz * (0.3 + 0.55 * cast) * L + rz * 0.15 * L);
      if (cast > 0.05) hand(LHAND, LS, A[0] * 0.9 * L * cast, (A[1] * 0.9 - 0.1) * L * cast - 0.8 * L * (1 - cast), A[2] * 0.9 * L * cast);
      else idleLeft();
      wdx = fx * 0.15 * (1 + cast * 2); wdy = 1; wdz = fz * 0.15 * (1 + cast * 2);
      break;
    }
    case 'crew': {
      const push = Math.sin(Math.min(1, sw.a + sw.b) * Math.PI) * 0.2;
      hand(RHAND, RS, fx * (0.55 + push) * L - rx * 0.05 * L, -0.5 * L, fz * (0.55 + push) * L - rz * 0.05 * L);
      hand(LHAND, LS, fx * (0.55 + push) * L + rx * 0.05 * L, -0.5 * L, fz * (0.55 + push) * L + rz * 0.05 * L);
      break;
    }
    default:
      hand(RHAND, RS, fx * (0.1 * L + swingArm), -0.9 * L, fz * (0.1 * L + swingArm));
      idleLeft();
  }

  // elbows bend back/out/down
  ik(RSHO, RHAND, RELB, DIM.uarm * s, DIM.farm * s, rx * 0.6 - fx * 0.5, -0.5, rz * 0.6 - fz * 0.5);
  ik(LSHO, LHAND, LELB, DIM.uarm * s, DIM.farm * s, -rx * 0.6 - fx * 0.5, -0.5, -rz * 0.6 - fz * 0.5);

  WD[0] = wdx; WD[1] = wdy; WD[2] = wdz;
  WD2[0] = w2x; WD2[1] = w2y; WD2[2] = w2z;
  const wl = Math.hypot(WD[0], WD[1], WD[2]) || 1, wl2 = Math.hypot(WD2[0], WD2[1], WD2[2]) || 1;
  const k = 0.35;
  for (let i = 0; i < 3; i++) {
    u.wd[i] += (WD[i] / wl - u.wd[i]) * k;
    u.wd2[i] += (WD2[i] / wl2 - u.wd2[i]) * k;
  }
}

// ---------------------------------------------------------------- feet
function updateFeet(u, speed) {
  const s = u.size;
  const fx = Math.cos(u.yaw), fz = Math.sin(u.yaw);
  const rx = -fz, rz = fx;
  const hw = DIM.hipW * s * 1.15;
  const dur = Math.max(0.16, Math.min(0.34, 0.34 / (0.7 + speed * 0.18))) * Math.sqrt(s);
  const thr = (speed > 0.4 ? 0.22 : 0.16) * s;
  for (let k = 0; k < 2; k++) {
    const ft = u.feet[k], other = u.feet[1 - k];
    const sg = k ? 1 : -1;
    if (u.ctrl < 0.45) { // not in control: feet follow the ragdoll so recovery starts from reality
      const pi = (k ? RFOOT : LFOOT) * 3;
      ft.x = u.p[pi]; ft.z = u.p[pi + 2]; ft.t = -1;
    } else if (ft.t >= 0) {
      ft.t += DT / dur;
      const t = Math.min(1, ft.t);
      const e = smooth(t);
      ft.x = ft.sx + (ft.ex - ft.sx) * e;
      ft.z = ft.sz + (ft.ez - ft.sz) * e;
      ft.lift = Math.sin(t * Math.PI) * (0.1 + Math.min(0.12, speed * 0.04)) * s;
      if (ft.t >= 1) { ft.t = -1; ft.lift = 0; if (speed > 0.5 && u.onStep) u.onStep(u, k); }
    } else if (other.t < 0 || other.t > 0.85) {
      const ix = u.ax + rx * sg * hw + u.vx * 0.12, iz = u.az + rz * sg * hw + u.vz * 0.12;
      const d = Math.hypot(ft.x - ix, ft.z - iz);
      if (d > thr || (speed < 0.1 && d > 0.08 * s && u.idleStep)) {
        ft.sx = ft.x; ft.sz = ft.z;
        ft.ex = ix + u.vx * dur * 0.9; ft.ez = iz + u.vz * dur * 0.9;
        ft.t = 0;
      }
    }
    ft.y = terrain.heightAt(ft.x, ft.z) + (ft.lift || 0);
  }
}

// ---------------------------------------------------------------- step
export function stepBody(u) {
  const p = u.p, o = u.o, s = u.size;
  if (u.asleep) return;
  const alive = u.alive;
  const damp = alive ? 0.982 : 0.99;
  for (let i = 0; i < NP * 3; i += 3) {
    const vx = (p[i] - o[i]) * damp, vy = (p[i + 1] - o[i + 1]) * damp, vz = (p[i + 2] - o[i + 2]) * damp;
    o[i] = p[i]; o[i + 1] = p[i + 1]; o[i + 2] = p[i + 2];
    p[i] += vx; p[i + 1] += vy - GRAV; p[i + 2] += vz;
  }

  if (alive) {
    const speed = Math.hypot(u.vx, u.vz);
    updateFeet(u, speed);
    // airborne units lose control until they land
    const pel = PELVIS * 3;
    const air = p[pel + 1] - terrain.heightAt(p[pel], p[pel + 2]) > DIM.hip * s * 1.6;
    const ctrl = u.ctrl * (air ? 0.1 : 1);
    if (ctrl > 0.01) {
      buildPose(u, speed);
      const maxStep = 0.07 * s;
      for (let i = 0; i < NP; i++) {
        const j = i * 3, k = PULL[i] * ctrl;
        let dx = (T[j] - p[j]) * k, dy = (T[j + 1] - p[j + 1]) * k, dz = (T[j + 2] - p[j + 2]) * k;
        const m = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
        if (m > maxStep) { const c = maxStep / m; dx *= c; dy *= c; dz *= c; }
        p[j] += dx; p[j + 1] += dy; p[j + 2] += dz;
        // damp velocity relative to the anchor's motion for a controlled (but still wobbly) gait
        const dmp = 0.1 * ctrl;
        o[j] += (p[j] - o[j] - u.vx * DT) * dmp;
        o[j + 1] += (p[j + 1] - o[j + 1]) * dmp;
        o[j + 2] += (p[j + 2] - o[j + 2] - u.vz * DT) * dmp;
      }
    }
  }

  // constraints
  const rest = u.rest, im = u.im;
  for (let it = 0; it < 4; it++) {
    for (let c = 0; c < NC; c++) {
      const a = CA[c] * 3, b = CB[c] * 3;
      const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
      let r = rest[c];
      if (CMIN[c]) { r *= CMIN[c]; if (d >= r) continue; }
      const wa = im[CA[c]], wb = im[CB[c]];
      const diff = ((d - r) / (d * (wa + wb))) * CS[c];
      p[a] += dx * diff * wa; p[a + 1] += dy * diff * wa; p[a + 2] += dz * diff * wa;
      p[b] -= dx * diff * wb; p[b + 1] -= dy * diff * wb; p[b + 2] -= dz * diff * wb;
    }
  }

  // ground + water
  const water = terrain.water;
  const fric = alive ? 0.25 : 0.35;
  let moved = 0;
  for (let i = 0; i < NP; i++) {
    const j = i * 3;
    const g = terrain.heightAt(p[j], p[j + 2]) + RAD[i] * s;
    if (p[j + 1] < g) {
      p[j + 1] = g;
      if (o[j + 1] < g) o[j + 1] = g;
      o[j] += (p[j] - o[j]) * fric;
      o[j + 2] += (p[j + 2] - o[j + 2]) * fric;
    }
    if (water !== null && p[j + 1] < water) {
      o[j] += (p[j] - o[j]) * 0.08; o[j + 2] += (p[j + 2] - o[j + 2]) * 0.08;
      o[j + 1] += (p[j + 1] - o[j + 1]) * 0.12;
      if (!alive) p[j + 1] += GRAV * 1.6; // corpses float
    }
    if (!alive) moved = Math.max(moved, Math.abs(p[j] - o[j]) + Math.abs(p[j + 1] - o[j + 1]) + Math.abs(p[j + 2] - o[j + 2]));
  }
  if (!alive) {
    if (moved < 0.0025) { if (++u.sleep > 40) u.asleep = true; }
    else u.sleep = 0;
  }
}

export function pt(u, i, out) {
  out.x = u.p[i * 3]; out.y = u.p[i * 3 + 1]; out.z = u.p[i * 3 + 2];
  return out;
}
