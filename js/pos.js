/**
 * Pet Store POS - Point of Sale Module
 * Xử lý quét mã vạch, giỏ hàng, thanh toán
 */

// State
let cart = [];
let scanner = null;
let isScanning = false;
let products = [];

// DOM Elements
const elements = {
    menuToggle: document.getElementById('menuToggle'),
    sidebar: document.getElementById('sidebar'),
    scannerBox: document.getElementById('scannerBox'),
    scannerPlaceholder: document.getElementById('scannerPlaceholder'),
    toggleScannerBtn: document.getElementById('toggleScannerBtn'),
    barcodeInput: document.getElementById('barcodeInput'),
    searchBtn: document.getElementById('searchBtn'),
    productGrid: document.getElementById('productGrid'),
    categoryFilter: document.getElementById('categoryFilter'),
    cartItems: document.getElementById('cartItems'),
    cartEmpty: document.getElementById('cartEmpty'),
    cartCount: document.getElementById('cartCount'),
    cartTotal: document.getElementById('cartTotal'),
    clearCartBtn: document.getElementById('clearCartBtn'),
    checkoutBtn: document.getElementById('checkoutBtn'),
    receiptModal: document.getElementById('receiptModal'),
    receiptContent: document.getElementById('receiptContent'),
    closeReceiptBtn: document.getElementById('closeReceiptBtn'),
    printReceiptBtn: document.getElementById('printReceiptBtn'),
    newOrderBtn: document.getElementById('newOrderBtn'),
    backupBtn: document.getElementById('backupBtn'),
    todayStats: document.getElementById('todayStats'),
    todayRevenue: document.getElementById('todayRevenue'),
    toastContainer: document.getElementById('toastContainer')
};

// ==================== INITIALIZATION ====================

async function init() {
    try {
        await db.init();
        await loadProducts();
        await loadCategories();
        await updateTodayStats();
        setupEventListeners();
        loadCartFromStorage();
        console.log('POS initialized successfully');
    } catch (error) {
        console.error('Init error:', error);
        showToast('Lỗi khởi tạo: ' + error.message, 'error');
    }
}

function setupEventListeners() {
    // Mobile menu
    elements.menuToggle?.addEventListener('click', () => {
        elements.sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            !elements.sidebar.contains(e.target) &&
            !elements.menuToggle.contains(e.target)) {
            elements.sidebar.classList.remove('open');
        }
    });

    // Scanner toggle
    elements.toggleScannerBtn?.addEventListener('click', toggleScanner);

    // Barcode input
    elements.barcodeInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleBarcodeSearch(elements.barcodeInput.value.trim());
        }
    });

    elements.searchBtn?.addEventListener('click', () => {
        handleBarcodeSearch(elements.barcodeInput.value.trim());
    });

    // Category filter
    elements.categoryFilter?.addEventListener('change', filterProducts);

    // Cart actions
    elements.clearCartBtn?.addEventListener('click', clearCart);
    elements.checkoutBtn?.addEventListener('click', checkout);

    // Receipt modal
    elements.closeReceiptBtn?.addEventListener('click', closeReceiptModal);
    elements.receiptModal?.addEventListener('click', (e) => {
        if (e.target === elements.receiptModal) closeReceiptModal();
    });
    elements.printReceiptBtn?.addEventListener('click', printReceipt);
    elements.newOrderBtn?.addEventListener('click', startNewOrder);

    // Backup
    elements.backupBtn?.addEventListener('click', backupData);
}

// ==================== BARCODE SCANNER ====================

async function toggleScanner() {
    if (isScanning) {
        stopScanner();
    } else {
        startScanner();
    }
}

async function startScanner() {
    try {
        elements.scannerPlaceholder.classList.add('hidden');
        elements.scannerBox.classList.add('active');

        scanner = new Html5Qrcode("scanner");

        await scanner.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 100 },
                aspectRatio: 1.7777778
            },
            onScanSuccess,
            onScanError
        );

        isScanning = true;
        elements.toggleScannerBtn.innerHTML = '<i class="fas fa-stop"></i> Tắt Camera';
        elements.toggleScannerBtn.classList.remove('btn-primary');
        elements.toggleScannerBtn.classList.add('btn-danger');

        showToast('Camera đã bật', 'success');
    } catch (error) {
        console.error('Scanner error:', error);
        showToast('Không thể bật camera: ' + error.message, 'error');
        elements.scannerPlaceholder.classList.remove('hidden');
        elements.scannerBox.classList.remove('active');
    }
}

async function stopScanner() {
    if (scanner && isScanning) {
        try {
            await scanner.stop();
            scanner.clear();
        } catch (e) {
            console.error('Stop scanner error:', e);
        }
    }

    isScanning = false;
    elements.toggleScannerBtn.innerHTML = '<i class="fas fa-camera"></i> Bật Camera';
    elements.toggleScannerBtn.classList.add('btn-primary');
    elements.toggleScannerBtn.classList.remove('btn-danger');
    elements.scannerPlaceholder.classList.remove('hidden');
    elements.scannerBox.classList.remove('active');
}

function onScanSuccess(decodedText) {
    // Play beep sound
    playBeep();

    // Handle the scanned barcode
    handleBarcodeSearch(decodedText);

    // Stop scanner after successful scan (scan only once)
    stopScanner();
}

function onScanError(error) {
    // Ignore scan errors (normal when no barcode in view)
}

function playBeep() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 1000;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
}

// ==================== PRODUCT SEARCH ====================

async function handleBarcodeSearch(query) {
    if (!query) return;

    elements.barcodeInput.value = '';

    // First try exact barcode match
    const product = await db.getProductByBarcode(query);

    if (product) {
        addToCart(product);
        return;
    }

    // Try searching by name
    const searchResults = await db.searchProducts(query);

    if (searchResults.length === 1) {
        addToCart(searchResults[0]);
    } else if (searchResults.length > 1) {
        highlightSearchResults(searchResults);
        showToast(`Tìm thấy ${searchResults.length} sản phẩm`, 'warning');
    } else {
        showToast('Không tìm thấy sản phẩm: ' + query, 'error');
    }
}

function highlightSearchResults(results) {
    const productCards = document.querySelectorAll('.product-card');
    const resultIds = results.map(r => r.id);

    productCards.forEach(card => {
        if (resultIds.includes(card.dataset.id)) {
            card.style.animation = 'pulse 0.5s ease 3';
            setTimeout(() => {
                card.style.animation = '';
            }, 1500);
        }
    });
}

// ==================== PRODUCTS DISPLAY ====================

async function loadProducts() {
    products = await db.getAllProducts();
    renderProducts(products);
}

async function loadCategories() {
    const categories = await db.getAllCategories();

    elements.categoryFilter.innerHTML = '<option value="">Tất cả</option>';
    categories.forEach(cat => {
        elements.categoryFilter.innerHTML += `<option value="${cat.name}">${cat.name}</option>`;
    });
}

function renderProducts(productList) {
    if (productList.length === 0) {
        elements.productGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1;">
                <i class="fas fa-box-open"></i>
                <h3>Chưa có sản phẩm</h3>
                <p>Thêm sản phẩm trong mục <a href="products.html">Sản phẩm</a></p>
            </div>
        `;
        return;
    }

    elements.productGrid.innerHTML = productList.map(product => `
        <div class="product-card" data-id="${product.id}" onclick="addToCartById('${product.id}')">
            <div class="product-card-name" title="${product.name}">${product.name}</div>
            <div class="product-card-price">${formatCurrency(product.price)}</div>
            ${product.stock !== undefined && product.stock <= 5 ?
            `<span class="badge badge-warning" style="font-size: 0.65rem;">Còn ${product.stock}</span>` :
            ''
        }
        </div>
    `).join('');
}

function filterProducts() {
    const category = elements.categoryFilter.value;

    if (category) {
        const filtered = products.filter(p => p.category === category);
        renderProducts(filtered);
    } else {
        renderProducts(products);
    }
}

// ==================== CART MANAGEMENT ====================

function addToCartById(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        addToCart(product);
    }
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            barcode: product.barcode
        });
    }

    updateCart();
    showToast(`Đã thêm: ${product.name}`, 'success');
}

function updateCartItemQty(productId, delta) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    item.quantity += delta;

    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== productId);
    }

    updateCart();
}

function removeCartItem(productId) {
    cart = cart.filter(i => i.id !== productId);
    updateCart();
}

function clearCart() {
    if (cart.length === 0) return;

    if (confirm('Xóa tất cả sản phẩm khỏi giỏ hàng?')) {
        cart = [];
        updateCart();
        showToast('Đã xóa giỏ hàng', 'success');
    }
}

function updateCart() {
    // Update cart items display
    if (cart.length === 0) {
        elements.cartItems.innerHTML = `
            <div class="cart-empty">
                <i class="fas fa-shopping-basket"></i>
                <p>Giỏ hàng trống</p>
                <p class="text-muted" style="font-size: 0.875rem;">Quét mã vạch hoặc chọn sản phẩm</p>
            </div>
        `;
    } else {
        elements.cartItems.innerHTML = cart.map(item => `
            <div class="cart-item animate-fadeIn">
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">${formatCurrency(item.price)}</div>
                </div>
                <div class="cart-item-qty">
                    <button onclick="updateCartItemQty('${item.id}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="updateCartItemQty('${item.id}', 1)">+</button>
                </div>
                <div class="cart-item-subtotal">${formatCurrency(item.price * item.quantity)}</div>
                <button class="cart-item-remove" onclick="removeCartItem('${item.id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
    }

    // Update totals
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    elements.cartCount.textContent = totalItems;
    elements.cartTotal.textContent = formatCurrency(totalAmount);
    elements.checkoutBtn.disabled = cart.length === 0;

    // Save to localStorage
    saveCartToStorage();
}

function saveCartToStorage() {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
}

function loadCartFromStorage() {
    const saved = localStorage.getItem('pos_cart');
    if (saved) {
        try {
            cart = JSON.parse(saved);
            updateCart();
        } catch (e) {
            cart = [];
        }
    }
}

// ==================== CHECKOUT ====================

async function checkout() {
    if (cart.length === 0) return;

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Create order
    const order = {
        items: cart.map(item => ({
            productId: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity
        })),
        total: total
    };

    try {
        const savedOrder = await db.addOrder(order);

        // Generate receipt
        generateReceipt(savedOrder);

        // Clear cart
        cart = [];
        saveCartToStorage();
        updateCart();

        // Update stats
        await updateTodayStats();

        // Show receipt modal
        elements.receiptModal.classList.add('active');

        showToast(`Đã tạo đơn hàng ${savedOrder.orderNumber}`, 'success');
    } catch (error) {
        console.error('Checkout error:', error);
        showToast('Lỗi tạo đơn hàng: ' + error.message, 'error');
    }
}

function generateReceipt(order) {
    const date = new Date(order.createdAt);

    elements.receiptContent.innerHTML = `
        <div class="receipt">
            <div class="receipt-header">
                <div class="receipt-title">🐾 PET STORE</div>
                <div style="font-size: 0.75rem; margin-top: 0.5rem;">
                    ${order.orderNumber}<br>
                    ${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN')}
                </div>
            </div>
            
            <div class="receipt-items">
                ${order.items.map(item => `
                    <div class="receipt-item">
                        <span>${item.name} x${item.quantity}</span>
                        <span>${formatCurrency(item.subtotal)}</span>
                    </div>
                `).join('')}
            </div>
            
            <div class="receipt-total">
                <span>TỔNG CỘNG</span>
                <span>${formatCurrency(order.total)}</span>
            </div>
            
            <div class="receipt-footer">
                Cảm ơn quý khách!<br>
                Hẹn gặp lại 🐕🐈
            </div>
        </div>
    `;
}

function closeReceiptModal() {
    elements.receiptModal.classList.remove('active');
}

function printReceipt() {
    const receiptHtml = elements.receiptContent.innerHTML;
    const printWindow = window.open('', '', 'width=400,height=600');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Hóa đơn</title>
            <style>
                body { font-family: 'Courier New', monospace; padding: 20px; }
                .receipt { max-width: 300px; margin: 0 auto; }
                .receipt-header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                .receipt-title { font-size: 18px; font-weight: bold; }
                .receipt-item { display: flex; justify-content: space-between; margin: 5px 0; }
                .receipt-total { border-top: 1px dashed #000; margin-top: 10px; padding-top: 10px; font-weight: bold; display: flex; justify-content: space-between; }
                .receipt-footer { text-align: center; margin-top: 15px; font-size: 12px; }
            </style>
        </head>
        <body>${receiptHtml}</body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
}

function startNewOrder() {
    closeReceiptModal();
    elements.barcodeInput.focus();
}

// ==================== STATS ====================

async function updateTodayStats() {
    const stats = await db.getTodayStats();

    elements.todayStats.querySelector('div:first-child div:first-child').textContent = stats.orderCount;
    elements.todayRevenue.textContent = formatCurrency(stats.totalRevenue);
}

// ==================== BACKUP ====================

async function backupData() {
    try {
        const data = await db.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `petstore_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        URL.revokeObjectURL(url);
        showToast('Đã tải file backup', 'success');
    } catch (error) {
        showToast('Lỗi backup: ' + error.message, 'error');
    }
}

// ==================== UTILITIES ====================

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount).replace('₫', 'đ');
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'check-circle' :
        type === 'error' ? 'exclamation-circle' :
            'exclamation-triangle';

    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== START APP ====================

document.addEventListener('DOMContentLoaded', init);

// Make functions globally accessible for onclick handlers
window.addToCartById = addToCartById;
window.updateCartItemQty = updateCartItemQty;
window.removeCartItem = removeCartItem;
