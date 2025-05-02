// ==================== API Functions ====================
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000' 
    : 'https://gifts-drop.vercel.app';

async function apiRequest(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_URL}/api${endpoint}`, options);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// ==================== User Management ====================
let currentUser = null;
let balance = 0;
let userLevel = 1;
let userXP = 0;

async function authenticateUser(userData) {
    try {
        const response = await apiRequest('/users/auth', 'POST', {
            telegram_id: userData.id,
            username: userData.username,
            first_name: userData.first_name,
            last_name: userData.last_name,
            photo_url: userData.photo,
            language_code: userData.language
        });
        
        if (response.success) {
            currentUser = response.user;
            balance = response.balance || 0;
            userLevel = response.level || 1;
            userXP = response.xp || 0;
            return true;
        }
        return false;
    } catch (error) {
        console.error('Authentication failed:', error);
        return false;
    }
}

async function updateBalance(amount, type = 'deposit', description = '') {
    try {
        const response = await apiRequest('/users/balance', 'POST', {
            user_id: currentUser.id,
            amount: amount,
            type: type,
            description: description
        });
        
        if (response.success) {
            balance = response.new_balance;
            updateBalanceDisplay();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Balance update failed:', error);
        showToast(error.message || "Ошибка обновления баланса", "error");
        return false;
    }
}

async function getTransactions() {
    try {
        const response = await apiRequest(`/users/transactions/${currentUser.id}`);
        return response.transactions || [];
    } catch (error) {
        console.error('Failed to get transactions:', error);
        return [];
    }
}

// ==================== UI Functions ====================
function updateBalanceDisplay() {
    document.querySelectorAll('.balance-amount').forEach(el => {
        el.textContent = balance;
    });
}

function updateProfile() {
    if (!currentUser) return;
    
    const userName = document.getElementById('userName');
    const avatar = document.getElementById('userAvatar');
    const placeholder = document.getElementById('avatarPlaceholder');

    if (userName) userName.textContent = currentUser.name || currentUser.first_name;
    
    if (avatar && placeholder) {
        if (currentUser.photo_url) {
            placeholder.style.display = 'none';
            avatar.style.backgroundImage = `url(${currentUser.photo_url})`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
        } else {
            placeholder.style.display = 'flex';
            avatar.style.backgroundImage = 'none';
            
            const initials = (currentUser.first_name?.[0] || '') + (currentUser.last_name?.[0] || '');
            placeholder.textContent = initials.toUpperCase();
        }
    }
}

function updateLevelDisplay() {
    document.getElementById('userLevel').textContent = userLevel;
    document.getElementById('xpDisplay').textContent = `${userXP}/100 XP`; // Упрощенная версия
}

// ==================== Theme Management ====================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeSwitch(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeSwitch(newTheme);
}

function updateThemeSwitch(theme) {
    const icon = document.querySelector('.theme-switch-btn i');
    const text = document.querySelector('.theme-switch-btn span');
    
    if (icon && text) {
        if (theme === 'dark') {
            icon.className = 'fas fa-sun';
            text.textContent = 'Светлая тема';
        } else {
            icon.className = 'fas fa-moon';
            text.textContent = 'Темная тема';
        }
    }
}

// ==================== Tab Navigation ====================
function openTab(tabName, clickedElement) {
    // Проверяем, что tabName существует
    if (!tabName) {
        console.error('Tab name is undefined');
        return;
    }

    // Скрыть все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Убрать активное состояние у всех кнопок
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Показать выбранную вкладку
    const tab = document.getElementById(tabName);
    if (!tab) {
        console.error(`Tab with id ${tabName} not found`);
        return;
    }
    tab.classList.add('active');
    
    // Активировать кнопку
    const button = clickedElement || document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    if (button) {
        button.classList.add('active');
    }

    // Загружаем данные для вкладки профиля
    if (tabName === 'profile') {
        loadProfileData();
    }
}

async function loadProfileData() {
    try {
        const container = document.getElementById('transactionsList');
        container.innerHTML = '<div class="loading">Загрузка...</div>';
        
        const transactions = await getTransactions();
        updateTransactionsList(transactions);
    } catch (error) {
        console.error('Failed to load profile data:', error);
        showToast("Ошибка загрузки данных", "error");
    }
}

function updateTransactionsList(transactions) {
    const container = document.getElementById('transactionsList');
    if (!container) return;

    if (transactions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exchange-alt"></i>
                <p>Нет транзакций</p>
            </div>
        `;
        return;
    }

    container.innerHTML = transactions.map(tx => `
        <div class="transaction-item ${tx.type}">
            <div class="transaction-icon">
                <i class="fas ${
                    tx.type === 'deposit' ? 'fa-coins' : 
                    tx.type === 'bonus' ? 'fa-gift' : 'fa-exchange-alt'
                }"></i>
            </div>
            <div class="transaction-info">
                <div class="transaction-description">${tx.description || tx.type}</div>
                <div class="transaction-date">${new Date(tx.created_at).toLocaleString()}</div>
            </div>
            <div class="transaction-amount ${tx.amount >= 0 ? 'positive' : 'negative'}">
                ${tx.amount >= 0 ? '+' : ''}${tx.amount} 🪙
            </div>
        </div>
    `).join('');
}

// ==================== Deposit Functions ====================
function openDepositModal() {
    const modal = document.getElementById('depositModal');
    if (modal) modal.classList.remove('hidden');
}

function closeDepositModal() {
    const modal = document.getElementById('depositModal');
    if (modal) modal.classList.add('hidden');
}

function switchDepositTab(tabName) {
    document.querySelectorAll('.deposit-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.deposit-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const tab = document.querySelector(`.deposit-tab[data-tab="${tabName}"]`);
    const content = document.querySelector(`.deposit-tab-content.${tabName}`);
    
    if (tab) tab.classList.add('active');
    if (content) content.classList.add('active');
}

async function processTonDeposit() {
    const tonAmount = parseFloat(document.getElementById('tonAmount').value);
    
    if (!tonAmount || tonAmount < 0.5) {
        showToast("Минимальная сумма пополнения - 0.5 TON", "error");
        return;
    }
    
    const giftcoinAmount = Math.floor(tonAmount * 200);
    const success = await updateBalance(
        giftcoinAmount,
        'deposit',
        `Пополнение через TON (${tonAmount} TON)`
    );
    
    if (success) {
        showToast(`Баланс пополнен на ${giftcoinAmount} GiftCoin`, "success");
        closeDepositModal();
    }
}

async function processStarsDeposit() {
    const starsAmount = parseInt(document.getElementById('starsAmount').value);
    
    if (!starsAmount || starsAmount < 25) {
        showToast("Минимальное количество звезд - 25", "error");
        return;
    }
    
    const success = await updateBalance(
        starsAmount,
        'deposit',
        'Пополнение звездами'
    );
    
    if (success) {
        showToast(`Баланс пополнен на ${starsAmount} GiftCoin`, "success");
        closeDepositModal();
    }
}

// ==================== Notification System ====================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                         type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        ${message}
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Добавляем в script.js
let currentCase = null;
let caseItems = [];
let selectedCount = 1;
let isDemoMode = false;

async function loadCasePage(caseId) {
    try {
        const response = await apiRequest(`/case/${caseId}`);
        if (response.success) {
            currentCase = response.case;
            caseItems = response.items;
            renderCasePage();
        } else {
            showToast("Ошибка загрузки кейса", "error");
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Failed to load case:', error);
        showToast("Ошибка загрузки кейса", "error");
        window.location.href = 'index.html';
    }
}

function renderCasePage() {
    if (!currentCase) return;
    
    document.getElementById('caseName').textContent = currentCase.name;
    document.getElementById('casePrice').textContent = `${currentCase.price} 🪙`;
    
    const itemsContainer = document.getElementById('caseItemsTrack');
    itemsContainer.innerHTML = caseItems.map(item => `
        <div class="case-item" data-rarity="${item.rarity}">
            <div class="item-image" style="background-image: url('${item.image_url || 'img/default-item.png'}')"></div>
            <div class="item-info">
                <h4>${item.name}</h4>
                <p class="item-rarity ${item.rarity}">${getRarityName(item.rarity)}</p>
                <p class="item-chance">Шанс: ${(item.adjusted_chance || item.drop_chance)}%</p>
            </div>
        </div>
    `).join('');
    
    updateOpenButtons();
}

function getRarityName(rarity) {
    const names = {
        'common': 'Обычный',
        'rare': 'Редкий',
        'epic': 'Эпический',
        'legendary': 'Легендарный'
    };
    return names[rarity] || rarity;
}

function updateOpenButtons() {
    const demoBtn = document.getElementById('demoOpenBtn');
    const openBtn = document.getElementById('openCaseBtn');
    const quickOpenBtn = document.getElementById('quickOpenBtn');
    
    if (isDemoMode) {
        demoBtn.classList.add('active');
        openBtn.classList.remove('active');
        quickOpenBtn.classList.remove('active');
    } else {
        demoBtn.classList.remove('active');
        openBtn.classList.add('active');
        quickOpenBtn.classList.add('active');
    }
    
    document.getElementById('openCount').textContent = selectedCount;
    document.getElementById('totalCost').textContent = isDemoMode ? 0 : currentCase.price * selectedCount;
}

async function openCase() {
    if (!currentUser || !currentCase) return;
    
    try {
        const response = await apiRequest('/open-case', 'POST', {
            user_id: currentUser.id,
            case_id: currentCase.id,
            count: selectedCount,
            is_demo: isDemoMode
        });
        
        if (response.success) {
            showCaseResults(response.items);
            
            if (!isDemoMode) {
                balance -= response.totalCost;
                updateBalanceDisplay();
                showToast(`Открыто ${selectedCount} кейсов`, "success");
            }
        }
    } catch (error) {
        console.error('Failed to open case:', error);
        showToast(error.message || "Ошибка открытия кейса", "error");
    }
}

function showCaseResults(items) {
    const resultsContainer = document.getElementById('caseResults');
    resultsContainer.innerHTML = items.map(item => `
        <div class="won-item" data-rarity="${item.rarity}">
            <div class="item-image" style="background-image: url('${item.image_url || 'img/default-item.png'}')"></div>
            <div class="item-info">
                <h4>${item.name}</h4>
                <p class="item-rarity ${item.rarity}">${getRarityName(item.rarity)}</p>
                <p class="item-price">Цена: ${item.price} 🪙</p>
            </div>
        </div>
    `).join('');
    
    document.getElementById('caseOpenSection').classList.add('hidden');
    document.getElementById('caseResultsSection').classList.remove('hidden');
}

function toggleDemoMode() {
    isDemoMode = !isDemoMode;
    updateOpenButtons();
}

function changeCount(change) {
    selectedCount = Math.max(1, Math.min(3, selectedCount + change));
    updateOpenButtons();
}

function backToCase() {
    document.getElementById('caseOpenSection').classList.remove('hidden');
    document.getElementById('caseResultsSection').classList.add('hidden');
}

// ==================== Initialization ====================
async function initApp() {
    try {
        // Инициализация Telegram WebApp
        const authResult = initTelegramAuth();
        
        if (authResult?.data) {
            const authSuccess = await authenticateUser(authResult.data);
            if (!authSuccess) {
                showToast("Ошибка авторизации", "error");
                return;
            }
        } else {
            // Режим тестирования
            currentUser = getTestUserData();
            balance = 1000;
            showToast("Режим тестирования", "warning");
        }

        // Инициализация интерфейса
        updateProfile();
        updateBalanceDisplay();
        updateLevelDisplay();
        initTheme();
        
        // Открываем вкладку по умолчанию
        setTimeout(() => {
            openTab('cases');
        }, 0);
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast("Ошибка инициализации", "error");
    }
}

// ==================== Telegram Auth Helpers ====================
function initTelegramAuth() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        try {
            const webApp = Telegram.WebApp;
            webApp.expand();
            webApp.ready();
            
            if (webApp.initDataUnsafe?.user) {
                return {
                    data: webApp.initDataUnsafe.user,
                    webAppInstance: webApp
                };
            }
        } catch (e) {
            console.error('Telegram auth error:', e);
        }
    }
    return null;
}

function getTestUserData() {
    return {
        id: 999999,
        first_name: "Тестовый",
        last_name: "Пользователь",
        username: "test_user",
        photo_url: "",
        language_code: "ru",
        name: "Тестовый Пользователь"
    };
}

// ==================== Event Listeners ====================
function initEventListeners() {
    // Навигация
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            openTab(tabName, this);
        });
    });
    
    // Кнопка пополнения
    document.querySelector('.deposit-btn')?.addEventListener('click', openDepositModal);
    
    // Кнопки в модалках
    document.querySelector('.modal-button.secondary')?.addEventListener('click', closeDepositModal);
    
    // Переключение вкладок депозита
    document.querySelectorAll('.deposit-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            switchDepositTab(tabName);
        });
    });
    
    // Обработчики пополнения
    document.getElementById('depositTonBtn')?.addEventListener('click', processTonDeposit);
    document.getElementById('depositStarsBtn')?.addEventListener('click', processStarsDeposit);
    
    // Переключатель темы
    document.querySelector('.theme-switch-btn')?.addEventListener('click', toggleTheme);
    
    // Автоматический расчет суммы при вводе
    document.getElementById('tonAmount')?.addEventListener('input', function() {
        const amount = parseFloat(this.value) || 0;
        document.getElementById('tonGiftcoin').textContent = Math.floor(amount * 200);
    });

    // Добавляем в initEventListeners()
    document.getElementById('demoOpenBtn')?.addEventListener('click', toggleDemoMode);
    document.getElementById('openCaseBtn')?.addEventListener('click', openCase);
    document.getElementById('quickOpenBtn')?.addEventListener('click', () => {
        selectedCount = 3;
        openCase();
    });
    document.getElementById('increaseCount')?.addEventListener('click', () => changeCount(1));
    document.getElementById('decreaseCount')?.addEventListener('click', () => changeCount(-1));
    document.getElementById('backToCaseBtn')?.addEventListener('click', backToCase);
}

// ==================== Global Functions ====================
window.openTab = openTab;
window.openDepositModal = openDepositModal;
window.closeDepositModal = closeDepositModal;
window.toggleTheme = toggleTheme;
window.switchDepositTab = switchDepositTab;
window.processTonDeposit = processTonDeposit;
window.processStarsDeposit = processStarsDeposit;

// ==================== Start Application ====================
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    initApp();
});