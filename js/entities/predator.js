/**
 * js/entities/predator.js
 * Predators: sharks (chase AI) and jellyfish (vertical drift + stun).
 * Boss jellyfish every 5th level.
 */

import { Vector2D, makeSwimState, applySwimForce, integratePhysics, keepInBounds, seek, flee, separationForce } from '../engine/physics.js';
import { Pool } from '../engine/pool.js';

// ── Shark ──────────────────────────────────────────────────────────────────────

export class Shark {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.radius = opts.radius || 26;
    this.speed = opts.speed || 2.2;
    this.type = 'shark';
    this.color = '#495057';
    this.finColor = '#343a40';
    this.eyeColor = '#ff3b3b';
    this.chaseRange = opts.chaseRange || 280;
    this.steerForce = opts.steerForce || 0.22;
    this.isStunned = false;
    this.stunnedTimer = 0;
    this.stunDuration = 2.0;
    this.active = true;
    this.wanderTimer = 0;
    this.wanderInterval = 2.0;
    this.wanderAngle = Math.random() * Math.PI * 2;
  }

  update(dt, playerX, playerY, worldW, worldH, speedMult = 1.0) {
    if (!this.active) return;

    if (this.isStunned) {
      this.stunnedTimer -= dt;
      if (this.stunnedTimer <= 0) { this.isStunned = false; }
      this.x += this.vx * 0.5;
      this.y += this.vy * 0.5;
      this.vx *= 0.95;
      this.vy *= 0.95;
      return;
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distSq = dx * dx + dy * dy;
    const chaseRangeSq = this.chaseRange * this.chaseRange;

    if (distSq < chaseRangeSq) {
      const dist = Math.sqrt(distSq) || 1;
      const desiredX = (dx / dist) * this.speed * speedMult;
      const desiredY = (dy / dist) * this.speed * speedMult;
      this.vx += (desiredX - this.vx) * this.steerForce;
      this.vy += (desiredY - this.vy) * this.steerForce;
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderAngle += (Math.random() - 0.5) * Math.PI * 0.6;
        this.wanderTimer = this.wanderInterval;
      }
      this.vx += Math.cos(this.wanderAngle) * 0.15;
      this.vy += Math.sin(this.wanderAngle) * 0.15;
    }

    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const maxSpd = this.speed * speedMult;
    if (speed > maxSpd) {
      this.vx = (this.vx / speed) * maxSpd;
      this.vy = (this.vy / speed) * maxSpd;
    }

    this.x += this.vx;
    this.y += this.vy;

    if (this.x < -this.radius * 2) this.x = worldW + this.radius;
    if (this.x > worldW + this.radius * 2) this.x = -this.radius;
    if (this.y < -this.radius * 2) this.y = worldH + this.radius;
    if (this.y > worldH + this.radius * 2) this.y = -this.radius;
  }

  stun() {
    this.isStunned = true;
    this.stunnedTimer = this.stunDuration;
  }

  getHitbox() { return { x: this.x, y: this.y, radius: this.radius }; }
}

// ── Jellyfish ─────────────────────────────────────────────────────────────────

export class Jellyfish {
  constructor(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = opts.radius || 20;
    this.speed = opts.speed || 0.8;
    this.type = 'jelly';
    this.color = '#9b59b6';
    this.finColor = '#8e44ad';
    this.eyeColor = '#e8daef';
    this.jellyPhase = Math.random() * Math.PI * 2;
    this.jellyAmplitude = opts.amplitude || 1.2;
    this.jellyFrequency = opts.frequency || 1.0;
    this.stunDuration = opts.stunDuration || 2.0;
    this.isStunned = false;
    this.active = true;
  }

  update(dt, worldW, worldH) {
    if (!this.active) return;

    this.jellyPhase += dt * this.jellyFrequency * Math.PI * 2;
    const baseVy = Math.sin(this.jellyPhase) * this.jellyAmplitude;
    const vxDrift = Math.cos(this.jellyPhase * 0.3) * 0.4;

    this.vy = baseVy;
    this.vx = vxDrift;

    this.x += this.vx;
    this.y += this.vy;

    if (this.y < this.radius) { this.y = this.radius; this.vy = Math.abs(this.vy); }
    if (this.y > worldH - this.radius) { this.y = worldH - this.radius; this.vy = -Math.abs(this.vy); }
    if (this.x < this.radius) { this.x = worldW - this.radius; }
    if (this.x > worldW - this.radius) { this.x = this.radius; }
  }

  getHitbox() { return { x: this.x, y: this.y, radius: this.radius }; }
}

// ── Boss Jellyfish ─────────────────────────────────────────────────────────────

export class BossJellyfish {
  constructor(x, y, maxHealth) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 65;
    this.speed = 1.2;
    this.type = 'boss';
    this.color = '#8b0000';
    this.finColor = '#c0392b';
    this.eyeColor = '#ff3b3b';
    this.bossMaxHealth = maxHealth;
    this.bossHealth = maxHealth;
    this.isBoss = true;
    this.jellyPhase = 0;
    this.jellyAmplitude = 2.0;
    this.jellyFrequency = 0.7;
    this.hitCooldown = 0;
    this.bossDamageFlash = 0;
    this.attackTimer = 0;
    this.attackInterval = 3.0;
    this.phase = 'idle';
    this.rushDir = { x: 0, y: 0 };
    this.rushTimer = 0;
    this.active = true;
  }

  update(dt, playerX, playerY, worldW, worldH) {
    if (!this.active) return;
    const p = this;

    if (p.hitCooldown > 0) p.hitCooldown -= dt;
    if (p.bossDamageFlash > 0) p.bossDamageFlash -= dt;

    p.jellyPhase += dt * p.jellyFrequency * Math.PI * 2;
    p.attackTimer -= dt;

    const dx = playerX - p.x;
    const dy = playerY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    if (p.phase === 'idle') {
      p.vx += (dx / dist) * 0.08;
      p.vy += (dy / dist) * 0.08;
      p.vy += Math.sin(p.jellyPhase) * 0.6;
      p.vx += Math.cos(p.jellyPhase * 0.5) * 0.3;

      if (p.attackTimer <= 0) {
        p.phase = 'rushing';
        p.rushDir = { x: dx / dist, y: dy / dist };
        p.rushTimer = 0.8;
        p.attackTimer = p.attackInterval;
      }
    } else if (p.phase === 'rushing') {
      const rushSpeed = 5.0;
      p.vx = p.rushDir.x * rushSpeed;
      p.vy = p.rushDir.y * rushSpeed;
      p.rushTimer -= dt;
      if (p.rushTimer <= 0) p.phase = 'idle';
    }

    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.92;
    p.vy *= 0.92;

    const margin = p.radius;
    if (p.x < margin) p.x = margin;
    if (p.x > worldW - margin) p.x = worldW - margin;
    if (p.y < margin) p.y = margin;
    if (p.y > worldH - margin) p.y = worldH - margin;
  }

  takeDamage(amount = 1) {
    if (this.hitCooldown > 0) return false;
    this.bossHealth -= amount;
    this.hitCooldown = 0.4;
    this.bossDamageFlash = 0.2;
    return true;
  }

  getHitbox() { return { x: this.x, y: this.y, radius: this.radius }; }

  get healthPct() { return this.bossHealth / this.bossMaxHealth; }
}

// ── PredatorSystem ────────────────────────────────────────────────────────────

class PredatorSystem {
  constructor() {
    this._sharks = [];
    this._jellies = [];
    this._boss = null;
  }

  clear() {
    this._sharks = [];
    this._jellies = [];
    this._boss = null;
  }

  spawnShark(x, y, opts = {}) {
    this._sharks.push(new Shark(x, y, opts));
  }

  spawnJelly(x, y, opts = {}) {
    this._jellies.push(new Jellyfish(x, y, opts));
  }

  spawnBoss(x, y, health) {
    this._boss = new BossJellyfish(x, y, health);
    return this._boss;
  }

  update(dt, playerX, playerY, worldW, worldH, sharkSpeedMult = 1.0) {
    for (const s of this._sharks) {
      if (s.active) s.update(dt, playerX, playerY, worldW, worldH, sharkSpeedMult);
    }
    for (const j of this._jellies) {
      if (j.active) j.update(dt, worldW, worldH);
    }
    if (this._boss && this._boss.active) {
      this._boss.update(dt, playerX, playerY, worldW, worldH);
    }
  }

  get sharks() { return this._sharks; }
  get jellies() { return this._jellies; }
  get boss() { return this._boss; }

  get activeCount() {
    let n = 0;
    for (const s of this._sharks) if (s.active) n++;
    for (const j of this._jellies) if (j.active) n++;
    if (this._boss && this._boss.active) n++;
    return n;
  }
}

const predatorSystem = new PredatorSystem();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Shark, Jellyfish, BossJellyfish, PredatorSystem, predatorSystem };
}