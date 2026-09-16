/**
 * tests/logic.test.mjs
 * Plain-assert tests for DOM-free game modules.
 * Run: node tests/logic.test.mjs
 * Exit 0 only if ALL tests pass.
 */
import { Vector2D, circleCircle, circleRect,
         makeSwimState, applySwimForce, applyDash,
         integratePhysics, keepInBounds } from '../js/engine/physics.js';
import Pool from '../js/engine/pool.js';
import { getLevelConfig, isBossLevel, levelBonus, bossName } from '../js/systems/levels.js';
import { Orca } from '../js/entities/orca.js';

// ── helpers ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function pass(name) { console.log(`PASS ${name}`); passed++; }
function fail(name, reason) { console.log(`FAIL ${name}: ${reason}`); failed++; }
function assert(condition, name, reason) {
  if (condition) pass(name); else fail(name, reason);
}
function assertNear(a, b, tol, name) {
  if (Math.abs(a - b) <= tol) pass(name);
  else fail(name, `expected ~${b}, got ${a}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Vector2D
// ═══════════════════════════════════════════════════════════════════════════
assert(new Vector2D(3,4).x === 3, 'Vector2D constructor x');
assert(new Vector2D(3,4).y === 4, 'Vector2D constructor y');
{
  const v = new Vector2D(3, 4); v.set(5, 6);
  assert(v.x === 5 && v.y === 6, 'Vector2D set');
}
assert(new Vector2D(1,2).add(new Vector2D(3,6)).x === 4, 'Vector2D add x');
assert(new Vector2D(1,2).add(new Vector2D(3,6)).y === 8, 'Vector2D add y');
assert(new Vector2D(5,8).sub(new Vector2D(2,3)).x === 3, 'Vector2D sub x');
assert(new Vector2D(5,8).sub(new Vector2D(2,3)).y === 5, 'Vector2D sub y');
assert(new Vector2D(3,4).scale(2).x === 6, 'Vector2D scale x');
assert(new Vector2D(3,4).scale(2).y === 8, 'Vector2D scale y');
assert(new Vector2D(1,2).dot(new Vector2D(3,4)) === 11, 'Vector2D dot = 11');
assertNear(new Vector2D(3,4).length(), 5, 1e-10, 'Vector2D length 3-4-5');
assertNear(new Vector2D(3,4).lengthSq(), 25, 1e-10, 'Vector2D lengthSq = 25');
assertNear(new Vector2D(3,4).normalize().length(), 1, 1e-10, 'Vector2D normalize unit');
assert(new Vector2D(0,0).normalize().x === 0, 'Vector2D normalize zero x');
assert(new Vector2D(0,0).normalize().y === 0, 'Vector2D normalize zero y');
assertNear(new Vector2D(10,0).limit(5).length(), 5, 1e-10, 'Vector2D limit');
{
  const v = new Vector2D(1,2); const c = v.clone(); c.x = 99;
  assert(v.x === 1, 'Vector2D clone independence');
}
assertNear(Vector2D.dist(new Vector2D(0,0), new Vector2D(3,4)), 5, 1e-10, 'Vector2D.dist');
assertNear(Vector2D.distSq(new Vector2D(0,0), new Vector2D(3,4)), 25, 1e-10, 'Vector2D.distSq');

// ═══════════════════════════════════════════════════════════════════════════
// Circle-Circle Collision
// ═══════════════════════════════════════════════════════════════════════════
{
  const a = { pos: new Vector2D(0,0), radius: 10 };
  const b = { pos: new Vector2D(19,0), radius: 9 };
  assert(circleCircle(a,b) === true, 'circleCircle hit — touching');
}
{
  const a = { pos: new Vector2D(0,0), radius: 10 };
  const b = { pos: new Vector2D(5,0), radius: 10 };
  assert(circleCircle(a,b) === true, 'circleCircle hit — overlap');
}
{
  const a = { pos: new Vector2D(0,0), radius: 10 };
  const b = { pos: new Vector2D(50,0), radius: 5 };
  assert(circleCircle(a,b) === false, 'circleCircle miss — far apart');
}
{
  const a = { pos: new Vector2D(0,0), radius: 20 };
  const b = { pos: new Vector2D(2,0), radius: 5 };
  assert(circleCircle(a,b) === true, 'circleCircle hit — inside other');
}

// ═══════════════════════════════════════════════════════════════════════════
// Circle-Rect Collision
// ═══════════════════════════════════════════════════════════════════════════
{
  const c = { pos: new Vector2D(50,50), radius: 10 };
  const r = { x: 0, y: 0, width: 100, height: 100 };
  assert(circleRect(c,r) === true, 'circleRect hit — inside rect');
}
{
  const c = { pos: new Vector2D(55,5), radius: 10 };
  const r = { x: 0, y: 0, width: 50, height: 50 };
  assert(circleRect(c,r) === true, 'circleRect hit — partial overlap');
}
{
  const c = { pos: new Vector2D(200,25), radius: 10 };
  const r = { x: 0, y: 0, width: 50, height: 50 };
  assert(circleRect(c,r) === false, 'circleRect miss — right of rect');
}
{
  const c = { pos: new Vector2D(25,200), radius: 10 };
  const r = { x: 0, y: 0, width: 50, height: 50 };
  assert(circleRect(c,r) === false, 'circleRect miss — below rect');
}
{
  const c = { pos: new Vector2D(60,60), radius: 5 };
  const r = { x: 50, y: 50, width: 10, height: 10 };
  assert(circleRect(c,r) === true, 'circleRect hit — corner nearest');
}

// ═══════════════════════════════════════════════════════════════════════════
// Swim Physics
// ═══════════════════════════════════════════════════════════════════════════
assert(makeSwimState().pos.x === 0, 'makeSwimState default x');
assert(makeSwimState().pos.y === 0, 'makeSwimState default y');
assert(makeSwimState().radius === 20, 'makeSwimState default radius');
assert(makeSwimState().maxSpeed === 5, 'makeSwimState default maxSpeed');
{
  const s = makeSwimState(); applySwimForce(s, new Vector2D(1,0));
  assert(s.acc.x > 0, 'applySwimForce adds acc x');
}
{
  const s = makeSwimState(); const before = s.acc.x;
  applySwimForce(s, new Vector2D(0,0));
  assert(s.acc.x === before, 'applySwimForce ignores zero dir');
}
{
  const s = makeSwimState(0,0); s.vel.set(10,0); s.acc.set(0,0);
  const px = s.pos.x;
  integratePhysics(s, 1/60);
  assert(s.pos.x > px, 'integratePhysics moves position');
  assert(s.vel.x < 10, 'integratePhysics applies drag');
}
{
  const s = makeSwimState(); s.vel.set(100,0);
  integratePhysics(s, 1/60);
  assert(s.vel.length() <= s.maxSpeed + 0.001, 'integratePhysics clamps speed');
}
{
  const s = makeSwimState(0,0); s.vel.set(0,0);
  applyDash(s, new Vector2D(1,0), 15);
  assert(s.vel.x > 10, 'applyDash adds velocity burst');
}
{
  const s = makeSwimState(0,0);
  applyDash(s, new Vector2D(1,0), 1000);
  assert(s.vel.length() <= s.maxSpeed * 3 + 0.001, 'applyDash clamps max speed');
}
{
  const s = makeSwimState(-50,0); s.radius = 10;
  keepInBounds(s, 100, 100, true);
  assert(s.pos.x > 0, 'keepInBounds wrap right');
}
{
  const s = makeSwimState(500,500); s.radius = 10;
  keepInBounds(s, 100, 100, false);
  assert(s.pos.x <= 90 && s.pos.y <= 90, 'keepInBounds clamp bottom-right');
}
{
  const s = makeSwimState(-500,-500); s.radius = 10;
  keepInBounds(s, 100, 100, false);
  assert(s.pos.x >= 10 && s.pos.y >= 10, 'keepInBounds clamp top-left');
}

// ═══════════════════════════════════════════════════════════════════════════
// Object Pool
// ═══════════════════════════════════════════════════════════════════════════
{
  const pool = new Pool(() => ({ active:false }), 3);
  assert(pool.activeCount === 0, 'Pool prealloc activeCount=0');
  assert(pool.freeCount === 3, 'Pool prealloc freeCount=3');
}
{
  const pool = new Pool(() => ({ active:false }), 0);
  const obj = pool.acquire();
  assert(obj.active === true, 'acquired object active');
  assert(pool.activeCount === 1, 'activeCount increments');
  assert(pool.freeCount === 0, 'freeCount decrements');
}
{
  const pool = new Pool(() => ({ active:false }), 1);
  const obj = pool.acquire();
  pool.release(obj);
  assert(obj.active === false, 'released object inactive');
  assert(pool.activeCount === 0, 'release activeCount=0');
  assert(pool.freeCount === 1, 'release freeCount restored to pre-acquire level');
}
{
  const pool = new Pool(() => ({ active:false, n:0 }), 1);
  const obj1 = pool.acquire();
  pool.release(obj1);
  const obj2 = pool.acquire();
  assert(obj1 === obj2, 'Pool reuses released object');
}
{
  const pool = new Pool(() => ({ active:false }), 0);
  pool.acquire(); pool.acquire();
  pool.releaseAll();
  assert(pool.activeCount === 0, 'releaseAll activeCount=0');
  assert(pool.freeCount === 2, 'releaseAll freeCount=2');
}
{
  const pool = new Pool(() => ({ active:false, fresh:true }), 0);
  assert(pool.acquire().fresh === true, 'factory when free list empty');
}
{
  const pool = new Pool(() => ({ active:false, n:0 }), 0);
  pool.acquire(); pool._active[0].n = 1;
  pool.acquire(); pool._active[1].n = 2;
  let sum = 0; pool.forEach(o => sum += o.n);
  assert(sum === 3, 'forEach sums only active');
}

// ═══════════════════════════════════════════════════════════════════════════
// Scoring & Combo Math (Orca.eat / eatPearl)
// ═══════════════════════════════════════════════════════════════════════════
{
  const o = new Orca(0,0);
  o.eat(100, 10);
  assert(o.combo === 1, 'first eat combo=1');
}
{
  const o = new Orca(0,0);
  o.eat(100, 0);
  o.eat(100, 20); // 20-0=20 > comboWindow 1.8
  assert(o.combo === 1, 'eat outside window resets combo');
}
{
  const o = new Orca(0,0);
  o.eat(100, 0);
  o.eat(100, 0.5); // within window
  assert(o.combo === 2, 'rapid eat builds combo to 2');
}
{
  const o = new Orca(0,0);
  o.eat(100, 0);
  o.eat(100, 0.5);
  o.eat(100, 1.0);
  assert(o.combo === 3, 'third eat combo=3');
}
{
  const o = new Orca(0,0);
  for (let i = 0; i < 20; i++) o.eat(100, i * 0.1);
  assert(o.combo === 10, 'combo caps at 10');
}
{
  // Note: combo is managed internally by Orca.eat() based on timing.
  // Direct combo assignment is overwritten by eat() logic.
  const o = new Orca(0,0);
  o.eat(100, 0); o.eat(100, 0.5); // combo builds to 2 internally
  assert(o.combo === 2, 'eat builds combo via timing');
}
{
  // combo boost: eatPearl adds +2 (capped at 10)
  // after one eat combo=1, eatPearl does min(1+2,10)=3
  const o = new Orca(0,0);
  o.eat(100, 0); // combo=1
  o.eatPearl(50, 0.5); // combo = min(1+2, 10) = 3
  assert(o.combo === 3, 'eatPearl combo boost +2 from existing combo');
}
{
  // eatPearl: combo+2 then points = base * new_combo
  // Since eatPearl updates combo first, we test the return value reflects updated combo
  const o = new Orca(0,0);
  o.eat(100, 0); // combo=1, lastEat=0
  o.eat(100, 0.5); // within window, combo=2
  // now call eatPearl at t=1.0 (outside 1.8 window), combo resets to 1 first, then +2 = 3
  const ptsPearl = o.eatPearl(100, 2.0);
  // window: 2.0 - 0.5 = 1.5 > 1.8? No, 1.5 < 1.8, still in window
  // combo starts at 2, then eatPearl does min(2+2,10)=4, points=400
  assert(ptsPearl === 400, 'eatPearl points = base * updated_combo');
}
{
  const o = new Orca(0,0);
  o.hunger = 0.5;
  o.eat(100, 0);
  assert(o.hunger > 0.5, 'eat restores hunger');
}
{
  const o = new Orca(0,0);
  o.hunger = 0.2;
  o.eatPearl(50, 0);
  assert(o.hunger > 0.5, 'eatPearl restores more hunger');
}

// ═══════════════════════════════════════════════════════════════════════════
// Level Config Progression + Boss every 5th
// ═══════════════════════════════════════════════════════════════════════════
assert(getLevelConfig(1).preyCount === 20, 'level 1 preyCount=20');
assert(getLevelConfig(1).hasBoss === false, 'level 1 no boss');
assert(getLevelConfig(5).hasBoss === true, 'level 5 has boss');
assert(getLevelConfig(5).bossHealth === 10, 'level 5 bossHealth=10');
assert(getLevelConfig(10).hasBoss === true, 'level 10 has boss');
assert(getLevelConfig(10).bossHealth === 20, 'level 10 bossHealth=20');
assert(getLevelConfig(15).hasBoss === true, 'level 15 has boss');
assert(getLevelConfig(15).bossHealth === 35, 'level 15 bossHealth=35');
assert(isBossLevel(5) === true, 'isBossLevel(5)=true');
assert(isBossLevel(10) === true, 'isBossLevel(10)=true');
assert(isBossLevel(15) === true, 'isBossLevel(15)=true');
assert(isBossLevel(3) === false, 'isBossLevel(3)=false');
assert(isBossLevel(7) === false, 'isBossLevel(7)=false');
assert(isBossLevel(1) === false, 'isBossLevel(1)=false');
assert(isBossLevel(0) === true, 'isBossLevel(0)=true (mathematical: 0%5===0, level-0 does not occur in game)');
// level 16 should be non-boss
assert(getLevelConfig(16).hasBoss === false, 'level 16 no boss');
// infinite scaling beyond level 15
assert(getLevelConfig(20).preyCount > getLevelConfig(15).preyCount, 'level 20 prey > level 15');
assert(getLevelConfig(50).sharkCount > getLevelConfig(20).sharkCount, 'level 50 sharks > level 20');

// ═══════════════════════════════════════════════════════════════════════════
// Hunger Decay
// ═══════════════════════════════════════════════════════════════════════════
{
  const o = new Orca(0,0);
  o.hunger = 1.0;
  o.update(1, {x:0,y:0}, 0.01, 800, 600); // 1 second at rate 0.01
  assertNear(o.hunger, 0.99, 1e-6, 'hunger decays by rate*dt');
}
{
  const o = new Orca(0,0);
  o.hunger = 0.5;
  o.update(0.5, {x:0,y:0}, 0.02, 800, 600); // 0.5s at rate 0.02
  assertNear(o.hunger, 0.49, 1e-6, 'hunger half-rate decay');
}
{
  const o = new Orca(0,0);
  o.hunger = 0.01;
  o.update(1, {x:0,y:0}, 0.02, 800, 600);
  assert(o.hunger >= 0, 'hunger does not go negative');
}

// ═══════════════════════════════════════════════════════════════════════════
// Orca growth tiers
// ═══════════════════════════════════════════════════════════════════════════
{
  const o = new Orca(0,0);
  assert(o.growthTier === 0, 'initial growthTier=0');
  assert(o.radius === 22, 'initial radius (base 22)');
}
{
  const o = new Orca(0,0);
  o.score = 2000;
  o.update(0, {x:0,y:0}, 0, 800, 600);
  assert(o.growthTier >= 1, 'score 2000 reaches tier >= 1');
}
{
  const o = new Orca(0,0);
  o.score = 50000;
  o.update(0, {x:0,y:0}, 0, 800, 600);
  assert(o.growthTier === 5, 'score 50000 reaches max tier 5');
}

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════
console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);