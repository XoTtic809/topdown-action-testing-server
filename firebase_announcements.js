// ============================================
// ANNOUNCEMENTS SYSTEM
// ============================================
// This file handles global announcements that admins can send
// Announcements persist in Firebase and show to users on login

console.log('📢 Loading announcements module...');

// Track which announcements the current user has seen
let seenAnnouncements = [];

// ============================================
// SEND ANNOUNCEMENT (Admin Only)
// ============================================

async function sendAnnouncement(title, message, type = 'info', options = {}) {
  if (!isAdmin) {
    return { success: false, error: 'Not authorized' };
  }
  
  if (!title || !message) {
    return { success: false, error: 'Title and message are required' };
  }
  
  try {
    // Prepare announcement data
    const announcementData = {
      title: title,
      message: message,
      type: type, // info, warning, success, error
      priority: options.priority || 'normal', // normal, high, urgent
      adminId: currentUser.uid,
      adminName: currentUser.displayName || currentUser.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString(),
      expiresAt: options.expiresAt || null, // Optional expiry date
      active: options.active !== undefined ? options.active : true,
      showToGuests: options.showToGuests !== undefined ? options.showToGuests : true
    };
    
    // Create announcement document
    const announcementRef = await db.collection('announcements').add(announcementData);
    
    // Log admin action
    await logAdminAction('send_announcement', {
      announcementId: announcementRef.id,
      title: title,
      type: type,
      priority: announcementData.priority,
      active: announcementData.active
    });
    
    console.log('📢 Announcement sent:', title);
    return { success: true, id: announcementRef.id };
    
  } catch (error) {
    console.error('Error sending announcement:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// FETCH ANNOUNCEMENTS
// ============================================

// Fetch recent announcements for admin panel
async function fetchRecentAnnouncements(limit = 10) {
  if (!isAdmin) return [];
  
  try {
    const snapshot = await db.collection('announcements')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    const announcements = [];
    snapshot.forEach(doc => {
      announcements.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return announcements;
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }
}

// Fetch active announcements for users
async function fetchActiveAnnouncements() {
  try {
    const snapshot = await db.collection('announcements')
      .where('active', '==', true)
      .orderBy('timestamp', 'desc')
      .limit(5) // Only get latest 5 active announcements
      .get();
    
    const announcements = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Check if expired
      if (data.expiresAt) {
        const expiryDate = new Date(data.expiresAt);
        if (expiryDate < new Date()) {
          return; // Skip expired announcements
        }
      }
      
      announcements.push({
        id: doc.id,
        ...data
      });
    });
    
    return announcements;
  } catch (error) {
    console.error('Error fetching active announcements:', error);
    return [];
  }
}

// ============================================
// DISPLAY ANNOUNCEMENTS
// ============================================

// Display recent announcements in admin panel
async function displayRecentAnnouncements() {
  const listEl = document.getElementById('recentAnnouncements');
  if (!listEl) return;
  
  listEl.innerHTML = '<div class="loading-spinner">Loading...</div>';
  
  const announcements = await fetchRecentAnnouncements();
  
  if (announcements.length === 0) {
    listEl.innerHTML = '<div class="loading-spinner">No announcements yet</div>';
    return;
  }
  
  const typeIcons = {
    info: 'ℹ️',
    warning: '⚠️',
    success: '✅',
    error: '❌'
  };
  
  const priorityBadges = {
    normal: '',
    high: '<span style="background: rgba(255,165,0,0.2); color: #ffaa00; padding: 2px 6px; border-radius: 3px; font-size: 9px; margin-left: 6px;">⚡ HIGH</span>',
    urgent: '<span style="background: rgba(255,71,87,0.2); color: #ff6b7a; padding: 2px 6px; border-radius: 3px; font-size: 9px; margin-left: 6px;">🚨 URGENT</span>'
  };
  
  listEl.innerHTML = '';
  announcements.forEach(announcement => {
    const el = document.createElement('div');
    el.className = 'admin-announcement-entry';
    
    const time = announcement.timestamp 
      ? new Date(announcement.timestamp.seconds * 1000).toLocaleString()
      : new Date(announcement.createdAt).toLocaleString();
    
    const icon = typeIcons[announcement.type] || 'ℹ️';
    const priorityBadge = priorityBadges[announcement.priority || 'normal'] || '';
    const statusBadge = announcement.active 
      ? '<span style="color: #6bff7b;">● Active</span>' 
      : '<span style="color: #888;">● Inactive</span>';
    
    // Expiry info
    let expiryInfo = '';
    if (announcement.expiresAt) {
      const expiryDate = new Date(announcement.expiresAt);
      const isExpired = expiryDate < new Date();
      const expiryText = expiryDate.toLocaleDateString();
      expiryInfo = isExpired 
        ? `<div style="font-size: 10px; color: #ff6b7a; margin-top: 4px;">⏰ Expired: ${expiryText}</div>`
        : `<div style="font-size: 10px; color: #ffaa00; margin-top: 4px;">⏰ Expires: ${expiryText}</div>`;
    }
    
    // Guest visibility
    const guestBadge = announcement.showToGuests === false 
      ? '<span style="font-size: 9px; color: #888; margin-left: 6px;">👤 Members Only</span>' 
      : '';
    
    el.innerHTML = `
      <div class="admin-announcement-header">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-size: 18px;">${icon}</span>
          <strong>${announcement.title}</strong>
          ${priorityBadge}
          ${guestBadge}
        </div>
        ${statusBadge}
      </div>
      <div class="admin-announcement-message">${announcement.message}</div>
      ${expiryInfo}
      <div class="admin-announcement-meta">
        by ${announcement.adminName} · ${time}
      </div>
      ${isAdmin ? `
        <div class="admin-announcement-actions">
          <button class="admin-action-btn ${announcement.active ? 'warning' : 'success'}" 
                  onclick="toggleAnnouncementStatus('${announcement.id}', ${!announcement.active})">
            ${announcement.active ? '🔇 Deactivate' : '🔔 Activate'}
          </button>
          <button class="admin-action-btn delete" 
                  onclick="deleteAnnouncement('${announcement.id}', '${announcement.title.replace(/'/g, "\\'")}')">
            🗑️ Delete
          </button>
        </div>
      ` : ''}
    `;
    
    listEl.appendChild(el);
  });
}

// Show announcement modal to user
async function showAnnouncementToUser(announcement) {
  // Check if user has already seen this announcement
  if (seenAnnouncements.includes(announcement.id)) {
    return;
  }
  
  const modal = document.getElementById('announcementModal');
  if (!modal) return;
  
  const title = modal.querySelector('.announcement-title');
  const subtitle = modal.querySelector('.announcement-subtitle');
  const content = modal.querySelector('.announcement-body');
  
  if (!title || !content) return;
  
  const typeIcons = {
    info: 'ℹ️',
    warning: '⚠️',
    success: '✅',
    error: '❌'
  };
  
  const icon = typeIcons[announcement.type] || 'ℹ️';
  
  // Priority styling
  let priorityText = '';
  let modalBorderColor = 'rgba(88,166,255,0.3)';
  
  if (announcement.priority === 'urgent') {
    priorityText = ' 🚨 URGENT';
    modalBorderColor = 'rgba(255,71,87,0.6)';
    modal.style.borderColor = modalBorderColor;
  } else if (announcement.priority === 'high') {
    priorityText = ' ⚡ IMPORTANT';
    modalBorderColor = 'rgba(255,165,0,0.6)';
    modal.style.borderColor = modalBorderColor;
  } else {
    modal.style.borderColor = 'rgba(88,166,255,0.3)';
  }
  
  // Update modal content
  title.textContent = `${icon} ${announcement.title}${priorityText}`;
  if (subtitle) subtitle.textContent = new Date(announcement.timestamp?.seconds * 1000 || announcement.createdAt).toLocaleDateString();
  
  // Replace the content sections with the announcement message
  const sections = modal.querySelectorAll('.announcement-section');
  if (sections.length > 0) {
    // Clear existing sections
    sections.forEach(section => section.remove());
  }
  
  // Create new message section
  const messageSection = document.createElement('div');
  messageSection.className = 'announcement-section';
  messageSection.innerHTML = `<p style="white-space: pre-wrap;">${announcement.message}</p>`;
  
  // Insert before the close button
  const closeBtn = modal.querySelector('.announcement-close-btn');
  if (closeBtn && closeBtn.parentNode) {
    closeBtn.parentNode.insertBefore(messageSection, closeBtn);
  }
  
  // Show modal
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  
  // Mark as seen
  seenAnnouncements.push(announcement.id);
  
  // Save to user's seen list in Firebase (if logged in)
  if (currentUser && !isGuest) {
    try {
      await db.collection('users').doc(currentUser.uid).update({
        seenAnnouncements: firebase.firestore.FieldValue.arrayUnion(announcement.id)
      });
    } catch (error) {
      console.error('Error marking announcement as seen:', error);
    }
  } else {
    // For guests, save to localStorage
    localStorage.setItem('seenAnnouncements', JSON.stringify(seenAnnouncements));
  }
}

// Check and display new announcements for user
async function checkForNewAnnouncements() {
  try {
    // Load user's seen announcements
    if (currentUser && !isGuest) {
      const userDoc = await db.collection('users').doc(currentUser.uid).get();
      if (userDoc.exists) {
        seenAnnouncements = userDoc.data().seenAnnouncements || [];
      }
    } else {
      // Guest: load from localStorage
      const saved = localStorage.getItem('seenAnnouncements');
      seenAnnouncements = saved ? JSON.parse(saved) : [];
    }
    
    // Fetch active announcements
    const announcements = await fetchActiveAnnouncements();
    
    // Filter announcements based on user type
    const relevantAnnouncements = announcements.filter(a => {
      // If user is guest and announcement is members-only, skip it
      if (isGuest && a.showToGuests === false) {
        return false;
      }
      return true;
    });
    
    // Find unseen announcements
    const unseen = relevantAnnouncements.filter(a => !seenAnnouncements.includes(a.id));
    
    // Sort by priority (urgent > high > normal) then by timestamp
    unseen.sort((a, b) => {
      const priorityOrder = { urgent: 3, high: 2, normal: 1 };
      const aPriority = priorityOrder[a.priority || 'normal'];
      const bPriority = priorityOrder[b.priority || 'normal'];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      // Same priority, sort by timestamp (newest first)
      const aTime = a.timestamp?.seconds || new Date(a.createdAt).getTime() / 1000;
      const bTime = b.timestamp?.seconds || new Date(b.createdAt).getTime() / 1000;
      return bTime - aTime;
    });
    
    // Show the highest priority unseen announcement
    if (unseen.length > 0) {
      showAnnouncementToUser(unseen[0]);
    }
    
  } catch (error) {
    console.error('Error checking for announcements:', error);
  }
}

// ============================================
// ADMIN ACTIONS
// ============================================

// Toggle announcement active/inactive status
async function toggleAnnouncementStatus(announcementId, newStatus) {
  if (!isAdmin) return { success: false, error: 'Not authorized' };
  
  try {
    await db.collection('announcements').doc(announcementId).update({
      active: newStatus
    });
    
    await logAdminAction('toggle_announcement', {
      announcementId: announcementId,
      newStatus: newStatus
    });
    
    console.log(`📢 Announcement ${newStatus ? 'activated' : 'deactivated'}`);
    displayRecentAnnouncements(); // Refresh list
    return { success: true };
    
  } catch (error) {
    console.error('Error toggling announcement:', error);
    return { success: false, error: error.message };
  }
}

// Delete an announcement
async function deleteAnnouncement(announcementId, title) {
  if (!isAdmin) return { success: false, error: 'Not authorized' };
  
  if (!confirm(`Delete announcement: "${title}"?`)) {
    return { success: false, error: 'Cancelled' };
  }
  
  try {
    await db.collection('announcements').doc(announcementId).delete();
    
    await logAdminAction('delete_announcement', {
      announcementId: announcementId,
      title: title
    });
    
    console.log('🗑️ Announcement deleted');
    displayRecentAnnouncements(); // Refresh list
    showAdminMessage('Announcement deleted');
    return { success: true };
    
  } catch (error) {
    console.error('Error deleting announcement:', error);
    showAdminMessage('Error: ' + error.message, true);
    return { success: false, error: error.message };
  }
}

// ============================================
// UI EVENT LISTENERS
// ============================================

// Send announcement button
document.addEventListener('DOMContentLoaded', () => {
  // Character counters
  const titleInput = document.getElementById('announceTitle');
  const messageInput = document.getElementById('announceMessage');
  const titleCounter = document.getElementById('titleCounter');
  const messageCounter = document.getElementById('messageCounter');
  
  if (titleInput && titleCounter) {
    titleInput.addEventListener('input', () => {
      const count = titleInput.value.length;
      titleCounter.textContent = `${count}/100`;
      titleCounter.style.color = count > 80 ? '#ff6b7a' : 'var(--muted)';
    });
  }
  
  if (messageInput && messageCounter) {
    messageInput.addEventListener('input', () => {
      const count = messageInput.value.length;
      messageCounter.textContent = `${count}/500`;
      messageCounter.style.color = count > 450 ? '#ff6b7a' : 'var(--muted)';
    });
  }
  
  // Preview announcement button
  const previewBtn = document.getElementById('previewAnnouncementBtn');
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      const title = document.getElementById('announceTitle').value.trim();
      const message = document.getElementById('announceMessage').value.trim();
      const type = document.getElementById('announceType').value;
      const priority = document.getElementById('announcePriority').value;
      
      if (!title || !message) {
        showAdminMessage('Enter title and message to preview', true);
        return;
      }
      
      // Create preview announcement object
      const previewAnnouncement = {
        id: 'preview',
        title: title,
        message: message,
        type: type,
        priority: priority,
        timestamp: { seconds: Date.now() / 1000 },
        adminName: currentUser?.displayName || 'Admin'
      };
      
      // Show in modal
      showAnnouncementToUser(previewAnnouncement);
      showAdminMessage('Preview shown! Close the modal to continue editing.');
    });
  }
  
  // Send announcement button
  const sendBtn = document.getElementById('sendAnnouncementBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      const title = document.getElementById('announceTitle').value.trim();
      const message = document.getElementById('announceMessage').value.trim();
      const type = document.getElementById('announceType').value;
      const priority = document.getElementById('announcePriority').value;
      const expiryInput = document.getElementById('announceExpiry').value;
      const active = document.getElementById('announceActive').checked;
      const showToGuests = document.getElementById('announceShowToGuests').checked;
      
      if (!title || !message) {
        showAdminMessage('Please enter both title and message', true);
        return;
      }
      
      // Convert expiry datetime-local to ISO string if provided
      const expiresAt = expiryInput ? new Date(expiryInput).toISOString() : null;
      
      // Build options object
      const options = {
        priority: priority,
        expiresAt: expiresAt,
        active: active,
        showToGuests: showToGuests
      };
      
      showAdminMessage('Sending announcement...', false);
      
      const result = await sendAnnouncement(title, message, type, options);
      
      if (result.success) {
        const statusText = active ? 'sent and active' : 'saved as draft (inactive)';
        showAdminMessage(`✅ Announcement ${statusText}!`);
        
        // Clear form
        document.getElementById('announceTitle').value = '';
        document.getElementById('announceMessage').value = '';
        document.getElementById('announceType').value = 'info';
        document.getElementById('announcePriority').value = 'normal';
        document.getElementById('announceExpiry').value = '';
        document.getElementById('announceActive').checked = true;
        document.getElementById('announceShowToGuests').checked = true;
        titleCounter.textContent = '0/100';
        messageCounter.textContent = '0/500';
        
        // Refresh recent announcements list
        displayRecentAnnouncements();
      } else {
        showAdminMessage('Error: ' + result.error, true);
      }
    });
  }
  
  // Close announcement modal button
  const closeAnnouncementBtn = document.getElementById('closeAnnouncementBtn');
  if (closeAnnouncementBtn) {
    closeAnnouncementBtn.addEventListener('click', () => {
      const modal = document.getElementById('announcementModal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
    });
  }
});

console.log('✅ Announcements module loaded');