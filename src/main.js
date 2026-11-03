import * as THREE from 'three';
import { Post } from './post.js';
import { U } from './materials.js';
import { buildWorld, H } from './world.js';
import { spawnCast } from './characters.js';
import { spawnParticles } from './particles.js';

const Q = new URLSearchParams(location.search);
const CAPTURE = Q.has('capture');
const NIGHT = Q.get('time') === 'night';
U.zoom = U.zoom || { value: 1 };

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const scene = new THREE.Scene();
const world = buildWorld(scene, { night: NIGHT });
const cast = spawnCast(scene, world);
const parts = spawnParticles(scene, world, NIGHT);

// ---------- 光照：黄昏 / 夜晚 ----------
const sunDir = new THREE.Vector3(-0.55, 0.62, 0.82).normalize();
const sun = new THREE.DirectionalLight(NIGHT ? 0x8fa6ff : 0xffb47e, NIGHT ? 2.0 : 5.0);
sun.position.copy(sunDir).multiplyScalar(60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 1, far: 140 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const SH_TEXEL = 84 / 2048;
const SUN_R = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), sunDir).normalize();
const SUN_U = new THREE.Vector3().crossVectors(sunDir, SUN_R).normalize();
const hemi = new THREE.HemisphereLight(NIGHT ? 0x3a4a80 : 0x8a8ee0, NIGHT ? 0x1a1a2a : 0x4a3a40, NIGHT ? 1.6 : 2.5);
scene.add(hemi);
const fill = new THREE.DirectionalLight(NIGHT ? 0x3a4a90 : 0x7f86d8, NIGHT ? 0.6 : 1.3); // 冷色补光，照亮右侧断面
fill.position.set(40, 25, -10); scene.add(fill);
if (NIGHT) world.root.traverse((o) => { if (o.isPointLight) o.intensity *= 1.3; });

const post = new Post(renderer);
const fin = post.mFinal.uniforms;
const srgb = (h) => new THREE.Color(h);
fin.bgTop.value.copy(srgb(NIGHT ? 0x0b1020 : 0x161a30));
fin.bgBot.value.copy(srgb(NIGHT ? 0x182033 : 0x3a2c4a));
fin.grade.value.set(...(NIGHT ? [0.92, 0.98, 1.12] : [1.04, 0.98, 0.95]));
fin.bloomStr.value = NIGHT ? 1.3 : 1.0;
fin.sat.value = 1.22;

// ---------- 相机 ----------
const ELEV = THREE.MathUtils.degToRad(36);
const camDir = new THREE.Vector3(1, Math.tan(ELEV) * Math.SQRT2, 1).normalize();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
camera.layers.enable(1);
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const UPV = new THREE.Vector3(0, 1, 0).addScaledVector(camDir, -camDir.y).normalize(); // 屏幕向上方向
const cam = { focus: new THREE.Vector3(0, 0, 0), view: 60, viewTarget: 60, follow: 0, mode: 'intro', t: 0 };
let W = 0, Ht = 0, PX = 2;
function overviewView() { const a = W / Ht; return Math.max(64, 88 / a); }
function resize() {
  W = CAPTURE ? +(Q.get('w') || 960) : innerWidth; Ht = CAPTURE ? +(Q.get('h') || 540) : innerHeight;
  PX = +(Q.get('px') || Math.max(2, Math.round(Ht / 300)));
  renderer.setSize(W, Ht, !CAPTURE);
  if (CAPTURE) { canvas.style.width = W + 'px'; canvas.style.height = Ht + 'px'; }
  post.setSize(W, Ht, PX);
  if (cam.mode === 'intro' || cam.mode === 'overview') { cam.view = cam.viewTarget = overviewView(); }
}
addEventListener('resize', resize);
const CLOSE = 18;
const OVER_FOCUS = new THREE.Vector3(0, 2.2, 0);

const shift = new THREE.Vector2();
function placeCamera() {
  const v = cam.view, a = W / Ht;
  camera.left = -v * a / 2; camera.right = v * a / 2; camera.top = v / 2; camera.bottom = -v / 2;
  camera.updateProjectionMatrix();
  const P = cam.focus.clone().addScaledVector(camDir, 150);
  // 像素对齐：相机在其右/上轴上吸附到低分辨率像素网格，残差交给最终合成做亚像素平移
  const texel = v / post.lh;
  const r = P.dot(RIGHT), u = P.dot(UPV);
  const rs = Math.round(r / texel) * texel, us = Math.round(u / texel) * texel;
  P.addScaledVector(RIGHT, rs - r).addScaledVector(UPV, us - u);
  shift.set((rs - r) / texel, (us - u) / texel); // 补偿方向与吸附方向一致
  camera.position.copy(P); camera.up.set(0, 1, 0); camera.lookAt(P.clone().sub(camDir));
  U.zoom.value = CLOSE / v * 1.6;
  return texel;
}

// ---------- 输入 ----------
const keys = new Set();
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyO') { cam.mode = cam.mode === 'overview' ? 'follow' : 'overview'; cam.viewTarget = cam.mode === 'overview' ? overviewView() : CLOSE; }
  if (cam.mode === 'intro' && /Key[WASD]|Arrow/.test(e.code)) startFollow();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('wheel', (e) => {
  const ov = overviewView();
  cam.viewTarget = THREE.MathUtils.clamp(cam.viewTarget * Math.exp(e.deltaY * 0.0012), 12, ov);
  cam.mode = cam.viewTarget > ov * 0.9 ? 'overview' : 'follow';
}, { passive: true });
const ray = new THREE.Raycaster();
canvas.addEventListener('pointerdown', (e) => {
  const r = canvas.getBoundingClientRect();
  const nd = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(nd, camera);
  const o = ray.ray.origin, d = ray.ray.direction;
  const t = (0.1 - o.y) / d.y; const x = o.x + d.x * t, z = o.z + d.z * t;
  if (Math.abs(x) < H && Math.abs(z) < H) { cast.player.goTo(x, z); if (cam.mode !== 'follow') startFollow(); marker(x, z); }
});
function startFollow() { cam.mode = 'follow'; cam.viewTarget = CLOSE; }
// 点击标记
const mk = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.4, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 1.6), transparent: true }));
mk.layers.set(1); mk.visible = false; scene.add(mk);
let mkT = 0;
function marker(x, z) { mk.position.set(x, world.heightAt(x, z) + 0.05, z); mk.visible = true; mkT = 1; }

function inputDir() {
  let f = 0, s = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
  if (scripted) return scripted;
  // 屏幕上 = 世界 (-1,0,-1)，屏幕右 = (1,0,-1)
  return { x: (-f + s) * Math.SQRT1_2, z: (-f - s) * Math.SQRT1_2 };
}
let scripted = null;

// ---------- 主循环 ----------
let time = 0;
function update(dt) {
  time += dt; U.time.value = time;
  cam.t += dt;
  cast.update(dt, inputDir(), time);
  world.update(time);
  // 园丁浇水的水滴
  const gd = cast.gardener;
  const on = gd.anim === 'water' && gd.fig.props.can.visible ? 1 : 0;
  parts.drops.material.uniforms.uOn.value = on;
  if (on) { gd.fig.props.can.localToWorld(parts.drops.material.uniforms.uOrigin.value.set(0, -0.05, 0.45)); }
  if (mkT > 0) { mkT -= dt * 0.8; mk.material.opacity = Math.max(0, mkT); mk.scale.setScalar(1 + (1 - mkT) * 0.6); if (mkT <= 0) mk.visible = false; }
  // 相机
  if (!CAPTURE && cam.mode === 'intro' && cam.t > 3.0) startFollow();
  const pp = cast.player.pos;
  const want = cam.mode === 'follow' ? 1 : 0;
  cam.follow += (want - cam.follow) * Math.min(1, dt * 1.4);
  cam.view += (cam.viewTarget - cam.view) * Math.min(1, dt * 1.8);
  const tgt = OVER_FOCUS.clone().lerp(new THREE.Vector3(pp.x, pp.y + 0.6, pp.z), cam.follow);
  cam.focus.lerp(tgt, Math.min(1, dt * 3.0));
  if (camOverride) { cam.focus.copy(camOverride.focus); cam.view = camOverride.view; }
  // 阴影相机跟随焦点（保持阴影精度）
  // 阴影中心吸附到阴影贴图像素网格（在光源空间里），避免阴影边缘跳动
  const T = new THREE.Vector3(cam.focus.x, 0, cam.focus.z);
  const a = Math.round(T.dot(SUN_R) / SH_TEXEL) * SH_TEXEL, b = Math.round(T.dot(SUN_U) / SH_TEXEL) * SH_TEXEL, c = T.dot(sunDir);
  sun.target.position.set(0, 0, 0).addScaledVector(SUN_R, a).addScaledVector(SUN_U, b).addScaledVector(sunDir, c);
  sun.position.copy(sun.target.position).addScaledVector(sunDir, 60);
}
let camOverride = null;
function render() {
  const texel = placeCamera();
  post.render(scene, camera, { shift, depthThr: Math.max(0.35, texel * 2.8), bloomThr: 1.2 });
}
resize();
post.collectNormals(scene);

// 渐隐提示
const hint = document.getElementById('hint');
if (CAPTURE) hint.style.display = 'none'; else setTimeout(() => (hint.style.opacity = 0), 7000);

if (!CAPTURE) {
  let last = performance.now();
  const loop = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); render(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
} else {
  // 录制/截图接口（固定步长，确定性）
  window.__step = (dt, n = 1) => { for (let i = 0; i < n; i++) update(dt); render(); };
  window.__goto = (x, z) => cast.player.goTo(x, z);
  window.__dir = (x, z) => { scripted = x === null ? null : { x, z }; };
  window.__follow = (on) => { on ? startFollow() : (cam.mode = 'overview', cam.viewTarget = overviewView()); };
  window.__view = (v) => { cam.viewTarget = v; };
  window.__camSet = (fx, fy, fz, v) => { camOverride = fx === null ? null : { focus: new THREE.Vector3(fx, fy, fz), view: v }; };
  window.__player = (x, z) => { cast.player.pos.set(x, world.heightAt(x, z), z); cast.player.trail.push([x, z]); };
  window.__actors = () => cast.actors.map((a) => [a.name || '', a.pos.x.toFixed(1), a.pos.y.toFixed(2), a.pos.z.toFixed(1), a.anim]);
  window.__state = () => ({ p: [cast.player.pos.x, cast.player.pos.z], path: !!cast.player.path, view: cam.view });
  window.__snapCam = () => { cam.view = cam.viewTarget; cam.follow = cam.mode === 'follow' ? 1 : 0; const pp = cast.player.pos; cam.focus.copy(OVER_FOCUS.clone().lerp(new THREE.Vector3(pp.x, pp.y + 0.6, pp.z), cam.follow)); };
  update(1 / 30); render();
  window.__ready = true;
}
