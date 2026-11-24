// ============================================================================
// VANGUARD 2089 — AAA Modern Warfare × Cyberpunk Weapon Arsenal & 3D Builders
// 6 Bespoke Multi-Part Articulated 3D Weapons + Operator Cyber-Glove Rig
// ============================================================================
import { SceneNode, mat } from './engine.js';

export const WEAPONS = [
  {
    id: 'ar',
    slot: 1,
    name: 'M41-K "SPECTRE"',
    category: 'SMART TACTICAL ASSAULT RIFLE',
    caliber: '6.8mm CASSELS-HV',
    fireMode: 'FULL-AUTO',
    auto: true,
    rpm: 710,
    damage: 28,
    headMult: 2.1,
    pellets: 1,
    spreadHip: 0.022,
    spreadAds: 0.004,
    magSize: 32,
    reserveMax: 224,
    reloadTime: 1.55,
    recoilPitch: 0.017,
    recoilYaw: 0.006,
    adsFov: 52,
    range: 140,
    muzzleColor: [1.0, 0.72, 0.25],
    tracerColor: [0.2, 0.92, 1.0],
    accentHex: '#00e5ff',
    cost: 0,
    stats: { damage: 72, fireRate: 76, accuracy: 86, mobility: 78 },
    lore: 'JSOC-standard 2089 modular carbine fusing brushed titanium upper receivers with a caseless hyper-velocity feed and integrated Kiroshi holo-reflex.',
    hipPos: [0.21, -0.175, -0.43],
    adsPos: [0.0, -0.145, -0.34],
  },
  {
    id: 'smg',
    slot: 2,
    name: 'VX-9 "KRAKEN"',
    category: 'DUAL-RAIL MAGNETIC PDW',
    caliber: '4.7mm FERRO-FLECHETTE',
    fireMode: 'HYPER-AUTO',
    auto: true,
    rpm: 1040,
    damage: 19,
    headMult: 1.9,
    pellets: 1,
    spreadHip: 0.026,
    spreadAds: 0.008,
    magSize: 44,
    reserveMax: 264,
    reloadTime: 1.35,
    recoilPitch: 0.012,
    recoilYaw: 0.009,
    adsFov: 58,
    range: 85,
    muzzleColor: [0.15, 0.88, 1.0],
    tracerColor: [0.1, 0.95, 1.0],
    accentHex: '#00f0ff',
    cost: 450,
    stats: { damage: 54, fireRate: 96, accuracy: 74, mobility: 95 },
    lore: 'Compact bullpup CQB shredder using copper-wound twin magnetic accelerator rails to hurl steel flechettes at 1,040 RPM with minimal muzzle climb.',
    hipPos: [0.20, -0.17, -0.39],
    adsPos: [0.0, -0.148, -0.31],
  },
  {
    id: 'shotgun',
    slot: 3,
    name: 'M870-X "CERBERUS"',
    category: 'THERMITE BREACHER SHOTGUN',
    caliber: '12G INCENDIARY TUNGSTEN',
    fireMode: 'PUMP-ACTION',
    auto: false,
    rpm: 86,
    damage: 18,
    headMult: 1.65,
    pellets: 8,
    spreadHip: 0.068,
    spreadAds: 0.044,
    magSize: 8,
    reserveMax: 56,
    reloadTime: 1.85,
    recoilPitch: 0.068,
    recoilYaw: 0.014,
    adsFov: 58,
    range: 46,
    muzzleColor: [1.0, 0.45, 0.08],
    tracerColor: [1.0, 0.52, 0.12],
    accentHex: '#ff7b1c',
    cost: 650,
    stats: { damage: 95, fireRate: 32, accuracy: 48, mobility: 72 },
    lore: 'Reinforced tactical breach cannon wrapped in glowing induction coils that superheat tungsten buckshot to 1,400°C as it clears the muzzle.',
    hipPos: [0.22, -0.18, -0.43],
    adsPos: [0.0, -0.146, -0.34],
  },
  {
    id: 'sniper',
    slot: 4,
    name: 'RA-77 "LONGBOW"',
    category: 'ANTI-MATERIEL RAILGUN',
    caliber: '14mm SABOT RAIL-SLUG',
    fireMode: 'BOLT-RAIL',
    auto: false,
    rpm: 52,
    damage: 138,
    headMult: 2.8,
    pellets: 1,
    spreadHip: 0.048,
    spreadAds: 0.0005,
    magSize: 5,
    reserveMax: 35,
    reloadTime: 2.15,
    recoilPitch: 0.075,
    recoilYaw: 0.008,
    adsFov: 24,
    scoped: true,
    pierce: true,
    range: 220,
    muzzleColor: [0.1, 0.85, 1.0],
    tracerColor: [0.35, 0.96, 1.0],
    accentHex: '#38e8ff',
    cost: 900,
    stats: { damage: 100, fireRate: 24, accuracy: 99, mobility: 54 },
    lore: 'Long-frame precision railgun utilizing open twin-conductor capacitor fins to punch armor-piercing depleted tungsten slugs clean through heavy exo-frames.',
    hipPos: [0.22, -0.185, -0.46],
    adsPos: [0.0, -0.13, -0.28],
  },
  {
    id: 'plasma',
    slot: 5,
    name: 'PL-4 "SOLARIS"',
    category: 'DIRECTED-ENERGY CARBINE',
    caliber: 'IONIZED PLASMA CELL',
    fireMode: 'FULL-AUTO EMP',
    auto: true,
    rpm: 410,
    damage: 42,
    headMult: 1.85,
    pellets: 1,
    spreadHip: 0.018,
    spreadAds: 0.005,
    magSize: 24,
    reserveMax: 168,
    reloadTime: 1.75,
    recoilPitch: 0.021,
    recoilYaw: 0.007,
    adsFov: 52,
    range: 130,
    splash: 2.4,
    shieldBonus: 1.8,
    muzzleColor: [0.15, 1.0, 0.72],
    tracerColor: [0.2, 1.0, 0.75],
    accentHex: '#22f2b4',
    cost: 1100,
    stats: { damage: 86, fireRate: 64, accuracy: 88, mobility: 76 },
    lore: 'Experimental white-ceramic directed-energy rifle housing a magnetic containment core. Bolts detonate in a localized EMP arc that shreds cyber-shields.',
    hipPos: [0.21, -0.175, -0.43],
    adsPos: [0.0, -0.145, -0.34],
  },
  {
    id: 'pistol',
    slot: 6,
    name: 'K9-P "WRAITH"',
    category: 'SUPPRESSED SMART SIDEARM',
    caliber: '10mm SUBSONIC AP',
    fireMode: 'SEMI-AUTO',
    auto: false,
    rpm: 460,
    damage: 34,
    headMult: 2.4,
    pellets: 1,
    spreadHip: 0.014,
    spreadAds: 0.003,
    magSize: 15,
    reserveMax: 120,
    reloadTime: 1.15,
    recoilPitch: 0.025,
    recoilYaw: 0.005,
    adsFov: 60,
    range: 95,
    muzzleColor: [1.0, 0.25, 0.28],
    tracerColor: [1.0, 0.45, 0.3],
    accentHex: '#ff424e',
    cost: 0,
    stats: { damage: 64, fireRate: 68, accuracy: 91, mobility: 100 },
    lore: 'Whisper-quiet black-ops sidearm fitted with a rectangular Osprey cyber-suppressor, tritium sights, and an underbarrel crimson target designator.',
    hipPos: [0.19, -0.165, -0.37],
    adsPos: [0.0, -0.132, -0.30],
  },
];

export const WEAPON_MAP = Object.fromEntries(WEAPONS.map(w => [w.id, w]));

// Shared tactile PBR materials for weapons
const M_GUNMETAL = mat({ color: [0.20, 0.23, 0.27], roughness: 0.34, metallic: 0.82, tex: 'carbon' });
const M_TITANIUM = mat({ color: [0.46, 0.51, 0.57], roughness: 0.28, metallic: 0.88, tex: 'carbon' });
const M_POLYMER  = mat({ color: [0.12, 0.14, 0.17], roughness: 0.65, metallic: 0.15, tex: 'carbon' });
const M_CERAMIC  = mat({ color: [0.84, 0.87, 0.90], roughness: 0.24, metallic: 0.20 });
const M_COPPER   = mat({ color: [0.82, 0.45, 0.22], roughness: 0.26, metallic: 0.92 });
const M_BARREL   = mat({ color: [0.14, 0.16, 0.19], roughness: 0.22, metallic: 0.94 });
const M_LENS     = mat({ color: [0.05, 0.55, 0.72], alpha: 0.28, unlit: true });

function emMat(rgb) {
  return mat({ color: rgb, emissive: [rgb[0] * 2.4, rgb[1] * 2.4, rgb[2] * 2.4], roughness: 0.2, metallic: 0.1 });
}

// Helper to build the holographic optic assembly + floating glowing reticle
function addHoloOptic(parent, y, z, accentRGB, wide = false) {
  const w = wide ? 0.064 : 0.052;
  const h = wide ? 0.052 : 0.044;
  // Base mount
  parent.addPart({ mesh: 'box', pos: [0, y - 0.01, z], scale: [w + 0.008, 0.018, 0.10], material: M_POLYMER });
  // Left & Right armored hood walls
  parent.addPart({ mesh: 'box', pos: [-w * 0.5, y + h * 0.5, z], scale: [0.008, h, 0.088], material: M_GUNMETAL });
  parent.addPart({ mesh: 'box', pos: [ w * 0.5, y + h * 0.5, z], scale: [0.008, h, 0.088], material: M_GUNMETAL });
  // Top hood bridge
  parent.addPart({ mesh: 'box', pos: [0, y + h, z], scale: [w + 0.008, 0.008, 0.088], material: M_TITANIUM });
  // Tinted glass lens
  parent.addPart({ mesh: 'plane', pos: [0, y + h * 0.5, z + 0.015], scale: [w - 0.01, h - 0.01, 1], material: M_LENS, additive: true, castShadow: false });
  // Glowing floating reticle dot + outer halo ring
  parent.addPart({ mesh: 'sphere', pos: [0, y + h * 0.5, z + 0.01], scale: [0.005, 0.005, 0.005], material: emMat(accentRGB), castShadow: false });
  parent.addPart({ mesh: 'ring', pos: [0, y + h * 0.5, z + 0.01], scale: [0.024, 0.024, 0.024], material: mat({ color: accentRGB, alpha: 0.75, unlit: true }), additive: true, castShadow: false });
}

// Helper to add a dramatic multi-plane additive muzzle flash star
function addMuzzleFlash(parent, zPos, color) {
  const mf = parent.addPart({ pos: [0, 0.032, zPos], visible: false, name: 'muzzleFlash' });
  const coreMat = mat({ color: [color[0] * 2.5, color[1] * 2.5, color[2] * 2.5], alpha: 0.95, unlit: true });
  mf.addPart({ mesh: 'cone', pos: [0, 0, -0.09], rot: [-Math.PI / 2, 0, 0], scale: [0.075, 0.22, 0.075], material: coreMat, additive: true, castShadow: false });
  mf.addPart({ mesh: 'plane', pos: [0, 0, -0.02], scale: [0.22, 0.05, 1], material: coreMat, additive: true, castShadow: false });
  mf.addPart({ mesh: 'plane', pos: [0, 0, -0.02], rot: [0, 0, Math.PI / 2], scale: [0.22, 0.05, 1], material: coreMat, additive: true, castShadow: false });
  mf.addPart({ mesh: 'plane', pos: [0, 0, -0.02], rot: [0, 0, Math.PI / 4], scale: [0.16, 0.035, 1], material: coreMat, additive: true, castShadow: false });
  mf.addPart({ mesh: 'plane', pos: [0, 0, -0.02], rot: [0, 0, -Math.PI / 4], scale: [0.16, 0.035, 1], material: coreMat, additive: true, castShadow: false });
  return mf;
}

// Build complete 3D articulated weapon model (used in BOTH First-Person Viewmodel & 3D Armory Showcase!)
export function buildWeaponModel(weaponId, includeHands = false, operatorPalette = null) {
  const root = new SceneNode({ name: 'weapon_' + weaponId });
  const spec = WEAPON_MAP[weaponId] || WEAPONS[0];
  let boltNode = null;
  let magNode = null;
  let muzzleNode = null;
  let ammoStrip = null;

  const CYAN = [0.05, 0.92, 1.0];
  const AMBER = [1.0, 0.56, 0.10];
  const PLASMA = [0.12, 1.0, 0.72];
  const CRIMSON = [1.0, 0.22, 0.26];

  if (weaponId === 'ar') {
    // === M41-K "SPECTRE" — Smart Tactical Assault Rifle ===
    // Main upper & lower receiver
    root.addPart({ mesh: 'box', pos: [0, 0.03, -0.04], scale: [0.062, 0.072, 0.34], material: M_GUNMETAL });
    root.addPart({ mesh: 'box', pos: [0, -0.015, 0.02], scale: [0.056, 0.048, 0.22], material: M_POLYMER });
    // Brushed titanium top picatinny rail
    root.addPart({ mesh: 'box', pos: [0, 0.072, -0.14], scale: [0.036, 0.014, 0.54], material: M_TITANIUM });
    // Handguard shroud with side vents
    root.addPart({ mesh: 'box', pos: [0, 0.032, -0.32], scale: [0.068, 0.068, 0.26], material: M_TITANIUM });
    root.addPart({ mesh: 'box', pos: [-0.036, 0.032, -0.31], scale: [0.008, 0.022, 0.20], material: M_POLYMER });
    root.addPart({ mesh: 'box', pos: [ 0.036, 0.032, -0.31], scale: [0.008, 0.022, 0.20], material: M_POLYMER });
    // Glowing cyan neural telemetry rails along handguard
    root.addPart({ mesh: 'box', pos: [-0.037, 0.048, -0.32], scale: [0.006, 0.008, 0.22], material: emMat(CYAN) });
    root.addPart({ mesh: 'box', pos: [ 0.037, 0.048, -0.32], scale: [0.006, 0.008, 0.22], material: emMat(CYAN) });
    // Fluted barrel + hybrid tactical compensator
    root.addPart({ mesh: 'cyl', pos: [0, 0.034, -0.52], rot: [Math.PI / 2, 0, 0], scale: [0.024, 0.22, 0.024], material: M_BARREL });
    root.addPart({ mesh: 'box', pos: [0, 0.034, -0.64], scale: [0.036, 0.036, 0.082], material: M_GUNMETAL });
    // PEQ-15 laser module on right rail
    root.addPart({ mesh: 'box', pos: [0.048, 0.036, -0.36], scale: [0.026, 0.026, 0.09], material: M_POLYMER });
    root.addPart({ mesh: 'cyl', pos: [0.052, 0.036, -0.41], rot: [Math.PI / 2, 0, 0], scale: [0.01, 0.015, 0.01], material: emMat(CRIMSON) });
    // Tactical stock + cheek riser
    root.addPart({ mesh: 'box', pos: [0, 0.018, 0.22], scale: [0.044, 0.078, 0.20], material: M_POLYMER });
    root.addPart({ mesh: 'box', pos: [0, 0.052, 0.20], scale: [0.052, 0.022, 0.14], material: M_GUNMETAL });
    // Pistol grip + angled foregrip
    root.addPart({ mesh: 'box', pos: [0, -0.075, 0.075], rot: [0.32, 0, 0], scale: [0.042, 0.115, 0.052], material: M_POLYMER });
    root.addPart({ mesh: 'box', pos: [0, -0.035, -0.30], rot: [-0.45, 0, 0], scale: [0.036, 0.085, 0.044], material: M_POLYMER });
    // Reciprocating bolt carrier
    boltNode = root.addPart({ mesh: 'box', pos: [0.034, 0.038, -0.04], scale: [0.012, 0.022, 0.09], material: M_TITANIUM });
    // Detachable curved-look magazine
    magNode = root.addPart({ pos: [0, -0.09, -0.09], rot: [-0.14, 0, 0] });
    magNode.addPart({ mesh: 'box', scale: [0.042, 0.16, 0.068], material: M_POLYMER });
    magNode.addPart({ mesh: 'box', pos: [0, -0.075, 0], scale: [0.048, 0.022, 0.074], material: M_TITANIUM });
    // Live ammo strip on rear receiver
    ammoStrip = root.addPart({ mesh: 'box', pos: [-0.033, 0.045, 0.04], scale: [0.006, 0.012, 0.085], material: emMat(CYAN) });
    // Holo Reflex Optic
    addHoloOptic(root, 0.082, 0.01, CYAN, false);
    muzzleNode = addMuzzleFlash(root, -0.70, spec.muzzleColor);
  }
  else if (weaponId === 'smg') {
    // === VX-9 "KRAKEN" — Dual-Rail Magnetic PDW ===
    root.addPart({ mesh: 'box', pos: [0, 0.025, -0.04], scale: [0.058, 0.082, 0.30], material: M_GUNMETAL });
    root.addPart({ mesh: 'box', pos: [0, -0.045, -0.15], rot: [0.22, 0, 0], scale: [0.052, 0.11, 0.09], material: M_POLYMER });
    // Twin forward magnetic rails (upper & lower with glowing gap!)
    root.addPart({ mesh: 'box', pos: [0, 0.064, -0.30], scale: [0.044, 0.020, 0.28], material: M_TITANIUM });
    root.addPart({ mesh: 'box', pos: [0, 0.004, -0.30], scale: [0.044, 0.020, 0.28], material: M_TITANIUM });
    // Copper electromagnetic accelerator coils
    for (let i = 0; i < 4; i++) {
      const cz = -0.21 - i * 0.055;
      root.addPart({ mesh: 'box', pos: [-0.026, 0.034, cz], scale: [0.012, 0.044, 0.022], material: M_COPPER });
      root.addPart({ mesh: 'box', pos: [ 0.026, 0.034, cz], scale: [0.012, 0.044, 0.022], material: M_COPPER });
    }
    // Glowing cyan core plasma-rail slot
    root.addPart({ mesh: 'box', pos: [0, 0.034, -0.30], scale: [0.014, 0.018, 0.27], material: emMat(CYAN) });
    // Compact folding PDW stock & grip
    root.addPart({ mesh: 'box', pos: [0, 0.03, 0.18], scale: [0.032, 0.044, 0.16], material: M_POLYMER });
    root.addPart({ mesh: 'box', pos: [0, -0.065, 0.05], rot: [0.28, 0, 0], scale: [0.040, 0.105, 0.048], material: M_POLYMER });
    // Angled extended vector mag with glowing cyan rounds
    magNode = root.addPart({ pos: [0, -0.11, -0.17], rot: [0.24, 0, 0] });
    magNode.addPart({ mesh: 'box', scale: [0.036, 0.18, 0.048], material: M_POLYMER });
    magNode.addPart({ mesh: 'box', pos: [-0.019, 0, 0], scale: [0.005, 0.13, 0.018], material: emMat(CYAN) });
    boltNode = root.addPart({ mesh: 'box', pos: [0.032, 0.045, -0.06], scale: [0.014, 0.016, 0.07], material: M_COPPER });
    ammoStrip = root.addPart({ mesh: 'box', pos: [-0.031, 0.046, 0.03], scale: [0.006, 0.010, 0.08], material: emMat(CYAN) });
    addHoloOptic(root, 0.076, -0.02, CYAN, false);
    muzzleNode = addMuzzleFlash(root, -0.46, spec.muzzleColor);
  }
  else if (weaponId === 'shotgun') {
    // === M870-X "CERBERUS" — Thermite Breacher Shotgun ===
    root.addPart({ mesh: 'box', pos: [0, 0.024, -0.03], scale: [0.074, 0.088, 0.34], material: M_GUNMETAL });
    // Twin over-under heavy barrels
    root.addPart({ mesh: 'cyl', pos: [0, 0.056, -0.39], rot: [Math.PI / 2, 0, 0], scale: [0.036, 0.44, 0.036], material: M_BARREL });
    root.addPart({ mesh: 'cyl', pos: [0, 0.014, -0.37], rot: [Math.PI / 2, 0, 0], scale: [0.034, 0.40, 0.034], material: M_GUNMETAL });
    // Shrouded perforated heat-shield + glowing orange thermite induction coils!
    root.addPart({ mesh: 'box', pos: [0, 0.066, -0.36], scale: [0.064, 0.032, 0.34], material: M_TITANIUM });
    for (let i = 0; i < 5; i++) {
      const gz = -0.23 - i * 0.062;
      root.addPart({ mesh: 'box', pos: [0, 0.042, gz], scale: [0.072, 0.016, 0.022], material: emMat(AMBER) });
    }
    // Heavy spiked breacher choke muzzle
    root.addPart({ mesh: 'box', pos: [0, 0.040, -0.62], scale: [0.062, 0.074, 0.06], material: M_TITANIUM });
    // Chunky pump-action forend (animated on shot!)
    boltNode = root.addPart({ mesh: 'box', pos: [0, -0.012, -0.32], scale: [0.068, 0.054, 0.17], material: M_POLYMER });
    // Tactical drum/tube feed
    magNode = root.addPart({ mesh: 'cyl', pos: [0, -0.055, -0.10], rot: [Math.PI / 2, 0, 0], scale: [0.085, 0.11, 0.085], material: M_POLYMER });
    // Heavy stock & grip
    root.addPart({ mesh: 'box', pos: [0, 0.01, 0.24], scale: [0.052, 0.095, 0.22], material: M_POLYMER });
    root.addPart({ mesh: 'box', pos: [0, -0.072, 0.09], rot: [0.38, 0, 0], scale: [0.046, 0.115, 0.054], material: M_POLYMER });
    ammoStrip = root.addPart({ mesh: 'box', pos: [-0.039, 0.042, 0.02], scale: [0.006, 0.014, 0.09], material: emMat(AMBER) });
    addHoloOptic(root, 0.078, 0.01, AMBER, true);
    muzzleNode = addMuzzleFlash(root, -0.67, spec.muzzleColor);
  }
  else if (weaponId === 'sniper') {
    // === RA-77 "LONGBOW" — Anti-Materiel Railgun Sniper ===
    root.addPart({ mesh: 'box', pos: [0, 0.026, -0.04], scale: [0.068, 0.084, 0.38], material: M_GUNMETAL });
    root.addPart({ mesh: 'box', pos: [0, 0.074, -0.18], scale: [0.040, 0.016, 0.52], material: M_TITANIUM });
    // Open Twin-Rail Electromagnetic Barrel (long & menacing)
    root.addPart({ mesh: 'box', pos: [-0.028, 0.038, -0.54], scale: [0.018, 0.044, 0.68], material: M_TITANIUM });
    root.addPart({ mesh: 'box', pos: [ 0.028, 0.038, -0.54], scale: [0.018, 0.044, 0.68], material: M_TITANIUM });
    // Central glowing cyan hyper-capacitor plasma rail
    root.addPart({ mesh: 'box', pos: [0, 0.038, -0.53], scale: [0.014, 0.018, 0.66], material: emMat(CYAN) });
    // 6 angled capacitor cooling fins
    for (let i = 0; i < 6; i++) {
      const fz = -0.26 - i * 0.10;
      root.addPart({ mesh: 'box', pos: [0, 0.038, fz], scale: [0.082, 0.056, 0.018], material: M_GUNMETAL });
      root.addPart({ mesh: 'box', pos: [0, 0.068, fz], scale: [0.054, 0.008, 0.012], material: emMat(CYAN) });
    }
    // Folded front bipod legs
    root.addPart({ mesh: 'cyl', pos: [-0.044, -0.005, -0.56], rot: [Math.PI / 2, 0, 0], scale: [0.014, 0.24, 0.014], material: M_BARREL });
    root.addPart({ mesh: 'cyl', pos: [ 0.044, -0.005, -0.56], rot: [Math.PI / 2, 0, 0], scale: [0.014, 0.24, 0.014], material: M_BARREL });
    // Large Digital Variable-Zoom Smart Scope
    root.addPart({ mesh: 'cyl', pos: [0, 0.118, -0.04], rot: [Math.PI / 2, 0, 0], scale: [0.054, 0.30, 0.054], material: M_GUNMETAL });
    root.addPart({ mesh: 'cyl', pos: [0, 0.118, -0.18], rot: [Math.PI / 2, 0, 0], scale: [0.066, 0.07, 0.066], material: M_TITANIUM });
    root.addPart({ mesh: 'cyl', pos: [0, 0.118, 0.10], rot: [Math.PI / 2, 0, 0], scale: [0.060, 0.06, 0.060], material: M_POLYMER });
    root.addPart({ mesh: 'box', pos: [0, 0.088, -0.10], scale: [0.028, 0.038, 0.04], material: M_POLYMER });
    root.addPart({ mesh: 'box', pos: [0, 0.088, 0.04], scale: [0.028, 0.038, 0.04], material: M_POLYMER });
    root.addPart({ mesh: 'ring', pos: [0, 0.118, 0.132], scale: [0.052, 0.052, 0.052], material: mat({ color: CYAN, alpha: 0.8, unlit: true }), additive: true });
    // Stock, cheek rest, bolt & box mag
    root.addPart({ mesh: 'box', pos: [0, 0.018, 0.27], scale: [0.048, 0.086, 0.26], material: M_POLYMER });
    root.addPart({ mesh: 'box', pos: [0, -0.075, 0.07], rot: [0.28, 0, 0], scale: [0.044, 0.11, 0.052], material: M_POLYMER });
    boltNode = root.addPart({ mesh: 'box', pos: [0.042, 0.042, 0.04], scale: [0.036, 0.016, 0.022], material: M_TITANIUM });
    magNode = root.addPart({ mesh: 'box', pos: [0, -0.07, -0.09], scale: [0.048, 0.11, 0.095], material: M_POLYMER });
    ammoStrip = root.addPart({ mesh: 'box', pos: [-0.036, 0.046, 0.04], scale: [0.006, 0.012, 0.10], material: emMat(CYAN) });
    muzzleNode = addMuzzleFlash(root, -0.90, spec.muzzleColor);
  }
  else if (weaponId === 'plasma') {
    // === PL-4 "SOLARIS" — Aerospace Ceramic Plasma Carbine ===
    root.addPart({ mesh: 'box', pos: [0, 0.032, -0.06], scale: [0.072, 0.084, 0.36], material: M_CERAMIC });
    root.addPart({ mesh: 'box', pos: [0, 0.036, -0.34], scale: [0.066, 0.074, 0.28], material: M_CERAMIC });
    root.addPart({ mesh: 'box', pos: [0, 0.002, -0.22], scale: [0.054, 0.036, 0.44], material: M_GUNMETAL });
    // Open glowing turquoise magnetic plasma containment chamber!
    root.addPart({ mesh: 'cyl', pos: [0, 0.048, -0.22], rot: [Math.PI / 2, 0, 0], scale: [0.044, 0.18, 0.044], material: emMat(PLASMA) });
    for (let i = 0; i < 4; i++) {
      root.addPart({ mesh: 'box', pos: [0, 0.048, -0.15 - i * 0.046], scale: [0.078, 0.068, 0.014], material: M_GUNMETAL });
    }
    // Dual emitter prongs at barrel tip
    root.addPart({ mesh: 'box', pos: [-0.026, 0.042, -0.54], scale: [0.018, 0.038, 0.16], material: M_TITANIUM });
    root.addPart({ mesh: 'box', pos: [ 0.026, 0.042, -0.54], scale: [0.018, 0.038, 0.16], material: M_TITANIUM });
    root.addPart({ mesh: 'cyl', pos: [0, 0.042, -0.54], rot: [Math.PI / 2, 0, 0], scale: [0.022, 0.14, 0.022], material: emMat(PLASMA) });
    // Stock, grip, plasma battery cell
    root.addPart({ mesh: 'box', pos: [0, 0.022, 0.21], scale: [0.052, 0.088, 0.20], material: M_CERAMIC });
    root.addPart({ mesh: 'box', pos: [0, -0.072, 0.06], rot: [0.3, 0, 0], scale: [0.044, 0.11, 0.052], material: M_POLYMER });
    boltNode = root.addPart({ mesh: 'box', pos: [0, 0.082, -0.22], scale: [0.042, 0.014, 0.14], material: M_TITANIUM });
    magNode = root.addPart({ mesh: 'cyl', pos: [0, -0.055, -0.12], scale: [0.054, 0.11, 0.054], material: M_GUNMETAL });
    magNode.addPart({ mesh: 'cyl', pos: [0, 0, 0], scale: [1.06, 0.55, 1.06], material: emMat(PLASMA) });
    ammoStrip = root.addPart({ mesh: 'box', pos: [-0.038, 0.052, 0.02], scale: [0.006, 0.012, 0.09], material: emMat(PLASMA) });
    addHoloOptic(root, 0.084, -0.01, PLASMA, false);
    muzzleNode = addMuzzleFlash(root, -0.63, spec.muzzleColor);
  }
  else {
    // === K9-P "WRAITH" — Suppressed Smart Sidearm ===
    // Lower frame + ergonomic grip
    root.addPart({ mesh: 'box', pos: [0, 0.012, -0.05], scale: [0.038, 0.032, 0.22], material: M_POLYMER });
    root.addPart({ mesh: 'box', pos: [0, -0.062, 0.032], rot: [0.26, 0, 0], scale: [0.036, 0.115, 0.050], material: M_POLYMER });
    // Reciprocating CNC-milled titanium slide
    boltNode = root.addPart({ pos: [0, 0.042, -0.05] });
    boltNode.addPart({ mesh: 'box', scale: [0.040, 0.038, 0.23], material: M_TITANIUM });
    boltNode.addPart({ mesh: 'box', pos: [-0.021, 0.002, 0.02], scale: [0.004, 0.008, 0.09], material: emMat(CRIMSON) });
    // Micro red-dot on slide
    addHoloOptic(boltNode, 0.022, 0.05, CRIMSON, false);
    // Rectangular Osprey Cyberpunk Suppressor
    root.addPart({ mesh: 'box', pos: [0, 0.034, -0.27], scale: [0.038, 0.052, 0.22], material: M_GUNMETAL });
    root.addPart({ mesh: 'box', pos: [0, 0.018, -0.27], scale: [0.041, 0.010, 0.19], material: M_POLYMER });
    // Underbarrel crimson laser module
    root.addPart({ mesh: 'box', pos: [0, -0.012, -0.11], scale: [0.026, 0.024, 0.07], material: M_GUNMETAL });
    root.addPart({ mesh: 'sphere', pos: [0, -0.012, -0.15], scale: [0.01, 0.01, 0.01], material: emMat(CRIMSON) });
    // Magazine inside grip
    magNode = root.addPart({ mesh: 'box', pos: [0, -0.075, 0.036], rot: [0.26, 0, 0], scale: [0.028, 0.11, 0.038], material: M_GUNMETAL });
    ammoStrip = root.addPart({ mesh: 'box', pos: [0, 0.050, 0.068], scale: [0.028, 0.012, 0.006], material: emMat(CRIMSON) });
    muzzleNode = addMuzzleFlash(root, -0.39, spec.muzzleColor);
  }

  // First-Person Operator Cyber-Armored Hands & Forearms
  if (includeHands) {
    const pal = operatorPalette || {
      sleeve: [0.16, 0.20, 0.25],
      plate: [0.35, 0.41, 0.48],
      accent: [0.05, 0.90, 1.0],
    };
    const mSleeve = mat({ color: pal.sleeve, roughness: 0.65, metallic: 0.25, tex: 'carbon' });
    const mPlate = mat({ color: pal.plate, roughness: 0.32, metallic: 0.85 });
    const mGlow = emMat(pal.accent);

    // Right tactical cyber-hand on pistol grip + forearm
    const rArm = root.addPart({ pos: [0.025, -0.085, 0.08], rot: [0.25, -0.12, 0.1] });
    rArm.addPart({ mesh: 'box', pos: [0, 0, 0], scale: [0.064, 0.074, 0.078], material: mSleeve });
    rArm.addPart({ mesh: 'box', pos: [0.028, 0.015, 0.01], scale: [0.018, 0.042, 0.052], material: mPlate });
    rArm.addPart({ mesh: 'box', pos: [0.055, -0.05, 0.17], rot: [-0.35, 0.22, 0], scale: [0.088, 0.084, 0.32], material: mSleeve });
    rArm.addPart({ mesh: 'box', pos: [0.082, -0.015, 0.16], rot: [-0.35, 0.22, 0], scale: [0.042, 0.028, 0.22], material: mPlate });
    rArm.addPart({ mesh: 'box', pos: [0.095, -0.008, 0.15], rot: [-0.35, 0.22, 0], scale: [0.010, 0.010, 0.16], material: mGlow });

    // Left support hand on foregrip / barrel shroud
    if (weaponId !== 'pistol') {
      const lArm = root.addPart({ pos: [-0.032, -0.045, -0.25], rot: [0.15, 0.35, -0.25] });
      lArm.addPart({ mesh: 'box', pos: [0, 0, 0], scale: [0.068, 0.066, 0.085], material: mSleeve });
      lArm.addPart({ mesh: 'box', pos: [-0.032, 0.012, 0], scale: [0.016, 0.038, 0.055], material: mPlate });
      lArm.addPart({ mesh: 'box', pos: [-0.14, -0.08, 0.21], rot: [-0.32, -0.58, 0.22], scale: [0.086, 0.082, 0.36], material: mSleeve });
      lArm.addPart({ mesh: 'box', pos: [-0.15, -0.05, 0.20], rot: [-0.32, -0.58, 0.22], scale: [0.05, 0.024, 0.22], material: mPlate });
      lArm.addPart({ mesh: 'box', pos: [-0.13, -0.04, 0.19], rot: [-0.32, -0.58, 0.22], scale: [0.012, 0.010, 0.15], material: mGlow });
    }
  }

  return { root, boltNode, magNode, muzzleNode, ammoStrip, spec };
}

// Kinetic Cyber-Blade (for F Melee Slash)
export function buildCyberBlade() {
  const root = new SceneNode({ visible: false, name: 'cyberBlade' });
  root.addPart({ mesh: 'box', pos: [0, 0, 0], scale: [0.035, 0.042, 0.14], material: M_POLYMER });
  root.addPart({ mesh: 'box', pos: [0, 0.01, -0.22], scale: [0.012, 0.048, 0.34], material: M_TITANIUM });
  root.addPart({ mesh: 'box', pos: [0, -0.014, -0.22], scale: [0.015, 0.012, 0.35], material: emMat([0.1, 0.95, 1.0]) });
  return root;
}
