// Small math helpers, seeded RNG and colour utilities shared by sim and render.

export const TAU = Math.PI * 2;
export const DT = 1 / 60; // fixed simulation step (s)

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const angDiff = (a, b) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};
export const approachAngle = (a, b, step) => a + clamp(angDiff(a, b), -step, step);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simulation RNG. Reseeded per battle so the same armies + seed replay the same way
// (groundwork for replays / lockstep multiplayer). Visual-only randomness uses Math.random.
let simRand = mulberry32(1);
export const seedSim = (s) => { simRand = mulberry32(s); };
export const rnd = () => simRand();
export const rr = (a, b) => a + simRand() * (b - a);
export const fr = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(simRand() * arr.length) | 0];

// Value noise (2D) for terrain.
export function makeNoise(seed) {
  const r = mulberry32(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = r(); }
  for (let i = 255; i > 0; i--) {
    const j = (r() * (i + 1)) | 0;
    const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const v = (x, y) => vals[perm[(x & 255) + perm[y & 255]]];
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = smooth(xf), w = smooth(yf);
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), w) * 2 - 1;
  };
  n2.fbm = (x, y, oct = 4) => {
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
  };
  return n2;
}

// Colours as [r,g,b] in 0..1, fed straight into instance colours.
const cache = new Map();
export function rgb(hex) {
  let c = cache.get(hex);
  if (c) return c;
  const n = parseInt(hex.slice(1), 16);
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); // sRGB -> linear (renderer works in linear)
  c = [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)];
  cache.set(hex, c);
  return c;
}
export const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
export const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

// Segment (a->b) vs sphere (c, r): returns t in 0..1 of first hit or -1.
export function segSphere(ax, ay, az, bx, by, bz, cx, cy, cz, r) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const fx = ax - cx, fy = ay - cy, fz = az - cz;
  const a = dx * dx + dy * dy + dz * dz;
  const c = fx * fx + fy * fy + fz * fz - r * r;
  if (c <= 0) return 0;
  if (a < 1e-9) return -1;
  const b = 2 * (fx * dx + fy * dy + fz * dz);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

export function fmtMoney(n) {
  return n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : String(Math.round(n));
}
