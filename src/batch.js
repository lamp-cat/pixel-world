import * as THREE from 'three';
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 把大量同几何体的小块合并成一个 InstancedMesh（每实例颜色 + 可选摆动幅度）
export class Batch {
  constructor(geo, mat, { cast = true, receive = true, sway = false } = {}) {
    Object.assign(this, { geo, mat, cast, receive, sway });
    this.m = []; this.c = []; this.w = [];
  }
  add(x, y, z, sx, sy, sz, color, ry = 0, rx = 0, rz = 0, jit = 0.05, sway = 0, rand = Math.random) {
    _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    this.m.push(_m.clone());
    if (color && color.isColor) _c.copy(color); else _c.set(color);
    if (jit) _c.multiplyScalar(1 + (rand() - 0.5) * 2 * jit);
    this.c.push(_c.r, _c.g, _c.b); this.w.push(sway);
  }
  addMatrix(m, color, sway = 0) { this.m.push(m.clone()); _c.set(color); this.c.push(_c.r, _c.g, _c.b); this.w.push(sway); }
  build(parent) {
    const n = this.m.length; if (!n) return null;
    const mesh = new THREE.InstancedMesh(this.geo, this.mat, n);
    for (let i = 0; i < n; i++) mesh.setMatrixAt(i, this.m[i]);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.c), 3);
    if (this.sway) this.geo.setAttribute('aSway', new THREE.InstancedBufferAttribute(new Float32Array(this.w), 1));
    mesh.castShadow = this.cast; mesh.receiveShadow = this.receive;
    mesh.frustumCulled = false;
    parent.add(mesh);
    return mesh;
  }
}

export function bladeGeo() {
  const pos = [], nor = [];
  const w = 0.1;
  for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const cx = Math.cos(a) * w, cz = Math.sin(a) * w;
    pos.push(-cx, 0, -cz, cx, 0, cz, 0, 1, 0);
    nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export function prismGeo() { // 帐篷：沿 z 的三棱柱，底宽 1 高 1 长 1
  const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.lineTo(-0.5, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5);
  return g.toNonIndexed();
}
