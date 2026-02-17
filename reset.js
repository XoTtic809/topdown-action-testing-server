// ============================================
// FULL RESET SCRIPT - ADMIN ONLY
// ============================================
// SECURITY NOTICE:
// - Only add <script src="reset.js"></script> to index.html when needed
// - Requires admin authentication (isAdmin check enforced)
// - Double confirmation required before execution
// - Logs all actions to activityLogs collection
// - CRITICAL: Remove from index.html and delete this file after use
// - DO NOT deploy with reset.js included in production
// ============================================

async function runFullReset() {
  if (!isAdmin) {
    console.error('❌ You must be logged in as admin to run this.');
    return;
  }

  const confirmed = confirm(
    '⚠️ FULL RESET\n\n' +
    'This will permanently:\n' +
    '  • Reset ALL users coins to 0\n' +
    '  • Reset ALL users high scores to 0\n' +
    '  • Reset ALL users XP to 0\n' +
    '  • Reset ALL users battle pass (tier 0, no premium, no claimed rewards)\n' +
    '  • Remove ALL cosmetics (trails, death effects, titles, badges)\n' +
    '  • Reset ALL users skins to [agent] only\n' +
    '  • Wipe the score leaderboard\n' +
    '  • Wipe the coins leaderboard\n' +
    '  • Wipe the level leaderboard\n\n' +
    'This CANNOT be undone. Are you absolutely sure?'
  );

  if (!confirmed) {
    console.log('Reset cancelled.');
    return;
  }

  const doubleConfirmed = confirm('Last chance — click OK to permanently reset everything.');
  if (!doubleConfirmed) {
    console.log('Reset cancelled.');
    return;
  }

  console.log('🔄 Starting full reset...');
  let usersReset = 0, errors = 0;

  // ── 1. Reset all user documents ──────────────────────────────
  console.log('📋 Resetting user documents...');
  try {
    const usersSnap = await db.collection('users').get();
    const userBatch = db.batch();

    usersSnap.forEach(doc => {
      userBatch.update(doc.ref, {
        highScore:   0,
        totalCoins:  0,
        ownedSkins:  ['agent'],
        activeSkin:  'agent',
        gamesPlayed: 0,
        battlePass: {
          season: 1,
          currentXP: 0,
          currentTier: 0,
          isPremium: false,
          claimedRewards: { free: [], premium: [] },
          ownedTrails: [],
          ownedDeathEffects: [],
          ownedTitles: [],
          ownedBadges: [],
          activeTrail: null,
          activeDeathEffect: null,
          activeTitle: null,
          activeBadge: null
        }
      });
      usersReset++;
    });

    await userBatch.commit();
    console.log(`✅ Reset ${usersReset} user documents`);
  } catch (err) {
    console.error('❌ Error resetting users:', err);
    errors++;
  }

  // ── 2. Wipe score leaderboard ─────────────────────────────────
  console.log('🏆 Clearing score leaderboard...');
  try {
    const lbSnap = await db.collection('leaderboard').get();
    const lbBatch = db.batch();
    lbSnap.forEach(doc => lbBatch.delete(doc.ref));
    await lbBatch.commit();
    console.log(`✅ Deleted ${lbSnap.size} leaderboard entries`);
  } catch (err) {
    console.error('❌ Error clearing leaderboard:', err);
    errors++;
  }

  // ── 3. Wipe coins leaderboard ─────────────────────────────────
  console.log('🪙 Clearing coins leaderboard...');
  try {
    const coinsSnap = await db.collection('coinsLeaderboard').get();
    const coinsBatch = db.batch();
    coinsSnap.forEach(doc => coinsBatch.delete(doc.ref));
    await coinsBatch.commit();
    console.log(`✅ Deleted ${coinsSnap.size} coins leaderboard entries`);
  } catch (err) {
    console.error('❌ Error clearing coins leaderboard:', err);
    errors++;
  }

  // ── 4. Wipe level leaderboard ─────────────────────────────────
  console.log('⭐ Clearing level leaderboard...');
  try {
    const levelSnap = await db.collection('levelLeaderboard').get();
    const levelBatch = db.batch();
    levelSnap.forEach(doc => levelBatch.delete(doc.ref));
    await levelBatch.commit();
    console.log(`✅ Deleted ${levelSnap.size} level leaderboard entries`);
  } catch (err) {
    console.error('❌ Error clearing level leaderboard:', err);
    errors++;
  }

  // ── 5. Log the action ─────────────────────────────────────────
  try {
    await db.collection('activityLogs').add({
      action:    'full_reset',
      adminName: currentUser.displayName || currentUser.email,
      adminId:   currentUser.uid,
      usersAffected: usersReset,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    // Non-critical, don't count as error
  }

  // ── Done ──────────────────────────────────────────────────────
  if (errors === 0) {
    console.log(`\n✅ RESET COMPLETE — ${usersReset} users reset, leaderboards wiped.`);
    alert(`✅ Reset complete!\n\n${usersReset} users reset.\nLeaderboards wiped.\n\nRemember to delete reset.js from your server.`);
  } else {
    console.warn(`\n⚠️ Reset finished with ${errors} error(s) — check console above.`);
    alert(`⚠️ Reset finished with ${errors} error(s). Check the console for details.`);
  }
}

console.log('✅ Reset script loaded. Type runFullReset() to execute.');