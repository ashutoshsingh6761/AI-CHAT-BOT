// client/js/app.js
// Application bootstrap: decides whether to show the auth screen or the
// chat app, and wires up global chrome (theme, sidebar, logout, toasts).

const Toast = (() => {
  const container = document.getElementById('toast-container');

  function show(message, type = 'info', duration = 3500) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  return { show };
})();

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('nimbus_theme', theme);
}

function initTheme() {
  const saved = localStorage.getItem('nimbus_theme');
  const preferred = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(preferred);

  document.getElementById('theme-toggle-btn').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
}

function initSidebarToggle() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobile-overlay');

  document.getElementById('open-sidebar-btn').addEventListener('click', () => {
    sidebar.classList.add('open');
    overlay.style.display = 'block';
  });

  function close() {
    sidebar.classList.remove('open');
    overlay.style.display = 'none';
  }

  document.getElementById('close-sidebar-btn').addEventListener('click', close);
  overlay.addEventListener('click', close);
}

function showApp(user) {
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');

  document.getElementById('user-name-label').textContent = user.name;
  document.getElementById('user-avatar').textContent = (user.name || 'U').trim().charAt(0).toUpperCase();

  Chat.init();
}

function showAuth() {
  document.getElementById('app-view').classList.add('hidden');
  document.getElementById('auth-view').classList.remove('hidden');
}

function initLogout() {
  document.getElementById('logout-btn').addEventListener('click', () => {
    Auth.logout();
    showAuth();
  });
}

async function bootstrap() {
  initTheme();
  initSidebarToggle();
  initLogout();

  Auth.init((user) => showApp(user));

  const restoredUser = await Auth.tryRestoreSession();
  if (restoredUser) {
    showApp(restoredUser);
  } else {
    showAuth();
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);
