// Mountain temple at sunset: a winding stone path climbs through dense forest to a vermilion-and-gold
// temple on a plateau, while the sun sinks behind the ridge. Built from the ascii-diorama starter.
// Runs live in the browser and loops forever (Space pauses).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const W = 1440, HH = 1440, DURATION = 24;
const COLS = 200, ROWS = 100;
const CLS = { grass: 1, leaf: 2, flower: 3, stone: 4, stair: 5, red: 6, wood: 7, sand: 8, sky: 9, sun: 10, monk: 11, roof: 12, rock: 13, haze: 14, water: 15 };

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const hash2 = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), f = x - i, g = y - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g);
  return (hash2(i, j) * (1 - u) + hash2(i + 1, j) * u) * (1 - v) + (hash2(i, j + 1) * (1 - u) + hash2(i + 1, j + 1) * u) * v;
}
const fbm = (x, y) => vnoise(x, y) * .5 + vnoise(x * 2.1 + 3, y * 2.1) * .28 + vnoise(x * 4.3, y * 4.3 + 5) * .15 + vnoise(x * 8.7, y * 8.7) * .07;
let seed = 31;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

const time = { value: 0 };
function tag(mat, cls, extra) {
  mat.onBeforeCompile = (s) => {
    extra?.(s);
    s.fragmentShader = s.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>\n gl_FragColor.a = ${(cls / 16).toFixed(4)};`);
  };
  mat.customProgramCacheKey = () => `c${cls}${extra ? extra.toString().length : 0}`;
  return mat;
}
const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
function pixels(img, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
  return { d: x.getImageData(0, 0, w, h).data, w, h };
}
const texLoader = new THREE.TextureLoader();
function tex(url, rx = 1, ry = 1) { const t = texLoader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t; }

// ---------- land: foot of the mountain at the bottom (+z), temple plateau, ridge behind (-z) ----------
const PLAT_Y = 8, PX = 12.6, PZ0 = -16.8, PZ1 = -3.4;           // temple plateau rectangle
const creekZ = (x) => 14.2 + Math.sin(x * .13 + 1) * 1.1;
function rawH(x, z) {
  const s = sstep(12.5, -3.6, z);
  let y = .35 + (PLAT_Y - .35) * Math.pow(s, .95);
  y -= sstep(14, 34, Math.abs(x)) * 3.2 * s;                       // the mountain is a spur, falls away at the sides
  y += (fbm(x * .11 + 4, z * .11) - .5) * 3.4 * s * (1 - s) * 2.2;  // lumpy slope
  y += (fbm(x * .5, z * .5) - .5) * .5 * (1 - s * .5);
  // ridge behind the temple, crest around z=-24
  const r = sstep(PZ0 + .5, -21.5, z) * (1 - sstep(-25, -32, z) * .5);
  const crest = 3.2 + 3.4 * fbm(x * .05 + 7, 2.2);
  y += r * crest;
  // flat plateau
  const dx = Math.max(0, Math.abs(x) - PX), dz = Math.max(0, PZ0 - z, z - PZ1), d = Math.hypot(dx, dz);
  y = THREE.MathUtils.lerp(y, PLAT_Y, sstep(1.6, 0, d));
  // creek at the foot
  const cd = Math.abs(z - creekZ(x));
  y = THREE.MathUtils.lerp(y, -.7, sstep(2.6, .9, cd));
  return y;
}
const PATH = [[0, -3.9], [0, -2], [-2.4, .2], [-5.6, 1.6], [-6.6, 3.6], [-4.6, 5.6], [-.4, 6.6], [3.8, 7.6], [5.8, 9.4], [5.2, 11.4]];
const pathCurve = new THREE.CatmullRomCurve3(PATH.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', .5);
const pathLen = pathCurve.getLength();
const pathS = [];
for (let i = 0; i <= 500; i++) { const p = pathCurve.getPointAt(i / 500); pathS.push({ x: p.x, z: p.z, y: rawH(p.x, p.z) }); }
for (let pass = 0; pass < 7; pass++) {
  const c = pathS.map(s => s.y);
  for (let i = 0; i < c.length; i++) { let a = 0, n = 0; for (let k = -9; k <= 9; k++) { const v = c[i + k]; if (v !== undefined) { a += v; n++; } } pathS[i].y = a / n; }
}
for (let i = 0; i < 40; i++) pathS[i].y = THREE.MathUtils.lerp(PLAT_Y, pathS[i].y, i / 40);
pathS.forEach(s => { s.y = Math.max(s.y, .3); });
const X0 = -50, X1 = 50, Z0 = -34, Z1 = 30, FW = 600, FH = 400;
const fD = new Float32Array(FW * FH), fY = new Float32Array(FW * FH), fH = new Float32Array(FW * FH);
for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) {
  const x = X0 + (X1 - X0) * i / (FW - 1), z = Z0 + (Z1 - Z0) * j / (FH - 1);
  let best = 1e9, by = 0;
  for (let k = 0; k < pathS.length; k += 3) { const s = pathS[k], d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < best) { best = d; by = s.y; } }
  const D = Math.sqrt(best), k = sstep(2.8, 1.3, D);
  fD[j * FW + i] = D; fY[j * FW + i] = by;
  fH[j * FW + i] = rawH(x, z) * (1 - k) + (by - .03) * k;
}
function samp(f, x, z) {
  const u = clamp((x - X0) / (X1 - X0)) * (FW - 1), v = clamp((z - Z0) / (Z1 - Z0)) * (FH - 1);
  const i = Math.min(FW - 2, u | 0), j = Math.min(FH - 2, v | 0), a = u - i, b = v - j;
  return (f[j * FW + i] * (1 - a) + f[j * FW + i + 1] * a) * (1 - b) + (f[(j + 1) * FW + i] * (1 - a) + f[(j + 1) * FW + i + 1] * a) * b;
}
const H = (x, z) => samp(fH, x, z);
const pathD = (x, z) => samp(fD, x, z);
const flowerField = (x, z) => fbm(x * .1 + 11, z * .12 - 4);
const inPlateau = (x, z, m = 0) => Math.abs(x) < PX + m && z > PZ0 - m && z < PZ1 + m;
const slope = (x, z) => Math.hypot(H(x + .3, z) - H(x - .3, z), H(x, z + .3) - H(x, z - .3)) / .6;

async function buildTerrain() {
  const [grass, sand, rock, slate] = await Promise.all(['leafy_grass', 'coast_sand_01', 'aerial_rocks_02', 'castle_wall_slates'].map(n => loadImg(`assets/tex/${n}.jpg`).then(i => pixels(i, 512, 512))));
  const TW = 2048, TH = 1400, col = new Uint8Array(TW * TH * 4), cls = new Uint8Array(TW * TH * 4);
  const pick = (t, x, z, m) => { const o = (((fract(z / m) * t.h) | 0) * t.w + ((fract(x / m) * t.w) | 0)) * 4; return [t.d[o], t.d[o + 1], t.d[o + 2]]; };
  for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
    const x = X0 + (X1 - X0) * i / (TW - 1), z = Z0 + (Z1 - Z0) * j / (TH - 1), y = H(x, z), pd = pathD(x, z);
    const n = fbm(x * .3, z * .3);
    let c, k;
    if (pd < 1.25 && z > PZ1 - .8) { c = pick(slate, x, z, 3); c = [c[0] * .95, c[1] * .9, c[2] * .85]; k = CLS.stair; }
    else if (inPlateau(x, z, -.2)) {                                   // courtyard paving, lighter central axis
      c = pick(slate, x, z, 2.2); const ax = Math.abs(x) < 1.3 ? 1.25 : 1; c = [c[0] * ax * 1.05, c[1] * ax, c[2] * ax * .9]; k = CLS.stair;
    }
    else if (Math.abs(z - creekZ(x)) < 2.1 && y < .1) { c = pick(sand, x, z, 3); c = [c[0] * .8, c[1] * .75, c[2] * .7]; k = CLS.sand; }
    else if (z < PZ0 - 1.2) {                                          // ridge: hazy forested slope rising to the crest
      const g = pick(grass, x, z, 3), haze = sstep(-19, -30, z), v = .45 + .9 * fbm(x * .35 + 2, z * .35);
      c = [g[0] * .5 * v, g[1] * .95 * v, g[2] * .45 * v];
      c = [c[0] * (1 - haze) + 120 * haze * v, c[1] * (1 - haze) + 88 * haze * v, c[2] * (1 - haze) + 120 * haze * v];
      k = CLS.leaf;
    }
    else if (slope(x, z) > 1.25 + n * .5) { c = pick(rock, x, z, 6); c = [c[0] * .7, c[1] * .72, c[2] * .76]; k = CLS.rock; }
    else {
      c = pick(grass, x, z, 2.6); const v = .55 + .9 * fbm(x * .16 + 5, z * .16);
      c = [c[0] * .85 * v, c[1] * 1.2 * v, c[2] * .45 * v]; k = CLS.grass;
      if (z > 6 && flowerField(x, z) > .58) { c = [c[0] * .85 + 40, c[1] * .85 + 36, c[2] * .85 + 30]; }
    }
    const o = (j * TW + i) * 4;
    col[o] = Math.min(255, c[0]); col[o + 1] = Math.min(255, c[1]); col[o + 2] = Math.min(255, c[2]); col[o + 3] = 255; cls[o] = k * 16;
  }
  const colTex = new THREE.DataTexture(col, TW, TH, THREE.RGBAFormat);
  colTex.colorSpace = THREE.SRGBColorSpace; colTex.magFilter = THREE.LinearFilter; colTex.minFilter = THREE.LinearMipmapLinearFilter; colTex.generateMipmaps = true; colTex.anisotropy = 8; colTex.needsUpdate = true;
  const clsTex = new THREE.DataTexture(cls, TW, TH, THREE.RGBAFormat); clsTex.magFilter = clsTex.minFilter = THREE.NearestFilter; clsTex.needsUpdate = true;
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, 480, 400); g.rotateX(-Math.PI / 2); g.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, H(x, z)); uv.setXY(i, (x - X0) / (X1 - X0), (z - Z0) / (Z1 - Z0)); }
  g.computeVertexNormals();
  const m = new THREE.MeshLambertMaterial({ map: colTex });
  m.onBeforeCompile = (s) => {
    s.uniforms.clsTex = { value: clsTex };
    s.fragmentShader = 'uniform sampler2D clsTex;\n' + s.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>\n gl_FragColor.a = texture2D(clsTex, vMapUv).r;`);
  };
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.castShadow = true;
  return mesh;
}

// ---------- creek at the foot, catching the sunset ----------
function buildCreek() {
  const depth = new Float32Array(FW * FH * 4);
  for (let j = 0; j < FH; j++) for (let i = 0; i < FW; i++) depth[(j * FW + i) * 4] = -fH[j * FW + i];
  const dt = new THREE.DataTexture(depth, FW, FH, THREE.RGBAFormat, THREE.FloatType);
  dt.magFilter = dt.minFilter = THREE.LinearFilter; dt.needsUpdate = true;
  const m = new THREE.ShaderMaterial({
    uniforms: { uD: { value: dt }, uT: time, uB: { value: new THREE.Vector4(X0, Z0, X1 - X0, Z1 - Z0) } },
    vertexShader: `varying vec3 vW; void main(){ vW = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vW,1.); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uD; uniform float uT; uniform vec4 uB; varying vec3 vW;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
      void main(){
        vec2 uv = (vW.xz-uB.xy)/uB.zw;
        float d = texture2D(uD,uv).r;
        if(d<-.05) discard;
        float flow = vn(vW.xz*vec2(.5,1.6)+vec2(uT*.6,0.));
        vec3 c = mix(vec3(.08,.2,.3),vec3(.03,.1,.2),smoothstep(.1,.6,d));
        c += vec3(.9,.45,.15)*smoothstep(.55,.85,flow)*.55;           // sunset glints
        c += vec3(.45,.4,.35)*smoothstep(.15,0.,d);                    // bright rim
        gl_FragColor = vec4(c,15./16.);
      }`,
  });
  const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0); g.rotateX(-Math.PI / 2); g.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  return new THREE.Mesh(g, m);
}

// ---------- sky card behind the ridge: gradient, clouds, distant ranges, the sun ----------
const SUN = new THREE.Vector3(-7, 12.5, -36);
function buildSky() {
  const m = new THREE.ShaderMaterial({
    uniforms: { uT: time, uSun: { value: SUN } },
    vertexShader: `varying vec3 vW; void main(){ vW = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vW,1.); }`,
    fragmentShader: /* glsl */`
      uniform float uT; uniform vec3 uSun; varying vec3 vW;
      float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
      float fbm(vec2 p){ return vn(p)*.5+vn(p*2.1+3.1)*.28+vn(p*4.3+7.7)*.15+vn(p*8.7)*.07; }
      void main(){
        float y = vW.y, x = vW.x;
        vec2 sp = vec2(x,y)-uSun.xy; float sd = length(sp*vec2(1.,1.15));
        float t = smoothstep(4.,44.,y);
        vec3 c = mix(vec3(1.4,.6,.12),vec3(1.1,.32,.24),smoothstep(0.,.35,t));
        c = mix(c,vec3(.48,.18,.42),smoothstep(.3,.75,t));
        c = mix(c,vec3(.12,.09,.26),smoothstep(.7,1.,t));
        c += vec3(1.1,.6,.2)*exp(-sd*.16)*.9;                          // glow around the sun
        float cl = fbm(vec2(x*.035+uT*.012,y*.16));
        float band = smoothstep(.52,.72,cl)*smoothstep(10.,18.,y);
        c = mix(c,mix(vec3(1.2,.5,.35),vec3(.5,.22,.4),smoothstep(18.,40.,y)),band*.8);
        float cls = 9.;
        float rs = 4.6;
        if(sd<rs){ c = mix(vec3(1.7,1.25,.55),vec3(1.9,1.65,1.05),smoothstep(rs,0.,sd)); cls = 10.; }
        // two painted distant ranges in front of the sun
        float h1 = 9.6+5.2*fbm(vec2(x*.05+1.3,.5))+1.2*vn(vec2(x*.4,2.));
        if(y<h1){ c = mix(vec3(.62,.3,.36),vec3(.4,.2,.32),smoothstep(h1,h1-6.,y)); c += vec3(.6,.3,.1)*exp(-length(vec2(x,h1)-uSun.xy)*.12)*smoothstep(h1-1.2,h1,y); cls = 14.; }
        float h2 = 5.+5.5*fbm(vec2(x*.07+8.,1.5));
        if(y<h2){ c = mix(vec3(.36,.18,.3),vec3(.24,.14,.26),smoothstep(h2,h2-6.,y)); cls = 14.; }
        gl_FragColor = vec4(c,cls/16.);
      }`,
  });
  const g = new THREE.PlaneGeometry(220, 110); g.translate(0, 45, SUN.z);
  return new THREE.Mesh(g, m);
}

// ---------- wind ----------
function bladeWind(s) {
  s.uniforms.uT = time;
  s.vertexShader = 'uniform float uT;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    float ph = instanceMatrix[3].x*.34+instanceMatrix[3].z*.22;
    float gust = sin(uT*.75-ph)*.5+.5;
    transformed.x += (sin(uT*1.6+ph*2.)*.28+gust*.6)*.22*position.y*position.y;`);
}
function leafWind(s) {
  s.uniforms.uT = time;
  s.vertexShader = 'uniform float uT;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    float ph = instanceMatrix[3].x*.9+instanceMatrix[3].z*.7+instanceMatrix[3].y*.8;
    transformed.y += sin(uT*2.1+ph)*.035;
    transformed += vec3(1.,0.,.4)*sin(uT*.8+instanceMatrix[3].x*.22)*.06;`);
}
const grassOK = (x, z) => !inPlateau(x, z, .3) && pathD(x, z) > 1.4 && Math.abs(z - creekZ(x)) > 2.2 && z > PZ0 - 1;
function buildGrass(scene) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-.045, 0, 0, .045, 0, 0, .012, .6, 0, -.045, 0, 0, .012, .6, 0, 0, 1, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(18).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const N = 150000, im = new THREE.InstancedMesh(g, tag(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), CLS.grass, bladeWind), N);
  const o = new THREE.Object3D(), c = new THREE.Color();
  let i = 0, guard = 0;
  while (i < N && guard++ < 5e6) {
    const x = -30 + rnd() * 60, z = -18 + rnd() * 38, y = H(x, z);
    if (!grassOK(x, z)) continue;
    o.position.set(x, y - .02, z); o.rotation.y = rnd() * 6.28;
    const s = .3 + rnd() * .3; o.scale.set(1.5, s, 1.5); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    const v = .55 + rnd() * .75, tone = fbm(x * .16 + 5, z * .16);
    const dk = .55 + 1.1 * tone; c.setRGB((.17 * v + tone * .1) * dk, .54 * v * dk, .07 * v * dk); im.setColorAt(i++, c);
  }
  im.count = i; im.receiveShadow = true; scene.add(im);
}
function buildFlowers(scene) {
  const g = new THREE.PlaneGeometry(.14, .14); g.rotateX(-Math.PI / 2 + .25);
  const N = 40000, im = new THREE.InstancedMesh(g, tag(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), CLS.flower, bladeWind), N);
  const o = new THREE.Object3D(), c = new THREE.Color();
  let i = 0, guard = 0;
  while (i < N && guard++ < 6e6) {
    const x = -30 + rnd() * 60, z = 4 + rnd() * 16, y = H(x, z);
    if (flowerField(x, z) < .57 + rnd() * .05 || !grassOK(x, z) || pathD(x, z) < 1.9) continue;
    if (fbm(x * .9, z * .9) < .45) continue;
    o.position.set(x, y + .2 + rnd() * .16, z); o.rotation.y = rnd() * 6.28; o.scale.setScalar(.8 + rnd() * .9); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    const r = rnd(); c.setRGB(.95, r < .4 ? .55 : .85, r < .4 ? .6 : .55); im.setColorAt(i++, c);
  }
  im.count = i; im.receiveShadow = true; scene.add(im);
}

// ---------- forest: broadleaf crowns and tall conifers ----------
function buildTrees(scene, barkTex) {
  const spots = [];
  let guard = 0;
  const ok = (x, z, gap) => !spots.some(s => (s.x - x) ** 2 + (s.z - z) ** 2 < gap);
  while (spots.length < 300 && guard++ < 40000) {
    const x = -34 + rnd() * 68, z = -24 + rnd() * 37;
    if (inPlateau(x, z, 1.2) || pathD(x, z) < 2.4 || Math.abs(z - creekZ(x)) < 2.6 || !ok(x, z, 4.4)) continue;
    if (z < PZ0 - 3.5) continue;
    let hides = false; for (let k = 1; k <= 5; k += 1) if (pathD(x, z - k) < 1.6 || inPlateau(x, z - k, -1) && z > PZ1) hides = true;
    if (hides) continue;
    if (z > 7 && rnd() < .55) continue;                               // thinner near the meadow at the foot
    const r = rnd();
    spots.push({ x, z, s: .62 + rnd() * .38 - (pathD(x, z) < 4 ? .12 : 0), kind: r < .26 ? 'pine' : r < .5 ? 'deep' : r < .82 ? 'green' : 'lime' });
  }
  spots.push({ x: -7.5, z: -13.2, s: .85, kind: 'ginkgo' }, { x: 8.2, z: -5.6, s: .55, kind: 'maple' }, { x: -8.4, z: -5.4, s: .55, kind: 'maple' });
  const pal = {
    deep: [[.14, .44, .14], [.2, .52, .16], [.1, .36, .12], [.26, .56, .16]],
    green: [[.3, .62, .12], [.4, .72, .16], [.22, .5, .1], [.5, .76, .18]],
    lime: [[.58, .8, .16], [.68, .86, .22], [.46, .7, .12], [.76, .88, .26]],
    pine: [[.1, .4, .2], [.16, .48, .22], [.08, .32, .17], [.22, .52, .24]],
    ginkgo: [[.98, .74, .12], [1, .82, .25], [.86, .6, .08]],
    maple: [[.9, .2, .05], [1, .35, .08], [.7, .1, .04]],
  };
  const trunks = [], leaves = [];
  for (const t of spots) {
    const y0 = H(t.x, t.z), pine = t.kind === 'pine', H0 = (pine ? 6.2 : 4.6) * t.s;
    const tg = new THREE.CylinderGeometry(.08 * t.s, .2 * t.s, H0, 6); tg.translate(t.x, y0 + H0 / 2, t.z); trunks.push(tg);
    const P = pal[t.kind];
    if (pine) {
      for (let i = 0; i < 700; i++) {
        const h = rnd(), rr = (1 - h) * 1.7 * t.s * Math.sqrt(rnd()), th = rnd() * 6.28, lit = .7 + .6 * h;
        const p = P[(rnd() * P.length) | 0];
        leaves.push(t.x + Math.cos(th) * rr, y0 + H0 * (.28 + h * .8), t.z + Math.sin(th) * rr, p[0] * lit, p[1] * lit, p[2] * lit);
      }
    } else {
      for (let b = 0; b < 2; b++) { const a = rnd() * 6.28; const bg = new THREE.CylinderGeometry(.03 * t.s, .07 * t.s, 1.8 * t.s, 5); bg.rotateZ(.8); bg.rotateY(a); bg.translate(t.x + Math.cos(a) * .5 * t.s, y0 + H0 * .72, t.z - Math.sin(a) * .5 * t.s); trunks.push(bg); }
      const lobes = 8;
      for (let l = 0; l < lobes; l++) {
        const a = rnd() * 6.28, r = rnd() ** .6 * 2.2 * t.s, lx = t.x + Math.cos(a) * r, lz = t.z + Math.sin(a) * r, ly = y0 + H0 * .82 + (rnd() - .35) * 1.6 * t.s + (1 - r / (2.3 * t.s)) * 1.2 * t.s;
        const lr = (.75 + rnd() * .5) * t.s;
        for (let i = 0; i < 95; i++) {
          const u = rnd() * 2 - 1, th = rnd() * 6.28, q = Math.sqrt(1 - u * u), rr = lr * Math.cbrt(rnd());
          const p = P[(rnd() * P.length) | 0], lit = .7 + .6 * clamp(u * .5 + .5);
          leaves.push(lx + q * Math.cos(th) * rr, ly + u * rr * .75, lz + q * Math.sin(th) * rr, p[0] * lit, p[1] * lit, p[2] * lit);
        }
      }
    }
  }
  const barkMat = tag(new THREE.MeshLambertMaterial({ map: barkTex, color: '#d8cfc2' }), CLS.wood);
  const trunk = new THREE.Mesh(mergeGeometries(trunks), barkMat); trunk.castShadow = true; scene.add(trunk);
  const g = new THREE.PlaneGeometry(.3, .24);
  const count = leaves.length / 6, im = new THREE.InstancedMesh(g, tag(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), CLS.leaf, leafWind), count);
  const o = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    o.position.set(leaves[i * 6], leaves[i * 6 + 1], leaves[i * 6 + 2]); o.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
    c.setRGB(leaves[i * 6 + 3], leaves[i * 6 + 4], leaves[i * 6 + 5]); im.setColorAt(i, c);
  }
  im.castShadow = true; im.receiveShadow = true; scene.add(im);
  console.log('trees', spots.length, 'leaves', count);
}

// ---------- temple architecture ----------
function colored(g, hex) {
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}
// Hipped roof as a sagging heightfield with upturned corners; W along x, D along z.
function hipRoof(w, d, h, curl = .45) {
  const g = new THREE.PlaneGeometry(w, d, 28, 18); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, hx = w / 2, hz = d / 2, r = Math.max(0, hx - hz);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), t = clamp(Math.max(Math.abs(z) / hz, Math.max(0, Math.abs(x) - r) / hz));
    const ax = Math.abs(x) / hx, az = Math.abs(z) / hz;
    p.setY(i, h * Math.pow(1 - t, 1.7) + curl * Math.pow(ax * az, 5) + curl * .25 * Math.pow(t, 5));
  }
  g.computeVertexNormals();
  return g;
}
const gp = (g, x, y, z) => { g.translate(x, y, z); return g; };
function hall(o) {
  // o: {w, d, h, roofs:[colors], double, wall, platform}
  const { w, d, h, roof = '#f0b232', double = false, plat = .7 } = o;
  const red = [], roofs = [], stone = [], dark = [], gold = [];
  stone.push(gp(new THREE.BoxGeometry(w + 2, plat, d + 2), 0, plat / 2, 0));
  for (let s = 0; s < 3; s++) stone.push(gp(new THREE.BoxGeometry(w * .4, plat * (s + 1) / 3.5, .45), 0, plat * (s + 1) / 7, d / 2 + 1 + (2 - s) * .42 + .2));
  const y0 = plat;
  red.push(gp(new THREE.BoxGeometry(w, h, d), 0, y0 + h / 2, 0));
  const np = Math.max(3, Math.round(w / 1.2));
  for (let i = 0; i <= np; i++) for (const sz of [-1, 1]) red.push(gp(new THREE.CylinderGeometry(.14, .16, h, 8), -w / 2 - .2 + (w + .4) * i / np, y0 + h / 2, sz * (d / 2 + .2)));
  for (let i = 0; i < np; i++) dark.push(gp(new THREE.BoxGeometry((w + .4) / np * .62, h * .66, .06), -w / 2 - .2 + (w + .4) * (i + .5) / np, y0 + h * .4, d / 2 + .03));
  gold.push(gp(new THREE.BoxGeometry(w + .5, .22, d + .5), 0, y0 + h - .05, 0));
  let top = y0 + h;
  const R1 = hipRoof(w + 2.2, d + 2.2, double ? 1.2 : 2.1, .5); roofs.push(gp(R1, 0, top, 0));
  if (double) {
    red.push(gp(new THREE.BoxGeometry(w * .72, 1.25, d * .66), 0, top + .62, 0));
    gold.push(gp(new THREE.BoxGeometry(w * .72 + .3, .18, d * .66 + .3), 0, top + 1.2, 0));
    top += 1.25;
    roofs.push(gp(hipRoof(w * .72 + 2, d * .66 + 2, 2, .5), 0, top, 0));
  }
  const ridgeH = top + (double ? 2 : 2.1), rl = Math.max(.6, (double ? w * .72 + 2 : w + 2.2) - (double ? d * .66 + 2 : d + 2.2));
  dark.push(gp(new THREE.BoxGeometry(rl + .3, .22, .22), 0, ridgeH + .05, 0));
  for (const s of [-1, 1]) gold.push(gp(new THREE.BoxGeometry(.2, .55, .3), s * (rl / 2 + .1), ridgeH + .3, 0));
  return { red, roofs, stone, dark, gold };
}
function pagoda() {
  const red = [], roofs = [], stone = [], dark = [], gold = [];
  stone.push(gp(new THREE.BoxGeometry(5, .6, 5), 0, .3, 0));
  let y = .6;
  for (let i = 0; i < 5; i++) {
    const s = 3.3 - i * .45, h = i === 0 ? 2.1 : 1.3;
    red.push(gp(new THREE.BoxGeometry(s, h, s), 0, y + h / 2, 0));
    dark.push(gp(new THREE.BoxGeometry(s * .35, h * .6, .05), 0, y + h * .38, s / 2 + .02));
    y += h;
    roofs.push(gp(hipRoof(s + 1.9, s + 1.9, .85, .5), 0, y - .05, 0));
    y += .3;
  }
  gold.push(gp(new THREE.CylinderGeometry(.06, .1, 2.2, 6), 0, y + 1.1, 0));
  for (let k = 0; k < 5; k++) gold.push(gp(new THREE.TorusGeometry(.2 - k * .02, .05, 5, 10).rotateX(Math.PI / 2), 0, y + .45 + k * .3, 0));
  gold.push(gp(new THREE.SphereGeometry(.16, 8, 6), 0, y + 2.25, 0));
  return { red, roofs, stone, dark, gold };
}
function place(set, x, z, ry, y = PLAT_Y) {
  const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
  for (const k in set) set[k] = set[k].map(g => g.applyMatrix4(m));
  return set;
}
function buildTemple(scene) {
  const all = { red: [], roofs: [], stone: [], dark: [], gold: [], roofG: [] };
  const add = (set, teal = false) => { for (const k in set) (k === 'roofs' && teal ? all.roofG : all[k]).push(...set[k]); };
  add(place(hall({ w: 10.4, d: 5.4, h: 3, double: true, plat: 1.1 }), 0, -11.9, 0));           // main hall
  add(place(hall({ w: 5, d: 2.9, h: 2, plat: .4 }), -8.9, -6.6, Math.PI / 2), true);       // side halls
  add(place(hall({ w: 5, d: 2.9, h: 2, plat: .4 }), 8.9, -6.6, -Math.PI / 2), true);
  add(place(pagoda(), 9.3, -14.2, .2), true);
  // front gate on the plateau edge, the path arrives here
  const gate = hall({ w: 4.6, d: 2.2, h: 2.3, plat: .35 }); gate.dark.push(gp(new THREE.BoxGeometry(1.6, 1.9, .1), 0, 1.3, 1.14));
  add(place(gate, 0, PZ1 - .4, 0));
  // enclosing wall with a tiled cap
  const wall = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), a = Math.atan2(z1 - z0, x1 - x0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const m = new THREE.Matrix4().makeRotationY(-a).setPosition(cx, PLAT_Y, cz);
    all.red.push(new THREE.BoxGeometry(L, 1.25, .36).translate(0, .62, 0).applyMatrix4(m));
    all.roofG.push(hipRoof(L + .3, .9, .3, .05).translate(0, 1.25, 0).applyMatrix4(m));
  };
  const zf = PZ1 - .4, zb = PZ0 + .3, xe = PX - .3;
  wall(-xe, zf, -2.9, zf); wall(2.9, zf, xe, zf); wall(-xe, zf, -xe, zb); wall(xe, zf, xe, zb); wall(-xe, zb, xe, zb);
  // bronze incense burner
  all.dark.push(new THREE.CylinderGeometry(.45, .35, .7, 10).translate(0, PLAT_Y + .35, -6.4), new THREE.CylinderGeometry(.06, .06, .5, 5).translate(0, PLAT_Y + .9, -6.4));
  // paifang archway at the foot of the path
  const fp = pathCurve.getPointAt(.985), ft = pathCurve.getTangentAt(.985), fy = samp(fY, fp.x, fp.z);
  const pf = { red: [], roofs: [], stone: [], dark: [], gold: [] };
  for (const s of [-1.5, -.6, .6, 1.5]) { pf.red.push(gp(new THREE.CylinderGeometry(.13, .15, s * s < 1 ? 2.9 : 2.2, 8), s, s * s < 1 ? 1.45 : 1.1, 0)); pf.stone.push(gp(new THREE.BoxGeometry(.5, .35, .5), s, .17, 0)); }
  pf.red.push(gp(new THREE.BoxGeometry(3.4, .25, .22), 0, 2.15, 0)); pf.gold.push(gp(new THREE.BoxGeometry(.8, .45, .08), 0, 2.55, .1));
  pf.roofs.push(gp(hipRoof(1.9, .9, .45, .25), 0, 2.95, 0), gp(hipRoof(1.4, .8, .35, .2), -1.05, 2.3, 0), gp(hipRoof(1.4, .8, .35, .2), 1.05, 2.3, 0));
  add(place(pf, fp.x, fp.z, Math.atan2(ft.x, ft.z), fy - .05));

  const mats = {
    red: tag(new THREE.MeshLambertMaterial({ map: tex('assets/tex/weathered_planks.jpg', 1, 1), color: '#ff5030', emissive: '#a01a06', emissiveIntensity: .7 }), CLS.red),
    roofs: tag(new THREE.MeshLambertMaterial({ vertexColors: false, color: '#ffc23a', emissive: '#5a3a06', emissiveIntensity: .5, side: THREE.DoubleSide }), CLS.roof),
    roofG: tag(new THREE.MeshLambertMaterial({ color: '#5fa88e', emissive: '#16382c', emissiveIntensity: .45, side: THREE.DoubleSide }), CLS.roof),
    stone: tag(new THREE.MeshLambertMaterial({ map: tex('assets/tex/castle_wall_slates.jpg', .5, .5), color: '#e6e0d6' }), CLS.stone),
    dark: tag(new THREE.MeshLambertMaterial({ color: '#4a2a1c' }), CLS.wood),
    gold: tag(new THREE.MeshLambertMaterial({ color: '#ffd04a', emissive: '#6a4a08', emissiveIntensity: .6 }), CLS.roof),
  };
  for (const k in all) {
    if (!all[k].length) continue;
    const geos = all[k].map(g => { g = g.index ? g.toNonIndexed() : g; for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; });
    const mesh = new THREE.Mesh(mergeGeometries(geos), mats[k]); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
  }
}
function buildSteps(scene) {
  const o = new THREE.Object3D();
  const steps = Math.floor(pathLen / .43), sim = new THREE.InstancedMesh(new THREE.BoxGeometry(1.6, .2, .4), tag(new THREE.MeshLambertMaterial({ map: tex('assets/tex/castle_wall_slates.jpg', .4, .2), color: '#f2ebe0' }), CLS.stair), steps);
  for (let i = 0; i < steps; i++) {
    const u = (i + .5) / steps, p = pathCurve.getPointAt(u), t = pathCurve.getTangentAt(u);
    o.position.set(p.x, samp(fY, p.x, p.z), p.z); o.rotation.set(0, Math.atan2(t.x, t.z), 0); o.updateMatrix(); sim.setMatrixAt(i, o.matrix);
  }
  sim.receiveShadow = true; sim.castShadow = true; scene.add(sim);
}
function buildLanterns(scene) {
  const parts = [];
  const add = (g, y) => { g.translate(0, y, 0); g.deleteAttribute('uv'); parts.push(g.index ? g.toNonIndexed() : g); };
  add(new THREE.BoxGeometry(.5, .13, .5), .07); add(new THREE.CylinderGeometry(.09, .12, .62, 8), .44);
  add(new THREE.BoxGeometry(.36, .1, .36), .78); add(new THREE.BoxGeometry(.3, .3, .3), .97);
  add(new THREE.ConeGeometry(.42, .24, 4), 1.24); add(new THREE.SphereGeometry(.06, 6, 5), 1.39);
  const g = mergeGeometries(parts); g.computeVertexNormals();
  const n = 16, im = new THREE.InstancedMesh(g, tag(new THREE.MeshLambertMaterial({ color: '#ddd6cc', emissive: '#3a2a10', emissiveIntensity: .3 }), CLS.stone), n), o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const u = .1 + i / n * .84, p = pathCurve.getPointAt(u), t = pathCurve.getTangentAt(u), s = i % 2 ? 1 : -1;
    const x = p.x - t.z * s * 1.75, z = p.z + t.x * s * 1.75;
    o.position.set(x, H(x, z) - .02, z); o.rotation.y = Math.atan2(t.x, t.z); o.scale.setScalar(1.15); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
  }
  im.castShadow = true; im.receiveShadow = true; scene.add(im);
}
function buildMonk() {
  const parts = [
    colored(new THREE.CylinderGeometry(.16, .3, .75, 8).translate(0, .42, 0), '#ff8a1c'),
    colored(new THREE.BoxGeometry(.5, .14, .2).translate(0, .66, .02), '#c0400c'),
    colored(new THREE.SphereGeometry(.14, 8, 6).translate(0, .92, 0), '#ffd2a0'),
  ];
  const m = new THREE.Mesh(mergeGeometries(parts), tag(new THREE.MeshBasicMaterial({ vertexColors: true }), CLS.monk));
  m.castShadow = true; m.scale.setScalar(1.25);
  return m;
}

// ---------- ascii + tilt shift ----------
const GLYPHS = " .'`,:;-~=+*oOsS$%&8#@/\\|_^v\u2014";
const GI = Object.fromEntries([...GLYPHS].map((c, i) => [c, i]));
const gg = (c) => GI[c].toFixed(1);
function buildAtlas() {
  const tw = 64, th = 120, c = document.createElement('canvas');
  c.width = tw * GLYPHS.length; c.height = th;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'bold 100px Menlo, Monaco, "DejaVu Sans Mono", monospace';
  [...GLYPHS].forEach((ch, i) => { if (ch === '\u2014') x.fillRect(i * tw, th * .44, tw, th * .12); else x.fillText(ch, (i + .5) * tw, th * .52); });
  const t = new THREE.CanvasTexture(c); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.flipY = false;
  return t;
}
const asciiFrag = /* glsl */`
precision highp float;
uniform sampler2D uScene, uAtlas; uniform vec2 uGrid; uniform float uTime, uN;
in vec2 vUv; out vec4 outColor;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float lum(vec3 c){ return dot(c,vec3(.25,.6,.15)); }
vec3 grade(vec3 c){
  c = max(c,0.); c = c/(1.+c*.12); c = pow(c,vec3(1./2.2));
  c = mix(c,c*c*(3.-2.*c),.5);
  float l = lum(c); c = mix(vec3(l),c,1.28);
  return clamp(c,0.,1.);
}
void main(){
  vec2 g = vUv*uGrid, cell = floor(g), cuv = (cell+.5)/uGrid;
  ivec2 sz = textureSize(uScene,0);
  float lodC = log2(float(sz.x)/uGrid.x)+.05;
  vec3 col = grade(textureLod(uScene,cuv,lodC).rgb);
  float cls = floor(texelFetch(uScene,ivec2(cuv*vec2(sz)),0).a*16.+.5);
  float L = lum(col);
  vec2 e = 1./uGrid;
  float lx0=lum(grade(textureLod(uScene,cuv-vec2(e.x,0),lodC).rgb)), lx1=lum(grade(textureLod(uScene,cuv+vec2(e.x,0),lodC).rgb));
  float ly0=lum(grade(textureLod(uScene,cuv-vec2(0,e.y),lodC).rgb)), ly1=lum(grade(textureLod(uScene,cuv+vec2(0,e.y),lodC).rgb));
  vec2 grad = vec2(lx1-lx0,(ly1-ly0)*.55); float mag = length(grad);
  float a4 = mod(atan(grad.y,grad.x)+.3927,3.14159)/.7854;
  float edgeG = a4<1.?${gg('|')}:a4<2.?${gg('\\')}:a4<3.?${gg('\u2014')}:${gg('/')};
  float w = vn(cell*vec2(.05,.09)+vec2(-uTime*.28,uTime*.07))*2.-1.;
  float gl = ${gg('.')};
  float bgk = .22;
  if(cls<1.5){        // grass
    gl = L<.1?${gg('.')}:L<.17?${gg(':')}:(w<-.2?${gg('\\')}:w>.2?${gg('/')}:${gg('|')});
  } else if(cls<2.5){ // leaves
    gl = L<.12?${gg('.')}:L<.24?${gg(':')}:L<.38?${gg('*')}:L<.5?${gg('+')}:${gg('o')};
  } else if(cls<3.5){ // flowers
    gl = L<.34?${gg(':')}:L<.55?${gg('*')}:L<.76?${gg('%')}:${gg('#')};
  } else if(cls<4.5){ // stone
    gl = L<.22?${gg(':')}:L<.42?${gg('%')}:${gg('#')};
    if(mag>.16) gl = edgeG;
  } else if(cls<5.5){ // stairs, paving
    gl = L<.12?${gg(':')}:L<.24?${gg('=')}:L<.5?${gg('\u2014')}:${gg('#')};
  } else if(cls<6.5){ // vermilion walls, pillars
    gl = L<.08?${gg(':')}:L<.2?${gg('=')}:${gg('#')};
    if(mag>.2 && L>.08) gl = edgeG;
  } else if(cls<7.5){ // wood, trunks, doors
    gl = L<.14?${gg(':')}:(mag>.1?edgeG:(L<.34?${gg('|')}:${gg('#')}));
  } else if(cls<8.5){ // creek bed sand
    gl = L<.3?${gg(':')}:L<.6?${gg(';')}:${gg('=')};
  } else if(cls<9.5){ // sky
    float cw = vn(cell*vec2(.03,.4)+vec2(uTime*.05,0.));
    gl = L<.14?${gg('.')}:L<.3?${gg('-')}:L<.55?(cw>.55?${gg('=')}:${gg('~')}):L<.8?${gg('=')}:${gg('*')};
    bgk = .45;
  } else if(cls<10.5){ // sun
    gl = L<.85?${gg('O')}:${gg('@')};
    bgk = .7;
  } else if(cls<11.5){ // monk
    gl = L<.5?${gg('&')}:${gg('$')};
  } else if(cls<12.5){ // roofs
    gl = L<.3?${gg('=')}:L<.62?${gg('\u2014')}:${gg('#')};
    if(mag>.22) gl = edgeG;
  } else if(cls<13.5){ // rock
    gl = L<.12?${gg('.')}:L<.26?${gg(':')}:L<.42?${gg('%')}:${gg('#')};
    if(mag>.2) gl = edgeG;
  } else if(cls<14.5){ // distant ranges
    gl = L<.12?${gg('.')}:L<.22?${gg(':')}:L<.36?${gg('^')}:${gg('+')};
    bgk = .35;
  } else { // creek water
    gl = L<.2?${gg('-')}:L<.45?(w>0.?${gg('~')}:${gg('-')}):${gg('=')};
  }
  vec2 gv = g-cell, dx = dFdx(g), dy = dFdy(g);
  float ink = smoothstep(.12,.78,textureGrad(uAtlas,vec2((gl+gv.x)/uN,1.-gv.y),dx/uN,dy).r);
  vec3 blur = grade(textureLod(uScene,vUv,lodC+1.2).rgb);
  outColor = vec4(mix(blur*bgk,col*1.3+.012,ink),1.);
}`;
const tiltFrag = /* glsl */`
precision highp float;
uniform sampler2D uA; uniform vec2 uRes;
in vec2 vUv; out vec4 outColor;
void main(){
  float dy = vUv.y-.5; dy = dy>0. ? dy*.82 : -dy;
  float r = pow(smoothstep(.27,.6,dy),1.6)*26.;
  vec3 c = vec3(0.); float tw = 0.;
  if(r<.2){ outColor = vec4(texture(uA,vUv).rgb,1.); return; }
  float lod = max(log2(r/4.),0.);
  for(int i=0;i<36;i++){
    float t = float(i)+.5, a = t*2.39996, rr = sqrt(t/36.)*r;
    vec2 o = vec2(cos(a),sin(a))*rr/uRes;
    c += textureLod(uA,vUv+o,lod).rgb; tw += 1.;
  }
  outColor = vec4(c/tw,1.);
}`;

async function main() {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, HH);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // low warm sunset key from the left, long shadows across the slope
  const sun = new THREE.DirectionalLight('#ffc68a', 4.2); sun.position.set(-40, 38, 26); sun.target.position.set(0, 5, -3);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: 5, far: 140 });
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .03;
  scene.add(sun, sun.target, new THREE.HemisphereLight('#ffe0c0', '#5a6a30', 1.5));

  const barkTex = tex('assets/tex/bark_brown_02.jpg', 1, 2);
  scene.add(await buildTerrain(), buildCreek(), buildSky());
  buildGrass(scene); buildFlowers(scene); buildTrees(scene, barkTex);
  buildTemple(scene); buildSteps(scene); buildLanterns(scene);
  const monk = buildMonk(); scene.add(monk);

  const NM = 160, motes = new THREE.InstancedMesh(new THREE.PlaneGeometry(.1, .1), tag(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.15, .55), side: THREE.DoubleSide }), CLS.flower), NM);
  scene.add(motes);
  const moteS = Array.from({ length: NM }, () => [rnd(), rnd(), rnd(), rnd()]);

  const camera = new THREE.PerspectiveCamera(23, W / HH, 5, 400);
  const TARGET = new THREE.Vector3(0, 8, -6);
  function placeCamera(t) {
    const k = .5 - .5 * Math.cos(Math.PI * t / DURATION), az = THREE.MathUtils.degToRad(-7 + 14 * k), el = THREE.MathUtils.degToRad(29 + 1.2 * Math.sin(k * 3.14)), R = 110 - 3 * k;
    camera.position.set(TARGET.x + Math.sin(az) * Math.cos(el) * R, TARGET.y + Math.sin(el) * R, TARGET.z + Math.cos(az) * Math.cos(el) * R);
    camera.lookAt(TARGET); camera.updateMatrixWorld();
  }

  const rt = new THREE.WebGLRenderTarget(W, HH, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
  const art = new THREE.WebGLRenderTarget(W, HH, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  const vtx = `in vec3 position; in vec2 uv; out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`;
  const ascii = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: vtx, fragmentShader: asciiFrag, depthTest: false, depthWrite: false,
    uniforms: { uScene: { value: rt.texture }, uAtlas: { value: buildAtlas() }, uGrid: { value: new THREE.Vector2(COLS, ROWS) }, uTime: time, uN: { value: GLYPHS.length } } });
  const tilt = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: vtx, fragmentShader: tiltFrag, depthTest: false, depthWrite: false,
    uniforms: { uA: { value: art.texture }, uRes: { value: new THREE.Vector2(W, HH) } } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), ascii); quad.frustumCulled = false;
  const post = new THREE.Scene(); post.add(quad); const postCam = new THREE.Camera();

  const dummy = new THREE.Object3D(), SPEED = .55, LOOP = 2 * DURATION;
  function drawFrame(t) {
    time.value = t; placeCamera(t);
    // the monk climbs from the archway to the gate once per two sweeps
    const f = fract(t / LOOP), u = clamp(.97 - f * .94), p = pathCurve.getPointAt(u), tg = pathCurve.getTangentAt(u);
    const step = Math.abs(Math.sin(t * SPEED * 9));
    monk.position.set(p.x, samp(fY, p.x, p.z) + .1 + step * .07, p.z); monk.rotation.y = Math.atan2(-tg.x, -tg.z); monk.rotation.z = Math.sin(t * SPEED * 9) * .06;
    monk.visible = u > .02;
    moteS.forEach((s, i) => {
      const k = fract(s[0] + t * (.012 + s[3] * .01));
      const x = -18 + k * 36 + Math.sin(t * .6 + s[1] * 9) * .5, z = -14 + s[2] * 26;
      dummy.position.set(x, H(x, z) + 1.5 + s[1] * 5 + Math.sin(t * .9 + s[3] * 12) * .35, z);
      dummy.rotation.set(t + s[0] * 9, t * .7, s[1]); dummy.scale.setScalar(.8 + s[3] * .8); dummy.updateMatrix(); motes.setMatrixAt(i, dummy.matrix);
    });
    motes.instanceMatrix.needsUpdate = true;
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
    quad.material = ascii; renderer.setRenderTarget(art); renderer.render(post, postCam);
    quad.material = tilt; renderer.setRenderTarget(null); renderer.render(post, postCam);
  }
  Object.assign(renderer.domElement.style, { width: 'min(100vw, 100vh)', height: 'min(100vw, 100vh)', margin: 'auto' });
  Object.assign(document.body.style, { display: 'grid', placeItems: 'center', height: '100vh' });
  let paused = false, clock = +(new URLSearchParams(location.search).get('t') || 0), last = performance.now();
  if (new URLSearchParams(location.search).has('freeze')) paused = true;
  addEventListener('keydown', (e) => { if (e.code === 'Space') { paused = !paused; e.preventDefault(); } });
  window.__ready = true; window.__setClock = (t) => { clock = t; paused = true; };
  const loop = (now) => {
    if (!paused) clock += Math.min(.1, (now - last) / 1000);
    last = now;
    drawFrame(clock);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
main().catch(e => console.error(e));
