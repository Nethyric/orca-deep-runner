/**
 * js/engine/pool.js
 * Generic object pool — DOM-free, node-testable.
 * Usage: const pool = new Pool(() => ({ active: false, x: 0, y: 0 }), 200);
 */

class Pool {
  /**
   * @param {Function} factory - () => new empty object instance
   * @param {number} initialSize - pre-allocate count
   */
  constructor(factory, initialSize = 0) {
    this._factory = factory;
    this._free = [];
    this._active = [];
    for (let i = 0; i < initialSize; i++) {
      this._free.push(factory());
    }
  }

  /** Acquire an object; returns null if pool exhausted and maxSize reached, or a fresh object. */
  acquire() {
    const obj = this._free.length > 0
      ? this._free.pop()
      : this._factory();

    obj.active = true;
    this._active.push(obj);
    return obj;
  }

  /**
   * Release a specific object back to the pool.
   * @param {object} obj
   */
  release(obj) {
    obj.active = false;
    const idx = this._active.indexOf(obj);
    if (idx !== -1) this._active.splice(idx, 1);
    // Reset known fields before recycling
    if (typeof obj.reset === 'function') {
      obj.reset();
    } else {
      for (const k of Object.keys(obj)) {
        if (k !== 'active') delete obj[k];
      }
    }
    this._free.push(obj);
  }

  /** Release all active objects at once. */
  releaseAll() {
    while (this._active.length > 0) {
      this.release(this._active[this._active.length - 1]);
    }
  }

  /** Iterate active objects. */
  forEach(fn) {
    for (const obj of this._active) fn(obj);
  }

  /** @returns {number} count of currently active objects */
  get activeCount() { return this._active.length; }

  /** @returns {number} count of objects in the free list */
  get freeCount() { return this._free.length; }
}

// Node / CommonJS export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Pool;
}