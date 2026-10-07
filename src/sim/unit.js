// A battlefield unit: logical anchor + AI state on top of an active-ragdoll body.
import { buildBody, stepBody, P, DIM } from './body.js';
import { terrain } from './terrain.js';
import { WEAPONS } from '../data/weapons.js';
import { UNITS } from '../data/factions.js';
import { rr, rnd, approachAngle, clamp, DT } from '../util.js';

let uid = 0;
export function resetIds() { uid = 0; }

export class Unit {
  constructor(type, team, x, z, yaw = team === 0 ? 0 : Math.PI) {
    const def = UNITS[type];
    this.id = ++uid;
    this.type = type;
    this.def = def;
    this.team = team;
    this.size = def.size;
    this.w = WEAPONS[def.weapon];
    this.hp = this.maxHp = def.hp;
    this.alive = true;
    this.t = rnd() * 10;
    this.phase = rnd() * 6;
    // movement
    this.vx = 0; this.vz = 0; this.mvx = 0; this.mvz = 0;
    this.faceYaw = yaw;
    this.aimYaw = yaw; this.aimPitch = 0;
    this.turn = def.mech ? 2.2 : 6;
    // state
    this.stagger = 0; this.ctrl = 1;
    this.atkT = -1; this.released = true; this.atkSide = 0;
    this.cool = rr(0.3, 1.2) * Math.min(this.w.cd, 3);
    this.burstLeft = 0; this.burstT = 0;
    this.draw = 0; this.bowUp = 0; this.casting = 0; this.recoil = 0; this.spin = 0; this.spinup = 0;
    this.target = null; this.retarget = 0; this.engaged = 0;
    this.heal = null; this.healing = false;
    this.rangeMul = rr(0.72, 0.92);
    this.dashCd = rr(0, 1.5); this.chargeT = 0;
    this.freezeT = 0; this.poison = 0;
    this.hitFlash = 0;
    this.kills = 0; this.dmgDealt = 0;
    this.deathT = 0; this.sink = 0;
    this.player = null; // set while possessed
    this.idleStep = true;
    buildBody(this, x, z, yaw);
    if (def.machine) { this.mx = x + Math.cos(yaw) * 1.4; this.mz = z + Math.sin(yaw) * 1.4; this.myaw = yaw; this.mfire = 0; }
  }

  px(i) { return this.p[i * 3]; }
  py(i) { return this.p[i * 3 + 1]; }
  pz(i) { return this.p[i * 3 + 2]; }
  // chest point (between neck and pelvis)
  cx() { return (this.p[3] + this.p[6]) * 0.5; }
  cy() { return (this.p[4] + this.p[7]) * 0.5; }
  cz() { return (this.p[5] + this.p[8]) * 0.5; }

  // Called each fixed step by the world. `think` is the AI (or player) controller.
  update(battleOn, think) {
    const dt = DT;
    this.t += dt;
    this.hitFlash -= dt;
    this.recoil *= 0.8;
    if (!this.alive) { stepBody(this); return; }

    this.stagger = Math.max(0, this.stagger - dt * (this.def.mech ? 1.4 : 0.9));
    const target = clamp(1.25 - this.stagger, 0, 1);
    this.ctrl += (target - this.ctrl) * (target > this.ctrl ? 0.04 : 0.5);
    if (this.freezeT > 0) this.freezeT -= dt;
    this.cool -= dt * (this.freezeT > 0 ? 0.5 : 1);
    this.dashCd -= dt;

    this.mvx = 0; this.mvz = 0;
    if (battleOn && this.ctrl > 0.5) think(this, dt);
    else if (!battleOn) {
      this.faceYaw = this.team === 0 ? 0 : Math.PI;
      this.aimYaw = this.faceYaw + Math.sin(this.t * 0.6 + this.id) * 0.05;
      this.aimPitch = 0;
      this.bowUp += (0 - this.bowUp) * 0.1;
    }

    // velocity toward desired, slowed by freeze and lost control
    let mul = this.freezeT > 0 ? 0.5 : 1;
    if (this.chargeT > 0) { this.chargeT -= dt; mul *= 2.1; }
    const acc = Math.min(1, dt * 7);
    this.vx += (this.mvx * mul - this.vx) * acc;
    this.vz += (this.mvz * mul - this.vz) * acc;
    if (this.ctrl < 0.5) { this.vx *= 0.85; this.vz *= 0.85; }
    // wading
    if (terrain.water !== null && terrain.heightAt(this.ax, this.az) < terrain.water - 0.3) { this.vx *= 0.96; this.vz *= 0.96; }
    this.ax += this.vx * dt;
    this.az += this.vz * dt;

    // anchor is leashed to the real body so knockback actually moves the unit
    const pelx = this.p[6], pelz = this.p[8];
    const dx = this.ax - pelx, dz = this.az - pelz, d = Math.hypot(dx, dz);
    const leash = 0.35 * this.size;
    if (d > leash) { this.ax = pelx + (dx / d) * leash; this.az = pelz + (dz / d) * leash; }
    const lim = terrain.HALF - 8;
    this.ax = clamp(this.ax, -lim, lim); this.az = clamp(this.az, -lim, lim);

    this.yaw = approachAngle(this.yaw, this.faceYaw, this.turn * dt * (this.freezeT > 0 ? 0.5 : 1));

    // attack timeline
    if (this.atkT >= 0) {
      this.atkT += dt * (this.freezeT > 0 ? 0.6 : 1);
      if (!this.released && this.atkT >= this.w.windup) { this.released = true; this.onRelease(this, false); }
      if (this.w.hold === 'bow') this.draw = Math.min(1, this.atkT / Math.max(0.1, this.w.windup));
      if (this.atkT > this.w.windup + 0.45) { this.atkT = -1; this.draw = 0; }
    }
    if (this.burstLeft > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) { this.burstLeft--; this.burstT = this.w.gap; this.onRelease(this, true); }
    }
    if (this.atkT < 0 || this.atkT > this.w.windup) this.draw = 0;
    this.casting *= 0.92;

    stepBody(this);
  }
}

export const HIP_H = DIM.hip;
export { P };
