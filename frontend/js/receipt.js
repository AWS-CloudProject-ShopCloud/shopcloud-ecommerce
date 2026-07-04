/**
 * receipt.js — Receipts page logic
 * Lists and displays receipts retrieved from AWS S3
 */

const API = '/api';
const TAX_RATE = 0.08;

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
function formatDate(iso) {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

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

  const params = new URLSearchParams(window.location.search);
  const receiptId = params.get('receiptId') || localStorage.getItem('lastReceiptId');

  if (receiptId) {
    localStorage.removeItem('lastReceiptId');
    await loadReceiptDetail(receiptId);
  } else {
    await loadReceiptList();
  }
})();

// ─── Load Receipt List from S3 ────────────────────────────────────────────────
async function loadReceiptList() {
  const skeletons = document.getElementById('receiptSkeletons');
  const tableContainer = document.getElementById('tableContainer');
  const emptyState = document.getElementById('emptyReceiptState');
  
  skeletons.style.display = 'block';
  tableContainer.style.display = 'none';
  emptyState.style.display = 'none';

  try {
    const res = await fetch(`${API}/receipt`, {
      headers: { 'Authorization': `Bearer ${getToken()}` },
    });

    if (!res.ok) throw new Error('Failed to load receipts');

    const data = await res.json();
    const receipts = data.receipts || [];

    document.getElementById('receiptCountInfo').textContent = `${receipts.length} total`;

    skeletons.style.display = 'none';

    if (receipts.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    tableContainer.style.display = 'block';
    renderReceiptList(receipts);
  } catch (err) {
    skeletons.style.display = 'none';
    showToast('Failed to load receipts from S3: ' + err.message, 'error');
    emptyState.style.display = 'block';
  }
}

// ─── Render Receipt List Table ────────────────────────────────────────────────
function renderReceiptList(receipts) {
  const list = document.getElementById('receiptList');
  list.innerHTML = receipts.map((r, i) => `
    <tr style="animation: slideIn 0.2s ease-out ${i * 0.03}s both;">
      <td class="text-mono" style="font-size: 0.85rem;">
        <div>${r.receiptId.split('-')[0].toUpperCase()}...</div>
        <div class="text-muted" style="font-size: 0.75rem;">${r.receiptId}</div>
      </td>
      <td>${new Date(r.lastModified).toLocaleString()}</td>
      <td class="text-mono text-muted">${formatBytes(r.size)}</td>
      <td>
        <button class="btn btn-outline" style="padding: 0.25rem 0.75rem; font-size: 0.75rem;" onclick="loadReceiptDetail('${r.receiptId}')">View</button>
      </td>
    </tr>
  `).join('');
}

// ─── Load and Display a Single Receipt Detail ─────────────────────────────────
window.loadReceiptDetail = async function(receiptId) {
  document.getElementById('listView').style.display = 'none';
  document.getElementById('detailView').style.display = 'block';
  
  // Show skeletons in detail view implicitly by clearing fields
  document.getElementById('receiptId').textContent = 'Loading...';
  document.getElementById('receiptItemsList').innerHTML = '<div style="padding:1rem; text-align:center;" class="text-muted">Fetching from S3...</div>';
  
  try {
    const res = await fetch(`${API}/receipt/${receiptId}`, {
      headers: { 'Authorization': `Bearer ${getToken()}` },
    });

    if (!res.ok) throw new Error('Receipt not found');

    const data = await res.json();
    renderReceiptDetail(data.receipt, data.key);
  } catch (err) {
    showToast('Failed to load receipt from S3: ' + err.message, 'error');
    showListView();
  }
};

// ─── Render Receipt Detail View ───────────────────────────────────────────────
function renderReceiptDetail(receipt, s3Key) {
  document.getElementById('receiptId').textContent = receipt.receiptId;
  document.getElementById('customerName').textContent = receipt.userName || '—';
  document.getElementById('customerEmail').textContent = receipt.userEmail || '—';
  document.getElementById('purchaseDate').textContent = formatDate(receipt.purchaseDate);

  // Items
  const itemsList = document.getElementById('receiptItemsList');
  itemsList.innerHTML = (receipt.items || []).map(item => `
    <div class="flex justify-between items-center" style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color);">
      <div>
        <div style="font-weight: 500;">${item.name}</div>
        <div class="text-muted text-sm">Qty: ${item.quantity}</div>
      </div>
      <div class="text-mono">${fmt(item.price * item.quantity)}</div>
    </div>
  `).join('');

  const subtotal = receipt.totalAmount || receipt.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax;

  document.getElementById('receiptSubtotal').textContent = fmt(subtotal);
  document.getElementById('receiptTax').textContent = fmt(tax);
  document.getElementById('receiptTotal').textContent = fmt(total);

  if (s3Key) {
    document.getElementById('s3Location').textContent = `s3://${s3Key}`;
  }
}

// ─── Show list view ───────────────────────────────────────────────────────────
window.showListView = function() {
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('listView').style.display = 'block';
  history.pushState({}, '', 'receipt.html');
  if (document.getElementById('receiptList').innerHTML.trim() === '') {
    loadReceiptList();
  }
};
