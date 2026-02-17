// ============================================
// LOOT BOX / CRATE SYSTEM
// CS2-Style Unboxing with Rarity System
// ============================================

console.log('📦 Loading crate system...');

// ============================================
// WEB AUDIO SOUND ENGINE (works on file:// too)
// ============================================

const _crateAudioCtx = (() => {
  try { return new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; }
})();

function cratePlaySound(type) {
  if (!_crateAudioCtx) return;
  // Resume context on first user gesture (browser autoplay policy)
  if (_crateAudioCtx.state === 'suspended') _crateAudioCtx.resume();

  const ctx = _crateAudioCtx;
  const now = ctx.currentTime;

  function tone(freq, gainVal, duration, waveType = 'sine', endFreq = null) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.linearRampToValueAtTime(endFreq, now + duration);
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration);
  }

  switch (type) {
    case 'tick':
      tone(600, 0.08, 0.04, 'square');
      break;
    case 'spin_start':
      // Rising sweep
      tone(200, 0.12, 0.4, 'sawtooth', 600);
      break;
    case 'land':
      tone(440, 0.25, 0.15, 'sine');
      setTimeout(() => tone(550, 0.2, 0.2, 'sine'), 80);
      break;
    case 'epic_land':
      tone(350, 0.3, 0.2, 'sine', 700);
      setTimeout(() => tone(700, 0.25, 0.3, 'sine'), 100);
      setTimeout(() => tone(880, 0.2, 0.4, 'sine'), 220);
      break;
    case 'legendary_land':
      tone(300, 0.35, 0.25, 'sine', 900);
      setTimeout(() => tone(600, 0.3, 0.3, 'sine'), 80);
      setTimeout(() => tone(900, 0.28, 0.4, 'sine'), 180);
      setTimeout(() => tone(1200, 0.22, 0.5, 'sine'), 300);
      break;
    case 'win':
      // Happy chord
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.2, 0.4, 'sine'), i * 80));
      break;
    case 'coin':
      tone(880, 0.15, 0.1, 'sine');
      setTimeout(() => tone(1100, 0.12, 0.15, 'sine'), 80);
      break;
  }
}


// ============================================
// CRATE DEFINITIONS
// ============================================

const CRATES = [
  {
    id: 'common-crate',
    name: 'Common Crate',
    price: 500,
    color: '#78b7ff',
    desc: 'Contains 1 random skin from the common pool',
    icon: '📦',
    rarityWeights: {
      common: 0.70,    // 70% chance
      uncommon: 0.25,  // 25% chance
      rare: 0.05       // 5% chance
    }
  },
  {
    id: 'rare-crate',
    name: 'Rare Crate',
    price: 1200,
    color: '#9d7aff',
    desc: 'Better odds! Contains 1 skin with higher rarity chances',
    icon: '🎁',
    rarityWeights: {
      common: 0.40,    // 40% chance
      uncommon: 0.40,  // 40% chance
      rare: 0.15,      // 15% chance
      epic: 0.05       // 5% chance
    }
  },
  {
    id: 'epic-crate',
    name: 'Epic Crate',
    price: 2500,
    color: '#ff78b7',
    desc: 'Premium crate with guaranteed epic or better!',
    icon: '🎭',
    rarityWeights: {
      uncommon: 0.30,  // 30% chance
      rare: 0.40,      // 40% chance
      epic: 0.25,      // 25% chance
      legendary: 0.05  // 5% chance
    }
  },
  {
    id: 'legendary-crate',
    name: 'Legendary Crate',
    price: 5000,
    color: '#ffd700',
    desc: 'Ultimate crate! Guaranteed legendary or mythic skin!',
    icon: '⭐',
    rarityWeights: {
      rare: 0.20,      // 20% chance
      epic: 0.40,      // 40% chance
      legendary: 0.35, // 35% chance
      mythic: 0.05     // 5% chance
    }
  },
  {
    id: 'icon-crate',
    name: 'Icon Skins Crate',
    price: 1000,  // Icon skins priced at 1000 (do not change)
    color: '#00ff9d',
    desc: 'Exclusive friend skins! 8 regular + 1 ultra-rare secret!',
    icon: '🎯',
    rarityWeights: {
      icon: 0.995,   // 99.5% chance - shared among 8 skins (12.4375% each)
      creator: 0.005 // 0.5% chance - THE CREATOR only
    }
  }
];

// ============================================
// SKIN RARITY CLASSIFICATIONS
// ============================================

const SKIN_RARITIES = {
  common:    ['c_static', 'c_rust', 'c_slate', 'c_olive', 'c_maroon'],
  uncommon:  ['c_cobalt', 'c_teal', 'c_coral', 'c_sand', 'c_chrome'],
  rare:      ['c_prism', 'c_aurora', 'c_lava', 'c_storm', 'c_neon'],
  epic:      ['c_glitch', 'c_nebula', 'c_biohazard', 'c_arctic', 'c_wildfire', 'c_spectre'],
  legendary: ['c_supernova', 'c_wraith', 'c_titan', 'c_astral'],
  mythic:    ['c_omnichrome', 'c_singularity', 'c_ultraviolet', 'c_godmode', 'c_rift']
};

// Icon Skins - Split into regular and ultra-rare creator
const ICON_SKIN_RARITIES = {
  icon: ['icon_noah_brown', 'icon_keegan_baseball', 'icon_dpoe_fade', 'icon_evan_watermelon', 'icon_gavin_tzl', 'icon_carter_cosmic', 'icon_brody_flag', 'icon_sterling', 'icon_justin_clover'], // 99.5% shared among these 9
  creator: ['icon_the_creator'] // 0.5% chance - ultra rare
};

// ============================================
// CRATE OPENING LOGIC
// ============================================

function getRarityColor(rarity) {
  const colors = {
    common: '#78b7ff',
    uncommon: '#9d7aff',
    rare: '#ff78b7',
    epic: '#ff9d47',
    legendary: '#ffd700',
    mythic: '#ff69ff',
    icon: '#00ff9d',
    creator: '#ffd700' // Divine gold for THE CREATOR
  };
  return colors[rarity] || '#78b7ff';
}

function getRarityName(rarity) {
  const names = {
    common: 'COMMON',
    uncommon: 'UNCOMMON',
    rare: 'RARE',
    epic: 'EPIC',
    legendary: 'LEGENDARY',
    mythic: 'MYTHIC',
    icon: 'ICON',
    creator: 'DIVINE' // Special name for THE CREATOR
  };
  return names[rarity] || 'COMMON';
}

function rollRarity(crate) {
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [rarity, weight] of Object.entries(crate.rarityWeights)) {
    cumulative += weight;
    if (rand < cumulative) {
      return rarity;
    }
  }
  
  // Fallback
  return Object.keys(crate.rarityWeights)[0];
}

function getRandomSkinFromRarity(rarity, crateId) {
  // Use icon skin pool for icon crate, regular pool for others
  const pool = crateId === 'icon-crate' 
    ? (ICON_SKIN_RARITIES[rarity] || ICON_SKIN_RARITIES.common)
    : (SKIN_RARITIES[rarity] || SKIN_RARITIES.common);
  return pool[Math.floor(Math.random() * pool.length)];
}

function openCrate(crateId) {
  const crate = CRATES.find(c => c.id === crateId);
  if (!crate) return null;
  
  // Check if player has enough coins
  if (playerCoins < crate.price) {
    showCrateMessage('Not enough coins!', true);
    return null;
  }
  
  // Deduct coins
  playerCoins -= crate.price;
  saveCoins();
  
  // Roll for exactly 1 item
  const rewards = [];
  
  // ═══ DEV: Force THE CREATOR if flag is set ═══
  let rarity, skinId;
  
  if (crateId === 'icon-crate' && typeof devForceCreatorFlag !== 'undefined' && devForceCreatorFlag) {
    // Force THE CREATOR
    rarity = 'creator';
    skinId = 'icon_the_creator';
    devForceCreatorFlag = false; // Reset flag after use
    console.log('👑 DEV FORCE: THE CREATOR guaranteed in this crate!');
  } else {
    // Normal random roll
    rarity = rollRarity(crate);
    skinId = getRandomSkinFromRarity(rarity, crateId);
  }
  
  const skin = SKINS.find(s => s.id === skinId);
  
  if (skin) {
    const isDuplicate = ownedSkins.includes(skinId);
    let coinValue = 0;
    
    if (isDuplicate) {
      // Convert duplicate to coins based on rarity
      const rarityValues = {
        common: 25,
        uncommon: 50,
        rare: 100,
        epic: 200,
        legendary: 400,
        mythic: 750,
        icon: 150,      // Icon skins duplicate value
        creator: 1000   // THE CREATOR duplicate value (ultra-rare 0.5%)
      };
      coinValue = rarityValues[rarity] || 50;
      playerCoins += coinValue;
    } else {
      // Add new skin to owned skins
      ownedSkins.push(skinId);
    }
    
    rewards.push({
      skin,
      rarity,
      isDuplicate,
      coinValue
    });
  }
  
  saveCoins();
  saveSkins();
  
  return {
    crate,
    rewards
  };
}

// ============================================
// CRATE OPENING ANIMATION
// ============================================

let isOpeningCrate = false;

function showCrateOpeningAnimation(crateId) {
  if (isOpeningCrate) return;
  
  const result = openCrate(crateId);
  if (!result) return;
  
  isOpeningCrate = true;
  const modal = document.getElementById('crateOpenModal');
  const animation = document.getElementById('crateOpenAnimation');
  const results = document.getElementById('crateResults');
  
  // Show modal with animation
  modal.classList.remove('hidden');
  animation.classList.remove('hidden');
  results.classList.add('hidden');
  
  // Create spinning items reel (CS2 style)
  const reel = document.getElementById('crateReel');
  reel.innerHTML = '';
  
  // Store the winning item
  const winningItem = result.rewards[0];

  // CS2 Style: Generate more items for longer scroll (80 items, winner at position 70)
  const totalItems = 80;
  const winningPosition = 70;
  const reelItems = [];
  
  for (let i = 0; i < totalItems; i++) {
    if (i === winningPosition) {
      // Place the ACTUAL winning item here
      reelItems[i] = {
        skin: winningItem.skin,
        rarity: winningItem.rarity,
        isDuplicate: winningItem.isDuplicate,
        coinValue: winningItem.coinValue
      };
    } else {
      // Generate random items for other positions
      const randomRarity = rollRarity(result.crate);
      const randomSkin = getRandomSkinFromRarity(randomRarity, result.crate.id);
      const skin = SKINS.find(s => s.id === randomSkin);
      reelItems[i] = { skin, rarity: randomRarity };
    }
  }

  // Create reel items
  reelItems.forEach((item, index) => {
    const reelItem = document.createElement('div');
    reelItem.className = 'crate-reel-item';
    
    // Mark the winning item
    if (index === winningPosition) {
      reelItem.classList.add('winning-item');
      reelItem.setAttribute('data-winner', 'true');
    }
    
    reelItem.style.background = `linear-gradient(135deg, ${getRarityColor(item.rarity)}55, ${getRarityColor(item.rarity)}22)`;
    reelItem.style.borderColor = getRarityColor(item.rarity);
    
    const preview = document.createElement('div');
    preview.className = 'crate-item-preview';

    // Rich reel previews matching the skin tier visuals
    const reelPreviewStyles = {
      // COMMON
      c_static:    { bg: 'radial-gradient(circle, #c8c8dc 0%, #808090 60%, #404050 100%)', shadow: '#b8b8cc' },
      c_rust:      { bg: 'radial-gradient(circle, #c06030 0%, #8b4513 55%, #4a2008 100%)', shadow: '#8b4513' },
      c_slate:     { bg: 'radial-gradient(circle, #8090a0 0%, #607080 55%, #303840 100%)', shadow: '#708090' },
      c_olive:     { bg: 'radial-gradient(circle, #9ab040 0%, #6b8e23 55%, #344010 100%)', shadow: '#6b8e23' },
      c_maroon:    { bg: 'radial-gradient(circle, #cc3050 0%, #9b2335 55%, #4a0f1a 100%)', shadow: '#9b2335' },
      // UNCOMMON
      c_cobalt:    { bg: 'radial-gradient(circle, #3080ff 0%, #0047ab 55%, #001a60 100%)', shadow: '#3080ff' },
      c_teal:      { bg: 'radial-gradient(circle, #00c8b0 0%, #00897b 55%, #003830 100%)', shadow: '#00c8b0' },
      c_coral:     { bg: 'radial-gradient(circle, #ff9080 0%, #ff6f61 55%, #a02010 100%)', shadow: '#ff6f61' },
      c_sand:      { bg: 'radial-gradient(circle, #e0c870 0%, #c2a25a 55%, #6a5020 100%)', shadow: '#c2a25a' },
      c_chrome:    { bg: 'linear-gradient(135deg, #666 0%, #ddd 25%, #999 50%, #fff 75%, #888 100%)', shadow: '#ccc', anim: 'quantumSpin 3s linear infinite' },
      // RARE
      c_prism:     { bg: 'conic-gradient(red,orange,yellow,green,cyan,blue,violet,red)', shadow: 'white', anim: 'quantumSpin 2s linear infinite' },
      c_aurora:    { bg: 'linear-gradient(180deg,#00ff99 0%,#00aaff 40%,#9900cc 100%)', shadow: '#00ff99', anim: 'galaxyShimmer 2.5s ease-in-out infinite' },
      c_lava:      { bg: 'radial-gradient(circle,#ffcc00 0%,#ff4500 45%,#cc0000 75%,#440000 100%)', shadow: '#ff4500', anim: 'voidPulse 1.5s ease-in-out infinite' },
      c_storm:     { bg: 'radial-gradient(circle,#c0d8ff 0%,#4080ff 35%,#0020a0 65%,#000820 100%)', shadow: '#4080ff', anim: 'voidPulse 2s ease-in-out infinite' },
      c_neon:      { bg: 'linear-gradient(135deg,#ff00cc 0%,#00ffff 50%,#ff00cc 100%)', shadow: '#ff00cc', anim: 'quantumSpin 3s linear infinite' },
      // EPIC
      c_glitch:    { bg: 'conic-gradient(#ff0080,#00ffff,#ff0000,#00ff00,#ff00ff,#0000ff,#ff0080)', shadow: '#ff0080', anim: 'quantumSpin 0.6s linear infinite' },
      c_nebula:    { bg: 'radial-gradient(circle at 40% 35%,#ff80cc 0%,#9922cc 35%,#220066 65%,#110033 100%)', shadow: '#9922cc', anim: 'galaxyShimmer 2s ease-in-out infinite' },
      c_biohazard: { bg: 'radial-gradient(circle,#ccff00 0%,#39ff14 30%,#006600 65%,#001a00 100%)', shadow: '#39ff14', anim: 'voidPulse 1.2s ease-in-out infinite' },
      c_arctic:    { bg: 'radial-gradient(circle,#ffffff 0%,#aaeeff 25%,#00c8ff 55%,#004466 100%)', shadow: '#00e5ff', anim: 'galaxyShimmer 3s ease-in-out infinite' },
      c_wildfire:  { bg: 'radial-gradient(circle,#ffffff 0%,#ffff00 20%,#ff6600 50%,#cc0000 75%,#300000 100%)', shadow: '#ff6600', anim: 'voidPulse 0.9s ease-in-out infinite' },
      c_spectre:   { bg: 'radial-gradient(circle,rgba(255,255,255,0.95) 0%,rgba(180,180,255,0.8) 35%,rgba(80,80,200,0.5) 65%,rgba(20,20,80,0.3) 100%)', shadow: 'rgba(160,160,255,0.9)', anim: 'voidPulse 2.5s ease-in-out infinite' },
      // LEGENDARY
      c_supernova: { bg: 'conic-gradient(white,yellow,orange,red,magenta,blue,cyan,white)', shadow: 'white', anim: 'quantumSpin 1.5s linear infinite' },
      c_wraith:    { bg: 'radial-gradient(circle,#8800ff 0%,#440088 30%,#1a0033 60%,#000000 100%)', shadow: '#8800ff', anim: 'voidPulse 2s ease-in-out infinite' },
      c_titan:     { bg: 'radial-gradient(circle,#ffe080 0%,#f5a623 30%,#b87333 60%,#3c1a00 100%)', shadow: '#f5a623', anim: 'celestialGlow 2.5s ease-in-out infinite' },
      c_astral:    { bg: 'linear-gradient(135deg,#00e5ff 0%,#7b2ff7 35%,#ff00aa 65%,#00e5ff 100%)', shadow: '#7b2ff7', anim: 'quantumSpin 4s linear infinite' },
      // MYTHIC
      c_omnichrome:{ bg: 'conic-gradient(red,orange,yellow,lime,cyan,blue,violet,magenta,red)', shadow: 'white', anim: 'quantumSpin 0.7s linear infinite' },
      c_singularity:{ bg: 'conic-gradient(#ff0080,#00ffff,#8000ff,#ff0080)', shadow: '#7700ff', anim: 'quantumSpin 2s linear infinite' },
      c_ultraviolet:{ bg: 'radial-gradient(circle,#ff88ff 0%,#cc00ff 30%,#6600cc 60%,#200033 100%)', shadow: '#cc00ff', anim: 'voidPulse 1.5s ease-in-out infinite' },
      c_godmode:   { bg: 'radial-gradient(circle,#ffffff 0%,#fffdd0 20%,#fff59d 50%,#ffd700 80%,#fff 100%)', shadow: 'white', anim: 'diamondShine 1.8s ease-in-out infinite' },
      c_rift:      { bg: 'linear-gradient(135deg,#000 0%,#1a0044 25%,#ff00aa 50%,#00ffff 75%,#000 100%)', shadow: '#ff00aa', anim: 'quantumSpin 2.5s linear infinite' },
      // ICON SKINS - EXACT MATCH TO SHOP
      icon_noah_brown:      { bg: '#6b4423', shadow: '0 0 18px #6b4423' },
      icon_keegan_baseball: { bg: 'radial-gradient(circle,#ffffff 0%,#f9f9f9 35%,#f5f5f5 70%,#e8e8e8 100%),repeating-conic-gradient(from 45deg at 35% 50%,transparent 0deg,transparent 2deg,#d32f2f 2deg,#d32f2f 4deg,transparent 4deg,transparent 176deg,#d32f2f 176deg,#d32f2f 178deg,transparent 178deg),repeating-conic-gradient(from 45deg at 65% 50%,transparent 0deg,transparent 2deg,#d32f2f 2deg,#d32f2f 4deg,transparent 4deg,transparent 176deg,#d32f2f 176deg,#d32f2f 178deg,transparent 178deg)', shadow: '0 0 22px rgba(210,47,47,0.45), 0 0 6px rgba(150,150,150,0.25)' },
      icon_dpoe_fade:       { bg: 'linear-gradient(135deg, #ff69b4 0%, #ff9ec4 35%, #a8d8ea 65%, #89cff0 100%)', shadow: '0 0 22px #a8d8ea' },
      icon_evan_watermelon: { bg: 'radial-gradient(circle, #ff6b9d 0%, #ff4466 30%, #ff1744 50%, #4caf50 70%, #2e7d32 100%)', shadow: '0 0 20px #ff4466, inset 0 0 15px rgba(46, 125, 50, 0.3)', anim: 'voidPulse 2s ease-in-out infinite' },
      icon_gavin_tzl:       { bg: 'linear-gradient(135deg, #dc143c 0%, #ffffff 50%, #0047ab 100%)', shadow: '0 0 25px #0047ab, 0 0 35px rgba(220, 20, 60, 0.5)', anim: 'quantumSpin 3s linear infinite', border: '2px solid rgba(255, 255, 255, 0.5)' },
      icon_carter_cosmic:   { bg: 'radial-gradient(circle, #ff2020 0%, #cc0000 40%, #660000 70%, #1a0000 100%)', shadow: '0 0 25px #cc0000' },
      icon_brody_flag:      { bg: 'linear-gradient(to bottom, #b22234 0%, #b22234 7.7%, #ffffff 7.7%, #ffffff 15.4%, #b22234 15.4%, #b22234 23.1%, #ffffff 23.1%, #ffffff 30.8%, #b22234 30.8%, #b22234 38.5%, #ffffff 38.5%, #ffffff 46.2%, #b22234 46.2%, #b22234 53.9%, #ffffff 53.9%, #ffffff 61.6%, #b22234 61.6%, #b22234 69.3%, #ffffff 69.3%, #ffffff 77%, #b22234 77%, #b22234 84.7%, #ffffff 84.7%, #ffffff 92.4%, #b22234 92.4%, #b22234 100%)', shadow: '0 0 22px #3c3b6e, inset 0 0 30px rgba(60,59,110,0.3)', anim: 'flagWave 2s ease-in-out infinite' },
      icon_sterling:        { bg: 'radial-gradient(circle at 30% 30%, #0064ff 0%, #0050cc 30%, #003399 60%, #000000 100%)', shadow: '0 0 25px #0064ff, 0 0 40px rgba(0, 100, 255, 0.5)', anim: 'sterlingPulse 3s ease-in-out infinite' },
      icon_justin_clover:   { bg: 'radial-gradient(circle, #39ff14 0%, #1a8c2e 40%, #0d5c1a 70%, #042b0a 100%)', shadow: '0 0 25px #39ff14, 0 0 40px rgba(26, 140, 46, 0.5)', anim: 'voidPulse 2s ease-in-out infinite' },
      icon_the_creator:     { bg: 'conic-gradient(from 0deg, #ffd700, #ffffff, #ff69b4, #00ffff, #9d4edd, #ffd700)', shadow: '0 0 40px rgba(255, 215, 0, 0.9), 0 0 60px rgba(255, 255, 255, 0.6), 0 0 80px rgba(157, 78, 221, 0.5)', anim: 'creatorDivine 4s linear infinite', border: '2px solid rgba(255, 255, 255, 0.8)' },
    };
    const ps = reelPreviewStyles[item.skin.id];
    if (ps) {
      preview.style.background = ps.bg;
      // If shadow contains comma (multiple shadows) or starts with "0 0", use it directly
      if (ps.shadow.includes(',') || ps.shadow.startsWith('0 0')) {
        preview.style.boxShadow = ps.shadow;
      } else {
        preview.style.boxShadow = ps.shadow;
      }
      if (ps.anim) preview.style.animation = ps.anim;
      if (ps.border) preview.style.border = ps.border;
    } else {
      preview.style.background = item.skin.color || getRarityColor(item.rarity);
      preview.style.boxShadow = `0 0 15px ${getRarityColor(item.rarity)}`;
    }
    
    const name = document.createElement('div');
    name.className = 'crate-item-name';
    name.textContent = item.skin.name;
    
    const rarityTag = document.createElement('div');
    rarityTag.className = 'crate-item-rarity';
    rarityTag.textContent = getRarityName(item.rarity);
    rarityTag.style.color = getRarityColor(item.rarity);
    
    reelItem.appendChild(preview);
    reelItem.appendChild(name);
    reelItem.appendChild(rarityTag);
    reel.appendChild(reelItem);
  });
  
  // Play opening animation sound
  cratePlaySound('spin_start');
  
  // Animate the reel - CS2 style
  // Measure actual rendered item size (accounts for padding/border/CSS)
  const firstReelItem = reel.querySelector('.crate-reel-item');
  const actualItemWidth = firstReelItem ? firstReelItem.offsetWidth : 120;
  const reelGap = 20; // must match CSS gap on .crate-reel
  const itemSlotWidth = actualItemWidth + reelGap;
  
  // CS2 Style: Perfect centering (no random offset)
  // The reel starts at left:50% in CSS, so item 0's left edge is at container center.
  // To center the winning item: translate = -(winningPosition * slotWidth + itemWidth/2)
  const targetPosition = -(winningPosition * itemSlotWidth + actualItemWidth / 2);
  
  // CS2 Style: Longer spin duration with slight variance (7-9 seconds)
  const spinDuration = 7000 + Math.random() * 2000; // 7-9 seconds
  
  // Start slow
  reel.style.transition = 'none';
  reel.style.transform = 'translateX(0)';
  
  // CS2 Style: Smooth deceleration with custom easing
  // cubic-bezier for that signature CS2 slow-down feel
  setTimeout(() => {
    reel.style.transition = `transform ${spinDuration}ms cubic-bezier(0.1, 0.6, 0.2, 1)`;
    reel.style.transform = `translateX(${targetPosition}px)`;
  }, 50);
  
  // CS2 Style: Tick sounds during spin with realistic deceleration
  let tickInterval = 60; // Start faster than before
  let lastTickTime = Date.now();
  
  function playTicksDeceleratingCS2(elapsed, duration) {
    if (elapsed >= duration - 300) return; // Stop ticking near the end
    
    const now = Date.now();
    if (now - lastTickTime >= tickInterval) {
      cratePlaySound('tick');
      lastTickTime = now;
      
      // CS2 Style: Gradual slowdown curve
      const progress = elapsed / duration;
      // Exponential slowdown for that CS2 feel
      tickInterval = 60 + Math.floor(Math.pow(progress, 2.5) * 400);
    }
    
    requestAnimationFrame(() => playTicksDeceleratingCS2(elapsed + 16, duration));
  }
  setTimeout(() => playTicksDeceleratingCS2(0, spinDuration), 100);
  
  // CS2 Style: Landing animation triggers just before stop
  const landingTime = spinDuration - 400; // 400ms before completion
  setTimeout(() => {
    // Play special landing sound based on rarity
    const reward = winningItem;
    if (reward.rarity === 'legendary' || reward.rarity === 'mythic') {
      cratePlaySound('legendary_land');
    } else if (reward.rarity === 'epic') {
      cratePlaySound('epic_land');
    } else {
      cratePlaySound('land');
    }
    
    // Add glow effect to winning item
    const winningItemEl = document.querySelector('.winning-item');
    if (winningItemEl) {
      winningItemEl.classList.add('item-landed');
    }
  }, landingTime);
  
  // CS2 Style: Show results after full animation completes
  const totalAnimationTime = spinDuration + 600; // Extra 600ms for impact
  setTimeout(() => {
    animation.classList.add('hidden');
    results.classList.remove('hidden');
    displayCrateResults(result);
    
    // Final celebration sound
    const reward = winningItem;
    if (!reward.isDuplicate) {
      cratePlaySound('win');
    } else {
      cratePlaySound('coin');
    }
  }, totalAnimationTime);
}

function displayCrateResults(result) {
  const container = document.getElementById('crateRewardsList');
  container.innerHTML = '';
  
  const reward = result.rewards[0]; // Only 1 item now
  
  const card = document.createElement('div');
  card.className = 'crate-reward-card single-reward';
  card.style.borderColor = getRarityColor(reward.rarity);
  card.style.background = `linear-gradient(135deg, ${getRarityColor(reward.rarity)}33, ${getRarityColor(reward.rarity)}11)`;
  card.style.boxShadow = `0 0 40px ${getRarityColor(reward.rarity)}77`;
  
  const preview = document.createElement('div');
  preview.className = 'crate-reward-preview large-preview';
  // Use same rich style map as reel items
  const resultPreviewStyles = {
    c_static:    { bg:'radial-gradient(circle,#c8c8dc 0%,#808090 60%,#404050 100%)',sh:'#b8b8cc' },
    c_rust:      { bg:'radial-gradient(circle,#c06030 0%,#8b4513 55%,#4a2008 100%)',sh:'#8b4513' },
    c_slate:     { bg:'radial-gradient(circle,#8090a0 0%,#607080 55%,#303840 100%)',sh:'#708090' },
    c_olive:     { bg:'radial-gradient(circle,#9ab040 0%,#6b8e23 55%,#344010 100%)',sh:'#6b8e23' },
    c_maroon:    { bg:'radial-gradient(circle,#cc3050 0%,#9b2335 55%,#4a0f1a 100%)',sh:'#9b2335' },
    c_cobalt:    { bg:'radial-gradient(circle,#3080ff 0%,#0047ab 55%,#001a60 100%)',sh:'#3080ff' },
    c_teal:      { bg:'radial-gradient(circle,#00c8b0 0%,#00897b 55%,#003830 100%)',sh:'#00c8b0' },
    c_coral:     { bg:'radial-gradient(circle,#ff9080 0%,#ff6f61 55%,#a02010 100%)',sh:'#ff6f61' },
    c_sand:      { bg:'radial-gradient(circle,#e0c870 0%,#c2a25a 55%,#6a5020 100%)',sh:'#c2a25a' },
    c_chrome:    { bg:'linear-gradient(135deg,#666 0%,#ddd 25%,#999 50%,#fff 75%,#888 100%)',sh:'#ccc',an:'quantumSpin 2s linear infinite' },
    c_prism:     { bg:'conic-gradient(red,orange,yellow,green,cyan,blue,violet,red)',sh:'white',an:'quantumSpin 1.5s linear infinite' },
    c_aurora:    { bg:'linear-gradient(180deg,#00ff99 0%,#00aaff 40%,#9900cc 100%)',sh:'#00ff99',an:'galaxyShimmer 2.5s ease-in-out infinite' },
    c_lava:      { bg:'radial-gradient(circle,#ffcc00 0%,#ff4500 45%,#cc0000 75%,#440000 100%)',sh:'#ff4500',an:'voidPulse 1.5s ease-in-out infinite' },
    c_storm:     { bg:'radial-gradient(circle,#c0d8ff 0%,#4080ff 35%,#0020a0 65%,#000820 100%)',sh:'#4080ff',an:'voidPulse 2s ease-in-out infinite' },
    c_neon:      { bg:'linear-gradient(135deg,#ff00cc 0%,#00ffff 50%,#ff00cc 100%)',sh:'#ff00cc',an:'quantumSpin 2.5s linear infinite' },
    c_glitch:    { bg:'conic-gradient(#ff0080,#00ffff,#ff0000,#00ff00,#ff00ff,#0000ff,#ff0080)',sh:'#ff0080',an:'quantumSpin 0.5s linear infinite' },
    c_nebula:    { bg:'radial-gradient(circle at 40% 35%,#ff80cc 0%,#9922cc 35%,#220066 65%,#110033 100%)',sh:'#9922cc',an:'galaxyShimmer 2s ease-in-out infinite' },
    c_biohazard: { bg:'radial-gradient(circle,#ccff00 0%,#39ff14 30%,#006600 65%,#001a00 100%)',sh:'#39ff14',an:'voidPulse 1.2s ease-in-out infinite' },
    c_arctic:    { bg:'radial-gradient(circle,#ffffff 0%,#aaeeff 25%,#00c8ff 55%,#004466 100%)',sh:'#00e5ff',an:'galaxyShimmer 3s ease-in-out infinite' },
    c_wildfire:  { bg:'radial-gradient(circle,#ffffff 0%,#ffff00 20%,#ff6600 50%,#cc0000 75%,#300000 100%)',sh:'#ff6600',an:'voidPulse 0.9s ease-in-out infinite' },
    c_spectre:   { bg:'radial-gradient(circle,rgba(255,255,255,0.95) 0%,rgba(180,180,255,0.8) 35%,rgba(80,80,200,0.5) 65%,rgba(20,20,80,0.3) 100%)',sh:'rgba(160,160,255,0.9)',an:'voidPulse 2.5s ease-in-out infinite' },
    c_supernova: { bg:'conic-gradient(white,yellow,orange,red,magenta,blue,cyan,white)',sh:'white',an:'quantumSpin 1.5s linear infinite' },
    c_wraith:    { bg:'radial-gradient(circle,#8800ff 0%,#440088 30%,#1a0033 60%,#000000 100%)',sh:'#8800ff',an:'voidPulse 2s ease-in-out infinite' },
    c_titan:     { bg:'radial-gradient(circle,#ffe080 0%,#f5a623 30%,#b87333 60%,#3c1a00 100%)',sh:'#f5a623',an:'celestialGlow 2.5s ease-in-out infinite' },
    c_astral:    { bg:'linear-gradient(135deg,#00e5ff 0%,#7b2ff7 35%,#ff00aa 65%,#00e5ff 100%)',sh:'#7b2ff7',an:'quantumSpin 4s linear infinite' },
    c_omnichrome:{ bg:'conic-gradient(red,orange,yellow,lime,cyan,blue,violet,magenta,red)',sh:'white',an:'quantumSpin 0.7s linear infinite' },
    c_singularity:{ bg:'conic-gradient(#ff0080,#00ffff,#8000ff,#ff0080)',sh:'#7700ff',an:'quantumSpin 2s linear infinite' },
    c_ultraviolet:{ bg:'radial-gradient(circle,#ff88ff 0%,#cc00ff 30%,#6600cc 60%,#200033 100%)',sh:'#cc00ff',an:'voidPulse 1.5s ease-in-out infinite' },
    c_godmode:   { bg:'radial-gradient(circle,#ffffff 0%,#fffdd0 20%,#fff59d 50%,#ffd700 80%,#fff 100%)',sh:'white',an:'diamondShine 1.8s ease-in-out infinite' },
    c_rift:      { bg:'linear-gradient(135deg,#000 0%,#1a0044 25%,#ff00aa 50%,#00ffff 75%,#000 100%)',sh:'#ff00aa',an:'quantumSpin 2.5s linear infinite' },
    // Icon Skins - EXACT MATCH TO SHOP
    icon_noah_brown:      { bg:'#6b4423',sh:'0 0 18px #6b4423' },
    icon_keegan_baseball: { bg:'radial-gradient(circle,#ffffff 0%,#f9f9f9 35%,#f5f5f5 70%,#e8e8e8 100%),repeating-conic-gradient(from 45deg at 35% 50%,transparent 0deg,transparent 2deg,#d32f2f 2deg,#d32f2f 4deg,transparent 4deg,transparent 176deg,#d32f2f 176deg,#d32f2f 178deg,transparent 178deg),repeating-conic-gradient(from 45deg at 65% 50%,transparent 0deg,transparent 2deg,#d32f2f 2deg,#d32f2f 4deg,transparent 4deg,transparent 176deg,#d32f2f 176deg,#d32f2f 178deg,transparent 178deg)',sh:'0 0 22px rgba(210,47,47,0.45), 0 0 6px rgba(150,150,150,0.25)' },
    icon_dpoe_fade:       { bg:'linear-gradient(135deg, #ff69b4 0%, #ff9ec4 35%, #a8d8ea 65%, #89cff0 100%)',sh:'0 0 22px #a8d8ea' },
    icon_evan_watermelon: { bg:'radial-gradient(circle, #ff6b9d 0%, #ff4466 30%, #ff1744 50%, #4caf50 70%, #2e7d32 100%)',sh:'0 0 20px #ff4466, inset 0 0 15px rgba(46, 125, 50, 0.3)',an:'voidPulse 2s ease-in-out infinite' },
    icon_gavin_tzl:       { bg:'linear-gradient(135deg, #dc143c 0%, #ffffff 50%, #0047ab 100%)',sh:'0 0 25px #0047ab, 0 0 35px rgba(220, 20, 60, 0.5)',an:'quantumSpin 3s linear infinite',border:'2px solid rgba(255, 255, 255, 0.5)' },
    icon_carter_cosmic:   { bg:'radial-gradient(circle, #ff2020 0%, #cc0000 40%, #660000 70%, #1a0000 100%)',sh:'0 0 25px #cc0000' },
    icon_brody_flag:      { bg:'linear-gradient(to bottom, #b22234 0%, #b22234 7.7%, #ffffff 7.7%, #ffffff 15.4%, #b22234 15.4%, #b22234 23.1%, #ffffff 23.1%, #ffffff 30.8%, #b22234 30.8%, #b22234 38.5%, #ffffff 38.5%, #ffffff 46.2%, #b22234 46.2%, #b22234 53.9%, #ffffff 53.9%, #ffffff 61.6%, #b22234 61.6%, #b22234 69.3%, #ffffff 69.3%, #ffffff 77%, #b22234 77%, #b22234 84.7%, #ffffff 84.7%, #ffffff 92.4%, #b22234 92.4%, #b22234 100%)',sh:'0 0 22px #3c3b6e, inset 0 0 30px rgba(60,59,110,0.3)',an:'flagWave 2s ease-in-out infinite' },
    icon_sterling:        { bg:'radial-gradient(circle at 30% 30%, #0064ff 0%, #0050cc 30%, #003399 60%, #000000 100%)',sh:'0 0 25px #0064ff, 0 0 40px rgba(0, 100, 255, 0.5)',an:'sterlingPulse 3s ease-in-out infinite' },
    icon_justin_clover:   { bg:'radial-gradient(circle, #39ff14 0%, #1a8c2e 40%, #0d5c1a 70%, #042b0a 100%)',sh:'0 0 25px #39ff14, 0 0 40px rgba(26, 140, 46, 0.5)',an:'voidPulse 2s ease-in-out infinite' },
    icon_the_creator:     { bg:'conic-gradient(from 0deg, #ffd700, #ffffff, #ff69b4, #00ffff, #9d4edd, #ffd700)',sh:'0 0 40px rgba(255, 215, 0, 0.9), 0 0 60px rgba(255, 255, 255, 0.6), 0 0 80px rgba(157, 78, 221, 0.5)',an:'creatorDivine 4s linear infinite',border:'2px solid rgba(255, 255, 255, 0.8)' },
  };
  const rps = resultPreviewStyles[reward.skin.id];
  if (rps) {
    preview.style.background = rps.bg;
    // If shadow contains comma (multiple shadows) or starts with "0 0", use it directly
    if (rps.sh.includes(',') || rps.sh.startsWith('0 0')) {
      preview.style.boxShadow = rps.sh;
    } else {
      preview.style.boxShadow = `0 0 30px ${rps.sh}`;
    }
    if (rps.an) preview.style.animation = rps.an;
    if (rps.border) preview.style.border = rps.border;
  } else {
    preview.style.background = reward.skin.color || getRarityColor(reward.rarity);
    preview.style.boxShadow = `0 0 30px ${getRarityColor(reward.rarity)}`;
  }
  
  const info = document.createElement('div');
  info.className = 'crate-reward-info';
  
  const name = document.createElement('div');
  name.className = 'crate-reward-name large-name';
  name.textContent = reward.skin.name;
  
  const rarity = document.createElement('div');
  rarity.className = 'crate-reward-rarity large-rarity';
  
  // Special handling for THE CREATOR - no rarity, custom message
  if (reward.skin.id === 'icon_the_creator') {
    rarity.textContent = '✨ DIVINE CREATION ✨';
    rarity.style.color = '#ffd700';
    rarity.style.textShadow = '0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 255, 255, 0.6)';
    rarity.style.fontSize = '16px';
    rarity.style.fontWeight = '900';
    rarity.style.letterSpacing = '3px';
  } else {
    rarity.textContent = getRarityName(reward.rarity);
    rarity.style.color = getRarityColor(reward.rarity);
  }
  
  const status = document.createElement('div');
  status.className = 'crate-reward-status large-status';
  if (reward.isDuplicate) {
    status.innerHTML = `<div style="font-size: 24px; margin-bottom: 8px;">💰</div>Duplicate! Converted to ${reward.coinValue} coins`;
    status.style.color = '#ffd93d';
  } else {
    // Special unlock message for THE CREATOR
    if (reward.skin.id === 'icon_the_creator') {
      status.innerHTML = `<div style="font-size: 36px; margin-bottom: 12px;">👑</div><div style="font-size: 20px; font-weight: 900; margin-bottom: 6px; background: linear-gradient(90deg, #ffd700, #ffffff, #ff69b4, #00ffff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">YOU HAVE UNLOCKED THE CREATOR!</div><div style="font-size: 14px; color: rgba(255,255,255,0.8); margin-top: 8px;">The ultimate power has been bestowed upon you.</div>`;
      status.style.textAlign = 'center';
    } else {
      status.innerHTML = `<div style="font-size: 32px; margin-bottom: 8px;">✨</div>NEW SKIN UNLOCKED!`;
      status.style.color = '#6bff7b';
      status.style.fontWeight = '700';
      status.style.fontSize = '18px';
    }
  }
  
  info.appendChild(name);
  info.appendChild(rarity);
  info.appendChild(status);
  
  card.appendChild(preview);
  card.appendChild(info);
  container.appendChild(card);
  
  // Update summary
  const summary = document.getElementById('crateSummary');
  if (reward.isDuplicate) {
    summary.innerHTML = `
      <div class="crate-summary-stat">
        <span class="crate-summary-label">Result:</span>
        <span class="crate-summary-value" style="color: #ffd93d;">Duplicate</span>
      </div>
      <div class="crate-summary-stat">
        <span class="crate-summary-label">Coins Refunded:</span>
        <span class="crate-summary-value">🪙 ${reward.coinValue}</span>
      </div>
      <div class="crate-summary-stat">
        <span class="crate-summary-label">Your Balance:</span>
        <span class="crate-summary-value">🪙 ${playerCoins}</span>
      </div>
    `;
  } else {
    summary.innerHTML = `
      <div class="crate-summary-stat">
        <span class="crate-summary-label">Result:</span>
        <span class="crate-summary-value" style="color: #6bff7b;">New Skin!</span>
      </div>
      <div class="crate-summary-stat">
        <span class="crate-summary-label">Rarity:</span>
        <span class="crate-summary-value" style="color: ${getRarityColor(reward.rarity)};">${getRarityName(reward.rarity)}</span>
      </div>
      <div class="crate-summary-stat">
        <span class="crate-summary-label">Your Balance:</span>
        <span class="crate-summary-value">🪙 ${playerCoins}</span>
      </div>
    `;
  }
}

function closeCrateModal() {
  const modal = document.getElementById('crateOpenModal');
  modal.classList.add('hidden');
  isOpeningCrate = false;
  
  // Refresh shop UI to show new skins
  if (typeof initShopUI === 'function') {
    initShopUI();
  }
}

function showCrateMessage(msg, isError = false) {
  const msgEl = document.getElementById('crateMessage');
  if (!msgEl) return;
  
  msgEl.textContent = msg;
  msgEl.style.color = isError ? '#ff4757' : '#6bff7b';
  msgEl.classList.remove('hidden');
  
  setTimeout(() => {
    msgEl.classList.add('hidden');
  }, 3000);
}

// ============================================
// CRATE INDEX / BROWSE CONTENTS
// ============================================

function showCrateIndex(crateId) {
  const crate = CRATES.find(c => c.id === crateId);
  if (!crate) return;

  const modal = document.getElementById('crateIndexModal');
  const title = document.getElementById('crateIndexTitle');
  const body  = document.getElementById('crateIndexBody');

  title.textContent = `${crate.icon} ${crate.name} — Contents`;
  title.style.color = crate.color;
  body.innerHTML = '';

  // Determine which pool to use
  const isIcon = crateId === 'icon-crate';
  const pool   = isIcon ? ICON_SKIN_RARITIES : SKIN_RARITIES;

  // Build a section for each rarity this crate can drop
  Object.entries(crate.rarityWeights).forEach(([rarity, weight]) => {
    // Hide creator rarity unless player owns it
    if (rarity === 'creator' && !ownedSkins.includes('icon_the_creator')) return;

    const skins = pool[rarity];
    if (!skins || skins.length === 0) return;

    const pct = (weight * 100).toFixed(1).replace(/\.0$/, '');

    // Section wrapper
    const section = document.createElement('div');
    section.className = 'crate-index-section';

    // Header with rarity name + drop chance
    const header = document.createElement('div');
    header.className = 'crate-index-section-header';
    header.innerHTML = `<span class="crate-index-rarity" style="color:${getRarityColor(rarity)}">${getRarityName(rarity)}</span>`
      + `<span class="crate-index-chance" style="color:${getRarityColor(rarity)}">${pct}% drop chance</span>`;
    section.appendChild(header);

    // Grid of skins
    const grid = document.createElement('div');
    grid.className = 'crate-index-grid';

    skins.forEach(skinId => {
      const skinData = SKINS.find(s => s.id === skinId);
      if (!skinData) return;

      const owned = ownedSkins.includes(skinId);

      const card = document.createElement('div');
      card.className = 'crate-index-item' + (owned ? ' owned' : '');
      card.style.borderColor = getRarityColor(rarity);

      // Skin preview swatch (reuse reel preview styles)
      const swatch = document.createElement('div');
      swatch.className = 'crate-index-swatch';

      // Try to apply the rich preview style if available
      const reelStyles = getCratePreviewStyle(skinId);
      if (reelStyles) {
        swatch.style.background = reelStyles.bg;
        if (reelStyles.anim) swatch.style.animation = reelStyles.anim;
        if (reelStyles.border) swatch.style.border = reelStyles.border;
      } else {
        swatch.style.background = skinData.color || getRarityColor(rarity);
      }

      const label = document.createElement('div');
      label.className = 'crate-index-label';
      label.textContent = skinData.name;

      const status = document.createElement('div');
      status.className = 'crate-index-status';
      status.textContent = owned ? 'OWNED' : '';
      status.style.color = owned ? '#6bff7b' : 'transparent';

      card.appendChild(swatch);
      card.appendChild(label);
      card.appendChild(status);
      grid.appendChild(card);
    });

    section.appendChild(grid);
    body.appendChild(section);
  });

  modal.classList.remove('hidden');
}

function closeCrateIndex() {
  document.getElementById('crateIndexModal').classList.add('hidden');
}

// Helper: return the rich preview style object for a skin ID (reuses reel styles)
function getCratePreviewStyle(skinId) {
  const styles = {
    // COMMON
    c_static:    { bg: 'radial-gradient(circle, #c8c8dc 0%, #808090 60%, #404050 100%)' },
    c_rust:      { bg: 'radial-gradient(circle, #c06030 0%, #8b4513 55%, #4a2008 100%)' },
    c_slate:     { bg: 'radial-gradient(circle, #8090a0 0%, #607080 55%, #303840 100%)' },
    c_olive:     { bg: 'radial-gradient(circle, #9ab040 0%, #6b8e23 55%, #344010 100%)' },
    c_maroon:    { bg: 'radial-gradient(circle, #cc3050 0%, #9b2335 55%, #4a0f1a 100%)' },
    // UNCOMMON
    c_cobalt:    { bg: 'radial-gradient(circle, #3080ff 0%, #0047ab 55%, #001a60 100%)' },
    c_teal:      { bg: 'radial-gradient(circle, #00c8b0 0%, #00897b 55%, #003830 100%)' },
    c_coral:     { bg: 'radial-gradient(circle, #ff9080 0%, #ff6f61 55%, #a02010 100%)' },
    c_sand:      { bg: 'radial-gradient(circle, #e0c870 0%, #c2a25a 55%, #6a5020 100%)' },
    c_chrome:    { bg: 'linear-gradient(135deg, #666 0%, #ddd 25%, #999 50%, #fff 75%, #888 100%)', anim: 'quantumSpin 3s linear infinite' },
    // RARE
    c_prism:     { bg: 'conic-gradient(red,orange,yellow,green,cyan,blue,violet,red)', anim: 'quantumSpin 2s linear infinite' },
    c_aurora:    { bg: 'linear-gradient(180deg,#00ff99 0%,#00aaff 40%,#9900cc 100%)', anim: 'galaxyShimmer 2.5s ease-in-out infinite' },
    c_lava:      { bg: 'radial-gradient(circle,#ffcc00 0%,#ff4500 45%,#cc0000 75%,#440000 100%)', anim: 'voidPulse 1.5s ease-in-out infinite' },
    c_storm:     { bg: 'radial-gradient(circle,#c0d8ff 0%,#4080ff 35%,#0020a0 65%,#000820 100%)', anim: 'voidPulse 2s ease-in-out infinite' },
    c_neon:      { bg: 'linear-gradient(135deg,#ff00cc 0%,#00ffff 50%,#ff00cc 100%)', anim: 'quantumSpin 3s linear infinite' },
    // EPIC
    c_glitch:    { bg: 'conic-gradient(#ff0080,#00ffff,#ff0000,#00ff00,#ff00ff,#0000ff,#ff0080)', anim: 'quantumSpin 0.6s linear infinite' },
    c_nebula:    { bg: 'radial-gradient(circle at 40% 35%,#ff80cc 0%,#9922cc 35%,#220066 65%,#110033 100%)', anim: 'galaxyShimmer 2s ease-in-out infinite' },
    c_biohazard: { bg: 'radial-gradient(circle,#ccff00 0%,#39ff14 30%,#006600 65%,#001a00 100%)', anim: 'voidPulse 1.2s ease-in-out infinite' },
    c_arctic:    { bg: 'radial-gradient(circle,#ffffff 0%,#aaeeff 25%,#00c8ff 55%,#004466 100%)', anim: 'galaxyShimmer 3s ease-in-out infinite' },
    c_wildfire:  { bg: 'radial-gradient(circle,#ffffff 0%,#ffff00 20%,#ff6600 50%,#cc0000 75%,#300000 100%)', anim: 'voidPulse 0.9s ease-in-out infinite' },
    c_spectre:   { bg: 'radial-gradient(circle,rgba(255,255,255,0.95) 0%,rgba(180,180,255,0.8) 35%,rgba(80,80,200,0.5) 65%,rgba(20,20,80,0.3) 100%)', anim: 'voidPulse 2.5s ease-in-out infinite' },
    // LEGENDARY
    c_supernova: { bg: 'conic-gradient(white,yellow,orange,red,magenta,blue,cyan,white)', anim: 'quantumSpin 1.5s linear infinite' },
    c_wraith:    { bg: 'radial-gradient(circle,#8800ff 0%,#440088 30%,#1a0033 60%,#000000 100%)', anim: 'voidPulse 2s ease-in-out infinite' },
    c_titan:     { bg: 'radial-gradient(circle,#ffe080 0%,#f5a623 30%,#b87333 60%,#3c1a00 100%)', anim: 'celestialGlow 2.5s ease-in-out infinite' },
    c_astral:    { bg: 'linear-gradient(135deg,#00e5ff 0%,#7b2ff7 35%,#ff00aa 65%,#00e5ff 100%)', anim: 'quantumSpin 4s linear infinite' },
    // MYTHIC
    c_omnichrome:  { bg: 'conic-gradient(red,orange,yellow,lime,cyan,blue,violet,magenta,red)', anim: 'quantumSpin 0.7s linear infinite' },
    c_singularity: { bg: 'conic-gradient(#ff0080,#00ffff,#8000ff,#ff0080)', anim: 'quantumSpin 2s linear infinite' },
    c_ultraviolet: { bg: 'radial-gradient(circle,#ff88ff 0%,#cc00ff 30%,#6600cc 60%,#200033 100%)', anim: 'voidPulse 1.5s ease-in-out infinite' },
    c_godmode:     { bg: 'radial-gradient(circle,#ffffff 0%,#fffdd0 20%,#fff59d 50%,#ffd700 80%,#fff 100%)', anim: 'diamondShine 1.8s ease-in-out infinite' },
    c_rift:        { bg: 'linear-gradient(135deg,#000 0%,#1a0044 25%,#ff00aa 50%,#00ffff 75%,#000 100%)', anim: 'quantumSpin 2.5s linear infinite' },
    // ICON SKINS
    icon_noah_brown:      { bg: '#6b4423' },
    icon_keegan_baseball: { bg: 'radial-gradient(circle,#ffffff 0%,#f9f9f9 35%,#f5f5f5 70%,#e8e8e8 100%)' },
    icon_dpoe_fade:       { bg: 'linear-gradient(135deg, #ff69b4 0%, #ff9ec4 35%, #a8d8ea 65%, #89cff0 100%)' },
    icon_evan_watermelon: { bg: 'radial-gradient(circle, #ff6b9d 0%, #ff4466 30%, #ff1744 50%, #4caf50 70%, #2e7d32 100%)', anim: 'voidPulse 2s ease-in-out infinite' },
    icon_gavin_tzl:       { bg: 'linear-gradient(135deg, #dc143c 0%, #ffffff 50%, #0047ab 100%)', anim: 'quantumSpin 3s linear infinite', border: '2px solid rgba(255, 255, 255, 0.5)' },
    icon_carter_cosmic:   { bg: 'radial-gradient(circle, #ff2020 0%, #cc0000 40%, #660000 70%, #1a0000 100%)' },
    icon_brody_flag:      { bg: 'linear-gradient(to bottom, #b22234 0%, #b22234 15%, #fff 15%, #fff 30%, #b22234 30%, #b22234 46%, #fff 46%, #fff 61%, #b22234 61%, #b22234 77%, #fff 77%, #fff 92%, #b22234 92%, #b22234 100%)', anim: 'flagWave 2s ease-in-out infinite' },
    icon_sterling:        { bg: 'radial-gradient(circle at 30% 30%, #0064ff 0%, #0050cc 30%, #003399 60%, #000000 100%)', anim: 'sterlingPulse 3s ease-in-out infinite' },
    icon_justin_clover:   { bg: 'radial-gradient(circle, #39ff14 0%, #1a8c2e 40%, #0d5c1a 70%, #042b0a 100%)', anim: 'voidPulse 2s ease-in-out infinite' },
    icon_the_creator:     { bg: 'conic-gradient(from 0deg, #ffd700, #ffffff, #ff69b4, #00ffff, #9d4edd, #ffd700)', anim: 'creatorDivine 4s linear infinite', border: '2px solid rgba(255, 255, 255, 0.8)' },
  };
  return styles[skinId] || null;
}

// ============================================
// SHOP UI INTEGRATION
// ============================================

function initCratesTab() {
  const grid = document.getElementById('cratesGrid');
  if (!grid) return;

  grid.innerHTML = '';

  CRATES.forEach(crate => {
    const card = document.createElement('div');
    card.className = 'crate-card';
    card.style.borderColor = crate.color;

    const icon = document.createElement('div');
    icon.className = 'crate-icon';
    icon.textContent = crate.icon;
    icon.style.textShadow = `0 0 20px ${crate.color}`;

    const name = document.createElement('div');
    name.className = 'crate-name';
    name.textContent = crate.name;

    const desc = document.createElement('div');
    desc.className = 'crate-desc';
    desc.textContent = crate.desc;

    const preview = document.createElement('div');
    preview.className = 'crate-preview';

    // Show possible rewards
    const rarities = Object.keys(crate.rarityWeights);
    rarities.forEach(rarity => {
      // Hide 'creator' rarity unless player owns THE CREATOR
      if (rarity === 'creator' && !ownedSkins.includes('icon_the_creator')) {
        return; // Skip displaying this rarity tag
      }

      const tag = document.createElement('span');
      tag.className = 'crate-rarity-tag';
      tag.textContent = getRarityName(rarity);
      tag.style.background = getRarityColor(rarity) + '33';
      tag.style.borderColor = getRarityColor(rarity);
      tag.style.color = getRarityColor(rarity);
      preview.appendChild(tag);
    });

    const price = document.createElement('div');
    price.className = 'crate-price';
    price.textContent = `🪙 ${crate.price}`;

    // Browse contents button
    const browseBtn = document.createElement('button');
    browseBtn.className = 'crate-browse-btn';
    browseBtn.textContent = 'BROWSE CONTENTS';
    browseBtn.onclick = () => showCrateIndex(crate.id);

    const btn = document.createElement('button');
    btn.className = 'crate-btn';
    btn.textContent = 'OPEN CRATE';
    btn.disabled = playerCoins < crate.price;
    btn.onclick = () => showCrateOpeningAnimation(crate.id);

    card.appendChild(icon);
    card.appendChild(name);
    card.appendChild(desc);
    card.appendChild(preview);
    card.appendChild(price);
    card.appendChild(browseBtn);
    card.appendChild(btn);
    grid.appendChild(card);
  });
}

console.log('✅ Crate system loaded');