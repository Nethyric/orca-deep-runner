/**
 * js/engine/input.js
 * Keyboard + Touch input — DOM-dependent but lightweight.
 * Exports a singleton InputManager.
 */

class InputManager {
  constructor() {
    this.keys = {};
    this.prevKeys = {};
    this.touchActive = false;
    this.touchPos = { x: 0, y: 0 };
    this.touchDelta = { x: 0, y: 0 };
    this._touchStart = null;
    this._boundKeydown = this._onKeyDown.bind(this);
    this._boundKeyup = this._onKeyUp.bind(this);
    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchMove = this._onTouchMove.bind(this);
    this._boundTouchEnd = this._onTouchEnd.bind(this);
  }

  /** Call from canvas init. */
  attach(canvas) {
    window.addEventListener('keydown', this._boundKeydown);
    window.addEventListener('keyup', this._boundKeyup);
    canvas.addEventListener('touchstart', this._boundTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this._boundTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._boundTouchEnd);
    this._canvas = canvas;
  }

  detach() {
    window.removeEventListener('keydown', this._boundKeydown);
    window.removeEventListener('keyup', this._boundKeyup);
    if (this._canvas) {
      this._canvas.removeEventListener('touchstart', this._boundTouchStart);
      this._canvas.removeEventListener('touchmove', this._boundTouchMove);
      this._canvas.removeEventListener('touchend', this._boundTouchEnd);
    }
  }

  _onKeyDown(e) {
    this.keys[e.code] = true;
    // Prevent arrow-key scrolling
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
      e.preventDefault();
    }
  }

  _onKeyUp(e) { this.keys[e.code] = false; }

  _onTouchStart(e) {
    e.preventDefault();
    const t = e.touches[0];
    this._touchStart = { x: t.clientX, y: t.clientY };
    this.touchPos.x = t.clientX;
    this.touchPos.y = t.clientY;
    this.touchActive = true;
    this.touchDelta.x = 0;
    this.touchDelta.y = 0;
  }

  _onTouchMove(e) {
    e.preventDefault();
    const t = e.touches[0];
    if (this._touchStart) {
      this.touchDelta.x = t.clientX - this._touchStart.x;
      this.touchDelta.y = t.clientY - this._touchStart.y;
    }
    this.touchPos.x = t.clientX;
    this.touchPos.y = t.clientY;
  }

  _onTouchEnd(e) {
    e.preventDefault();
    this.touchActive = false;
    this._touchStart = null;
    this.touchDelta.x = 0;
    this.touchDelta.y = 0;
  }

  /** Returns true on the frame the key is first pressed. */
  isKeyPressed(code) {
    return !this.prevKeys[code] && !!this.keys[code];
  }

  /** Returns true while the key is held. */
  isKeyHeld(code) { return !!this.keys[code]; }

  /** Returns normalized direction vector from keyboard. */
  getKeyboardDir() {
    let x = 0, y = 0;
    if (this.isKeyHeld('ArrowLeft') || this.isKeyHeld('KeyA')) x -= 1;
    if (this.isKeyHeld('ArrowRight') || this.isKeyHeld('KeyD')) x += 1;
    if (this.isKeyHeld('ArrowUp') || this.isKeyHeld('KeyW')) y -= 1;
    if (this.isKeyHeld('ArrowDown') || this.isKeyHeld('KeyS')) y += 1;
    const len = Math.sqrt(x * x + y * y);
    if (len > 0) return { x: x / len, y: y / len };
    return { x: 0, y: 0 };
  }

  /** Returns normalized direction from touch drag (or {0,0}). */
  getTouchDir() {
    const THRESHOLD = 10;
    const dx = this.touchDelta.x;
    const dy = this.touchDelta.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < THRESHOLD) return { x: 0, y: 0 };
    return { x: dx / len, y: dy / len };
  }

  /** Combined dir (keyboard wins if active, else touch). */
  getDir() {
    const kb = this.getKeyboardDir();
    if (kb.x !== 0 || kb.y !== 0) return kb;
    return this.getTouchDir();
  }

  /** True if dash pressed (Shift or J). */
  isDashPressed() { return this.isKeyPressed('ShiftLeft') || this.isKeyPressed('ShiftRight') || this.isKeyPressed('KeyJ'); }

  /** True if pause pressed (P or Escape). */
  isPausePressed() { return this.isKeyPressed('KeyP') || this.isKeyPressed('Escape'); }

  /** True if mute pressed (M). */
  isMutePressed() { return this.isKeyPressed('KeyM'); }

  /** Call at end of each frame. */
  updatePrev() { this.prevKeys = { ...this.keys }; }
}

const inputManager = new InputManager();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InputManager, inputManager };
}