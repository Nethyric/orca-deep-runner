/**
 * js/systems/levels.js
 * Level configuration and progression — DOM-free, node-testable.
 * Boss every 5th level (5, 10, 15...).
 */

export const LEVEL_DURATION = 60; // seconds per level

/**
 * Level config template:
 * @typedef {Object} LevelConfig
 * @property {number} preyCount - total prey spawn count
 * @property {number} sharkCount
 * @property {number} jellyCount
 * @property {number} sharkSpeedMult - speed multiplier for sharks
 * @property {number} preySpeedMult
 * @property {number} hungerRate - hunger decay per second (0-1)
 * @property {number} pearlChance - 0-1 probability per spawn
 * @property {boolean} hasBoss
 * @property {number} bossHealth - hit points for boss (if hasBoss)
 */

/** @type {LevelConfig[]} */
const LEVEL_DEFS = [
  // Level 1 — Gentle intro
  {
    preyCount: 20, sharkCount: 1, jellyCount: 1,
    sharkSpeedMult: 0.8, preySpeedMult: 0.8,
    hungerRate: 0.008,
    pearlChance: 0.15,
    hasBoss: false, bossHealth: 0,
  },
  // Level 2
  {
    preyCount: 28, sharkCount: 2, jellyCount: 2,
    sharkSpeedMult: 0.9, preySpeedMult: 0.9,
    hungerRate: 0.010,
    pearlChance: 0.12,
    hasBoss: false, bossHealth: 0,
  },
  // Level 3
  {
    preyCount: 35, sharkCount: 2, jellyCount: 3,
    sharkSpeedMult: 1.0, preySpeedMult: 1.0,
    hungerRate: 0.012,
    pearlChance: 0.10,
    hasBoss: false, bossHealth: 0,
  },
  // Level 4
  {
    preyCount: 40, sharkCount: 3, jellyCount: 4,
    sharkSpeedMult: 1.1, preySpeedMult: 1.05,
    hungerRate: 0.014,
    pearlChance: 0.08,
    hasBoss: false, bossHealth: 0,
  },
  // Level 5 — BOSS 1
  {
    preyCount: 30, sharkCount: 2, jellyCount: 3,
    sharkSpeedMult: 1.0, preySpeedMult: 1.0,
    hungerRate: 0.013,
    pearlChance: 0.20,
    hasBoss: true, bossHealth: 10,
  },
  // Level 6
  {
    preyCount: 45, sharkCount: 3, jellyCount: 4,
    sharkSpeedMult: 1.2, preySpeedMult: 1.1,
    hungerRate: 0.015,
    pearlChance: 0.08,
    hasBoss: false, bossHealth: 0,
  },
  // Level 7
  {
    preyCount: 50, sharkCount: 4, jellyCount: 5,
    sharkSpeedMult: 1.3, preySpeedMult: 1.15,
    hungerRate: 0.016,
    pearlChance: 0.07,
    hasBoss: false, bossHealth: 0,
  },
  // Level 8
  {
    preyCount: 55, sharkCount: 4, jellyCount: 5,
    sharkSpeedMult: 1.4, preySpeedMult: 1.2,
    hungerRate: 0.018,
    pearlChance: 0.06,
    hasBoss: false, bossHealth: 0,
  },
  // Level 9
  {
    preyCount: 60, sharkCount: 5, jellyCount: 6,
    sharkSpeedMult: 1.5, preySpeedMult: 1.25,
    hungerRate: 0.020,
    pearlChance: 0.05,
    hasBoss: false, bossHealth: 0,
  },
  // Level 10 — BOSS 2
  {
    preyCount: 40, sharkCount: 3, jellyCount: 4,
    sharkSpeedMult: 1.3, preySpeedMult: 1.2,
    hungerRate: 0.018,
    pearlChance: 0.18,
    hasBoss: true, bossHealth: 20,
  },
  // Level 11
  {
    preyCount: 65, sharkCount: 5, jellyCount: 6,
    sharkSpeedMult: 1.6, preySpeedMult: 1.3,
    hungerRate: 0.022,
    pearlChance: 0.05,
    hasBoss: false, bossHealth: 0,
  },
  // Level 12
  {
    preyCount: 70, sharkCount: 6, jellyCount: 7,
    sharkSpeedMult: 1.7, preySpeedMult: 1.35,
    hungerRate: 0.024,
    pearlChance: 0.04,
    hasBoss: false, bossHealth: 0,
  },
  // Level 13
  {
    preyCount: 75, sharkCount: 6, jellyCount: 7,
    sharkSpeedMult: 1.8, preySpeedMult: 1.4,
    hungerRate: 0.026,
    pearlChance: 0.04,
    hasBoss: false, bossHealth: 0,
  },
  // Level 14
  {
    preyCount: 80, sharkCount: 7, jellyCount: 8,
    sharkSpeedMult: 1.9, preySpeedMult: 1.45,
    hungerRate: 0.028,
    pearlChance: 0.03,
    hasBoss: false, bossHealth: 0,
  },
  // Level 15 — BOSS 3
  {
    preyCount: 50, sharkCount: 4, jellyCount: 5,
    sharkSpeedMult: 1.5, preySpeedMult: 1.3,
    hungerRate: 0.024,
    pearlChance: 0.15,
    hasBoss: true, bossHealth: 35,
  },
  // Infinite scaling after 15
];

/**
 * Get level config (1-indexed level number).
 * Levels beyond 15 scale from level 15 with increasing difficulty.
 */
export function getLevelConfig(level) {
  if (level < 1) level = 1;
  const idx = Math.min(level - 1, LEVEL_DEFS.length - 1);
  const base = LEVEL_DEFS[idx];

  if (level <= LEVEL_DEFS.length) return { ...base };

  // Scale beyond defined levels
  const extraLevels = level - LEVEL_DEFS.length;
  return {
    preyCount: Math.floor(base.preyCount + extraLevels * 3),
    sharkCount: Math.min(12, base.sharkCount + Math.floor(extraLevels * 0.4)),
    jellyCount: Math.min(12, base.jellyCount + Math.floor(extraLevels * 0.3)),
    sharkSpeedMult: base.sharkSpeedMult + extraLevels * 0.05,
    preySpeedMult: base.preySpeedMult + extraLevels * 0.04,
    hungerRate: Math.min(0.05, base.hungerRate + extraLevels * 0.001),
    pearlChance: Math.max(0.02, base.pearlChance - extraLevels * 0.003),
    hasBoss: false, bossHealth: 0,
  };
}

/**
 * @param {number} level
 * @returns {boolean}
 */
export function isBossLevel(level) {
  return level % 5 === 0;
}

/**
 * Bonus score for completing a level.
 * @param {number} level
 * @returns {number}
 */
export function levelBonus(level) {
  return level * 500 + 1000;
}

/**
 * @param {number} level
 * @returns {string}
 */
export function bossName(level) {
  return `MEGA JELLY BOSS LV${level}`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LEVEL_DURATION, getLevelConfig, isBossLevel, levelBonus, bossName };
}