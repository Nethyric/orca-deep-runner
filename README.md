# Orca: Deep Runner

> **Field test:** this game was built autonomously by
> [**Orca Code**](https://github.com/Nethyric/orca-code) — the zero-dependency AI coding agent —
> in a single continuous session (18 files, ~2,600 lines, 90 logic tests),
> driven by MiniMax-M2.7 via the Dahl inference API.


A survival-arcade game where you control a growing orca in the deep ocean.
Hunt prey to survive — eat fast sardines, cautious mackerel, and powerful tuna.
Beware sharks and jellyfish. Every 5th level a Mega Jelly Boss guards the deep.

---

## Deep Ocean Identity

- **Aesthetic**: Bioluminescent deep-ocean noir. Dark backgrounds (#020810 → #0a1f38),
  cyan glow accents (#00e5ff), parallax light-rays.
- **Feel**: Fluid physics with momentum, tight dash-and-chase combo loop.
- **Progression**: Score unlocks growth tiers (larger orca, stronger presence).
  Every 5 levels a boss challenge.
- **Audio**: Fully synthesized WebAudio SFX — no audio files needed.

---

## Controls

| Action     | Keyboard         | Mobile          |
|------------|------------------|-----------------|
| Swim       | WASD / Arrow Keys | Touch drag      |
| Dash burst | Shift / J         | —               |
| Pause      | P / Esc          | —               |
| Mute audio | M                 | —               |

---

## Prey Kinds

| Kind     | Name      | Speed | Points | Colour  |
|----------|-----------|-------|--------|---------|
| Fast     | Sardine   | 3.5   | 50     | Orange  |
| Medium   | Mackerel | 2.2   | 100    | Blue    |
| Slow     | Tuna      | 1.2   | 200    | Green   |

Pearls (rare, glowing white) award **500 pts** and restore extra hunger.

---

## Combo & Scoring

- **Combo** builds when successive eats land within 1.8 seconds (max x10).
- **eatPearl** boosts combo by +2 (capped at 10) before multiplying points.
- Base points × combo multiplier = score per eat.
- **Hunger** drains each second; eat to restore. Starve → game over.
- **Lives**: 3 per game; lose one on predator contact. Invincibility frames apply.

---

## Levels

- 60-second timed levels (non-boss).
- Boss levels every **5th level** (5, 10, 15 …).
- Boss health scales: level 5 = 10 HP, level 10 = 20 HP, level 15 = 35 HP.
- Infinite scaling beyond level 15: more prey, more predators, faster sharks.
- Level-complete bonus: `level × 500 + 1000` pts.

---

## High Scores

Top 5 scores persisted in `localStorage`. Enter 3-letter initials on game over.

---

## Run

**Option A — development (live reload not included):**

```
open index.html
```

**Option B — single-file build:**

```
python3 tools/build_single.py
# → dist/orca-deep-runner.html
open dist/orca-deep-runner.html
```

---

## Tests

```bash
node tests/logic.test.mjs
```

Expected output: `Results: 90 passed, 0 failed`

---

## Build

```bash
python3 tools/build_single.py
```

Dependencies: Python 3 standard library only. Output: `dist/orca-deep-runner.html`.

---

## Project Structure

```
js/
  engine/
    physics.js   — Vector2D, collision, swim physics (DOM-free)
    pool.js      — Generic object pool (DOM-free)
    input.js     — Keyboard + touch singleton
  entities/
    orca.js      — Player entity + eat/combo/hunger logic
    prey.js      — Prey fish (boid schooling), pearls
    predator.js  — Shark AI, jellyfish, BossJellyfish
  systems/
    particles.js — Particle pool + effects
    audio.js     — WebAudio synthesized SFX
    save.js      — localStorage high-score table
    levels.js    — Level configs, boss detection, scaling
    hud.js       — DOM HUD management
  main.js        — Game loop, state machine, rendering

css/
  style.css      — All styles, CSS variables, animations

tests/
  logic.test.mjs — 90 plain-assert DOM-free tests

tools/
  build_single.py — Inline CSS + concatenate JS → dist/

index.html       — Entry point (uses module script tags)
dist/            — Build output (git-ignored)
```