// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Kalakroti Rugs â€“ Frontend Engine v4.0 (Shopping Suite)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const API_BASE_URL = window.KALAKROTI_API_BASE_URL || '/api';

// State Management
let cart     = JSON.parse(localStorage.getItem('Kalakroti_cart'))     || [];
let wishlist = JSON.parse(localStorage.getItem('Kalakroti_wishlist')) || [];
let currentUser = JSON.parse(localStorage.getItem('Kalakroti_user')) || null;
let collectionSyncTimer = null;
let publicConfig = null;
let activeFilters = {
    category_slug: null,
    style: null,
    room: null,
    space: [],
    shape: [],
    size: [],
    material: [],
    price_min: 0,
    price_max: 100000,
    search: null,
    sort: '-created_at'
};

const FALLBACK_CATEGORIES = [
    { id: 1, name: 'Silk Carpets', slug: 'silk-carpets', image_url: '/static/images/silk-carpets-e7427e.jpg', order: 1 },
    { id: 2, name: 'Woolen Rugs', slug: 'woolen-rugs', image_url: '/static/images/woolen-rugs-28654e.jpg', order: 2 },
    { id: 3, name: 'Vintage Kilims', slug: 'vintage-kilims', image_url: '/static/images/vintage-kilims-3112c8.jpg', order: 3 },
    { id: 4, name: 'Modern Abstracts', slug: 'modern-abstracts', image_url: '/static/images/modern-abstracts-3813de.jpg', order: 4 }
];

const FALLBACK_PRODUCTS = [];

function normalizeProducts(data) {
    const products = data.results ?? data;
    return Array.isArray(products) ? products.map(p => ({
        ...p,
        category_slug: p.category_slug || FALLBACK_CATEGORIES.find(c => c.id === p.category)?.slug || slugifyText(p.category_name || ''),
        price: Number(p.price || 0),
        discount_price: p.discount_price === null || p.discount_price === undefined || p.discount_price === '' ? null : Number(p.discount_price)
    })) : [];
}

function slugifyText(value) {
    return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function filterFallbackProducts() {
    let products = [...FALLBACK_PRODUCTS];
    if (activeFilters.search) {
        const q = activeFilters.search.toLowerCase();
        products = products.filter(p => [p.title, p.description, p.material, p.origin, p.category_name, p.space, p.shape, p.pattern_style].some(v => String(v || '').toLowerCase().includes(q)));
    }
    if (activeFilters.category_slug) products = products.filter(p => p.category_slug === activeFilters.category_slug);
    if (activeFilters.style) products = products.filter(p => [p.pattern_style, ...(p.tags || []).map(t => t.name)].some(v => slugifyText(v) === slugifyText(activeFilters.style)));
    if (activeFilters.room) products = products.filter(p => slugifyText(p.space).includes(slugifyText(activeFilters.room)));
    if (activeFilters.price_min > 0) products = products.filter(p => Number(p.discount_price || p.price) >= activeFilters.price_min);
    if (activeFilters.price_max < 100000) products = products.filter(p => Number(p.discount_price || p.price) <= activeFilters.price_max);
    ['space', 'shape', 'size', 'material'].forEach(field => {
        if (activeFilters[field]?.length) products = products.filter(p => activeFilters[field].some(v => String(p[field] || '').toLowerCase().includes(v.toLowerCase())));
    });
    if (activeFilters.sort === 'price') products.sort((a, b) => Number(a.discount_price || a.price) - Number(b.discount_price || b.price));
    else if (activeFilters.sort === '-price') products.sort((a, b) => Number(b.discount_price || b.price) - Number(a.discount_price || a.price));
    else if (activeFilters.sort === 'title') products.sort((a, b) => a.title.localeCompare(b.title));
    else products.sort((a, b) => b.id - a.id);
    return products;
}

async function fetchCatalogProducts(url, options = {}) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const products = normalizeProducts(await res.json());
        if (products.length || options.allowEmpty) return { products, source: 'api' };
    } catch (err) {
        console.warn('Catalog API unavailable, using fallback catalog:', err.message);
    }
    return { products: options.filteredFallback ? filterFallbackProducts() : [...FALLBACK_PRODUCTS], source: 'fallback' };
}

function getAuthToken() {
    return currentUser?.token || localStorage.getItem('Kalakroti_auth_token') || '';
}

function authHeaders(extra = {}) {
    const token = getAuthToken();
    return {
        ...extra,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

function saveCurrentUser(user, token) {
    currentUser = { ...user, token };
    localStorage.setItem('Kalakroti_user', JSON.stringify(currentUser));
    localStorage.setItem('Kalakroti_auth_token', token);
}

function cartForApi() {
    return cart.map(item => ({
        product_id: item.id,
        quantity: item.qty || 1
    }));
}

function wishlistForApi() {
    return wishlist.map(item => ({ product_id: item.id }));
}

async function syncCollection(options = {}) {
    if (!getAuthToken()) return;
    const { merge = false, immediate = false } = options;

    const run = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/account/collection/`, {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    cart: cartForApi(),
                    wishlist: wishlistForApi(),
                    merge
                })
            });
            if (!res.ok) return;
            const data = await res.json();
            cart = data.cart || cart;
            wishlist = data.wishlist || wishlist;
            updateCart(false);
            updateWishlist(false);
        } catch (err) {
            console.warn('Collection sync failed:', err);
        }
    };

    if (immediate) {
        await run();
        return;
    }

    clearTimeout(collectionSyncTimer);
    collectionSyncTimer = setTimeout(run, 350);
}

async function loadPublicConfig() {
    if (publicConfig) return publicConfig;
    try {
        const res = await fetch(`${API_BASE_URL}/config/`);
        publicConfig = res.ok ? await res.json() : {};
    } catch (err) {
        publicConfig = {};
    }
    return publicConfig;
}

// â”€â”€ Router & Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function handleRoute() {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    
    // Sync state from URL
    activeFilters = {
        category_slug: searchParams.get('category'),
        style: searchParams.get('style'),
        room: searchParams.get('room'),
        space: searchParams.get('space')?.split(',') || [],
        shape: searchParams.get('shape')?.split(',') || [],
        size: searchParams.get('size')?.split(',') || [],
        material: searchParams.get('material')?.split(',') || [],
        price_min: parseInt(searchParams.get('min_price')) || 0,
        price_max: parseInt(searchParams.get('max_price')) || 100000,
        search: searchParams.get('q'),
        sort: searchParams.get('sort') || '-created_at'
    };

    document.querySelectorAll('.page-view').forEach(v => v.style.display = 'none');
    closeAllSidebars();
    
    if (path === '/' || path === '/index.html' || path === '') {
        showView('view-home');
        updateSEO("Kalakroti Rugs", "Exquisite Heritage Rugs for Modern Spaces.");
        requestAnimationFrame(() => initHome());
    } else if (path.startsWith('/all')) {
        showView('view-results');
        updateResultsHeader('Our', 'Curated');
        renderBreadcrumbs('results-breadcrumbs', [{ label: 'All Rugs' }]);
        fetchResults();
    } else if (path.startsWith('/category/')) {
        const slug = path.split('/').pop();
        showView('view-results');
        updateResultsHeader(slug.replace(/-/g, ' '), 'Category');
        renderBreadcrumbs('results-breadcrumbs', [{ label: 'Categories', path: '/all' }, { label: slug.replace(/-/g, ' ') }]);
        activeFilters.category_slug = slug;
        fetchResults();
    } else if (path.startsWith('/style/')) {
        const style = path.split('/').pop();
        showView('view-results');
        updateResultsHeader(style.charAt(0).toUpperCase() + style.slice(1), 'Style');
        renderBreadcrumbs('results-breadcrumbs', [{ label: 'Styles', path: '/all' }, { label: style }]);
        activeFilters.style = style;
        fetchResults();
    } else if (path.startsWith('/room/')) {
        const room = decodeURIComponent(path.split('/').pop());
        showView('view-results');
        updateResultsHeader(room.replace(/-/g, ' '), 'Room');
        renderBreadcrumbs('results-breadcrumbs', [{ label: 'Rooms', path: '/all' }, { label: room.replace(/-/g, ' ') }]);
        activeFilters.space = [room];
        fetchResults();
    } else if (path.startsWith('/product/')) {
        const slug = path.split('/').pop();
        showView('view-product');
        fetchProductDetail(slug);
    } else if (path === '/checkout') {
        if (cart.length === 0) {
            showToast('Your cart is empty');
            navigateTo(null, '/');
            return;
        }
        showView('view-checkout');
        updateCheckoutSummary();
    } else if (path === '/contact') {
        showView('view-contact');
        updateSEO("Contact Us", "Personalized assistance for your rug collection.");
    } else if (path === '/account') {
        // If already logged in, go straight to full dashboard
        if (currentUser && getAuthToken()) {
            window.location.href = '/dashboard.html';
            return;
        }
        showView('view-account');
        updateSEO("Account", "Manage your Kalakroti collection.");
        renderAccountView();
    } else if (path === '/order-success') {
        showView('view-order-success');

    } else {
        showView('view-home');
    }
}

function navigateTo(e, path) {
    if (e) e.preventDefault();
    window.history.pushState({}, '', path);
    handleRoute();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.handleNavTab = (e, tab) => {
    if (e) e.preventDefault();
    const currentPath = window.location.pathname;
    if (currentPath !== '/' && currentPath !== '/index.html' && currentPath !== '') {
        window.history.pushState({}, '', '/');
        handleRoute();
        // Wait for page to switch and initHome to run
        setTimeout(() => {
            const section = document.getElementById('spaces');
            if (section) {
                section.scrollIntoView({ behavior: 'smooth' });
                switchShopTab(tab);
            }
        }, 500);
    } else {
        const section = document.getElementById('spaces');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });
            switchShopTab(tab);
        }
    }
};

window.addEventListener('popstate', handleRoute);

function showView(id) {
    const view = document.getElementById(id);
    if (view) view.style.display = 'block';
}

// â”€â”€ UI Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function updateSEO(title, description) {
    document.title = `${title} | Kalakroti Rugs`;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
    }
    metaDesc.content = description || "Discover the finest collection of heritage-grade rugs and carpets at Kalakroti Rugs. Editorial curation for modern and traditional spaces.";
}

function injectProductJSONLD(product) {
    let existingScript = document.getElementById('product-schema');
    if (existingScript) existingScript.remove();

    const schema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": product.title,
        "image": [window.location.origin + product.main_image],
        "description": product.description || product.short_description,
        "sku": product.sku,
        "offers": {
            "@type": "Offer",
            "url": window.location.href,
            "priceCurrency": "INR",
            "price": product.discount_price || product.price,
            "availability": product.stock_quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "itemCondition": "https://schema.org/NewCondition"
        }
    };

    const script = document.createElement('script');
    script.id = 'product-schema';
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
}

function renderBreadcrumbs(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <a href="/" onclick="navigateTo(event, '/')" class="hover:text-heritage-gold transition-colors">Home</a>
        ${items.map(item => `
            <span class="mx-2 opacity-50">/</span>
            ${item.path ? `<a href="${item.path}" onclick="navigateTo(event, '${item.path}')" class="hover:text-heritage-gold transition-colors">${item.label}</a>` : `<span class="text-heritage-gold font-bold">${item.label}</span>`}
        `).join('')}
    `;
}

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function toggleSidebar(id, show) {
    const el = document.getElementById(id);
    const overlay = document.getElementById('sidebar-overlay');
    if (!el) return;
    if(show) {
        el.classList.add('active');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    } else {
        el.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function closeAllSidebars() {
    document.querySelectorAll('.sidebar').forEach(s => s.classList.remove('active'));
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// â”€â”€ Help FAB (Fixed Bottom Right - CSS handles position) â”€â”€
function initFAB() {
    // FAB is now fixed via CSS (bottom: 32px; right: 32px)
    // No drag needed â€” clean, always accessible
    const fab = document.getElementById('help-fab');
    if (!fab) return;
    // Pulse animation on first visit
    if (!localStorage.getItem('fab_seen')) {
        setTimeout(() => {
            fab.style.animation = 'fab-pulse 1s ease 3';
            localStorage.setItem('fab_seen', '1');
        }, 3000);
    }
}

function handleContact(e) {
    e.preventDefault();
    showToast('Message sent to our concierge.');
    e.target.reset();
}

// â”€â”€ Account Suite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function toggleAccountForm(isRegister) {
    document.getElementById('login-form-container').style.display = isRegister ? 'none' : 'block';
    document.getElementById('register-form-container').style.display = isRegister ? 'block' : 'none';
    document.getElementById('account-view-title').innerHTML = isRegister ? 'Join the <i>Circle</i>' : 'Welcome <i>Back</i>';
}

function renderAccountView() {
    const profile = document.getElementById('profile-container');
    const login = document.getElementById('login-form-container');
    const register = document.getElementById('register-form-container');
    
    if (currentUser) {
        profile.style.display = 'block';
        login.style.display = 'none';
        register.style.display = 'none';
        document.getElementById('profile-name').innerText = currentUser.name;
        document.getElementById('profile-email').innerText = currentUser.email;
        document.getElementById('account-view-title').innerHTML = 'Your <i>Collection</i>';
        profile.classList.add('animate-pop');
    } else {
        profile.style.display = 'none';
        login.style.display = 'block';
        register.style.display = 'none';
        document.getElementById('account-view-title').innerHTML = 'Welcome <i>Back</i>';
        login.classList.add('animate-slide-up');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    if (!password || password.length < 6) { showToast('Please enter a valid password'); return; }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to sign in');

        saveCurrentUser(data.user, data.token);
        await syncCollection({ merge: true, immediate: true });
        showToast('Signed in successfully. Redirecting to your dashboard...');
        setTimeout(() => { window.location.href = '/dashboard.html'; }, 800);
    } catch (err) {
        showToast(err.message);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = e.target.name.value;
    const email = e.target.email.value;
    const password = e.target.password.value;
    if (!password || password.length < 6) { showToast('Password must be at least 6 characters'); return; }

    try {
        const res = await fetch(`${API_BASE_URL}/auth/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to create account');

        saveCurrentUser(data.user, data.token);
        await syncCollection({ merge: true, immediate: true });
        showToast('Account created! Welcome to Kalakroti. Redirecting to your dashboard...');
        setTimeout(() => { window.location.href = '/dashboard.html'; }, 800);
    } catch (err) {
        showToast(err.message);
    }
}

function handleLogout() {
    currentUser = null;
    localStorage.removeItem('Kalakroti_user');
    localStorage.removeItem('Kalakroti_auth_token');
    showToast('Signed out');
    renderAccountView();
    updateAuthUI();
}

// Listen for Close buttons, Overlay click, and ESC key
document.addEventListener('click', e => {
    if (e.target.classList.contains('close-sidebar') || e.target.id === 'sidebar-overlay') {
        closeAllSidebars();
    }
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeAllSidebars();
        document.getElementById('search-overlay').style.display = 'none';
    }
});

// â”€â”€ Shopping Suite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function formatPrice(val) {
    return `₹${parseFloat(val).toLocaleString('en-IN')}`;
}

function updateCart(shouldSync = true) {
    localStorage.setItem('Kalakroti_cart', JSON.stringify(cart));
    if (shouldSync) syncCollection();
    
    // Update Badge
    const count = cart.reduce((s, i) => s + (i.qty || 1), 0);
    const badge = document.getElementById('cart-count');
    if (badge) {
        const prevCount = parseInt(badge.innerText) || 0;
        badge.innerText = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
        if (count !== prevCount) {
            badge.classList.add('badge-bump');
            setTimeout(() => badge.classList.remove('badge-bump'), 400);
        }
    }

    // Update Sidebar List
    const container = document.getElementById('cart-items');
    if (!container) return;

    let subtotal = cart.reduce((sum, item) => sum + parseFloat(item.discount_price || item.price) * (item.qty || 1), 0);
    
    container.innerHTML = cart.length ? cart.map((item, i) => `
        <div class="cart-item flex gap-4 mb-8 group">
            <img src="${item.main_image}" class="w-24 h-28 object-cover rounded-sm" loading="lazy">
            <div class="flex-1">
                <h4 class="font-serif text-lg mb-1 leading-tight">${item.title}</h4>
                <p class="text-sm text-heritage-gold font-bold mb-4">${formatPrice(item.discount_price || item.price)}</p>
                <div class="flex items-center gap-4">
                    <div class="flex items-center border border-heritage-dark/10">
                        <button onclick="changeQty(${i}, -1)" class="w-8 h-8 flex items-center justify-center hover:bg-heritage-dark hover:text-white transition-colors">âˆ’</button>
                        <span class="w-8 text-center text-xs font-bold">${item.qty || 1}</span>
                        <button onclick="changeQty(${i}, 1)"  class="w-8 h-8 flex items-center justify-center hover:bg-heritage-dark hover:text-white transition-colors">+</button>
                    </div>
                    <button onclick="removeFromCart(${i})" class="text-[9px] uppercase tracking-widest text-heritage-rust font-bold hover:underline">Remove</button>
                </div>
            </div>
        </div>
    `).join('') : '<div class="text-center py-20 opacity-30"><p class="font-serif text-xl">Your cart is empty</p><p class="text-xs uppercase tracking-widest mt-2">Add some masterpieces</p></div>';

    document.getElementById('cart-subtotal').innerText = formatPrice(subtotal);
    document.getElementById('cart-total').innerText = formatPrice(subtotal);
    
    if (window.location.pathname === '/checkout') updateCheckoutSummary();
}

function addToCart(p) { 
    const existing = cart.find(item => item.id === p.id);
    if (existing) {
        existing.qty = (existing.qty || 1) + 1;
    } else {
        cart.push({...p, qty: 1}); 
    }
    updateCart(); 
    showToast('Added to cart');
    toggleSidebar('cart-sidebar', true);
    const cartEl = document.getElementById('cart-sidebar');
    cartEl.classList.remove('success-flash');
    void cartEl.offsetWidth; // trigger reflow
    cartEl.classList.add('success-flash');
}

function changeQty(i, d) { 
    cart[i].qty = Math.max(1, (cart[i].qty || 1) + d); 
    updateCart(); 
}

function removeFromCart(i) { 
    cart.splice(i, 1); 
    updateCart(); 
    showToast('Removed from cart');
}

// â”€â”€ Checkout & Razorpay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function updateCheckoutSummary() {
    const container = document.getElementById('checkout-summary-items');
    if (!container) return;

    let subtotal = cart.reduce((sum, item) => sum + parseFloat(item.discount_price || item.price) * (item.qty || 1), 0);
    
    container.innerHTML = cart.map(item => `
        <div class="flex gap-4">
            <img src="${item.main_image}" class="w-16 h-20 object-cover rounded-sm" loading="lazy">
            <div class="flex-1">
                <h4 class="font-serif text-base leading-tight">${item.title}</h4>
                <p class="text-xs opacity-50 mt-1">${item.qty} x ${formatPrice(item.discount_price || item.price)}</p>
            </div>
            <div class="font-bold text-sm">${formatPrice(parseFloat(item.discount_price || item.price) * item.qty)}</div>
        </div>
    `).join('');

    document.getElementById('checkout-subtotal').innerText = formatPrice(subtotal);
    document.getElementById('checkout-total').innerText = formatPrice(subtotal);
}

async function handleCheckout(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('pay-btn');
    
    // Basic Validation
    const phone = form.phone.value;
    const pincode = form.pincode.value;
    
    if (phone.length < 10) {
        showToast('Please enter a valid 10-digit phone number');
        return;
    }
    if (pincode.length !== 6) {
        showToast('Please enter a valid 6-digit pincode');
        return;
    }

    const originalText = btn.innerText;
    btn.innerHTML = `
        <svg class="animate-spin h-4 w-4 mr-3 inline-block" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Securing Payment...
    `;
    btn.disabled = true;
    showProcessingOverlay('Verifying payment signature with the treasury...');

    try {
        // 1. Create Order on Backend
        const res = await fetch(`${API_BASE_URL}/create-payment/`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                items: cartForApi(),
                product_ids: cart.map(item => item.id),
                customer_details: {
                    name: form.name.value,
                    email: form.email.value,
                    phone: form.phone.value,
                    address: form.address.value,
                    city: form.city.value,
                    pincode: form.pincode.value
                }
            })
        });

        if (!res.ok) throw new Error('Could not initialize payment');
        const orderData = await res.json();

        if (orderData.mode === 'offline') {
            showProcessingOverlay('Local checkout mode active. Confirming your order...');
            const verifyRes = await fetch(`${API_BASE_URL}/verify-payment/`, {
                method: 'POST',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    razorpay_order_id: orderData.order_id,
                    offline_payment: true,
                    items: cartForApi(),
                    customer_details: {
                        name: form.name.value,
                        email: form.email.value,
                        phone: form.phone.value,
                        address: form.address.value,
                        city: form.city.value,
                        pincode: form.pincode.value
                    }
                })
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Order confirmation failed');

            cart = [];
            updateCart();
            const successId = document.getElementById('success-order-id');
            if (successId) successId.innerText = `#${verifyData.order_id}`;
            hideProcessingOverlay();
            navigateTo(null, '/order-success');
            return;
        }

        // 2. Launch Razorpay
        const options = {
            "key": orderData.key_id,
            "amount": orderData.amount,
            "currency": "INR",
            "name": "Kalakroti Rugs",
            "description": "Exquisite Heritage Collection",
            "order_id": orderData.order_id,
            "handler": async function (response) {
                showToast('Payment Captured. Finalizing Order...');
                try {
                    const verifyRes = await fetch(`${API_BASE_URL}/verify-payment/`, {
                        method: 'POST',
                        headers: authHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            items: cartForApi(),
                            customer_details: {
                                name: form.name.value,
                                email: form.email.value,
                                phone: form.phone.value,
                                address: form.address.value,
                                city: form.city.value,
                                pincode: form.pincode.value
                            },
                            total_amount: cart.reduce((sum, item) => sum + parseFloat(item.discount_price || item.price) * (item.qty || 1), 0)
                        })
                    });

                    if (!verifyRes.ok) throw new Error('Payment verification failed');
                    
                    showProcessingOverlay('Order integrity verified. Confirming stock...');
                    
                    setTimeout(() => {
                        cart = [];
                        updateCart();
                        const successId = document.getElementById('success-order-id');
                        const trackBtn = document.getElementById('success-track-btn');
                        if (successId) successId.innerText = `#${response.razorpay_order_id}`;
                        if (trackBtn) trackBtn.onclick = () => {
                            navigateTo(null, '/account');
                            setTimeout(() => {
                                const input = document.querySelector('#track-form input[name="order_id"]');
                                if (input) {
                                    input.value = response.razorpay_order_id;
                                    handleTrackOrder({ preventDefault: () => {}, target: { order_id: { value: response.razorpay_order_id } } });
                                }
                            }, 500);
                        };
                        
                        hideProcessingOverlay();
                        navigateTo(null, '/order-success');
                    }, 2000);
                } catch (err) {
                    hideProcessingOverlay();
                    showToast('Verification Error: ' + err.message);
                    btn.innerText = originalText;
                    btn.disabled = false;
                }
            },
            "prefill": {
                "name": form.name.value,
                "email": form.email.value,
                "contact": form.phone.value
            },
            "theme": { "color": "#1f1b18" },
            "modal": {
                "ondismiss": function() {
                    btn.innerText = originalText;
                    btn.disabled = false;
                    showToast('Payment cancelled');
                }
            }
        };

        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (response){
            showToast('Payment Failed: ' + response.error.description);
            btn.innerText = originalText;
            btn.disabled = false;
        });
        rzp.open();

    } catch (err) {
        console.error(err);
        showToast('System Error: ' + err.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// â”€â”€ Order Tracking & Processing Overlay â”€â”€â”€â”€â”€â”€â”€

function showProcessingOverlay(status) {
    if (typeof KalakrotiLoader !== 'undefined') {
        KalakrotiLoader.showFullscreen(status);
        return;
    }
    const overlay = document.getElementById('processing-overlay');
    const statusText = document.getElementById('processing-status');
    if (overlay) overlay.style.display = 'flex';
    if (statusText) statusText.innerText = status;
}

function hideProcessingOverlay() {
    if (typeof KalakrotiLoader !== 'undefined') {
        KalakrotiLoader.hideFullscreen();
        return;
    }
    const overlay = document.getElementById('processing-overlay');
    if (overlay) overlay.style.display = 'none';
}

async function handleTrackOrder(e) {
    if (e.preventDefault) e.preventDefault();
    const orderId = e.target.order_id.value;
    const results = document.getElementById('tracking-results');
    
    if (!orderId) return;

    try {
        const res = await fetch(`${API_BASE_URL}/orders/${orderId}/`);
        if (!res.ok) throw new Error('Order not found');
        const order = await res.json();

        results.classList.remove('hidden');
        document.getElementById('track-id-display').innerText = `Order #${order.order_id}`;
        document.getElementById('track-date-display').innerText = `Placed on ${new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        document.getElementById('track-status-badge').innerText = `Status: ${order.status}`;

        // Reset steps
        document.querySelectorAll('.tracking-step, .tracking-step-cancelled, .tracking-step-returned').forEach(s => {
            s.classList.add('opacity-30');
            s.classList.remove('hidden', 'animate-slide-up');
        });
        
        const statusLower = order.status.toLowerCase();
        
        if (statusLower === 'cancelled') {
            document.querySelectorAll('.tracking-step, .tracking-step-returned').forEach(s => s.classList.add('hidden'));
            const cancelStep = document.querySelector('.tracking-step-cancelled');
            if (cancelStep) {
                cancelStep.classList.remove('hidden', 'opacity-30');
                cancelStep.classList.add('animate-slide-up');
            }
        } else if (statusLower === 'returned') {
            document.querySelectorAll('.tracking-step, .tracking-step-cancelled').forEach(s => s.classList.add('hidden'));
            const returnStep = document.querySelector('.tracking-step-returned');
            if (returnStep) {
                returnStep.classList.remove('hidden', 'opacity-30');
                returnStep.classList.add('animate-slide-up');
            }
        } else {
            document.querySelectorAll('.tracking-step-cancelled, .tracking-step-returned').forEach(s => s.classList.add('hidden'));
            const steps = ['pending', 'processed', 'shipped', 'delivered'];
            const currentIdx = steps.indexOf(statusLower);
            
            document.querySelectorAll('.tracking-step').forEach((step, idx) => {
                if (idx <= currentIdx) {
                    step.classList.remove('opacity-30');
                    step.classList.add('animate-slide-up');
                    const dot = step.querySelector('.step-dot');
                    if (dot) dot.classList.add('bg-kalakroti-gold');
                }
            });
        }
        
        results.classList.remove('animate-pop');
        void results.offsetWidth;
        results.classList.add('animate-pop');

    } catch (err) {
        showToast('Tracking Error: ' + err.message);
        results.classList.add('hidden');
    }
}

// â”€â”€ Wishlist Suite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function updateWishlist(shouldSync = true) {
    localStorage.setItem('Kalakroti_wishlist', JSON.stringify(wishlist));
    if (shouldSync) syncCollection();
    const container = document.getElementById('wishlist-items');
    if (!container) return;
    
    container.innerHTML = wishlist.length ? wishlist.map((item, i) => `
        <div class="cart-item flex gap-4 mb-8">
            <img src="${item.main_image}" class="w-24 h-28 object-cover rounded-sm" loading="lazy">
            <div class="flex-1">
                <h4 class="font-serif text-lg mb-1 leading-tight">${item.title}</h4>
                <p class="text-sm text-heritage-gold font-bold mb-4">${formatPrice(item.discount_price || item.price)}</p>
                <div class="flex gap-2">
                    <button onclick='addToCart(${JSON.stringify(item)}); removeFromWishlist(${i})' class="text-[9px] uppercase tracking-widest bg-heritage-dark text-white px-4 py-2 hover:bg-heritage-gold transition-colors">Add to Cart</button>
                    <button onclick="removeFromWishlist(${i})" class="text-[9px] uppercase tracking-widest border border-heritage-rust text-heritage-rust px-4 py-2 hover:bg-heritage-rust hover:text-white transition-colors">Remove</button>
                </div>
            </div>
        </div>
    `).join('') : '<div class="text-center py-20 opacity-30"><p class="font-serif text-xl">Wishlist empty</p></div>';
}

function addToWishlist(p) { 
    if(!wishlist.find(x => x.id === p.id)) {
        wishlist.push(p); 
        updateWishlist();
        showToast('Added to wishlist');
    } else {
        showToast('Already in wishlist');
    }
    toggleSidebar('wishlist-sidebar', true); 
    const wlEl = document.getElementById('wishlist-sidebar');
    wlEl.classList.remove('success-flash');
    void wlEl.offsetWidth;
    wlEl.classList.add('success-flash');
}

function removeFromWishlist(i) { 
    wishlist.splice(i,1); 
    updateWishlist(); 
}

// â”€â”€ Home View Logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function initHome() {
    fetchFeaturedProducts();
    switchShopTab('room');
}

const shopTabData = {
    room: [
        { name: "Living Room", img: "cat-living.png", slug: "Living Room" },
        { name: "Bedroom", img: "cat-bedroom.png", slug: "Bedroom" },
        { name: "Dining Room", img: "cat-dining.png", slug: "Dining Room" },
        { name: "Hallway", img: "cat-hallway.png", slug: "Hallway" },
        { name: "Office", img: "cat-office.png", slug: "Office" }
    ],
    style: [
        { name: "Modern", img: "style-modern.png", slug: "modern" },
        { name: "Vintage", img: "vintage-kilims-3112c8.jpg", slug: "vintage" },
        { name: "Bohemian", img: "hero-4-8cbbc2.png", slug: "bohemian" },
        { name: "Traditional", img: "cat-living.png", slug: "traditional" }, { name: "Minimalist", img: "style_minimalist.png", slug: "minimalist" }
    ],
    material: [
        { name: "Wool", img: "woolen-rugs-28654e.jpg", slug: "wool" },
        { name: "Bamboo Silk", img: "silk-carpets-e7427e.jpg", slug: "silk" },
        { name: "Jute", img: "hero-1-bc2ca9.png", slug: "jute" },
        { name: "Cotton", img: "cat-bedroom.png", slug: "cotton" }, { name: "Sisal", img: "material_sisal.png", slug: "sisal" }
    ]
};

function switchShopTab(tab) {
    document.querySelectorAll('#shop-tabs .tab-btn').forEach(btn => {
        const indicator = btn.querySelector('.tab-indicator');
        if (btn.dataset.tab === tab) {
            btn.classList.add('tab-active', 'font-bold');
            btn.classList.remove('text-heritage-dark/40', 'font-medium');
            indicator.classList.remove('hidden');
        } else {
            btn.classList.remove('tab-active', 'font-bold');
            btn.classList.add('text-heritage-dark/40', 'font-medium');
            indicator.classList.add('hidden');
        }
    });

    const container = document.getElementById('tab-content');
    if (!container) return;

    const items = shopTabData[tab];
    container.innerHTML = items.map(item => `
        <div class="group relative aspect-[4/5] overflow-hidden rounded-sm cursor-pointer" 
             onclick="navigateTo(event, '/${tab}/${item.slug}')">
            <img src="/static/images/${item.img}" class="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110 grayscale-[10%] group-hover:grayscale-0" loading="lazy">
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
            <div class="absolute bottom-8 left-0 right-0 text-center">
                <span class="font-serif text-xl text-white tracking-wide">${item.name}</span>
            </div>
        </div>
    `).join('');
}

// â”€â”€ Results View Logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function updateResultsHeader(title, subtitle) {
    const t = document.getElementById('results-title');
    const s = document.getElementById('results-subtitle');
    if (t) t.innerHTML = `${title} <i>Collection</i>`;
    if (s) s.innerText = subtitle;
}

let currentPage = 1;
let hasNextPage = true;
let isLoadingPage = false;
let currentProducts = [];
let infiniteObserver = null;

async function fetchResults(append = false) {
    const grid = document.getElementById('results-grid');
    if (!grid) return;
    
    if (!append) {
        currentPage = 1;
        currentProducts = [];
        hasNextPage = true;
        const skeletonHTML = Array(6).fill().map(() => `
            <div class="product-card animate-pulse">
                <div class="bg-heritage-beige/50 w-full aspect-[4/5] rounded-sm mb-6"></div>
                <div class="h-4 bg-heritage-beige/70 w-3/4 mb-3 rounded-sm mx-auto"></div>
                <div class="h-3 bg-heritage-beige/50 w-1/2 rounded-sm mx-auto"></div>
            </div>
        `).join('');
        grid.innerHTML = skeletonHTML;
    }
    
    if (isLoadingPage || !hasNextPage) return;
    isLoadingPage = true;

    let url = `${API_BASE_URL}/products/?ordering=${activeFilters.sort}&page_size=12&page=${currentPage}`;
    if (activeFilters.search) url += `&search=${encodeURIComponent(activeFilters.search)}`;
    if (activeFilters.price_min > 0) url += `&price__gte=${activeFilters.price_min}`;
    if (activeFilters.price_max < 100000) url += `&price__lte=${activeFilters.price_max}`;
    if (activeFilters.room) url += `&space__icontains=${encodeURIComponent(activeFilters.room)}`;
    if (activeFilters.style) url += `&tags__name=${encodeURIComponent(activeFilters.style)}`;
    if (activeFilters.category_slug) url += `&category__slug=${activeFilters.category_slug}`;
    if (activeFilters.space.length) activeFilters.space.forEach(s => url += `&space__icontains=${encodeURIComponent(s)}`);
    if (activeFilters.shape.length) activeFilters.shape.forEach(s => url += `&shape__icontains=${encodeURIComponent(s)}`);
    if (activeFilters.size.length) activeFilters.size.forEach(s => url += `&size__icontains=${encodeURIComponent(s)}`);
    if (activeFilters.material.length) activeFilters.material.forEach(s => url += `&material=${encodeURIComponent(s)}`);

    try {
        const response = await fetch(url);
        const data = await response.json();
        const products = normalizeProducts(data);
        
        if (data.next) {
            hasNextPage = true;
            currentPage++;
        } else {
            hasNextPage = false;
        }

        currentProducts = append ? [...currentProducts, ...products] : products;
        
        if (!append) grid.innerHTML = '';
        renderProducts(products, grid, append);
        
        const countEl = document.getElementById('results-count');
        if (countEl) countEl.innerText = `Showing ${currentProducts.length} product${currentProducts.length !== 1 ? 's' : ''}`;
        
        if (!append) populateSidebarFilters(currentProducts);
        
        setupInfiniteObserver(grid);
    } catch (e) {
        console.error('fetchResults error:', e);
        if (!append) grid.innerHTML = '<div class="col-span-3 text-center py-20 text-heritage-dark/60">An error occurred loading the collection.</div>';
    } finally {
        isLoadingPage = false;
    }
}

function setupInfiniteObserver(grid) {
    if (infiniteObserver) infiniteObserver.disconnect();
    
    let marker = document.getElementById('infinite-scroll-marker');
    if (!marker) {
        marker = document.createElement('div');
        marker.id = 'infinite-scroll-marker';
        marker.className = 'w-full h-10 mt-10';
        grid.parentNode.appendChild(marker);
    }
    
    if (!hasNextPage) {
        marker.style.display = 'none';
        return;
    }
    
    marker.style.display = 'block';
    
    infiniteObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoadingPage && hasNextPage) {
            fetchResults(true);
        }
    }, { rootMargin: '200px' });
    
    infiniteObserver.observe(marker);
}

function applyFilters() {
    const sortEl = document.getElementById('sort-by');
    if (sortEl) activeFilters.sort = sortEl.value;

    // Collect multi-select filters
    const getChecked = (selector) => Array.from(document.querySelectorAll(selector)).filter(i => i.checked).map(i => i.value);
    activeFilters.space = getChecked('#filter-space input');
    activeFilters.shape = getChecked('#filter-shape input');
    activeFilters.size = getChecked('#filter-size input');
    activeFilters.material = getChecked('#filter-materials input');

    // Update URL without full reload
    const params = new URLSearchParams();
    if (activeFilters.search) params.set('q', activeFilters.search);
    if (activeFilters.category_slug) params.set('category', activeFilters.category_slug);
    if (activeFilters.style) params.set('style', activeFilters.style);
    if (activeFilters.room) params.set('room', activeFilters.room);
    if (activeFilters.price_min > 0) params.set('min_price', activeFilters.price_min);
    if (activeFilters.price_max < 100000) params.set('max_price', activeFilters.price_max);
    if (activeFilters.space.length) params.set('space', activeFilters.space.join(','));
    if (activeFilters.shape.length) params.set('shape', activeFilters.shape.join(','));
    if (activeFilters.size.length) params.set('size', activeFilters.size.join(','));
    if (activeFilters.material.length) params.set('material', activeFilters.material.join(','));
    if (activeFilters.sort !== '-created_at') params.set('sort', activeFilters.sort);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);

    renderFilterChips();
    fetchResults();
}

function renderFilterChips() {
    const container = document.getElementById('active-filter-chips');
    if (!container) return;
    container.innerHTML = '';

    const chips = [];
    if (activeFilters.search) chips.push({ label: `Search: ${activeFilters.search}`, key: 'search' });
    if (activeFilters.category_slug) chips.push({ label: `Category: ${activeFilters.category_slug}`, key: 'category_slug' });
    if (activeFilters.style) chips.push({ label: `Style: ${activeFilters.style}`, key: 'style' });
    if (activeFilters.room) chips.push({ label: `Room: ${activeFilters.room}`, key: 'room' });
    if (activeFilters.price_min > 0 || activeFilters.price_max < 100000) {
        let label = 'Price: ';
        if (activeFilters.price_min > 0 && activeFilters.price_max < 100000) label += `â‚¹${(activeFilters.price_min/1000).toFixed(0)}k-â‚¹${(activeFilters.price_max/1000).toFixed(0)}k`;
        else if (activeFilters.price_min > 0) label += `Over â‚¹${(activeFilters.price_min/1000).toFixed(0)}k`;
        else label += `Under â‚¹${(activeFilters.price_max/1000).toFixed(0)}k`;
        chips.push({ label, key: 'price' });
    }
    if (activeFilters.space.length) activeFilters.space.forEach(v => chips.push({ label: `Space: ${v}`, key: 'space', value: v }));
    if (activeFilters.shape.length) activeFilters.shape.forEach(v => chips.push({ label: `Shape: ${v}`, key: 'shape', value: v }));
    if (activeFilters.size.length) activeFilters.size.forEach(v => chips.push({ label: `Size: ${v}`, key: 'size', value: v }));
    if (activeFilters.material.length) activeFilters.material.forEach(v => chips.push({ label: `Material: ${v}`, key: 'material', value: v }));

    if (chips.length === 0) return;

    container.innerHTML = chips.map(c => `
        <div class="flex items-center gap-2 bg-heritage-dark text-white text-[9px] uppercase tracking-widest px-3 py-1.5 rounded-full font-bold">
            ${c.label}
            <button onclick="clearSingleFilter('${c.key}', '${c.value || ''}')" class="hover:text-heritage-gold transition-colors ml-1">âœ•</button>
        </div>
    `).join('') + `<button onclick="clearAllFilters()" class="text-[9px] uppercase tracking-widest font-bold text-heritage-rust hover:underline ml-2">Clear All</button>`;
}

function filterContainerId(key) {
    return key === 'material' ? 'filter-materials' : `filter-${key}`;
}

function clearSingleFilter(key, value) {
    if (['space', 'shape', 'size', 'material'].includes(key)) {
        activeFilters[key] = activeFilters[key].filter(v => v !== value);
        // Uncheck in UI
        document.querySelectorAll(`#${filterContainerId(key)} input`).forEach(i => {
            if (i.value === value) i.checked = false;
        });
    } else {
        clearFilter(key);
        return;
    }
    applyFilters();
}


function clearFilter(key) {
    if (key === 'price') {
        activeFilters.price_min = 0;
        activeFilters.price_max = 100000;
        const minEl = document.getElementById('price-min');
        const maxEl = document.getElementById('price-max');
        if (minEl) minEl.value = 0;
        if (maxEl) maxEl.value = 100000;
        handlePriceSlider();
    } else if (['space', 'shape', 'size', 'material'].includes(key)) {
        activeFilters[key] = [];
        document.querySelectorAll(`#${filterContainerId(key)} input`).forEach(i => i.checked = false);
    } else {
        activeFilters[key] = null;
    }
    applyFilters();
}

function handlePriceSlider(trigger) {
    const minInput = document.getElementById('price-min');
    const maxInput = document.getElementById('price-max');
    const track = document.getElementById('slider-track');
    const minVal = document.getElementById('thumb-min-value');
    const maxVal = document.getElementById('thumb-max-value');
    
    if (!minInput || !maxInput) return;

    let min = parseInt(minInput.value);
    let max = parseInt(maxInput.value);

    if (max - min < 5000) {
        const target = trigger || (typeof event !== 'undefined' ? event.target : null);
        if (target?.classList?.contains('min-range')) {
            minInput.value = max - 5000;
            min = max - 5000;
        } else {
            maxInput.value = min + 5000;
            max = min + 5000;
        }
    }

    const minPct = (min / minInput.max) * 100;
    const maxPct = (max / maxInput.max) * 100;

    track.style.left = minPct + "%";
    track.style.width = (maxPct - minPct) + "%";

    minVal.style.left = minPct + "%";
    maxVal.style.left = maxPct + "%";

    minVal.innerText = `â‚¹${(min/1000).toFixed(0)}k`;
    maxVal.innerText = max >= 100000 ? `â‚¹1L+` : `â‚¹${(max/1000).toFixed(0)}k`;

    activeFilters.price_min = min;
    activeFilters.price_max = max;

    debouncedApplyFilters();
}

const debouncedApplyFilters = debounce(() => applyFilters(), 300);


function clearAllFilters() {
    activeFilters = {
        category_slug: null,
        style: null,
        room: null,
        space: [],
        shape: [],
        size: [],
        material: [],
        price_min: 0,
        price_max: 100000,
        search: null,
        sort: '-created_at'
    };
    document.querySelectorAll('.filter-options input').forEach(i => i.checked = false);
    const minEl = document.getElementById('price-min');
    const maxEl = document.getElementById('price-max');
    if (minEl) minEl.value = 0;
    if (maxEl) maxEl.value = 100000;
    handlePriceSlider();
    applyFilters();
}


function populateSidebarFilters(products) {
    const matContainer = document.getElementById('filter-materials');
    const catContainer = document.getElementById('filter-categories');
    const spaceContainer = document.getElementById('filter-space');
    const shapeContainer = document.getElementById('filter-shape');
    const sizeContainer = document.getElementById('filter-size');

    if (!matContainer || (matContainer.children.length > 0 && products.length === 0)) return;

    const populate = (container, field, activeList) => {
        if (!container) return;
        const values = [...new Set(products.map(p => p[field]).filter(Boolean))].sort();
        if (values.length === 0 && container.children.length > 0) return;
        
        container.innerHTML = values.map(v => {
            const isChecked = activeList && activeList.includes(v);
            return `
                <label class="filter-option">
                    <input type="checkbox" value="${v}" ${isChecked ? 'checked' : ''} onchange="applyFilters()">
                    <div class="custom-checkbox"></div>
                    ${v}
                </label>
            `;
        }).join('');
    };

    populate(matContainer, 'material', activeFilters.material);
    populate(spaceContainer, 'space', activeFilters.space);
    populate(shapeContainer, 'shape', activeFilters.shape);
    populate(sizeContainer, 'size', activeFilters.size);

    if (catContainer && catContainer.children.length === 0) {
        fetch(`${API_BASE_URL}/categories/`).then(res => res.json()).then(data => {
            const cats = (data.results ?? data);
            return cats.length ? cats : FALLBACK_CATEGORIES;
        }).catch(() => FALLBACK_CATEGORIES).then(cats => {
            catContainer.innerHTML = cats.map(c => `
                <label class="filter-option">
                    <input type="radio" name="cat" value="${c.slug}" ${activeFilters.category_slug === c.slug ? 'checked' : ''} onchange="activeFilters.category_slug='${c.slug}';applyFilters()">
                    <div class="custom-checkbox rounded-full"></div>
                    ${c.name}
                </label>
            `).join('');
        });
    }
}


// â”€â”€ Product Detail Logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchProductDetail(slug) {
    const container = document.getElementById('product-content');
    container.innerHTML = `
        <div class="flex flex-col md:flex-row gap-16 animate-pulse mt-8">
            <div class="md:w-1/2 bg-heritage-beige/50 aspect-[4/5] rounded-sm"></div>
            <div class="md:w-1/2 space-y-6 pt-10">
                <div class="h-10 bg-heritage-beige/70 w-3/4 rounded-sm"></div>
                <div class="h-6 bg-heritage-beige/50 w-1/4 rounded-sm"></div>
                <div class="h-24 bg-heritage-beige/40 w-full rounded-sm mt-8"></div>
                <div class="h-12 bg-heritage-beige/70 w-1/2 rounded-sm mt-12"></div>
            </div>
        </div>
    `;
    
    try {
        const { products } = await fetchCatalogProducts(`${API_BASE_URL}/products/?slug=${slug}`, { allowEmpty: true });
        const product = products[0] || FALLBACK_PRODUCTS.find(p => p.slug === slug);
        
        if (!product) {
            container.innerHTML = '<div class="text-center py-40">Piece not found.</div>';
            return;
        }

        // SEO & Breadcrumbs
        updateSEO(product.title, product.description.substring(0, 160));
        injectProductJSONLD(product);
        renderBreadcrumbs('product-breadcrumbs', [
            { label: 'Collection', path: '/all' },
            { label: product.category_name, path: `/category/${product.category_slug || slugifyText(product.category_name)}` },
            { label: product.title }
        ]);

        const discountPct = product.discount_price ? Math.round((1 - (product.discount_price / product.price)) * 100) : 0;
        
        // Prepare Gallery
        const gallery = [product.main_image, ...(product.gallery?.map(img => img.image_url) || [])];

        container.innerHTML = `
            <div class="flex flex-col lg:flex-row gap-16 relative">
                <!-- Gallery Column -->
                <div class="flex-1">
                    <div class="sticky top-32 space-y-4">
                        <div class="aspect-[4/5] overflow-hidden bg-heritage-beige rounded-sm group cursor-zoom-in">
                            <img id="main-product-image" src="${product.main_image}" alt="${product.title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy">
                        </div>
                        <div class="grid grid-cols-4 gap-4">
                            ${gallery.map((img, i) => `
                                <div class="aspect-square cursor-pointer overflow-hidden bg-heritage-beige rounded-sm border-2 ${i === 0 ? 'border-heritage-gold' : 'border-transparent'} hover:border-heritage-gold transition-all gallery-thumb" onclick="changePDPImage(this, '${img}')">
                                    <img src="${img}" class="w-full h-full object-cover" loading="lazy">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Info Column -->
                <div class="flex-1 space-y-10">
                    <div>
                        <span class="sans-subtitle text-heritage-rust">${product.category_name}</span>
                        <h1 class="serif-title text-6xl mb-6 leading-tight">${product.title}</h1>
                        <div class="flex items-center gap-6">
                            <span class="text-3xl font-bold text-heritage-gold" id="pdp-price">${formatPrice(product.discount_price || product.price)}</span>
                            ${product.discount_price ? `<span class="line-through text-heritage-dark/30 text-xl">${formatPrice(product.price)}</span>` : ''}
                            ${discountPct > 0 ? `<span class="bg-heritage-rust text-white text-[10px] px-3 py-1 font-bold">LIMITED TIME: ${discountPct}% OFF</span>` : ''}
                        </div>
                    </div>

                    <div class="space-y-4">
                        <h4 class="text-[10px] uppercase tracking-widest font-bold opacity-40">Select Size</h4>
                        <div class="variant-selector" id="pdp-variants">
                            ${product.variants?.length ? product.variants.map((v, i) => `
                                <button class="variant-btn ${i === 0 ? 'active' : ''}" onclick="selectVariant(this, ${v.price}, ${v.discount_price || 'null'}, '${v.size}')">
                                    ${v.size}
                                </button>
                            `).join('') : `<button class="variant-btn active">${product.size || 'Custom'}</button>`}
                        </div>
                    </div>

                    <p class="text-heritage-dark/60 text-lg leading-relaxed border-t border-heritage-border/30 pt-8">${product.description}</p>
                    
                    <div class="grid grid-cols-2 gap-x-12 gap-y-8 py-10 border-y border-heritage-border/30">
                        <div><h4 class="text-[10px] uppercase tracking-widest text-heritage-dark/40 mb-1">Material</h4><p class="font-medium text-sm">${product.material}</p></div>
                        <div><h4 class="text-[10px] uppercase tracking-widest text-heritage-dark/40 mb-1">Space</h4><p class="font-medium text-sm">${product.space || 'Universal'}</p></div>
                        <div><h4 class="text-[10px] uppercase tracking-widest text-heritage-dark/40 mb-1">Shape</h4><p class="font-medium text-sm">${product.shape || 'Rectangle'}</p></div>
                        <div><h4 class="text-[10px] uppercase tracking-widest text-heritage-dark/40 mb-1">Origin</h4><p class="font-medium text-sm">${product.origin}</p></div>
                        <div><h4 class="text-[10px] uppercase tracking-widest text-heritage-dark/40 mb-1">Dimensions</h4><p class="font-medium text-sm">${product.size}</p></div>
                        <div><h4 class="text-[10px] uppercase tracking-widest text-heritage-dark/40 mb-1">SKU</h4><p class="font-medium text-sm opacity-50">${product.sku}</p></div>
                    </div>

                    <div class="flex gap-4 pt-4">
                        <button onclick='addToCart(${JSON.stringify(product)})' class="flex-1 py-5 bg-heritage-dark text-white text-[11px] uppercase tracking-[4px] font-bold transition-all hover:bg-heritage-gold shadow-2xl active:scale-[0.98]">Add to Cart</button>
                        <button onclick='addToWishlist(${JSON.stringify(product)})' class="px-10 py-5 border border-heritage-dark text-heritage-dark text-[11px] uppercase tracking-[4px] font-bold hover:bg-heritage-dark hover:text-white transition-all">Add to Wishlist</button>
                    </div>

                    <!-- Trust Signals -->
                    <div class="flex items-center gap-8 py-6 opacity-40">
                        <div class="flex items-center gap-2 text-[9px] uppercase tracking-widest font-bold">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Authentic
                        </div>
                        <div class="flex items-center gap-2 text-[9px] uppercase tracking-widest font-bold">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg> Free Shipping
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Reviews Section -->
            <section class="mt-32 border-t border-heritage-border/30 pt-20">
                <div class="flex flex-col lg:flex-row gap-20">
                    <div class="lg:w-1/3">
                        <h2 class="serif-title text-4xl mb-6">Client <i>Voices</i></h2>
                        <div class="flex items-center gap-4 mb-4">
                            <div class="star-rating">
                                ${Array(5).fill('<svg viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>').join('')}
                            </div>
                            <span class="text-sm font-bold">4.9 / 5.0</span>
                        </div>
                        <p class="text-heritage-dark/50 text-sm italic">Based on ${product.reviews?.length || 12} certified purchase reviews.</p>
                    </div>
                    <div class="lg:w-2/3 space-y-12">
                        ${product.reviews?.length ? product.reviews.map(r => `
                            <div class="space-y-3">
                                <div class="flex justify-between items-center">
                                    <h4 class="font-bold text-sm uppercase tracking-widest">${r.customer_name}</h4>
                                    <span class="text-[10px] opacity-40">${new Date(r.created_at).toLocaleDateString()}</span>
                                </div>
                                <div class="star-rating scale-75 origin-left">
                                    ${Array(r.rating).fill('<svg viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>').join('')}
                                </div>
                                <p class="text-heritage-dark/70 text-base italic leading-relaxed">"${r.comment}"</p>
                            </div>
                        `).join('') : `
                            <div class="p-8 bg-heritage-beige/30 rounded-sm italic text-heritage-dark/40">
                                No reviews yet. Be the first to share your experience with this piece.
                            </div>
                        `}
                    </div>
                </div>
            </section>

            <section class="mt-40">
                <div class="section-header text-left">
                    <span class="sans-subtitle">Recommendation</span>
                    <h2 class="serif-title text-4xl">Similar <i>Masterpieces</i></h2>
                </div>
                <div id="related-products" class="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12"></div>
            </section>
        `;
        
        // Fetch Related
        fetchCatalogProducts(`${API_BASE_URL}/products/?category=${product.category}&page_size=5`).then(({ products }) => {
            const related = products.filter(p => p.id !== product.id).slice(0,4);
            renderProducts(related.length ? related : FALLBACK_PRODUCTS.filter(p => p.id !== product.id && p.category_slug === product.category_slug).slice(0,4), document.getElementById('related-products'));
        });

    } catch (e) { console.error(e); }
}

function changePDPImage(thumb, url) {
    document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('border-heritage-gold'));
    thumb.classList.add('border-heritage-gold');
    document.getElementById('main-product-image').src = url;
}

function selectVariant(btn, price, discountPrice, size) {
    document.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('pdp-price').innerText = formatPrice(discountPrice || price);
}

// â”€â”€ Rendering Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const PRODUCT_FALLBACK_IMG = '/static/images/hero-1-bc2ca9.png';

function renderProducts(products, container, append = false) {
    if (!products || !products.length) {
        if (!append) container.innerHTML = '<p class="col-span-full text-center text-heritage-dark/40 py-20">No matching pieces found in our collection.</p>';
        return;
    }

    const html = products.map((p, i) => {
        const discountPct = p.discount_price ? Math.round((1 - (p.discount_price / p.price)) * 100) : 0;
        const imgSrc = p.main_image || PRODUCT_FALLBACK_IMG;
        return `
            <div class="group relative product-card animate-fade-up" style="animation-delay:${i*0.05}s"
                 onclick="navigateTo(event, '/product/${p.slug}')">
                <div class="relative aspect-[4/5] overflow-hidden bg-heritage-beige mb-6 rounded-sm">
                    <img src="${imgSrc}" alt="${p.title}" loading="lazy"
                         onerror="this.onerror=null;this.src='${PRODUCT_FALLBACK_IMG}';"
                         class="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110">
                    <div class="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span class="bg-white/90 text-heritage-dark text-[9px] uppercase tracking-[2px] px-6 py-3 font-bold shadow-xl translate-y-4 group-hover:translate-y-0 transition-transform">Quick View</span>
                    </div>
                    ${discountPct > 0 ? `<div class="discount-badge">${discountPct}% OFF</div>` : ''}
                </div>
                <div class="space-y-1">
                    <span class="product-label">${p.category_name || 'Exquisite'}</span>
                    <h3 class="nav-link-underline font-serif text-lg leading-tight">${p.title}</h3>
                    <div class="price mt-2">
                        <span class="text-heritage-gold font-bold">${formatPrice(p.discount_price || p.price)}</span>
                        ${p.discount_price ? `<span class="line-through text-heritage-dark/30 text-xs ml-2">${formatPrice(p.price)}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (append) {
        container.insertAdjacentHTML('beforeend', html);
    } else {
        container.innerHTML = html;
    }
}

// â”€â”€ Search & Infrastructure â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const debouncedSearch = debounce((q) => {
    if (q.length > 2) {
        // Reserved for instant results overlay.
    }
}, 300);

function handleSearch(e) {
    if (e) e.preventDefault();
    const q = document.getElementById('global-search').value.trim();
    if (q) {
        document.getElementById('search-overlay').style.display = 'none';
        document.body.style.overflow = '';
        navigateTo(null, `/all?q=${encodeURIComponent(q)}`);
    }
}

async function fetchCategories() {
    const container = document.getElementById('categories-container');
    if (!container) return;
    try {
        const res = await fetch(`${API_BASE_URL}/categories/`);
        const data = await res.json();
        const apiItems = data.results ?? data;
        const items = apiItems.length ? apiItems : FALLBACK_CATEGORIES;
        container.innerHTML = items.slice(0,4).map((cat, i) => `
            <div class="group product-card fade-up cursor-pointer" onclick="navigateTo(event, '/category/${cat.slug}')">
                <div class="img-wrapper overflow-hidden rounded-sm">
                    <img src="${cat.image_url}" class="transition-transform duration-1000 group-hover:scale-110" loading="lazy">
                </div>
                <div class="text-center mt-6">
                    <span class="product-label">Collection</span>
                    <h3 class="nav-link-underline inline-block">${cat.name}</h3>
                </div>
            </div>
        `).join('');
    } catch(e) {
        container.innerHTML = FALLBACK_CATEGORIES.slice(0,4).map(cat => `
            <div class="group product-card fade-up cursor-pointer" onclick="navigateTo(event, '/category/${cat.slug}')">
                <div class="img-wrapper overflow-hidden rounded-sm">
                    <img src="${cat.image_url}" class="transition-transform duration-1000 group-hover:scale-110" loading="lazy">
                </div>
                <div class="text-center mt-6">
                    <span class="product-label">Collection</span>
                    <h3 class="nav-link-underline inline-block">${cat.name}</h3>
                </div>
            </div>
        `).join('');
    }
}

async function fetchFeaturedProducts() {
    const container = document.getElementById('featured-products-container');
    if (!container) return;
    // Show skeleton loader
    container.innerHTML = Array(4).fill(0).map(() => `
        <div class="animate-pulse">
            <div class="aspect-[4/5] bg-heritage-beige/80 rounded-sm mb-6"></div>
            <div class="h-3 bg-heritage-beige/80 rounded mb-3 w-1/3"></div>
            <div class="h-5 bg-heritage-beige/80 rounded mb-2"></div>
            <div class="h-4 bg-heritage-beige/60 rounded w-1/2"></div>
        </div>
    `).join('');
    try {
        // Fetch featured products first; if fewer than 4, fall back to newest
        let { products: featured } = await fetchCatalogProducts(`${API_BASE_URL}/products/?is_featured=true&ordering=-created_at&page_size=8`);
        if (featured.length < 4) {
            const { products: newest } = await fetchCatalogProducts(`${API_BASE_URL}/products/?ordering=-created_at&page_size=8`);
            featured = newest;
        }
        renderProducts(featured.slice(0, 8), container);
    } catch(e) {
        console.error('Featured products error:', e);
        renderProducts(FALLBACK_PRODUCTS.filter(p => p.is_featured).slice(0, 8), container);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Wire search overlay
    const searchOverlay = document.getElementById('search-overlay');
    const searchIcon = document.getElementById('search-icon');
    const closeSearch = document.getElementById('close-search');

    if (searchIcon) {
        searchIcon.onclick = () => {
            searchOverlay.style.display = 'block';
            document.getElementById('global-search').focus();
        };
    }
    if (closeSearch) {
        closeSearch.onclick = () => { searchOverlay.style.display = 'none'; };
    }

    const searchInput = document.getElementById('global-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
    }

    // Initialize Draggable Help FAB
    initFAB();

    // Boot
    handleRoute();
    updateCart();
    updateWishlist();
    updateAuthUI();
    initGoogleSignIn();
    syncCollection({ merge: true, immediate: true });

    // Festive Popup Logic (5s Delay)
    setTimeout(() => {
        const popup = document.getElementById('festive-popup');
        const content = document.getElementById('festive-popup-content');
        if (popup && !localStorage.getItem('festive_popup_dismissed')) {
            popup.classList.remove('pointer-events-none', 'opacity-0');
            popup.classList.add('opacity-100');
            if (content) {
                content.classList.remove('scale-95');
                content.classList.add('scale-100');
            }
            startFestiveTimer();
        }
    }, 5000);
});

// â”€â”€ Profile Icon Smart Routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function handleProfileClick(e) {
    if (e) e.preventDefault();
    const user = JSON.parse(localStorage.getItem('Kalakroti_user') || 'null');
    if (user && getAuthToken()) {
        window.location.href = '/dashboard.html';
    } else {
        navigateTo(e, '/account');
    }
}

// â”€â”€ Google Sign In Logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function initGoogleSignIn() {
    const config = await loadPublicConfig();
    const clientId = config.google_client_id;
    const messageEls = document.querySelectorAll('.google-config-message');
    const buttonEls = document.querySelectorAll('.google-button-slot');

    if (!clientId) {
        messageEls.forEach(el => {
            el.textContent = 'Google sign-in needs GOOGLE_CLIENT_ID in the backend environment.';
            el.style.display = 'block';
        });
        return;
    }

    // Check if we just returned from Google OAuth Redirect
    const hash = window.location.hash;
    if (hash.includes('id_token=')) {
        const params = new URLSearchParams(hash.substring(1));
        const idToken = params.get('id_token');
        if (idToken) {
            window.location.hash = ''; // clear hash
            processGoogleCredential(idToken);
            return;
        }
    }

    const render = () => {
        buttonEls.forEach(el => {
            el.innerHTML = '';
            const btn = document.createElement('button');
            btn.className = 'w-full py-3 px-4 border border-heritage-border rounded-sm flex items-center justify-center gap-3 hover:bg-heritage-beige transition-colors';
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.7 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> <span class="text-sm font-semibold text-heritage-dark tracking-wide uppercase">Continue with Google</span>`;
            btn.onclick = () => {
                const redirectUri = window.location.origin + '/account';
                const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=id_token&scope=openid%20email%20profile&nonce=${Math.random().toString(36).substring(2)}&prompt=select_account`;
                window.location.href = authUrl;
            };
            el.appendChild(btn);
        });
        messageEls.forEach(el => { el.style.display = 'none'; });
    };

    render();
}

async function processGoogleCredential(credential) {
    if (typeof KalakrotiLoader !== 'undefined') {
        KalakrotiLoader.showFullscreen("Authenticating with Google...");
    }
    try {
        const res = await fetch(`${API_BASE_URL}/auth/social/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Google Sign-In failed');

        saveCurrentUser({ ...data.user, isGoogle: true }, data.token);
        await syncCollection({ merge: true, immediate: true });
        
        if (typeof KalakrotiLoader !== 'undefined') {
            KalakrotiLoader.showFullscreen(["Welcome back!", "Preparing your dashboard..."]);
        }
        
        // Flag for seamless transition to dashboard
        sessionStorage.setItem('kalakroti_login_transition', 'true');
        
        updateAuthUI();
        window.location.href = '/dashboard.html';
    } catch (err) {
        if (typeof KalakrotiLoader !== 'undefined') {
            KalakrotiLoader.hideFullscreen();
        }
        showToast(err.message);
    }
}

function updateAuthUI() {
    // Update profile icon appearance when logged in
    const profileIcon = document.getElementById('profile-icon');
    if (profileIcon && currentUser && getAuthToken()) {
        profileIcon.style.stroke = '#C5A059'; // gold tint when logged in
        profileIcon.title = currentUser.name;
        // Override click to go to dashboard
        profileIcon.onclick = () => { window.location.href = '/dashboard.html'; };
    } else if (profileIcon) {
        profileIcon.style.stroke = '';
        profileIcon.title = 'Account';
        profileIcon.onclick = handleProfileClick;
    }
    // If account view is visible, re-render it
    const accountView = document.getElementById('view-account');
    if (accountView && accountView.style.display !== 'none') {
        renderAccountView();
    }
}
// â”€â”€ Festive Popup Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function closeFestivePopup() {
    const popup = document.getElementById('festive-popup');
    const content = document.getElementById('festive-popup-content');
    if (popup) {
        popup.classList.add('opacity-0', 'pointer-events-none');
        popup.classList.remove('opacity-100');
        if (content) {
            content.classList.add('scale-95');
            content.classList.remove('scale-100');
        }
        localStorage.setItem('festive_popup_dismissed', 'true');
    }
}

function handleFestiveSubscribe(e) {
    e.preventDefault();
    const email = e.target.email.value;
    showToast(`Voucher Sent! Check ${email} for your 15% discount code.`);
    closeFestivePopup();
}

function startFestiveTimer() {
    let targetTime = localStorage.getItem('festive_target_time');
    if (!targetTime) {
        // Set target to 24 hours from now
        targetTime = new Date().getTime() + (24 * 60 * 60 * 1000);
        localStorage.setItem('festive_target_time', targetTime);
    } else {
        targetTime = parseInt(targetTime);
    }

    const update = () => {
        const now = new Date().getTime();
        const diff = targetTime - now;

        if (diff <= 0) {
            document.getElementById('timer-hours').innerText = '00';
            document.getElementById('timer-mins').innerText = '00';
            document.getElementById('timer-secs').innerText = '00';
            return;
        }

        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById('timer-hours').innerText = h.toString().padStart(2, '0');
        document.getElementById('timer-mins').innerText = m.toString().padStart(2, '0');
        document.getElementById('timer-secs').innerText = s.toString().padStart(2, '0');
    };

    update();
    setInterval(update, 1000);
}

window.handlePriceSlider = handlePriceSlider;
window.clearSingleFilter = clearSingleFilter;
window.clearAllFilters = clearAllFilters;
window.clearFilter = clearFilter;
window.applyFilters = applyFilters;
window.handleSearch = handleSearch;
window.handleNavTab = handleNavTab;
window.switchShopTab = switchShopTab;
window.handleProfileClick = handleProfileClick;
window.updateAuthUI = updateAuthUI;
window.closeFestivePopup = closeFestivePopup;
window.handleFestiveSubscribe = handleFestiveSubscribe;
window.changePDPImage = changePDPImage;
window.selectVariant = selectVariant;

