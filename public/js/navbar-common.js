// ─── RailSense AI Shared Navigation & Authentication Utilities ───

// Shared Logout Function
function handleLogout() {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
  } catch (err) {
    console.warn('Storage clear warning:', err);
  }
  // Redirect cleanly to login page
  window.location.href = '/login';
}

// Global expose
window.handleLogout = handleLogout;

// Shared Live Database Status Checker
async function checkGlobalDbHealth() {
  const badge = document.getElementById('nav-db-badge');
  const text = document.getElementById('nav-db-status');
  if (!text) return;

  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.status === 'connected') {
      text.textContent = 'DB Connected';
      if (badge) badge.classList.remove('disconnected');
    } else {
      text.textContent = 'DB Offline';
      if (badge) badge.classList.add('disconnected');
    }
  } catch (err) {
    text.textContent = 'DB Offline';
    if (badge) badge.classList.add('disconnected');
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  checkGlobalDbHealth();
  // Keep status synchronized every 15 seconds
  setInterval(checkGlobalDbHealth, 15000);
});
