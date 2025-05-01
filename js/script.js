// ==================== API Functions ====================
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
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

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
        
        return response;
    } catch (error) {
        console.error('Authentication failed:', error);
        return null;
    }
}

async function updateUserBalance(amount) {
    try {
        const response = await apiRequest('/users/balance', 'POST', {
            user_id: currentUser.id,
            amount: amount
        });
        
        return response.new_balance;
    } catch (error) {
        console.error('Balance update failed:', error);
        return null;
    }
}

// ==================== Функции из auth.js ====================
function initTelegramAuth() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        const webApp = Telegram.WebApp;
        console.log('Данные из Telegram:', webApp.initDataUnsafe?.user);
        try {
            const webApp = Telegram.WebApp;
            webApp.expand();
            webApp.ready();
            
            if (webApp.initDataUnsafe?.user) {
                return {
                    platform: 'telegram',
                    data: webApp.initDataUnsafe.user,
                    webAppInstance: webApp
                };
            }
            return null;
        } catch (e) {
            console.error('Telegram auth error:', e);
            return null;
        }
    }
    return null;
}

function getTestUserData() {
    return {
        id: Math.floor(Math.random() * 1000000),
        first_name: "Тестовый",
        last_name: "Пользователь",
        username: "test_user",
        photo_url: "",
        language_code: "ru"
    };
}

function formatUserData(userData) {
    if (!userData) return null;
    return {
        id: userData.id || 0,
        name: [userData.first_name, userData.last_name].filter(Boolean).join(' '),
        username: userData.username ? `@${userData.username}` : '',
        photo: userData.photo_url || '',
        language: userData.language_code || 'ru'
    };
}

// ==================== Глобальные переменные ====================
let balance = 1000;
let canSpin = true;
let activeBonuses = [];
let userDeposits = 0;
let currentUser = null;
let dailySpins = 1;

// Определяем API_URL в зависимости от хоста
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000' 
    : 'https://gifts-drop.vercel.app';

// Уровни
const LEVELS = [
    { level: 1, xpRequired: 0, reward: 0, bonus: "Доступ к базовым кейсам" },
    { level: 2, xpRequired: 100, reward: 50, bonus: "+5% к выигрышам" },
    { level: 3, xpRequired: 300, reward: 100, bonus: "Доступ к премиум кейсам" },
    { level: 4, xpRequired: 600, reward: 200, bonus: "+1 дополнительный спин" },
    { level: 5, xpRequired: 1000, reward: 500, bonus: "Эксклюзивные бонусы" }
];

let userXP = 0;
let userLevel = 1;

// Промокоды
const PROMO_CODES = {
    "WELCOME": { amount: 100, used: false },
    "GIFT100": { amount: 100, used: false },
    "BONUS50": { amount: 50, used: false }
};

// Типы бонусов
const BONUS_TYPES = [
    { 
        type: "deposit", 
        probability: 45,
        variants: [
            { title: "+20% К ДЕПОЗИТУ", value: 0.2, icon: "fa-coins", duration: 24 },
            { title: "+15% К ДЕПОЗИТУ", value: 0.15, icon: "fa-coins", duration: 12 }
        ]
    },
    { 
        type: "discount", 
        probability: 35,
        variants: [
            { title: "-20% НА КЕЙСЫ", value: 0.2, icon: "fa-percentage", duration: 12 },
            { title: "-15% НА КЕЙСЫ", value: 0.15, icon: "fa-percentage", duration: 6 }
        ]
    },
    { 
        type: "free", 
        probability: 20,
        variants: [
            { title: "+2 ПОДАРКА", value: 2, icon: "fa-gift", duration: 0 },
            { title: "+1 ПОДАРОК", value: 1, icon: "fa-gift", duration: 0 }
        ]
    }
];

// ==================== Основные функции ====================
async function initApp() {
    console.log('Initializing app...');
    
    try {
        const authResult = initTelegramAuth();
        
        if (authResult && authResult.data) {
            currentUser = formatUserData(authResult.data);
            console.log('Authenticated as Telegram user:', currentUser);
            
            // Аутентифицируем пользователя на сервере
            const authResponse = await authenticateUser(currentUser);
            if (authResponse) {
                balance = authResponse.balance;
                userLevel = authResponse.level;
                userXP = authResponse.xp;
            }
            
            if (authResult.webAppInstance) {
                try {
                    authResult.webAppInstance.setHeaderColor('#8a2be2');
                    authResult.webAppInstance.enableClosingConfirmation();
                } catch (e) {
                    console.log('WebApp settings error:', e);
                }
            }
        } else {
            currentUser = formatUserData(getTestUserData());
            console.log('Using test user:', currentUser);
            
            if (!document.querySelector('.test-warning')) {
                const warning = document.createElement('div');
                warning.className = 'test-warning';
                warning.textContent = 'Режим тестирования: используются тестовые данные';
                document.body.prepend(warning);
            }
        }

        // Остальной код инициализации...
        updateProfile();
        initTheme();
        initRoulette();
        initDepositModal();
        updateActiveBonuses();
        checkAvailableGiveaways();
        initUserLevel();
        loadUserProgress();
        
        initEventListeners();
        openTab('cases');
        
        console.log('App initialized successfully');
    } catch (e) {
        console.error('Initialization error:', e);
        showToast('Произошла ошибка при инициализации приложения', 'error');
    }
}

function initEventListeners() {
    // Навигация
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            openTab(tabName, this);
        });
    });
    
    // Кейсы
    document.querySelectorAll('.case-card').forEach(card => {
        card.addEventListener('click', function() {
            const caseType = this.getAttribute('data-case-type');
            openCase(caseType);
        });
    });
    
    // Кнопка пополнения
    document.querySelector('.deposit-btn')?.addEventListener('click', openDepositModal);
    
    // Кнопки в модалках
    document.querySelector('.modal-button.secondary')?.addEventListener('click', closeDepositModal);
    document.getElementById('levelUpModal')?.querySelector('.modal-button')
        .addEventListener('click', closeLevelUpModal);
}

function updateProfile() {
    if (!currentUser) return;
    
    const userName = document.getElementById('userName');
    const avatar = document.getElementById('userAvatar');
    const placeholder = document.getElementById('avatarPlaceholder');

    if (userName) userName.textContent = currentUser.name;
    
    if (avatar && placeholder) {
        if (currentUser.photo) {
            placeholder.style.display = 'none';
            avatar.style.backgroundImage = `url(${currentUser.photo})`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
        } else {
            placeholder.style.display = 'flex';
            avatar.style.backgroundImage = 'none';
            
            const initials = currentUser.name.split(' ')
                .map(n => n[0])
                .join('')
                .toUpperCase();
            placeholder.textContent = initials;
        }
    }

    updateUserStats();
}

function updateUserStats() {
    const openedCases = document.getElementById('openedCases');
    const bestPrize = document.getElementById('bestPrize');
    
    if (openedCases) {
        openedCases.textContent = Math.abs(currentUser.id % 20);
    }
    
    if (bestPrize) {
        const prizes = ['Обычный', 'Редкий', 'Эпический', 'Легендарный'];
        bestPrize.textContent = prizes[Math.floor(currentUser.id % 4)];
    }
}

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

// ==================== Функции кейсов ====================
function openTab(tabName, clickedElement) {
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
    if (tab) tab.classList.add('active');
    
    // Активировать кнопку
    const button = clickedElement || document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    if (button) button.classList.add('active');
}

async function openCase(caseType) {
    try {
        console.log(`Opening ${caseType} case...`);
        
        let price = 0;
        switch (caseType) {
            case 'mix': price = 0; break;
            case 'premium': price = 500; break;
            case 'legendary': price = 1000; break;
            default: 
                showToast("Неизвестный тип кейса", "error");
                return;
        }
        
        if (balance < price) {
            showToast("Недостаточно средств", "error");
            return;
        }
        
        // Здесь должна быть реальная логика запроса к API
        // Временно используем mock-данные
        const mockResponse = {
            success: true,
            new_balance: balance - price + 200, // Пример выигрыша
            prize_description: "Редкий приз (200 🪙)",
            leveled_up: false
        };
        
        if (mockResponse.success) {
            updateBalance(mockResponse.new_balance - balance);
            showToast(`Кейс "${caseType}" открыт! Получено: ${mockResponse.prize_description}`, "success");
            
            if (mockResponse.leveled_up) {
                showLevelUpModal(userLevel + 1);
            }
        } else {
            showToast("Ошибка при открытии кейса", "error");
        }
    } catch (error) {
        console.error('Error opening case:', error);
        showToast("Ошибка соединения", "error");
    }
}

// ==================== Функции рулетки ====================
function initRoulette() {
    const track = document.getElementById('rouletteTrack');
    if (!track) return;
    
    track.innerHTML = '';
    
    for (let i = 0; i < 20; i++) {
        const type = getRandomBonusType();
        const bonus = getRandomVariant(type);
        
        const item = document.createElement('div');
        item.className = `roulette-item ${type}`;
        item.innerHTML = `<i class="fas ${bonus.icon}"></i>`;
        item.dataset.type = type;
        item.dataset.title = bonus.title;
        item.dataset.value = bonus.value;
        item.dataset.duration = bonus.duration;
        
        track.appendChild(item);
    }
}

function getRandomBonusType() {
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const type of BONUS_TYPES) {
        cumulative += type.probability;
        if (random <= cumulative) return type.type;
    }
    
    return 'deposit';
}

function getRandomVariant(type) {
    const bonusType = BONUS_TYPES.find(t => t.type === type);
    return bonusType.variants[Math.floor(Math.random() * bonusType.variants.length)];
}

function spinRoulette() {
    if (!canSpin || dailySpins <= 0) {
        showToast("Нет доступных спинов", "error");
        return;
    }

    addXP(15);
    
    dailySpins--;
    saveUserProgress();
    updateLevelSystem();

    if (!canSpin) {
        showToast("Подождите, пока завершится текущий спин", "error");
        return;
    }
    
    if (balance < 100) {
        showToast("Недостаточно средств для спина", "error");
        return;
    }
    
    updateBalance(-100);
    canSpin = false;
    const spinButton = document.querySelector('.spin-button');
    if (spinButton) spinButton.disabled = true;
    
    const track = document.getElementById('rouletteTrack');
    const items = document.querySelectorAll('.roulette-item');
    
    const targetType = getRandomBonusType();
    const targetItems = Array.from(items).filter(item => item.dataset.type === targetType);
    const targetItem = targetItems[Math.floor(Math.random() * targetItems.length)];
    const itemIndex = Array.from(items).indexOf(targetItem);
    
    const itemWidth = 110;
    const stopPosition = -(itemIndex * itemWidth) + (window.innerWidth / 2 - itemWidth / 2);
    
    if (track) {
        track.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)';
        track.style.transform = `translateX(${stopPosition}px)`;
    }
    
    setTimeout(() => {
        const wonBonus = {
            title: targetItem.dataset.title,
            type: targetItem.dataset.type,
            value: parseFloat(targetItem.dataset.value),
            duration: parseInt(targetItem.dataset.duration),
            icon: targetItem.querySelector('i').className
        };
        
        activateBonus(wonBonus);
        showWinModal(wonBonus);
        
        setTimeout(() => {
            if (track) {
                track.style.transition = 'none';
                initRoulette();
            }
            canSpin = true;
            if (spinButton) spinButton.disabled = false;
        }, 500);
    }, 3000);
}

// ==================== Функции бонусов ====================
function activateBonus(bonus) {
    if (bonus.type === 'free') {
        showToast(`Вы получили ${bonus.value} подарка!`, "success");
    }
    
    if (bonus.duration > 0) {
        bonus.endTime = Date.now() + bonus.duration * 3600000;
        activeBonuses.push(bonus);
        updateActiveBonuses();
    }
}

function updateActiveBonuses() {
    const now = Date.now();
    activeBonuses = activeBonuses.filter(b => b.endTime > now);
    
    const container = document.getElementById('activeBonusesList');
    if (!container) return;
    
    if (activeBonuses.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <p>Нет активных бонусов</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    activeBonuses.forEach(bonus => {
        const hoursLeft = Math.ceil((bonus.endTime - now) / 3600000);
        
        const bonusElement = document.createElement('div');
        bonusElement.className = 'bonus-item';
        bonusElement.innerHTML = `
            <div class="bonus-icon ${bonus.type}">
                <i class="${bonus.icon}"></i>
            </div>
            <div class="bonus-info">
                <div>${bonus.title}</div>
                <div class="bonus-timer">Истекает через ${hoursLeft}ч</div>
            </div>
        `;
        
        container.appendChild(bonusElement);
    });
}

function showWinModal(bonus) {
    const modal = document.getElementById('winModal');
    if (!modal) return;
    
    const icon = document.getElementById('winIcon');
    const title = document.getElementById('winTitle');
    const desc = document.getElementById('winDescription');
    
    if (icon) {
        icon.className = `win-icon ${bonus.type}`;
        icon.innerHTML = `<i class="${bonus.icon}"></i>`;
    }
    if (title) title.textContent = "ПОЗДРАВЛЯЕМ!";
    if (desc) desc.textContent = bonus.title;
    
    modal.classList.remove('hidden');
}

function closeWinModal() {
    const modal = document.getElementById('winModal');
    if (modal) modal.classList.add('hidden');
}

// ==================== Функции депозита ====================
function initDepositModal() {
    const tonInput = document.getElementById('tonAmount');
    const starsInput = document.getElementById('starsAmount');
    
    if (tonInput) {
        tonInput.addEventListener('input', () => {
            const ton = parseFloat(tonInput.value) || 0;
            const giftcoin = Math.floor(ton * 200);
            const giftcoinElement = document.getElementById('tonGiftcoin');
            if (giftcoinElement) giftcoinElement.textContent = giftcoin;
        });
    }
    
    if (starsInput) {
        starsInput.addEventListener('input', () => {
            const stars = parseInt(starsInput.value) || 0;
            const giftcoinElement = document.getElementById('starsGiftcoin');
            if (giftcoinElement) giftcoinElement.textContent = stars;
        });
    }
}

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
    const promoCode = document.getElementById('tonPromoCode').value.toUpperCase();
    
    if (!tonAmount || tonAmount < 0.5) {
        showToast("Минимальная сумма пополнения - 0.5 TON", "error");
        return;
    }
    
    try {
        // Здесь должен быть реальный запрос к API
        // Временно используем mock-данные
        const mockResponse = {
            success: true,
            new_balance: balance + tonAmount * 200,
            bonus_received: promoCode === "WELCOME" ? 100 : 0
        };
        
        if (mockResponse.success) {
            updateBalance(mockResponse.new_balance - balance);
            userDeposits += tonAmount * 200;
            
            if (mockResponse.bonus_received > 0) {
                showToast(`Промокод применен! +${mockResponse.bonus_received} GiftCoin`, "success");
            }
            
            showToast(`Баланс пополнен на ${tonAmount * 200} GiftCoin`, "success");
            closeDepositModal();
            checkAvailableGiveaways();
        } else {
            showToast("Ошибка при пополнении", "error");
        }
    } catch (error) {
        console.error('Error:', error);
        showToast("Ошибка соединения", "error");
    }
}

async function processStarsDeposit() {
    const starsAmount = parseInt(document.getElementById('starsAmount').value);
    const promoCode = document.getElementById('starsPromoCode').value.toUpperCase();
    
    if (!starsAmount || starsAmount < 25) {
        showToast("Минимальное количество звезд - 25", "error");
        return;
    }
    
    try {
        // Здесь должен быть реальный запрос к API
        // Временно используем mock-данные
        const mockResponse = {
            success: true,
            new_balance: balance + starsAmount,
            bonus_received: promoCode === "WELCOME" ? 100 : 0
        };
        
        if (mockResponse.success) {
            updateBalance(mockResponse.new_balance - balance);
            userDeposits += starsAmount;
            
            if (mockResponse.bonus_received > 0) {
                showToast(`Промокод применен! +${mockResponse.bonus_received} GiftCoin`, "success");
            }
            
            showToast(`Баланс пополнен на ${starsAmount} GiftCoin`, "success");
            closeDepositModal();
            checkAvailableGiveaways();
        } else {
            showToast("Ошибка при пополнении", "error");
        }
    } catch (error) {
        console.error('Error:', error);
        showToast("Ошибка соединения", "error");
    }
}

// ==================== Функции розыгрышей ====================
function joinGiveaway(minAmount) {
    if (userDeposits >= minAmount) {
        showToast(`Вы участвуете в розыгрыше!`, 'success');
    } else {
        showToast(`Пополните баланс на ${minAmount} 🪙 для участия`, 'error');
        openDepositModal();
    }
}

function checkAvailableGiveaways() {
    const giveawayCards = document.querySelectorAll('.giveaway-card');
    
    giveawayCards.forEach(card => {
        const minDeposit = parseInt(card.dataset.minDeposit);
        const button = card.querySelector('.giveaway-button');
        
        if (button) {
            button.disabled = userDeposits < minAmount;
        }
    });
}

// ==================== Функции уровней ====================
function calculateXPForLevel(level) {
    if (level <= 1) return 0;
    return LEVELS[level - 1]?.xpRequired || 0;
}

function initLevelSystem() {
    userLevel = 1;
    userXP = 0;
    updateLevelDisplay();
}

function addXP(amount) {
    if (amount <= 0) return;
    
    userXP += amount;
    
    let leveledUp = false;
    while (userLevel < LEVELS.length && userXP >= LEVELS[userLevel].xpRequired) {
        userLevel++;
        leveledUp = true;
    }
    
    if (leveledUp) {
        showLevelUpModal(LEVELS[userLevel - 1]);
        applyLevelBonus(userLevel);
    }
    
    updateLevelDisplay();
    saveProgress();
}

function applyLevelBonus(level) {
    switch(level) {
        case 2:
            // +5% к выигрышам
            break;
        case 3:
            // Разблокировать премиум кейсы
            break;
        case 4:
            dailySpins++;
            break;
        case 5:
            // Эксклюзивные бонусы
            break;
    }
}

function showLevelUpModal(levelData) {
    const modal = document.getElementById('levelUpModal');
    if (!modal) return;
    
    const levelText = modal.querySelector('.level-text');
    const rewardText = modal.querySelector('.reward-text');
    const bonusText = modal.querySelector('.bonus-text');
    
    if (levelText) levelText.textContent = `Уровень ${levelData.level}!`;
    if (rewardText) rewardText.textContent = `Награда: ${levelData.reward} 🪙`;
    if (bonusText) bonusText.textContent = `Бонус: ${levelData.bonus}`;
    
    modal.classList.remove('hidden');
}

function closeLevelUpModal() {
    const modal = document.getElementById('levelUpModal');
    if (modal) modal.classList.add('hidden');
}

function updateLevelSystem() {
    const currentLevelData = LEVELS[userLevel - 1];
    const nextLevelData = LEVELS[userLevel] || currentLevelData;
    
    const levelElement = document.getElementById('userLevel');
    if (levelElement) {
        levelElement.textContent = userLevel;
    }
    
    const progress = nextLevelData 
        ? (userXP - currentLevelData.xpRequired) / 
          (nextLevelData.xpRequired - currentLevelData.xpRequired) * 100
        : 100;
    
    const progressBar = document.getElementById('levelProgress');
    if (progressBar) progressBar.style.width = `${progress}%`;
    
    const xpText = document.getElementById('xpText');
    if (xpText) xpText.textContent = `${userXP}/${nextLevelData.xpRequired} XP`;
}

function updateLevelDisplay() {
    const currentLevel = LEVELS[userLevel - 1];
    const nextLevel = LEVELS[userLevel] || currentLevel;
    
    const levelElement = document.getElementById('userLevel');
    if (levelElement) levelElement.textContent = userLevel;
    
    const progressPercent = nextLevel 
        ? ((userXP - currentLevel.xpRequired) / 
          (nextLevel.xpRequired - currentLevel.xpRequired)) * 100
        : 100;
    
    const progressBar = document.getElementById('levelProgress');
    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    
    const xpDisplay = document.getElementById('xpDisplay');
    if (xpDisplay) xpDisplay.textContent = `${userXP}/${nextLevel.xpRequired} XP`;
}

function saveUserProgress() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        Telegram.WebApp.CloudStorage.setItem('userProgress', JSON.stringify({
            xp: userXP,
            level: userLevel,
            spins: dailySpins
        }));
    } else {
        localStorage.setItem('userProgress', JSON.stringify({
            xp: userXP,
            level: userLevel,
            spins: dailySpins
        }));
    }
}

function saveProgress() {
    const progressData = {
        level: userLevel,
        xp: userXP
    };
    
    localStorage.setItem('userProgress', JSON.stringify(progressData));
}

function loadUserProgress() {
    const levelElement = document.getElementById('userLevel');
    const uiLevel = levelElement ? parseInt(levelElement.textContent) : 1;
    
    let data = null;
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        data = Telegram.WebApp.CloudStorage.getItem('userProgress');
    } else {
        data = localStorage.getItem('userProgress');
    }
    
    if (data) {
        try {
            const parsed = JSON.parse(data);
            userLevel = Math.max(parsed.level || 1, uiLevel);
            userXP = Math.max(parsed.xp || 0, calculateXPForLevel(userLevel));
            dailySpins = parsed.spins || 1;
        } catch (e) {
            console.error('Error loading progress:', e);
            userLevel = uiLevel;
            userXP = calculateXPForLevel(userLevel);
        }
    } else {
        userLevel = uiLevel;
        userXP = calculateXPForLevel(userLevel);
    }
}

function loadProgress() {
    const savedData = localStorage.getItem('userProgress');
    if (savedData) {
        try {
            const { level, xp } = JSON.parse(savedData);
            userLevel = Math.min(level, LEVELS.length);
            userXP = Math.max(xp, LEVELS[userLevel - 1].xpRequired);
        } catch (e) {
            console.error("Ошибка загрузки прогресса:", e);
        }
    }
    updateLevelDisplay();
}

function initUserLevel() {
    const levelElement = document.getElementById('userLevel');
    if (levelElement) {
        const currentLevel = parseInt(levelElement.textContent) || 1;
        userLevel = currentLevel;
        userXP = calculateXPForLevel(currentLevel);
        updateLevelSystem();
    }
}

// ==================== Вспомогательные функции ====================
async function updateBalance(amount) {
    try {
        const newBalance = await updateUserBalance(amount);
        if (newBalance !== null) {
            balance = newBalance;
            document.querySelectorAll('.balance-amount').forEach(el => {
                el.textContent = balance;
                
                el.style.transform = 'scale(1.2)';
                el.style.color = amount > 0 ? 'var(--success)' : 'var(--danger)';
                setTimeout(() => {
                    el.style.transform = 'scale(1)';
                    el.style.color = '';
                }, 300);
            });
        }
    } catch (error) {
        console.error('Failed to update balance:', error);
        showToast('Ошибка обновления баланса', 'error');
    }
}

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

// ==================== Глобальное подключение функций ====================
window.openTab = openTab;
window.openCase = openCase;
window.openDepositModal = openDepositModal;
window.closeDepositModal = closeDepositModal;
window.toggleTheme = toggleTheme;
window.spinRoulette = spinRoulette;
window.closeWinModal = closeWinModal;
window.joinGiveaway = joinGiveaway;
window.switchDepositTab = switchDepositTab;
window.processTonDeposit = processTonDeposit;
window.processStarsDeposit = processStarsDeposit;
window.closeLevelUpModal = closeLevelUpModal;

// ==================== Запуск приложения ====================
document.addEventListener('DOMContentLoaded', function() {
    // Дополнительная проверка DOM
    if (!document.getElementById('userName') || 
        !document.getElementById('rouletteTrack') || 
        !document.querySelector('.bottom-nav')) {
        console.error('Critical DOM elements are missing!');
        return;
    }
    
    initApp();
});