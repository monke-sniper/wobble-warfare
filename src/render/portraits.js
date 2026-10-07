// Unit card portraits rendered from the real 3D models (offscreen, once per unit type).
import * as THREE from 'three';
import { Batcher } from './batcher.js';
import { drawUnit } from './unitdraw.js';
import { Unit } from '../sim/unit.js';
import { UNITS } from '../data/factions.js';

const SIZE = 144;
let renderer = null, scene, camera, batcher, geoms;
const cache = new Map();
const queue = [];
const waiting = new Map();

function init(bodyGeoms) {
  geoms = bodyGeoms;
  const canvas = document.createElement('canvas');
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8aa0b8', 1.6));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(4, 6, -3);
  scene.add(sun);
  camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  batcher = new Batcher(scene, { shadows: false, noShadow: true });
}

function renderOne(type) {
  const def = UNITS[type];
  const u = new Unit(type, 0, 0, 0, 0);
  // settle into the idle stance
  for (let i = 0; i < 50; i++) u.update(false, null);
  u.o.set(u.p);
  const G = {
    torso: batcher.geo('torso', geoms.torso), cube: batcher.geo('cube', geoms.cube), limb: batcher.geo('limb', geoms.limb), head: batcher.geo('head', geoms.head),
  };
  batcher.begin();
  drawUnit(batcher, G, u, 1);
  batcher.end();
  const s = def.size;
  const cx = u.cx(), cy = u.cy(), cz = u.cz();
  if (def.machine) {
    camera.position.set(cx + 5.2, cy + 2.2, cz - 4.2);
    camera.lookAt(cx + 1.0, cy - 0.1, cz);
  } else {
    const d = 3.1 * s;
    camera.position.set(cx + d * 0.86, cy + 0.55 * s, cz - d * 0.5);
    camera.lookAt(cx, cy + 0.2 * s, cz);
  }
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
}

// Returns a data URL immediately if cached, otherwise queues it and calls cb(url) later.
export function portrait(type, cb) {
  const url = cache.get(type);
  if (url) return url;
  if (cb) {
    if (!waiting.has(type)) { waiting.set(type, []); queue.push(type); }
    waiting.get(type).push(cb);
  }
  return '';
}

export function setupPortraits(bodyGeoms) { init(bodyGeoms); }

// Process a few portraits per frame so the UI never hitches.
export function pumpPortraits(n = 3) {
  for (let i = 0; i < n && queue.length; i++) {
    const t = queue.shift();
    let url = '';
    try { url = renderOne(t); } catch (e) { console.warn('portrait failed', t, e); }
    cache.set(t, url);
    for (const cb of waiting.get(t) || []) cb(url);
    waiting.delete(t);
  }
}

export function warmPortraits() { for (const k of Object.keys(UNITS)) portrait(k, () => {}); }
