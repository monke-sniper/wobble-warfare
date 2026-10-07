// Visual effects: pooled low-poly particles (scale-out instead of alpha fades), tracers, beams,
// lightning, shockwave rings, flash lights, stuck arrows/spears and in-flight projectiles.
import * as THREE from 'three';
import { writeBasis, writeSegment, frame } from './batcher.js';
import { projModel } from './models.js';
import { terrain } from '../sim/terrain.js';
import { rgb, fr } from '../util.js';

const CAP = 4096;
const SHAPES = ['pcube', 'pico', 'ptet'];

export class FX {
  constructor(scene, geoms) {
    this.geoms = geoms;
    this.n = 0;
    const F = (n = CAP) => new Float32Array(n);
    this.x = F(); this.y = F(); this.z = F(); this.vx = F(); this.vy = F(); this.vz = F();
    this.age = F(); this.life = F(); this.size = F(); this.grow = F(); this.r = F(); this.g = F(); this.b = F();
    this.grav = F(); this.drag = F(); this.rot = F(); this.rot2 = F(); this.spin = F();
    this.glow = new Uint8Array(CAP); this.shape = new Uint8Array(CAP);
    this.next = 0;
    this.beams = [];
    this.rings = [];
    this.stuck = [];
    this.stuckNext = 0;
    this.stuckCap = 600;
    this.quality = 1;
    this.lights = [];
    for (let i = 0; i < 3; i++) {
      const L = new THREE.PointLight('#ffb060', 0, 18, 1.6);
      L.userData.k = 0;
      scene.add(L);
      this.lights.push(L);
    }
  }

  clear() {
    this.life.fill(0); this.age.fill(1);
    this.beams.length = 0; this.rings.length = 0; this.stuck.length = 0; this.stuckNext = 0;
    for (const L of this.lights) { L.intensity = 0; L.userData.k = 0; }
  }

  // ---------------------------------------------------------------- particles
  p(x, y, z, vx, vy, vz, life, size, col, glow = 0, shape = 1, grav = 0, drag = 0.98, grow = 1) {
    const i = this.next;
    this.next = (this.next + 1) % CAP;
    this.x[i] = x; this.y[i] = y; this.z[i] = z; this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
    this.age[i] = 0; this.life[i] = life; this.size[i] = size; this.grow[i] = grow;
    this.r[i] = col[0]; this.g[i] = col[1]; this.b[i] = col[2];
    this.glow[i] = glow; this.shape[i] = shape; this.grav[i] = grav; this.drag[i] = drag;
    this.rot[i] = Math.random() * 6.3; this.rot2[i] = Math.random() * 6.3; this.spin[i] = fr(-6, 6);
  }

  flash(x, y, z, power, color = '#ffb060') {
    let L = this.lights[0];
    for (const l of this.lights) if (l.userData.k < L.userData.k) L = l;
    L.position.set(x, y + 1, z);
    L.color.set(color);
    L.userData.k = power;
    L.distance = 6 + power * 2;
    L.intensity = power * 30;
  }

  update(dt) {
    for (let i = 0; i < CAP; i++) {
      if (this.age[i] >= this.life[i]) continue;
      this.age[i] += dt;
      const d = this.drag[i];
      this.vx[i] *= d; this.vy[i] = this.vy[i] * d - 9.81 * this.grav[i] * dt; this.vz[i] *= d;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; this.z[i] += this.vz[i] * dt;
      if (this.grav[i] > 0) {
        const g = terrain.heightAt(this.x[i], this.z[i]) + this.size[i] * 0.5;
        if (this.y[i] < g) { this.y[i] = g; this.vy[i] *= -0.3; this.vx[i] *= 0.6; this.vz[i] *= 0.6; this.spin[i] *= 0.5; }
      }
    }
    for (let k = this.beams.length - 1; k >= 0; k--) { const b = this.beams[k]; b.t -= dt; if (b.t <= 0) this.beams.splice(k, 1); }
    for (let k = this.rings.length - 1; k >= 0; k--) { const r = this.rings[k]; r.t += dt; if (r.t >= r.life) this.rings.splice(k, 1); }
    for (const L of this.lights) {
      if (L.userData.k <= 0) continue;
      L.userData.k = Math.max(0, L.userData.k - dt * 9);
      L.intensity = L.userData.k * 30;
    }
  }

  draw(B, G, alpha, camRight) {
    const geos = this.geoms;
    for (let i = 0; i < CAP; i++) {
      const age = this.age[i], life = this.life[i];
      if (age >= life) continue;
      const t = age / life;
      let s = this.size[i] * (1 + (this.grow[i] - 1) * t);
      if (t > 0.65) s *= (1 - t) / 0.35;
      if (s <= 0.002) continue;
      const bt = B.geo((this.glow[i] ? 'g' : 'l') + SHAPES[this.shape[i]], geos[SHAPES[this.shape[i]]], !!this.glow[i]);
      const o = bt.alloc(this.r[i], this.g[i], this.b[i]);
      const a = this.rot[i] + age * this.spin[i], b = this.rot2[i] + age * this.spin[i] * 0.7;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      const M = bt.M;
      M[o] = ca * s; M[o + 1] = 0; M[o + 2] = -sa * s; M[o + 3] = 0;
      M[o + 4] = sa * sb * s; M[o + 5] = cb * s; M[o + 6] = ca * sb * s; M[o + 7] = 0;
      M[o + 8] = sa * cb * s; M[o + 9] = -sb * s; M[o + 10] = ca * cb * s; M[o + 11] = 0;
      M[o + 12] = this.x[i]; M[o + 13] = this.y[i]; M[o + 14] = this.z[i]; M[o + 15] = 1;
    }
    // beams / lightning
    const gb = B.geo('gcube', geos.pcube, true);
    for (const b of this.beams) {
      const k = b.t / b.life;
      writeSegment(gb, b.col, b.ax, b.ay, b.az, b.bx, b.by, b.bz, b.w * k, b.w * k, camRight[0], camRight[1], camRight[2]);
    }
    // shockwave rings
    const rb = B.geo('ring', geos.ring, true);
    for (const r of this.rings) {
      const t = r.t / r.life, R = r.r * (0.2 + t * 1.2), h = 0.5 * (1 - t);
      const o = rb.alloc(r.col[0], r.col[1], r.col[2]);
      writeBasis(rb.M, o, [1, 0, 0], [0, 1, 0], [0, 0, 1], R, h, R, r.x, r.y + h * 0.5, r.z);
    }
    this.drawStuck(B, alpha);
  }

  // ---------------------------------------------------------------- stuck arrows / spears
  addStuck(type, team, unit, idx, x, y, z, dx, dy, dz) {
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    const len = type === 'spear' ? 0.55 : type === 'bolt' ? 0.8 : type === 'harpoon' ? 0.4 : 0.3;
    const e = { type, team, unit, idx, x: x + dx * len, y: y + dy * len, z: z + dz * len, dx, dy, dz, ox: 0, oy: 0, oz: 0 };
    if (unit) { const j = idx * 3; e.ox = e.x - unit.p[j]; e.oy = e.y - unit.p[j + 1]; e.oz = e.z - unit.p[j + 2]; }
    if (this.stuck.length < this.stuckCap) this.stuck.push(e);
    else { this.stuck[this.stuckNext] = e; this.stuckNext = (this.stuckNext + 1) % this.stuckCap; }
  }

  drawStuck(B, alpha) {
    for (const e of this.stuck) {
      let x = e.x, y = e.y, z = e.z;
      const u = e.unit;
      if (u) {
        if (u.sink) continue;
        const j = e.idx * 3;
        x = u.o[j] + (u.p[j] - u.o[j]) * alpha + e.ox; y = u.o[j + 1] + (u.p[j + 1] - u.o[j + 1]) * alpha + e.oy; z = u.o[j + 2] + (u.p[j + 2] - u.o[j + 2]) * alpha + e.oz;
      }
      const m = projModel(e.type, e.team);
      const pair = B.model('pj' + e.type + e.team, m);
      const [X, Y, Z] = frame(e.dx, e.dy, e.dz, 0, 1, 0);
      for (const bt of pair) {
        if (!bt) continue;
        const o = bt.alloc(1, 1, 1);
        writeBasis(bt.M, o, X, Y, Z, 1, 1, 1, x, y, z);
      }
    }
  }

  // ---------------------------------------------------------------- projectiles in flight
  drawProjectiles(B, list, alpha, camRight) {
    const geos = this.geoms;
    const gb = B.geo('gcube', geos.pcube, true);
    for (const pr of list) {
      const x = pr.px + (pr.x - pr.px) * alpha, y = pr.py + (pr.y - pr.py) * alpha, z = pr.pz + (pr.z - pr.pz) * alpha;
      const sp = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
      if (pr.type === 'bullet') {
        const L = Math.min(sp * 0.03, 3);
        const c = pr.col || (pr.col = rgb(pr.color));
        writeSegment(gb, c, x - (pr.vx / sp) * L, y - (pr.vy / sp) * L, z - (pr.vz / sp) * L, x, y, z, 0.05, 0.05, camRight[0], camRight[1], camRight[2]);
        continue;
      }
      const m = projModel(pr.type, pr.team);
      const pair = B.model('pj' + pr.type + pr.team, m);
      const spinT = pr.type === 'shuriken' || pr.type === 'rock' || pr.type === 'boulder' || pr.type === 'bomb' || pr.type === 'dynamite' || pr.type === 'potion' || pr.type === 'grenade';
      let fx = pr.vx, fy = pr.vy, fz = pr.vz;
      let hx = 0, hy = 1, hz = 0;
      if (spinT) { const a = pr.spin * (pr.type === 'shuriken' ? 3 : 1); fx = Math.cos(a); fy = Math.sin(a); fz = 0.3; hx = 0; hy = 0; hz = 1; }
      const [X, Y, Z] = frame(fx, fy, fz, hx, hy, hz);
      const s = pr.type === 'magic' ? pr.size / 0.25 : 1;
      const col = pr.type === 'magic' ? (pr.col || (pr.col = rgb(pr.color))) : [1, 1, 1];
      for (const bt of pair) {
        if (!bt) continue;
        const o = bt.alloc(col[0], col[1], col[2]);
        writeBasis(bt.M, o, X, Y, Z, s, s, s, x, y, z);
      }
    }
  }

  // ---------------------------------------------------------------- named effects (sim hooks)
  emit(name, a, b, c, d, e, f, g, h) {
    const q = this.quality;
    switch (name) {
      case 'explosion': return this.explosion(a, b, c, d, e, f);
      case 'potion': {
        const col = rgb(e || '#7dff5a');
        for (let i = 0; i < 14 * q; i++) this.p(a, b, c, fr(-4, 4), fr(1, 6), fr(-4, 4), fr(0.4, 0.9), fr(0.15, 0.35), col, 1, 1, 0.6, 0.97, 1.4);
        for (let i = 0; i < 8 * q; i++) this.p(a + fr(-1, 1) * d * 0.5, b, c + fr(-1, 1) * d * 0.5, 0, fr(0.5, 1.5), 0, fr(0.8, 1.6), fr(0.3, 0.6), col, 1, 1, 0, 0.95, 1.8);
        this.ring(a, b, c, d, col, 0.3);
        return;
      }
      case 'muzzle': {
        const col = rgb(g || '#ffd36b');
        this.p(a + d * 0.05, b + e * 0.05, c + f * 0.05, d * 2, e * 2, f * 2, 0.06, 0.18, col, 1, 1, 0, 0.9, 1.6);
        for (let i = 0; i < 2 * q; i++) this.p(a, b, c, d * fr(4, 10) + fr(-1, 1), e * fr(4, 10) + fr(-1, 1), f * fr(4, 10) + fr(-1, 1), 0.12, 0.04, col, 1, 2, 0.2);
        const sm = (h || 0) * q;
        for (let i = 0; i < sm * 4; i++) this.p(a, b, c, d * fr(1, 4) + fr(-0.5, 0.5), e * fr(1, 3) + fr(0.2, 1), f * fr(1, 4) + fr(-0.5, 0.5), fr(0.6, 1.4), fr(0.12, 0.25) * (1 + sm * 0.3), rgb('#d8d8d8'), 0, 1, -0.03, 0.94, 2.2);
        if (h > 1) this.flash(a, b, c, 1.2, g);
        return;
      }
      case 'blood': {
        const col = rgb('#b3202a');
        for (let i = 0; i < 4 * q; i++) this.p(a, b, c, d * fr(1, 4) + fr(-1.5, 1.5), e * fr(1, 3) + fr(0.5, 3), f * fr(1, 4) + fr(-1.5, 1.5), fr(0.4, 0.8), fr(0.05, 0.1), col, 0, 0, 1, 0.98);
        return;
      }
      case 'sparks': {
        const col = rgb(g || '#ffe08a');
        for (let i = 0; i < (h || 5) * q; i++) this.p(a, b, c, d * fr(2, 6) + fr(-3, 3), e * fr(2, 6) + fr(0, 4), f * fr(2, 6) + fr(-3, 3), fr(0.15, 0.35), fr(0.03, 0.06), col, 1, 2, 0.6);
        return;
      }
      case 'dust': {
        const col = rgb(terrain.biome.dirt);
        const n = Math.max(1, Math.round(4 * d * q));
        for (let i = 0; i < n; i++) this.p(a, b + 0.1, c, fr(-1, 1) * d * 2, fr(0.5, 2) * d, fr(-1, 1) * d * 2, fr(0.4, 0.9), fr(0.1, 0.25) * (0.5 + d), col, 0, 1, 0, 0.92, 2);
        return;
      }
      case 'splash': {
        const col = rgb(terrain.biome.waterColor || '#3d9be0');
        for (let i = 0; i < 6 * q; i++) this.p(a, b, c, fr(-1.5, 1.5), fr(2, 5), fr(-1.5, 1.5), fr(0.4, 0.8), fr(0.08, 0.16), col, terrain.biome.waterGlow ? 1 : 0, 1, 1);
        return;
      }
      case 'trail': {
        this.p(a, b, c, fr(-0.3, 0.3), fr(0.2, 0.6), fr(-0.3, 0.3), fr(0.35, 0.7) * d, fr(0.08, 0.14) * d, rgb('#d9d9d9'), 0, 1, 0, 0.96, 2);
        this.p(a, b, c, 0, 0, 0, 0.08, 0.14 * d, rgb('#ffb347'), 1, 1, 0, 0.9, 0.5);
        return;
      }
      case 'magictrail': this.p(a, b, c, fr(-0.4, 0.4), fr(-0.4, 0.4), fr(-0.4, 0.4), fr(0.25, 0.5), fr(0.08, 0.16), rgb(d || '#ffffff'), 1, 2, 0, 0.95, 0.3); return;
      case 'fuse': this.p(a, b, c, fr(-1, 1), fr(1, 2), fr(-1, 1), 0.2, 0.04, rgb('#ffcf3a'), 1, 2, 0.5); return;
      case 'ice': for (let i = 0; i < 6 * q; i++) this.p(a, b, c, fr(-2, 2), fr(0, 3), fr(-2, 2), fr(0.3, 0.6), fr(0.05, 0.12), rgb('#bff8ff'), 1, 2, 0.5); return;
      case 'poison': this.p(a + fr(-0.2, 0.2), b, c + fr(-0.2, 0.2), 0, fr(0.6, 1.2), 0, fr(0.5, 0.9), fr(0.06, 0.12), rgb('#7dff5a'), 1, 1, 0, 0.98, 0.4); return;
      case 'fire': for (let i = 0; i < 2; i++) this.p(a + fr(-0.3, 0.3), b, c + fr(-0.3, 0.3), 0, fr(1, 3), 0, fr(0.3, 0.6), fr(0.12, 0.25), rgb(Math.random() < 0.5 ? '#ff7a1a' : '#ffcf3a'), 1, 1, 0, 0.95, 0.4); return;
      case 'summon': {
        for (let i = 0; i < 18 * q; i++) this.p(a + fr(-0.6, 0.6), b + fr(0, 0.4), c + fr(-0.6, 0.6), fr(-0.5, 0.5), fr(1.5, 5), fr(-0.5, 0.5), fr(0.5, 1.1), fr(0.08, 0.18), rgb(Math.random() < 0.6 ? '#7dff6a' : '#b48bff'), 1, 1, 0, 0.95, 0.5);
        this.ring(a, b, c, 2.2, rgb('#7dff6a'), 0.5);
        this.flash(a, b, c, 0.8, '#7dff6a');
        return;
      }
      case 'bones': for (let i = 0; i < 8 * q; i++) this.p(a, b, c, fr(-3, 3), fr(1, 5), fr(-3, 3), fr(1, 2), fr(0.06, 0.12), rgb('#ece4cc'), 0, 0, 1); return;
      case 'stick': return this.addStuck(a.type, a.team, b, c, d, e, f, a.vx, a.vy, a.vz);
      case 'stickground': return this.addStuck(a.type, a.team, null, 0, b, c, d, a.vx, a.vy, a.vz);
      case 'beam': {
        const col = rgb(g || '#7ff6ff');
        this.beams.push({ ax: a, ay: b, az: c, bx: d, by: e, bz: f, col, w: 0.22, t: 0.3, life: 0.3 });
        this.beams.push({ ax: a, ay: b, az: c, bx: d, by: e, bz: f, col: [1, 1, 1], w: 0.08, t: 0.18, life: 0.18 });
        for (let k = 0; k < 12 * q; k++) { const t = Math.random(); this.p(a + (d - a) * t, b + (e - b) * t, c + (f - c) * t, fr(-0.3, 0.3), fr(0, 0.6), fr(-0.3, 0.3), fr(0.3, 0.7), fr(0.05, 0.1), col, 1, 1, 0, 0.95, 0.5); }
        this.flash(d, e, f, 0.6, g);
        return;
      }
      case 'lightning': {
        // zig-zag from the sky
        const col = rgb('#dff4ff');
        let px = a + fr(-3, 3), py = b + 30, pz = c + fr(-3, 3);
        const steps = 8;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const jit = i < steps ? (1 - t) * 2.5 : 0;
          const nx = a + fr(-1, 1) * jit, ny = b + 30 * (1 - t), nz = c + fr(-1, 1) * jit;
          this.beams.push({ ax: px, ay: py, az: pz, bx: nx, by: ny, bz: nz, col, w: 0.35, t: 0.35, life: 0.35 });
          px = nx; py = ny; pz = nz;
        }
        this.flash(a, b + 2, c, 2.5, '#cfe8ff');
        return;
      }
    }
  }

  ring(x, y, z, r, col, life = 0.35) { this.rings.push({ x, y, z, r, col, t: 0, life }); }

  explosion(x, y, z, r, color, small) {
    const q = this.quality;
    const big = !small;
    const fire = color ? rgb(color) : rgb('#ff8a2a');
    const n1 = (big ? 10 : 5) * q, n2 = (big ? 6 : 2) * q, n3 = (big ? 12 : 4) * q;
    for (let i = 0; i < n1; i++) {
      const c = i % 3 === 0 ? rgb('#fff1a8') : i % 3 === 1 ? rgb('#ffcf3a') : fire;
      this.p(x + fr(-0.3, 0.3) * r, y + fr(0, 0.4) * r, z + fr(-0.3, 0.3) * r, fr(-2, 2) * r, fr(0.5, 3) * r, fr(-2, 2) * r, fr(0.25, 0.5), fr(0.25, 0.45) * r, c, 1, 1, 0, 0.88, 1.8);
    }
    for (let i = 0; i < n2; i++) {
      const g = fr(0.62, 0.82);
      this.p(x + fr(-0.4, 0.4) * r, y + fr(0.1, 0.5) * r, z + fr(-0.4, 0.4) * r, fr(-0.8, 0.8) * r, fr(0.8, 2.2), fr(-0.8, 0.8) * r, fr(0.8, 1.6), fr(0.11, 0.18) * r, [g, g, g * 1.03], 0, 1, -0.04, 0.95, 1.9);
    }
    const dirt = rgb(terrain.biome.dirt);
    for (let i = 0; i < n3; i++) this.p(x, y + 0.2, z, fr(-5, 5) * Math.sqrt(r), fr(4, 11), fr(-5, 5) * Math.sqrt(r), fr(1, 2.2), fr(0.08, 0.22), Math.random() < 0.5 ? dirt : rgb('#5a4a3a'), 0, 0, 1, 0.99);
    for (let i = 0; i < 8 * q; i++) this.p(x, y + 0.3, z, fr(-12, 12), fr(3, 14), fr(-12, 12), fr(0.2, 0.5), fr(0.04, 0.07), rgb('#ffe08a'), 1, 2, 0.8);
    this.ring(x, terrain.heightAt(x, z), z, r * 1.3, rgb('#fff1c8'), big ? 0.35 : 0.25);
    this.flash(x, y, z, big ? Math.min(3, r * 0.7) : 0.8, color || '#ffb060');
  }
}
