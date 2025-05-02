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

// ==================== Case Functions ====================
let currentCase = null;
let caseItems = [];
let caseCount = 1;
let isQuickOpen = false;
let isOpening = false;

async function loadCase(caseId) {
    try {
        const response = await apiRequest(`/users/case/${caseId}`);
        if (response.success) {
            currentCase = response.case;
            caseItems = response.items;
            showCaseModal();
        } else {
            showToast("Ошибка загрузки кейса", "error");
        }
    } catch (error) {
        console.error('Error loading case:', error);
        showToast("Ошибка загрузки кейса", "error");
    }
}

function showCaseModal() {
    if (!currentCase) return;
    
    // Устанавливаем информацию о кейсе
    document.getElementById('modalCaseName').textContent = currentCase.name;
    document.getElementById('modalCasePrice').textContent = `Цена: ${currentCase.price} 🪙`;
    document.getElementById('totalPrice').textContent = currentCase.price * caseCount;
    
    // Устанавливаем изображение кейса
    const caseImage = document.getElementById('modalCaseImage');
    if (currentCase.image_url) {
        caseImage.style.backgroundImage = `url(${currentCase.image_url})`;
        caseImage.style.backgroundSize = 'cover';
        caseImage.style.backgroundPosition = 'center';
        caseImage.innerHTML = '';
    } else {
        caseImage.style.backgroundImage = 'none';
        caseImage.innerHTML = '<i class="fas fa-gift"></i>';
    }
    
    // Заполняем список возможных предметов
    const itemsGrid = document.getElementById('possibleItems');
    itemsGrid.innerHTML = '';
    
    caseItems.forEach(item => {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-card';
        
        // Цвет рамки в зависимости от редкости
        let rarityClass = '';
        let rarityColor = '';
        
        switch(item.rarity) {
            case 'uncommon':
                rarityColor = '#2ecc71';
                break;
            case 'rare':
                rarityColor = '#3498db';
                break;
            case 'epic':
                rarityColor = '#9b59b6';
                break;
            case 'legendary':
                rarityColor = '#f39c12';
                break;
            default: // common
                rarityColor = '#95a5a6';
        }
        
        itemCard.innerHTML = `
            <div class="rarity-indicator" style="background: ${rarityColor}"></div>
            <div class="item-image">
                ${item.image_url ? 
                    `<img src="${item.image_url}" alt="${item.name}" style="max-width:100%; max-height:100%;">` : 
                    `<i class="fas fa-box-open"></i>`}
            </div>
            <div class="item-name">${item.name}</div>
            <div class="item-chance">${parseFloat(item.adjusted_chance).toFixed(2)}%</div>
        `;
        
        itemsGrid.appendChild(itemCard);
    });
    
    // Сбрасываем анимацию
    resetCaseAnimation();
    
    // Показываем модальное окно
    document.getElementById('caseModal').classList.remove('hidden');
}

function closeCaseModal() {
    document.getElementById('caseModal').classList.add('hidden');
    currentCase = null;
    caseItems = [];
    caseCount = 1;
    isQuickOpen = false;
}

function changeCaseCount(change) {
    const newCount = caseCount + change;
    if (newCount >= 1 && newCount <= 3) {
        caseCount = newCount;
        document.getElementById('caseCount').textContent = caseCount;
        document.getElementById('totalPrice').textContent = currentCase.price * caseCount;
    }
}

function toggleQuickOpen() {
    isQuickOpen = !isQuickOpen;
    const icon = document.getElementById('quickOpenIcon');
    if (isQuickOpen) {
        icon.style.color = '#f39c12';
    } else {
        icon.style.color = 'white';
    }
}

function resetCaseAnimation() {
    const caseTop = document.querySelector('.case-top');
    caseTop.style.animation = 'none';
    caseTop.offsetHeight; // Trigger reflow
    caseTop.style.animation = null;
    
    document.getElementById('caseReward').innerHTML = '';
    document.getElementById('caseResults').innerHTML = '';
}

async function openCase(isReal) {
    if (!currentCase || isOpening) return;
    
    // Проверяем баланс для реального открытия
    if (isReal && balance < currentCase.price * caseCount) {
        showToast("Недостаточно средств", "error");
        return;
    }
    
    isOpening = true;
    
    try {
        // Запрос на открытие кейса
        const response = await apiRequest('/users/open-case', 'POST', {
            user_id: currentUser.id,
            case_id: currentCase.id,
            count: caseCount,
            is_demo: !isReal
        });
        
        if (response.success) {
            // Обновляем баланс, если это реальное открытие
            if (isReal) {
                balance = response.new_balance;
                updateBalanceDisplay();
            }
            
            // Анимируем открытие
            await animateCaseOpening(response.won_items);
            
            // Показываем результаты
            showCaseResults(response.won_items);
            
        } else {
            showToast("Ошибка при открытии кейса", "error");
        }
    } catch (error) {
        console.error('Error opening case:', error);
        showToast("Ошибка при открытии кейса", "error");
    } finally {
        isOpening = false;
    }
}

async function animateCaseOpening(wonItems) {
    const caseTop = document.querySelector('.case-top');
    const caseReward = document.getElementById('caseReward');
    
    // Сбрасываем анимацию
    resetCaseAnimation();
    
    // Запускаем анимацию открытия
    caseTop.style.animation = 'openCaseTop 1s forwards';
    
    // Ждем завершения анимации открытия
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Показываем выигранные предметы
    if (isQuickOpen) {
        // Быстрое открытие - показываем все сразу
        showAllRewards(wonItems);
    } else {
        // Обычное открытие - показываем по одному с задержкой
        for (let i = 0; i < wonItems.length; i++) {
            showReward(wonItems[i], i);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

function showReward(item, index) {
    const caseReward = document.getElementById('caseReward');
    const caseResults = document.getElementById('caseResults');
    
    // Показываем предмет в основном окне
    caseReward.innerHTML = `
        <div class="win-icon ${item.rarity}">
            ${item.image_url ? 
                `<img src="${item.image_url}" alt="${item.name}" style="max-width:80%; max-height:80%;">` : 
                `<i class="fas fa-gift"></i>`}
        </div>
    `;
    
    // Добавляем предмет в список результатов
    const resultItem = document.createElement('div');
    resultItem.className = 'case-result-item';
    resultItem.innerHTML = `
        ${item.image_url ? 
            `<img src="${item.image_url}" alt="${item.name}" style="max-width:80%; max-height:80%;">` : 
            `<i class="fas fa-gift"></i>`}
        <div class="rarity-badge ${'rarity-' + item.rarity}">
            ${index + 1}
        </div>
    `;
    caseResults.appendChild(resultItem);
    
    // Анимация появления
    resultItem.style.animation = 'bounceIn 0.5s';
}

function showAllRewards(wonItems) {
    const caseReward = document.getElementById('caseReward');
    const caseResults = document.getElementById('caseResults');
    
    caseReward.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 1rem; margin-bottom: 5px;">Вы открыли:</div>
            <div style="display: flex; justify-content: center; gap: 10px;">
                ${wonItems.map((item, index) => `
                    <div style="text-align: center;">
                        <div class="win-icon ${item.rarity}" style="width: 50px; height: 50px; font-size: 1.5rem;">
                            ${item.image_url ? 
                                `<img src="${item.image_url}" alt="${item.name}" style="max-width:80%; max-height:80%;">` : 
                                `<i class="fas fa-gift"></i>`}
                        </div>
                        <div style="font-size: 0.7rem;">${index + 1}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Добавляем все предметы в список результатов
    wonItems.forEach((item, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'case-result-item';
        resultItem.innerHTML = `
            ${item.image_url ? 
                `<img src="${item.image_url}" alt="${item.name}" style="max-width:80%; max-height:80%;">` : 
                `<i class="fas fa-gift"></i>`}
            <div class="rarity-badge ${'rarity-' + item.rarity}">
                ${index + 1}
            </div>
        `;
        caseResults.appendChild(resultItem);
        resultItem.style.animation = 'bounceIn 0.5s';
    });
}

function showCaseResults(wonItems) {
    // Можно добавить дополнительную логику для отображения результатов
    // Например, подсветку самых редких предметов и т.д.
    const legendaryItems = wonItems.filter(item => item.rarity === 'legendary');
    if (legendaryItems.length > 0) {
        showToast(`Поздравляем! Вы получили легендарный предмет!`, "success");
    }
}

// Обновляем функцию openCase в глобальной области видимости
window.openCase = function(caseType) {
    // Для примера - загружаем кейс с ID 1 (можно сделать динамически)
    loadCase(1);
};

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

    document.querySelectorAll('.case-card').forEach(card => {
        card.addEventListener('click', function() {
            const caseType = this.getAttribute('onclick').match(/openCase\('(.*?)'\)/)[1];
            loadCase(getCaseIdByType(caseType));
        });
    });

    // Закрытие модального окна кейса
    document.querySelector('#caseModal .modal-button.secondary')?.addEventListener('click', closeCaseModal);
    
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
}

function getCaseIdByType(caseType) {
    // Здесь можно реализовать логику сопоставления типа кейса с его ID
    // Например, можно хранить mapping в currentUser или загружать с сервера
    switch(caseType) {
        case 'mix': return 1;
        case 'premium': return 2;
        case 'legendary': return 3;
        default: return 1;
    }
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