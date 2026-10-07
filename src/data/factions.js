// Factions and the unit roster. Adding a unit = one entry here (+ models if it needs new gear).
// speed m/s, hp, cost gold. size scales the whole body (and melee reach).
// look: skin, shirt ('team' | hex), pants ('team' | 'teamDark' | hex), hat, beard, chest, back, shield, bulk, boots
// ai:   melee (default for melee weapons) | ranged | kite (keeps distance) | healer | siege | summoner
// Flags: dash (leaps at targets), charge (rams at speed), deathBoom, regen, deflect (chance to bat away projectiles)

export const FACTIONS = [
  { id: 'tribal', name: 'Tribal', color: '#c27a3c', biome: 'grass', blurb: 'Clubs, rocks and a lot of yelling.' },
  { id: 'farmer', name: 'Farmer', color: '#d8b13a', biome: 'autumn', blurb: 'Pitchforks out. The harvest is war.' },
  { id: 'medieval', name: 'Medieval', color: '#8a8f9c', biome: 'grass', blurb: 'Steel, siege engines and a very large king.' },
  { id: 'ancient', name: 'Ancient', color: '#d9a64a', biome: 'desert', blurb: 'Phalanxes, monsters and an angry god.' },
  { id: 'viking', name: 'Viking', color: '#5a8fc2', biome: 'snow', blurb: 'Axes, ice arrows and headbutts.' },
  { id: 'dynasty', name: 'Dynasty', color: '#d4473a', biome: 'autumn', blurb: 'Blades, fireworks and giants.' },
  { id: 'pirate', name: 'Pirate', color: '#3a9fb0', biome: 'beach', blurb: 'Gunpowder solves everything.' },
  { id: 'western', name: 'Wild West', color: '#b5652e', biome: 'desert', blurb: 'Quick draws and quicker dynamite.' },
  { id: 'modern', name: 'Sci-Fi', color: '#4f6bff', biome: 'alien', blurb: 'Railguns, rockets and a walking tank.' },
  { id: 'dark', name: 'Dark Magic', color: '#7d4bc2', biome: 'volcano', blurb: 'The dead do not stay down.' },
];

const SKIN = '#f2c79b', TAN = '#d79b6b', BONE = '#ece4cc', STEEL = '#aab3bf';

export const UNITS = {
  // ------------------------------------------------------------------ TRIBAL
  clubber: { faction: 'tribal', name: 'Clubber', cost: 70, hp: 90, speed: 3.4, weapon: 'club',
    look: { skin: TAN, hat: 'tribalhair', pants: '#8a5a32' }, desc: 'Swings a club. Simple, cheap, enthusiastic.' },
  protector: { faction: 'tribal', name: 'Protector', cost: 100, hp: 130, speed: 3.0, weapon: 'club', shield: 'hide',
    look: { skin: TAN, hat: 'headband', pants: '#8a5a32' }, desc: 'Hide shield soaks up arrows from the front.' },
  spearthrower: { faction: 'tribal', name: 'Spear Thrower', cost: 130, hp: 70, speed: 3.2, weapon: 'spearthrow', ai: 'ranged',
    look: { skin: TAN, hat: 'feather', pants: '#8a5a32' }, desc: 'Throws spears in a high arc. They stick.' },
  stoner: { faction: 'tribal', name: 'Stoner', cost: 160, hp: 110, speed: 3.0, weapon: 'rock', ai: 'ranged',
    look: { skin: TAN, hat: 'tribalhair', bulk: 1.15, pants: '#8a5a32' }, desc: 'Hurls heavy rocks that knock people over.' },
  bonemage: { faction: 'tribal', name: 'Bone Mage', cost: 320, hp: 90, speed: 2.8, weapon: 'bonebolt', ai: 'kite',
    look: { skin: TAN, hat: 'skullmask', pants: '#5a3a22' }, desc: 'Fires bone shards that pierce through rows of enemies.' },
  chieftain: { faction: 'tribal', name: 'Chieftain', cost: 480, hp: 650, speed: 2.9, size: 1.4, weapon: 'bigaxe',
    look: { skin: TAN, hat: 'headdress', pants: '#6b3f22', bulk: 1.2 }, desc: 'Huge axe, huge headdress, huge knockback.' },

  // ------------------------------------------------------------------ FARMER
  halfling: { faction: 'farmer', name: 'Halfling', cost: 50, hp: 45, speed: 4.4, size: 0.62, weapon: 'sickle',
    look: { hat: 'curly', pants: '#6b5a3a' }, desc: 'Tiny, fast and surprisingly stabby.' },
  farmer: { faction: 'farmer', name: 'Farmer', cost: 80, hp: 100, speed: 3.2, weapon: 'pitchfork',
    look: { hat: 'straw', pants: '#4a6fa5' }, desc: 'Pitchfork reach keeps clubs at bay.' },
  haybaler: { faction: 'farmer', name: 'Hay Baler', cost: 150, hp: 220, speed: 2.9, weapon: 'haybale',
    look: { hat: 'cap', pants: '#4a6fa5', bulk: 1.2 }, desc: 'Slams enemies with a hay bale. Sends them flying.' },
  potionseller: { faction: 'farmer', name: 'Potion Seller', cost: 220, hp: 80, speed: 3.0, weapon: 'potion', ai: 'ranged',
    look: { hat: 'kerchief', pants: '#5a4a6a' }, desc: 'Throws bubbling potions that splash acid.' },
  scarecrow: { faction: 'farmer', name: 'Scarecrow', cost: 270, hp: 130, speed: 2.6, weapon: 'crows', ai: 'kite',
    look: { skin: '#d8c070', hat: 'scarecrowhat', pants: '#7a6a4a' }, desc: 'Releases homing crows.' },
  harvester: { faction: 'farmer', name: 'Harvester', cost: 750, hp: 950, speed: 3.0, size: 1.5, weapon: 'scythes',
    look: { hat: 'straw', pants: '#3e5f90', bulk: 1.2 }, desc: 'Twin scythes. Reaps everything in a wide arc.' },

  // ------------------------------------------------------------------ MEDIEVAL
  bard: { faction: 'medieval', name: 'Bard', cost: 60, hp: 60, speed: 3.4, weapon: 'lute',
    look: { hat: 'bardhat', pants: '#7a3a6a' }, desc: 'Plays one note, very hard, on your head.' },
  squire: { faction: 'medieval', name: 'Squire', cost: 110, hp: 120, speed: 3.1, weapon: 'sword', shield: 'kite',
    look: { hat: 'coif', pants: '#5a5a62' }, desc: 'Sword and shield. Solid front line.' },
  archer: { faction: 'medieval', name: 'Archer', cost: 150, hp: 70, speed: 3.1, weapon: 'bow', ai: 'kite',
    look: { hat: 'hood', back: 'quiver', pants: '#4f5a3a' }, desc: 'Arcing arrows from long range.' },
  healer: { faction: 'medieval', name: 'Healer', cost: 230, hp: 90, speed: 3.0, weapon: 'healstaff', ai: 'healer',
    look: { hat: 'healerhood', pants: '#e8e2d0' }, desc: 'Heals wounded allies nearby.' },
  knight: { faction: 'medieval', name: 'Knight', cost: 600, hp: 650, speed: 2.8, weapon: 'longsword', shield: 'heater', armor: 0.3,
    look: { hat: 'greathelm', chest: 'plate', pants: STEEL, bulk: 1.15 }, desc: 'Heavily armoured. Shrugs off arrows.' },
  catapult: { faction: 'medieval', name: 'Catapult', cost: 1000, hp: 140, speed: 0, weapon: 'catapult', ai: 'siege', machine: 'catapult',
    look: { hat: 'cap', pants: '#5a4a3a' }, desc: 'Lobs flaming boulders across the map. Cannot move.' },
  king: { faction: 'medieval', name: 'King', cost: 1500, hp: 1600, speed: 2.8, size: 1.55, weapon: 'greatsword', armor: 0.15,
    look: { hat: 'crown', back: 'cape', beard: '#c9a26b', bulk: 1.25, pants: '#5a2a6a' }, desc: 'Royal greatsword. Clears crowds.' },

  // ------------------------------------------------------------------ ANCIENT
  shieldbearer: { faction: 'ancient', name: 'Shield Bearer', cost: 100, hp: 200, speed: 2.9, weapon: 'shieldbash', shield: 'tower',
    look: { hat: 'band', pants: '#d8c8a0' }, desc: 'Giant shield. Blocks almost everything from the front.' },
  sarissa: { faction: 'ancient', name: 'Sarissa', cost: 150, hp: 100, speed: 3.0, weapon: 'pike',
    look: { hat: 'helmgreek', pants: '#d8c8a0' }, desc: 'Very long pike. Pokes from behind the line.' },
  hoplite: { faction: 'ancient', name: 'Hoplite', cost: 200, hp: 170, speed: 3.0, weapon: 'spear', shield: 'hoplon',
    look: { hat: 'corinth', pants: '#d8c8a0' }, desc: 'Spear and round shield. Disciplined.' },
  snakearcher: { faction: 'ancient', name: 'Snake Archer', cost: 300, hp: 80, speed: 3.1, weapon: 'snakebow', ai: 'kite',
    look: { hat: 'snakehood', back: 'quiver', pants: '#d8c8a0' }, desc: 'Poisoned arrows keep hurting after they land.' },
  ballista: { faction: 'ancient', name: 'Ballista', cost: 900, hp: 140, speed: 0, weapon: 'ballista', ai: 'siege', machine: 'ballista',
    look: { hat: 'band', pants: '#d8c8a0' }, desc: 'Giant bolt skewers a whole line. Cannot move.' },
  minotaur: { faction: 'ancient', name: 'Minotaur', cost: 1300, hp: 1900, speed: 3.6, size: 1.75, weapon: 'horns', charge: true,
    look: { skin: '#8a5a34', shirt: '#8a5a34', hat: 'bullhead', pants: 'team', bulk: 1.3 }, desc: 'Charges and tosses enemies with its horns.' },
  zeus: { faction: 'ancient', name: 'Zeus', cost: 2200, hp: 1400, speed: 2.6, size: 1.4, weapon: 'lightning', ai: 'kite', regen: 12,
    look: { hat: 'laurel', beard: '#ffffff', shirt: '#f4f4f4', back: 'capewhite', pants: 'team' }, desc: 'Calls down lightning. Regenerates.' },

  // ------------------------------------------------------------------ VIKING
  headbutter: { faction: 'viking', name: 'Headbutter', cost: 90, hp: 120, speed: 3.6, weapon: 'headbutt',
    look: { hat: 'horned', beard: '#c9732e', pants: '#6a5a4a' }, desc: 'No weapon needed. Just a very hard head.' },
  icearcher: { faction: 'viking', name: 'Ice Archer', cost: 240, hp: 90, speed: 3.1, weapon: 'icebow', ai: 'kite',
    look: { hat: 'furhat', back: 'quiver', pants: '#6a5a4a' }, desc: 'Ice arrows slow whatever they hit.' },
  brawler: { faction: 'viking', name: 'Brawler', cost: 230, hp: 210, speed: 3.3, weapon: 'dualaxe',
    look: { hat: 'viking', beard: '#e0b048', pants: '#6a5a4a', bulk: 1.1 }, desc: 'Two axes, no patience.' },
  berserker: { faction: 'viking', name: 'Berserker', cost: 480, hp: 320, speed: 5.4, weapon: 'dualaxe', dash: true,
    look: { hat: 'wolfpelt', beard: '#8a4a22', pants: '#6a5a4a' }, desc: 'Leaps into the enemy and spins axes. Very fast.' },
  valkyrie: { faction: 'viking', name: 'Valkyrie', cost: 650, hp: 520, speed: 4.4, weapon: 'sword', shield: 'round', dash: true,
    look: { hat: 'wingedhelm', chest: 'plate', pants: '#c0c8d8' }, desc: 'Swift shieldmaiden who leaps over the front line.' },
  jarl: { faction: 'viking', name: 'Jarl', cost: 1100, hp: 1250, speed: 3.0, size: 1.45, weapon: 'bigaxe', armor: 0.1,
    look: { hat: 'jarlhelm', beard: '#d95a2a', back: 'cape', bulk: 1.25, pants: '#5a4a3a' }, desc: 'Massive axe swings send warriors flying.' },

  // ------------------------------------------------------------------ DYNASTY
  samurai: { faction: 'dynasty', name: 'Samurai', cost: 280, hp: 230, speed: 3.4, weapon: 'katana', armor: 0.1, deflect: 0.25,
    look: { hat: 'kabuto', chest: 'samurai', pants: '#2a2a32' }, desc: 'Fast katana strikes. Can deflect arrows.' },
  monk: { faction: 'dynasty', name: 'Monk', cost: 300, hp: 260, speed: 4.4, weapon: 'bostaff', deflect: 0.35,
    look: { hat: 'bald', shirt: '#f08a24', pants: 'team' }, desc: 'Lightning-fast staff combos. Deflects projectiles.' },
  ninja: { faction: 'dynasty', name: 'Ninja', cost: 340, hp: 140, speed: 5.0, weapon: 'shuriken', ai: 'kite', dash: true,
    look: { hat: 'ninjamask', shirt: '#25252c', pants: 'teamDark' }, desc: 'Throws shuriken in quick bursts and dodges away.' },
  firework: { faction: 'dynasty', name: 'Firework Archer', cost: 450, hp: 90, speed: 3.0, weapon: 'firebow', ai: 'kite',
    look: { hat: 'conehat', back: 'quiver', pants: '#2a2a32' }, desc: 'Explosive arrows, three at a time.' },
  hwacha: { faction: 'dynasty', name: 'Hwacha', cost: 1300, hp: 140, speed: 0, weapon: 'hwacha', ai: 'siege', machine: 'hwacha',
    look: { hat: 'conehat', pants: '#2a2a32' }, desc: 'Launches a barrage of 16 rocket arrows. Cannot move.' },
  giant: { faction: 'dynasty', name: 'Samurai Giant', cost: 1650, hp: 2600, speed: 2.6, size: 2.1, weapon: 'kanabo', armor: 0.15,
    look: { hat: 'kabuto', chest: 'samurai', pants: '#2a2a32', bulk: 1.3 }, desc: 'A towering samurai with a spiked club.' },

  // ------------------------------------------------------------------ PIRATE
  flintlock: { faction: 'pirate', name: 'Flintlock', cost: 150, hp: 90, speed: 3.2, weapon: 'flintlock', ai: 'ranged',
    look: { hat: 'bandana', pants: '#e8e0c8' }, desc: 'One powerful shot, then a long reload.' },
  blunderbuss: { faction: 'pirate', name: 'Blunderbuss', cost: 260, hp: 120, speed: 3.0, weapon: 'blunderbuss', ai: 'ranged',
    look: { hat: 'tricornsmall', pants: '#e8e0c8', beard: '#3a2a1a' }, desc: 'Close-range spray of lead.' },
  bomber: { faction: 'pirate', name: 'Bomb Thrower', cost: 360, hp: 90, speed: 3.0, weapon: 'bomb', ai: 'ranged',
    look: { hat: 'beanie', pants: '#e8e0c8' }, desc: 'Lobs bouncing bombs.' },
  harpooner: { faction: 'pirate', name: 'Harpooner', cost: 420, hp: 130, speed: 3.0, weapon: 'harpoon', ai: 'ranged',
    look: { hat: 'sailor', pants: '#2a3a5a' }, desc: 'Harpoons enemies and drags them in.' },
  captain: { faction: 'pirate', name: 'Captain', cost: 750, hp: 700, speed: 3.2, size: 1.15, weapon: 'cutlass',
    look: { hat: 'tricorn', beard: '#1a1a1a', back: 'coat', pants: '#2a2a2a' }, desc: 'Cutlass master with a lot of health.' },
  cannon: { faction: 'pirate', name: 'Cannon', cost: 1000, hp: 140, speed: 0, weapon: 'cannon', ai: 'siege', machine: 'cannon',
    look: { hat: 'bandana', pants: '#e8e0c8' }, desc: 'Explosive cannonballs. Cannot move.' },

  // ------------------------------------------------------------------ WILD WEST
  miner: { faction: 'western', name: 'Miner', cost: 160, hp: 160, speed: 3.1, weapon: 'pickaxe',
    look: { hat: 'minerhelm', pants: '#3a4a6a', beard: '#5a3a1a' }, desc: 'Pickaxe and a hard hat.' },
  gunslinger: { faction: 'western', name: 'Gunslinger', cost: 300, hp: 100, speed: 3.4, weapon: 'revolvers', ai: 'ranged',
    look: { hat: 'cowboy', pants: '#3a4a6a' }, desc: 'Two revolvers, fanned fast.' },
  dynamiter: { faction: 'western', name: 'Dynamite', cost: 380, hp: 100, speed: 3.1, weapon: 'dynamite', ai: 'ranged',
    look: { hat: 'cowboybrown', pants: '#5a4a3a' }, desc: 'Throws lit dynamite. Big boom.' },
  quickdraw: { faction: 'western', name: 'Quickdraw', cost: 600, hp: 150, speed: 3.2, weapon: 'lever', ai: 'kite',
    look: { hat: 'cowboyblack', pants: '#2a2a2a', back: 'coat' }, desc: 'Long-range lever rifle. Never misses (often).' },
  sheriff: { faction: 'western', name: 'Sheriff', cost: 850, hp: 650, speed: 3.0, size: 1.2, weapon: 'shotgun', ai: 'ranged',
    look: { hat: 'cowboywhite', chest: 'badge', pants: '#3a4a6a', beard: '#a07040' }, desc: 'Tough lawman with a scattergun.' },
  gatling: { faction: 'western', name: 'Gatling Gun', cost: 1200, hp: 140, speed: 0, weapon: 'gatling', ai: 'siege', machine: 'gatling',
    look: { hat: 'cowboy', pants: '#3a4a6a' }, desc: 'Hand-cranked hail of bullets. Cannot move.' },

  // ------------------------------------------------------------------ SCI-FI (the original roster)
  rifleman: { faction: 'modern', name: 'Rifleman', cost: 130, hp: 100, speed: 3.3, weapon: 'rifle', ai: 'ranged',
    look: { hat: 'helmet', chest: 'vest', pants: 'teamDark' }, desc: 'Reliable 3-round bursts.' },
  breacher: { faction: 'modern', name: 'Breacher', cost: 180, hp: 180, speed: 3.8, weapon: 'breacher', ai: 'ranged',
    look: { hat: 'cap', chest: 'vest', pants: 'teamDark' }, desc: 'Point-blank scattergun. Sends people flying.' },
  cyberninja: { faction: 'modern', name: 'Cyber Ninja', cost: 240, hp: 140, speed: 5.2, weapon: 'plasma', dash: true, deflect: 0.4,
    look: { hat: 'cyber', shirt: '#22242c', pants: 'teamDark' }, desc: 'Plasma blade and a dash. Deflects bullets.' },
  medic: { faction: 'modern', name: 'Medic', cost: 200, hp: 95, speed: 3.4, weapon: 'healgun', ai: 'healer',
    look: { hat: 'medic', shirt: '#f2f2f2', pants: 'teamDark' }, desc: 'Nano-beam heals wounded allies.' },
  grenadier: { faction: 'modern', name: 'Grenadier', cost: 250, hp: 110, speed: 3.0, weapon: 'grenade', ai: 'ranged',
    look: { hat: 'gasmask', chest: 'vest', pants: 'teamDark' }, desc: 'Lobs grenades over shields.' },
  riot: { faction: 'modern', name: 'Riot Shield', cost: 300, hp: 260, speed: 2.8, weapon: 'baton', shield: 'riot', armor: 0.1,
    look: { hat: 'riot', chest: 'vest', pants: 'teamDark' }, desc: 'Energy shield blocks bullets. Stun baton.' },
  railgunner: { faction: 'modern', name: 'Railgunner', cost: 420, hp: 85, speed: 2.8, weapon: 'railgun', ai: 'kite', prefer: 'value',
    look: { hat: 'visor', back: 'pack', pants: 'teamDark' }, desc: 'Rail slug pierces three targets. Hunts expensive units.' },
  rocketeer: { faction: 'modern', name: 'Rocketeer', cost: 450, hp: 120, speed: 3.0, weapon: 'rocketl', ai: 'ranged', prefer: 'big',
    look: { hat: 'helmet', back: 'pack', chest: 'vest', pants: 'teamDark' }, desc: 'Explosive splash damage. Ragdolls guaranteed.' },
  mech: { faction: 'modern', name: 'Combat Mech', cost: 1800, hp: 2600, speed: 2.4, size: 2.0, weapon: 'minigun', ai: 'ranged', armor: 0.25, deathBoom: true, mech: true,
    look: { skin: '#8d96a5', shirt: '#7a8494', pants: '#5d6573', hat: 'mechhead', bulk: 1.35, boots: '#3a3f48' }, desc: 'Walking tank with a minigun. Explodes when destroyed.' },

  // ------------------------------------------------------------------ DARK MAGIC
  skeleton: { faction: 'dark', name: 'Skeleton', cost: 40, hp: 45, speed: 3.3, weapon: 'bonesword', skeleton: true,
    look: { skin: BONE, shirt: BONE, pants: 'teamDark', hat: 'skull', bulk: 0.8, boots: BONE }, desc: 'Cheap, fragile and numerous.' },
  skelarcher: { faction: 'dark', name: 'Skeleton Archer', cost: 90, hp: 45, speed: 3.1, weapon: 'bow', ai: 'kite', skeleton: true,
    look: { skin: BONE, shirt: BONE, pants: 'teamDark', hat: 'skull', bulk: 0.8, boots: BONE }, desc: 'Bony archer. Cheap ranged support.' },
  necromancer: { faction: 'dark', name: 'Necromancer', cost: 520, hp: 160, speed: 2.8, weapon: 'summon', ai: 'summoner',
    look: { hat: 'necrohood', shirt: '#2a2234', pants: '#2a2234', back: 'capedark' }, desc: 'Raises fallen soldiers as skeletons for its side.' },
  wizard: { faction: 'dark', name: 'Wizard', cost: 560, hp: 130, speed: 2.8, weapon: 'fireball', ai: 'kite',
    look: { hat: 'wizard', beard: '#f0f0f0', shirt: '#3a3ab0', pants: '#3a3ab0' }, desc: 'Explosive fireballs from afar.' },
  paladin: { faction: 'dark', name: 'Paladin', cost: 950, hp: 950, speed: 2.9, size: 1.15, weapon: 'warhammer', armor: 0.25, regen: 18,
    look: { hat: 'paladinhelm', chest: 'plategold', back: 'capewhite', pants: STEEL, bulk: 1.15 }, desc: 'Holy hammer and self-healing armour.' },
};

for (const k in UNITS) {
  const u = UNITS[k];
  u.key = k;
  u.size = u.size || 1;
  u.mass = u.mass || u.size ** 3 * (u.mech ? 2.2 : 1);
  u.look = { skin: SKIN, shirt: 'team', pants: 'teamDark', boots: '#3b2f28', bulk: 1, ...u.look };
}

export const unitsOf = (fid) => Object.values(UNITS).filter((u) => u.faction === fid).sort((a, b) => a.cost - b.cost);
export const factionOf = (fid) => FACTIONS.find((f) => f.id === fid);
