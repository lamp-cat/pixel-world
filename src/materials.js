// 共享材质：分段卡通光照 + 世界坐标像素噪点 + 顶点摆动（草/藤/树冠）
import * as THREE from 'three';

export const U = { time: { value: 0 }, wind: { value: 1 } };

let grad = null;
export function gradientMap() {
  if (grad) return grad;
  const v = [16, 52, 140, 218, 255];
  const d = new Uint8Array(v.length * 4);
  v.forEach((x, i) => d.set([x, x, x, 255], i * 4));
  grad = new THREE.DataTexture(d, v.length, 1, THREE.RGBAFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter;
  grad.generateMipmaps = false;
  grad.needsUpdate = true;
  return grad;
}

// mode: 0 草（越高越摆） 1 垂挂（越低越摆） 2 整体
const SWAY = (mode) => `
#ifdef USE_INSTANCING
  vec3 sIp = vec3(instanceMatrix[3].xyz);
#else
  vec3 sIp = vec3(modelMatrix[3].xyz);
#endif
  float sPh = uTime * 1.6 + sIp.x * 0.37 + sIp.z * 0.23;
  float sH = ${mode === 0 ? 'max(position.y, 0.0)' : mode === 1 ? '(0.5 - position.y)' : '1.0'};
  float sA = aSway * uWind;
  transformed.x += (sin(sPh) + 0.45 * sin(sPh * 2.7 + 1.3)) * sA * sH;
  transformed.z += cos(sPh * 0.83 + 0.7) * sA * sH * 0.6;
`;
const WP = `
  vec4 wpp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wpp = instanceMatrix * wpp;
#endif
  vWP = (modelMatrix * wpp).xyz;
`;
const NOISE = `
  vec3 qn = floor(vWP * uNoiseScale + 0.001);
  float hn = fract(sin(dot(qn, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  diffuseColor.rgb *= 1.0 + (hn - 0.5) * uNoise;
`;

function patch(m, { noise = 0.1, scale = 4, sway = null, normal = false } = {}) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.uniforms.uWind = U.wind;
    sh.uniforms.uNoise = { value: noise };
    sh.uniforms.uNoiseScale = { value: scale };
    let vs = 'uniform float uTime;\nuniform float uWind;\nvarying vec3 vWP;\n' + (sway !== null ? 'attribute float aSway;\n' : '') + sh.vertexShader;
    if (sway !== null) vs = vs.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY(sway));
    vs = vs.replace('#include <project_vertex>', '#include <project_vertex>\n' + WP);
    sh.vertexShader = vs;
    if (!normal) {
      sh.fragmentShader = 'uniform float uNoise;\nuniform float uNoiseScale;\nvarying vec3 vWP;\n' +
        sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + NOISE);
    }
  };
  m.customProgramCacheKey = () => `rd-${noise}-${scale}-${sway}-${normal}`;
  return m;
}

const normalCache = new Map();
export function normalMat(sway = null) {
  const k = String(sway);
  if (!normalCache.has(k)) normalCache.set(k, patch(new THREE.MeshNormalMaterial(), { sway, normal: true }));
  return normalCache.get(k);
}

const toonCache = new Map();
// 实例化网格用白色基色 + instanceColor；角色等普通网格用 color
export function toon(color = 0xffffff, opts = {}) {
  const key = `${color}-${JSON.stringify(opts)}`;
  if (toonCache.has(key)) return toonCache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), side: opts.side ?? THREE.FrontSide });
  patch(m, opts);
  m.userData.nmat = normalMat(opts.sway ?? null);
  toonCache.set(key, m);
  return m;
}

// 自发光（HDR 颜色 > 1 才会被泛光提取）
export function glow(r, g, b) {
  const m = new THREE.MeshBasicMaterial();
  m.color.setRGB(r, g, b);
  m.userData.base = [r, g, b];
  m.userData.nmat = normalMat(null);
  return m;
}
