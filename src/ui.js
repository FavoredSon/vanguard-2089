// ============================================================================
// VANGUARD 2089 — AAA Tactical HUD, Radar, 3D Armory Codex, Shop & Menus
// ============================================================================
import { WEAPONS, WEAPON_MAP } from './weapons.js';
import { OPERATORS, getPortrait } from './characters.js';
import { ENEMY_LIST, ENEMY_SPECS } from './enemies.js';
import { clamp } from './math.js';

export class UIController {
  constructor() {
    this.game = null;
    this.$ = id => document.getElementById(id);
    this.radarCanvas = this.$('radar-canvas');
    this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;
    this.lastCommsKey = '';
  }

  attach(game) {
    this.game = game;
    this._bindEvents();
    this._renderOperatorQuickBar();
    this._updateMenuRecords();
    this.syncScreen('menu');
  }

  _bindEvents() {
    this.$('btn-campaign').onclick = () => this.game.startGame('campaign');
    this.$('btn-endless').onclick = () => this.game.startGame('endless');
    this.$('btn-armory').onclick = () => this.game.openShowcase('weapons', 'ar');
    this.$('btn-operators').onclick = () => this.game.openShowcase('operators', this.game.selectedOperatorId);
    this.$('btn-hostiles').onclick = () => this.game.openShowcase('enemies', 'titan');

    // Showcase tabs
    this.$('sc-tab-weapons').onclick = () => { this.game.setShowcaseItem('weapons', 'ar'); this.renderShowcaseUI(); };
    this.$('sc-tab-operators').onclick = () => { this.game.setShowcaseItem('operators', this.game.selectedOperatorId); this.renderShowcaseUI(); };
    this.$('sc-tab-enemies').onclick = () => { this.game.setShowcaseItem('enemies', 'trooper'); this.renderShowcaseUI(); };
    this.$('sc-back').onclick = () => this.game.returnToMenu();
    this.$('sc-action-btn').onclick = () => {
      if (this.game.showcaseTab === 'weapons') this.game.triggerShowcaseFire();
      else if (this.game.showcaseTab === 'operators') {
        this.game.selectedOperatorId = this.game.showcaseId;
        this._renderOperatorQuickBar();
        this.renderShowcaseUI();
      }
    };

    // Pause / Settings
    this.$('btn-resume').onclick = () => this.game.resumeGame();
    this.$('btn-restart').onclick = () => this.game.startGame(this.game.mode);
    this.$('btn-quit').onclick = () => this.game.returnToMenu();

    this.$('opt-sens').oninput = e => {
      const v = parseFloat(e.target.value);
      this.game.settings.sensitivity = v * 0.001;
      this.$('opt-sens-val').textContent = v.toFixed(1);
    };
    this.$('opt-fov').oninput = e => {
      const v = parseInt(e.target.value, 10);
      this.game.settings.fov = v;
      this.$('opt-fov-val').textContent = v + '°';
    };
    this.$('opt-vol').oninput = e => {
      const v = parseInt(e.target.value, 10);
      this.game.settings.volume = v / 100;
      this.game.audio.setVolume(v / 100);
      this.$('opt-vol-val').textContent = v + '%';
    };
    this.$('opt-qual').value = this.game.settings.quality;
    this.$('opt-qual').onchange = e => {
      this.game.settings.quality = e.target.value;
      this.game.engine.setQuality(e.target.value);
    };
    this.$('opt-touch').onchange = e => {
      this.game.settings.touchMode = e.target.value;
      this._syncTouchUI();
    };

    // Pointer lock resume banner click
    this.$('lock-banner').onclick = () => this.game.requestLock();

    // Shop close
    this.$('shop-close').onclick = () => this.game.resumeGame();

    // Debrief buttons
    this.$('debrief-retry').onclick = () => this.game.startGame(this.game.mode);
    this.$('debrief-endless').onclick = () => this.game.startGame('endless');
    this.$('debrief-menu').onclick = () => this.game.returnToMenu();

    // Bind Tappable HUD Abilities & Interact Prompt (works on Mobile + Desktop)
    const tapBind = (id, fn) => {
      const el = this.$(id);
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); this.game.audio.init(); fn(); }, { passive: false });
      el.addEventListener('mousedown', e => { e.stopPropagation(); this.game.audio.init(); fn(); });
    };
    tapBind('ab-overclock', () => this.game.activateOverclock());
    tapBind('ab-scan', () => this.game.activateScan());
    tapBind('ab-grenade', () => this.game.throwGrenade());
    tapBind('interact-prompt', () => this.game.tryInteractOrMelee());

    this._bindTouchControls();
    this._syncTouchUI();
  }

  _bindTouchControls() {
    const g = this.game;
    const moveZone = this.$('touch-move-zone');
    const joyBase = this.$('joy-base');
    const joyNub = this.$('joy-nub');
    const joySprint = this.$('joy-sprint-tag');
    const lookZone = this.$('touch-look-zone');

    // 1. Floating Virtual Analog Move Joystick (independent touch identifier)
    let moveId = null, joyCx = 0, joyCy = 0;
    const maxR = 46;

    moveZone.addEventListener('touchstart', e => {
      if (g.state !== 'playing') return;
      e.preventDefault();
      g.audio.init();
      if (moveId !== null) return;
      const t = e.changedTouches[0];
      moveId = t.identifier;
      const rect = moveZone.getBoundingClientRect();
      joyCx = t.clientX;
      joyCy = t.clientY;
      joyBase.classList.remove('hidden');
      joyBase.style.left = (joyCx - rect.left) + 'px';
      joyBase.style.top = (joyCy - rect.top) + 'px';
      joyNub.style.transform = 'translate(-50%, -50%)';
    }, { passive: false });

    moveZone.addEventListener('touchmove', e => {
      if (moveId === null) return;
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== moveId) continue;
        let dx = t.clientX - joyCx;
        let dy = t.clientY - joyCy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
        joyNub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        g.touch.moveX = dx / maxR;
        g.touch.moveY = -dy / maxR;
        // Pushing forward past 82% engages Auto-Sprint!
        const sprint = (-dy / maxR) > 0.82 && Math.abs(dx / maxR) < 0.55;
        g.touch.sprint = sprint;
        joySprint.classList.toggle('active', sprint);
      }
    }, { passive: false });

    const endMove = e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === moveId) {
          moveId = null;
          g.touch.moveX = 0;
          g.touch.moveY = 0;
          g.touch.sprint = false;
          joyBase.classList.add('hidden');
          joySprint.classList.remove('active');
        }
      }
    };
    moveZone.addEventListener('touchend', endMove);
    moveZone.addEventListener('touchcancel', endMove);

    // 2. Smooth Right-Side Touch-Look Aim Pad
    let lookId = null, lastLx = 0, lastLy = 0;
    lookZone.addEventListener('touchstart', e => {
      if (g.state !== 'playing') return;
      e.preventDefault();
      g.audio.init();
      if (lookId !== null) return;
      const t = e.changedTouches[0];
      lookId = t.identifier;
      lastLx = t.clientX;
      lastLy = t.clientY;
    }, { passive: false });

    lookZone.addEventListener('touchmove', e => {
      if (lookId === null) return;
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== lookId) continue;
        g.applyTouchLook(t.clientX - lastLx, t.clientY - lastLy);
        lastLx = t.clientX;
        lastLy = t.clientY;
      }
    }, { passive: false });

    const endLook = e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lookId) lookId = null;
      }
    };
    lookZone.addEventListener('touchend', endLook);
    lookZone.addEventListener('touchcancel', endLook);

    // 3. Fire + Drag-to-Track Thumb Trigger (COD Mobile style!)
    const fireBtn = this.$('tbtn-fire');
    let fireId = null, lastFx = 0, lastFy = 0;
    fireBtn.addEventListener('touchstart', e => {
      if (g.state !== 'playing') return;
      e.preventDefault(); e.stopPropagation();
      g.audio.init();
      const t = e.changedTouches[0];
      fireId = t.identifier;
      lastFx = t.clientX; lastFy = t.clientY;
      g.touch.firing = true;
      fireBtn.classList.add('pressed');
      g._tryFire(true);
    }, { passive: false });
    fireBtn.addEventListener('touchmove', e => {
      if (fireId === null) return;
      e.preventDefault(); e.stopPropagation();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier !== fireId) continue;
        g.applyTouchLook(t.clientX - lastFx, t.clientY - lastFy);
        lastFx = t.clientX; lastFy = t.clientY;
      }
    }, { passive: false });
    const endFire = e => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === fireId) {
          fireId = null;
          g.touch.firing = false;
          fireBtn.classList.remove('pressed');
        }
      }
    };
    fireBtn.addEventListener('touchend', endFire);
    fireBtn.addEventListener('touchcancel', endFire);

    // 4. Ergonomic Action Buttons (ADS, Reload, Jump, Slide/Crouch, Melee/Act, Pause, Shop)
    const bindTouchBtn = (id, fn) => {
      const el = this.$(id);
      if (!el) return;
      el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); g.audio.init(); fn(el); }, { passive: false });
      el.addEventListener('mousedown', e => { e.stopPropagation(); g.audio.init(); fn(el); });
    };
    bindTouchBtn('tbtn-ads', () => { g.touch.adsToggle = !g.touch.adsToggle; });
    bindTouchBtn('tbtn-reload', () => { g.startReload(); });
    bindTouchBtn('tbtn-jump', () => { g.touch.jumpQueued = true; });
    bindTouchBtn('tbtn-crouch', () => {
      if (g.player.sprinting && g.player.grounded && g.player.slideTimer <= 0) g.startSlide();
      else g.touch.crouchToggle = !g.touch.crouchToggle;
    });
    bindTouchBtn('tbtn-act', () => { g.tryInteractOrMelee(); });
    bindTouchBtn('tbtn-pause', () => { g.pauseGame(); });
    bindTouchBtn('tbtn-shop', () => { g.openShop(); });
  }

  _syncTouchUI() {
    const active = this.game.isTouchActive();
    document.body.classList.toggle('touch-mode', active);
    const tc = this.$('touch-controls');
    if (tc) tc.classList.toggle('hidden', !(active && this.game.state === 'playing'));
    const engaged = this.game.pointerLocked || this.game.unlockedAim || active;
    this.$('lock-banner').classList.toggle('hidden', !(this.game.state === 'playing' && !engaged));
  }

  _updateMenuRecords() {
    const r = this.game.records;
    this.$('menu-best-wave').textContent = r.bestWave > 0 ? `BEST WAVE ${r.bestWave} // ${r.bestScore.toLocaleString()} PTS` : 'NO RECORD YET — DEPLOY TO BENCHMARK';
    this.$('menu-camp-status').textContent = r.campaignCleared ? 'STATUS: SECTOR 04 CLEARED' : 'STATUS: DEPLOYMENT READY';
  }

  _renderOperatorQuickBar() {
    const box = this.$('menu-op-list');
    box.innerHTML = '';
    for (const op of OPERATORS) {
      const active = op.id === this.game.selectedOperatorId;
      const el = document.createElement('button');
      el.className = 'op-chip' + (active ? ' active' : '');
      el.style.setProperty('--op-accent', op.accentHex);
      el.innerHTML = `
        <img src="${getPortrait(op.id)}" alt="${op.name}" />
        <div class="op-chip-info">
          <div class="op-chip-call">${op.callsign}</div>
          <div class="op-chip-name">${op.name}</div>
          <div class="op-chip-perk">${op.perkTitle}</div>
        </div>
      `;
      el.onclick = () => {
        this.game.audio.init();
        this.game.audio.playUI();
        this.game.selectedOperatorId = op.id;
        this._renderOperatorQuickBar();
      };
      box.appendChild(el);
    }
  }

  syncScreen(state) {
    this.$('screen-menu').classList.toggle('hidden', state !== 'menu');
    this.$('screen-showcase').classList.toggle('hidden', state !== 'showcase');
    this.$('hud-layer').classList.toggle('hidden', state !== 'playing' && state !== 'paused' && state !== 'shop');
    this.$('screen-pause').classList.toggle('hidden', state !== 'paused');
    this.$('screen-shop').classList.toggle('hidden', state !== 'shop');
    this.$('screen-debrief').classList.toggle('hidden', state !== 'debrief');
    this._syncTouchUI();

    if (state === 'menu') {
      this._updateMenuRecords();
      this._renderOperatorQuickBar();
    }
    if (state === 'showcase') {
      this.renderShowcaseUI();
    }
    if (state === 'playing') {
      const op = this.game.getOperator();
      this.$('hud-op-img').src = getPortrait(op.id);
      this.$('hud-op-call').textContent = op.callsign;
      this.$('hud-shop-hint').classList.toggle('hidden', this.game.mode !== 'endless');
      this.$('tbtn-shop').classList.toggle('hidden', this.game.mode !== 'endless');
    }
  }

  onPointerLockChange(locked, state) {
    const engaged = locked || this.game.unlockedAim || this.game.isTouchActive();
    this.$('lock-banner').classList.toggle('hidden', !(state === 'playing' && !engaged));
  }

  // --- 3D ARMORY / CODEX SHOWCASE UI ---
  renderShowcaseUI() {
    const tab = this.game.showcaseTab;
    const id = this.game.showcaseId;
    this.$('sc-tab-weapons').classList.toggle('active', tab === 'weapons');
    this.$('sc-tab-operators').classList.toggle('active', tab === 'operators');
    this.$('sc-tab-enemies').classList.toggle('active', tab === 'enemies');

    const listEl = this.$('sc-list');
    listEl.innerHTML = '';

    const items = tab === 'weapons' ? WEAPONS : (tab === 'operators' ? OPERATORS : ENEMY_LIST);
    for (const item of items) {
      const btn = document.createElement('button');
      btn.className = 'sc-item' + (item.id === id ? ' active' : '');
      btn.style.setProperty('--accent', item.accentHex || '#00e5ff');
      btn.innerHTML = `
        <div class="sc-item-kicker">${tab === 'weapons' ? `SLOT 0${item.slot}` : (tab === 'operators' ? item.callsign : item.threat)}</div>
        <div class="sc-item-title">${item.name}</div>
        <div class="sc-item-sub">${tab === 'weapons' ? item.category : item.role}</div>
      `;
      btn.onclick = () => {
        this.game.setShowcaseItem(tab, item.id);
        this.renderShowcaseUI();
      };
      listEl.appendChild(btn);
    }

    // Dossier Right Panel
    const titleEl = this.$('sc-title');
    const catEl = this.$('sc-cat');
    const loreEl = this.$('sc-lore');
    const statsEl = this.$('sc-stats');
    const actBtn = this.$('sc-action-btn');

    if (tab === 'weapons') {
      const w = WEAPON_MAP[id] || WEAPONS[0];
      titleEl.textContent = w.name;
      catEl.textContent = `${w.category} // ${w.caliber} // ${w.fireMode}`;
      loreEl.textContent = w.lore;
      statsEl.innerHTML = this._statBar('DAMAGE', w.stats.damage, '#00e5ff')
        + this._statBar('FIRE RATE', w.stats.fireRate, '#f5a623')
        + this._statBar('ACCURACY', w.stats.accuracy, '#22f2b4')
        + this._statBar('MOBILITY', w.stats.mobility, '#e8eef5')
        + `<div class="sc-meta-grid">
             <div><span>MAGAZINE</span><b>${w.magSize} RDS</b></div>
             <div><span>CRIT MULT</span><b>${w.headMult}×</b></div>
             <div><span>RPM</span><b>${w.rpm}</b></div>
             <div><span>ENDLESS COST</span><b>${w.cost ? '₵' + w.cost : 'ISSUED'}</b></div>
           </div>`;
      actBtn.classList.remove('hidden');
      actBtn.textContent = 'TEST FIRE ACOUSTICS & MUZZLE';
    } else if (tab === 'operators') {
      const op = OPERATORS.find(o => o.id === id) || OPERATORS[0];
      titleEl.textContent = `${op.name} "${op.callsign}"`;
      catEl.textContent = op.division;
      loreEl.textContent = op.bio;
      const sig = WEAPON_MAP[op.signatureWeapon];
      statsEl.innerHTML = `
        <div class="sc-portrait-row">
          <img src="${getPortrait(op.id)}" class="sc-portrait" />
          <div>
            <div class="sc-perk-tag">TACTICAL PASSIVE</div>
            <div class="sc-perk-name">${op.perkTitle}</div>
            <div class="sc-perk-desc">${op.perkDesc}</div>
          </div>
        </div>
        <div class="sc-meta-grid">
          <div><span>ROLE</span><b>${op.role}</b></div>
          <div><span>SIGNATURE</span><b>${sig.name}</b></div>
          <div><span>MAX ARMOR</span><b>${op.bonuses.maxArmor}</b></div>
          <div><span>OVERCLOCK</span><b>${op.bonuses.overclockDur}s</b></div>
        </div>`;
      actBtn.classList.remove('hidden');
      const isSel = this.game.selectedOperatorId === op.id;
      actBtn.textContent = isSel ? 'ACTIVE DEPLOYMENT OPERATOR ✓' : 'SET AS ACTIVE OPERATOR';
    } else {
      const en = ENEMY_SPECS[id] || ENEMY_LIST[0];
      titleEl.textContent = en.name;
      catEl.textContent = `${en.role} // THREAT LEVEL: ${en.threat}`;
      loreEl.textContent = en.lore;
      statsEl.innerHTML = this._statBar('INTEGRITY (HP)', Math.min(100, Math.round(en.hp / 15.5)), '#ff3b44')
        + this._statBar('CYBER SHIELD', Math.min(100, Math.round(en.shield / 4.5)), '#00e5ff')
        + this._statBar('MOBILITY', Math.min(100, Math.round(en.speed * 11)), '#f5a623')
        + `<div class="sc-meta-grid">
             <div><span>HITPOINTS</span><b>${en.hp}</b></div>
             <div><span>SHIELD</span><b>${en.shield || 'NONE'}</b></div>
             <div><span>BOUNTY</span><b>₵${en.credits}</b></div>
             <div><span>WEAKPOINT</span><b>${en.isBoss ? 'CORE + HEAD' : (en.flying ? 'OPTIC EYE' : 'HEADSHOT')}</b></div>
           </div>`;
      actBtn.classList.add('hidden');
    }
  }

  _statBar(label, val, color) {
    return `<div class="stat-row">
      <div class="stat-lbl"><span>${label}</span><span>${val}</span></div>
      <div class="stat-track"><div class="stat-fill" style="width:${clamp(val, 4, 100)}%;background:${color}"></div></div>
    </div>`;
  }

  // --- ENDLESS REQUISITION SHOP UI ---
  renderShop() {
    const g = this.game;
    const p = g.player;
    this.$('shop-credits').textContent = `₵${p.credits.toLocaleString()}`;

    const wepGrid = this.$('shop-weapons');
    wepGrid.innerHTML = '';
    for (const w of WEAPONS) {
      const inv = g.inventory[w.id];
      const cost = inv.unlocked ? 120 : w.cost;
      const can = p.credits >= cost;
      const card = document.createElement('button');
      card.className = 'shop-card' + (can ? '' : ' locked');
      card.innerHTML = `
        <div class="shop-tag">${inv.unlocked ? 'OWNED — REFILL AMMO' : 'UNLOCK WEAPON'}</div>
        <div class="shop-name">${w.name}</div>
        <div class="shop-sub">${w.category}</div>
        <div class="shop-price">₵${cost}</div>
      `;
      card.onclick = () => { if (g.buyShopItem('weapon', w.id)) this.renderShop(); };
      wepGrid.appendChild(card);
    }

    const upgGrid = this.$('shop-upgrades');
    const dmgCost = 350 + p.damageUpgrades * 250;
    const armCost = 300 + p.armorUpgrades * 220;
    const refCost = 320 + p.reflexUpgrades * 240;
    const items = [
      { act: 'ammo_all', tag: 'LOGISTICS', name: 'FULL AMMO & EMP GRENADES', sub: 'Refills all unlocked weapons + max EMP grenades', cost: 200, max: false },
      { act: 'medkit',   tag: 'TRAUMA STIM', name: 'NANO-MEDKIT & SHIELD', sub: 'Restores 100% Health & Subdermal Armor immediately', cost: 180, max: false },
      { act: 'upg_dmg',  tag: `TIER ${p.damageUpgrades}/5`, name: 'RAIL OVERCLOCK (+16% DMG)', sub: 'Permanently boosts all ballistic & plasma damage', cost: dmgCost, max: p.damageUpgrades >= 5 },
      { act: 'upg_armor',tag: `TIER ${p.armorUpgrades}/5`, name: 'SUBDERMAL PLATING (+25 ARMOR)', sub: 'Increases max Subdermal Shield capacity & restores it', cost: armCost, max: p.armorUpgrades >= 5 },
      { act: 'upg_reflex',tag: `TIER ${p.reflexUpgrades}/5`, name: 'NEURAL REFLEX (+SPEED & Q)', sub: 'Boosts sprint speed, Overclock duration & cooldown', cost: refCost, max: p.reflexUpgrades >= 5 },
    ];
    upgGrid.innerHTML = '';
    for (const it of items) {
      const can = !it.max && p.credits >= it.cost;
      const card = document.createElement('button');
      card.className = 'shop-card' + (can ? '' : ' locked');
      card.innerHTML = `
        <div class="shop-tag">${it.tag}</div>
        <div class="shop-name">${it.name}</div>
        <div class="shop-sub">${it.sub}</div>
        <div class="shop-price">${it.max ? 'MAXED' : '₵' + it.cost}</div>
      `;
      card.onclick = () => { if (g.buyShopItem(it.act)) this.renderShop(); };
      upgGrid.appendChild(card);
    }
  }

  // --- LIVE IN-GAME HUD UPDATE ---
  updateHUD(g) {
    const p = g.player;
    const spec = WEAPON_MAP[g.currentWeaponId];
    const inv = g.inventory[g.currentWeaponId];

    // Health & Armor
    this.$('hud-hp-fill').style.width = clamp((p.hp / p.maxHp) * 100, 0, 100) + '%';
    this.$('hud-hp-num').textContent = Math.ceil(p.hp);
    this.$('hud-arm-fill').style.width = clamp((p.armor / p.maxArmor) * 100, 0, 100) + '%';
    this.$('hud-arm-num').textContent = Math.ceil(p.armor);

    // Objective & Mode telemetry
    this.$('hud-obj-title').textContent = g.objectiveTitle;
    this.$('hud-obj-sub').textContent = g.objectiveSub;
    this.$('hud-score').textContent = p.score.toLocaleString();
    this.$('hud-credits').textContent = `₵${p.credits}`;
    this.$('hud-mode-badge').textContent = g.mode === 'campaign' ? 'OP: BLACKOUT PROTOCOL' : `WAVE ${g.wave} // ENDLESS`;

    // Ammo & Weapon Strip
    this.$('hud-wep-name').textContent = spec.name;
    this.$('hud-wep-cat').textContent = spec.fireMode;
    this.$('hud-ammo-mag').textContent = inv.mag;
    this.$('hud-ammo-mag').classList.toggle('low', inv.mag <= Math.ceil(spec.magSize * 0.25));
    this.$('hud-ammo-res').textContent = `/ ${inv.reserve}`;

    const relBar = this.$('hud-reload-wrap');
    if (g.reloading) {
      relBar.classList.remove('hidden');
      const pct = clamp((1 - g.reloadTimer / g.reloadDur) * 100, 0, 100);
      this.$('hud-reload-fill').style.width = pct + '%';
    } else {
      relBar.classList.add('hidden');
    }

    // Weapon slots strip (tappable on mobile & desktop!)
    const slotsEl = this.$('hud-slots');
    if (slotsEl.children.length !== WEAPONS.length) {
      slotsEl.innerHTML = '';
      for (const w of WEAPONS) {
        const div = document.createElement('div');
        div.className = 'wslot';
        div.id = 'wslot-' + w.id;
        div.innerHTML = `<span>${w.slot}</span>${w.id.toUpperCase()}`;
        const pick = e => { e.preventDefault(); e.stopPropagation(); g.switchWeapon(w.id); };
        div.addEventListener('touchstart', pick, { passive: false });
        div.addEventListener('mousedown', pick);
        slotsEl.appendChild(div);
      }
    }
    for (const w of WEAPONS) {
      const el = this.$('wslot-' + w.id);
      el.classList.toggle('active', w.id === g.currentWeaponId);
      el.classList.toggle('locked', !g.inventory[w.id].unlocked);
    }

    // Sync Mobile ADS & Interact/Knife button highlight
    const tAds = this.$('tbtn-ads');
    if (tAds) tAds.classList.toggle('active', !!g.touch.adsToggle);
    const tAct = this.$('tbtn-act');
    if (tAct) {
      tAct.classList.toggle('interact', !!g.interactPrompt);
      tAct.textContent = g.interactPrompt ? 'USE' : 'KNIFE';
    }

    // Cyberware Abilities
    this._updateAbility('ab-overclock', p.overclockActive > 0 ? 'ACTIVE' : (p.overclockCd > 0 ? Math.ceil(p.overclockCd) + 's' : 'READY'), p.overclockActive > 0, p.overclockCd > 0);
    this._updateAbility('ab-scan', p.scanActive > 0 ? 'SCANNING' : (p.scanCd > 0 ? Math.ceil(p.scanCd) + 's' : 'READY'), p.scanActive > 0, p.scanCd > 0);
    this._updateAbility('ab-grenade', `×${p.grenades}`, false, p.grenades <= 0);

    // Crosshair & Sniper Scope Overlay
    const scoped = !!(spec.scoped && g.adsAmount > 0.82);
    this.$('sniper-scope').classList.toggle('hidden', !scoped);
    const ch = this.$('crosshair');
    ch.classList.toggle('hidden', scoped);
    const gap = Math.round(clamp(8 + (1 - g.adsAmount) * 10 + g.recoilKick * 24 + (p.sprinting ? 14 : 0), 4, 42));
    ch.style.setProperty('--gap', gap + 'px');

    // Hitmarker
    const hm = this.$('hitmarker');
    hm.classList.toggle('visible', g.hitmarkerTimer > 0);
    hm.classList.toggle('head', g.hitmarkerHead);
    hm.classList.toggle('kill', g.hitmarkerKill);

    // Damage directional arc
    const da = this.$('dmg-arc');
    if (p.hitDirTimer > 0 && p.hitDirAngle !== null) {
      da.style.opacity = clamp(p.hitDirTimer, 0, 1);
      da.style.transform = `translate(-50%, -50%) rotate(${p.hitDirAngle}rad)`;
    } else {
      da.style.opacity = 0;
    }

    // Interact prompt
    const ip = this.$('interact-prompt');
    if (g.interactPrompt) {
      ip.classList.remove('hidden');
      ip.textContent = g.interactPrompt.label;
    } else {
      ip.classList.add('hidden');
    }

    // Boss Health Bar
    const bossBar = this.$('boss-bar');
    if (g.activeBoss && g.activeBoss.alive) {
      bossBar.classList.remove('hidden');
      this.$('boss-hp-fill').style.width = clamp((g.activeBoss.hp / g.activeBoss.maxHp) * 100, 0, 100) + '%';
      this.$('boss-sh-fill').style.width = clamp((g.activeBoss.shield / Math.max(1, g.activeBoss.maxShield)) * 100, 0, 100) + '%';
      this.$('boss-phase').textContent = g.activeBoss.phase2 ? 'PHASE II // OVERDRIVE' : 'PHASE I // SIEGE PROTOCOL';
    } else {
      bossBar.classList.add('hidden');
    }

    // Radio Comms Box
    const commsBox = this.$('comms-box');
    if (g.activeComms) {
      commsBox.classList.remove('hidden');
      const key = g.activeComms.npc.id + ':' + g.activeComms.text;
      if (this.lastCommsKey !== key) {
        this.lastCommsKey = key;
        this.$('comms-img').src = getPortrait(g.activeComms.npc.id);
        this.$('comms-call').textContent = g.activeComms.npc.callsign;
        this.$('comms-call').style.color = g.activeComms.npc.accentHex;
        this.$('comms-text').textContent = g.activeComms.text;
      }
    } else {
      commsBox.classList.add('hidden');
    }

    // Kill Feed
    const kf = this.$('kill-feed');
    kf.innerHTML = g.killFeed.map(k => `<div class="kf-row ${k.highlight ? 'hl' : ''}"><span>${k.title}</span><b>${k.bonus}</b></div>`).join('');

    // 3D Projected Waypoints & Optic Scan Hostile Diamonds
    this._updateWorldMarkers(g);

    // Rotating Tactical Radar Minimap
    this._drawRadar(g);
  }

  _updateAbility(id, statusText, active, cooling) {
    const el = this.$(id);
    el.classList.toggle('active', active);
    el.classList.toggle('cooling', cooling && !active);
    el.querySelector('.ab-state').textContent = statusText;
  }

  _updateWorldMarkers(g) {
    const layer = this.$('world-markers');
    let html = '';

    // Campaign Objective Waypoint Diamond
    if (g.objectivePos) {
      const sc = g.engine.projectToScreen(g.objectivePos);
      if (sc) {
        const dist = Math.round(Math.hypot(g.objectivePos[0] - g.player.pos[0], g.objectivePos[2] - g.player.pos[2]));
        html += `<div class="wm-obj" style="left:${sc.x}px;top:${sc.y}px"><div class="wm-diamond"></div><span>${dist}m</span></div>`;
      }
    }

    // Optic Scan Hostile Tags (or Boss Lock-On)
    const scanning = g.player.scanActive > 0;
    for (const en of g.enemies) {
      if (!en.alive) continue;
      if (!scanning && !en.spec.isBoss && en.hitFlash <= 0) continue;
      const topPos = [en.pos[0], en.pos[1] + en.spec.height + 0.35, en.pos[2]];
      const sc = g.engine.projectToScreen(topPos);
      if (!sc) continue;
      const hpPct = Math.round((en.hp / en.maxHp) * 100);
      html += `<div class="wm-enemy" style="left:${sc.x}px;top:${sc.y}px">
        <div class="wm-ename">${en.spec.name}</div>
        <div class="wm-ebar"><div style="width:${hpPct}%"></div></div>
      </div>`;
    }
    layer.innerHTML = html;
  }

  _drawRadar(g) {
    const ctx = this.radarCtx;
    if (!ctx) return;
    const W = 136, H = 136, cx = W / 2, cy = H / 2;
    ctx.clearRect(0, 0, W, H);

    // Circular radar background
    ctx.fillStyle = 'rgba(6, 11, 17, 0.82)';
    ctx.beginPath(); ctx.arc(cx, cy, 64, 0, Math.PI * 2); ctx.fill();

    // Concentric range rings
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.16)';
    ctx.lineWidth = 1;
    for (const r of [20, 42, 63]) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }

    // Player FOV wedge
    ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 62, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55);
    ctx.closePath();
    ctx.fill();

    const p = g.player;
    const scale = 1.65; // pixels per meter
    const cos = Math.cos(p.yaw);
    const sin = Math.sin(p.yaw);

    const toRadar = (wx, wz) => {
      const dx = wx - p.pos[0];
      const dz = wz - p.pos[2];
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;
      return [cx + rx * scale, cy + rz * scale];
    };

    // Objective diamond on radar
    if (g.objectivePos) {
      const [ox, oy] = toRadar(g.objectivePos[0], g.objectivePos[2]);
      const d = Math.hypot(ox - cx, oy - cy);
      const tx = d > 58 ? cx + (ox - cx) / d * 58 : ox;
      const ty = d > 58 ? cy + (oy - cy) / d * 58 : oy;
      ctx.fillStyle = '#f5a623';
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }

    // Enemy blips
    for (const en of g.enemies) {
      if (!en.alive) continue;
      const [ex, ey] = toRadar(en.pos[0], en.pos[2]);
      if (Math.hypot(ex - cx, ey - cy) > 60) continue;
      ctx.fillStyle = en.spec.isBoss ? '#ff2436' : (en.spec.flying ? '#00e5ff' : '#ff4752');
      ctx.beginPath();
      ctx.arc(ex, ey, en.spec.isBoss ? 5.5 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player center chevron
    ctx.fillStyle = '#e8eef5';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 4, cy + 4); ctx.lineTo(cx - 4, cy + 4);
    ctx.closePath(); ctx.fill();
  }

  // --- AFTER-ACTION DEBRIEF ---
  showDebrief(data) {
    this.syncScreen('debrief');
    this.$('debrief-kicker').textContent = data.mode === 'campaign' ? 'CAMPAIGN MISSION 01 // OPERATION BLACKOUT PROTOCOL' : 'ENDLESS MODE // PROTOCOL INFINITE SIEGE';
    this.$('debrief-title').textContent = data.victory ? 'MISSION ACCOMPLISHED' : 'OPERATOR DOWN — KIA';
    this.$('debrief-title').className = 'debrief-title ' + (data.victory ? 'win' : 'loss');
    this.$('debrief-rank').textContent = data.rank;
    this.$('debrief-score').textContent = data.score.toLocaleString();
    this.$('debrief-kills').textContent = data.kills;
    this.$('debrief-heads').textContent = data.headshots;
    this.$('debrief-acc').textContent = data.accuracy + '%';
    const mins = Math.floor(data.time / 60);
    const secs = Math.floor(data.time % 60).toString().padStart(2, '0');
    this.$('debrief-time').textContent = `${mins}:${secs}`;
    this.$('debrief-wave').textContent = data.mode === 'endless' ? `WAVE ${data.wave}` : (data.victory ? 'SECTOR 04 SECURED' : 'INCOMPLETE');
  }
}
