/**
 * js/main.js
 * Orca: Deep Runner — main game loop, state machine, canvas rendering.
 * Integrates: orca, prey, predator, particle, audio, save, hud, levels.
 */

import { Vector2D, circleCircle, circleRect } from './engine/physics.js';
import { Orca } from './entities/orca.js';
import { preySystem, PREY_TYPES } from './entities/prey.js';
import { predatorSystem } from './entities/predator.js';
import { particleSystem } from './systems/particles.js';
import { audioSystem } from './systems/audio.js';
import { inputManager } from './engine/input.js';
import { loadHighScores, insertHighScore, isHighScore } from './systems/save.js';
import { getLevelConfig, isBossLevel, levelBonus, bossName, LEVEL_DURATION } from './systems/levels.js';
import { hudSystem } from './systems/hud.js';

// ── Canvas & World ─────────────────────────────────────────────────────────

const WORLD_W = 1280;
const WORLD_H = 720;

let canvas, ctx;
let gameTime = 0;
let levelTime = 0;
let lastTime = 0;
let animationId = null;

// ── Game State ───────────────────────────────────────────────────────────────

const STATE = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  LEVEL_COMPLETE: 'level-complete',
  GAME_OVER: 'game-over',
  GAME_CLEAR: 'game-clear',
  ENTERING_NAME: 'entering-name',
};

let currentState = STATE.MENU;
let player = null;
let currentLevel = 1;
let levelConfig = null;
let spawnQueue = [];
let spawnTimer = 0;
let hungerWarningPlayed = false;
let levelCompleteTimer = 0;
let levelCompleteBonusApplied = false;
let pendingHighScoreRank = null;

// ── Background Layers (Parallax) ─────────────────────────────────────────────

const BG_LAYERS = [
  { speed: 0.1, color: '#020508', y: 0 },
  { speed: 0.2, color: '#030a14', y: 0 },
  { speed: 0.35, color: '#051525', y: 0 },
];

const LIGHT_RAYS = [];
for (let i = 0; i < 6; i++) {
  LIGHT_RAYS.push({
    x: Math.random() * WORLD_W,
    width: 40 + Math.random() * 80,
    alpha: 0.03 + Math.random() * 0.05,
    angle: -0.1 + Math.random() * 0.2,
    speed: 0.05 + Math.random() * 0.05,
    phase: Math.random() * Math.PI * 2,
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  inputManager.attach(canvas);
  inputManager._canvas = canvas;
  buildMenuHighScores();
  transition(STATE.MENU);
}

function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}

// ── State Transitions ──────────────────────────────────────────────────────────

function transition(newState, data) {
  const prev = currentState;
  currentState = newState;

  if (newState === STATE.MENU) {
    showMenu();
  } else if (newState === STATE.PLAYING) {
    hideAllOverlays();
    hudSystem.show();
    if (prev !== STATE.PLAYING) {
      startLevel(data?.level || 1);
    }
  } else if (newState === STATE.PAUSED) {
    showOverlay('PAUSED', 'paused');
  } else if (newState === STATE.LEVEL_COMPLETE) {
    hudSystem.hide();
    showOverlay('LEVEL COMPLETE', 'level-complete');
    audioSystem.levelComplete();
    levelCompleteTimer = 0;
    levelCompleteBonusApplied = false;
  } else if (newState === STATE.GAME_OVER) {
    hudSystem.hide();
    audioSystem.gameOver();
    if (player && isHighScore(player.score)) {
      pendingHighScoreRank = null; // filled after name entry
      showOverlay('GAME OVER', 'game-over');
      showInitialsInput();
    } else {
      showOverlay('GAME OVER', 'game-over');
    }
  }
}

// ── Level Management ──────────────────────────────────────────────────────────

function startLevel(level) {
  currentLevel = level;
  levelConfig = getLevelConfig(level);
  levelTime = 0;
  spawnQueue = [];
  spawnTimer = 0;
  hungerWarningPlayed = false;
  levelCompleteBonusApplied = false;

  if (!player) {
    player = new Orca(WORLD_W / 2, WORLD_H / 2);
  } else {
    player.reset(WORLD_W / 2, WORLD_H / 2);
  }

  preySystem.clear();
  predatorSystem.clear();
  particleSystem.clear();
  buildSpawnQueue();
  hudSystem.buildLives(player.lives);

  if (isBossLevel(level)) {
    const boss = predatorSystem.spawnBoss(WORLD_W / 2, 150, levelConfig.bossHealth);
    audioSystem.bossAlert();
    hudSystem.setBossBar(true, bossName(level), 1.0);
  } else {
    hudSystem.setBossBar(false);
  }
}

function buildSpawnQueue() {
  const cfg = levelConfig;
  const preyPerWave = 4;
  for (let i = 0; i < cfg.preyCount; i++) {
    const delay = Math.floor(i / preyPerWave) * 3.0;
    const kinds = ['slow', 'medium', 'fast'];
    const kind = kinds[i % 3];
    spawnQueue.push({ type: 'prey', kind, delay });
  }
  for (let i = 0; i < cfg.sharkCount; i++) {
    spawnQueue.push({ type: 'shark', delay: 2.0 + i * 4.0 });
  }
  for (let i = 0; i < cfg.jellyCount; i++) {
    spawnQueue.push({ type: 'jelly', delay: 3.0 + i * 3.5 });
  }
  spawnQueue.sort((a, b) => a.delay - b.delay);
}

// ── Update ─────────────────────────────────────────────────────────────────────

function update(dt) {
  if (currentState === STATE.PLAYING) {
    updatePlaying(dt);
  } else if (currentState === STATE.LEVEL_COMPLETE) {
    updateLevelComplete(dt);
  }
}

function updatePlaying(dt) {
  gameTime += dt;
  levelTime += dt;

  if (inputManager.isPausePressed()) {
    transition(STATE.PAUSED);
    return;
  }

  if (inputManager.isMutePressed()) {
    audioSystem.setMuted(!audioSystem.muted);
    hudSystem.setMuted(audioSystem.muted);
    inputManager.updatePrev();
    return;
  }

  const dir = inputManager.getDir();
  const dashPressed = inputManager.isDashPressed();

  if (dashPressed && player.dashCooldown <= 0 && player.stunTimer <= 0) {
    const dashDir = new Vector2D(dir.x || 0.001, dir.y || 0.001);
    if (player.tryDash(dashDir, player.hunger)) {
      particleSystem.spawn('dash', player.pos.x, player.pos.y);
      audioSystem.dash();
    }
  }

  player.update(dt, dir, levelConfig.hungerRate, WORLD_W, WORLD_H);

  if (player.hunger < 0.2 && !hungerWarningPlayed) {
    audioSystem.hungerWarning();
    hungerWarningPlayed = true;
  }

  if (player.hunger <= 0) {
    transition(STATE.GAME_OVER);
    return;
  }

  if (player.lives <= 0) {
    transition(STATE.GAME_OVER);
    return;
  }

  // Spawn queue
  spawnTimer += dt;
  while (spawnQueue.length > 0 && spawnQueue[0].delay <= spawnTimer) {
    const item = spawnQueue.shift();
    if (item.type === 'prey') {
      const pearl = Math.random() < levelConfig.pearlChance;
      preySystem.spawn(item.kind, WORLD_W, WORLD_H, { speedMult: levelConfig.preySpeedMult, pearl });
    } else if (item.type === 'shark') {
      const sx = Math.random() < 0.5 ? -40 : WORLD_W + 40;
      const sy = Math.random() * WORLD_H;
      predatorSystem.spawnShark(sx, sy, { speed: 2.2 * levelConfig.sharkSpeedMult });
    } else if (item.type === 'jelly') {
      const jx = Math.random() * WORLD_W;
      const jy = -30;
      predatorSystem.spawnJelly(jx, jy);
    }
  }

  preySystem.update(dt, preySystem.getActive(), WORLD_W, WORLD_H);
  predatorSystem.update(dt, player.pos.x, player.pos.y, WORLD_W, WORLD_H, levelConfig.sharkSpeedMult);
  particleSystem.update(dt, WORLD_W, WORLD_H);

  handlePreyCollisions();
  handlePredatorCollisions();
  handleBossCollisions();

  if (isBossLevel(currentLevel) && predatorSystem.boss && !predatorSystem.boss.active) {
    predatorSystem._boss = null;
    hudSystem.setBossBar(false);
  }

  // Level complete check
  if (!isBossLevel(currentLevel) && levelTime >= LEVEL_DURATION) {
    transition(STATE.LEVEL_COMPLETE);
    return;
  }

  if (isBossLevel(currentLevel) && (!predatorSystem.boss || !predatorSystem.boss.active)) {
    transition(STATE.LEVEL_COMPLETE);
    return;
  }

  hudSystem.update(player.score, player.combo, player.hunger, player.lives, currentLevel);

  if (predatorSystem.boss && predatorSystem.boss.active) {
    hudSystem.setBossBar(true, bossName(currentLevel), predatorSystem.boss.healthPct);
  }

  inputManager.updatePrev();
}

function handlePreyCollisions() {
  const active = preySystem.getActive();
  for (const prey of active) {
    if (!prey.active || prey.eaten) continue;
    const dist = Vector2D.dist(player.pos, new Vector2D(prey.x, prey.y));
    if (dist < player.radius + prey.radius) {
      prey.eaten = true;
      const pts = player.eat(prey.points, gameTime);
      audioSystem.eatSmall();
      particleSystem.spawn('eat', prey.x, prey.y, { color: prey.color });
      if (player.combo > 1) {
        hudSystem.showComboFlash(`COMBO x${player.combo}!`);
      }
      preySystem.release(prey);
    }
  }
}

function handlePredatorCollisions() {
  const sharks = predatorSystem.sharks;
  const jellies = predatorSystem.jellies;
  const boss = predatorSystem.boss;

  for (const shark of sharks) {
    if (!shark.active) continue;
    const dist = Vector2D.dist(player.pos, new Vector2D(shark.x, shark.y));
    if (dist < player.radius + shark.radius) {
      if (player.takeDamage()) {
        player.knockback(shark.x, shark.y);
        audioSystem.damage();
        particleSystem.spawn('damage', player.pos.x, player.pos.y);
        hudSystem.shake(2);
        shark.stun();
      }
    }
  }

  for (const jelly of jellies) {
    if (!jelly.active) continue;
    const dist = Vector2D.dist(player.pos, new Vector2D(jelly.x, jelly.y));
    if (dist < player.radius + jelly.radius) {
      if (player.stunTimer <= 0) {
        player.stunTimer = 1.5;
        player.knockback(jelly.x, jelly.y);
        audioSystem.stun();
        particleSystem.spawn('stun', player.pos.x, player.pos.y);
        hudSystem.shake(1);
      }
    }
  }

  if (boss && boss.active) {
    const dist = Vector2D.dist(player.pos, new Vector2D(boss.x, boss.y));
    if (dist < player.radius + boss.radius) {
      if (player.takeDamage()) {
        player.knockback(boss.x, boss.y);
        audioSystem.damage();
        particleSystem.spawn('damage', player.pos.x, player.pos.y);
        hudSystem.shake(3);
        boss.takeDamage(1);
        audioSystem.bossHit();
        particleSystem.spawn('bossHit', player.pos.x, player.pos.y);
      }
    }
  }
}

function handleBossCollisions() {
  // handled in handlePredatorCollisions
}

// ── Render ─────────────────────────────────────────────────────────────────────

function render() {
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const scaleX = w / WORLD_W;
  const scaleY = h / WORLD_H;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (w - WORLD_W * scale) / 2;
  const offsetY = (h - WORLD_H * scale) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  if (currentState === STATE.MENU) {
    renderMenu();
  } else {
    renderGame();
  }

  ctx.restore();
}

function renderGame() {
  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  grad.addColorStop(0, '#0a1f38');
  grad.addColorStop(0.4, '#061425');
  grad.addColorStop(1, '#020810');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Parallax layers
  const t = gameTime;
  for (const layer of BG_LAYERS) {
    const shift = (t * layer.speed * 20) % 100;
    ctx.fillStyle = layer.color;
    ctx.fillRect(-shift, 0, WORLD_W + 200, WORLD_H);
  }

  // Light rays
  for (const ray of LIGHT_RAYS) {
    const rx = ray.x + Math.sin(t * ray.speed + ray.phase) * 30;
    const rw = ray.width;
    const alpha = ray.alpha * (0.7 + 0.3 * Math.sin(t * 0.3 + ray.phase));
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx + rw, 0);
    ctx.lineTo(rx + rw * 0.3 + rw * 0.5, WORLD_H);
    ctx.lineTo(rx - rw * 0.2, WORLD_H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Prey
  preySystem.forEach(p => {
    if (!p.active) return;
    drawPrey(p);
  });

  // Predators
  for (const shark of predatorSystem.sharks) {
    if (shark.active) drawShark(shark);
  }
  for (const jelly of predatorSystem.jellies) {
    if (jelly.active) drawJelly(jelly);
  }
  if (predatorSystem.boss && predatorSystem.boss.active) {
    drawBoss(predatorSystem.boss);
  }

  // Orca
  if (player) {
    drawOrca(player);
  }

  // Particles
  particleSystem._pool.forEach(p => {
    if (!p.active) return;
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function drawPrey(p) {
  const r = p.radius;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r * 1.4, r * 0.8, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.innerColor;
  ctx.beginPath();
  ctx.ellipse(p.x - r * 0.2, p.y - r * 0.15, r * 0.5, r * 0.3, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(p.x + r * 0.5, p.y - r * 0.1, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
}

function drawShark(s) {
  const r = s.radius;
  const angle = Math.atan2(s.vy, s.vx);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(angle);
  if (s.isStunned) ctx.globalAlpha = 0.5;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.6, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = s.finColor;
  ctx.beginPath();
  ctx.moveTo(-r * 0.2, -r * 0.7);
  ctx.lineTo(r * 0.3, -r * 1.4);
  ctx.lineTo(r * 0.5, -r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 1.4, 0);
  ctx.lineTo(-r * 2.1, -r * 0.6);
  ctx.lineTo(-r * 1.8, 0);
  ctx.lineTo(-r * 2.1, r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = s.eyeColor;
  ctx.beginPath();
  ctx.arc(r * 0.7, -r * 0.2, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawJelly(j) {
  const r = j.radius;
  ctx.save();
  ctx.translate(j.x, j.y);
  ctx.fillStyle = j.color;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.7, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = j.eyeColor;
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.1, r * 0.5, r * 0.3, 0, Math.PI, 0);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = j.finColor;
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const tx = (i - 2) * r * 0.35;
    const phase = j.jellyPhase + i * 0.5;
    ctx.beginPath();
    ctx.moveTo(tx, r * 0.1);
    ctx.quadraticCurveTo(tx + Math.sin(phase) * r * 0.4, r * 0.8, tx + Math.sin(phase + 1) * r * 0.3, r * 1.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoss(b) {
  const r = b.radius;
  ctx.save();
  ctx.translate(b.x, b.y);
  const flash = b.bossDamageFlash > 0;
  const baseColor = flash ? '#ff6b6b' : b.color;
  const finColor = flash ? '#ff9999' : b.finColor;
  ctx.shadowColor = b.color;
  ctx.shadowBlur = 30;
  ctx.fillStyle = baseColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.75, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = finColor;
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.1, r * 0.6, r * 0.35, 0, Math.PI, 0);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = finColor;
  ctx.lineWidth = 4;
  for (let i = 0; i < 7; i++) {
    const tx = (i - 3) * r * 0.25;
    const phase = b.jellyPhase + i * 0.6;
    ctx.beginPath();
    ctx.moveTo(tx, r * 0.15);
    ctx.quadraticCurveTo(tx + Math.sin(phase) * r * 0.5, r * 1.0, tx + Math.sin(phase + 1) * r * 0.4, r * 1.8);
    ctx.stroke();
  }
  ctx.fillStyle = b.eyeColor;
  ctx.beginPath();
  ctx.arc(-r * 0.35, -r * 0.2, r * 0.15, 0, Math.PI * 2);
  ctx.arc(r * 0.35, -r * 0.2, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOrca(o) {
  const r = o.radius;
  const px = o.pos.x;
  const py = o.pos.y;
  const angle = Math.atan2(o.vel.y, o.vel.x);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  if (o.invincibleTimer > 0 && Math.floor(o.invincibleTimer * 10) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.5, r * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e8f0';
  ctx.beginPath();
  ctx.ellipse(r * 0.1, r * 0.15, r * 0.9, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(r * 0.5, -r * 0.15, r * 0.25, r * 0.18, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(r * 0.55, -r * 0.12, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.75);
  ctx.lineTo(r * 0.2, -r * 1.5);
  ctx.lineTo(r * 0.45, -r * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 1.3, 0);
  ctx.lineTo(-r * 2.0, -r * 0.7);
  ctx.lineTo(-r * 1.6, 0);
  ctx.lineTo(-r * 2.0, r * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.ellipse(r * 0.2, r * 0.5, r * 0.5, r * 0.2, 0.5, 0, Math.PI * 2);
  ctx.fill();
  if (o.eatTimer > 0) {
    ctx.strokeStyle = '#2ed573';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.8, r * 1.0, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Menu Render ─────────────────────────────────────────────────────────────────

function renderMenu() {
  const grad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  grad.addColorStop(0, '#0a1f38');
  grad.addColorStop(0.5, '#061425');
  grad.addColorStop(1, '#020810');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  const t = Date.now() / 1000;
  for (const ray of LIGHT_RAYS) {
    const rx = ray.x + Math.sin(t * ray.speed + ray.phase) * 30;
    const rw = ray.width;
    const alpha = ray.alpha * 0.5;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx + rw, 0);
    ctx.lineTo(rx + rw * 0.3 + rw * 0.5, WORLD_H);
    ctx.lineTo(rx - rw * 0.2, WORLD_H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = '#00e5ff';
  ctx.font = 'bold 52px "Courier New"';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 30;
  ctx.fillText('ORCA', WORLD_W / 2, 180);
  ctx.shadowBlur = 0;
  ctx.font = '16px "Courier New"';
  ctx.fillStyle = '#6b8fa3';
  ctx.fillText('DEEP RUNNER', WORLD_W / 2, 215);
  ctx.fillStyle = '#00e5ff';
  ctx.font = '11px "Courier New"';
  ctx.fillText('WASD / ARROWS TO SWIM  |  SHIFT/J TO DASH  |  P/ESC TO PAUSE', WORLD_W / 2, 250);
  ctx.fillText('M TO MUTE  |  TOUCH DRAG ON MOBILE', WORLD_W / 2, 268);
  ctx.textAlign = 'left';
}

// ── Overlay / Menu Helpers ──────────────────────────────────────────────────────

function showOverlay(title, className) {
  const el = document.getElementById('overlay');
  const titleEl = el ? el.querySelector('.overlay-title') : null;
  if (el) el.classList.remove('hidden');
  if (titleEl) {
    titleEl.textContent = title;
    titleEl.className = 'overlay-title ' + (className || '');
  }
  const stats = el ? el.querySelector('.overlay-stats') : null;
  if (stats && player) {
    stats.innerHTML = `SCORE: <span>${player.score.toLocaleString()}</span>  |  LEVEL: <span>${currentLevel}</span>`;
  }
}

function hideAllOverlays() {
  const el = document.getElementById('overlay');
  if (el) el.classList.add('hidden');
  const initialsEl = document.getElementById('initials-input');
  if (initialsEl) initialsEl.style.display = 'none';
}

function showInitialsInput() {
  const el = document.getElementById('initials-input');
  if (el) { el.style.display = 'block'; el.value = ''; el.focus(); }
}

function showBonusText(text) {
  let el = document.querySelector('.bonus-text');
  if (!el) { el = document.createElement('div'); el.className = 'bonus-text'; document.body.appendChild(el); }
  el.textContent = text;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2000);
}

function showMenu() {
  const menu = document.getElementById('menu');
  if (menu) menu.classList.remove('hidden');
  hideAllOverlays();
  hudSystem.hide();
}

function buildMenuHighScores() {
  const box = document.querySelector('.high-scores-box');
  if (!box) return;
  const scores = loadHighScores();
  let html = '';
  if (scores.length === 0) {
    html = '<div class="hs-row"><span class="hs-rank">—</span><span class="hs-initials">—</span><span class="hs-score">—</span></div>';
  } else {
    scores.forEach((s, i) => {
      html += `<div class="hs-row"><span class="hs-rank">${i + 1}.</span><span class="hs-initials">${s.initials}</span><span class="hs-score">${s.score.toLocaleString()}</span></div>`;
    });
  }
  const title = box.querySelector('.high-scores-title') || document.createElement('div');
  title.className = 'high-scores-title';
  title.textContent = 'HIGH SCORES';
  box.innerHTML = '';
  box.appendChild(title);
  box.innerHTML += html;
}

// ── Menu Button Actions ────────────────────────────────────────────────────────

function onStartGame() {
  audioSystem.resume();
  audioSystem.init();
  audioSystem.menuConfirm();
  currentLevel = 1;
  startLevel(1);
  transition(STATE.PLAYING);
}

function onResumeGame() {
  audioSystem.menuConfirm();
  transition(STATE.PLAYING);
}

function onRestartGame() {
  audioSystem.menuConfirm();
  startLevel(currentLevel);
  transition(STATE.PLAYING);
}

function onMainMenu() {
  audioSystem.menuSelect();
  if (animationId) cancelAnimationFrame(animationId);
  currentState = STATE.MENU;
  player = null;
  preySystem.clear();
  predatorSystem.clear();
  particleSystem.clear();
  transition(STATE.MENU);
}

function onSubmitScore() {
  const input = document.getElementById('initials-input');
  const initials = input ? (input.value || 'AAA').toUpperCase().slice(0, 3) : 'AAA';
  insertHighScore(initials, player.score);
  const input2 = document.getElementById('initials-input');
  if (input2) input2.style.display = 'none';
  buildMenuHighScores();
  currentState = STATE.MENU;
  transition(STATE.MENU);
}

// ── Game Loop ──────────────────────────────────────────────────────────────────

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - (lastTime || timestamp)) / 1000, 0.05);
  lastTime = timestamp;
  update(dt);
  render();
  animationId = requestAnimationFrame(gameLoop);
}

function startGameLoop() {
  if (animationId) cancelAnimationFrame(animationId);
  lastTime = performance.now();
  animationId = requestAnimationFrame(gameLoop);
}

// ── DOM-ready ───────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  init();

  const btnStart = document.getElementById('btn-start');
  if (btnStart) btnStart.addEventListener('click', onStartGame);

  const btnResume = document.getElementById('btn-resume');
  if (btnResume) btnResume.addEventListener('click', onResumeGame);

  const btnRestart = document.getElementById('btn-restart');
  if (btnRestart) btnRestart.addEventListener('click', onRestartGame);

  const btnMainMenu = document.getElementById('btn-main-menu');
  if (btnMainMenu) btnMainMenu.addEventListener('click', onMainMenu);

  const btnSubmit = document.getElementById('btn-submit-score');
  if (btnSubmit) btnSubmit.addEventListener('click', onSubmitScore);

  const initialsInput = document.getElementById('initials-input');
  if (initialsInput) {
    initialsInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') onSubmitScore();
    });
  }

  startGameLoop();
});

// ── Exports (for tests) ────────────────────────────────────────────────────────

export { STATE, currentState, player, currentLevel, levelConfig,
         startLevel, transition, updatePlaying, handlePreyCollisions,
         handlePredatorCollisions, spawnQueue, gameTime, levelTime,
         WORLD_W, WORLD_H };

export default null;