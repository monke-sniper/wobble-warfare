// Three.js stage: renderer, lights, low-poly terrain + water + props, deploy-zone overlays,
// clouds, quality presets with automatic downgrade when the frame rate drops.
import * as THREE from 'three';
import { terrain, PLAY, ZONE } from '../sim/terrain.js';
import { Batcher } from './batcher.js';
import { bodyGeoms, propModel, TEAM_COLORS } from './models.js';
import { FX } from './fx.js';
import { rgb, mixc, clamp, mulberry32 } from '../util.js';

const QUALITY = {
  low: { ratio: 0.75, shadow: 0, fx: 0.5 },
  medium: { ratio: 1, shadow: 1024, fx: 0.8 },
  high: { ratio: 2, shadow: 2048, fx: 1 },
};

export class Stage {
  constructor(canvas) {
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NeutralToneMapping; // keeps colours punchy without blowing out sunlit slopes
    r.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 700);
    this.camera.position.set(0, 20, -40);

    this.hemi = new THREE.HemisphereLight('#cfeaff', '#5a7a3a', 1.2);
    this.scene.add(this.hemi);
    const sun = (this.sun = new THREE.DirectionalLight('#fff4d6', 2.6));
    sun.position.set(30, 60, 22);
    sun.castShadow = true;
    const sc = sun.shadow.camera;
    sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 1; sc.far = 180;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    this.scene.add(sun.target);

    this.geoms = bodyGeoms();
    this.geoms.pcube = this.geoms.cube;
    this.geoms.pico = this.geoms.ico;
    this.geoms.ptet = this.geoms.tet;
    this.geoms.ring = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true);
    this.geoms.ring.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(this.geoms.ring.attributes.position.count * 3).fill(1), 3));

    this.units = new Batcher(this.scene, { shadows: true });
    this.units.glow.side = THREE.DoubleSide;
    this.fxb = new Batcher(this.scene, { shadows: false, noShadow: true });
    this.fxb.glow.side = THREE.DoubleSide;
    this.fx = new FX(this.scene, this.geoms);

    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.terrainMesh = null;
    this.water = null;
    this.props = new THREE.Group();
    this.world.add(this.props);
    this.zones = new THREE.Group();
    this.scene.add(this.zones);
    this.clouds = new THREE.Group();
    this.scene.add(this.clouds);
    this.marker = this.makeMarker();
    this.scene.add(this.marker);

    this.qualityKey = 'medium';
    this.autoQ = false;
    this.fpsAcc = 0; this.fpsN = 0; this.fpsT = 0;
    this.shadowsOn = true;
    this.resize();
  }

  // ---------------------------------------------------------------- quality
  setQuality(key, shadowsAllowed = true) {
    this.autoQ = key === 'auto';
    if (key === 'auto') key = this.qualityKey === 'auto' ? 'medium' : this.qualityKey;
    if (!QUALITY[key]) key = 'medium';
    this.qualityKey = key;
    const q = QUALITY[key];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.ratio));
    const sh = shadowsAllowed && q.shadow > 0;
    this.shadowsOn = sh;
    this.renderer.shadowMap.enabled = sh;
    this.sun.castShadow = sh;
    if (sh && this.sun.shadow.mapSize.x !== q.shadow) {
      this.sun.shadow.mapSize.set(q.shadow, q.shadow);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.units.setShadows(sh);
    if (this.terrainMesh) this.terrainMesh.receiveShadow = sh;
    this.props.traverse((o) => { if (o.isMesh) { o.castShadow = sh; } });
    this.fx.quality = q.fx;
    // materials need recompiling when shadow state flips
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    this.resize();
  }

  // Called once per frame with the frame time; steps quality down if we are struggling.
  autoTune(dt) {
    if (!this.autoQ) return;
    this.fpsT += dt; this.fpsN++;
    if (this.fpsT < 3) return;
    const fps = this.fpsN / this.fpsT;
    this.fpsT = 0; this.fpsN = 0;
    const order = ['low', 'medium', 'high'];
    const i = order.indexOf(this.qualityKey);
    if (fps < 42 && i > 0) { this.setQuality(order[i - 1]); this.autoQ = true; }
    else if (fps > 58 && i < 2 && !this.tunedDown) { this.setQuality(order[i + 1]); this.autoQ = true; }
    if (fps < 42) this.tunedDown = true;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- environment
  applyBiome() {
    const B = terrain.biome;
    this.scene.background = new THREE.Color(B.sky);
    this.scene.fog = new THREE.Fog(B.fog, B.fogNear, B.fogFar);
    this.hemi.color.set(B.hemiSky);
    this.hemi.groundColor.set(B.hemiGround);
    this.hemi.intensity = B.hemiI * 0.9;
    this.sun.color.set(B.sun);
    this.sun.intensity = B.sunI * 0.62;
    this.buildTerrain();
    this.buildWater();
    this.buildProps();
    this.buildZones();
    this.buildClouds();
  }

  buildTerrain() {
    const N = terrain.N;
    if (!this.terrainMesh) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * N * 18), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N * N * 18), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * N * 18), 3));
      const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
      this.terrainMesh = new THREE.Mesh(g, m);
      this.terrainMesh.receiveShadow = this.shadowsOn;
      this.terrainMesh.frustumCulled = false;
      this.world.add(this.terrainMesh);
    }
    const B = terrain.biome;
    this.tc = {
      grass: B.grass.map(rgb), dirt: rgb(B.dirt), rock: rgb(B.rock), sand: rgb(B.sand), snow: rgb('#f6f9ff'), scorch: rgb('#2a2420'),
    };
    this.writeCells(0, N - 1);
    const g = this.terrainMesh.geometry;
    g.attributes.position.clearUpdateRanges(); g.attributes.color.clearUpdateRanges(); g.attributes.normal.clearUpdateRanges();
    g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.normal.needsUpdate = true;
    g.computeBoundingSphere();
  }

  // Rewrite triangle rows j0..j1 from the heightmap.
  writeCells(j0, j1) {
    const N = terrain.N, C = terrain.CELL, H0 = -terrain.HALF, h = terrain.h, sc = terrain.scorch, W = N + 1;
    const g = this.terrainMesh.geometry;
    const P = g.attributes.position.array, Nn = g.attributes.normal.array, Cc = g.attributes.color.array;
    const tc = this.tc, water = terrain.water, sandBand = terrain.biome.sandBand || 0.6;
    const grassN = tc.grass.length;
    for (let j = j0; j <= j1; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * W + i;
        const ha = h[k], hb = h[k + 1], hc = h[k + W], hd = h[k + W + 1];
        const x0 = H0 + i * C, x1 = x0 + C, z0 = H0 + j * C, z1 = z0 + C;
        let o = (j * N + i) * 18;
        // tri 1: a, c, b   tri 2: b, c, d
        const v = [x0, ha, z0, x0, hc, z1, x1, hb, z0, x1, hb, z0, x0, hc, z1, x1, hd, z1];
        const sa = sc[k], sb = sc[k + 1], scc = sc[k + W], sd = sc[k + W + 1];
        for (let t = 0; t < 2; t++) {
          const q = t * 9;
          const ax = v[q], ay = v[q + 1], az = v[q + 2], bx = v[q + 3], by = v[q + 4], bz = v[q + 5], cx = v[q + 6], cy = v[q + 7], cz = v[q + 8];
          let nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
          let ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
          let nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
          const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          const avg = (ay + by + cy) / 3;
          const hash = Math.abs(Math.sin(i * 127.1 + j * 311.7 + t * 74.7) * 43758.5453) % 1;
          const patch = Math.sin(i * 0.23 + Math.cos(j * 0.17) * 2) + Math.cos(j * 0.21 - i * 0.07) + hash * 0.7;
          let col = tc.grass[clamp(((patch + 2) / 4.7) * grassN, 0, grassN - 1) | 0];
          const outside = !terrain.inPlay((ax + bx + cx) / 3, (az + bz + cz) / 3, 6);
          if (water !== null && avg < water + sandBand) col = tc.sand;
          if (ny < 0.86) col = mixc(col, tc.dirt, clamp((0.86 - ny) * 6, 0, 1));
          if (ny < 0.7 || (outside && avg > 9)) col = mixc(col, tc.rock, outside && avg > 9 ? clamp((avg - 9) / 4, 0, 1) : 0.8);
          if (outside && avg > 24 && terrain.biomeKey !== 'desert') col = tc.snow;
          // scorch per triangle (not per cell) so craters read as ragged burns, not squares
          const s = t === 0 ? (sa + scc + sb) / 3 : (sb + scc + sd) / 3;
          if (s > 0.05) col = mixc(col, mixc(tc.dirt, tc.scorch, 0.5), clamp(s * 0.8, 0, 0.7));
          const shade = 0.965 + hash * 0.05;
          for (let vI = 0; vI < 3; vI++) {
            P[o] = v[q + vI * 3]; P[o + 1] = v[q + vI * 3 + 1]; P[o + 2] = v[q + vI * 3 + 2];
            Nn[o] = nx; Nn[o + 1] = ny; Nn[o + 2] = nz;
            Cc[o] = col[0] * shade; Cc[o + 1] = col[1] * shade; Cc[o + 2] = col[2] * shade;
            o += 3;
          }
        }
      }
    }
  }

  // Apply crater deformation from the sim.
  syncTerrain() {
    const D = terrain.dirty;
    if (!D || !this.terrainMesh) return;
    terrain.dirty = null;
    const N = terrain.N;
    const j0 = clamp(D.j0 - 1, 0, N - 1), j1 = clamp(D.j1, 0, N - 1);
    this.writeCells(j0, j1);
    const g = this.terrainMesh.geometry;
    const start = j0 * N * 18, count = (j1 - j0 + 1) * N * 18;
    for (const a of [g.attributes.position, g.attributes.normal, g.attributes.color]) {
      a.addUpdateRange(start, count);
      a.needsUpdate = true;
    }
  }

  buildWater() {
    if (this.water) { this.world.remove(this.water); this.water.geometry.dispose(); this.water.material.dispose(); this.water = null; }
    if (terrain.water === null) return;
    const B = terrain.biome;
    const g = new THREE.PlaneGeometry(terrain.HALF * 2, terrain.HALF * 2, 44, 44).toNonIndexed();
    g.rotateX(-Math.PI / 2);
    const m = B.waterGlow
      ? new THREE.MeshBasicMaterial({ color: B.waterColor })
      : new THREE.MeshLambertMaterial({ color: B.waterColor, transparent: true, opacity: 0.82, flatShading: true });
    this.water = new THREE.Mesh(g, m);
    this.water.position.y = terrain.water;
    this.water.renderOrder = 1;
    this.waterBase = Float32Array.from(g.attributes.position.array);
    this.world.add(this.water);
  }

  animateWater(t) {
    if (!this.water) return;
    const a = this.water.geometry.attributes.position, base = this.waterBase, arr = a.array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = base[i], z = base[i + 2];
      arr[i + 1] = Math.sin(x * 0.35 + t * 1.3) * 0.12 + Math.cos(z * 0.3 + t * 1.1) * 0.12;
    }
    a.needsUpdate = true;
  }

  buildProps() {
    for (const c of [...this.props.children]) { this.props.remove(c); c.dispose?.(); }
    const byType = new Map();
    for (const p of terrain.props) { if (!byType.has(p.type)) byType.set(p.type, []); byType.get(p.type).push(p); }
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), V = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    for (const [type, list] of byType) {
      const model = propModel(type);
      for (const [geom, glow] of [[model.lit, false], [model.glow, true]]) {
        if (!geom) continue;
        const mat = glow ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
        const im = new THREE.InstancedMesh(geom, mat, list.length);
        list.forEach((p, i) => {
          Q.setFromAxisAngle(Y, p.rot);
          M.compose(V.set(p.x, p.y - 0.15, p.z), Q, S.setScalar(p.s));
          im.setMatrixAt(i, M);
        });
        im.castShadow = this.shadowsOn && !glow;
        im.computeBoundingSphere();
        this.props.add(im);
      }
    }
  }

  buildZones() {
    for (const c of [...this.zones.children]) { this.zones.remove(c); c.geometry.dispose(); c.material.dispose(); }
    const step = 1.5;
    for (let team = 0; team < 2; team++) {
      const sgn = team === 0 ? -1 : 1;
      const x0 = sgn * ZONE.near, x1 = sgn * ZONE.far;
      const xa = Math.min(x0, x1), xb = Math.max(x0, x1), za = -(PLAY.z - 1), zb = PLAY.z - 1;
      const nx = Math.ceil((xb - xa) / step), nz = Math.ceil((zb - za) / step);
      const pos = [];
      const Hh = (x, z) => terrain.surfaceAt(x, z) + 0.08;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const ax = xa + (i * (xb - xa)) / nx, bx = xa + ((i + 1) * (xb - xa)) / nx;
        const az = za + (j * (zb - za)) / nz, bz = za + ((j + 1) * (zb - za)) / nz;
        pos.push(ax, Hh(ax, az), az, ax, Hh(ax, bz), bz, bx, Hh(bx, az), az, bx, Hh(bx, az), az, ax, Hh(ax, bz), bz, bx, Hh(bx, bz), bz);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const col = TEAM_COLORS[team].team;
      const fill = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, depthWrite: false }));
      fill.renderOrder = 2;
      this.zones.add(fill);
      // border strips
      const bp = [];
      const edge = (ax, az, bx, bz) => {
        const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5);
        const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), px = (-dz / l) * 0.18, pz = (dx / l) * 0.18;
        for (let k = 0; k < n; k++) {
          const t0 = k / n, t1 = (k + 1) / n;
          const x0_ = ax + dx * t0, z0_ = az + dz * t0, x1_ = ax + dx * t1, z1_ = az + dz * t1;
          const y0 = Hh(x0_, z0_) + 0.04, y1 = Hh(x1_, z1_) + 0.04;
          bp.push(x0_ - px, y0, z0_ - pz, x0_ + px, y0, z0_ + pz, x1_ - px, y1, z1_ - pz, x1_ - px, y1, z1_ - pz, x0_ + px, y0, z0_ + pz, x1_ + px, y1, z1_ + pz);
        }
      };
      edge(xa, za, xb, za); edge(xb, za, xb, zb); edge(xb, zb, xa, zb); edge(xa, zb, xa, za);
      const bg = new THREE.BufferGeometry();
      bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
      const border = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
      border.renderOrder = 3;
      this.zones.add(border);
    }
  }
  showZones(which) { // which: null (none) | 0 | 1 | 'both'
    this.zones.children.forEach((m, i) => { const team = i < 2 ? 0 : 1; m.visible = which === 'both' || which === team; });
  }

  buildClouds() {
    for (const c of [...this.clouds.children]) this.clouds.remove(c);
    if (terrain.biomeKey === 'alien') return;
    const r = mulberry32(terrain.seed + 99);
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshLambertMaterial({ color: terrain.biomeKey === 'volcano' ? '#8a7068' : '#ffffff', flatShading: true });
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const n = 3 + ((r() * 3) | 0);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(geo, mat);
        m.position.set((k - n / 2) * 3.2 + r() * 2, r() * 1.5, r() * 3);
        m.scale.set(3 + r() * 2.5, 1.6 + r() * 1.2, 2.5 + r() * 2);
        g.add(m);
      }
      g.position.set((r() * 2 - 1) * 160, 48 + r() * 18, (r() * 2 - 1) * 160);
      g.userData.v = 0.6 + r() * 0.8;
      this.clouds.add(g);
    }
  }
  animateClouds(dt) {
    for (const g of this.clouds.children) {
      g.position.x += g.userData.v * dt;
      if (g.position.x > 180) g.position.x = -180;
    }
  }

  // ---------------------------------------------------------------- markers
  makeMarker() {
    const g = new THREE.TorusGeometry(0.6, 0.06, 3, 20);
    g.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.9 }));
    m.renderOrder = 10;
    m.visible = false;
    return m;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
