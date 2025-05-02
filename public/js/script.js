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
let currentCase = null;
let caseItems = [];
let caseCount = 1;
let isQuickMode = false;
let isOpening = false;

async function authenticateUser(userData) {
    try {
        const response = await apiRequest('/users/auth', 'POST', {
            telegram_id: userData.id,
            username: userData.username,
            first_name: userData.first_name,
            last_name: userData.last_name,
            photo_url: userData.photo_url,
            language_code: userData.language_code
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

// ==================== Case Functions ====================
async function loadCase(caseId) {
    try {
        showLoading(true);
        const response = await apiRequest(`/users/case/${caseId}`);
        if (response.success) {
            currentCase = response.case;
            caseItems = response.items;
            setupCasePage();
        } else {
            showErrorAndRedirect("Ошибка загрузки кейса");
        }
    } catch (error) {
        console.error('Error loading case:', error);
        showErrorAndRedirect("Ошибка загрузки кейса");
    } finally {
        showLoading(false);
    }
}

function setupCasePage() {
    if (!currentCase) return;
    
    document.getElementById('caseTitle').textContent = `Открытие: ${currentCase.name}`;
    updateTotalPrice();
    setupCaseTrack();
    setupPossibleItems();
}

function updateTotalPrice() {
    document.getElementById('totalPrice').textContent = currentCase.price * caseCount;
}

function setupCaseTrack() {
    const caseTrack = document.getElementById('caseTrack');
    caseTrack.innerHTML = '';
    
    for (let i = 0; i < caseCount; i++) {
        const caseItem = document.createElement('div');
        caseItem.className = 'case-item';
        caseItem.innerHTML = `
            <div class="case-top">
                <i class="fas fa-gift"></i>
            </div>
            <div class="case-bottom">
                <div class="case-reward"></div>
            </div>
        `;
        caseTrack.appendChild(caseItem);
    }
    
    setTimeout(() => {
        const trackWidth = caseTrack.scrollWidth;
        const containerWidth = caseTrack.parentElement.offsetWidth;
        caseTrack.style.transform = `translateX(${(containerWidth - trackWidth) / 2}px)`;
    }, 100);
}

function setupPossibleItems() {
    const itemsGrid = document.getElementById('itemsGrid');
    itemsGrid.innerHTML = '';
    
    caseItems.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        itemCard.innerHTML = `
            <div class="rarity-indicator ${getRarityClass(item.rarity)}"></div>
            <div class="item-image">
                ${getItemContent(item)}
            </div>
            <div class="item-name">${item.name}</div>
            <div class="item-chance">${parseFloat(item.adjusted_chance).toFixed(2)}%</div>
        `;
        itemsGrid.appendChild(itemCard);
    });
}

function changeCaseCount(change) {
    const newCount = caseCount + change;
    if (newCount >= 1 && newCount <= 3) {
        caseCount = newCount;
        document.getElementById('caseCount').textContent = caseCount;
        updateTotalPrice();
        setupCaseTrack();
    }
}

function toggleQuickMode() {
    isQuickMode = !isQuickMode;
    const button = document.getElementById('quickToggle');
    button.classList.toggle('active', isQuickMode);
    button.innerHTML = isQuickMode ? 
        '<i class="fas fa-bolt"></i> Быстрое открытие' : 
        '<i class="fas fa-bolt"></i> Быстрое открытие';
}

async function openCases(isReal) {
    if (!currentCase || isOpening) return;
    
    if (isReal && balance < currentCase.price * caseCount) {
        showToast("Недостаточно средств", "error");
        return;
    }
    
    isOpening = true;
    disableControls(true);
    
    try {
        const response = await apiRequest('/users/open-case', 'POST', {
            user_id: currentUser.id,
            case_id: currentCase.id,
            count: caseCount,
            is_demo: !isReal
        });
        
        if (response.success) {
            if (isReal) {
                balance = response.new_balance;
                updateBalanceDisplay();
            }
            
            await animateCaseOpening(response.won_items);
            showResults(response.won_items);
            
            if (hasLegendaryItems(response.won_items)) {
                showToast("Поздравляем! Вы получили легендарный предмет!", "success");
            }
        } else {
            showToast(response.error || "Ошибка при открытии кейса", "error");
        }
    } catch (error) {
        console.error('Error opening cases:', error);
        showToast(error.message || "Ошибка при открытии кейса", "error");
        
        if (isReal) {
            try {
                const balanceResponse = await apiRequest(`/users/balance/${currentUser.id}`);
                if (balanceResponse.success) {
                    balance = balanceResponse.balance;
                    updateBalanceDisplay();
                }
            } catch (e) {
                console.error('Failed to refresh balance:', e);
            }
        }
    } finally {
        isOpening = false;
        disableControls(false);
    }
}

function disableControls(disabled) {
    document.querySelectorAll('.count-btn, .quick-toggle, .action-btn')
        .forEach(btn => btn.disabled = disabled);
}

function hasLegendaryItems(items) {
    return items.some(item => item.rarity.toLowerCase() === 'legendary');
}

async function animateCaseOpening(wonItems) {
    const caseTrack = document.getElementById('caseTrack');
    const caseItems = document.querySelectorAll('.case-item');
    
    for (let i = 0; i < caseItems.length; i++) {
        const caseItem = caseItems[i];
        const caseTop = caseItem.querySelector('.case-top');
        const caseReward = caseItem.querySelector('.case-reward');
        
        caseTop.style.transform = 'rotateX(-180deg)';
        caseTop.style.transition = 'transform 0.5s ease-out';
        
        await sleep(500);
        caseReward.innerHTML = getItemContent(wonItems[i]);
        caseReward.style.animation = 'bounceIn 0.5s';
        
        if (i < caseItems.length - 1 && !isQuickMode) {
            caseTrack.scrollTo({
                left: caseItem.offsetLeft + caseItem.offsetWidth,
                behavior: 'smooth'
            });
            await sleep(1000);
        }
    }
    
    if (!isQuickMode) {
        await sleep(500);
        caseTrack.scrollTo({
            left: 0,
            behavior: 'smooth'
        });
    }
}

function showResults(items) {
    const resultsContainer = document.getElementById('caseResults');
    resultsContainer.innerHTML = '';
    
    items.forEach((item, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        resultItem.innerHTML = `
            ${getItemContent(item)}
            <div class="rarity ${getRarityClass(item.rarity)}">${index + 1}</div>
        `;
        resultsContainer.appendChild(resultItem);
    });
    
    document.querySelector('.case-results-container').scrollIntoView({
        behavior: 'smooth'
    });
}

function getItemContent(item) {
    return item.image_url ? 
        `<img src="${item.image_url}" alt="${item.name}" style="max-width:80%; max-height:80%;">` : 
        `<i class="fas fa-gift"></i>`;
}

function getRarityClass(rarity) {
    return `rarity-${rarity.toLowerCase()}`;
}

function getCaseIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function redirectToMain() {
    window.location.href = 'index.html';
}

function showErrorAndRedirect(message) {
    showToast(message, "error");
    setTimeout(redirectToMain, 2000);
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
    document.getElementById('xpDisplay').textContent = `${userXP}/100 XP`;
}

function showLoading(show) {
    const container = document.querySelector('.app-main');
    if (show) {
        const loader = document.createElement('div');
        loader.className = 'loading-overlay';
        loader.innerHTML = '<div class="loader"></div>';
        container.appendChild(loader);
    } else {
        const loader = document.querySelector('.loading-overlay');
        if (loader) loader.remove();
    }
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
    if (!tabName) {
        console.error('Tab name is undefined');
        return;
    }

    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const tab = document.getElementById(tabName);
    if (!tab) {
        console.error(`Tab with id ${tabName} not found`);
        return;
    }
    tab.classList.add('active');
    
    const button = clickedElement || document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    if (button) {
        button.classList.add('active');
    }

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

// ==================== Initialization ====================
async function initApp() {
    try {
        const authResult = initTelegramAuth();
        
        if (authResult?.data) {
            const authSuccess = await authenticateUser(authResult.data);
            if (!authSuccess) {
                showToast("Ошибка авторизации", "error");
                return;
            }
        } else {
            showToast("Требуется авторизация через Telegram", "error");
            return;
        }

        updateProfile();
        updateBalanceDisplay();
        updateLevelDisplay();
        initTheme();
        
        // Если это страница кейса
        if (document.getElementById('caseTitle')) {
            const caseId = getCaseIdFromUrl();
            if (caseId) {
                await loadCase(caseId);
            } else {
                redirectToMain();
            }
        } else {
            // Главная страница
            setTimeout(() => {
                openTab('cases');
            }, 0);
        }
        
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

// ==================== Utility Functions ====================
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

    // Кнопки управления кейсами
    document.getElementById('quickToggle')?.addEventListener('click', toggleQuickMode);
    document.getElementById('decreaseCount')?.addEventListener('click', () => changeCaseCount(-1));
    document.getElementById('increaseCount')?.addEventListener('click', () => changeCaseCount(1));
    document.getElementById('openDemoBtn')?.addEventListener('click', () => openCases(false));
    document.getElementById('openRealBtn')?.addEventListener('click', () => openCases(true));
}

// ==================== Global Functions ====================
window.openTab = openTab;
window.openDepositModal = openDepositModal;
window.closeDepositModal = closeDepositModal;
window.toggleTheme = toggleTheme;
window.switchDepositTab = switchDepositTab;
window.processTonDeposit = processTonDeposit;
window.processStarsDeposit = processStarsDeposit;
window.changeCaseCount = changeCaseCount;
window.toggleQuickMode = toggleQuickMode;
window.openCases = openCases;

// ==================== Start Application ====================
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    initApp();
});

// Добавляем стили для toast, если их нет
if (!document.querySelector('style#toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
    .toast {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 1000;
        animation: slideIn 0.3s;
    }
    
    .toast.info {
        background: #3498db;
    }
    
    .toast.success {
        background: #2ecc71;
    }
    
    .toast.error {
        background: #e74c3c;
    }
    
    .toast.warning {
        background: #f39c12;
    }
    
    .toast.fade-out {
        animation: fadeOut 0.3s;
    }
    
    @keyframes slideIn {
        from { bottom: -50px; opacity: 0; }
        to { bottom: 20px; opacity: 1; }
    }
    
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
    
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }
    
    .loader {
        border: 5px solid #f3f3f3;
        border-top: 5px solid #8a2be2;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    `;
    document.head.appendChild(style);
}