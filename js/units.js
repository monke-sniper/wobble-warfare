'use strict';
// Data-driven unit roster + the Unit class. Adding a unit = adding an entry here.
(function (G) {
  const R = G.ragdoll, I = R.IDX;

  // role: 0 = front line, 1 = back line (used for random army layouts)
  G.UNITS = {
    rifleman: { name: 'Rifleman', cost: 100, hp: 100, speed: 62, size: 1, weapon: 'rifle', hat: 'helmet', role: 0.4,
      desc: 'Reliable 3-round bursts. The backbone of any army.' },
    shotgunner: { name: 'Breacher', cost: 150, hp: 180, speed: 85, size: 1.02, weapon: 'shotgun', hat: 'cap', role: 0.15,
      desc: 'Point-blank scattergun. Sends people flying.' },
    ninja: { name: 'Cyber Ninja', cost: 150, hp: 130, speed: 135, size: 0.95, weapon: 'blade', hat: 'ninja', ai: 'melee', role: 0.1, recover: 1.6, deflect: 0.4,
      desc: 'Plasma katana and a dash. Deflects some bullets aimed at its front.' },
    medic: { name: 'Medic', cost: 160, hp: 90, speed: 66, size: 0.98, weapon: 'pistol', hat: 'medic', ai: 'medic', heal: 16, role: 0.5,
      desc: 'Heals wounded allies with a nano-beam. Carries a pistol.' },
    grenadier: { name: 'Grenadier', cost: 180, hp: 110, speed: 55, size: 1.04, weapon: 'grenade', hat: 'gasmask', role: 0.6,
      desc: 'Lobs bouncing grenades over hills and shields.' },
    shield: { name: 'Riot Shield', cost: 250, hp: 240, speed: 48, size: 1.1, mass: 1.4, weapon: 'baton', hat: 'riot', ai: 'melee', shield: true, role: 0.02,
      desc: 'Energy shield blocks frontal bullets. Bonks with a stun baton.' },
    sniper: { name: 'Railgunner', cost: 250, hp: 80, speed: 45, size: 0.98, weapon: 'sniper', hat: 'hood', ai: 'kite', prefer: 'value', role: 0.95, turn: 4,
      desc: 'Rail slug pierces two targets. Hunts expensive units.' },
    rocket: { name: 'Rocketeer', cost: 300, hp: 120, speed: 50, size: 1.04, weapon: 'rocket', hat: 'antenna', prefer: 'big', role: 0.75,
      desc: 'Explosive splash damage. Ragdolls guaranteed.' },
    mech: { name: 'Combat Mech', cost: 1200, hp: 2400, speed: 34, size: 1.9, mass: 5, weapon: 'minigun', hat: 'mech', style: 'mech', role: 0.5, recover: 2.5, turn: 3,
      desc: 'Walking tank with a minigun. Explodes when destroyed.' },
  };

  const DEAD_GRAY = '#6c7079';
  function palettes(team, def) {
    const t = G.TEAMS[team];
    const base = def.style === 'mech'
      ? { main: '#6f7888', dark: '#4a5160', light: '#a7b0bf', skin: '#a7b0bf', glow: t.glow, team: t.main }
      : { main: t.main, dark: t.dark, light: t.light, skin: t.light, glow: t.glow, team: t.main };
    const dead = {};
    for (const k in base) dead[k] = G.mix(base[k], DEAD_GRAY, 0.55);
    dead.glow = '#3a3d44';
    return [base, dead];
  }

  let uid = 0;
  class Unit {
    constructor(type, team, x) {
      const def = G.UNITS[type];
      this.id = ++uid;
      this.type = type;
      this.def = def;
      this.team = team;
      this.w = G.WEAPONS[def.weapon];
      this.hp = this.maxHp = def.hp;
      this.alive = true;
      this.facing = team === 0 ? 1 : -1;
      this.aim = team === 0 ? 0 : Math.PI;
      this.wAng = this.aim;
      this.balance = 1;
      this.stagger = 0;
      this.moveX = 0;
      this.leanX = 0;
      this.walkPhase = Math.random() * G.TAU;
      this.target = null;
      this.retarget = 0;
      this.cool = G.rand(0.2, 1) * this.w.cd;
      this.burstLeft = 0;
      this.burstT = 0;
      this.recoil = 0;
      this.swing = -1;
      this.swingHit = false;
      this.hitFlash = 0;
      this.muzzleT = 0;
      this.kills = 0;
      this.rangeMul = G.rand(0.68, 0.92);
      this.spawnX = x;
      this.healing = null;
      this.heal = null;
      this.lobV = null;
      this.deathTime = 0;
      [this.pal, this.palDead] = palettes(team, def);
      R.build(this, x, G.terrain.heightAt(x));
    }

    chest() {
      const n = this.pts[I.NECK], p = this.pts[I.PELVIS];
      return { x: (n.x + p.x) / 2, y: (n.y + p.y) / 2 };
    }

    update(dt) {
      this.hitFlash -= dt;
      this.muzzleT -= dt;
      this.recoil *= 0.82;
      this.stagger = Math.max(0, this.stagger - dt * (this.def.recover || 0.9));
      this.balance = this.alive ? G.clamp(1.15 - this.stagger, 0, 1) : 0;
      if (this.alive) {
        this.cool -= dt;
        if (G.battleOn) G.ai.think(this, dt);
        else {
          this.moveX = 0;
          const base = this.team === 0 ? 0 : Math.PI;
          this.aim = base + Math.sin(G.time * 0.8 + this.id) * 0.08;
        }
        if (this.burstLeft > 0) {
          this.burstT -= dt;
          if (this.burstT <= 0) { this.burstLeft--; this.burstT = this.w.gap; G.shootGun(this); }
        }
        if (this.swing >= 0) {
          this.swing += dt / this.w.swing;
          if (!this.swingHit && this.swing >= 0.55) { this.swingHit = true; G.meleeHit(this); }
          if (this.swing >= 1) this.swing = -1;
        }
      }
      R.step(this);
    }
  }
  G.Unit = Unit;
})(window.WW);
