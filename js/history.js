/**
 * Pet Store POS - Order History Module
 */

let orders = [];
let currentOrderId = null;

const elements = {
    menuToggle: document.getElementById('menuToggle'),
    sidebar: document.getElementById('sidebar'),
    periodFilter: document.getElementById('periodFilter'),
    searchInput: document.getElementById('searchInput'),
    ordersTable: document.getElementById('ordersTable'),
    periodRevenue: document.getElementById('periodRevenue'),
    periodOrders: document.getElementById('periodOrders'),
    periodItems: document.getElementById('periodItems'),
    orderModal: document.getElementById('orderModal'),
    orderDetails: document.getElementById('orderDetails'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    printOrderBtn: document.getElementById('printOrderBtn'),
    deleteOrderBtn: document.getElementById('deleteOrderBtn'),
    toastContainer: document.getElementById('toastContainer')
};

// ==================== INITIALIZATION ====================

async function init() {
    try {
        await db.init();
        await loadOrders();
        setupEventListeners();
        console.log('History page initialized');
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

    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            !elements.sidebar.contains(e.target) &&
            !elements.menuToggle.contains(e.target)) {
            elements.sidebar.classList.remove('open');
        }
    });

    // Filters
    elements.periodFilter?.addEventListener('change', loadOrders);
    elements.searchInput?.addEventListener('input', debounce(filterOrders, 300));

    // Modal
    elements.closeModalBtn?.addEventListener('click', closeModal);
    elements.orderModal?.addEventListener('click', (e) => {
        if (e.target === elements.orderModal) closeModal();
    });

    elements.printOrderBtn?.addEventListener('click', printCurrentOrder);
    elements.deleteOrderBtn?.addEventListener('click', deleteCurrentOrder);
}

// ==================== ORDERS ====================

async function loadOrders() {
    const period = elements.periodFilter.value;
    let startDate, endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    switch (period) {
        case 'today':
            startDate = new Date();
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'week':
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'month':
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'all':
            startDate = new Date(2000, 0, 1);
            break;
    }

    orders = await db.getOrdersByDateRange(startDate, endDate);
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    updateStats();
    renderOrders(orders);
}

function renderOrders(orderList) {
    if (orderList.length === 0) {
        elements.ordersTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center" style="padding: 3rem;">
                    <div class="empty-state">
                        <i class="fas fa-receipt"></i>
                        <h3>Chưa có đơn hàng</h3>
                        <p>Các đơn hàng sẽ hiển thị ở đây</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    elements.ordersTable.innerHTML = orderList.map(order => {
        const date = new Date(order.createdAt);
        const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
        const itemNames = order.items.map(i => i.name).slice(0, 2).join(', ');
        const moreItems = order.items.length > 2 ? ` +${order.items.length - 2}` : '';

        return `
            <tr>
                <td><code style="color: var(--primary);">${order.orderNumber}</code></td>
                <td>
                    <div>${date.toLocaleDateString('vi-VN')}</div>
                    <div class="text-muted" style="font-size: 0.75rem;">${date.toLocaleTimeString('vi-VN')}</div>
                </td>
                <td>
                    <div style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${order.items.map(i => i.name).join(', ')}">
                        ${itemNames}${moreItems}
                    </div>
                    <div class="text-muted" style="font-size: 0.75rem;">${itemCount} sản phẩm</div>
                </td>
                <td><strong class="text-success">${formatCurrency(order.total)}</strong></td>
                <td>
                    <button class="btn btn-icon btn-outline" onclick="viewOrder('${order.id}')" title="Xem chi tiết">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterOrders() {
    const search = elements.searchInput.value.toLowerCase();

    if (!search) {
        renderOrders(orders);
        return;
    }

    const filtered = orders.filter(o =>
        o.orderNumber.toLowerCase().includes(search) ||
        o.items.some(i => i.name.toLowerCase().includes(search))
    );

    renderOrders(filtered);
}

function updateStats() {
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const totalItems = orders.reduce((sum, o) =>
        sum + o.items.reduce((iSum, i) => iSum + i.quantity, 0), 0
    );

    elements.periodRevenue.textContent = formatCurrency(totalRevenue);
    elements.periodOrders.textContent = orders.length;
    elements.periodItems.textContent = totalItems;
}

// ==================== ORDER DETAILS ====================

async function viewOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    currentOrderId = orderId;
    const date = new Date(order.createdAt);

    elements.orderDetails.innerHTML = `
        <div class="receipt">
            <div class="receipt-header">
                <div class="receipt-title">🐾 PET STORE</div>
                <div style="font-size: 0.875rem; margin-top: 0.5rem;">
                    <strong>${order.orderNumber}</strong><br>
                    ${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN')}
                </div>
            </div>
            
            <div class="receipt-items" style="margin: 1rem 0;">
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
        </div>
    `;

    elements.orderModal.classList.add('active');
}

function closeModal() {
    elements.orderModal.classList.remove('active');
    currentOrderId = null;
}

function printCurrentOrder() {
    const receiptHtml = elements.orderDetails.innerHTML;
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

async function deleteCurrentOrder() {
    if (!currentOrderId) return;

    const order = orders.find(o => o.id === currentOrderId);
    if (!order) return;

    if (confirm(`Xóa đơn hàng ${order.orderNumber}?`)) {
        try {
            await db.deleteOrder(currentOrderId);
            closeModal();
            await loadOrders();
            showToast('Đã xóa đơn hàng', 'success');
        } catch (error) {
            showToast('Lỗi: ' + error.message, 'error');
        }
    }
}

// ==================== UTILITIES ====================

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount).replace('₫', 'đ');
}

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

// ==================== START ====================

document.addEventListener('DOMContentLoaded', init);

window.viewOrder = viewOrder;
