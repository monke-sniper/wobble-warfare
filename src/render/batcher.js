// Instanced batching: every distinct geometry gets one InstancedMesh that is refilled each
// frame. Hundreds of ragdolls with gear cost a few dozen draw calls in total.
import * as THREE from 'three';

class Batch {
  constructor(owner, geom, mat, cap = 64) {
    this.owner = owner;
    this.geom = geom;
    this.mat = mat;
    this.count = 0;
    this.make(cap);
  }
  make(cap) {
    const old = this.mesh;
    const m = new THREE.InstancedMesh(this.geom, this.mat, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.castShadow = this.owner.shadows && !this.owner.noShadow;
    m.receiveShadow = false;
    m.count = 0;
    if (old) {
      m.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, this.count * 16));
      m.instanceColor.array.set(old.instanceColor.array.subarray(0, this.count * 3));
      this.owner.group.remove(old);
      old.dispose();
    }
    this.cap = cap;
    this.mesh = m;
    this.M = m.instanceMatrix.array;
    this.C = m.instanceColor.array;
    this.owner.group.add(m);
  }
  // Returns the float offset to write 16 matrix elements at; colour set separately.
  alloc(r, g, b) {
    if (this.count >= this.cap) this.make(this.cap * 2);
    const i = this.count++;
    const c = i * 3;
    this.C[c] = r; this.C[c + 1] = g; this.C[c + 2] = b;
    return i * 16;
  }
}

export class Batcher {
  constructor(parent, { shadows = true, noShadow = false } = {}) {
    this.group = new THREE.Group();
    parent.add(this.group);
    this.shadows = shadows;
    this.noShadow = noShadow;
    this.lit = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    this.map = new Map();
  }
  // key -> Batch for a raw geometry (lit unless glow=true)
  geo(key, geom, glow = false) {
    let bt = this.map.get(key);
    if (!bt) { bt = new Batch(this, geom, glow ? this.glow : this.lit); this.map.set(key, bt); }
    return bt;
  }
  // model = { lit, glow } -> [litBatch|null, glowBatch|null]
  model(key, model) {
    let pair = this.map.get(key);
    if (!pair) {
      pair = [model.lit ? new Batch(this, model.lit, this.lit) : null, model.glow ? new Batch(this, model.glow, this.glow) : null];
      this.map.set(key, pair);
    }
    return pair;
  }
  begin() {
    for (const v of this.map.values()) {
      if (Array.isArray(v)) { if (v[0]) v[0].count = 0; if (v[1]) v[1].count = 0; } else v.count = 0;
    }
  }
  end() {
    const fin = (bt) => {
      if (!bt) return;
      const m = bt.mesh;
      m.count = bt.count;
      m.visible = bt.count > 0;
      if (bt.count) {
        m.instanceMatrix.clearUpdateRanges();
        m.instanceMatrix.addUpdateRange(0, bt.count * 16);
        m.instanceMatrix.needsUpdate = true;
        m.instanceColor.clearUpdateRanges();
        m.instanceColor.addUpdateRange(0, bt.count * 3);
        m.instanceColor.needsUpdate = true;
      }
    };
    for (const v of this.map.values()) { if (Array.isArray(v)) { fin(v[0]); fin(v[1]); } else fin(v); }
  }
  setShadows(on) {
    this.shadows = on;
    const set = (bt) => { if (bt) bt.mesh.castShadow = on && !this.noShadow; };
    for (const v of this.map.values()) { if (Array.isArray(v)) { set(v[0]); set(v[1]); } else set(v); }
  }
  drawCalls() {
    let n = 0;
    for (const v of this.map.values()) { if (Array.isArray(v)) { n += (v[0] && v[0].count ? 1 : 0) + (v[1] && v[1].count ? 1 : 0); } else n += v.count ? 1 : 0; }
    return n;
  }
}

// ---------------------------------------------------------------- matrix writers
// Column-major basis matrix: X, Y, Z axes scaled by sx, sy, sz, translated to (px,py,pz).
export function writeBasis(M, o, X, Y, Z, sx, sy, sz, px, py, pz) {
  M[o] = X[0] * sx; M[o + 1] = X[1] * sx; M[o + 2] = X[2] * sx; M[o + 3] = 0;
  M[o + 4] = Y[0] * sy; M[o + 5] = Y[1] * sy; M[o + 6] = Y[2] * sy; M[o + 7] = 0;
  M[o + 8] = Z[0] * sz; M[o + 9] = Z[1] * sz; M[o + 10] = Z[2] * sz; M[o + 11] = 0;
  M[o + 12] = px; M[o + 13] = py; M[o + 14] = pz; M[o + 15] = 1;
}

const SX = [0, 0, 0], SY = [0, 0, 0], SZ = [0, 0, 0];
// Build an orthonormal frame with Y = dir, X close to hint. Results in SX/SY/SZ.
export function frame(dx, dy, dz, hx, hy, hz) {
  let l = Math.hypot(dx, dy, dz) || 1;
  SY[0] = dx / l; SY[1] = dy / l; SY[2] = dz / l;
  const d = hx * SY[0] + hy * SY[1] + hz * SY[2];
  let x0 = hx - SY[0] * d, x1 = hy - SY[1] * d, x2 = hz - SY[2] * d;
  l = Math.hypot(x0, x1, x2);
  if (l < 1e-4) { // hint parallel to dir: pick any perpendicular
    if (Math.abs(SY[1]) < 0.9) { x0 = SY[2]; x1 = 0; x2 = -SY[0]; } else { x0 = 1; x1 = 0; x2 = 0; }
    l = Math.hypot(x0, x1, x2);
  }
  SX[0] = x0 / l; SX[1] = x1 / l; SX[2] = x2 / l;
  SZ[0] = SX[1] * SY[2] - SX[2] * SY[1];
  SZ[1] = SX[2] * SY[0] - SX[0] * SY[2];
  SZ[2] = SX[0] * SY[1] - SX[1] * SY[0];
  return [SX, SY, SZ];
}

// Instance stretched between a and b (geometry is unit-sized, centred, along Y).
export function writeSegment(bt, col, ax, ay, az, bx, by, bz, tx, tz, hx, hy, hz) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const L = Math.hypot(dx, dy, dz) || 1e-4;
  frame(dx, dy, dz, hx, hy, hz);
  const o = bt.alloc(col[0], col[1], col[2]);
  writeBasis(bt.M, o, SX, SY, SZ, tx, L, tz, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
}
