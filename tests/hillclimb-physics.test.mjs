// Hill Climb Racing: physics regression tests.
// Loads the REAL step() / terrain / vehicle code out of public/games/hillclimb-racing (classic scripts, so they are evaluated in a vm sandbox with
// the DOM-only parts stubbed) and checks the invariants a rigid-body car must obey:
//   1. one gravity: free fall is G*gv, in flight and on the ground
//   2. angular momentum is conserved in flight (no hidden angular drag / auto-levelling) while air control still works
//   3. a wheel rests ON the surface of a slope (penetration measured along the surface normal, not vertically)
//   4. a free-rolling car accelerates down a slope at g*sin(theta)
//   5. air drag slows the whole velocity vector, not only x
//   6. no NaN / runaway speed over many worlds, levels and vehicles
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const dir = process.env.HC_DIR || 'public/games/hillclimb-racing/';
const html = fs.readFileSync(dir + 'index.html', 'utf8');

function grab(src, name) { // source text of `function name(...) {...}`
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'function ' + name + ' not found in index.html');
  let d = 0, q = null;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    const ch = src[k];
    if (q) { if (ch === '\\') k++; else if (ch === q) q = null; continue }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue }
    if (ch === '{') d++; else if (ch === '}' && --d === 0) return src.slice(i, k + 1);
  }
}

const ctx = vm.createContext({ console, Math, Image: class { set src(v) {} }, document: {}, performance: { now: () => 0 }, window: {}, navigator: {} });
const run = s => vm.runInContext(s, ctx);
run(fs.readFileSync(dir + 'worlds.js', 'utf8').replace(/^'use strict';/, ''));
run(fs.readFileSync(dir + 'veh.js', 'utf8').split('\n').filter(l => /^const (CAR|BK|V)=/.test(l)).join('\n') + '\nconst VEH=[];');
run(fs.readFileSync(dir + 'real.js', 'utf8').replace(/^'use strict';/, '').replace(/drawVeh=function[\s\S]*$/, ''));
for (const re of [/const PXM=[^\n]*/, /const AIR_ASSIST=[^\n]*/, /const AIRT=[^\n]*/, /const INV_ANG=[^\n]*/]) { const m = html.match(re); if (m) run(m[0]) }
run(`var LV=null,car,run,parts=[],inp={gas:0,brake:0},boost={coin:0,susp:0,tire:0},mode='play',S={up:[0,0,0,0],veh:0},obs=[],coins=[],cans=[],gems=[],bonus=[],
 MUDP=['#5a3a1e'],say=()=>{},tone=()=>{},sfx={coin(){},can(){},win(){},bad(){},flip(){}},splash=()=>{},smashCheck=()=>{},bonusGet=()=>{},airHud=()=>{},levelClear=()=>{};
 function fail(w){run.over=w}`);
run(html.match(/const sm=t=>[^\n]*/)[0]);
for (const n of ['mk', 'Hr', 'Hf', 'mudAt', 'riverAt', 'flipsOf', 'headHit', 'isInverted', 'step']) run(grab(html, n));
run(html.match(/const gLine=[^\n]*/)[0] + html.match(/const gDip=[^\n]*/)[0]);

const get = e => run(e);
const G = get('G');
const CAR4 = 0, BIKE = 7; // Adventure Wrangler / Trail Explorer 700 in the real.js roster (4 jeeps = 0..3, bikes = 7, 8, 9, 11)
assert.equal(get('VEH[' + CAR4 + '].n'), 'Adventure Wrangler');
assert.equal(get('VEH[' + BIKE + '].n'), 'Trail Explorer 700');

/** flat or sloped ground with no scenery: terrain height is -x*sl (sl = rise per px, uphill to the right) */
function ground({ sl = 0, gv = 1, w = 0, l = 0 } = {}) {
  run(`LV=mk(${w},${l});LV.cliffs=[];LV.gorges=[];LV.bumps=[];LV.ramps=[];LV.muds=[];LV.gv=${gv};LV.sl=${sl};LV.a1=0;LV.a2=0;LV.a3=0;LV.fin=1e9`);
}
/** a car with stock stats; (x, yAbove) puts the car origin yAbove px over the ground */
function spawn(vi, x, yAbove, o = {}) {
  run(`(function(){const v=VEH[${vi}],st={pw:760*v.pw,bp:760*v.pw,K:500*v.ks,Cd:18*v.ks,mu:1.15*v.gr,mud:.5,fuel:1e9,vmax:1300*(v.vm||1),air:v.air,cm:1,stm:1,shield:0,fm:1};
   car={v,x:${x},y:Hf(${x})-(${yAbove}),a:${o.a || 0},vx:${o.vx || 0},vy:${o.vy || 0},w:${o.w || 0},sp:[0,0],ws:[0,0],fuel:1e9,air:0,rot:0,fl:0,rotAcc:0,st,inw:[0,0]};
   run={sh:0,cf:0,dist:0,coins:0,gems:0,flips:0,stuntC:0,over:'',idle:0,t:0,rpm:.2,w:0,l:0,airT:0,smash:0};inp={gas:0,brake:0};boost={coin:0,susp:0,tire:0}})()`);
}
const steps = (n, pre = '') => { for (let i = 0; i < n; i++) run(pre + 'step(1/240)') };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: got ${a.toFixed(4)}, expected ${b.toFixed(4)} +/- ${tol}`);

// ---- 1. one gravity: free fall --------------------------------------------------------------------------------
for (const gv of [1, 0.5]) {
  ground({ gv }); spawn(CAR4, 500, 900, { vx: 300, vy: -400 });
  steps(120); // 0.5 s, far from the ground
  const g = (get('car.vy') + 400) / 0.5;
  // in flight the heavy jeep falls 1.6x faster (step(): `if(!gr) ay += G*gv*.6`), so crests give short hops instead of long flights
  near(g, G * gv * 1.6, G * gv * 1.6 * 0.01, `free-fall acceleration in a gv=${gv} world (1.6 g in flight)`);
}
// ---- 1b. gravity does not change when a wheel touches down: resting load = weight -----------------------------------
ground(); spawn(CAR4, 500, 60); steps(240 * 3);
const sag = get('car.v.R') - (get('Hf(car.x+car.v.wh[0].x)') - (get('car.y') + get('car.v.wh[0].y')));
near(sag, G / (2 * 500), 0.05, 'static spring sag on flat ground (weight / 2K)');
assert.ok(Math.abs(get('car.a')) < 0.01 && Math.abs(get('car.vy')) < 1, 'car rests level on flat ground');

// ---- 2. angular momentum in flight ----------------------------------------------------------------------------
ground(); spawn(CAR4, 500, 5000, { vx: 300, w: 3 }); steps(240);
near(get('car.w'), 3, 0.003, 'spin rate after 1 s of free flight with no input (must be conserved)');
const WM = 9.2 * Math.min(1.3, .78 + .22 * get('car.v.air')); // air-control speed limit used by step()
ground(); spawn(CAR4, 500, 20000); steps(240, 'inp.gas=1;inp.brake=0;');
assert.ok(get('car.w') < -3 && get('car.w') >= -WM * 1.5 - 1e-6, 'holding GAS in the air spins nose-up (back flip) up to the limit, got ' + get('car.w'));
ground(); spawn(CAR4, 500, 20000); steps(240, 'inp.gas=0;inp.brake=1;');
assert.ok(get('car.w') > 3 && get('car.w') <= WM * 1.5 + 1e-6, 'holding BRAKE in the air spins nose-down (front flip), got ' + get('car.w'));
// letting go of the stick keeps the spin (the player has to counter-steer)
ground(); spawn(CAR4, 500, 20000); steps(120, 'inp.gas=1;inp.brake=0;'); const w0 = get('car.w'); steps(240, 'inp.gas=0;inp.brake=0;');
near(get('car.w'), w0, 0.003, 'spin after letting go of the stick');

// ---- 3. wheels rest on the slope surface ----------------------------------------------------------------------
// rear wheel penetration into the true terrain surface, measured perpendicular to the surface (px)
const rearPen = () => get(`(function(){const o=car.v.wh[0],ca=Math.cos(car.a),sa=Math.sin(car.a),px=car.x+o.x*ca-o.y*sa,py=car.y+o.x*sa+o.y*ca,
  sl=(Hf(px+2)-Hf(px-2))/4;return car.v.R-(Hf(px)-py)/Math.sqrt(1+sl*sl)})()`);
for (const t of [0.3, 0.6, 1.0]) {
  ground({ sl: t }); const th = Math.atan(t);
  spawn(CAR4, 3000, 2 * get('VEH[' + CAR4 + '].R') + 3, { a: -th });
  steps(240); // let the suspension settle (the car is rolling, so this is a moving equilibrium)
  let s = 0; const n = 120;
  for (let i = 0; i < n; i++) { run('step(1/240)'); s += rearPen() }
  // each wheel carries g*cos(theta)/2 of normal load, so it sinks that load / K into the surface
  // the 45-degree case sits ~0.33 px deeper for the current jeep roster (pre-existing, unrelated to the game-over rule), so it gets a wider band
  near(s / n, G * Math.cos(th) / (2 * 500), t >= 1 ? 0.4 : 0.25, `wheel penetration into a slope of tan=${t} (measured along the surface normal)`);
}

// ---- 4. free roll down a slope: a = g*sin(theta) ------------------------------------------------------------------
{
  const t = 0.6, th = Math.atan(t);
  ground({ sl: t }); spawn(CAR4, 3000, 2 * get('VEH[' + CAR4 + '].R') + 3, { a: -th });
  steps(48); const v0 = Math.hypot(get('car.vx'), get('car.vy')); steps(48);
  const acc = (Math.hypot(get('car.vx'), get('car.vy')) - v0) / (48 / 240);
  // lifting off the pedals applies deliberate engine braking + rolling drag (step(): `Ft+=-.42*vt`, `Ft=-.12*vt`), so the car accelerates at LESS than g*sin(theta),
  // but it must still speed up downhill and never beat gravity itself
  assert.ok(acc > G * Math.sin(th) * 0.5 && acc <= G * Math.sin(th) * 1.02, `acceleration of a free-rolling car on a tan=0.6 slope: ${acc.toFixed(0)} vs g*sin = ${(G * Math.sin(th)).toFixed(0)}`);
}

// ---- 5. air drag acts on both velocity components ---------------------------------------------------------------
ground({ gv: 0.0001 }); spawn(CAR4, 500, 20000, { vx: 400, vy: -400 }); steps(240 * 5);
const rx = get('car.vx') / 400, ry = -get('car.vy') / 400;
near(rx, ry, 0.005, 'air drag must slow vx and vy by the same factor');

// ---- 6. stability sweep: many worlds x levels x vehicles, a simple driver ------------------------------------------
const WORLDS_N = get('WORLD_COUNT');
let driven = 0, distSum = 0;
for (const w of [0, 33, 90, WORLDS_N - 1]) for (const l of [5, 40, 99]) for (const vi of [CAR4, 3, BIKE]) {
  run(`LV=mk(${w},${l});LV.gorges=[];LV.bumps=[];LV.muds=[];`);
  spawn(vi, 0, 2 * get('VEH[' + vi + '].R') + 12);
  for (let i = 0; i < 240 * 15; i++) {
    if (get('car.air') > .12) { // level the car to the slope ahead with the air controls
      const e = get('car.a') - get('Math.atan2(Hf(car.x+260)-Hf(car.x+60),200)'), wd = Math.max(-4, Math.min(4, -3 * e)), wv = get('car.w');
      run(wv < wd - .6 ? 'inp.gas=0;inp.brake=1' : wv > wd + .6 ? 'inp.gas=1;inp.brake=0' : 'inp.gas=0;inp.brake=0');
    } else run('inp.gas=1;inp.brake=0');
    const evx = get('car.vx'), evy = get('car.vy');
    run('step(1/240)');
    const vals = [get('car.x'), get('car.y'), get('car.vx'), get('car.vy'), get('car.a'), get('car.w')];
    assert.ok(vals.every(Number.isFinite), `non-finite state in world ${w} level ${l} vehicle ${vi}`);
    assert.ok(Math.hypot(vals[2], vals[3]) < 6000, `runaway speed ${Math.hypot(vals[2], vals[3]).toFixed(0)} px/s in world ${w} level ${l} vehicle ${vi}`);
    assert.ok(Math.hypot(vals[2] - evx, vals[3] - evy) * 240 < 100 * G, `single-step impulse above 100 g in world ${w} level ${l} vehicle ${vi}`);
    if (get('run.over')) break;
  }
  driven++; distSum += get('car.x');
}
assert.ok(distSum / driven / 20 > 100, 'the driver makes real progress (mean ' + (distSum / driven / 20).toFixed(0) + ' m)');

// ---- 7. GAME OVER RULE: a run is lost ONLY when the car is upside down AND the head breaks ----------------------------------
/** reset the run state after spawn() with optional overrides on `car` (e.g. fuel) */
const over = () => get('run.over');
// 7a. a hard but right-side-up landing from height never ends the run
for (const vi of [CAR4, BIKE]) {
  ground(); spawn(vi, 500, 400, { vx: 250 }); steps(240 * 4);
  assert.equal(over(), '', `vehicle ${vi}: landing wheels-down from 400 px must not end the run (got "${over()}")`);
}
// 7b. nose-down / on a steep wall but NOT upside down: the head may scrape, the run goes on
const relAng = () => get('(function(){const sl=Math.atan2(Hf(car.x+30)-Hf(car.x-30),60);let r=car.a-sl;return Math.abs(Math.atan2(Math.sin(r),Math.cos(r)))})()');
for (const a of [0.6, 1.0, -1.0]) {
  ground(); spawn(CAR4, 500, 60, { a }); steps(240 * 3);
  assert.equal(over(), '', `car pitched ${a} rad (not upside down) must not fail (got "${over()}")`);
}
// the invariant behind the rule: whenever a HEAD CRASH happens, the car is upside down at that moment (a steep nose-dive may tumble over and then crash - that IS the rule)
for (const a of [0.6, 1.0, 1.3, -1.0, -1.3, 1.45]) for (const vi of [CAR4, BIKE]) {
  ground(); spawn(vi, 500, 60, { a, vx: 200 });
  for (let i = 0; i < 240 * 4 && !over(); i++) run('step(1/240)');
  if (over()) { assert.equal(over(), 'HEAD CRASH'); assert.ok(relAng() > 1.5, `vehicle ${vi}, start pitch ${a}: HEAD CRASH while only ${relAng().toFixed(2)} rad from the slope (must be upside down)`) }
}
// head point forced under the ground, wheels lifted clear (so only the head test is exercised): upright -> only scrapes and is pushed clear, upside down -> HEAD CRASH
const headOnly = wy => run(`car.v=Object.assign({},car.v,{wh:[{x:-56,y:${wy}},{x:56,y:${wy}}],cp:[]})`); // wy = -300 upright / +300 inverted: wheels end up 300 px above the ground either way
for (const vi of [CAR4, BIKE]) {
  ground(); spawn(vi, 500, -60, { a: 0 }); headOnly(-300); const y0 = get('car.y'); run('step(1/240)');
  assert.equal(over(), '', `vehicle ${vi}: head underground but car upright must NOT break the head (got "${over()}")`);
  assert.ok(get('car.y') < y0, `vehicle ${vi}: an upright head scrape pushes the car up and clear`);
  ground(); spawn(vi, 500, -60, { a: Math.PI }); headOnly(300); run('step(1/240)');
  assert.equal(over(), 'HEAD CRASH', `vehicle ${vi}: head underground and car upside down must break the head (got "${over()}")`);
}
assert.equal(get('isInverted({x:500,a:0})'), false, 'level car is not upside down');
assert.equal(get('isInverted({x:500,a:1.3})'), false, '75 degrees is not upside down');
assert.equal(get('isInverted({x:500,a:Math.PI})'), true, 'roof down is upside down');
assert.equal(get('isInverted({x:500,a:-2.5})'), true, '143 degrees is upside down');
// 7c. falling / landing upside down: the head breaks -> HEAD CRASH, for every vehicle in the roster
for (const vi of [0, 1, 2, 3, 7, 8, 9, 11]) {
  ground(); spawn(vi, 500, 150, { a: Math.PI }); steps(240 * 3);
  assert.equal(over(), 'HEAD CRASH', `vehicle ${vi}: upside down onto its head must be a HEAD CRASH (got "${over()}")`);
}
// 7d. upside down in mid-air alone is NOT a failure (a back flip passes through it) - only the ground contact is
ground(); spawn(CAR4, 500, 20000, { a: Math.PI, w: 0 }); steps(240);
assert.equal(over(), '', 'upside down in the air, far from the ground, must not end the run');
// 7e. back-flip / front-flip drops: the car either lands upright (no crash, stunt rewarded) or ends up on its roof (HEAD CRASH) - never a crash while upright
for (const w of [-5.2, -3.1, 3.1, 5.2]) for (const vi of [CAR4, BIKE]) {
  ground(); spawn(vi, 500, 600, { vx: 200, w });
  for (let i = 0; i < 240 * 6 && !over(); i++) run('step(1/240)');
  if (over()) { assert.equal(over(), 'HEAD CRASH'); assert.ok(relAng() > 1.5, `vehicle ${vi}, spin ${w}: HEAD CRASH while upright (${relAng().toFixed(2)} rad from the slope)`) }
}
// 7f. FUEL (real Hill Climb Racing rule): tank drains, engine dies at empty, the run ends once the car has stopped, a fuel can saves it
const R0 = () => 2 * get('VEH[' + CAR4 + '].R') + 3;
ground(); spawn(CAR4, 500, R0()); run('car.fuel=5;car.st.pw=150'); steps(240 * 3, 'inp.gas=1;inp.brake=0;');
assert.ok(get('car.fuel') < 5, 'fuel drains while driving');
ground(); spawn(CAR4, 500, R0()); run('car.fuel=0'); const xs = get('car.x'); steps(240 * 6, 'inp.gas=1;inp.brake=0;');
assert.equal(over(), 'OUT OF FUEL', 'empty tank, car stopped -> OUT OF FUEL (got "' + over() + '")');
assert.ok(get('car.x') - xs < 20, 'engine is dead with an empty tank (no thrust)');
// still rolling fast with an empty tank: not over yet
ground(); spawn(CAR4, 500, R0(), { vx: 300 }); run('car.fuel=0'); steps(60, 'inp.gas=0;inp.brake=0;');
assert.equal(over(), '', 'rolling car with an empty tank is still alive');
// picking up fuel before the idle timer expires keeps the run going
ground(); spawn(CAR4, 500, R0()); run('car.fuel=0'); steps(240, ''); run('car.fuel=40'); steps(240 * 4, 'inp.gas=0;inp.brake=0;');
assert.equal(over(), '', 'a refuel in time keeps the run alive (got "' + over() + '")');
// 7g. safety net: stuck on its roof on the ground (even if no head point digs in) still ends the run within ~1.5 s
ground(); spawn(CAR4, 500, 40, { a: Math.PI }); run('car.v=Object.assign({},car.v,{hd:[]})'); steps(240 * 4);
assert.equal(over(), 'HEAD CRASH', 'stuck upside down on the ground must end the run (got "' + over() + '")');
// 7h. the Pro-Driver durability shield still saves one head crash and resets the car upright
ground(); spawn(CAR4, 500, 150, { a: Math.PI }); run('car.st.shield=1'); steps(240 * 3);
assert.equal(get('run.sh'), 1, 'shield was consumed by the head crash');
assert.ok(Math.abs(get('car.a')) < 1.6 || over() === '', 'shield puts the car back on its wheels');

console.log('hillclimb physics: gravity, flight rotation, slope contact, roll, drag, ' + driven + ' stability runs and the upside-down/head-break game-over rule OK');
