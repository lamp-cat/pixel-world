// 像素管线：低分辨率 HDR 渲染 → 深度/法线描边 → 泛光 → 最近邻放大 + 亚像素平移补偿
import * as THREE from 'three';
import { normalMat } from './materials.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const mat = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });

const OUTLINE = `
uniform sampler2D tColor, tDepth, tNormal; uniform vec2 res; uniform float depthRange, thr;
varying vec2 vUv;
float rawD(vec2 o){ return texture2D(tDepth, vUv + o / res).r; }
vec3 N(vec2 o){ return texture2D(tNormal, vUv + o / res).rgb * 2. - 1.; }
void main(){
  vec4 c = texture2D(tColor, vUv);
  float r0 = rawD(vec2(0));
  if (r0 >= 0.99999) { gl_FragColor = vec4(c.rgb, 0.); return; }
  float d = r0 * depthRange; vec3 n = N(vec2(0));
  float dEdge = 0., nEdge = 0.;
  vec2 o[4]; o[0] = vec2(1, 0); o[1] = vec2(-1, 0); o[2] = vec2(0, 1); o[3] = vec2(0, -1);
  for (int i = 0; i < 4; i++) {
    float rn = rawD(o[i]);
    float diff = (rn >= 0.99999 ? 1000. : rn * depthRange) - d;
    dEdge = max(dEdge, diff);
    vec3 nn = N(o[i]);
    float nd = dot(n - nn, vec3(1., 1., 1.));
    float ni = smoothstep(-.01, .01, nd);
    float di = step(-thr * 0.5, diff);
    nEdge += (1. - dot(n, nn)) * ni * di;
  }
  vec3 col = c.rgb;
  bool emis = max(col.r, max(col.g, col.b)) > 2.4;   // 发光体不描边
  if (emis) {} else if (dEdge > thr) {
    float l = dot(col, vec3(.3, .55, .15));
    col = mix(col, vec3(l), -0.25) * 0.45;          // 更暗、略加饱和的本地色
    col *= vec3(0.92, 0.9, 1.08);
  } else if (nEdge > 0.3) {
    col *= 1.32;                                     // 凸棱提亮
  }
  gl_FragColor = vec4(col, 1.);
}`;

const BRIGHT = `
uniform sampler2D tSrc; uniform vec2 res; uniform float thr; varying vec2 vUv;
void main(){
  vec3 s = vec3(0.);
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(float(i - (i / 2) * 2) - .5, float(i / 2) - .5) / res;
    vec4 c = texture2D(tSrc, vUv + o);
    s += max(c.rgb - thr, 0.) * c.a + max(c.rgb - 0.6, 0.) * (1. - c.a); // 背景上的萤火虫也发光
  }
  gl_FragColor = vec4(s * 0.25, 1.);
}`;

const BLUR = `
uniform sampler2D tSrc; uniform vec2 res, dir; varying vec2 vUv;
void main(){
  vec3 s = texture2D(tSrc, vUv).rgb * 0.227;
  vec2 st = dir / res;
  s += (texture2D(tSrc, vUv + st * 1.38).rgb + texture2D(tSrc, vUv - st * 1.38).rgb) * 0.316;
  s += (texture2D(tSrc, vUv + st * 3.23).rgb + texture2D(tSrc, vUv - st * 3.23).rgb) * 0.070;
  gl_FragColor = vec4(s, 1.);
}`;

const FINAL = `
uniform sampler2D tScene, tBloom, tBloom2; uniform vec2 lowRes, shift; uniform vec3 bgTop, bgBot, grade;
uniform float bloomStr, vign, sat;
varying vec2 vUv;
void main(){
  vec2 uv = vUv - shift / lowRes;
  vec2 p = (floor(uv * lowRes) + 0.5) / lowRes;
  vec4 c = texture2D(tScene, p);
  vec2 q = vUv - .5;
  vec3 bg = mix(bgBot, bgTop, smoothstep(0., 1., vUv.y + q.x * .15));
  vec3 col = c.a > .5 ? c.rgb : bg + c.rgb;
  col += (texture2D(tBloom, uv).rgb * 0.6 + texture2D(tBloom2, uv).rgb * 0.8) * bloomStr;
  float l = dot(col, vec3(.3, .55, .15));
  col = max(mix(vec3(l), col, sat), 0.) * grade;
  col = mix(col, 0.8 + 0.2 * (1. - exp(-(col - 0.8) / 0.2)), step(0.8, col));
  col *= 1. - vign * dot(q, q) * 1.6;
  col = pow(clamp(col, 0., 1.), vec3(1. / 2.2));
  gl_FragColor = vec4(col, 1.);
}`;

export class Post {
  constructor(renderer) {
    this.r = renderer;
    this.qs = new THREE.Scene();
    this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qs.add(this.quad);
    this.mOutline = mat(OUTLINE, { tColor: { value: null }, tDepth: { value: null }, tNormal: { value: null }, res: { value: new THREE.Vector2() }, depthRange: { value: 1 }, thr: { value: 0.5 } });
    this.mBright = mat(BRIGHT, { tSrc: { value: null }, res: { value: new THREE.Vector2() }, thr: { value: 1.25 } });
    this.mBlur = mat(BLUR, { tSrc: { value: null }, res: { value: new THREE.Vector2() }, dir: { value: new THREE.Vector2() } });
    this.mFinal = mat(FINAL, {
      tScene: { value: null }, tBloom: { value: null }, tBloom2: { value: null }, lowRes: { value: new THREE.Vector2() }, shift: { value: new THREE.Vector2() },
      bgTop: { value: new THREE.Color() }, bgBot: { value: new THREE.Color() }, grade: { value: new THREE.Vector3(1, 1, 1) },
      bloomStr: { value: 1.0 }, vign: { value: 0.35 }, sat: { value: 1.1 },
    });
    this.normalMeshes = [];
  }
  setSize(w, h, px) {
    this.lw = Math.ceil(w / px); this.lh = Math.ceil(h / px);
    const N = THREE.NearestFilter, L = THREE.LinearFilter;
    const mk = (W, H, f, depth = false, type = THREE.HalfFloatType) => new THREE.WebGLRenderTarget(W, H, { minFilter: f, magFilter: f, type, depthBuffer: depth, generateMipmaps: false });
    [this.rtColor, this.rtNormal, this.rtOut, this.b1, this.b2, this.c1, this.c2].forEach((t) => t && t.dispose());
    this.rtColor = mk(this.lw, this.lh, N, true);
    this.rtColor.depthTexture = new THREE.DepthTexture(this.lw, this.lh);
    this.rtColor.depthTexture.type = THREE.UnsignedIntType;
    this.rtNormal = mk(this.lw, this.lh, N, true, THREE.UnsignedByteType);
    this.rtOut = mk(this.lw, this.lh, L);
    const bw = Math.ceil(this.lw / 2), bh = Math.ceil(this.lh / 2);
    this.b1 = mk(bw, bh, L); this.b2 = mk(bw, bh, L);
    const cw = Math.ceil(this.lw / 5), ch = Math.ceil(this.lh / 5);
    this.c1 = mk(cw, ch, L); this.c2 = mk(cw, ch, L);
  }
  collectNormals(scene) {
    this.normalMeshes = [];
    scene.traverse((o) => { if ((o.isMesh || o.isInstancedMesh) && o.layers.isEnabled(0) && !o.userData.noNormal) this.normalMeshes.push(o); });
  }
  pass(m, target) { this.quad.material = m; this.r.setRenderTarget(target); this.r.render(this.qs, this.qc); }
  blur(src, tmp, w, h, rad) {
    this.mBlur.uniforms.res.value.set(w, h);
    this.mBlur.uniforms.tSrc.value = src.texture; this.mBlur.uniforms.dir.value.set(rad, 0); this.pass(this.mBlur, tmp);
    this.mBlur.uniforms.tSrc.value = tmp.texture; this.mBlur.uniforms.dir.value.set(0, rad); this.pass(this.mBlur, src);
  }
  render(scene, camera, opt) {
    const r = this.r;
    // 1) 颜色（HDR）+ 深度
    r.shadowMap.needsUpdate = true;
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(this.rtColor); r.clear(); r.render(scene, camera);
    // 2) 法线
    const saved = this.normalMeshes.map((m) => m.material);
    this.normalMeshes.forEach((m) => { m.material = m.userData.nmat || m.material.userData?.nmat || normalMat(null); });
    camera.layers.disable(1);
    const bgS = scene.background; scene.background = null;
    r.setClearColor(0x8080ff, 1);
    r.setRenderTarget(this.rtNormal); r.clear(); r.render(scene, camera);
    camera.layers.enable(1); scene.background = bgS;
    this.normalMeshes.forEach((m, i) => { m.material = saved[i]; });
    // 3) 描边
    const u = this.mOutline.uniforms;
    u.tColor.value = this.rtColor.texture; u.tDepth.value = this.rtColor.depthTexture; u.tNormal.value = this.rtNormal.texture;
    u.res.value.set(this.lw, this.lh); u.depthRange.value = camera.far - camera.near; u.thr.value = opt.depthThr;
    this.pass(this.mOutline, this.rtOut);
    // 4) 泛光：两级
    this.mBright.uniforms.tSrc.value = this.rtOut.texture; this.mBright.uniforms.res.value.set(this.lw, this.lh);
    this.pass(this.mBright, this.b1);
    this.blur(this.b1, this.b2, this.b1.width, this.b1.height, 1.0);
    this.mBright.uniforms.tSrc.value = this.b1.texture; this.mBright.uniforms.thr.value = 0.0;
    this.mBright.uniforms.res.value.set(this.b1.width, this.b1.height);
    // 复用 BRIGHT（阈值 0）做降采样
    this.pass(this.mBright, this.c1);
    this.mBright.uniforms.thr.value = opt.bloomThr ?? 1.25;
    this.blur(this.c1, this.c2, this.c1.width, this.c1.height, 1.0);
    this.blur(this.c1, this.c2, this.c1.width, this.c1.height, 2.0);
    // 5) 合成到屏幕
    const f = this.mFinal.uniforms;
    f.tScene.value = this.rtOut.texture; f.tBloom.value = this.b1.texture; f.tBloom2.value = this.c1.texture;
    f.lowRes.value.set(this.lw, this.lh); f.shift.value.copy(opt.shift);
    this.pass(this.mFinal, null);
  }
}
