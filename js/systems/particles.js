/**
 * js/systems/particles.js
 * Particle effects using the object pool.
 * Particles are plain objects — rendering done in main.js.
 */

import { Pool } from '../engine/pool.js';

// ── Particle Types ─────────────────────────────────────────────────────────────

const PARTICLE_DEFS = {
  eat: { count: 8, speed: 3, life: 0.5, size: 4, color: '#2ed573' },
  eatMedium: { count: 12, speed: 4, life: 0.6, size: 5, color: '#1e90ff' },
  eatLarge: { count: 18, speed: 5, life: 0.7, size: 6, color: '#ffd700' },
  pearl: { count: 20, speed: 6, life: 0.8, size: 5, color: '#e0f7ff' },
  damage: { count: 15, speed: 4, life: 0.6, size: 4, color: '#ff3b3b' },
  dash: { count: 12, speed: 7, life: 0.4, size: 3, color: '#00e5ff' },
  stun: { count: 10, speed: 2, life: 1.2, size: 8, color: '#c8e6ff' },
  bossHit: { count: 20, speed: 5, life: 0.5, size: 5, color: '#ff6b6b' },
  bubble: { count: 4, speed: 1, life: 2.0, size: 6, color: '#a0d8ef' },
  sparkle: { count: 6, speed: 2, life: 0.8, size: 3, color: '#ffd700' },
};

function makeParticle() {
  return {
    active: false,
    x: 0, y: 0,
    vx: 0, vy: 0,
    life: 0, maxLife: 0,
    size: 4, color: '#fff',
    type: 'eat',
  };
}

class ParticleSystem {
  constructor() {
    this._pool = new Pool(makeParticle, 300);
  }

  /**
   * Spawn particles of given type at position.
   * @param {string} type
   * @param {number} x
   * @param {number} y
   * @param {object} [opts] - override def properties
   */
  spawn(type, x, y, opts = {}) {
    const def = PARTICLE_DEFS[type];
    if (!def) return;
    const count = opts.count !== undefined ? opts.count : def.count;
    for (let i = 0; i < count; i++) {
      const p = this._pool.acquire();
      const angle = Math.random() * Math.PI * 2;
      const speed = (opts.speed !== undefined ? opts.speed : def.speed) * (0.5 + Math.random() * 0.5);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = opts.life !== undefined ? opts.life : def.life;
      p.maxLife = p.life;
      p.size = def.size * (0.8 + Math.random() * 0.4);
      p.color = opts.color || def.color;
      p.type = type;
    }
  }

  /**
   * Update all active particles.
   * @param {number} dt - delta time in seconds
   * @param {number} worldW
   * @param {number} worldH
   */
  update(dt, worldW, worldH) {
    const toRelease = [];
    this._pool.forEach(p => {
      p.life -= dt;
      if (p.life <= 0) { toRelease.push(p); return; }
      p.x += p.vx;
      p.y += p.vy;
      p.vy -= 0.05; // slight upward buoyancy for bubbles
      p.vx *= 0.98;
      p.vy *= 0.98;
      // wrap
      if (p.x < 0) p.x = worldW;
      if (p.x > worldW) p.x = 0;
      if (p.y < 0) p.y = worldH;
      if (p.y > worldH) p.y = 0;
    });
    for (const p of toRelease) this._pool.release(p);
  }

  /**
   * @returns {number} active particle count
   */
  get activeCount() { return this._pool.activeCount; }

  /** Release all particles. */
  clear() { this._pool.releaseAll(); }
}

const particleSystem = new ParticleSystem();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ParticleSystem, particleSystem, PARTICLE_DEFS };
}