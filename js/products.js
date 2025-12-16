/**
 * Pet Store POS - Products Management Module
 */

let products = [];
let categories = [];
let editingProductId = null;

// DOM Elements
const elements = {
    menuToggle: document.getElementById('menuToggle'),
    sidebar: document.getElementById('sidebar'),
    searchInput: document.getElementById('searchInput'),
    categoryFilter: document.getElementById('categoryFilter'),
    productTable: document.getElementById('productTable'),
    totalProducts: document.getElementById('totalProducts'),
    totalCategories: document.getElementById('totalCategories'),
    lowStockCount: document.getElementById('lowStockCount'),
    addProductBtn: document.getElementById('addProductBtn'),
    importBtn: document.getElementById('importBtn'),
    productModal: document.getElementById('productModal'),
    productForm: document.getElementById('productForm'),
    modalTitle: document.getElementById('modalTitle'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    category: document.getElementById('category'),
    addCategoryBtn: document.getElementById('addCategoryBtn'),
    importModal: document.getElementById('importModal'),
    closeImportBtn: document.getElementById('closeImportBtn'),
    cancelImportBtn: document.getElementById('cancelImportBtn'),
    importFile: document.getElementById('importFile'),
    processImportBtn: document.getElementById('processImportBtn'),
    downloadTemplateBtn: document.getElementById('downloadTemplateBtn'),
    toastContainer: document.getElementById('toastContainer')
};

// ==================== INITIALIZATION ====================

async function init() {
    try {
        await db.init();
        await loadProducts();
        await loadCategories();
        updateStats();
        setupEventListeners();
        console.log('Products page initialized');
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

    // Search & Filter
    elements.searchInput?.addEventListener('input', debounce(filterProducts, 300));
    elements.categoryFilter?.addEventListener('change', filterProducts);

    // Add Product
    elements.addProductBtn?.addEventListener('click', () => openProductModal());
    elements.closeModalBtn?.addEventListener('click', closeProductModal);
    elements.cancelBtn?.addEventListener('click', closeProductModal);
    elements.productModal?.addEventListener('click', (e) => {
        if (e.target === elements.productModal) closeProductModal();
    });

    // Form submit
    elements.productForm?.addEventListener('submit', handleProductSubmit);

    // Add Category
    elements.addCategoryBtn?.addEventListener('click', handleAddCategory);

    // Import
    elements.importBtn?.addEventListener('click', openImportModal);
    elements.closeImportBtn?.addEventListener('click', closeImportModal);
    elements.cancelImportBtn?.addEventListener('click', closeImportModal);
    elements.importModal?.addEventListener('click', (e) => {
        if (e.target === elements.importModal) closeImportModal();
    });
    elements.processImportBtn?.addEventListener('click', processImport);
    elements.downloadTemplateBtn?.addEventListener('click', downloadTemplate);
}

// ==================== PRODUCTS CRUD ====================

async function loadProducts() {
    products = await db.getAllProducts();
    renderProducts(products);
}

async function loadCategories() {
    categories = await db.getAllCategories();
    renderCategoryDropdowns();
}

function renderProducts(productList) {
    if (productList.length === 0) {
        elements.productTable.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="padding: 3rem;">
                    <div class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <h3>Chưa có sản phẩm</h3>
                        <p>Nhấn "Thêm sản phẩm" hoặc "Nhập Excel" để bắt đầu</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    elements.productTable.innerHTML = productList.map(product => `
        <tr>
            <td><code>${product.barcode}</code></td>
            <td>
                <strong>${product.name}</strong>
                ${product.unit ? `<span class="text-muted" style="font-size: 0.75rem;"> / ${product.unit}</span>` : ''}
            </td>
            <td>
                ${product.category ? `<span class="badge badge-primary">${product.category}</span>` : '-'}
            </td>
            <td><strong class="text-success">${formatCurrency(product.price)}</strong></td>
            <td>
                ${product.stock !== undefined ?
            (product.stock <= 5 ?
                `<span class="badge badge-warning">${product.stock}</span>` :
                product.stock
            ) : '-'
        }
            </td>
            <td>
                <button class="btn btn-icon btn-outline" onclick="editProduct('${product.id}')" title="Sửa">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-icon btn-outline" onclick="deleteProduct('${product.id}')" title="Xóa" style="color: var(--danger);">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function renderCategoryDropdowns() {
    const options = '<option value="">-- Chọn danh mục --</option>' +
        categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    elements.category.innerHTML = options;
    elements.categoryFilter.innerHTML = '<option value="">Tất cả danh mục</option>' +
        categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function updateStats() {
    elements.totalProducts.textContent = products.length;
    elements.totalCategories.textContent = categories.length;
    elements.lowStockCount.textContent = products.filter(p => p.stock !== undefined && p.stock <= 5).length;
}

function filterProducts() {
    const search = elements.searchInput.value.toLowerCase();
    const category = elements.categoryFilter.value;

    let filtered = products;

    if (search) {
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(search) ||
            p.barcode.toLowerCase().includes(search)
        );
    }

    if (category) {
        filtered = filtered.filter(p => p.category === category);
    }

    renderProducts(filtered);
}

// ==================== PRODUCT MODAL ====================

function openProductModal(product = null) {
    editingProductId = product?.id || null;
    elements.modalTitle.textContent = product ? 'Sửa sản phẩm' : 'Thêm sản phẩm';

    // Reset form
    elements.productForm.reset();

    // Fill form if editing
    if (product) {
        document.getElementById('barcode').value = product.barcode || '';
        document.getElementById('name').value = product.name || '';
        document.getElementById('category').value = product.category || '';
        document.getElementById('price').value = product.price || '';
        document.getElementById('cost').value = product.cost || '';
        document.getElementById('stock').value = product.stock || 0;
        document.getElementById('unit').value = product.unit || '';
    }

    elements.productModal.classList.add('active');
    document.getElementById('barcode').focus();
}

function closeProductModal() {
    elements.productModal.classList.remove('active');
    editingProductId = null;
}

async function handleProductSubmit(e) {
    e.preventDefault();

    const productData = {
        barcode: document.getElementById('barcode').value.trim(),
        name: document.getElementById('name').value.trim(),
        category: document.getElementById('category').value,
        price: parseFloat(document.getElementById('price').value) || 0,
        cost: parseFloat(document.getElementById('cost').value) || 0,
        stock: parseInt(document.getElementById('stock').value) || 0,
        unit: document.getElementById('unit').value.trim()
    };

    try {
        if (editingProductId) {
            productData.id = editingProductId;
            await db.updateProduct(productData);
            showToast('Đã cập nhật sản phẩm', 'success');
        } else {
            await db.addProduct(productData);
            showToast('Đã thêm sản phẩm mới', 'success');
        }

        closeProductModal();
        await loadProducts();
        updateStats();
    } catch (error) {
        if (error.message.includes('unique') || error.name === 'ConstraintError') {
            showToast('Mã vạch đã tồn tại', 'error');
        } else {
            showToast('Lỗi: ' + error.message, 'error');
        }
    }
}

async function editProduct(id) {
    const product = await db.getProduct(id);
    if (product) {
        openProductModal(product);
    }
}

async function deleteProduct(id) {
    const product = await db.getProduct(id);
    if (!product) return;

    if (confirm(`Xóa sản phẩm "${product.name}"?`)) {
        try {
            await db.deleteProduct(id);
            showToast('Đã xóa sản phẩm', 'success');
            await loadProducts();
            updateStats();
        } catch (error) {
            showToast('Lỗi: ' + error.message, 'error');
        }
    }
}

// ==================== CATEGORIES ====================

async function handleAddCategory() {
    const name = prompt('Nhập tên danh mục mới:');
    if (!name || !name.trim()) return;

    try {
        await db.addCategory({ name: name.trim() });
        await loadCategories();
        updateStats();

        // Select the new category
        elements.category.value = name.trim();

        showToast('Đã thêm danh mục: ' + name, 'success');
    } catch (error) {
        showToast('Lỗi: ' + error.message, 'error');
    }
}

// ==================== IMPORT/EXPORT ====================

function openImportModal() {
    elements.importModal.classList.add('active');
    elements.importFile.value = '';
}

function closeImportModal() {
    elements.importModal.classList.remove('active');
}

async function processImport() {
    const file = elements.importFile.files[0];
    if (!file) {
        showToast('Vui lòng chọn file', 'error');
        return;
    }

    try {
        const data = await readExcelFile(file);

        if (data.length === 0) {
            showToast('File không có dữ liệu', 'error');
            return;
        }

        let imported = 0;
        let errors = 0;

        for (const row of data) {
            if (!row.barcode || !row.name) {
                errors++;
                continue;
            }

            try {
                // Add category if not exists
                if (row.category) {
                    const existingCat = categories.find(c => c.name === row.category);
                    if (!existingCat) {
                        await db.addCategory({ name: row.category });
                    }
                }

                // Check if product exists
                const existing = await db.getProductByBarcode(row.barcode);
                if (existing) {
                    // Update existing
                    await db.updateProduct({ ...existing, ...row });
                } else {
                    // Add new
                    await db.addProduct(row);
                }
                imported++;
            } catch (e) {
                errors++;
            }
        }

        closeImportModal();
        await loadProducts();
        await loadCategories();
        updateStats();

        showToast(`Đã nhập ${imported} sản phẩm${errors > 0 ? `, ${errors} lỗi` : ''}`,
            errors > 0 ? 'warning' : 'success');
    } catch (error) {
        showToast('Lỗi đọc file: ' + error.message, 'error');
    }
}

function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                // Skip header row, map to objects
                const products = [];
                for (let i = 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length === 0) continue;

                    products.push({
                        barcode: String(row[0] || '').trim(),
                        name: String(row[1] || '').trim(),
                        category: String(row[2] || '').trim(),
                        price: parseFloat(row[3]) || 0,
                        cost: parseFloat(row[4]) || 0,
                        stock: parseInt(row[5]) || 0,
                        unit: String(row[6] || '').trim()
                    });
                }

                resolve(products);
            } catch (err) {
                reject(err);
            }
        };

        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

function downloadTemplate() {
    const template = [
        ['Mã vạch', 'Tên sản phẩm', 'Danh mục', 'Giá bán', 'Giá nhập', 'Tồn kho', 'Đơn vị'],
        ['8935001730057', 'Thức ăn chó Pedigree 1.5kg', 'Thức ăn chó', 150000, 120000, 10, 'gói'],
        ['8935001730064', 'Thức ăn mèo Whiskas 1.2kg', 'Thức ăn mèo', 130000, 100000, 15, 'gói']
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'product_template.xlsx');

    showToast('Đã tải file mẫu', 'success');
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

// Global functions for onclick
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
