// ============================================================================
// VANGUARD 2089 — 3D Tactical Level Architectures & Collision World
// 1. Campaign Mission 01: OPERATION BLACKOUT PROTOCOL (Neo-Kowloon Sector 04)
// 2. Endless Mode Arena: PROTOCOL INFINITE SIEGE (The Foundry)
// ============================================================================
import { SceneNode, mat } from './engine.js';
import { clamp, rayAABB } from './math.js';

export class LevelWorld {
  constructor() {
    this.root = new SceneNode({ name: 'levelRoot' });
    this.colliders = [];   // { minX, minY, minZ, maxX, maxY, maxZ, tag, active }
    this.floors = [];      // { minX, maxX, minZ, maxZ, y, rampAxis, y0, y1 }
    this.staticLights = [];
    this.interactables = []; // { id, pos, radius, label, type, active, node, coreNode, hp }
    this.spawnPoints = [];
    this.playerStart = [0, 0, 0];
    this.playerStartYaw = Math.PI;
    this.gateBlocker = null;
    this.gateNode = null;
    this.extractNode = null;
  }

  addBox(x, y, z, sx, sy, sz, material, collide = true, isFloor = false, tag = '') {
    const n = this.root.addPart({
      mesh: 'box',
      pos: [x, y, z],
      scale: [sx, sy, sz],
      material,
      castShadow: sy > 0.25 && sy < 35,
    });
    const col = {
      minX: x - sx * 0.5, maxX: x + sx * 0.5,
      minY: y - sy * 0.5, maxY: y + sy * 0.5,
      minZ: z - sz * 0.5, maxZ: z + sz * 0.5,
      tag, active: true,
    };
    if (collide) this.colliders.push(col);
    if (isFloor) {
      this.floors.push({ minX: col.minX, maxX: col.maxX, minZ: col.minZ, maxZ: col.maxZ, y: col.maxY });
    }
    return { node: n, col };
  }

  addRamp(x, z, w, d, y0, y1, axis, material) {
    // Stepped walkable ramp visual + smooth analytical floor height
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const h = y0 + (y1 - y0) * t;
      const px = axis === 'x' ? x - w * 0.5 + w * t : x;
      const pz = axis === 'z' ? z - d * 0.5 + d * t : z;
      const sw = axis === 'x' ? w / steps + 0.05 : w;
      const sd = axis === 'z' ? d / steps + 0.05 : d;
      this.root.addPart({ mesh: 'box', pos: [px, h * 0.5, pz], scale: [sw, Math.max(0.2, h), sd], material });
    }
    this.floors.push({
      minX: x - w * 0.5, maxX: x + w * 0.5,
      minZ: z - d * 0.5, maxZ: z + d * 0.5,
      y: y1, rampAxis: axis, y0, y1,
    });
  }

  addNeonLamp(x, y, z, color, intensity = 3.8, radius = 18) {
    // Cyber streetlamp pole + emissive light bar + translucent volumetric glow cone
    this.root.addPart({ mesh: 'cyl', pos: [x, y * 0.5, z], scale: [0.18, y, 0.18], material: mat({ color: [0.18, 0.22, 0.26], roughness: 0.4, metallic: 0.85 }) });
    this.root.addPart({
      mesh: 'box', pos: [x, y + 0.1, z], scale: [0.95, 0.16, 0.28],
      material: mat({ color, emissive: [color[0]*3.4, color[1]*3.4, color[2]*3.4], roughness: 0.2, metallic: 0.1 }),
      castShadow: false,
    });
    // Volumetric light shaft cone
    this.root.addPart({
      mesh: 'cone', pos: [x, y * 0.5, z], scale: [3.2, y, 3.2],
      material: mat({ color: [color[0], color[1], color[2]], alpha: 0.045, unlit: true }),
      additive: true, castShadow: false,
    });
    this.staticLights.push({ pos: [x, y - 0.4, z], color, intensity, radius });
  }

  addBillboard(x, y, z, w, h, rotY, signTex, glowColor) {
    const holder = this.root.addPart({ pos: [x, y, z], rot: [0, rotY, 0] });
    holder.addPart({ mesh: 'box', pos: [0, 0, -0.18], scale: [w + 0.3, h + 0.3, 0.24], material: mat({ color: [0.10, 0.12, 0.16], roughness: 0.5, metallic: 0.8 }) });
    holder.addPart({
      mesh: 'plane', pos: [0, 0, 0.02], scale: [w, h, 1],
      material: mat({ color: [1.3, 1.3, 1.3], alpha: 0.96, tex: signTex, unlit: true }),
      castShadow: false,
    });
    this.staticLights.push({ pos: [x + Math.sin(rotY) * 2.5, y, z + Math.cos(rotY) * 2.5], color: glowColor, intensity: 4.5, radius: 22 });
  }

  getFloorHeight(x, z, curY = 0) {
    let best = 0;
    for (let i = 0; i < this.floors.length; i++) {
      const f = this.floors[i];
      if (x >= f.minX - 0.15 && x <= f.maxX + 0.15 && z >= f.minZ - 0.15 && z <= f.maxZ + 0.15) {
        let fy = f.y;
        if (f.rampAxis === 'x') {
          const t = clamp((x - f.minX) / (f.maxX - f.minX), 0, 1);
          fy = f.y0 + (f.y1 - f.y0) * t;
        } else if (f.rampAxis === 'z') {
          const t = clamp((z - f.minZ) / (f.maxZ - f.minZ), 0, 1);
          fy = f.y0 + (f.y1 - f.y0) * t;
        }
        // Allow stepping onto floors within 1.15m above feet (ramps & ledges)
        if (fy <= curY + 1.15 && fy > best) best = fy;
      }
    }
    return best;
  }

  // Smooth wall-sliding circle vs AABB movement (for Player & Ground Enemies)
  moveCircle(x, y, z, dx, dz, radius, height = 1.75) {
    let nx = x + dx;
    let nz = z + dz;
    const ny = this.getFloorHeight(nx, nz, y);
    const feetY = Math.max(y, ny) + 0.38; // Step clearance
    const headY = feetY + height - 0.38;

    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < this.colliders.length; i++) {
        const c = this.colliders[i];
        if (!c.active) continue;
        if (c.maxY <= feetY || c.minY >= headY) continue;
        const cx = clamp(nx, c.minX, c.maxX);
        const cz = clamp(nz, c.minZ, c.maxZ);
        const rx = nx - cx;
        const rz = nz - cz;
        const d2 = rx * rx + rz * rz;
        if (d2 < radius * radius) {
          const d = Math.sqrt(d2);
          if (d > 1e-5) {
            const push = radius - d;
            nx += (rx / d) * push;
            nz += (rz / d) * push;
          } else {
            // Inside box fallback: push to nearest side
            const dl = Math.abs(nx - c.minX), dr = Math.abs(c.maxX - nx);
            const df = Math.abs(nz - c.minZ), db = Math.abs(c.maxZ - nz);
            const m = Math.min(dl, dr, df, db);
            if (m === dl) nx = c.minX - radius;
            else if (m === dr) nx = c.maxX + radius;
            else if (m === df) nz = c.minZ - radius;
            else nz = c.maxZ + radius;
          }
        }
      }
    }
    return { x: nx, y: this.getFloorHeight(nx, nz, y), z: nz };
  }

  raycastWorld(ox, oy, oz, dx, dy, dz, maxDist = 180) {
    let bestT = maxDist;
    let hit = false;
    // Ground plane y = 0
    if (dy < -1e-5 && oy > 0) {
      const tg = -oy / dy;
      if (tg > 0 && tg < bestT) { bestT = tg; hit = true; }
    }
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (!c.active) continue;
      const t = rayAABB(ox, oy, oz, dx, dy, dz, c.minX, c.minY, c.minZ, c.maxX, c.maxY, c.maxZ, bestT);
      if (t >= 0 && t < bestT) {
        bestT = t;
        hit = true;
      }
    }
    return hit ? bestT : -1;
  }

  hasLineOfSight(x1, y1, z1, x2, y2, z2) {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.05) return true;
    const t = this.raycastWorld(x1, y1, z1, dx / dist, dy / dist, dz / dist, dist - 0.25);
    return t < 0;
  }
}

// ============================================================================
// BUILD CAMPAIGN MISSION 01: "OPERATION: BLACKOUT PROTOCOL"
// ============================================================================
export function buildCampaignLevel() {
  const w = new LevelWorld();
  w.playerStart = [0, 0, 12];
  w.playerStartYaw = 0; // Looking down -Z toward Sector 04!

  const mAsphalt = mat({ color: [0.85, 0.90, 0.96], roughness: 0.22, metallic: 0.25, tex: 'asphalt', uvScale: [12, 34] });
  const mConc    = mat({ color: [0.76, 0.80, 0.86], roughness: 0.65, metallic: 0.15, tex: 'concrete', uvScale: [3, 2] });
  const mWallLg  = mat({ color: [0.68, 0.72, 0.78], roughness: 0.68, metallic: 0.18, tex: 'concrete', uvScale: [12, 2] });
  const mTower   = mat({ color: [0.75, 0.82, 0.92], roughness: 0.35, metallic: 0.55, tex: 'tower', uvScale: [3, 6] });
  const mCrate   = mat({ color: [0.88, 0.90, 0.92], roughness: 0.52, metallic: 0.35, tex: 'crate' });
  const mGrate   = mat({ color: [0.72, 0.78, 0.84], roughness: 0.42, metallic: 0.78, tex: 'grate', uvScale: [4, 4] });
  const mNeonC   = mat({ color: [0.1, 0.95, 1.0], emissive: [0.2, 2.5, 3.0], roughness: 0.2, metallic: 0.1 });
  const mNeonA   = mat({ color: [1.0, 0.6, 0.1], emissive: [2.8, 1.4, 0.2], roughness: 0.2, metallic: 0.1 });
  const mNeonR   = mat({ color: [1.0, 0.18, 0.22], emissive: [3.2, 0.4, 0.4], roughness: 0.2, metallic: 0.1 });
  const mNeonG   = mat({ color: [0.1, 1.0, 0.55], emissive: [0.2, 2.8, 1.4], roughness: 0.2, metallic: 0.1 });

  // Main Wet Cyber-Asphalt Ground (from Z = +22 to Z = -126)
  w.addBox(0, -0.5, -52, 68, 1.0, 152, mAsphalt, false, true);

  // Outer Perimeter Fortified Concrete Walls
  w.addBox(0, 4, 22, 68, 8, 2, mWallLg, true);     // Rear boundary
  w.addBox(0, 5, -126, 68, 10, 2, mWallLg, true);  // Far helipad boundary

  // --- ZONE 1: PERIMETER STREET & CHECKPOINT ALPHA (Z: +18 to -22) ---
  // Left & Right narrow corridor walls creating tense urban canyon
  w.addBox(-14, 5, -2, 4, 10, 48, mWallLg, true);
  w.addBox( 14, 5, -2, 4, 10, 48, mWallLg, true);

  // Towering Cyber Skyscrapers framing the skyline (non-colliding background spectacle)
  for (const [bx, bz, bh] of [[-26, 4, 44], [26, 2, 52], [-28, -26, 58], [28, -28, 48], [-38, -58, 66], [38, -62, 62], [-34, -96, 55], [34, -98, 60], [0, -142, 72]]) {
    w.addBox(bx, bh * 0.5, bz, 16, bh, 18, mTower, false);
  }

  // Holographic Cyber Billboards!
  w.addBillboard(-11.8, 7.2, -4, 9.0, 4.4, Math.PI / 2, 'signCyan', [0.05, 0.85, 1.0]);
  w.addBillboard( 11.8, 7.6, -14, 9.0, 4.4, -Math.PI / 2, 'signAmber', [1.0, 0.58, 0.12]);
  w.addBillboard(-22.8, 9.2, -46, 11.0, 5.2, Math.PI / 2, 'signCrimson', [1.0, 0.2, 0.26]);
  w.addBillboard( 22.8, 9.2, -52, 11.0, 5.2, -Math.PI / 2, 'signCyan', [0.05, 0.85, 1.0]);

  // Streetlamps with Volumetric Cones
  w.addNeonLamp(-10.2, 6.2, 6,  [0.05, 0.90, 1.0], 3.8, 18);
  w.addNeonLamp( 10.2, 6.2, -6, [1.0, 0.62, 0.14], 3.8, 18);
  w.addNeonLamp(-10.2, 6.2, -18,[0.05, 0.90, 1.0], 3.8, 18);

  // Tactical Cover Barricades & Military Crates in Street
  w.addBox(-4.5, 0.7, 3, 4.2, 1.4, 1.1, mConc, true);
  w.addBox( 5.0, 0.7, -3, 4.2, 1.4, 1.1, mConc, true);
  w.addBox(-5.5, 1.0, -10, 2.4, 2.0, 2.4, mCrate, true);
  w.addBox( 4.2, 0.85, -13, 3.6, 1.7, 1.2, mConc, true);
  w.addBox(-1.2, 0.7, -16, 3.2, 1.4, 1.0, mConc, true);

  // Checkpoint Alpha Laser Security Gate (Z = -22) — opens when Relay destroyed/hacked!
  w.addBox(-9.5, 3.5, -22, 7.5, 7, 2.2, mConc, true);
  w.addBox( 9.5, 3.5, -22, 7.5, 7, 2.2, mConc, true);
  w.addBox(0, 6.5, -22, 12, 2.2, 2.6, mConc, true);
  const gateBarrier = w.addBox(0, 2.8, -22, 11.5, 5.4, 0.4, mat({ color: [1.0, 0.16, 0.22], alpha: 0.42, unlit: true }), true, false, 'gate');
  gateBarrier.node.additive = true;
  w.gateNode = gateBarrier.node;
  w.gateBlocker = gateBarrier.col;

  // Checkpoint Security Relay Core (Interact [F] or Shoot!)
  const relayNode = w.root.addPart({ pos: [5.5, 0, -20.2] });
  relayNode.addPart({ mesh: 'box', pos: [0, 0.9, 0], scale: [1.1, 1.8, 0.8], material: mConc });
  const relayCore = relayNode.addPart({ mesh: 'octahedron' in {} ? 'box' : 'sphere', pos: [0, 2.05, 0], scale: [0.58, 0.72, 0.58], material: mNeonR });
  w.interactables.push({
    id: 'gate_relay', type: 'relay', pos: [5.5, 1.8, -20.2], radius: 3.6,
    label: 'HACK / DESTROY GATE RELAY [F or SHOOT]', active: true, hp: 90,
    node: relayNode, coreNode: relayCore,
  });

  // --- ZONE 2: NEON CORPORATE PLAZA (Z: -24 to -66) ---
  w.addBox(-25, 6, -45, 4, 12, 46, mWallLg, true);
  w.addBox( 25, 6, -45, 4, 12, 46, mWallLg, true);
  // Central Glowing Cyber-Obelisk / Monument
  w.addBox(0, 2.5, -45, 4.4, 5.0, 4.4, mConc, true);
  w.root.addPart({ mesh: 'box', pos: [0, 5.4, -45], scale: [4.6, 0.35, 4.6], material: mNeonC });
  w.staticLights.push({ pos: [0, 6.2, -45], color: [0.05, 0.92, 1.0], intensity: 5.0, radius: 26 });

  // Elevated Left & Right Sniper Catwalks + Walkable Ramps!
  w.addBox(-17.5, 3.3, -45, 6.5, 0.5, 24, mGrate, true, true);
  w.addBox( 17.5, 3.3, -45, 6.5, 0.5, 24, mGrate, true, true);
  w.addRamp(-17.5, -29.5, 4.2, 7.5, 0, 3.55, 'z', mGrate); // Walk up from Z=-25.8 to -33.2 (note axis direction handled cleanly)
  // Fix ramp orientation: y0 at minZ (-33.2) -> y1 at maxZ (-25.8) so high end meets catwalk at -33!
  w.floors[w.floors.length - 1].y0 = 3.55;
  w.floors[w.floors.length - 1].y1 = 0;

  w.addRamp(17.5, -29.5, 4.2, 7.5, 3.55, 0, 'z', mGrate);
  // Plaza Tactical Cover Crates & Pillars
  for (const [cx, cz] of [[-8, -34], [8, -34], [-9, -54], [9, -54], [0, -34], [0, -56]]) {
    w.addBox(cx, 1.05, cz, 2.8, 2.1, 2.2, mCrate, true);
  }
  w.addNeonLamp(-11, 6.5, -36, [0.05, 0.9, 1.0], 4.0, 20);
  w.addNeonLamp( 11, 6.5, -54, [1.0, 0.55, 0.12], 4.0, 20);

  // Vanguard Orbital Armory Drop Pod (Unlocks Railgun Sniper + Plasma Carbine + Refills Ammo!)
  const podNode = w.root.addPart({ pos: [0, 0, -58.5] });
  podNode.addPart({ mesh: 'cyl', pos: [0, 1.1, 0], scale: [1.6, 2.2, 1.6], material: mCrate });
  const podCore = podNode.addPart({ mesh: 'box', pos: [0, 2.4, 0], scale: [1.2, 0.4, 1.2], material: mNeonA });
  w.staticLights.push({ pos: [0, 2.6, -58.5], color: [1.0, 0.65, 0.12], intensity: 3.5, radius: 14 });
  w.interactables.push({
    id: 'armory_pod', type: 'armory', pos: [0, 1.4, -58.5], radius: 4.0,
    label: 'SECURE HEAVY ARMS & REFILL [F]', active: true, hp: 9999,
    node: podNode, coreNode: podCore,
  });

  // --- ZONE 3: SERVER UPLINK ATRIUM (Z: -66 to -92) ---
  w.addBox(-19, 5.5, -79, 4, 11, 28, mWallLg, true);
  w.addBox( 19, 5.5, -79, 4, 11, 28, mWallLg, true);
  // Narrow entrance archway from Plaza
  w.addBox(-14, 4.5, -66, 12, 9, 2.4, mConc, true);
  w.addBox( 14, 4.5, -66, 12, 9, 2.4, mConc, true);
  w.addBox(0, 7.8, -66, 16, 2.4, 2.8, mConc, true);

  // 3 Sabotageable Glowing Uplink Data Cores!
  const coreCoords = [[-11, -76], [11, -76], [0, -84]];
  coreCoords.forEach(([sx, sz], idx) => {
    const sn = w.root.addPart({ pos: [sx, 0, sz] });
    sn.addPart({ mesh: 'box', pos: [0, 1.6, 0], scale: [1.9, 3.2, 1.9], material: mTower });
    const sc = sn.addPart({ mesh: 'cyl', pos: [0, 1.7, 0], scale: [1.25, 2.2, 1.25], material: mNeonC });
    w.colliders.push({ minX: sx - 1.0, maxX: sx + 1.0, minY: 0, maxY: 3.2, minZ: sz - 1.0, maxZ: sz + 1.0, active: true, tag: 'core' });
    w.staticLights.push({ pos: [sx, 2.4, sz], color: [0.05, 0.92, 1.0], intensity: 3.4, radius: 15 });
    w.interactables.push({
      id: 'data_core_' + idx, type: 'datacore', pos: [sx, 1.8, sz], radius: 3.8,
      label: `SABOTAGE UPLINK CORE ${idx + 1} [F or SHOOT]`, active: true, hp: 110,
      node: sn, coreNode: sc,
    });
  });

  // Cover inside Server Atrium
  w.addBox(-4.5, 0.8, -73, 3.4, 1.6, 1.1, mConc, true);
  w.addBox( 4.5, 0.8, -73, 3.4, 1.6, 1.1, mConc, true);
  w.addBox( 0, 0.8, -78, 4.0, 1.6, 1.2, mConc, true);

  // --- ZONE 4: ROOFTOP HELIPAD & ARES-IX TITAN BOSS ARENA (Z: -92 to -126) ---
  w.addBox(-27, 5.5, -109, 4, 11, 36, mWallLg, true);
  w.addBox( 27, 5.5, -109, 4, 11, 36, mWallLg, true);
  w.addBox(-18, 4.5, -92, 14, 9, 2.4, mConc, true);
  w.addBox( 18, 4.5, -92, 14, 9, 2.4, mConc, true);

  // 4 Heavy Reinforced Boss-Fight Cover Bunkers
  for (const [bx, bz] of [[-12, -101], [12, -101], [-12, -116], [12, -116]]) {
    w.addBox(bx, 1.4, bz, 4.2, 2.8, 2.8, mConc, true);
  }
  // Glowing Orbital Extraction Helipad Ring in Center (Z = -109)
  const pad = w.root.addPart({ pos: [0, 0.06, -109] });
  pad.addPart({ mesh: 'ring', rot: [-Math.PI / 2, 0, 0], scale: [11, 11, 1], material: mat({ color: [0.1, 1.0, 0.55], alpha: 0.65, unlit: true }), additive: true, castShadow: false });
  pad.addPart({ mesh: 'box', pos: [-1.4, 0.02, 0], scale: [0.55, 0.04, 4.2], material: mNeonG, castShadow: false });
  pad.addPart({ mesh: 'box', pos: [ 1.4, 0.02, 0], scale: [0.55, 0.04, 4.2], material: mNeonG, castShadow: false });
  pad.addPart({ mesh: 'box', pos: [ 0.0, 0.02, 0], scale: [3.2, 0.04, 0.55], material: mNeonG, castShadow: false });
  w.extractNode = pad;

  w.addNeonLamp(-16, 7.0, -109, [1.0, 0.2, 0.26], 4.5, 24);
  w.addNeonLamp( 16, 7.0, -109, [0.05, 0.92, 1.0], 4.5, 24);

  return w;
}

// ============================================================================
// BUILD ENDLESS MODE ARENA: "THE FOUNDRY" (Multi-Tier Cyber-Warfare Arena)
// ============================================================================
export function buildEndlessArena() {
  const w = new LevelWorld();
  w.playerStart = [0, 0, 20];
  w.playerStartYaw = 0;

  const mAsphalt = mat({ color: [0.85, 0.90, 0.96], roughness: 0.24, metallic: 0.25, tex: 'asphalt', uvScale: [14, 14] });
  const mConc    = mat({ color: [0.76, 0.80, 0.86], roughness: 0.65, metallic: 0.16, tex: 'concrete', uvScale: [4, 2] });
  const mWallLg  = mat({ color: [0.68, 0.72, 0.78], roughness: 0.66, metallic: 0.20, tex: 'concrete', uvScale: [12, 2] });
  const mTower   = mat({ color: [0.74, 0.82, 0.92], roughness: 0.34, metallic: 0.58, tex: 'tower', uvScale: [3, 6] });
  const mCrate   = mat({ color: [0.88, 0.90, 0.92], roughness: 0.50, metallic: 0.36, tex: 'crate' });
  const mGrate   = mat({ color: [0.74, 0.80, 0.88], roughness: 0.38, metallic: 0.80, tex: 'grate', uvScale: [4, 4] });
  const mNeonC   = mat({ color: [0.1, 0.95, 1.0], emissive: [0.2, 2.5, 3.0], roughness: 0.2, metallic: 0.1 });
  const mNeonA   = mat({ color: [1.0, 0.6, 0.1], emissive: [2.8, 1.4, 0.2], roughness: 0.2, metallic: 0.1 });

  // 64x64 Wet Cyber Arena Floor
  w.addBox(0, -0.5, 0, 68, 1.0, 68, mAsphalt, false, true);

  // Perimeter Arena Walls
  w.addBox(0, 4.5, -33, 68, 9, 2, mWallLg, true);
  w.addBox(0, 4.5,  33, 68, 9, 2, mWallLg, true);
  w.addBox(-33, 4.5, 0, 2, 9, 68, mWallLg, true);
  w.addBox( 33, 4.5, 0, 2, 9, 68, mWallLg, true);

  // Skyline Backdrop Megatowers & Holographic Billboards
  for (const [bx, bz, bh] of [[-46, -42, 64], [46, -42, 56], [-46, 42, 52], [46, 42, 68], [0, -52, 74], [0, 52, 58]]) {
    w.addBox(bx, bh * 0.5, bz, 18, bh, 18, mTower, false);
  }
  w.addBillboard(0, 9.5, -31.8, 14, 5.8, 0, 'signCyan', [0.05, 0.88, 1.0]);
  w.addBillboard(0, 9.5,  31.8, 14, 5.8, Math.PI, 'signAmber', [1.0, 0.58, 0.12]);
  w.addBillboard(-31.8, 9.5, 0, 14, 5.8, Math.PI / 2, 'signCrimson', [1.0, 0.2, 0.26]);
  w.addBillboard( 31.8, 9.5, 0, 14, 5.8, -Math.PI / 2, 'signCyan', [0.05, 0.88, 1.0]);

  // Central Elevated Reactor Deck + 4 Walkable Ramps!
  w.addBox(0, 1.25, 0, 14, 2.5, 14, mGrate, true, true);
  // Central Glowing Plasma Reactor Core framed by 4 Armored Struts!
  for (const [sx, sz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    w.addBox(sx, 5.2, sz, 0.75, 5.6, 0.75, mConc, true);
  }
  w.addBox(0, 7.9, 0, 3.8, 0.7, 3.8, mConc, false);
  w.root.addPart({ mesh: 'cyl', pos: [0, 5.1, 0], scale: [1.85, 5.0, 1.85], material: mNeonC });
  w.staticLights.push({ pos: [0, 5.6, 0], color: [0.05, 0.92, 1.0], intensity: 6.0, radius: 32 });

  // 4 Ramps leading up onto Central Deck
  w.addRamp(0, 10.5, 4.6, 7.0, 2.5, 0, 'z', mGrate);   // South ramp (+Z to center)
  w.addRamp(0, -10.5, 4.6, 7.0, 0, 2.5, 'z', mGrate);  // North ramp (-Z to center)
  w.addRamp(10.5, 0, 7.0, 4.6, 2.5, 0, 'x', mGrate);   // East ramp
  w.addRamp(-10.5, 0, 7.0, 4.6, 0, 2.5, 'x', mGrate);  // West ramp

  // 4 Corner Tactical Cover Bunkers + Neon Lamps
  for (const [sx, sz] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) {
    w.addBox(sx, 1.3, sz, 5.2, 2.6, 2.2, mConc, true);
    w.addBox(sx + (sx > 0 ? -3.4 : 3.4), 1.05, sz + (sz > 0 ? -3.4 : 3.4), 2.4, 2.1, 2.4, mCrate, true);
    w.addNeonLamp(sx * 0.72, 6.8, sz * 0.72, sx * sz > 0 ? [0.05, 0.90, 1.0] : [1.0, 0.58, 0.12], 4.0, 22);
  }

  // Requisition Armory Terminal on South Side (also accessible via [B] anytime!)
  const term = w.root.addPart({ pos: [0, 0, 26.5] });
  term.addPart({ mesh: 'box', pos: [0, 1.1, 0], scale: [2.2, 2.2, 1.2], material: mConc });
  const tCore = term.addPart({ mesh: 'box', pos: [0, 1.5, -0.65], scale: [1.5, 0.85, 0.12], material: mNeonA });
  w.staticLights.push({ pos: [0, 2.2, 25.0], color: [1.0, 0.65, 0.12], intensity: 3.4, radius: 14 });
  w.interactables.push({
    id: 'shop_terminal', type: 'shop', pos: [0, 1.4, 26.5], radius: 4.5,
    label: 'REQUISITION ARMORY [B or F]', active: true, hp: 99999,
    node: term, coreNode: tCore,
  });

  // Perimeter Enemy Spawn Points
  w.spawnPoints = [
    [-26, 0, -26], [26, 0, -26], [-26, 0, 26], [26, 0, 26],
    [0, 0, -28], [-28, 0, 0], [28, 0, 0], [0, 0, 27],
  ];

  return w;
}
