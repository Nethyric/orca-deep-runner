/**
 * js/systems/hud.js
 * HUD DOM element management — minimal, DOM-dependent.
 * Pure display logic; actual game state read from Game singleton.
 */

class HUDSystem {
  constructor() {
    this._elScore = document.getElementById('hud-score');
    this._elCombo = document.getElementById('hud-combo');
    this._elHunger = document.getElementById('hunger-bar');
    this._elLevel = document.getElementById('hud-level');
    this._elLives = document.getElementById('lives-container');
    this._elBossBar = document.getElementById('boss-bar');
    this._elBossInner = document.getElementById('boss-bar-inner');
    this._elBossName = document.querySelector('.boss-name');
    this._elMute = document.getElementById('mute-indicator');
    this._elComboDisplay = document.getElementById('combo-display');
    this._comboTimer = null;
  }

  show() { document.getElementById('hud').classList.add('visible'); }
  hide() { document.getElementById('hud').classList.remove('visible'); }

  /**
   * @param {number} score
   * @param {number} comboMultiplier
   * @param {number} hunger 0-1
   * @param {number} lives
   * @param {number} level
   */
  update(score, comboMultiplier, hunger, lives, level) {
    if (this._elScore) this._elScore.textContent = score.toLocaleString();
    if (this._elCombo) this._elCombo.textContent = `x${comboMultiplier}`;
    if (this._elHunger) this._elHunger.style.width = `${Math.max(0, hunger * 100)}%`;
    if (this._elLevel) this._elLevel.textContent = level;
    if (this._elLives) {
      const icons = this._elLives.querySelectorAll('.orca-icon');
      icons.forEach((ic, i) => {
        ic.classList.toggle('lost', i >= lives);
      });
    }
  }

  /**
   * Flash combo text briefly.
   * @param {string} text e.g. "COMBO x5!"
   */
  showComboFlash(text) {
    if (!this._elComboDisplay) return;
    this._elComboDisplay.textContent = text;
    this._elComboDisplay.classList.add('visible');
    clearTimeout(this._comboTimer);
    this._comboTimer = setTimeout(() => {
      this._elComboDisplay.classList.remove('visible');
    }, 800);
  }

  /**
   * @param {boolean} visible
   * @param {string} [name]
   * @param {number} [pct] 0-1
   */
  setBossBar(visible, name, pct) {
    if (!this._elBossBar) return;
    this._elBossBar.classList.toggle('visible', visible);
    if (name) this._elBossName.textContent = name;
    if (pct !== undefined) this._elBossInner.style.width = `${Math.max(0, pct * 100)}%`;
  }

  /** Show mute icon. */
  setMuted(muted) {
    if (this._elMute) this._elMute.classList.toggle('visible', muted);
  }

  /** Build lives icons. */
  buildLives(count) {
    if (!this._elLives) return;
    this._elLives.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const ic = document.createElement('div');
      ic.className = 'orca-icon';
      this._elLives.appendChild(ic);
    }
  }

  /**
   * Trigger screen shake on body.
   * @param {number} [intensity] 1-5 (default 1)
   */
  shake(intensity = 1) {
    document.body.classList.remove('shake');
    void document.body.offsetWidth; // reflow to restart animation
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 150 * intensity);
  }
}

const hudSystem = new HUDSystem();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HUDSystem, hudSystem };
}