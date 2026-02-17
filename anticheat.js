// ============================================
// ANTICHEAT & USERNAME FILTER
// Topdown Action — Enhanced Edition v2
// ============================================
// Load this AFTER firebase-config.js and BEFORE firebase-auth.js
// ============================================

console.log('🛡️ Loading anti-cheat module v2...');

// ============================================
// USERNAME FILTER
// ============================================

const BAD_WORDS = [
  // Slurs & hate speech
  'nigger','nigga','faggot','fag','dyke','tranny','chink','spic','kike','wetback',
  'gook','cracker','beaner','coon','towelhead','sandnigger','raghead','redskin',
  // Sexual content
  'fuck','shit','ass','bitch','cunt','dick','cock','pussy','whore','slut',
  'blowjob','handjob','cumshot','penis','vagina','dildo','masturbate','anal',
  'porno','porn','xxx','hentai','nude','naked','boobs','titties','tits',
  // Violence / threats
  'kill','murder','rape','terrorist','jihad','isis','nazi','hitler','kkk',
  // Admin impersonation
  'admin','moderator','mod','developer','dev','staff','official','ethan','owner',
];

const LEET_MAP = {
  '0':'o','1':'i','3':'e','4':'a','5':'s','6':'g','7':'t','8':'b','@':'a',
  '$':'s','!':'i','|':'l','(':'c','+':'t','#':'h'
};

function normalizeUsername(name) {
  return name
    .toLowerCase()
    .split('').map(c => LEET_MAP[c] || c).join('')
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/[^a-z0-9]/g, '');
}

function validateUsername(username) {
  const trimmed = username.trim();
  if (trimmed.length < 3)  return { ok: false, reason: 'Username must be at least 3 characters.' };
  if (trimmed.length > 20) return { ok: false, reason: 'Username must be 20 characters or fewer.' };
  if (!/^[a-zA-Z0-9_\-. ]+$/.test(trimmed))
    return { ok: false, reason: 'Username may only contain letters, numbers, spaces, underscores, hyphens, and periods.' };
  if (!/^[a-zA-Z0-9]/.test(trimmed))
    return { ok: false, reason: 'Username must start with a letter or number.' };

  const normalized = normalizeUsername(trimmed);
  for (const word of BAD_WORDS) {
    if (normalized.includes(word))
      return { ok: false, reason: 'That username is not allowed. Please choose a different one.' };
  }
  return { ok: true };
}

// ============================================
// GAME MECHANICS CONSTANTS
// Mirror of game.js values — update if game changes
// ============================================

const AC_GAME = {
  enemiesNeeded: w => w * 5 + 12,
  spawnRate:     w => Math.max(0.25, 1.0 - w * 0.05),
  waveBreak:     2,
  bossCountdown: 3,
  // Boss score by type: 1=regular, 2=mega, 3=ultra, 4=legendary
  bossScore: (w, type) => {
    if (type === 4) return 5500 + w * 700;
    if (type === 3) return 3000 + w * 400;
    if (type === 2) return 1500 + w * 250;
    return 600 + w * 120;
  },
  bossCoins: (w, type) => {
    if (type === 4) return 150 + w * 15;
    if (type === 3) return 75  + w * 8;
    if (type === 2) return 40  + w * 5;
    return 20 + w * 3;
  },
  waveBonus:     w => (w + 1) * 60,
  waveCoinBonus: w => w * 2,
  maxPowerupScore: 9 * 150, // 9 permanent upgrade pickups * 150 pts each
};

// ============================================
// SCORE PLAUSIBILITY
// ============================================

// Builds a ceiling score for wave W based on real game mechanics.
// Every enemy treated as a miniboss (100 pts) — ultra generous.
// Every boss treated as legendary — ultra generous.
// 30% padding on top.
function maxPlausibleScore(waveReached) {
  const W = Math.max(1, waveReached);
  let s = 0;
  for (let w = 1; w < W; w++) {
    s += AC_GAME.enemiesNeeded(w) * 100;   // all minibosses
    s += AC_GAME.waveBonus(w);
    if (w % 5 === 0) s += AC_GAME.bossScore(w, 4); // legendary every boss wave
  }
  s += AC_GAME.enemiesNeeded(W) * 100;     // partial current wave
  s += AC_GAME.maxPowerupScore;
  return Math.floor(s * 1.3);
}

// Maximum kills possible given waves cleared
function maxPlausibleKills(waveReached) {
  const W = Math.max(1, waveReached);
  let k = 0;
  for (let w = 1; w <= W; w++) k += AC_GAME.enemiesNeeded(w);
  return Math.floor(k * 1.5); // 50% buffer for nuke kill-all etc.
}

// Minimum real game time (seconds) to reach wave W.
// Calculated from actual spawn timings; then reduced by 30% to avoid false flags.
function minPlausibleGameTime(waveReached) {
  if (waveReached <= 1) return 8;
  const W = Math.max(1, waveReached);
  let t = 0;
  for (let w = 1; w < W; w++) {
    t += AC_GAME.enemiesNeeded(w) * AC_GAME.spawnRate(w); // spawn time
    if (w % 5 === 0) {
      t += AC_GAME.bossCountdown;
      const bossHp = w % 20 === 0 ? (270 + w * 44) :
                     w % 10 === 0 ? (150 + w * 45) :
                                    (60  + w * 25);
      t += Math.max(5, bossHp / 18); // 18 HP/s = extreme player DPS
    } else {
      t += AC_GAME.waveBreak;
    }
  }
  return Math.max(8, Math.floor(t * 0.70)); // 30% generous reduction
}

// Max coins earnable in one session through wave W
function maxPlausibleCoins(waveReached) {
  const W = Math.max(1, waveReached);
  let c = 0;
  for (let w = 1; w < W; w++) {
    c += AC_GAME.enemiesNeeded(w) * 8; // all minibosses (8 coins each)
    c += AC_GAME.waveCoinBonus(w);
    if (w % 5 === 0) c += AC_GAME.bossCoins(w, 4);
  }
  c += AC_GAME.enemiesNeeded(W) * 8;
  return Math.floor(c * 1.4);
}

// ============================================
// SESSION TRACKING
// ============================================

const gameSession = {
  token:        null,
  startTime:    null,
  endTime:      null,
  waveReached:  1,
  totalKills:   0,
  submitted:    false,
  coinsAtStart: 0,
};

function acSessionStart() {
  gameSession.token       = Math.random().toString(36).slice(2) + Date.now().toString(36);
  gameSession.startTime   = Date.now();
  gameSession.endTime     = null;
  gameSession.waveReached = 1;
  gameSession.totalKills  = 0;
  gameSession.submitted   = false;
  gameSession.coinsAtStart = (typeof playerCoins !== 'undefined') ? playerCoins : 0;
}

function acSessionEnd(waveReached, kills) {
  gameSession.endTime    = Date.now();
  gameSession.waveReached = waveReached;
  gameSession.totalKills  = kills;
}

// ============================================
// SCORE VALIDATION
// ============================================

let _lastSubmitTime = 0;

function validateScore(score, waveReached, gameDurationMs, totalKills) {
  const sec = gameDurationMs / 1000;
  const W   = Math.max(1, waveReached);

  // Basic sanity
  if (!Number.isFinite(score) || score < 0)
    return { valid: false, reason: `Invalid score value: ${score}`, severity: 'reject' };

  // 1. Hard ban ceiling: 4× the already-generous max
  const maxScore = maxPlausibleScore(W);
  if (score > maxScore * 4)
    return { valid: false,
      reason: `Score ${score.toLocaleString()} is mathematically impossible at wave ${W} (ban ceiling: ${(maxScore*4).toLocaleString()})`,
      severity: 'ban' };

  // 2. Reject ceiling: generous max (already includes 30% buffer)
  if (score > maxScore)
    return { valid: false,
      reason: `Score ${score.toLocaleString()} exceeds ceiling ${maxScore.toLocaleString()} at wave ${W}`,
      severity: 'reject' };

  // 3. Wave 1 hard cap — max possible is ~3500
  if (W === 1 && score > 3500)
    return { valid: false,
      reason: `Score ${score} is impossible on wave 1 (hard cap ~3500)`,
      severity: 'reject' };

  // 4. Kill count plausibility
  if (totalKills > 0) {
    const maxKills = maxPlausibleKills(W);
    if (totalKills > maxKills)
      return { valid: false,
        reason: `${totalKills} kills impossible at wave ${W} (max: ${maxKills})`,
        severity: 'reject' };

    // Kill rate: >8 kills/sec sustained over 10+ seconds is inhuman
    const kps = totalKills / Math.max(1, sec);
    if (kps > 8 && sec > 10)
      return { valid: false,
        reason: `Kill rate ${kps.toFixed(1)}/s is inhuman (${totalKills} kills in ${Math.round(sec)}s)`,
        severity: 'flag' };
  }

  // 5. Score vs kills coherence
  if (totalKills > 10) {
    const absoluteMax = totalKills * 100 + W * 500 + AC_GAME.maxPowerupScore;
    if (score > absoluteMax * 1.5)
      return { valid: false,
        reason: `Score ${score.toLocaleString()} too high for ${totalKills} kills`,
        severity: 'flag' };
  }

  // 6. Minimum time
  const minTime = minPlausibleGameTime(W);
  if (sec < minTime && W > 2)
    return { valid: false,
      reason: `Reached wave ${W} in ${Math.round(sec)}s (min realistic: ${minTime}s)`,
      severity: 'flag' };

  // 7. Too fast overall
  if (sec < 5 && score > 500)
    return { valid: false,
      reason: `Score ${score} submitted in ${Math.round(sec)}s — impossibly fast`,
      severity: 'reject' };

  // 8. Rate limit — gap must be at least half the session duration or 15s
  const now     = Date.now();
  const cooldown = Math.max(15000, gameDurationMs * 0.5);
  if (_lastSubmitTime !== 0 && (now - _lastSubmitTime) < cooldown)
    return { valid: false,
      reason: `Score submitted too quickly after previous (${Math.round((now-_lastSubmitTime)/1000)}s gap)`,
      severity: 'reject' };

  return { valid: true };
}

function validateCoins(totalCoins, waveReached) {
  if (!Number.isFinite(totalCoins) || totalCoins < 0)
    return { valid: false, reason: `Invalid coin value: ${totalCoins}`, severity: 'reject' };

  // Coins are cumulative across sessions — only flag suspiciously large single-session gains
  const gained  = totalCoins - gameSession.coinsAtStart;
  const maxGain = maxPlausibleCoins(Math.max(1, waveReached));
  if (gained > 0 && gained > maxGain)
    return { valid: false,
      reason: `Earned ${gained.toLocaleString()} coins this session (max: ${maxGain.toLocaleString()}) at wave ${waveReached}`,
      severity: 'flag' };

  return { valid: true };
}

function maxPlausibleXP(waveReached, totalKills, matchTime) {
  const W = Math.max(1, waveReached);
  let xp = 0;

  // XP from waves (20 XP each for all completed waves)
  xp += (W - 1) * 20;

  // XP from kills (assume generous average of 8 XP per kill, accounting for boss 2x multiplier)
  xp += totalKills * 8;

  // Match completion bonus
  xp += 30;

  // 50% padding for normal variance
  return Math.ceil(xp * 1.5);
}

function validateXP(xpEarned, waveReached, totalKills, matchTime) {
  if (!Number.isFinite(xpEarned) || xpEarned < 0)
    return { valid: false, reason: `Invalid XP value: ${xpEarned}`, severity: 'reject' };

  const maxXP = maxPlausibleXP(waveReached, totalKills, matchTime);
  if (xpEarned > maxXP)
    return { valid: false,
      reason: `Earned ${xpEarned} XP in ${waveReached} waves with ${totalKills} kills (max expected: ${maxXP})`,
      severity: 'reject' };

  return { valid: true };
}

// ============================================
// FIREBASE ENFORCEMENT
// ============================================

async function acSubmitScore(score) {
  if (!currentUser || isGuest) return;

  if (isAdmin) { await submitScoreToLeaderboard(score); return; }

  if (gameSession.submitted) { console.warn('[AC] Duplicate submission blocked'); return; }

  if (!gameSession.startTime) { console.warn('[AC] No session — not submitted'); return; }

  const duration = (gameSession.endTime || Date.now()) - gameSession.startTime;
  const result   = validateScore(score, gameSession.waveReached, duration, gameSession.totalKills);

  if (!result.valid) {
    console.warn(`[AC] ${result.severity.toUpperCase()}: ${result.reason}`);
    await acLogViolation(score, result.reason, result.severity, 'score');
    if (result.severity === 'ban') await acAutoBan(result.reason);
    return;
  }

  _lastSubmitTime = Date.now();
  gameSession.submitted = true;
  await submitScoreToLeaderboard(score);

  // Coin check (non-blocking — just logs anomalies)
  if (typeof playerCoins !== 'undefined') {
    const cr = validateCoins(playerCoins, gameSession.waveReached);
    if (!cr.valid) {
      console.warn(`[AC] Coin flag: ${cr.reason}`);
      await acLogViolation(playerCoins, cr.reason, cr.severity, 'coins');
    }
  }
}

// ============================================
// AUTO-BAN & VIOLATION LOGGING
// ============================================

async function acAutoBan(reason) {
  if (!currentUser) return;
  try {
    await db.collection('banned').doc(currentUser.uid).set({
      bannedAt: firebase.firestore.FieldValue.serverTimestamp(),
      bannedBy: 'anticheat_system',
      reason:   `[AUTO-BAN] ${reason}`,
      automatic: true
    });
    await db.collection('activityLogs').add({
      action:         'auto_ban',
      adminName:      'Anti-Cheat System',
      targetUserId:   currentUser.uid,
      targetUsername: currentUser.displayName || currentUser.email,
      reason:         reason,
      timestamp:      firebase.firestore.FieldValue.serverTimestamp()
    });
    console.warn('[AC] User auto-banned');
    await auth.signOut();
    alert('⚠️ Your account has been automatically banned for submitting an impossible score.\n\nIf you believe this is an error, please contact the developer.');
  } catch (err) {
    console.error('[AC] Auto-ban failed:', err);
  }
}

async function acLogViolation(value, reason, severity, type = 'score') {
  if (!currentUser) return;
  const sessionDuration = gameSession.endTime && gameSession.startTime
    ? Math.round((gameSession.endTime - gameSession.startTime) / 1000) : null;
  const killRate = gameSession.totalKills > 0 && sessionDuration
    ? +(gameSession.totalKills / sessionDuration).toFixed(2) : null;

  try {
    await db.collection('flaggedScores').add({
      userId:       currentUser.uid,
      username:     currentUser.displayName || currentUser.email,
      type,
      score:        type === 'score' ? value : null,
      coins:        type === 'coins' ? value : null,
      wave:         gameSession.waveReached,
      kills:        gameSession.totalKills,
      gameDuration: sessionDuration,
      killRate,
      sessionToken: gameSession.token,
      reason,
      severity,
      timestamp:    firebase.firestore.FieldValue.serverTimestamp(),
      reviewed:     false
    });
  } catch (err) {
    console.error('[AC] Failed to log violation:', err);
  }
}

// ============================================
// ADMIN: FLAGGED SCORES UI
// ============================================

async function displayFlaggedScores() {
  const listEl = document.getElementById('flaggedScoresList');
  if (!listEl || !isAdmin) return;
  listEl.innerHTML = '<div class="loading-spinner">Loading...</div>';

  try {
    const snap = await db.collection('flaggedScores')
      .orderBy('timestamp', 'desc').limit(50).get();

    if (snap.empty) {
      listEl.innerHTML = '<div class="loading-spinner">No flagged scores</div>';
      return;
    }

    listEl.innerHTML = '';
    snap.forEach(doc => {
      const d  = doc.data();
      const ts = d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleString() : 'N/A';
      const severityColor = d.severity === 'ban'
        ? 'rgba(255,50,50,0.5)' : d.severity === 'reject'
        ? 'rgba(255,150,50,0.4)' : 'rgba(255,215,0,0.3)';

      const row = document.createElement('div');
      row.className = 'admin-score-entry flagged-entry';
      row.style.borderColor = severityColor;

      const killRateStr = d.killRate != null ? ` · ${d.killRate}/s kills` : '';
      const typeLabel   = d.type === 'coins' ? '🪙' : '🏆';

      row.innerHTML = `
        <div class="admin-score-info" style="flex:1; min-width:0;">
          <div class="admin-score-name">
            <span style="color:${d.severity==='ban'?'#ff4757':d.severity==='reject'?'#ff9f43':'#ffd700'}">
              [${(d.severity||'flag').toUpperCase()}]
            </span>
            ${typeLabel} ${escapeHtml(d.username||'?')}
          </div>
          <div class="admin-score-val">
            Score: ${(d.score||0).toLocaleString()} · Wave ${d.wave||'?'} · ${d.kills||0} kills · ${d.gameDuration||'?'}s${killRateStr}
          </div>
          <div style="font-size:10px;color:#888;margin-top:2px;">${escapeHtml(d.reason||'')} · ${ts}</div>
        </div>
        <div class="admin-user-actions">
          ${!d.reviewed ? `<button class="admin-action-btn ban" onclick="acAdminBan('${doc.id}','${escapeHtml(d.userId||'')}','${escapeHtml(d.username||'')}')">🚫 Ban</button>` : ''}
          <button class="admin-action-btn reset" onclick="acAdminDismiss('${doc.id}')">✓ Clear</button>
        </div>`;
      listEl.appendChild(row);
    });
  } catch (err) {
    listEl.innerHTML = `<div class="loading-spinner">Error: ${err.message}</div>`;
  }
}

async function acAdminBan(docId, userId, username) {
  if (!isAdmin || !confirm(`Ban ${username} for cheating?`)) return;
  const result = await banUser(userId, `Banned for cheating (flagged score)`);
  showAdminMessage(result.success ? `${username} banned` : 'Error: ' + result.error, !result.success);
  await db.collection('flaggedScores').doc(docId).update({ reviewed: true });
  displayFlaggedScores();
}

async function acAdminDismiss(docId) {
  if (!isAdmin) return;
  await db.collection('flaggedScores').doc(docId).update({ reviewed: true });
  displayFlaggedScores();
}

// ============================================
// DEBUG HELPER (admin console only)
// Usage: acDebug(10) — shows all thresholds for wave 10
// ============================================

function acDebug(wave) {
  if (!isAdmin) { console.log('Admin only'); return; }
  const max  = maxPlausibleScore(wave);
  const minT = minPlausibleGameTime(wave);
  const maxK = maxPlausibleKills(wave);
  const maxC = maxPlausibleCoins(wave);
  console.group(`[AC Debug] Wave ${wave}`);
  console.log(`Reject ceiling:  ${max.toLocaleString()} pts`);
  console.log(`Ban ceiling:     ${(max*4).toLocaleString()} pts`);
  console.log(`Min game time:   ${minT}s (${(minT/60).toFixed(1)} min)`);
  console.log(`Max kills:       ${maxK}`);
  console.log(`Max coins/sess:  ${maxC.toLocaleString()}`);
  console.groupEnd();
  return { max, ban: max*4, minTime: minT, maxKills: maxK, maxCoins: maxC };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

console.log('✅ Anti-cheat module v2 loaded');