// ============================================================================
// VANGUARD 2089 — Playable Operator Roster, 3D Character Builders & NPC Comms
// ============================================================================
import { SceneNode, mat } from './engine.js';
import { generatePortraitDataURL } from './textures.js';
import { buildWeaponModel } from './weapons.js';

export const OPERATORS = [
  {
    id: 'vance',
    callsign: 'GHOST-01',
    name: 'SGT. VEX VANCE',
    division: 'JSOC CYBER-RECON // TASK FORCE VANGUARD',
    role: 'TACTICAL RECON & OVERWATCH',
    signatureWeapon: 'ar',
    accentHex: '#00e5ff',
    perkTitle: 'NEURAL LINK RELOAD',
    perkDesc: '+18% Faster Reload Speed & +40% Extended Optic Scan Range',
    bonuses: { reloadMult: 0.82, scanRange: 52, maxArmor: 100, overclockDur: 4.2, dmgMult: 1.0 },
    palette: {
      armor: [0.16, 0.20, 0.25],
      plate: [0.36, 0.42, 0.49],
      cloth: [0.11, 0.13, 0.16],
      accent: [0.05, 0.90, 1.0],
      sleeve: [0.16, 0.20, 0.25],
    },
    bio: 'Former Tier-1 orbital insertion specialist augmented with a military-grade right-arm cybernetic servo and Kiroshi Mk.IX tactical HUD visor.',
  },
  {
    id: 'sato',
    callsign: 'VALKYRIE',
    name: 'CAPT. KAIA SATO',
    division: 'EX-ARASAKA BLACK-OPS // VANGUARD STRIKE',
    role: 'HIGH-SPEED ASSAULT & REFLEX',
    signatureWeapon: 'smg',
    accentHex: '#ff3b4e',
    perkTitle: 'SANDEVISTAN SYNC',
    perkDesc: '+35% Overclock Reflex Duration & +25% Faster Shield Recharge',
    bonuses: { reloadMult: 0.95, scanRange: 38, maxArmor: 95, overclockDur: 5.7, shieldRegenMult: 1.25, speedMult: 1.10, dmgMult: 1.0 },
    palette: {
      armor: [0.80, 0.84, 0.88],
      plate: [0.22, 0.25, 0.30],
      cloth: [0.12, 0.12, 0.15],
      accent: [1.0, 0.22, 0.30],
      sleeve: [0.76, 0.80, 0.84],
    },
    bio: 'Defected elite corporate counter-intelligence operative outfitted with lightweight ceramic-white exo-plating and a custom Sandevistan spine accelerator.',
  },
  {
    id: 'reyes',
    callsign: 'ANVIL',
    name: 'CPL. MARCUS REYES',
    division: 'HEAVY EXO-BREACHER // 7TH ARMORED CYBER',
    role: 'HEAVY ASSAULT & DEMOLITION',
    signatureWeapon: 'shotgun',
    accentHex: '#f5a623',
    perkTitle: 'TUNGSTEN EXO-CHASSIS',
    perkDesc: '+45 Max Subdermal Armor & +20% Shotgun / Explosive Blast Damage',
    bonuses: { reloadMult: 1.0, scanRange: 36, maxArmor: 145, overclockDur: 4.0, blastMult: 1.22, dmgMult: 1.05 },
    palette: {
      armor: [0.24, 0.28, 0.22],
      plate: [0.44, 0.41, 0.31],
      cloth: [0.14, 0.15, 0.13],
      accent: [1.0, 0.65, 0.12],
      sleeve: [0.24, 0.28, 0.22],
    },
    bio: 'Heavy breaching veteran wearing reinforced tungsten-weave shoulder pauldrons and a ballistic amber face-shield engineered to shrug off rotary cannon fire.',
  },
];

export const COMMS_NPCS = {
  oracle: {
    id: 'oracle',
    callsign: 'OVERWATCH // ORACLE',
    name: 'LT. ELENA VOSS',
    accentHex: '#00e5ff',
  },
  specter: {
    id: 'specter',
    callsign: 'SPECTER-2',
    name: 'SGT. COLE MERCER',
    accentHex: '#36e88e',
  },
  kaelen: {
    id: 'kaelen',
    callsign: 'DIRECTOR KAELEN [ARES-IX]',
    name: 'ROGUE COMMANDER',
    accentHex: '#ff2b3a',
  },
};

const portraitCache = {};
export function getPortrait(id) {
  if (!portraitCache[id]) portraitCache[id] = generatePortraitDataURL(id);
  return portraitCache[id];
}

// Build full articulated 3D Operator Character for the 3D Showcase / Roster Turntable
export function buildOperatorModel(opId) {
  const op = OPERATORS.find(o => o.id === opId) || OPERATORS[0];
  const p = op.palette;
  const root = new SceneNode({ name: 'operator_' + op.id });

  const mArmor = mat({ color: p.armor, roughness: 0.36, metallic: 0.65, tex: 'hexArmor' });
  const mPlate = mat({ color: p.plate, roughness: 0.28, metallic: 0.85, tex: 'carbon' });
  const mCloth = mat({ color: p.cloth, roughness: 0.72, metallic: 0.15, tex: 'carbon' });
  const mGlow = mat({ color: p.accent, emissive: [p.accent[0]*2.6, p.accent[1]*2.6, p.accent[2]*2.6], roughness: 0.2, metallic: 0.1 });
  const mDark = mat({ color: [0.10, 0.12, 0.15], roughness: 0.5, metallic: 0.6 });

  const isHeavy = op.id === 'reyes';
  const torsoW = isHeavy ? 0.56 : (op.id === 'sato' ? 0.44 : 0.48);

  // Legs (articulated boots, shin greaves, knee pads, armored thighs)
  for (const side of [-1, 1]) {
    const leg = root.addPart({ pos: [side * 0.15, 0.90, 0] });
    // Thigh + tactical holster pouch
    leg.addPart({ mesh: 'box', pos: [0, -0.22, 0], scale: [0.17, 0.44, 0.19], material: mCloth });
    leg.addPart({ mesh: 'box', pos: [side * 0.095, -0.20, 0.02], scale: [0.05, 0.18, 0.13], material: mPlate });
    // Knee armor guard
    leg.addPart({ mesh: 'box', pos: [0, -0.45, 0.09], scale: [0.14, 0.13, 0.08], material: mPlate });
    // Armored shin greave
    leg.addPart({ mesh: 'box', pos: [0, -0.66, -0.01], scale: [0.15, 0.40, 0.17], material: mArmor });
    leg.addPart({ mesh: 'box', pos: [side * 0.08, -0.64, 0.02], scale: [0.016, 0.22, 0.022], material: mGlow });
    // Tactical combat boot
    leg.addPart({ mesh: 'box', pos: [0, -0.86, 0.05], scale: [0.16, 0.12, 0.28], material: mDark });
  }

  // Tactical Utility Belt & Pelvis Rig
  root.addPart({ mesh: 'box', pos: [0, 0.95, 0], scale: [torsoW * 0.94, 0.18, 0.27], material: mDark });
  root.addPart({ mesh: 'box', pos: [0, 0.96, 0.14], scale: [0.14, 0.09, 0.04], material: mPlate });

  // Upper Torso & Ballistic Plate Carrier
  const torso = root.addPart({ pos: [0, 1.30, 0], name: 'torso' });
  torso.addPart({ mesh: 'box', pos: [0, 0, 0], scale: [torsoW, 0.56, 0.30], material: mCloth });
  // Front ceramic chest plate + mag pouches
  torso.addPart({ mesh: 'box', pos: [0, 0.05, 0.15], scale: [torsoW * 0.84, 0.38, 0.08], material: mArmor });
  torso.addPart({ mesh: 'box', pos: [0, 0.14, 0.195], scale: [0.22, 0.032, 0.016], material: mGlow });
  for (let px = -1; px <= 1; px++) {
    torso.addPart({ mesh: 'box', pos: [px * 0.11, -0.10, 0.18], scale: [0.085, 0.13, 0.055], material: mPlate });
  }
  // Armored Tactical Exo-Collar
  torso.addPart({ mesh: 'box', pos: [0, 0.29, -0.02], scale: [torsoW * 0.72, 0.12, 0.28], material: mPlate });

  // Back Cyber-Pack / Thruster & Comms Antenna
  torso.addPart({ mesh: 'box', pos: [0, 0.04, -0.22], scale: [0.34, 0.44, 0.18], material: mPlate });
  torso.addPart({ mesh: 'box', pos: [-0.09, -0.02, -0.32], scale: [0.06, 0.26, 0.03], material: mGlow });
  torso.addPart({ mesh: 'box', pos: [ 0.09, -0.02, -0.32], scale: [0.06, 0.26, 0.03], material: mGlow });
  torso.addPart({ mesh: 'cyl', pos: [0.14, 0.42, -0.24], scale: [0.015, 0.48, 0.015], material: mDark });
  torso.addPart({ mesh: 'sphere', pos: [0.14, 0.66, -0.24], scale: [0.035, 0.035, 0.035], material: mGlow });

  // Head & Cyber-Helmet
  const head = torso.addPart({ pos: [0, 0.44, 0.01], name: 'head' });
  head.addPart({ mesh: 'cyl', pos: [0, -0.11, 0], scale: [0.13, 0.12, 0.13], material: mDark });
  head.addPart({ mesh: 'box', pos: [0, 0.02, 0], scale: [0.24, 0.26, 0.26], material: mArmor });
  head.addPart({ mesh: 'box', pos: [0, 0.14, -0.01], scale: [0.14, 0.06, 0.24], material: mPlate });
  // Ear comms modules
  head.addPart({ mesh: 'cyl', pos: [-0.13, 0.01, 0], rot: [0, 0, Math.PI / 2], scale: [0.09, 0.04, 0.09], material: mPlate });
  head.addPart({ mesh: 'cyl', pos: [ 0.13, 0.01, 0], rot: [0, 0, Math.PI / 2], scale: [0.09, 0.04, 0.09], material: mPlate });
  // Glowing Visor Strip
  head.addPart({ mesh: 'box', pos: [0, 0.04, 0.132], scale: [0.21, 0.068, 0.028], material: mGlow });
  // Chin / Jaw respirator
  head.addPart({ mesh: 'box', pos: [0, -0.07, 0.11], scale: [0.16, 0.09, 0.08], material: mDark });

  // Articulated Arms + Heavy Shoulder Pauldrons
  const pauldronS = isHeavy ? 0.26 : 0.19;
  const rArm = torso.addPart({ pos: [torsoW * 0.5 + 0.08, 0.17, 0], rot: [0.65, -0.35, -0.12] });
  rArm.addPart({ mesh: 'box', pos: [0.03, 0.04, 0], scale: [pauldronS, 0.18, 0.24], material: mPlate });
  rArm.addPart({ mesh: 'box', pos: [0, -0.15, 0], scale: [0.13, 0.30, 0.13], material: mCloth });
  // Vance has metallic cybernetic right forearm!
  rArm.addPart({ mesh: 'box', pos: [0, -0.34, 0.12], rot: [0.75, 0, 0], scale: [0.12, 0.30, 0.12], material: op.id === 'vance' ? mPlate : mArmor });
  rArm.addPart({ mesh: 'box', pos: [0.065, -0.34, 0.12], rot: [0.75, 0, 0], scale: [0.016, 0.18, 0.02], material: mGlow });

  const lArm = torso.addPart({ pos: [-(torsoW * 0.5 + 0.08), 0.17, 0], rot: [0.75, 0.45, 0.15] });
  lArm.addPart({ mesh: 'box', pos: [-0.03, 0.04, 0], scale: [pauldronS, 0.18, 0.24], material: mPlate });
  lArm.addPart({ mesh: 'box', pos: [0, -0.15, 0], scale: [0.13, 0.30, 0.13], material: mCloth });
  lArm.addPart({ mesh: 'box', pos: [0, -0.34, 0.12], rot: [0.75, 0, 0], scale: [0.12, 0.30, 0.12], material: mArmor });

  // Signature Weapon held at ready across chest!
  const wep = buildWeaponModel(op.signatureWeapon, false);
  wep.root.pos.set([0.08, -0.02, 0.36]);
  wep.root.rot.set([0.08, -1.15, 0.08]);
  wep.root.scale.set([0.95, 0.95, 0.95]);
  torso.add(wep.root);

  return { root, torso, head, op };
}
