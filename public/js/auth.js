/* ── auth.js — client-side validation + modal logic ─────────── */
/* Loaded on both index.html and builder.html.
   Index-specific elements are null on builder.html — guarded below. */

const modal       = document.getElementById('auth-modal');
const backdrop    = document.getElementById('auth-backdrop');
const builderCard = document.getElementById('builder-card');
const builderCta  = document.getElementById('builder-cta');
const userBar     = document.getElementById('user-bar');
const userGreeting = document.getElementById('user-greeting');

// ── Only wire up index.html elements when they exist ──────────
if (modal && backdrop) {

  // ── Open / close modal ──────────────────────────────────────
  function openModal(tab = 'login') {
    modal.classList.add('open');
    backdrop.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    switchTab(tab);
  }

  function closeModal() {
    modal.classList.remove('open');
    backdrop.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    clearErrors();
  }

  document.getElementById('auth-close').addEventListener('click', closeModal);
  backdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // ── Tabs ────────────────────────────────────────────────────
  function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.auth-form').forEach(f =>
      f.classList.toggle('active', f.id === `form-${tab}`));
    clearErrors();
  }

  document.querySelectorAll('.auth-tab').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  document.querySelectorAll('.auth-link').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.switch)));

  // ── Builder card click → open modal ────────────────────────
  builderCard.addEventListener('click', () => {
    if (builderCard.classList.contains('unlocked')) {
      window.location.href = 'builder.html';
    } else {
      openModal('login');
    }
  });

  // ── Validation helpers ──────────────────────────────────────
  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }
  function clearErrors() {
    document.querySelectorAll('.field-error').forEach(e => e.textContent = '');
    document.querySelectorAll('input').forEach(i => i.classList.remove('invalid'));
  }
  function markInvalid(inputId, errId, msg) {
    const input = document.getElementById(inputId);
    if (input) input.classList.add('invalid');
    showError(errId, msg);
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ── Login validation ────────────────────────────────────────
  function validateLogin() {
    clearErrors();
    let valid = true;
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-password').value;

    if (!email) {
      markInvalid('login-email', 'login-email-err', 'Email is required.');
      valid = false;
    } else if (!validateEmail(email)) {
      markInvalid('login-email', 'login-email-err', 'Enter a valid email address.');
      valid = false;
    }
    if (!pass) {
      markInvalid('login-password', 'login-password-err', 'Password is required.');
      valid = false;
    }
    return valid;
  }

  // ── Register validation ─────────────────────────────────────
  function validateRegister() {
    clearErrors();
    let valid = true;
    const username = document.getElementById('reg-username').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const pass     = document.getElementById('reg-password').value;
    const confirm  = document.getElementById('reg-confirm').value;

    if (!username || username.length < 3) {
      markInvalid('reg-username', 'reg-username-err', 'Username must be at least 3 characters.');
      valid = false;
    }
    if (!email) {
      markInvalid('reg-email', 'reg-email-err', 'Email is required.');
      valid = false;
    } else if (!validateEmail(email)) {
      markInvalid('reg-email', 'reg-email-err', 'Enter a valid email address.');
      valid = false;
    }
    if (pass.length < 8) {
      markInvalid('reg-password', 'reg-password-err', 'Password must be at least 8 characters.');
      valid = false;
    }
    if (pass !== confirm) {
      markInvalid('reg-confirm', 'reg-confirm-err', 'Passwords do not match.');
      valid = false;
    }
    return valid;
  }

  // ── Form submits ────────────────────────────────────────────
  document.getElementById('form-login').addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateLogin()) return;

    const btn = document.getElementById('login-submit');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:    document.getElementById('login-email').value.trim(),
          password: document.getElementById('login-password').value
        })
      });
      const data = await res.json();

      if (!res.ok) {
        showError('login-form-err', data.message || 'Login failed. Please try again.');
      } else {
        handleLoginSuccess(data);
      }
    } catch {
      showError('login-form-err', 'Cannot connect to server.');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  document.getElementById('form-register').addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateRegister()) return;

    const btn = document.getElementById('register-submit');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: document.getElementById('reg-username').value.trim(),
          email:    document.getElementById('reg-email').value.trim(),
          password: document.getElementById('reg-password').value
        })
      });
      const data = await res.json();

      if (!res.ok) {
        showError('reg-form-err', data.message || 'Registration failed. Please try again.');
      } else {
        handleLoginSuccess(data);
      }
    } catch {
      showError('reg-form-err', 'Cannot connect to server.');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  });

  // ── Post-login UI update ────────────────────────────────────
  function handleLoginSuccess(data) {
    if (data.token)    localStorage.setItem('mtg_token',    data.token);
    if (data.username) localStorage.setItem('mtg_username', data.username);
    closeModal();
    window.location.href = 'builder.html';
  }

  function setLoggedIn(username) {
    if (userBar)      userBar.style.display = 'flex';
    if (userGreeting) userGreeting.textContent = `Hello, ${username}`;
    if (builderCard)  builderCard.classList.add('unlocked');
    if (builderCta)   builderCta.textContent = 'Open builder →';
    const lock = document.getElementById('portal-lock');
    if (lock) lock.style.display = 'none';
  }

  function setLoggedOut() {
    if (userBar)     userBar.style.display = 'none';
    if (builderCard) builderCard.classList.remove('unlocked');
    if (builderCta)  builderCta.textContent = 'Sign in to build →';
    const lock = document.getElementById('portal-lock');
    if (lock) lock.style.display = '';
    localStorage.removeItem('mtg_token');
    localStorage.removeItem('mtg_username');
  }

  // ── Logout ──────────────────────────────────────────────────
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
      setLoggedOut();
    });
  }

  // ── Restore session on page load ────────────────────────────
  (function restoreSession() {
    const token    = localStorage.getItem('mtg_token');
    const username = localStorage.getItem('mtg_username');
    if (token && username) setLoggedIn(username);
  })();

} // end index-only block
