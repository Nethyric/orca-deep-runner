/**
 * js/engine/physics.js
 * Pure physics — DOM-free, node-testable.
 * Vector2D, circle-circle and circle-rect collision, swimming physics.
 */

// ── Vector2D ──────────────────────────────────────────────────────────────────
class Vector2D {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { this.x = x; this.y = y; return this; }
  add(v) { return new Vector2D(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vector2D(this.x - v.x, this.y - v.y); }
  scale(s) { return new Vector2D(this.x * s, this.y * s); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
  lengthSq() { return this.x * this.x + this.y * this.y; }
  normalize() {
    const len = this.length();
    return len > 0 ? this.scale(1 / len) : new Vector2D();
  }
  limit(max) { const len = this.length(); return len > max ? this.normalize().scale(max) : this.clone(); }
  clone() { return new Vector2D(this.x, this.y); }
  static dist(a, b) { const dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); }
  static distSq(a, b) { const dx = b.x - a.x, dy = b.y - a.y; return dx * dx + dy * dy; }
}

// ── Collision Helpers ──────────────────────────────────────────────────────────

/**
 * Circle-circle collision test.
 * @param {object} a - { pos: Vector2D, radius: number }
 * @param {object} b - { pos: Vector2D, radius: number }
 * @returns {boolean}
 */
function circleCircle(a, b) {
  const rSum = a.radius + b.radius;
  return Vector2D.distSq(a.pos, b.pos) <= rSum * rSum;
}

/**
 * Circle-AABB collision (e.g. orca vs a bounding rect obstacle).
 * @param {object} circle - { pos: Vector2D, radius: number }
 * @param {object} rect - { x, y, width, height } (top-left origin)
 * @returns {boolean}
 */
function circleRect(circle, rect) {
  const cx = circle.pos.x;
  const cy = circle.pos.y;
  const r = circle.radius;
  const rx = rect.x;
  const ry = rect.y;
  const rw = rect.width;
  const rh = rect.height;

  const nearestX = Math.max(rx, Math.min(cx, rx + rw));
  const nearestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= r * r;
}

/**
 * Closest point on a rect to a circle center (for collision response).
 */
function closestPointOnRect(circlePos, rect) {
  return new Vector2D(
    Math.max(rect.x, Math.min(circlePos.x, rect.x + rect.width)),
    Math.max(rect.y, Math.min(circlePos.y, rect.y + rect.height))
  );
}

// ── Swimming Physics ───────────────────────────────────────────────────────────

/**
 * Physics state for a swimming entity.
 * NOT a class — just a factory that returns a plain object (DOM-free).
 */
function makeSwimState(x = 0, y = 0) {
  return {
    pos: new Vector2D(x, y),
    vel: new Vector2D(0, 0),
    acc: new Vector2D(0, 0),
    radius: 20,
    // constants (tune per entity)
    mass: 1,
    maxSpeed: 5,
    swimForce: 0.6,
    drag: 0.92,       // water resistance multiplier per frame (60fps baseline)
    dragAir: 0.98,    // less drag in air (not used underwater but available)
    turnRate: 0.15,   // max angular change per frame (unused for canvas — kept for logic)
  };
}

/**
 * Apply a directional swim force (e.g. from WASD input).
 * @param {object} state - swim state object
 * @param {Vector2D} direction - normalized input direction
 * @param {number} [force] - magnitude (default from state.swimForce)
 */
function applySwimForce(state, direction, force) {
  if (!direction || direction.lengthSq() < 0.0001) return;
  const d = direction.normalize();
  state.acc = state.acc.add(d.scale(force || state.swimForce));
}

/**
 * Apply a dash burst force.
 * @param {object} state
 * @param {Vector2D} direction - normalized direction of dash
 * @param {number} power - dash strength (e.g. 15)
 */
function applyDash(state, direction, power) {
  if (!direction || direction.lengthSq() < 0.0001) return;
  const d = direction.normalize();
  state.vel = state.vel.add(d.scale(power));
  // Clamp speed after dash
  if (state.vel.length() > state.maxSpeed * 3) {
    state.vel = state.vel.normalize().scale(state.maxSpeed * 3);
  }
}

/**
 * Integrate velocity from acceleration, apply drag, clamp speed.
 * Call once per frame.
 * @param {object} state
 * @param {number} dt - delta time in seconds (default 1/60)
 */
function integratePhysics(state, dt = 1 / 60) {
  // Apply acceleration
  state.vel = state.vel.add(state.acc.scale(dt * 60));
  // Apply drag
  state.vel = state.vel.scale(state.drag);
  // Clamp speed
  state.vel = state.vel.limit(state.maxSpeed);
  // Update position
  state.pos = state.pos.add(state.vel.scale(dt * 60));
  // Reset acceleration for next frame
  state.acc = new Vector2D(0, 0);
}

/**
 * Keep entity within bounds (world wrapping or clamping).
 * @param {object} state
 * @param {number} worldW
 * @param {number} worldH
 * @param {boolean} [wrap=true] - wrap around edges
 */
function keepInBounds(state, worldW, worldH, wrap = true) {
  if (wrap) {
    if (state.pos.x < -state.radius) state.pos.x = worldW + state.radius;
    else if (state.pos.x > worldW + state.radius) state.pos.x = -state.radius;
    if (state.pos.y < -state.radius) state.pos.y = worldH + state.radius;
    else if (state.pos.y > worldH + state.radius) state.pos.y = -state.radius;
  } else {
    state.pos.x = Math.max(state.radius, Math.min(worldW - state.radius, state.pos.x));
    state.pos.y = Math.max(state.radius, Math.min(worldH - state.radius, state.pos.y));
  }
}

/**
 * Separation force: steer away from nearby entities (boid-style).
 * @param {object} self - entity with pos/radius
 * @param {Array} others - entities with pos/radius
 * @param {number} separationRadius
 * @returns {Vector2D} separation force vector
 */
function separationForce(self, others, separationRadius) {
  const force = new Vector2D();
  let count = 0;
  for (const other of others) {
    if (other === self) continue;
    const dist = Vector2D.dist(self.pos, other.pos);
    if (dist < separationRadius && dist > 0) {
      const away = self.pos.sub(other.pos).normalize().scale(1 / dist);
      force.x += away.x;
      force.y += away.y;
      count++;
    }
  }
  if (count > 0) {
    return new Vector2D(force.x / count, force.y / count);
  }
  return force;
}

// ── Steering Behaviours (for AI) ──────────────────────────────────────────────

/**
 * Seek: steer toward a target position.
 * @param {object} state
 * @param {Vector2D} target
 * @param {number} [maxForce]
 */
function seek(state, target, maxForce = 0.3) {
  const desired = target.sub(state.pos).normalize().scale(state.maxSpeed);
  const steer = desired.sub(state.vel);
  return steer.limit(maxForce);
}

/**
 * Flee: steer away from threat.
 */
function flee(state, threat, maxForce = 0.5) {
  const away = state.pos.sub(threat.pos).normalize().scale(state.maxSpeed);
  const steer = away.sub(state.vel);
  return steer.limit(maxForce);
}

// ── Exports ────────────────────────────────────────────────────────────────────
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Vector2D, circleCircle, circleRect, closestPointOnRect,
    makeSwimState, applySwimForce, applyDash, integratePhysics, keepInBounds,
    separationForce, seek, flee };
}