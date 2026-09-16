/**
 * js/systems/save.js
 * localStorage high-score table (top 5).
 * Pure JS — localStorage guarded by try/catch for node compatibility.
 */

const SAVE_KEY = 'orca_deep_runner_scores';

function _getStorage() {
  try { return localStorage; } catch (e) { return null; }
}

/**
 * @returns {Array<{initials: string, score: number}>}
 */
function loadHighScores() {
  try {
    const raw = _getStorage()?.getItem(SAVE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}

/**
 * Persist top-5 high scores.
 * @param {Array} scores
 */
function saveHighScores(scores) {
  try {
    _getStorage()?.setItem(SAVE_KEY, JSON.stringify(scores));
  } catch (e) { /* ignore */ }
}

/**
 * Insert a score; returns new table.
 * @param {string} initials - 3 chars
 * @param {number} score
 * @returns {Array} new top-5 table
 */
function insertHighScore(initials, score) {
  const scores = loadHighScores();
  scores.push({ initials: initials.toUpperCase().slice(0, 3), score });
  scores.sort((a, b) => b.score - a.score);
  const top5 = scores.slice(0, 5);
  saveHighScores(top5);
  return top5;
}

/**
 * Check if score qualifies for top 5.
 * @param {number} score
 * @returns {boolean}
 */
function isHighScore(score) {
  const scores = loadHighScores();
  if (scores.length < 5) return true;
  return score > scores[scores.length - 1].score;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadHighScores, saveHighScores, insertHighScore, isHighScore };
}