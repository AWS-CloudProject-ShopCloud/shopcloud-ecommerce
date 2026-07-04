/**
 * cart.js — Cart page logic
 * Renders cart items, handles quantity updates, triggers Lambda purchase
 */

const API = '/api';
const TAX_RATE = 0.08;

const CATEGORY_EMOJI = {
  'Electronics': '💻', 'Books': '📚', 'Furniture': '🪑',
  'Storage': '💾', 'Accessories': '🔌', 'Default': '📦',
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3800);
}

function getToken() { return localStorage.getItem('accessToken'); }
function getCart() { return JSON.parse(localStorage.getItem('cart') || '[]'); }
function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadge();
  renderCart();
}
function updateCartBadge() {
  const cart = getCart();
  const total = cart.reduce((s, i) => s + i.quantity, 0);
  const badge = document.getElementById('cartCountBadge');
  if (badge) badge.textContent = total;
}

window.handleLogout = function() {
  const token = getToken();
  if (token) fetch(`${API}/auth/logout`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }).catch(() => {});
  localStorage.clear();
  window.location.href = 'index.html';
};

function fmt(n) { return `$${parseFloat(n).toFixed(2)}`; }

// ─── Auth Guard & Init ────────────────────────────────────────────────────────
(async function init() {
  const token = getToken();
  if (!token) { window.location.href = 'index.html'; return; }

  try {
    const res = await fetch(`${API}/auth/me`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (!res.ok) throw new Error();
    const user = await res.json();
    document.getElementById('userName').textContent = user.name || user.email;
  } catch {
    localStorage.clear();
    window.location.href = 'index.html';
    return;
  }

  updateCartBadge();
  renderCart();
})();

// ─── Render Cart ──────────────────────────────────────────────────────────────
function renderCart() {
  const cart = getCart();
  const emptyState = document.getElementById('emptyCartState');
  const cartContent = document.getElementById('cartContent');
  const cartList = document.getElementById('cartItemsList');

  if (cart.length === 0) {
    emptyState.style.display = 'block';
    cartContent.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  cartContent.style.display = 'grid';

  document.getElementById('itemCountLabel').textContent =
    `(${cart.reduce((s, i) => s + i.quantity, 0)})`;

  // Cart items
  cartList.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      <div style="font-size: 2rem; margin-right: 1rem; line-height: 1;">${CATEGORY_EMOJI[item.category] || '📦'}</div>
      <div style="flex-grow: 1;">
        <div style="font-weight: 500;">${item.name}</div>
        <div class="text-muted text-sm">${item.category}</div>
        <div class="text-mono" style="margin-top: 0.25rem;">${fmt(item.price)}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <button class="qty-btn" onclick="changeQty(${idx}, -1)">-</button>
          <span style="font-weight: 500; font-variant-numeric: tabular-nums; min-width: 1rem; text-align: center;">${item.quantity}</span>
          <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
        </div>
        <button onclick="removeItem(${idx})" class="btn btn-outline" style="padding: 0.25rem 0.5rem; border-color: transparent; color: var(--status-error);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  // Summary
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  document.getElementById('summaryItems').innerHTML = cart.map(item => `
    <div class="summary-row">
      <span class="text-muted" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%;">${item.name} × ${item.quantity}</span>
      <span class="text-mono">${fmt(item.price * item.quantity)}</span>
    </div>
  `).join('');

  document.getElementById('subtotalAmount').textContent = fmt(subtotal);
  document.getElementById('taxAmount').textContent = fmt(tax);
  document.getElementById('totalAmount').textContent = fmt(total);
}

// ─── Quantity Controls ────────────────────────────────────────────────────────
window.changeQty = function(idx, delta) {
  const cart = getCart();
  cart[idx].quantity = Math.max(1, cart[idx].quantity + delta);
  saveCart(cart);
};

window.removeItem = function(idx) {
  const cart = getCart();
  const removed = cart.splice(idx, 1)[0];
  showToast(`Removed from cart`, 'info');
  saveCart(cart);
};

window.clearCart = function() {
  if (!confirm('Are you sure you want to clear your cart?')) return;
  saveCart([]);
  showToast('Cart cleared', 'info');
};

// ─── Purchase (Lambda trigger) ────────────────────────────────────────────────
window.handlePurchase = async function() {
  const cart = getCart();
  if (cart.length === 0) { showToast('Your cart is empty!', 'warning'); return; }

  const btn = document.getElementById('purchaseBtn');
  const btnText = document.getElementById('purchaseBtnText');
  const btnSpinner = document.getElementById('purchaseBtnSpinner');

  btn.disabled = true;
  btnText.style.display = 'none';
  btnSpinner.style.display = 'inline-block';

  try {
    const res = await fetch(`${API}/purchase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ items: cart }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Purchase failed');

    // Clear cart and redirect to receipt
    localStorage.setItem('lastReceiptId', data.receiptId);
    localStorage.removeItem('cart');

    showToast('Purchase successful!', 'success');
    setTimeout(() => {
      window.location.href = `receipt.html?receiptId=${data.receiptId}`;
    }, 1200);

  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btnText.style.display = 'inline';
    btnSpinner.style.display = 'none';
  }
};
