/* AFRICA UNLIMITED - phys.js
   Arcade physics for the SUV and the on-foot explorer. Pure functions: the game passes an env with
   h(x,z) ground height, water(x,z) and solid(x,z) (inside a building). Forward = (-sin yaw, -cos yaw). */
const G = 9.81;

export function createCar() {
  return { x: 0, z: 0, y: 0, yaw: 0, vx: 0, vz: 0, vy: 0, steer: 0, pitch: 0, roll: 0, grounded: true, nitro: 1, wheel: 0, hit: 0, water: false, speed: 0 };
}

export function stepCar(c, inp, dt, env) {
  const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw);
  const fx = -sy, fz = -cy, rx = cy, rz = -sy;
  let vf = c.vx * fx + c.vz * fz, vl = c.vx * rx + c.vz * rz;
  const L = 2.8, hF = env.h(c.x + fx * L / 2, c.z + fz * L / 2), hB = env.h(c.x - fx * L / 2, c.z - fz * L / 2);
  const sl = (hF - hB) / L, sinS = sl / Math.sqrt(1 + sl * sl);
  c.water = env.water(c.x, c.z);
  const thr = inp.my, boost = !!inp.boost && c.nitro > 0.02 && thr > 0;
  let acc = 0;
  if (thr > 0) {
    acc = thr * 18 * Math.max(0, 1 - Math.max(vf, 0) / (boost ? 52 : 46));
    if (vf < -0.5) acc += 22;
    if (boost) { acc += 6; c.nitro = Math.max(0, c.nitro - dt * 0.22); }
  } else if (thr < 0) {
    acc = vf > 0.6 ? thr * 30 : thr * 9 * Math.max(0, 1 - (-vf) / 14);
  }
  if (!boost) c.nitro = Math.min(1, c.nitro + dt * 0.07);
  if (c.grounded) acc -= G * sinS;
  acc -= vf * (c.water ? 0.9 : 0.08) + vf * Math.abs(vf) * 0.0011;
  if (inp.hand) acc -= Math.sign(vf) * Math.min(Math.abs(vf) / dt, 5);
  vf += acc * dt;
  if (thr === 0 && !inp.hand && Math.abs(vf) < 0.35) vf *= 0.85;
  vl *= Math.exp(-(inp.hand ? 1.1 : (c.water ? 2.5 : 7.5)) * dt);

  c.steer += (inp.mx - c.steer) * Math.min(1, dt * 9);
  const sp = Math.abs(vf);
  let yr = c.steer * 1.7 * Math.min(1, sp / 3.5) / (1 + sp / 15) * (vf >= 0 ? 1 : -1) * (inp.hand ? 1.5 : 1);
  if (!c.grounded) yr *= 0.2;
  c.yaw -= yr * dt;
  const nfx = -Math.sin(c.yaw), nfz = -Math.cos(c.yaw), nrx = Math.cos(c.yaw), nrz = -Math.sin(c.yaw);
  c.vx = nfx * vf + nrx * vl; c.vz = nfz * vf + nrz * vl;

  const ox = c.x, oz = c.z;
  c.x += c.vx * dt; c.z += c.vz * dt; c.hit = 0;
  if (env.solid) {
    const pf = 2.2;
    if (env.solid(c.x, c.z) || env.solid(c.x + nfx * pf, c.z + nfz * pf) || env.solid(c.x - nfx * pf, c.z - nfz * pf)) {
      c.x = ox; c.z = oz; c.hit = Math.abs(vf) < 2.5 ? 0 : Math.min(1, Math.abs(vf) / 15);
      vf *= -0.3; c.vx = nfx * vf; c.vz = nfz * vf;
    }
  }
  const gh = env.h(c.x, c.z) - (c.water ? 0.5 : 0);
  const ny = c.y + c.vy * dt; c.vy -= G * dt;
  if (ny <= gh + 0.12) {
    if (!c.grounded && c.vy < -9) c.hit = Math.max(c.hit, 0.6);
    c.vy = Math.max(-25, Math.min(30, (gh - c.y) / dt)) * 0.5;
    c.y = gh; c.grounded = true;
  } else { c.y = ny; c.grounded = false; }

  const Wd = 1.0, Lw = 1.35;
  const hFR = env.h(c.x + nfx * Lw + nrx * Wd, c.z + nfz * Lw + nrz * Wd), hFL = env.h(c.x + nfx * Lw - nrx * Wd, c.z + nfz * Lw - nrz * Wd);
  const hBR = env.h(c.x - nfx * Lw + nrx * Wd, c.z - nfz * Lw + nrz * Wd), hBL = env.h(c.x - nfx * Lw - nrx * Wd, c.z - nfz * Lw - nrz * Wd);
  let pT = Math.atan((hFR + hFL - hBR - hBL) / 2 / (2 * Lw)), rT = Math.atan(((hFR + hBR) - (hFL + hBL)) / 2 / (2 * Wd));
  if (!c.grounded) { pT = Math.atan2(c.vy, Math.max(8, Math.abs(vf))); rT = 0; }
  const k = Math.min(1, dt * 8);
  c.pitch += (pT - c.pitch) * k; c.roll += (rT - c.roll) * k;
  c.speed = vf; c.wheel += vf * dt / 0.46;
}

export function createPerson() {
  return { x: 0, z: 0, y: 0, yaw: 0, vx: 0, vz: 0, vy: 0, grounded: true, anim: 0, water: false, speed: 0 };
}

export function stepFoot(p, inp, dt, env, camYaw) {
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  let dx = rx * inp.mx + fx * inp.my, dz = rz * inp.mx + fz * inp.my;
  const m = Math.hypot(dx, dz), mag = Math.min(1, m);
  if (m > 0) { dx /= m; dz /= m; }
  p.water = env.water(p.x, p.z);
  const top = (inp.boost ? 6.8 : 2.7) * (p.water ? 0.45 : 1) * mag;
  const k = Math.min(1, dt * (p.grounded ? 10 : 2));
  p.vx += (dx * top - p.vx) * k; p.vz += (dz * top - p.vz) * k;
  if (mag > 0.1) {
    let d = Math.atan2(-dx, -dz) - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    p.yaw += d * Math.min(1, dt * 12);
  }
  let nx = p.x + p.vx * dt, nz = p.z + p.vz * dt;
  if (env.solid && env.solid(nx, nz)) {
    if (!env.solid(nx, p.z)) nz = p.z; else if (!env.solid(p.x, nz)) nx = p.x; else { nx = p.x; nz = p.z; }
  }
  if (p.grounded && env.h(nx, nz) - p.y > 0.9) { nx = p.x; nz = p.z; }
  p.x = nx; p.z = nz;
  const gh = env.h(p.x, p.z) - (p.water ? 0.9 : 0);
  if (inp.jump && p.grounded && !p.water) { p.vy = 5.4; p.grounded = false; }
  if (p.grounded && p.vy <= 0 && Math.abs(p.y - gh) < 0.5) { p.y = gh; p.vy = 0; }
  else { p.vy -= 14 * dt; p.y += p.vy * dt; if (p.y <= gh) { p.y = gh; p.vy = 0; p.grounded = true; } else p.grounded = false; }
  p.speed = Math.hypot(p.vx, p.vz); p.anim += p.speed * dt * 1.8;
}
