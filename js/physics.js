'use strict';
// Verlet point masses, distance constraints, terrain collision and loose props.
(function (G) {
  const P = (G.phys = {});
  const MAXV = 36;

  class Point {
    constructor(x, y, r, mass) {
      this.x = x; this.y = y;
      this.px = x; this.py = y;
      this.r = r;
      this.im = 1 / mass;
      this.g = false; // touching ground
    }
  }
  P.Point = Point;

  P.integrate = function (p, damp) {
    let vx = (p.x - p.px) * damp, vy = (p.y - p.py) * damp + G.GRAV;
    const v2 = vx * vx + vy * vy;
    if (v2 > MAXV * MAXV) {
      const k = MAXV / Math.sqrt(v2);
      vx *= k; vy *= k;
    }
    p.px = p.x; p.py = p.y;
    p.x += vx; p.y += vy;
  };

  P.solve = function (c) {
    const a = c.a, b = c.b;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.0001;
    const w = a.im + b.im;
    const diff = ((d - c.len) / (d * w)) * c.k;
    a.x += dx * diff * a.im; a.y += dy * diff * a.im;
    b.x -= dx * diff * b.im; b.y -= dy * diff * b.im;
  };

  // Positional ground + world-edge collision. Friction is applied separately once per step.
  P.collide = function (p) {
    const W = G.world.W;
    if (p.x < p.r) { const vx = p.x - p.px; p.x = p.r; p.px = p.x + vx * 0.5; }
    else if (p.x > W - p.r) { const vx = p.x - p.px; p.x = W - p.r; p.px = p.x + vx * 0.5; }
    const gy = G.terrain.heightAt(p.x) - p.r;
    if (p.y > gy) {
      const vy = p.y - p.py;
      p.y = gy;
      if (vy > 0) p.py = p.y + vy * 0.25;
      p.g = true;
    } else p.g = false;
  };

  P.friction = function (p, keep) {
    if (p.g) p.px = p.x - (p.x - p.px) * keep;
  };

  P.impulse = function (p, ix, iy) {
    p.px -= ix * p.im;
    p.py -= iy * p.im;
  };

  // A two-point stick: dropped weapons, shields, debris.
  class Prop {
    constructor(kind, ax, ay, bx, by, vx, vy, opts) {
      this.kind = kind;
      this.a = new Point(ax, ay, 2.5, 1);
      this.b = new Point(bx, by, 2.5, 1);
      this.a.px = ax - vx; this.a.py = ay - vy;
      this.b.px = bx - vx; this.b.py = by - vy;
      this.c = { a: this.a, b: this.b, len: Math.hypot(bx - ax, by - ay), k: 1 };
      this.age = 0;
      Object.assign(this, opts);
    }
  }
  P.Prop = Prop;

  P.updateProp = function (pr) {
    pr.age += G.DT;
    P.integrate(pr.a, 0.995);
    P.integrate(pr.b, 0.995);
    for (let i = 0; i < 3; i++) {
      P.solve(pr.c);
      P.collide(pr.a);
      P.collide(pr.b);
    }
    P.friction(pr.a, 0.75);
    P.friction(pr.b, 0.75);
  };
})(window.WW);
