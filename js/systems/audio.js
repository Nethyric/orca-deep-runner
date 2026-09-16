/**
 * js/systems/audio.js
 * WebAudio synthesized SFX — zero audio files.
 * All methods wrap in try/catch so game keeps working if audio is blocked.
 */

class AudioSystem {
  constructor() {
    this._ctx = null;
    this._muted = false;
    this._masterGain = null;
  }

  /** Call on first user gesture. */
  init() {
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = 0.4;
      this._masterGain.connect(this._ctx.destination);
    } catch (e) {
      this._ctx = null;
    }
  }

  /** Resume context if suspended (after user gesture). */
  resume() {
    try {
      if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume();
    } catch (e) { /* ignore */ }
  }

  /** @param {boolean} muted */
  setMuted(muted) { this._muted = muted; }

  get muted() { return this._muted; }

  _makeOsc(type, freq, duration, volume = 0.3, freqEnd = null, attack = 0.01, decay = 0.1) {
    try {
      if (!this._ctx || this._muted) return;
      const osc = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.connect(gain);
      gain.connect(this._masterGain);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this._ctx.currentTime);
      if (freqEnd !== null) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, this._ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(0, this._ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, this._ctx.currentTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + duration);
      osc.start(this._ctx.currentTime);
      osc.stop(this._ctx.currentTime + duration + 0.01);
    } catch (e) { /* audio blocked */ }
  }

  _noise(duration, volume = 0.2) {
    try {
      if (!this._ctx || this._muted) return;
      const bufferSize = this._ctx.sampleRate * duration;
      const buf = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const src = this._ctx.createBufferSource();
      src.buffer = buf;
      const gain = this._ctx.createGain();
      const filter = this._ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 800;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this._masterGain);
      gain.gain.setValueAtTime(volume, this._ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + duration);
      src.start();
    } catch (e) { /* ignore */ }
  }

  /** Eat a small prey. */
  eatSmall() {
    this._makeOsc('sine', 520, 0.12, 0.25, 780);
  }

  /** Eat medium prey. */
  eatMedium() {
    this._makeOsc('sine', 440, 0.15, 0.3, 660);
    setTimeout(() => this._makeOsc('sine', 660, 0.1, 0.15, 900), 60);
  }

  /** Eat large prey / bonus. */
  eatLarge() {
    this._makeOsc('sine', 350, 0.2, 0.3, 520);
    setTimeout(() => this._makeOsc('sine', 520, 0.2, 0.2, 780), 80);
    setTimeout(() => this._makeOsc('sine', 780, 0.15, 0.15, 1100), 160);
  }

  /** Eat pearl. */
  eatPearl() {
    this._makeOsc('sine', 800, 0.3, 0.3, 1400);
    this._makeOsc('triangle', 1200, 0.25, 0.2, 1800);
  }

  /** Dash burst. */
  dash() {
    this._noise(0.15, 0.15);
    this._makeOsc('sawtooth', 150, 0.2, 0.2, 80);
  }

  /** Take damage (shark hit). */
  damage() {
    this._noise(0.3, 0.3);
    this._makeOsc('sawtooth', 200, 0.25, 0.3, 60);
    this._makeOsc('square', 100, 0.2, 0.2, 50);
  }

  /** Stunned by jellyfish. */
  stun() {
    this._makeOsc('sine', 300, 0.4, 0.2, 150);
    this._noise(0.5, 0.1);
  }

  /** Level complete. */
  levelComplete() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => this._makeOsc('sine', f, 0.3, 0.3, f * 1.5), i * 120);
    });
  }

  /** Game over. */
  gameOver() {
    const notes = [400, 350, 300, 200];
    notes.forEach((f, i) => {
      setTimeout(() => this._makeOsc('sawtooth', f, 0.3, 0.25, f * 0.8), i * 150);
    });
  }

  /** Boss spawn. */
  bossAlert() {
    this._makeOsc('sine', 100, 0.6, 0.4, 50);
    setTimeout(() => this._makeOsc('sawtooth', 80, 0.8, 0.3, 40), 200);
  }

  /** Boss damage hit. */
  bossHit() {
    this._noise(0.1, 0.2);
    this._makeOsc('square', 120, 0.15, 0.2, 60);
  }

  /** Menu select. */
  menuSelect() {
    this._makeOsc('sine', 600, 0.08, 0.15, 800);
  }

  /** Menu confirm. */
  menuConfirm() {
    this._makeOsc('sine', 440, 0.12, 0.2, 660);
  }

  /** Hunger warning (low). */
  hungerWarning() {
    this._makeOsc('sine', 200, 0.15, 0.15, 150);
  }

  /** Pearl bonus popup. */
  pearlBonus() {
    this._makeOsc('triangle', 1000, 0.2, 0.2, 1600);
    setTimeout(() => this._makeOsc('sine', 1400, 0.15, 0.15, 2000), 80);
  }
}

const audioSystem = new AudioSystem();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioSystem, audioSystem };
}