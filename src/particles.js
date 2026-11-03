// GPU 粒子：萤火虫、火星、烟、浮尘、水滴 —— 全部在顶点着色器里按时间计算
import * as THREE from 'three';
import { U } from './materials.js';

const VS = (body) => `
uniform float uTime, uZoom; uniform vec3 uOrigin, uArea; uniform float uOn;
attribute vec4 aSeed;
varying vec4 vCol; varying float vRound;
void main(){
  vec3 p; float size; vec4 col; vRound = 0.;
  ${body}
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(size, 1.);
  vCol = col;
}`;
const FS = `
varying vec4 vCol; varying float vRound;
void main(){
  if (vRound > 0.5 && length(gl_PointCoord - 0.5) > 0.5) discard;
  if (vCol.a < 0.01) discard;
  gl_FragColor = vCol;
}`;

const BODIES = {
  firefly: `
    float t = uTime * (0.25 + aSeed.w * 0.2) + aSeed.x * 50.;
    p = uOrigin + (aSeed.xyz - 0.5) * uArea + vec3(sin(t) * 0.9, sin(t * 1.7 + aSeed.y * 9.) * 0.35 + 0.5, cos(t * 0.8 + aSeed.z * 7.) * 0.9);
    float bl = pow(0.5 + 0.5 * sin(uTime * (1.2 + aSeed.w) + aSeed.y * 40.), 5.);
    size = 1. + step(0.6, bl) * (uZoom > 1.5 ? 1. : 0.);
    col = vec4(vec3(2.2, 3.4, 0.9) * (0.15 + bl * 1.4), 1.) * uOn;`,
  spark: `
    float life = fract(uTime * (0.5 + aSeed.w * 0.4) + aSeed.x);
    p = uOrigin + vec3((aSeed.y - .5) * 0.5 + sin(life * 7. + aSeed.z * 20.) * 0.35 * life, life * 3.2, (aSeed.z - .5) * 0.5 + cos(life * 6. + aSeed.y * 20.) * 0.35 * life);
    size = 1.;
    col = vec4(vec3(6., 2.6, 0.6) * (1. - life) * step(0.15, fract(aSeed.w * 7. + uTime * 3.)), 1.);`,
  smoke: `
    float life = fract(uTime * 0.09 + aSeed.x);
    p = uOrigin + vec3(life * 2.6 + sin(life * 5. + aSeed.y * 6.) * 0.35, life * 6.5, -life * 1.2 + cos(life * 4. + aSeed.z * 6.) * 0.35);
    size = (2.5 + life * 9. * (0.7 + aSeed.w * 0.6)) * uZoom;
    vRound = 1.;
    float a = smoothstep(0., 0.12, life) * (1. - life);
    col = vec4(mix(vec3(0.45, 0.38, 0.42), vec3(0.28, 0.26, 0.34), life), a * 0.55);`,
  dust: `
    float t = uTime * 0.05 + aSeed.x * 10.;
    p = uOrigin + vec3(fract(aSeed.x + t * 0.2) - .5, fract(aSeed.y + sin(t) * 0.05), fract(aSeed.z + t * 0.13) - .5) * uArea;
    size = 1.;
    float a = 0.5 + 0.5 * sin(uTime * 0.7 + aSeed.w * 30.);
    col = vec4(vec3(1.0, 0.8, 0.6) * 0.3 * a, 1.) * uOn;`,
  drops: `
    float life = fract(uTime * 1.6 + aSeed.x);
    p = uOrigin + vec3((aSeed.y - .5) * 0.12, -life * life * 1.1, (aSeed.z - .5) * 0.12 + life * 0.15);
    size = 1.;
    col = vec4(vec3(0.6, 0.9, 1.3), 1.) * uOn;`,
  drip: `
    float life = fract(uTime * (0.35 + aSeed.y * 0.2) + aSeed.x);
    p = uOrigin + vec3(0., -life * life * 5.5, 0.);
    size = 1.;
    col = vec4(vec3(0.5, 0.8, 1.0) * step(0.2, life), 1.);`,
};

export function makeParticles(scene, type, n, origin, area = [1, 1, 1], { additive = true, on = 1 } = {}) {
  const g = new THREE.BufferGeometry();
  const seeds = new Float32Array(n * 4); for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time, uZoom: U.zoom || (U.zoom = { value: 1 }), uOrigin: { value: new THREE.Vector3(...origin) }, uArea: { value: new THREE.Vector3(...area) }, uOn: { value: on } },
    vertexShader: VS(BODIES[type]), fragmentShader: FS, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false; pts.layers.set(1); pts.renderOrder = additive ? 3 : 2;
  scene.add(pts);
  return pts;
}

export function spawnParticles(scene, world, night) {
  const [fx, fy, fz] = world.fire;
  const P = {};
  P.sparks = makeParticles(scene, 'spark', 40, [fx, fy + 0.1, fz]);
  P.smoke = makeParticles(scene, 'smoke', 26, [fx, fy + 0.4, fz], [1, 1, 1], { additive: false });
  P.smoke2 = makeParticles(scene, 'smoke', 14, [-12.5, 1.0, -10.5], [1, 1, 1], { additive: false }); // 冒烟的瓦砾
  const ff = night ? 1 : 0.7;
  P.ff1 = makeParticles(scene, 'firefly', Math.round(70 * ff), [13, 1.2, 14], [17, 2.5, 17]);
  P.ff2 = makeParticles(scene, 'firefly', Math.round(50 * ff), [-13, 0.2, 13], [16, 2, 14]);
  P.ff3 = makeParticles(scene, 'firefly', Math.round(20 * ff), [-7.5, 6.5, -17], [5, 1.5, 7]);
  P.dust = makeParticles(scene, 'dust', 70, [0, 0.2, 0], [46, 9, 46], { on: night ? 0.4 : 1 });
  P.drops = makeParticles(scene, 'drops', 18, [0, 0, 0], [1, 1, 1], { on: 0 });
  P.drip = [];
  for (const d of world.drips) P.drip.push(makeParticles(scene, 'drip', 3, d));
  return P;
}
