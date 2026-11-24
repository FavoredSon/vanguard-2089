// ============================================================================
// VANGUARD 2089 — Procedural WebAudio Tactical Soundscape & Weapon Acoustics
// ============================================================================

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.noiseBuf = null;
    this.muted = false;
    this.volume = 0.72;
    this.intensity = 0.0; // 0 = ambient stealth, 1 = intense firefight / boss
    this.musicTimer = null;
    this.stepIdx = 0;
    this.rainNode = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.28;
    this.musicGain.connect(this.master);

    // Pre-generate 2-second white noise buffer
    const sr = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, sr * 2, sr);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    this._startAmbience();
    this._startAdaptiveMusic();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  _startAmbience() {
    if (!this.ctx) return;
    // Cyber-rain steady textured hiss
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 0.65;
    const g = this.ctx.createGain();
    g.gain.value = 0.032;
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start();
    this.rainNode = src;
  }

  _startAdaptiveMusic() {
    if (this.musicTimer) return;
    const bassNotes = [55, 55, 65.41, 55, 73.42, 55, 82.41, 61.74]; // Dark A-minor cyberpunk pulse
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running' || this.muted) return;
      const now = this.ctx.currentTime;
      const idx = this.stepIdx++ % 16;

      // Deep dark cyber-bass pulse
      const note = bassNotes[Math.floor(idx / 2) % bassNotes.length];
      if (idx % 2 === 0 || this.intensity > 0.35) {
        const osc = this.ctx.createOscillator();
        const filt = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note, now);
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(160 + this.intensity * 520, now);
        filt.frequency.exponentialRampToValueAtTime(90, now + 0.16);
        const amp = (idx % 2 === 0 ? 0.16 : 0.08) * (0.35 + this.intensity * 0.65);
        g.gain.setValueAtTime(amp, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
        osc.connect(filt); filt.connect(g); g.connect(this.musicGain);
        osc.start(now); osc.stop(now + 0.18);
      }

      // Industrial combat kick & metallic hi-hat when intensity > 0.2
      if (this.intensity > 0.2 && idx % 4 === 0) {
        const k = this.ctx.createOscillator();
        const kg = this.ctx.createGain();
        k.frequency.setValueAtTime(135, now);
        k.frequency.exponentialRampToValueAtTime(36, now + 0.12);
        kg.gain.setValueAtTime(0.26 * this.intensity, now);
        kg.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        k.connect(kg); kg.connect(this.musicGain);
        k.start(now); k.stop(now + 0.15);
      }
      if (this.intensity > 0.45 && idx % 2 === 1) {
        this._noiseBurst(0.035, 7800, 'highpass', 0.06 * this.intensity, this.musicGain);
      }
    }, 130);
  }

  _noiseBurst(dur, freq, type, vol, dest = null) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    src.start(now, Math.random() * 0.8, dur);
  }

  _tone(fStart, fEnd, dur, type, vol, delay = 0) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), now + dur);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(now); osc.stop(now + dur + 0.01);
  }

  playShot(weaponId, timeScale = 1.0) {
    if (!this.ctx || this.muted) return;
    const p = 0.65 + 0.35 * timeScale;
    switch (weaponId) {
      case 'ar': // M41-K SPECTRE — punchy modern rifle crack + bolt clack
        this._tone(190 * p, 42 * p, 0.11, 'triangle', 0.38);
        this._noiseBurst(0.11, 1450 * p, 'bandpass', 0.42);
        this._noiseBurst(0.05, 4200 * p, 'highpass', 0.22);
        break;
      case 'smg': // VX-9 KRAKEN — rapid magnetic zip + snap
        this._tone(340 * p, 95 * p, 0.07, 'sawtooth', 0.22);
        this._noiseBurst(0.065, 2400 * p, 'bandpass', 0.28);
        break;
      case 'shotgun': // M870-X CERBERUS — booming thermal cannon + pump
        this._tone(130 * p, 28 * p, 0.26, 'sine', 0.65);
        this._noiseBurst(0.28, 720 * p, 'lowpass', 0.62);
        this._noiseBurst(0.14, 2400 * p, 'bandpass', 0.35);
        // Pump-rack foley delayed
        this._tone(680, 420, 0.06, 'square', 0.09, 0.26);
        this._tone(520, 880, 0.07, 'square', 0.10, 0.37);
        break;
      case 'sniper': // RA-77 LONGBOW — thunderous hyper-rail boom + electromagnetic tail
        this._tone(1100 * p, 140 * p, 0.32, 'sawtooth', 0.35);
        this._tone(150 * p, 24 * p, 0.38, 'sine', 0.68);
        this._noiseBurst(0.32, 1800 * p, 'bandpass', 0.55);
        this._tone(2400 * p, 820 * p, 0.28, 'sine', 0.14, 0.04);
        break;
      case 'plasma': // PL-4 SOLARIS — sci-fi high-energy plasma discharge
        this._tone(920 * p, 190 * p, 0.16, 'sawtooth', 0.28);
        this._tone(480 * p, 110 * p, 0.15, 'triangle', 0.26);
        this._noiseBurst(0.10, 3200 * p, 'bandpass', 0.2);
        break;
      case 'pistol': // K9-P WRAITH — suppressed tactical thwip + crisp slide
        this._tone(280 * p, 75 * p, 0.08, 'triangle', 0.24);
        this._noiseBurst(0.06, 2800 * p, 'bandpass', 0.22);
        break;
      default:
        this._noiseBurst(0.1, 1400, 'bandpass', 0.3);
    }
  }

  playEnemyShot(heavy = false) {
    if (!this.ctx || this.muted) return;
    if (heavy) {
      this._tone(140, 38, 0.14, 'sawtooth', 0.18);
      this._noiseBurst(0.12, 900, 'lowpass', 0.2);
    } else {
      this._tone(420, 120, 0.07, 'sawtooth', 0.11);
      this._noiseBurst(0.06, 1900, 'bandpass', 0.12);
    }
  }

  playHitmarker(headshot = false, kill = false) {
    if (!this.ctx || this.muted) return;
    if (headshot) {
      this._tone(1950, 1380, 0.07, 'triangle', 0.34);
      this._tone(2900, 2200, 0.09, 'sine', 0.24, 0.015);
    } else {
      this._tone(1250, 720, 0.045, 'square', 0.16);
    }
    if (kill) {
      this._tone(520, 880, 0.11, 'triangle', 0.22, 0.04);
    }
  }

  playReload() {
    if (!this.ctx || this.muted) return;
    this._tone(520, 280, 0.07, 'square', 0.11, 0.05);
    this._tone(360, 620, 0.08, 'square', 0.12, 0.55);
    this._tone(740, 1120, 0.07, 'triangle', 0.14, 0.92);
  }

  playExplosion() {
    if (!this.ctx || this.muted) return;
    this._tone(110, 22, 0.65, 'sine', 0.72);
    this._tone(220, 38, 0.45, 'sawtooth', 0.35);
    this._noiseBurst(0.7, 480, 'lowpass', 0.68);
    this._noiseBurst(0.25, 1900, 'bandpass', 0.34);
  }

  playOverclock(on = true) {
    if (!this.ctx || this.muted) return;
    if (on) {
      this._tone(880, 160, 0.45, 'sawtooth', 0.3);
      this._tone(440, 80, 0.55, 'sine', 0.4);
    } else {
      this._tone(160, 680, 0.28, 'sine', 0.25);
    }
  }

  playScan() {
    if (!this.ctx || this.muted) return;
    this._tone(420, 1680, 0.42, 'sine', 0.24);
    this._tone(840, 2100, 0.35, 'triangle', 0.14, 0.08);
  }

  playMelee() {
    if (!this.ctx || this.muted) return;
    this._noiseBurst(0.11, 3200, 'bandpass', 0.3);
    this._tone(620, 180, 0.11, 'sawtooth', 0.2);
  }

  playPlayerHit() {
    if (!this.ctx || this.muted) return;
    this._tone(160, 48, 0.15, 'sawtooth', 0.36);
    this._noiseBurst(0.12, 950, 'lowpass', 0.3);
  }

  playRadioBeep() {
    if (!this.ctx || this.muted) return;
    this._tone(1420, 1420, 0.055, 'sine', 0.15);
    this._tone(1890, 1890, 0.065, 'sine', 0.15, 0.065);
  }

  playStep(sprint = false) {
    if (!this.ctx || this.muted) return;
    this._noiseBurst(0.045, sprint ? 680 : 480, 'lowpass', sprint ? 0.11 : 0.06);
  }

  playUI() {
    if (!this.ctx || this.muted) return;
    this._tone(980, 1340, 0.05, 'triangle', 0.12);
  }
}
