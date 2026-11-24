// ============================================================================
// VANGUARD 2089 — Master FPS Game Simulation, Campaign & Endless Director
// ============================================================================
import { Engine, SceneNode, mat } from './engine.js';
import { AudioEngine } from './audio.js';
import { WEAPONS, WEAPON_MAP, buildWeaponModel, buildCyberBlade } from './weapons.js';
import { OPERATORS, COMMS_NPCS, getPortrait, buildOperatorModel } from './characters.js';
import { Enemy, ENEMY_SPECS, buildEnemyModel } from './enemies.js';
import { buildCampaignLevel, buildEndlessArena } from './levels.js';
import { clamp, damp, lerp, M4, rand, raySphere, DEG2RAD } from './math.js';

export class VanguardGame {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.engine = new Engine(canvas);
    this.audio = new AudioEngine();

    // App state
    this.state = 'menu'; // 'menu' | 'showcase' | 'playing' | 'paused' | 'shop' | 'debrief'
    this.mode = 'campaign'; // 'campaign' | 'endless'
    this.selectedOperatorId = 'vance';

    // Detect mobile/touch hardware
    this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    // Settings
    this.settings = {
      sensitivity: 0.0022,
      fov: 76,
      quality: this.isTouchDevice ? 'med' : 'high',
      volume: 0.72,
      invertY: false,
      touchMode: 'auto', // 'auto' | 'on' | 'off'
    };
    if (this.isTouchDevice) this.engine.setQuality('med');

    // High scores persisted locally
    this.records = this._loadRecords();

    // Scene roots
    this.worldRoot = new SceneNode({ name: 'worldRoot' });
    this.vmRoot = new SceneNode({ name: 'vmRoot', visible: false });
    this.fxRoot = new SceneNode({ name: 'fxRoot' });
    this.enemyRoot = new SceneNode({ name: 'enemyRoot' });
    this.showcaseRoot = new SceneNode({ name: 'showcaseRoot' });

    this.level = null;
    this.enemies = [];
    this.projectiles = []; // Enemy plasma/rockets & player grenades
    this.vfx = [];         // Tracers, sparks, explosion spheres
    this.rainDrops = [];
    this.dynLights = [];

    // Input state (Desktop + Dual-Thumb Touch)
    this.keys = {};
    this.mouseDown = [false, false, false];
    this.pointerLocked = false;
    this.touch = {
      moveX: 0,
      moveY: 0,
      sprint: false,
      firing: false,
      adsToggle: false,
      crouchToggle: false,
      jumpQueued: false,
    };

    // Showcase turntable state
    this.showcaseTab = 'weapons'; // 'weapons' | 'operators' | 'enemies'
    this.showcaseId = 'ar';
    this.showcaseYaw = 0.55;
    this.showcasePitch = 0.14;
    this.showcaseZoom = 1.0;
    this.showcaseDragging = false;
    this.showcasePinchDist = 0;
    this.showcaseLastTouch = null;
    this.showcaseNode = null;
    this.showcaseBuilt = null;
    this.showcaseFlashTimer = 0;

    // Player & combat state (reset on deploy)
    this._resetPlayerState();

    // Build menu backdrop immediately
    this._setupMenuBackdrop();
    this._bindInputs();

    // Main loop
    this.time = 0;
    this.lastFrame = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _loadRecords() {
    try {
      const r = JSON.parse(localStorage.getItem('vanguard2089_records') || '{}');
      return { bestWave: r.bestWave || 0, bestScore: r.bestScore || 0, campaignCleared: !!r.campaignCleared };
    } catch { return { bestWave: 0, bestScore: 0, campaignCleared: false }; }
  }

  _saveRecords() {
    try { localStorage.setItem('vanguard2089_records', JSON.stringify(this.records)); } catch {}
  }

  getOperator() {
    return OPERATORS.find(o => o.id === this.selectedOperatorId) || OPERATORS[0];
  }

  _resetPlayerState() {
    const op = this.getOperator();
    const b = op.bonuses;
    this.player = {
      pos: new Float32Array([0, 0, 12]),
      vel: new Float32Array([0, 0, 0]),
      yaw: 0,
      pitch: 0,
      grounded: true,
      crouching: false,
      sprinting: false,
      slideTimer: 0,
      slideDir: [0, 0],
      eyeH: 1.66,
      hp: 100,
      maxHp: 100,
      armor: b.maxArmor || 100,
      maxArmor: b.maxArmor || 100,
      shieldRegenDelay: 0,
      grenades: 3,
      maxGrenades: 5,
      credits: 250,
      score: 0,
      kills: 0,
      headshots: 0,
      shotsFired: 0,
      shotsHit: 0,
      damageUpgrades: 0,
      armorUpgrades: 0,
      reflexUpgrades: 0,
      stepTimer: 0,
      bobPhase: 0,
      hitDirAngle: null,
      hitDirTimer: 0,
      // Abilities
      overclockActive: 0,
      overclockCd: 0,
      scanActive: 0,
      scanCd: 0,
      meleeTimer: 0,
    };

    // Weapon inventory
    this.inventory = {};
    for (const w of WEAPONS) {
      const unlocked = (w.id === 'ar' || w.id === 'smg' || w.id === 'shotgun' || w.id === 'pistol');
      this.inventory[w.id] = {
        unlocked,
        mag: w.magSize,
        reserve: w.reserveMax,
      };
    }
    this.currentWeaponId = op.signatureWeapon;
    if (!this.inventory[this.currentWeaponId].unlocked) this.inventory[this.currentWeaponId].unlocked = true;

    this.fireTimer = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.adsAmount = 0;
    this.recoilPitch = 0;
    this.recoilKick = 0;
    this.pumpAnim = 0;
    this.vmMuzzleTimer = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.weaponSwapTimer = 0;

    // Campaign / Endless director state
    this.missionTime = 0;
    this.missionStage = 0;
    this.objectiveTitle = '';
    this.objectiveSub = '';
    this.objectivePos = null;
    this.coresRemaining = 3;
    this.wave = 0;
    this.waveIntermission = 0;
    this.waveEnemiesLeftToSpawn = 0;
    this.waveSpawnTimer = 0;
    this.waveQueue = [];
    this.activeBoss = null;
    this.killFeed = [];
    this.commsQueue = [];
    this.activeComms = null;
    this.hitmarkerTimer = 0;
    this.hitmarkerHead = false;
    this.hitmarkerKill = false;
    this.interactPrompt = null;
  }

  _bindInputs() {
    window.addEventListener('keydown', e => {
      if (e.repeat && (e.code === 'KeyR' || e.code === 'KeyQ' || e.code === 'KeyE' || e.code === 'KeyG' || e.code === 'KeyF' || e.code === 'KeyB')) return;
      this.keys[e.code] = true;

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (this.state === 'playing') this.pauseGame();
        else if (this.state === 'paused' || this.state === 'shop') this.resumeGame();
        return;
      }

      if (this.state === 'shop' && e.code === 'KeyB') {
        this.resumeGame();
        return;
      }

      if (this.state !== 'playing') return;

      // Weapon slots 1-6
      if (e.code.startsWith('Digit')) {
        const idx = parseInt(e.code.slice(5), 10) - 1;
        if (idx >= 0 && idx < WEAPONS.length) this.switchWeapon(WEAPONS[idx].id);
      }
      if (e.code === 'KeyR') this.startReload();
      if (e.code === 'KeyQ') this.activateOverclock();
      if (e.code === 'KeyE') this.activateScan();
      if (e.code === 'KeyG') this.throwGrenade();
      if (e.code === 'KeyF') this.tryInteractOrMelee();
      if (e.code === 'KeyB' && this.mode === 'endless') this.openShop();
      if (e.code === 'KeyC' && this.player.sprinting && this.player.grounded && this.player.slideTimer <= 0) {
        this.startSlide();
      }
    });

    window.addEventListener('keyup', e => {
      this.keys[e.code] = false;
    });

    this.canvas.addEventListener('mousedown', e => {
      this.audio.init();
      if (this.state === 'showcase') {
        this.showcaseDragging = true;
        this.lastMouse = [e.clientX, e.clientY];
        return;
      }
      if (this.state !== 'playing') return;
      this.lastMouse = [e.clientX, e.clientY];
      if (!this.pointerLocked && !this.unlockedAim) {
        this.requestLock();
      }
      this.mouseDown[e.button] = true;
      if (e.button === 0) this._tryFire(true);
    });

    window.addEventListener('mouseup', e => {
      this.mouseDown[e.button] = false;
      this.showcaseDragging = false;
    });

    window.addEventListener('mousemove', e => {
      if (this.state === 'showcase' && this.showcaseDragging) {
        const dx = this.lastMouse ? (e.clientX - this.lastMouse[0]) : e.movementX;
        const dy = this.lastMouse ? (e.clientY - this.lastMouse[1]) : e.movementY;
        this.lastMouse = [e.clientX, e.clientY];
        this.showcaseYaw += dx * 0.008;
        this.showcasePitch = clamp(this.showcasePitch + dy * 0.006, -0.55, 0.75);
        return;
      }
      if (this.state !== 'playing') return;
      if (!this.pointerLocked && !this.unlockedAim) return;

      let mx = 0, my = 0;
      if (this.pointerLocked) {
        mx = e.movementX || 0;
        my = e.movementY || 0;
        this.mouseEdgeTurn = 0;
      } else {
        if (this.lastMouse) {
          mx = clamp(e.clientX - this.lastMouse[0], -80, 80);
          my = clamp(e.clientY - this.lastMouse[1], -80, 80);
        }
        this.lastMouse = [e.clientX, e.clientY];
        // Edge-turn smoothly when cursor nears left/right edge of sandboxed iframe
        const w = Math.max(1, window.innerWidth);
        const nx = e.clientX / w;
        if (nx < 0.14) this.mouseEdgeTurn = (0.14 - nx) / 0.14;
        else if (nx > 0.86) this.mouseEdgeTurn = -((nx - 0.86) / 0.14);
        else this.mouseEdgeTurn = 0;
      }

      const sens = this.settings.sensitivity * (this.adsAmount > 0.5 ? (WEAPON_MAP[this.currentWeaponId].scoped ? 0.35 : 0.65) : 1.0);
      const boost = this.pointerLocked ? 1.0 : 1.55;
      this.player.yaw -= mx * sens * boost;
      const inv = this.settings.invertY ? -1 : 1;
      this.player.pitch = clamp(this.player.pitch - my * sens * boost * inv, -1.42, 1.42);
      this.swayX = clamp(this.swayX - mx * 0.00025, -0.028, 0.028);
      this.swayY = clamp(this.swayY + my * 0.00025, -0.022, 0.022);
    });

    window.addEventListener('mouseleave', () => {
      this.mouseEdgeTurn = 0;
      this.lastMouse = null;
    });

    this.canvas.addEventListener('wheel', e => {
      if (this.state === 'showcase') {
        this.showcaseZoom = clamp(this.showcaseZoom + e.deltaY * 0.001, 0.55, 1.85);
        return;
      }
      if (this.state !== 'playing') return;
      const unlocked = WEAPONS.filter(w => this.inventory[w.id]?.unlocked).map(w => w.id);
      const cur = unlocked.indexOf(this.currentWeaponId);
      if (cur >= 0 && unlocked.length > 1) {
        const next = (cur + (e.deltaY > 0 ? 1 : -1) + unlocked.length) % unlocked.length;
        this.switchWeapon(unlocked[next]);
      }
    }, { passive: true });

    // Touch orbit & 2-finger pinch zoom for 3D Armory Showcase
    this.canvas.addEventListener('touchstart', e => {
      this.audio.init();
      if (this.state !== 'showcase') return;
      e.preventDefault();
      if (e.touches.length === 1) {
        this.showcaseDragging = true;
        this.showcaseLastTouch = [e.touches[0].clientX, e.touches[0].clientY];
      } else if (e.touches.length === 2) {
        this.showcaseDragging = false;
        this.showcasePinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      if (this.state !== 'showcase') return;
      e.preventDefault();
      if (e.touches.length === 1 && this.showcaseDragging && this.showcaseLastTouch) {
        const dx = e.touches[0].clientX - this.showcaseLastTouch[0];
        const dy = e.touches[0].clientY - this.showcaseLastTouch[1];
        this.showcaseLastTouch = [e.touches[0].clientX, e.touches[0].clientY];
        this.showcaseYaw += dx * 0.01;
        this.showcasePitch = clamp(this.showcasePitch + dy * 0.007, -0.55, 0.75);
      } else if (e.touches.length === 2 && this.showcasePinchDist > 0) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this.showcaseZoom = clamp(this.showcaseZoom * (this.showcasePinchDist / Math.max(10, d)), 0.55, 1.85);
        this.showcasePinchDist = d;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => {
      this.showcaseDragging = false;
      this.showcaseLastTouch = null;
      this.showcasePinchDist = 0;
    });

    this.canvas.addEventListener('contextmenu', e => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = (document.pointerLockElement === this.canvas);
      this.ui.onPointerLockChange(this.pointerLocked, this.state);
    });

    document.addEventListener('pointerlockerror', () => {
      if (this.state === 'playing') {
        this.unlockedAim = true;
        this.ui.onPointerLockChange(false, this.state);
      }
    });

    window.addEventListener('resize', () => {
      this.engine.resize(window.innerWidth, window.innerHeight);
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.engine.resize(window.innerWidth, window.innerHeight), 150);
    });
    this.engine.resize(window.innerWidth, window.innerHeight);
  }

  isTouchActive() {
    if (this.settings.touchMode === 'on') return true;
    if (this.settings.touchMode === 'off') return false;
    return this.isTouchDevice;
  }

  applyTouchLook(dx, dy) {
    if (this.state !== 'playing') return;
    const spec = WEAPON_MAP[this.currentWeaponId];
    const sens = this.settings.sensitivity * 1.95 * (this.adsAmount > 0.5 ? (spec.scoped ? 0.35 : 0.62) : 1.0);
    const inv = this.settings.invertY ? -1 : 1;
    this.player.yaw -= dx * sens;
    this.player.pitch = clamp(this.player.pitch - dy * sens * inv, -1.42, 1.42);
    this.swayX = clamp(this.swayX - dx * 0.00025, -0.028, 0.028);
    this.swayY = clamp(this.swayY + dy * 0.00025, -0.022, 0.022);
  }

  _applyTouchAimAssist(dt) {
    if (!this.isTouchActive()) return;
    const p = this.player;
    const eye = [p.pos[0], p.pos[1] + p.eyeH, p.pos[2]];
    const dir = this._getAimDir();
    let bestEn = null;
    let bestDot = 0.986; // ~9.5 degree cone
    let bestVec = null;

    for (const en of this.enemies) {
      if (!en.alive) continue;
      const ty = en.pos[1] + (en.spec.flying ? 0 : en.spec.height * 0.72);
      const vx = en.pos[0] - eye[0], vy = ty - eye[1], vz = en.pos[2] - eye[2];
      const d = Math.hypot(vx, vy, vz);
      if (d > 48 || d < 1.2) continue;
      const dot = (vx * dir[0] + vy * dir[1] + vz * dir[2]) / d;
      if (dot > bestDot) {
        bestDot = dot;
        bestEn = en;
        bestVec = [vx / d, vy / d, vz / d];
      }
    }
    if (bestEn && bestVec) {
      const targetYaw = Math.atan2(-bestVec[0], -bestVec[2]);
      const targetPitch = Math.asin(clamp(bestVec[1], -0.95, 0.95));
      let dyaw = targetYaw - p.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      const pull = (this.touch.firing || this.adsAmount > 0.3) ? 6.5 : 2.2;
      p.yaw += dyaw * Math.min(1, dt * pull);
      p.pitch = clamp(p.pitch + (targetPitch - p.pitch) * Math.min(1, dt * pull), -1.42, 1.42);
    }
  }

  requestLock() {
    if (this.isTouchActive()) return;
    let failed = false;
    try {
      if (this.canvas.requestPointerLock) {
        const p = this.canvas.requestPointerLock();
        if (p && p.catch) {
          p.catch(() => {
            this.unlockedAim = true;
            this.ui.onPointerLockChange(false, this.state);
          });
        }
      } else {
        failed = true;
      }
    } catch {
      failed = true;
    }
    if (failed) {
      this.unlockedAim = true;
      this.ui.onPointerLockChange(false, this.state);
    } else {
      // If inside a sandboxed iframe that silently ignores Pointer Lock, auto-switch to Unlocked Aim!
      setTimeout(() => {
        if (this.state === 'playing' && !this.pointerLocked) {
          this.unlockedAim = true;
          this.ui.onPointerLockChange(false, this.state);
        }
      }, 120);
    }
  }

  exitLock() {
    try {
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    } catch {}
  }

  // --- MENU LIVE 3D BACKDROP ---
  _setupMenuBackdrop() {
    this.level = buildCampaignLevel();
    this.worldRoot = new SceneNode();
    this.worldRoot.add(this.level.root);
    this.fxRoot = new SceneNode();
    this.worldRoot.add(this.fxRoot);
    this._initRain(160);
    // Spawn a couple dramatic silhouette guards on the street for live menu depth
    const g1 = buildEnemyModel('titan');
    g1.root.pos.set([0, 0, -45]);
    this.worldRoot.add(g1.root);
    this.vmRoot.visible = false;
  }

  _initRain(count = 180) {
    this.rainDrops = [];
    const rMat = mat({ color: [0.45, 0.78, 1.0], alpha: 0.24, unlit: true });
    for (let i = 0; i < count; i++) {
      const n = this.fxRoot.addPart({
        mesh: 'box', pos: [rand(-22, 22), rand(0, 18), rand(-22, 22)],
        scale: [0.018, 0.85, 0.018], material: rMat, additive: true, castShadow: false,
      });
      this.rainDrops.push({ node: n, speed: rand(18, 28) });
    }
  }

  // --- 3D ARMORY / CODEX SHOWCASE ---
  openShowcase(tab = 'weapons', itemId = null) {
    this.audio.init();
    this.audio.playUI();
    this.exitLock();
    this.state = 'showcase';
    this.showcaseTab = tab;
    if (itemId) this.showcaseId = itemId;
    else this.showcaseId = tab === 'weapons' ? 'ar' : (tab === 'operators' ? this.selectedOperatorId : 'trooper');
    this.showcaseYaw = 0.55;
    this.showcasePitch = 0.14;
    this.showcaseZoom = 1.0;
    this._rebuildShowcaseScene();
    this.ui.syncScreen('showcase');
  }

  setShowcaseItem(tab, id) {
    this.audio.playUI();
    this.showcaseTab = tab;
    this.showcaseId = id;
    if (tab === 'operators') this.selectedOperatorId = id;
    this.showcaseZoom = 1.0;
    this._rebuildShowcaseScene();
  }

  triggerShowcaseFire() {
    if (this.showcaseTab !== 'weapons' || !this.showcaseBuilt) return;
    this.audio.init();
    this.audio.playShot(this.showcaseId, 1.0);
    this.showcaseFlashTimer = 0.09;
    if (this.showcaseBuilt.muzzleNode) this.showcaseBuilt.muzzleNode.visible = true;
  }

  _rebuildShowcaseScene() {
    this.showcaseRoot = new SceneNode();
    // Sleek cyber-armory pedestal & holo rings
    const pedMat = mat({ color: [0.16, 0.20, 0.26], roughness: 0.32, metallic: 0.85, tex: 'hexArmor' });
    const ringMat = mat({ color: [0.05, 0.92, 1.0], alpha: 0.72, unlit: true });
    const floorMat = mat({ color: [0.22, 0.26, 0.32], roughness: 0.25, metallic: 0.45, tex: 'asphalt', uvScale: [6, 6] });

    this.showcaseRoot.addPart({ mesh: 'box', pos: [0, -0.5, 0], scale: [28, 1, 28], material: floorMat });
    this.showcaseRoot.addPart({ mesh: 'cyl', pos: [0, 0.08, 0], scale: [2.8, 0.16, 2.8], material: pedMat });
    this.showcaseRoot.addPart({ mesh: 'ring', pos: [0, 0.17, 0], rot: [-Math.PI / 2, 0, 0], scale: [3.1, 3.1, 1], material: ringMat, additive: true, castShadow: false });
    this.showcaseRoot.addPart({ mesh: 'ring', pos: [0, 0.19, 0], rot: [-Math.PI / 2, 0, 0], scale: [3.8, 3.8, 1], material: mat({ color: [1.0, 0.62, 0.12], alpha: 0.4, unlit: true }), additive: true, castShadow: false });

    // Background architectural tactical pillars
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      this.showcaseRoot.addPart({ mesh: 'box', pos: [Math.cos(a)*7.5, 3.5, Math.sin(a)*7.5], scale: [0.9, 7.5, 0.9], material: mat({ color: [0.18, 0.22, 0.28], roughness: 0.5, metallic: 0.6, tex: 'concrete' }) });
    }

    const holder = this.showcaseRoot.addPart({ pos: [0, 0.16, 0] });
    this.showcaseNode = holder;

    if (this.showcaseTab === 'weapons') {
      const w = buildWeaponModel(this.showcaseId, false);
      w.root.pos.set([0, 1.08, 0.28]);
      w.root.scale.set([2.15, 2.15, 2.15]);
      w.root.rot.set([0, Math.PI / 2, 0]);
      holder.add(w.root);
      this.showcaseBuilt = w;
    } else if (this.showcaseTab === 'operators') {
      const op = buildOperatorModel(this.showcaseId);
      op.root.scale.set([1.05, 1.05, 1.05]);
      holder.add(op.root);
      this.showcaseBuilt = op;
    } else {
      const en = buildEnemyModel(this.showcaseId);
      const isTitan = this.showcaseId === 'titan';
      const isDrone = this.showcaseId === 'drone';
      const sc = isTitan ? 0.56 : 1.02;
      en.root.scale.set([sc, sc, sc]);
      if (isDrone) en.root.pos.set([0, 1.25, 0]);
      holder.add(en.root);
      this.showcaseBuilt = en;
    }
    this.vmRoot.visible = false;
  }

  returnToMenu() {
    this.audio.playUI();
    this.exitLock();
    this.state = 'menu';
    this.audio.intensity = 0.0;
    this.engine.overclock = 0;
    this.engine.scanStrength = 0;
    this.engine.damageFlash = 0;
    this._setupMenuBackdrop();
    this.ui.syncScreen('menu');
  }

  // --- START CAMPAIGN OR ENDLESS DEPLOYMENT ---
  startGame(mode = 'campaign') {
    this.audio.init();
    this.audio.playUI();
    this.mode = mode;
    this._resetPlayerState();

    this.level = (mode === 'campaign') ? buildCampaignLevel() : buildEndlessArena();
    this.player.pos.set(this.level.playerStart);
    this.player.yaw = this.level.playerStartYaw;
    this.player.pitch = 0;

    this.worldRoot = new SceneNode({ name: 'worldRoot' });
    this.worldRoot.add(this.level.root);
    this.enemyRoot = new SceneNode({ name: 'enemyRoot' });
    this.worldRoot.add(this.enemyRoot);
    this.fxRoot = new SceneNode({ name: 'fxRoot' });
    this.worldRoot.add(this.fxRoot);

    this.enemies = [];
    this.projectiles = [];
    this.vfx = [];
    this.dynLights = [];
    this._initRain(180);

    // Build first-person weapon viewmodel with current Operator's armored hands
    this._rebuildViewmodel();
    this.vmRoot.visible = true;

    if (mode === 'campaign') {
      this._startCampaignStage(1);
    } else {
      this._startNextWave();
    }

    this.state = 'playing';
    this.ui.syncScreen('playing');
    this.requestLock();
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.mouseDown = [false, false, false];
    this.exitLock();
    this.ui.syncScreen('paused');
  }

  resumeGame() {
    if (this.state !== 'paused' && this.state !== 'shop') return;
    this.state = 'playing';
    this.ui.syncScreen('playing');
    this.requestLock();
  }

  openShop() {
    if (this.mode !== 'endless' || this.state !== 'playing') return;
    this.audio.playUI();
    this.state = 'shop';
    this.mouseDown = [false, false, false];
    this.exitLock();
    this.ui.syncScreen('shop');
    this.ui.renderShop();
  }

  _rebuildViewmodel() {
    const op = this.getOperator();
    this.vmRoot = new SceneNode({ name: 'vmRoot', visible: true });
    this.vmWeaponHolder = this.vmRoot.addPart({ name: 'vmWeaponHolder' });
    this.vmBuilt = buildWeaponModel(this.currentWeaponId, true, op.palette);
    this.vmWeaponHolder.add(this.vmBuilt.root);
    this.vmBlade = buildCyberBlade();
    this.vmRoot.add(this.vmBlade);
  }

  // --- WEAPON SWITCHING, FIRING, RELOADING, ABILITIES ---
  switchWeapon(id) {
    if (!this.inventory[id]?.unlocked || id === this.currentWeaponId) return;
    this.currentWeaponId = id;
    this.reloading = false;
    this.reloadTimer = 0;
    this.weaponSwapTimer = 0.24;
    this.audio.playUI();
    this._rebuildViewmodel();
  }

  startReload() {
    const spec = WEAPON_MAP[this.currentWeaponId];
    const inv = this.inventory[this.currentWeaponId];
    if (this.reloading || inv.mag >= spec.magSize || inv.reserve <= 0) return;
    const op = this.getOperator();
    this.reloading = true;
    this.reloadTimer = spec.reloadTime * (op.bonuses.reloadMult || 1.0);
    this.reloadDur = this.reloadTimer;
    this.audio.playReload();
  }

  activateOverclock() {
    if (this.player.overclockCd > 0 || this.player.overclockActive > 0) return;
    const op = this.getOperator();
    this.player.overclockActive = (op.bonuses.overclockDur || 4.2) + this.player.reflexUpgrades * 0.6;
    this.player.overclockCd = Math.max(8, 16 - this.player.reflexUpgrades * 1.5);
    this.audio.playOverclock(true);
    this.engine.chromatic = 0.85;
  }

  activateScan() {
    if (this.player.scanCd > 0) return;
    this.player.scanActive = 5.5;
    this.player.scanCd = 11.0;
    this.engine.scanOrigin.set(this.player.pos);
    this.engine.scanRadius = 0.5;
    this.engine.scanStrength = 1.0;
    this.audio.playScan();
  }

  startSlide() {
    this.player.slideTimer = 0.58;
    const fx = -Math.sin(this.player.yaw);
    const fz = -Math.cos(this.player.yaw);
    this.player.slideDir = [fx, fz];
    this.audio.playStep(true);
  }

  throwGrenade() {
    if (this.player.grenades <= 0) return;
    this.player.grenades--;
    const dir = this._getAimDir();
    const start = [this.player.pos[0], this.player.pos[1] + this.player.eyeH - 0.1, this.player.pos[2]];
    const n = this.fxRoot.addPart({
      mesh: 'sphere', pos: start, scale: [0.22, 0.22, 0.22],
      material: mat({ color: [0.1, 0.95, 1.0], emissive: [0.2, 2.8, 3.4], roughness: 0.2, metallic: 0.4 }),
    });
    this.projectiles.push({
      type: 'grenade', friendly: true, node: n,
      pos: new Float32Array(start),
      vel: new Float32Array([dir[0] * 19, dir[1] * 19 + 4.8, dir[2] * 19]),
      life: 1.55, radius: 7.2,
      damage: Math.round(180 * (this.getOperator().bonuses.blastMult || 1.0)),
    });
    this.audio.playMelee();
  }

  tryInteractOrMelee() {
    // First check nearby interactables (Relay, Armory Pod, Data Cores, Shop Terminal)
    if (this.interactPrompt && this.interactPrompt.active) {
      const it = this.interactPrompt;
      if (it.type === 'shop') {
        this.openShop();
        return;
      }
      if (it.type === 'armory') {
        this._claimArmoryPod(it);
        return;
      }
      if (it.type === 'relay') {
        this._destroyRelay(it);
        return;
      }
      if (it.type === 'datacore') {
        this._sabotageDataCore(it);
        return;
      }
    }

    // Otherwise execute Kinetic Cyber-Blade Melee Slash!
    if (this.player.meleeTimer > 0) return;
    this.player.meleeTimer = 0.34;
    this.audio.playMelee();
    const eye = [this.player.pos[0], this.player.pos[1] + this.player.eyeH, this.player.pos[2]];
    const dir = this._getAimDir();
    for (const en of this.enemies) {
      if (!en.alive) continue;
      const dx = en.pos[0] - eye[0];
      const dy = (en.pos[1] + en.spec.height * 0.5) - eye[1];
      const dz = en.pos[2] - eye[2];
      const d = Math.hypot(dx, dy, dz);
      if (d < 3.4) {
        const dot = (dx * dir[0] + dy * dir[1] + dz * dir[2]) / Math.max(0.01, d);
        if (dot > 0.55) {
          this._damageEnemy(en, 115, false, true, [en.pos[0], en.pos[1] + 1.2, en.pos[2]]);
        }
      }
    }
  }

  _getAimDir(spread = 0) {
    const cp = Math.cos(this.player.pitch);
    const sp = Math.sin(this.player.pitch);
    const cy = Math.cos(this.player.yaw);
    const sy = Math.sin(this.player.yaw);
    let dx = -sy * cp;
    let dy = sp;
    let dz = -cy * cp;
    if (spread > 0) {
      dx += rand(-spread, spread);
      dy += rand(-spread, spread);
      dz += rand(-spread, spread);
      const l = Math.hypot(dx, dy, dz);
      dx /= l; dy /= l; dz /= l;
    }
    return [dx, dy, dz];
  }

  _tryFire(isClick = false) {
    if (this.state !== 'playing' || this.reloading || this.weaponSwapTimer > 0) return;
    const spec = WEAPON_MAP[this.currentWeaponId];
    if (!spec.auto && !isClick) return;
    if (this.fireTimer > 0) return;

    const inv = this.inventory[this.currentWeaponId];
    if (inv.mag <= 0) {
      this.startReload();
      return;
    }

    inv.mag--;
    this.fireTimer = 60 / spec.rpm;
    this.player.shotsFired++;

    const timeScale = this.player.overclockActive > 0 ? 0.38 : 1.0;
    this.audio.playShot(spec.id, timeScale);

    // Visual recoil + muzzle flash + dynamic light
    const adsRecoil = this.adsAmount > 0.5 ? 0.55 : 1.0;
    this.recoilPitch += spec.recoilPitch * adsRecoil;
    this.player.pitch = clamp(this.player.pitch + spec.recoilPitch * adsRecoil * 0.65, -1.42, 1.42);
    this.player.yaw += rand(-spec.recoilYaw, spec.recoilYaw) * adsRecoil;
    this.recoilKick = Math.min(1.0, this.recoilKick + (spec.id === 'shotgun' || spec.id === 'sniper' ? 0.95 : 0.45));
    if (spec.id === 'shotgun') this.pumpAnim = 0.42;
    this.vmMuzzleTimer = 0.055;
    if (this.vmBuilt?.muzzleNode) {
      this.vmBuilt.muzzleNode.visible = true;
      this.vmBuilt.muzzleNode.rot[2] = rand(0, 6.28);
    }

    const eye = [this.player.pos[0], this.player.pos[1] + this.player.eyeH, this.player.pos[2]];
    const fDir = this._getAimDir();
    // Spawn muzzle world light
    this.dynLights.push({
      pos: [eye[0] + fDir[0] * 0.9, eye[1] + fDir[1] * 0.9, eye[2] + fDir[2] * 0.9],
      color: spec.muzzleColor, intensity: 4.5, radius: 11, life: 0.06,
    });

    // Damage multiplier from Operator + Endless Upgrades
    const op = this.getOperator();
    let dmgMult = (op.bonuses.dmgMult || 1.0) * (1 + this.player.damageUpgrades * 0.16);
    if (spec.id === 'shotgun' && op.bonuses.blastMult) dmgMult *= op.bonuses.blastMult;

    const spread = lerp(spec.spreadHip, spec.spreadAds, this.adsAmount);
    const muzzleWorld = [
      eye[0] + fDir[0] * 0.65 + Math.cos(this.player.yaw) * (0.18 * (1 - this.adsAmount)),
      eye[1] + fDir[1] * 0.65 - 0.12 * (1 - this.adsAmount),
      eye[2] + fDir[2] * 0.65 - Math.sin(this.player.yaw) * (0.18 * (1 - this.adsAmount)),
    ];

    let anyHit = false;
    for (let p = 0; p < spec.pellets; p++) {
      const d = this._getAimDir(spread);
      const worldT = this.level.raycastWorld(eye[0], eye[1], eye[2], d[0], d[1], d[2], spec.range);
      let maxT = worldT > 0 ? worldT : spec.range;

      // Also check shootable Campaign objectives (Gate Relay / Data Cores)
      for (const it of this.level.interactables) {
        if (!it.active || (it.type !== 'relay' && it.type !== 'datacore')) continue;
        const ti = raySphere(eye[0], eye[1], eye[2], d[0], d[1], d[2], it.pos[0], it.pos[1], it.pos[2], 1.15, maxT);
        if (ti > 0) {
          maxT = ti;
          it.hp -= spec.damage * dmgMult;
          this._spawnSparks([eye[0] + d[0]*ti, eye[1] + d[1]*ti, eye[2] + d[2]*ti], [0.1, 0.95, 1.0], 7);
          this.hitmarkerTimer = 0.12; this.hitmarkerHead = false; this.hitmarkerKill = false;
          this.audio.playHitmarker(false, false);
          if (it.hp <= 0) {
            if (it.type === 'relay') this._destroyRelay(it);
            else this._sabotageDataCore(it);
          }
        }
      }

      // Check Enemy Hitboxes (Headshot/Core Weakpoint + Torso)
      const hits = [];
      for (const en of this.enemies) {
        if (!en.alive) continue;
        const s = en.spec;
        // 1. Weakpoint sphere (Head / Drone Eye / Titan Head or Chest Fusion Core)
        const headY = en.pos[1] + (s.flying ? 0 : s.headY);
        let th = raySphere(eye[0], eye[1], eye[2], d[0], d[1], d[2], en.pos[0], headY, en.pos[2], s.headR * 1.15, maxT);
        let isCrit = th > 0;
        if (!isCrit && s.coreY) {
          const tc = raySphere(eye[0], eye[1], eye[2], d[0], d[1], d[2], en.pos[0], en.pos[1] + s.coreY, en.pos[2], s.coreR, maxT);
          if (tc > 0) { th = tc; isCrit = true; }
        }
        // 2. Body sphere/capsule approximation
        const bodyY = en.pos[1] + (s.flying ? 0 : s.height * 0.48);
        const tb = raySphere(eye[0], eye[1], eye[2], d[0], d[1], d[2], en.pos[0], bodyY, en.pos[2], s.radius * 1.25, maxT);
        if (isCrit && th > 0) hits.push({ en, t: th, head: true });
        else if (tb > 0) hits.push({ en, t: tb, head: false });
      }
      hits.sort((a, b) => a.t - b.t);

      let endPt = [eye[0] + d[0] * maxT, eye[1] + d[1] * maxT, eye[2] + d[2] * maxT];
      if (hits.length > 0) {
        const hitCount = spec.pierce ? hits.length : 1;
        for (let hi = 0; hi < hitCount; hi++) {
          const h = hits[hi];
          const hitPos = [eye[0] + d[0] * h.t, eye[1] + d[1] * h.t, eye[2] + d[2] * h.t];
          const dmg = spec.damage * dmgMult * (h.head ? spec.headMult : 1.0);
          this._damageEnemy(h.en, dmg, h.head, !!spec.shieldBonus, hitPos);
          anyHit = true;
          if (!spec.pierce) endPt = hitPos;

          // Plasma Carbine EMP Splash!
          if (spec.splash) {
            this._spawnExplosionVisual(hitPos, 1.4, [0.15, 1.0, 0.72]);
            for (const other of this.enemies) {
              if (!other.alive || other === h.en) continue;
              const dd = Math.hypot(other.pos[0] - hitPos[0], other.pos[2] - hitPos[2]);
              if (dd < spec.splash) this._damageEnemy(other, dmg * 0.45, false, true, hitPos);
            }
          }
        }
      } else if (worldT > 0) {
        this._spawnSparks(endPt, spec.tracerColor, 5);
      }

      // Luminous 3D Bullet / Rail Tracer Beam!
      this._spawnTracer(muzzleWorld, endPt, spec.tracerColor, spec.id === 'sniper' ? 0.28 : 0.085, spec.id === 'sniper' ? 0.055 : 0.024);
    }

    if (anyHit) this.player.shotsHit++;
    if (inv.mag === 0 && inv.reserve > 0) this.startReload();
  }

  _damageEnemy(en, dmg, isHead, isEmp, hitPos) {
    const res = en.takeDamage(dmg, isHead, isEmp);
    this.hitmarkerTimer = 0.16;
    this.hitmarkerHead = isHead;
    this.hitmarkerKill = res.killed;
    this.audio.playHitmarker(isHead, res.killed);
    this._spawnSparks(hitPos, isHead ? [1.0, 0.85, 0.15] : (en.shield > 0 ? [0.1, 0.9, 1.0] : [1.0, 0.28, 0.2]), isHead ? 10 : 6);

    if (res.killed) {
      this.enemyRoot.remove(en.node);
      this.player.kills++;
      if (isHead) this.player.headshots++;
      const pts = en.spec.score + (isHead ? 50 : 0);
      const creds = en.spec.credits + (isHead ? 25 : 0);
      this.player.score += pts;
      this.player.credits += creds;

      this._addKillFeed(`${en.spec.name}${isHead ? ' [HEADSHOT]' : ''}`, `+₵${creds}`, isHead);
      if (en.spec.isBoss) {
        this._spawnExplosionVisual([en.pos[0], en.pos[1] + 2.2, en.pos[2]], 5.5, [1.0, 0.35, 0.1]);
        this.audio.playExplosion();
        this.activeBoss = null;
        if (this.mode === 'campaign') this._onCampaignBossDefeated();
      } else {
        this._spawnExplosionVisual([en.pos[0], en.pos[1] + 1.0, en.pos[2]], 1.6, en.spec.flying ? [0.1, 0.9, 1.0] : [1.0, 0.4, 0.12]);
      }
    }
  }

  _damagePlayer(amount, srcPos = null) {
    if (this.state !== 'playing') return;
    this.player.shieldRegenDelay = 3.4;
    this.engine.damageFlash = Math.min(1.0, this.engine.damageFlash + 0.55);
    this.engine.chromatic = Math.min(1.0, this.engine.chromatic + 0.45);
    this.audio.playPlayerHit();

    if (srcPos) {
      const dx = srcPos[0] - this.player.pos[0];
      const dz = srcPos[2] - this.player.pos[2];
      const angToSrc = Math.atan2(dx, dz);
      // Convert to relative angle around player look direction
      this.player.hitDirAngle = angToSrc + this.player.yaw + Math.PI;
      this.player.hitDirTimer = 0.85;
    }

    if (this.player.armor > 0) {
      this.player.armor -= amount;
      if (this.player.armor < 0) {
        this.player.hp += this.player.armor;
        this.player.armor = 0;
      }
    } else {
      this.player.hp -= amount;
    }

    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this._finishMatch(false);
    }
  }

  // --- VFX & DYNAMIC LIGHTS ---
  _spawnTracer(start, end, color, life = 0.08, thickness = 0.025) {
    const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 0.2) return;
    const mid = [(start[0] + end[0]) * 0.5, (start[1] + end[1]) * 0.5, (start[2] + end[2]) * 0.5];
    const yaw = Math.atan2(dx, dz);
    const pitch = -Math.asin(clamp(dy / len, -1, 1));
    const n = this.fxRoot.addPart({
      mesh: 'box', pos: mid, rot: [pitch, yaw, 0], scale: [thickness, thickness, len],
      material: mat({ color: [color[0] * 2.4, color[1] * 2.4, color[2] * 2.4], alpha: 0.9, unlit: true }),
      additive: true, castShadow: false,
    });
    this.vfx.push({ node: n, life, maxLife: life, type: 'fade' });
  }

  _spawnSparks(pos, color, count = 6) {
    const m = mat({ color: [color[0] * 2.5, color[1] * 2.5, color[2] * 2.5], alpha: 0.95, unlit: true });
    for (let i = 0; i < count; i++) {
      const n = this.fxRoot.addPart({
        mesh: 'box', pos: [...pos], scale: [0.06, 0.06, 0.14], material: m, additive: true, castShadow: false,
      });
      this.vfx.push({
        node: n, life: rand(0.22, 0.45), maxLife: 0.45, type: 'spark',
        vel: [rand(-5.5, 5.5), rand(1.5, 6.5), rand(-5.5, 5.5)],
      });
    }
  }

  _spawnExplosionVisual(pos, radius, color) {
    const n = this.fxRoot.addPart({
      mesh: 'sphere', pos: [...pos], scale: [0.5, 0.5, 0.5],
      material: mat({ color: [color[0] * 2.6, color[1] * 2.6, color[2] * 2.6], alpha: 0.85, unlit: true }),
      additive: true, castShadow: false,
    });
    this.vfx.push({ node: n, life: 0.38, maxLife: 0.38, type: 'blast', targetScale: radius * 2.0 });
    this._spawnSparks(pos, color, 14);
    this.dynLights.push({ pos: [...pos], color, intensity: 8.0, radius: radius * 4.5, life: 0.32 });
  }

  // --- COMMS & KILLFEED ---
  queueComms(npcId, text, duration = 4.6) {
    this.commsQueue.push({ npc: COMMS_NPCS[npcId], text, duration });
  }

  _addKillFeed(title, bonus, highlight = false) {
    this.killFeed.unshift({ title, bonus, highlight, life: 3.8 });
    if (this.killFeed.length > 5) this.killFeed.pop();
  }

  // ============================================================================
  // CAMPAIGN MISSION 01: "OPERATION: BLACKOUT PROTOCOL" DIRECTOR
  // ============================================================================
  _spawnEnemy(type, x, y, z, scale = 1.0) {
    const en = new Enemy(type, x, y, z, scale);
    this.enemies.push(en);
    this.enemyRoot.add(en.node);
    if (en.spec.isBoss) this.activeBoss = en;
    return en;
  }

  _startCampaignStage(stage) {
    this.missionStage = stage;
    if (stage === 1) {
      this.objectiveTitle = 'BREACH CHECKPOINT ALPHA';
      this.objectiveSub = 'Eliminate Syndicate patrol & destroy the Gate Security Relay [F or SHOOT]';
      this.objectivePos = [5.5, 2.2, -20.2];
      this.queueComms('oracle', 'Ghost-01, welcome to Neo-Kowloon Sector 04. Militech lockdown is live. Breach Checkpoint Alpha and disable that laser gate.');
      this.queueComms('specter', 'I have overwatch from the north crane. Watch for Hornet drones sweeping the avenue. Weapons free.');
      this._spawnEnemy('trooper', -4.5, 0, -6);
      this._spawnEnemy('trooper',  4.5, 0, -10);
      this._spawnEnemy('trooper',  0.0, 0, -16);
      this._spawnEnemy('drone',   -6.0, 0, -14);
    }
    else if (stage === 2) {
      this.objectiveTitle = 'CLEAR THE NEON PLAZA & SECURE HEAVY ARMS';
      this.objectiveSub = 'Eliminate Plaza hostiles & claim the Orbital Armory Pod [F]';
      this.objectivePos = [0, 2.5, -58.5];
      this.queueComms('oracle', 'Gate is down! Advancing into Corporate Plaza — heads up, thermal signatures on the elevated catwalks and an Aegis Heavy ahead.');
      this.queueComms('specter', 'Dropped a Vanguard Armory Pod at the far end of the square. Grab the Railgun & Plasma Carbine before pushing the Atrium.');
      this._spawnEnemy('sniper', -17.5, 3.55, -44);
      this._spawnEnemy('sniper',  17.5, 3.55, -48);
      this._spawnEnemy('ronin',   -6.0, 0, -38);
      this._spawnEnemy('ronin',    7.0, 0, -42);
      this._spawnEnemy('trooper', -8.0, 0, -52);
      this._spawnEnemy('enforcer', 0.0, 0, -54);
    }
    else if (stage === 3) {
      this.objectiveTitle = 'SABOTAGE UPLINK DATA CORES (0/3)';
      this.objectiveSub = 'Destroy or hack all 3 glowing cyan server conduits in the Atrium';
      this.objectivePos = [0, 2.4, -78];
      this.queueComms('oracle', 'Heavy weapons online! Breach the Server Atrium and overload all three Uplink Cores to blind ARES-IX orbital targeting.');
      this._spawnEnemy('trooper', -8, 0, -72);
      this._spawnEnemy('trooper',  8, 0, -72);
      this._spawnEnemy('drone',   -6, 0, -78);
      this._spawnEnemy('drone',    6, 0, -82);
      this._spawnEnemy('walker',   0, 0, -81);
    }
    else if (stage === 4) {
      this.objectiveTitle = 'ELIMINATE DIRECTOR KAELEN — ARES-IX TITAN';
      this.objectiveSub = 'Target the glowing Chest Fusion Core & Head Visor weakpoints!';
      this.objectivePos = [0, 3.8, -112];
      this.queueComms('kaelen', 'Vanguard vermin! You think destroying three relays stops ARES-IX? I will crush you into the asphalt myself!');
      this.queueComms('oracle', 'MASSIVE THERMAL SPIKE! ARES-IX Titan War-Mech dropping on the helipad! Use the bunkers for missile cover and hit its chest reactor!');
      this._spawnEnemy('titan', 0, 0, -114, 1.0);
      this._spawnEnemy('drone', -10, 0, -108);
      this._spawnEnemy('drone',  10, 0, -108);
      this._spawnEnemy('trooper', -14, 0, -102);
      this._spawnEnemy('trooper',  14, 0, -102);
    }
    else if (stage === 5) {
      this.objectiveTitle = 'REACH ORBITAL EXTRACTION PAD';
      this.objectiveSub = 'Move onto the green Helipad Ring for immediate exfiltration';
      this.objectivePos = [0, 1.5, -109];
      this.queueComms('oracle', 'ARES-IX TITAN IS DOWN! Incredible work, Operator! Extraction bird is descending — get to the center helipad ring NOW!');
    }
  }

  _destroyRelay(it) {
    if (!it.active) return;
    it.active = false;
    it.coreNode.visible = false;
    this._spawnExplosionVisual(it.pos, 2.2, [1.0, 0.35, 0.15]);
    this.audio.playExplosion();
    if (this.level.gateBlocker) this.level.gateBlocker.active = false;
    if (this.level.gateNode) this.level.gateNode.visible = false;
    this._addKillFeed('GATE SECURITY RELAY DISABLED', 'PATH OPEN', true);
    if (this.missionStage === 1) this._startCampaignStage(2);
  }

  _claimArmoryPod(it) {
    if (!it.active) return;
    it.active = false;
    it.coreNode.material = mat({ color: [0.1, 1.0, 0.55], emissive: [0.2, 2.2, 1.0] });
    // Unlock Sniper & Plasma Carbine + refill all ammo, armor & grenades!
    this.inventory.sniper.unlocked = true;
    this.inventory.plasma.unlocked = true;
    for (const w of WEAPONS) {
      this.inventory[w.id].mag = w.magSize;
      this.inventory[w.id].reserve = w.reserveMax;
    }
    this.player.armor = this.player.maxArmor;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 45);
    this.player.grenades = this.player.maxGrenades;
    this.audio.playOverclock(false);
    this._addKillFeed('UNLOCKED RA-77 RAILGUN & PL-4 PLASMA', 'FULL RESUPPLY', true);
    if (this.missionStage === 2) this._startCampaignStage(3);
  }

  _sabotageDataCore(it) {
    if (!it.active) return;
    it.active = false;
    it.coreNode.visible = false;
    this.coresRemaining--;
    this._spawnExplosionVisual(it.pos, 2.4, [0.1, 0.92, 1.0]);
    this.audio.playExplosion();
    const done = 3 - this.coresRemaining;
    this.objectiveTitle = `SABOTAGE UPLINK DATA CORES (${done}/3)`;
    this._addKillFeed(`UPLINK CORE ${done}/3 DESTROYED`, '+250 PTS', true);
    this.player.score += 250;

    // Reinforce on 2nd core
    if (this.coresRemaining === 1) {
      this._spawnEnemy('ronin', -8, 0, -86);
      this._spawnEnemy('ronin',  8, 0, -86);
    }
    if (this.coresRemaining <= 0 && this.missionStage === 3) {
      this._startCampaignStage(4);
    }
  }

  _onCampaignBossDefeated() {
    this._startCampaignStage(5);
  }

  // ============================================================================
  // ENDLESS MODE: "PROTOCOL: INFINITE SIEGE" WAVE DIRECTOR & REQUISITION SHOP
  // ============================================================================
  _startNextWave() {
    this.wave++;
    this.waveIntermission = 0;
    const w = this.wave;
    const isBossWave = (w % 5 === 0);

    // Build wave spawn queue
    this.waveQueue = [];
    const total = 5 + Math.floor(w * 2.4);
    for (let i = 0; i < total; i++) {
      const r = Math.random();
      if (w >= 4 && r < 0.14) this.waveQueue.push('walker');
      else if (w >= 3 && r < 0.28) this.waveQueue.push('enforcer');
      else if (w >= 3 && r < 0.44) this.waveQueue.push('sniper');
      else if (w >= 2 && r < 0.64) this.waveQueue.push('ronin');
      else if (r < 0.80) this.waveQueue.push('drone');
      else this.waveQueue.push('trooper');
    }
    if (isBossWave) this.waveQueue.push('titan');

    this.waveSpawnTimer = 0.6;
    this.objectiveTitle = isBossWave ? `WAVE ${w} — HVT BOSS INBOUND` : `ENDLESS SIEGE — WAVE ${w}`;
    this.objectiveSub = isBossWave
      ? 'ARES-IX TITAN deployed! Defeat all hostiles. Press [B] for Requisition Armory.'
      : 'Eliminate all incoming Syndicate waves. Press [B] anytime for Upgrades & Weapons.';
    this.objectivePos = null;

    if (w === 1) {
      this.queueComms('oracle', 'Welcome to The Foundry, Operator. Endless Siege protocol engaged. Earn Credits from kills and press [B] for weapons & cyberware upgrades.');
    } else if (isBossWave) {
      this.queueComms('kaelen', `Wave ${w} — deploying ARES-IX Heavy Command Unit! Let us see how long you survive.`);
    } else {
      this._addKillFeed(`WAVE ${w} COMMENCING`, `${this.waveQueue.length} HOSTILES`, true);
    }
  }

  buyShopItem(action, id = null) {
    this.audio.init();
    if (action === 'weapon') {
      const w = WEAPON_MAP[id];
      if (!w) return false;
      const inv = this.inventory[id];
      if (!inv.unlocked) {
        if (this.player.credits < w.cost) return false;
        this.player.credits -= w.cost;
        inv.unlocked = true;
        inv.mag = w.magSize;
        inv.reserve = w.reserveMax;
        this.switchWeapon(id);
        this.audio.playOverclock(false);
        return true;
      } else {
        // Ammo refill for ₵120
        if (this.player.credits < 120) return false;
        this.player.credits -= 120;
        inv.mag = w.magSize;
        inv.reserve = w.reserveMax;
        this.audio.playReload();
        return true;
      }
    }
    if (action === 'ammo_all') {
      if (this.player.credits < 200) return false;
      this.player.credits -= 200;
      for (const w of WEAPONS) {
        if (this.inventory[w.id].unlocked) {
          this.inventory[w.id].mag = w.magSize;
          this.inventory[w.id].reserve = w.reserveMax;
        }
      }
      this.player.grenades = this.player.maxGrenades;
      this.audio.playReload();
      return true;
    }
    if (action === 'medkit') {
      if (this.player.credits < 180) return false;
      this.player.credits -= 180;
      this.player.hp = this.player.maxHp;
      this.player.armor = this.player.maxArmor;
      this.audio.playOverclock(false);
      return true;
    }
    if (action === 'upg_dmg') {
      const cost = 350 + this.player.damageUpgrades * 250;
      if (this.player.credits < cost || this.player.damageUpgrades >= 5) return false;
      this.player.credits -= cost;
      this.player.damageUpgrades++;
      this.audio.playOverclock(false);
      return true;
    }
    if (action === 'upg_armor') {
      const cost = 300 + this.player.armorUpgrades * 220;
      if (this.player.credits < cost || this.player.armorUpgrades >= 5) return false;
      this.player.credits -= cost;
      this.player.armorUpgrades++;
      this.player.maxArmor += 25;
      this.player.armor = this.player.maxArmor;
      this.audio.playOverclock(false);
      return true;
    }
    if (action === 'upg_reflex') {
      const cost = 320 + this.player.reflexUpgrades * 240;
      if (this.player.credits < cost || this.player.reflexUpgrades >= 5) return false;
      this.player.credits -= cost;
      this.player.reflexUpgrades++;
      this.audio.playOverclock(false);
      return true;
    }
    return false;
  }

  _finishMatch(victory) {
    this.state = 'debrief';
    this.mouseDown = [false, false, false];
    this.exitLock();
    this.audio.intensity = 0.0;

    if (this.mode === 'campaign' && victory) this.records.campaignCleared = true;
    if (this.mode === 'endless') {
      if (this.wave > this.records.bestWave) this.records.bestWave = this.wave;
    }
    if (this.player.score > this.records.bestScore) this.records.bestScore = this.player.score;
    this._saveRecords();

    const acc = this.player.shotsFired > 0 ? Math.round((this.player.shotsHit / this.player.shotsFired) * 100) : 0;
    const rank = victory ? (acc >= 45 && this.player.headshots >= 6 ? 'S' : 'A') : (this.wave >= 5 || this.player.kills >= 20 ? 'B' : 'C');
    this.ui.showDebrief({
      victory,
      mode: this.mode,
      rank,
      score: this.player.score,
      kills: this.player.kills,
      headshots: this.player.headshots,
      accuracy: acc,
      time: this.missionTime,
      wave: this.wave,
      records: this.records,
    });
  }

  // ============================================================================
  // MAIN SIMULATION & RENDER LOOP
  // ============================================================================
  _loop(now) {
    const rawDt = Math.min(0.05, Math.max(0.001, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.time += rawDt;

    if (this.state === 'menu') {
      this._updateRain(rawDt, [0, 4, -8]);
      const angle = this.time * 0.14;
      const camPos = [Math.sin(angle) * 10.5, 4.2 + Math.sin(this.time * 0.35) * 0.7, -8 + Math.cos(angle) * 11.5];
      const view = M4.create();
      M4.lookAt(view, camPos, [0, 2.2, -32], [0, 1, 0]);
      this.engine.lights = this.level.staticLights.slice(0, 16);
      this.engine.vmMuzzleLight = null;
      this.engine.renderFrame(this.worldRoot, null, camPos, view, 66 * DEG2RAD, this.time, [0, 0, -25]);
    }
    else if (this.state === 'showcase') {
      this._renderShowcase(rawDt);
    }
    else if (this.state === 'playing') {
      this._updatePlaying(rawDt);
      this._renderPlaying();
    }
    else if (this.state === 'paused' || this.state === 'shop' || this.state === 'debrief') {
      // Keep rendering the crisp frozen world behind tactical overlays
      this._renderPlaying();
    }

    requestAnimationFrame(this._loop);
  }

  _renderShowcase(dt) {
    if (!this.showcaseDragging) this.showcaseYaw += dt * 0.38;
    if (this.showcaseNode) {
      this.showcaseNode.rot[1] = this.showcaseYaw;
      if (this.showcaseTab === 'weapons') {
        this.showcaseNode.pos[1] = 0.16 + Math.sin(this.time * 2.2) * 0.05;
      } else {
        this.showcaseNode.pos[1] = 0.16;
      }
    }
    if (this.showcaseFlashTimer > 0) {
      this.showcaseFlashTimer -= dt;
      if (this.showcaseFlashTimer <= 0 && this.showcaseBuilt?.muzzleNode) {
        this.showcaseBuilt.muzzleNode.visible = false;
      }
    }
    // Subtle idle rotation on drone rotors / gun barrels inside showcase
    if (this.showcaseTab === 'enemies' && this.showcaseBuilt?.anim) {
      const a = this.showcaseBuilt.anim;
      if (a.gunBarrel) a.gunBarrel.rot[2] += dt * 4.0;
      for (const r of a.rotors) r.rot[1] += dt * 22;
    }

    const baseDist = this.showcaseTab === 'weapons'
      ? (this.showcaseId === 'sniper' ? 3.85 : 3.25)
      : (this.showcaseId === 'titan' ? 4.35 : 3.85);
    const dist = baseDist * this.showcaseZoom;
    const targetY = this.showcaseTab === 'weapons' ? 1.24 : 1.18;
    const camPos = [
      Math.sin(0) * dist,
      targetY + Math.sin(this.showcasePitch) * dist,
      Math.cos(this.showcasePitch) * dist,
    ];
    const view = M4.create();
    M4.lookAt(view, camPos, [0, targetY, 0], [0, 1, 0]);

    // Dramatic 3-point cyber studio lighting!
    this.engine.lights = [
      { pos: [2.8, 3.2, 3.2], color: [0.95, 0.98, 1.0], intensity: 5.5, radius: 18 },
      { pos: [-3.4, 2.4, -2.2], color: [0.05, 0.90, 1.0], intensity: 6.0, radius: 18 },
      { pos: [2.8, 1.4, -3.2], color: [1.0, 0.56, 0.12], intensity: 5.0, radius: 16 },
    ];
    if (this.showcaseFlashTimer > 0) {
      this.engine.lights.push({ pos: [0, 1.3, 1.4], color: [1.0, 0.72, 0.25], intensity: 10.0, radius: 12 });
    }
    this.engine.vmMuzzleLight = null;
    this.engine.fogDensity = 0.012;
    this.engine.renderFrame(this.showcaseRoot, null, camPos, view, 48 * DEG2RAD, this.time, [0, 1, 0]);
  }

  _updatePlaying(rawDt) {
    this.missionTime += rawDt;
    const p = this.player;
    const op = this.getOperator();

    // Overclock Time-Dilation (world slows to 0.34x while player stays crisp!)
    let worldDt = rawDt;
    if (p.overclockActive > 0) {
      p.overclockActive = Math.max(0, p.overclockActive - rawDt);
      worldDt = rawDt * 0.34;
      this.engine.overclock = damp(this.engine.overclock, 1.0, 10, rawDt);
      if (p.overclockActive <= 0) this.audio.playOverclock(false);
    } else {
      this.engine.overclock = damp(this.engine.overclock, 0.0, 8, rawDt);
    }
    if (p.overclockCd > 0) p.overclockCd = Math.max(0, p.overclockCd - rawDt);

    // Optic Scan Pulse Wave
    if (p.scanActive > 0) {
      p.scanActive = Math.max(0, p.scanActive - rawDt);
      this.engine.scanRadius += rawDt * 34;
      this.engine.scanStrength = clamp(p.scanActive / 1.2, 0, 1);
    } else {
      this.engine.scanStrength = 0;
    }
    if (p.scanCd > 0) p.scanCd = Math.max(0, p.scanCd - rawDt);

    // Decay post FX & HUD feedback
    this.engine.damageFlash = damp(this.engine.damageFlash, 0, 4.5, rawDt);
    this.engine.chromatic = damp(this.engine.chromatic, p.overclockActive > 0 ? 0.35 : 0, 6.0, rawDt);
    if (this.hitmarkerTimer > 0) this.hitmarkerTimer -= rawDt;
    if (p.hitDirTimer > 0) p.hitDirTimer -= rawDt;

    // Subdermal Armor Recharge
    if (p.shieldRegenDelay > 0) p.shieldRegenDelay -= rawDt;
    else if (p.armor < p.maxArmor) {
      const rate = 16 * (op.bonuses.shieldRegenMult || 1.0);
      p.armor = Math.min(p.maxArmor, p.armor + rate * rawDt);
    }

    // --- PLAYER MOVEMENT PHYSICS (Desktop Keyboard + Mobile Dual-Thumb Joystick) ---
    const kbForward = (this.keys['KeyW'] ? 1 : 0) - (this.keys['KeyS'] ? 1 : 0);
    const kbStrafe  = (this.keys['KeyD'] ? 1 : 0) - (this.keys['KeyA'] ? 1 : 0);
    // Arrow keys smoothly turn camera (handy inside preview iframes without pointer lock!)
    const turnYaw = (this.keys['ArrowLeft'] ? 1 : 0) - (this.keys['ArrowRight'] ? 1 : 0);
    const turnPitch = (this.keys['ArrowUp'] ? 1 : 0) - (this.keys['ArrowDown'] ? 1 : 0);
    if (turnYaw !== 0) p.yaw += turnYaw * 2.1 * rawDt;
    if (turnPitch !== 0) p.pitch = clamp(p.pitch + turnPitch * 1.5 * rawDt, -1.42, 1.42);
    if (this.unlockedAim && !this.pointerLocked && this.mouseEdgeTurn) {
      p.yaw += this.mouseEdgeTurn * 2.2 * rawDt;
    }
    const forward = clamp(kbForward + this.touch.moveY, -1, 1);
    const strafe  = clamp(kbStrafe + this.touch.moveX, -1, 1);
    p.crouching = !!this.keys['KeyC'] || this.touch.crouchToggle || p.slideTimer > 0;
    p.sprinting = (!!this.keys['ShiftLeft'] || this.touch.sprint) && forward > 0.35 && !p.crouching && this.adsAmount < 0.2;

    const baseSpeed = 7.4 * (op.bonuses.speedMult || 1.0) * (1 + p.reflexUpgrades * 0.06) * (p.overclockActive > 0 ? 1.25 : 1.0);
    let moveSpeed = baseSpeed;
    if (p.sprinting) moveSpeed *= 1.46;
    else if (p.crouching) moveSpeed *= 0.56;
    else if (this.adsAmount > 0.3) moveSpeed *= 0.68;

    let moveX = 0, moveZ = 0;
    if (p.slideTimer > 0) {
      p.slideTimer -= rawDt;
      const slideSpd = 14.5 * (p.slideTimer / 0.58 + 0.35);
      moveX = p.slideDir[0] * slideSpd;
      moveZ = p.slideDir[1] * slideSpd;
    } else if (Math.abs(forward) > 0.04 || Math.abs(strafe) > 0.04) {
      const len = Math.max(1, Math.hypot(forward, strafe));
      const nf = forward / len, ns = strafe / len;
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      const rx =  Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      moveX = (fx * nf + rx * ns) * moveSpeed;
      moveZ = (fz * nf + rz * ns) * moveSpeed;
    }

    // Jump & Gravity
    if ((this.keys['Space'] || this.touch.jumpQueued) && p.grounded) {
      p.vel[1] = 8.4;
      p.grounded = false;
      this.touch.crouchToggle = false;
    }
    this.touch.jumpQueued = false;
    p.vel[1] -= 23.5 * rawDt;

    const moved = this.level.moveCircle(p.pos[0], p.pos[1], p.pos[2], moveX * rawDt, moveZ * rawDt, 0.48, p.crouching ? 1.15 : 1.78);
    p.pos[0] = moved.x;
    p.pos[2] = moved.z;
    p.pos[1] += p.vel[1] * rawDt;

    if (p.pos[1] <= moved.y) {
      p.pos[1] = moved.y;
      p.vel[1] = 0;
      p.grounded = true;
    } else {
      p.grounded = false;
    }

    const targetEye = p.crouching ? 1.02 : 1.66;
    p.eyeH = damp(p.eyeH, targetEye, 14, rawDt);

    // Subtle magnetic aim assist for mobile touch players
    this._applyTouchAimAssist(rawDt);

    // Footstep cadence & view bob
    const horizSpd = Math.hypot(moveX, moveZ);
    if (p.grounded && horizSpd > 1.2 && p.slideTimer <= 0) {
      p.bobPhase += rawDt * (p.sprinting ? 12.5 : 8.5);
      p.stepTimer -= rawDt;
      if (p.stepTimer <= 0) {
        p.stepTimer = p.sprinting ? 0.30 : 0.44;
        this.audio.playStep(p.sprinting);
      }
    }

    // --- WEAPON TIMERS & ANIMATION ---
    if (this.fireTimer > 0) this.fireTimer -= rawDt;
    if (this.weaponSwapTimer > 0) this.weaponSwapTimer = Math.max(0, this.weaponSwapTimer - rawDt);
    if (this.pumpAnim > 0) this.pumpAnim = Math.max(0, this.pumpAnim - rawDt);
    if (p.meleeTimer > 0) p.meleeTimer = Math.max(0, p.meleeTimer - rawDt);

    if (this.reloading) {
      this.reloadTimer -= rawDt;
      if (this.reloadTimer <= 0) {
        const spec = WEAPON_MAP[this.currentWeaponId];
        const inv = this.inventory[this.currentWeaponId];
        const need = spec.magSize - inv.mag;
        const take = Math.min(need, inv.reserve);
        inv.mag += take;
        inv.reserve -= take;
        this.reloading = false;
      }
    }

    // Hold LMB or Touch FIRE button for automatic fire
    if (this.mouseDown[0] || this.touch.firing) this._tryFire(false);

    // ADS interpolation (Desktop RMB or Mobile ADS toggle)
    if (this.reloading || p.sprinting) this.touch.adsToggle = false;
    const wantAds = (this.mouseDown[2] || this.touch.adsToggle) && !this.reloading && !p.sprinting && this.weaponSwapTimer <= 0;
    this.adsAmount = damp(this.adsAmount, wantAds ? 1 : 0, 14, rawDt);
    this.recoilKick = damp(this.recoilKick, 0, 14, rawDt);
    this.recoilPitch = damp(this.recoilPitch, 0, 10, rawDt);
    this.swayX = damp(this.swayX, 0, 10, rawDt);
    this.swayY = damp(this.swayY, 0, 10, rawDt);

    if (this.vmMuzzleTimer > 0) {
      this.vmMuzzleTimer -= rawDt;
      const spec = WEAPON_MAP[this.currentWeaponId];
      this.engine.vmMuzzleLight = [spec.muzzleColor[0], spec.muzzleColor[1], spec.muzzleColor[2], 6.5 * (this.vmMuzzleTimer / 0.055)];
      if (this.vmMuzzleTimer <= 0 && this.vmBuilt?.muzzleNode) {
        this.vmBuilt.muzzleNode.visible = false;
        this.engine.vmMuzzleLight = null;
      }
    }

    this._updateViewmodelTransform();

    // --- CHECK NEARBY INTERACTABLES ---
    this.interactPrompt = null;
    for (const it of this.level.interactables) {
      if (!it.active) continue;
      if (it.coreNode) it.coreNode.rot[1] += rawDt * 1.8;
      const d = Math.hypot(it.pos[0] - p.pos[0], it.pos[2] - p.pos[2]);
      if (d <= it.radius) this.interactPrompt = it;
    }

    // --- UPDATE ENEMIES & AI ---
    const eyePos = [p.pos[0], p.pos[1] + p.eyeH, p.pos[2]];
    let aliveCount = 0;
    const aiCallbacks = {
      onEnemyMelee: (en, dmg) => {
        this._damagePlayer(dmg, en.pos);
        this.audio.playMelee();
      },
      onSniperLaser: (en, from, to) => {
        this._spawnTracer(from, [to[0], to[1] - 0.15, to[2]], [1.0, 0.12, 0.18], 0.05, 0.014);
      },
      onEnemyShoot: (en, from, to, dmg, type) => {
        this.audio.playEnemyShot(type === 'enforcer' || type === 'walker' || type === 'titan');
        const spread = type === 'sniper' ? 0.025 : (type === 'enforcer' ? 0.09 : 0.065);
        const dx = (to[0] - from[0]) + rand(-spread, spread) * 8;
        const dy = (to[1] - 0.12 - from[1]) + rand(-spread, spread) * 5;
        const dz = (to[2] - from[2]) + rand(-spread, spread) * 8;
        const len = Math.hypot(dx, dy, dz) || 1;
        const spd = type === 'sniper' ? 95 : (type === 'titan' ? 42 : 34);
        const col = type === 'drone' ? [0.1, 0.9, 1.0] : (type === 'sniper' ? [0.15, 1.0, 0.72] : [1.0, 0.35, 0.12]);
        const n = this.fxRoot.addPart({
          mesh: 'box', pos: [...from], scale: [0.09, 0.09, 0.75],
          rot: [-Math.asin(clamp(dy / len, -1, 1)), Math.atan2(dx, dz), 0],
          material: mat({ color: [col[0]*2.6, col[1]*2.6, col[2]*2.6], alpha: 0.95, unlit: true }),
          additive: true, castShadow: false,
        });
        this.projectiles.push({
          type: 'bolt', friendly: false, node: n,
          pos: new Float32Array(from), vel: new Float32Array([dx/len*spd, dy/len*spd, dz/len*spd]),
          life: 2.4, damage: dmg, srcPos: [...en.pos],
        });
      },
      onBossMissile: (en, from, to) => {
        this.audio.playShot('sniper', 0.75);
        for (const side of [-1, 1]) {
          const start = [from[0] + side * 1.1, from[1], from[2]];
          const dx = to[0] - start[0] + rand(-1.8, 1.8);
          const dy = (to[1] - 0.5) - start[1];
          const dz = to[2] - start[2] + rand(-1.8, 1.8);
          const len = Math.hypot(dx, dy, dz) || 1;
          const n = this.fxRoot.addPart({
            mesh: 'sphere', pos: start, scale: [0.34, 0.34, 0.34],
            material: mat({ color: [3.0, 0.35, 0.15], alpha: 0.95, unlit: true }),
            additive: true, castShadow: false,
          });
          this.projectiles.push({
            type: 'missile', friendly: false, node: n,
            pos: new Float32Array(start), vel: new Float32Array([dx/len*24, dy/len*24 + 2.2, dz/len*24]),
            life: 3.2, damage: 28, radius: 4.5, srcPos: [...en.pos],
          });
        }
      },
    };

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (!en.alive) { this.enemies.splice(i, 1); continue; }
      aliveCount++;
      en.update(worldDt, eyePos, this.level, aiCallbacks);
    }

    // Dynamic combat music intensity!
    const targetIntensity = this.activeBoss ? 1.0 : (aliveCount > 0 ? clamp(0.35 + aliveCount * 0.1, 0, 0.85) : 0.12);
    this.audio.intensity = damp(this.audio.intensity, targetIntensity, 2.5, rawDt);

    // --- UPDATE PROJECTILES ---
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= worldDt;
      if (pr.type === 'grenade') {
        pr.vel[1] -= 18.0 * worldDt;
        const nx = pr.pos[0] + pr.vel[0] * worldDt;
        const ny = pr.pos[1] + pr.vel[1] * worldDt;
        const nz = pr.pos[2] + pr.vel[2] * worldDt;
        const fl = this.level.getFloorHeight(nx, nz, pr.pos[1]);
        if (ny < fl + 0.15) {
          pr.pos[1] = fl + 0.15;
          pr.vel[1] = -pr.vel[1] * 0.42;
          pr.vel[0] *= 0.72; pr.vel[2] *= 0.72;
        } else {
          pr.pos[0] = nx; pr.pos[1] = ny; pr.pos[2] = nz;
        }
        pr.node.pos.set(pr.pos);
        if (pr.life <= 0) {
          this._detonateGrenade(pr);
          this.fxRoot.remove(pr.node);
          this.projectiles.splice(i, 1);
        }
      } else {
        // Enemy plasma bolts & Boss missiles
        if (pr.type === 'missile') pr.vel[1] -= 3.2 * worldDt;
        const step = Math.hypot(pr.vel[0], pr.vel[1], pr.vel[2]) * worldDt;
        const dirL = Math.hypot(pr.vel[0], pr.vel[1], pr.vel[2]) || 1;
        const hitW = this.level.raycastWorld(pr.pos[0], pr.pos[1], pr.pos[2], pr.vel[0]/dirL, pr.vel[1]/dirL, pr.vel[2]/dirL, step + 0.25);
        pr.pos[0] += pr.vel[0] * worldDt;
        pr.pos[1] += pr.vel[1] * worldDt;
        pr.pos[2] += pr.vel[2] * worldDt;
        pr.node.pos.set(pr.pos);

        const dPlayer = Math.hypot(pr.pos[0] - p.pos[0], pr.pos[1] - (p.pos[1] + 1.0), pr.pos[2] - p.pos[2]);
        if (dPlayer < (pr.type === 'missile' ? 1.4 : 0.78)) {
          this._damagePlayer(pr.damage, pr.srcPos);
          if (pr.type === 'missile') { this._spawnExplosionVisual(pr.pos, 2.8, [1.0, 0.35, 0.1]); this.audio.playExplosion(); }
          this.fxRoot.remove(pr.node);
          this.projectiles.splice(i, 1);
          continue;
        }
        if (hitW >= 0 || pr.life <= 0) {
          if (pr.type === 'missile') {
            this._spawnExplosionVisual(pr.pos, 3.0, [1.0, 0.35, 0.1]);
            this.audio.playExplosion();
            if (dPlayer < pr.radius) this._damagePlayer(pr.damage * (1 - dPlayer / pr.radius), pr.srcPos);
          } else {
            this._spawnSparks(pr.pos, [1.0, 0.4, 0.15], 3);
          }
          this.fxRoot.remove(pr.node);
          this.projectiles.splice(i, 1);
        }
      }
    }

    // --- UPDATE VFX, RAIN & DYNAMIC LIGHTS ---
    for (let i = this.vfx.length - 1; i >= 0; i--) {
      const v = this.vfx[i];
      v.life -= worldDt;
      if (v.life <= 0) {
        this.fxRoot.remove(v.node);
        this.vfx.splice(i, 1);
        continue;
      }
      const t = v.life / v.maxLife;
      if (v.type === 'fade') {
        v.node.material.alpha = t * 0.9;
      } else if (v.type === 'spark') {
        v.vel[1] -= 14 * worldDt;
        v.node.pos[0] += v.vel[0] * worldDt;
        v.node.pos[1] += v.vel[1] * worldDt;
        v.node.pos[2] += v.vel[2] * worldDt;
        v.node.material.alpha = t;
      } else if (v.type === 'blast') {
        const s = lerp(v.targetScale, 0.4, t);
        v.node.scale.set([s, s, s]);
        v.node.material.alpha = t * 0.85;
      }
    }

    for (let i = this.dynLights.length - 1; i >= 0; i--) {
      this.dynLights[i].life -= rawDt;
      if (this.dynLights[i].life <= 0) this.dynLights.splice(i, 1);
    }

    this._updateRain(worldDt, p.pos);

    // --- CAMPAIGN / ENDLESS PROGRESSION CHECKS ---
    if (this.mode === 'campaign') {
      // Stage 5 Extraction check
      if (this.missionStage === 5) {
        const dEx = Math.hypot(p.pos[0] - 0, p.pos[2] - (-109));
        if (dEx < 5.5) this._finishMatch(true);
      }
    } else {
      // Endless Wave spawning & intermission
      if (this.waveQueue.length > 0) {
        this.waveSpawnTimer -= worldDt;
        if (this.waveSpawnTimer <= 0 && aliveCount < 11) {
          const type = this.waveQueue.shift();
          const sp = this.level.spawnPoints[Math.floor(Math.random() * this.level.spawnPoints.length)];
          const scale = 1.0 + (this.wave - 1) * 0.11;
          this._spawnEnemy(type, sp[0] + rand(-1.5, 1.5), sp[1], sp[2] + rand(-1.5, 1.5), scale);
          this.waveSpawnTimer = Math.max(0.7, 2.2 - this.wave * 0.08);
        }
      } else if (aliveCount === 0) {
        if (this.waveIntermission <= 0) {
          this.waveIntermission = 7.5;
          const bonus = 150 + this.wave * 60;
          p.credits += bonus;
          p.score += 300 * this.wave;
          this._addKillFeed(`WAVE ${this.wave} CLEARED`, `+₵${bonus} CREDITS`, true);
          this.objectiveTitle = `WAVE ${this.wave} CLEARED — REGROUP`;
          this.objectiveSub = `Next wave in ${Math.ceil(this.waveIntermission)}s — Press [B] for Requisition Armory!`;
        } else {
          this.waveIntermission -= rawDt;
          this.objectiveSub = `Next wave in ${Math.max(1, Math.ceil(this.waveIntermission))}s — Press [B] for Requisition Armory!`;
          if (this.waveIntermission <= 0) this._startNextWave();
        }
      }
    }

    // --- COMMS QUEUE & KILLFEED DECAY ---
    if (this.activeComms) {
      this.activeComms.timer -= rawDt;
      if (this.activeComms.timer <= 0) this.activeComms = null;
    }
    if (!this.activeComms && this.commsQueue.length > 0) {
      const next = this.commsQueue.shift();
      this.activeComms = { ...next, timer: next.duration };
      this.audio.playRadioBeep();
    }
    for (let i = this.killFeed.length - 1; i >= 0; i--) {
      this.killFeed[i].life -= rawDt;
      if (this.killFeed[i].life <= 0) this.killFeed.splice(i, 1);
    }

    // Update HUD smoothly
    this.ui.updateHUD(this);
  }

  _detonateGrenade(pr) {
    this._spawnExplosionVisual(pr.pos, pr.radius * 0.55, [0.1, 0.92, 1.0]);
    this.audio.playExplosion();
    this.engine.chromatic = 0.6;
    for (const en of this.enemies) {
      if (!en.alive) continue;
      const d = Math.hypot(en.pos[0] - pr.pos[0], en.pos[2] - pr.pos[2]);
      if (d < pr.radius) {
        const falloff = 1.0 - (d / pr.radius) * 0.65;
        this._damageEnemy(en, pr.damage * falloff, false, true, [en.pos[0], en.pos[1] + 1.1, en.pos[2]]);
      }
    }
  }

  _updateRain(dt, center) {
    for (let i = 0; i < this.rainDrops.length; i++) {
      const d = this.rainDrops[i];
      d.node.pos[1] -= d.speed * dt;
      if (d.node.pos[1] < -0.5) {
        d.node.pos[0] = center[0] + rand(-22, 22);
        d.node.pos[1] = center[1] + rand(12, 20);
        d.node.pos[2] = center[2] + rand(-22, 22);
      }
    }
  }

  _updateViewmodelTransform() {
    if (!this.vmBuilt) return;
    const spec = WEAPON_MAP[this.currentWeaponId];
    const p = this.player;

    // Hide viewmodel when fully scoped in Railgun Sniper digital scope!
    const scopedHide = !!(spec.scoped && this.adsAmount > 0.82);
    this.vmWeaponHolder.visible = !scopedHide && p.meleeTimer <= 0;

    // Cyber-blade melee animation
    if (p.meleeTimer > 0) {
      this.vmBlade.visible = true;
      const t = 1 - (p.meleeTimer / 0.34);
      this.vmBlade.pos.set([lerp(0.35, -0.45, t), lerp(-0.18, -0.05, Math.sin(t * Math.PI)), -0.45]);
      this.vmBlade.rot.set([0.2, lerp(-0.8, 1.4, t), lerp(-0.4, 0.9, t)]);
    } else {
      this.vmBlade.visible = false;
    }

    const bobAmp = p.grounded && !p.crouching ? (1 - this.adsAmount * 0.85) : 0.2;
    const bobX = Math.cos(p.bobPhase) * 0.011 * bobAmp;
    const bobY = Math.abs(Math.sin(p.bobPhase)) * 0.014 * bobAmp;

    const hx = lerp(spec.hipPos[0], spec.adsPos[0], this.adsAmount);
    const hy = lerp(spec.hipPos[1], spec.adsPos[1], this.adsAmount);
    const hz = lerp(spec.hipPos[2], spec.adsPos[2], this.adsAmount);

    const swapDrop = this.weaponSwapTimer > 0 ? (this.weaponSwapTimer / 0.24) * 0.25 : 0;
    const sprintCant = p.sprinting ? 1.0 : 0.0;
    const reloadTilt = this.reloading ? Math.sin((1 - this.reloadTimer / this.reloadDur) * Math.PI) : 0;

    this.vmWeaponHolder.pos.set([
      hx + bobX + this.swayX - sprintCant * 0.05,
      hy - bobY + this.swayY - swapDrop - reloadTilt * 0.08,
      hz + this.recoilKick * 0.075,
    ]);
    this.vmWeaponHolder.rot.set([
      this.recoilKick * 0.14 - reloadTilt * 0.26 - sprintCant * 0.12,
      sprintCant * 0.42 + this.swayX * 1.4,
      reloadTilt * 0.48 + (p.slideTimer > 0 ? -0.22 : 0),
    ]);

    // Reciprocating bolt / pump-action animation
    if (this.vmBuilt.boltNode) {
      if (spec.id === 'shotgun') {
        const pt = this.pumpAnim > 0 ? Math.sin((this.pumpAnim / 0.42) * Math.PI) : 0;
        this.vmBuilt.boltNode.pos[2] = -0.32 + pt * 0.085;
      } else {
        this.vmBuilt.boltNode.pos[2] = -0.05 + this.recoilKick * 0.055;
      }
    }
    // Detachable Magazine Drop & Reinsert during reload!
    if (this.vmBuilt.magNode) {
      this.vmBuilt.magNode.pos[1] = (spec.id === 'ar' ? -0.09 : (spec.id === 'smg' ? -0.11 : -0.07)) - reloadTilt * 0.16;
    }
    // Live Ammo Strip color changes from Cyan -> Amber -> Red when low!
    if (this.vmBuilt.ammoStrip) {
      const inv = this.inventory[this.currentWeaponId];
      const frac = inv.mag / spec.magSize;
      const col = frac > 0.35 ? spec.tracerColor : (frac > 0.15 ? [1.0, 0.65, 0.1] : [1.0, 0.15, 0.18]);
      this.vmBuilt.ammoStrip.material.color = col;
      this.vmBuilt.ammoStrip.material.emissive = [col[0]*2.4, col[1]*2.4, col[2]*2.4];
    }
  }

  _renderPlaying() {
    const p = this.player;
    const eyePos = [p.pos[0], p.pos[1] + p.eyeH, p.pos[2]];
    const dir = this._getAimDir();
    const target = [eyePos[0] + dir[0], eyePos[1] + dir[1], eyePos[2] + dir[2]];

    // Subtle camera roll during Cyber-Slide or strafe
    const roll = p.slideTimer > 0 ? -0.12 : 0;
    const up = [Math.sin(roll), Math.cos(roll), 0];
    const view = M4.create();
    M4.lookAt(view, eyePos, target, up);

    // Dynamic FOV (Sprint boost + ADS zoom)
    const spec = WEAPON_MAP[this.currentWeaponId];
    const baseFov = this.settings.fov + (p.sprinting ? 6 : 0) + (p.slideTimer > 0 ? 8 : 0);
    const fov = lerp(baseFov, spec.adsFov, this.adsAmount) * DEG2RAD;

    // Sort closest static + dynamic lights (max 16)
    const allLights = [...this.dynLights, ...this.level.staticLights];
    allLights.sort((a, b) => {
      const da = (a.pos[0]-p.pos[0])**2 + (a.pos[2]-p.pos[2])**2;
      const db = (b.pos[0]-p.pos[0])**2 + (b.pos[2]-p.pos[2])**2;
      return da - db;
    });
    this.engine.lights = allLights.slice(0, 16);
    this.engine.fogDensity = 0.015;
    this.engine.renderFrame(this.worldRoot, this.vmRoot, eyePos, view, fov, this.time, p.pos);
  }
}
