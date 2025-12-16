/**
 * Pet Store POS - Settings Module
 */

const elements = {
    menuToggle: document.getElementById('menuToggle'),
    sidebar: document.getElementById('sidebar'),
    backupBtn: document.getElementById('backupBtn'),
    restoreBtn: document.getElementById('restoreBtn'),
    restoreFile: document.getElementById('restoreFile'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    totalProducts: document.getElementById('totalProducts'),
    totalOrders: document.getElementById('totalOrders'),
    totalCategories: document.getElementById('totalCategories'),
    totalRevenue: document.getElementById('totalRevenue'),
    toastContainer: document.getElementById('toastContainer')
};

// ==================== INITIALIZATION ====================

async function init() {
    try {
        await db.init();
        await loadStats();
        setupEventListeners();
        console.log('Settings page initialized');
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

    // Backup
    elements.backupBtn?.addEventListener('click', backupData);

    // Restore
    elements.restoreBtn?.addEventListener('click', () => {
        elements.restoreFile.click();
    });
    elements.restoreFile?.addEventListener('change', restoreData);

    // Clear all
    elements.clearAllBtn?.addEventListener('click', clearAllData);
}

// ==================== STATS ====================

async function loadStats() {
    const products = await db.getAllProducts();
    const orders = await db.getAllOrders();
    const categories = await db.getAllCategories();

    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);

    elements.totalProducts.textContent = products.length;
    elements.totalOrders.textContent = orders.length;
    elements.totalCategories.textContent = categories.length;
    elements.totalRevenue.textContent = formatCurrency(totalRevenue);
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
        showToast('Đã tải file backup thành công!', 'success');
    } catch (error) {
        showToast('Lỗi backup: ' + error.message, 'error');
    }
}

// ==================== RESTORE ====================

async function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset input
    event.target.value = '';

    if (!confirm('⚠️ CẢNH BÁO: Tất cả dữ liệu hiện tại sẽ bị thay thế bởi dữ liệu từ file backup.\n\nBạn có chắc chắn muốn tiếp tục?')) {
        return;
    }

    try {
        const text = await file.text();
        const result = await db.importData(text);

        if (result.success) {
            showToast(`Đã phục hồi: ${result.imported.products} sản phẩm, ${result.imported.orders} đơn hàng, ${result.imported.categories} danh mục`, 'success');
            await loadStats();
        } else {
            showToast('Lỗi phục hồi: ' + result.error, 'error');
        }
    } catch (error) {
        showToast('Lỗi đọc file: ' + error.message, 'error');
    }
}

// ==================== CLEAR ALL ====================

async function clearAllData() {
    const confirmText = 'XÓA TẤT CẢ';
    const input = prompt(`⚠️ CẢNH BÁO NGHIÊM TRỌNG!\n\nHành động này sẽ XÓA VĨNH VIỄN tất cả:\n- Sản phẩm\n- Đơn hàng\n- Danh mục\n\nNhập "${confirmText}" để xác nhận:`);

    if (input !== confirmText) {
        if (input !== null) {
            showToast('Đã hủy xóa dữ liệu', 'warning');
        }
        return;
    }

    try {
        await db.clearAllData();
        showToast('Đã xóa tất cả dữ liệu', 'success');
        await loadStats();
    } catch (error) {
        showToast('Lỗi: ' + error.message, 'error');
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

// ==================== START ====================

document.addEventListener('DOMContentLoaded', init);
