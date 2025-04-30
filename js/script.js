// Глобальные переменные
let balance = 1000;
let canSpin = true;
let activeBonuses = [];
let userDeposits = 0;
let tgUserData = {
    first_name: "Гость",
    photo_url: ""
};

// Функция для загрузки данных пользователя из Telegram
function loadTelegramUserData() {
    // Проверяем, что мы внутри Telegram WebApp
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        const webApp = Telegram.WebApp;
        
        // Получаем данные пользователя
        const user = webApp.initDataUnsafe?.user;
        
        if (user) {
            // Формируем объект с данными пользователя
            const userData = {
                id: user.id || 0,
                firstName: user.first_name || 'Гость',
                lastName: user.last_name || '',
                username: user.username ? `@${user.username}` : '',
                photoUrl: user.photo_url || '',
                languageCode: user.language_code || 'ru'
            };
            
            console.log('Данные пользователя Telegram:', userData);
            return userData;
        }
    }
    
    // Возвращаем данные по умолчанию, если не в Telegram
    console.log('Режим тестирования (вне Telegram)');
    return {
        id: 0,
        firstName: 'Гость',
        lastName: '',
        username: '',
        photoUrl: '',
        languageCode: 'ru'
    };
}

// Функция для обновления профиля на основе данных Telegram
function updateProfileWithTelegramData() {
    const userData = loadTelegramUserData();
    
    // Получаем элементы DOM
    const userNameElement = document.getElementById('userName');
    const userAvatarElement = document.getElementById('userAvatar');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    
    // Формируем полное имя пользователя
    let fullName = userData.firstName;
    if (userData.lastName) {
        fullName += ` ${userData.lastName}`;
    }
    
    // Устанавливаем имя пользователя
    if (userData.username) {
        userNameElement.textContent = `${fullName} (${userData.username})`;
    } else {
        userNameElement.textContent = fullName;
    }
    
    // Устанавливаем аватар
    if (userData.photoUrl) {
        // Скрываем placeholder и показываем аватар
        avatarPlaceholder.style.display = 'none';
        userAvatarElement.style.backgroundImage = `url(${userData.photoUrl})`;
        userAvatarElement.style.backgroundSize = 'cover';
        userAvatarElement.style.backgroundPosition = 'center';
    } else {
        // Показываем placeholder, если нет аватара
        avatarPlaceholder.style.display = 'flex';
        userAvatarElement.style.backgroundImage = 'none';
        userAvatarElement.style.backgroundColor = 'var(--primary)';
    }
    
    // Добавляем дополнительные данные, если нужно
    const userLevelElement = document.querySelector('.profile-info .level');
    if (userLevelElement) {
        // Можно добавить логику определения уровня на основе id пользователя
        // Например, четные ID - уровень 5, нечетные - уровень 3
        userLevelElement.textContent = userData.id % 2 === 0 ? '5' : '3';
    }
    
    // Обновляем статистику (можно добавить логику сохранения статистики)
    updateUserStats();
}

// Функция для обновления статистики пользователя
function updateUserStats() {
    const userData = loadTelegramUserData();
    
    // Генерируем статистику на основе ID пользователя для демонстрации
    const openedCasesElement = document.getElementById('openedCases');
    const bestPrizeElement = document.getElementById('bestPrize');
    
    if (openedCasesElement) {
        const baseCases = Math.abs(userData.id % 20); // От 0 до 19
        openedCasesElement.textContent = baseCases + 3; // От 3 до 22
    }
    
    if (bestPrizeElement) {
        const prizes = ['Обычный', 'Редкий', 'Эпический', 'Легендарный'];
        const prizeIndex = Math.abs(userData.id % 4);
        bestPrizeElement.textContent = prizes[prizeIndex];
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // 1. Инициализация Telegram WebApp
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        Telegram.WebApp.expand();
        Telegram.WebApp.ready();
    }
    
    // 2. Загрузка данных пользователя
    updateProfileWithTelegramData();
    
    // 3. Добавляем кнопку для теста, если не в Telegram
    if (typeof Telegram === 'undefined') {
        addTestUserButton();
    }
});

// Функция для добавления тестовой кнопки (вне Telegram)
function addTestUserButton() {
    const testBtn = document.createElement('button');
    testBtn.className = 'test-data-btn';
    testBtn.textContent = 'Тестовые данные';
    testBtn.onclick = () => {
        // Имитируем данные пользователя Telegram
        const testUser = {
            id: 123456789,
            firstName: 'Иван',
            lastName: 'Иванов',
            username: 'ivanov',
            photoUrl: 'https://via.placeholder.com/150',
            languageCode: 'ru'
        };
        
        // Сохраняем тестовые данные
        window.tgUserData = testUser;
        
        // Обновляем профиль
        updateProfileWithTelegramData();
        
        // Показываем уведомление
        showToast('Тестовые данные загружены', 'success');
    };
    
    document.body.appendChild(testBtn);
}

// Вспомогательная функция для показа уведомлений
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    
    // Стили в зависимости от типа
    const colors = {
        'info': 'var(--primary)',
        'success': 'var(--success)',
        'error': 'var(--danger)'
    };
    
    toast.style.backgroundColor = colors[type] || colors.info;
    document.body.appendChild(toast);
    
    // Автоматическое скрытие
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
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

// Открытие кейса
function openCase(caseType) {
    const modal = document.getElementById('caseModal');
    const rewardElement = document.getElementById('caseReward');
    
    // Скрываем все кейсы
    modal.classList.remove('hidden');
    
    // Через 1 секунду показываем награду
    setTimeout(() => {
        const rewards = {
            'mix': ['🔮 Магический артефакт', '🧢 Обычная кепка', '💍 Серебряное кольцо'],
            'premium': ['📱 Смартфон', '🎧 Наушники', '⌚ Умные часы'],
            'legendary': ['🏆 Легендарный трофей', '💎 Алмаз', '🚗 Виртуальный автомобиль']
        };
        
        const randomReward = rewards[caseType][Math.floor(Math.random() * rewards[caseType].length)];
        rewardElement.textContent = randomReward.split(' ')[0];
        
        // Добавляем валюту
        updateBalance(100);
    }, 1000);
}

// Закрытие модального окна кейса
function closeCaseModal() {
    document.getElementById('caseModal').classList.add('hidden');
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