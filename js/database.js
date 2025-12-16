/**
 * Pet Store POS - Database Module
 * Sử dụng IndexedDB để lưu trữ dữ liệu offline
 */

const DB_NAME = 'PetStorePOS';
const DB_VERSION = 1;

class Database {
    constructor() {
        this.db = null;
    }

    // Khởi tạo database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Products store
                if (!db.objectStoreNames.contains('products')) {
                    const productStore = db.createObjectStore('products', { keyPath: 'id' });
                    productStore.createIndex('barcode', 'barcode', { unique: true });
                    productStore.createIndex('name', 'name', { unique: false });
                    productStore.createIndex('category', 'category', { unique: false });
                }

                // Orders store
                if (!db.objectStoreNames.contains('orders')) {
                    const orderStore = db.createObjectStore('orders', { keyPath: 'id' });
                    orderStore.createIndex('orderNumber', 'orderNumber', { unique: true });
                    orderStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Categories store
                if (!db.objectStoreNames.contains('categories')) {
                    db.createObjectStore('categories', { keyPath: 'id' });
                }
            };
        });
    }

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // ==================== PRODUCTS ====================

    async addProduct(product) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readwrite');
            const store = transaction.objectStore('products');

            product.id = product.id || this.generateId();
            product.createdAt = product.createdAt || new Date().toISOString();

            const request = store.add(product);
            request.onsuccess = () => resolve(product);
            request.onerror = () => reject(request.error);
        });
    }

    async updateProduct(product) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readwrite');
            const store = transaction.objectStore('products');

            product.updatedAt = new Date().toISOString();

            const request = store.put(product);
            request.onsuccess = () => resolve(product);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteProduct(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readwrite');
            const store = transaction.objectStore('products');

            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async getProduct(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readonly');
            const store = transaction.objectStore('products');

            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getProductByBarcode(barcode) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readonly');
            const store = transaction.objectStore('products');
            const index = store.index('barcode');

            const request = index.get(barcode);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllProducts() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['products'], 'readonly');
            const store = transaction.objectStore('products');

            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async searchProducts(query) {
        const products = await this.getAllProducts();
        const lowerQuery = query.toLowerCase();

        return products.filter(p =>
            p.name.toLowerCase().includes(lowerQuery) ||
            p.barcode.includes(query) ||
            (p.category && p.category.toLowerCase().includes(lowerQuery))
        );
    }

    // ==================== ORDERS ====================

    async getNextOrderNumber() {
        const orders = await this.getAllOrders();
        if (orders.length === 0) return 'HD0001';

        const lastOrder = orders.sort((a, b) =>
            new Date(b.createdAt) - new Date(a.createdAt)
        )[0];

        const lastNum = parseInt(lastOrder.orderNumber.replace('HD', ''));
        return 'HD' + String(lastNum + 1).padStart(4, '0');
    }

    async addOrder(order) {
        // Get order number BEFORE creating transaction to avoid transaction closing
        const orderNumber = order.orderNumber || await this.getNextOrderNumber();
        const orderId = order.id || this.generateId();
        const createdAt = order.createdAt || new Date().toISOString();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');

            const orderData = {
                ...order,
                id: orderId,
                orderNumber: orderNumber,
                createdAt: createdAt
            };

            const request = store.add(orderData);
            request.onsuccess = () => resolve(orderData);
            request.onerror = () => reject(request.error);
        });
    }

    async getOrder(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readonly');
            const store = transaction.objectStore('orders');

            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllOrders() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readonly');
            const store = transaction.objectStore('orders');

            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getOrdersByDateRange(startDate, endDate) {
        const orders = await this.getAllOrders();
        return orders.filter(o => {
            const orderDate = new Date(o.createdAt);
            return orderDate >= startDate && orderDate <= endDate;
        });
    }

    async deleteOrder(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');

            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== CATEGORIES ====================

    async addCategory(category) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['categories'], 'readwrite');
            const store = transaction.objectStore('categories');

            category.id = category.id || this.generateId();

            const request = store.add(category);
            request.onsuccess = () => resolve(category);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllCategories() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['categories'], 'readonly');
            const store = transaction.objectStore('categories');

            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteCategory(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['categories'], 'readwrite');
            const store = transaction.objectStore('categories');

            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== BACKUP & RESTORE ====================

    async exportData() {
        const products = await this.getAllProducts();
        const orders = await this.getAllOrders();
        const categories = await this.getAllCategories();

        const data = {
            exportDate: new Date().toISOString(),
            version: DB_VERSION,
            products,
            orders,
            categories
        };

        return JSON.stringify(data, null, 2);
    }

    async importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            // Clear existing data
            await this.clearAllData();

            // Import categories
            for (const category of (data.categories || [])) {
                await this.addCategory(category);
            }

            // Import products
            for (const product of (data.products || [])) {
                await this.addProduct(product);
            }

            // Import orders
            for (const order of (data.orders || [])) {
                await new Promise((resolve, reject) => {
                    const transaction = this.db.transaction(['orders'], 'readwrite');
                    const store = transaction.objectStore('orders');
                    const request = store.add(order);
                    request.onsuccess = () => resolve();
                    request.onerror = () => reject(request.error);
                });
            }

            return {
                success: true,
                imported: {
                    products: data.products?.length || 0,
                    orders: data.orders?.length || 0,
                    categories: data.categories?.length || 0
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async clearAllData() {
        const stores = ['products', 'orders', 'categories'];

        for (const storeName of stores) {
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction([storeName], 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    // ==================== STATISTICS ====================

    async getTodayStats() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const orders = await this.getOrdersByDateRange(today, tomorrow);

        return {
            orderCount: orders.length,
            totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
            itemsSold: orders.reduce((sum, o) =>
                sum + o.items.reduce((iSum, i) => iSum + i.quantity, 0), 0
            )
        };
    }
}

// Singleton instance
const db = new Database();
