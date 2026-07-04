/**
 * auth.js — Handles Authentication
 * Login & Registration
 */

const API = '/api';

// ─── Utility: Toast Notifications ────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3800);
}

// ─── Utility: Set button loading state ───────────────────────────────────────
function setLoading(btnId, textId, loading) {
  const btn = document.getElementById(btnId);
  const text = document.getElementById(textId);
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalText = text.textContent;
    text.textContent = 'Please wait...';
  } else {
    text.textContent = btn.dataset.originalText;
  }
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
window.switchTab = function(tab) {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginTab = document.getElementById('loginTab');
  const registerTab = document.getElementById('registerTab');

  loginForm.style.display = 'none';
  registerForm.style.display = 'none';
  loginTab.classList.remove('active');
  registerTab.classList.remove('active');

  if (tab === 'login') {
    loginForm.style.display = 'block';
    loginTab.classList.add('active');
  } else if (tab === 'register') {
    registerForm.style.display = 'block';
    registerTab.classList.add('active');
  }
};

// ─── Handle Login ─────────────────────────────────────────────────────────────
window.handleLogin = async function(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showToast('Please enter your email and password.', 'warning');
    return;
  }

  setLoading('loginBtn', 'loginBtnText', true);

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Login failed');

    // Store tokens
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('idToken', data.idToken);
    localStorage.setItem('userEmail', email);

    showToast('Login successful!', 'success');
    setTimeout(() => window.location.href = 'products.html', 800);

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading('loginBtn', 'loginBtnText', false);
  }
};

// ─── Handle Register ──────────────────────────────────────────────────────────
window.handleRegister = async function(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  if (!name || !email || !password) {
    showToast('Please fill in all fields.', 'warning');
    return;
  }

  if (password.length < 8) {
    showToast('Password must be at least 8 characters.', 'warning');
    return;
  }

  setLoading('registerBtn', 'registerBtnText', true);

  try {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Registration failed');

    showToast('Account created! You can now sign in.', 'success');
    
    // Pre-fill login email and switch to login tab
    setTimeout(() => {
      document.getElementById('loginEmail').value = email;
      switchTab('login');
    }, 800);

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading('registerBtn', 'registerBtnText', false);
  }
};

// ─── Check if already logged in ───────────────────────────────────────────────
(function checkAuth() {
  const token = localStorage.getItem('accessToken');
  if (token) {
    window.location.href = 'products.html';
  }
})();
