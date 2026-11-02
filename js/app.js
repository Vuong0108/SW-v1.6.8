/**
        * STUDENT WALLET - PHASE 4 ARCHITECTURE
        * Kế thừa toàn bộ nền tảng Phase 1, 2, 3 và bổ sung AnalyticsService + AnalyticsUI
        * để phân tích dòng tiền theo ngày/tuần/tháng, tỷ trọng danh mục và đối chiếu các tháng.
        */
        const StudentWalletApp = (() => {
        'use strict';

        /* ========================================================================
        1. GENERAL UTILITIES
        ======================================================================== */
        const GeneralUtils = {
        STORAGE_KEYS: {
        THEME: 'student_wallet_theme_v1',
        SIDEBAR_COLLAPSED: 'student_wallet_sidebar_collapsed_v1',
        PROFILE: 'student_wallet_profile_v1',
        SETTINGS: 'student_wallet_settings_v1',
        DEMO_MODE: 'student_wallet_demo_mode_v1'
        },

        qs(selector, scope = document) {
        return scope.querySelector(selector);
        },

        qsa(selector, scope = document) {
        return Array.from(scope.querySelectorAll(selector));
        },

        getStorage(key, fallback = null) {
        try {
        const raw = localStorage.getItem(key);
        return raw !== null ? JSON.parse(raw) : fallback;
        } catch (error) {
        console.warn(`[Storage Read Warning] Key: ${key}`, error);
        return fallback;
        }
        },

        setStorage(key, value) {
        try {
        localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
        console.warn(`[Storage Write Warning] Key: ${key}`, error);
        }
        },

        refreshIcons() {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
        }
        },

        formatCurrencyVND(amount) {
        const num = Number(amount) || 0;
        return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0
        }).format(num);
        },

        escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
        },

        generateUniqueId(prefix = 'tx') {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return `${prefix}_${window.crypto.randomUUID()}`;
        }
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }
        };

        /* ========================================================================
        2. DATE & TIME UTILITIES
        ======================================================================== */
        const DateTimeUtils = {
        formatCurrentDateVi(date = new Date()) {
        const formatter = new Intl.DateTimeFormat('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
        });
        return formatter.format(date);
        },

        formatLocalISODate(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
        },

        dateFormatPreference: 'DD/MM/YYYY',

        formatDisplayDateVi(isoDateStr) {
        if (!isoDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoDateStr)) return isoDateStr || '';
        const [year, month, day] = isoDateStr.split('-');
        if (this.dateFormatPreference === 'YYYY-MM-DD') {
        return `${year}-${month}-${day}`;
        }
        if (this.dateFormatPreference === 'MM/DD/YYYY') {
        return `${month}/${day}/${year}`;
        }
        return `${day}/${month}/${year}`;
        },

        formatShortDayMonthVi(isoDateStr) {
        if (!isoDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoDateStr)) return isoDateStr || '';
        const [, month, day] = isoDateStr.split('-');
        return `${day}/${month}`;
        },

        formatPeriodKey(year, month) {
        const y = Number(year);
        const m = String(Number(month)).padStart(2, '0');
        return `${y}-${m}`;
        },

        formatPeriodLabelVi(periodKey) {
        if (!periodKey || !/^\d{4}-\d{2}$/.test(periodKey)) return periodKey || '';
        const [year, month] = periodKey.split('-');
        return `Tháng ${month}/${year}`;
        },

        /**
        * Tính ngày Thứ Hai đầu tuần từ chuỗi YYYY-MM-DD để gom nhóm theo tuần
        */
        getMondayOfWeekISO(isoDateStr) {
        const [y, m, d] = isoDateStr.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        const dayOfWeek = dt.getDay(); // 0 (CN) -> 6 (T7)
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        dt.setDate(dt.getDate() + diffToMonday);
        return this.formatLocalISODate(dt);
        },

        getSundayOfWeekISO(mondayIsoStr) {
        const [y, m, d] = mondayIsoStr.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        dt.setDate(dt.getDate() + 6);
        return this.formatLocalISODate(dt);
        },

        getGreetingByHour(date = new Date()) {
        const hour = date.getHours();
        if (hour >= 5 && hour < 12) return 'Chào buổi sáng';
        if (hour >= 12 && hour < 18) return 'Chào buổi chiều';
        return 'Chào buổi tối';
        },

        initHeaderDateAndGreeting() {
        const dateEl = GeneralUtils.qs('#currentDateDisplay');
        const greetingEl = GeneralUtils.qs('#greetingHeading');
        const now = new Date();

        if (dateEl) {
        dateEl.textContent = this.formatCurrentDateVi(now);
        dateEl.setAttribute('datetime', this.formatLocalISODate(now));
        }

        if (greetingEl) {
        greetingEl.textContent = `${this.getGreetingByHour(now)}, chào mừng bạn đến với Student Wallet!`;
        }
        }
        };

        /* ========================================================================
        3. NOTIFICATION & MODAL MANAGER (In-App Toast & Confirm Dialog)
        ======================================================================== */
        const NotificationManager = {
        pendingDeleteId: null,
        onConfirmCallback: null,

        init() {
        const cancelBtn = GeneralUtils.qs('#cancelDeleteModalBtn');
        const confirmBtn = GeneralUtils.qs('#confirmDeleteModalBtn');
        const modalBackdrop = GeneralUtils.qs('#deleteConfirmModal');

        if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.closeConfirmModal());
        }

        if (modalBackdrop) {
        modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) this.closeConfirmModal();
        });
        }

        if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
        if (typeof this.onConfirmCallback === 'function') {
        this.onConfirmCallback(this.pendingDeleteId);
        }
        this.closeConfirmModal();
        });
        }

        document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalBackdrop && modalBackdrop.classList.contains('is-open')) {
        this.closeConfirmModal();
        }
        });
        },

        showToast(message, type = 'success') {
        const container = GeneralUtils.qs('#toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast-item toast-item--${type}`;
        toast.innerHTML = `
        <span>${GeneralUtils.escapeHTML(message)}</span>
        <button type="button" class="btn-icon" aria-label="Đóng thông báo">
        <i data-lucide="x" style="width: 14px; height: 14px;"></i>
        </button>
        `;

        const closeBtn = toast.querySelector('button');
        const removeToast = () => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
        };

        if (closeBtn) closeBtn.addEventListener('click', removeToast);

        container.appendChild(toast);
        GeneralUtils.refreshIcons();

        setTimeout(removeToast, 3800);
        },

        openConfirmModal(targetId, message, callback, title = 'Xác nhận xóa dữ liệu') {
        const modalBackdrop = GeneralUtils.qs('#deleteConfirmModal');
        const titleEl = GeneralUtils.qs('#deleteModalTitle');
        const msgEl = GeneralUtils.qs('#deleteModalMessage');
        if (!modalBackdrop) return;

        this.pendingDeleteId = targetId;
        this.onConfirmCallback = callback;

        if (titleEl && title) {
        titleEl.textContent = title;
        }
        if (msgEl && message) {
        msgEl.textContent = message;
        }

        modalBackdrop.classList.add('is-open');
        },

        closeConfirmModal() {
        const modalBackdrop = GeneralUtils.qs('#deleteConfirmModal');
        if (modalBackdrop) {
        modalBackdrop.classList.remove('is-open');
        }
        this.pendingDeleteId = null;
        this.onConfirmCallback = null;
        }
        };

        /* ========================================================================
        4. DATABASE LAYER (IndexedDB v2: 'transactions' + 'budgets')
        ======================================================================== */
        const Database = {
        DB_NAME: 'StudentWalletDB',
        REAL_DB_NAME: 'StudentWalletDB',
        DEMO_DB_NAME: 'StudentWalletDemoDB',
        isDemoMode: false,
        realDbInstance: null,
        demoDbInstance: null,
        DB_VERSION: 4,
        STORE_TRANSACTIONS: 'transactions',
        STORE_BUDGETS: 'budgets',
        STORE_SAVINGS_GOALS: 'savingsGoals',
        STORE_SAVINGS_CONTRIBUTIONS: 'savingsContributions',
        STORE_ALLOWANCES: 'allowances',
        STORE_RECURRING_EXPENSES: 'recurringExpenses',
        dbInstance: null,
        memoryFallback: [],
        memoryBudgetsFallback: [],
        memorySavingsGoalsFallback: [],
        memorySavingsContributionsFallback: [],
        memoryAllowancesFallback: [],
        memoryRecurringExpensesFallback: [],
        useFallback: false,

        async init() {
        if (!window.indexedDB) {
        console.warn('[Database] Trình duyệt không hỗ trợ IndexedDB, chuyển sang bộ nhớ tạm.');
        this.useFallback = true;
        return;
        }

        return new Promise((resolve) => {
        try {
        const request = window.indexedDB.open(this.DB_NAME, this.DB_VERSION);

        request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(this.STORE_TRANSACTIONS)) {
        const txStore = db.createObjectStore(this.STORE_TRANSACTIONS, { keyPath: 'id' });
        txStore.createIndex('date', 'date', { unique: false });
        txStore.createIndex('type', 'type', { unique: false });
        txStore.createIndex('category', 'category', { unique: false });
        txStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.STORE_BUDGETS)) {
        const budgetStore = db.createObjectStore(this.STORE_BUDGETS, { keyPath: 'id' });
        budgetStore.createIndex('periodKey', 'periodKey', { unique: false });
        budgetStore.createIndex('scope', 'scope', { unique: false });
        budgetStore.createIndex('category', 'category', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.STORE_SAVINGS_GOALS)) {
        const sgStore = db.createObjectStore(this.STORE_SAVINGS_GOALS, { keyPath: 'id' });
        sgStore.createIndex('status', 'status', { unique: false });
        sgStore.createIndex('targetDate', 'targetDate', { unique: false });
        sgStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.STORE_SAVINGS_CONTRIBUTIONS)) {
        const scStore = db.createObjectStore(this.STORE_SAVINGS_CONTRIBUTIONS, { keyPath: 'id' });
        scStore.createIndex('goalId', 'goalId', { unique: false });
        scStore.createIndex('type', 'type', { unique: false });
        scStore.createIndex('date', 'date', { unique: false });
        scStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.STORE_ALLOWANCES)) {
        const alwStore = db.createObjectStore(this.STORE_ALLOWANCES, { keyPath: 'id' });
        alwStore.createIndex('frequency', 'frequency', { unique: false });
        alwStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.STORE_RECURRING_EXPENSES)) {
        const recStore = db.createObjectStore(this.STORE_RECURRING_EXPENSES, { keyPath: 'id' });
        recStore.createIndex('frequency', 'frequency', { unique: false });
        recStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        };

        request.onsuccess = (event) => {
        this.realDbInstance = event.target.result;
        this.dbInstance = this.realDbInstance;
        resolve(this.dbInstance);
        };

        request.onerror = (event) => {
        console.error('[Database] Lỗi mở IndexedDB:', event.target.error);
        this.useFallback = true;
        resolve(null);
        };
        } catch (error) {
        console.error('[Database] Ngoại lệ khởi tạo IndexedDB:', error);
        this.useFallback = true;
        resolve(null);
        }
        });
        },

        async getAllTransactions() {
        if (this.useFallback || !this.dbInstance) {
        return [...this.memoryFallback];
        }

        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_TRANSACTIONS], 'readonly');
        const store = tx.objectStore(this.STORE_TRANSACTIONS);
        const request = store.getAll();

        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => reject(request.error);
        } catch (err) {
        reject(err);
        }
        });
        },

        async getTransactionById(id) {
        if (this.useFallback || !this.dbInstance) {
        return this.memoryFallback.find((item) => item.id === id) || null;
        }

        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_TRANSACTIONS], 'readonly');
        const store = tx.objectStore(this.STORE_TRANSACTIONS);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
        } catch (err) {
        reject(err);
        }
        });
        },

        async putTransaction(record) {
        if (this.useFallback || !this.dbInstance) {
        const idx = this.memoryFallback.findIndex((item) => item.id === record.id);
        if (idx >= 0) {
        this.memoryFallback[idx] = record;
        } else {
        this.memoryFallback.push(record);
        }
        return record;
        }

        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_TRANSACTIONS], 'readwrite');
        const store = tx.objectStore(this.STORE_TRANSACTIONS);
        const request = store.put(record);

        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
        } catch (err) {
        reject(err);
        }
        });
        },

        async deleteTransaction(id) {
        if (this.useFallback || !this.dbInstance) {
        this.memoryFallback = this.memoryFallback.filter((item) => item.id !== id);
        return true;
        }

        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_TRANSACTIONS], 'readwrite');
        const store = tx.objectStore(this.STORE_TRANSACTIONS);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
        } catch (err) {
        reject(err);
        }
        });
        },

        async getAllBudgets() {
        if (this.useFallback || !this.dbInstance) {
        return [...this.memoryBudgetsFallback];
        }

        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_BUDGETS], 'readonly');
        const store = tx.objectStore(this.STORE_BUDGETS);
        const request = store.getAll();

        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => reject(request.error);
        } catch (err) {
        reject(err);
        }
        });
        },

        async getBudgetById(id) {
        if (this.useFallback || !this.dbInstance) {
        return this.memoryBudgetsFallback.find((item) => item.id === id) || null;
        }

        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_BUDGETS], 'readonly');
        const store = tx.objectStore(this.STORE_BUDGETS);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
        } catch (err) {
        reject(err);
        }
        });
        },

        async putBudget(record) {
        if (this.useFallback || !this.dbInstance) {
        const idx = this.memoryBudgetsFallback.findIndex((item) => item.id === record.id);
        if (idx >= 0) {
        this.memoryBudgetsFallback[idx] = record;
        } else {
        this.memoryBudgetsFallback.push(record);
        }
        return record;
        }

        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_BUDGETS], 'readwrite');
        const store = tx.objectStore(this.STORE_BUDGETS);
        const request = store.put(record);

        request.onsuccess = () => resolve(record);
        request.onerror = () => reject(request.error);
        } catch (err) {
        reject(err);
        }
        });
        },

        async deleteBudget(id) {
        if (this.useFallback || !this.dbInstance) {
        this.memoryBudgetsFallback = this.memoryBudgetsFallback.filter((item) => item.id !== id);
        return true;
        }

        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_BUDGETS], 'readwrite');
        const store = tx.objectStore(this.STORE_BUDGETS);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
        } catch (err) {
        reject(err);
        }
        });
        },
        async getAllSavingsGoals() {
        if (this.useFallback || !this.dbInstance) return [...this.memorySavingsGoalsFallback];
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_SAVINGS_GOALS], 'readonly');
        const req = tx.objectStore(this.STORE_SAVINGS_GOALS).getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        async getSavingsGoalById(id) {
        if (this.useFallback || !this.dbInstance) {
        return this.memorySavingsGoalsFallback.find((g) => g.id === id) || null;
        }
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_SAVINGS_GOALS], 'readonly');
        const req = tx.objectStore(this.STORE_SAVINGS_GOALS).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        async putSavingsGoal(record) {
        if (this.useFallback || !this.dbInstance) {
        const idx = this.memorySavingsGoalsFallback.findIndex((g) => g.id === record.id);
        if (idx >= 0) this.memorySavingsGoalsFallback[idx] = record;
        else this.memorySavingsGoalsFallback.push(record);
        return record;
        }
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_SAVINGS_GOALS], 'readwrite');
        const req = tx.objectStore(this.STORE_SAVINGS_GOALS).put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        async deleteSavingsGoal(id) {
        if (this.useFallback || !this.dbInstance) {
        this.memorySavingsGoalsFallback = this.memorySavingsGoalsFallback.filter((g) => g.id !== id);
        return true;
        }
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_SAVINGS_GOALS], 'readwrite');
        const req = tx.objectStore(this.STORE_SAVINGS_GOALS).delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        async getAllSavingsContributions() {
        if (this.useFallback || !this.dbInstance) return [...this.memorySavingsContributionsFallback];
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_SAVINGS_CONTRIBUTIONS], 'readonly');
        const req = tx.objectStore(this.STORE_SAVINGS_CONTRIBUTIONS).getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        async putSavingsContribution(record) {
        if (this.useFallback || !this.dbInstance) {
        this.memorySavingsContributionsFallback.push(record);
        return record;
        }
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_SAVINGS_CONTRIBUTIONS], 'readwrite');
        const req = tx.objectStore(this.STORE_SAVINGS_CONTRIBUTIONS).put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        async deleteContributionsByGoalId(goalId) {
        const all = await this.getAllSavingsContributions();
        const targets = all.filter((c) => c.goalId === goalId);
        if (this.useFallback || !this.dbInstance) {
        this.memorySavingsContributionsFallback = this.memorySavingsContributionsFallback.filter((c) => c.goalId !== goalId);
        return true;
        }
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_SAVINGS_CONTRIBUTIONS], 'readwrite');
        const store = tx.objectStore(this.STORE_SAVINGS_CONTRIBUTIONS);
        targets.forEach((item) => store.delete(item.id));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        } catch (err) { reject(err); }
        });
        },

        async getAllAllowances() {
        if (this.useFallback || !this.dbInstance) return [...this.memoryAllowancesFallback];
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_ALLOWANCES], 'readonly');
        const req = tx.objectStore(this.STORE_ALLOWANCES).getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        async getAllowanceById(id) {
        if (this.useFallback || !this.dbInstance) {
        return this.memoryAllowancesFallback.find((a) => a.id === id) || null;
        }
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_ALLOWANCES], 'readonly');
        const req = tx.objectStore(this.STORE_ALLOWANCES).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        async putAllowance(record) {
        if (this.useFallback || !this.dbInstance) {
        const idx = this.memoryAllowancesFallback.findIndex((a) => a.id === record.id);
        if (idx >= 0) this.memoryAllowancesFallback[idx] = record;
        else this.memoryAllowancesFallback.push(record);
        return record;
        }
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_ALLOWANCES], 'readwrite');
        const req = tx.objectStore(this.STORE_ALLOWANCES).put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        async deleteAllowance(id) {
        if (this.useFallback || !this.dbInstance) {
        this.memoryAllowancesFallback = this.memoryAllowancesFallback.filter((a) => a.id !== id);
        return true;
        }
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_ALLOWANCES], 'readwrite');
        const req = tx.objectStore(this.STORE_ALLOWANCES).delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        async getAllRecurringExpenses() {
        if (this.useFallback || !this.dbInstance) return [...this.memoryRecurringExpensesFallback];
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_RECURRING_EXPENSES], 'readonly');
        const req = tx.objectStore(this.STORE_RECURRING_EXPENSES).getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        async getRecurringExpenseById(id) {
        if (this.useFallback || !this.dbInstance) {
        return this.memoryRecurringExpensesFallback.find((r) => r.id === id) || null;
        }
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_RECURRING_EXPENSES], 'readonly');
        const req = tx.objectStore(this.STORE_RECURRING_EXPENSES).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        async putRecurringExpense(record) {
        if (this.useFallback || !this.dbInstance) {
        const idx = this.memoryRecurringExpensesFallback.findIndex((r) => r.id === record.id);
        if (idx >= 0) this.memoryRecurringExpensesFallback[idx] = record;
        else this.memoryRecurringExpensesFallback.push(record);
        return record;
        }
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_RECURRING_EXPENSES], 'readwrite');
        const req = tx.objectStore(this.STORE_RECURRING_EXPENSES).put(record);
        req.onsuccess = () => resolve(record);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        async deleteRecurringExpense(id) {
        if (this.useFallback || !this.dbInstance) {
        this.memoryRecurringExpensesFallback = this.memoryRecurringExpensesFallback.filter((r) => r.id !== id);
        return true;
        }
        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction([this.STORE_RECURRING_EXPENSES], 'readwrite');
        const req = tx.objectStore(this.STORE_RECURRING_EXPENSES).delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
        } catch (err) { reject(err); }
        });
        },

        /**
        * Ghi nguyên tử (Atomic Transaction) toàn bộ 6 bảng tài chính khi Restore.
        * Nếu có bất kỳ lỗi nào xảy ra giữa chừng, IndexedDB tự động rollback toàn bộ,
        * đảm bảo không bao giờ làm mất dữ liệu hiện tại.
        */
        async importFinancialDataset(dataset, clearFirst = false) {
        if (this.useFallback || !this.dbInstance) {
        if (clearFirst) {
        this.memoryFallback = [...dataset.transactions];
        this.memoryBudgetsFallback = [...dataset.budgets];
        this.memorySavingsGoalsFallback = [...dataset.savingsGoals];
        this.memorySavingsContributionsFallback = [...dataset.savingsContributions];
        this.memoryAllowancesFallback = [...dataset.allowances];
        this.memoryRecurringExpensesFallback = [...dataset.recurringExpenses];
        } else {
        const mergeArr = (target, incoming) => {
        incoming.forEach((item) => {
        const i = target.findIndex((x) => x.id === item.id);
        if (i >= 0) target[i] = item;
        else target.push(item);
        });
        };
        mergeArr(this.memoryFallback, dataset.transactions);
        mergeArr(this.memoryBudgetsFallback, dataset.budgets);
        mergeArr(this.memorySavingsGoalsFallback, dataset.savingsGoals);
        mergeArr(this.memorySavingsContributionsFallback, dataset.savingsContributions);
        mergeArr(this.memoryAllowancesFallback, dataset.allowances);
        mergeArr(this.memoryRecurringExpensesFallback, dataset.recurringExpenses);
        }
        return true;
        }

        const storeNames = [
        this.STORE_TRANSACTIONS,
        this.STORE_BUDGETS,
        this.STORE_SAVINGS_GOALS,
        this.STORE_SAVINGS_CONTRIBUTIONS,
        this.STORE_ALLOWANCES,
        this.STORE_RECURRING_EXPENSES
        ];

        return new Promise((resolve, reject) => {
        try {
        const tx = this.dbInstance.transaction(storeNames, 'readwrite');

        const mapping = [
        [this.STORE_TRANSACTIONS, dataset.transactions],
        [this.STORE_BUDGETS, dataset.budgets],
        [this.STORE_SAVINGS_GOALS, dataset.savingsGoals],
        [this.STORE_SAVINGS_CONTRIBUTIONS, dataset.savingsContributions],
        [this.STORE_ALLOWANCES, dataset.allowances],
        [this.STORE_RECURRING_EXPENSES, dataset.recurringExpenses]
        ];

        mapping.forEach(([storeName, records]) => {
        const store = tx.objectStore(storeName);
        if (clearFirst) {
        store.clear();
        }
        (records || []).forEach((rec) => {
        store.put(rec);
        });
        });

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('Giao dịch khôi phục dữ liệu thất bại.'));
        tx.onabort = () => reject(new Error('Quá trình khôi phục bị hủy để bảo vệ dữ liệu gốc.'));
        } catch (err) {
        reject(err);
        }
        });
        }
        };

        /* ========================================================================
        5. TRANSACTION SERVICE (Validation, CRUD & Financial Calculations)
        ======================================================================== */
        const TransactionService = {
        CATEGORIES: {
        income: [
        'Trợ cấp gia đình',
        'Học bổng',
        'Làm thêm (Part-time)',
        'Thưởng / Quà tặng',
        'Thu nhập khác'
        ],
        expense: [
        'Ăn uống & Sinh hoạt',
        'Tiền trọ & Điện nước',
        'Học tập & Giáo trình',
        'Di chuyển & Xăng xe',
        'Giải trí & Mua sắm',
        'Sức khỏe & Y tế',
        'Chi tiêu khác'
        ],
        transfer: [
        'Chuyển sang Tiền mặt',
        'Nạp vào Ví điện tử',
        'Chuyển khoản Ngân hàng',
        'Chuyển quỹ nội bộ'
        ]
        },

        TYPE_LABELS: {
        income: 'Thu nhập',
        expense: 'Chi tiêu',
        transfer: 'Chuyển khoản'
        },

        getAllUniqueCategories() {
        const set = new Set([
        ...this.CATEGORIES.expense,
        ...this.CATEGORIES.income,
        ...this.CATEGORIES.transfer
        ]);
        return Array.from(set);
        },

        validateInput(payload) {
        const errors = [];
        const validTypes = ['income', 'expense', 'transfer'];

        const type = String(payload.type || '').trim();
        if (!validTypes.includes(type)) {
        errors.push('Loại giao dịch không hợp lệ.');
        }

        const amount = Number(payload.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
        errors.push('Số tiền phải là một số dương lớn hơn 0.');
        }

        const category = String(payload.category || '').trim();
        if (!category) {
        errors.push('Vui lòng chọn danh mục giao dịch.');
        }

        const date = String(payload.date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push('Ngày giao dịch không hợp lệ (định dạng YYYY-MM-DD).');
        } else {
        const parsed = new Date(`${date}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) {
        errors.push('Ngày giao dịch không tồn tại.');
        }
        }

        const note = String(payload.note || '').trim();
        if (note.length > 250) {
        errors.push('Ghi chú không được vượt quá 250 ký tự.');
        }

        return {
        isValid: errors.length === 0,
        errors,
        sanitized: {
        type,
        amount: Math.round(amount),
        category,
        date,
        note
        }
        };
        },

        async createTransaction(payload) {
        const check = this.validateInput(payload);
        if (!check.isValid) {
        throw new Error(check.errors[0]);
        }

        const nowISO = new Date().toISOString();
        const newRecord = {
        id: GeneralUtils.generateUniqueId('tx'),
        ...check.sanitized,
        createdAt: nowISO,
        updatedAt: nowISO
        };

        await Database.putTransaction(newRecord);
        return newRecord;
        },

        async updateTransaction(id, payload) {
        if (!id) throw new Error('Không tìm thấy mã giao dịch cần chỉnh sửa.');

        const existing = await Database.getTransactionById(id);
        if (!existing) {
        throw new Error('Giao dịch không tồn tại hoặc đã bị xóa.');
        }

        const check = this.validateInput(payload);
        if (!check.isValid) {
        throw new Error(check.errors[0]);
        }

        const updatedRecord = {
        ...existing,
        ...check.sanitized,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: new Date().toISOString()
        };

        await Database.putTransaction(updatedRecord);
        return updatedRecord;
        },

        async removeTransaction(id) {
        if (!id) throw new Error('Mã giao dịch không hợp lệ.');
        await Database.deleteTransaction(id);
        return true;
        },

        calculateSummary(transactions = []) {
        let totalIncome = 0;
        let totalExpense = 0;
        let totalTransfer = 0;
        let incomeCount = 0;
        let expenseCount = 0;
        let transferCount = 0;

        transactions.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        if (amt <= 0) return;

        if (tx.type === 'income') {
        totalIncome += amt;
        incomeCount += 1;
        } else if (tx.type === 'expense') {
        totalExpense += amt;
        expenseCount += 1;
        } else if (tx.type === 'transfer') {
        totalTransfer += amt;
        transferCount += 1;
        }
        });

        const balance = totalIncome - totalExpense;

        return {
        totalIncome,
        totalExpense,
        totalTransfer,
        balance,
        incomeCount,
        expenseCount,
        transferCount,
        totalCount: transactions.length
        };
        },

        filterAndSortTransactions(transactions = [], filters = {}) {
        const {
        search = '',
        type = 'all',
        category = 'all',
        dateFrom = '',
        dateTo = '',
        sort = 'newest'
        } = filters;

        const keyword = search.trim().toLowerCase();

        const filtered = transactions.filter((tx) => {
        if (type !== 'all' && tx.type !== type) return false;
        if (category !== 'all' && tx.category !== category) return false;
        if (dateFrom && tx.date < dateFrom) return false;
        if (dateTo && tx.date > dateTo) return false;

        if (keyword) {
        const noteText = String(tx.note || '').toLowerCase();
        const catText = String(tx.category || '').toLowerCase();
        if (!noteText.includes(keyword) && !catText.includes(keyword)) {
        return false;
        }
        }
        return true;
        });

        filtered.sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date);
        if (dateDiff !== 0) {
        return sort === 'oldest' ? dateDiff : -dateDiff;
        }
        const createdDiff = String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
        return sort === 'oldest' ? createdDiff : -createdDiff;
        });

        return filtered;
        },

        groupCashflowByDate(transactions = [], limitDays = 7) {
        const map = new Map();

        transactions.forEach((tx) => {
        if (tx.type !== 'income' && tx.type !== 'expense') return;
        const dateKey = tx.date;
        if (!map.has(dateKey)) {
        map.set(dateKey, { date: dateKey, income: 0, expense: 0 });
        }
        const entry = map.get(dateKey);
        if (tx.type === 'income') entry.income += Number(tx.amount) || 0;
        if (tx.type === 'expense') entry.expense += Number(tx.amount) || 0;
        });

        const sortedDates = Array.from(map.values()).sort((a, b) =>
        b.date.localeCompare(a.date)
        );

        return sortedDates.slice(0, limitDays).reverse();
        }
        };

        /* ========================================================================
        6. BUDGET SERVICE (PHASE 3)
        ======================================================================== */
        const BudgetService = {
        validateBudgetInput(payload) {
        const errors = [];
        const validScopes = ['overall', 'category'];

        const scope = String(payload.scope || '').trim();
        if (!validScopes.includes(scope)) {
        errors.push('Loại ngân sách không hợp lệ.');
        }

        const year = Number(payload.year);
        const month = Number(payload.month);
        if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        errors.push('Năm ngân sách không hợp lệ.');
        }
        if (!Number.isInteger(month) || month < 1 || month > 12) {
        errors.push('Tháng ngân sách không hợp lệ (1 - 12).');
        }

        let category = 'ALL';
        if (scope === 'category') {
        category = String(payload.category || '').trim();
        if (!category || !TransactionService.CATEGORIES.expense.includes(category)) {
        errors.push('Vui lòng chọn danh mục chi tiêu hợp lệ.');
        }
        }

        const amount = Number(payload.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
        errors.push('Hạn mức ngân sách phải là số dương lớn hơn 0.');
        }

        const note = String(payload.note || '').trim();
        if (note.length > 200) {
        errors.push('Ghi chú không được vượt quá 200 ký tự.');
        }

        const periodKey = DateTimeUtils.formatPeriodKey(year, month);

        return {
        isValid: errors.length === 0,
        errors,
        sanitized: {
        periodKey,
        year,
        month,
        scope,
        category: scope === 'overall' ? 'ALL' : category,
        amount: Math.round(amount),
        note
        }
        };
        },

        async saveBudget(payload, editingId = null) {
        const check = this.validateBudgetInput(payload);
        if (!check.isValid) {
        throw new Error(check.errors[0]);
        }

        const allBudgets = await Database.getAllBudgets();
        const { periodKey, scope, category } = check.sanitized;

        const duplicate = allBudgets.find(
        (b) =>
        b.periodKey === periodKey &&
        b.scope === scope &&
        b.category === category &&
        b.id !== editingId
        );

        const nowISO = new Date().toISOString();

        if (editingId) {
        const existing = await Database.getBudgetById(editingId);
        if (!existing) {
        throw new Error('Không tìm thấy ngân sách cần chỉnh sửa.');
        }
        if (duplicate) {
        throw new Error(
        scope === 'overall'
        ? 'Ngân sách tổng cho tháng này đã tồn tại.'
        : `Danh mục "${category}" đã có ngân sách trong tháng này.`
        );
        }

        const updated = {
        ...existing,
        ...check.sanitized,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: nowISO
        };
        await Database.putBudget(updated);
        return { record: updated, mode: 'updated' };
        }

        if (duplicate) {
        const merged = {
        ...duplicate,
        ...check.sanitized,
        id: duplicate.id,
        createdAt: duplicate.createdAt,
        updatedAt: nowISO
        };
        await Database.putBudget(merged);
        return { record: merged, mode: 'updated' };
        }

        const created = {
        id: GeneralUtils.generateUniqueId('bg'),
        ...check.sanitized,
        createdAt: nowISO,
        updatedAt: nowISO
        };
        await Database.putBudget(created);
        return { record: created, mode: 'created' };
        },

        async removeBudget(id) {
        if (!id) throw new Error('Mã ngân sách không hợp lệ.');
        await Database.deleteBudget(id);
        return true;
        },

        evaluateUsageStatus(spent, limit) {
        const safeLimit = Number(limit) || 0;
        const safeSpent = Number(spent) || 0;

        if (safeLimit <= 0) {
        return {
        rawPercent: 0,
        displayPercent: 0,
        barPercent: 0,
        remaining: 0,
        level: 'none',
        badgeClass: 'budget-status-badge--safe',
        barClass: 'budget-progress-fill--safe',
        statusText: 'Chưa đặt hạn mức'
        };
        }

        const rawPercent = (safeSpent / safeLimit) * 100;
        const displayPercent = Math.round(rawPercent * 10) / 10;
        const barPercent = Math.min(100, Math.max(0, rawPercent));
        const remaining = safeLimit - safeSpent;

        if (safeSpent > safeLimit) {
        return {
        rawPercent,
        displayPercent,
        barPercent: 100,
        remaining,
        level: 'exceeded',
        badgeClass: 'budget-status-badge--danger',
        barClass: 'budget-progress-fill--danger',
        statusText: `Vượt ngân sách (+${GeneralUtils.formatCurrencyVND(Math.abs(remaining))})`
        };
        }

        if (Math.abs(safeSpent - safeLimit) < 0.01 || rawPercent >= 100) {
        return {
        rawPercent: 100,
        displayPercent: 100,
        barPercent: 100,
        remaining: 0,
        level: 'limit-100',
        badgeClass: 'budget-status-badge--danger',
        barClass: 'budget-progress-fill--danger',
        statusText: 'Chạm ngưỡng 100% ngân sách'
        };
        }

        if (rawPercent >= 80) {
        return {
        rawPercent,
        displayPercent,
        barPercent,
        remaining,
        level: 'warning-80',
        badgeClass: 'budget-status-badge--warning',
        barClass: 'budget-progress-fill--warning',
        statusText: `Cảnh báo: Đã dùng ${displayPercent}% (≥ 80%)`
        };
        }

        return {
        rawPercent,
        displayPercent,
        barPercent,
        remaining,
        level: 'safe',
        badgeClass: 'budget-status-badge--safe',
        barClass: 'budget-progress-fill--safe',
        statusText: `An toàn (${displayPercent}%)`
        };
        },

        buildMonthlyBudgetReport(periodKey, allBudgets = [], allTransactions = []) {
        const monthlyExpenses = allTransactions.filter(
        (tx) =>
        tx &&
        tx.type === 'expense' &&
        typeof tx.date === 'string' &&
        tx.date.startsWith(`${periodKey}-`)
        );

        let totalMonthlySpent = 0;
        const spentByCategory = {};

        monthlyExpenses.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        if (amt <= 0) return;
        totalMonthlySpent += amt;
        const cat = tx.category || 'Chi tiêu khác';
        spentByCategory[cat] = (spentByCategory[cat] || 0) + amt;
        });

        const periodBudgets = allBudgets.filter((b) => b.periodKey === periodKey);
        const overallBudgetRecord =
        periodBudgets.find((b) => b.scope === 'overall') || null;
        const categoryBudgetRecords = periodBudgets
        .filter((b) => b.scope === 'category')
        .sort((a, b) => a.category.localeCompare(b.category, 'vi'));

        let sumCategoryBudgets = 0;
        const categoryItems = categoryBudgetRecords.map((b) => {
        const catSpent = spentByCategory[b.category] || 0;
        sumCategoryBudgets += Number(b.amount) || 0;
        const status = this.evaluateUsageStatus(catSpent, b.amount);
        return {
        budget: b,
        spent: catSpent,
        limit: Number(b.amount) || 0,
        status
        };
        });

        let overallItem = null;
        if (overallBudgetRecord) {
        const status = this.evaluateUsageStatus(
        totalMonthlySpent,
        overallBudgetRecord.amount
        );
        overallItem = {
        budget: overallBudgetRecord,
        spent: totalMonthlySpent,
        limit: Number(overallBudgetRecord.amount) || 0,
        status
        };
        }

        const effectiveTotalLimit = overallItem
        ? overallItem.limit
        : sumCategoryBudgets;
        const effectiveSourceLabel = overallItem
        ? 'Theo ngân sách tổng tháng đã thiết lập'
        : sumCategoryBudgets > 0
        ? `Tổng hợp từ ${categoryItems.length} danh mục chi tiêu`
        : 'Chưa thiết lập hạn mức cho tháng này';

        const effectiveStatus = this.evaluateUsageStatus(
        totalMonthlySpent,
        effectiveTotalLimit
        );

        const budgetedCategoryNames = new Set(
        categoryBudgetRecords.map((b) => b.category)
        );
        const unbudgetedExpenses = Object.entries(spentByCategory)
        .filter(([catName, amt]) => amt > 0 && !budgetedCategoryNames.has(catName))
        .map(([category, spent]) => ({ category, spent }))
        .sort((a, b) => b.spent - a.spent);

        const alerts = [];
        if (overallItem && overallItem.status.level !== 'safe') {
        alerts.push({
        scope: 'overall',
        title: 'Ngân sách tổng tháng',
        ...overallItem.status,
        spent: overallItem.spent,
        limit: overallItem.limit
        });
        }

        categoryItems.forEach((item) => {
        if (item.status.level !== 'safe') {
        alerts.push({
        scope: 'category',
        title: `Danh mục "${item.budget.category}"`,
        ...item.status,
        spent: item.spent,
        limit: item.limit
        });
        }
        });

        return {
        periodKey,
        totalMonthlySpent,
        monthlyExpenseCount: monthlyExpenses.length,
        effectiveTotalLimit,
        effectiveSourceLabel,
        effectiveStatus,
        overallItem,
        categoryItems,
        sumCategoryBudgets,
        unbudgetedExpenses,
        alerts
        };
        },

        getAvailableHistoryPeriods(allBudgets = [], allTransactions = [], currentPeriodKey = '') {
        const periodSet = new Set();
        if (currentPeriodKey) periodSet.add(currentPeriodKey);

        allBudgets.forEach((b) => {
        if (b && b.periodKey) periodSet.add(b.periodKey);
        });

        allTransactions.forEach((tx) => {
        if (tx && tx.type === 'expense' && typeof tx.date === 'string' && tx.date.length >= 7) {
        periodSet.add(tx.date.slice(0, 7));
        }
        });

        return Array.from(periodSet)
        .filter((p) => /^\d{4}-\d{2}$/.test(p))
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 6);
        }
        };

        /* ========================================================================
        7. ANALYTICS SERVICE (PHASE 4: Cashflow, Category Share & Month Comparison)
        ======================================================================== */
        const AnalyticsService = {
        CATEGORY_PALETTE: [
        '#ef4444', // Đỏ
        '#f59e0b', // Cam
        '#3b82f6', // Xanh dương
        '#8b5cf6', // Tím
        '#10b981', // Xanh ngọc
        '#ec4899', // Hồng
        '#64748b'  // Xám đá
        ],

        /**
        * Lọc danh sách giao dịch phục vụ phân tích.
        * QUY TẮC BẮT BUỘC:
        * - Chỉ lấy giao dịch có type === 'income' hoặc type === 'expense'.
        * - Loại bỏ hoàn toàn giao dịch 'transfer' khỏi mọi phép tính thu/chi.
        */
        filterValidAnalyticsTransactions(allTransactions = [], filterConfig = {}) {
        const {
        mode = 'month', // 'month' | 'year' | 'range' | 'all'
        year = new Date().getFullYear(),
        month = new Date().getMonth() + 1,
        dateFrom = '',
        dateTo = ''
        } = filterConfig;

        const monthPrefix = DateTimeUtils.formatPeriodKey(year, month);
        const yearPrefix = `${Number(year)}-`;

        return allTransactions.filter((tx) => {
        if (!tx || (tx.type !== 'income' && tx.type !== 'expense')) return false;
        const amt = Number(tx.amount) || 0;
        if (amt <= 0 || typeof tx.date !== 'string') return false;

        if (mode === 'month') {
        return tx.date.startsWith(`${monthPrefix}-`);
        }
        if (mode === 'year') {
        return tx.date.startsWith(yearPrefix);
        }
        if (mode === 'range') {
        if (dateFrom && tx.date < dateFrom) return false;
        if (dateTo && tx.date > dateTo) return false;
        return true;
        }
        return true; // mode === 'all'
        });
        },

        /**
        * Tính tổng thu, tổng chi, số dư ròng và tỷ lệ tiết kiệm
        */
        computeOverviewMetrics(filteredTransactions = []) {
        let totalIncome = 0;
        let totalExpense = 0;
        let incomeCount = 0;
        let expenseCount = 0;

        filteredTransactions.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'income') {
        totalIncome += amt;
        incomeCount += 1;
        } else if (tx.type === 'expense') {
        totalExpense += amt;
        expenseCount += 1;
        }
        });

        const netBalance = totalIncome - totalExpense;
        const savingsRate =
        totalIncome > 0
        ? Math.round(((totalIncome - totalExpense) / totalIncome) * 1000) / 10
        : 0;

        return {
        totalIncome,
        totalExpense,
        netBalance,
        incomeCount,
        expenseCount,
        totalValidCount: incomeCount + expenseCount,
        savingsRate
        };
        },

        /**
        * Nhóm dòng tiền Thu – Chi theo Ngày (day), Tuần (week) hoặc Tháng (month)
        */
        buildCashflowTimeline(filteredTransactions = [], granularity = 'day') {
        const buckets = new Map();

        filteredTransactions.forEach((tx) => {
        const amt = Number(tx.amount) || 0;
        if (amt <= 0) return;

        let key = '';
        let label = '';
        let subLabel = '';

        if (granularity === 'day') {
        key = tx.date;
        label = DateTimeUtils.formatShortDayMonthVi(tx.date);
        subLabel = tx.date.slice(0, 4);
        } else if (granularity === 'week') {
        const mondayISO = DateTimeUtils.getMondayOfWeekISO(tx.date);
        const sundayISO = DateTimeUtils.getSundayOfWeekISO(mondayISO);
        key = mondayISO;
        label = `${DateTimeUtils.formatShortDayMonthVi(mondayISO)} - ${DateTimeUtils.formatShortDayMonthVi(sundayISO)}`;
        subLabel = `Tuần (${mondayISO.slice(0, 4)})`;
        } else {
        // month
        key = tx.date.slice(0, 7);
        const [y, m] = key.split('-');
        label = `T${m}/${y}`;
        subLabel = `Năm ${y}`;
        }

        if (!buckets.has(key)) {
        buckets.set(key, {
        key,
        label,
        subLabel,
        income: 0,
        expense: 0
        });
        }

        const item = buckets.get(key);
        if (tx.type === 'income') item.income += amt;
        if (tx.type === 'expense') item.expense += amt;
        });

        const sorted = Array.from(buckets.values()).sort((a, b) =>
        a.key.localeCompare(b.key)
        );

        // Giới hạn hiển thị tối đa 14 cột gần nhất để biểu đồ luôn thoáng và rõ ràng
        const maxBuckets = granularity === 'day' ? 14 : 12;
        const sliced =
        sorted.length > maxBuckets
        ? sorted.slice(sorted.length - maxBuckets)
        : sorted;

        const maxPeak = Math.max(
        1,
        ...sliced.map((b) => Math.max(b.income, b.expense))
        );

        return {
        items: sliced.map((b) => ({
        ...b,
        net: b.income - b.expense,
        incomeHeightPct: Math.round((b.income / maxPeak) * 100),
        expenseHeightPct: Math.round((b.expense / maxPeak) * 100)
        })),
        totalBuckets: sorted.length,
        maxPeak
        };
        },

        /**
        * Phân tích chi tiêu theo danh mục và xác định danh mục chi tiêu lớn nhất
        */
        analyzeExpenseByCategory(filteredTransactions = []) {
        const catMap = new Map();
        let totalExpense = 0;

        filteredTransactions.forEach((tx) => {
        if (tx.type !== 'expense') return;
        const amt = Number(tx.amount) || 0;
        if (amt <= 0) return;

        totalExpense += amt;
        const catName = tx.category || 'Chi tiêu khác';

        if (!catMap.has(catName)) {
        catMap.set(catName, {
        category: catName,
        amount: 0,
        count: 0
        });
        }
        const record = catMap.get(catName);
        record.amount += amt;
        record.count += 1;
        });

        const sortedCategories = Array.from(catMap.values()).sort(
        (a, b) => b.amount - a.amount
        );

        let cumulativeDeg = 0;
        const gradientSegments = [];

        const breakdown = sortedCategories.map((item, idx) => {
        const sharePercent =
        totalExpense > 0
        ? Math.round((item.amount / totalExpense) * 1000) / 10
        : 0;
        const color = this.CATEGORY_PALETTE[idx % this.CATEGORY_PALETTE.length];

        const degSpan = totalExpense > 0 ? (item.amount / totalExpense) * 360 : 0;
        const startDeg = cumulativeDeg;
        const endDeg = cumulativeDeg + degSpan;
        cumulativeDeg = endDeg;

        gradientSegments.push(`${color} ${startDeg.toFixed(2)}deg ${endDeg.toFixed(2)}deg`);

        return {
        ...item,
        sharePercent,
        color
        };
        });

        const conicGradient =
        gradientSegments.length > 0
        ? `conic-gradient(${gradientSegments.join(', ')})`
        : 'conic-gradient(var(--border-subtle) 0deg 360deg)';

        const largestCategory = breakdown.length > 0 ? breakdown[0] : null;

        return {
        totalExpense,
        breakdown,
        largestCategory,
        conicGradient
        };
        },

        /**
        * So sánh tình hình tài chính giữa các tháng (Dựa trên toàn bộ lịch sử Income & Expense)
        */
        buildMonthlyComparison(allTransactions = []) {
        const monthMap = new Map();

        allTransactions.forEach((tx) => {
        if (!tx || (tx.type !== 'income' && tx.type !== 'expense')) return;
        const amt = Number(tx.amount) || 0;
        if (amt <= 0 || typeof tx.date !== 'string' || tx.date.length < 7) return;

        const periodKey = tx.date.slice(0, 7);
        if (!monthMap.has(periodKey)) {
        monthMap.set(periodKey, {
        periodKey,
        income: 0,
        expense: 0,
        categoryMap: {}
        });
        }

        const entry = monthMap.get(periodKey);
        if (tx.type === 'income') {
        entry.income += amt;
        } else if (tx.type === 'expense') {
        entry.expense += amt;
        const cat = tx.category || 'Chi tiêu khác';
        entry.categoryMap[cat] = (entry.categoryMap[cat] || 0) + amt;
        }
        });

        // Sắp xếp tăng dần theo thời gian để tính biến động so với tháng liền trước
        const chronological = Array.from(monthMap.values()).sort((a, b) =>
        a.periodKey.localeCompare(b.periodKey)
        );

        const enriched = chronological.map((item, idx) => {
        const net = item.income - item.expense;
        const savingsRate =
        item.income > 0
        ? Math.round(((item.income - item.expense) / item.income) * 1000) / 10
        : null;

        // Tìm danh mục chi lớn nhất trong tháng đó
        let topCat = 'Chưa phát sinh chi';
        let topCatAmount = 0;
        Object.entries(item.categoryMap).forEach(([cat, val]) => {
        if (val > topCatAmount) {
        topCatAmount = val;
        topCat = cat;
        }
        });

        // So sánh chi tiêu với kỳ có dữ liệu liền trước
        const prev = idx > 0 ? chronological[idx - 1] : null;
        let expenseDiff = null;
        let expenseDiffPercent = null;

        if (prev) {
        expenseDiff = item.expense - prev.expense;
        if (prev.expense > 0) {
        expenseDiffPercent =
        Math.round(((item.expense - prev.expense) / prev.expense) * 1000) / 10;
        }
        }

        return {
        periodKey: item.periodKey,
        periodLabel: DateTimeUtils.formatPeriodLabelVi(item.periodKey),
        income: item.income,
        expense: item.expense,
        net,
        savingsRate,
        topCat,
        topCatAmount,
        prevPeriodKey: prev ? prev.periodKey : null,
        expenseDiff,
        expenseDiffPercent
        };
        });

        // Đảo ngược để tháng mới nhất nằm trên cùng của bảng
        return enriched.reverse();
        }
        };

        /* ========================================================================
        8. ANALYTICS UI CONTROLLER (PHASE 4)
        ======================================================================== */
        const AnalyticsUI = {
        filterMode: 'month', // 'month' | 'year' | 'range' | 'all'
        selectedYear: new Date().getFullYear(),
        selectedMonth: new Date().getMonth() + 1,
        dateFrom: '',
        dateTo: '',
        granularity: 'day', // 'day' | 'week' | 'month'

        init() {
        const now = new Date();
        this.selectedYear = now.getFullYear();
        this.selectedMonth = now.getMonth() + 1;

        // Mặc định khoảng ngày là từ đầu tháng hiện tại đến hôm nay
        const firstDayISO = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-01`;
        const todayISO = DateTimeUtils.formatLocalISODate(now);
        this.dateFrom = firstDayISO;
        this.dateTo = todayISO;

        this.populateYearSelect();
        this.syncControlsUI();
        this.bindEvents();
        },

        populateYearSelect() {
        const yearSelect = GeneralUtils.qs('#analyticsYearSelect');
        if (!yearSelect) return;

        const currentYear = new Date().getFullYear();
        const years = [];
        for (let y = currentYear - 5; y <= currentYear + 3; y++) {
        years.push(y);
        }

        yearSelect.innerHTML = years
        .map((y) => `<option value="${y}">Năm ${y}</option>`)
        .join('');
        },

        syncControlsUI() {
        // Segmented filter mode buttons
        const modeBtns = GeneralUtils.qsa('[data-analytics-mode]');
        modeBtns.forEach((btn) => {
        btn.classList.toggle(
        'is-active',
        btn.getAttribute('data-analytics-mode') === this.filterMode
        );
        });

        // Show/hide filter inputs according to mode
        const monthCtrl = GeneralUtils.qs('#analyticsMonthCtrl');
        const yearCtrl = GeneralUtils.qs('#analyticsYearCtrl');
        const rangeCtrl = GeneralUtils.qs('#analyticsRangeCtrl');

        if (monthCtrl) {
        monthCtrl.classList.toggle('is-hidden', this.filterMode !== 'month');
        }
        if (yearCtrl) {
        yearCtrl.classList.toggle(
        'is-hidden',
        this.filterMode !== 'month' && this.filterMode !== 'year'
        );
        }
        if (rangeCtrl) {
        rangeCtrl.classList.toggle('is-hidden', this.filterMode !== 'range');
        }

        // Sync values
        const monthSelect = GeneralUtils.qs('#analyticsMonthSelect');
        const yearSelect = GeneralUtils.qs('#analyticsYearSelect');
        const fromInput = GeneralUtils.qs('#analyticsDateFrom');
        const toInput = GeneralUtils.qs('#analyticsDateTo');

        if (monthSelect) monthSelect.value = String(this.selectedMonth);
        if (yearSelect) yearSelect.value = String(this.selectedYear);
        if (fromInput) fromInput.value = this.dateFrom;
        if (toInput) toInput.value = this.dateTo;

        // Sync granularity buttons
        const granBtns = GeneralUtils.qsa('[data-analytics-granularity]');
        granBtns.forEach((btn) => {
        btn.classList.toggle(
        'is-active',
        btn.getAttribute('data-analytics-granularity') === this.granularity
        );
        });
        },

        getFilterDescriptionLabel() {
        if (this.filterMode === 'month') {
        return DateTimeUtils.formatPeriodLabelVi(
        DateTimeUtils.formatPeriodKey(this.selectedYear, this.selectedMonth)
        );
        }
        if (this.filterMode === 'year') {
        return `Cả năm ${this.selectedYear}`;
        }
        if (this.filterMode === 'range') {
        const fromTxt = this.dateFrom
        ? DateTimeUtils.formatDisplayDateVi(this.dateFrom)
        : 'Đầu kỳ';
        const toTxt = this.dateTo
        ? DateTimeUtils.formatDisplayDateVi(this.dateTo)
        : 'Hiện tại';
        return `Từ ${fromTxt} đến ${toTxt}`;
        }
        return 'Toàn bộ lịch sử dữ liệu';
        },

        renderAll(allTransactions = []) {
        const filterConfig = {
        mode: this.filterMode,
        year: this.selectedYear,
        month: this.selectedMonth,
        dateFrom: this.dateFrom,
        dateTo: this.dateTo
        };

        const filtered = AnalyticsService.filterValidAnalyticsTransactions(
        allTransactions,
        filterConfig
        );

        const overview = AnalyticsService.computeOverviewMetrics(filtered);
        const categoryReport = AnalyticsService.analyzeExpenseByCategory(filtered);
        const timelineReport = AnalyticsService.buildCashflowTimeline(
        filtered,
        this.granularity
        );
        const monthlyComparison =
        AnalyticsService.buildMonthlyComparison(allTransactions);

        // 1. Update Filter status bar
        const rangeLabelEl = GeneralUtils.qs('#analyticsActiveRangeLabel');
        const countLabelEl = GeneralUtils.qs('#analyticsFilteredCountLabel');
        if (rangeLabelEl) {
        rangeLabelEl.textContent = `Đang phân tích: ${this.getFilterDescriptionLabel()}`;
        }
        if (countLabelEl) {
        countLabelEl.textContent = `${overview.totalValidCount} giao dịch thu/chi hợp lệ (${overview.incomeCount} thu, ${overview.expenseCount} chi)`;
        }

        // 2. Render 4 KPI Cards
        this.renderKPIs(overview, categoryReport);

        // 3. Toggle Empty State vs Active Workspace
        const emptyStateEl = GeneralUtils.qs('#analyticsEmptyState');
        const workspaceEl = GeneralUtils.qs('#analyticsActiveWorkspace');

        // Kiểm tra nếu toàn bộ DB chưa có giao dịch thu/chi nào hoặc bộ lọc hiện tại trống
        const totalValidInDB = AnalyticsService.filterValidAnalyticsTransactions(
        allTransactions,
        { mode: 'all' }
        ).length;

        if (filtered.length === 0 && totalValidInDB === 0) {
        if (emptyStateEl) emptyStateEl.classList.remove('is-hidden');
        if (workspaceEl) workspaceEl.classList.add('is-hidden');
        GeneralUtils.refreshIcons();
        return;
        }

        if (emptyStateEl) {
        emptyStateEl.classList.toggle('is-hidden', filtered.length > 0);
        }
        if (workspaceEl) {
        workspaceEl.classList.remove('is-hidden');
        }

        // 4. Render Timeline Chart, Category Breakdown & Monthly Comparison Table
        this.renderTimelineChart(timelineReport);
        this.renderCategoryBreakdown(categoryReport);
        this.renderMonthlyComparisonTable(monthlyComparison);

        GeneralUtils.refreshIcons();
        },

        renderKPIs(overview, categoryReport) {
        const incomeValEl = GeneralUtils.qs('#anKpiIncomeValue');
        const incomeSubEl = GeneralUtils.qs('#anKpiIncomeSub');
        const expenseValEl = GeneralUtils.qs('#anKpiExpenseValue');
        const expenseSubEl = GeneralUtils.qs('#anKpiExpenseSub');
        const netValEl = GeneralUtils.qs('#anKpiNetValue');
        const netSubEl = GeneralUtils.qs('#anKpiNetSub');
        const topCatNameEl = GeneralUtils.qs('#anKpiTopCatName');
        const topCatSubEl = GeneralUtils.qs('#anKpiTopCatSub');

        if (incomeValEl) {
        incomeValEl.textContent = GeneralUtils.formatCurrencyVND(overview.totalIncome);
        }
        if (incomeSubEl) {
        incomeSubEl.textContent = `${overview.incomeCount} giao dịch thu nhập`;
        }

        if (expenseValEl) {
        expenseValEl.textContent = GeneralUtils.formatCurrencyVND(overview.totalExpense);
        }
        if (expenseSubEl) {
        expenseSubEl.textContent = `${overview.expenseCount} giao dịch chi tiêu`;
        }

        if (netValEl) {
        const sign = overview.netBalance > 0 ? '+' : '';
        netValEl.textContent = `${sign}${GeneralUtils.formatCurrencyVND(overview.netBalance)}`;
        netValEl.className =
        overview.netBalance > 0
        ? 'kpi-card__value kpi-card__value--income'
        : overview.netBalance < 0
        ? 'kpi-card__value kpi-card__value--expense'
        : 'kpi-card__value';
        }
        if (netSubEl) {
        if (overview.totalIncome > 0) {
        netSubEl.textContent = `Tỷ lệ tích lũy ròng: ${overview.savingsRate}% thu nhập`;
        } else {
        netSubEl.textContent = 'Chưa phát sinh thu nhập trong kỳ';
        }
        }

        if (categoryReport.largestCategory) {
        const top = categoryReport.largestCategory;
        if (topCatNameEl) topCatNameEl.textContent = top.category;
        if (topCatSubEl) {
        topCatSubEl.textContent = `${GeneralUtils.formatCurrencyVND(top.amount)} (${top.sharePercent}% tổng chi)`;
        }
        } else {
        if (topCatNameEl) topCatNameEl.textContent = 'Chưa có chi tiêu';
        if (topCatSubEl) topCatSubEl.textContent = '0 ₫ (0% tổng chi tiêu)';
        }
        },

        renderTimelineChart(timelineReport) {
        const container = GeneralUtils.qs('#analyticsTimelineChartContainer');
        const metaText = GeneralUtils.qs('#analyticsTimelineMetaText');
        if (!container) return;

        const granName =
        this.granularity === 'day'
        ? 'ngày'
        : this.granularity === 'week'
        ? 'tuần'
        : 'tháng';

        if (metaText) {
        metaText.textContent = `Hiển thị ${timelineReport.items.length} mốc ${granName} phát sinh giao dịch`;
        }

        if (timelineReport.items.length === 0) {
        container.innerHTML = `
        <div class="empty-state-box" style="padding: var(--space-8) var(--space-4);">
        <p class="empty-state-box__desc">Không có dữ liệu Thu – Chi trong kỳ này để dựng biểu đồ.</p>
        </div>
        `;
        return;
        }

        const columnsHTML = timelineReport.items
        .map((col) => {
        const incH = col.income > 0 ? Math.max(col.incomeHeightPct, 5) : 0;
        const expH = col.expense > 0 ? Math.max(col.expenseHeightPct, 5) : 0;

        return `
        <div class="vchart-col" title="${GeneralUtils.escapeHTML(col.label)} | Thu: ${GeneralUtils.formatCurrencyVND(col.income)} | Chi: ${GeneralUtils.formatCurrencyVND(col.expense)}">
        <div class="vchart-bars">
        <div
        class="vchart-bar vchart-bar--income"
        style="height: ${incH}%;"
        aria-label="Thu nhập ${GeneralUtils.escapeHTML(col.label)}: ${GeneralUtils.formatCurrencyVND(col.income)}"
        ></div>
        <div
        class="vchart-bar vchart-bar--expense"
        style="height: ${expH}%;"
        aria-label="Chi tiêu ${GeneralUtils.escapeHTML(col.label)}: ${GeneralUtils.formatCurrencyVND(col.expense)}"
        ></div>
        </div>
        <span class="vchart-label">${GeneralUtils.escapeHTML(col.label)}</span>
        <span class="vchart-sub">${GeneralUtils.escapeHTML(col.subLabel)}</span>
        </div>
        `;
        })
        .join('');

        const detailRowsHTML = timelineReport.items
        .slice()
        .reverse()
        .slice(0, 6)
        .map((item) => {
        const netSign = item.net > 0 ? '+' : '';
        return `
        <div class="cashflow-row">
        <div class="cashflow-row__meta">
        <span><strong>${GeneralUtils.escapeHTML(item.label)}</strong> (${GeneralUtils.escapeHTML(item.subLabel)})</span>
        <span>
        Thu: <strong style="color: var(--color-success);">+${GeneralUtils.formatCurrencyVND(item.income)}</strong> |
        Chi: <strong style="color: var(--color-danger);">-${GeneralUtils.formatCurrencyVND(item.expense)}</strong> |
        Ròng: <strong>${netSign}${GeneralUtils.formatCurrencyVND(item.net)}</strong>
        </span>
        </div>
        </div>
        `;
        })
        .join('');

        container.innerHTML = `
        <div class="vchart-scroll">
        <div class="vchart-stage">
        ${columnsHTML}
        </div>
        </div>
        <div style="border-top: 1px solid var(--border-subtle); padding-top: var(--space-3); display: flex; flex-direction: column; gap: var(--space-2);">
        <span style="font-size: var(--fs-xs); font-weight: var(--fw-semibold); color: var(--text-muted); text-transform: uppercase;">
        Chi tiết các mốc thời gian gần nhất
        </span>
        ${detailRowsHTML}
        </div>
        `;
        },

        renderCategoryBreakdown(categoryReport) {
        const container = GeneralUtils.qs('#analyticsCategoryContainer');
        const badgeEl = GeneralUtils.qs('#analyticsCategoryCountBadge');
        if (!container) return;

        if (badgeEl) {
        badgeEl.textContent = `${categoryReport.breakdown.length} danh mục`;
        }

        if (categoryReport.breakdown.length === 0) {
        container.innerHTML = `
        <div class="empty-state-box" style="padding: var(--space-8) var(--space-4);">
        <p class="empty-state-box__desc">
        Chưa có giao dịch Chi tiêu (Expense) nào trong khoảng thời gian này để phân tích cơ cấu danh mục.
        </p>
        </div>
        `;
        return;
        }

        const top = categoryReport.largestCategory;
        const rankItemsHTML = categoryReport.breakdown
        .map(
        (item) => `
        <div class="category-rank-item">
        <div class="category-rank-item__top">
        <span class="category-rank-item__name">
        <span class="cat-color-swatch" style="background-color: ${item.color};"></span>
        <span>${GeneralUtils.escapeHTML(item.category)}</span>
        </span>
        <strong>${GeneralUtils.formatCurrencyVND(item.amount)}</strong>
        </div>
        <div class="budget-progress-track" style="height: 7px;">
        <div
        class="budget-progress-fill"
        style="width: ${Math.max(item.sharePercent, 3)}%; background-color: ${item.color};"
        ></div>
        </div>
        <div class="category-rank-item__meta" style="justify-content: space-between; color: var(--text-muted);">
        <span>${item.count} giao dịch</span>
        <span>Chiếm <strong>${item.sharePercent}%</strong> tổng chi</span>
        </div>
        </div>
        `
        )
        .join('');

        container.innerHTML = `
        <div class="donut-summary-box">
        <div class="donut-ring" style="background: ${categoryReport.conicGradient};" role="img" aria-label="Biểu đồ tròn cơ cấu chi tiêu theo danh mục">
        <div class="donut-hole">
        <span class="donut-hole__label">Tổng chi tiêu</span>
        <span class="donut-hole__val">${GeneralUtils.formatCurrencyVND(categoryReport.totalExpense)}</span>
        </div>
        </div>

        <div style="flex: 1; min-width: 200px;">
        <div class="top-category-Banner">
        <div class="top-category-Banner__info">
        <span class="top-category-Banner__tag">Danh mục chi lớn nhất</span>
        <span class="top-category-Banner__name">${GeneralUtils.escapeHTML(top.category)}</span>
        <span style="font-size: var(--fs-xs); color: var(--text-secondary);">
        ${top.count} giao dịch phát sinh trong kỳ
        </span>
        </div>
        <div class="top-category-Banner__stats">
        <div style="font-size: var(--fs-base); font-weight: var(--fw-bold); color: var(--color-danger);">
        ${GeneralUtils.formatCurrencyVND(top.amount)}
        </div>
        <span class="budget-status-badge budget-status-badge--danger">
        Chiếm ${top.sharePercent}% tổng chi
        </span>
        </div>
        </div>
        </div>
        </div>

        <div class="category-rank-list">
        ${rankItemsHTML}
        </div>
        `;
        },

        renderMonthlyComparisonTable(monthlyRows = []) {
        const tbody = GeneralUtils.qs('#analyticsComparisonTableBody');
        const badgeEl = GeneralUtils.qs('#analyticsComparisonBadge');
        if (!tbody) return;

        if (badgeEl) {
        badgeEl.textContent = `${monthlyRows.length} tháng có dữ liệu`;
        }

        if (monthlyRows.length === 0) {
        tbody.innerHTML = `
        <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: var(--space-6);">
        Chưa có dữ liệu lịch sử để so sánh giữa các tháng.
        </td>
        </tr>
        `;
        return;
        }

        tbody.innerHTML = monthlyRows
        .map((row) => {
        const netSign = row.net > 0 ? '+' : '';
        const netColor =
        row.net > 0
        ? 'var(--color-success)'
        : row.net < 0
        ? 'var(--color-danger)'
        : 'var(--text-primary)';

        const savingsText =
        row.savingsRate !== null ? `${row.savingsRate}%` : 'Chưa có thu nhập';

        let deltaHTML = `<span class="delta-pill delta-pill--neutral">Kỳ cơ sở đầu tiên</span>`;
        if (row.expenseDiff !== null) {
        if (row.expenseDiff > 0) {
        const pctTxt =
        row.expenseDiffPercent !== null ? ` (+${row.expenseDiffPercent}%)` : '';
        deltaHTML = `
        <span class="delta-pill delta-pill--up" title="Tăng chi tiêu so với ${DateTimeUtils.formatPeriodLabelVi(row.prevPeriodKey)}">
        Tăng +${GeneralUtils.formatCurrencyVND(row.expenseDiff)}${pctTxt}
        </span>
        `;
        } else if (row.expenseDiff < 0) {
        const pctTxt =
        row.expenseDiffPercent !== null ? ` (${row.expenseDiffPercent}%)` : '';
        deltaHTML = `
        <span class="delta-pill delta-pill--down" title="Giảm chi tiêu so với ${DateTimeUtils.formatPeriodLabelVi(row.prevPeriodKey)}">
        Giảm -${GeneralUtils.formatCurrencyVND(Math.abs(row.expenseDiff))}${pctTxt}
        </span>
        `;
        } else {
        deltaHTML = `<span class="delta-pill delta-pill--neutral">Không đổi (0%)</span>`;
        }
        }

        const topCatText =
        row.topCatAmount > 0
        ? `${GeneralUtils.escapeHTML(row.topCat)} (${GeneralUtils.formatCurrencyVND(row.topCatAmount)})`
        : 'Chưa phát sinh chi';

        return `
        <tr>
        <td><strong>${GeneralUtils.escapeHTML(row.periodLabel)}</strong></td>
        <td style="color: var(--color-success); font-weight: var(--fw-semibold);">
        +${GeneralUtils.formatCurrencyVND(row.income)}
        </td>
        <td style="color: var(--color-danger); font-weight: var(--fw-semibold);">
        -${GeneralUtils.formatCurrencyVND(row.expense)}
        </td>
        <td style="color: ${netColor}; font-weight: var(--fw-bold);">
        ${netSign}${GeneralUtils.formatCurrencyVND(row.net)}
        </td>
        <td>${savingsText}</td>
        <td>${deltaHTML}</td>
        <td>${topCatText}</td>
        </tr>
        `;
        })
        .join('');
        },

        bindEvents() {
        // Chuyển chế độ lọc (month / year / range / all)
        const modeBtns = GeneralUtils.qsa('[data-analytics-mode]');
        modeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-analytics-mode');
        if (!mode) return;
        this.filterMode = mode;

        // Tự động gợi ý đơn vị biểu đồ hợp lý khi chuyển chế độ
        if (mode === 'year' || mode === 'all') {
        this.granularity = 'month';
        } else if (mode === 'month') {
        this.granularity = 'day';
        }

        this.syncControlsUI();
        this.renderAll(FinancialUI.allTransactions);
        });
        });

        // Chọn tháng / năm / khoảng thời gian
        const monthSelect = GeneralUtils.qs('#analyticsMonthSelect');
        const yearSelect = GeneralUtils.qs('#analyticsYearSelect');
        const fromInput = GeneralUtils.qs('#analyticsDateFrom');
        const toInput = GeneralUtils.qs('#analyticsDateTo');
        const resetBtn = GeneralUtils.qs('#analyticsResetFilterBtn');

        if (monthSelect) {
        monthSelect.addEventListener('change', () => {
        this.selectedMonth = Number(monthSelect.value);
        this.renderAll(FinancialUI.allTransactions);
        });
        }

        if (yearSelect) {
        yearSelect.addEventListener('change', () => {
        this.selectedYear = Number(yearSelect.value);
        this.renderAll(FinancialUI.allTransactions);
        });
        }

        if (fromInput) {
        fromInput.addEventListener('change', () => {
        this.dateFrom = fromInput.value;
        this.renderAll(FinancialUI.allTransactions);
        });
        }

        if (toInput) {
        toInput.addEventListener('change', () => {
        this.dateTo = toInput.value;
        this.renderAll(FinancialUI.allTransactions);
        });
        }

        if (resetBtn) {
        resetBtn.addEventListener('click', () => {
        const now = new Date();
        this.filterMode = 'month';
        this.selectedYear = now.getFullYear();
        this.selectedMonth = now.getMonth() + 1;
        this.granularity = 'day';
        this.syncControlsUI();
        this.renderAll(FinancialUI.allTransactions);
        });
        }

        // Chuyển đơn vị biểu đồ thời gian (Ngày / Tuần / Tháng)
        const granBtns = GeneralUtils.qsa('[data-analytics-granularity]');
        granBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
        const g = btn.getAttribute('data-analytics-granularity');
        if (!g) return;
        this.granularity = g;
        this.syncControlsUI();
        this.renderAll(FinancialUI.allTransactions);
        });
        });
        }
        };

        /* ========================================================================
        9. BUDGET UI CONTROLLER (PHASE 3)
        ======================================================================== */
        const BudgetUI = {
        allBudgets: [],
        selectedYear: new Date().getFullYear(),
        selectedMonth: new Date().getMonth() + 1,
        editingBudgetId: null,

        async init() {
        const now = new Date();
        this.selectedYear = now.getFullYear();
        this.selectedMonth = now.getMonth() + 1;

        this.populateYearSelect();
        this.populateExpenseCategories();
        this.syncPeriodSelectors();
        this.setFormScope('overall');
        this.resetBudgetForm();
        this.bindEvents();
        },

        getSelectedPeriodKey() {
        return DateTimeUtils.formatPeriodKey(this.selectedYear, this.selectedMonth);
        },

        populateYearSelect() {
        const yearSelect = GeneralUtils.qs('#budgetYearSelect');
        if (!yearSelect) return;

        const currentYear = new Date().getFullYear();
        const years = [];
        for (let y = currentYear - 5; y <= currentYear + 3; y++) {
        years.push(y);
        }

        yearSelect.innerHTML = years
        .map((y) => `<option value="${y}">Năm ${y}</option>`)
        .join('');
        },

        populateExpenseCategories(selectedCat = '') {
        const selectEl = GeneralUtils.qs('#budgetCategorySelect');
        if (!selectEl) return;

        const expenseCats = TransactionService.CATEGORIES.expense;
        selectEl.innerHTML = expenseCats
        .map(
        (cat) =>
        `<option value="${GeneralUtils.escapeHTML(cat)}">${GeneralUtils.escapeHTML(cat)}</option>`
        )
        .join('');

        if (selectedCat && expenseCats.includes(selectedCat)) {
        selectEl.value = selectedCat;
        }
        },

        syncPeriodSelectors() {
        const monthSelect = GeneralUtils.qs('#budgetMonthSelect');
        const yearSelect = GeneralUtils.qs('#budgetYearSelect');
        const formPeriodDisplay = GeneralUtils.qs('#budgetFormPeriodDisplay');

        if (yearSelect) {
        const exists = Array.from(yearSelect.options).some(
        (opt) => Number(opt.value) === this.selectedYear
        );
        if (!exists) {
        const opt = document.createElement('option');
        opt.value = String(this.selectedYear);
        opt.textContent = `Năm ${this.selectedYear}`;
        yearSelect.appendChild(opt);
        }
        yearSelect.value = String(this.selectedYear);
        }

        if (monthSelect) {
        monthSelect.value = String(this.selectedMonth);
        }

        const periodKey = this.getSelectedPeriodKey();
        if (formPeriodDisplay) {
        formPeriodDisplay.value = DateTimeUtils.formatPeriodLabelVi(periodKey);
        }
        },

        setFormScope(scope, selectedCategory = '') {
        const validScope = scope === 'category' ? 'category' : 'overall';
        const scopeInput = GeneralUtils.qs('#budgetScopeInput');
        const categoryGroup = GeneralUtils.qs('#budgetCategoryGroup');

        if (scopeInput) scopeInput.value = validScope;

        const scopeBtns = GeneralUtils.qsa('[data-budget-scope]');
        scopeBtns.forEach((btn) => {
        btn.classList.toggle(
        'is-active',
        btn.getAttribute('data-budget-scope') === validScope
        );
        });

        if (categoryGroup) {
        categoryGroup.classList.toggle('is-hidden', validScope !== 'category');
        }

        if (validScope === 'category') {
        this.populateExpenseCategories(selectedCategory);
        }
        },

        resetBudgetForm() {
        this.editingBudgetId = null;
        const idInput = GeneralUtils.qs('#budgetIdInput');
        const amountInput = GeneralUtils.qs('#budgetAmountInput');
        const noteInput = GeneralUtils.qs('#budgetNoteInput');
        const formTitle = GeneralUtils.qs('#budgetFormTitleText');
        const submitText = GeneralUtils.qs('#budgetSubmitBtnText');
        const cancelBtn = GeneralUtils.qs('#budgetCancelEditBtn');
        const errorEl = GeneralUtils.qs('#budgetFormError');

        if (idInput) idInput.value = '';
        if (amountInput) amountInput.value = '';
        if (noteInput) noteInput.value = '';
        if (formTitle) formTitle.textContent = 'Thiết lập ngân sách';
        if (submitText) submitText.textContent = 'Lưu ngân sách';
        if (cancelBtn) cancelBtn.classList.add('is-hidden');
        if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('is-hidden');
        }

        this.setFormScope('overall');
        this.syncPeriodSelectors();
        },

        startEditingBudget(budgetId) {
        const target = this.allBudgets.find((b) => b.id === budgetId);
        if (!target) {
        NotificationManager.showToast('Không tìm thấy ngân sách cần chỉnh sửa.', 'error');
        return;
        }

        this.editingBudgetId = target.id;
        this.selectedYear = Number(target.year);
        this.selectedMonth = Number(target.month);
        this.syncPeriodSelectors();

        const idInput = GeneralUtils.qs('#budgetIdInput');
        const amountInput = GeneralUtils.qs('#budgetAmountInput');
        const noteInput = GeneralUtils.qs('#budgetNoteInput');
        const formTitle = GeneralUtils.qs('#budgetFormTitleText');
        const submitText = GeneralUtils.qs('#budgetSubmitBtnText');
        const cancelBtn = GeneralUtils.qs('#budgetCancelEditBtn');
        const errorEl = GeneralUtils.qs('#budgetFormError');

        if (idInput) idInput.value = target.id;
        this.setFormScope(target.scope, target.category);
        if (amountInput) amountInput.value = target.amount;
        if (noteInput) noteInput.value = target.note || '';

        if (formTitle) formTitle.textContent = 'Chỉnh sửa ngân sách';
        if (submitText) submitText.textContent = 'Cập nhật ngân sách';
        if (cancelBtn) cancelBtn.classList.remove('is-hidden');
        if (errorEl) errorEl.classList.add('is-hidden');

        const formEl = GeneralUtils.qs('#budgetForm');
        if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        },

        changePeriod(year, month) {
        let y = Number(year);
        let m = Number(month);
        if (m < 1) {
        m = 12;
        y -= 1;
        } else if (m > 12) {
        m = 1;
        y += 1;
        }

        this.selectedYear = y;
        this.selectedMonth = m;
        this.syncPeriodSelectors();

        if (this.editingBudgetId) {
        this.resetBudgetForm();
        }

        this.renderAll(FinancialUI.allTransactions);
        },

        async reloadBudgetsAndRender(allTransactions = []) {
        try {
        this.allBudgets = await Database.getAllBudgets();
        } catch (error) {
        console.error('[BudgetUI] Lỗi đọc dữ liệu ngân sách:', error);
        this.allBudgets = [];
        }
        this.renderAll(allTransactions);
        },

        renderAll(allTransactions = []) {
        const periodKey = this.getSelectedPeriodKey();
        const report = BudgetService.buildMonthlyBudgetReport(
        periodKey,
        this.allBudgets,
        allTransactions
        );

        this.renderHistoryPills(allTransactions, periodKey);
        this.renderBudgetKPIs(report);
        this.renderAlertBanners(report);
        this.renderBudgetCards(report);
        this.renderUnbudgetedExpenses(report);
        GeneralUtils.refreshIcons();
        },

        renderHistoryPills(allTransactions, activePeriodKey) {
        const container = GeneralUtils.qs('#budgetHistoryPillsContainer');
        if (!container) return;

        const periods = BudgetService.getAvailableHistoryPeriods(
        this.allBudgets,
        allTransactions,
        activePeriodKey
        );

        if (periods.length === 0) {
        container.innerHTML = '';
        return;
        }

        container.innerHTML =
        `<span class="budget-history-label">Kỳ có dữ liệu:</span>` +
        periods
        .map((pKey) => {
        const isActive = pKey === activePeriodKey;
        const [y, m] = pKey.split('-');
        return `
        <button
        type="button"
        class="period-pill-btn ${isActive ? 'is-active' : ''}"
        data-period-jump="${pKey}"
        title="Xem ngân sách Tháng ${m}/${y}"
        >
        T${m}/${y}
        </button>
        `;
        })
        .join('');
        },

        renderBudgetKPIs(report) {
        const periodLabel = DateTimeUtils.formatPeriodLabelVi(report.periodKey);

        const kpiPeriodLabel = GeneralUtils.qs('#budgetKpiPeriodLabel');
        const kpiTotalVal = GeneralUtils.qs('#budgetKpiTotalValue');
        const kpiTotalSub = GeneralUtils.qs('#budgetKpiTotalSub');
        const kpiSpentVal = GeneralUtils.qs('#budgetKpiSpentValue');
        const kpiSpentSub = GeneralUtils.qs('#budgetKpiSpentSub');
        const kpiRemLabel = GeneralUtils.qs('#budgetKpiRemainingLabel');
        const kpiRemVal = GeneralUtils.qs('#budgetKpiRemainingValue');
        const kpiRemSub = GeneralUtils.qs('#budgetKpiRemainingSub');

        if (kpiPeriodLabel) {
        kpiPeriodLabel.textContent = `Tổng ngân sách (${periodLabel})`;
        }
        if (kpiTotalVal) {
        kpiTotalVal.textContent = GeneralUtils.formatCurrencyVND(report.effectiveTotalLimit);
        }
        if (kpiTotalSub) {
        kpiTotalSub.textContent = report.effectiveSourceLabel;
        }

        if (kpiSpentVal) {
        kpiSpentVal.textContent = GeneralUtils.formatCurrencyVND(report.totalMonthlySpent);
        }
        if (kpiSpentSub) {
        kpiSpentSub.textContent = `${report.monthlyExpenseCount} giao dịch chi tiêu trong ${periodLabel}`;
        }

        if (report.effectiveTotalLimit > 0) {
        const rem = report.effectiveStatus.remaining;
        if (rem >= 0) {
        if (kpiRemLabel) kpiRemLabel.textContent = 'Ngân sách còn lại';
        if (kpiRemVal) {
        kpiRemVal.textContent = GeneralUtils.formatCurrencyVND(rem);
        kpiRemVal.className = 'kpi-card__value kpi-card__value--income';
        }
        } else {
        if (kpiRemLabel) kpiRemLabel.textContent = 'Số tiền vượt ngân sách';
        if (kpiRemVal) {
        kpiRemVal.textContent = `-${GeneralUtils.formatCurrencyVND(Math.abs(rem))}`;
        kpiRemVal.className = 'kpi-card__value kpi-card__value--expense';
        }
        }
        if (kpiRemSub) {
        kpiRemSub.textContent = `Tiến độ sử dụng: ${report.effectiveStatus.displayPercent}% (${report.effectiveStatus.statusText})`;
        }
        } else {
        if (kpiRemLabel) kpiRemLabel.textContent = 'Ngân sách còn lại';
        if (kpiRemVal) {
        kpiRemVal.textContent = '0 ₫';
        kpiRemVal.className = 'kpi-card__value';
        }
        if (kpiRemSub) {
        kpiRemSub.textContent = 'Hãy thiết lập ngân sách để tính số tiền còn lại';
        }
        }
        },

        renderAlertBanners(report) {
        const alertContainer = GeneralUtils.qs('#budgetAlertsContainer');
        if (!alertContainer) return;

        if (!report.alerts || report.alerts.length === 0) {
        alertContainer.innerHTML = '';
        alertContainer.classList.add('is-hidden');
        return;
        }

        alertContainer.classList.remove('is-hidden');
        alertContainer.innerHTML = report.alerts
        .map((alert) => {
        const isDanger =
        alert.level === 'exceeded' || alert.level === 'limit-100';
        const bannerClass = isDanger
        ? 'budget-alert-banner--danger'
        : 'budget-alert-banner--warning';
        const iconName = isDanger ? 'alert-octagon' : 'alert-triangle';

        let detailText = '';
        if (alert.level === 'exceeded') {
        detailText = `${alert.title} đã vượt hạn mức ${GeneralUtils.formatCurrencyVND(
        Math.abs(alert.remaining)
        )} (${alert.displayPercent}% – Đã chi ${GeneralUtils.formatCurrencyVND(
        alert.spent
        )} / ${GeneralUtils.formatCurrencyVND(alert.limit)}).`;
        } else if (alert.level === 'limit-100') {
        detailText = `${alert.title} đã sử dụng chạm mốc 100% hạn mức (${GeneralUtils.formatCurrencyVND(
        alert.spent
        )} / ${GeneralUtils.formatCurrencyVND(alert.limit)}).`;
        } else {
        detailText = `${alert.title} đã sử dụng ${alert.displayPercent}% hạn mức (≥ 80%). Số tiền còn lại: ${GeneralUtils.formatCurrencyVND(
        alert.remaining
        )}.`;
        }

        return `
        <div class="budget-alert-banner ${bannerClass}" role="alert">
        <div class="budget-alert-banner__left">
        <i data-lucide="${iconName}" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
        <span>${GeneralUtils.escapeHTML(detailText)}</span>
        </div>
        </div>
        `;
        })
        .join('');
        },

        renderBudgetCards(report) {
        const overallContainer = GeneralUtils.qs('#budgetOverallSection');
        const categoryListEl = GeneralUtils.qs('#budgetCategoryList');
        const emptyStateEl = GeneralUtils.qs('#budgetEmptyState');
        const countBadgeEl = GeneralUtils.qs('#budgetCategoryCountBadge');

        if (countBadgeEl) {
        countBadgeEl.textContent = `${report.categoryItems.length} danh mục`;
        }

        if (overallContainer) {
        if (report.overallItem) {
        overallContainer.innerHTML = this.buildBudgetItemCardHTML(
        report.overallItem,
        true
        );
        } else {
        overallContainer.innerHTML = '';
        }
        }

        if (categoryListEl && emptyStateEl) {
        if (report.categoryItems.length === 0) {
        categoryListEl.innerHTML = '';
        emptyStateEl.classList.remove('is-hidden');

        const emptyTitle = GeneralUtils.qs('#budgetEmptyTitle');
        const emptyDesc = GeneralUtils.qs('#budgetEmptyDesc');
        if (report.overallItem) {
        if (emptyTitle) {
        emptyTitle.textContent = 'Chưa thiết lập ngân sách riêng cho từng danh mục';
        }
        if (emptyDesc) {
        emptyDesc.textContent =
        'Bạn đã có ngân sách tổng tháng ở phía trên. Nếu muốn kiểm soát chi tiết từng khoản (như Ăn uống, Tiền trọ...), hãy chọn "Theo danh mục chi" ở biểu mẫu bên trái.';
        }
        } else {
        if (emptyTitle) {
        emptyTitle.textContent = `Chưa có ngân sách cho ${DateTimeUtils.formatPeriodLabelVi(
        report.periodKey
        )}`;
        }
        if (emptyDesc) {
        emptyDesc.textContent =
        'Bạn chưa thiết lập ngân sách tổng hoặc ngân sách danh mục nào cho tháng đang chọn. Hãy sử dụng biểu mẫu bên trái để bắt đầu kiểm soát chi tiêu.';
        }
        }
        } else {
        emptyStateEl.classList.add('is-hidden');
        categoryListEl.innerHTML = report.categoryItems
        .map((item) => this.buildBudgetItemCardHTML(item, false))
        .join('');
        }
        }
        },

        buildBudgetItemCardHTML(item, isOverall = false) {
        const { budget, spent, limit, status } = item;
        const title = isOverall
        ? `Ngân sách tổng – ${DateTimeUtils.formatPeriodLabelVi(budget.periodKey)}`
        : budget.category;
        const subtitle = isOverall
        ? 'Áp dụng cho toàn bộ giao dịch Chi tiêu (Expense) trong tháng'
        : `Hạn mức danh mục chi tiêu • ${DateTimeUtils.formatPeriodLabelVi(budget.periodKey)}`;

        const remainingLabel = status.remaining >= 0 ? 'Còn lại' : 'Vượt hạn mức';
        const remainingClass =
        status.remaining >= 0
        ? 'budget-metric__val--remaining-pos'
        : 'budget-metric__val--remaining-neg';
        const remainingText =
        status.remaining >= 0
        ? GeneralUtils.formatCurrencyVND(status.remaining)
        : `-${GeneralUtils.formatCurrencyVND(Math.abs(status.remaining))}`;

        const noteHTML = budget.note
        ? `<span>Ghi chú: ${GeneralUtils.escapeHTML(budget.note)}</span>`
        : `<span>Tiến độ thực tế: ${status.displayPercent}%</span>`;

        return `
        <article class="budget-item-card ${isOverall ? 'budget-item-card--overall' : ''}" data-budget-id="${GeneralUtils.escapeHTML(budget.id)}">
        <div class="budget-item-card__top">
        <div class="budget-item-card__title-group">
        <div class="budget-item-card__title">
        <i data-lucide="${isOverall ? 'shield' : 'tag'}" style="width: 16px; height: 16px; color: var(--accent-primary);"></i>
        <span>${GeneralUtils.escapeHTML(title)}</span>
        <span class="budget-status-badge ${status.badgeClass}">
        ${GeneralUtils.escapeHTML(status.statusText)}
        </span>
        </div>
        <span class="budget-item-card__subtitle">${GeneralUtils.escapeHTML(subtitle)}</span>
        </div>

        <div class="tx-item__actions">
        <button
        type="button"
        class="btn-icon"
        data-budget-action="edit"
        data-id="${GeneralUtils.escapeHTML(budget.id)}"
        title="Chỉnh sửa ngân sách"
        aria-label="Chỉnh sửa ngân sách"
        >
        <i data-lucide="pencil" style="width: 16px; height: 16px;"></i>
        </button>
        <button
        type="button"
        class="btn-icon btn-icon--danger"
        data-budget-action="delete"
        data-id="${GeneralUtils.escapeHTML(budget.id)}"
        title="Xóa ngân sách"
        aria-label="Xóa ngân sách"
        >
        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
        </button>
        </div>
        </div>

        <div class="budget-item-card__metrics">
        <div class="budget-metric">
        <span class="budget-metric__label">Ngân sách đặt ra</span>
        <span class="budget-metric__val">${GeneralUtils.formatCurrencyVND(limit)}</span>
        </div>
        <div class="budget-metric">
        <span class="budget-metric__label">Đã chi tiêu</span>
        <span class="budget-metric__val budget-metric__val--spent">${GeneralUtils.formatCurrencyVND(spent)}</span>
        </div>
        <div class="budget-metric">
        <span class="budget-metric__label">${remainingLabel}</span>
        <span class="budget-metric__val ${remainingClass}">${remainingText}</span>
        </div>
        </div>

        <div class="budget-progress-wrapper">
        <div class="budget-progress-track" role="progressbar" aria-valuenow="${Math.round(status.displayPercent)}" aria-valuemin="0" aria-valuemax="100">
        <div class="budget-progress-fill ${status.barClass}" style="width: ${status.barPercent}%;"></div>
        </div>
        <div class="budget-item-card__footer">
        ${noteHTML}
        <span><strong>${status.displayPercent}%</strong> đã sử dụng</span>
        </div>
        </div>
        </article>
        `;
        },

        renderUnbudgetedExpenses(report) {
        const cardEl = GeneralUtils.qs('#unbudgetedExpensesCard');
        const listEl = GeneralUtils.qs('#unbudgetedExpensesList');
        if (!cardEl || !listEl) return;

        if (!report.unbudgetedExpenses || report.unbudgetedExpenses.length === 0) {
        cardEl.classList.add('is-hidden');
        listEl.innerHTML = '';
        return;
        }

        cardEl.classList.remove('is-hidden');
        listEl.innerHTML = report.unbudgetedExpenses
        .map(
        (item) => `
        <div class="tx-item" style="padding: var(--space-3) var(--space-4);">
        <div class="tx-item__left">
        <div class="tx-badge-icon tx-badge-icon--expense" style="width: 36px; height: 36px;">
        <i data-lucide="alert-circle" style="width: 16px; height: 16px;"></i>
        </div>
        <div class="tx-item__info">
        <span class="tx-item__category">${GeneralUtils.escapeHTML(item.category)}</span>
        <div class="tx-item__date">Đã phát sinh chi tiêu trong tháng nhưng chưa đặt ngân sách danh mục riêng</div>
        </div>
        </div>
        <div class="tx-item__right">
        <span class="tx-item__amount tx-item__amount--expense">
        -${GeneralUtils.formatCurrencyVND(item.spent)}
        </span>
        <button
        type="button"
        class="btn-action"
        data-quick-budget-cat="${GeneralUtils.escapeHTML(item.category)}"
        style="padding: 4px 10px; font-size: var(--fs-xs);"
        >
        <i data-lucide="plus" style="width: 14px; height: 14px;"></i>
        <span>Đặt ngân sách</span>
        </button>
        </div>
        </div>
        `
        )
        .join('');
        },

        bindEvents() {
        const monthSelect = GeneralUtils.qs('#budgetMonthSelect');
        const yearSelect = GeneralUtils.qs('#budgetYearSelect');
        const prevBtn = GeneralUtils.qs('#budgetPrevMonthBtn');
        const nextBtn = GeneralUtils.qs('#budgetNextMonthBtn');
        const currentBtn = GeneralUtils.qs('#budgetCurrentMonthBtn');

        if (monthSelect) {
        monthSelect.addEventListener('change', () => {
        this.changePeriod(this.selectedYear, Number(monthSelect.value));
        });
        }

        if (yearSelect) {
        yearSelect.addEventListener('change', () => {
        this.changePeriod(Number(yearSelect.value), this.selectedMonth);
        });
        }

        if (prevBtn) {
        prevBtn.addEventListener('click', () => {
        this.changePeriod(this.selectedYear, this.selectedMonth - 1);
        });
        }

        if (nextBtn) {
        nextBtn.addEventListener('click', () => {
        this.changePeriod(this.selectedYear, this.selectedMonth + 1);
        });
        }

        if (currentBtn) {
        currentBtn.addEventListener('click', () => {
        const now = new Date();
        this.changePeriod(now.getFullYear(), now.getMonth() + 1);
        });
        }

        const historyPillsContainer = GeneralUtils.qs('#budgetHistoryPillsContainer');
        if (historyPillsContainer) {
        historyPillsContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('[data-period-jump]');
        if (!pill) return;
        const periodKey = pill.getAttribute('data-period-jump');
        if (periodKey && /^\d{4}-\d{2}$/.test(periodKey)) {
        const [y, m] = periodKey.split('-');
        this.changePeriod(Number(y), Number(m));
        }
        });
        }

        const scopeBtns = GeneralUtils.qsa('[data-budget-scope]');
        scopeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
        const scope = btn.getAttribute('data-budget-scope');
        this.setFormScope(scope);
        });
        });

        const budgetForm = GeneralUtils.qs('#budgetForm');
        if (budgetForm) {
        budgetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errorEl = GeneralUtils.qs('#budgetFormError');
        if (errorEl) errorEl.classList.add('is-hidden');

        const scope = GeneralUtils.qs('#budgetScopeInput')?.value || 'overall';
        const payload = {
        year: this.selectedYear,
        month: this.selectedMonth,
        scope,
        category:
        scope === 'category'
        ? GeneralUtils.qs('#budgetCategorySelect')?.value
        : 'ALL',
        amount: GeneralUtils.qs('#budgetAmountInput')?.value,
        note: GeneralUtils.qs('#budgetNoteInput')?.value
        };

        try {
        const result = await BudgetService.saveBudget(
        payload,
        this.editingBudgetId
        );
        if (result.mode === 'updated') {
        NotificationManager.showToast(
        'Đã cập nhật hạn mức ngân sách thành công!',
        'success'
        );
        } else {
        NotificationManager.showToast(
        'Đã tạo ngân sách mới thành công!',
        'success'
        );
        }

        this.resetBudgetForm();
        await this.reloadBudgetsAndRender(FinancialUI.allTransactions);
        } catch (err) {
        if (errorEl) {
        errorEl.textContent = err.message || 'Dữ liệu ngân sách không hợp lệ.';
        errorEl.classList.remove('is-hidden');
        }
        }
        });
        }

        const cancelEditBtn = GeneralUtils.qs('#budgetCancelEditBtn');
        if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
        this.resetBudgetForm();
        });
        }

        const budgetPage = GeneralUtils.qs('#page-budget');
        if (budgetPage) {
        budgetPage.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-budget-action]');
        if (actionBtn) {
        const action = actionBtn.getAttribute('data-budget-action');
        const id = actionBtn.getAttribute('data-id');
        if (!id) return;

        if (action === 'edit') {
        this.startEditingBudget(id);
        } else if (action === 'delete') {
        const target = this.allBudgets.find((b) => b.id === id);
        const label = target
        ? target.scope === 'overall'
        ? `Ngân sách tổng (${DateTimeUtils.formatPeriodLabelVi(target.periodKey)})`
        : `Ngân sách danh mục "${target.category}" (${DateTimeUtils.formatPeriodLabelVi(target.periodKey)})`
        : 'ngân sách này';

        NotificationManager.openConfirmModal(
        id,
        `Bạn có chắc chắn muốn xóa ${label} không? Các giao dịch chi tiêu vẫn được giữ nguyên.`,
        async (confirmedId) => {
        try {
        await BudgetService.removeBudget(confirmedId);
        if (this.editingBudgetId === confirmedId) {
        this.resetBudgetForm();
        }
        await this.reloadBudgetsAndRender(FinancialUI.allTransactions);
        NotificationManager.showToast('Đã xóa ngân sách.', 'info');
        } catch (err) {
        NotificationManager.showToast(
        err.message || 'Không thể xóa ngân sách.',
        'error'
        );
        }
        },
        'Xác nhận xóa ngân sách'
        );
        }
        return;
        }

        const quickCatBtn = e.target.closest('[data-quick-budget-cat]');
        if (quickCatBtn) {
        const cat = quickCatBtn.getAttribute('data-quick-budget-cat');
        if (cat) {
        this.resetBudgetForm();
        this.setFormScope('category', cat);
        const amountInput = GeneralUtils.qs('#budgetAmountInput');
        if (amountInput) {
        amountInput.focus();
        amountInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        }
        }
        });
        }
        }
        };

        /* ========================================================================
        10. UI CONTROLLER: TRANSACTIONS & DASHBOARD SYNC (PHASE 2 + 3 + 4 HOOKS)
        ======================================================================== */
        /* ========================================================================
        9B. SAVINGS SERVICE & AI ASSISTANT SERVICE (PHASE 5)
        ======================================================================== */
        const SavingsService = {
        VALID_ICONS: [
        'piggy-bank', 'laptop', 'graduation-cap', 'book-open',
        'smartphone', 'shield', 'plane', 'gift'
        ],

        validateGoalInput(payload) {
        const errors = [];
        const name = String(payload.name || '').trim();
        if (!name) errors.push('Vui lòng nhập tên mục tiêu tiết kiệm.');
        if (name.length > 100) errors.push('Tên mục tiêu không quá 100 ký tự.');

        const targetAmount = Number(payload.targetAmount);
        if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
        errors.push('Số tiền mục tiêu phải là số dương lớn hơn 0.');
        }

        const startDate = String(payload.startDate || '').trim();
        const targetDate = String(payload.targetDate || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        errors.push('Ngày bắt đầu không hợp lệ.');
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        errors.push('Hạn hoàn thành không hợp lệ.');
        }
        if (startDate && targetDate && targetDate < startDate) {
        errors.push('Hạn hoàn thành phải sau hoặc bằng ngày bắt đầu.');
        }

        const icon = this.VALID_ICONS.includes(payload.icon) ? payload.icon : 'piggy-bank';
        const description = String(payload.description || '').trim();

        return {
        isValid: errors.length === 0,
        errors,
        sanitized: {
        name,
        targetAmount: Math.round(targetAmount),
        startDate,
        targetDate,
        icon,
        description
        }
        };
        },

        async saveGoal(payload, editingId = null) {
        const check = this.validateGoalInput(payload);
        if (!check.isValid) throw new Error(check.errors[0]);

        const nowISO = new Date().toISOString();

        if (editingId) {
        const existing = await Database.getSavingsGoalById(editingId);
        if (!existing) throw new Error('Không tìm thấy mục tiêu cần chỉnh sửa.');

        const currentAmt = Number(existing.currentAmount) || 0;
        const updatedStatus =
        existing.status === 'completed' || currentAmt >= check.sanitized.targetAmount
        ? 'completed'
        : 'active';

        const updated = {
        ...existing,
        ...check.sanitized,
        currentAmount: currentAmt,
        status: updatedStatus,
        updatedAt: nowISO
        };
        await Database.putSavingsGoal(updated);
        return { record: updated, mode: 'updated' };
        }

        // Quy tắc bắt buộc: Tạo mới mục tiêu НЕ tự động cộng tiền (currentAmount = 0)
        const created = {
        id: GeneralUtils.generateUniqueId('sg'),
        ...check.sanitized,
        currentAmount: 0,
        status: 'active',
        createdAt: nowISO,
        updatedAt: nowISO
        };
        await Database.putSavingsGoal(created);
        return { record: created, mode: 'created' };
        },

        async deleteGoalAndHistory(goalId) {
        if (!goalId) throw new Error('Mã mục tiêu không hợp lệ.');
        await Database.deleteContributionsByGoalId(goalId);
        await Database.deleteSavingsGoal(goalId);
        return true;
        },

        async toggleGoalCompleted(goalId) {
        const goal = await Database.getSavingsGoalById(goalId);
        if (!goal) throw new Error('Không tìm thấy mục tiêu.');

        const nextStatus = goal.status === 'completed' ? 'active' : 'completed';
        const updated = {
        ...goal,
        status: nextStatus,
        updatedAt: new Date().toISOString()
        };
        await Database.putSavingsGoal(updated);
        return updated;
        },

        /**
        * Nạp tiền (deposit) hoặc Rút tiền (withdraw) khỏi mục tiêu.
        * QUY TẮC TÀI CHÍNH: Chỉ cập nhật savingsGoals & savingsContributions,
        * KHÔNG tạo giao dịch income/expense mới trong bảng transactions.
        */
        async recordContribution(payload) {
        const goalId = String(payload.goalId || '').trim();
        const goal = await Database.getSavingsGoalById(goalId);
        if (!goal) throw new Error('Mục tiêu tiết kiệm không tồn tại.');

        const type = payload.type === 'withdraw' ? 'withdraw' : 'deposit';
        const amount = Math.round(Number(payload.amount));
        if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Số tiền đóng góp/rút phải lớn hơn 0.');
        }

        const currentSaved = Number(goal.currentAmount) || 0;
        if (type === 'withdraw' && amount > currentSaved) {
        throw new Error(
        `Không thể rút vượt quá số tiền hiện có trong mục tiêu (${GeneralUtils.formatCurrencyVND(currentSaved)}).`
        );
        }

        const date = String(payload.date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('Ngày thực hiện không hợp lệ.');
        }

        const note = String(payload.note || '').trim();
        const nowISO = new Date().toISOString();

        const contributionRecord = {
        id: GeneralUtils.generateUniqueId('sc'),
        goalId: goal.id,
        type,
        amount,
        date,
        note,
        createdAt: nowISO
        };

        const newCurrentAmount =
        type === 'deposit' ? currentSaved + amount : currentSaved - amount;
        const nextStatus =
        newCurrentAmount >= goal.targetAmount ? 'completed' : goal.status;

        const updatedGoal = {
        ...goal,
        currentAmount: newCurrentAmount,
        status: nextStatus,
        updatedAt: nowISO
        };

        await Database.putSavingsContribution(contributionRecord);
        await Database.putSavingsGoal(updatedGoal);

        return { goal: updatedGoal, contribution: contributionRecord };
        },

        evaluateGoalMetrics(goal) {
        const target = Math.max(1, Number(goal.targetAmount) || 1);
        const current = Math.max(0, Number(goal.currentAmount) || 0);
        const missing = Math.max(0, target - current);
        const rawPct = (current / target) * 100;
        const displayPct = Math.round(rawPct * 10) / 10;
        const barPct = Math.min(100, Math.max(0, rawPct));

        // Tính số ngày còn lại từ hôm nay tới targetDate
        const todayISO = DateTimeUtils.formatLocalISODate(new Date());
        const [ty, tm, td] = todayISO.split('-').map(Number);
        const todayMs = new Date(ty, tm - 1, td).getTime();

        let daysRemaining = null;
        let timeText = '';
        if (goal.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(goal.targetDate)) {
        const [gy, gm, gd] = goal.targetDate.split('-').map(Number);
        const targetMs = new Date(gy, gm - 1, gd).getTime();
        daysRemaining = Math.ceil((targetMs - todayMs) / (1000 * 60 * 60 * 24));

        if (goal.status === 'completed' || missing === 0) {
        timeText = 'Đã hoàn thành mục tiêu';
        } else if (daysRemaining > 0) {
        timeText = `Còn ${daysRemaining} ngày (Hạn: ${DateTimeUtils.formatDisplayDateVi(goal.targetDate)})`;
        } else if (daysRemaining === 0) {
        timeText = 'Đến hạn hôm nay';
        } else {
        timeText = `Đã quá hạn ${Math.abs(daysRemaining)} ngày`;
        }
        }

        return {
        target,
        current,
        missing,
        displayPct,
        barPct,
        daysRemaining,
        timeText,
        isCompleted: goal.status === 'completed' || missing === 0
        };
        }
        };

        const AIAssistantService = {
        buildDiagnosticInsights(allTransactions = [], allBudgets = [], allGoals = [], allContributions = []) {
        const insights = [];
        const summary = TransactionService.calculateSummary(allTransactions);
        const now = new Date();
        const currentPeriodKey = DateTimeUtils.formatPeriodKey(now.getFullYear(), now.getMonth() + 1);

        // 1. Phân tích thu nhập, chi tiêu và số dư
        if (summary.incomeCount === 0 && summary.expenseCount === 0) {
        insights.push({
        level: 'primary',
        icon: 'info',
        title: 'Chưa có dữ liệu giao dịch Thu – Chi',
        desc: 'Cơ sở dữ liệu hiện chưa có giao dịch Thu nhập hoặc Chi tiêu nào. Hãy thêm giao dịch ở trang Thu chi để Trợ lý AI phân tích dòng tiền chính xác.'
        });
        } else {
        const savingsRate =
        summary.totalIncome > 0
        ? Math.round(((summary.totalIncome - summary.totalExpense) / summary.totalIncome) * 1000) / 10
        : 0;
        const level = summary.balance > 0 ? (savingsRate >= 20 ? 'success' : 'primary') : 'danger';

        insights.push({
        level,
        icon: 'activity',
        title: `Sức khỏe dòng tiền: Tích lũy ròng ${savingsRate}%`,
        desc: `Tổng thu: ${GeneralUtils.formatCurrencyVND(summary.totalIncome)} | Tổng chi: ${GeneralUtils.formatCurrencyVND(summary.totalExpense)} | Số dư thực tế: ${GeneralUtils.formatCurrencyVND(summary.balance)}. ${
        savingsRate >= 20
        ? 'Bạn đang duy trì tỷ lệ tiết kiệm rất tốt (≥ 20% thu nhập).'
        : summary.balance >= 0
        ? 'Nên hướng tới mục tiêu giữ lại tối thiểu 15% - 20% tổng thu nhập mỗi tháng.'
        : 'Cảnh báo: Tổng chi tiêu đang vượt quá tổng thu nhập thực tế.'
        }`
        });
        }

        // 2. Nhận xét thói quen chi tiêu
        const catReport = AnalyticsService.analyzeExpenseByCategory(allTransactions);
        if (catReport.largestCategory) {
        const top = catReport.largestCategory;
        insights.push({
        level: top.sharePercent >= 50 ? 'warning' : 'primary',
        icon: 'pie-chart',
        title: `Thói quen chi tiêu: Tập trung vào "${top.category}"`,
        desc: `Danh mục "${top.category}" chiếm tỷ trọng cao nhất (${top.sharePercent}% tổng chi tiêu, tương đương ${GeneralUtils.formatCurrencyVND(top.amount)} qua ${top.count} giao dịch). ${
        top.sharePercent >= 50
        ? 'Một danh mục đang chiếm từ 50% tổng chi trở lên, bạn nên rà soát để tránh mất cân đối.'
        : 'Cơ cấu chi tiêu đang được phân bổ tương đối hợp lý.'
        }`
        });
        }

        // 3. Đối chiếu với Ngân sách tháng hiện tại
        const monthlyBudgetReport = BudgetService.buildMonthlyBudgetReport(
        currentPeriodKey,
        allBudgets,
        allTransactions
        );
        if (monthlyBudgetReport.effectiveTotalLimit > 0) {
        const st = monthlyBudgetReport.effectiveStatus;
        insights.push({
        level: st.level === 'safe' ? 'success' : st.level === 'warning-80' ? 'warning' : 'danger',
        icon: 'shield-check',
        title: `Gợi ý theo Ngân sách ${DateTimeUtils.formatPeriodLabelVi(currentPeriodKey)}`,
        desc: `Bạn đã chi ${GeneralUtils.formatCurrencyVND(monthlyBudgetReport.totalMonthlySpent)} / ${GeneralUtils.formatCurrencyVND(monthlyBudgetReport.effectiveTotalLimit)} (${st.displayPercent}%). ${
        st.remaining > 0
        ? `Hạn mức còn lại trong tháng là ${GeneralUtils.formatCurrencyVND(st.remaining)}. Bạn có thể trích một phần số dư này vào Quỹ tiết kiệm.`
        : 'Bạn đã chạm hoặc vượt ngân sách tháng này. Hãy ưu tiên cắt giảm các khoản chi không thiết yếu.'
        }`
        });
        } else {
        insights.push({
        level: 'warning',
        icon: 'sliders-horizontal',
        title: `Chưa thiết lập Ngân sách cho ${DateTimeUtils.formatPeriodLabelVi(currentPeriodKey)}`,
        desc: 'Bạn nên đặt hạn mức ngân sách tháng tại trang Ngân sách (Budget) để AI đối chiếu tốc độ chi tiêu hàng ngày.'
        });
        }

        // 4. Ước tính thời gian đạt mục tiêu tiết kiệm (ETA)
        const activeGoals = allGoals.filter((g) => g.status !== 'completed' && (Number(g.currentAmount) || 0) < (Number(g.targetAmount) || 0));
        if (activeGoals.length > 0) {
        const monthlyRows = AnalyticsService.buildMonthlyComparison(allTransactions);
        const avgMonthlySurplus =
        monthlyRows.length > 0
        ? Math.max(0, Math.round(monthlyRows.reduce((acc, r) => acc + (r.net > 0 ? r.net : 0), 0) / monthlyRows.length))
        : 0;

        const firstGoal = activeGoals[0];
        const missing = Math.max(0, Number(firstGoal.targetAmount) - (Number(firstGoal.currentAmount) || 0));

        let etaText = '';
        if (avgMonthlySurplus > 0) {
        const monthsNeeded = Math.ceil(missing / avgMonthlySurplus);
        etaText = `Với mức thặng dư trung bình khoảng ${GeneralUtils.formatCurrencyVND(avgMonthlySurplus)}/tháng, ước tính bạn cần khoảng ${monthsNeeded} tháng để tích lũy đủ ${GeneralUtils.formatCurrencyVND(missing)} còn thiếu cho mục tiêu "${firstGoal.name}".`;
        } else {
        etaText = `Mục tiêu "${firstGoal.name}" còn thiếu ${GeneralUtils.formatCurrencyVND(missing)}. Hiện chưa có thặng dư dương trung bình hàng tháng để ước tính số tháng tự động.`;
        }

        insights.push({
        level: 'primary',
        icon: 'clock',
        title: `Ước tính lộ trình mục tiêu (${activeGoals.length} mục tiêu đang mở)`,
        desc: etaText
        });
        }

        return insights;
        },

        answerUserQuestion(questionText, allTransactions = [], allBudgets = [], allGoals = [], allContributions = []) {
        const q = String(questionText || '').trim().toLowerCase();
        const summary = TransactionService.calculateSummary(allTransactions);
        const totalSavedInGoals = allGoals.reduce((sum, g) => sum + (Number(g.currentAmount) || 0), 0);
        const unallocatedBalance = summary.balance - totalSavedInGoals;

        if (allTransactions.length === 0 && allGoals.length === 0) {
        return 'Hiện tại cơ sở dữ liệu của bạn chưa có giao dịch hay mục tiêu tiết kiệm nào. Hãy thêm dữ liệu thực tế ở trang Thu chi hoặc tạo mục tiêu tiết kiệm để mình tính toán chính xác cho bạn nhé!';
        }

        if (q.includes('thu chi') || q.includes('số dư') || q.includes('tổng quan') || q === 'summary') {
        return `Dựa trên dữ liệu thực tế của bạn:\n• Tổng thu nhập: ${GeneralUtils.formatCurrencyVND(summary.totalIncome)} (${summary.incomeCount} giao dịch)\n• Tổng chi tiêu: ${GeneralUtils.formatCurrencyVND(summary.totalExpense)} (${summary.expenseCount} giao dịch)\n• Số dư thực tế (Thu - Chi): ${GeneralUtils.formatCurrencyVND(summary.balance)}\n• Đã phân bổ vào Quỹ tiết kiệm: ${GeneralUtils.formatCurrencyVND(totalSavedInGoals)}\n• Số dư khả dụng ngoài quỹ: ${GeneralUtils.formatCurrencyVND(unallocatedBalance)}.`;
        }

        if (q.includes('thói quen') || q.includes('danh mục') || q.includes('nhiều nhất') || q.includes('lớn nhất') || q === 'habit') {
        const catReport = AnalyticsService.analyzeExpenseByCategory(allTransactions);
        if (!catReport.largestCategory) {
        return 'Bạn chưa có giao dịch Chi tiêu (Expense) nào nên chưa xác định được danh mục chi lớn nhất.';
        }
        const top = catReport.largestCategory;
        const second = catReport.breakdown[1];
        return `Phân tích thói quen chi tiêu thực tế:\n• Danh mục chi lớn nhất là "${top.category}" với ${GeneralUtils.formatCurrencyVND(top.amount)} (${top.sharePercent}% tổng chi, ${top.count} lần giao dịch).${
        second ? `\n• Đứng thứ hai là "${second.category}" với ${GeneralUtils.formatCurrencyVND(second.amount)} (${second.sharePercent}%).` : ''
        }\n• Lời khuyên: Nếu bạn giảm 10% chi tiêu ở mục "${top.category}", bạn sẽ tiết kiệm thêm được ${GeneralUtils.formatCurrencyVND(Math.round(top.amount * 0.1))}.`;
        }

        if (q.includes('ngân sách') || q.includes('gợi ý') || q === 'budget-advice') {
        const now = new Date();
        const pKey = DateTimeUtils.formatPeriodKey(now.getFullYear(), now.getMonth() + 1);
        const rep = BudgetService.buildMonthlyBudgetReport(pKey, allBudgets, allTransactions);
        if (rep.effectiveTotalLimit <= 0) {
        return `Trong ${DateTimeUtils.formatPeriodLabelVi(pKey)}, bạn đã chi ${GeneralUtils.formatCurrencyVND(rep.totalMonthlySpent)} nhưng chưa đặt hạn mức ngân sách. Hãy sang trang Ngân sách để đặt trần chi tiêu giúp kiểm soát dòng tiền tốt hơn.`;
        }
        return `Tình hình Ngân sách ${DateTimeUtils.formatPeriodLabelVi(pKey)}:\n• Hạn mức: ${GeneralUtils.formatCurrencyVND(rep.effectiveTotalLimit)}\n• Đã chi: ${GeneralUtils.formatCurrencyVND(rep.totalMonthlySpent)} (${rep.effectiveStatus.displayPercent}%)\n• Trạng thái: ${rep.effectiveStatus.statusText}.`;
        }

        if (q.includes('bao lâu') || q.includes('mục tiêu') || q.includes('tiết kiệm') || q === 'goal-eta') {
        if (allGoals.length === 0) {
        return 'Bạn chưa tạo mục tiêu tiết kiệm nào. Hãy tạo mục tiêu ở tab "Quỹ mục tiêu tiết kiệm" để mình tính thời gian hoàn thành dự kiến nhé.';
        }
        const monthlyRows = AnalyticsService.buildMonthlyComparison(allTransactions);
        const avgNet =
        monthlyRows.length > 0
        ? Math.max(0, Math.round(monthlyRows.reduce((s, r) => s + Math.max(0, r.net), 0) / monthlyRows.length))
        : 0;

        const lines = allGoals.map((g) => {
        const m = SavingsService.evaluateGoalMetrics(g);
        if (m.isCompleted) return `• "${g.name}": Đã hoàn thành 100% (${GeneralUtils.formatCurrencyVND(m.current)}).`;
        const eta =
        avgNet > 0
        ? `Cần khoảng ${Math.ceil(m.missing / avgNet)} tháng (theo mức dư TB ${GeneralUtils.formatCurrencyVND(avgNet)}/tháng)`
        : m.timeText;
        return `• "${g.name}": Đạt ${m.displayPct}%, còn thiếu ${GeneralUtils.formatCurrencyVND(m.missing)} — ${eta}.`;
        });

        return `Tiến độ & Ước tính các mục tiêu tiết kiệm của bạn:\n${lines.join('\n')}`;
        }

        return `Báo cáo nhanh từ dữ liệu thật của bạn:\n• Số dư thực tế (Thu - Chi): ${GeneralUtils.formatCurrencyVND(summary.balance)}\n• Tổng quỹ tiết kiệm đang giữ: ${GeneralUtils.formatCurrencyVND(totalSavedInGoals)} (${allGoals.length} mục tiêu, ${allContributions.length} lượt nạp/rút)\n• Số dư khả dụng ngoài quỹ: ${GeneralUtils.formatCurrencyVND(unallocatedBalance)}.\nBạn có thể nhấn vào các nút gợi ý phía trên để xem phân tích sâu từng mảng!`;
        }
        };

        const SavingsAiUI = {
        allGoals: [],
        allContributions: [],
        activeTab: 'goals',
        goalFilter: 'all',
        editingGoalId: null,
        openContributeGoalId: null,
        openHistoryGoalId: null,

        async init() {
        this.resetGoalForm();
        this.bindEvents();
        },

        resetGoalForm() {
        this.editingGoalId = null;
        const todayISO = DateTimeUtils.formatLocalISODate(new Date());
        const nextMonthDate = new Date();
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 3);
        const defaultTargetISO = DateTimeUtils.formatLocalISODate(nextMonthDate);

        const idInput = GeneralUtils.qs('#sgIdInput');
        const nameInput = GeneralUtils.qs('#sgNameInput');
        const targetAmtInput = GeneralUtils.qs('#sgTargetAmountInput');
        const iconSelect = GeneralUtils.qs('#sgIconSelect');
        const startInput = GeneralUtils.qs('#sgStartDateInput');
        const targetDateInput = GeneralUtils.qs('#sgTargetDateInput');
        const descInput = GeneralUtils.qs('#sgDescInput');
        const titleText = GeneralUtils.qs('#savingsFormTitleText');
        const submitText = GeneralUtils.qs('#sgSubmitBtnText');
        const cancelBtn = GeneralUtils.qs('#sgCancelEditBtn');
        const errEl = GeneralUtils.qs('#sgFormError');

        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
        if (targetAmtInput) targetAmtInput.value = '';
        if (iconSelect) iconSelect.value = 'piggy-bank';
        if (startInput) startInput.value = todayISO;
        if (targetDateInput) targetDateInput.value = defaultTargetISO;
        if (descInput) descInput.value = '';
        if (titleText) titleText.textContent = 'Tạo mục tiêu tiết kiệm';
        if (submitText) submitText.textContent = 'Lưu mục tiêu';
        if (cancelBtn) cancelBtn.classList.add('is-hidden');
        if (errEl) {
        errEl.textContent = '';
        errEl.classList.add('is-hidden');
        }
        },

        startEditingGoal(goalId) {
        const goal = this.allGoals.find((g) => g.id === goalId);
        if (!goal) return;

        this.editingGoalId = goal.id;
        const idInput = GeneralUtils.qs('#sgIdInput');
        const nameInput = GeneralUtils.qs('#sgNameInput');
        const targetAmtInput = GeneralUtils.qs('#sgTargetAmountInput');
        const iconSelect = GeneralUtils.qs('#sgIconSelect');
        const startInput = GeneralUtils.qs('#sgStartDateInput');
        const targetDateInput = GeneralUtils.qs('#sgTargetDateInput');
        const descInput = GeneralUtils.qs('#sgDescInput');
        const titleText = GeneralUtils.qs('#savingsFormTitleText');
        const submitText = GeneralUtils.qs('#sgSubmitBtnText');
        const cancelBtn = GeneralUtils.qs('#sgCancelEditBtn');
        const errEl = GeneralUtils.qs('#sgFormError');

        if (idInput) idInput.value = goal.id;
        if (nameInput) nameInput.value = goal.name;
        if (targetAmtInput) targetAmtInput.value = goal.targetAmount;
        if (iconSelect) iconSelect.value = goal.icon || 'piggy-bank';
        if (startInput) startInput.value = goal.startDate;
        if (targetDateInput) targetDateInput.value = goal.targetDate;
        if (descInput) descInput.value = goal.description || '';
        if (titleText) titleText.textContent = 'Chỉnh sửa mục tiêu';
        if (submitText) submitText.textContent = 'Cập nhật mục tiêu';
        if (cancelBtn) cancelBtn.classList.remove('is-hidden');
        if (errEl) errEl.classList.add('is-hidden');

        const formEl = GeneralUtils.qs('#savingsGoalForm');
        if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        },

        async reloadAndRender(allTransactions = []) {
        try {
        this.allGoals = await Database.getAllSavingsGoals();
        this.allContributions = await Database.getAllSavingsContributions();
        } catch (err) {
        console.error('[SavingsAiUI] Lỗi tải dữ liệu mục tiêu tiết kiệm:', err);
        this.allGoals = [];
        this.allContributions = [];
        }

        this.renderKPIs(allTransactions);
        this.renderGoalsList();
        this.renderAiInsights(allTransactions);
        GeneralUtils.refreshIcons();
        },

        renderKPIs(allTransactions = []) {
        const txSummary = TransactionService.calculateSummary(allTransactions);
        let totalSaved = 0;
        let totalTarget = 0;
        let completedCount = 0;
        let activeCount = 0;

        this.allGoals.forEach((g) => {
        const cur = Number(g.currentAmount) || 0;
        const tar = Number(g.targetAmount) || 0;
        totalSaved += cur;
        totalTarget += tar;
        if (g.status === 'completed' || (tar > 0 && cur >= tar)) completedCount += 1;
        else activeCount += 1;
        });

        const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 1000) / 10 : 0;
        const unallocated = txSummary.balance - totalSaved;

        const savedEl = GeneralUtils.qs('#savKpiTotalSaved');
        const targetSubEl = GeneralUtils.qs('#savKpiTotalTargetSub');
        const unallocEl = GeneralUtils.qs('#savKpiUnallocatedBalance');
        const realBalSubEl = GeneralUtils.qs('#savKpiRealBalanceSub');
        const countsEl = GeneralUtils.qs('#savKpiGoalCounts');
        const compSubEl = GeneralUtils.qs('#savKpiCompletedSub');

        if (savedEl) savedEl.textContent = GeneralUtils.formatCurrencyVND(totalSaved);
        if (targetSubEl) {
        targetSubEl.textContent = `Tổng mục tiêu: ${GeneralUtils.formatCurrencyVND(totalTarget)} (${overallPct}%)`;
        }
        if (unallocEl) {
        unallocEl.textContent = GeneralUtils.formatCurrencyVND(unallocated);
        unallocEl.className =
        unallocated >= 0 ? 'kpi-card__value' : 'kpi-card__value kpi-card__value--expense';
        }
        if (realBalSubEl) {
        realBalSubEl.textContent = `Số dư thực tế (Thu - Chi): ${GeneralUtils.formatCurrencyVND(txSummary.balance)} (Theo dõi độc lập)`;
        }
        if (countsEl) countsEl.textContent = `${this.allGoals.length} mục tiêu`;
        if (compSubEl) {
        compSubEl.textContent = `${activeCount} đang thực hiện • ${completedCount} hoàn thành`;
        }
        },

        renderGoalsList() {
        const container = GeneralUtils.qs('#savingsGoalsListContainer');
        const emptyEl = GeneralUtils.qs('#savingsGoalsEmptyState');
        const countLabel = GeneralUtils.qs('#sgFilterCountLabel');
        if (!container || !emptyEl) return;

        const filtered = this.allGoals
        .filter((g) => {
        const isDone = g.status === 'completed' || (Number(g.currentAmount) || 0) >= (Number(g.targetAmount) || 1);
        if (this.goalFilter === 'active') return !isDone;
        if (this.goalFilter === 'completed') return isDone;
        return true;
        })
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

        if (countLabel) {
        countLabel.textContent = `Hiển thị ${filtered.length} / ${this.allGoals.length} mục tiêu`;
        }

        if (filtered.length === 0) {
        container.innerHTML = '';
        emptyEl.classList.remove('is-hidden');
        return;
        }

        emptyEl.classList.add('is-hidden');
        const todayISO = DateTimeUtils.formatLocalISODate(new Date());

        container.innerHTML = filtered
        .map((goal) => {
        const m = SavingsService.evaluateGoalMetrics(goal);
        const goalContribs = this.allContributions
        .filter((c) => c.goalId === goal.id)
        .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));

        const isContribOpen = this.openContributeGoalId === goal.id;
        const isHistoryOpen = this.openHistoryGoalId === goal.id;

        const badgeClass = m.isCompleted
        ? 'budget-status-badge--safe'
        : m.daysRemaining !== null && m.daysRemaining < 0
        ? 'budget-status-badge--danger'
        : 'budget-status-badge--primary';

        const statusLabel = m.isCompleted
        ? 'Đã hoàn thành'
        : m.daysRemaining !== null && m.daysRemaining < 0
        ? 'Quá hạn'
        : 'Đang tích lũy';

        const barClass = m.isCompleted ? 'budget-progress-fill--safe' : 'budget-progress-fill--primary';

        const historyItemsHTML =
        goalContribs.length === 0
        ? `<p style="font-size: var(--fs-xs); color: var(--text-muted);">Chưa có lịch sử đóng góp hoặc rút tiền nào cho mục tiêu này.</p>`
        : goalContribs
        .map((c) => {
        const isDep = c.type === 'deposit';
        return `
        <div class="tx-item" style="padding: var(--space-2) var(--space-3);">
        <div class="tx-item__left">
        <span class="tx-type-pill ${isDep ? 'tx-type-pill--income' : 'tx-type-pill--expense'}">
        ${isDep ? '+ Đóng góp' : '- Rút ra'}
        </span>
        <span style="font-size: var(--fs-xs); color: var(--text-secondary);">
        ${c.note ? GeneralUtils.escapeHTML(c.note) : 'Không có ghi chú'}
        </span>
        </div>
        <div class="tx-item__right">
        <span style="font-size: var(--fs-xs); color: var(--text-muted);">${DateTimeUtils.formatDisplayDateVi(c.date)}</span>
        <strong style="font-size: var(--fs-xs); color: ${isDep ? 'var(--color-success)' : 'var(--color-danger)'};">
        ${isDep ? '+' : '-'}${GeneralUtils.formatCurrencyVND(c.amount)}
        </strong>
        </div>
        </div>
        `;
        })
        .join('');

        return `
        <article class="budget-item-card ${m.isCompleted ? 'budget-item-card--completed' : ''}" data-goal-id="${GeneralUtils.escapeHTML(goal.id)}">
        <div class="budget-item-card__top">
        <div class="budget-item-card__title-group">
        <div class="budget-item-card__title">
        <i data-lucide="${GeneralUtils.escapeHTML(goal.icon || 'piggy-bank')}" style="width: 18px; height: 18px; color: var(--accent-primary);"></i>
        <span>${GeneralUtils.escapeHTML(goal.name)}</span>
        <span class="budget-status-badge ${badgeClass}">${statusLabel}</span>
        </div>
        <span class="budget-item-card__subtitle">
        Từ ${DateTimeUtils.formatDisplayDateVi(goal.startDate)} • ${GeneralUtils.escapeHTML(m.timeText)}
        </span>
        </div>

        <div class="tx-item__actions">
        <button type="button" class="btn-icon" data-sg-action="toggle-complete" data-id="${GeneralUtils.escapeHTML(goal.id)}" title="${m.isCompleted ? 'Mở lại mục tiêu' : 'Đánh dấu hoàn thành'}">
        <i data-lucide="${m.isCompleted ? 'rotate-ccw' : 'check-circle-2'}" style="width: 16px; height: 16px;"></i>
        </button>
        <button type="button" class="btn-icon" data-sg-action="edit" data-id="${GeneralUtils.escapeHTML(goal.id)}" title="Chỉnh sửa mục tiêu">
        <i data-lucide="pencil" style="width: 16px; height: 16px;"></i>
        </button>
        <button type="button" class="btn-icon btn-icon--danger" data-sg-action="delete" data-id="${GeneralUtils.escapeHTML(goal.id)}" title="Xóa mục tiêu">
        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
        </button>
        </div>
        </div>

        ${goal.description ? `<p style="font-size: var(--fs-xs); color: var(--text-secondary);">${GeneralUtils.escapeHTML(goal.description)}</p>` : ''}

        <div class="budget-item-card__metrics">
        <div class="budget-metric">
        <span class="budget-metric__label">Số tiền hiện có</span>
        <span class="budget-metric__val budget-metric__val--remaining-pos">${GeneralUtils.formatCurrencyVND(m.current)}</span>
        </div>
        <div class="budget-metric">
        <span class="budget-metric__label">Mục tiêu đề ra</span>
        <span class="budget-metric__val">${GeneralUtils.formatCurrencyVND(m.target)}</span>
        </div>
        <div class="budget-metric">
        <span class="budget-metric__label">Số tiền còn thiếu</span>
        <span class="budget-metric__val ${m.missing > 0 ? 'budget-metric__val--spent' : 'budget-metric__val--remaining-pos'}">
        ${GeneralUtils.formatCurrencyVND(m.missing)}
        </span>
        </div>
        </div>

        <div class="budget-progress-wrapper">
        <div class="budget-progress-track" role="progressbar" aria-valuenow="${Math.round(m.displayPct)}" aria-valuemin="0" aria-valuemax="100">
        <div class="budget-progress-fill ${barClass}" style="width: ${m.barPct}%;"></div>
        </div>
        <div class="budget-item-card__footer">
        <span>Lịch sử: <strong>${goalContribs.length}</strong> lượt đóng góp/rút</span>
        <span>Tiến độ: <strong>${m.displayPct}%</strong></span>
        </div>
        </div>

        <div class="savings-goal-actions-bar">
        <div class="savings-goal-btn-group">
        <button type="button" class="btn-chip btn-chip--deposit" data-sg-action="open-contrib" data-contrib-mode="deposit" data-id="${GeneralUtils.escapeHTML(goal.id)}">
        <i data-lucide="plus-circle" style="width: 14px; height: 14px;"></i>
        <span>Đóng góp tiền</span>
        </button>
        <button type="button" class="btn-chip btn-chip--withdraw" data-sg-action="open-contrib" data-contrib-mode="withdraw" data-id="${GeneralUtils.escapeHTML(goal.id)}">
        <i data-lucide="minus-circle" style="width: 14px; height: 14px;"></i>
        <span>Rút tiền</span>
        </button>
        </div>
        <button type="button" class="btn-chip btn-chip--neutral" data-sg-action="toggle-history" data-id="${GeneralUtils.escapeHTML(goal.id)}">
        <i data-lucide="history" style="width: 14px; height: 14px;"></i>
        <span>Lịch sử (${goalContribs.length})</span>
        </button>
        </div>

        <!-- Inline Contribution / Withdraw Drawer -->
        <div class="goal-drawer-panel ${isContribOpen ? '' : 'is-hidden'}" id="contribDrawer_${GeneralUtils.escapeHTML(goal.id)}">
        <form class="sg-contrib-form" data-goal-id="${GeneralUtils.escapeHTML(goal.id)}">
        <input type="hidden" name="contribType" value="deposit" />
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-2);">
        <strong class="contrib-drawer-title" style="font-size: var(--fs-xs); color: var(--text-primary);">
        Xác nhận đóng góp vào mục tiêu
        </strong>
        <span style="font-size: 0.7rem; color: var(--text-muted);">Không tạo giao dịch Chi tiêu/Thu nhập trùng</span>
        </div>
        <div class="filter-bar__row" style="margin-bottom: var(--space-2);">
        <div>
        <label class="form-label">Số tiền (VND) *</label>
        <input type="number" name="amount" class="form-control" placeholder="Ví dụ: 500000" min="1" step="1" required />
        </div>
        <div>
        <label class="form-label">Ngày thực hiện *</label>
        <input type="date" name="date" class="form-control" value="${todayISO}" required />
        </div>
        <div>
        <label class="form-label">Ghi chú</label>
        <input type="text" name="note" class="form-control" placeholder="Trích từ tiền làm thêm..." maxlength="120" />
        </div>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: var(--space-2);">
        <button type="button" class="btn-secondary" data-sg-action="close-contrib" style="padding: 5px 12px; font-size: var(--fs-xs);">Đóng</button>
        <button type="submit" class="btn-primary" style="padding: 5px 14px; font-size: var(--fs-xs);">Xác nhận lưu</button>
        </div>
        </form>
        </div>

        <!-- Inline Contribution History Drawer -->
        <div class="goal-drawer-panel ${isHistoryOpen ? '' : 'is-hidden'}">
        <strong style="font-size: var(--fs-xs); color: var(--text-primary);">Lịch sử đóng góp & rút tiền của mục tiêu</strong>
        <div class="tx-list" style="gap: var(--space-2);">
        ${historyItemsHTML}
        </div>
        </div>
        </article>
        `;
        })
        .join('');
        },

        renderAiInsights(allTransactions = []) {
        const container = GeneralUtils.qs('#aiAutoInsightsContainer');
        const chatBox = GeneralUtils.qs('#aiChatHistoryBox');
        if (!container) return;

        const insights = AIAssistantService.buildDiagnosticInsights(
        allTransactions,
        BudgetUI.allBudgets,
        this.allGoals,
        this.allContributions
        );

        container.innerHTML = insights
        .map(
        (item) => `
        <div class="ai-insight-block ai-insight-block--${item.level}">
        <div class="ai-insight-block__title">
        <i data-lucide="${item.icon}" style="width: 16px; height: 16px;"></i>
        <span>${GeneralUtils.escapeHTML(item.title)}</span>
        </div>
        <p class="ai-insight-block__desc">${GeneralUtils.escapeHTML(item.desc)}</p>
        </div>
        `
        )
        .join('');

        if (chatBox && chatBox.children.length === 0) {
        this.appendChatMessage(
        'assistant',
        'Xin chào! Mình là Trợ lý Phân tích Tài chính nội bộ của Student Wallet. Mọi nhận xét và câu trả lời đều được tính toán trực tiếp từ dữ liệu thật của bạn trên trình duyệt. Hãy chọn câu hỏi gợi ý hoặc nhập câu hỏi bên dưới nhé!'
        );
        }
        },

        appendChatMessage(role, text) {
        const chatBox = GeneralUtils.qs('#aiChatHistoryBox');
        if (!chatBox) return;

        const msg = document.createElement('div');
        msg.className = `ai-msg ai-msg--${role === 'user' ? 'user' : 'assistant'}`;
        msg.innerHTML = GeneralUtils.escapeHTML(text).replace(/\n/g, '<br>');
        chatBox.appendChild(msg);
        chatBox.scrollTop = chatBox.scrollHeight;
        },

        bindEvents() {
        // Chuyển tab giữa Quỹ mục tiêu tiết kiệm & Trợ lý AI
        const tabBtns = GeneralUtils.qsa('[data-savings-ai-tab]');
        tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-savings-ai-tab');
        this.activeTab = tab === 'ai' ? 'ai' : 'goals';
        tabBtns.forEach((b) =>
        b.classList.toggle('is-active', b.getAttribute('data-savings-ai-tab') === this.activeTab)
        );
        GeneralUtils.qs('#savingsGoalsTabPanel')?.classList.toggle('is-hidden', this.activeTab !== 'goals');
        GeneralUtils.qs('#aiAssistantTabPanel')?.classList.toggle('is-hidden', this.activeTab !== 'ai');
        });
        });

        // Lọc trạng thái mục tiêu
        const filterBtns = GeneralUtils.qsa('[data-goal-filter]');
        filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
        this.goalFilter = btn.getAttribute('data-goal-filter') || 'all';
        filterBtns.forEach((b) =>
        b.classList.toggle('is-active', b.getAttribute('data-goal-filter') === this.goalFilter)
        );
        this.renderGoalsList();
        GeneralUtils.refreshIcons();
        });
        });

        // Submit tạo/sửa mục tiêu
        const goalForm = GeneralUtils.qs('#savingsGoalForm');
        if (goalForm) {
        goalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = GeneralUtils.qs('#sgFormError');
        if (errEl) errEl.classList.add('is-hidden');

        const payload = {
        name: GeneralUtils.qs('#sgNameInput')?.value,
        targetAmount: GeneralUtils.qs('#sgTargetAmountInput')?.value,
        icon: GeneralUtils.qs('#sgIconSelect')?.value,
        startDate: GeneralUtils.qs('#sgStartDateInput')?.value,
        targetDate: GeneralUtils.qs('#sgTargetDateInput')?.value,
        description: GeneralUtils.qs('#sgDescInput')?.value
        };

        try {
        const res = await SavingsService.saveGoal(payload, this.editingGoalId);
        NotificationManager.showToast(
        res.mode === 'updated'
        ? 'Đã cập nhật mục tiêu tiết kiệm!'
        : 'Đã tạo mục tiêu tiết kiệm mới (Số dư ban đầu: 0 ₫)!',
        'success'
        );
        this.resetGoalForm();
        await this.reloadAndRender(FinancialUI.allTransactions);
        } catch (err) {
        if (errEl) {
        errEl.textContent = err.message || 'Dữ liệu mục tiêu không hợp lệ.';
        errEl.classList.remove('is-hidden');
        }
        }
        });
        }

        GeneralUtils.qs('#sgCancelEditBtn')?.addEventListener('click', () => this.resetGoalForm());

        // Event delegation trên danh sách mục tiêu
        const listContainer = GeneralUtils.qs('#savingsGoalsListContainer');
        if (listContainer) {
        listContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-sg-action]');
        if (!btn) return;

        const action = btn.getAttribute('data-sg-action');
        const goalId = btn.getAttribute('data-id');

        if (action === 'edit' && goalId) {
        this.startEditingGoal(goalId);
        } else if (action === 'delete' && goalId) {
        const target = this.allGoals.find((g) => g.id === goalId);
        NotificationManager.openConfirmModal(
        goalId,
        `Bạn có chắc chắn muốn xóa mục tiêu "${target ? target.name : ''}" cùng toàn bộ lịch sử đóng góp của mục tiêu này không?`,
        async (confirmedId) => {
        await SavingsService.deleteGoalAndHistory(confirmedId);
        if (this.editingGoalId === confirmedId) this.resetGoalForm();
        await this.reloadAndRender(FinancialUI.allTransactions);
        NotificationManager.showToast('Đã xóa mục tiêu tiết kiệm.', 'info');
        },
        'Xác nhận xóa mục tiêu tiết kiệm'
        );
        } else if (action === 'toggle-complete' && goalId) {
        const updated = await SavingsService.toggleGoalCompleted(goalId);
        NotificationManager.showToast(
        updated.status === 'completed'
        ? 'Đã đánh dấu hoàn thành mục tiêu!'
        : 'Đã mở lại mục tiêu tiết kiệm.',
        'success'
        );
        await this.reloadAndRender(FinancialUI.allTransactions);
        } else if (action === 'open-contrib' && goalId) {
        const mode = btn.getAttribute('data-contrib-mode') || 'deposit';
        this.openContributeGoalId = goalId;
        this.renderGoalsList();
        GeneralUtils.refreshIcons();

        const drawer = GeneralUtils.qs(`#contribDrawer_${goalId}`);
        if (drawer) {
        const typeInput = drawer.querySelector('input[name="contribType"]');
        const titleEl = drawer.querySelector('.contrib-drawer-title');
        if (typeInput) typeInput.value = mode;
        if (titleEl) {
        titleEl.textContent =
        mode === 'withdraw'
        ? 'Rút tiền khỏi mục tiêu tiết kiệm (Không tính thành Thu nhập)'
        : 'Đóng góp tiền vào mục tiêu tiết kiệm (Không tính trùng Chi tiêu)';
        }
        drawer.querySelector('input[name="amount"]')?.focus();
        }
        } else if (action === 'close-contrib') {
        this.openContributeGoalId = null;
        this.renderGoalsList();
        GeneralUtils.refreshIcons();
        } else if (action === 'toggle-history' && goalId) {
        this.openHistoryGoalId = this.openHistoryGoalId === goalId ? null : goalId;
        this.renderGoalsList();
        GeneralUtils.refreshIcons();
        }
        });

        listContainer.addEventListener('submit', async (e) => {
        const form = e.target.closest('.sg-contrib-form');
        if (!form) return;
        e.preventDefault();

        const goalId = form.getAttribute('data-goal-id');
        const type = form.querySelector('input[name="contribType"]')?.value || 'deposit';
        const amount = form.querySelector('input[name="amount"]')?.value;
        const date = form.querySelector('input[name="date"]')?.value;
        const note = form.querySelector('input[name="note"]')?.value;

        try {
        await SavingsService.recordContribution({ goalId, type, amount, date, note });
        this.openContributeGoalId = null;
        this.openHistoryGoalId = goalId;
        await this.reloadAndRender(FinancialUI.allTransactions);
        NotificationManager.showToast(
        type === 'withdraw'
        ? 'Đã rút tiền khỏi mục tiêu thành công!'
        : 'Đã ghi nhận khoản đóng góp vào mục tiêu!',
        'success'
        );
        } catch (err) {
        NotificationManager.showToast(err.message || 'Lỗi ghi nhận đóng góp.', 'error');
        }
        });
        }

        // AI Assistant Events
        GeneralUtils.qs('#toggleAiApiConfigBtn')?.addEventListener('click', () => {
        GeneralUtils.qs('#aiApiConfigDrawer')?.classList.toggle('is-hidden');
        });

        GeneralUtils.qs('#refreshAiInsightsBtn')?.addEventListener('click', () => {
        this.renderAiInsights(FinancialUI.allTransactions);
        GeneralUtils.refreshIcons();
        NotificationManager.showToast('Đã cập nhật phân tích từ dữ liệu mới nhất.', 'info');
        });

        GeneralUtils.qs('#clearAiChatBtn')?.addEventListener('click', () => {
        const box = GeneralUtils.qs('#aiChatHistoryBox');
        if (box) box.innerHTML = '';
        this.renderAiInsights(FinancialUI.allTransactions);
        });

        GeneralUtils.qs('#aiQuickPromptsBar')?.addEventListener('click', (e) => {
        const pill = e.target.closest('[data-ai-prompt]');
        if (!pill) return;
        const code = pill.getAttribute('data-ai-prompt');
        const label = pill.textContent.trim();
        this.appendChatMessage('user', label);
        const reply = AIAssistantService.answerUserQuestion(
        code,
        FinancialUI.allTransactions,
        BudgetUI.allBudgets,
        this.allGoals,
        this.allContributions
        );
        this.appendChatMessage('assistant', reply);
        });

        GeneralUtils.qs('#aiQuestionForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = GeneralUtils.qs('#aiQuestionInput');
        const text = input?.value.trim();
        if (!text) return;

        this.appendChatMessage('user', text);
        input.value = '';

        const reply = AIAssistantService.answerUserQuestion(
        text,
        FinancialUI.allTransactions,
        BudgetUI.allBudgets,
        this.allGoals,
        this.allContributions
        );
        this.appendChatMessage('assistant', reply);
        });
        }
        };
        const FinancialUI = {
        allTransactions: [],
        editingTransactionId: null,

        async init() {
        this.populateFilterCategories();
        this.setFormType('expense');
        this.resetFormToDefault();
        this.bindFormAndFilterEvents();
        await this.reloadAndRenderAll();
        },

        populateCategorySelectForType(type, selectedCategory = '') {
        const categorySelect = GeneralUtils.qs('#txCategoryInput');
        if (!categorySelect) return;

        const categories =
        TransactionService.CATEGORIES[type] || TransactionService.CATEGORIES.expense;

        categorySelect.innerHTML = categories
        .map(
        (cat) =>
        `<option value="${GeneralUtils.escapeHTML(cat)}">${GeneralUtils.escapeHTML(cat)}</option>`
        )
        .join('');

        if (selectedCategory && categories.includes(selectedCategory)) {
        categorySelect.value = selectedCategory;
        }
        },

        populateFilterCategories() {
        const filterCatSelect = GeneralUtils.qs('#filterCategorySelect');
        if (!filterCatSelect) return;

        const allCats = TransactionService.getAllUniqueCategories();
        filterCatSelect.innerHTML =
        `<option value="all">Tất cả danh mục</option>` +
        allCats
        .map(
        (cat) =>
        `<option value="${GeneralUtils.escapeHTML(cat)}">${GeneralUtils.escapeHTML(cat)}</option>`
        )
        .join('');
        },

        setFormType(type, selectedCategory = '') {
        const validType = ['income', 'expense', 'transfer'].includes(type) ? type : 'expense';
        const typeInput = GeneralUtils.qs('#txTypeInput');
        if (typeInput) typeInput.value = validType;

        const segBtns = GeneralUtils.qsa('.type-seg-btn[data-type]');
        segBtns.forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-type') === validType);
        });

        this.populateCategorySelectForType(validType, selectedCategory);
        },

        resetFormToDefault() {
        this.editingTransactionId = null;
        const idInput = GeneralUtils.qs('#txIdInput');
        const amountInput = GeneralUtils.qs('#txAmountInput');
        const dateInput = GeneralUtils.qs('#txDateInput');
        const noteInput = GeneralUtils.qs('#txNoteInput');
        const formTitle = GeneralUtils.qs('#txFormTitleText');
        const submitText = GeneralUtils.qs('#txSubmitBtnText');
        const cancelBtn = GeneralUtils.qs('#txCancelEditBtn');
        const errorEl = GeneralUtils.qs('#txFormError');

        if (idInput) idInput.value = '';
        if (amountInput) amountInput.value = '';
        if (dateInput) dateInput.value = DateTimeUtils.formatLocalISODate(new Date());
        if (noteInput) noteInput.value = '';
        if (formTitle) formTitle.textContent = 'Thêm giao dịch mới';
        if (submitText) submitText.textContent = 'Lưu giao dịch';
        if (cancelBtn) cancelBtn.classList.add('is-hidden');
        if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('is-hidden');
        }

        this.setFormType('expense');
        },

        startEditingTransaction(txId) {
        const target = this.allTransactions.find((item) => item.id === txId);
        if (!target) {
        NotificationManager.showToast('Không tìm thấy giao dịch cần sửa.', 'error');
        return;
        }

        this.editingTransactionId = target.id;
        const idInput = GeneralUtils.qs('#txIdInput');
        const amountInput = GeneralUtils.qs('#txAmountInput');
        const dateInput = GeneralUtils.qs('#txDateInput');
        const noteInput = GeneralUtils.qs('#txNoteInput');
        const formTitle = GeneralUtils.qs('#txFormTitleText');
        const submitText = GeneralUtils.qs('#txSubmitBtnText');
        const cancelBtn = GeneralUtils.qs('#txCancelEditBtn');
        const errorEl = GeneralUtils.qs('#txFormError');

        if (idInput) idInput.value = target.id;
        this.setFormType(target.type, target.category);
        if (amountInput) amountInput.value = target.amount;
        if (dateInput) dateInput.value = target.date;
        if (noteInput) noteInput.value = target.note || '';

        if (formTitle) formTitle.textContent = 'Chỉnh sửa giao dịch';
        if (submitText) submitText.textContent = 'Cập nhật giao dịch';
        if (cancelBtn) cancelBtn.classList.remove('is-hidden');
        if (errorEl) errorEl.classList.add('is-hidden');

        const formCard = GeneralUtils.qs('#transactionForm');
        if (formCard) {
        formCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        },

        getCurrentFilterValues() {
        return {
        search: GeneralUtils.qs('#filterSearchInput')?.value || '',
        type: GeneralUtils.qs('#filterTypeSelect')?.value || 'all',
        category: GeneralUtils.qs('#filterCategorySelect')?.value || 'all',
        dateFrom: GeneralUtils.qs('#filterDateFrom')?.value || '',
        dateTo: GeneralUtils.qs('#filterDateTo')?.value || '',
        sort: GeneralUtils.qs('#filterSortSelect')?.value || 'newest'
        };
        },

        resetFilters() {
        const searchInput = GeneralUtils.qs('#filterSearchInput');
        const typeSelect = GeneralUtils.qs('#filterTypeSelect');
        const catSelect = GeneralUtils.qs('#filterCategorySelect');
        const dateFrom = GeneralUtils.qs('#filterDateFrom');
        const dateTo = GeneralUtils.qs('#filterDateTo');
        const sortSelect = GeneralUtils.qs('#filterSortSelect');

        if (searchInput) searchInput.value = '';
        if (typeSelect) typeSelect.value = 'all';
        if (catSelect) catSelect.value = 'all';
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (sortSelect) sortSelect.value = 'newest';

        this.renderTransactionsList();
        },

        async reloadAndRenderAll() {
        try {
        this.allTransactions = await Database.getAllTransactions();
        } catch (error) {
        console.error('[FinancialUI] Lỗi tải danh sách giao dịch:', error);
        this.allTransactions = [];
        NotificationManager.showToast('Không thể đọc dữ liệu từ trình duyệt.', 'error');
        }

        const summary = TransactionService.calculateSummary(this.allTransactions);
        this.renderSummaryKPIs(summary);
        this.renderDashboardWidgets(summary);
        this.renderTransactionsList();

        // Tự động đồng bộ sang Ngân sách (Phase 3), Phân tích (Phase 4), Tiết kiệm (Phase 5) & Phase 6
        await BudgetUI.reloadBudgetsAndRender(this.allTransactions);
        AnalyticsUI.renderAll(this.allTransactions);
        await SavingsAiUI.reloadAndRender(this.allTransactions);
        await AllowanceRecurringUI.reloadAndRender();
        await SettingsBackupUI.refreshStatsDisplay();
        GeneralUtils.refreshIcons();
        },

        renderSummaryKPIs(summary) {
        const formattedBalance = GeneralUtils.formatCurrencyVND(summary.balance);
        const formattedIncome = GeneralUtils.formatCurrencyVND(summary.totalIncome);
        const formattedExpense = GeneralUtils.formatCurrencyVND(summary.totalExpense);
        const formattedTransfer = GeneralUtils.formatCurrencyVND(summary.totalTransfer);

        const dashBalance = GeneralUtils.qs('#dashBalanceValue');
        const dashIncome = GeneralUtils.qs('#dashIncomeValue');
        const dashExpense = GeneralUtils.qs('#dashExpenseValue');
        const dashIncomeCount = GeneralUtils.qs('#dashIncomeCount');
        const dashExpenseCount = GeneralUtils.qs('#dashExpenseCount');

        if (dashBalance) dashBalance.textContent = formattedBalance;
        if (dashIncome) dashIncome.textContent = formattedIncome;
        if (dashExpense) dashExpense.textContent = formattedExpense;
        if (dashIncomeCount) dashIncomeCount.textContent = `${summary.incomeCount} giao dịch thu nhập`;
        if (dashExpenseCount) dashExpenseCount.textContent = `${summary.expenseCount} giao dịch chi tiêu`;

        const txBalance = GeneralUtils.qs('#txPageBalanceValue');
        const txIncome = GeneralUtils.qs('#txPageIncomeValue');
        const txExpense = GeneralUtils.qs('#txPageExpenseValue');
        const txTransferInfo = GeneralUtils.qs('#txPageTransferInfo');

        if (txBalance) txBalance.textContent = formattedBalance;
        if (txIncome) txIncome.textContent = formattedIncome;
        if (txExpense) txExpense.textContent = formattedExpense;
        if (txTransferInfo) {
        txTransferInfo.textContent = `Chuyển khoản nội bộ (không tính thu/chi): ${formattedTransfer}`;
        }
        },

        renderDashboardWidgets() {
        const emptySection = GeneralUtils.qs('#dashboardEmptySection');
        const activeSection = GeneralUtils.qs('#dashboardActiveSection');
        const recentContainer = GeneralUtils.qs('#dashboardRecentList');
        const chartContainer = GeneralUtils.qs('#dashboardChartContainer');

        if (this.allTransactions.length === 0) {
        if (emptySection) emptySection.classList.remove('is-hidden');
        if (activeSection) activeSection.classList.add('is-hidden');
        return;
        }

        if (emptySection) emptySection.classList.add('is-hidden');
        if (activeSection) activeSection.classList.remove('is-hidden');

        const recentList = TransactionService.filterAndSortTransactions(this.allTransactions, {
        sort: 'newest'
        }).slice(0, 5);

        if (recentContainer) {
        recentContainer.innerHTML = recentList
        .map((tx) => this.buildTransactionItemHTML(tx, false))
        .join('');
        }

        if (chartContainer) {
        const dailyGroups = TransactionService.groupCashflowByDate(this.allTransactions, 7);
        if (dailyGroups.length === 0) {
        chartContainer.innerHTML = `
        <p style="font-size: var(--fs-sm); color: var(--text-muted); padding: var(--space-4) 0;">
        Hiện chỉ có giao dịch chuyển khoản nội bộ. Thêm giao dịch Thu nhập hoặc Chi tiêu để hiển thị biểu đồ so sánh.
        </p>
        `;
        } else {
        const maxAmount = Math.max(
        1,
        ...dailyGroups.map((d) => Math.max(d.income, d.expense))
        );

        chartContainer.innerHTML = dailyGroups
        .map((item) => {
        const incomePct = Math.round((item.income / maxAmount) * 100);
        const expensePct = Math.round((item.expense / maxAmount) * 100);
        return `
        <div class="cashflow-row">
        <div class="cashflow-row__meta">
        <span>Ngày ${DateTimeUtils.formatDisplayDateVi(item.date)}</span>
        <span>
        Thu: +${GeneralUtils.formatCurrencyVND(item.income)} |
        Chi: -${GeneralUtils.formatCurrencyVND(item.expense)}
        </span>
        </div>
        <div class="cashflow-row__bars">
        <div class="bar-track" title="Thu nhập: ${GeneralUtils.formatCurrencyVND(item.income)}">
        <div class="bar-fill bar-fill--income" style="width: ${Math.max(incomePct, item.income > 0 ? 4 : 0)}%;"></div>
        </div>
        <div class="bar-track" title="Chi tiêu: ${GeneralUtils.formatCurrencyVND(item.expense)}">
        <div class="bar-fill bar-fill--expense" style="width: ${Math.max(expensePct, item.expense > 0 ? 4 : 0)}%;"></div>
        </div>
        </div>
        </div>
        `;
        })
        .join('');
        }
        }
        },

        renderTransactionsList() {
        const listContainer = GeneralUtils.qs('#txListContainer');
        const emptyState = GeneralUtils.qs('#txEmptyState');
        const emptyTitle = GeneralUtils.qs('#txEmptyTitle');
        const emptyDesc = GeneralUtils.qs('#txEmptyDesc');
        const countEl = GeneralUtils.qs('#filterResultCount');

        if (!listContainer || !emptyState) return;

        const filters = this.getCurrentFilterValues();
        const filtered = TransactionService.filterAndSortTransactions(
        this.allTransactions,
        filters
        );

        if (countEl) {
        countEl.textContent = `Hiển thị ${filtered.length} / ${this.allTransactions.length} giao dịch`;
        }

        if (filtered.length === 0) {
        listContainer.innerHTML = '';
        emptyState.classList.remove('is-hidden');

        if (this.allTransactions.length === 0) {
        if (emptyTitle) emptyTitle.textContent = 'Danh sách giao dịch đang trống';
        if (emptyDesc) {
        emptyDesc.textContent =
        'Chưa có giao dịch thu hoặc chi nào được lưu trữ. Hãy điền thông tin vào biểu mẫu bên cạnh để thêm giao dịch đầu tiên của bạn.';
        }
        } else {
        if (emptyTitle) emptyTitle.textContent = 'Không tìm thấy giao dịch phù hợp';
        if (emptyDesc) {
        emptyDesc.textContent =
        'Không có giao dịch nào khớp với điều kiện tìm kiếm hoặc bộ lọc hiện tại. Hãy thử đặt lại bộ lọc.';
        }
        }
        } else {
        emptyState.classList.add('is-hidden');
        listContainer.innerHTML = filtered
        .map((tx) => this.buildTransactionItemHTML(tx, true))
        .join('');
        }

        GeneralUtils.refreshIcons();
        },

        buildTransactionItemHTML(tx, showActions = true) {
        const isIncome = tx.type === 'income';
        const isExpense = tx.type === 'expense';
        const sign = isIncome ? '+' : isExpense ? '-' : '';
        const iconName = isIncome
        ? 'arrow-down-left'
        : isExpense
        ? 'arrow-up-right'
        : 'arrow-left-right';
        const typeLabel = TransactionService.TYPE_LABELS[tx.type] || 'Giao dịch';
        const noteText = tx.note
        ? GeneralUtils.escapeHTML(tx.note)
        : 'Không có ghi chú';

        const actionsHTML = showActions
        ? `
        <div class="tx-item__actions">
        <button
        type="button"
        class="btn-icon"
        data-action="edit-tx"
        data-id="${GeneralUtils.escapeHTML(tx.id)}"
        title="Chỉnh sửa giao dịch"
        aria-label="Chỉnh sửa giao dịch"
        >
        <i data-lucide="pencil" style="width: 16px; height: 16px;"></i>
        </button>
        <button
        type="button"
        class="btn-icon btn-icon--danger"
        data-action="delete-tx"
        data-id="${GeneralUtils.escapeHTML(tx.id)}"
        title="Xóa giao dịch"
        aria-label="Xóa giao dịch"
        >
        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
        </button>
        </div>
        `
        : '';

        return `
        <article class="tx-item" data-tx-id="${GeneralUtils.escapeHTML(tx.id)}">
        <div class="tx-item__left">
        <div class="tx-badge-icon tx-badge-icon--${GeneralUtils.escapeHTML(tx.type)}">
        <i data-lucide="${iconName}"></i>
        </div>
        <div class="tx-item__info">
        <div class="tx-item__top">
        <span class="tx-item__category">${GeneralUtils.escapeHTML(tx.category)}</span>
        <span class="tx-type-pill tx-type-pill--${GeneralUtils.escapeHTML(tx.type)}">${typeLabel}</span>
        </div>
        <p class="tx-item__note" title="${noteText}">${noteText}</p>
        <div class="tx-item__date">Ngày: ${DateTimeUtils.formatDisplayDateVi(tx.date)}</div>
        </div>
        </div>
        <div class="tx-item__right">
        <span class="tx-item__amount tx-item__amount--${GeneralUtils.escapeHTML(tx.type)}">
        ${sign}${GeneralUtils.formatCurrencyVND(tx.amount)}
        </span>
        ${actionsHTML}
        </div>
        </article>
        `;
        },

        bindFormAndFilterEvents() {
        const segBtns = GeneralUtils.qsa('.type-seg-btn[data-type]');
        segBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
        const selectedType = btn.getAttribute('data-type');
        this.setFormType(selectedType);
        });
        });

        const form = GeneralUtils.qs('#transactionForm');
        if (form) {
        form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const errorEl = GeneralUtils.qs('#txFormError');
        if (errorEl) errorEl.classList.add('is-hidden');

        const payload = {
        type: GeneralUtils.qs('#txTypeInput')?.value,
        amount: GeneralUtils.qs('#txAmountInput')?.value,
        category: GeneralUtils.qs('#txCategoryInput')?.value,
        date: GeneralUtils.qs('#txDateInput')?.value,
        note: GeneralUtils.qs('#txNoteInput')?.value
        };

        try {
        if (this.editingTransactionId) {
        await TransactionService.updateTransaction(this.editingTransactionId, payload);
        NotificationManager.showToast('Đã cập nhật giao dịch thành công!', 'success');
        } else {
        await TransactionService.createTransaction(payload);
        NotificationManager.showToast('Đã thêm giao dịch mới thành công!', 'success');
        }

        this.resetFormToDefault();
        await this.reloadAndRenderAll();
        } catch (err) {
        if (errorEl) {
        errorEl.textContent = err.message || 'Dữ liệu đầu vào không hợp lệ.';
        errorEl.classList.remove('is-hidden');
        }
        }
        });
        }

        const cancelEditBtn = GeneralUtils.qs('#txCancelEditBtn');
        if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
        this.resetFormToDefault();
        });
        }

        const listContainer = GeneralUtils.qs('#txListContainer');
        if (listContainer) {
        listContainer.addEventListener('click', (event) => {
        const actionBtn = event.target.closest('[data-action]');
        if (!actionBtn) return;

        const action = actionBtn.getAttribute('data-action');
        const txId = actionBtn.getAttribute('data-id');
        if (!txId) return;

        if (action === 'edit-tx') {
        this.startEditingTransaction(txId);
        } else if (action === 'delete-tx') {
        const targetTx = this.allTransactions.find((t) => t.id === txId);
        const label = targetTx
        ? `${targetTx.category} (${GeneralUtils.formatCurrencyVND(targetTx.amount)})`
        : 'giao dịch này';

        NotificationManager.openConfirmModal(
        txId,
        `Bạn có chắc chắn muốn xóa giao dịch "${label}" không? Số dư, ngân sách và báo cáo phân tích sẽ được tính toán lại ngay lập tức.`,
        async (confirmedId) => {
        try {
        await TransactionService.removeTransaction(confirmedId);
        if (this.editingTransactionId === confirmedId) {
        this.resetFormToDefault();
        }
        await this.reloadAndRenderAll();
        NotificationManager.showToast('Đã xóa giao dịch.', 'info');
        } catch (err) {
        NotificationManager.showToast(
        err.message || 'Không thể xóa giao dịch.',
        'error'
        );
        }
        },
        'Xác nhận xóa giao dịch'
        );
        }
        });
        }

        const filterInputs = [
        '#filterSearchInput',
        '#filterTypeSelect',
        '#filterCategorySelect',
        '#filterDateFrom',
        '#filterDateTo',
        '#filterSortSelect'
        ];

        filterInputs.forEach((selector) => {
        const el = GeneralUtils.qs(selector);
        if (!el) return;
        const evtName = selector === '#filterSearchInput' ? 'input' : 'change';
        el.addEventListener(evtName, () => this.renderTransactionsList());
        });

        const resetFilterBtn = GeneralUtils.qs('#resetFilterBtn');
        if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', () => this.resetFilters());
        }
        }
        };

        /* ========================================================================
        11. UI STATE MANAGEMENT (Sidebar & Responsive Drawer)
        ======================================================================== */
        const UIState = {
        isSidebarCollapsed: false,
        isMobileDrawerOpen: false,

        init() {
        const savedCollapsed = GeneralUtils.getStorage(
        GeneralUtils.STORAGE_KEYS.SIDEBAR_COLLAPSED,
        false
        );
        this.isSidebarCollapsed = Boolean(savedCollapsed);
        this.applySidebarState();
        this.bindEvents();
        },

        applySidebarState() {
        const appShell = GeneralUtils.qs('#appShell');
        const toggleIcon = GeneralUtils.qs('#sidebarToggleIcon');
        if (!appShell) return;

        appShell.classList.toggle('is-sidebar-collapsed', this.isSidebarCollapsed);

        if (toggleIcon) {
        toggleIcon.setAttribute(
        'data-lucide',
        this.isSidebarCollapsed ? 'panel-left-open' : 'panel-left-close'
        );
        GeneralUtils.refreshIcons();
        }
        },

        toggleSidebar() {
        if (window.innerWidth <= 767) {
        this.toggleMobileDrawer();
        return;
        }
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
        GeneralUtils.setStorage(
        GeneralUtils.STORAGE_KEYS.SIDEBAR_COLLAPSED,
        this.isSidebarCollapsed
        );
        this.applySidebarState();
        },

        toggleMobileDrawer(forceState) {
        const appShell = GeneralUtils.qs('#appShell');
        const mobileMenuBtn = GeneralUtils.qs('#mobileMenuBtn');
        if (!appShell) return;

        this.isMobileDrawerOpen =
        typeof forceState === 'boolean' ? forceState : !this.isMobileDrawerOpen;

        appShell.classList.toggle('is-mobile-drawer-open', this.isMobileDrawerOpen);
        document.body.classList.toggle('is-scroll-locked', this.isMobileDrawerOpen);

        if (mobileMenuBtn) {
        mobileMenuBtn.setAttribute('aria-expanded', String(this.isMobileDrawerOpen));
        }
        },

        closeMobileDrawer() {
        if (this.isMobileDrawerOpen) {
        this.toggleMobileDrawer(false);
        }
        },

        bindEvents() {
        const sidebarToggleBtn = GeneralUtils.qs('#sidebarToggleBtn');
        const mobileMenuBtn = GeneralUtils.qs('#mobileMenuBtn');
        const backdrop = GeneralUtils.qs('#sidebarBackdrop');

        if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => this.toggleSidebar());
        }

        if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => this.toggleMobileDrawer());
        }

        if (backdrop) {
        backdrop.addEventListener('click', () => this.closeMobileDrawer());
        }

        document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && this.isMobileDrawerOpen) {
        this.closeMobileDrawer();
        }
        });

        window.addEventListener('resize', () => {
        if (window.innerWidth > 767 && this.isMobileDrawerOpen) {
        this.closeMobileDrawer();
        }
        });

        /* --- LOGIC TÍNH NĂNG MỚI (BOTTOM NAV, FAB & JSON TEXTAREA) --- */

        // 1. Đồng bộ định tuyến Bottom Nav -> Sidebar Router
        const bottomNavItems = document.querySelectorAll('.bottom-nav-item');
        bottomNavItems.forEach(btn => {
        btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-bottom-route');
        const sidebarNav = document.querySelector(`.nav-item[data-route="${route}"]`);
        if (sidebarNav) {
        sidebarNav.click(); // Mượn router gốc để chuyển trang
        // Cập nhật UI Active
        bottomNavItems.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        }
        });
        });

        // 2. Logic nút FAB
        const fabBtn = document.getElementById('mobileFabBtn');
        if (fabBtn) {
        fabBtn.addEventListener('click', () => {
        const txRoute = document.querySelector('.nav-item[data-route="transactions"]');
        const txBottomRoute = document.querySelector('.bottom-nav-item[data-bottom-route="transactions"]');
        if (txRoute) txRoute.click();
        if (txBottomRoute) {
        bottomNavItems.forEach(b => b.classList.remove('is-active'));
        txBottomRoute.classList.add('is-active');
        }
        // Tự động focus vào ô nhập số tiền sau khi chuyển trang
        setTimeout(() => {
        const amountInput = document.getElementById('txAmountInput');
        if (amountInput) amountInput.focus();
        }, 300);
        });
        }

        // 3. Logic Textarea: Khôi phục và Tạo JSON
        const genJsonBtn = document.getElementById('generateJsonTextBtn');
        const resJsonBtn = document.getElementById('restoreJsonTextBtn');
        const jsonTextarea = document.getElementById('rawJsonTextarea');

        if (genJsonBtn && jsonTextarea) {
        genJsonBtn.addEventListener('click', async () => {
        const data = {
        transactions: await Database.getAllTransactions(),
        budgets: await Database.getAllBudgets(),
        savingsGoals: await Database.getAllSavingsGoals(),
        savingsContributions: await Database.getAllSavingsContributions(),
        allowances: await Database.getAllAllowances(),
        recurringExpenses: await Database.getAllRecurringExpenses()
        };
        jsonTextarea.value = JSON.stringify(data);
        jsonTextarea.select();
        try {
        document.execCommand('copy');
        NotificationManager.showToast('Đã tạo và sao chép JSON vào khay nhớ tạm!', 'success');
        } catch(e) {
        NotificationManager.showToast('Tạo thành công. Vui lòng copy thủ công.', 'info');
        }
        });
        }

        if (resJsonBtn && jsonTextarea) {
        resJsonBtn.addEventListener('click', async () => {
        if (!jsonTextarea.value.trim()) {
        NotificationManager.showToast('Vui lòng dán mã JSON vào ô trước khi khôi phục.', 'warning');
        return;
        }
        try {
        const parsed = JSON.parse(jsonTextarea.value.trim());
        const modeSelect = document.getElementById('importBackupModeSelect');
        const clearFirst = modeSelect && modeSelect.value === 'overwrite';

        await Database.importFinancialDataset(parsed, clearFirst);
        NotificationManager.showToast('Khôi phục dữ liệu thành công! Ứng dụng sẽ tự động tải lại...', 'success');
        setTimeout(() => location.reload(), 1500);
        } catch (err) {
        NotificationManager.showToast('Mã JSON không hợp lệ hoặc bị lỗi cấu trúc.', 'error');
        }
        });
        }
        /* --- KẾT THÚC LOGIC MỚI --- */

        }
        };

        /* ========================================================================
        12. THEME MANAGEMENT (Light / Dark Mode + localStorage)
        ======================================================================== */
        const ThemeManager = {
        currentTheme: 'light',

        init() {
        const savedTheme = GeneralUtils.getStorage(GeneralUtils.STORAGE_KEYS.THEME, null);
        if (savedTheme === 'light' || savedTheme === 'dark') {
        this.currentTheme = savedTheme;
        } else {
        const prefersDark =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.currentTheme = prefersDark ? 'dark' : 'light';
        }

        this.applyTheme(this.currentTheme, false);
        this.bindEvents();
        },

        applyTheme(theme, persist = true) {
        this.currentTheme = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);

        if (persist) {
        GeneralUtils.setStorage(GeneralUtils.STORAGE_KEYS.THEME, this.currentTheme);
        }

        const themeToggleIcon = GeneralUtils.qs('#themeToggleIcon');
        if (themeToggleIcon) {
        themeToggleIcon.setAttribute(
        'data-lucide',
        this.currentTheme === 'dark' ? 'sun' : 'moon'
        );
        }

        const themeButtons = GeneralUtils.qsa('[data-theme-value]');
        themeButtons.forEach((btn) => {
        const isMatch = btn.getAttribute('data-theme-value') === this.currentTheme;
        btn.classList.toggle('is-selected', isMatch);
        });

        GeneralUtils.refreshIcons();
        },

        toggleTheme() {
        const nextTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(nextTheme, true);
        },

        bindEvents() {
        const themeToggleBtn = GeneralUtils.qs('#themeToggleBtn');
        if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => this.toggleTheme());
        }

        const themeOptionBtns = GeneralUtils.qsa('[data-theme-value]');
        themeOptionBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
        const targetTheme = btn.getAttribute('data-theme-value');
        this.applyTheme(targetTheme, true);
        });
        });
        }
        };

        /* ========================================================================
        13. NAVIGATION & HISTORY API ROUTER
        ======================================================================== */
        const Navigation = {
        ROUTES: {
        'dashboard': { title: 'Tổng quan – Dashboard' },
        'transactions': { title: 'Thu chi – Transactions' },
        'budget': { title: 'Ngân sách – Budget' },
        'analytics': { title: 'Phân tích tài chính – Analytics' },
        'savings-ai': { title: 'Tiết kiệm & AI – Savings & AI' },
        'profile': { title: 'Hồ sơ cá nhân' },
        'settings': { title: 'Cài đặt' }
        },

        currentRoute: 'dashboard',

        init() {
        const initialRoute = this.resolveRouteFromLocation();
        this.navigateTo(initialRoute, { replaceState: true });
        this.bindEvents();
        },

        resolveRouteFromLocation() {
        const hash = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
        if (hash && this.ROUTES[hash]) {
        return hash;
        }
        return 'dashboard';
        },

        navigateTo(routeKey, options = { pushState: true, replaceState: false }) {
        const targetRoute = this.ROUTES[routeKey] ? routeKey : 'dashboard';
        this.currentRoute = targetRoute;

        const pages = GeneralUtils.qsa('.page-view');
        pages.forEach((page) => {
        const isTarget = page.getAttribute('data-page') === targetRoute;
        page.classList.toggle('is-active', isTarget);
        });

        const navItems = GeneralUtils.qsa('.sidebar [data-route]');
        navItems.forEach((item) => {
        const isActive = item.getAttribute('data-route') === targetRoute;
        item.classList.toggle('is-active', isActive);
        if (isActive) {
        item.setAttribute('aria-current', 'page');
        } else {
        item.removeAttribute('aria-current');
        }
        });

        const routeMeta = this.ROUTES[targetRoute];
        const headerTitleEl = GeneralUtils.qs('#headerPageTitle');
        if (headerTitleEl && routeMeta) {
        headerTitleEl.textContent = routeMeta.title;
        }
        document.title = `${routeMeta.title} | Student Wallet`;

        const targetHash = `#${targetRoute}`;
        try {
        if (options.replaceState) {
        window.history.replaceState({ route: targetRoute }, '', targetHash);
        } else if (options.pushState && window.location.hash !== targetHash) {
        window.history.pushState({ route: targetRoute }, '', targetHash);
        }
        } catch (err) {
        window.location.hash = targetHash;
        }

        UIState.closeMobileDrawer();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        },

        bindEvents() {
        document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-route]');
        if (!trigger) return;

        event.preventDefault();
        const targetRoute = trigger.getAttribute('data-route');
        if (targetRoute) {
        this.navigateTo(targetRoute, { pushState: true });
        }
        });

        window.addEventListener('popstate', (event) => {
        const stateRoute =
        (event.state && event.state.route) || this.resolveRouteFromLocation();
        this.navigateTo(stateRoute, { pushState: false, replaceState: false });
        });

        window.addEventListener('hashchange', () => {
        const hashRoute = this.resolveRouteFromLocation();
        if (hashRoute !== this.currentRoute) {
        this.navigateTo(hashRoute, { pushState: false, replaceState: false });
        }
        });
        }
        };

        /* ========================================================================
        14. PHASE 6A & 6B: ALLOWANCE & RECURRING EXPENSES SERVICES + UI
        ======================================================================== */
        const ScheduleCycleHelper = {
        FREQUENCY_LABELS: {
        once: 'Một lần',
        weekly: 'Hàng tuần',
        monthly: 'Hàng tháng'
        },

        getCurrentCycleInfo(frequency, now = new Date()) {
        const todayISO = DateTimeUtils.formatLocalISODate(now);
        if (frequency === 'once') {
        return {
        cycleKey: 'ONCE',
        cycleLabel: 'Khoản một lần duy nhất'
        };
        }
        if (frequency === 'weekly') {
        const mondayISO = DateTimeUtils.getMondayOfWeekISO(todayISO);
        const sundayISO = DateTimeUtils.getSundayOfWeekISO(mondayISO);
        return {
        cycleKey: `W_${mondayISO}`,
        cycleLabel: `Kỳ tuần này (${DateTimeUtils.formatShortDayMonthVi(mondayISO)} - ${DateTimeUtils.formatShortDayMonthVi(sundayISO)})`
        };
        }
        const periodKey = DateTimeUtils.formatPeriodKey(now.getFullYear(), now.getMonth() + 1);
        return {
        cycleKey: `M_${periodKey}`,
        cycleLabel: `Kỳ ${DateTimeUtils.formatPeriodLabelVi(periodKey)}`
        };
        },

        isConfirmedForCycle(record, cycleKey) {
        if (!record) return false;
        const history = Array.isArray(record.confirmedCycles) ? record.confirmedCycles : [];
        if (record.frequency === 'once') {
        return history.length > 0 || Boolean(record.lastConfirmedCycleKey);
        }
        return history.includes(cycleKey) || record.lastConfirmedCycleKey === cycleKey;
        }
        };

        const AllowanceService = {
        validateInput(payload) {
        const errors = [];
        const name = String(payload.name || '').trim();
        if (!name) errors.push('Vui lòng nhập tên khoản trợ cấp.');
        if (name.length > 100) errors.push('Tên khoản trợ cấp không vượt quá 100 ký tự.');

        const amount = Number(payload.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
        errors.push('Số tiền trợ cấp phải lớn hơn 0.');
        }

        const validFreq = ['once', 'weekly', 'monthly'];
        const frequency = validFreq.includes(payload.frequency) ? payload.frequency : 'monthly';

        const category = String(payload.category || '').trim();
        if (!category || !TransactionService.CATEGORIES.income.includes(category)) {
        errors.push('Vui lòng chọn danh mục thu nhập hợp lệ.');
        }

        const startDate = String(payload.startDate || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        errors.push('Ngày bắt đầu / dự kiến không hợp lệ.');
        }

        const note = String(payload.note || '').trim();
        if (note.length > 200) errors.push('Ghi chú không vượt quá 200 ký tự.');

        return {
        isValid: errors.length === 0,
        errors,
        sanitized: {
        name,
        amount: Math.round(amount),
        frequency,
        category,
        startDate,
        note
        }
        };
        },

        async saveAllowance(payload, editingId = null) {
        const check = this.validateInput(payload);
        if (!check.isValid) throw new Error(check.errors[0]);

        const nowISO = new Date().toISOString();
        if (editingId) {
        const existing = await Database.getAllowanceById(editingId);
        if (!existing) throw new Error('Không tìm thấy khoản trợ cấp cần sửa.');

        const updated = {
        ...existing,
        ...check.sanitized,
        updatedAt: nowISO
        };
        await Database.putAllowance(updated);
        return { record: updated, mode: 'updated' };
        }

        const created = {
        id: GeneralUtils.generateUniqueId('alw'),
        ...check.sanitized,
        confirmedCycles: [],
        lastConfirmedCycleKey: null,
        lastConfirmedAt: null,
        lastTransactionId: null,
        createdAt: nowISO,
        updatedAt: nowISO
        };
        await Database.putAllowance(created);
        return { record: created, mode: 'created' };
        },

        async deleteAllowance(id) {
        if (!id) throw new Error('Mã khoản trợ cấp không hợp lệ.');
        await Database.deleteAllowance(id);
        return true;
        },

        /**
        * Xác nhận đã nhận tiền trợ cấp -> Tạo giao dịch Thu nhập thực tế.
        * Chống xác nhận trùng trong cùng chu kỳ và chống tạo giao dịch trùng.
        */
        async confirmReceived(id) {
        const record = await Database.getAllowanceById(id);
        if (!record) throw new Error('Khoản trợ cấp không tồn tại.');

        const cycleInfo = ScheduleCycleHelper.getCurrentCycleInfo(record.frequency, new Date());
        if (ScheduleCycleHelper.isConfirmedForCycle(record, cycleInfo.cycleKey)) {
        throw new Error(`Khoản trợ cấp "${record.name}" đã được xác nhận nhận tiền trong ${cycleInfo.cycleLabel.toLowerCase()} rồi!`);
        }

        const todayISO = DateTimeUtils.formatLocalISODate(new Date());
        const txNote = `[Trợ cấp - ${ScheduleCycleHelper.FREQUENCY_LABELS[record.frequency]}] ${record.name}${record.note ? ` (${record.note})` : ''}`.slice(0, 250);

        const createdTx = await TransactionService.createTransaction({
        type: 'income',
        amount: record.amount,
        category: record.category,
        date: todayISO,
        note: txNote
        });

        const confirmedCycles = Array.isArray(record.confirmedCycles)
        ? [...record.confirmedCycles]
        : [];
        if (!confirmedCycles.includes(cycleInfo.cycleKey)) {
        confirmedCycles.push(cycleInfo.cycleKey);
        }

        const updatedAllowance = {
        ...record,
        confirmedCycles,
        lastConfirmedCycleKey: cycleInfo.cycleKey,
        lastConfirmedDate: todayISO,
        lastConfirmedAt: new Date().toISOString(),
        lastTransactionId: createdTx.id,
        updatedAt: new Date().toISOString()
        };

        await Database.putAllowance(updatedAllowance);
        return { allowance: updatedAllowance, transaction: createdTx, cycleInfo };
        }
        };

        const RecurringExpenseService = {
        validateInput(payload) {
        const errors = [];
        const name = String(payload.name || '').trim();
        if (!name) errors.push('Vui lòng nhập tên chi phí định kỳ.');
        if (name.length > 100) errors.push('Tên chi phí không vượt quá 100 ký tự.');

        const amount = Number(payload.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
        errors.push('Số tiền chi phí định kỳ phải lớn hơn 0.');
        }

        const validFreq = ['once', 'weekly', 'monthly'];
        const frequency = validFreq.includes(payload.frequency) ? payload.frequency : 'monthly';

        const category = String(payload.category || '').trim();
        if (!category || !TransactionService.CATEGORIES.expense.includes(category)) {
        errors.push('Vui lòng chọn danh mục chi tiêu hợp lệ.');
        }

        const startDate = String(payload.startDate || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        errors.push('Hạn thanh toán / ngày bắt đầu không hợp lệ.');
        }

        const note = String(payload.note || '').trim();
        if (note.length > 200) errors.push('Ghi chú không vượt quá 200 ký tự.');

        return {
        isValid: errors.length === 0,
        errors,
        sanitized: {
        name,
        amount: Math.round(amount),
        frequency,
        category,
        startDate,
        note
        }
        };
        },

        async saveRecurringExpense(payload, editingId = null) {
        const check = this.validateInput(payload);
        if (!check.isValid) throw new Error(check.errors[0]);

        const nowISO = new Date().toISOString();
        if (editingId) {
        const existing = await Database.getRecurringExpenseById(editingId);
        if (!existing) throw new Error('Không tìm thấy chi phí định kỳ cần sửa.');

        const updated = {
        ...existing,
        ...check.sanitized,
        updatedAt: nowISO
        };
        await Database.putRecurringExpense(updated);
        return { record: updated, mode: 'updated' };
        }

        const created = {
        id: GeneralUtils.generateUniqueId('rec'),
        ...check.sanitized,
        confirmedCycles: [],
        lastConfirmedCycleKey: null,
        lastConfirmedAt: null,
        lastTransactionId: null,
        createdAt: nowISO,
        updatedAt: nowISO
        };
        await Database.putRecurringExpense(created);
        return { record: created, mode: 'created' };
        },

        async deleteRecurringExpense(id) {
        if (!id) throw new Error('Mã chi phí định kỳ không hợp lệ.');
        await Database.deleteRecurringExpense(id);
        return true;
        },

        async confirmPaid(id) {
        const record = await Database.getRecurringExpenseById(id);
        if (!record) throw new Error('Khoản chi phí định kỳ không tồn tại.');

        const cycleInfo = ScheduleCycleHelper.getCurrentCycleInfo(record.frequency, new Date());
        if (ScheduleCycleHelper.isConfirmedForCycle(record, cycleInfo.cycleKey)) {
        throw new Error(`Khoản chi phí "${record.name}" đã được xác nhận thanh toán trong ${cycleInfo.cycleLabel.toLowerCase()} rồi!`);
        }

        const todayISO = DateTimeUtils.formatLocalISODate(new Date());
        const txNote = `[Định kỳ - ${ScheduleCycleHelper.FREQUENCY_LABELS[record.frequency]}] ${record.name}${record.note ? ` (${record.note})` : ''}`.slice(0, 250);

        const createdTx = await TransactionService.createTransaction({
        type: 'expense',
        amount: record.amount,
        category: record.category,
        date: todayISO,
        note: txNote
        });

        const confirmedCycles = Array.isArray(record.confirmedCycles)
        ? [...record.confirmedCycles]
        : [];
        if (!confirmedCycles.includes(cycleInfo.cycleKey)) {
        confirmedCycles.push(cycleInfo.cycleKey);
        }

        const updatedRec = {
        ...record,
        confirmedCycles,
        lastConfirmedCycleKey: cycleInfo.cycleKey,
        lastConfirmedDate: todayISO,
        lastConfirmedAt: new Date().toISOString(),
        lastTransactionId: createdTx.id,
        updatedAt: new Date().toISOString()
        };

        await Database.putRecurringExpense(updatedRec);
        return { recurring: updatedRec, transaction: createdTx, cycleInfo };
        }
        };

        const AllowanceRecurringUI = {
        allAllowances: [],
        allRecurring: [],
        activeWorkspaceTab: 'ledger',
        editingAllowanceId: null,
        editingRecurringId: null,
        isProcessingConfirm: false,

        async init() {
        this.populateCategorySelects();
        this.resetAllowanceForm();
        this.resetRecurringForm();
        this.bindEvents();
        },

        populateCategorySelects() {
        const alwSelect = GeneralUtils.qs('#alwCategorySelect');
        if (alwSelect) {
        alwSelect.innerHTML = TransactionService.CATEGORIES.income
        .map((c) => `<option value="${GeneralUtils.escapeHTML(c)}">${GeneralUtils.escapeHTML(c)}</option>`)
        .join('');
        }

        const recSelect = GeneralUtils.qs('#recCategorySelect');
        if (recSelect) {
        recSelect.innerHTML = TransactionService.CATEGORIES.expense
        .map((c) => `<option value="${GeneralUtils.escapeHTML(c)}">${GeneralUtils.escapeHTML(c)}</option>`)
        .join('');
        }
        },

        switchWorkspaceTab(tabName) {
        const valid = ['ledger', 'allowances', 'recurring'].includes(tabName) ? tabName : 'ledger';
        this.activeWorkspaceTab = valid;

        GeneralUtils.qsa('[data-tx-workspace-tab]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-tx-workspace-tab') === valid);
        });

        GeneralUtils.qs('#transactionsMountSlot')?.classList.toggle('is-hidden', valid !== 'ledger');
        GeneralUtils.qs('#allowancesMountPanel')?.classList.toggle('is-hidden', valid !== 'allowances');
        GeneralUtils.qs('#recurringMountPanel')?.classList.toggle('is-hidden', valid !== 'recurring');
        GeneralUtils.refreshIcons();
        },

        resetAllowanceForm() {
        this.editingAllowanceId = null;
        const todayISO = DateTimeUtils.formatLocalISODate(new Date());
        const idInput = GeneralUtils.qs('#alwIdInput');
        const nameInput = GeneralUtils.qs('#alwNameInput');
        const amountInput = GeneralUtils.qs('#alwAmountInput');
        const freqSelect = GeneralUtils.qs('#alwFrequencySelect');
        const catSelect = GeneralUtils.qs('#alwCategorySelect');
        const startInput = GeneralUtils.qs('#alwStartDateInput');
        const noteInput = GeneralUtils.qs('#alwNoteInput');
        const titleEl = GeneralUtils.qs('#alwFormTitleText');
        const submitEl = GeneralUtils.qs('#alwSubmitBtnText');
        const cancelBtn = GeneralUtils.qs('#alwCancelEditBtn');
        const errEl = GeneralUtils.qs('#alwFormError');

        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
        if (amountInput) amountInput.value = '';
        if (freqSelect) freqSelect.value = 'monthly';
        if (catSelect) catSelect.value = TransactionService.CATEGORIES.income[0];
        if (startInput) startInput.value = todayISO;
        if (noteInput) noteInput.value = '';
        if (titleEl) titleEl.textContent = 'Thêm khoản trợ cấp';
        if (submitEl) submitEl.textContent = 'Lưu khoản trợ cấp';
        if (cancelBtn) cancelBtn.classList.add('is-hidden');
        if (errEl) {
        errEl.textContent = '';
        errEl.classList.add('is-hidden');
        }
        },

        startEditingAllowance(id) {
        const item = this.allAllowances.find((a) => a.id === id);
        if (!item) return;

        this.editingAllowanceId = item.id;
        GeneralUtils.qs('#alwIdInput').value = item.id;
        GeneralUtils.qs('#alwNameInput').value = item.name;
        GeneralUtils.qs('#alwAmountInput').value = item.amount;
        GeneralUtils.qs('#alwFrequencySelect').value = item.frequency;
        GeneralUtils.qs('#alwCategorySelect').value = item.category;
        GeneralUtils.qs('#alwStartDateInput').value = item.startDate;
        GeneralUtils.qs('#alwNoteInput').value = item.note || '';
        GeneralUtils.qs('#alwFormTitleText').textContent = 'Chỉnh sửa khoản trợ cấp';
        GeneralUtils.qs('#alwSubmitBtnText').textContent = 'Cập nhật trợ cấp';
        GeneralUtils.qs('#alwCancelEditBtn')?.classList.remove('is-hidden');
        GeneralUtils.qs('#alwFormError')?.classList.add('is-hidden');
        GeneralUtils.qs('#allowanceForm')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        },

        resetRecurringForm() {
        this.editingRecurringId = null;
        const todayISO = DateTimeUtils.formatLocalISODate(new Date());
        const idInput = GeneralUtils.qs('#recIdInput');
        const nameInput = GeneralUtils.qs('#recNameInput');
        const amountInput = GeneralUtils.qs('#recAmountInput');
        const freqSelect = GeneralUtils.qs('#recFrequencySelect');
        const catSelect = GeneralUtils.qs('#recCategorySelect');
        const startInput = GeneralUtils.qs('#recStartDateInput');
        const noteInput = GeneralUtils.qs('#recNoteInput');
        const titleEl = GeneralUtils.qs('#recFormTitleText');
        const submitEl = GeneralUtils.qs('#recSubmitBtnText');
        const cancelBtn = GeneralUtils.qs('#recCancelEditBtn');
        const errEl = GeneralUtils.qs('#recFormError');

        if (idInput) idInput.value = '';
        if (nameInput) nameInput.value = '';
        if (amountInput) amountInput.value = '';
        if (freqSelect) freqSelect.value = 'monthly';
        if (catSelect) catSelect.value = TransactionService.CATEGORIES.expense[1] || TransactionService.CATEGORIES.expense[0];
        if (startInput) startInput.value = todayISO;
        if (noteInput) noteInput.value = '';
        if (titleEl) titleEl.textContent = 'Thêm chi phí định kỳ';
        if (submitEl) submitEl.textContent = 'Lưu chi phí định kỳ';
        if (cancelBtn) cancelBtn.classList.add('is-hidden');
        if (errEl) {
        errEl.textContent = '';
        errEl.classList.add('is-hidden');
        }
        },

        startEditingRecurring(id) {
        const item = this.allRecurring.find((r) => r.id === id);
        if (!item) return;

        this.editingRecurringId = item.id;
        GeneralUtils.qs('#recIdInput').value = item.id;
        GeneralUtils.qs('#recNameInput').value = item.name;
        GeneralUtils.qs('#recAmountInput').value = item.amount;
        GeneralUtils.qs('#recFrequencySelect').value = item.frequency;
        GeneralUtils.qs('#recCategorySelect').value = item.category;
        GeneralUtils.qs('#recStartDateInput').value = item.startDate;
        GeneralUtils.qs('#recNoteInput').value = item.note || '';
        GeneralUtils.qs('#recFormTitleText').textContent = 'Chỉnh sửa chi phí định kỳ';
        GeneralUtils.qs('#recSubmitBtnText').textContent = 'Cập nhật chi phí';
        GeneralUtils.qs('#recCancelEditBtn')?.classList.remove('is-hidden');
        GeneralUtils.qs('#recFormError')?.classList.add('is-hidden');
        GeneralUtils.qs('#recurringForm')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        },

        async reloadAndRender() {
        try {
        this.allAllowances = await Database.getAllAllowances();
        this.allRecurring = await Database.getAllRecurringExpenses();
        } catch (err) {
        console.error('[AllowanceRecurringUI] Lỗi tải dữ liệu:', err);
        this.allAllowances = [];
        this.allRecurring = [];
        }
        this.renderAllowancesList();
        this.renderRecurringList();
        },

        renderAllowancesList() {
        const container = GeneralUtils.qs('#alwListContainer');
        const emptyEl = GeneralUtils.qs('#alwEmptyState');
        const badgeEl = GeneralUtils.qs('#alwCountBadge');
        if (!container || !emptyEl) return;

        if (badgeEl) badgeEl.textContent = `${this.allAllowances.length} khoản trợ cấp`;

        if (this.allAllowances.length === 0) {
        container.innerHTML = '';
        emptyEl.classList.remove('is-hidden');
        return;
        }

        emptyEl.classList.add('is-hidden');
        const sorted = [...this.allAllowances].sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        );

        container.innerHTML = sorted
        .map((item) => {
        const cycle = ScheduleCycleHelper.getCurrentCycleInfo(item.frequency);
        const isConfirmed = ScheduleCycleHelper.isConfirmedForCycle(item, cycle.cycleKey);
        const freqLabel = ScheduleCycleHelper.FREQUENCY_LABELS[item.frequency] || 'Hàng tháng';
        const totalTimes = Array.isArray(item.confirmedCycles) ? item.confirmedCycles.length : 0;

        return `
        <article class="budget-item-card ${isConfirmed ? 'budget-item-card--completed' : ''}">
        <div class="budget-item-card__top">
        <div class="budget-item-card__title-group">
        <div class="budget-item-card__title">
        <i data-lucide="hand-coins" style="width: 18px; height: 18px; color: var(--color-success);"></i>
        <span>${GeneralUtils.escapeHTML(item.name)}</span>
        <span class="cycle-badge">${GeneralUtils.escapeHTML(freqLabel)}</span>
        <span class="budget-status-badge ${isConfirmed ? 'budget-status-badge--safe' : 'budget-status-badge--warning'}">
        ${isConfirmed ? 'Đã nhận kỳ này' : 'Chờ xác nhận nhận tiền'}
        </span>
        </div>
        <span class="budget-item-card__subtitle">
        Danh mục: ${GeneralUtils.escapeHTML(item.category)} • Ngày mốc: ${DateTimeUtils.formatDisplayDateVi(item.startDate)} • ${GeneralUtils.escapeHTML(cycle.cycleLabel)}
        </span>
        </div>

        <div class="tx-item__actions">
        <button type="button" class="btn-icon" data-alw-action="edit" data-id="${GeneralUtils.escapeHTML(item.id)}" title="Chỉnh sửa">
        <i data-lucide="pencil" style="width: 16px; height: 16px;"></i>
        </button>
        <button type="button" class="btn-icon btn-icon--danger" data-alw-action="delete" data-id="${GeneralUtils.escapeHTML(item.id)}" title="Xóa">
        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
        </button>
        </div>
        </div>

        ${item.note ? `<p style="font-size: var(--fs-xs); color: var(--text-secondary);">Ghi chú: ${GeneralUtils.escapeHTML(item.note)}</p>` : ''}

        <div class="savings-goal-actions-bar">
        <div>
        <span style="font-size: var(--fs-lg); font-weight: var(--fw-bold); color: var(--color-success);">
        +${GeneralUtils.formatCurrencyVND(item.amount)}
        </span>
        <span style="font-size: var(--fs-xs); color: var(--text-muted); margin-left: var(--space-2);">
        (Đã nhận tổng cộng ${totalTimes} kỳ${item.lastConfirmedDate ? ` • Gần nhất: ${DateTimeUtils.formatDisplayDateVi(item.lastConfirmedDate)}` : ''})
        </span>
        </div>

        ${
        isConfirmed
        ? `<button type="button" class="btn-chip btn-chip--done" disabled>
        <i data-lucide="check-check" style="width: 15px; height: 15px;"></i>
        <span>Đã tạo giao dịch Thu nhập (${GeneralUtils.escapeHTML(cycle.cycleLabel)})</span>
        </button>`
        : `<button type="button" class="btn-chip btn-chip--deposit" data-alw-action="confirm" data-id="${GeneralUtils.escapeHTML(item.id)}">
        <i data-lucide="check-circle-2" style="width: 15px; height: 15px;"></i>
        <span>Xác nhận đã nhận tiền (+Tạo Thu nhập)</span>
        </button>`
        }
        </div>
        </article>
        `;
        })
        .join('');
        },

        renderRecurringList() {
        const container = GeneralUtils.qs('#recListContainer');
        const emptyEl = GeneralUtils.qs('#recEmptyState');
        const badgeEl = GeneralUtils.qs('#recCountBadge');
        if (!container || !emptyEl) return;

        if (badgeEl) badgeEl.textContent = `${this.allRecurring.length} khoản định kỳ`;

        if (this.allRecurring.length === 0) {
        container.innerHTML = '';
        emptyEl.classList.remove('is-hidden');
        return;
        }

        emptyEl.classList.add('is-hidden');
        const sorted = [...this.allRecurring].sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        );

        container.innerHTML = sorted
        .map((item) => {
        const cycle = ScheduleCycleHelper.getCurrentCycleInfo(item.frequency);
        const isPaid = ScheduleCycleHelper.isConfirmedForCycle(item, cycle.cycleKey);
        const freqLabel = ScheduleCycleHelper.FREQUENCY_LABELS[item.frequency] || 'Hàng tháng';
        const totalTimes = Array.isArray(item.confirmedCycles) ? item.confirmedCycles.length : 0;

        return `
        <article class="budget-item-card ${isPaid ? 'budget-item-card--completed' : ''}">
        <div class="budget-item-card__top">
        <div class="budget-item-card__title-group">
        <div class="budget-item-card__title">
        <i data-lucide="calendar-clock" style="width: 18px; height: 18px; color: var(--color-danger);"></i>
        <span>${GeneralUtils.escapeHTML(item.name)}</span>
        <span class="cycle-badge">${GeneralUtils.escapeHTML(freqLabel)}</span>
        <span class="budget-status-badge ${isPaid ? 'budget-status-badge--safe' : 'budget-status-badge--danger'}">
        ${isPaid ? 'Đã thanh toán kỳ này' : 'Chưa thanh toán kỳ này'}
        </span>
        </div>
        <span class="budget-item-card__subtitle">
        Danh mục: ${GeneralUtils.escapeHTML(item.category)} • Ngày mốc: ${DateTimeUtils.formatDisplayDateVi(item.startDate)} • ${GeneralUtils.escapeHTML(cycle.cycleLabel)}
        </span>
        </div>

        <div class="tx-item__actions">
        <button type="button" class="btn-icon" data-rec-action="edit" data-id="${GeneralUtils.escapeHTML(item.id)}" title="Chỉnh sửa">
        <i data-lucide="pencil" style="width: 16px; height: 16px;"></i>
        </button>
        <button type="button" class="btn-icon btn-icon--danger" data-rec-action="delete" data-id="${GeneralUtils.escapeHTML(item.id)}" title="Xóa">
        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
        </button>
        </div>
        </div>

        ${item.note ? `<p style="font-size: var(--fs-xs); color: var(--text-secondary);">Ghi chú: ${GeneralUtils.escapeHTML(item.note)}</p>` : ''}

        <div class="savings-goal-actions-bar">
        <div>
        <span style="font-size: var(--fs-lg); font-weight: var(--fw-bold); color: var(--color-danger);">
        -${GeneralUtils.formatCurrencyVND(item.amount)}
        </span>
        <span style="font-size: var(--fs-xs); color: var(--text-muted); margin-left: var(--space-2);">
        (Đã thanh toán ${totalTimes} kỳ${item.lastConfirmedDate ? ` • Gần nhất: ${DateTimeUtils.formatDisplayDateVi(item.lastConfirmedDate)}` : ''})
        </span>
        </div>

        ${
        isPaid
        ? `<button type="button" class="btn-chip btn-chip--done" disabled>
        <i data-lucide="check-check" style="width: 15px; height: 15px;"></i>
        <span>Đã tạo giao dịch Chi tiêu (${GeneralUtils.escapeHTML(cycle.cycleLabel)})</span>
        </button>`
        : `<button type="button" class="btn-chip btn-chip--withdraw" data-rec-action="confirm" data-id="${GeneralUtils.escapeHTML(item.id)}">
        <i data-lucide="check-circle-2" style="width: 15px; height: 15px;"></i>
        <span>Xác nhận đã thanh toán (-Tạo Chi tiêu)</span>
        </button>`
        }
        </div>
        </article>
        `;
        })
        .join('');
        },

        bindEvents() {
        GeneralUtils.qsa('[data-tx-workspace-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
        this.switchWorkspaceTab(btn.getAttribute('data-tx-workspace-tab'));
        });
        });

        const alwForm = GeneralUtils.qs('#allowanceForm');
        if (alwForm) {
        alwForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = GeneralUtils.qs('#alwFormError');
        if (errEl) errEl.classList.add('is-hidden');

        const payload = {
        name: GeneralUtils.qs('#alwNameInput')?.value,
        amount: GeneralUtils.qs('#alwAmountInput')?.value,
        frequency: GeneralUtils.qs('#alwFrequencySelect')?.value,
        category: GeneralUtils.qs('#alwCategorySelect')?.value,
        startDate: GeneralUtils.qs('#alwStartDateInput')?.value,
        note: GeneralUtils.qs('#alwNoteInput')?.value
        };

        try {
        const res = await AllowanceService.saveAllowance(payload, this.editingAllowanceId);
        NotificationManager.showToast(
        res.mode === 'updated'
        ? 'Đã cập nhật khoản trợ cấp!'
        : 'Đã thêm khoản trợ cấp mới! Hãy nhấn xác nhận khi bạn thực sự nhận tiền.',
        'success'
        );
        this.resetAllowanceForm();
        await FinancialUI.reloadAndRenderAll();
        } catch (err) {
        if (errEl) {
        errEl.textContent = err.message || 'Dữ liệu khoản trợ cấp không hợp lệ.';
        errEl.classList.remove('is-hidden');
        }
        }
        });
        }

        GeneralUtils.qs('#alwCancelEditBtn')?.addEventListener('click', () => this.resetAllowanceForm());

        const recForm = GeneralUtils.qs('#recurringForm');
        if (recForm) {
        recForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const errEl = GeneralUtils.qs('#recFormError');
        if (errEl) errEl.classList.add('is-hidden');

        const payload = {
        name: GeneralUtils.qs('#recNameInput')?.value,
        amount: GeneralUtils.qs('#recAmountInput')?.value,
        frequency: GeneralUtils.qs('#recFrequencySelect')?.value,
        category: GeneralUtils.qs('#recCategorySelect')?.value,
        startDate: GeneralUtils.qs('#recStartDateInput')?.value,
        note: GeneralUtils.qs('#recNoteInput')?.value
        };

        try {
        const res = await RecurringExpenseService.saveRecurringExpense(payload, this.editingRecurringId);
        NotificationManager.showToast(
        res.mode === 'updated'
        ? 'Đã cập nhật chi phí định kỳ!'
        : 'Đã lưu chi phí định kỳ! Hệ thống không tự trừ tiền cho đến khi bạn bấm xác nhận thanh toán.',
        'success'
        );
        this.resetRecurringForm();
        await FinancialUI.reloadAndRenderAll();
        } catch (err) {
        if (errEl) {
        errEl.textContent = err.message || 'Dữ liệu chi phí định kỳ không hợp lệ.';
        errEl.classList.remove('is-hidden');
        }
        }
        });
        }

        GeneralUtils.qs('#recCancelEditBtn')?.addEventListener('click', () => this.resetRecurringForm());

        const alwList = GeneralUtils.qs('#alwListContainer');
        if (alwList) {
        alwList.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-alw-action]');
        if (!btn || this.isProcessingConfirm) return;

        const action = btn.getAttribute('data-alw-action');
        const id = btn.getAttribute('data-id');
        if (!id) return;

        if (action === 'edit') {
        this.startEditingAllowance(id);
        } else if (action === 'delete') {
        const item = this.allAllowances.find((a) => a.id === id);
        NotificationManager.openConfirmModal(
        id,
        `Bạn có chắc chắn muốn xóa khoản trợ cấp "${item ? item.name : ''}" không? Các giao dịch thu nhập đã xác nhận trước đó vẫn được giữ nguyên.`,
        async (confirmedId) => {
        await AllowanceService.deleteAllowance(confirmedId);
        if (this.editingAllowanceId === confirmedId) this.resetAllowanceForm();
        await FinancialUI.reloadAndRenderAll();
        NotificationManager.showToast('Đã xóa khoản trợ cấp.', 'info');
        },
        'Xác nhận xóa khoản trợ cấp'
        );
        } else if (action === 'confirm') {
        try {
        this.isProcessingConfirm = true;
        const res = await AllowanceService.confirmReceived(id);
        await FinancialUI.reloadAndRenderAll();
        NotificationManager.showToast(
        `Đã xác nhận nhận tiền "${res.allowance.name}" và tạo giao dịch Thu nhập +${GeneralUtils.formatCurrencyVND(res.allowance.amount)}!`,
        'success'
        );
        } catch (err) {
        NotificationManager.showToast(err.message || 'Không thể xác nhận khoản trợ cấp.', 'error');
        } finally {
        this.isProcessingConfirm = false;
        }
        }
        });
        }

        const recList = GeneralUtils.qs('#recListContainer');
        if (recList) {
        recList.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-rec-action]');
        if (!btn || this.isProcessingConfirm) return;

        const action = btn.getAttribute('data-rec-action');
        const id = btn.getAttribute('data-id');
        if (!id) return;

        if (action === 'edit') {
        this.startEditingRecurring(id);
        } else if (action === 'delete') {
        const item = this.allRecurring.find((r) => r.id === id);
        NotificationManager.openConfirmModal(
        id,
        `Bạn có chắc chắn muốn xóa chi phí định kỳ "${item ? item.name : ''}" không? Các giao dịch chi tiêu đã thanh toán trước đó vẫn được giữ nguyên.`,
        async (confirmedId) => {
        await RecurringExpenseService.deleteRecurringExpense(confirmedId);
        if (this.editingRecurringId === confirmedId) this.resetRecurringForm();
        await FinancialUI.reloadAndRenderAll();
        NotificationManager.showToast('Đã xóa chi phí định kỳ.', 'info');
        },
        'Xác nhận xóa chi phí định kỳ'
        );
        } else if (action === 'confirm') {
        try {
        this.isProcessingConfirm = true;
        const res = await RecurringExpenseService.confirmPaid(id);
        await FinancialUI.reloadAndRenderAll();
        NotificationManager.showToast(
        `Đã xác nhận thanh toán "${res.recurring.name}" và tạo giao dịch Chi tiêu -${GeneralUtils.formatCurrencyVND(res.recurring.amount)}!`,
        'success'
        );
        } catch (err) {
        NotificationManager.showToast(err.message || 'Không thể xác nhận thanh toán.', 'error');
        } finally {
        this.isProcessingConfirm = false;
        }
        }
        });
        }
        }
        };

        /* ========================================================================
        15. PROFILE MANAGEMENT (Local Storage + Header Sync)
        ======================================================================== */
        const ProfileUI = {
        DEFAULT_PROFILE: {
        fullName: 'Sinh viên',
        email: '',
        school: '',
        major: '',
        classYear: '',
        bio: '',
        avatarDataUrl: '',
        avatarBg: '#2563eb'
        },

        profile: null,

        init() {
        const saved = GeneralUtils.getStorage(GeneralUtils.STORAGE_KEYS.PROFILE, null);
        this.profile = {
        ...this.DEFAULT_PROFILE,
        ...(saved && typeof saved === 'object' ? saved : {})
        };
        this.renderProfileToUI();
        this.bindEvents();
        },

        getInitials(nameStr) {
        const clean = String(nameStr || 'SV').trim();
        if (!clean) return 'SV';
        const parts = clean.split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        },

        renderProfileToUI() {
        const p = this.profile || this.DEFAULT_PROFILE;
        const initials = this.getInitials(p.fullName);

        const headerBtn = GeneralUtils.qs('#headerProfileBtn');
        if (headerBtn) {
        const circleEl = headerBtn.querySelector('.avatar-circle');
        const labelEl = headerBtn.querySelector('.avatar-label');
        if (circleEl) {
        if (p.avatarDataUrl) {
        circleEl.style.background = 'transparent';
        circleEl.innerHTML = `<img src="${GeneralUtils.escapeHTML(p.avatarDataUrl)}" alt="Avatar" />`;
        } else {
        circleEl.style.background = p.avatarBg || '#2563eb';
        circleEl.style.color = '#ffffff';
        circleEl.textContent = initials;
        }
        }
        if (labelEl) {
        labelEl.textContent = p.fullName || 'Sinh viên';
        }
        }

        const largeAvatar = GeneralUtils.qs('#profileAvatarPreview');
        if (largeAvatar) {
        if (p.avatarDataUrl) {
        largeAvatar.style.background = 'transparent';
        largeAvatar.innerHTML = `<img src="${GeneralUtils.escapeHTML(p.avatarDataUrl)}" alt="Avatar sinh viên" />`;
        } else {
        largeAvatar.style.background = p.avatarBg || '#2563eb';
        largeAvatar.style.color = '#ffffff';
        largeAvatar.textContent = initials;
        }
        }

        const setTxt = (sel, val, fallback) => {
        const el = GeneralUtils.qs(sel);
        if (el) el.textContent = val && String(val).trim() ? val : fallback;
        };

        setTxt('#profileCardName', p.fullName, 'Sinh viên');
        setTxt('#profileCardMajor', p.major, 'Chưa cập nhật chuyên ngành');
        setTxt('#profileCardEmail', p.email, 'Chưa cập nhật');
        setTxt('#profileCardSchool', p.school, 'Chưa cập nhật');
        setTxt('#profileCardClass', p.classYear, 'Chưa cập nhật');

        const setVal = (sel, val) => {
        const el = GeneralUtils.qs(sel);
        if (el) el.value = val || '';
        };
        setVal('#profNameInput', p.fullName);
        setVal('#profEmailInput', p.email);
        setVal('#profSchoolInput', p.school);
        setVal('#profMajorInput', p.major);
        setVal('#profClassYearInput', p.classYear);
        setVal('#profBioInput', p.bio);

        GeneralUtils.qsa('[data-avatar-bg]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-avatar-bg') === p.avatarBg);
        btn.textContent = initials;
        });
        },

        saveProfile(nextProfile) {
        this.profile = {
        ...this.DEFAULT_PROFILE,
        ...nextProfile
        };
        GeneralUtils.setStorage(GeneralUtils.STORAGE_KEYS.PROFILE, this.profile);
        this.renderProfileToUI();
        },

        bindEvents() {
        const form = GeneralUtils.qs('#profileForm');
        if (form) {
        form.addEventListener('submit', (e) => {
        e.preventDefault();
        const errEl = GeneralUtils.qs('#profileFormError');
        if (errEl) errEl.classList.add('is-hidden');

        const fullName = String(GeneralUtils.qs('#profNameInput')?.value || '').trim();
        const email = String(GeneralUtils.qs('#profEmailInput')?.value || '').trim();

        if (!fullName) {
        if (errEl) {
        errEl.textContent = 'Vui lòng nhập họ và tên sinh viên.';
        errEl.classList.remove('is-hidden');
        }
        return;
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (errEl) {
        errEl.textContent = 'Địa chỉ email không đúng định dạng.';
        errEl.classList.remove('is-hidden');
        }
        return;
        }

        this.saveProfile({
        ...this.profile,
        fullName,
        email,
        school: String(GeneralUtils.qs('#profSchoolInput')?.value || '').trim(),
        major: String(GeneralUtils.qs('#profMajorInput')?.value || '').trim(),
        classYear: String(GeneralUtils.qs('#profClassYearInput')?.value || '').trim(),
        bio: String(GeneralUtils.qs('#profBioInput')?.value || '').trim()
        });

        NotificationManager.showToast('Đã lưu thông tin hồ sơ cá nhân thành công!', 'success');
        });
        }

        GeneralUtils.qs('#profResetBtn')?.addEventListener('click', () => {
        this.saveProfile({ ...this.DEFAULT_PROFILE });
        NotificationManager.showToast('Đã khôi phục hồ sơ về mặc định.', 'info');
        });

        GeneralUtils.qsa('[data-avatar-bg]').forEach((btn) => {
        btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-avatar-bg') || '#2563eb';
        this.saveProfile({
        ...this.profile,
        avatarBg: color,
        avatarDataUrl: ''
        });
        });
        });

        GeneralUtils.qs('#profileRemoveAvatarBtn')?.addEventListener('click', () => {
        this.saveProfile({
        ...this.profile,
        avatarDataUrl: ''
        });
        NotificationManager.showToast('Đã chuyển sang ảnh đại diện chữ cái.', 'info');
        });

        const fileInput = GeneralUtils.qs('#profileAvatarFileInput');
        if (fileInput) {
        fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
        NotificationManager.showToast('Vui lòng chọn tệp hình ảnh hợp lệ.', 'error');
        fileInput.value = '';
        return;
        }

        if (file.size > 1.5 * 1024 * 1024) {
        NotificationManager.showToast('Kích thước ảnh đại diện không được vượt quá 1.5MB.', 'error');
        fileInput.value = '';
        return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
        const dataUrl = String(ev.target?.result || '');
        if (dataUrl.startsWith('data:image/')) {
        this.saveProfile({
        ...this.profile,
        avatarDataUrl: dataUrl
        });
        NotificationManager.showToast('Đã cập nhật ảnh đại diện mới!', 'success');
        }
        };
        reader.readAsDataURL(file);
        fileInput.value = '';
        });
        }
        }
        };

        /* ========================================================================
        16. SETTINGS & BACKUP / RESTORE (JSON)
        ======================================================================== */
        const SettingsBackupUI = {
        DEFAULT_SETTINGS: {
        dateFormat: 'DD/MM/YYYY',
        defaultRoute: 'dashboard',
        showWelcomeBanner: true,
        currency: 'VND'
        },

        settings: null,

        init() {
        const saved = GeneralUtils.getStorage(GeneralUtils.STORAGE_KEYS.SETTINGS, null);
        this.settings = {
        ...this.DEFAULT_SETTINGS,
        ...(saved && typeof saved === 'object' ? saved : {}),
        currency: 'VND'
        };
        this.applySettingsToApp(false);
        this.syncFormControls();
        this.bindEvents();
        },

        applySettingsToApp(reRenderViews = false) {
        const s = this.settings || this.DEFAULT_SETTINGS;
        DateTimeUtils.dateFormatPreference = s.dateFormat || 'DD/MM/YYYY';

        const welcomeCard = GeneralUtils.qs('#dashboardWelcomeCard');
        if (welcomeCard) {
        welcomeCard.classList.toggle('is-hidden', !s.showWelcomeBanner);
        }

        if (reRenderViews && FinancialUI.allTransactions) {
        FinancialUI.renderDashboardWidgets();
        FinancialUI.renderTransactionsList();
        AnalyticsUI.renderAll(FinancialUI.allTransactions);
        SavingsAiUI.renderGoalsList();
        AllowanceRecurringUI.renderAllowancesList();
        AllowanceRecurringUI.renderRecurringList();
        GeneralUtils.refreshIcons();
        }
        },

        syncFormControls() {
        const s = this.settings || this.DEFAULT_SETTINGS;
        const fmtSelect = GeneralUtils.qs('#setDateFormatSelect');
        const routeSelect = GeneralUtils.qs('#setDefaultRouteSelect');
        const welcomeChk = GeneralUtils.qs('#setShowWelcomeCheckbox');

        if (fmtSelect) fmtSelect.value = s.dateFormat || 'DD/MM/YYYY';
        if (routeSelect) routeSelect.value = s.defaultRoute || 'dashboard';
        if (welcomeChk) welcomeChk.checked = Boolean(s.showWelcomeBanner);
        },

        async refreshStatsDisplay() {
        try {
        const [txs, bgs, sgs, scs, alws, recs] = await Promise.all([
        Database.getAllTransactions(),
        Database.getAllBudgets(),
        Database.getAllSavingsGoals(),
        Database.getAllSavingsContributions(),
        Database.getAllAllowances(),
        Database.getAllRecurringExpenses()
        ]);

        const setTxt = (sel, val) => {
        const el = GeneralUtils.qs(sel);
        if (el) el.textContent = String(val);
        };

        setTxt('#bkStatTxCount', txs.length);
        setTxt('#bkStatBudgetCount', bgs.length);
        setTxt('#bkStatSavingsCount', `${sgs.length} / ${scs.length}`);
        setTxt('#bkStatSchedulesCount', `${alws.length} / ${recs.length}`);
        } catch (err) {
        console.warn('[SettingsBackupUI] Không thể tải thống kê:', err);
        }
        },

        async exportFinancialDataAsJson() {
        const prevDb = Database.dbInstance;
        try {
        if (Database.realDbInstance) {
        Database.dbInstance = Database.realDbInstance;
        }
        const [
        transactions,
        budgets,
        savingsGoals,
        savingsContributions,
        allowances,
        recurringExpenses
        ] = await Promise.all([
        Database.getAllTransactions(),
        Database.getAllBudgets(),
        Database.getAllSavingsGoals(),
        Database.getAllSavingsContributions(),
        Database.getAllAllowances(),
        Database.getAllRecurringExpenses()
        ]);

        const backupPayload = {
        app: 'StudentWallet',
        schemaVersion: 6,
        dbVersion: Database.DB_VERSION,
        exportedAt: new Date().toISOString(),
        currency: 'VND',
        includesProfile: false,
        data: {
        transactions,
        budgets,
        savingsGoals,
        savingsContributions,
        allowances,
        recurringExpenses
        }
        };

        const jsonStr = JSON.stringify(backupPayload, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const dateStamp = DateTimeUtils.formatLocalISODate(new Date());

        const a = document.createElement('a');
        a.href = url;
        a.download = `student-wallet-backup-${dateStamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        NotificationManager.showToast('Đã xuất file sao lưu dữ liệu THẬT (.JSON) thành công!', 'success');
        } catch (err) {
        console.error('[Backup Export Error]', err);
        NotificationManager.showToast('Không thể xuất file sao lưu.', 'error');
        } finally {
        Database.dbInstance = prevDb;
        }
        },

        validateBackupJsonObject(parsed) {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Cấu trúc file JSON không hợp lệ (Không phải đối tượng dữ liệu).');
        }

        const root = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
        const hasAnyStore = [
        'transactions',
        'budgets',
        'savingsGoals',
        'savingsContributions',
        'allowances',
        'recurringExpenses'
        ].some((k) => Array.isArray(root[k]));

        if (!hasAnyStore) {
        throw new Error('File JSON không chứa bất kỳ bảng dữ liệu tài chính hợp lệ nào của Student Wallet.');
        }

        const ensureArray = (arr, label) => {
        if (arr === undefined) return [];
        if (!Array.isArray(arr)) {
        throw new Error(`Trường "${label}" trong file JSON không phải là danh sách hợp lệ.`);
        }
        return arr;
        };

        const rawTx = ensureArray(root.transactions, 'transactions');
        const rawBg = ensureArray(root.budgets, 'budgets');
        const rawSg = ensureArray(root.savingsGoals, 'savingsGoals');
        const rawSc = ensureArray(root.savingsContributions, 'savingsContributions');
        const rawAlw = ensureArray(root.allowances, 'allowances');
        const rawRec = ensureArray(root.recurringExpenses, 'recurringExpenses');

        const cleanTransactions = rawTx.map((t, i) => {
        if (!t || typeof t !== 'object') throw new Error(`Giao dịch ở vị trí #${i + 1} bị hỏng.`);
        const check = TransactionService.validateInput(t);
        if (!check.isValid) {
        throw new Error(`Giao dịch #${i + 1} không hợp lệ: ${check.errors[0]}`);
        }
        return {
        id: String(t.id || GeneralUtils.generateUniqueId('tx')).trim(),
        ...check.sanitized,
        createdAt: t.createdAt || new Date().toISOString(),
        updatedAt: t.updatedAt || new Date().toISOString()
        };
        });

        const cleanBudgets = rawBg.map((b, i) => {
        if (!b || typeof b !== 'object') throw new Error(`Ngân sách ở vị trí #${i + 1} bị hỏng.`);
        const check = BudgetService.validateBudgetInput(b);
        if (!check.isValid) {
        throw new Error(`Ngân sách #${i + 1} không hợp lệ: ${check.errors[0]}`);
        }
        return {
        id: String(b.id || GeneralUtils.generateUniqueId('bg')).trim(),
        ...check.sanitized,
        createdAt: b.createdAt || new Date().toISOString(),
        updatedAt: b.updatedAt || new Date().toISOString()
        };
        });

        const cleanSavingsGoals = rawSg.map((g, i) => {
        if (!g || typeof g !== 'object') throw new Error(`Mục tiêu tiết kiệm #${i + 1} bị hỏng.`);
        const check = SavingsService.validateGoalInput(g);
        if (!check.isValid) {
        throw new Error(`Mục tiêu tiết kiệm #${i + 1} không hợp lệ: ${check.errors[0]}`);
        }
        const currentAmount = Math.max(0, Math.round(Number(g.currentAmount) || 0));
        return {
        id: String(g.id || GeneralUtils.generateUniqueId('sg')).trim(),
        ...check.sanitized,
        currentAmount,
        status: g.status === 'completed' || currentAmount >= check.sanitized.targetAmount ? 'completed' : 'active',
        createdAt: g.createdAt || new Date().toISOString(),
        updatedAt: g.updatedAt || new Date().toISOString()
        };
        });

        const cleanSavingsContributions = rawSc.map((c, i) => {
        if (!c || typeof c !== 'object' || !c.goalId) {
        throw new Error(`Lịch sử đóng góp tiết kiệm #${i + 1} thiếu mã mục tiêu.`);
        }
        const amount = Math.round(Number(c.amount));
        if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`Lịch sử đóng góp #${i + 1} có số tiền không hợp lệ.`);
        }
        return {
        id: String(c.id || GeneralUtils.generateUniqueId('sc')).trim(),
        goalId: String(c.goalId).trim(),
        type: c.type === 'withdraw' ? 'withdraw' : 'deposit',
        amount,
        date: /^\d{4}-\d{2}-\d{2}$/.test(c.date) ? c.date : DateTimeUtils.formatLocalISODate(new Date()),
        note: String(c.note || '').trim(),
        createdAt: c.createdAt || new Date().toISOString()
        };
        });

        const cleanAllowances = rawAlw.map((a, i) => {
        if (!a || typeof a !== 'object') throw new Error(`Khoản trợ cấp #${i + 1} bị hỏng.`);
        const check = AllowanceService.validateInput(a);
        if (!check.isValid) {
        throw new Error(`Khoản trợ cấp #${i + 1} không hợp lệ: ${check.errors[0]}`);
        }
        return {
        id: String(a.id || GeneralUtils.generateUniqueId('alw')).trim(),
        ...check.sanitized,
        confirmedCycles: Array.isArray(a.confirmedCycles) ? a.confirmedCycles : [],
        lastConfirmedCycleKey: a.lastConfirmedCycleKey || null,
        lastConfirmedDate: a.lastConfirmedDate || null,
        lastConfirmedAt: a.lastConfirmedAt || null,
        lastTransactionId: a.lastTransactionId || null,
        createdAt: a.createdAt || new Date().toISOString(),
        updatedAt: a.updatedAt || new Date().toISOString()
        };
        });

        const cleanRecurringExpenses = rawRec.map((r, i) => {
        if (!r || typeof r !== 'object') throw new Error(`Chi phí định kỳ #${i + 1} bị hỏng.`);
        const check = RecurringExpenseService.validateInput(r);
        if (!check.isValid) {
        throw new Error(`Chi phí định kỳ #${i + 1} không hợp lệ: ${check.errors[0]}`);
        }
        return {
        id: String(r.id || GeneralUtils.generateUniqueId('rec')).trim(),
        ...check.sanitized,
        confirmedCycles: Array.isArray(r.confirmedCycles) ? r.confirmedCycles : [],
        lastConfirmedCycleKey: r.lastConfirmedCycleKey || null,
        lastConfirmedDate: r.lastConfirmedDate || null,
        lastConfirmedAt: r.lastConfirmedAt || null,
        lastTransactionId: r.lastTransactionId || null,
        createdAt: r.createdAt || new Date().toISOString(),
        updatedAt: r.updatedAt || new Date().toISOString()
        };
        });

        return {
        transactions: cleanTransactions,
        budgets: cleanBudgets,
        savingsGoals: cleanSavingsGoals,
        savingsContributions: cleanSavingsContributions,
        allowances: cleanAllowances,
        recurringExpenses: cleanRecurringExpenses
        };
        },

        async buildDeduplicatedDataset(validatedDataset, mode = 'merge') {
        const dedupeList = (existingList, incomingList, signatureFn) => {
        const base = mode === 'overwrite' ? [] : [...existingList];
        const idSet = new Set(base.map((x) => x.id));
        const sigSet = new Set(base.map((x) => signatureFn(x)));

        incomingList.forEach((item) => {
        const sig = signatureFn(item);
        if (idSet.has(item.id) || sigSet.has(sig)) {
        return;
        }
        idSet.add(item.id);
        sigSet.add(sig);
        base.push(item);
        });

        return base;
        };

        const [curTx, curBg, curSg, curSc, curAlw, curRec] =
        mode === 'overwrite'
        ? [[], [], [], [], [], []]
        : await Promise.all([
        Database.getAllTransactions(),
        Database.getAllBudgets(),
        Database.getAllSavingsGoals(),
        Database.getAllSavingsContributions(),
        Database.getAllAllowances(),
        Database.getAllRecurringExpenses()
        ]);

        return {
        transactions: dedupeList(
        curTx,
        validatedDataset.transactions,
        (x) => `${x.type}|${x.amount}|${x.category}|${x.date}|${x.note}`
        ),
        budgets: dedupeList(
        curBg,
        validatedDataset.budgets,
        (x) => `${x.periodKey}|${x.scope}|${x.category}`
        ),
        savingsGoals: dedupeList(
        curSg,
        validatedDataset.savingsGoals,
        (x) => `${x.name.toLowerCase()}|${x.targetAmount}|${x.startDate}|${x.targetDate}`
        ),
        savingsContributions: dedupeList(
        curSc,
        validatedDataset.savingsContributions,
        (x) => `${x.goalId}|${x.type}|${x.amount}|${x.date}|${x.note}`
        ),
        allowances: dedupeList(
        curAlw,
        validatedDataset.allowances,
        (x) => `${x.name.toLowerCase()}|${x.amount}|${x.frequency}|${x.category}`
        ),
        recurringExpenses: dedupeList(
        curRec,
        validatedDataset.recurringExpenses,
        (x) => `${x.name.toLowerCase()}|${x.amount}|${x.frequency}|${x.category}`
        )
        };
        },

        async executeImportDataset(validatedDataset, mode) {
        const prevDb = Database.dbInstance;
        try {
        if (Database.realDbInstance) {
        Database.dbInstance = Database.realDbInstance;
        }
        const finalDataset = await this.buildDeduplicatedDataset(validatedDataset, mode);
        await Database.importFinancialDataset(finalDataset, true);
        } finally {
        Database.dbInstance = prevDb;
        }
        await FinancialUI.reloadAndRenderAll();
        NotificationManager.showToast(
        mode === 'overwrite'
        ? 'Đã ghi đè và khôi phục vào dữ liệu THẬT thành công!'
        : 'Đã gộp bản sao lưu vào dữ liệu THẬT thành công (loại bỏ trùng lặp)!',
        'success'
        );
        },

        bindEvents() {
        const prefForm = GeneralUtils.qs('#settingsPreferencesForm');
        if (prefForm) {
        prefForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.settings = {
        ...this.settings,
        dateFormat: GeneralUtils.qs('#setDateFormatSelect')?.value || 'DD/MM/YYYY',
        defaultRoute: GeneralUtils.qs('#setDefaultRouteSelect')?.value || 'dashboard',
        showWelcomeBanner: Boolean(GeneralUtils.qs('#setShowWelcomeCheckbox')?.checked),
        currency: 'VND'
        };
        GeneralUtils.setStorage(GeneralUtils.STORAGE_KEYS.SETTINGS, this.settings);
        this.applySettingsToApp(true);
        NotificationManager.showToast('Đã lưu cài đặt hệ thống!', 'success');
        });
        }

        GeneralUtils.qs('#exportBackupJsonBtn')?.addEventListener('click', () => {
        this.exportFinancialDataAsJson();
        });

        GeneralUtils.qs('#importBackupJsonBtn')?.addEventListener('click', () => {
        const fileInput = GeneralUtils.qs('#importBackupFileInput');
        const modeSelect = GeneralUtils.qs('#importBackupModeSelect');
        const errEl = GeneralUtils.qs('#backupImportError');
        if (errEl) errEl.classList.add('is-hidden');

        const file = fileInput?.files && fileInput.files[0];
        if (!file) {
        if (errEl) {
        errEl.textContent = 'Vui lòng chọn file .JSON sao lưu cần khôi phục.';
        errEl.classList.remove('is-hidden');
        }
        return;
        }

        const mode = modeSelect?.value === 'overwrite' ? 'overwrite' : 'merge';
        const reader = new FileReader();

        reader.onload = async (ev) => {
        try {
        const rawText = String(ev.target?.result || '');
        let parsed;
        try {
        parsed = JSON.parse(rawText);
        } catch (syntaxErr) {
        throw new Error('File không đúng định dạng JSON chuẩn. Dữ liệu hiện tại của bạn vẫn an toàn.');
        }

        const validatedDataset = this.validateBackupJsonObject(parsed);

        if (mode === 'overwrite') {
        NotificationManager.openConfirmModal(
        'overwrite_backup',
        'Bạn đang chọn chế độ GHI ĐÈ (Overwrite). Toàn bộ dữ liệu tài chính hiện tại sẽ được thay thế bằng dữ liệu trong file sao lưu. (Hồ sơ cá nhân & Avatar vẫn được giữ nguyên). Bạn có chắc chắn muốn tiếp tục?',
        async () => {
        try {
        await this.executeImportDataset(validatedDataset, 'overwrite');
        fileInput.value = '';
        } catch (restoreErr) {
        NotificationManager.showToast(
        restoreErr.message || 'Khôi phục thất bại. Dữ liệu gốc được bảo toàn.',
        'error'
        );
        }
        },
        'Xác nhận ghi đè dữ liệu sao lưu'
        );
        } else {
        await this.executeImportDataset(validatedDataset, 'merge');
        fileInput.value = '';
        }
        } catch (validationErr) {
        if (errEl) {
        errEl.textContent = validationErr.message || 'Dữ liệu file sao lưu không hợp lệ.';
        errEl.classList.remove('is-hidden');
        }
        }
        };

        reader.onerror = () => {
        if (errEl) {
        errEl.textContent = 'Không thể đọc tệp đã chọn. Dữ liệu hiện tại của bạn vẫn an toàn.';
        errEl.classList.remove('is-hidden');
        }
        };

        reader.readAsText(file, 'utf-8');
        });
        }
        };

        /* ========================================================================
        17. DEMO MODE MANAGER (100% Isolated IndexedDB: StudentWalletDemoDB)
        ======================================================================== */
        const DemoModeManager = {
        isSwitching: false,

        async openDemoDatabase() {
        if (Database.useFallback || !window.indexedDB) return null;
        if (Database.demoDbInstance) return Database.demoDbInstance;

        return new Promise((resolve) => {
        try {
        const req = window.indexedDB.open(Database.DEMO_DB_NAME, Database.DB_VERSION);
        req.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(Database.STORE_TRANSACTIONS)) {
        const txStore = db.createObjectStore(Database.STORE_TRANSACTIONS, { keyPath: 'id' });
        txStore.createIndex('date', 'date', { unique: false });
        txStore.createIndex('type', 'type', { unique: false });
        txStore.createIndex('category', 'category', { unique: false });
        txStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(Database.STORE_BUDGETS)) {
        const bgStore = db.createObjectStore(Database.STORE_BUDGETS, { keyPath: 'id' });
        bgStore.createIndex('periodKey', 'periodKey', { unique: false });
        bgStore.createIndex('scope', 'scope', { unique: false });
        bgStore.createIndex('category', 'category', { unique: false });
        }
        if (Database.STORE_SAVINGS_GOALS && !db.objectStoreNames.contains(Database.STORE_SAVINGS_GOALS)) {
        const sgStore = db.createObjectStore(Database.STORE_SAVINGS_GOALS, { keyPath: 'id' });
        sgStore.createIndex('status', 'status', { unique: false });
        sgStore.createIndex('targetDate', 'targetDate', { unique: false });
        sgStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (Database.STORE_SAVINGS_CONTRIBUTIONS && !db.objectStoreNames.contains(Database.STORE_SAVINGS_CONTRIBUTIONS)) {
        const scStore = db.createObjectStore(Database.STORE_SAVINGS_CONTRIBUTIONS, { keyPath: 'id' });
        scStore.createIndex('goalId', 'goalId', { unique: false });
        scStore.createIndex('type', 'type', { unique: false });
        scStore.createIndex('date', 'date', { unique: false });
        scStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (Database.STORE_ALLOWANCES && !db.objectStoreNames.contains(Database.STORE_ALLOWANCES)) {
        const alwStore = db.createObjectStore(Database.STORE_ALLOWANCES, { keyPath: 'id' });
        alwStore.createIndex('frequency', 'frequency', { unique: false });
        alwStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        if (Database.STORE_RECURRING_EXPENSES && !db.objectStoreNames.contains(Database.STORE_RECURRING_EXPENSES)) {
        const recStore = db.createObjectStore(Database.STORE_RECURRING_EXPENSES, { keyPath: 'id' });
        recStore.createIndex('frequency', 'frequency', { unique: false });
        recStore.createIndex('createdAt', 'createdAt', { unique: false });
        }
        };
        req.onsuccess = (e) => {
        Database.demoDbInstance = e.target.result;
        resolve(Database.demoDbInstance);
        };
        req.onerror = () => resolve(null);
        } catch (err) {
        resolve(null);
        }
        });
        },

        buildSampleDataset() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const periodKey = DateTimeUtils.formatPeriodKey(year, month);
        
        // Lấy ngày hiện tại để làm mốc chặn
        const todayDay = now.getDate();
        
        // Ép các ngày của dữ liệu Demo không được vượt quá ngày hôm nay,
        // nhờ vậy giao dịch mới thêm vào (mặc định là hôm nay) sẽ luôn được đẩy lên top.
        const padDay = (d) => {
            const safeDay = Math.min(d, todayDay, 28);
            return `${periodKey}-${String(safeDay).padStart(2, '0')}`;
        };
        const nowISO = now.toISOString();

        return {
        transactions: [
        {
        id: 'demo_tx_1',
        type: 'income',
        amount: 3500000,
        category: 'Trợ cấp gia đình',
        date: padDay(1),
        note: '[Demo] Trợ cấp sinh hoạt phí đầu tháng từ gia đình',
        createdAt: nowISO,
        updatedAt: nowISO
        },
        {
        id: 'demo_tx_2',
        type: 'income',
        amount: 1800000,
        category: 'Làm thêm (Part-time)',
        date: padDay(5),
        note: '[Demo] Lương trợ giảng & gia sư lập trình',
        createdAt: nowISO,
        updatedAt: nowISO
        },
        {
        id: 'demo_tx_3',
        type: 'expense',
        amount: 1500000,
        category: 'Tiền trọ & Điện nước',
        date: padDay(2),
        note: '[Demo] Thanh toán tiền phòng trọ và Internet tháng này',
        createdAt: nowISO,
        updatedAt: nowISO
        },
        {
        id: 'demo_tx_4',
        type: 'expense',
        amount: 950000,
        category: 'Ăn uống & Sinh hoạt',
        date: padDay(6),
        note: '[Demo] Đi siêu thị mua thực phẩm & ăn uống tuần đầu',
        createdAt: nowISO,
        updatedAt: nowISO
        },
        {
        id: 'demo_tx_5',
        type: 'expense',
        amount: 320000,
        category: 'Học tập & Giáo trình',
        date: padDay(8),
        note: '[Demo] Mua tài liệu chuyên ngành CNTT & in ấn',
        createdAt: nowISO,
        updatedAt: nowISO
        },
        {
        id: 'demo_tx_6',
        type: 'expense',
        amount: 180000,
        category: 'Di chuyển & Xăng xe',
        date: padDay(10),
        note: '[Demo] Đổ xăng đi học và vé gửi xe trường',
        createdAt: nowISO,
        updatedAt: nowISO
        }
        ],
        budgets: [
        {
        id: 'demo_bg_overall',
        periodKey,
        year,
        month,
        scope: 'overall',
        category: 'ALL',
        amount: 4000000,
        note: '[Demo] Hạn mức chi tiêu tổng trong tháng của sinh viên',
        createdAt: nowISO,
        updatedAt: nowISO
        },
        {
        id: 'demo_bg_food',
        periodKey,
        year,
        month,
        scope: 'category',
        category: 'Ăn uống & Sinh hoạt',
        amount: 1600000,
        note: '[Demo] Ngân sách ăn uống tự nấu & căng tin',
        createdAt: nowISO,
        updatedAt: nowISO
        },
        {
        id: 'demo_bg_rent',
        periodKey,
        year,
        month,
        scope: 'category',
        category: 'Tiền trọ & Điện nước',
        amount: 1600000,
        note: '[Demo] Cố định tiền trọ, điện nước và Wifi',
        createdAt: nowISO,
        updatedAt: nowISO
        }
        ],
        savingsGoals: [
        {
        id: 'demo_sg_1',
        name: 'Nâng cấp RAM & SSD cho Laptop học lập trình',
        targetAmount: 2500000,
        currentAmount: 1000000,
        startDate: padDay(1),
        targetDate: `${year + 1}-01-15`,
        icon: 'laptop',
        description: '[Demo] Tích lũy từ lương làm thêm để nâng cấp máy chạy IDE mượt hơn',
        status: 'active',
        createdAt: nowISO,
        updatedAt: nowISO
        },
        {
        id: 'demo_sg_2',
        name: 'Quỹ dự phòng khẩn cấp sinh viên',
        targetAmount: 3000000,
        currentAmount: 600000,
        startDate: padDay(1),
        targetDate: `${year + 1}-03-01`,
        icon: 'shield',
        description: '[Demo] Dự phòng y tế và các tình huống phát sinh',
        status: 'active',
        createdAt: nowISO,
        updatedAt: nowISO
        }
        ],
        savingsContributions: [
        {
        id: 'demo_sc_1',
        goalId: 'demo_sg_1',
        type: 'deposit',
        amount: 1000000,
        date: padDay(5),
        note: '[Demo] Trích từ lương gia sư đợt 1',
        createdAt: nowISO
        },
        {
        id: 'demo_sc_2',
        goalId: 'demo_sg_2',
        type: 'deposit',
        amount: 600000,
        date: padDay(2),
        note: '[Demo] Để dành đầu tháng',
        createdAt: nowISO
        }
        ],
        allowances: [
        {
        id: 'demo_alw_1',
        name: 'Trợ cấp sinh hoạt gia đình hàng tháng',
        amount: 3500000,
        frequency: 'monthly',
        category: 'Trợ cấp gia đình',
        startDate: padDay(1),
        note: '[Demo] Gia đình gửi vào mùng 1 đầu tháng',
        confirmedCycles: [`M_${periodKey}`],
        lastConfirmedCycleKey: `M_${periodKey}`,
        lastConfirmedDate: padDay(1),
        lastConfirmedAt: nowISO,
        lastTransactionId: 'demo_tx_1',
        createdAt: nowISO,
        updatedAt: nowISO
        }
        ],
        recurringExpenses: [
        {
        id: 'demo_rec_1',
        name: 'Tiền phòng trọ & Internet cáp quang',
        amount: 1500000,
        frequency: 'monthly',
        category: 'Tiền trọ & Điện nước',
        startDate: padDay(2),
        note: '[Demo] Đóng cố định đầu tháng cho chủ nhà',
        confirmedCycles: [`M_${periodKey}`],
        lastConfirmedCycleKey: `M_${periodKey}`,
        lastConfirmedDate: padDay(2),
        lastConfirmedAt: nowISO,
        lastTransactionId: 'demo_tx_3',
        createdAt: nowISO,
        updatedAt: nowISO
        },
        {
        id: 'demo_rec_2',
        name: 'Gói cước 4G sinh viên hàng tháng',
        amount: 90000,
        frequency: 'monthly',
        category: 'Chi tiêu khác',
        startDate: padDay(15),
        note: '[Demo] Gia hạn gói data di động (chưa thanh toán kỳ này)',
        confirmedCycles: [],
        lastConfirmedCycleKey: null,
        lastConfirmedDate: null,
        lastConfirmedAt: null,
        lastTransactionId: null,
        createdAt: nowISO,
        updatedAt: nowISO
        }
        ]
        };
        },

        async populateDemoDatabase(forceReset = false) {
        const demoDb = await this.openDemoDatabase();
        if (!demoDb) return;

        // CHỐT CHẶN: Dùng cờ (flag) để kiểm soát thay vì đếm số bản ghi.
        // Giúp người dùng có thể xóa SẠCH dữ liệu demo mà không bị hệ thống tự động bơm lại.
        const isSeeded = GeneralUtils.getStorage('student_wallet_demo_seeded_v1', false);
        
        if (isSeeded && !forceReset) {
        return; // Nếu đã nạp data mẫu rồi thì dừng, bảo toàn mọi thao tác CRUD của user.
        }

        const sample = this.buildSampleDataset();
        const availableStores = [
        [Database.STORE_TRANSACTIONS, sample.transactions],
        [Database.STORE_BUDGETS, sample.budgets],
        [Database.STORE_SAVINGS_GOALS, sample.savingsGoals],
        [Database.STORE_SAVINGS_CONTRIBUTIONS, sample.savingsContributions],
        [Database.STORE_ALLOWANCES, sample.allowances],
        [Database.STORE_RECURRING_EXPENSES, sample.recurringExpenses]
        ].filter(([storeName]) => storeName && demoDb.objectStoreNames.contains(storeName));

        return new Promise((resolve, reject) => {
        try {
        const storeNames = availableStores.map(([name]) => name);
        const tx = demoDb.transaction(storeNames, 'readwrite');
        
        availableStores.forEach(([storeName, records]) => {
        const store = tx.objectStore(storeName);
        store.clear();
        (records || []).forEach((rec) => store.put(rec));
        });
        
        tx.oncomplete = () => {
        // Đánh dấu đã nạp data mẫu thành công để không bao giờ ghi đè nữa
        GeneralUtils.setStorage('student_wallet_demo_seeded_v1', true);
        resolve(true);
        };
        
        tx.onerror = () => reject(tx.error);
        } catch (err) {
        reject(err);
        }
        });
        },

        updateDemoSettingsUI() {
        const isDemo = Boolean(Database.isDemoMode);
        const badgeEl = GeneralUtils.qs('#demoModeStatusBadge');
        const resetBtn = GeneralUtils.qs('#resetDemoDataBtn');
        const btnOff = GeneralUtils.qs('#btnDemoOff');
        const btnOn = GeneralUtils.qs('#btnDemoOn');
        const statusTextEl = GeneralUtils.qs('#dashboardStatusText');

        if (badgeEl) {
        badgeEl.textContent = isDemo ? 'Đang bật (Dữ liệu Demo cách ly)' : 'Đang tắt (Dữ liệu thật)';
        badgeEl.style.backgroundColor = isDemo ? 'var(--color-warning-soft)' : 'var(--bg-muted)';
        badgeEl.style.color = isDemo ? 'var(--color-warning)' : 'var(--text-muted)';
        }

        if (resetBtn) {
        resetBtn.classList.toggle('is-hidden', !isDemo);
        }

        if (btnOff) btnOff.classList.toggle('is-selected', !isDemo);
        if (btnOn) btnOn.classList.toggle('is-selected', isDemo);

        if (statusTextEl) {
        statusTextEl.textContent = isDemo
        ? 'Bạn đang ở CHẾ ĐỘ DEMO (StudentWalletDemoDB). Bạn có thể tự do thêm, sửa, xóa dữ liệu mẫu mà không làm ảnh hưởng tới dữ liệu thật của mình.'
        : 'Hệ thống lưu trữ IndexedDB đã sẵn sàng. Mọi giao dịch thu nhập, chi tiêu, hạn mức ngân sách và biểu đồ phân tích tài chính đều được đồng bộ tự động ngay trên trình duyệt.';
        }
        },

        async applyMode(enableDemo, persist = true, showNotification = true) {
        if (this.isSwitching) return;
        this.isSwitching = true;

        try {
        const targetState = Boolean(enableDemo);
        if (targetState) {
        const demoDb = await this.openDemoDatabase();
        await this.populateDemoDatabase(false);
        Database.isDemoMode = true;
        Database.dbInstance = demoDb;
        } else {
        Database.isDemoMode = false;
        Database.dbInstance = Database.realDbInstance;
        }

        if (persist) {
        GeneralUtils.setStorage(GeneralUtils.STORAGE_KEYS.DEMO_MODE, Database.isDemoMode);
        }

        this.updateDemoSettingsUI();
        await FinancialUI.reloadAndRenderAll();

        if (showNotification) {
        NotificationManager.showToast(
        Database.isDemoMode
        ? 'Đã bật Chế độ Demo! Ứng dụng đang hiển thị bộ dữ liệu minh họa cách ly.'
        : 'Đã tắt Chế độ Demo và quay lại dữ liệu thật của bạn.',
        Database.isDemoMode ? 'info' : 'success'
        );
        }
        } catch (err) {
        console.error('[DemoModeManager] Lỗi chuyển chế độ Demo:', err);
        NotificationManager.showToast('Không thể chuyển đổi chế độ Demo.', 'error');
        } finally {
        this.isSwitching = false;
        }
        },

        async init() {
        const savedDemo = GeneralUtils.getStorage(GeneralUtils.STORAGE_KEYS.DEMO_MODE, false);
        if (savedDemo) {
        await this.applyMode(true, false, false);
        } else {
        this.updateDemoSettingsUI();
        }
        this.bindEvents();
        },

        bindEvents() {
        const demoBtns = GeneralUtils.qsa('[data-demo-mode-value]');
        demoBtns.forEach((btn) => {
        btn.addEventListener('click', async () => {
        const val = btn.getAttribute('data-demo-mode-value');
        const wantDemo = val === 'on';
        if (wantDemo === Database.isDemoMode) return;
        await this.applyMode(wantDemo, true, true);
        });
        });

        const resetBtn = GeneralUtils.qs('#resetDemoDataBtn');
        if (resetBtn) {
        resetBtn.addEventListener('click', () => {
        if (!Database.isDemoMode) return;
        NotificationManager.openConfirmModal(
        'reset_demo_data',
        'Bạn có muốn khôi phục bộ dữ liệu Demo về trạng thái mẫu ban đầu không? (Dữ liệu thật của bạn vẫn hoàn toàn không bị ảnh hưởng).',
        async () => {
        await this.populateDemoDatabase(true);
        await FinancialUI.reloadAndRenderAll();
        NotificationManager.showToast('Đã khôi phục dữ liệu Demo về trạng thái ban đầu!', 'success');
        },
        'Khôi phục dữ liệu Demo gốc'
        );
        });
        }
        }
        };

        /* ========================================================================
        INITIALIZE APPLICATION
        ======================================================================== */
        async function initApp() {
        GeneralUtils.refreshIcons();
        DateTimeUtils.initHeaderDateAndGreeting();
        ThemeManager.init();
        UIState.init();
        NotificationManager.init();

        ProfileUI.init();
        SettingsBackupUI.init();

        if (!window.location.hash && SettingsBackupUI.settings?.defaultRoute) {
        window.location.hash = `#${SettingsBackupUI.settings.defaultRoute}`;
        }
        Navigation.init();

        await Database.init();
        await BudgetUI.init();
        AnalyticsUI.init();
        await SavingsAiUI.init();
        await AllowanceRecurringUI.init();
        await DemoModeManager.init();
        await FinancialUI.init();
        }

        return {
        init: initApp,
        modules: {
        GeneralUtils,
        DateTimeUtils,
        NotificationManager,
        Database,
        TransactionService,
        BudgetService,
        AnalyticsService,
        SavingsService,
        AIAssistantService,
        AllowanceService,
        RecurringExpenseService,
        BudgetUI,
        AnalyticsUI,
        SavingsAiUI,
        AllowanceRecurringUI,
        ProfileUI,
        SettingsBackupUI,
        DemoModeManager,
        FinancialUI,
        UIState,
        ThemeManager,
        Navigation
        }
        };
        })();

        document.addEventListener('DOMContentLoaded', StudentWalletApp.init);
