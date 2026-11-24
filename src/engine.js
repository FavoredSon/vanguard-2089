// ============================================================================
// VANGUARD 2089 — WebGL2 PBR + PCF Shadows + HDR Bloom + Cyber-Scan Engine
// ============================================================================
import { M4 } from './math.js';
import { createTextureLibrary } from './textures.js';

const MAX_LIGHTS = 12;

// --- SHADERS (GLSL 300 es) ---

const SHADOW_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
uniform mat4 uLightVP;
uniform mat4 uModel;
void main() {
  gl_Position = uLightVP * uModel * vec4(aPos, 1.0);
}`;

const SHADOW_FS = `#version 300 es
precision mediump float;
void main() {}`;

const PBR_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aNorm;
layout(location = 2) in vec2 aUv;

uniform mat4 uModel;
uniform mat4 uViewProj;
uniform mat4 uLightVP;
uniform vec2 uUvScale;

out vec3 vWorldPos;
out vec3 vNormal;
out vec2 vUv;
out vec4 vLightSpacePos;

void main() {
  vec4 wp = uModel * vec4(aPos, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(uModel) * aNorm);
  vUv = aUv * uUvScale;
  vLightSpacePos = uLightVP * wp;
  gl_Position = uViewProj * wp;
}`;

const PBR_FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;

in vec3 vWorldPos;
in vec3 vNormal;
in vec2 vUv;
in vec4 vLightSpacePos;

uniform sampler2D uAlbedoMap;
uniform sampler2DShadow uShadowMap;
uniform vec3 uCamPos;
uniform vec3 uColor;
uniform vec3 uEmissive;
uniform float uRoughness;
uniform float uMetallic;
uniform float uAlpha;
uniform int uUseShadow;
uniform int uUseFog;

// Sun / Directional Light
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uFogColor;
uniform float uFogDensity;

// Cyber-Scan pulse wave
uniform vec3 uScanOrigin;
uniform float uScanRadius;
uniform float uScanStrength;
uniform float uHighlight; // 1.0 on enemies during optic scan

// Dynamic Point Lights
uniform int uNumLights;
uniform vec4 uLightPosRad[${MAX_LIGHTS}];   // xyz = pos, w = radius
uniform vec4 uLightColInt[${MAX_LIGHTS}];   // rgb = color, w = intensity

out vec4 fragColor;

const float PI = 3.14159265359;

float D_GGX(float NdotH, float r) {
  float a = r * r;
  float a2 = a * a;
  float d = (NdotH * NdotH) * (a2 - 1.0) + 1.0;
  return a2 / max(PI * d * d, 0.0001);
}

float G_SchlickGGX(float NdotV, float r) {
  float k = (r + 1.0);
  k = (k * k) / 8.0;
  return NdotV / max(NdotV * (1.0 - k) + k, 0.0001);
}

vec3 F_Schlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 evalBRDF(vec3 N, vec3 V, vec3 L, vec3 albedo, float rough, float metal, vec3 F0) {
  float NdotL = max(dot(N, L), 0.0);
  if (NdotL <= 0.0) return vec3(0.0);
  vec3 H = normalize(V + L);
  float NdotV = max(dot(N, V), 0.001);
  float NdotH = max(dot(N, H), 0.0);
  float HdotV = max(dot(H, V), 0.0);

  float NDF = D_GGX(NdotH, rough);
  float G = G_SchlickGGX(NdotV, rough) * G_SchlickGGX(NdotL, rough);
  vec3 F = F_Schlick(HdotV, F0);

  vec3 spec = (NDF * G * F) / max(4.0 * NdotV * NdotL, 0.001);
  vec3 kD = (vec3(1.0) - F) * (1.0 - metal);
  return (kD * albedo / PI + spec) * NdotL;
}

float calcShadow(vec4 lsPos, vec3 N, vec3 L) {
  if (uUseShadow == 0) return 1.0;
  vec3 proj = lsPos.xyz / lsPos.w;
  proj = proj * 0.5 + 0.5;
  if (proj.z > 0.999 || proj.x < 0.01 || proj.x > 0.99 || proj.y < 0.01 || proj.y > 0.99) return 1.0;
  float bias = max(0.0026 * (1.0 - dot(N, L)), 0.0008);
  vec2 texel = vec2(1.0 / 1024.0);
  float s = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      s += texture(uShadowMap, vec3(proj.xy + vec2(x, y) * texel, proj.z - bias));
    }
  }
  return s / 9.0;
}

void main() {
  vec4 tex = texture(uAlbedoMap, vUv);
  vec3 albedo = pow(tex.rgb, vec3(2.2)) * uColor;
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(uCamPos - vWorldPos);

  float rough = clamp(uRoughness, 0.06, 0.98);
  // Subtle micro-roughness variation from texture luma for rich surface feel
  float texLuma = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
  rough = clamp(rough + (0.5 - texLuma) * 0.18, 0.06, 0.98);

  vec3 F0 = mix(vec3(0.04), albedo, uMetallic);

  // Directional moon/searchlight with PCF shadows
  vec3 Lsun = normalize(uSunDir);
  float shadow = calcShadow(vLightSpacePos, N, Lsun);
  vec3 Lo = evalBRDF(N, V, Lsun, albedo, rough, uMetallic, F0) * uSunColor * (0.25 + 0.75 * shadow);

  // Dynamic point lights (neon signs, muzzle flashes, plasma, beacons, fire)
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uNumLights) break;
    vec3 lpos = uLightPosRad[i].xyz;
    float lrad = uLightPosRad[i].w;
    vec3 toL = lpos - vWorldPos;
    float dist = length(toL);
    if (dist < lrad) {
      vec3 L = toL / max(dist, 0.001);
      float att = clamp(1.0 - (dist / lrad), 0.0, 1.0);
      att = att * att * (3.0 - 2.0 * att) / (1.0 + dist * dist * 0.045);
      Lo += evalBRDF(N, V, L, albedo, rough, uMetallic, F0) * uLightColInt[i].rgb * uLightColInt[i].w * att;
    }
  }

  // Hemisphere ambient + subtle metallic cyber-sky reflection + rim fresnel
  float hemi = N.y * 0.5 + 0.5;
  vec3 ambient = mix(uGroundColor, uSkyColor, hemi) * albedo * (1.0 - uMetallic * 0.55);
  vec3 R = reflect(-V, N);
  float refUp = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 envSpec = mix(vec3(0.04, 0.07, 0.11), vec3(0.16, 0.34, 0.48), refUp) * F_Schlick(max(dot(N, V), 0.0), F0) * (1.0 - rough * 0.75);

  vec3 color = ambient + envSpec + Lo + uEmissive;

  // Tactical Optic Scan Pulse Wave (expanding cyan cyber-grid ring)
  if (uScanStrength > 0.01 && uUseFog == 1) {
    float dScan = length(vWorldPos - uScanOrigin);
    float ring = exp(-pow((dScan - uScanRadius) * 0.65, 2.0));
    float grid = step(0.92, fract(vWorldPos.x * 0.8)) + step(0.92, fract(vWorldPos.z * 0.8)) + step(0.92, fract(vWorldPos.y * 0.8));
    color += vec3(0.0, 1.5, 2.0) * ring * (0.45 + 0.55 * min(grid, 1.0)) * uScanStrength;
    if (uHighlight > 0.5 && dScan < uScanRadius + 1.5) {
      float rim = pow(1.0 - max(dot(N, V), 0.0), 2.0);
      color += vec3(2.2, 0.35, 0.15) * (0.35 + rim * 1.6) * uScanStrength;
    }
  }

  // Atmospheric Distance + Low-Lying Height Mist Fog
  if (uUseFog == 1) {
    float dist = length(uCamPos - vWorldPos);
    float distFog = 1.0 - exp(-dist * uFogDensity);
    float heightFog = exp(-max(vWorldPos.y, 0.0) * 0.16) * clamp(dist * 0.018, 0.0, 0.55);
    float fogFactor = clamp(distFog + heightFog * 0.45, 0.0, 0.94);
    color = mix(color, uFogColor, fogFactor);
  }

  fragColor = vec4(color, uAlpha);
}`;

const UNLIT_VS = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 2) in vec2 aUv;
uniform mat4 uModel;
uniform mat4 uViewProj;
out vec2 vUv;
void main() {
  vUv = aUv;
  gl_Position = uViewProj * uModel * vec4(aPos, 1.0);
}`;

const UNLIT_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform vec4 uColor;
uniform sampler2D uAlbedoMap;
uniform int uUseTex;
out vec4 fragColor;
void main() {
  vec4 c = uColor;
  if (uUseTex == 1) c *= texture(uAlbedoMap, vUv);
  fragColor = c;
}`;

const QUAD_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const BRIGHT_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uScene;
uniform float uThreshold;
out vec4 fragColor;
void main() {
  vec3 c = texture(uScene, vUv).rgb;
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float soft = smoothstep(uThreshold, uThreshold + 0.55, luma);
  fragColor = vec4(c * soft, 1.0);
}`;

const BLUR_FS = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 fragColor;
void main() {
  vec2 off1 = uDir * 1.3846153846;
  vec2 off2 = uDir * 3.2307692308;
  vec3 col = texture(uTex, vUv).rgb * 0.2270270270;
  col += texture(uTex, vUv + off1).rgb * 0.3162162162;
  col += texture(uTex, vUv - off1).rgb * 0.3162162162;
  col += texture(uTex, vUv + off2).rgb * 0.0702702703;
  col += texture(uTex, vUv - off2).rgb * 0.0702702703;
  fragColor = vec4(col, 1.0);
}`;

const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uChromatic;
uniform float uDamageFlash;
uniform float uOverclock;
uniform float uScanStrength;
uniform float uTime;
out vec4 fragColor;

vec3 acesToneMap(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec2 centered = vUv - 0.5;
  float dist = length(centered);

  // Subtle chromatic aberration on hit / overclock / dash
  float ca = uChromatic * (0.002 + dist * 0.012);
  vec3 col;
  if (ca > 0.0004) {
    col.r = texture(uScene, vUv + centered * ca).r;
    col.g = texture(uScene, vUv).g;
    col.b = texture(uScene, vUv - centered * ca).b;
  } else {
    col = texture(uScene, vUv).rgb;
  }

  vec3 bloom = texture(uBloom, vUv).rgb * uBloomStrength;
  col += bloom;

  // Overclock (Sandevistan) cyan-amber high-contrast shift
  if (uOverclock > 0.01) {
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 tint = mix(vec3(0.05, 0.72, 0.95), vec3(1.15, 0.85, 0.45), smoothstep(0.2, 0.95, luma));
    col = mix(col, col * tint * 1.18, uOverclock * 0.42);
  }

  // ACES Filmic Tone Mapping & Gamma
  col = acesToneMap(col * uExposure);
  col = pow(col, vec3(1.0 / 2.2));

  // Subtle visor scanline sheen during Optic Scan
  if (uScanStrength > 0.01) {
    float scan = sin(vUv.y * 420.0 + uTime * 8.0) * 0.03 * uScanStrength;
    col += vec3(0.0, 0.12, 0.18) * uScanStrength * (0.25 + dist * 0.5) + scan;
  }

  // Cinematic vignette
  float vig = smoothstep(0.95, 0.34, dist);
  col *= mix(0.68, 1.0, vig);

  // Directional damage crimson edge pulse
  if (uDamageFlash > 0.01) {
    float edge = smoothstep(0.22, 0.78, dist);
    col = mix(col, vec3(0.92, 0.08, 0.1), edge * uDamageFlash * 0.78);
  }

  fragColor = vec4(col, 1.0);
}`;

// --- PROCEDURAL GEOMETRY BUILDERS ---

function createMesh(gl, positions, normals, uvs, indices) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const pb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  const nb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, nb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

  const ub = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, ub);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

  const ib = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  gl.bindVertexArray(null);
  return { vao, count: indices.length };
}

function buildBoxMesh(gl) {
  const p = [
    // +Z
    -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    // -Z
     0.5,-0.5,-0.5, -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5,
    // +Y
    -0.5, 0.5, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5,-0.5, -0.5, 0.5,-0.5,
    // -Y
    -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5,
    // +X
     0.5,-0.5, 0.5,  0.5,-0.5,-0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5,
    // -X
    -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5,
  ];
  const n = [
    0,0,1, 0,0,1, 0,0,1, 0,0,1,
    0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
    0,1,0, 0,1,0, 0,1,0, 0,1,0,
    0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
    1,0,0, 1,0,0, 1,0,0, 1,0,0,
    -1,0,0, -1,0,0, -1,0,0, -1,0,0,
  ];
  const u = [];
  const idx = [];
  for (let f = 0; f < 6; f++) {
    u.push(0, 1, 1, 1, 1, 0, 0, 0);
    const o = f * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  return createMesh(gl, p, n, u, idx);
}

function buildCylinderMesh(gl, segs = 16, topR = 0.5, botR = 0.5) {
  const p = [], n = [], u = [], idx = [];
  // Side ring
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    p.push(c * topR, 0.5, s * topR); n.push(c, 0, s); u.push(i / segs, 0);
    p.push(c * botR, -0.5, s * botR); n.push(c, 0, s); u.push(i / segs, 1);
  }
  for (let i = 0; i < segs; i++) {
    const o = i * 2;
    idx.push(o, o + 1, o + 3, o, o + 3, o + 2);
  }
  // Top cap
  if (topR > 0.001) {
    const tc = p.length / 3;
    p.push(0, 0.5, 0); n.push(0, 1, 0); u.push(0.5, 0.5);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      p.push(Math.cos(a) * topR, 0.5, Math.sin(a) * topR);
      n.push(0, 1, 0);
      u.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    }
    for (let i = 0; i < segs; i++) idx.push(tc, tc + i + 2, tc + i + 1);
  }
  // Bottom cap
  if (botR > 0.001) {
    const bc = p.length / 3;
    p.push(0, -0.5, 0); n.push(0, -1, 0); u.push(0.5, 0.5);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      p.push(Math.cos(a) * botR, -0.5, Math.sin(a) * botR);
      n.push(0, -1, 0);
      u.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    }
    for (let i = 0; i < segs; i++) idx.push(bc, bc + i + 1, bc + i + 2);
  }
  return createMesh(gl, p, n, u, idx);
}

function buildSphereMesh(gl, stacks = 10, slices = 16) {
  const p = [], n = [], u = [], idx = [];
  for (let i = 0; i <= stacks; i++) {
    const v = i / stacks;
    const phi = v * Math.PI;
    for (let j = 0; j <= slices; j++) {
      const uu = j / slices;
      const theta = uu * Math.PI * 2;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.cos(phi);
      const z = Math.sin(phi) * Math.sin(theta);
      p.push(x * 0.5, y * 0.5, z * 0.5);
      n.push(x, y, z);
      u.push(uu, v);
    }
  }
  const stride = slices + 1;
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const a = i * stride + j;
      const b = a + stride;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  return createMesh(gl, p, n, u, idx);
}

function buildPlaneMesh(gl) {
  const p = [-0.5,-0.5,0, 0.5,-0.5,0, 0.5,0.5,0, -0.5,0.5,0];
  const n = [0,0,1, 0,0,1, 0,0,1, 0,0,1];
  const u = [0,1, 1,1, 1,0, 0,0];
  const idx = [0,1,2, 0,2,3];
  return createMesh(gl, p, n, u, idx);
}

function buildRingMesh(gl, segs = 24, inner = 0.36, outer = 0.5) {
  const p = [], n = [], u = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const c = Math.cos(a), s = Math.sin(a);
    p.push(c * inner, s * inner, 0); n.push(0, 0, 1); u.push(0.5 + c * 0.36, 0.5 + s * 0.36);
    p.push(c * outer, s * outer, 0); n.push(0, 0, 1); u.push(0.5 + c * 0.5, 0.5 + s * 0.5);
  }
  for (let i = 0; i < segs; i++) {
    const o = i * 2;
    idx.push(o, o + 1, o + 3, o, o + 3, o + 2);
  }
  return createMesh(gl, p, n, u, idx);
}

// --- SCENE GRAPH NODE ---

export class SceneNode {
  constructor(opts = {}) {
    this.pos = new Float32Array(opts.pos || [0, 0, 0]);
    this.rot = new Float32Array(opts.rot || [0, 0, 0]);
    this.scale = new Float32Array(opts.scale || [1, 1, 1]);
    this.mesh = opts.mesh || null; // 'box'|'cyl'|'cone'|'sphere'|'plane'|'ring'
    this.material = opts.material || null;
    this.visible = opts.visible !== undefined ? opts.visible : true;
    this.castShadow = opts.castShadow !== undefined ? opts.castShadow : true;
    this.additive = !!opts.additive;
    this.highlight = !!opts.highlight;
    this.children = [];
    this.localMatrix = M4.create();
    this.worldMatrix = M4.create();
    this.name = opts.name || '';
  }

  add(child) {
    this.children.push(child);
    return child;
  }

  addPart(opts) {
    const n = new SceneNode(opts);
    this.children.push(n);
    return n;
  }

  remove(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
  }

  updateWorld(parentWorld = null) {
    M4.fromTRS(this.localMatrix, this.pos, this.rot, this.scale);
    if (parentWorld) M4.multiply(this.worldMatrix, parentWorld, this.localMatrix);
    else this.worldMatrix.set(this.localMatrix);
    for (let i = 0; i < this.children.length; i++) {
      this.children[i].updateWorld(this.worldMatrix);
    }
  }
}

export function mat(opts = {}) {
  return {
    color: opts.color || [0.75, 0.78, 0.82],
    emissive: opts.emissive || [0, 0, 0],
    roughness: opts.roughness !== undefined ? opts.roughness : 0.45,
    metallic: opts.metallic !== undefined ? opts.metallic : 0.3,
    alpha: opts.alpha !== undefined ? opts.alpha : 1.0,
    tex: opts.tex || 'white',
    uvScale: opts.uvScale || [1, 1],
    unlit: !!opts.unlit,
  };
}

// --- WEBGL2 RENDERER ENGINE ---

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 is required to run VANGUARD 2089.');
    this.gl = gl;

    // HDR float support detection
    this.hasFloatRT = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    gl.getExtension('OES_texture_float_linear');
    gl.getExtension('OES_texture_half_float_linear');

    // Compile programs
    this.progShadow = this._compile(SHADOW_VS, SHADOW_FS);
    this.progPBR = this._compile(PBR_VS, PBR_FS);
    this.progUnlit = this._compile(UNLIT_VS, UNLIT_FS);
    this.progBright = this._compile(QUAD_VS, BRIGHT_FS);
    this.progBlur = this._compile(QUAD_VS, BLUR_FS);
    this.progComposite = this._compile(QUAD_VS, COMPOSITE_FS);

    // Cache uniform locations
    this.uShadow = this._getUniforms(this.progShadow, ['uLightVP', 'uModel']);
    this.uPBR = this._getUniforms(this.progPBR, [
      'uModel','uViewProj','uLightVP','uUvScale','uAlbedoMap','uShadowMap','uCamPos',
      'uColor','uEmissive','uRoughness','uMetallic','uAlpha','uUseShadow','uUseFog',
      'uSunDir','uSunColor','uSkyColor','uGroundColor','uFogColor','uFogDensity',
      'uScanOrigin','uScanRadius','uScanStrength','uHighlight',
      'uNumLights','uLightPosRad','uLightColInt',
    ]);
    this.uUnlit = this._getUniforms(this.progUnlit, ['uModel','uViewProj','uColor','uAlbedoMap','uUseTex']);
    this.uBright = this._getUniforms(this.progBright, ['uScene','uThreshold']);
    this.uBlur = this._getUniforms(this.progBlur, ['uTex','uDir']);
    this.uComp = this._getUniforms(this.progComposite, [
      'uScene','uBloom','uBloomStrength','uExposure','uChromatic','uDamageFlash','uOverclock','uScanStrength','uTime',
    ]);

    // Meshes
    this.meshes = {
      box: buildBoxMesh(gl),
      cyl: buildCylinderMesh(gl, 16, 0.5, 0.5),
      cyl8: buildCylinderMesh(gl, 8, 0.5, 0.5),
      cone: buildCylinderMesh(gl, 14, 0.0, 0.5),
      sphere: buildSphereMesh(gl, 10, 16),
      plane: buildPlaneMesh(gl),
      ring: buildRingMesh(gl, 24, 0.36, 0.5),
    };

    // Fullscreen quad
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    const qb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Procedural Textures
    this.textures = createTextureLibrary(gl);

    // Shadow map FBO (1024x1024)
    this.shadowSize = 1024;
    this._initShadowMap();

    // Post-processing FBOs
    this.width = 0;
    this.height = 0;
    this.renderScale = 1.0;
    this.bloomEnabled = true;
    this.shadowsEnabled = true;
    this.resize(canvas.clientWidth || 1280, canvas.clientHeight || 720);

    // Scene lighting / atmosphere state
    this.sunDir = new Float32Array([0.45, 0.85, 0.35]);
    this.sunColor = new Float32Array([0.95, 1.05, 1.35]);
    this.skyColor = new Float32Array([0.14, 0.22, 0.34]);
    this.groundColor = new Float32Array([0.07, 0.09, 0.12]);
    this.fogColor = new Float32Array([0.035, 0.055, 0.088]);
    this.fogDensity = 0.015;
    this.exposure = 1.15;
    this.bloomStrength = 0.68;

    // Post FX dynamic parameters
    this.chromatic = 0;
    this.damageFlash = 0;
    this.overclock = 0;
    this.scanOrigin = new Float32Array([0, 0, 0]);
    this.scanRadius = 0;
    this.scanStrength = 0;

    // Matrices & scratch pools
    this.viewMat = M4.create();
    this.projMat = M4.create();
    this.viewProjMat = M4.create();
    this.lightViewMat = M4.create();
    this.lightProjMat = M4.create();
    this.lightVPMat = M4.create();
    this.camPos = new Float32Array([0, 2, 5]);

    this.lights = [];
    this._lightPosRad = new Float32Array(MAX_LIGHTS * 4);
    this._lightColInt = new Float32Array(MAX_LIGHTS * 4);
    this._opaqueList = [];
    this._transList = [];
  }

  _compile(vsSrc, fsSrc) {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      throw new Error('VS Error: ' + gl.getShaderInfoLog(vs));
    }
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error('FS Error: ' + gl.getShaderInfoLog(fs));
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error('Link Error: ' + gl.getProgramInfoLog(prog));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  _getUniforms(prog, names) {
    const map = {};
    for (const n of names) map[n] = this.gl.getUniformLocation(prog, n);
    return map;
  }

  _initShadowMap() {
    const gl = this.gl;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, this.shadowSize, this.shadowSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);

    this.shadowFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  _makeRT(w, h, withDepth = false) {
    const gl = this.gl;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const internal = this.hasFloatRT ? gl.RGBA16F : gl.RGBA8;
    const type = this.hasFloatRT ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    let depth = null;
    if (withDepth) {
      depth = gl.createRenderbuffer();
      gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex, depth, w, h };
  }

  _deleteRT(rt) {
    if (!rt) return;
    const gl = this.gl;
    gl.deleteFramebuffer(rt.fbo);
    gl.deleteTexture(rt.tex);
    if (rt.depth) gl.deleteRenderbuffer(rt.depth);
  }

  _initFramebuffers(w, h) {
    this._deleteRT(this.rtScene);
    this._deleteRT(this.rtBloomA);
    this._deleteRT(this.rtBloomB);
    const sw = Math.max(2, Math.floor(w * this.renderScale));
    const sh = Math.max(2, Math.floor(h * this.renderScale));
    const bw = Math.max(2, Math.floor(sw * 0.5));
    const bh = Math.max(2, Math.floor(sh * 0.5));
    this.rtScene = this._makeRT(sw, sh, true);
    this.rtBloomA = this._makeRT(bw, bh, false);
    this.rtBloomB = this._makeRT(bw, bh, false);
  }

  resize(w, h) {
    const isMobile = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || Math.min(w, h) < 600;
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.0 : 1.5);
    const pw = Math.max(2, Math.floor(w * dpr));
    const ph = Math.max(2, Math.floor(h * dpr));
    if (pw === this.width && ph === this.height) return;
    this.width = pw;
    this.height = ph;
    this.canvas.width = pw;
    this.canvas.height = ph;
    this._initFramebuffers(pw, ph);
  }

  setQuality(level) {
    if (level === 'low') {
      this.renderScale = 0.72;
      this.bloomEnabled = false;
      this.shadowsEnabled = false;
    } else if (level === 'med') {
      this.renderScale = 0.88;
      this.bloomEnabled = true;
      this.shadowsEnabled = true;
    } else {
      this.renderScale = 1.0;
      this.bloomEnabled = true;
      this.shadowsEnabled = true;
    }
    this._initFramebuffers(this.width, this.height);
  }

  _collectNodes(node, parentHighlight = false) {
    if (!node.visible) return;
    const hl = parentHighlight || node.highlight;
    if (node.mesh && node.material) {
      const item = { node, hl };
      if (node.additive || node.material.alpha < 0.99 || node.material.unlit) {
        this._transList.push(item);
      } else {
        this._opaqueList.push(item);
      }
    }
    for (let i = 0; i < node.children.length; i++) {
      this._collectNodes(node.children[i], hl);
    }
  }

  projectToScreen(worldPos) {
    const m = this.viewProjMat;
    const x = worldPos[0], y = worldPos[1], z = worldPos[2];
    const cx = m[0]*x + m[4]*y + m[8]*z + m[12];
    const cy = m[1]*x + m[5]*y + m[9]*z + m[13];
    const cz = m[2]*x + m[6]*y + m[10]*z + m[14];
    const cw = m[3]*x + m[7]*y + m[11]*z + m[15];
    if (cw <= 0.05) return null;
    const ndcX = cx / cw;
    const ndcY = cy / cw;
    if (ndcX < -1.15 || ndcX > 1.15 || ndcY < -1.15 || ndcY > 1.15) return null;
    return {
      x: (ndcX * 0.5 + 0.5) * this.canvas.clientWidth,
      y: (0.5 - ndcY * 0.5) * this.canvas.clientHeight,
      z: cz / cw,
      behind: cw <= 0,
    };
  }

  renderFrame(sceneRoot, viewmodelRoot, camPos, viewMat, fovRad, timeSec, shadowTarget = null) {
    const gl = this.gl;
    this.camPos.set(camPos);
    this.viewMat.set(viewMat);
    const aspect = this.width / Math.max(1, this.height);
    M4.perspective(this.projMat, fovRad, aspect, 0.08, 220);
    M4.multiply(this.viewProjMat, this.projMat, this.viewMat);

    // Update world transforms
    sceneRoot.updateWorld(null);
    this._opaqueList.length = 0;
    this._transList.length = 0;
    this._collectNodes(sceneRoot, false);

    // Upload dynamic lights (closest / brightest up to MAX_LIGHTS)
    const numLights = Math.min(this.lights.length, MAX_LIGHTS);
    for (let i = 0; i < numLights; i++) {
      const l = this.lights[i];
      const o = i * 4;
      this._lightPosRad[o] = l.pos[0];
      this._lightPosRad[o + 1] = l.pos[1];
      this._lightPosRad[o + 2] = l.pos[2];
      this._lightPosRad[o + 3] = l.radius;
      this._lightColInt[o] = l.color[0];
      this._lightColInt[o + 1] = l.color[1];
      this._lightColInt[o + 2] = l.color[2];
      this._lightColInt[o + 3] = l.intensity;
    }

    // 1. SHADOW MAP PASS
    const focus = shadowTarget || camPos;
    const lEye = [focus[0] + this.sunDir[0] * 48, focus[1] + this.sunDir[1] * 48, focus[2] + this.sunDir[2] * 48];
    M4.lookAt(this.lightViewMat, lEye, focus, [0, 1, 0]);
    M4.ortho(this.lightProjMat, -42, 42, -42, 42, 4, 120);
    M4.multiply(this.lightVPMat, this.lightProjMat, this.lightViewMat);

    if (this.shadowsEnabled) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
      gl.viewport(0, 0, this.shadowSize, this.shadowSize);
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.FRONT);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(this.progShadow);
      gl.uniformMatrix4fv(this.uShadow.uLightVP, false, this.lightVPMat);

      for (let i = 0; i < this._opaqueList.length; i++) {
        const node = this._opaqueList[i].node;
        if (!node.castShadow) continue;
        const m = this.meshes[node.mesh];
        if (!m) continue;
        gl.uniformMatrix4fv(this.uShadow.uModel, false, node.worldMatrix);
        gl.bindVertexArray(m.vao);
        gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
      }
      gl.cullFace(gl.BACK);
    }

    // 2. MAIN WORLD HDR PASS
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.rtScene.fbo);
    gl.viewport(0, 0, this.rtScene.w, this.rtScene.h);
    gl.clearColor(this.fogColor[0], this.fogColor[1], this.fogColor[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    this._setupPBRUniforms(this.viewProjMat, this.camPos, this.shadowsEnabled ? 1 : 0, 1, numLights);
    this._drawPBRList(this._opaqueList);

    // 3. TRANSPARENT / ADDITIVE VFX PASS
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    for (let i = 0; i < this._transList.length; i++) {
      const { node, hl } = this._transList[i];
      const matObj = node.material;
      const m = this.meshes[node.mesh];
      if (!m) continue;

      if (node.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      if (matObj.unlit) {
        gl.useProgram(this.progUnlit);
        gl.uniformMatrix4fv(this.uUnlit.uViewProj, false, this.viewProjMat);
        gl.uniformMatrix4fv(this.uUnlit.uModel, false, node.worldMatrix);
        gl.uniform4f(this.uUnlit.uColor, matObj.color[0], matObj.color[1], matObj.color[2], matObj.alpha);
        if (matObj.tex && matObj.tex !== 'white' && this.textures[matObj.tex]) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, this.textures[matObj.tex]);
          gl.uniform1i(this.uUnlit.uAlbedoMap, 0);
          gl.uniform1i(this.uUnlit.uUseTex, 1);
        } else {
          gl.uniform1i(this.uUnlit.uUseTex, 0);
        }
        gl.bindVertexArray(m.vao);
        gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
      } else {
        this._setupPBRUniforms(this.viewProjMat, this.camPos, 0, 1, numLights);
        this._drawSinglePBR(node, hl);
      }
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);

    // 4. FIRST-PERSON VIEWMODEL PASS (Depth Cleared — Never Clips Walls!)
    if (viewmodelRoot && viewmodelRoot.visible) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      viewmodelRoot.updateWorld(null);
      this._opaqueList.length = 0;
      this._transList.length = 0;
      this._collectNodes(viewmodelRoot, false);

      const vmProj = M4.create();
      M4.perspective(vmProj, 56 * Math.PI / 180, aspect, 0.02, 12);
      // Viewmodel sits in camera-local space (camera at origin looking down -Z)
      const zeroCam = new Float32Array([0, 0, 0]);
      // Create crisp local lighting for the gun + muzzle flash light if active
      this._setupPBRUniforms(vmProj, zeroCam, 0, 0, numLights, true);
      this._drawPBRList(this._opaqueList);

      gl.depthMask(false);
      gl.enable(gl.BLEND);
      gl.disable(gl.CULL_FACE);
      for (let i = 0; i < this._transList.length; i++) {
        const { node } = this._transList[i];
        const m = this.meshes[node.mesh];
        if (!m) continue;
        if (node.additive) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(this.progUnlit);
        gl.uniformMatrix4fv(this.uUnlit.uViewProj, false, vmProj);
        gl.uniformMatrix4fv(this.uUnlit.uModel, false, node.worldMatrix);
        const matObj = node.material;
        gl.uniform4f(this.uUnlit.uColor, matObj.color[0], matObj.color[1], matObj.color[2], matObj.alpha);
        gl.uniform1i(this.uUnlit.uUseTex, 0);
        gl.bindVertexArray(m.vao);
        gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
      }
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
    }

    // 5. HDR BLOOM PASSES
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.quadVao);

    if (this.bloomEnabled) {
      // Bright extract -> rtBloomA
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.rtBloomA.fbo);
      gl.viewport(0, 0, this.rtBloomA.w, this.rtBloomA.h);
      gl.useProgram(this.progBright);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.rtScene.tex);
      gl.uniform1i(this.uBright.uScene, 0);
      gl.uniform1f(this.uBright.uThreshold, this.hasFloatRT ? 0.92 : 0.72);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // 2 iterations of separable Gaussian blur
      gl.useProgram(this.progBlur);
      gl.uniform1i(this.uBlur.uTex, 0);
      for (let pass = 0; pass < 2; pass++) {
        const spread = pass === 0 ? 1.0 : 2.1;
        // Horizontal A -> B
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.rtBloomB.fbo);
        gl.bindTexture(gl.TEXTURE_2D, this.rtBloomA.tex);
        gl.uniform2f(this.uBlur.uDir, spread / this.rtBloomA.w, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        // Vertical B -> A
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.rtBloomA.fbo);
        gl.bindTexture(gl.TEXTURE_2D, this.rtBloomB.tex);
        gl.uniform2f(this.uBlur.uDir, 0, spread / this.rtBloomA.h);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }

    // 6. FINAL COMPOSITE + ACES TONE MAP -> SCREEN
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.progComposite);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.rtScene.tex);
    gl.uniform1i(this.uComp.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.rtBloomA.tex);
    gl.uniform1i(this.uComp.uBloom, 1);
    gl.uniform1f(this.uComp.uBloomStrength, this.bloomEnabled ? this.bloomStrength : 0.0);
    gl.uniform1f(this.uComp.uExposure, this.exposure);
    gl.uniform1f(this.uComp.uChromatic, this.chromatic);
    gl.uniform1f(this.uComp.uDamageFlash, this.damageFlash);
    gl.uniform1f(this.uComp.uOverclock, this.overclock);
    gl.uniform1f(this.uComp.uScanStrength, this.scanStrength);
    gl.uniform1f(this.uComp.uTime, timeSec);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  _setupPBRUniforms(viewProj, camPos, useShadow, useFog, numLights, isViewmodel = false) {
    const gl = this.gl;
    const u = this.uPBR;
    gl.useProgram(this.progPBR);
    gl.uniformMatrix4fv(u.uViewProj, false, viewProj);
    gl.uniformMatrix4fv(u.uLightVP, false, this.lightVPMat);
    gl.uniform3fv(u.uCamPos, camPos);
    gl.uniform1i(u.uUseShadow, useShadow);
    gl.uniform1i(u.uUseFog, useFog);

    if (isViewmodel) {
      // Studio-grade tactical rim & key lighting for crisp weapon rendering
      gl.uniform3f(u.uSunDir, 0.35, 0.85, 0.45);
      gl.uniform3f(u.uSunColor, 1.45, 1.55, 1.85);
      gl.uniform3f(u.uSkyColor, 0.24, 0.36, 0.52);
      gl.uniform3f(u.uGroundColor, 0.14, 0.16, 0.20);
      // Optional muzzle light from viewmodel light slot 0
      const vmLights = this.vmMuzzleLight ? 1 : 0;
      gl.uniform1i(u.uNumLights, vmLights);
      if (vmLights) {
        gl.uniform4f(u.uLightPosRad, 0.15, -0.05, -0.75, 2.5);
        gl.uniform4f(u.uLightColInt, this.vmMuzzleLight[0], this.vmMuzzleLight[1], this.vmMuzzleLight[2], this.vmMuzzleLight[3]);
      }
    } else {
      gl.uniform3fv(u.uSunDir, this.sunDir);
      gl.uniform3fv(u.uSunColor, this.sunColor);
      gl.uniform3fv(u.uSkyColor, this.skyColor);
      gl.uniform3fv(u.uGroundColor, this.groundColor);
      gl.uniform3fv(u.uFogColor, this.fogColor);
      gl.uniform1f(u.uFogDensity, this.fogDensity);
      gl.uniform3fv(u.uScanOrigin, this.scanOrigin);
      gl.uniform1f(u.uScanRadius, this.scanRadius);
      gl.uniform1f(u.uScanStrength, this.scanStrength);
      gl.uniform1i(u.uNumLights, numLights);
      if (numLights > 0) {
        gl.uniform4fv(u.uLightPosRad, this._lightPosRad);
        gl.uniform4fv(u.uLightColInt, this._lightColInt);
      }
    }

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(u.uShadowMap, 1);
    gl.uniform1i(u.uAlbedoMap, 0);
  }

  _drawPBRList(list) {
    for (let i = 0; i < list.length; i++) {
      this._drawSinglePBR(list[i].node, list[i].hl);
    }
  }

  _drawSinglePBR(node, hl) {
    const gl = this.gl;
    const u = this.uPBR;
    const m = this.meshes[node.mesh];
    if (!m) return;
    const matObj = node.material;
    gl.uniformMatrix4fv(u.uModel, false, node.worldMatrix);
    gl.uniform3fv(u.uColor, matObj.color);
    gl.uniform3fv(u.uEmissive, matObj.emissive);
    gl.uniform1f(u.uRoughness, matObj.roughness);
    gl.uniform1f(u.uMetallic, matObj.metallic);
    gl.uniform1f(u.uAlpha, matObj.alpha);
    gl.uniform2fv(u.uUvScale, matObj.uvScale);
    gl.uniform1f(u.uHighlight, hl ? 1.0 : 0.0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures[matObj.tex] || this.textures.white);

    gl.bindVertexArray(m.vao);
    gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_SHORT, 0);
  }
}
