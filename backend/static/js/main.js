/**
 * Sahayaa – Main JavaScript
 * Shared across all pages
 */

// ─── Quick Exit / Privacy Mode ─────────────────────────────
const quickExitBtn = document.getElementById('quickExitBtn');
const privacyOverlay = document.getElementById('privacyOverlay');
let privacyActive = false;

function togglePrivacy() {
  privacyActive = !privacyActive;
  privacyOverlay.classList.toggle('active', privacyActive);
}

if (quickExitBtn) {
  quickExitBtn.addEventListener('click', togglePrivacy);
}

if (privacyOverlay) {
  privacyOverlay.addEventListener('click', () => {
    privacyActive = false;
    privacyOverlay.classList.remove('active');
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (privacyActive) {
      privacyActive = false;
      privacyOverlay.classList.remove('active');
    }
  }
});

// ─── Toast Notification System ────────────────────────────
function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Navbar scroll shadow ─────────────────────────────────
const navbar = document.getElementById('mainNavbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 10);
  });
}

// ─── Auth State in Navbar ─────────────────────────────────
function updateNavAuth() {
  const area = document.getElementById('authNavArea');
  if (!area) return;

  const token = localStorage.getItem('sahayaa_token');
  const user = JSON.parse(localStorage.getItem('sahayaa_user') || 'null');

  if (token && user) {
    area.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-size:0.875rem;font-weight:600;color:var(--lavender);">
          👋 ${user.name.split(' ')[0]}
        </div>
        ${user.role === 'admin' ? '<a href="/admin" class="btn btn-secondary btn-sm">Admin</a>' : ''}
        <button onclick="logout()" class="btn btn-secondary btn-sm" style="color:#EF4444;">Logout</button>
      </div>`;
  } else {
    area.innerHTML = '<a href="/login" class="btn btn-secondary btn-sm" id="loginNavBtn">Login</a>';
  }
}

function logout() {
  localStorage.removeItem('sahayaa_token');
  localStorage.removeItem('sahayaa_user');
  showToast('Logged out successfully.', 'info');
  setTimeout(() => window.location.reload(), 800);
}

updateNavAuth();
