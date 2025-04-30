// Глобальные переменные
let balance = 1000;
let canSpin = true;
let activeBonuses = [];
let userDeposits = 0;

// Типы бонусов и их вероятности
const BONUS_TYPES = [
    {
        type: 'deposit',
        probability: 45,
        variants: [
            { icon: 'fa-coins', title: '+10% к депозиту', value: 10, duration: 24 },
            { icon: 'fa-piggy-bank', title: '+15% к депозиту', value: 15, duration: 12 },
            { icon: 'fa-wallet', title: '+20% к депозиту', value: 20, duration: 6 }
        ]
    },
    {
        type: 'discount',
        probability: 35,
        variants: [
            { icon: 'fa-percentage', title: 'Скидка 10%', value: 10, duration: 24 },
            { icon: 'fa-tag', title: 'Скидка 15%', value: 15, duration: 12 },
            { icon: 'fa-badge-percent', title: 'Скидка 20%', value: 20, duration: 6 }
        ]
    },
    {
        type: 'free',
        probability: 20,
        variants: [
            { icon: 'fa-gift', title: '1 бесплатный кейс', value: 1, duration: 0 },
            { icon: 'fa-box-open', title: '2 бесплатных кейса', value: 2, duration: 0 },
            { icon: 'fa-star', title: '3 бесплатных кейса', value: 3, duration: 0 }
        ]
    }
];

// Промокоды
const PROMO_CODES = {
    'WELCOME': { amount: 100, used: false },
    'BONUS50': { amount: 50, used: false },
    'FREEGIFT': { amount: 200, used: false }
};

// ====================== ТЕЛЕГРАМ ИНТЕГРАЦИЯ ======================
function initTelegramWebApp() {
    // Проверяем доступность Telegram WebApp API
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        console.log("Telegram WebApp API доступен");
        
        const webApp = Telegram.WebApp;
        const user = webApp.initDataUnsafe?.user;
        
        if (user) {
            console.log("Данные пользователя Telegram:", user);
            
            // Развертываем на весь экран
            webApp.expand();
            webApp.ready();
            
            // Обновляем профиль с реальными данными
            updateProfileWithTelegramData(user);
            return;
        }
    }
    
    console.log("Режим тестирования (вне Telegram)");
    // Используем тестовые данные только если не в Telegram
    updateProfileWithTelegramData({
        first_name: "Тестовый",
        last_name: "Пользователь",
        username: "test_user",
        photo_url: "https://via.placeholder.com/150"
    });
}

// Обновление профиля с данными из Telegram
function updateProfileWithTelegramData(user) {
    const userName = document.getElementById('userName');
    const avatar = document.getElementById('userAvatar');
    const placeholder = document.getElementById('avatarPlaceholder');
    
    // Формируем имя для отображения
    let displayName = user.first_name || "Гость";
    if (user.last_name) {
        displayName += ` ${user.last_name}`;
    }
    if (user.username) {
        displayName += ` (@${user.username})`;
    }
    
    userName.textContent = displayName;
    
    // Устанавливаем аватар
    if (user.photo_url) {
        placeholder.style.display = 'none';
        avatar.style.backgroundImage = `url(${user.photo_url})`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
    } else {
        placeholder.style.display = 'flex';
        avatar.style.backgroundImage = 'none';
        avatar.style.backgroundColor = 'var(--primary)';
    }
    
    // Обновляем уровень (примерная логика)
    const levelElement = document.querySelector('.profile-info .level');
    if (levelElement) {
        const userId = user.id || 0;
        levelElement.textContent = Math.max(1, Math.min(10, Math.floor(userId % 10) + 1));
    }
    
    // Обновляем статистику
    updateUserStats(user.id || 0);
}

// Обновление статистики пользователя
function updateUserStats(userId) {
    const openedCases = document.getElementById('openedCases');
    const bestPrize = document.getElementById('bestPrize');
    
    if (openedCases) {
        openedCases.textContent = Math.max(0, Math.floor(userId % 20));
    }
    
    if (bestPrize) {
        const prizes = ['Обычный', 'Редкий', 'Эпический', 'Легендарный'];
        bestPrize.textContent = prizes[Math.floor(userId % 4)] || 'Обычный';
    }
}

// ====================== ОСНОВНЫЕ ФУНКЦИИ ======================
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

// Переключение вкладок
function openTab(tabName) {
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
    event.currentTarget.classList.add('active');
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
    if (!canSpin || balance < 100) {
        showToast("Недостаточно средств или подождите", "error");
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
    const itemWidth = 110; // Ширина элемента + отступ
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
            initRoulette(); // Переинициализация для бесконечной прокрутки
            canSpin = true;
            document.querySelector('.spin-button').disabled = false;
        }, 500);
    }, 3000);
}

// Активация бонуса
function activateBonus(bonus) {
    // Применяем мгновенные бонусы
    if (bonus.type === 'free') {
        showToast(`Вы получили ${bonus.value} подарка!`, "success");
    }
    
    // Добавляем временные бонусы
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
    const modal = document.createElement('div');
    modal.id = 'winModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>ПОЗДРАВЛЯЕМ!</h3>
            <div class="win-icon ${bonus.type}">
                <i class="${bonus.icon}"></i>
            </div>
            <p>${bonus.title}</p>
            <button class="modal-button" onclick="closeWinModal()">OK</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
}

// Закрытие модального окна
function closeWinModal() {
    const modal = document.getElementById('winModal');
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
}

// Открытие кейса
function openCase(caseType) {
    const modal = document.createElement('div');
    modal.id = 'caseModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>${caseType === 'mix' ? 'МИКС КЕЙС' : caseType === 'premium' ? 'ПРЕМИУМ КЕЙС' : 'ЛЕГЕНДАРНЫЙ КЕЙС'}</h3>
            <div class="case-animation">
                <div class="case-top"></div>
                <div class="case-bottom">
                    <div id="caseReward"></div>
                </div>
            </div>
            <button class="modal-button" onclick="closeCaseModal()">ЗАКРЫТЬ</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    
    // Через 1 секунду показываем награду
    setTimeout(() => {
        const rewards = {
            'mix': ['🔮 Магический артефакт', '🧢 Обычная кепка', '💍 Серебряное кольцо'],
            'premium': ['📱 Смартфон', '🎧 Наушники', '⌚ Умные часы'],
            'legendary': ['🏆 Легендарный трофей', '💎 Алмаз', '🚗 Виртуальный автомобиль']
        };
        
        const randomReward = rewards[caseType][Math.floor(Math.random() * rewards[caseType].length)];
        document.getElementById('caseReward').textContent = randomReward.split(' ')[0];
        
        // Добавляем валюту
        updateBalance(100);
    }, 1000);
}

// Закрытие модального окна кейса
function closeCaseModal() {
    const modal = document.getElementById('caseModal');
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
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
    
    document.querySelector(`.deposit-tab[onclick="switchDepositTab('${tabName}')"]`).classList.add('active');
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
    
    // Здесь должна быть интеграция с TON кошельком
    // В демо-режиме просто добавляем баланс
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
    
    // Здесь должна быть интеграция с Telegram Stars API
    // В демо-режиме просто добавляем баланс
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
    const balanceElements = document.querySelectorAll('.balance-amount');
    const startBalance = balance;
    balance += amount;
    
    let current = startBalance;
    const increment = amount / 20;
    
    const timer = setInterval(() => {
        current += increment;
        if ((amount > 0 && current >= balance) || (amount < 0 && current <= balance)) {
            clearInterval(timer);
            current = balance;
        }
        balanceElements.forEach(el => {
            el.textContent = Math.floor(current);
        });
    }, 20);
    
    // Анимация
    balanceElements.forEach(el => {
        el.style.transform = 'scale(1.2)';
        el.style.color = amount > 0 ? 'var(--success)' : 'var(--danger)';
        setTimeout(() => {
            el.style.transform = 'scale(1)';
            el.style.color = '';
        }, 300);
    });
}

// Показ уведомления
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    const colors = {
        'info': 'var(--primary)',
        'success': 'var(--success)',
        'error': 'var(--danger)'
    };
    
    toast.style.background = colors[type];
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('hidden');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Инициализация Telegram WebApp (должна быть первой!)
    initTelegramWebApp();
    
    // 2. Инициализация остальных компонентов
    initTheme();
    initRoulette();
    initDepositModal();
    updateActiveBonuses();
    openTab('cases');
    checkAvailableGiveaways();
    
    // 3. Периодическое обновление
    setInterval(updateActiveBonuses, 60000);
    
    // 4. Добавляем кнопку для теста (только вне Telegram)
    if (typeof Telegram === 'undefined') {
        const testBtn = document.createElement('button');
        testBtn.className = 'test-data-btn';
        testBtn.textContent = 'Тестовые данные';
        testBtn.onclick = () => {
            updateProfileWithTelegramData({
                first_name: "Тестовый",
                last_name: "Пользователь",
                username: "test_user",
                photo_url: "https://via.placeholder.com/150",
                id: Math.floor(Math.random() * 100000)
            });
            showToast("Тестовые данные загружены", "success");
        };
        document.body.appendChild(testBtn);
    }
});