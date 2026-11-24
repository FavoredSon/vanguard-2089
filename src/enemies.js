// ============================================================================
// VANGUARD 2089 — 7 Articulated 3D Enemy Classes + ARES-IX TITAN Boss
// ============================================================================
import { SceneNode, mat } from './engine.js';
import { clamp, rand } from './math.js';

export const ENEMY_SPECS = {
  trooper: {
    id: 'trooper',
    name: 'SYNDICATE TROOPER',
    role: 'PMC TACTICAL INFANTRY',
    threat: 'MODERATE',
    hp: 85,
    shield: 0,
    speed: 4.5,
    radius: 0.52,
    height: 1.85,
    headY: 1.62,
    headR: 0.28,
    damage: 9,
    fireRate: 0.72,
    range: 36,
    score: 120,
    credits: 85,
    accentHex: '#ff3b44',
    lore: 'Militech-Syndicate frontline trooper clad in composite hex-armor with crimson tactical optics. Uses coordinated strafing and burst-fire suppression.',
  },
  ronin: {
    id: 'ronin',
    name: 'CYBER-RONIN',
    role: 'BLADE ASSAULT CYBORG',
    threat: 'HIGH',
    hp: 105,
    shield: 35,
    speed: 8.2,
    radius: 0.50,
    height: 1.85,
    headY: 1.64,
    headR: 0.28,
    damage: 24,
    fireRate: 0.85,
    range: 2.6,
    meleeOnly: true,
    score: 200,
    credits: 135,
    accentHex: '#ff2442',
    lore: 'Hyper-augmented close-quarters assassin armed with twin superheated thermal katanas and spinal dash thrusters. Zig-zags to close distance rapidly.',
  },
  enforcer: {
    id: 'enforcer',
    name: 'AEGIS ENFORCER',
    role: 'HEAVY EXO-JUGGERNAUT',
    threat: 'SEVERE',
    hp: 240,
    shield: 120,
    speed: 2.7,
    radius: 0.75,
    height: 2.25,
    headY: 1.98,
    headR: 0.34,
    damage: 7,
    fireRate: 0.16,
    range: 32,
    score: 360,
    credits: 240,
    accentHex: '#f5a623',
    lore: 'Armored exo-suit heavy carrying a shoulder-projected hex-shield and a six-barrel rotary cannon. Shred its shield with EMP or target the amber visor.',
  },
  sniper: {
    id: 'sniper',
    name: 'NETRUNNER PHANTOM',
    role: 'STEALTH RAIL-MARKSMAN',
    threat: 'HIGH',
    hp: 75,
    shield: 30,
    speed: 3.4,
    radius: 0.48,
    height: 1.82,
    headY: 1.60,
    headR: 0.28,
    damage: 34,
    fireRate: 2.6,
    range: 62,
    laserAim: true,
    score: 240,
    credits: 165,
    accentHex: '#22f2b4',
    lore: 'Cloaked recon specialist armed with a high-velocity rail rifle. Emits a visible crimson lock-on laser for 1.1 seconds before unleashing an armor-piercing shot.',
  },
  drone: {
    id: 'drone',
    name: 'HORNET-X4 DRONE',
    role: 'AUTONOMOUS HUNTER-KILLER',
    threat: 'MODERATE',
    hp: 65,
    shield: 25,
    speed: 6.4,
    radius: 0.62,
    height: 1.1,
    headY: 0.0,
    headR: 0.44,
    flying: true,
    hoverY: 3.2,
    damage: 8,
    fireRate: 0.52,
    range: 38,
    score: 150,
    credits: 110,
    accentHex: '#00e5ff',
    lore: 'Quad-thruster tactical UAV patrolling sector airways. Orbits targets at altitude while firing twin plasma repeaters. Vulnerable to EMP and headshots on its central eye.',
  },
  walker: {
    id: 'walker',
    name: 'ARACHNID-MK2',
    role: 'QUADRUPED ASSAULT MECH',
    threat: 'SEVERE',
    hp: 210,
    shield: 80,
    speed: 3.3,
    radius: 1.05,
    height: 1.65,
    headY: 1.15,
    headR: 0.46,
    damage: 14,
    fireRate: 0.48,
    range: 40,
    score: 340,
    credits: 230,
    accentHex: '#ff6b1a',
    lore: 'Four-legged cyber-warfare spider-tank equipped with stabilized twin autocannons and reinforced sloped chassis plating.',
  },
  titan: {
    id: 'titan',
    name: 'ARES-IX "TITAN"',
    role: 'COMMAND WAR-MECH [BOSS]',
    threat: 'EXTREME',
    hp: 1550,
    shield: 450,
    speed: 3.1,
    radius: 1.45,
    height: 4.3,
    headY: 3.72,
    headR: 0.62,
    coreY: 2.85,
    coreR: 0.65,
    damage: 14,
    fireRate: 0.24,
    range: 55,
    isBoss: true,
    score: 2500,
    credits: 1200,
    accentHex: '#ff2436',
    lore: 'Towering 4.3-meter prototype bipedal war-mech piloted by Rogue Director Kaelen. Armed with a rotary plasma cannon, twin shoulder missile salvos, and an overdrive fusion core.',
  },
};

export const ENEMY_LIST = Object.values(ENEMY_SPECS);

// Shared Enemy PBR materials
const M_DARK_ARMOR = mat({ color: [0.16, 0.19, 0.24], roughness: 0.40, metallic: 0.72, tex: 'hexArmor' });
const M_SLATE      = mat({ color: [0.27, 0.31, 0.37], roughness: 0.36, metallic: 0.78, tex: 'carbon' });
const M_CRIMSON_PL = mat({ color: [0.56, 0.12, 0.16], roughness: 0.32, metallic: 0.65, tex: 'hexArmor' });
const M_HAZARD     = mat({ color: [0.85, 0.56, 0.10], roughness: 0.38, metallic: 0.55, tex: 'hexArmor' });
const M_STEALTH    = mat({ color: [0.11, 0.14, 0.18], roughness: 0.62, metallic: 0.35, tex: 'carbon' });
const M_JOINT      = mat({ color: [0.10, 0.11, 0.14], roughness: 0.45, metallic: 0.85 });

function em(rgb, mult = 2.6) {
  return mat({ color: rgb, emissive: [rgb[0]*mult, rgb[1]*mult, rgb[2]*mult], roughness: 0.2, metallic: 0.1 });
}

// Build complete articulated 3D Enemy Model (used in gameplay & 3D Hostiles Codex!)
export function buildEnemyModel(type) {
  const root = new SceneNode({ name: 'enemy_' + type, highlight: true });
  const anim = { leftLeg: null, rightLeg: null, leftArm: null, rightArm: null, torso: null, turret: null, gunBarrel: null, shieldMesh: null, legs: [], rotors: [], muzzle: null };

  if (type === 'trooper') {
    const mVis = em([1.0, 0.18, 0.22], 2.8);
    // Articulated Legs
    anim.leftLeg = root.addPart({ pos: [-0.14, 0.88, 0] });
    anim.leftLeg.addPart({ mesh: 'box', pos: [0, -0.22, 0], scale: [0.16, 0.44, 0.18], material: M_DARK_ARMOR });
    anim.leftLeg.addPart({ mesh: 'box', pos: [0, -0.64, 0], scale: [0.14, 0.42, 0.16], material: M_SLATE });
    anim.leftLeg.addPart({ mesh: 'box', pos: [0, -0.84, 0.05], scale: [0.15, 0.11, 0.26], material: M_JOINT });

    anim.rightLeg = root.addPart({ pos: [0.14, 0.88, 0] });
    anim.rightLeg.addPart({ mesh: 'box', pos: [0, -0.22, 0], scale: [0.16, 0.44, 0.18], material: M_DARK_ARMOR });
    anim.rightLeg.addPart({ mesh: 'box', pos: [0, -0.64, 0], scale: [0.14, 0.42, 0.16], material: M_SLATE });
    anim.rightLeg.addPart({ mesh: 'box', pos: [0, -0.84, 0.05], scale: [0.15, 0.11, 0.26], material: M_JOINT });

    // Torso & Ballistic Plate Carrier
    anim.torso = root.addPart({ pos: [0, 1.24, 0] });
    anim.torso.addPart({ mesh: 'box', scale: [0.46, 0.56, 0.28], material: M_DARK_ARMOR });
    anim.torso.addPart({ mesh: 'box', pos: [0, 0.06, 0.14], scale: [0.36, 0.34, 0.08], material: M_SLATE });
    anim.torso.addPart({ mesh: 'box', pos: [0, 0.14, 0.185], scale: [0.18, 0.035, 0.02], material: mVis });
    anim.torso.addPart({ mesh: 'box', pos: [0, 0.04, -0.20], scale: [0.30, 0.38, 0.14], material: M_JOINT });

    // Head + Glowing Crimson Tactical Visor
    const head = anim.torso.addPart({ pos: [0, 0.42, 0] });
    head.addPart({ mesh: 'box', scale: [0.24, 0.26, 0.26], material: M_SLATE });
    head.addPart({ mesh: 'box', pos: [0, 0.03, 0.132], scale: [0.22, 0.07, 0.028], material: mVis });

    // Arms + Pulse Rifle
    anim.leftArm = anim.torso.addPart({ pos: [-0.30, 0.18, 0], rot: [-0.85, 0.3, 0] });
    anim.leftArm.addPart({ mesh: 'box', pos: [0, 0.03, 0], scale: [0.16, 0.16, 0.18], material: M_SLATE });
    anim.leftArm.addPart({ mesh: 'box', pos: [0, -0.22, 0], scale: [0.12, 0.46, 0.12], material: M_DARK_ARMOR });

    anim.rightArm = anim.torso.addPart({ pos: [0.30, 0.18, 0], rot: [-1.1, -0.15, 0] });
    anim.rightArm.addPart({ mesh: 'box', pos: [0, 0.03, 0], scale: [0.16, 0.16, 0.18], material: M_SLATE });
    anim.rightArm.addPart({ mesh: 'box', pos: [0, -0.22, 0], scale: [0.12, 0.46, 0.12], material: M_DARK_ARMOR });
    // Held Assault Rifle
    const gun = anim.rightArm.addPart({ pos: [-0.04, -0.45, 0.16], rot: [1.1, 0, 0] });
    gun.addPart({ mesh: 'box', pos: [0, 0, 0.18], scale: [0.08, 0.12, 0.62], material: M_JOINT });
    gun.addPart({ mesh: 'box', pos: [0, 0.05, 0.28], scale: [0.02, 0.02, 0.34], material: mVis });
    anim.muzzle = gun.addPart({ mesh: 'sphere', pos: [0, 0.02, 0.54], scale: [0.18, 0.18, 0.26], material: mat({ color: [2.4, 0.7, 0.2], alpha: 0.9, unlit: true }), additive: true, visible: false });
  }
  else if (type === 'ronin') {
    const mBlade = em([1.0, 0.16, 0.26], 3.2);
    // Agile dark-crimson cyborg legs
    anim.leftLeg = root.addPart({ pos: [-0.14, 0.90, 0] });
    anim.leftLeg.addPart({ mesh: 'box', pos: [0, -0.42, 0], scale: [0.13, 0.84, 0.15], material: M_STEALTH });
    anim.leftLeg.addPart({ mesh: 'box', pos: [-0.07, -0.58, 0.04], scale: [0.03, 0.36, 0.04], material: mBlade });

    anim.rightLeg = root.addPart({ pos: [0.14, 0.90, 0] });
    anim.rightLeg.addPart({ mesh: 'box', pos: [0, -0.42, 0], scale: [0.13, 0.84, 0.15], material: M_STEALTH });
    anim.rightLeg.addPart({ mesh: 'box', pos: [0.07, -0.58, 0.04], scale: [0.03, 0.36, 0.04], material: mBlade });

    // Lean armored crimson cyber-torso + jet thrusters
    anim.torso = root.addPart({ pos: [0, 1.26, 0] });
    anim.torso.addPart({ mesh: 'box', scale: [0.42, 0.56, 0.24], material: M_CRIMSON_PL });
    anim.torso.addPart({ mesh: 'box', pos: [0, 0.05, 0.13], scale: [0.28, 0.28, 0.05], material: M_STEALTH });
    anim.torso.addPart({ mesh: 'box', pos: [-0.12, 0.12, -0.18], rot: [0.35, 0, 0.2], scale: [0.11, 0.28, 0.11], material: M_JOINT });
    anim.torso.addPart({ mesh: 'box', pos: [ 0.12, 0.12, -0.18], rot: [0.35, 0, -0.2], scale: [0.11, 0.28, 0.11], material: M_JOINT });
    anim.torso.addPart({ mesh: 'sphere', pos: [-0.12, -0.02, -0.22], scale: [0.09, 0.09, 0.09], material: mBlade });
    anim.torso.addPart({ mesh: 'sphere', pos: [ 0.12, -0.02, -0.22], scale: [0.09, 0.09, 0.09], material: mBlade });

    // Horned Oni Cyber-Helmet
    const head = anim.torso.addPart({ pos: [0, 0.42, 0.02] });
    head.addPart({ mesh: 'box', scale: [0.22, 0.26, 0.24], material: M_CRIMSON_PL });
    head.addPart({ mesh: 'box', pos: [0, 0.02, 0.125], scale: [0.20, 0.055, 0.025], material: mBlade });
    // Cyber Oni Horns
    head.addPart({ mesh: 'cone', pos: [-0.11, 0.18, 0.06], rot: [0.35, 0, 0.45], scale: [0.05, 0.20, 0.05], material: M_SLATE });
    head.addPart({ mesh: 'cone', pos: [ 0.11, 0.18, 0.06], rot: [0.35, 0, -0.45], scale: [0.05, 0.20, 0.05], material: M_SLATE });

    // Twin Thermal Katana Arms
    anim.leftArm = anim.torso.addPart({ pos: [-0.28, 0.18, 0], rot: [-0.7, 0.2, -0.25] });
    anim.leftArm.addPart({ mesh: 'box', pos: [0, -0.22, 0], scale: [0.11, 0.46, 0.11], material: M_STEALTH });
    anim.leftArm.addPart({ mesh: 'box', pos: [0, -0.44, 0.46], scale: [0.028, 0.055, 0.96], material: mBlade });

    anim.rightArm = anim.torso.addPart({ pos: [0.28, 0.18, 0], rot: [-0.9, -0.2, 0.25] });
    anim.rightArm.addPart({ mesh: 'box', pos: [0, -0.22, 0], scale: [0.11, 0.46, 0.11], material: M_STEALTH });
    anim.rightArm.addPart({ mesh: 'box', pos: [0, -0.44, 0.46], scale: [0.028, 0.055, 0.96], material: mBlade });
  }
  else if (type === 'enforcer') {
    const mAmb = em([1.0, 0.62, 0.08], 2.8);
    // Heavy Exo Legs
    anim.leftLeg = root.addPart({ pos: [-0.24, 1.02, 0] });
    anim.leftLeg.addPart({ mesh: 'box', pos: [0, -0.48, 0], scale: [0.26, 0.96, 0.28], material: M_DARK_ARMOR });
    anim.leftLeg.addPart({ mesh: 'box', pos: [0, -0.44, 0.14], scale: [0.22, 0.30, 0.08], material: M_HAZARD });

    anim.rightLeg = root.addPart({ pos: [0.24, 1.02, 0] });
    anim.rightLeg.addPart({ mesh: 'box', pos: [0, -0.48, 0], scale: [0.26, 0.96, 0.28], material: M_DARK_ARMOR });
    anim.rightLeg.addPart({ mesh: 'box', pos: [0, -0.44, 0.14], scale: [0.22, 0.30, 0.08], material: M_HAZARD });

    // Massive Juggernaut Torso + Shoulder Pauldrons
    anim.torso = root.addPart({ pos: [0, 1.48, 0] });
    anim.torso.addPart({ mesh: 'box', scale: [0.76, 0.74, 0.48], material: M_DARK_ARMOR });
    anim.torso.addPart({ mesh: 'box', pos: [0, 0.08, 0.24], scale: [0.58, 0.46, 0.12], material: M_HAZARD });
    anim.torso.addPart({ mesh: 'box', pos: [0, 0.16, 0.31], scale: [0.26, 0.06, 0.03], material: mAmb });
    // Glowing weakpoint power pack on back
    anim.torso.addPart({ mesh: 'cyl', pos: [0, 0.10, -0.32], scale: [0.28, 0.46, 0.28], material: mAmb });
    // Dome Head inside Armored Collar
    anim.torso.addPart({ mesh: 'box', pos: [0, 0.42, 0], scale: [0.46, 0.18, 0.42], material: M_SLATE });
    anim.torso.addPart({ mesh: 'box', pos: [0, 0.54, 0.02], scale: [0.28, 0.26, 0.28], material: M_DARK_ARMOR });
    anim.torso.addPart({ mesh: 'box', pos: [0, 0.55, 0.17], scale: [0.24, 0.08, 0.03], material: mAmb });

    // Left Arm + Translucent Hex Energy Shield!
    anim.leftArm = anim.torso.addPart({ pos: [-0.50, 0.18, 0.08], rot: [-0.85, 0.45, 0] });
    anim.leftArm.addPart({ mesh: 'box', pos: [-0.04, 0.10, 0], scale: [0.30, 0.28, 0.32], material: M_HAZARD });
    anim.leftArm.addPart({ mesh: 'box', pos: [0, -0.25, 0], scale: [0.20, 0.52, 0.20], material: M_SLATE });
    anim.shieldMesh = anim.torso.addPart({
      mesh: 'box', pos: [-0.38, 0.02, 0.52], rot: [0, -0.25, 0], scale: [0.78, 1.12, 0.04],
      material: mat({ color: [0.1, 0.85, 1.0], alpha: 0.32, unlit: true }), additive: true, castShadow: false,
    });

    // Right Arm + Spinning Rotary Minigun!
    anim.rightArm = anim.torso.addPart({ pos: [0.50, 0.18, 0.06], rot: [-0.45, 0, 0] });
    anim.rightArm.addPart({ mesh: 'box', pos: [0.04, 0.10, 0], scale: [0.30, 0.28, 0.32], material: M_HAZARD });
    anim.rightArm.addPart({ mesh: 'box', pos: [0, -0.24, 0], scale: [0.20, 0.48, 0.20], material: M_SLATE });
    const mini = anim.rightArm.addPart({ pos: [0.04, -0.45, 0.38], rot: [0.45, 0, 0] });
    mini.addPart({ mesh: 'cyl', rot: [Math.PI / 2, 0, 0], scale: [0.24, 0.38, 0.24], material: M_JOINT });
    anim.gunBarrel = mini.addPart({ pos: [0, 0, 0.44] });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      anim.gunBarrel.addPart({ mesh: 'cyl', pos: [Math.cos(a)*0.06, Math.sin(a)*0.06, 0], rot: [Math.PI / 2, 0, 0], scale: [0.036, 0.62, 0.036], material: M_SLATE });
    }
    anim.muzzle = mini.addPart({ mesh: 'sphere', pos: [0, 0, 0.80], scale: [0.28, 0.28, 0.38], material: mat({ color: [2.6, 1.3, 0.2], alpha: 0.9, unlit: true }), additive: true, visible: false });
  }
  else if (type === 'sniper') {
    const mOpt = em([0.1, 1.0, 0.72], 2.9);
    anim.leftLeg = root.addPart({ pos: [-0.13, 0.88, 0] });
    anim.leftLeg.addPart({ mesh: 'box', pos: [0, -0.42, 0], scale: [0.13, 0.84, 0.15], material: M_STEALTH });
    anim.rightLeg = root.addPart({ pos: [0.13, 0.88, 0] });
    anim.rightLeg.addPart({ mesh: 'box', pos: [0, -0.42, 0], scale: [0.13, 0.84, 0.15], material: M_STEALTH });

    // Cloaked Recon Torso + Cape
    anim.torso = root.addPart({ pos: [0, 1.24, 0] });
    anim.torso.addPart({ mesh: 'box', scale: [0.40, 0.56, 0.24], material: M_STEALTH });
    anim.torso.addPart({ mesh: 'box', pos: [0, -0.08, -0.16], rot: [0.12, 0, 0], scale: [0.46, 0.84, 0.04], material: M_DARK_ARMOR });
    // Hooded Multi-Lens Tri-Optic Head
    const head = anim.torso.addPart({ pos: [0, 0.40, 0.02] });
    head.addPart({ mesh: 'box', scale: [0.26, 0.28, 0.28], material: M_STEALTH });
    head.addPart({ mesh: 'sphere', pos: [-0.06, 0.02, 0.14], scale: [0.055, 0.055, 0.055], material: mOpt });
    head.addPart({ mesh: 'sphere', pos: [ 0.06, 0.02, 0.14], scale: [0.055, 0.055, 0.055], material: mOpt });
    head.addPart({ mesh: 'sphere', pos: [ 0.00, 0.08, 0.14], scale: [0.050, 0.050, 0.050], material: mOpt });

    anim.leftArm = anim.torso.addPart({ pos: [-0.26, 0.16, 0], rot: [-1.1, 0.4, 0] });
    anim.leftArm.addPart({ mesh: 'box', pos: [0, -0.22, 0], scale: [0.10, 0.44, 0.10], material: M_STEALTH });
    anim.rightArm = anim.torso.addPart({ pos: [0.26, 0.16, 0], rot: [-1.2, -0.1, 0] });
    anim.rightArm.addPart({ mesh: 'box', pos: [0, -0.22, 0], scale: [0.10, 0.44, 0.10], material: M_STEALTH });
    // Long Rail Sniper Rifle
    const gun = anim.rightArm.addPart({ pos: [-0.04, -0.44, 0.22], rot: [1.2, 0, 0] });
    gun.addPart({ mesh: 'box', pos: [0, 0, 0.36], scale: [0.07, 0.11, 1.18], material: M_SLATE });
    gun.addPart({ mesh: 'box', pos: [0, 0.03, 0.56], scale: [0.022, 0.024, 0.72], material: mOpt });
    anim.muzzle = gun.addPart({ mesh: 'sphere', pos: [0, 0.02, 0.96], scale: [0.22, 0.22, 0.32], material: mat({ color: [0.2, 2.5, 2.0], alpha: 0.9, unlit: true }), additive: true, visible: false });
  }
  else if (type === 'drone') {
    const mEye = em([0.05, 0.92, 1.0], 3.0);
    const mRed = em([1.0, 0.22, 0.22], 2.8);
    // Central armored chassis sphere/wedge
    anim.torso = root.addPart({ pos: [0, 0, 0] });
    anim.torso.addPart({ mesh: 'box', scale: [0.68, 0.36, 0.78], material: M_SLATE });
    anim.torso.addPart({ mesh: 'box', pos: [0, 0.18, -0.05], scale: [0.46, 0.14, 0.52], material: M_DARK_ARMOR });
    // Glowing central cyclops scanner eye
    anim.torso.addPart({ mesh: 'sphere', pos: [0, 0.0, 0.38], scale: [0.26, 0.26, 0.16], material: mEye });
    anim.torso.addPart({ mesh: 'sphere', pos: [0, 0.0, 0.45], scale: [0.11, 0.11, 0.08], material: mRed });
    // Twin under-slung plasma repeaters
    anim.torso.addPart({ mesh: 'cyl', pos: [-0.22, -0.22, 0.24], rot: [Math.PI / 2, 0, 0], scale: [0.07, 0.48, 0.07], material: M_JOINT });
    anim.torso.addPart({ mesh: 'cyl', pos: [ 0.22, -0.22, 0.24], rot: [Math.PI / 2, 0, 0], scale: [0.07, 0.48, 0.07], material: M_JOINT });
    // 4 Quad-Thruster Nacelles with spinning rotor rings!
    for (const [rx, rz] of [[-0.56, 0.42], [0.56, 0.42], [-0.56, -0.42], [0.56, -0.42]]) {
      anim.torso.addPart({ mesh: 'box', pos: [rx * 0.5, 0.06, rz * 0.5], rot: [0, Math.atan2(rx, rz), 0], scale: [0.08, 0.07, 0.56], material: M_JOINT });
      const pod = anim.torso.addPart({ pos: [rx, 0.08, rz] });
      pod.addPart({ mesh: 'cyl', scale: [0.34, 0.12, 0.34], material: M_DARK_ARMOR });
      const blade = pod.addPart({ mesh: 'box', pos: [0, 0.08, 0], scale: [0.30, 0.02, 0.05], material: mEye });
      anim.rotors.push(blade);
    }
    anim.muzzle = anim.torso.addPart({ mesh: 'sphere', pos: [0, -0.22, 0.54], scale: [0.26, 0.20, 0.30], material: mat({ color: [0.2, 2.2, 2.8], alpha: 0.9, unlit: true }), additive: true, visible: false });
  }
  else if (type === 'walker') {
    const mCore = em([1.0, 0.42, 0.08], 3.0);
    // Swiveling Armored Spider Turret Dome
    anim.torso = root.addPart({ pos: [0, 1.05, 0] });
    anim.torso.addPart({ mesh: 'cyl', scale: [1.18, 0.52, 1.18], material: M_DARK_ARMOR });
    anim.torso.addPart({ mesh: 'box', pos: [0, 0.24, -0.05], scale: [0.84, 0.36, 0.94], material: M_SLATE });
    anim.torso.addPart({ mesh: 'sphere', pos: [0, 0.22, 0.45], scale: [0.28, 0.22, 0.18], material: mCore });
    // Twin Autocannons
    anim.torso.addPart({ mesh: 'cyl', pos: [-0.46, 0.18, 0.58], rot: [Math.PI / 2, 0, 0], scale: [0.11, 0.92, 0.11], material: M_JOINT });
    anim.torso.addPart({ mesh: 'cyl', pos: [ 0.46, 0.18, 0.58], rot: [Math.PI / 2, 0, 0], scale: [0.11, 0.92, 0.11], material: M_JOINT });
    anim.muzzle = anim.torso.addPart({ mesh: 'sphere', pos: [0, 0.18, 1.08], scale: [0.46, 0.22, 0.30], material: mat({ color: [2.8, 1.1, 0.2], alpha: 0.9, unlit: true }), additive: true, visible: false });

    // 4 Articulated Quadruped Spider Legs
    const angles = [0.7, 2.4, -2.4, -0.7];
    for (let i = 0; i < 4; i++) {
      const a = angles[i];
      const legPivot = root.addPart({ pos: [Math.sin(a)*0.52, 0.92, Math.cos(a)*0.52], rot: [0, a, 0] });
      legPivot.addPart({ mesh: 'box', pos: [0, 0.12, 0.34], rot: [-0.45, 0, 0], scale: [0.16, 0.16, 0.72], material: M_HAZARD });
      legPivot.addPart({ mesh: 'box', pos: [0, -0.42, 0.72], rot: [0.28, 0, 0], scale: [0.14, 1.05, 0.14], material: M_DARK_ARMOR });
      anim.legs.push(legPivot);
    }
  }
  else if (type === 'titan') {
    // === ARES-IX "TITAN" — 4.3-Meter Command War-Mech Boss ===
    const mCore = em([1.0, 0.14, 0.18], 3.6);
    const mAmb  = em([1.0, 0.62, 0.10], 2.8);

    // Massive Articulated Bipedal Mech Legs (reverse-joint hydraulic)
    for (const side of [-1, 1]) {
      const leg = root.addPart({ pos: [side * 0.64, 1.95, 0] });
      // Upper hydraulic thigh
      leg.addPart({ mesh: 'box', pos: [0, -0.45, 0.12], rot: [-0.25, 0, 0], scale: [0.48, 0.98, 0.56], material: M_DARK_ARMOR });
      leg.addPart({ mesh: 'box', pos: [side * 0.26, -0.45, 0.12], scale: [0.12, 0.64, 0.36], material: M_CRIMSON_PL });
      // Knee actuator & armored lower shin
      leg.addPart({ mesh: 'cyl', pos: [0, -0.95, 0.24], rot: [0, 0, Math.PI / 2], scale: [0.34, 0.54, 0.34], material: M_JOINT });
      leg.addPart({ mesh: 'box', pos: [0, -1.42, -0.06], rot: [0.18, 0, 0], scale: [0.42, 0.98, 0.46], material: M_SLATE });
      leg.addPart({ mesh: 'box', pos: [0, -1.42, 0.18], scale: [0.12, 0.52, 0.06], material: mCore });
      // Clawed hydraulic war-foot
      leg.addPart({ mesh: 'box', pos: [0, -1.86, 0.12], scale: [0.58, 0.24, 0.88], material: M_JOINT });
      if (side < 0) anim.leftLeg = leg; else anim.rightLeg = leg;
    }

    // Pelvis Hydraulics
    root.addPart({ mesh: 'box', pos: [0, 2.02, 0], scale: [1.42, 0.44, 0.86], material: M_JOINT });

    // Towering Armored Upper Hull + Glowing Chest Fusion Core
    anim.torso = root.addPart({ pos: [0, 2.88, 0] });
    anim.torso.addPart({ mesh: 'box', scale: [1.72, 1.38, 1.18], material: M_DARK_ARMOR });
    anim.torso.addPart({ mesh: 'box', pos: [0, 0.14, 0.58], scale: [1.34, 0.92, 0.26], material: M_CRIMSON_PL });
    // Glowing Exposed Fusion Reactor Core (Weakpoint!)
    anim.torso.addPart({ mesh: 'cyl', pos: [0, 0.06, 0.72], rot: [Math.PI / 2, 0, 0], scale: [0.56, 0.16, 0.56], material: M_JOINT });
    anim.torso.addPart({ mesh: 'sphere', pos: [0, 0.06, 0.84], scale: [0.44, 0.44, 0.30], material: mCore });
    // Twin Rear Exhaust Reactor Stacks
    anim.torso.addPart({ mesh: 'box', pos: [-0.46, 0.42, -0.72], scale: [0.36, 1.05, 0.38], material: M_SLATE });
    anim.torso.addPart({ mesh: 'box', pos: [ 0.46, 0.42, -0.72], scale: [0.36, 1.05, 0.38], material: M_SLATE });
    anim.torso.addPart({ mesh: 'box', pos: [-0.46, 0.96, -0.72], scale: [0.22, 0.14, 0.22], material: mAmb });
    anim.torso.addPart({ mesh: 'box', pos: [ 0.46, 0.96, -0.72], scale: [0.22, 0.14, 0.22], material: mAmb });

    // Twin Shoulder-Mounted 6-Tube Missile Pods!
    for (const side of [-1, 1]) {
      const pod = anim.torso.addPart({ pos: [side * 0.96, 0.86, -0.05] });
      pod.addPart({ mesh: 'box', scale: [0.56, 0.54, 0.74], material: M_SLATE });
      pod.addPart({ mesh: 'box', pos: [0, 0.12, 0.38], scale: [0.42, 0.16, 0.05], material: mAmb });
      pod.addPart({ mesh: 'box', pos: [0, -0.12, 0.38], scale: [0.42, 0.16, 0.05], material: mCore });
    }

    // Armored Mech Command Head + Predator Visor (Headshot Weakpoint!)
    const head = anim.torso.addPart({ pos: [0, 0.88, 0.16] });
    head.addPart({ mesh: 'box', scale: [0.64, 0.50, 0.66], material: M_SLATE });
    head.addPart({ mesh: 'box', pos: [0, 0.04, 0.34], scale: [0.54, 0.14, 0.06], material: mCore });
    head.addPart({ mesh: 'box', pos: [0, 0.28, -0.06], scale: [0.22, 0.16, 0.56], material: M_CRIMSON_PL });

    // Left Arm: Heavy Hydraulic Siege Shield + Forearm Rail-Blaster
    anim.leftArm = anim.torso.addPart({ pos: [-1.14, 0.22, 0.08], rot: [-0.35, 0.2, 0] });
    anim.leftArm.addPart({ mesh: 'box', pos: [-0.08, 0.16, 0], scale: [0.56, 0.54, 0.62], material: M_CRIMSON_PL });
    anim.leftArm.addPart({ mesh: 'box', pos: [0, -0.56, 0.16], scale: [0.38, 1.08, 0.40], material: M_SLATE });
    anim.shieldMesh = anim.leftArm.addPart({
      mesh: 'box', pos: [-0.24, -0.58, 0.42], scale: [0.22, 1.48, 0.96],
      material: mat({ color: [1.0, 0.2, 0.26], alpha: 0.36, unlit: true }), additive: true, castShadow: false,
    });

    // Right Arm: Giant Rotary Plasma Autocannon!
    anim.rightArm = anim.torso.addPart({ pos: [1.14, 0.22, 0.08], rot: [-0.32, 0, 0] });
    anim.rightArm.addPart({ mesh: 'box', pos: [0.08, 0.16, 0], scale: [0.56, 0.54, 0.62], material: M_CRIMSON_PL });
    anim.rightArm.addPart({ mesh: 'box', pos: [0, -0.45, 0.14], scale: [0.40, 0.88, 0.42], material: M_SLATE });
    const cannon = anim.rightArm.addPart({ pos: [0.06, -0.82, 0.68], rot: [0.32, 0, 0] });
    cannon.addPart({ mesh: 'cyl', rot: [Math.PI / 2, 0, 0], scale: [0.46, 0.72, 0.46], material: M_JOINT });
    anim.gunBarrel = cannon.addPart({ pos: [0, 0, 0.82] });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      anim.gunBarrel.addPart({ mesh: 'cyl', pos: [Math.cos(a)*0.12, Math.sin(a)*0.12, 0], rot: [Math.PI / 2, 0, 0], scale: [0.065, 1.25, 0.065], material: M_SLATE });
    }
    anim.gunBarrel.addPart({ mesh: 'cyl', rot: [Math.PI / 2, 0, 0], scale: [0.12, 1.22, 0.12], material: mCore });
    anim.muzzle = cannon.addPart({ mesh: 'sphere', pos: [0, 0, 1.54], scale: [0.56, 0.56, 0.78], material: mat({ color: [3.2, 0.6, 0.25], alpha: 0.92, unlit: true }), additive: true, visible: false });
  }

  return { root, anim };
}

// ============================================================================
// Runtime Enemy Entity Controller & AI State Machine
// ============================================================================
export class Enemy {
  constructor(type, x, y, z, scaleMult = 1.0) {
    const spec = ENEMY_SPECS[type] || ENEMY_SPECS.trooper;
    this.type = type;
    this.spec = spec;
    this.maxHp = Math.round(spec.hp * scaleMult);
    this.hp = this.maxHp;
    this.maxShield = Math.round(spec.shield * scaleMult);
    this.shield = this.maxShield;
    this.alive = true;

    this.pos = new Float32Array([x, spec.flying ? y + spec.hoverY : y, z]);
    this.vel = new Float32Array([0, 0, 0]);
    this.yaw = 0;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeTimer = rand(1.2, 2.8);
    this.fireCooldown = rand(0.5, 1.4);
    this.burstLeft = 0;
    this.aimCharge = 0; // For sniper laser telegraph
    this.missileCooldown = 4.5; // For Titan Boss
    this.hitFlash = 0;
    this.muzzleTimer = 0;
    this.walkPhase = rand(0, 6.28);
    this.phase2 = false;
    this.alerted = false;

    const built = buildEnemyModel(type);
    this.node = built.root;
    this.anim = built.anim;
    this.node.pos.set(this.pos);

    // Optional Sniper Laser Sight Beam node
    this.laserNode = null;
  }

  takeDamage(amount, isHead = false, isEmp = false) {
    if (!this.alive) return { killed: false, shieldBroken: false };
    this.alerted = true;
    this.hitFlash = 0.14;
    let dmg = amount;
    let shieldBroken = false;

    if (this.shield > 0) {
      const sDmg = dmg * (isEmp ? 1.85 : 1.0);
      this.shield -= sDmg;
      if (this.shield <= 0) {
        const overflow = -this.shield;
        this.shield = 0;
        shieldBroken = true;
        if (this.anim.shieldMesh) this.anim.shieldMesh.visible = false;
        this.hp -= overflow * 0.6;
      }
    } else {
      this.hp -= dmg;
    }

    // Titan Boss Phase 2 Overdrive at 50% HP!
    if (this.spec.isBoss && !this.phase2 && this.hp <= this.maxHp * 0.5) {
      this.phase2 = true;
      this.shield = Math.round(this.maxShield * 0.65);
      if (this.anim.shieldMesh) this.anim.shieldMesh.visible = true;
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
      return { killed: true, shieldBroken };
    }
    return { killed: false, shieldBroken };
  }

  update(dt, playerPos, level, callbacks) {
    if (!this.alive) return;
    const s = this.spec;
    const dx = playerPos[0] - this.pos[0];
    const dz = playerPos[2] - this.pos[2];
    const dy = (playerPos[1] - 0.3) - (this.pos[1] + s.height * 0.6);
    const distXZ = Math.hypot(dx, dz);
    const dist3D = Math.hypot(dx, dy, dz);

    // Aggro activation
    if (!this.alerted && dist3D < (s.isBoss ? 70 : 48)) this.alerted = true;
    if (!this.alerted) {
      this._animate(dt, 0);
      return;
    }

    // Smooth yaw facing player
    const targetYaw = Math.atan2(dx, dz);
    let diff = targetYaw - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += diff * Math.min(1, dt * (s.isBoss ? 3.5 : 7.5));

    // Line of sight check
    const eyeY = this.pos[1] + (s.flying ? 0 : s.height * 0.72);
    const hasLOS = level.hasLineOfSight(this.pos[0], eyeY, this.pos[2], playerPos[0], playerPos[1], playerPos[2]);

    // Movement AI tailored per class
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeDir = -this.strafeDir;
      this.strafeTimer = rand(1.1, 2.6);
    }

    let moveX = 0, moveZ = 0;
    const nx = distXZ > 0.01 ? dx / distXZ : 0;
    const nz = distXZ > 0.01 ? dz / distXZ : 1;
    const sx = -nz * this.strafeDir;
    const sz = nx * this.strafeDir;

    const spd = s.speed * (this.phase2 ? 1.25 : 1.0);
    if (s.meleeOnly) {
      // Cyber-Ronin rushes aggressively & zig-zags!
      moveX = (nx * 0.92 + sx * 0.55) * spd;
      moveZ = (nz * 0.92 + sz * 0.55) * spd;
    } else if (s.flying) {
      // Hornet Drone orbits player at 10-16m altitude
      const desired = 13.5;
      const radial = clamp((distXZ - desired) * 0.35, -1, 1);
      moveX = (nx * radial + sx * 0.85) * spd;
      moveZ = (nz * radial + sz * 0.85) * spd;
      const targetY = Math.max(level.getFloorHeight(this.pos[0], this.pos[2]) + s.hoverY, playerPos[1] + 1.4);
      this.pos[1] += (targetY + Math.sin(this.walkPhase * 2.0) * 0.45 - this.pos[1]) * Math.min(1, dt * 3.0);
    } else if (s.laserAim) {
      // Netrunner Sniper prefers distance (18-36m) and strafes slowly
      if (distXZ < 15) { moveX = -nx * spd * 0.8; moveZ = -nz * spd * 0.8; }
      else if (distXZ > 34 || !hasLOS) { moveX = (nx * 0.75 + sx * 0.4) * spd; moveZ = (nz * 0.75 + sz * 0.4) * spd; }
      else { moveX = sx * spd * 0.35; moveZ = sz * spd * 0.35; }
    } else {
      // Troopers, Enforcers, Walkers, Titan advance to optimal range & strafe
      const ideal = s.isBoss ? 16 : (this.type === 'enforcer' ? 12 : 16);
      if (distXZ > ideal || !hasLOS) {
        moveX = (nx * 0.82 + sx * 0.42) * spd;
        moveZ = (nz * 0.82 + sz * 0.42) * spd;
      } else if (distXZ < ideal * 0.52) {
        moveX = (-nx * 0.45 + sx * 0.75) * spd;
        moveZ = (-nz * 0.45 + sz * 0.75) * spd;
      } else {
        moveX = sx * spd * 0.72;
        moveZ = sz * spd * 0.72;
      }
    }

    // Apply movement with AABB wall collision
    const moveSpeed = Math.hypot(moveX, moveZ);
    if (!s.flying) {
      const nextPos = level.moveCircle(this.pos[0], this.pos[1], this.pos[2], moveX * dt, moveZ * dt, s.radius);
      this.pos[0] = nextPos.x;
      this.pos[1] = nextPos.y;
      this.pos[2] = nextPos.z;
    } else {
      this.pos[0] += moveX * dt;
      this.pos[2] += moveZ * dt;
    }

    // Combat Firing Logic
    this.fireCooldown -= dt;
    if (this.muzzleTimer > 0) {
      this.muzzleTimer -= dt;
      if (this.anim.muzzle) this.anim.muzzle.visible = this.muzzleTimer > 0;
    }

    if (s.meleeOnly) {
      if (dist3D <= s.range + 0.6 && this.fireCooldown <= 0) {
        this.fireCooldown = s.fireRate;
        callbacks.onEnemyMelee(this, s.damage);
      }
    } else if (hasLOS && dist3D <= s.range) {
      if (s.laserAim) {
        // Sniper lock-on laser telegraph before firing!
        if (this.fireCooldown <= 1.15) {
          this.aimCharge = clamp(1.15 - this.fireCooldown, 0, 1.15) / 1.15;
          callbacks.onSniperLaser(this, [this.pos[0], eyeY, this.pos[2]], playerPos);
        }
        if (this.fireCooldown <= 0) {
          this.fireCooldown = s.fireRate + rand(0, 0.5);
          this.aimCharge = 0;
          this.muzzleTimer = 0.1;
          if (this.anim.muzzle) this.anim.muzzle.visible = true;
          callbacks.onEnemyShoot(this, [this.pos[0], eyeY, this.pos[2]], playerPos, s.damage, 'sniper');
        }
      } else {
        if (this.fireCooldown <= 0) {
          const rate = this.phase2 ? s.fireRate * 0.72 : s.fireRate;
          this.fireCooldown = rate + rand(0, rate * 0.25);
          this.muzzleTimer = 0.08;
          if (this.anim.muzzle) this.anim.muzzle.visible = true;
          callbacks.onEnemyShoot(this, [this.pos[0], eyeY, this.pos[2]], playerPos, s.damage, this.type);
        }
      }
    } else {
      this.aimCharge = 0;
    }

    // Titan Boss Special: Twin Shoulder Homing/Arc Missile Salvo!
    if (s.isBoss && hasLOS) {
      this.missileCooldown -= dt;
      if (this.missileCooldown <= 0) {
        this.missileCooldown = this.phase2 ? 4.4 : 6.2;
        callbacks.onBossMissile(this, [this.pos[0], this.pos[1] + 3.8, this.pos[2]], playerPos);
      }
    }

    this._animate(dt, moveSpeed);
  }

  _animate(dt, moveSpeed) {
    this.node.pos.set(this.pos);
    this.node.rot[1] = this.yaw;

    // Hit-flinch tilt
    if (this.hitFlash > 0) {
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.node.rot[0] = -this.hitFlash * 1.1;
    } else {
      this.node.rot[0] = 0;
    }

    this.walkPhase += dt * (moveSpeed > 0.3 ? (this.spec.isBoss ? 4.2 : 8.5) : 2.0);
    const swing = moveSpeed > 0.3 ? Math.sin(this.walkPhase) * 0.55 : 0;

    if (this.anim.leftLeg) this.anim.leftLeg.rot[0] = swing;
    if (this.anim.rightLeg) this.anim.rightLeg.rot[0] = -swing;

    // Spin rotary barrels & drone rotors
    if (this.anim.gunBarrel) this.anim.gunBarrel.rot[2] += dt * (this.alerted ? 18 : 2);
    for (let i = 0; i < this.anim.rotors.length; i++) {
      this.anim.rotors[i].rot[1] += dt * 28;
    }
    // Spider walker alternating leg articulation
    for (let i = 0; i < this.anim.legs.length; i++) {
      this.anim.legs[i].rot[0] = Math.sin(this.walkPhase + i * 1.6) * (moveSpeed > 0.3 ? 0.25 : 0.04);
    }
    // Cyber-Ronin aggressive slash pose
    if (this.type === 'ronin' && this.anim.rightArm) {
      this.anim.rightArm.rot[0] = -0.9 + Math.sin(this.walkPhase * 1.8) * 0.45;
      this.anim.leftArm.rot[0] = -0.7 - Math.sin(this.walkPhase * 1.8) * 0.45;
    }
  }
}
