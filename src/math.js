// ============================================================================
// VANGUARD 2089 — Fast 3D Math, Matrix & Collision Utilities
// ============================================================================

export const EPSILON = 1e-6;
export const DEG2RAD = Math.PI / 180;

export function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function damp(a, b, lambda, dt) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt));
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function rand(min = 0, max = 1) {
  return min + Math.random() * (max - min);
}

export function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

// Vec3 helpers operating on plain [x,y,z] or Float32Array
export const V3 = {
  create(x = 0, y = 0, z = 0) { return new Float32Array([x, y, z]); },
  set(out, x, y, z) { out[0] = x; out[1] = y; out[2] = z; return out; },
  copy(out, a) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return out; },
  add(out, a, b) { out[0] = a[0] + b[0]; out[1] = a[1] + b[1]; out[2] = a[2] + b[2]; return out; },
  sub(out, a, b) { out[0] = a[0] - b[0]; out[1] = a[1] - b[1]; out[2] = a[2] - b[2]; return out; },
  scale(out, a, s) { out[0] = a[0] * s; out[1] = a[1] * s; out[2] = a[2] * s; return out; },
  scaleAndAdd(out, a, b, s) { out[0] = a[0] + b[0] * s; out[1] = a[1] + b[1] * s; out[2] = a[2] + b[2] * s; return out; },
  dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
  cross(out, a, b) {
    const ax = a[0], ay = a[1], az = a[2];
    const bx = b[0], by = b[1], bz = b[2];
    out[0] = ay * bz - az * by;
    out[1] = az * bx - ax * bz;
    out[2] = ax * by - ay * bx;
    return out;
  },
  len(a) { return Math.hypot(a[0], a[1], a[2]); },
  dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); },
  distXZ(a, b) { return Math.hypot(a[0] - b[0], a[2] - b[2]); },
  norm(out, a) {
    const l = Math.hypot(a[0], a[1], a[2]);
    if (l > EPSILON) { out[0] = a[0] / l; out[1] = a[1] / l; out[2] = a[2] / l; }
    else { out[0] = 0; out[1] = 0; out[2] = 0; }
    return out;
  },
  lerp(out, a, b, t) {
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    out[2] = a[2] + (b[2] - a[2]) * t;
    return out;
  },
};

// Column-major 4x4 Matrix utilities
export const M4 = {
  create() {
    const m = new Float32Array(16);
    m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
    return m;
  },
  identity(out) {
    out.fill(0);
    out[0] = 1; out[5] = 1; out[10] = 1; out[15] = 1;
    return out;
  },
  copy(out, a) { out.set(a); return out; },
  multiply(out, a, b) {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30;
    out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31;
    out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32;
    out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    return out;
  },
  // Compose TRS with Euler YXZ (yaw, pitch, roll)
  fromTRS(out, pos, rot, scale) {
    const cx = Math.cos(rot[0]), sx = Math.sin(rot[0]);
    const cy = Math.cos(rot[1]), sy = Math.sin(rot[1]);
    const cz = Math.cos(rot[2]), sz = Math.sin(rot[2]);
    // R = Ry * Rx * Rz
    const r00 = cy * cz + sy * sx * sz;
    const r01 = cz * sy * sx - cy * sz;
    const r02 = cx * sy;
    const r10 = cx * sz;
    const r11 = cx * cz;
    const r12 = -sx;
    const r20 = cy * sx * sz - cz * sy;
    const r21 = cy * cz * sx + sy * sz;
    const r22 = cy * cx;
    const sx0 = scale[0], sy0 = scale[1], sz0 = scale[2];
    out[0] = r00 * sx0; out[1] = r10 * sx0; out[2] = r20 * sx0; out[3] = 0;
    out[4] = r01 * sy0; out[5] = r11 * sy0; out[6] = r21 * sy0; out[7] = 0;
    out[8] = r02 * sz0; out[9] = r12 * sz0; out[10] = r22 * sz0; out[11] = 0;
    out[12] = pos[0]; out[13] = pos[1]; out[14] = pos[2]; out[15] = 1;
    return out;
  },
  perspective(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy * 0.5);
    const nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) * nf;
    out[11] = -1;
    out[14] = 2 * far * near * nf;
    return out;
  },
  ortho(out, left, right, bottom, top, near, far) {
    const lr = 1 / (left - right);
    const bt = 1 / (bottom - top);
    const nf = 1 / (near - far);
    out.fill(0);
    out[0] = -2 * lr;
    out[5] = -2 * bt;
    out[10] = 2 * nf;
    out[12] = (left + right) * lr;
    out[13] = (top + bottom) * bt;
    out[14] = (far + near) * nf;
    out[15] = 1;
    return out;
  },
  lookAt(out, eye, center, up) {
    let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
    let len = Math.hypot(zx, zy, zz);
    if (len < EPSILON) { zz = 1; len = 1; }
    zx /= len; zy /= len; zz /= len;
    let xx = up[1] * zz - up[2] * zy;
    let xy = up[2] * zx - up[0] * zz;
    let xz = up[0] * zy - up[1] * zx;
    len = Math.hypot(xx, xy, xz);
    if (len < EPSILON) { xx = 1; xy = 0; xz = 0; }
    else { xx /= len; xy /= len; xz /= len; }
    const yx = zy * xz - zz * xy;
    const yy = zz * xx - zx * xz;
    const yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  },
  transformPoint(out, m, p) {
    const x = p[0], y = p[1], z = p[2];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1;
    out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
  },
};

// Ray vs AABB intersection. Returns t >= 0 or -1.
export function rayAABB(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ, maxDist = 1e9) {
  let tmin = 0;
  let tmax = maxDist;
  const invX = Math.abs(dx) > 1e-8 ? 1 / dx : (dx >= 0 ? 1e8 : -1e8);
  let t1 = (minX - ox) * invX;
  let t2 = (maxX - ox) * invX;
  if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
  tmin = Math.max(tmin, t1);
  tmax = Math.min(tmax, t2);
  if (tmax < tmin) return -1;

  const invY = Math.abs(dy) > 1e-8 ? 1 / dy : (dy >= 0 ? 1e8 : -1e8);
  t1 = (minY - oy) * invY;
  t2 = (maxY - oy) * invY;
  if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
  tmin = Math.max(tmin, t1);
  tmax = Math.min(tmax, t2);
  if (tmax < tmin) return -1;

  const invZ = Math.abs(dz) > 1e-8 ? 1 / dz : (dz >= 0 ? 1e8 : -1e8);
  t1 = (minZ - oz) * invZ;
  t2 = (maxZ - oz) * invZ;
  if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
  tmin = Math.max(tmin, t1);
  tmax = Math.min(tmax, t2);
  if (tmax < tmin) return -1;

  return tmin;
}

// Ray vs Sphere intersection. Returns t >= 0 or -1.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxDist = 1e9) {
  const lx = ox - cx, ly = oy - cy, lz = oz - cz;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  let t = -b - sq;
  if (t < 0) t = -b + sq;
  if (t < 0 || t > maxDist) return -1;
  return t;
}
