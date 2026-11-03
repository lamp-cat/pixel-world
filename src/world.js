// 废城微景观：漂浮的方形城市切块
import * as THREE from 'three';
import { toon, glow } from './materials.js';
import { Batch, rng, bladeGeo, prismGeo } from './batch.js';
import { makeWater } from './water.js';

export const H = 24;
const GS = 0.5, GN = (H * 2) / GS;

const C = {
  asphalt: 0x4a4a54, asphalt2: 0x55555e, crack: 0x2c2b33, laneY: 0xb39a52, laneW: 0xc4bdae,
  curb: 0xb3ab9c, tile: 0x9d978b, tile2: 0x8a8479, pave: 0x8e887c, dirt: 0x76603f, dirt2: 0x5e4a33,
  grass: 0x5d7d36, grass2: 0x7f9b3f, grass3: 0x3f6230, grassY: 0xa3a346, moss: 0x5f7d35, moss2: 0x7a9840,
  concrete: 0xa59f93, concrete2: 0x8b857b, concrete3: 0xc0b8a8, slab: 0x968f84, interior: 0x4d4a52,
  glass: 0x26303b, rust: 0x7d3f22, rust2: 0x9a5530, rebar: 0x6e3a22,
  gravel: 0x9a958c, strConc: 0xbcb6aa, strDirt: 0x7a5236, strDirt2: 0x5e3c2a, rock: 0x4a4048, rock2: 0x3e3640, mud: 0x3d3b2c,
  leaf: [0x3f6a35, 0x4d7c3a, 0x5f8d3f, 0x37592f, 0x6d9a45], trunk: 0x5a4030,
  tarp: 0x3a6c92, tarp2: 0xa8582e, wood: 0x7a5636, wood2: 0x5e402a, tire: 0x2a2a2e,
  jersey: 0xb9b2a4, stripe: 0xd2772e, sand: 0x9c8a63,
};

export function buildWorld(scene, { night }) {
  const R = rng(20261103);
  const J = (a = 1) => (R() - 0.5) * 2 * a;
  const pick = (a) => a[Math.floor(R() * a.length)];
  const root = new THREE.Group(); scene.add(root);

  const B = {
    box: new Batch(new THREE.BoxGeometry(1, 1, 1), toon(0xffffff, { noise: 0.1 })),
    cyl: new Batch(new THREE.CylinderGeometry(0.5, 0.5, 1, 10), toon(0xffffff, { noise: 0.08 })),
    rock: new Batch(new THREE.DodecahedronGeometry(0.5, 0), toon(0xffffff, { noise: 0.12 })),
    canopy: new Batch(new THREE.IcosahedronGeometry(1, 1), toon(0xffffff, { noise: 0.3, scale: 5, sway: 2 }), { sway: true }),
    grass: new Batch(bladeGeo(), toon(0xffffff, { noise: 0, sway: 0, side: THREE.DoubleSide }), { sway: true, cast: false }),
    flower: new Batch(new THREE.BoxGeometry(1, 1, 1), toon(0xffffff, { noise: 0, sway: 2 }), { sway: true, cast: false }),
    vine: new Batch(new THREE.BoxGeometry(1, 1, 1), toon(0xffffff, { noise: 0.15, sway: 1 }), { sway: true }),
    prism: new Batch(prismGeo(), toon(0xffffff, { noise: 0.1, side: THREE.DoubleSide })),
    glow: new Batch(new THREE.BoxGeometry(1, 1, 1), glow(1, 1, 1), { cast: false, receive: false }),
    bulb: new Batch(new THREE.IcosahedronGeometry(0.5, 1), glow(1, 1, 1), { cast: false, receive: false }),
  };
  const box = (x, y, z, sx, sy, sz, col, ry = 0, rx = 0, rz = 0, jit = 0.05) => B.box.add(x, y, z, sx, sy, sz, col, ry, rx, rz, jit, 0, R);
  const boxE = (x0, y0, z0, x1, y1, z1, col, jit = 0.04) => box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, col, 0, 0, 0, jit);
  const cyl = (x, y, z, r, h, col, ry = 0, rx = 0, rz = 0, jit = 0.05) => B.cyl.add(x, y, z, r * 2, h, r * 2, col, ry, rx, rz, jit, 0, R);
  const rock = (x, y, z, s, col, sy = 1) => B.rock.add(x, y, z, s, s * sy, s * (0.8 + R() * 0.4), col, R() * 6, R() * 6, R() * 6, 0.12, 0, R);

  // ---------- 碰撞/寻路网格 ----------
  const grid = new Uint8Array(GN * GN);
  const cell = (x, z) => { const i = Math.floor((x + H) / GS), j = Math.floor((z + H) / GS); return i < 0 || j < 0 || i >= GN || j >= GN ? -1 : j * GN + i; };
  const setRect = (x0, z0, x1, z1, v, m = 0.3) => {
    for (let j = Math.max(0, Math.floor((z0 - m + H) / GS)); j <= Math.min(GN - 1, Math.floor((z1 + m + H) / GS)); j++)
      for (let i = Math.max(0, Math.floor((x0 - m + H) / GS)); i <= Math.min(GN - 1, Math.floor((x1 + m + H) / GS)); i++) grid[j * GN + i] = v;
  };
  const block = (x0, z0, x1, z1, m) => setRect(x0, z0, x1, z1, 1, m);
  const blockRot = (cx, cz, hw, hl, ry, m = 0.3) => { // 局部 x 半宽 hw, 局部 z 半长 hl
    const r = Math.hypot(hw, hl) + m, c = Math.cos(ry), s = Math.sin(ry);
    for (let z = cz - r; z <= cz + r; z += GS / 2) for (let x = cx - r; x <= cx + r; x += GS / 2) {
      const dx = x - cx, dz = z - cz, lx = c * dx - s * dz, lz = s * dx + c * dz;
      if (Math.abs(lx) <= hw + m && Math.abs(lz) <= hl + m) { const k = cell(x, z); if (k >= 0) grid[k] = 1; }
    }
  };
  const blocked = (x, z) => { const k = cell(x, z); return k < 0 || grid[k] === 1; };

  // ---------- 地块 + 剖面地层 ----------
  const P = { x0: -21, x1: -5, z0: 7, z1: H, water: -0.5, floor: -2.2 }; // 水淹广场
  boxE(-H, -8, -H, H, -2.4, H, C.rock, 0);
  boxE(-H, -2.4, -H, H, -0.2, P.z0, C.strConc, 0);
  boxE(-H, -2.4, P.z0, P.x0, -0.2, H, C.strConc, 0);
  boxE(P.x1, -2.4, P.z0, H, -0.2, H, C.strConc, 0);
  boxE(P.x0, -2.6, P.z0, P.x1, P.floor, H, C.mud, 0);
  // 道路
  boxE(-H, -0.2, -3.5, H, 0, 3.5, C.asphalt, 0.02);
  boxE(-3.5, -0.2, -H, 3.5, 0, -3.5, C.asphalt, 0.02);
  boxE(-3.5, -0.2, 3.5, 3.5, 0, H, C.asphalt, 0.02);
  // 四个街区地面
  boxE(-H, -0.2, -H, -3.5, 0.12, -3.5, C.pave);
  boxE(3.5, -0.2, -H, H, 0.12, -3.5, C.dirt);
  boxE(3.5, -0.2, 3.5, H, 0.12, H, C.grass3);
  boxE(-H, -0.2, 3.5, -3.5, 0.12, P.z0, C.pave);
  boxE(-H, -0.2, P.z0, P.x0, 0.12, H, C.pave);
  boxE(P.x1, -0.2, P.z0, -3.5, 0.12, H, C.pave);
  // 水池内壁的湿痕 + 苔藓线
  for (let x = P.x0; x < P.x1; x += 0.5) { boxE(x, P.water - 0.05, P.z0 - 0.04, x + 0.5, P.water + 0.15 + R() * 0.12, P.z0 + 0.02, pick([C.moss, C.moss2, 0x3c4f2a]), 0.1); }
  for (let z = P.z0; z < H; z += 0.5) {
    boxE(P.x1 - 0.02, P.water - 0.05, z, P.x1 + 0.04, P.water + 0.12 + R() * 0.12, z + 0.5, pick([C.moss, 0x3c4f2a]), 0.1);
    boxE(P.x0 - 0.04, P.water - 0.05, z, P.x0 + 0.02, P.water + 0.12 + R() * 0.12, z + 0.5, pick([C.moss, 0x3c4f2a]), 0.1);
  }

  const sn = (t, s) => Math.sin(t * 0.37 + s) * 0.5 + Math.sin(t * 0.91 + s * 2.1) * 0.3 + Math.sin(t * 2.3 + s * 3.7) * 0.12;
  const faceBox = (axis, t0, t1, y0, y1, col, inset = 0.6, out = 0.07) => axis === 'z'
    ? boxE(t0, y0, H - inset, t1, y1, H + out, col, 0.015)
    : boxE(H - inset, y0, t0, H + out, y1, t1, col, 0.015);
  for (const axis of ['z', 'x']) {
    for (let t = -H; t < H; t += 0.5) {
      const tc = t + 0.25;
      const inPool = axis === 'z' && tc > P.x0 && tc < P.x1;
      const road = Math.abs(tc) < 3.5;
      const green = tc > 3.5;
      let top = inPool ? P.floor : road ? 0 : 0.12;
      const surf = inPool ? C.mud : road ? C.asphalt : green ? (axis === 'z' ? C.grass3 : C.dirt) : (axis === 'z' ? C.pave : C.dirt);
      const b1 = top - (inPool ? 0.25 : 0.32) - 0.08 * sn(tc, 1);
      const b2 = b1 - 0.5 - 0.15 * sn(tc, 4);
      const b3 = b2 - 1.0 - 0.3 * sn(tc, 7);
      const b4 = b3 - 1.4 - 0.4 * sn(tc, 2);
      const b5 = b4 - 1.6 - 0.4 * sn(tc, 5);
      const bot = -8 + 0.5 * sn(tc, 9) + (R() < 0.1 ? -0.5 : 0);
      faceBox(axis, t, t + 0.5, b1, top, surf);
      if (!inPool) faceBox(axis, t, t + 0.5, b2, b1, C.gravel);
      faceBox(axis, t, t + 0.5, b3, inPool ? b1 : b2, C.strConc);
      faceBox(axis, t, t + 0.5, b4, b3, C.strDirt);
      faceBox(axis, t, t + 0.5, b5, b4, C.strDirt2);
      faceBox(axis, t, t + 0.5, bot, b5, R() < 0.5 ? C.rock : C.rock2);
      if (green && !inPool && R() < 0.7) faceBox(axis, t, t + 0.5, top - 0.12, top + 0.02, C.grass, 0.6, 0.1); // 草皮边
      if (R() < 0.22) { // 混凝土里的钢筋头
        const y = b3 + (b2 - b3) * R(); const tt = t + R() * 0.5;
        axis === 'z' ? box(tt, y, H + 0.12, 0.07, 0.07, 0.25, C.rebar, 0, 0, 0) : box(H + 0.12, y, tt, 0.25, 0.07, 0.07, C.rebar);
      }
      if (R() < 0.12) { // 泥土里的碎石
        const y = b4 + (b3 - b4) * R(), tt = t + R() * 0.5;
        axis === 'z' ? rock(tt, y, H + 0.05, 0.3 + R() * 0.25, C.concrete2) : rock(H + 0.05, y, tt, 0.3 + R() * 0.25, C.concrete2);
      }
      if (green && !inPool && R() < 0.3) { // 悬垂的根须
        const len = 0.4 + R() * 1.5, tt = t + R() * 0.5;
        axis === 'z' ? box(tt, top - 0.2 - len / 2, H + 0.1, 0.06, len, 0.06, C.trunk) : box(H + 0.1, top - 0.2 - len / 2, tt, 0.06, len, 0.06, C.trunk);
      }
    }
  }
  // 剖面里的管道（排水管、电缆管）
  const pipes = [['z', -14.7, -1.4, 0.32, 0x6d6f73], ['z', 8, -1.2, 0.28, C.rust], ['z', 15.5, -3.2, 0.45, 0x5b6468], ['x', -16, -1.3, 0.3, C.rust], ['x', 6.5, -3.1, 0.4, 0x5b6468], ['x', -6, -1.1, 0.22, 0x8a7a40], ['z', -0.8, -3.4, 0.36, C.rust2]];
  const drips = [];
  for (const [axis, t, y, r, col] of pipes) {
    if (axis === 'z') { cyl(t, y, H + 0.1, r, 0.6, col, 0, Math.PI / 2); cyl(t, y, H + 0.42, r * 0.7, 0.06, 0x1c1c20, 0, Math.PI / 2); }
    else { cyl(H + 0.1, y, t, r, 0.6, col, 0, 0, Math.PI / 2); cyl(H + 0.42, y, t, r * 0.7, 0.06, 0x1c1c20, 0, 0, Math.PI / 2); }
    if (r > 0.35) drips.push(axis === 'z' ? [t, y - r * 0.5, H + 0.42] : [H + 0.42, y - r * 0.5, t]);
  }
  // 底部垂下的岩块
  for (let i = 0; i < 26; i++) {
    const t = -H + R() * 2 * H, axis = R() < 0.5 ? 'z' : 'x';
    const s = 0.6 + R() * 1.3;
    const x = axis === 'z' ? t : H - R() * 3, z = axis === 'z' ? H - R() * 3 : t;
    rock(x, -8.1 - R() * 0.3, z, s, R() < 0.5 ? C.rock : C.rock2, 0.6);
  }
  // 地块边缘一圈不可走
  block(-H, -H, H, -H + 0.4, 0); block(-H, H - 0.4, H, H, 0); block(-H, -H, -H + 0.4, H, 0); block(H - 0.4, -H, H, H, 0);

  // ---------- 植被工具 ----------
  const grassPal = [C.grass, C.grass2, C.grass3, C.grassY, 0x6a8a3a];
  const tuft = (x, z, y, n = 6, spread = 0.25, h = 0.45, pal = grassPal) => {
    for (let i = 0; i < n; i++) {
      const hh = h * (0.5 + R() * 0.8);
      B.grass.add(x + J(spread), y, z + J(spread), 0.8 + R() * 0.6, hh, 0.8 + R() * 0.6, pick(pal), R() * 6, J(0.25), J(0.25), 0.12, 0.08 + R() * 0.06, R);
    }
  };
  const flower = (x, z, y) => {
    const col = pick([0xe9e2d0, 0xe8c64a, 0xd97a8a, 0xc9d0f0, 0xe9e2d0]);
    const hh = 0.25 + R() * 0.3;
    B.grass.add(x, y, z, 0.5, hh, 0.5, C.grass, R() * 6, 0, 0, 0.1, 0.05, R);
    B.flower.add(x, y + hh, z, 0.12, 0.1, 0.12, col, R() * 6, 0, 0, 0.05, 0.03, R);
  };
  const vine = (x, ytop, z, len, nx, nz) => { // 沿墙面垂挂的藤
    const segs = Math.ceil(len / 0.35);
    for (let i = 0; i < segs; i++) {
      const y = ytop - i * 0.35 - 0.17;
      B.vine.add(x + nx * 0.06, y, z + nz * 0.06, 0.12, 0.38, 0.12, pick([C.moss, C.leaf[1], C.leaf[3]]), 0, 0, 0, 0.1, 0.025 + i * 0.012, R);
      if (R() < 0.6) B.vine.add(x + nx * 0.1 + J(0.12) * Math.abs(nz), y, z + nz * 0.1 + J(0.12) * Math.abs(nx), 0.22, 0.2, 0.22, pick(C.leaf), R(), 0, 0, 0.12, 0.03 + i * 0.012, R);
    }
  };
  const ivy = (x, y0, z, w, h, nx, nz) => { // 贴墙的爬山虎斑块
    const n = Math.floor(w * h * 3);
    for (let i = 0; i < n; i++) {
      const u = J(w / 2), v = R() * h * (1 - Math.abs(u) / w);
      const sx = 0.25 + R() * 0.35, sy = 0.2 + R() * 0.3;
      box(x + (nz !== 0 ? u : nx * 0.04), y0 + v, z + (nx !== 0 ? u : nz * 0.04), nz !== 0 ? sx : 0.08, sy, nx !== 0 ? sx : 0.08, pick([C.moss, C.moss2, C.leaf[0], C.leaf[2]]), 0, 0, 0, 0.12);
    }
  };
  const tree = (x, z, h = 6, s = 1, y = 0.12, burst = false) => {
    const lean = J(0.12), lean2 = J(0.12);
    const segs = 4;
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, sh = h / segs, w = (0.55 - i * 0.07) * s;
      box(x + lean * h * (t0 + 0.5 / segs), y + sh * (i + 0.5), z + lean2 * h * (t0 + 0.5 / segs), w, sh + 0.1, w, C.trunk, R(), lean2 * 0.8, -lean * 0.8, 0.08);
    }
    for (let i = 0; i < 3; i++) { const a = R() * 6.28; box(x + Math.cos(a) * 0.5, y + 0.1, z + Math.sin(a) * 0.5, 0.9, 0.22, 0.25, C.trunk, -a, 0, 0.25, 0.1); }
    const tx = x + lean * h, tz = z + lean2 * h, ty = y + h;
    const n = 7 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, d = R() * 1.8 * s, r = (1.0 + R() * 0.8) * s;
      const by = ty + J(0.8) * s + (d < 0.8 ? 0.8 : 0);
      const col = pick(C.leaf);
      B.canopy.add(tx + Math.cos(a) * d, by, tz + Math.sin(a) * d, r, r * 0.85, r, col, R() * 6, 0, 0, 0.08, 0.05, R);
    }
    B.canopy.add(tx, ty + 1.1 * s, tz, 1.3 * s, 1.1 * s, 1.3 * s, C.leaf[2], 0, 0, 0, 0.06, 0.05, R);
    if (burst) { // 撑破路面
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * 6.28 + J(0.3), d = 0.8 + R() * 0.8;
        box(x + Math.cos(a) * d, 0.1, z + Math.sin(a) * d, 0.7 + R() * 0.5, 0.18, 0.5 + R() * 0.4, pick([C.asphalt, C.asphalt2]), -a, J(0.35), 0.25 + R() * 0.3, 0.05);
      }
      for (let i = 0; i < 4; i++) { const a = R() * 6.28; box(x + Math.cos(a) * 1.0, 0.15, z + Math.sin(a) * 1.0, 1.6, 0.25, 0.28, C.trunk, -a, 0, 0.15, 0.1); }
      tuft(x, z, 0.02, 14, 1.4, 0.5);
    }
    tuft(x, z, y, 10, 1.2, 0.5);
    block(x - 0.45, z - 0.45, x + 0.45, z + 0.45, 0.25);
  };
  const pile = (cx, cz, r, h, n, y = 0.12, pal = [C.concrete, C.concrete2, C.concrete3, 0x8d7a6a]) => {
    for (let i = 0; i < n; i++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * r;
      const yy = y + h * (1 - d / r) * (0.4 + 0.6 * R());
      const s = 0.25 + R() * 0.6;
      if (R() < 0.55) rock(cx + Math.cos(a) * d, yy, cz + Math.sin(a) * d, s, pick(pal), 0.7);
      else box(cx + Math.cos(a) * d, yy, cz + Math.sin(a) * d, s * 1.5, s * 0.5, s, pick(pal), R() * 6, J(0.5), J(0.5), 0.08);
    }
    for (let i = 0; i < n / 8; i++) { const a = R() * 6.28, d = R() * r * 0.7; box(cx + Math.cos(a) * d, y + h * 0.6, cz + Math.sin(a) * d, 0.05, 0.05, 0.9 + R(), C.rebar, R() * 6, J(0.8), J(0.6), 0.1); }
    for (let i = 0; i < n / 5; i++) { const a = R() * 6.28, d = r * (0.6 + R() * 0.5); tuft(cx + Math.cos(a) * d, cz + Math.sin(a) * d, y, 5, 0.3, 0.4); }
  };

  // ---------- 道路细节 ----------
  const roadAt = (x, z) => Math.abs(x) < 3.5 || Math.abs(z) < 3.5;
  for (let x = -23.4; x < 23; x += 2.5) { if (Math.abs(x + 0.7) < 4.6 || R() < 0.22) continue; boxE(x, 0, -0.12, x + 1.4, 0.022, 0.12, C.laneY, 0.08); }
  for (let z = -23.4; z < 23; z += 2.5) { if (Math.abs(z + 0.7) < 4.6 || R() < 0.22) continue; boxE(-0.12, 0, z, 0.12, 0.022, z + 1.4, C.laneW, 0.08); }
  for (const s of [-1, 1]) { // 边线（断续）
    for (let t = -23.5; t < 23.5; t += 0.5) {
      if (Math.abs(t) < 3.6 || R() < 0.3) continue;
      boxE(t, 0, s * 2.95 - 0.08, t + 0.5, 0.02, s * 2.95 + 0.08, C.laneW, 0.1);
      boxE(s * 2.95 - 0.08, 0, t, s * 2.95 + 0.08, 0.02, t + 0.5, C.laneW, 0.1);
    }
  }
  for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { // 斑马线
    if (R() < 0.2) continue;
    const t = -2.9 + k * 0.95;
    boxE(t, 0, s * 4.4 - 0.75, t + 0.48, 0.02, s * 4.4 + 0.75, C.laneW, 0.1);
    if (R() < 0.8) boxE(s * 4.4 - 0.75, 0, t, s * 4.4 + 0.75, 0.02, t + 0.48, C.laneW, 0.1);
  }
  const crack = (x, z, a, n) => {
    for (let i = 0; i < n; i++) {
      const L = 0.4 + R() * 0.6;
      const nx = x + Math.cos(a) * L, nz = z + Math.sin(a) * L;
      if (!roadAt(nx, nz) || Math.abs(nx) > 23.5 || Math.abs(nz) > 23.5) return;
      box((x + nx) / 2, 0.012, (z + nz) / 2, L + 0.06, 0.03, 0.13, C.crack, -a, 0, 0, 0.1);
      if (R() < 0.35) tuft(nx, nz, 0, 3, 0.12, 0.35);
      if (R() < 0.12) crack(nx, nz, a + J(1.2), Math.floor(n / 2));
      x = nx; z = nz; a += J(0.7);
    }
  };
  for (let i = 0; i < 46; i++) {
    const onX = R() < 0.5; const t = J(23);
    const x = onX ? t : J(3.2), z = onX ? J(3.2) : t;
    crack(x, z, R() * 6.28, 6 + Math.floor(R() * 10));
  }
  const potholes = [[-12, 1.6], [7.8, -2.0], [1.6, -8.5], [-1.9, 18], [16, -1], [1.2, 13.5]];
  for (const [x, z] of potholes) {
    const s = 0.9 + R() * 0.7;
    box(x, 0.004, z, s * 1.3, 0.02, s, C.crack, R() * 3, 0, 0, 0);
    box(x, 0.016, z, s * 1.0, 0.02, s * 0.75, 0x45566a, R() * 3, 0, 0, 0.05); // 积水
    for (let i = 0; i < 4; i++) rock(x + J(s * 0.7), 0.05, z + J(s * 0.7), 0.15 + R() * 0.15, C.asphalt2);
  }
  for (let i = 0; i < 40; i++) { // 碎块与垃圾
    const onX = R() < 0.5, t = J(23), x = onX ? t : J(3.3), z = onX ? J(3.3) : t;
    if (R() < 0.6) rock(x, 0.06, z, 0.12 + R() * 0.22, pick([C.concrete2, C.asphalt2, C.concrete]));
    else box(x, 0.03, z, 0.25, 0.03, 0.18, pick([0xd8d0c0, 0xb85b42, 0x4f7090]), R() * 6, J(0.1), J(0.1), 0.1);
  }
  // 人行道：方砖 + 缺砖 + 路缘石
  const sidewalk = (x0, z0, x1, z1) => {
    for (let x = x0; x < x1 - 0.01; x += 1) for (let z = z0; z < z1 - 0.01; z += 1) {
      const r = R();
      if (r < 0.1) { tuft(x + 0.5, z + 0.5, 0.12, 6, 0.3, 0.4); continue; }
      const tilt = r > 0.94;
      box(x + 0.5, 0.15 + (tilt ? 0.06 : 0), z + 0.5, 0.95, 0.08, 0.95, pick([C.tile, C.tile2, C.tile]), tilt ? J(0.2) : 0, tilt ? J(0.15) : 0, tilt ? J(0.15) : 0, 0.05);
      if (R() < 0.12) tuft(x + 0.5 + J(0.5), z + (R() < 0.5 ? 0 : 1), 0.18, 3, 0.1, 0.3);
    }
  };
  sidewalk(-H, -5.5, -3.5, -3.5); sidewalk(-5.5, -H, -3.5, -5.5);
  sidewalk(3.5, -5.5, H, -3.5); sidewalk(3.5, -H, 5.5, -5.5);
  sidewalk(3.5, 3.5, H, 5.5); sidewalk(3.5, 5.5, 5.5, H);
  sidewalk(-H, 3.5, -3.5, 5.5); sidewalk(-5.5, 5.5, -3.5, P.z0);
  for (let t = -H; t < H; t += 1) for (const s of [-1, 1]) {
    if (Math.abs(t + 0.5) < 3.5) continue;
    box(t + 0.5, 0.1, s * 3.6, 0.98, 0.2, 0.2, C.curb, 0, 0, 0, 0.06);
    box(s * 3.6, 0.1, t + 0.5, 0.2, 0.2, 0.98, C.curb, 0, 0, 0, 0.06);
  }
  const heightAt = (x, z) => {
    if (x > -12.4 && x < -10.4 && z > P.z0 - 0.1 && z < 10.6) return 0.12;
    return roadAt(x, z) ? 0 : (Math.abs(x) < 5.5 || Math.abs(z) < 5.5 ? 0.19 : 0.12);
  };

  // ---------- 建筑 ----------
  const building = (o) => {
    const { x0, z0, x1, z1, floors, fh = 3, base = 0.12, wall = C.concrete, slab = C.slab, lim = () => floors, doorFace = null, glassP = 0.3, vis = ['px', 'pz'] } = o;
    const L = (x, z) => Math.min(floors, lim(x, z));
    boxE(x0 + 0.3, base, z0 + 0.3, x1 - 0.3, base + 0.06, z1 - 0.3, C.interior, 0.05);
    for (let f = 0; f < floors; f++) {
      const y0 = base + f * fh, y1 = y0 + fh;
      // 楼板（f+1 层）
      for (let cx = x0; cx < x1; cx++) for (let cz = z0; cz < z1; cz++) {
        const px = cx + 0.5, pz = cz + 0.5;
        if (L(px, pz) < f + 1) continue;
        if (L(px, pz) === f + 1 && f + 1 < floors && R() < 0.12) continue; // 楼板破洞
        const e = 0.14;
        const ax0 = cx === x0 ? cx - e : cx, ax1 = cx === x1 - 1 ? cx + 1 + e : cx + 1, az0 = cz === z0 ? cz - e : cz, az1 = cz === z1 - 1 ? cz + 1 + e : cz + 1;
        boxE(ax0, y1 - 0.32, az0, ax1, y1, az1, f + 1 === floors ? C.concrete2 : slab, 0.03);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = px + dx, nz = pz + dz;
          if (nx < x0 || nx > x1 || nz < z0 || nz > z1) continue;
          if (L(nx, nz) >= f + 1) continue;
          if (R() < 0.35) for (let k = 0; k < 2; k++) { // 断口钢筋
            const off = J(0.35), len = 0.4 + R() * 0.7;
            box(px + dx * (0.5 + len / 2) + (dz ? off : 0), y1 - 0.16 - len * 0.15, pz + dz * (0.5 + len / 2) + (dx ? off : 0), dx ? len : 0.05, 0.05, dz ? len : 0.05, C.rebar, 0, dz * 0.35, -dx * 0.35, 0.1);
          }
          if (R() < 0.35) tuft(px + dx * 0.3, pz + dz * 0.3, y1, 4, 0.2, 0.35);
          if (R() < 0.25) vine(px + dx * 0.5, y1 - 0.2, pz + dz * 0.5, 0.6 + R() * 2.2, dx, dz);
        }
        if (R() < 0.06 && f + 1 === L(px, pz)) pile(px, pz, 0.7, 0.4, 5, y1);
      }
      // 墙
      const sides = [
        { n: 'nz', a: [x0, z0], d: [1, 0], len: x1 - x0, nrm: [0, -1] },
        { n: 'pz', a: [x0, z1], d: [1, 0], len: x1 - x0, nrm: [0, 1] },
        { n: 'nx', a: [x0, z0], d: [0, 1], len: z1 - z0, nrm: [-1, 0] },
        { n: 'px', a: [x1, z0], d: [0, 1], len: z1 - z0, nrm: [1, 0] },
      ];
      for (const S of sides) {
        for (let i = 0; i < S.len; i++) {
          const ex = S.a[0] + S.d[0] * (i + 0.5), ez = S.a[1] + S.d[1] * (i + 0.5);
          const px = ex - S.nrm[0] * 0.5, pz = ez - S.nrm[1] * 0.5;
          if (L(px, pz) < f + 1) {
            if (L(px, pz) > f && R() < 0.5) { // 半截残墙
              const hh = (L(px, pz) - f) * fh;
              seg(S, ex, ez, y0, y0 + Math.min(hh, fh * 0.6) * (0.5 + R() * 0.5), wall);
            }
            continue;
          }
          const pillar = i % 3 === 0 || i === S.len - 1;
          const topOpen = L(px, pz) < f + 2 && f + 1 < floors;
          const door = f === 0 && doorFace === S.n && i % 3 === 1;
          if (pillar) {
            seg(S, ex, ez, y0, y1 - 0.3, wall, 0.36);
            if (topOpen && R() < 0.6) for (let k = 0; k < 3; k++) box(ex + J(0.12), y1 + 0.3, ez + J(0.12), 0.05, 0.6 + R() * 0.6, 0.05, C.rebar, 0, J(0.35), J(0.35), 0.1);
          } else {
            if (!door) seg(S, ex, ez, y0, y0 + 0.95, wall);
            seg(S, ex, ez, y0 + 2.25, y1 - 0.3, wall);
            if (door) seg(S, ex, ez, y0, y0 + 2.25, C.glass, 0.1, -0.12);
            else if (R() < glassP) seg(S, ex, ez, y0 + 0.95, y0 + 2.25, C.glass, 0.08, -0.1);
            else if (R() < 0.15) seg(S, ex, ez, y0 + 0.95, y0 + 1.1, C.rust, 0.06, 0.12); // 生锈的空调架
          }
          if (vis.includes(S.n) && R() < 0.04) ivy(ex, y0, ez, 1.6, 2.5 + R() * 2, S.nrm[0], S.nrm[1]);
          if (vis.includes(S.n) && R() < 0.07) vine(ex + S.nrm[0] * 0.18, y1 - 0.1, ez + S.nrm[1] * 0.18, 1 + R() * 2.5, S.nrm[0], S.nrm[1]);
        }
      }
      // 内柱
      for (let cx = x0 + 2.5; cx < x1 - 1; cx += 4) for (let cz = z0 + 2.5; cz < z1 - 1; cz += 4) {
        if (L(cx, cz) >= f + 1) box(cx, (y0 + y1 - 0.3) / 2, cz, 0.5, fh - 0.3, 0.5, C.concrete2);
        else if (L(cx, cz) > f - 0.5 && R() < 0.6) box(cx, y0 + 0.6, cz, 0.5, 1.2, 0.5, C.concrete2, 0, J(0.1), J(0.1));
      }
    }
    // 屋顶女儿墙
    for (let x = x0; x < x1; x++) for (let z = z0; z < z1; z++) {
      if (x !== x0 && x !== x1 - 1 && z !== z0 && z !== z1 - 1) continue;
      if (L(x + 0.5, z + 0.5) < floors || R() < 0.15) continue;
      const y = base + floors * fh;
      const ex0 = x === x0 ? x - 0.14 : x, ex1 = x === x1 - 1 ? x + 1.14 : x + 1, ez0 = z === z0 ? z - 0.14 : z, ez1 = z === z1 - 1 ? z + 1.14 : z + 1;
      if (x === x0 || x === x1 - 1) boxE(x === x0 ? ex0 : ex1 - 0.25, y, ez0, x === x0 ? ex0 + 0.25 : ex1, y + 0.65, ez1, C.concrete3);
      if (z === z0 || z === z1 - 1) boxE(ex0, y, z === z0 ? ez0 : ez1 - 0.25, ex1, y + 0.65, z === z0 ? ez0 + 0.25 : ez1, C.concrete3);
    }
    block(x0, z0, x1, z1, 0.3);
  };
  function seg(S, ex, ez, y0, y1, col, thick = 0.3, push = 0) {
    if (y1 <= y0) return;
    const t = thick, nx = S.nrm[0], nz = S.nrm[1];
    const cx = ex - nx * (0.15 - push), cz = ez - nz * (0.15 - push);
    box(cx, (y0 + y1) / 2, cz, S.d[0] ? 1.0 : t, y1 - y0, S.d[1] ? 1.0 : t, col, 0, 0, 0, 0.05);
  }

  // A 塔楼（坍塌）
  const nA = (x, z) => Math.sin(x * 1.7) * 0.5 + Math.sin(z * 2.3 + 1) * 0.5;
  building({ x0: -21, z0: -21, x1: -11, z1: -12, floors: 6, wall: 0xa49c8e, lim: (x, z) => {
    const u = (x + 21) / 10, v = (z + 21) / 9;
    const c = Math.max(0, u * 0.75 + v * 0.85 - 0.55) * 6.2 + nA(x, z) * 0.6;
    return Math.max(0, Math.round(6 - Math.min(5, c)));
  } });
  pile(-11.5, -11, 3.2, 1.6, 60, 0.12);
  pile(-14.5, -10.2, 2.2, 1.0, 34, 0.12);
  block(-14, -13, -9, -8.5, 0.1);
  block(-16, -12, -12.5, -8.8, 0.1);
  box(-9.3, 1.6, -9.6, 4.2, 0.3, 3.2, C.slab, 0.4, 0.15, 0.62, 0.04); // 斜靠的楼板
  // 一楼的破霓虹（面朝 +z）
  const neonCyan = glow(0.5, 3.2, 3.6);
  const cyanBatch = new Batch(new THREE.BoxGeometry(1, 1, 1), neonCyan, { cast: false, receive: false });
  box(-18.2, 2.4, -11.75, 3.2, 1.0, 0.12, 0x232129, 0, 0, 0, 0);
  for (const [x0, y0, x1, y1] of [[-19.7, 1.95, -16.7, 2.03], [-19.7, 2.77, -16.7, 2.85], [-19.7, 1.95, -19.62, 2.85], [-16.78, 1.95, -16.7, 2.85]]) cyanBatch.add((x0 + x1) / 2, (y0 + y1) / 2, -11.66, x1 - x0, y1 - y0, 0.06, 0xffffff, 0, 0, 0, 0);
  for (let i = 0; i < 6; i++) cyanBatch.add(-19.2 + i * 0.42, 2.4 + (i % 2 ? 0.18 : -0.18), -11.66, 0.36, 0.07, 0.06, 0xffffff, 0, 0, (i % 2 ? -1 : 1) * 0.7, 0);
  cyanBatch.build(root);

  // B 楼（屋顶菜园）
  building({ x0: -10, z0: -21, x1: -5, z1: -13, floors: 2, wall: 0x9a8f80, glassP: 0.6, lim: (x, z) => (x > -6 && z > -14 ? 1 : 2) });
  const RY = 0.12 + 6;
  const planter = (x0, z0, x1, z1, crop) => {
    boxE(x0, RY, z0, x1, RY + 0.45, z1, C.wood, 0.08);
    boxE(x0 + 0.1, RY + 0.45, z0 + 0.1, x1 - 0.1, RY + 0.5, z1 - 0.1, 0x3d2a1e, 0.05);
    for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.4) for (let z = z0 + 0.3; z < z1 - 0.1; z += 0.45) {
      if (crop === 'leaf') { B.grass.add(x, RY + 0.5, z, 2.2, 0.35, 2.2, pick([0x6e9e3e, 0x86b04a, 0x5c8a35]), R() * 6, 0, 0, 0.1, 0.05, R); }
      else if (crop === 'tomato') { B.grass.add(x, RY + 0.5, z, 1.2, 0.7, 1.2, C.grass3, R() * 6, 0, 0, 0.1, 0.06, R); if (R() < 0.7) B.flower.add(x + J(0.08), RY + 0.75, z + J(0.08), 0.12, 0.12, 0.12, 0xc8402e, 0, 0, 0, 0.1, 0.03, R); }
      else { B.grass.add(x, RY + 0.5, z, 1.0, 0.6, 1.0, 0x7aa040, R() * 6, 0, 0, 0.1, 0.06, R); if (R() < 0.6) B.flower.add(x, RY + 0.8, z, 0.1, 0.1, 0.1, 0xe8c64a, 0, 0, 0, 0.1, 0.03, R); }
    }
  };
  planter(-9.6, -20.5, -8.2, -17.6, 'leaf');
  planter(-9.6, -16.8, -8.2, -14.0, 'tomato');
  planter(-7.0, -20.5, -5.6, -18.2, 'flower');
  cyl(-6.3, RY + 0.75, -15.2, 0.6, 1.5, 0x3f6f8a); cyl(-6.3, RY + 1.55, -15.2, 0.62, 0.1, 0x2e5266); // 水箱
  box(-9.0, RY + 0.55, -13.55, 1.3, 0.06, 0.8, 0x23304a, 0, 0.5, 0, 0.02); // 太阳能板
  box(-9.0, RY + 0.25, -13.75, 0.08, 0.5, 0.08, 0x666666);
  // 晾衣绳
  for (const z of [-20.6, -16.9]) box(-5.5, RY + 0.75, z, 0.07, 1.5, 0.07, C.wood2);
  box(-5.5, RY + 1.45, -18.75, 0.03, 0.03, 3.7, 0x555555);
  [[-20.0, 0xc8d0d8], [-19.2, 0xb04a3a], [-18.3, 0x4a6a9a], [-17.5, 0xd8c070]].forEach(([z, c]) => box(-5.5, RY + 1.15, z, 0.04, 0.55, 0.6, c, 0, 0, 0, 0.04));
  for (let y = 0.4; y < 6; y += 0.45) box(-4.84, y, -14.2, 0.06, 0.06, 0.7, 0x777777); // 爬梯
  box(-4.84, 3.2, -14.55, 0.06, 6.2, 0.06, 0x777777); box(-4.84, 3.2, -13.85, 0.06, 6.2, 0.06, 0x777777);
  const gardenLantern = [-9.0, RY + 1.0, -17.2];
  box(-9.0, RY + 0.5, -17.2, 0.05, 1.0, 0.05, C.wood2);

  // C 汽车旅馆
  building({ x0: 9, z0: -22, x1: 22, z1: -14, floors: 3, wall: 0xb58a6a, slab: 0x9c8574, doorFace: 'pz', glassP: 0.45, lim: (x, z) => (x > 18.5 + Math.sin(z * 1.3) * 1.2 ? 2 : 3) });
  boxE(9, 2.82, -14.14, 22, 3.12, -12.6, C.slab); // 外廊
  for (let x = 9.2; x < 22; x += 0.9) { if (R() < 0.15) continue; box(x, 3.5, -12.7, 0.07, 0.75, 0.07, 0x6a6e72); }
  for (let x = 9; x < 22; x += 1.5) { if (R() < 0.25) continue; box(x + 0.75, 3.85, -12.7, 1.5, 0.07, 0.07, 0x6a6e72, 0, 0, J(0.06)); }
  for (let x = 10; x < 22; x += 3) box(x, 1.45, -12.8, 0.25, 2.7, 0.25, C.concrete2);
  for (let i = 0; i < 8; i++) box(8.2, 0.12 + (i + 0.5) * 0.375, -9.0 - i * 0.5, 1.3, 0.12, 0.5, C.concrete2); // 楼梯
  boxE(7.55, 2.82, -14.14, 9, 3.12, -12.6, C.slab);
  boxE(7.5, 0.12, -9.3, 8.9, 2.0, -9.05, C.concrete2);
  for (let i = 0; i < 4; i++) box(7.5, 1.4 + i * 0.4, -9.4 - i * 1.0, 0.06, 1.0, 0.06, 0x6a6e72);
  block(7.4, -14, 9, -8.8, 0.25);
  ivy(22, 0.12, -17, 3, 6, 1, 0); ivy(13, 0.12, -14, 2.5, 3, 0, 1);
  // 霓虹灯牌 MOTEL（竖排）
  const SX = 6.0, SZ = -12.4;
  cyl(SX, 4.5, SZ, 0.15, 9, 0x5a5e62);
  const signG = new THREE.Group(); signG.position.set(SX + 0.2, 6.8, SZ + 0.2); signG.rotation.set(0.03, Math.PI / 4, -0.04); root.add(signG);
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5.6, 0.3), toon(0x2a2631, { noise: 0.1 }));
  signBoard.castShadow = true; signBoard.receiveShadow = true; signG.add(signBoard);
  const glyph = { M: ['101', '111', '111', '101', '101'], O: ['111', '101', '101', '101', '111'], T: ['111', '010', '010', '010', '010'], E: ['111', '100', '110', '100', '111'], L: ['100', '100', '100', '100', '111'] };
  const letters = [];
  'MOTEL'.split('').forEach((ch, li) => {
    const state = ch === 'T' ? 'dead' : ch === 'E' ? 'flicker' : 'on';
    const m = state === 'dead' ? glow(0.22, 0.06, 0.1) : glow(4.2, 0.9, 2.2);
    const b = new Batch(new THREE.BoxGeometry(1, 1, 1), m, { cast: false, receive: false });
    glyph[ch].forEach((row, ry) => row.split('').forEach((v, rx) => { if (v === '1') b.add((rx - 1) * 0.3, 2.2 - li * 1.1 - ry * 0.18 + 0.36, 0.17, 0.26, 0.16, 0.06, 0xffffff, 0, 0, 0, 0); }));
    b.build(signG); letters.push({ m, state, ch });
  });
  // 箭头霓虹
  const arrowM = glow(3.6, 2.4, 0.6);
  const arrow = new Batch(new THREE.BoxGeometry(1, 1, 1), arrowM, { cast: false, receive: false });
  for (let i = 0; i < 4; i++) arrow.add(-0.05 + i * 0.25, -3.15, 0.17, 0.18, 0.1, 0.06, 0xffffff, 0, 0, 0, 0);
  arrow.add(0.75, -3.05, 0.17, 0.1, 0.25, 0.06, 0xffffff, 0, 0, -0.7, 0); arrow.add(0.75, -3.25, 0.17, 0.1, 0.25, 0.06, 0xffffff, 0, 0, 0.7, 0);
  arrow.build(signG);
  const signFrame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.2), toon(0x2a2631)); signFrame.position.set(0.35, -3.15, 0); signG.add(signFrame);
  block(SX - 0.3, SZ - 0.3, SX + 0.3, SZ + 0.3, 0.2);

  // ---------- 营地 ----------
  const tent = (x, z, ry) => {
    B.prism.add(x, 0.12, z, 2.6, 1.7, 3.0, C.tarp, ry, 0, 0, 0.04, 0, R);
    box(x + Math.sin(ry) * 1.52, 0.6, z + Math.cos(ry) * 1.52, 1.0, 0.9, 0.04, 0x1e2a33, ry, 0, 0, 0);
    box(x + 0.5, 1.0, z + 0.3, 0.6, 0.5, 0.06, C.tarp2, ry, 0, 0.6, 0.05);
    for (const s of [-1, 1]) { box(x + Math.cos(ry) * s * 1.5, 0.2, z - Math.sin(ry) * s * 1.5, 0.12, 0.25, 0.12, C.wood2); }
    blockRot(x, z, 1.3, 1.5, ry, 0.3);
  };
  tent(16.5, -9.2, 0); tent(19.8, -8.6, -0.35);
  B.prism.add(19.8, 1.75, -8.6, 2.9, 0.12, 3.3, C.tarp2, -0.35, 0, 0, 0.04, 0, R);
  // 油桶火
  const FX = 11.6, FZ = -8.1;
  cyl(FX, 0.62, FZ, 0.42, 1.0, C.rust); cyl(FX, 1.13, FZ, 0.44, 0.06, C.rust2); cyl(FX, 0.4, FZ, 0.43, 0.06, C.rust2);
  for (let i = 0; i < 5; i++) box(FX - 0.4 + i * 0.2, 1.2, FZ, 0.04, 0.04, 0.95, 0x333333);
  cyl(FX + 0.1, 1.35, FZ, 0.26, 0.32, 0x3c3c40); // 锅
  block(FX - 0.5, FZ - 0.5, FX + 0.5, FZ + 0.5, 0.15);
  for (let i = 0; i < 6; i++) { const a = i * 1.05; rock(FX + Math.cos(a) * 0.9, 0.18, FZ + Math.sin(a) * 0.9, 0.25, C.concrete2); }
  const flameMs = [glow(5.5, 2.0, 0.4), glow(6, 3.6, 1.1), glow(4.2, 1.0, 0.25)];
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.6, 5), flameMs[i % 3]);
    f.position.set(FX - 0.25 + (i % 3) * 0.17 + J(0.05), 1.3, FZ - 0.2 + Math.floor(i / 3) * 0.3);
    f.userData.ph = R() * 10; f.userData.noNormal = true; root.add(f); flames.push(f);
  }
  // 沙发 + 板条箱 + 水桶
  box(10.1, 0.33, -8.0, 0.9, 0.42, 1.8, 0x6b4f5e); box(9.75, 0.85, -8.0, 0.25, 0.7, 1.8, 0x5c4251); box(10.1, 0.6, -7.0, 0.9, 0.5, 0.22, 0x5c4251); box(10.1, 0.6, -9.0, 0.9, 0.5, 0.22, 0x5c4251);
  block(9.5, -9.2, 10.6, -6.8, 0.15);
  for (const [x, z, s] of [[13.6, -10.4, 0.8], [14.3, -10.5, 0.7], [13.9, -10.3, 0.6], [14.2, -6.3, 0.7], [21.2, -11.0, 0.9]]) {
    box(x, 0.12 + s / 2 + (s === 0.6 ? 0.8 : 0), z, s, s, s, C.wood, R(), 0, 0, 0.1); block(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 0.15);
  }
  for (let i = 0; i < 3; i++) cyl(13.3 + i * 0.5, 0.42, -5.9, 0.2, 0.6, pick([0x3f73a8, 0x4f86b8, 0xd6d0c0]));
  block(13, -6.2, 14.8, -5.6, 0.15);
  // 路障
  const jersey = (x, z, ry) => { box(x, 0.55, z, 0.6, 0.85, 1.9, C.jersey, ry, 0, 0, 0.05); box(x, 0.32, z, 0.9, 0.4, 1.9, C.jersey, ry, 0, 0, 0.05); box(x + Math.cos(ry) * 0.31, 0.75, z - Math.sin(ry) * 0.31, 0.02, 0.18, 1.9, C.stripe, ry, 0, 0, 0.05); blockRot(x, z, 0.45, 0.95, ry, 0.25); };
  const tires = (x, z, n) => { for (let i = 0; i < n; i++) cyl(x + J(0.05), 0.12 + 0.15 + i * 0.28, z + J(0.05), 0.38, 0.27, C.tire, 0, J(0.06), J(0.06), 0.1); block(x - 0.4, z - 0.4, x + 0.4, z + 0.4, 0.2); };
  const sandbags = (x, z, ry, n) => { for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) box(x + Math.sin(ry) * (i * 0.6 + k * 0.3) , 0.25 + k * 0.25, z + Math.cos(ry) * (i * 0.6 + k * 0.3), 0.55, 0.25, 0.4, C.sand, ry + J(0.15), 0, 0, 0.08); };
  jersey(6.8, -4.7, Math.PI / 2); jersey(13.4, -4.7, Math.PI / 2); jersey(15.4, -4.75, Math.PI / 2 + 0.08); jersey(19.6, -4.7, Math.PI / 2);
  tires(8.4, -4.75, 3); tires(17.5, -4.7, 2); tires(21.6, -4.8, 3);
  for (let x = 5; x < 22; x += 3.6) if (x > 6 && (x < 9.5 || x > 12)) box(x + 1, 0.9, -4.6, 1.6, 1.5, 0.05, pick([0x7e6650, 0x6f7a7f, C.rust]), J(0.1), J(0.08), J(0.05), 0.05); // 铁皮
  jersey(4.7, -7.2, 0.05); tires(4.7, -9.2, 3); sandbags(4.7, -12.4, 0, 3);
  block(4.4, -12.6, 5.1, -10.6, 0.1);
  // 灯串
  const camPoles = [[6.2, -5.3], [21.0, -5.3], [21.0, -12.0], [6.6, -11.9]];
  for (const [x, z] of camPoles) box(x, 1.6, z, 0.1, 3.0, 0.1, C.wood2);
  const strands = [[0, 1], [1, 2], [3, 1]];
  for (const [a, b] of strands) {
    const [x0, z0] = camPoles[a], [x1, z1] = camPoles[b];
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.75);
    for (let i = 1; i < n; i++) {
      const t = i / n, sag = Math.sin(t * Math.PI) * 0.7;
      B.bulb.add(x0 + (x1 - x0) * t, 3.0 - sag, z0 + (z1 - z0) * t, 0.13, 0.15, 0.13, i % 4 === 2 ? new THREE.Color(0.25, 0.18, 0.1) : new THREE.Color(4.2, 2.6, 1.0), 0, 0, 0, 0, 0, R);
    }
  }
  for (let i = 0; i < 70; i++) { const x = 6 + R() * 15, z = -11.8 + R() * 6.6; if (!blocked(x, z)) tuft(x, z, 0.12, 2, 0.1, 0.3); }

  // ---------- 东南：长草的空地 + 残破小店 ----------
  building({ x0: 14, z0: 14, x1: 22, z1: 22, floors: 1, wall: 0x8f6f5a, glassP: 0.1, lim: (x, z) => (x + z > 37 ? 0.6 : 1) , vis: ['px', 'pz', 'nz'] });
  pile(17, 11.8, 2.0, 1.3, 40);
  pile(19.5, 18, 2.5, 1.0, 26);
  block(15.4, 10.4, 18.6, 13.2, 0.0);
  for (let i = 0; i < 6; i++) box(14.4 + i * 1.2, 0.15, 12.5 + J(0.5), 1.1, 0.06, 1.1, C.tile2, J(0.3), 0, 0, 0.1);
  tree(7.6, 10.2, 6.5, 1.1); tree(20.8, 7.4, 5.5, 0.95); tree(9.2, 20.0, 7, 1.2); tree(13.0, 16.8, 4.8, 0.85); tree(22.6, 23, 5, 0.9);
  for (let i = 0; i < 1800; i++) { // 草地
    const x = 5.6 + R() * 18, z = 5.6 + R() * 18;
    if (x > 13.8 && x < 22.2 && z > 13.8 && z < 22.2 && R() < 0.85) continue;
    const r = R();
    if (r < 0.1) flower(x, z, 0.12);
    else B.grass.add(x, 0.12, z, 0.8 + R() * 0.6, 0.25 + R() * 0.5, 0.8 + R() * 0.6, pick(grassPal), R() * 6, J(0.25), J(0.25), 0.12, 0.08 + R() * 0.06, R);
  }
  for (let i = 0; i < 18; i++) { const x = 6 + R() * 17, z = 6 + R() * 17; if (x > 13.5 && z > 13.5) continue; box(x, 0.13, z, 0.7 + R() * 0.8, 0.03, 0.5 + R() * 0.6, pick([C.dirt, C.dirt2]), R() * 3, 0, 0, 0.08); }
  // 公交站
  boxE(6.4, 2.3, 4.2, 9.6, 2.42, 5.4, 0x5a6670); for (const x of [6.6, 9.4]) box(x, 1.2, 5.2, 0.1, 2.2, 0.1, 0x5a6670);
  box(8.0, 1.25, 5.3, 2.8, 1.6, 0.04, 0x41596a, 0, 0, 0, 0.02); box(8, 0.55, 4.9, 2.2, 0.08, 0.45, C.wood); box(7.2, 0.33, 4.9, 0.08, 0.4, 0.3, 0x444444); box(8.8, 0.33, 4.9, 0.08, 0.4, 0.3, 0x444444);
  vine(6.6, 2.3, 5.42, 1.5, 0, 1); vine(9.0, 2.3, 5.42, 1.1, 0, 1); for (let i = 0; i < 8; i++) box(6.6 + R() * 3, 2.48, 4.4 + R() * 0.9, 0.4, 0.06, 0.35, pick([C.moss, C.moss2]));
  block(6.3, 4.9, 9.7, 5.5, 0.15);
  // 购物车
  const CX = 12.6, CZ = 9.3;
  box(CX, 0.75, CZ, 0.65, 0.5, 0.9, 0x8a8f96, 0.3, 0, 0, 0.02); box(CX, 0.5, CZ, 0.55, 0.06, 0.8, 0x6a6e74, 0.3); for (const [dx, dz] of [[-0.25, -0.35], [0.25, -0.35], [-0.25, 0.35], [0.25, 0.35]]) cyl(CX + dx, 0.2, CZ + dz, 0.07, 0.06, 0x222222, 0, 0, Math.PI / 2);
  box(CX, 0.95, CZ, 0.5, 0.2, 0.6, 0x7a6a50, 0.3, 0, 0, 0.1);
  block(CX - 0.4, CZ - 0.5, CX + 0.4, CZ + 0.5, 0.15);

  // ---------- 车辆 ----------
  const car = (x, z, ry, col, { rz = 0, rx = 0, y = 0, crushed = false, wheels = 4 } = {}) => {
    const g = (lx, ly, lz, sx, sy, sz, c, jit = 0.05) => {
      const v = new THREE.Vector3(lx, ly, lz).applyEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
      box(x + v.x, y + v.y, z + v.z, sx, sy, sz, c, ry, rx, rz, jit);
    };
    const ch = crushed ? 0.55 : 1;
    g(0, 0.55, 0, 1.8, 0.62, 4.0, col);
    g(0, 0.92 + 0.3 * ch, -0.15, 1.56, 0.6 * ch, 2.0, C.glass, 0.02);
    g(0, 1.24 + 0.3 * (ch - 1) * 1.6, -0.15, 1.6, 0.08, 2.05, col);
    g(0, 0.62, 2.01, 1.6, 0.18, 0.04, 0x3a3a3a); g(0.6, 0.72, 2.02, 0.3, 0.14, 0.04, 0xbdb7a0); g(-0.6, 0.72, 2.02, 0.3, 0.14, 0.04, 0xbdb7a0);
    for (let i = 0; i < 4; i++) g(J(0.6), 0.87, J(1.6), 0.4 + R() * 0.4, 0.04, 0.3 + R() * 0.4, pick([C.rust, C.rust2]), 0.1);
    if (R() < 0.7) g(J(0.3), 1.3, -0.3, 1.0, 0.05, 1.0, C.moss, 0.1);
    const wp = [[-0.85, 1.25], [0.85, 1.25], [-0.85, -1.25], [0.85, -1.25]];
    for (let i = 0; i < wheels; i++) { const [wx, wz] = wp[i]; const v = new THREE.Vector3(wx, 0.32, wz).applyEuler(new THREE.Euler(rx, ry, rz, 'YXZ')); cyl(x + v.x, y + v.y, z + v.z, 0.33, 0.24, C.tire, ry, rx, rz + Math.PI / 2, 0.05); }
    blockRot(x, z, 0.95, 2.05, ry, 0.3);
    for (let i = 0; i < 5; i++) tuft(x + J(1.6), z + J(1.6), 0.02, 4, 0.3, 0.45);
  };
  car(-8.6, -1.4, 1.45, 0x8c3b2e, { wheels: 3, rz: 0.05 });
  car(6.4, -1.5, 0.35, 0x3f7a78, {});
  car(-1.4, -17.2, 0.12, 0xd8d2c2, { crushed: true });
  car(18.5, 1.6, 1.62, 0x6e6a3e, { rz: Math.PI / 2 - 0.05, y: 0.95, wheels: 4 });
  car(10.8, 17.6, -0.6, 0x5b6c8a, { wheels: 2, rz: 0.08 });
  car(-8.4, -7.2, 0.9, 0x9a8f4a, { crushed: true, rx: 0.1 });
  tree(-1.4, -12.6, 6.5, 1.05, 0, true);
  tree(12.4, 0.6, 5.8, 1.0, 0, true);
  // 红绿灯（歪斜，黄灯在闪）
  const TL = new THREE.Group(); TL.position.set(3.95, 0.19, 3.95); TL.rotation.set(-0.12, 0, 0.16); root.add(TL);
  const tlm = toon(0x3c4044);
  const addTL = (geo, x, y, z, m = tlm) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; TL.add(me); return me; };
  addTL(new THREE.CylinderGeometry(0.1, 0.12, 4.6, 8), 0, 2.3, 0);
  addTL(new THREE.BoxGeometry(2.6, 0.12, 0.12), -1.3, 4.4, 0);
  addTL(new THREE.BoxGeometry(0.4, 1.1, 0.35), -2.3, 3.75, 0, toon(0x2f3a2c));
  const tlRed = addTL(new THREE.BoxGeometry(0.2, 0.2, 0.06), -2.3, 4.05, 0.18, glow(0.25, 0.04, 0.03));
  const tlAmber = addTL(new THREE.BoxGeometry(0.2, 0.2, 0.06), -2.3, 3.75, 0.18, glow(5, 2.5, 0.3));
  addTL(new THREE.BoxGeometry(0.2, 0.2, 0.06), -2.3, 3.45, 0.18, glow(0.03, 0.15, 0.06));
  vine(3.95, 4.3, 3.95, 1.4, 1, 0);
  block(3.7, 3.7, 4.2, 4.2, 0.15);
  // 歪倒的路牌 + 停车牌
  const SG = new THREE.Group(); SG.position.set(-3.95, 0.19, 4.05); SG.rotation.set(0.1, 0.5, -0.32); root.add(SG);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6), toon(0x6c7074)); sp.position.y = 1.6; SG.add(sp);
  const sb = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.05), toon(0x2f6a48)); sb.position.set(0.5, 3.0, 0); SG.add(sb);
  const sb2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 1.4), toon(0x2f6a48)); sb2.position.set(0, 2.6, 0.45); SG.add(sb2);
  const stop = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 8), toon(0xa8352c)); stop.rotation.x = Math.PI / 2; stop.position.set(0, 2.0, 0.05); SG.add(stop);
  SG.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  block(-4.2, 3.8, -3.7, 4.3, 0.15);
  // 路灯（坏的）
  for (const [x, z, ry, tilt] of [[-3.9, -9, 0, 0.05], [3.9, 14, Math.PI, -0.08], [-14, 3.9, -Math.PI / 2, 0.1], [16, -3.9, Math.PI / 2, 0], [-3.9, 20, 0, 0.35]]) {
    const G = new THREE.Group(); G.position.set(x, 0.19, z); G.rotation.set(0, ry, tilt); root.add(G);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.2, 6), toon(0x5d6266)); p.position.y = 2.1; G.add(p);
    const a = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.1), toon(0x5d6266)); a.position.set(0.45, 4.15, 0); G.add(a);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.25), toon(0x3d4246)); h.position.set(0.9, 4.08, 0); G.add(h);
    G.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    block(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 0.15);
  }

  // ---------- 西南：水淹广场 ----------
  const waterObs = [];
  // 半沉的公交车
  const BUS = { x: -14.6, z: 16.2, ry: 0.42, rx: 0.15, rz: -0.12, y: -0.4 };
  {
    const g = (lx, ly, lz, sx, sy, sz, c, jit = 0.04) => { const v = new THREE.Vector3(lx, ly, lz).applyEuler(new THREE.Euler(BUS.rx, BUS.ry, BUS.rz, 'YXZ')); box(BUS.x + v.x, BUS.y + v.y, BUS.z + v.z, sx, sy, sz, c, BUS.ry, BUS.rx, BUS.rz, jit); };
    g(0, 0.6, 0, 2.6, 2.4, 9.0, 0xc49a3c);
    g(0, 1.35, 0, 2.64, 0.75, 8.2, C.glass, 0.02);
    for (let i = 0; i < 8; i++) g(0, 1.35, -3.6 + i * 1.03, 2.68, 0.75, 0.1, 0xc49a3c, 0.03);
    g(0, 1.85, 0, 2.62, 0.12, 9.02, 0x9a968a); g(0, 0.45, 0, 2.64, 0.2, 9.02, 0x8a3d2a);
    g(0, 1.0, 4.52, 2.2, 1.4, 0.05, C.glass);
    g(0.2, 1.93, 1.5, 1.6, 0.06, 2.5, C.moss); g(-0.4, 1.93, -2.2, 1.2, 0.06, 1.6, C.moss2);
    for (let i = 0; i < 10; i++) g(J(0.9), 1.92, J(4), 0.5 + R() * 0.7, 0.04, 0.5 + R() * 0.9, i % 3 ? C.rust : 0x6a4a3a, 0.1);
    g(0.5, 1.95, 3.2, 1.0, 0.06, 1.2, C.moss2); g(-0.6, 1.95, 0.6, 0.9, 0.06, 1.4, C.moss);
    for (let i = 0; i < 10; i++) { const v = new THREE.Vector3(J(1.1), 1.9, J(4.2)).applyEuler(new THREE.Euler(BUS.rx, BUS.ry, BUS.rz, 'YXZ')); tuft(BUS.x + v.x, BUS.z + v.z, BUS.y + v.y, 4, 0.2, 0.4); }
    waterObs.push([BUS.x, BUS.z, 1.35, 4.6, -BUS.ry]);
  }
  // 只露车顶的汽车
  box(-7.8, -0.42, 19.8, 1.6, 0.3, 2.0, 0x7a3a4a, 0.3, 0, 0.05); box(-7.8, -0.25, 19.8, 1.5, 0.06, 1.9, 0x8a4a5a, 0.3); waterObs.push([-7.8, 19.8, 0.8, 1.0, -0.3]);
  // 水中路灯、浮萍、芦苇、漂浮物
  for (const [x, z, t] of [[-18.6, 10.2, 0.08], [-6.4, 13.2, -0.2], [-19.5, 21.5, 0.3]]) {
    const G = new THREE.Group(); G.position.set(x, P.floor, z); G.rotation.set(t * 0.5, 0, t); root.add(G);
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.6, 6), toon(0x5d6266)); p.position.y = 2.8; G.add(p);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.14, 0.25), toon(0x3d4246)); h.position.set(0.3, 5.5, 0); G.add(h);
    G.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    waterObs.push([x + Math.sin(t) * -1.7, z, 0.12, 0.12, 0]);
  }
  for (let i = 0; i < 70; i++) {
    const nearX = R() < 0.5;
    const x = nearX ? (R() < 0.5 ? P.x0 + R() * 2.5 : P.x1 - R() * 2.5) : P.x0 + R() * 16;
    const z = nearX ? P.z0 + R() * 16 : P.z0 + R() * 2.2;
    if (R() < 0.55) box(x, P.water + 0.02, z, 0.35 + R() * 0.3, 0.03, 0.3 + R() * 0.3, pick([0x4f7d3a, 0x6a9442, 0x3d6a33]), R() * 3, 0, 0, 0.1);
    else tuft(x, z, P.water - 0.05, 5, 0.18, 0.8, [0x5a7a35, 0x6f8a3a, 0x7d8f45]);
  }
  for (const [x, z] of [[-10, 15], [-17, 19.5], [-8.5, 9.5]]) { cyl(x, P.water + 0.05, z, 0.35, 0.18, C.tire, 0, 0, 0.1); waterObs.push([x, z, 0.35, 0.35, 0]); }
  box(-16.5, P.water + 0.06, 12.2, 1.6, 0.1, 0.35, C.wood, 0.7, 0, 0, 0.1); waterObs.push([-16.5, 12.2, 0.8, 0.2, -0.7]);
  // 栈桥（钓鱼的人坐在尽头）
  boxE(-12.4, -0.2, P.z0 - 0.3, -10.4, 0.12, 10.6, C.concrete2);
  for (const z of [8.3, 10.2]) for (const x of [-12.1, -10.7]) boxE(x - 0.18, P.floor, z - 0.18, x + 0.18, -0.2, z + 0.18, C.concrete2);
  boxE(-12.4, -0.22, 10.55, -10.4, 0.12, 10.62, C.moss);
  waterObs.push([-11.4, 8.8, 1.0, 1.8, 0]);
  const pierLantern = [-12.1, 0.62, 10.2];
  box(-12.1, 0.3, 10.2, 0.32, 0.36, 0.32, 0x3a3030); box(-12.1, 0.52, 10.2, 0.22, 0.08, 0.22, 0x3a3030);
  // 栏杆（残缺）
  for (let x = P.x0 + 0.4; x < P.x1; x += 1.0) { if ((x > -12.6 && x < -10.2) || R() < 0.25) continue; box(x, 0.6, P.z0 - 0.15, 0.08, 0.95, 0.08, 0x6a6e72); if (R() < 0.7) box(x + 0.5, 1.0, P.z0 - 0.15, 1.0, 0.07, 0.07, 0x6a6e72, 0, 0, J(0.1)); }
  // 水
  const water = makeWater({ x0: P.x0, x1: P.x1, z0: P.z0, z1: H + 0.07, y0: P.floor, y1: P.water, night, obstacles: waterObs });
  root.add(water);
  block(P.x0, P.z0, P.x1, H, 0.25);
  setRect(-12.4, P.z0 - 0.5, -10.4, 10.35, 0, -0.25);
  // 岸边树（一棵垂柳状）
  tree(-19.4, 5.3, 5.5, 1.0); tree(-7.2, 5.4, 4.6, 0.8);
  tree(-22.6, 12.5, 6.2, 1.05);
  for (let i = 0; i < 9; i++) vine(-22.6 + J(1.8), 6.2 + 0.12 - 0.4, 12.5 + 0.6 + R() * 1.2, 1.5 + R() * 2, 0, 1);
  for (let i = 0; i < 160; i++) { const x = -23.6 + R() * 2.5, z = 7.2 + R() * 16.4; if (R() < 0.15) flower(x, z, 0.12); else tuft(x, z, 0.12, 2, 0.1, 0.4); }
  for (let i = 0; i < 70; i++) { const x = -23.6 + R() * 20, z = 3.7 + R() * 3.1; if (!blocked(x, z) || R() < 0.3) tuft(x, z, 0.12, 2, 0.1, 0.35); }
  for (let i = 0; i < 40; i++) { const x = P.x1 + 0.2 + R() * 1.3, z = 7.3 + R() * 16; tuft(x, z, 0.12, 3, 0.15, 0.4); }
  // 西北街区地面杂草 + 苔藓
  for (let i = 0; i < 140; i++) { const x = -23.5 + R() * 18, z = -11.8 + R() * 6; if (!blocked(x, z)) tuft(x, z, 0.12, 3, 0.15, 0.4); }
  for (let i = 0; i < 40; i++) { const x = -23.5 + R() * 2.3, z = -23.5 + R() * 20; tuft(x, z, 0.12, 3, 0.2, 0.45); }
  for (let i = 0; i < 40; i++) { const x = -23.5 + R() * 20, z = -23.5 + R() * 2.3; tuft(x, z, 0.12, 3, 0.2, 0.45); }
  tree(-22.5, -9.5, 5.2, 0.9); tree(-6.0, -10.6, 4.4, 0.8);
  // 东北角零碎
  tree(22.8, -12.5, 4.8, 0.85);
  for (let i = 0; i < 50; i++) { const x = 22.3 + R() * 1.4, z = -23.5 + R() * 18; tuft(x, z, 0.12, 3, 0.15, 0.4); }

  // ---------- 灯光 ----------
  const lights = [];
  const pl = (x, y, z, col, I, d) => { const l = new THREE.PointLight(col, I, d, 1.6); l.position.set(x, y, z); root.add(l); lights.push(l); return l; };
  const fireL = pl(FX, 1.9, FZ, 0xff8a3a, 26, 9);
  const neonL = pl(SX + 1.0, 6.5, SZ + 1.0, 0xff4aa8, 16, 9);
  const cyanL = pl(-18.2, 2.3, -10.8, 0x40e0ff, 8, 6);
  const campL = pl(14, 2.6, -8.4, 0xffb060, 8, 8);
  // 灯笼（栈桥 + 屋顶菜园）
  const lanternM = glow(5.0, 3.0, 1.1);
  for (const p of [pierLantern, gardenLantern]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.2), lanternM); m.position.set(...p); root.add(m); }
  const pierL = pl(pierLantern[0], pierLantern[1] + 0.3, pierLantern[2], 0xffaa55, 9, 6);
  const gardenL = pl(gardenLantern[0], gardenLantern[1] + 0.3, gardenLantern[2], 0xffaa55, 7, 5);

  // ---------- 组装 ----------
  // 散落一些花
  for (let i = 0; i < 90; i++) { const x = -23 + R() * 46, z = -23 + R() * 46; if (!roadAt(x, z) && !blocked(x, z) && !(x < P.x1 && x > P.x0 && z > P.z0)) flower(x, z, heightAt(x, z)); }
  for (const k in B) B[k].build(root);
  root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.material.isMeshToonMaterial) { o.castShadow = true; o.receiveShadow = true; } });

  // ---------- A* 寻路 ----------
  function findPath(sx, sz, tx, tz) {
    const s = cell(sx, sz); let t = cell(tx, tz);
    if (s < 0 || t < 0) return null;
    if (grid[t]) { // 找最近的可走点
      let best = -1, bd = 1e9; const ti = t % GN, tj = (t / GN) | 0;
      for (let r = 1; r < 8 && best < 0; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const i = ti + di, j = tj + dj; if (i < 0 || j < 0 || i >= GN || j >= GN || grid[j * GN + i]) continue;
        const d = di * di + dj * dj; if (d < bd) { bd = d; best = j * GN + i; }
      }
      if (best < 0) return null; t = best;
    }
    const g = new Float32Array(GN * GN).fill(1e9), from = new Int32Array(GN * GN).fill(-1), closed = new Uint8Array(GN * GN);
    const open = [s]; g[s] = 0;
    const hf = (k) => Math.hypot((k % GN) - (t % GN), ((k / GN) | 0) - ((t / GN) | 0));
    const f = new Float32Array(GN * GN).fill(1e9); f[s] = hf(s);
    let it = 0;
    while (open.length && it++ < 20000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i;
      const k = open[bi]; open.splice(bi, 1);
      if (k === t) break;
      closed[k] = 1;
      const ki = k % GN, kj = (k / GN) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = ki + di, j = kj + dj; if (i < 0 || j < 0 || i >= GN || j >= GN) continue;
        const n = j * GN + i; if (grid[n] && n !== s || closed[n]) continue;
        if (di && dj && (grid[kj * GN + i] || grid[j * GN + ki])) continue;
        const ng = g[k] + (di && dj ? 1.414 : 1);
        if (ng < g[n]) { g[n] = ng; f[n] = ng + hf(n); from[n] = k; if (!open.includes(n)) open.push(n); }
      }
    }
    if (from[t] < 0 && t !== s) return null;
    const pts = []; for (let k = t; k >= 0; k = from[k]) pts.push([(k % GN) * GS - H + GS / 2, ((k / GN) | 0) * GS - H + GS / 2]);
    pts.reverse();
    // 视线简化
    const los = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (GS / 3)); for (let i = 1; i < n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, z = a[1] + (b[1] - a[1]) * i / n; if (blocked(x, z)) return false; } return true; };
    const out = [pts[0]]; let i = 0;
    while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !los(pts[i], pts[j])) j--; out.push(pts[j]); i = j; }
    if (!grid[cell(tx, tz)]) out[out.length - 1] = [tx, tz];
    return out.slice(1);
  }

  // ---------- 动画 ----------
  const flick = (t, s) => { const a = Math.sin(t * 13 + s) * 0.5 + Math.sin(t * 31 + s * 2) * 0.3 + Math.sin(t * 7.3 + s * 3) * 0.2; return a; };
  function update(t) {
    for (const f of flames) { const k = flick(t, f.userData.ph); f.scale.set(1 + k * 0.15, 1 + k * 0.35, 1 + k * 0.15); f.position.y = 1.3 + 0.1 * k; f.rotation.y = t * 2 + f.userData.ph; }
    fireL.intensity = 26 * (1 + flick(t, 1) * 0.25);
    campL.intensity = 8 * (1 + flick(t * 0.3, 5) * 0.05);
    // 霓虹：E 抽搐闪烁，整体偶尔掉电
    const blackout = Math.sin(t * 0.7) > 0.985 || (Math.sin(t * 5.1) > 0.97 && Math.sin(t * 0.37) > 0.4);
    for (const L of letters) {
      if (L.state === 'dead') continue;
      let k = blackout ? 0.08 : 1;
      if (L.state === 'flicker') { const s = Math.sin(t * 23) + Math.sin(t * 7.7) + Math.sin(t * 2.1) * 1.5; k *= s > 0.6 ? 1 : s > -0.4 ? 0.12 : 0.6; }
      const b = L.m.userData.base; L.m.color.setRGB(b[0] * k, b[1] * k, b[2] * k);
    }
    neonL.intensity = blackout ? 1 : 16;
    const ck = (Math.sin(t * 17) + Math.sin(t * 3.3) > 1.2) ? 0.1 : 1;
    { const b = neonCyan.userData.base; neonCyan.color.setRGB(b[0] * ck, b[1] * ck, b[2] * ck); cyanL.intensity = 8 * ck; }
    const am = tlAmber.material, on = Math.floor(t * 1.2) % 2 === 0; am.color.setRGB(on ? 5 : 0.3, on ? 2.5 : 0.15, on ? 0.3 : 0.02);
    const lk = 1 + flick(t * 0.5, 9) * 0.08; pierL.intensity = 9 * lk; gardenL.intensity = 7 * lk;
  }

  return {
    root, update, heightAt, blocked, findPath, water,
    fire: [FX, 1.3, FZ], drips,
    roofY: RY + 0.0, balconyY: 3.12,
  };
}
