/**
 * products.js — Product listing page logic
 * Fetches products from DynamoDB via Express API
 */

const API = '/api';

// ─── Category emoji map ───────────────────────────────────────────────────────
const CATEGORY_EMOJI = {
  'Electronics': '💻',
  'Books': '📚',
  'Furniture': '🪑',
  'Storage': '💾',
  'Accessories': '🔌',
  'Default': '📦',
};

// ─── Shared Utilities ─────────────────────────────────────────────────────────
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
}

function updateCartBadge() {
  const cart = getCart();
  const total = cart.reduce((sum, i) => sum + i.quantity, 0);
  const badge = document.getElementById('cartCountBadge');
  if (badge) badge.textContent = total;
}

function handleLogout() {
  const token = getToken();
  if (token) {
    fetch(`${API}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    }).catch(() => {});
  }
  localStorage.clear();
  window.location.href = 'index.html';
}

// ─── Auth Guard ───────────────────────────────────────────────────────────────
(async function init() {
  const token = getToken();
  if (!token) {
    window.location.href = 'index.html';
    return;
  }

  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Token expired');
    const user = await res.json();
    document.getElementById('userName').textContent = user.name || user.email;
  } catch {
    localStorage.clear();
    window.location.href = 'index.html';
    return;
  }

  updateCartBadge();
  loadProducts();
})();

// ─── Products State ────────────────────────────────────────────────────────────
let allProducts = [];
let activeCategory = 'all';

// ─── Load Products from DynamoDB ──────────────────────────────────────────────
async function loadProducts() {
  try {
    const res = await fetch(`${API}/products`, {
      headers: { 'Authorization': `Bearer ${getToken()}` },
    });

    if (!res.ok) throw new Error('Failed to load products');

    const data = await res.json();
    allProducts = data.products || [];

    document.getElementById('productCountInfo').textContent = `${allProducts.length} items`;

    buildCategoryFilters();
    renderProducts(allProducts);

  } catch (err) {
    showToast('Failed to load products from DynamoDB: ' + err.message, 'error');
    document.getElementById('productsGrid').innerHTML = '';
    document.getElementById('emptyState').style.display = 'block';
  }
}

// ─── Build Category Filter Chips ──────────────────────────────────────────────
function buildCategoryFilters() {
  const categories = [...new Set(allProducts.map(p => p.category))].sort();
  const container = document.getElementById('categoryFilters');

  categories.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'btn btn-outline';
    chip.style.borderColor = 'transparent';
    chip.dataset.category = cat;
    chip.onclick = () => filterByCategory(chip, cat);
    chip.textContent = `${CATEGORY_EMOJI[cat] || '📦'} ${cat}`;
    container.appendChild(chip);
  });
}

// ─── Filter by Category ───────────────────────────────────────────────────────
function filterByCategory(el, category) {
  document.querySelectorAll('#categoryFilters .btn').forEach(c => {
    c.style.background = 'transparent';
    c.style.borderColor = 'transparent';
  });
  el.style.background = 'var(--bg-surface-hover)';
  el.style.borderColor = 'var(--border-color-focus)';
  activeCategory = category;
  filterProducts();
}

// ─── Smart Search ─────────────────────────────────────────────────────────────
window.handleSmartSearch = function(e) {
  filterProducts();
};

function filterProducts() {
  const search = document.getElementById('searchInput').value.toLowerCase().trim();
  const filtered = allProducts.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchSearch = !search ||
      p.name.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search) ||
      p.category.toLowerCase().includes(search);
    return matchCat && matchSearch;
  });

  renderProducts(filtered);
}

// ─── Render Product Cards ─────────────────────────────────────────────────────
function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  const empty = document.getElementById('emptyState');

  grid.innerHTML = '';
  empty.style.display = products.length === 0 ? 'block' : 'none';

  const cart = getCart();

  products.forEach((product, i) => {
    const inCart = cart.find(c => c.productId === product.productId);
    const emoji = CATEGORY_EMOJI[product.category] || '📦';
    const isLowStock = product.quantity < 10;
    const stockClass = isLowStock ? 'badge-warning' : 'badge-success';
    const stockLabel = isLowStock ? `${product.quantity} left` : `In Stock`;

    const card = document.createElement('div');
    card.className = 'card';
    card.style.animation = `slideIn 0.3s ease-out ${i * 0.05}s both`;
    card.innerHTML = `
      <div class="flex items-center justify-between" style="margin-bottom: 1rem;">
        <span style="font-size:2.5rem; line-height: 1;">${emoji}</span>
        <span class="badge ${stockClass}">${stockLabel}</span>
      </div>
      <h3 class="card-title">${product.name}</h3>
      <p class="card-subtitle">${product.category}</p>
      <p class="text-sm text-muted" style="margin-bottom: 1.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${product.description}</p>
      
      <div class="flex items-center justify-between mt-auto">
        <div class="card-price">$${parseFloat(product.price).toFixed(2)}</div>
        <button
          id="btn-${product.productId}"
          class="btn ${inCart ? 'btn-outline' : 'btn-primary'}"
          onclick="toggleCart(event, '${product.productId}')"
          ${product.quantity === 0 ? 'disabled' : ''}
          style="padding: 0.25rem 0.75rem;"
        >
          ${product.quantity === 0 ? 'Out' : inCart ? '✓ Added' : 'Add'}
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ─── Toggle Add/Remove from Cart ─────────────────────────────────────────────
window.toggleCart = function(e, productId) {
  e.stopPropagation();

  const product = allProducts.find(p => p.productId === productId);
  if (!product) return;

  let cart = getCart();
  const idx = cart.findIndex(c => c.productId === productId);

  if (idx >= 0) {
    cart.splice(idx, 1);
    showToast(`Removed from cart`, 'info');
  } else {
    cart.push({
      productId: product.productId,
      name: product.name,
      price: product.price,
      category: product.category,
      quantity: 1,
    });
    showToast(`Added to cart`, 'success');
  }

  saveCart(cart);

  // Update button
  const btn = document.getElementById(`btn-${productId}`);
  const inCart = cart.find(c => c.productId === productId);
  if (btn) {
    btn.className = `btn ${inCart ? 'btn-outline' : 'btn-primary'}`;
    btn.textContent = inCart ? '✓ Added' : 'Add';
  }
};
