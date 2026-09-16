/**
 * js/entities/orca.js
 * Player orca entity — physics state + game logic.
 * Uses physics.js vector/pool primitives. DOM-free (no direct DOM access).
 */

import { Vector2D, makeSwimState, applySwimForce, applyDash, integratePhysics, keepInBounds } from '../engine/physics.js';

const BASE_RADIUS = 22;
const DASH_COST = 8;        // hunger cost per dash
const DASH_POWER = 14;
const INVINCIBLE_TIME = 2.5; // seconds
const STARVE_THRESHOLD = 0;  // hunger reaches 0 = game over (handled by game)
const GROWTH_THRESHOLDS = [0, 2000, 5000, 10000, 20000, 40000];
const GROWTH_RADIUS_BONUS = 4; // per tier

export class Orca {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    this.swim = makeSwimState(x, y);
    this.swim.radius = BASE_RADIUS;
    this.swim.maxSpeed = 5.5;
    this.swim.swimForce = 0.65;
    this.swim.drag = 0.90;

    this.hunger = 1.0;            // 1 = full, 0 = starved
    this.lives = 3;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;          // seconds until combo resets
    this.comboDecayRate = 1.5;    // seconds to keep combo alive
    this.invincibleTimer = 0;
    this.stunTimer = 0;
    this.growthTier = 0;          // 0-based index into GROWTH_THRESHOLDS
    this.isDashing = false;
    this.dashCooldown = 0;
    this.dashCooldownMax = 0.4;   // seconds
    this.eatTimer = 0;            // brief flash on eat

    // For combo multiplier math
    this.lastEatTime = -999;
    this.comboWindow = 1.8;       // seconds between eats to maintain combo
  }

  /** @returns {Vector2D} */
  get pos() { return this.swim.pos; }
  /** @returns {Vector2D} */
  get vel() { return this.swim.vel; }
  /** @returns {number} */
  get radius() { return this.swim.radius + this.growthTier * GROWTH_RADIUS_BONUS; }

  /**
   * Attempt to dash in given direction.
   * @param {Vector2D} dir
   * @param {number} hunger - current hunger (0-1)
   * @returns {boolean} true if dash executed
   */
  tryDash(dir, hunger) {
    if (this.dashCooldown > 0 || this.stunTimer > 0) return false;
    if (hunger < DASH_COST / 100) return false; // need at least 8% hunger
    this.isDashing = true;
    this.dashCooldown = this.dashCooldownMax;
    this.hunger = Math.max(0, hunger - DASH_COST / 100);
    applyDash(this.swim, dir, DASH_POWER);
    return true;
  }

  /**
   * Called each frame.
   * @param {number} dt - delta seconds
   * @param {{ x: number, y: number }} inputDir - normalized input
   * @param {number} hungerDecayRate - per second drain (from level config)
   * @param {number} worldW
   * @param {number} worldH
   */
  update(dt, inputDir, hungerDecayRate, worldW, worldH) {
    // Timers
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
    if (this.stunTimer > 0) this.stunTimer -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.eatTimer > 0) this.eatTimer -= dt;
    if (this.isDashing && this.dashCooldown < this.dashCooldownMax * 0.5) this.isDashing = false;

    // Combo decay
    this.comboTimer -= dt;
    if (this.comboTimer <= 0 && this.combo > 1) {
      this.combo = 1;
    }

    if (this.stunTimer > 0) {
      // Stunned: only drift, no input
      integratePhysics(this.swim, dt);
    } else {
      // Apply swim input
      if (inputDir.x !== 0 || inputDir.y !== 0) {
        applySwimForce(this.swim, new Vector2D(inputDir.x, inputDir.y));
      }
      integratePhysics(this.swim, dt);
    }

    keepInBounds(this.swim, worldW, worldH, true);

    // Hunger decay
    this.hunger = Math.max(0, this.hunger - hungerDecayRate * dt);

    // Growth check
    for (let i = GROWTH_THRESHOLDS.length - 1; i >= 0; i--) {
      if (this.score >= GROWTH_THRESHOLDS[i] && i > this.growthTier) {
        this.growthTier = i;
        break;
      }
    }
  }

  /**
   * Register an eat event.
   * @param {number} basePoints - raw point value of prey
   * @param {number} currentTime - game time in seconds
   * @returns {number} actual scored points (after combo)
   */
  eat(basePoints, currentTime) {
    if (currentTime - this.lastEatTime < this.comboWindow) {
      this.combo = Math.min(this.combo + 1, 10);
    } else {
      this.combo = 1;
    }
    this.lastEatTime = currentTime;
    this.comboTimer = this.comboDecayRate;

    const points = basePoints * this.combo;
    this.score += points;
    this.hunger = Math.min(1.0, this.hunger + 0.12);
    this.eatTimer = 0.15;
    return points;
  }

  /**
   * Register a pearl eat.
   * @param {number} basePoints
   * @param {number} currentTime
   * @returns {number}
   */
  eatPearl(basePoints, currentTime) {
    this.combo = Math.min(this.combo + 2, 10);
    this.lastEatTime = currentTime;
    this.comboTimer = this.comboDecayRate;
    const points = basePoints * this.combo;
    this.score += points;
    this.hunger = Math.min(1.0, this.hunger + 0.35);
    this.eatTimer = 0.25;
    return points;
  }

  /**
   * Take a hit from predator.
   * @returns {boolean} true if actually damaged (not invincible)
   */
  takeDamage() {
    if (this.invincibleTimer > 0) return false;
    this.lives--;
    this.invincibleTimer = INVINCIBLE_TIME;
    this.combo = 1;
    this.comboTimer = 0;
    return true;
  }

  /** Get knocked back by a predator hit. */
  knockback(fromX, fromY) {
    const dx = this.pos.x - fromX;
    const dy = this.pos.y - fromY;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    this.swim.vel.x = (dx / len) * 8;
    this.swim.vel.y = (dy / len) * 8;
  }

  /** Add lives after bonus (e.g. extra life item). */
  addLife() { this.lives = Math.min(this.lives + 1, 5); }

  /** Reset for new game. */
  reset(x, y) {
    this.swim.pos.set(x, y);
    this.swim.vel.set(0, 0);
    this.swim.acc = new Vector2D(0, 0);
    this.hunger = 1.0;
    this.lives = 3;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.invincibleTimer = 0;
    this.stunTimer = 0;
    this.growthTier = 0;
    this.isDashing = false;
    this.dashCooldown = 0;
    this.lastEatTime = -999;
    this.eatTimer = 0;
  }
}

// Default export for convenience
export default Orca;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Orca };
}