/**
 * js/entities/prey.js
 * Prey fish entities with schooling boid behavior.
 * 3 kinds: Fast (small, high speed, low pts), Medium, Slow (large, low speed, high pts).
 * Pearl = rare bonus item.
 */

import { Vector2D, makeSwimState, integratePhysics, keepInBounds, separationForce } from '../engine/physics.js';
import { Pool } from '../engine/pool.js';

// ── Prey Kinds ────────────────────────────────────────────────────────────────

export const PREY_KINDS = {
  fast: {
    name: 'sardine',
    radius: 8,
    speed: 3.5,
    points: 50,
    color: '#ff9f43',
    innerColor: '#ffeaa7',
    schoolRadius: 60,
    separationRadius: 20,
    steerForce: 0.2,
  },
  medium: {
    name: 'mackerel',
    radius: 12,
    speed: 2.2,
    points: 100,
    color: '#1e90ff',
    innerColor: '#74b9ff',
    schoolRadius: 80,
    separationRadius: 28,
    steerForce: 0.15,
  },
  slow: {
    name: 'tuna',
    radius: 18,
    speed: 1.2,
    points: 200,
    color: '#2ed573',
    innerColor: '#a8e6cf',
    schoolRadius: 100,
    separationRadius: 38,
    steerForce: 0.08,
  },
};

export const PREY_TYPES = ['fast', 'medium', 'slow'];

function makePrey() {
  return {
    active: false,
    x: 0, y: 0,
    vx: 0, vy: 0,
    radius: 10,
    speed: 2,
    points: 100,
    kind: 'medium',
    color: '#1e90ff',
    innerColor: '#74b9ff',
    schoolRadius: 80,
    separationRadius: 28,
    steerForce: 0.15,
    turnTimer: 0,
    turnInterval: 1.5,
    wanderAngle: 0,
    eaten: false,
    // for pearl
    isPearl: false,
    pearlRadius: 10,
    pearlColor: '#e0f7ff',
    pearlInner: '#ffffff',
  };
}

class PreySystem {
  constructor() {
    this._pool = new Pool(makePrey, 150);
  }

  /**
   * Spawn a prey at random position near edges.
   * @param {string} kind - 'fast'|'medium'|'slow'
   * @param {number} worldW
   * @param {number} worldH
   * @param {object} [opts] - speedMult, pearl
   */
  spawn(kind, worldW, worldH, opts = {}) {
    const p = this._pool.acquire();
    const def = PREY_KINDS[kind] || PREY_KINDS.medium;

    // Spawn from edges
    if (Math.random() < 0.5) {
      p.x = Math.random() < 0.5 ? -30 : worldW + 30;
      p.y = Math.random() * worldH;
    } else {
      p.x = Math.random() * worldW;
      p.y = Math.random() < 0.5 ? -30 : worldH + 30;
    }

    const speedMult = opts.speedMult || 1;
    p.vx = (Math.random() - 0.5) * def.speed * 2 * speedMult;
    p.vy = (Math.random() - 0.5) * def.speed * 2 * speedMult;
    p.radius = def.radius;
    p.speed = def.speed * speedMult;
    p.points = def.points;
    p.kind = kind;
    p.color = def.color;
    p.innerColor = def.innerColor;
    p.schoolRadius = def.schoolRadius;
    p.separationRadius = def.separationRadius;
    p.steerForce = def.steerForce;
    p.turnTimer = 0;
    p.turnInterval = 1.0 + Math.random() * 1.5;
    p.wanderAngle = Math.random() * Math.PI * 2;
    p.eaten = false;
    p.isPearl = opts.pearl || false;
    if (p.isPearl) {
      p.radius = 12;
      p.speed = 1.0;
      p.points = 500;
      p.color = '#e0f7ff';
      p.innerColor = '#ffffff';
    }
    return p;
  }

  /**
   * Update all prey (boid schooling).
   * @param {number} dt
   * @param {Array} school - array of prey to consider for flocking
   * @param {number} worldW
   * @param {number} worldH
   */
  update(dt, school, worldW, worldH) {
    this._pool.forEach(p => {
      if (!p.active) return;
      // Wander turn
      p.turnTimer -= dt;
      if (p.turnTimer <= 0) {
        p.wanderAngle += (Math.random() - 0.5) * Math.PI * 0.8;
        p.turnTimer = p.turnInterval;
      }

      // Boid forces
      let sx = 0, sy = 0, ax = 0, ay = 0;
      let count = 0;

      for (const other of school) {
        if (!other.active || other === p) continue;
        const dx = other.x - p.x;
        const dy = other.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1 || dist > p.schoolRadius) continue;

        // Alignment: steer toward average velocity
        ax += other.vx;
        ay += other.vy;
        count++;

        // Cohesion: steer toward center of mass
        sx += dx;
        sy += dy;
      }

      if (count > 0) {
        const norm = 1 / count;
        // Alignment
        const alignX = (ax * norm - p.vx) * p.steerForce;
        const alignY = (ay * norm - p.vy) * p.steerForce;
        // Cohesion
        const cohesX = (sx * norm - p.x) * p.steerForce * 0.5;
        const cohesY = (sy * norm - p.y) * p.steerForce * 0.5;
        p.vx += alignX + cohesX;
        p.vy += alignY + cohesY;
      }

      // Separation
      const sep = separationForce(
        { pos: new Vector2D(p.x, p.y), radius: p.radius },
        school.filter(o => o.active && o !== p && !o.isPearl && !p.isPearl)
          .map(o => ({ pos: new Vector2D(o.x, o.y), radius: o.radius })),
        p.separationRadius
      );
      p.vx += sep.x * p.steerForce * 1.5;
      p.vy += sep.y * p.steerForce * 1.5;

      // Wander
      p.vx += Math.cos(p.wanderAngle) * 0.3;
      p.vy += Math.sin(p.wanderAngle) * 0.3;

      // Speed limit
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speed > p.speed) {
        const scale = p.speed / speed;
        p.vx *= scale;
        p.vy *= scale;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.99;
      p.vy *= 0.99;

      keepInBounds({ pos: { x: p.x, y: p.y, radius: p.radius } }, worldW, worldH, true);
      p.x = p.x; p.y = p.y; // keepInBounds may modify pos object
    });
  }

  /**
   * @returns {Array} active prey
   */
  getActive() { return this._pool._active; }

  get activeCount() { return this._pool.activeCount; }

  /** Remove eaten prey, return to pool. */
  release(prey) { this._pool.release(prey); }

  clear() { this._pool.releaseAll(); }

  forEach(fn) { this._pool.forEach(fn); }
}

const preySystem = new PreySystem();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PreySystem, preySystem, PREY_KINDS, PREY_TYPES };
}