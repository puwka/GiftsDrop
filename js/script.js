import { initTelegramAuth, getTestUserData, formatUserData } from './auth.js';

// Глобальные переменные
let balance = 1000;
let canSpin = true;
let activeBonuses = [];
let userDeposits = 0;
let currentUser = null;
let isTelegramApp = false;
let dailySpins = 1;
let userXP = 0;
let userLevel = 1;

// Константы
const API_URL = 'https://your-backend-api.vercel.app/api';
const LEVELS = [
    { level: 1, xpRequired: 0, reward: 0, bonus: "Доступ к базовым кейсам" },
    { level: 2, xpRequired: 100, reward: 50, bonus: "+5% к выигрышам" },
    { level: 3, xpRequired: 300, reward: 100, bonus: "Доступ к премиум кейсам" },
    { level: 4, xpRequired: 600, reward: 200, bonus: "+1 дополнительный спин" },
    { level: 5, xpRequired: 1000, reward: 500, bonus: "Эксклюзивные бонусы" }
];

const PROMO_CODES = {
    "WELCOME": { amount: 100, used: false },
    "GIFT100": { amount: 100, used: false },
    "BONUS50": { amount: 50, used: false }
};

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

// ====================== ИНИЦИАЛИЗАЦИЯ ======================
async function initApp() {
    // Проверяем Telegram WebApp
    isTelegramApp = typeof Telegram !== 'undefined' && Telegram.WebApp;
    
    // Авторизация
    try {
        if (isTelegramApp) {
            const authResult = await handleTelegramAuth();
            if (authResult) {
                currentUser = authResult;
                await loadUserData();
            } else {
                showTestModeWarning();
            }
        } else {
            showTestModeWarning();
        }
    } catch (e) {
        console.error('Init error:', e);
        showTestModeWarning();
    }

    // Инициализация интерфейса
    initInterface();
}

async function handleTelegramAuth() {
    const authResult = initTelegramAuth();
    if (!authResult) return null;

    try {
        const response = await fetch(`${API_URL}/auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'tg-webapp-data': Telegram.WebApp.initData
            },
            body: JSON.stringify({
                initData: Telegram.WebApp.initData
            })
        });

        if (!response.ok) throw new Error('Auth failed');
        return await response.json();
    } catch (e) {
        console.error('Auth API error:', e);
        return null;
    }
}

async function loadUserData() {
    try {
        const response = await fetch(`${API_URL}/user`, {
            headers: {
                'tg-webapp-data': Telegram.WebApp.initData
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            balance = data.balance;
            userDeposits = data.deposits;
            activeBonuses = data.bonuses || [];
            userXP = data.xp || 0;
            userLevel = data.level || 1;
            dailySpins = data.dailySpins || 1;
            updateUI();
        }
    } catch (e) {
        console.error('Load data error:', e);
    }
}

function showTestModeWarning() {
    currentUser = formatUserData(getTestUserData());
    const warning = document.createElement('div');
    warning.className = 'test-warning';
    warning.textContent = 'Режим тестирования: используются тестовые данные';
    document.body.prepend(warning);
}

function initInterface() {
    updateProfile();
    initTheme();
    initRoulette();
    initDepositModal();
    updateActiveBonuses();
    checkAvailableGiveaways();
    updateLevelSystem();
    openTab('cases', document.querySelector('.nav-btn'));
    setInterval(updateActiveBonuses, 60000);
}

// ====================== СИСТЕМА УРОВНЕЙ ======================
function calculateXPForLevel(level) {
    return LEVELS.find(l => l.level === level)?.xpRequired || 0;
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
    
    updateLevelSystem();
    saveProgress();
}

function applyLevelBonus(level) {
    const levelData = LEVELS.find(l => l.level === level);
    if (!levelData) return;

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
    
    if (levelData.reward > 0) {
        updateBalance(levelData.reward);
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

function updateLevelSystem() {
    const currentLevelData = LEVELS[userLevel - 1];
    const nextLevelData = LEVELS[userLevel] || currentLevelData;
    
    document.getElementById('userLevel').textContent = userLevel;
    
    const progressPercent = nextLevelData 
        ? ((userXP - currentLevelData.xpRequired) / 
          (nextLevelData.xpRequired - currentLevelData.xpRequired)) * 100
        : 100;
    
    document.getElementById('levelProgress').style.width = `${progressPercent}%`;
    document.getElementById('xpDisplay').textContent = 
        `${userXP}/${nextLevelData.xpRequired} XP`;
}

async function saveProgress() {
    if (!isTelegramApp) {
        localStorage.setItem('userProgress', JSON.stringify({
            xp: userXP,
            level: userLevel,
            spins: dailySpins
        }));
        return;
    }

    try {
        await fetch(`${API_URL}/progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'tg-webapp-data': Telegram.WebApp.initData
            },
            body: JSON.stringify({
                xp: userXP,
                level: userLevel,
                dailySpins: dailySpins
            })
        });
    } catch (e) {
        console.error('Save progress error:', e);
    }
}

// ====================== ИНТЕРФЕЙС ПОЛЬЗОВАТЕЛЯ ======================
function updateProfile() {
    if (!currentUser) return;
    
    const userName = document.getElementById('userName');
    const avatar = document.getElementById('userAvatar');
    const placeholder = document.getElementById('avatarPlaceholder');

    userName.textContent = currentUser.name;
    
    if (currentUser.photo) {
        placeholder.style.display = 'none';
        avatar.style.backgroundImage = `url(${currentUser.photo})`;
        avatar.style.backgroundSize = 'cover';
    } else {
        placeholder.style.display = 'flex';
        avatar.style.backgroundImage = 'none';
        placeholder.textContent = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();
    }

    updateUserStats();
}

function updateUserStats() {
    document.querySelectorAll('.balance-amount').forEach(el => {
        el.textContent = balance;
    });
    
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

// ====================== СИСТЕМА ВКЛАДОК ======================
function openTab(tabName, clickedElement) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    
    if (clickedElement) {
        clickedElement.classList.add('active');
    } else {
        document.querySelector(`.nav-btn[onclick*="${tabName}"]`).classList.add('active');
    }
}

// ====================== ТЕМНАЯ ТЕМА ======================
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
    
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
        text.textContent = 'Светлая тема';
    } else {
        icon.className = 'fas fa-moon';
        text.textContent = 'Темная тема';
    }
}

// ====================== РУЛЕТКА БОНУСОВ ======================
function initRoulette() {
    const track = document.getElementById('rouletteTrack');
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

async function spinRoulette() {
    if (!canSpin || dailySpins <= 0) {
        showToast("Нет доступных спинов", "error");
        return;
    }

    if (balance < 100) {
        showToast("Недостаточно средств", "error");
        return;
    }
    
    dailySpins--;
    updateBalance(-100);
    addXP(15);
    canSpin = false;
    document.querySelector('.spin-button').disabled = true;
    
    const track = document.getElementById('rouletteTrack');
    const items = document.querySelectorAll('.roulette-item');
    const targetType = getRandomBonusType();
    const targetItems = Array.from(items).filter(item => item.dataset.type === targetType);
    const targetItem = targetItems[Math.floor(Math.random() * targetItems.length)];
    const itemIndex = Array.from(items).indexOf(targetItem);
    const itemWidth = 110;
    const stopPosition = -(itemIndex * itemWidth) + (window.innerWidth / 2 - itemWidth / 2);
    
    track.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)';
    track.style.transform = `translateX(${stopPosition}px)`;
    
    setTimeout(async () => {
        const wonBonus = {
            title: targetItem.dataset.title,
            type: targetItem.dataset.type,
            value: parseFloat(targetItem.dataset.value),
            duration: parseInt(targetItem.dataset.duration),
            icon: targetItem.querySelector('i').className
        };
        
        activateBonus(wonBonus);
        showWinModal(wonBonus);
        
        if (isTelegramApp) {
            await saveBonus(wonBonus);
        }
        
        setTimeout(() => {
            track.style.transition = 'none';
            initRoulette();
            canSpin = true;
            document.querySelector('.spin-button').disabled = false;
        }, 500);
    }, 3000);
}

async function saveBonus(bonus) {
    try {
        await fetch(`${API_URL}/bonus`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'tg-webapp-data': Telegram.WebApp.initData
            },
            body: JSON.stringify({
                bonus: {
                    ...bonus,
                    expiresAt: bonus.duration > 0 
                        ? new Date(Date.now() + bonus.duration * 3600000)
                        : null
                }
            })
        });
    } catch (e) {
        console.error('Save bonus error:', e);
    }
}

// ====================== СИСТЕМА КЕЙСОВ ======================
function openCase(caseType) {
    let price = 0;
    let xpReward = 10;
    
    switch (caseType) {
        case 'premium': 
            price = 500;
            xpReward = 25;
            break;
        case 'legendary': 
            price = 1000;
            xpReward = 50;
            break;
    }
    
    if (balance < price) {
        showToast("Недостаточно средств", "error");
        return;
    }
    
    if (price > 0) {
        updateBalance(-price);
    }
    
    addXP(xpReward);
    showToast(`Кейс "${caseType}" открыт!`, "success");
    
    // Здесь можно добавить логику награды за кейс
}

// ====================== СИСТЕМА ПОПОЛНЕНИЯ ======================
function initDepositModal() {
    const tonInput = document.getElementById('tonAmount');
    const starsInput = document.getElementById('starsAmount');
    
    tonInput.addEventListener('input', () => {
        const ton = parseFloat(tonInput.value) || 0;
        document.getElementById('tonGiftcoin').textContent = Math.floor(ton * 200);
    });
    
    starsInput.addEventListener('input', () => {
        const stars = parseInt(starsInput.value) || 0;
        document.getElementById('starsGiftcoin').textContent = stars;
    });
}

async function processTonDeposit() {
    const tonAmount = parseFloat(document.getElementById('tonAmount').value);
    const promoCode = document.getElementById('tonPromoCode').value.toUpperCase();
    
    if (!tonAmount || tonAmount < 0.5) {
        showToast("Минимальная сумма - 0.5 TON", "error");
        return;
    }
    
    let giftcoinAmount = tonAmount * 200;
    
    if (promoCode && PROMO_CODES[promoCode] && !PROMO_CODES[promoCode].used) {
        giftcoinAmount += PROMO_CODES[promoCode].amount;
        PROMO_CODES[promoCode].used = true;
        showToast(`Промокод применен! +${PROMO_CODES[promoCode].amount} 🪙`, "success");
    }
    
    if (isTelegramApp) {
        try {
            const response = await fetch(`${API_URL}/deposit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'tg-webapp-data': Telegram.WebApp.initData
                },
                body: JSON.stringify({
                    amount: giftcoinAmount,
                    currency: 'TON'
                })
            });
            
            if (!response.ok) throw new Error();
            
            const data = await response.json();
            balance = data.balance;
            userDeposits += giftcoinAmount;
            updateUI();
        } catch (e) {
            console.error('Deposit error:', e);
            showToast("Ошибка пополнения", "error");
            return;
        }
    } else {
        updateBalance(giftcoinAmount);
        userDeposits += giftcoinAmount;
    }
    
    showToast(`Баланс пополнен на ${giftcoinAmount} 🪙`, "success");
    closeDepositModal();
    checkAvailableGiveaways();
}

// ====================== РОЗЫГРЫШИ ======================
function joinGiveaway(minAmount) {
    if (userDeposits >= minAmount) {
        showToast(`Вы участвуете в розыгрыше!`, 'success');
    } else {
        showToast(`Пополните на ${minAmount - userDeposits} 🪙 для участия`, 'error');
        openDepositModal();
    }
}

function checkAvailableGiveaways() {
    document.querySelectorAll('.giveaway-card').forEach(card => {
        const minDeposit = parseInt(card.dataset.minDeposit);
        const button = card.querySelector('.giveaway-button');
        button.disabled = userDeposits < minDeposit;
    });
}

// ====================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======================
function updateBalance(amount) {
    balance += amount;
    updateUI();
    
    document.querySelectorAll('.balance-amount').forEach(el => {
        el.style.transform = 'scale(1.2)';
        el.style.color = amount > 0 ? 'var(--success)' : 'var(--danger)';
        setTimeout(() => {
            el.style.transform = 'scale(1)';
            el.style.color = '';
        }, 300);
    });
}

function updateUI() {
    updateUserStats();
    updateActiveBonuses();
    checkAvailableGiveaways();
    updateLevelSystem();
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${
            type === 'success' ? 'check-circle' : 
            type === 'error' ? 'exclamation-circle' : 'info-circle'
        }"></i>
        ${message}
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ====================== АКТИВНЫЕ БОНУСЫ ======================
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

// ====================== МОДАЛЬНЫЕ ОКНА ======================
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

function closeWinModal() {
    document.getElementById('winModal').classList.add('hidden');
}

function closeLevelUpModal() {
    document.getElementById('levelUpModal').classList.add('hidden');
}

function openDepositModal() {
    document.getElementById('depositModal').classList.remove('hidden');
}

function closeDepositModal() {
    document.getElementById('depositModal').classList.add('hidden');
}

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

// ====================== ЭКСПОРТ ФУНКЦИЙ ======================
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