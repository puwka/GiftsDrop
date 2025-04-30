const API_URL = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000' 
    : 'https://gifts-drop.vercel.app/';

// script.js
import { initTelegramAuth, getTestUserData, formatUserData } from './auth.js';

// Глобальные переменные
let balance = 1000;
let canSpin = true;
let activeBonuses = [];
let userDeposits = 0;
let currentUser = null;

// В объектах LEVELS добавьте свойство bonus
const LEVELS = [
    { level: 1, xpRequired: 0, reward: 0, bonus: "Доступ к базовым кейсам" },
    { level: 2, xpRequired: 100, reward: 50, bonus: "+5% к выигрышам" },
    { level: 3, xpRequired: 300, reward: 100, bonus: "Доступ к премиум кейсам" },
    { level: 4, xpRequired: 600, reward: 200, bonus: "+1 дополнительный спин" },
    { level: 5, xpRequired: 1000, reward: 500, bonus: "Эксклюзивные бонусы" }
];

// Глобальные переменные
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

function initApp() {
    // 1. Авторизация
    try {
        const authResult = initTelegramAuth();
        
        if (authResult && authResult.data) {
            // Режим Telegram - используем реальные данные
            currentUser = formatUserData(authResult.data);
            console.log('Authenticated as Telegram user:', currentUser);
            
            // Настройка WebApp
            if (authResult.webAppInstance) {
                try {
                    authResult.webAppInstance.setHeaderColor('#8a2be2');
                    authResult.webAppInstance.enableClosingConfirmation();
                } catch (e) {
                    console.log('WebApp settings error:', e);
                }
            }
        } else {
            // Тестовый режим
            currentUser = formatUserData(getTestUserData());
            console.log('Using test user:', currentUser);
            
            // Добавляем предупреждение в интерфейс
            if (!document.querySelector('.test-warning')) {
                const warning = document.createElement('div');
                warning.className = 'test-warning';
                warning.textContent = 'Режим тестирования: используются тестовые данные';
                document.body.prepend(warning);
            }
        }
    } catch (e) {
        console.error('Auth error:', e);
        currentUser = formatUserData(getTestUserData());
    }

    // 2. Обновление интерфейса
    updateProfile();
    initTheme();
    initRoulette();
    initDepositModal();
    updateActiveBonuses();
    checkAvailableGiveaways();
    initUserLevel();
    loadUserProgress();
    updateLevelSystem();
    initLevelSystem(); // Всегда начинаем с 1 уровня
    loadProgress();
    
    // 3. Открываем стартовую вкладку
    openTab('cases', document.querySelector('.nav-btn'));
    
    // 4. Периодическое обновление
    setInterval(updateActiveBonuses, 60000);
}

// Инициализация темы
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeSwitch(savedTheme);
}

// Переключение темы
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeSwitch(newTheme);
}

// Обновление переключателя темы
function updateThemeSwitch(theme) {
    const icon = document.querySelector('.theme-switch-btn i');
    const text = document.querySelector('.theme-switch-btn span');
    
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
        text.textContent = 'Светлая тема';
    } else {
        icon.className = 'fas fa-moon';
        text.textContent = 'Темная тема';
    }
}

// Обновление профиля
function updateProfile() {
    if (!currentUser) return;
    
    const userName = document.getElementById('userName');
    const avatar = document.getElementById('userAvatar');
    const placeholder = document.getElementById('avatarPlaceholder');

    // Обновляем имя пользователя
    userName.textContent = currentUser.name;
    
    // Обновляем аватар
    if (currentUser.photo) {
        placeholder.style.display = 'none';
        avatar.style.backgroundImage = `url(${currentUser.photo})`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
    } else {
        placeholder.style.display = 'flex';
        avatar.style.backgroundImage = 'none';
        
        // Генерируем инициалы для аватара
        const initials = currentUser.name.split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase();
        placeholder.textContent = initials;
    }

    updateUserStats();
}

// Обновление статистики
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

// Новая функция для расчета XP
function calculateXPForLevel(level) {
    if (level <= 1) return 0;
    return LEVELS[level - 1]?.xpRequired || 0;
}

// Новая функция инициализации уровней
function initLevelSystem() {
    // Сбрасываем всегда на 1 уровень при инициализации
    userLevel = 1;
    userXP = 0;
    
    // Обновляем отображение
    updateLevelDisplay();
}

// Обновите функцию addXP
function addXP(amount) {
    if (amount <= 0) return;
    
    userXP += amount;
    
    // Проверяем повышение уровня
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

function checkLevelUp() {
    const currentLevelData = LEVELS[userLevel - 1];
    const nextLevelData = LEVELS[userLevel];
    
    if (nextLevelData && userXP >= nextLevelData.xpRequired) {
        userLevel++;
        balance += nextLevelData.reward;
        
        showLevelUpModal(nextLevelData);
        applyLevelBonus(userLevel);
        saveUserProgress();
        updateLevelSystem();
        
        return true;
    }
    return false;
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
    const levelText = modal.querySelector('.level-text');
    const rewardText = modal.querySelector('.reward-text');
    const bonusText = modal.querySelector('.bonus-text');
    
    levelText.textContent = `Уровень ${levelData.level}!`;
    rewardText.textContent = `Награда: ${levelData.reward} 🪙`;
    bonusText.textContent = `Бонус: ${levelData.bonus}`;
    
    modal.classList.remove('hidden');
}

function closeLevelUpModal() {
    document.getElementById('levelUpModal').classList.add('hidden');
}

// Обновляем функцию отображения
function updateLevelSystem() {
    const currentLevelData = LEVELS[userLevel - 1];
    const nextLevelData = LEVELS[userLevel] || currentLevelData;
    
    // Обновляем уровень в профиле
    const levelElement = document.getElementById('userLevel');
    if (levelElement) {
        levelElement.textContent = userLevel;
    }
    
    // Обновляем прогресс-бар
    const progress = nextLevelData 
        ? (userXP - currentLevelData.xpRequired) / 
          (nextLevelData.xpRequired - currentLevelData.xpRequired) * 100
        : 100;
    
    document.getElementById('levelProgress').style.width = `${progress}%`;
    document.getElementById('xpText').textContent = 
        `${userXP}/${nextLevelData.xpRequired} XP`;
}

// Функция обновления отображения
function updateLevelDisplay() {
    const currentLevel = LEVELS[userLevel - 1];
    const nextLevel = LEVELS[userLevel] || currentLevel;
    
    // Обновляем цифру уровня
    document.getElementById('userLevel').textContent = userLevel;
    
    // Обновляем прогресс-бар
    const progressPercent = nextLevel 
        ? ((userXP - currentLevel.xpRequired) / 
          (nextLevel.xpRequired - currentLevel.xpRequired)) * 100
        : 100;
    
    document.getElementById('levelProgress').style.width = `${progressPercent}%`;
    document.getElementById('xpDisplay').textContent = 
        `${userXP}/${nextLevel.xpRequired} XP`;
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

// Сохранение прогресса
function saveProgress() {
    const progressData = {
        level: userLevel,
        xp: userXP
    };
    
    localStorage.setItem('userProgress', JSON.stringify(progressData));
}

function loadUserProgress() {
    // Проверяем текущий уровень в интерфейсе
    const levelElement = document.getElementById('userLevel');
    const uiLevel = levelElement ? parseInt(levelElement.textContent) : 1;
    
    // Загружаем сохраненные данные
    let data = null;
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        data = Telegram.WebApp.CloudStorage.getItem('userProgress');
    } else {
        data = localStorage.getItem('userProgress');
    }
    
    if (data) {
        try {
            const parsed = JSON.parse(data);
            // Используем максимальный уровень (из сохранения или интерфейса)
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

// Загрузка прогресса
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
        // Получаем текущий уровень из интерфейса
        const currentLevel = parseInt(levelElement.textContent) || 1;
        
        // Инициализируем систему
        userLevel = currentLevel;
        userXP = calculateXPForLevel(currentLevel);
        
        // Обновляем отображение
        updateLevelSystem();
    }
}

// Переключение вкладок
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
    document.getElementById(tabName).classList.add('active');
    
    // Активировать кнопку
    if (clickedElement) {
        clickedElement.classList.add('active');
    } else {
        document.querySelector(`.nav-btn[onclick*="${tabName}"]`).classList.add('active');
    }
}

// Инициализация рулетки
function initRoulette() {
    const track = document.getElementById('rouletteTrack');
    track.innerHTML = '';
    
    // Создаем 20 элементов для плавной прокрутки
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

// Получение случайного типа бонуса с учетом вероятности
function getRandomBonusType() {
    const random = Math.random() * 100;
    let cumulative = 0;
    
    for (const type of BONUS_TYPES) {
        cumulative += type.probability;
        if (random <= cumulative) return type.type;
    }
    
    return 'deposit';
}

// Получение случайного варианта бонуса
function getRandomVariant(type) {
    const bonusType = BONUS_TYPES.find(t => t.type === type);
    return bonusType.variants[Math.floor(Math.random() * bonusType.variants.length)];
}

// Прокрутка рулетки
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
    document.querySelector('.spin-button').disabled = true;
    
    const track = document.getElementById('rouletteTrack');
    const items = document.querySelectorAll('.roulette-item');
    
    // Выбираем случайный бонус с учетом вероятностей
    const targetType = getRandomBonusType();
    const targetItems = Array.from(items).filter(item => item.dataset.type === targetType);
    const targetItem = targetItems[Math.floor(Math.random() * targetItems.length)];
    const itemIndex = Array.from(items).indexOf(targetItem);
    
    // Расчет позиции для остановки
    const itemWidth = 110;
    const stopPosition = -(itemIndex * itemWidth) + (window.innerWidth / 2 - itemWidth / 2);
    
    // Анимация прокрутки
    track.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)';
    track.style.transform = `translateX(${stopPosition}px)`;
    
    // После завершения анимации
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
        
        // Сброс анимации
        setTimeout(() => {
            track.style.transition = 'none';
            initRoulette();
            canSpin = true;
            document.querySelector('.spin-button').disabled = false;
        }, 500);
    }, 3000);
}

// Активация бонуса
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

// Обновление списка активных бонусов
function updateActiveBonuses() {
    const now = Date.now();
    activeBonuses = activeBonuses.filter(b => b.endTime > now);
    
    const container = document.getElementById('activeBonusesList');
    
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

// Показ модального окна с выигрышем
function showWinModal(bonus) {
    const modal = document.getElementById('winModal');
    const icon = document.getElementById('winIcon');
    const title = document.getElementById('winTitle');
    const desc = document.getElementById('winDescription');
    
    icon.className = `win-icon ${bonus.type}`;
    icon.innerHTML = `<i class="${bonus.icon}"></i>`;
    title.textContent = "ПОЗДРАВЛЯЕМ!";
    desc.textContent = bonus.title;
    
    modal.classList.remove('hidden');
}

// Закрытие модального окна
function closeWinModal() {
    document.getElementById('winModal').classList.add('hidden');
}

// Участие в розыгрыше
function joinGiveaway(minAmount) {
    if (userDeposits >= minAmount) {
        showToast(`Вы участвуете в розыгрыше!`, 'success');
    } else {
        showToast(`Пополните баланс на ${minAmount} 🪙 для участия`, 'error');
        openDepositModal();
    }
}

// Инициализация модалки пополнения
function initDepositModal() {
    const tonInput = document.getElementById('tonAmount');
    const starsInput = document.getElementById('starsAmount');
    
    tonInput.addEventListener('input', () => {
        const ton = parseFloat(tonInput.value) || 0;
        const giftcoin = Math.floor(ton * 200);
        document.getElementById('tonGiftcoin').textContent = giftcoin;
    });
    
    starsInput.addEventListener('input', () => {
        const stars = parseInt(starsInput.value) || 0;
        document.getElementById('starsGiftcoin').textContent = stars;
    });
}

// Переключение вкладок пополнения
function switchDepositTab(tabName) {
    document.querySelectorAll('.deposit-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.deposit-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.querySelector(`.deposit-tab[onclick*="${tabName}"]`).classList.add('active');
    document.querySelector(`.deposit-tab-content.${tabName}`).classList.add('active');
}

// Обработка пополнения через TON
function processTonDeposit() {
    const tonAmount = parseFloat(document.getElementById('tonAmount').value);
    const promoCode = document.getElementById('tonPromoCode').value.toUpperCase();
    
    if (!tonAmount || tonAmount < 0.5) {
        showToast("Минимальная сумма пополнения - 0.5 TON", "error");
        return;
    }
    
    let giftcoinAmount = tonAmount * 200;
    
    // Применяем промокод, если он валиден
    if (promoCode && PROMO_CODES[promoCode] && !PROMO_CODES[promoCode].used) {
        giftcoinAmount += PROMO_CODES[promoCode].amount;
        PROMO_CODES[promoCode].used = true;
        showToast(`Промокод применен! +${PROMO_CODES[promoCode].amount} GiftCoin`, "success");
    }
    
    updateBalance(giftcoinAmount);
    userDeposits += giftcoinAmount;
    showToast(`Баланс пополнен на ${giftcoinAmount} GiftCoin`, "success");
    closeDepositModal();
    checkAvailableGiveaways();
}

// Обработка пополнения звездами
function processStarsDeposit() {
    const starsAmount = parseInt(document.getElementById('starsAmount').value);
    const promoCode = document.getElementById('starsPromoCode').value.toUpperCase();
    
    if (!starsAmount || starsAmount < 25) {
        showToast("Минимальное количество звезд - 25", "error");
        return;
    }
    
    let giftcoinAmount = starsAmount;
    
    // Применяем промокод, если он валиден
    if (promoCode && PROMO_CODES[promoCode] && !PROMO_CODES[promoCode].used) {
        giftcoinAmount += PROMO_CODES[promoCode].amount;
        PROMO_CODES[promoCode].used = true;
        showToast(`Промокод применен! +${PROMO_CODES[promoCode].amount} GiftCoin`, "success");
    }
    
    updateBalance(giftcoinAmount);
    userDeposits += giftcoinAmount;
    showToast(`Баланс пополнен на ${giftcoinAmount} GiftCoin`, "success");
    closeDepositModal();
    checkAvailableGiveaways();
}

// Открытие модального окна пополнения
function openDepositModal() {
    document.getElementById('depositModal').classList.remove('hidden');
}

// Закрытие модального окна пополнения
function closeDepositModal() {
    document.getElementById('depositModal').classList.add('hidden');
}

// Проверка доступных розыгрышей
function checkAvailableGiveaways() {
    const giveawayCards = document.querySelectorAll('.giveaway-card');
    
    giveawayCards.forEach(card => {
        const minDeposit = parseInt(card.dataset.minDeposit);
        const button = card.querySelector('.giveaway-button');
        
        button.disabled = userDeposits < minDeposit;
    });
}

// Обновление баланса
function updateBalance(amount) {
    balance += amount;
    document.querySelectorAll('.balance-amount').forEach(el => {
        el.textContent = balance;
        
        // Анимация изменения баланса
        el.style.transform = 'scale(1.2)';
        el.style.color = amount > 0 ? 'var(--success)' : 'var(--danger)';
        setTimeout(() => {
            el.style.transform = 'scale(1)';
            el.style.color = '';
        }, 300);
    });
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

// Инициализация Telegram WebApp
function initTelegramWebApp() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        Telegram.WebApp.ready();
        Telegram.WebApp.expand();
    }
}

// Пример: открытие кейса
async function openCase(caseType) {
    try {
        const response = await fetch(`${API_URL}/api/cases/open`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                case_type: caseType
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            updateBalance(data.new_balance - balance);
            showToast(`Кейс "${caseType}" открыт! Получено: ${data.prize_description}`, "success");
            
            if (data.leveled_up) {
                showLevelUpModal(data.current_level);
            }
        } else {
            showToast(data.msg || "Ошибка при открытии кейса", "error");
        }
    } catch (error) {
        console.error('Error:', error);
        showToast("Ошибка соединения", "error");
    }
}

// Экспорт функций для HTML
window.initApp = initApp;
window.openTab = openTab;
window.toggleTheme = toggleTheme;
window.spinRoulette = spinRoulette;
window.closeWinModal = closeWinModal;
window.joinGiveaway = joinGiveaway;
window.switchDepositTab = switchDepositTab;
window.processTonDeposit = processTonDeposit;
window.processStarsDeposit = processStarsDeposit;
window.openDepositModal = openDepositModal;
window.closeDepositModal = closeDepositModal;
window.openCase = openCase;
window.closeLevelUpModal = closeLevelUpModal;

// Запуск приложения
document.addEventListener('DOMContentLoaded', initApp);