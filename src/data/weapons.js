// Weapon archetypes. Distances in metres, speeds in m/s, times in seconds.
// kind:  melee | proj (physical projectile) | gun (hitscan-ish fast bullets) | heal | summon | lightning
// hold:  arm pose used by the animator (see sim/body.js)
// model: geometry key drawn in the right hand (render/models.js); off = left-hand model
// For melee, range/knock scale with unit size.
export const WEAPONS = {
  // ---------- melee ----------
  fists:      { kind: 'melee', hold: 'fists', dmg: 14, range: 0.95, cd: 0.6, windup: 0.16, knock: 3, arc: 0.9, snd: 'punch' },
  headbutt:   { kind: 'melee', hold: 'headbutt', dmg: 34, range: 1.0, cd: 1.2, windup: 0.4, knock: 9, arc: 0.7, snd: 'bonk' },
  horns:      { kind: 'melee', hold: 'headbutt', dmg: 90, range: 1.5, cd: 1.4, windup: 0.4, knock: 16, arc: 0.9, cleave: 3, snd: 'bonk' },
  shieldbash: { kind: 'melee', hold: 'fists', dmg: 16, range: 1.1, cd: 1.0, windup: 0.25, knock: 7, arc: 0.8, snd: 'bonk' },
  club:       { kind: 'melee', hold: 'one', model: 'club', dmg: 30, range: 1.3, cd: 1.1, windup: 0.33, knock: 4.5, arc: 0.9, snd: 'bonk' },
  sickle:     { kind: 'melee', hold: 'one', model: 'sickle', dmg: 18, range: 1.05, cd: 0.55, windup: 0.18, knock: 2, arc: 0.9, snd: 'slash' },
  lute:       { kind: 'melee', hold: 'one', model: 'lute', dmg: 14, range: 1.2, cd: 1.0, windup: 0.3, knock: 6, arc: 0.9, snd: 'strum' },
  sword:      { kind: 'melee', hold: 'one', model: 'sword', dmg: 38, range: 1.5, cd: 0.9, windup: 0.28, knock: 3, arc: 0.9, snd: 'slash' },
  bonesword:  { kind: 'melee', hold: 'one', model: 'bonesword', dmg: 22, range: 1.4, cd: 0.9, windup: 0.28, knock: 2.5, arc: 0.9, snd: 'slash' },
  longsword:  { kind: 'melee', hold: 'one', model: 'longsword', dmg: 70, range: 1.75, cd: 1.0, windup: 0.3, knock: 4, arc: 1.0, cleave: 2, snd: 'slash' },
  cutlass:    { kind: 'melee', hold: 'one', model: 'cutlass', dmg: 55, range: 1.5, cd: 0.7, windup: 0.22, knock: 3.5, arc: 1.0, cleave: 2, snd: 'slash' },
  katana:     { kind: 'melee', hold: 'two', model: 'katana', dmg: 60, range: 1.7, cd: 0.65, windup: 0.2, knock: 3, arc: 1.1, cleave: 2, snd: 'slash' },
  axe:        { kind: 'melee', hold: 'one', model: 'axe', dmg: 45, range: 1.4, cd: 0.95, windup: 0.3, knock: 4, arc: 0.9, snd: 'chop' },
  dualaxe:    { kind: 'melee', hold: 'dual', model: 'axe', off: 'axe', dmg: 30, range: 1.4, cd: 0.42, windup: 0.16, knock: 3, arc: 1.0, snd: 'chop' },
  pickaxe:    { kind: 'melee', hold: 'one', model: 'pickaxe', dmg: 46, range: 1.45, cd: 1.15, windup: 0.4, knock: 5, arc: 0.8, snd: 'clang' },
  baton:      { kind: 'melee', hold: 'one', model: 'baton', dmg: 30, range: 1.3, cd: 0.95, windup: 0.25, knock: 7, arc: 0.9, snd: 'zap' },
  plasma:     { kind: 'melee', hold: 'one', model: 'plasmablade', dmg: 50, range: 1.6, cd: 0.5, windup: 0.16, knock: 4, arc: 1.1, cleave: 2, snd: 'saber' },
  bigaxe:     { kind: 'melee', hold: 'two', model: 'bigaxe', dmg: 120, range: 2.0, cd: 1.5, windup: 0.5, knock: 10, arc: 1.2, cleave: 3, snd: 'chop' },
  greatsword: { kind: 'melee', hold: 'two', model: 'greatsword', dmg: 170, range: 2.4, cd: 1.55, windup: 0.5, knock: 11, arc: 1.3, cleave: 4, snd: 'slash' },
  warhammer:  { kind: 'melee', hold: 'two', model: 'warhammer', dmg: 85, range: 1.8, cd: 1.3, windup: 0.45, knock: 13, arc: 1.0, cleave: 3, snd: 'bonk' },
  kanabo:     { kind: 'melee', hold: 'two', model: 'kanabo', dmg: 220, range: 2.4, cd: 1.8, windup: 0.6, knock: 17, arc: 1.3, cleave: 5, snd: 'bonk' },
  bostaff:    { kind: 'melee', hold: 'two', model: 'bostaff', dmg: 26, range: 1.8, cd: 0.42, windup: 0.14, knock: 7, arc: 1.2, cleave: 2, snd: 'bonk' },
  haybale:    { kind: 'melee', hold: 'carry', model: 'haybale', dmg: 24, range: 1.5, cd: 1.2, windup: 0.4, knock: 13, arc: 1.0, cleave: 3, snd: 'thud' },
  scythes:    { kind: 'melee', hold: 'dual', model: 'scythe', off: 'scythe', dmg: 65, range: 1.9, cd: 0.8, windup: 0.3, knock: 5, arc: 1.3, cleave: 3, snd: 'slash' },
  spear:      { kind: 'melee', hold: 'spear', model: 'spear', dmg: 42, range: 2.2, cd: 0.95, windup: 0.3, knock: 3.5, arc: 0.5, snd: 'stab' },
  pike:       { kind: 'melee', hold: 'spear', model: 'pike', dmg: 36, range: 3.6, cd: 1.05, windup: 0.3, knock: 4, arc: 0.4, cleave: 2, snd: 'stab' },
  pitchfork:  { kind: 'melee', hold: 'spear', model: 'pitchfork', dmg: 28, range: 2.0, cd: 0.95, windup: 0.3, knock: 3, arc: 0.5, snd: 'stab' },

  // ---------- thrown / launched ----------
  spearthrow: { kind: 'proj', hold: 'throw', model: 'spear', dmg: 55, range: 19, cd: 2.4, windup: 0.45, knock: 5, arcing: true,
    proj: { type: 'spear', speed: 21, grav: 1, stick: true, len: 1.7 }, snd: 'throw' },
  rock:       { kind: 'proj', hold: 'throw', model: 'rock', dmg: 42, range: 16, cd: 2.6, windup: 0.5, knock: 10, arcing: true,
    proj: { type: 'rock', speed: 17, grav: 1, size: 0.32, bounce: true }, snd: 'throw' },
  bomb:       { kind: 'proj', hold: 'throw', model: 'bomb', dmg: 75, range: 18, cd: 3.0, windup: 0.5, knock: 14, arcing: true,
    proj: { type: 'bomb', speed: 17, grav: 1, radius: 3.0, fuse: 2.2, bounce: true }, snd: 'throw' },
  dynamite:   { kind: 'proj', hold: 'throw', model: 'dynamite', dmg: 85, range: 19, cd: 3.2, windup: 0.5, knock: 15, arcing: true,
    proj: { type: 'dynamite', speed: 18, grav: 1, radius: 3.2, fuse: 2.4, bounce: true }, snd: 'throw' },
  potion:     { kind: 'proj', hold: 'throw', model: 'potion', dmg: 45, range: 17, cd: 2.4, windup: 0.4, knock: 6, arcing: true,
    proj: { type: 'potion', speed: 16, grav: 1, radius: 2.6, color: '#7dff5a' }, snd: 'throw' },
  grenade:    { kind: 'proj', hold: 'throw', model: 'grenade', dmg: 80, range: 22, cd: 2.6, windup: 0.4, knock: 14, arcing: true,
    proj: { type: 'grenade', speed: 19, grav: 1, radius: 3.4, fuse: 1.6, bounce: true }, snd: 'throw' },
  shuriken:   { kind: 'proj', hold: 'throw', model: null, dmg: 20, range: 17, cd: 1.6, windup: 0.18, knock: 1.5, burst: 3, gap: 0.12,
    proj: { type: 'shuriken', speed: 30, grav: 0.15, stick: true }, snd: 'swoosh' },
  crows:      { kind: 'proj', hold: 'staff', model: 'pitchfork', dmg: 16, range: 22, cd: 2.4, windup: 0.4, knock: 1.5, burst: 3, gap: 0.15,
    proj: { type: 'crow', speed: 11, grav: 0, homing: 3.5, life: 5 }, snd: 'caw' },

  // ---------- bows ----------
  bow:        { kind: 'proj', hold: 'bow', model: 'bow', dmg: 34, range: 34, cd: 2.0, windup: 0.8, knock: 2.5, arcing: true,
    proj: { type: 'arrow', speed: 34, grav: 1, stick: true, len: 0.85 }, snd: 'bow' },
  icebow:     { kind: 'proj', hold: 'bow', model: 'icebow', dmg: 30, range: 34, cd: 2.0, windup: 0.8, knock: 2, arcing: true,
    proj: { type: 'arrow', speed: 36, grav: 1, stick: true, len: 0.85, freeze: 3, color: '#9ff3ff' }, snd: 'bow' },
  snakebow:   { kind: 'proj', hold: 'bow', model: 'bow', dmg: 26, range: 36, cd: 1.6, windup: 0.6, knock: 2, arcing: true,
    proj: { type: 'arrow', speed: 38, grav: 1, stick: true, len: 0.85, poison: 40, color: '#79e34a' }, snd: 'bow' },
  firebow:    { kind: 'proj', hold: 'bow', model: 'bow', dmg: 30, range: 40, cd: 2.4, windup: 0.7, knock: 9, arcing: true, burst: 3, gap: 0.14, spread: 0.06,
    proj: { type: 'firework', speed: 30, grav: 0.8, radius: 2.0, color: '#ffb02e' }, snd: 'firework' },

  // ---------- magic ----------
  bonebolt:   { kind: 'proj', hold: 'staff', model: 'bonestaff', dmg: 55, range: 24, cd: 2.4, windup: 0.5, knock: 6,
    proj: { type: 'magic', speed: 16, grav: 0, pierce: 4, color: '#f3ecd2', size: 0.3 }, snd: 'magic' },
  fireball:   { kind: 'proj', hold: 'staff', model: 'wizstaff', dmg: 70, range: 28, cd: 2.4, windup: 0.5, knock: 12,
    proj: { type: 'magic', speed: 15, grav: 0, radius: 2.8, color: '#ff7a1a', size: 0.45 }, snd: 'magic' },
  lightning:  { kind: 'lightning', hold: 'staff', model: 'zeusbolt', dmg: 130, range: 42, cd: 3.0, windup: 0.6, knock: 16, radius: 2.8, snd: 'thunder' },
  summon:     { kind: 'summon', hold: 'staff', model: 'necrostaff', range: 16, cd: 3.5, windup: 0.6, snd: 'magic' },
  healstaff:  { kind: 'heal', hold: 'staff', model: 'healstaff', heal: 28, range: 7, cd: 0.1, windup: 0, snd: 'heal' },
  healgun:    { kind: 'heal', hold: 'pistol', model: 'healgun', heal: 26, range: 8, cd: 0.1, windup: 0, snd: 'heal' },

  // ---------- firearms ----------
  flintlock:  { kind: 'gun', hold: 'pistol', model: 'flintlock', dmg: 60, range: 23, cd: 3.4, windup: 0.3, knock: 6, spread: 0.035, speed: 120, smoke: 1, snd: 'musket' },
  blunderbuss:{ kind: 'gun', hold: 'rifle', model: 'blunderbuss', dmg: 15, pellets: 9, range: 11, cd: 3.0, windup: 0.3, knock: 5, spread: 0.16, speed: 90, smoke: 1.4, snd: 'shotgun' },
  revolvers:  { kind: 'gun', hold: 'dual', model: 'revolver', off: 'revolver', dmg: 22, range: 21, cd: 0.45, windup: 0.08, knock: 2.5, spread: 0.05, speed: 150, smoke: 0.4, snd: 'pistol' },
  lever:      { kind: 'gun', hold: 'rifle', model: 'leverrifle', dmg: 48, range: 34, cd: 0.95, windup: 0.15, knock: 4, spread: 0.02, speed: 200, smoke: 0.5, snd: 'rifle' },
  shotgun:    { kind: 'gun', hold: 'rifle', model: 'shotgun', dmg: 16, pellets: 7, range: 13, cd: 1.6, windup: 0.15, knock: 4.5, spread: 0.13, speed: 110, smoke: 0.7, snd: 'shotgun' },
  harpoon:    { kind: 'proj', hold: 'rifle', model: 'harpoongun', dmg: 40, range: 19, cd: 4.0, windup: 0.4, knock: -14,
    proj: { type: 'harpoon', speed: 30, grav: 0.5, len: 1.4, stick: true }, snd: 'bow' },
  rifle:      { kind: 'gun', hold: 'rifle', model: 'rifle', dmg: 14, burst: 3, gap: 0.09, range: 30, cd: 1.1, windup: 0.1, knock: 1.8, spread: 0.035, speed: 180, snd: 'rifle', tracer: '#ffe27a' },
  breacher:   { kind: 'gun', hold: 'rifle', model: 'scifishotgun', dmg: 11, pellets: 8, range: 11, cd: 1.2, windup: 0.1, knock: 3.5, spread: 0.18, speed: 140, snd: 'shotgun', tracer: '#ffcf6b' },
  railgun:    { kind: 'gun', hold: 'rifle', model: 'railgun', dmg: 140, pierce: 3, range: 58, cd: 3.0, windup: 0.4, knock: 12, spread: 0.004, speed: 600, snd: 'rail', tracer: '#7ff6ff', rail: true },
  rocketl:    { kind: 'proj', hold: 'shoulder', model: 'launcher', dmg: 110, range: 40, cd: 3.2, windup: 0.4, knock: 16,
    proj: { type: 'rocket', speed: 26, grav: 0.12, radius: 3.6 }, snd: 'rocket' },
  minigun:    { kind: 'gun', hold: 'heavy', model: 'minigun', dmg: 11, range: 36, cd: 0.065, windup: 0, knock: 1.6, spread: 0.07, speed: 170, snd: 'minigun', tracer: '#ffb347', spinup: 0.6 },

  // ---------- siege (fired from the unit's machine) ----------
  catapult:   { kind: 'proj', hold: 'crew', dmg: 160, range: 60, minRange: 8, cd: 6.0, windup: 0.9, knock: 18, arcing: true, high: true,
    proj: { type: 'boulder', speed: 30, grav: 1, radius: 4.2, size: 0.75 }, snd: 'catapult' },
  ballista:   { kind: 'proj', hold: 'crew', dmg: 220, range: 55, cd: 5.0, windup: 0.5, knock: 22,
    proj: { type: 'bolt', speed: 52, grav: 0.35, pierce: 7, len: 2.4, stick: true }, snd: 'bow' },
  cannon:     { kind: 'proj', hold: 'crew', dmg: 170, range: 58, minRange: 6, cd: 5.2, windup: 0.6, knock: 20, arcing: true,
    proj: { type: 'cannonball', speed: 38, grav: 1, radius: 3.6, size: 0.4 }, snd: 'cannon' },
  hwacha:     { kind: 'proj', hold: 'crew', dmg: 32, range: 48, minRange: 8, cd: 8.5, windup: 0.4, knock: 7, arcing: true, burst: 16, gap: 0.06, spread: 0.09,
    proj: { type: 'firework', speed: 28, grav: 1, radius: 1.8, color: '#ff8a3d' }, snd: 'firework' },
  gatling:    { kind: 'gun', hold: 'crew', dmg: 13, range: 36, cd: 0.07, windup: 0, knock: 1.8, spread: 0.06, speed: 170, snd: 'minigun', tracer: '#ffd27a', spinup: 0.8 },
};

for (const k in WEAPONS) WEAPONS[k].key = k;
