// Camera modes: free fly (TABS-style), follow a unit, cinematic auto-director,
// third-person possession, and a slow orbit for the menu backdrop.
import * as THREE from 'three';
import { terrain } from '../sim/terrain.js';
import { world } from '../sim/world.js';
import { clamp, lerp, angDiff } from '../util.js';

const V = new THREE.Vector3(), T = new THREE.Vector3();

export class CamCtl {
  constructor(camera) {
    this.cam = camera;
    this.mode = 'free';
    this.pos = new THREE.Vector3(-40, 18, 0);
    this.yaw = 0; // same convention as units: forward = (cos yaw, 0, sin yaw)
    this.pitch = -0.35;
    this.vel = new THREE.Vector3();
    this.keys = {};
    this.boost = false;
    this.follow = null;
    this.followDist = 7;
    this.followYaw = 0;
    this.followPitch = -0.3;
    this.cineT = 0;
    this.cineAng = 0;
    this.shakeAmt = 0;
    this.orbitT = 0;
    this.look = new THREE.Vector3();
  }

  setFree(fromCurrent = true) {
    if (fromCurrent) {
      this.pos.copy(this.cam.position);
      const d = this.cam.getWorldDirection(V);
      this.yaw = Math.atan2(d.z, d.x);
      this.pitch = Math.asin(clamp(d.y, -1, 1));
    }
    this.mode = 'free';
    this.follow = null;
  }

  frame(team) { // overview of a side (or the whole field)
    this.mode = 'free';
    this.follow = null;
    if (team === 0) { this.pos.set(-58, 30, 0); this.yaw = 0; this.pitch = -0.56; }
    else if (team === 1) { this.pos.set(58, 30, 0); this.yaw = Math.PI; this.pitch = -0.56; }
    else { this.pos.set(-8, 46, -46); this.yaw = Math.PI / 2 + 0.15; this.pitch = -0.78; }
    this.vel.set(0, 0, 0);
  }

  startFollow(u) {
    this.mode = 'follow';
    this.follow = u;
    this.followYaw = Math.atan2(this.cam.position.z - u.cz(), this.cam.position.x - u.cx());
    this.followDist = clamp(this.cam.position.distanceTo(T.set(u.cx(), u.cy(), u.cz())), 4 * u.size, 14 * u.size);
  }

  look2(dx, dy) { // mouse look in radians
    if (this.mode === 'follow') {
      this.followYaw -= dx; this.followPitch = clamp(this.followPitch - dy, -1.3, 0.5);
    } else {
      this.yaw += dx; this.pitch = clamp(this.pitch - dy, -1.5, 1.2);
      if (this.mode === 'cine') this.setFree(true);
    }
  }

  zoom(amount) {
    if (this.mode === 'follow') { this.followDist = clamp(this.followDist * (1 + amount * 0.12), 2.5, 40); return; }
    if (this.mode === 'cine') this.setFree(true);
    const f = this.forward(V);
    this.vel.addScaledVector(f, -amount * 9 * (this.boost ? 2.5 : 1));
  }

  forward(out) {
    const cp = Math.cos(this.pitch);
    return out.set(Math.cos(this.yaw) * cp, Math.sin(this.pitch), Math.sin(this.yaw) * cp);
  }

  shake(amount) { this.shakeAmt = Math.min(1.2, this.shakeAmt + amount); }

  update(dt) {
    const cam = this.cam;
    switch (this.mode) {
      case 'free': this.updateFree(dt); break;
      case 'follow': this.updateFollow(dt); break;
      case 'cine': this.updateCine(dt); break;
      case 'possess': this.updatePossess(dt); break;
      case 'orbit': this.updateOrbit(dt); break;
    }
    if (this.shakeAmt > 0.001) {
      const s = this.shakeAmt * 0.35;
      cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s;
      this.shakeAmt *= Math.pow(0.02, dt);
    }
  }

  clampGround(p, pad = 1.2) {
    const g = terrain.surfaceAt(p.x, p.z) + pad;
    if (p.y < g) p.y = g;
    const lim = terrain.HALF + 30;
    p.x = clamp(p.x, -lim, lim); p.z = clamp(p.z, -lim, lim);
    if (p.y > 140) p.y = 140;
  }

  updateFree(dt) {
    const k = this.keys;
    const sp = (this.boost ? 60 : 22) * Math.max(1, (this.pos.y - terrain.surfaceAt(this.pos.x, this.pos.z)) / 25);
    const fx = Math.cos(this.yaw), fz = Math.sin(this.yaw);
    let mx = 0, my = 0, mz = 0;
    if (k.w) { mx += fx; mz += fz; }
    if (k.s) { mx -= fx; mz -= fz; }
    if (k.a) { mx += fz; mz -= fx; }
    if (k.d) { mx -= fz; mz += fx; }
    if (k.e) my += 1;
    if (k.q) my -= 1;
    const acc = Math.min(1, dt * 10);
    this.vel.x += (mx * sp - this.vel.x) * acc;
    this.vel.z += (mz * sp - this.vel.z) * acc;
    this.vel.y += (my * sp * 0.7 - this.vel.y) * acc;
    this.pos.addScaledVector(this.vel, dt);
    this.clampGround(this.pos);
    this.cam.position.copy(this.pos);
    this.cam.lookAt(T.copy(this.pos).add(this.forward(V)));
  }

  updateFollow(dt) {
    const u = this.follow;
    if (!u || u.sink) { this.setFree(true); return; }
    const tx = u.cx(), ty = u.cy() + 0.6 * u.size, tz = u.cz();
    if (!this.dragging) this.followYaw += angDiff(this.followYaw, u.yaw + Math.PI) * dt * 0.4 * (u.alive ? 1 : 0);
    const cp = Math.cos(this.followPitch);
    V.set(tx + Math.cos(this.followYaw) * cp * this.followDist, ty - Math.sin(this.followPitch) * this.followDist, tz + Math.sin(this.followYaw) * cp * this.followDist);
    this.clampGround(V);
    this.cam.position.lerp(V, Math.min(1, dt * 6));
    this.look.lerp(T.set(tx, ty, tz), Math.min(1, dt * 10));
    this.cam.lookAt(this.look);
  }

  // Auto director: orbit the centre of the fighting, zoom to fit, hop onto heroes.
  updateCine(dt) {
    const list = world.alive;
    if (!list.length) { this.updateOrbit(dt); return; }
    let cx = 0, cz = 0, n = 0, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (const u of list) {
      cx += u.ax; cz += u.az; n++;
      minX = Math.min(minX, u.ax); maxX = Math.max(maxX, u.ax); minZ = Math.min(minZ, u.az); maxZ = Math.max(maxZ, u.az);
    }
    cx /= n; cz /= n;
    const span = Math.max(maxX - minX, maxZ - minZ, 10);
    this.cineAng += dt * 0.12;
    const dist = clamp(span * 0.75, 14, 70);
    const cy = terrain.heightAt(cx, cz);
    V.set(cx + Math.cos(this.cineAng) * dist, cy + dist * 0.55 + 4, cz + Math.sin(this.cineAng) * dist);
    this.clampGround(V, 3);
    this.cam.position.lerp(V, Math.min(1, dt * 1.2));
    this.look.lerp(T.set(cx, cy + 1, cz), Math.min(1, dt * 2));
    this.cam.lookAt(this.look);
  }

  updatePossess(dt) {
    const u = this.follow;
    if (!u || !u.alive) { this.mode = 'free'; this.setFree(true); return; }
    const s = Math.max(1, u.size);
    const cp = Math.cos(this.pitch);
    const fx = Math.cos(this.yaw) * cp, fy = Math.sin(this.pitch), fz = Math.sin(this.yaw) * cp;
    const rx = -Math.sin(this.yaw), rz = Math.cos(this.yaw);
    const hx = u.cx(), hy = u.cy() + 0.9 * s, hz = u.cz();
    V.set(hx - fx * 4 * s + rx * 0.9 * s, hy - fy * 4 * s + 0.5 * s, hz - fz * 4 * s + rz * 0.9 * s);
    this.clampGround(V, 0.6);
    this.cam.position.lerp(V, Math.min(1, dt * 14));
    this.cam.lookAt(T.set(hx + fx * 30, hy + fy * 30, hz + fz * 30));
  }

  updateOrbit(dt) {
    this.orbitT += dt * 0.06;
    const r = 42;
    V.set(Math.cos(this.orbitT) * r, 16 + Math.sin(this.orbitT * 0.7) * 3, Math.sin(this.orbitT) * r);
    V.y += terrain.heightAt(V.x, V.z) * 0.4;
    this.cam.position.lerp(V, Math.min(1, dt * 2));
    this.look.lerp(T.set(0, terrain.heightAt(0, 0) + 1, 0), Math.min(1, dt * 2));
    this.cam.lookAt(this.look);
  }
}

export { lerp };
