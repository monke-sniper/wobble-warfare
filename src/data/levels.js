// Campaign chapters (one per faction), army layout helpers, random armies and battle codes.
import { FACTIONS, UNITS, unitsOf } from './factions.js';
import { BIOME_KEYS } from './biomes.js';
import { ZONE, PLAY, terrain } from '../sim/terrain.js';
import { mulberry32 } from '../util.js';

// Enemy groups: [unitType, count, depth 0 (front) .. 1 (back), zOffset?]
const L = (name, budget, enemy, tip, opt = {}) => ({ name, budget, enemy, tip, ...opt });

const CHAPTERS = {
  tribal: [
    L('First Blood', 420, [['clubber', 4, 0.1]], 'Clubbers trade blows evenly. Bring a few more than they have.', { hilly: 0.3 }),
    L('Rock Solid', 900, [['protector', 3, 0.1], ['stoner', 3, 0.5]], 'Stoners knock units over. Rush them before they wind up.'),
    L('Spear Wall', 1300, [['protector', 4, 0.05], ['spearthrower', 6, 0.55]], 'Shields stop spears from the front. Flank wide.'),
    L('The Chieftain', 2300, [['clubber', 6, 0.1], ['chieftain', 1, 0.3], ['bonemage', 2, 0.75]], 'Bone shards pierce lines. Spread out.'),
  ],
  farmer: [
    L('Pitchfork Mob', 1000, [['farmer', 10, 0.15]], 'Pitchforks out-reach clubs. Hit them from range.'),
    L('Halfling Horde', 1350, [['halfling', 24, 0.3]], 'Tiny, fast and everywhere.'),
    L('Potion Panic', 2100, [['haybaler', 6, 0.1], ['potionseller', 4, 0.6]], 'Hay bales launch people. Potions splash.'),
    L('Harvest Moon', 3000, [['farmer', 8, 0.1], ['harvester', 1, 0.3], ['scarecrow', 3, 0.8]], 'The Harvester reaps whole rows. Keep units spread.', { hilly: 0.8 }),
  ],
  medieval: [
    L("Squire's Oath", 1300, [['squire', 8, 0.1]], 'Sword and board. Shields block arrows from the front.'),
    L('Arrow Storm', 2100, [['squire', 4, 0.05], ['archer', 10, 0.65]], 'Archers outrange most things. Close the distance.'),
    L('Siege', 3300, [['squire', 6, 0.1], ['healer', 2, 0.4], ['catapult', 2, 0.95]], 'Catapults cannot hit what is too close.'),
    L('Long Live the King', 4600, [['knight', 2, 0.1], ['king', 1, 0.25], ['archer', 8, 0.7]], 'Armour shrugs off arrows. Hit hard.'),
  ],
  ancient: [
    L('Shield Wall', 2400, [['shieldbearer', 8, 0.05], ['sarissa', 6, 0.2]], 'A wall of shields. Go around or go over.'),
    L('Phalanx', 3400, [['hoplite', 10, 0.1], ['snakearcher', 4, 0.7]], 'Poison keeps ticking. Healers help.'),
    L('Labyrinth', 4300, [['hoplite', 6, 0.1], ['minotaur', 2, 0.3]], 'Minotaurs charge. Sidestep with numbers.', { hilly: 1.0 }),
    L('Wrath of Olympus', 6600, [['sarissa', 10, 0.1], ['zeus', 1, 0.7], ['ballista', 2, 0.95]], 'Lightning hurts. Zeus heals himself. Burst him down.'),
  ],
  viking: [
    L('Cold Open', 1500, [['headbutter', 12, 0.15]], 'No weapons, just foreheads.'),
    L('Frostbite', 3200, [['brawler', 6, 0.1], ['icearcher', 8, 0.65]], 'Ice arrows slow you down.'),
    L('Berserk', 3700, [['berserker', 8, 0.4]], 'They leap the moment you get close.'),
    L('Hall of the Jarl', 5600, [['valkyrie', 3, 0.1], ['jarl', 1, 0.3], ['icearcher', 6, 0.7]], 'Valkyries leap past your front line.'),
  ],
  dynasty: [
    L('Way of the Blade', 3200, [['samurai', 10, 0.15]], 'Samurai deflect arrows. Bring blades or explosives.'),
    L('Shadows', 4500, [['monk', 4, 0.1], ['ninja', 10, 0.5]], 'Ninjas dodge away. Area damage is your friend.'),
    L('Festival of Fire', 6600, [['samurai', 6, 0.1], ['firework', 6, 0.6], ['hwacha', 2, 0.95]], 'A hwacha volley wipes clumps. Do not clump.'),
    L('Titan', 7200, [['samurai', 8, 0.1], ['giant', 2, 0.35]], 'Two giants. Big knockback, big health bars.', { hilly: 0.9 }),
  ],
  pirate: [
    L('Boarding Party', 2300, [['flintlock', 12, 0.4]], 'One shot each, then a long reload. Charge after the volley.'),
    L('Blunder', 4500, [['blunderbuss', 8, 0.2], ['bomber', 6, 0.6]], 'Blunderbusses shred up close. Bombs bounce.'),
    L('Harpoon Bay', 5100, [['captain', 2, 0.1], ['harpooner', 6, 0.5], ['flintlock', 8, 0.6]], 'Harpoons drag your heroes into the crowd.'),
    L('Broadside', 8100, [['captain', 4, 0.1], ['bomber', 6, 0.55], ['cannon', 3, 0.95]], 'Three cannons. Get under the arc.'),
  ],
  western: [
    L('Gold Rush', 2600, [['miner', 14, 0.15]], 'Hard hats, harder pickaxes.'),
    L('High Noon', 3600, [['gunslinger', 10, 0.5]], 'Fast pistols. Shields help.'),
    L('TNT', 5100, [['miner', 4, 0.1], ['dynamiter', 10, 0.6]], 'Everything explodes.'),
    L('Showdown', 9200, [['sheriff', 1, 0.2], ['quickdraw', 6, 0.7], ['gatling', 2, 0.95]], 'Gatlings need time to spin up. Hit them first.'),
  ],
  modern: [
    L('Boots on the Ground', 2600, [['rifleman', 14, 0.45]], 'Rifles are accurate at range.'),
    L('Riot Control', 5100, [['riot', 8, 0.1], ['grenadier', 6, 0.6]], 'Riot shields block bullets. Grenades do not care.'),
    L('Overwatch', 7600, [['riot', 6, 0.1], ['rocketeer', 4, 0.6], ['railgunner', 6, 0.9]], 'Railguns pierce three targets and love expensive units.'),
    L('Heavy Metal', 10200, [['rifleman', 10, 0.2], ['mech', 2, 0.45], ['medic', 4, 0.7]], 'Mechs explode when destroyed. Stand back.'),
  ],
  dark: [
    L('Bone Yard', 2600, [['skeleton', 40, 0.3]], 'Forty skeletons. They break easily.'),
    L('Graveyard Shift', 5200, [['skeleton', 20, 0.15], ['skelarcher', 10, 0.55], ['necromancer', 3, 0.85]], 'Necromancers raise your fallen as skeletons. Kill them first.'),
    L('Arcane', 8200, [['paladin', 4, 0.1], ['wizard', 6, 0.7]], 'Paladins heal. Wizards explode.'),
    L('The End', 16000, [['knight', 4, 0.05], ['giant', 1, 0.2], ['jarl', 1, 0.25], ['zeus', 1, 0.6], ['wizard', 4, 0.65], ['necromancer', 2, 0.8], ['cannon', 2, 0.95], ['hwacha', 1, 0.95]], 'Everything. Good luck, commander.', { hilly: 1.1 }),
  ],
};

export const LEVELS = [];
FACTIONS.forEach((f, ci) => {
  CHAPTERS[f.id].forEach((lv, i) => {
    LEVELS.push({ ...lv, id: `${f.id}-${i + 1}`, chapter: ci, index: i, faction: f.id, biome: lv.biome || f.biome, seed: 1000 + ci * 37 + i * 11, hilly: lv.hilly ?? 0.45 + i * 0.12 });
  });
});
export const CHAPTER_IDS = FACTIONS.map((f) => f.id);

export const starsFor = (spent, budget) => (spent <= budget * 0.6 ? 3 : spent <= budget * 0.85 ? 2 : 1);

// Units the player may deploy in a level: every faction up to and including that chapter.
export function allowedUnits(level) {
  if (!level) return Object.keys(UNITS);
  return FACTIONS.slice(0, level.chapter + 1).flatMap((f) => unitsOf(f.id).map((u) => u.key));
}

export function levelUnlocked(level, stars) {
  if (level.chapter === 0 && level.index === 0) return true;
  if (level.index > 0) return !!stars[LEVELS.find((l) => l.chapter === level.chapter && l.index === level.index - 1).id];
  const prev = LEVELS.filter((l) => l.chapter === level.chapter - 1);
  return prev.every((l) => stars[l.id]);
}

// Turn groups into concrete positions inside a team's zone.
export function layout(groups, team) {
  const out = [];
  const sgn = team === 0 ? -1 : 1;
  const depthTaken = new Map();
  for (const [type, count, depth = 0.3, zOff = 0] of groups) {
    const def = UNITS[type];
    if (!def) continue;
    const sp = def.machine ? 5 : Math.max(1.3, 1.25 * def.size);
    const cols = def.machine ? count : Math.min(count, Math.max(1, Math.ceil(Math.sqrt(count * 3))));
    const rows = Math.ceil(count / cols);
    const key = Math.round(depth * 10);
    const shift = depthTaken.get(key) || 0;
    depthTaken.set(key, shift + rows * sp + 1);
    const x0 = ZONE.near + 2.5 + depth * (ZONE.far - ZONE.near - 6) + shift;
    for (let k = 0; k < count; k++) {
      const r = Math.floor(k / cols), c = k % cols;
      const inRow = Math.min(cols, count - r * cols);
      const z = (c - (inRow - 1) / 2) * sp + zOff + (r % 2 ? sp * 0.25 : 0);
      const x = Math.min(ZONE.far - 1, x0 + r * sp);
      if (Math.abs(z) > PLAY.z - 2) continue;
      const dz = dryZ(sgn * x, z);
      if (dz === null) continue;
      out.push([type, sgn * x, dz]);
    }
  }
  return out;
}

// Nearest z (searching both ways) where the ground is not under deep water.
function dryZ(x, z) {
  const deep = (zz) => terrain.water !== null && terrain.heightAt(x, zz) < terrain.water - 0.5;
  if (!deep(z)) return z;
  for (let k = 1; k < 60; k++) {
    for (const c of [z - k * 0.8, z + k * 0.8]) if (Math.abs(c) < PLAY.z - 2 && !deep(c)) return c;
  }
  return null;
}

// Spend a budget on a sensible random army from the given unit pool.
export function randomArmy(budget, pool, seed = (Math.random() * 1e9) | 0) {
  const r = mulberry32(seed);
  const defs = pool.map((k) => UNITS[k]).filter(Boolean);
  const counts = new Map();
  let left = budget, guard = 0;
  // pick 2-4 unit types for a themed look
  const kinds = [];
  const nk = 2 + ((r() * 3) | 0);
  for (let i = 0; i < nk * 3 && kinds.length < nk; i++) {
    const d = defs[(r() * defs.length) | 0];
    if (d.cost <= budget * 0.6 && !kinds.includes(d)) kinds.push(d);
  }
  if (!kinds.length) kinds.push(defs.reduce((a, b) => (a.cost < b.cost ? a : b)));
  while (left > 0 && guard++ < 400) {
    const d = kinds[(r() * kinds.length) | 0];
    if (d.cost > left) { if (kinds.every((k) => k.cost > left)) break; continue; }
    if (d.machine && (counts.get(d.key) || 0) >= 3) continue;
    counts.set(d.key, (counts.get(d.key) || 0) + 1);
    left -= d.cost;
  }
  const groups = [];
  for (const [k, n] of counts) {
    const d = UNITS[k];
    const ai = d.ai || (d.speed === 0 ? 'siege' : 'melee');
    const depth = d.machine ? 0.95 : ai === 'kite' ? 0.75 : ai === 'ranged' || ai === 'summoner' ? 0.55 : ai === 'healer' ? 0.45 : d.size > 1.3 ? 0.3 : 0.1;
    groups.push([k, n, depth, 0]);
  }
  return groups;
}

export function randomBiome() { return BIOME_KEYS[(Math.random() * BIOME_KEYS.length) | 0]; }

// ---------------------------------------------------------------- battle codes (share armies)
const KEYS = Object.keys(UNITS);
export function encodeBattle(b) {
  const units = b.units.map(([type, team, x, z]) => [KEYS.indexOf(type), team, Math.round(x * 4), Math.round(z * 4)]);
  const s = JSON.stringify({ v: 2, m: b.biome, s: b.seed, h: Math.round(b.hilly * 100), u: units.flat() });
  return btoa(unescape(encodeURIComponent(s))).replace(/=+$/, '');
}
export function decodeBattle(code) {
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if (!o || o.v !== 2 || !Array.isArray(o.u)) return null;
    const units = [];
    for (let i = 0; i + 3 < o.u.length; i += 4) {
      const type = KEYS[o.u[i]];
      if (!type) continue;
      units.push([type, o.u[i + 1] ? 1 : 0, o.u[i + 2] / 4, o.u[i + 3] / 4]);
    }
    return { biome: BIOME_KEYS.includes(o.m) ? o.m : 'grass', seed: o.s | 0, hilly: (o.h | 0) / 100, units };
  } catch { return null; }
}
