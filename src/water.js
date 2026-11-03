// 风格化水体：水面（深浅色、像素闪光、涟漪、泡沫线）+ 剖面体积（渐变、光带、气泡）
import * as THREE from 'three';
import { U, normalMat } from './materials.js';

export function makeWater({ x0, x1, z0, z1, y0, y1, night, obstacles }) {
  const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.time,
      uRect: { value: new THREE.Vector4(x0, z0, x1, z1) },
      uTop: { value: y1 }, uBot: { value: y0 },
      uObs: { value: obstacles.map((o) => new THREE.Vector4(...o)) }, // 旋转矩形: cx, cz, 半长(含角度编码) → 用 (cx,cz,rx,rz) 轴对齐 + 角度另传
      uObsA: { value: obstacles.map((o) => o[4] || 0) },
      uBob: { value: new THREE.Vector3(0, 0, 0) }, // xz + 涟漪强度
      uNight: { value: night ? 1 : 0 },
    },
    vertexShader: `
      varying vec3 vWP; varying vec3 vN;
      void main(){ vec4 w = modelMatrix * vec4(position,1.); vWP = w.xyz; vN = normal; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime, uTop, uBot, uNight; uniform vec4 uRect; uniform vec4 uObs[${obstacles.length}]; uniform float uObsA[${obstacles.length}]; uniform vec3 uBob;
      varying vec3 vWP; varying vec3 vN;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
      float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }
      void main(){
        vec3 deep = mix(vec3(0.020, 0.090, 0.120), vec3(0.010, 0.030, 0.070), uNight);
        vec3 shal = mix(vec3(0.060, 0.230, 0.240), vec3(0.020, 0.080, 0.130), uNight);
        vec3 foam = mix(vec3(0.85, 0.80, 0.72), vec3(0.45, 0.55, 0.75), uNight);
        vec3 warm = mix(vec3(0.90, 0.42, 0.20), vec3(0.25, 0.35, 0.65), uNight);
        if (vN.y > 0.5) {
          vec2 p = floor(vWP.xz * 10.) / 10.;               // 量化到像素网格
          vec2 c = (uRect.xy + uRect.zw) * .5, hs = (uRect.zw - uRect.xy) * .5;
          float shore = -sdBox(p - c, hs);
          shore = min(shore, 999.);
          float dObs = 999.;
          for (int i = 0; i < ${obstacles.length}; i++) {
            vec4 o = uObs[i]; float a = uObsA[i];
            vec2 q = p - o.xy; q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
            dObs = min(dObs, sdBox(q, o.zw));
          }
          float wob = vn(p * 1.3 + uTime * 0.25) * 0.25;
          float d = min(shore, dObs) + wob - 0.1;
          float n = vn(p * 0.55 + vec2(uTime * 0.05, 0.)) * 0.6 + vn(p * 2.1 - uTime * 0.15) * 0.4;
          vec3 col = mix(shal, deep, smoothstep(0.2, 3.2, shore + n * 0.8));
          // 夕阳倒影：横向拉长的暖色条纹
          float streak = vn(vec2(p.x * 0.35, p.y * 3.0) + vec2(0., uTime * 0.3));
          col += warm * step(0.72, streak) * 0.22;
          col += vec3(0.05, 0.12, 0.13) * step(0.66, n);
          // 泡沫线：贴岸一条 + 向外推的一条
          float f1 = step(d, 0.14);
          float ring = abs(d - (0.42 + 0.18 * sin(uTime * 1.2 + p.x * 0.7 + p.y * 0.5)));
          float f2 = step(ring, 0.055) * step(0.45, vn(p * 3. + uTime * 0.4));
          col = mix(col, foam, max(f1, f2 * 0.75));
          // 鱼漂涟漪
          float rb = length(p - uBob.xy);
          float rp = fract(rb * 1.6 - uTime * 0.9);
          col = mix(col, foam * 0.9, step(abs(rp - .5), .06) * smoothstep(2.2, 0.3, rb) * uBob.z * step(0.18, rb));
          // 像素闪光
          vec2 cell = floor(vWP.xz * 4.);
          float hh = h21(cell);
          float tw = pow(0.5 + 0.5 * sin(uTime * 2.6 + hh * 60.), 12.);
          col += step(0.975, hh) * tw * mix(vec3(2.6, 2.0, 1.3), vec3(1.2, 1.5, 2.4), uNight) * smoothstep(0.3, 1.2, shore);
          gl_FragColor = vec4(col, 1.);
        } else {
          float depth = clamp((uTop - vWP.y) / (uTop - uBot), 0., 1.);
          float qd = floor(depth * 7.) / 7.;                    // 分段色带
          vec3 col = mix(shal * 1.5, deep * 0.8, qd);
          float ray = step(0.8, fract(vWP.x * 0.22 + vWP.y * 0.35 + sin(uTime * 0.4) * 0.15)) * (1. - depth);
          col += vec3(0.05, 0.12, 0.12) * ray;
          vec2 bc = floor(vec2(vWP.x * 6., vWP.y * 6. - uTime * 3.));
          col += step(0.985, h21(bc)) * vec3(0.25, 0.35, 0.35) * (1. - depth * 0.5);
          if (uTop - vWP.y < 0.09) col = foam * 0.95;
          gl_FragColor = vec4(col, 1.);
        }
      }`,
  });
  m.userData.nmat = normalMat(null);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  mesh.receiveShadow = false;
  return mesh;
}
