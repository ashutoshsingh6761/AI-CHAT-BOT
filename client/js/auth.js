// client/js/auth.js
// Handles the login/register screen: tab switching, form submission,
// and handing off to app.js once authenticated.

const Auth = (() => {
  let currentUser = null;

  function getUser() {
    return currentUser;
  }

  function setUser(user) {
    currentUser = user;
  }

  function init(onAuthenticated) {
    const tabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        loginForm.classList.toggle('hidden', target !== 'login');
        registerForm.classList.toggle('hidden', target !== 'register');
      });
    });

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('login-error');
      errorEl.textContent = '';
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      const submitBtn = loginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        const res = await Api.login(email, password);
        Api.setToken(res.data.token);
        setUser(res.data.user);
        onAuthenticated(res.data.user);
      } catch (err) {
        errorEl.textContent = err.message || 'Login failed';
      } finally {
        submitBtn.disabled = false;
      }
    });

    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById('register-error');
      errorEl.textContent = '';
      const name = document.getElementById('register-name').value.trim();
      const email = document.getElementById('register-email').value.trim();
      const password = document.getElementById('register-password').value;

      const submitBtn = registerForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        const res = await Api.register(name, email, password);
        Api.setToken(res.data.token);
        setUser(res.data.user);
        onAuthenticated(res.data.user);
      } catch (err) {
        errorEl.textContent = (err.errors && err.errors[0]) || err.message || 'Registration failed';
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  async function tryRestoreSession() {
    if (!Api.getToken()) return null;
    try {
      const res = await Api.getMe();
      setUser(res.data.user);
      return res.data.user;
    } catch {
      Api.setToken(null);
      return null;
    }
  }

  function logout() {
    Api.setToken(null);
    setUser(null);
  }

  return { init, tryRestoreSession, logout, getUser, setUser };
})();
