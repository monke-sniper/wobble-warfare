// Heightmap terrain: generation, exact triangle height lookup (matches the rendered mesh),
// craters, ray casting, placement zones and prop scattering.
import { makeNoise, mulberry32, clamp, smooth } from '../util.js';
import { BIOMES } from '../data/biomes.js';

export const PLAY = { x: 46, z: 30 }; // half extents of the battlefield
export const ZONE = { near: 5, far: 44 }; // deploy zones: blue x in [-far,-near], red x in [near, far]
const N = 112;
const CELL = 2.2;
const HALF = (N * CELL) / 2;

const PROP_R = { pine: 0.35, oak: 0.45, autumn: 0.45, snowpine: 0.35, palm: 0.3, cactus: 0.35, rock: 0.9, deadtree: 0.3, crystal: 0.6, mesa: 0, bush: 0, mushroom: 0.5 };

export const terrain = {
  N, CELL, HALF,
  h: new Float32Array((N + 1) * (N + 1)),
  scorch: new Float32Array((N + 1) * (N + 1)),
  biome: BIOMES.grass,
  biomeKey: 'grass',
  seed: 1,
  hilly: 0.6,
  water: null,
  lava: false,
  props: [],
  solids: [], // props that block units (in play area)
  dirty: null, // {i0,i1,j0,j1} vertex range needing a mesh refresh
  version: 0,

  gen(seed, biomeKey = 'grass', hilly = 0.6) {
    this.seed = seed;
    this.biomeKey = BIOMES[biomeKey] ? biomeKey : 'grass';
    this.biome = BIOMES[this.biomeKey];
    this.hilly = hilly;
    this.water = this.biome.water;
    this.lava = !!this.biome.lava;
    const noise = makeNoise(seed);
    const beach = this.biomeKey === 'beach';
    const h = this.h;
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const x = -HALF + i * CELL, z = -HALF + j * CELL;
        let y = noise.fbm(x * 0.028, z * 0.028, 4) * (1.6 + 3.4 * hilly);
        y += noise.fbm(x * 0.011 + 40, z * 0.011 - 17, 3) * 4.5 * hilly;
        // Keep the very middle a little calmer so armies meet on readable ground.
        const mid = Math.max(Math.abs(x) / PLAY.x, Math.abs(z) / PLAY.z);
        y *= 0.55 + 0.45 * smooth(clamp(mid, 0, 1));
        // Mountains ring the battlefield.
        const ex = Math.max(0, Math.abs(x) - (PLAY.x + 8));
        let ez = Math.max(0, Math.abs(z) - (PLAY.z + 8));
        if (beach && z > 0) ez = 0;
        const e = Math.hypot(ex, ez);
        if (e > 0) y += e * 0.45 + e * e * 0.018 * (1.3 + noise(x * 0.07, z * 0.07));
        if (beach) y -= smooth(clamp((z - 22) / 30, 0, 1)) * 8;
        h[j * (N + 1) + i] = y;
      }
    }
    this.scorch.fill(0);
    this.scatterProps(seed);
    this.dirty = null;
    this.version++;
  },

  scatterProps(seed) {
    const r = mulberry32(seed * 7 + 11);
    this.props = [];
    this.solids = [];
    const lim = HALF - 6;
    for (const [type, density, where] of this.biome.props) {
      const area = where === 'all' ? PLAY.x * 2 * PLAY.z * 2 : (lim * 2) ** 2;
      const count = Math.round((density * area) / 100 * (where === 'all' ? 0.18 : 0.12));
      for (let k = 0; k < count; k++) {
        let x, z;
        if (where === 'all') { x = (r() * 2 - 1) * PLAY.x; z = (r() * 2 - 1) * PLAY.z; }
        else {
          x = (r() * 2 - 1) * lim; z = (r() * 2 - 1) * lim;
          if (Math.abs(x) < PLAY.x + 3 && Math.abs(z) < PLAY.z + 3) continue;
        }
        const y = this.heightAt(x, z);
        if (this.water !== null && y < this.water + 0.3) continue;
        const s = 0.8 + r() * 0.6;
        const p = { type, x, y, z, rot: r() * Math.PI * 2, s, r: (PROP_R[type] || 0) * s };
        this.props.push(p);
        if (p.r > 0 && this.inPlay(x, z, 4)) this.solids.push(p);
      }
    }
  },

  inPlay(x, z, pad = 0) {
    return Math.abs(x) < PLAY.x + pad && Math.abs(z) < PLAY.z + pad;
  },

  inZone(team, x, z) {
    if (Math.abs(z) > PLAY.z - 1) return false;
    const ax = team === 0 ? -x : x;
    return ax >= ZONE.near && ax <= ZONE.far;
  },

  vtx(i, j) {
    i = clamp(i, 0, N); j = clamp(j, 0, N);
    return this.h[j * (N + 1) + i];
  },

  // Exact height on the rendered triangles (cells split along the b-c diagonal).
  heightAt(x, z) {
    let fx = (x + HALF) / CELL, fz = (z + HALF) / CELL;
    fx = clamp(fx, 0, N - 1e-4); fz = clamp(fz, 0, N - 1e-4);
    const i = fx | 0, j = fz | 0;
    const u = fx - i, v = fz - j;
    const W = N + 1, h = this.h, k = j * W + i;
    const a = h[k], b = h[k + 1], c = h[k + W], d = h[k + W + 1];
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  },

  // Ground or water surface, whichever is higher.
  surfaceAt(x, z) {
    const y = this.heightAt(x, z);
    return this.water !== null && y < this.water ? this.water : y;
  },

  slopeAt(x, z, out) {
    const e = 0.6;
    out.x = (this.heightAt(x - e, z) - this.heightAt(x + e, z)) / (2 * e);
    out.z = (this.heightAt(x, z - e) - this.heightAt(x, z + e)) / (2 * e);
    return out;
  },

  crater(x, z, r, depth) {
    const W = N + 1;
    const i0 = clamp(Math.floor((x - r + HALF) / CELL), 0, N), i1 = clamp(Math.ceil((x + r + HALF) / CELL), 0, N);
    const j0 = clamp(Math.floor((z - r + HALF) / CELL), 0, N), j1 = clamp(Math.ceil((z + r + HALF) / CELL), 0, N);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const vx = -HALF + i * CELL, vz = -HALF + j * CELL;
        const d = Math.hypot(vx - x, vz - z) / r;
        if (d >= 1) continue;
        const k = j * W + i, f = (1 - d * d);
        this.h[k] -= depth * f * f;
        this.scorch[k] = Math.min(1, this.scorch[k] + f * 0.9);
      }
    }
    const D = this.dirty;
    if (D) { D.i0 = Math.min(D.i0, i0); D.i1 = Math.max(D.i1, i1); D.j0 = Math.min(D.j0, j0); D.j1 = Math.max(D.j1, j1); }
    else this.dirty = { i0, i1, j0, j1 };
  },

  // Ray vs terrain: returns distance t along the (normalised) direction, or -1.
  raycast(ox, oy, oz, dx, dy, dz, maxT = 400) {
    let t = 0, step = 0.6, prevT = 0;
    while (t < maxT) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      if (y <= this.heightAt(x, z)) {
        let lo = prevT, hi = t;
        for (let k = 0; k < 10; k++) {
          const m = (lo + hi) / 2;
          if (oy + dy * m <= this.heightAt(ox + dx * m, oz + dz * m)) hi = m; else lo = m;
        }
        return hi;
      }
      prevT = t;
      t += step;
      if (t > 60) step = 1.5;
    }
    return -1;
  },
};
