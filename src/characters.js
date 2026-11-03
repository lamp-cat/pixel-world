// 小人：方块拼成的低模人物/猫狗 + 程序化动画；NPC 习惯循环；玩家 + 跟随者
import * as THREE from 'three';
import { toon } from './materials.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const M = (c) => toon(c, { noise: 0.03 });
function part(parent, w, h, d, c, x, y, z) {
  const m = new THREE.Mesh(BOX, M(c)); m.scale.set(w, h, d); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const lerpA = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };

export function makeHuman(o) {
  const { skin = 0xd6a27a, shirt, pants, shoes = 0x2b2622, hair = 0x3a2a22, hat = null, hatCol = 0xc9a85a, pack = null, scarf = null, s = 1.05, coat = null } = o;
  const root = new THREE.Group();
  const body = grp(root); body.scale.setScalar(s);
  const hips = grp(body, 0, 0.8, 0);
  const legs = [-1, 1].map((sd) => {
    const hip = grp(hips, sd * 0.11, 0, 0);
    part(hip, 0.18, 0.36, 0.2, pants, 0, -0.18, 0);
    const knee = grp(hip, 0, -0.36, 0);
    part(knee, 0.17, 0.32, 0.19, pants, 0, -0.16, 0);
    part(knee, 0.19, 0.11, 0.28, shoes, 0, -0.37, 0.04);
    return { hip, knee };
  });
  const torso = grp(hips);
  part(torso, 0.46, 0.6, 0.3, shirt, 0, 0.3, 0);
  if (coat) part(torso, 0.48, 0.22, 0.32, coat, 0, 0.02, 0);
  part(torso, 0.4, 0.1, 0.24, pants, 0, -0.02, 0);
  const head = grp(torso, 0, 0.62, 0);
  part(head, 0.3, 0.3, 0.3, skin, 0, 0.15, 0);
  part(head, 0.32, 0.1, 0.32, hair, 0, 0.27, -0.01);
  part(head, 0.32, 0.2, 0.1, hair, 0, 0.17, -0.12);
  if (hat === 'straw') { part(head, 0.62, 0.05, 0.62, hatCol, 0, 0.32, 0); part(head, 0.32, 0.14, 0.32, hatCol, 0, 0.4, 0); }
  if (hat === 'beanie') { part(head, 0.33, 0.16, 0.33, hatCol, 0, 0.33, -0.01); }
  if (hat === 'cap') { part(head, 0.33, 0.1, 0.33, hatCol, 0, 0.32, 0); part(head, 0.26, 0.04, 0.16, hatCol, 0, 0.28, 0.21); }
  if (hat === 'hood') { part(head, 0.36, 0.22, 0.36, hatCol, 0, 0.27, -0.02); part(head, 0.36, 0.3, 0.1, hatCol, 0, 0.14, -0.15); }
  let scarfTail = null;
  if (scarf) { part(torso, 0.4, 0.1, 0.34, scarf, 0, 0.6, 0); scarfTail = grp(torso, 0.1, 0.6, -0.16); part(scarfTail, 0.1, 0.06, 0.4, scarf, 0, 0, -0.2); }
  if (pack) { part(torso, 0.36, 0.42, 0.18, pack, 0, 0.32, -0.22); part(torso, 0.3, 0.12, 0.2, 0x4a3e2e, 0, 0.58, -0.22); }
  const arms = [-1, 1].map((sd) => {
    const sh = grp(torso, sd * 0.3, 0.55, 0);
    part(sh, 0.13, 0.5, 0.15, coat || shirt, 0, -0.24, 0);
    part(sh, 0.12, 0.1, 0.12, skin, 0, -0.53, 0);
    const hand = grp(sh, 0, -0.55, 0);
    return { sh, hand };
  });
  return { kind: 'human', root, body, hips, torso, head, legs, arms, scarfTail, props: {}, s };
}

export function makeAnimal({ col, col2, s = 1, dog = false }) {
  const root = new THREE.Group();
  const body = grp(root); body.scale.setScalar(s);
  const trunk = grp(body, 0, 0.26, 0);
  part(trunk, 0.22, 0.2, 0.5, col, 0, 0, 0);
  if (col2) part(trunk, 0.2, 0.05, 0.3, col2, 0, -0.1, 0.02);
  const head = grp(trunk, 0, 0.1, 0.27);
  part(head, 0.22, 0.2, 0.2, col, 0, 0.04, 0.04);
  if (dog) { part(head, 0.14, 0.1, 0.14, col2 || col, 0, -0.01, 0.17); part(head, 0.06, 0.14, 0.08, 0x5a3a26, -0.12, 0.02, 0.02); part(head, 0.06, 0.14, 0.08, 0x5a3a26, 0.12, 0.02, 0.02); }
  else { part(head, 0.06, 0.08, 0.05, col, -0.07, 0.17, 0.03); part(head, 0.06, 0.08, 0.05, col, 0.07, 0.17, 0.03); }
  const legs = [[-0.07, 0.2], [0.07, 0.2], [-0.07, -0.2], [0.07, -0.2]].map(([x, z]) => { const g = grp(trunk, x, -0.08, z); part(g, 0.06, 0.2, 0.06, col, 0, -0.09, 0); return g; });
  const tail = grp(trunk, 0, 0.06, -0.25);
  part(tail, 0.05, 0.05, dog ? 0.22 : 0.32, col, 0, 0.0, -0.13);
  return { kind: dog ? 'dog' : 'cat', root, body, trunk, head, legs, tail, props: {}, s };
}

// ---------- 道具 ----------
function prop(f, name, hand, build) { const g = grp(f.arms[hand].hand); build(g); g.visible = false; f.props[name] = g; return g; }
export function addProps(f, list) {
  for (const p of list) {
    if (p === 'shovel') prop(f, p, 1, (g) => { part(g, 0.05, 0.05, 1.2, 0x6b4a30, 0, 0, 0.25); part(g, 0.2, 0.04, 0.26, 0x8a8e92, 0, 0, 0.92); g.rotation.x = 0.6; });
    if (p === 'can') prop(f, p, 1, (g) => { part(g, 0.2, 0.22, 0.26, 0x5f8f9a, 0, -0.08, 0.05); part(g, 0.05, 0.05, 0.25, 0x5f8f9a, 0, -0.02, 0.3); });
    if (p === 'ladle') prop(f, p, 1, (g) => { part(g, 0.04, 0.04, 0.6, 0x8a8e92, 0, 0, 0.25); });
    if (p === 'rod') prop(f, p, 1, (g) => { part(g, 0.04, 0.04, 2.4, 0x5a4030, 0, 0, 1.1); const tip = grp(g, 0, 0, 2.3); f.props.tip = tip; g.rotation.x = 0.5; });
    if (p === 'binoc') prop(f, p, 0, (g) => { part(g, 0.24, 0.1, 0.14, 0x2a2a2e, 0.15, 0.02, 0.04); });
    if (p === 'book') prop(f, p, 1, (g) => { part(g, 0.26, 0.04, 0.2, 0x8a3a3a, -0.12, 0.02, 0.06); part(g, 0.24, 0.045, 0.18, 0xe8e0d0, -0.12, 0.04, 0.06); });
    if (p === 'bag') prop(f, p, 0, (g) => { part(g, 0.24, 0.28, 0.16, 0x7a6a4a, 0, -0.16, 0); });
  }
}
const showProps = (f, names) => { for (const k in f.props) if (k !== 'tip') f.props[k].visible = names.includes(k); };

// ---------- 姿势 ----------
function resetH(f) {
  f.hips.position.y = 0.8; f.hips.rotation.set(0, 0, 0); f.torso.rotation.set(0, 0, 0); f.head.rotation.set(0, 0, 0);
  for (const l of f.legs) { l.hip.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); }
  f.arms.forEach((a, i) => a.sh.rotation.set(0, 0, (i ? -1 : 1) * 0.06));
  if (f.scarfTail) f.scarfTail.rotation.set(0, 0, 0);
}
export function poseHuman(f, anim, t, k = 1) {
  resetH(f);
  const [L, Rr] = f.legs, [AL, AR] = f.arms;
  const breathe = Math.sin(t * 1.9) * 0.025;
  const sit = (thigh = -1.5, knee = 1.45) => { f.hips.position.y = 0.06; L.hip.rotation.x = Rr.hip.rotation.x = thigh; L.knee.rotation.x = Rr.knee.rotation.x = knee; };
  switch (anim) {
    case 'walk': case 'run': {
      const ph = t, a = anim === 'run' ? 1.15 : 0.85;
      L.hip.rotation.x = Math.sin(ph) * 0.65 * a; Rr.hip.rotation.x = -Math.sin(ph) * 0.65 * a;
      L.knee.rotation.x = Math.max(0, -Math.sin(ph - 0.9)) * 0.9 * a; Rr.knee.rotation.x = Math.max(0, Math.sin(ph - 0.9)) * 0.9 * a;
      AL.sh.rotation.x = -Math.sin(ph) * 0.55 * a; AR.sh.rotation.x = Math.sin(ph) * 0.55 * a;
      f.hips.position.y = 0.8 + Math.abs(Math.cos(ph)) * 0.05 - 0.02;
      f.torso.rotation.x = 0.07 * a; f.torso.rotation.y = Math.sin(ph) * 0.08;
      if (f.scarfTail) f.scarfTail.rotation.set(0.25 + Math.sin(ph * 2) * 0.25, Math.sin(ph * 1.3) * 0.4, 0);
      break;
    }
    case 'dig': {
      const c = Math.sin(t * 2.6), d = Math.max(0, c);
      L.hip.rotation.x = -0.35; L.knee.rotation.x = 0.5; Rr.hip.rotation.x = 0.25; f.hips.position.y = 0.74;
      f.torso.rotation.x = 0.35 + 0.35 * d; AR.sh.rotation.x = -0.9 - 0.7 * c; AL.sh.rotation.x = -0.7 - 0.7 * c; AL.sh.rotation.z = -0.35; AR.sh.rotation.z = 0.1;
      f.head.rotation.x = 0.2; break;
    }
    case 'water': {
      f.torso.rotation.x = 0.22 + breathe; AR.sh.rotation.x = -1.05 + Math.sin(t * 1.3) * 0.08; AL.sh.rotation.x = -0.2; f.head.rotation.x = 0.35;
      if (f.props.can) f.props.can.rotation.x = 0.55 + Math.sin(t * 1.3) * 0.12; break;
    }
    case 'refill': { AR.sh.rotation.x = -0.75; AL.sh.rotation.x = -0.6; f.torso.rotation.x = 0.1; f.head.rotation.x = 0.2; break; }
    case 'stir': {
      f.torso.rotation.x = 0.16 + breathe; AR.sh.rotation.x = -1.0 + Math.sin(t * 4) * 0.18; AR.sh.rotation.z = Math.cos(t * 4) * 0.22; AL.sh.rotation.x = -0.35; f.head.rotation.x = 0.3; break;
    }
    case 'warm': {
      AL.sh.rotation.x = AR.sh.rotation.x = -1.15 + Math.sin(t * 2) * 0.06; AL.sh.rotation.z = -0.3; AR.sh.rotation.z = 0.3; f.head.rotation.x = 0.15; f.torso.rotation.x = 0.1 + breathe; break;
    }
    case 'pick': {
      f.hips.position.y = 0.66; L.hip.rotation.x = -0.9; L.knee.rotation.x = 1.3; Rr.hip.rotation.x = -0.5; Rr.knee.rotation.x = 1.2;
      f.torso.rotation.x = 0.85; AL.sh.rotation.x = AR.sh.rotation.x = -0.9 + Math.sin(t * 3) * 0.2; f.head.rotation.x = 0.2; break;
    }
    case 'fish': case 'reel': {
      sit(-1.45, 1.0 + Math.sin(t * 1.4) * 0.25); Rr.knee.rotation.x = 1.0 + Math.sin(t * 1.4 + 1.6) * 0.25;
      const jerk = anim === 'reel' ? Math.max(0, Math.sin(t * 5)) : 0;
      AR.sh.rotation.x = -1.05 - jerk * 0.7; AL.sh.rotation.x = -0.95 - jerk * 0.5; AL.sh.rotation.z = -0.3;
      f.torso.rotation.x = 0.12 + breathe - jerk * 0.15; f.head.rotation.x = 0.2; f.head.rotation.y = Math.sin(t * 0.3) * 0.25;
      if (f.props.rod) f.props.rod.rotation.x = 0.35 - jerk * 0.3; break;
    }
    case 'read': {
      sit(-1.45, 1.25); f.torso.rotation.x = -0.12 + breathe; AL.sh.rotation.x = AR.sh.rotation.x = -0.9; AL.sh.rotation.z = -0.25; AR.sh.rotation.z = 0.25;
      f.head.rotation.x = 0.45; if (Math.sin(t * 0.9) > 0.92) AR.sh.rotation.z = 0.6; break;
    }
    case 'stretch': { sit(-1.45, 1.25); const u = Math.sin(Math.min(1, t * 0.8) * Math.PI); AL.sh.rotation.x = AR.sh.rotation.x = -0.9 - 2.0 * u; f.torso.rotation.x = -0.12 - 0.15 * u; f.head.rotation.x = -0.3 * u; break; }
    case 'binoc': {
      AL.sh.rotation.x = AR.sh.rotation.x = -2.35; AL.sh.rotation.z = -0.55; AR.sh.rotation.z = 0.55; f.head.rotation.x = -0.05; f.torso.rotation.y = Math.sin(t * 0.5) * 0.45; f.torso.rotation.x = breathe; break;
    }
    default: { // idle
      f.torso.rotation.x = breathe; f.head.rotation.y = Math.sin(t * 0.35) * 0.35 * k; f.head.rotation.x = Math.sin(t * 0.21) * 0.06;
      AL.sh.rotation.x = Math.sin(t * 1.9) * 0.03; AR.sh.rotation.x = Math.sin(t * 1.9 + 0.5) * 0.03;
      if (f.scarfTail) f.scarfTail.rotation.set(0.1 + Math.sin(t * 2.3) * 0.1, Math.sin(t * 1.1) * 0.2, 0);
    }
  }
}
export function poseAnimal(f, anim, t) {
  f.trunk.rotation.set(0, 0, 0); f.trunk.position.y = 0.26; f.head.rotation.set(0, 0, 0); f.tail.rotation.set(0, 0, 0);
  f.legs.forEach((l) => l.rotation.set(0, 0, 0));
  const wag = f.kind === 'dog' ? 9 : 2;
  if (anim === 'walk') {
    f.legs.forEach((l, i) => { l.rotation.x = Math.sin(t + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.7; });
    f.trunk.position.y = 0.26 + Math.abs(Math.sin(t)) * 0.02; f.tail.rotation.x = 0.6 + Math.sin(t * 0.5) * 0.1; f.tail.rotation.y = Math.sin(t * wag * 0.3) * 0.5;
  } else if (anim === 'sit') {
    f.trunk.rotation.x = -0.45; f.trunk.position.y = 0.2; f.legs[2].rotation.x = 0.9; f.legs[3].rotation.x = 0.9; f.legs[0].rotation.x = 0.45; f.legs[1].rotation.x = 0.45;
    f.head.rotation.x = 0.4; f.head.rotation.y = Math.sin(t * 0.4) * 0.5; f.tail.rotation.x = -0.2; f.tail.rotation.y = Math.sin(t * wag) * 0.6;
  } else if (anim === 'groom') {
    f.trunk.rotation.x = -0.45; f.trunk.position.y = 0.2; f.legs[2].rotation.x = 0.9; f.legs[3].rotation.x = 0.9; f.legs[0].rotation.x = -0.6 + Math.sin(t * 5) * 0.3;
    f.head.rotation.x = 0.9 + Math.sin(t * 5) * 0.15; f.head.rotation.y = 0.3; f.tail.rotation.y = Math.sin(t * 2) * 0.4;
  } else { f.tail.rotation.x = 0.3; f.tail.rotation.y = Math.sin(t * wag) * 0.5; f.head.rotation.y = Math.sin(t * 0.5) * 0.4; }
}
const pose = (f, anim, t, k) => (f.kind === 'human' ? poseHuman(f, anim, t, k) : poseAnimal(f, anim === 'pick' ? 'groom' : anim, t));

// ---------- 演员 ----------
class Actor {
  constructor(fig, x, y, z, speed = 1.3) { this.fig = fig; this.pos = new THREE.Vector3(x, y, z); this.face = 0; this.speed = speed; this.t = Math.random() * 10; this.walkPh = 0; this.anim = 'idle'; this.at = 0; }
  apply(dt) {
    this.fig.root.position.copy(this.pos);
    this.fig.root.rotation.y = this.face;
    pose(this.fig, this.anim, this.anim === 'walk' || this.anim === 'run' ? this.walkPh : this.at, 1);
  }
}

export class NPC extends Actor {
  constructor(fig, world, steps, start, opt = {}) {
    super(fig, start[0], start[1] ?? world.heightAt(start[0], start[2]), start[2], opt.speed || 1.2);
    Object.assign(this, { world, steps, i: 0, timer: 0, props: opt.props || {} });
    this.stride = opt.stride || 3.6;
  }
  update(dt) {
    const s = this.steps[this.i];
    this.t += dt; this.at += dt;
    const next = () => { this.i = (this.i + 1) % this.steps.length; this.timer = 0; this.at = 0; };
    if (s[0] === 'go') {
      const ty = s[2] ?? this.world.heightAt(s[1], s[3]);
      const d = new THREE.Vector3(s[1] - this.pos.x, ty - this.pos.y, s[3] - this.pos.z);
      const dist = Math.hypot(d.x, d.z);
      if (dist < 0.05) { next(); }
      else {
        const st = Math.min(dist, this.speed * dt);
        this.pos.x += (d.x / dist) * st; this.pos.z += (d.z / dist) * st; this.pos.y += d.y * (st / dist);
        this.face = lerpA(this.face, Math.atan2(d.x, d.z), Math.min(1, dt * 10));
        this.walkPh += st * this.stride; this.anim = 'walk';
        showProps(this.fig, this.props.walk || []);
      }
    } else if (s[0] === 'act') {
      const [, anim, dur, face] = s;
      if (this.anim !== anim) this.at = 0;
      this.anim = anim; this.timer += dt;
      if (face !== undefined) this.face = lerpA(this.face, face, Math.min(1, dt * 6));
      showProps(this.fig, this.props[anim] || []);
      if (this.timer >= dur) next();
    }
    this.apply(dt);
  }
}

export class Player extends Actor {
  constructor(fig, world, x, z) { super(fig, x, world.heightAt(x, z), z, 3.3); this.world = world; this.path = null; this.trail = [[x, z]]; this.moving = false; this.idleT = 0; }
  goTo(x, z) { const p = this.world.findPath(this.pos.x, this.pos.z, x, z); this.path = p && p.length ? p : null; return !!this.path; }
  update(dt, dir) {
    this.t += dt; this.at += dt;
    let mx = 0, mz = 0;
    if (dir && (dir.x || dir.z)) { this.path = null; mx = dir.x; mz = dir.z; }
    else if (this.path) {
      const [tx, tz] = this.path[0];
      const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.12) { this.path.shift(); if (!this.path.length) this.path = null; }
      else { mx = dx / d; mz = dz / d; }
    }
    const L = Math.hypot(mx, mz);
    if (L > 0) {
      mx /= L; mz /= L;
      const st = this.speed * dt, W = this.world;
      const nx = this.pos.x + mx * st, nz = this.pos.z + mz * st;
      let moved = false;
      if (!W.blocked(nx, nz)) { this.pos.x = nx; this.pos.z = nz; moved = true; }
      else if (!W.blocked(nx, this.pos.z)) { this.pos.x = nx; moved = true; }
      else if (!W.blocked(this.pos.x, nz)) { this.pos.z = nz; moved = true; }
      if (moved) { this.walkPh += st * 3.2; this.anim = 'walk'; this.face = lerpA(this.face, Math.atan2(mx, mz), Math.min(1, dt * 12)); this.idleT = 0; }
      else { this.anim = 'idle'; if (this.path) this.path = null; }
      this.moving = moved;
    } else { if (this.anim !== 'idle') this.at = 0; this.anim = 'idle'; this.moving = false; this.idleT += dt; }
    const gy = this.world.heightAt(this.pos.x, this.pos.z);
    this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 14);
    const last = this.trail[this.trail.length - 1];
    if (Math.hypot(last[0] - this.pos.x, last[1] - this.pos.z) > 0.12) { this.trail.push([this.pos.x, this.pos.z]); if (this.trail.length > 400) this.trail.shift(); }
    this.apply(dt);
  }
}

export class Follower extends Actor {
  constructor(fig, world, leader, gap, speed = 3.6) { super(fig, leader.pos.x, leader.pos.y, leader.pos.z - gap, speed); Object.assign(this, { world, leader, gap }); this.pos.set(leader.pos.x - gap * 0.6, leader.pos.y, leader.pos.z - gap * 0.6); }
  update(dt) {
    this.t += dt; this.at += dt;
    const tr = this.leader.trail;
    let acc = Math.hypot(this.leader.pos.x - tr[tr.length - 1][0], this.leader.pos.z - tr[tr.length - 1][1]);
    let target = tr[0];
    for (let i = tr.length - 1; i > 0; i--) { acc += Math.hypot(tr[i][0] - tr[i - 1][0], tr[i][1] - tr[i - 1][1]); if (acc >= this.gap) { target = tr[i - 1]; break; } }
    const dx = target[0] - this.pos.x, dz = target[1] - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 0.08) {
      const sp = Math.min(this.speed * 1.4, Math.max(1.2, d * 3.5)), st = Math.min(d, sp * dt);
      this.pos.x += (dx / d) * st; this.pos.z += (dz / d) * st; this.walkPh += st * (this.fig.kind === 'human' ? 3.6 : 9);
      this.face = lerpA(this.face, Math.atan2(dx, dz), Math.min(1, dt * 10)); this.anim = 'walk';
    } else {
      if (this.anim === 'walk') this.at = 0;
      this.anim = this.fig.kind === 'dog' && this.at > 2.5 ? 'sit' : 'idle';
      const lx = this.leader.pos.x - this.pos.x, lz = this.leader.pos.z - this.pos.z;
      if (Math.hypot(lx, lz) > 0.3) this.face = lerpA(this.face, Math.atan2(lx, lz), Math.min(1, dt * 3));
    }
    const gy = this.world.heightAt(this.pos.x, this.pos.z);
    this.pos.y += (gy - this.pos.y) * Math.min(1, dt * 14);
    this.apply(dt);
  }
}

// ---------- 场景里的全部角色 ----------
export function spawnCast(scene, world) {
  const RY = world.roofY, BY = world.balconyY;
  const actors = [];
  const add = (a) => { scene.add(a.fig.root); actors.push(a); return a; };
  const PI = Math.PI;

  // 屋顶菜园的园丁
  const g = makeHuman({ shirt: 0x8ab85a, pants: 0x6a5240, hat: 'straw', hatCol: 0xd8bc6a, skin: 0xc98f6a });
  addProps(g, ['can']);
  const gardener = add(new NPC(g, world, [
    ['go', -7.7, RY, -19.0], ['act', 'water', 4.5, -PI / 2],
    ['go', -7.6, RY, -15.4], ['act', 'water', 4, -PI / 2],
    ['go', -6.3, RY, -16.3], ['act', 'refill', 2.2, 0],
    ['go', -6.3, RY, -17.9], ['act', 'water', 3.5, PI],
    ['act', 'idle', 2.5, PI / 4],
  ], [-7.7, RY, -18.0], { props: { water: ['can'], refill: ['can'], walk: ['can'] } }));
  // 油桶边煮饭的人
  const c = makeHuman({ shirt: 0xa8563a, pants: 0x39404a, hat: 'beanie', hatCol: 0x3a7a9a, coat: 0xc8623a, skin: 0xb07a58 });
  addProps(c, ['ladle']);
  const cook = add(new NPC(c, world, [
    ['act', 'stir', 6, -PI / 2], ['go', 13.6, null, -6.95], ['act', 'pick', 1.8, 0],
    ['go', 12.5, null, -8.1], ['act', 'stir', 5, -PI / 2], ['act', 'warm', 3.5, -PI / 2],
  ], [12.5, null, -8.1], { props: { stir: ['ladle'] } }));
  // 沙发上看书的人
  const r = makeHuman({ shirt: 0x7a6ac0, pants: 0x4a3c34, hair: 0x8a6a40, skin: 0xe0b08a, s: 1.0 });
  addProps(r, ['book']);
  const reader = add(new NPC(r, world, [['act', 'read', 9, PI / 2], ['act', 'stretch', 2.4, PI / 2]], [10.2, 0.55, -8.0], { props: { read: ['book'] } }));
  // 栈桥上钓鱼的老人
  const fz = makeHuman({ shirt: 0x6a7a6a, pants: 0x3a3a44, hat: 'cap', hatCol: 0xd8b040, hair: 0x9a9a9a, coat: 0x6e8e48, skin: 0xc69070 });
  addProps(fz, ['rod']);
  const fisher = add(new NPC(fz, world, [['act', 'fish', 11, 0], ['act', 'reel', 2.4, 0]], [-11.4, 0.12, 10.36], { props: { fish: ['rod'], reel: ['rod'] } }));
  // 翻废墟的拾荒者
  const sv = makeHuman({ shirt: 0xb08a4a, pants: 0x4a4038, hat: 'hood', hatCol: 0x9a6a3e, pack: 0x5a4a30, skin: 0xb88a68 });
  addProps(sv, ['shovel', 'bag']);
  const scav = add(new NPC(sv, world, [
    ['go', 15.0, null, 11.5], ['act', 'dig', 5, PI / 2], ['go', 13.5, null, 9.8], ['act', 'pick', 1.6, -PI / 2],
    ['go', 16.6, null, 9.9], ['act', 'dig', 4, 0], ['act', 'idle', 1.5, -0.6],
  ], [15.0, null, 11.5], { props: { dig: ['shovel'], walk: ['shovel'], pick: ['bag'], idle: ['shovel'] } }));
  // 外廊上巡逻的瞭望者
  const lk = makeHuman({ shirt: 0x4a6aa0, pants: 0x2e3238, hat: 'cap', hatCol: 0xb03a3a, pack: 0x3e4a3a, skin: 0xa8785a });
  addProps(lk, ['binoc']);
  const lookout = add(new NPC(lk, world, [
    ['go', 11.0, BY, -13.35], ['act', 'binoc', 3.2, 0.3], ['go', 20.0, BY, -13.35], ['act', 'binoc', 3.2, PI / 2 - 0.3], ['act', 'idle', 1.4, PI / 2],
  ], [15, BY, -13.35], { props: { binoc: ['binoc'] }, speed: 1.0 }));
  // 流浪猫
  const ct = makeAnimal({ col: 0xd8893a, col2: 0xf0e0c8, s: 1.2 });
  const cat = add(new NPC(ct, world, [
    ['go', 8.5, null, 13.2], ['act', 'sit', 3.5, 0.6], ['go', 12.0, null, 11.6], ['go', 10.5, null, 7.4], ['act', 'groom', 3, 2.0],
    ['go', 6.0, null, 8.0], ['go', 5.0, null, 2.2], ['act', 'sit', 3.0, -0.4], ['go', 6.2, null, 11.6],
  ], [6.2, null, 11.6], { speed: 1.1, stride: 9 }));

  // 玩家：围红围巾的旅人 + 黄雨衣小女孩 + 狗
  const hf = makeHuman({ shirt: 0x34908c, coat: 0x2f8a86, pants: 0x3b3a48, scarf: 0xd4402c, pack: 0x7a5f3a, hair: 0x2a1e18, skin: 0xd8a47c });
  const player = add(new Player(hf, world, 1.5, 9.0));
  const gf = makeHuman({ shirt: 0xe2b23a, pants: 0x4a5a78, hat: 'hood', hatCol: 0xe2b23a, skin: 0xe0b08a, s: 0.8 });
  const dg = makeAnimal({ col: 0xb08850, col2: 0xe8d8b8, s: 1.45, dog: true });
  const girl = add(new Follower(gf, world, player, 1.1));
  const dog = add(new Follower(dg, world, player, 2.0));

  // 鱼线 + 鱼漂
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xd8d4c8 }));
  line.layers.set(1); line.frustumCulled = false; scene.add(line);
  const bob = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.12), toon(0xd83a2a)); scene.add(bob);
  const tmp = new THREE.Vector3();
  const BOB = new THREE.Vector3(-11.1, -0.5, 13.0);

  function update(dt, dir, t) {
    for (const a of actors) a === player ? a.update(dt, dir) : a.update(dt);
    // 鱼漂
    const reel = fisher.anim === 'reel' ? Math.max(0, Math.sin(fisher.at * 5)) : 0;
    bob.position.set(BOB.x, -0.47 + Math.sin(t * 2.2) * 0.025 + reel * 0.12, BOB.z - reel * 0.3);
    fisher.fig.props.tip.getWorldPosition(tmp);
    const pa = lineGeo.attributes.position;
    pa.setXYZ(0, tmp.x, tmp.y, tmp.z);
    pa.setXYZ(1, (tmp.x + bob.position.x) / 2, (tmp.y + bob.position.y) / 2 - 0.35, (tmp.z + bob.position.z) / 2);
    pa.setXYZ(2, bob.position.x, bob.position.y + 0.06, bob.position.z); pa.needsUpdate = true;
    world.water.material.uniforms.uBob.value.set(BOB.x, BOB.z, 0.6 + reel * 0.8);
  }
  return { actors, player, girl, dog, gardener, cook, reader, fisher, scav, lookout, cat, update };
}
