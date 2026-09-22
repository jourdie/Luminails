const products = [
  { id: 'ph-bond', brand: 'Luminails Lab', name: 'PH Bond — nail prep', category: 'prep', categoryLabel: 'Prep', price: 38500, shade: 'PH', tone: 'tone-clear', sku: 'LN-PHB-01', badge: 'Best seller' },
  { id: 'gel-petal', brand: 'Bluesky', name: 'Color Gel — Petal Glow', category: 'gel', categoryLabel: 'Color gel', price: 62000, shade: '07', tone: 'tone-coral', sku: 'BS-G07', badge: 'New shade' },
  { id: 'rubber-base', brand: 'Party', name: 'Rubber Base — Milky', category: 'gel', categoryLabel: 'Base gel', price: 79000, shade: 'RB', tone: 'tone-lilac', sku: 'PT-RB-02', badge: 'Core studio' },
  { id: 'buffer', brand: 'Luminails Lab', name: 'Buffer 100/180 — soft touch', category: 'tools', categoryLabel: 'Tools', price: 12000, shade: '100', tone: 'tone-sage', sku: 'LN-BUF-01', badge: 'Refill' },
  { id: 'top-coat', brand: 'Born Pretty', name: 'No Wipe Top Coat — glass', category: 'gel', categoryLabel: 'Top coat', price: 54000, shade: 'TOP', tone: 'tone-clear', sku: 'BP-TOP-08', badge: 'High shine' },
  { id: 'lint-free', brand: 'Luminails Lab', name: 'Lint Free Wipes — 200 pcs', category: 'tools', categoryLabel: 'Tools', price: 28000, shade: '200', tone: 'tone-ink', sku: 'LN-LFW-02', badge: 'Studio pack' }
];

const state = { filter: 'all', query: '', sort: 'featured', cart: {} };
const grid = document.querySelector('[data-product-grid]');
const emptyState = document.querySelector('[data-empty-state]');
const totalLabel = document.querySelector('[data-product-total]');
const cartDrawer = document.querySelector('[data-cart-drawer]');
const backdrop = document.querySelector('[data-drawer-backdrop]');
const loginModal = document.querySelector('[data-login-modal]');
const modalBackdrop = document.querySelector('[data-modal-backdrop]');
const toast = document.querySelector('[data-toast]');

const formatPrice = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

function visibleProducts() {
  const query = state.query.trim().toLowerCase();
  const filtered = products.filter((product) => {
    const categoryMatch = state.filter === 'all' || product.category === state.filter;
    const queryMatch = !query || `${product.brand} ${product.name} ${product.sku}`.toLowerCase().includes(query);
    return categoryMatch && queryMatch;
  });
  if (state.sort === 'price-low') return filtered.toSorted((a, b) => a.price - b.price);
  if (state.sort === 'price-high') return filtered.toSorted((a, b) => b.price - a.price);
  return filtered;
}

function productMarkup(product) {
  return `<article class="product-card">
    <div class="product-image"><span class="product-badge">${product.badge}</span><div class="product-bottle ${product.tone}" data-shade="${product.shade}"></div><span class="product-sku">${product.sku}</span></div>
    <div class="product-info"><div class="product-topline"><span>${product.brand}</span><span>${product.categoryLabel}</span></div><h3>${product.name}</h3><div class="product-bottom"><div class="product-price">${formatPrice(product.price)}<small>Harga contoh B2B</small></div><button class="add-product" data-add="${product.id}" aria-label="Tambah ${product.name} ke keranjang">+</button></div></div>
  </article>`;
}

function renderProducts() {
  const list = visibleProducts();
  grid.innerHTML = list.map(productMarkup).join('');
  totalLabel.textContent = list.length;
  emptyState.hidden = list.length !== 0;
  grid.hidden = list.length === 0;
}

function cartEntries() { return Object.entries(state.cart).map(([id, quantity]) => ({ product: products.find((item) => item.id === id), quantity })).filter((entry) => entry.product); }

function cartMarkup() {
  const entries = cartEntries();
  if (!entries.length) return '<div class="drawer-empty"><span>✦</span><p>Keranjangmu masih kosong.<br />Pilih essentials untuk mulai order.</p></div>';
  return entries.map(({ product, quantity }) => `<div class="cart-line"><div class="cart-thumb"><div class="product-bottle ${product.tone}" data-shade="${product.shade}"></div></div><div><h3>${product.name}</h3><small>${product.sku} · ${formatPrice(product.price)}</small><strong>${formatPrice(product.price * quantity)}</strong><div class="line-controls"><button data-decrease="${product.id}" aria-label="Kurangi jumlah">−</button><span>${quantity}</span><button data-increase="${product.id}" aria-label="Tambah jumlah">+</button></div></div><button class="remove-line" data-remove="${product.id}" aria-label="Hapus ${product.name}">×</button></div>`).join('');
}

function renderCart() {
  const entries = cartEntries();
  const count = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const total = entries.reduce((sum, entry) => sum + entry.quantity * entry.product.price, 0);
  document.querySelector('[data-cart-items]').innerHTML = cartMarkup();
  document.querySelector('[data-cart-count]').textContent = count;
  document.querySelector('[data-cart-total]').textContent = formatPrice(total);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove('is-visible'), 2400);
}

function setCartOpen(isOpen) {
  cartDrawer.classList.toggle('is-open', isOpen);
  cartDrawer.setAttribute('aria-hidden', String(!isOpen));
  backdrop.hidden = !isOpen;
  document.body.classList.toggle('no-scroll', isOpen);
}

function setLoginOpen(isOpen) {
  loginModal.classList.toggle('is-open', isOpen);
  loginModal.setAttribute('aria-hidden', String(!isOpen));
  modalBackdrop.hidden = !isOpen;
  document.body.classList.toggle('no-scroll', isOpen);
}

document.addEventListener('click', (event) => {
  const addButton = event.target.closest('[data-add]');
  if (addButton) {
    const id = addButton.dataset.add;
    state.cart[id] = (state.cart[id] || 0) + 1;
    renderCart();
    showToast('Produk masuk ke keranjang.');
    return;
  }
  const increase = event.target.closest('[data-increase]');
  const decrease = event.target.closest('[data-decrease]');
  const remove = event.target.closest('[data-remove]');
  if (increase) state.cart[increase.dataset.increase] = (state.cart[increase.dataset.increase] || 0) + 1;
  if (decrease) state.cart[decrease.dataset.decrease] = Math.max((state.cart[decrease.dataset.decrease] || 1) - 1, 0);
  if (remove) delete state.cart[remove.dataset.remove];
  if (increase || decrease || remove) renderCart();
  if (event.target.closest('[data-open-cart]')) { renderCart(); setCartOpen(true); }
  if (event.target.closest('[data-close-cart]') || event.target === backdrop) setCartOpen(false);
  if (event.target.closest('[data-open-login]')) setLoginOpen(true);
  if (event.target.closest('[data-close-login]') || event.target === modalBackdrop) setLoginOpen(false);
  if (event.target.closest('[data-demo-login]')) { setLoginOpen(false); showToast('Form login akan tersedia di milestone auth.'); }
  if (event.target.closest('[data-checkout]')) showToast('Review order akan terhubung ke akun B2B.');
  if (event.target.closest('[data-reset]')) { state.filter = 'all'; state.query = ''; document.querySelector('[data-search]').value = ''; document.querySelectorAll('[data-filter]').forEach((chip) => chip.classList.toggle('is-active', chip.dataset.filter === 'all')); renderProducts(); }
});

document.querySelectorAll('[data-filter]').forEach((chip) => chip.addEventListener('click', () => {
  state.filter = chip.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('is-active', item === chip));
  renderProducts();
}));
document.querySelector('[data-search]').addEventListener('input', (event) => { state.query = event.target.value; renderProducts(); });
document.querySelector('[data-sort]').addEventListener('change', (event) => { state.sort = event.target.value; renderProducts(); });
document.querySelector('[data-mobile-menu]').addEventListener('click', (event) => { const open = event.currentTarget.getAttribute('aria-expanded') === 'true'; event.currentTarget.setAttribute('aria-expanded', String(!open)); document.querySelector('.main-nav').classList.toggle('mobile-open', !open); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { setCartOpen(false); setLoginOpen(false); } });

renderProducts();
renderCart();
