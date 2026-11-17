import * as THREE from 'three';
import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

const Q = new URLSearchParams(location.search);
const PS = Number(Q.get('scale') || 1);
const W = Math.round(1080 * PS), H = Math.round(1920 * PS), FPS = 30;
const MCRES = Number(Q.get('mc') || 150);

// ---------- helpers ----------
const sq = v => v * v;
const clamp01 = x => Math.min(1, Math.max(0, x));
const ss = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const sm5 = x => { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function ell(x, y, z, cx, cy, cz, rx, ry, rz) {
  const px = x - cx, py = y - cy, pz = z - cz;
  const k0 = Math.sqrt(sq(px / rx) + sq(py / ry) + sq(pz / rz));
  const k1 = Math.sqrt(sq(px / (rx * rx)) + sq(py / (ry * ry)) + sq(pz / (rz * rz)));
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
}
function cap(x, y, z, ax, ay, az, bx, by, bz, r) {
  const pax = x - ax, pay = y - ay, paz = z - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = clamp01((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz));
  return Math.sqrt(sq(pax - bax * h) + sq(pay - bay * h) + sq(paz - baz * h)) - r;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
const smax = (a, b, k) => -smin(-a, -b, k);

// ---------- ear canal path (lateral -> medial) ----------
const E = [V3(-0.15, -0.1, 7.3), V3(0.15, -0.18, 6.1), V3(0.55, -0.3, 4.95), V3(0.98, -0.4, 3.95)];
const DRUM = V3(1.0, -0.4, 3.88);
const nD = V3(0.35, -0.45, 0.82).normalize();

// ---------- SDFs ----------
function skullSDF(x, y, z0) {
  const z = Math.abs(z0);
  let d = ell(x, y, z, -1.0, 3.8, 0, 9.2, 7.6, 7.2);
  d = smin(d, ell(x, y, z, 6.2, -2.2, 0, 3.6, 4.2, 3.5), 1.5);
  d = smin(d, cap(x, y, z, 6.2, -0.9, 4.3, 1.4, 0.4, 5.7, 0.5), 0.6);
  d = smin(d, ell(x, y, z, 6.3, -0.6, 3.9, 1.3, 1.2, 0.9), 0.8);
  d = smin(d, ell(x, y, z, -2.1, -2.3, 5.0, 1.0, 1.7, 0.9), 0.8);
  // mandible
  let m = cap(x, y, z, 2.2, -0.9, 5.0, -0.7, -6.0, 4.8, 0.48);
  m = Math.min(m, cap(x, y, z, -0.7, -6.0, 4.8, 3.2, -7.5, 3.9, 0.5));
  m = Math.min(m, cap(x, y, z, 3.2, -7.5, 3.9, 6.8, -8.0, 1.6, 0.5));
  m = Math.min(m, cap(x, y, z, 6.8, -8.0, 1.6, 7.6, -8.1, 0, 0.55));
  d = Math.min(d, m);
  // orbits & nasal aperture
  d = smax(d, -ell(x, y, z, 7.3, 2.0, 3.1, 1.6, 1.5, 1.8), 0.4);
  d = smax(d, -ell(x, y, z, 9.6, -1.4, 0, 1.1, 1.6, 0.9), 0.3);
  // external acoustic meatus (open) + tympanic cavity
  for (let i = 0; i < 3; i++) d = smax(d, -cap(x, y, z, E[i].x, E[i].y, E[i].z, E[i + 1].x, E[i + 1].y, E[i + 1].z, 0.46), 0.1);
  d = smax(d, -ell(x, y, z, 1.0, 0.0, 3.3, 0.85, 1.0, 0.7), 0.2);
  return d;
}
function skinSDF(x, y, z0) {
  const z = Math.abs(z0);
  let d = ell(x, y, z, -1.0, 3.8, 0, 9.9, 8.3, 7.9);
  d = smin(d, ell(x, y, z, 6.0, -2.3, 0, 4.6, 5.2, 4.9), 2.0);
  d = smin(d, cap(x, y, z, 9.4, 0.4, 0, 11.0, -1.6, 0, 0.85), 1.0);
  d = smin(d, ell(x, y, z, 6.2, -6.8, 0, 3.2, 2.0, 3.0), 1.2);
  d = smin(d, cap(x, y, z, -0.8, -6.0, 4.9, 6.0, -8.0, 2.0, 1.4), 1.0);
  d = smin(d, cap(x, y, z, -2.5, -5, 0, -3.3, -14, 0, 4.8), 3.0);
  for (let i = 0; i < 3; i++) d = smax(d, -cap(x, y, z, E[i].x, E[i].y, E[i].z + 1.5, E[i + 1].x, E[i + 1].y, E[i + 1].z, 0.5), 0.1);
  return d;
}
function surfZ(sdf, x, y) {
  let z = 11; while (z > 2 && sdf(x, y, z) > 0) z -= 0.25;
  let lo = z, hi = z + 0.25;
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (sdf(x, y, m) < 0) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
const skinZ = (x, y) => surfZ(skinSDF, x, y);
const skullZ = (x, y) => surfZ(skullSDF, x, y);

function buildSDFMesh(sdf, res, cx, cy, cz, half, material, maxPoly) {
  const mc = new MarchingCubes(res, material, false, false, maxPoly);
  mc.isolation = 0;
  const f = mc.field, N = res;
  for (let k = 0; k < N; k++) {
    const z = cz + ((k - N / 2) / (N / 2)) * half;
    for (let j = 0; j < N; j++) {
      const y = cy + ((j - N / 2) / (N / 2)) * half;
      for (let i = 0; i < N; i++) {
        const x = cx + ((i - N / 2) / (N / 2)) * half;
        f[i + j * N + k * N * N] = -sdf(x, y, z);
      }
    }
  }
  mc.scale.setScalar(half); mc.position.set(cx, cy, cz);
  mc.frustumCulled = false;
  mc.update();
  return mc;
}

// ---------- materials ----------
const VERT = `varying vec3 vN;varying vec3 vV;varying vec3 vW;varying vec2 vUv;varying float vM;attribute float aMask;
void main(){vUv=uv;
#ifdef USE_MASK
vM=aMask;
#else
vM=1.;
#endif
vec4 wp=modelMatrix*vec4(position,1.);vW=wp.xyz;vec4 mv=viewMatrix*wp;
vN=normalize(mat3(viewMatrix)*normalize(mat3(modelMatrix)*normal));vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`;
const LIGHT = `
vec3 n=normalize(vN);vec3 v=normalize(vV);
float ndv=abs(dot(n,v));float rim=pow(1.-ndv,uPow);
vec3 L=normalize(vec3(-0.45,0.65,0.62));float lam=max(dot(n,L),0.);
vec3 L2=normalize(vec3(0.6,-0.2,0.5));float lam2=max(dot(n,L2),0.);
`;
function ghostMat(o) {
  return new THREE.ShaderMaterial({
    defines: o.mask ? {USE_MASK: 1} : {},
    uniforms: {uBase: {value: new THREE.Color(o.base)}, uRim: {value: new THREE.Color(o.rim)}, uA0: {value: o.a0}, uA1: {value: o.a1},
      uPow: {value: o.pow || 2.2}, uK: {value: 1}, uFade: {value: new THREE.Vector2(o.fLo ?? -99, o.fHi ?? -98)}, uRimK: {value: o.rimK ?? 1.6}},
    vertexShader: VERT,
    fragmentShader: `uniform vec3 uBase,uRim;uniform float uA0,uA1,uPow,uK,uRimK;uniform vec2 uFade;
varying vec3 vN;varying vec3 vV;varying vec3 vW;varying vec2 vUv;varying float vM;
void main(){${LIGHT}
if(vM<0.03)discard;
vec3 col=uBase*(0.32+0.75*lam+0.25*lam2)+uRim*rim*uRimK;
float a=(uA0*(0.55+0.45*lam)+uA1*rim)*uK*smoothstep(0.03,0.6,vM);
a*=smoothstep(uFade.x,uFade.y,vW.y);
gl_FragColor=vec4(col,clamp(a,0.,1.));}`,
    transparent: true, depthWrite: false, side: o.side ?? THREE.FrontSide
  });
}
function solidMat(o) {
  return new THREE.ShaderMaterial({
    uniforms: {uBase: {value: new THREE.Color(o.base)}, uRim: {value: new THREE.Color(o.rim)}, uGlowCol: {value: new THREE.Color(o.glowCol || 0xffffff)},
      uGlow: {value: 0}, uA: {value: o.alpha ?? 1}, uPow: {value: 2.0}},
    vertexShader: VERT,
    fragmentShader: `uniform vec3 uBase,uRim,uGlowCol;uniform float uGlow,uA,uPow;
varying vec3 vN;varying vec3 vV;varying vec3 vW;varying vec2 vUv;varying float vM;
void main(){${LIGHT}
vec3 col=uBase*(0.28+0.8*lam+0.3*lam2)+uRim*rim*1.2+uGlowCol*uGlow;
gl_FragColor=vec4(col,uA);}`,
    transparent: (o.alpha ?? 1) < 1, side: o.side ?? THREE.FrontSide, depthWrite: (o.alpha ?? 1) >= 1
  });
}
const PULSE_GLSL = `
float pulseI(float u,float T,float dur,float w){float g=0.;
for(int k=0;k<9;k++){float uk=(T-0.35-0.45*float(k))/dur;if(uk>-0.02&&uk<1.06)g+=exp(-pow((u-uk)/w,2.));}
return g;}`;
const uT = {value: 0};
function cochleaMat() {
  return new THREE.ShaderMaterial({
    uniforms: {uT, uBase: {value: new THREE.Color(0x7a9ccc)}, uRim: {value: new THREE.Color(0x66b3ff)}, uPow: {value: 2.0}},
    vertexShader: VERT,
    fragmentShader: `uniform float uT,uPow;uniform vec3 uBase,uRim;
varying vec3 vN;varying vec3 vV;varying vec3 vW;varying vec2 vUv;varying float vM;
float G(float u){float g=0.;for(int k=0;k<9;k++){float dt=uT-(0.35+0.45*float(k)+1.6);if(dt>0.){float hp=dt*2.2;g+=exp(-dt*2.2)*(0.25+1.6*exp(-pow((u-hp)/0.2,2.)));}}return g;}
void main(){${LIGHT}
vec3 col=uBase*(0.3+0.8*lam+0.3*lam2)+uRim*rim*1.2;
float g=G(vUv.x);col+=vec3(0.25,0.7,1.)*g*1.5*(0.5+0.8*rim)+vec3(0.8,0.95,1.)*g*0.35;
gl_FragColor=vec4(col,1.);}`
  });
}
function waveMat(intensity, dur, falloff) {
  return new THREE.ShaderMaterial({
    uniforms: {uT, uI: {value: intensity}, uDur: {value: dur}, uW: {value: 0.05}, uFall: {value: falloff || 0}, uBaseI: {value: 0.1}, uK: {value: 1}},
    vertexShader: VERT,
    fragmentShader: `uniform float uT,uI,uDur,uW,uFall,uBaseI,uK;
varying vec3 vN;varying vec3 vV;varying vec3 vW;varying vec2 vUv;varying float vM;
${PULSE_GLSL}
void main(){vec3 n=normalize(vN);vec3 v=normalize(vV);float f=pow(abs(dot(n,v)),1.4);
float env=smoothstep(0.30,0.8,uT);
float p=pulseI(vUv.x,uT,uDur,uW)*mix(1.,(1.-vUv.x),uFall);
float I=(uBaseI*env+p*1.2)*uI*uK;
vec3 col=mix(vec3(0.08,0.42,1.0),vec3(0.75,0.95,1.0),clamp(p*0.6,0.,1.));
gl_FragColor=vec4(col*I*f,1.);}`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
}

// ---------- tapered tube ----------
function taperedTube(curve, segs, rad, rfn) {
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, P = curve.getPointAt(u), N = frames.normals[i], B = frames.binormals[i], r = rfn(u);
    for (let j = 0; j <= rad; j++) {
      const a = j / rad * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const nx = N.x * c + B.x * s, ny = N.y * c + B.y * s, nz = N.z * c + B.z * s;
      pos.push(P.x + nx * r, P.y + ny * r, P.z + nz * r); nor.push(nx, ny, nz); uv.push(u, j / rad);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < rad; j++) {
    const a = i * (rad + 1) + j, b = (i + 1) * (rad + 1) + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); return g;
}
const line = (a, b) => new THREE.LineCurve3(a, b);
function sphere(mat, p, rx, ry = rx, rz = rx) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), mat); m.position.copy(p); m.scale.set(rx, ry, rz); return m;
}

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({antialias: false, preserveDrawingBuffer: true});
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, W / H, 0.05, 400);
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(-6, 10, 12); scene.add(key);
const rimL = new THREE.DirectionalLight(0x3d8bff, 2.2); rimL.position.set(8, 3, -10); scene.add(rimL);

// background
{
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vU;void main(){vU=uv;gl_Position=vec4(position.xy,1.,1.);}',
    fragmentShader: `varying vec2 vU;float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec2 p=vU-vec2(0.5,0.52);p.x*=0.56;float r=length(p);
vec3 c=mix(vec3(0.004,0.014,0.04),vec3(0.001,0.003,0.01),smoothstep(0.0,0.62,r));
c+=vec3(0.0,0.01,0.03)*exp(-pow(vU.y-0.5,2.)*18.);
c+=(h(gl_FragCoord.xy)-0.5)*0.004;gl_FragColor=vec4(c,1.);}`,
    depthTest: false, depthWrite: false
  }));
  bg.frustumCulled = false; bg.renderOrder = -100; scene.add(bg);
}

const world = new THREE.Group(); scene.add(world);

// skull + skin
const skullMat = ghostMat({base: 0x7f93ad, rim: 0x2f86ff, a0: 0.22, a1: 0.7, pow: 2.4, fLo: -11, fHi: -4, rimK: 0.9});
const skull = buildSDFMesh(skullSDF, MCRES, 0, 1, 0, 13, skullMat, 500000); skull.renderOrder = 2; world.add(skull);
const skinMat = ghostMat({base: 0x6f8fbf, rim: 0x5fa0ff, a0: 0.0, a1: 0.22, pow: 3.2, fLo: -10, fHi: -3, rimK: 0.45});
const skin = buildSDFMesh(skinSDF, Math.round(MCRES * 0.9), 0.5, 1, 0, 14, skinMat, 500000); skin.renderOrder = 4; world.add(skin);

// pinna (height field relief on skin)
function ap(x, y, ax, ay, bx, by) { // distance to segment
  const px = x - ax, py = y - ay, bx_ = bx - ax, by_ = by - ay;
  const h = clamp01((px * bx_ + py * by_) / (bx_ * bx_ + by_ * by_)); return Math.hypot(px - bx_ * h, py - by_ * h);
}
const ECX = -1.0, ECY = 0.75, TILT = 14 * Math.PI / 180;
function pinnaField(x, y) {
  const dx = x - ECX, dy = y - ECY;
  const v = dx * -Math.sin(TILT) + dy * Math.cos(TILT), u = dx * Math.cos(TILT) + dy * Math.sin(TILT);
  const A = 3.15, B = 1.85 - 0.75 * ss(-0.2, -2.9, v) + 0.12 * ss(0.4, 2.0, v);
  const rho = Math.sqrt(sq(u / B) + sq(v / A)); const sd = (rho - 1) * 1.7;
  let inO = ss(0.1, -0.12, sd);
  const trg = Math.sqrt(sq((x - 1.0) / 0.5) + sq((y - 0.1) / 0.62));
  const inT = ss(1.05, 0.8, trg);
  let m = Math.max(inO, inT);
  const hole = Math.hypot(x - 0.0, y + 0.1); m *= ss(0.40, 0.52, hole);
  // relief
  const lob = ss(-1.2, -2.0, v);
  let h = 0.42 * inO + 0.3 * inO * lob;
  const cav = Math.exp(-Math.pow(Math.sqrt(sq((x + 0.15) / 0.9) + sq((y + 0.1) / 1.05)), 3.5) * 1.4);
  h *= (1 - 0.97 * cav);
  const hr = 0.85 + 0.6 * ss(0.2, 2.6, v);
  h += hr * Math.exp(-sq((sd + 0.28) / 0.24)) * (1 - lob) * inO;
  const dAH = Math.min(ap(x, y, -0.4, -0.95, -0.85, 0.2), ap(x, y, -0.85, 0.2, -1.0, 1.3), ap(x, y, -1.0, 1.3, -1.7, 2.8), ap(x, y, -1.0, 1.3, -0.2, 2.2));
  h += 0.55 * Math.exp(-sq(dAH / 0.3)) * inO;
  h += 0.85 * Math.exp(-(sq((x - 1.0) / 0.38) + sq((y - 0.1) / 0.5)));
  h += 0.5 * Math.exp(-(sq((x + 0.55) / 0.42) + sq((y + 1.25) / 0.32)));
  return {h, m};
}
{
  const x0 = -5.2, x1 = 2.8, y0 = -4.6, y1 = 5.6, nx = 150, ny = 190;
  const pos = [], msk = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const x = x0 + (x1 - x0) * i / nx, y = y0 + (y1 - y0) * j / ny;
    const {h, m} = pinnaField(x, y);
    pos.push(x, y, m > 0.01 ? skinZ(x, y) + h * 1.0 + 0.02 : 6); msk.push(m);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aMask', new THREE.Float32BufferAttribute(msk, 1));
  g.setIndex(idx); g.computeVertexNormals();
  const pinMat = ghostMat({base: 0xa9bdd8, rim: 0x6fb0ff, a0: 0.22, a1: 0.6, pow: 2.0, mask: true, fLo: -6, fHi: -3, rimK: 0.8});
  const pin = new THREE.Mesh(g, pinMat); pin.renderOrder = 5; world.add(pin);
}

// ear canal lumen
const canalCurve = new THREE.CatmullRomCurve3(E);
{
  const g = taperedTube(canalCurve, 60, 24, u => 0.4 - 0.02 * u);
  const m = new THREE.Mesh(g, ghostMat({base: 0x9fb4d0, rim: 0x7fc0ff, a0: 0.05, a1: 0.6, pow: 1.5, rimK: 0.9})); m.renderOrder = 6; world.add(m);
}

// eardrum
const drumMat = solidMat({base: 0x9fb0c8, rim: 0x6fb0ff, alpha: 0.5, side: THREE.DoubleSide, glowCol: 0xcfe6ff});
const uv_ = V3(0, 1, 0).addScaledVector(nD, -nD.y).normalize();
const e1 = new THREE.Vector3().crossVectors(uv_, nD).normalize();
{
  const pos = [], idx = [], R = 9, S = 40;
  pos.push(...DRUM.clone().addScaledVector(nD, -0.14).toArray());
  for (let r = 1; r <= R; r++) for (let s = 0; s <= S; s++) {
    const rho = r / R, a = s / S * Math.PI * 2;
    const p = DRUM.clone().addScaledVector(e1, Math.cos(a) * 0.4 * rho).addScaledVector(uv_, Math.sin(a) * 0.46 * rho).addScaledVector(nD, -0.14 * (1 - rho) * (1 - rho * 0.3));
    pos.push(p.x, p.y, p.z);
  }
  for (let s = 0; s < S; s++) idx.push(0, 1 + s, 2 + s);
  for (let r = 1; r < R; r++) for (let s = 0; s < S; s++) {
    const a = 1 + (r - 1) * (S + 1) + s, b = a + 1, c = a + S + 1, d = c + 1; idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const dm = new THREE.Mesh(g, drumMat); dm.renderOrder = 7; world.add(dm);
}

// ossicles
const ossMats = [0, 1, 2].map(() => solidMat({base: 0x8d9bb0, rim: 0x5ea8ff, glowCol: 0xb8d8ff}));
const Um = DRUM.clone().addScaledVector(nD, -0.12);
const Nk = Um.clone().addScaledVector(uv_, 0.5);
const Hd = Nk.clone().add(V3(-0.12, 0.2, -0.45));
const Ib = Hd.clone().add(V3(-0.3, -0.05, -0.08));
const Lp = Ib.clone().add(V3(0.02, -0.5, -0.2));
const Sh = Lp.clone().add(V3(-0.1, 0, -0.3));
const Fp = Sh.clone().add(V3(-0.25, 0, -0.28));
{
  const add = (m) => { m.renderOrder = 1; world.add(m); };
  const mk = (a, b, r0, r1, mat) => add(new THREE.Mesh(taperedTube(line(a, b), 8, 10, u => lerp(r0, r1, u)), mat));
  mk(Um, Nk, 0.055, 0.045, ossMats[0]); mk(Nk, Hd, 0.05, 0.06, ossMats[0]); add(sphere(ossMats[0], Hd, 0.14));
  add(sphere(ossMats[1], Ib, 0.17, 0.2, 0.14));
  mk(Ib, Ib.clone().add(V3(-0.32, -0.03, 0.12)), 0.05, 0.03, ossMats[1]);
  mk(Ib, Lp, 0.045, 0.03, ossMats[1]); add(sphere(ossMats[1], Lp, 0.05));
  add(sphere(ossMats[2], Sh, 0.05));
  mk(Sh, Fp.clone().add(V3(0, 0.07, 0)), 0.02, 0.02, ossMats[2]); mk(Sh, Fp.clone().add(V3(0, -0.07, 0)), 0.02, 0.02, ossMats[2]);
  add(sphere(ossMats[2], Fp, 0.19, 0.1, 0.03));
}

// inner ear
const VT = Fp.clone().add(V3(-0.05, 0.08, -0.33));
const inMat = solidMat({base: 0x7d9cc8, rim: 0x4f9bff, alpha: 0.9});
{
  world.add(sphere(inMat, VT, 0.4, 0.5, 0.38));
  const tri = [[V3(0.1, 1, 0.1), V3(-0.75, 0.1, 0.65), 0.5], [V3(0.75, 0, 0.65), V3(0.1, 0.95, 0), 0.6], [V3(-0.65, 0, 0.75), V3(-0.52, -0.3, -0.45), 0.58]];
  for (const [n0, w0, R] of tri) {
    const n = n0.clone().normalize(), w = w0.clone().addScaledVector(n, -n.dot(w0)).normalize(), qv = new THREE.Vector3().crossVectors(n, w);
    const C = VT.clone().addScaledVector(w, R), pts = [];
    for (let i = 0; i <= 60; i++) {
      const th = -(Math.PI - 0.6) + (2 * (Math.PI - 0.6)) * i / 60;
      pts.push(C.clone().addScaledVector(w, Math.cos(th) * R).addScaledVector(qv, Math.sin(th) * R));
    }
    world.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3(pts), 90, 12, () => 0.075), inMat));
    world.add(sphere(inMat, pts[0], 0.13, 0.13, 0.13));
  }
}
// cochlea
const aC = V3(0.7, -0.2, 0.6).normalize();
const Bc = VT.clone().add(V3(0.55, -0.45, -0.5));
let spiralPts = [];
{
  const p1 = new THREE.Vector3().crossVectors(aC, V3(0, 1, 0)).normalize(), p2 = new THREE.Vector3().crossVectors(aC, p1).normalize();
  const toV = VT.clone().sub(Bc); const th0 = Math.atan2(toV.dot(p2), toV.dot(p1));
  for (let i = 0; i <= 260; i++) {
    const t = i / 260, th = th0 + 2 * Math.PI * 2.5 * t, R = 0.09 + 0.22 * (1 - t);
    spiralPts.push(Bc.clone().addScaledVector(aC, 0.6 * t).addScaledVector(p1, Math.cos(th) * R).addScaledVector(p2, Math.sin(th) * R));
  }
  const curve = new THREE.CatmullRomCurve3(spiralPts);
  const cm = new THREE.Mesh(taperedTube(curve, 400, 14, t => 0.105 * (1 - 0.55 * t) + 0.02), cochleaMat()); world.add(cm);
  world.add(sphere(cochleaMat(), spiralPts[260], 0.045));
  // vestibule link + auditory nerve
  world.add(new THREE.Mesh(taperedTube(line(VT.clone().add(V3(0.15, -0.2, 0)), spiralPts[0]), 6, 10, () => 0.09), inMat));
  const nc = new THREE.CatmullRomCurve3([Bc.clone().addScaledVector(aC, 0.1), Bc.clone().add(V3(-0.4, 0.1, -0.8)), Bc.clone().add(V3(-0.9, 0.25, -1.9)), Bc.clone().add(V3(-1.3, 0.4, -3.2))]);
  const nm = ghostMat({base: 0xf2f7ff, rim: 0x9ad0ff, a0: 0.7, a1: 0.3, pow: 2}); nm.uniforms.uFade.value.set(-99, -98);
  const nmesh = new THREE.Mesh(taperedTube(nc, 40, 10, u => 0.075 * (1 - 0.3 * u)), nm); nmesh.renderOrder = 3; world.add(nmesh);
}

// headphone
let padMatRef, armMat, ledMat; const hpGroup = new THREE.Group(); world.add(hpGroup);
const padX = 2.9, padY = 0.15, padZ = skinZ(padX, padY);
{
  const darkMat = new THREE.MeshStandardMaterial({color: 0x10162a, metalness: 0.7, roughness: 0.28, envMapIntensity: 1.1});
  const padMat = new THREE.MeshStandardMaterial({color: 0x161e36, metalness: 0.6, roughness: 0.22, transparent: true, opacity: 0.4, envMapIntensity: 0.9});
  padMatRef = padMat; const pad = new THREE.Mesh(new RoundedBoxGeometry(1.45, 2.1, 0.62, 5, 0.26), padMat);
  pad.position.set(padX, padY, padZ + 0.3); pad.renderOrder = 8; hpGroup.add(pad);
  ledMat = new THREE.MeshBasicMaterial({color: new THREE.Color(0.2, 0.6, 1).multiplyScalar(1.2), transparent: true}); const led = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.018, 8, 64), ledMat);
  led.position.set(padX, padY, padZ + 0.63); hpGroup.add(led);
  const top = (x, y, o) => V3(x, y, skinZ(x, y) + o);
  const armPts = [top(padX - 0.1, 1.0, 0.55), top(2.4, 2.7, 0.9), top(1.1, 4.0, 1.4), top(-0.8, 4.5, 2.3), top(-2.7, 4.3, 2.4), top(-4.2, 2.9, 1.7), top(-4.4, 0.6, 1.1), top(-3.9, -2.2, 0.8), top(-3.2, -5, 0.8)];
  darkMat.transparent = true; armMat = darkMat; const arm = new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3(armPts), 160, 14, () => 0.17), darkMat); arm.renderOrder = 8; hpGroup.add(arm);
}

// ---------- bone-conduction waves ----------
const waveLen = 1;
const tgtC = spiralPts[118].clone();
const contact = V3(padX, padY, padZ - 0.1);
const boneTop = skullZ(padX, padY);
const mainPts = [contact, V3(padX - 0.05, padY, boneTop - 0.15), V3(2.5, 0.1, 4.9), V3(2.15, -0.05, 3.7), V3(1.6, -0.25, 2.8), tgtC.clone().add(V3(0.1, -0.02, 0.15))];
const mainCurve = new THREE.CatmullRomCurve3(mainPts);
const mainLen = mainCurve.getLength();
const waveMeshes = [];
function addWave(curve, intensity, rad, falloff, haloR, haloI) {
  const len = curve.getLength(), dur = 1.6 * len / mainLen;
  const m1 = new THREE.Mesh(taperedTube(curve, 260, 10, () => rad), waveMat(intensity, dur, falloff)); m1.renderOrder = 10; world.add(m1);
  const m2 = new THREE.Mesh(taperedTube(curve, 260, 10, () => haloR), waveMat(haloI, dur, falloff)); m2.renderOrder = 10; world.add(m2);
  m1.material.uniforms.uW.value = 0.05; m2.material.uniforms.uW.value = 0.08;
}
addWave(mainCurve, 1.6, 0.06, 0, 0.26, 0.22);
{
  const sz = (x, y) => V3(x, y, skullZ(x, y) - 0.4);
  addWave(new THREE.CatmullRomCurve3([V3(padX, padY, boneTop - 0.15), sz(1.6, 1.2), sz(-0.4, 2.5), sz(-2.8, 3.4), sz(-5, 3.5)]), 0.8, 0.045, 1, 0.2, 0.12);
  addWave(new THREE.CatmullRomCurve3([V3(padX, padY, boneTop - 0.15), sz(1.8, -1.2), sz(-0.2, -1.9), sz(-2.2, -2.6), sz(-3.5, -3.6)]), 0.7, 0.045, 1, 0.2, 0.1);
  addWave(new THREE.CatmullRomCurve3([V3(padX, padY, boneTop - 0.15), sz(5, -0.6), sz(7, -1.0)].map(p => p)), 0.6, 0.04, 1, 0.18, 0.1);
}
// pulse rings
const ringMats = [], rings = [];
for (let i = 0; i < 6; i++) for (let s = 0; s < 3; s++) {
  const mat = new THREE.MeshBasicMaterial({color: new THREE.Color(0.15, 0.55, 1).multiplyScalar(1.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0});
  const m = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 72), mat); m.renderOrder = 11; world.add(m); rings.push({m, i, s});
}
// contact ripples
const ripples = [];
for (let i = 0; i < 3; i++) {
  const mat = new THREE.MeshBasicMaterial({color: new THREE.Color(0.2, 0.6, 1).multiplyScalar(1.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0});
  const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.0, 64), mat); m.position.set(padX, padY, padZ + 0.02); m.renderOrder = 11; world.add(m); ripples.push(m);
}
// particles
const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(120,190,255,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const NP = 420, pSeed = [];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < NP; i++) pSeed.push({u0: rnd(), a: rnd() * 6.28, r: rnd() * 0.42, sp: 0.5 + rnd() * 0.5, ph: rnd() * 6.28});
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(NP * 3), 3)); pGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(NP * 3), 3));
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({size: 0.16, map: dotTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true}));
pts.renderOrder = 12; pts.frustumCulled = false; world.add(pts);
const tmpN = new THREE.Vector3(), tmpB = new THREE.Vector3();
function pulseJS(u, t, dur, w) { let g = 0; for (let k = 0; k < 9; k++) { const uk = (t - 0.35 - 0.45 * k) / dur; if (uk > -0.02 && uk < 1.06) g += Math.exp(-sq((u - uk) / w)); } return g; }

// ---------- air path (white) ----------
const airPts = [V3(-1.8, 0.5, 13), V3(-0.8, 0.2, 9.8), ...E];
const airCurve = new THREE.CatmullRomCurve3(airPts); const airLen = airCurve.getLength();
let sE0 = 0; { const a = airCurve.getLength(); let best = 1e9; for (let i = 0; i <= 300; i++) { const p = airCurve.getPointAt(i / 300); const d = p.distanceTo(E[0]); if (d < best) { best = d; sE0 = i / 300 * a; } } }
const airRings = [];
for (let i = 0; i < 4; i++) for (let s = 0; s < 2; s++) {
  const mat = new THREE.MeshBasicMaterial({color: new THREE.Color(0.8, 0.92, 1).multiplyScalar(1.3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0});
  const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 96), mat); m.renderOrder = 11; world.add(m); airRings.push({m, i, s});
}

// dust
{
  const g = new THREE.BufferGeometry(), p = [];
  for (let i = 0; i < 260; i++) p.push((rnd() - 0.5) * 70, (rnd() - 0.5) * 90, (rnd() - 0.5) * 50);
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const d = new THREE.Points(g, new THREE.PointsMaterial({size: 0.22, map: dotTex, color: new THREE.Color(0.25, 0.45, 0.8), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false}));
  d.renderOrder = -50; scene.add(d); window.__dust = d;
}

// contact glow under pad
{
  const gm = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshBasicMaterial({map: dotTex, color: new THREE.Color(0.3, 0.7, 1).multiplyScalar(1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55}));
  gm.position.set(padX, padY, padZ + 0.03); gm.renderOrder = 11; world.add(gm); window.__cg = gm;
}

// ---------- post ----------
const rt = new THREE.WebGLRenderTarget(W, H, {type: THREE.HalfFloatType, samples: 4});
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.45, 0.5, 0.85); composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- animation ----------
const quat = new THREE.Quaternion(), Z = V3(0, 0, 1);
function update(t) {
  uT.value = t;
  // camera
  const s = 0.12 * (t / 5) + 0.88 * sm5((t - 1.0) / 3.6);
  const d = Math.exp(lerp(Math.log(80), Math.log(11), s));
  const az = lerp(-6, 24, s) * Math.PI / 180, el = lerp(3, 26, s) * Math.PI / 180;
  const tg = V3(lerp(0.6, 0.65, s), lerp(0.4, -0.3, s), lerp(0, 2.3, s));
  camera.position.set(tg.x + d * Math.sin(az) * Math.cos(el), tg.y + d * Math.sin(el), tg.z + d * Math.cos(az) * Math.cos(el));
  camera.lookAt(tg);
  const close = ss(0.35, 0.85, s);
  skullMat.uniforms.uK.value = lerp(1, 0.14, close); padMatRef.opacity = lerp(0.45, 0.12, close); armMat.opacity = 1 - 0.97 * close; ledMat.opacity = 1 - close;
  skinMat.uniforms.uK.value = lerp(1, 0.08, close);
  // bone rings
  const phase = (t - 0.35) / 0.45;
  for (const r of rings) {
    const k = Math.floor(phase) - r.i; const u = (t - 0.35 - 0.45 * k) / 1.6 - r.s * 0.03;
    if (k < 0 || u < 0 || u > 1) { r.m.material.opacity = 0; continue; }
    const p = mainCurve.getPointAt(u), tn = mainCurve.getTangentAt(u);
    r.m.position.copy(p); quat.setFromUnitVectors(Z, tn); r.m.quaternion.copy(quat);
    const R = 0.22 + 0.16 * Math.sin(Math.PI * u); r.m.scale.setScalar(R);
    r.m.material.opacity = Math.sin(Math.PI * u) * (r.s === 0 ? 0.8 : r.s === 1 ? 0.45 : 0.22) * (1 - 0.4 * close);
  }
  // ripples at contact
  ripples.forEach((m, i) => {
    const ph = ((t - 0.35) / 0.9 + i / 3) % 1; const on = t > 0.3;
    m.scale.setScalar(0.3 + ph * 1.5); m.material.opacity = on ? (1 - ph) * (1 - ph) * 0.7 : 0;
  });
  window.__cg.material.opacity = (0.25 + 0.3 * Math.max(0, Math.sin((t - 0.35) / 0.45 * Math.PI * 2))) * ss(0.2, 0.6, t);
  // particles
  const pp = pGeo.attributes.position.array, pc = pGeo.attributes.color.array;
  for (let i = 0; i < NP; i++) {
    const sd = pSeed[i]; const u = ((sd.u0 + t * 0.32 * sd.sp) % 1);
    const p = mainCurve.getPointAt(u), tn = mainCurve.getTangentAt(u);
    tmpN.set(0, 1, 0).addScaledVector(tn, -tn.y).normalize(); tmpB.crossVectors(tn, tmpN);
    const a = sd.a + t * 0.8 * sd.sp, r = sd.r * (0.5 + 0.5 * Math.sin(Math.PI * u)) * (1 + 0.3 * Math.sin(t * 5 + sd.ph));
    pp[i * 3] = p.x + (tmpN.x * Math.cos(a) + tmpB.x * Math.sin(a)) * r;
    pp[i * 3 + 1] = p.y + (tmpN.y * Math.cos(a) + tmpB.y * Math.sin(a)) * r;
    pp[i * 3 + 2] = p.z + (tmpN.z * Math.cos(a) + tmpB.z * Math.sin(a)) * r;
    const b = (0.2 + 0.9 * pulseJS(u, t, 1.6, 0.07)) * smoothstep01(0.3, 0.8, t) * Math.sin(Math.PI * Math.min(1, u * 1.02));
    pc[i * 3] = 0.15 * b; pc[i * 3 + 1] = 0.55 * b; pc[i * 3 + 2] = 1.0 * b;
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
  // air rings
  const ph2 = (t - 0.7) / 0.5;
  for (const r of airRings) {
    const k = Math.floor(ph2) - r.i; const u = (t - 0.7 - 0.5 * k) / 1.5 - r.s * 0.025;
    if (k < 0 || u < 0 || u > 1) { r.m.material.opacity = 0; continue; }
    const p = airCurve.getPointAt(u), tn = airCurve.getTangentAt(u);
    r.m.position.copy(p); quat.setFromUnitVectors(Z, tn); r.m.quaternion.copy(quat);
    const sIn = u * airLen - sE0; const R = (sIn < 0 ? 0.4 + Math.min(1.5, -sIn * 0.3) : 0.38) * (r.s ? 0.78 : 1);
    r.m.scale.setScalar(R);
    r.m.material.opacity = ss(0, 0.12, u) * (1 - ss(0.9, 1.0, u)) * (r.s ? 0.12 : 0.28) * (1 - 0.6 * close);
  }
  // air arrival -> drum / ossicles glow
  const arr = (delay) => { let g = 0; for (let k = 0; k < 8; k++) { const dt = t - (0.7 + 0.5 * k + 1.5 + delay); if (dt > 0) g += Math.exp(-dt * 5) * 0.9; } return Math.min(g, 1.2); };
  drumMat.uniforms.uGlow.value = arr(0) * 0.8;
  ossMats.forEach((m, i) => m.uniforms.uGlow.value = arr(0.06 + 0.07 * i) * 0.7);
  const dust = window.__dust; dust.position.y = Math.sin(t * 0.5) * 0.8; dust.rotation.y = t * 0.02;
}
function smoothstep01(a, b, x) { return ss(a, b, x); }

window.renderFrame = (i) => { update(i / FPS); composer.render(); return true; };
window.__ready = true;
const tq = Q.get('t'); if (tq !== null) window.renderFrame(Math.round(Number(tq) * FPS));
