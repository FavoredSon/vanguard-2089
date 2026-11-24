// ============================================================================
// VANGUARD 2089 — Procedural PBR Texture & Tactical Portrait Generator
// Generates crisp Albedo, Roughness/Metal/Bump, Emissive maps & Character Art
// ============================================================================

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createTextureLibrary(gl) {
  const textures = {};

  function uploadCanvas(canvas, repeat = true, srgb = false) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    const ext = gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) {
      const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
    }
    return tex;
  }

  // 1. WHITE 1x1 fallback
  {
    const c = makeCanvas(4, 4);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 4, 4);
    textures.white = uploadCanvas(c, true);
  }

  // 2. WET CYBER-ASPHALT (puddles, aggregate grain, road markings, grate detail)
  {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    const r = seededRand(101);
    ctx.fillStyle = '#141920';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle puddle patches (darker & smoother)
    for (let i = 0; i < 18; i++) {
      const x = r() * 512, y = r() * 512, rad = 35 + r() * 95;
      const g = ctx.createRadialGradient(x, y, 4, x, y, rad);
      g.addColorStop(0, 'rgba(6, 11, 18, 0.7)');
      g.addColorStop(1, 'rgba(20, 25, 32, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fine asphalt aggregate speckles
    for (let i = 0; i < 9000; i++) {
      const v = 18 + Math.floor(r() * 34);
      ctx.fillStyle = `rgb(${v},${v + 3},${v + 7})`;
      ctx.fillRect(r() * 512, r() * 512, 1.5, 1.5);
    }

    // Road lane dashes & tactical markings
    ctx.fillStyle = 'rgba(235, 168, 42, 0.72)';
    ctx.fillRect(248, 24, 16, 170);
    ctx.fillRect(248, 276, 16, 170);
    ctx.fillStyle = 'rgba(180, 200, 220, 0.25)';
    ctx.fillRect(14, 0, 6, 512);
    ctx.fillRect(492, 0, 6, 512);

    // Cracks & expansion joint
    ctx.strokeStyle = 'rgba(4, 6, 9, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 256); ctx.lineTo(512, 256);
    ctx.stroke();

    textures.asphalt = uploadCanvas(c, true);
  }

  // 3. BRUTALIST CONCRETE + MILITARY HAZARD TRIM
  {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    const r = seededRand(202);
    ctx.fillStyle = '#2a313a';
    ctx.fillRect(0, 0, 512, 512);

    // Concrete panels
    for (let y = 0; y < 512; y += 128) {
      for (let x = 0; x < 512; x += 256) {
        const shade = 38 + Math.floor(r() * 14);
        ctx.fillStyle = `rgb(${shade},${shade + 5},${shade + 11})`;
        ctx.fillRect(x + 2, y + 2, 252, 124);
        ctx.strokeStyle = '#12161c';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, 253, 125);
        // Formwork tie-bolts
        ctx.fillStyle = '#141920';
        for (const bx of [x + 24, x + 232]) {
          for (const by of [y + 24, y + 104]) {
            ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
    }

    // Vertical weather streaks
    for (let i = 0; i < 160; i++) {
      const x = r() * 512, h = 40 + r() * 200;
      ctx.fillStyle = `rgba(8, 12, 16, ${0.08 + r() * 0.14})`;
      ctx.fillRect(x, r() * 512, 2 + r() * 5, h);
    }

    // Bottom hazard stripe bar
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 456, 512, 56);
    ctx.clip();
    ctx.fillStyle = '#181c22';
    ctx.fillRect(0, 456, 512, 56);
    ctx.fillStyle = '#d98f18';
    for (let x = -64; x < 580; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 512); ctx.lineTo(x + 24, 512);
      ctx.lineTo(x + 56, 456); ctx.lineTo(x + 32, 456);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#0d1015';
    ctx.fillRect(0, 452, 512, 6);

    textures.concrete = uploadCanvas(c, true);
  }

  // 4. CARBON-FIBER / TACTICAL GUNMETAL
  {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1d232b';
    ctx.fillRect(0, 0, 256, 256);
    // Carbon weave pattern
    for (let y = 0; y < 256; y += 8) {
      for (let x = 0; x < 256; x += 8) {
        const alt = ((x + y) / 8) % 2 === 0;
        ctx.fillStyle = alt ? '#272f3a' : '#181e26';
        ctx.fillRect(x, y, 7, 3);
        ctx.fillStyle = alt ? '#181e26' : '#2d3643';
        ctx.fillRect(x, y + 4, 7, 3);
      }
    }
    // Subtle brushed scratches
    const r = seededRand(303);
    ctx.strokeStyle = 'rgba(200, 220, 240, 0.06)';
    for (let i = 0; i < 80; i++) {
      const y = r() * 256;
      ctx.beginPath(); ctx.moveTo(r() * 256, y); ctx.lineTo(r() * 256, y + 1); ctx.stroke();
    }
    textures.carbon = uploadCanvas(c, true);
  }

  // 5. CYBER TOWER / SERVER FACADE (glass mullions + glowing micro-windows)
  {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext('2d');
    const r = seededRand(404);
    ctx.fillStyle = '#0c1118';
    ctx.fillRect(0, 0, 512, 512);

    // Architectural mullions
    for (let y = 0; y < 512; y += 32) {
      ctx.fillStyle = '#161f2b';
      ctx.fillRect(0, y, 512, 4);
      for (let x = 0; x < 512; x += 64) {
        ctx.fillStyle = '#141c27';
        ctx.fillRect(x, y, 4, 32);
        const lit = r();
        if (lit > 0.72) {
          ctx.fillStyle = lit > 0.91 ? 'rgba(0, 229, 255, 0.55)' :
                          lit > 0.84 ? 'rgba(245, 166, 35, 0.5)' : 'rgba(130, 175, 215, 0.25)';
          ctx.fillRect(x + 8, y + 8, 48, 16);
        }
      }
    }
    // Vertical structural ribs
    ctx.fillStyle = '#1d2735';
    ctx.fillRect(0, 0, 18, 512);
    ctx.fillRect(248, 0, 16, 512);
    ctx.fillRect(494, 0, 18, 512);

    textures.tower = uploadCanvas(c, true);
  }

  // 6. MILITARY TACTICAL CRATE / COVER
  {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2d353b';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#151a1f';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 240, 240);
    // Ribs
    ctx.fillStyle = '#22282e';
    for (let y = 34; y < 220; y += 28) {
      ctx.fillRect(22, y, 212, 12);
    }
    // Corner armor plates
    ctx.fillStyle = '#3d4750';
    for (const [cx, cy] of [[0,0],[216,0],[0,216],[216,216]]) {
      ctx.fillRect(cx, cy, 40, 40);
    }
    // Stencil bar
    ctx.fillStyle = '#e89b1e';
    ctx.fillRect(26, 114, 204, 28);
    ctx.fillStyle = '#111519';
    ctx.font = 'bold 17px monospace';
    ctx.fillText('MIL-SPEC // SEC-04', 36, 134);
    textures.crate = uploadCanvas(c, true);
  }

  // 7. INDUSTRIAL FLOOR GRATING / CATWALK
  {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1b222a';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#323e4d';
    ctx.lineWidth = 3;
    for (let i = -256; i < 512; i += 24) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 256, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i + 256, 0); ctx.lineTo(i, 256); ctx.stroke();
    }
    ctx.strokeStyle = '#475668';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 248, 248);
    textures.grate = uploadCanvas(c, true);
  }

  // 8. CYBER-TECH ARMOR HEX (for Enemies & Server Cores)
  {
    const c = makeCanvas(256, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#202833';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#334154';
    ctx.lineWidth = 2;
    const step = 28;
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 12; col++) {
        const cx = col * step + (row % 2 ? step / 2 : 0);
        const cy = row * (step * 0.86);
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const ang = (a * Math.PI) / 3 + Math.PI / 6;
          const px = cx + Math.cos(ang) * 13;
          const py = cy + Math.sin(ang) * 13;
          if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
    textures.hexArmor = uploadCanvas(c, true);
  }

  // 9. HOLOGRAPHIC NEON BILLBOARDS (3 distinct cyberpunk corporate signs)
  function makeSign(title, sub, jp, accent, bg) {
    const c = makeCanvas(512, 256);
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 256);
    // Scanlines
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < 256; y += 6) ctx.fillRect(0, y, 512, 2);
    // Border frame
    ctx.strokeStyle = accent;
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, 492, 236);
    // Corner accent
    ctx.fillStyle = accent;
    ctx.fillRect(22, 22, 16, 212);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText(title, 56, 104);
    ctx.fillStyle = accent;
    ctx.font = 'bold 26px monospace';
    ctx.fillText(sub, 58, 154);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText(jp, 58, 212);
    return uploadCanvas(c, false);
  }

  textures.signCyan = makeSign('ARES-IX', 'ORBITAL DEFENSE // SEC-04', 'アレス防衛システム', '#00e5ff', '#04131c');
  textures.signAmber = makeSign('LOCKDOWN', 'CURFEW PROTOCOL ACTIVE', '立入禁止 // 警戒区域', '#ff9d1c', '#1c1004');
  textures.signCrimson = makeSign('KINETIC', 'NEURAL COMBAT AUGMENTS', '戦術サイバー兵器', '#ff3344', '#1d0509');

  return textures;
}

// ============================================================================
// High-Detail Procedural Tactical Portraits (Operators & Radio Comms NPCs)
// Returned as crisp Data URLs for HUD comms & Operator Roster
// ============================================================================
export function generatePortraitDataURL(id) {
  const c = makeCanvas(240, 260);
  const ctx = c.getContext('2d');

  const palettes = {
    vance:   { bg1: '#091521', bg2: '#04080d', accent: '#00e5ff', armor: '#202934', trim: '#46576b', visor: '#00f0ff', skin: '#c4967a' },
    sato:    { bg1: '#1c0c12', bg2: '#090608', accent: '#ff3b4e', armor: '#d5dde6', trim: '#28303b', visor: '#ff4255', skin: '#dfb89d' },
    reyes:   { bg1: '#1a1509', bg2: '#090805', accent: '#f5a623', armor: '#3a4236', trim: '#635c46', visor: '#ffb42c', skin: '#9d6b4e' },
    oracle:  { bg1: '#061922', bg2: '#030a0f', accent: '#00e5ff', armor: '#192634', trim: '#2c4a66', visor: '#3cf2ff', skin: '#cfa58c' },
    specter: { bg1: '#121a14', bg2: '#050806', accent: '#36e88e', armor: '#1f2822', trim: '#384b3e', visor: '#36e88e', skin: '#b58468' },
    kaelen:  { bg1: '#240709', bg2: '#0b0304', accent: '#ff2b3a', armor: '#1b1d22', trim: '#59161d', visor: '#ff2838', skin: '#8c8f96' },
  };
  const p = palettes[id] || palettes.vance;

  // Background gradient + tactical grid ticks
  const bg = ctx.createLinearGradient(0, 0, 0, 260);
  bg.addColorStop(0, p.bg1);
  bg.addColorStop(1, p.bg2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 240, 260);

  // Subtle radial glow behind head
  const glow = ctx.createRadialGradient(120, 105, 10, 120, 105, 110);
  glow.addColorStop(0, p.accent + '44');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 240, 260);

  // Tactical background crosshairs & hex ring
  ctx.strokeStyle = p.accent + '28';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(120, 105, 76, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(15, 105); ctx.lineTo(45, 105);
  ctx.moveTo(195, 105); ctx.lineTo(225, 105);
  ctx.stroke();

  // Shoulders / Heavy Tactical Armor
  ctx.fillStyle = p.armor;
  ctx.beginPath();
  ctx.moveTo(22, 260);
  ctx.lineTo(38, 192);
  ctx.lineTo(78, 174);
  ctx.lineTo(162, 174);
  ctx.lineTo(202, 192);
  ctx.lineTo(218, 260);
  ctx.closePath();
  ctx.fill();

  // Pauldron trim & collar armor
  ctx.fillStyle = p.trim;
  ctx.beginPath();
  ctx.moveTo(64, 174); ctx.lineTo(120, 206); ctx.lineTo(176, 174);
  ctx.lineTo(166, 224); ctx.lineTo(120, 240); ctx.lineTo(74, 224);
  ctx.closePath();
  ctx.fill();

  // Glowing chest telemetry line
  ctx.fillStyle = p.accent;
  ctx.fillRect(96, 212, 48, 4);
  ctx.fillRect(54, 208, 14, 3);
  ctx.fillRect(172, 208, 14, 3);

  // Neck cyber-cables
  ctx.fillStyle = '#151a20';
  ctx.fillRect(98, 148, 44, 38);
  ctx.strokeStyle = p.accent + '88';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(106, 154); ctx.lineTo(106, 184); ctx.moveTo(134, 154); ctx.lineTo(134, 184); ctx.stroke();

  // Head / Helmet silhouette tailored per character
  if (id === 'vance' || id === 'specter' || id === 'kaelen') {
    // Full Armored Tactical Cyber-Helmet
    ctx.fillStyle = p.armor;
    ctx.beginPath();
    ctx.moveTo(74, 92);
    ctx.quadraticCurveTo(74, 42, 120, 42);
    ctx.quadraticCurveTo(166, 42, 166, 92);
    ctx.lineTo(160, 144);
    ctx.lineTo(138, 164);
    ctx.lineTo(102, 164);
    ctx.lineTo(80, 144);
    ctx.closePath();
    ctx.fill();

    // Helmet crown ridge & ear comms pods
    ctx.fillStyle = p.trim;
    ctx.fillRect(112, 42, 16, 42);
    ctx.fillRect(66, 92, 12, 34);
    ctx.fillRect(162, 92, 12, 34);

    // Glowing Cyber Visor
    ctx.shadowColor = p.visor;
    ctx.shadowBlur = 14;
    ctx.fillStyle = p.visor;
    if (id === 'kaelen') {
      // Menacing dual angular predator optics
      ctx.beginPath();
      ctx.moveTo(82, 92); ctx.lineTo(116, 102); ctx.lineTo(112, 112); ctx.lineTo(84, 106); ctx.closePath();
      ctx.moveTo(158, 92); ctx.lineTo(124, 102); ctx.lineTo(128, 112); ctx.lineTo(156, 106); ctx.closePath();
      ctx.fill();
    } else if (id === 'specter') {
      // Triple NVG / Recon lenses
      for (const lx of [94, 120, 146]) {
        ctx.beginPath(); ctx.arc(lx, 102, 9, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // Sleek JSOC split visor
      ctx.beginPath();
      ctx.moveTo(80, 94); ctx.lineTo(160, 94); ctx.lineTo(152, 112);
      ctx.lineTo(124, 108); ctx.lineTo(120, 116); ctx.lineTo(116, 108);
      ctx.lineTo(88, 112); ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Respirator jaw vents
    ctx.fillStyle = '#0e1318';
    ctx.fillRect(102, 134, 36, 18);
    ctx.fillStyle = p.trim;
    for (let vx = 106; vx <= 132; vx += 6) ctx.fillRect(vx, 137, 3, 12);
  } else {
    // Stylized Face + Cybernetic Augments (Sato, Reyes, Oracle)
    // Hair / Tech cowl
    ctx.fillStyle = id === 'sato' ? '#141821' : id === 'oracle' ? '#1b2736' : '#1f1b18';
    ctx.beginPath();
    ctx.arc(120, 92, 48, Math.PI * 0.9, Math.PI * 2.1);
    ctx.lineTo(164, 126); ctx.lineTo(76, 126); ctx.closePath();
    ctx.fill();

    // Face shape
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.moveTo(84, 88); ctx.lineTo(156, 88);
    ctx.lineTo(152, 134); ctx.lineTo(132, 160);
    ctx.lineTo(108, 160); ctx.lineTo(88, 134);
    ctx.closePath();
    ctx.fill();

    // Cyber jaw-plate for Sato / Heavy visor for Reyes / Holo-glasses for Oracle
    if (id === 'sato') {
      ctx.fillStyle = '#252c36';
      ctx.beginPath();
      ctx.moveTo(88, 130); ctx.lineTo(152, 130); ctx.lineTo(134, 162); ctx.lineTo(106, 162); ctx.closePath();
      ctx.fill();
      ctx.shadowColor = p.visor; ctx.shadowBlur = 10;
      ctx.fillStyle = p.visor;
      ctx.beginPath(); ctx.arc(138, 106, 7, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#141820';
      ctx.fillRect(96, 102, 16, 5);
    } else if (id === 'reyes') {
      // Heavy ballistic half-helmet + amber HUD visor
      ctx.fillStyle = p.armor;
      ctx.beginPath();
      ctx.arc(120, 86, 48, Math.PI, 0);
      ctx.lineTo(168, 100); ctx.lineTo(72, 100); ctx.closePath();
      ctx.fill();
      ctx.shadowColor = p.visor; ctx.shadowBlur = 12;
      ctx.fillStyle = p.visor;
      ctx.fillRect(82, 98, 76, 14);
      ctx.shadowBlur = 0;
    } else {
      // Oracle holographic tactical eyewear
      ctx.shadowColor = p.visor; ctx.shadowBlur = 12;
      ctx.fillStyle = p.visor + 'cc';
      ctx.fillRect(84, 98, 72, 13);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#223142';
      ctx.fillRect(68, 96, 14, 24);
      ctx.fillRect(158, 96, 14, 24);
    }
  }

  // Scanline overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
  for (let y = 0; y < 260; y += 4) ctx.fillRect(0, y, 240, 1.5);

  // Corner tactical frame
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(8, 28); ctx.lineTo(8, 8); ctx.lineTo(28, 8);
  ctx.moveTo(212, 8); ctx.lineTo(232, 8); ctx.lineTo(232, 28);
  ctx.moveTo(8, 232); ctx.lineTo(8, 252); ctx.lineTo(28, 252);
  ctx.moveTo(212, 252); ctx.lineTo(232, 252); ctx.lineTo(232, 232);
  ctx.stroke();

  return c.toDataURL('image/png');
}
