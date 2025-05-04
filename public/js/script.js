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
let wonItem = null;

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
            localStorage.setItem('userBalance', balance); // Сохраняем
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
    const levelElement = document.getElementById('userLevel');
    const xpElement = document.getElementById('xpDisplay');
    
    if (levelElement) levelElement.textContent = userLevel;
    if (xpElement) xpElement.textContent = `${userXP}/100 XP`;
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

function navigateTo(url) {
    // Сохраняем баланс перед переходом
    if (currentUser) {
        localStorage.setItem('userBalance', balance);
    }
    
    // Если URL содержит хэш (например, #bonuses), делаем плавный скролл
    if (url.includes('#')) {
        const [base, hash] = url.split('#');
        window.location.href = base;
        
        // После загрузки страницы скроллим к нужному разделу
        window.addEventListener('load', () => {
            const section = document.getElementById(hash);
            if (section) {
                section.scrollIntoView({ behavior: 'smooth' });
            }
        });
    } else {
        window.location.href = url;
    }
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
        console.log(`Загрузка кейса ID: ${caseId}`);
        const response = await apiRequest(`/users/case/${caseId}`);
        console.log('Ответ сервера:', response);
        
        if (!response.success) throw new Error(response.error || 'Case not found');
        
        currentCase = response.case;
        caseItems = response.items || [];
        console.log('Получено предметов:', caseItems.length);
        
        // Показываем статичное изображение кейса
        renderCasePage();
        
    } catch (error) {
        console.error('Ошибка загрузки кейса:', error);
        showToast("Ошибка загрузки кейса", "error");
        setTimeout(() => window.location.href = 'index.html', 2000);
    }
}

function showLoading(show) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = show ? 'block' : 'none';
}

function renderCasePage() {
    if (!currentCase) return;
    
    console.log('Рендеринг кейса:', currentCase);

    const staticView = document.getElementById('caseStaticView');
    if (staticView) {
        staticView.querySelector('.case-image').style.backgroundImage = 
            currentCase.image_url ? `url('${currentCase.image_url}')` : '';
        staticView.querySelector('.case-image i').style.display = 
            currentCase.image_url ? 'none' : 'block';
    }

    // Обновляем основную информацию о кейсе
    document.getElementById('casePrice').textContent = `${currentCase.price} 🪙`;
    
    // Создаем перемешанный массив предметов для прокрутки
    const shuffledItems = [...caseItems].sort(() => Math.random() - 0.5);
    
    // Рендерим предметы для горизонтального скролла (только картинки)
    const itemsContainer = document.getElementById('caseItemsTrack');
    if (itemsContainer) {
        itemsContainer.innerHTML = shuffledItems.map(item => `
            <div class="roulette-item ${item.rarity || 'common'}" 
                 style="background-image: url('${item.image_url || 'img/default-item.png'}')">
            </div>
        `).join('');
    }
    
    // Рендерим предметы для сетки внизу (полная информация)
    const itemsGrid = document.getElementById('caseItemsGrid');
    if (itemsGrid) {
        itemsGrid.innerHTML = caseItems.map(item => `
            <div class="case-item" data-rarity="${item.rarity}">
                <div class="item-image" style="background-image: url('${item.image_url || 'img/default-item.png'}')">
                    ${!item.image_url ? `<i class="fas fa-box-open"></i>` : ''}
                </div>
                <div class="item-info">
                    <h4>${item.name || 'Неизвестный предмет'}</h4>
                    <p class="item-rarity ${item.rarity || 'common'}">
                        ${getRarityName(item.rarity)}
                    </p>
                    <p class="item-chance">
                        ${item.drop_chance ? `Шанс: ${item.drop_chance}%` : ''}
                    </p>
                </div>
            </div>
        `).join('');
    }
    
    console.log('Предметы отрендерены');
}

function goBack() {
    // Сохраняем баланс в URL перед переходом
    const balanceParam = `balance=${balance}`;
    const url = `index.html?${balanceParam}`;
    
    // Если в Telegram WebApp - используем его API
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        window.history.back();
    } else {
        window.location.href = url;
    }
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

// В script.js обновите функцию openCase:
async function openCase() {
    if (!currentUser || !currentCase) {
        showToast("Ошибка: данные не загружены", "error");
        return;
    }

    const button = document.getElementById('openCaseBtn');
    if (button) button.disabled = true;

    try {
        showLoading(true);
        
        // Получаем предметы с их шансами из БД
        const response = await apiRequest(`/users/case/${currentCase.id}/items`);
        if (!response.success) throw new Error(response.error || "Ошибка загрузки предметов");
        
        const itemsWithChances = response.items;
        const winningItem = selectItemWithChance(itemsWithChances);
        wonItem = winningItem;

        // Настройка анимации рулетки
        const itemsTrack = document.getElementById('caseItemsTrack');
        const staticView = document.getElementById('caseStaticView');
        const rouletteView = document.getElementById('caseRouletteView');
        
        // Сброс анимации
        itemsTrack.style.transition = 'none';
        itemsTrack.style.transform = 'translateX(0)';
        void itemsTrack.offsetWidth;
        
        // Переключение вида
        staticView.classList.add('hidden');
        rouletteView.classList.remove('hidden');
        
        // Создаем рулетку с 3 циклами случайных предметов + выигрышный в конце
        const loopCount = 3;
        let rouletteItems = [];
        for (let i = 0; i < loopCount; i++) {
            rouletteItems.push(...[...itemsWithChances].sort(() => Math.random() - 0.5));
        }
        rouletteItems.push(winningItem);
        
        // Рендерим рулетку
        itemsTrack.innerHTML = rouletteItems.map(item => `
            <div class="roulette-item ${item.rarity || 'common'}" 
                 data-item-id="${item.id}"
                 style="background-image: url('${item.image_url || 'img/default-item.png'}')">
            </div>
        `).join('');

        await new Promise(resolve => requestAnimationFrame(resolve));
        
        // Рассчитываем позицию остановки (последний элемент)
        const itemWidth = 120;
        const trackWidth = rouletteItems.length * itemWidth;
        const stopPosition = trackWidth - (window.innerWidth / 2) - (itemWidth / 2);
        
        // Запускаем анимацию с эффектом замедления
        itemsTrack.style.transition = 'transform 5s cubic-bezier(0.08, 0.65, 0.25, 1)';
        itemsTrack.style.transform = `translateX(-${stopPosition}px)`;
        
        // Ждем завершения анимации
        await new Promise(resolve => setTimeout(resolve, 5200));
        
        // Выделяем выигрышный предмет
        const winningElement = itemsTrack.querySelector(`[data-item-id="${winningItem.id}"]`);
        if (winningElement) {
            winningElement.classList.add('highlighted');
        }
        
        // Показываем модальное окно с выигрышем
        showWinModal(winningItem);
        
        // Обновляем баланс (если не демо-режим)
        if (!isDemoMode) {
            balance -= currentCase.price * selectedCount;
            updateBalanceDisplay();
            
            // Сохраняем открытие кейса в БД
            const result = await apiRequest('/users/open-case', 'POST', {
                user_id: currentUser.id,
                case_id: currentCase.id,
                item_id: winningItem.id,
                is_demo: isDemoMode
            });
            
            if (!result.success) throw new Error(result.error || 'Ошибка открытия кейса');
        }
    } catch (error) {
        console.error('Ошибка открытия кейса:', error);
        showToast(error.message || "Ошибка при открытии кейса", "error");
    } finally {
        showLoading(false);
        if (button) button.disabled = false;
        
        // Возвращаем исходный вид
        setTimeout(() => {
            const staticView = document.getElementById('caseStaticView');
            const rouletteView = document.getElementById('caseRouletteView');
            const itemsTrack = document.getElementById('caseItemsTrack');
            
            staticView.classList.remove('hidden');
            rouletteView.classList.add('hidden');
            
            itemsTrack.style.transition = 'none';
            itemsTrack.style.transform = 'translateX(0)';
            void itemsTrack.offsetWidth;
        }, 1500);
    }
}

// Функция для выбора предмета с учетом шансов
function selectItemWithChance(items) {
    // Создаем массив с кумулятивными шансами
    let cumulativeChance = 0;
    const itemsWithRanges = items.map(item => {
        const start = cumulativeChance;
        cumulativeChance += item.adjusted_chance;
        return {
            ...item,
            start,
            end: cumulativeChance
        };
    });

    // Генерируем случайное число от 0 до общей суммы шансов
    const random = Math.random() * cumulativeChance;
    
    // Находим предмет, в диапазон которого попало случайное число
    const selectedItem = itemsWithRanges.find(item => 
        random >= item.start && random < item.end
    );
    
    return selectedItem || items[0]; // На всякий случай возвращаем первый предмет, если что-то пошло не так
}

function getItemCenterPosition(itemIndex, itemWidth) {
    const viewportCenter = window.innerWidth / 2;
    return (itemIndex * itemWidth) + (itemWidth / 2) - viewportCenter;
}

function calculateStopPosition(items, winningIndex, itemWidth) {
    const visibleItems = Math.ceil(window.innerWidth / itemWidth);
    const paddingItems = Math.floor(visibleItems / 2);
    
    // Позиция, при которой выигрышный элемент будет по центру
    return (winningIndex + paddingItems) * itemWidth - (window.innerWidth / 2) + (itemWidth / 2);
}

// Новая функция для показа модального окна с выигрышем
function showWinModal(item) {
    const modal = document.getElementById('winModal');
    if (!modal) return;

    const container = document.getElementById('wonItemContainer');
    const sellPriceElement = document.getElementById('sellPrice');
    
    const rarityClass = item.rarity || 'common';
    const rarityName = getRarityName(item.rarity);
    const sellPrice = Math.floor((item.price || 0) * 0.7);
    
    container.innerHTML = `
        <div class="won-item" data-rarity="${rarityClass}">
            <div class="item-image">
                ${item.image_url ? 
                    `<img src="${item.image_url}" alt="${item.name}" loading="lazy">` : 
                    `<i class="fas fa-gift"></i>`}
            </div>
            <div class="item-info">
                <h4 class="item-name">${item.name || 'Неизвестный предмет'}</h4>
                <p class="item-rarity ${rarityClass}">${rarityName}</p>
                ${item.price ? `<p class="item-price">Цена: ${item.price} 🪙</p>` : ''}
                ${item.drop_chance ? `<p class="item-chance">Шанс: ${item.drop_chance}%</p>` : ''}
            </div>
        </div>
    `;
    
    if (sellPriceElement) {
        sellPriceElement.textContent = sellPrice;
    }
    
    modal.classList.remove('hidden');
    
    // Добавляем анимацию для легендарных предметов
    if (rarityClass === 'legendary') {
        const wonItem = container.querySelector('.won-item');
        wonItem.style.animation = 'pulse 2s infinite';
    }
}

async function keepItem() {
    const modal = document.getElementById('winModal');
    if (modal) modal.classList.add('hidden');
}

async function sellItem() {
    const modal = document.getElementById('winModal');
    if (!modal || !wonItem) return;
    
    const sellPrice = Math.floor((wonItem.price || 0) * 0.7);
    
    try {
        const success = await updateBalance(
            sellPrice,
            'sell',
            `Продажа предмета: ${wonItem.name}`
        );
        
        if (success) {
            showToast(`Предмет продан за ${sellPrice} 🪙`, "success");
            modal.classList.add('hidden');
        }
    } catch (error) {
        console.error('Sell item error:', error);
        showToast("Ошибка при продаже предмета", "error");
    }
}

function showCaseResult(item) {
    // 1. Находим контейнер
    const container = document.getElementById('caseResultContainer');
    if (!container) {
        console.error('Result container not found');
        return;
    }
    
    // 2. Создаем HTML для предмета
    const rarityClass = item.rarity || 'common';
    const rarityName = getRarityName(item.rarity);
    
    container.innerHTML = `
        <div class="won-item ${rarityClass}">
            <div class="item-image">
                ${item.image_url ? 
                    `<img src="${item.image_url}" alt="${item.name}" loading="lazy">` : 
                    `<i class="fas fa-gift"></i>`}
            </div>
            <div class="item-details">
                <h3>${item.name || 'Неизвестный предмет'}</h3>
                <p class="rarity-badge ${rarityClass}">${rarityName}</p>
                ${item.price ? `<p class="item-price">Цена: ${item.price} 🪙</p>` : ''}
            </div>
        </div>
    `;
    
    // 3. Показываем секцию с результатами
    document.getElementById('caseOpenSection').classList.add('hidden');
    document.getElementById('caseResultSection').classList.remove('hidden');
    
    // 4. Добавляем анимацию для редких предметов
    if (rarityClass === 'legendary') {
        container.querySelector('.won-item').classList.add('animate-pulse');
    }
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

function initCaseCategories() {
    const categoryBtns = document.querySelectorAll('.category-btn');
    const caseCategories = document.querySelectorAll('.case-category');
    
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            caseCategories.forEach(cat => cat.classList.remove('show'));
            
            const category = btn.dataset.category;
            document.querySelector(`.case-category.${category}`).classList.add('show');
            
            // Плавная прокрутка к началу
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    });

    // Обновляем счетчики для категорий
    const categoryCounts = {
        all: document.querySelectorAll('.case-category.all .case-card').length,
        free: document.querySelectorAll('.case-category.free .case-card').length,
        branded: document.querySelectorAll('.case-category.branded .case-card').length,
        exclusive: document.querySelectorAll('.case-category.exclusive .case-card').length,
        farm: document.querySelectorAll('.case-category.farm .case-card').length
    };

    categoryBtns.forEach(btn => {
        const count = categoryCounts[btn.dataset.category] || 0;
        const countSpan = btn.querySelector('.category-count') || document.createElement('span');
        countSpan.className = 'category-count';
        countSpan.textContent = count;
        
        if (!btn.querySelector('.category-count')) {
            btn.appendChild(countSpan);
        }
    });
}

// ==================== Initialization ====================
async function initApp() {
    try {
        // Получаем баланс из URL (если есть)
        const urlParams = new URLSearchParams(window.location.search);
        const urlBalance = urlParams.get('balance');
        
        if (urlBalance) {
            balance = parseInt(urlBalance);
            localStorage.setItem('userBalance', balance); // Дублируем в localStorage
        } else {
            // Если в URL нет, пробуем взять из localStorage
            const savedBalance = localStorage.getItem('userBalance');
            if (savedBalance) balance = parseInt(savedBalance);
        }

        // Остальная логика инициализации...
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
            balance = balance || 1000; // Если баланс не задан, ставим 1000
            showToast("Режим тестирования", "warning");
        }

        updateProfile();
        updateBalanceDisplay();
        updateLevelDisplay();
        initCaseCategories();
        
        setTimeout(() => openTab('cases'), 0);
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast("Ошибка инициализации", "error");
    }
}

function highlightCurrentTab() {
    // Для case.html всегда активен таб "Кейсы"
    if (window.location.pathname.includes('case.html')) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === 'cases');
        });
        return;
    }
    
    // Для index.html определяем по хэшу
    const currentTab = window.location.hash.replace('#', '') || 'cases';
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === currentTab);
    });
}

// Добавьте функцию для закрытия приложения через Telegram
function closeApp() {
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        Telegram.WebApp.close();
    } else {
        // Альтернативное действие, если не в Telegram
        window.location.href = 'index.html';
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

    document.addEventListener('DOMContentLoaded', () => {
        highlightCurrentTab();
    });
    
    // Обработчики пополнения
    document.getElementById('depositTonBtn')?.addEventListener('click', processTonDeposit);
    document.getElementById('depositStarsBtn')?.addEventListener('click', processStarsDeposit);
    
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

    // В initEventListeners() добавьте:
    document.getElementById('backToCaseBtn')?.addEventListener('click', () => {
        document.getElementById('caseOpenSection').classList.remove('hidden');
        document.getElementById('caseResultSection').classList.add('hidden');
    });

    document.getElementById('keepItemBtn')?.addEventListener('click', keepItem);
    document.getElementById('sellItemBtn')?.addEventListener('click', sellItem);
    
    // Сброс анимации при закрытии модального окна
    document.getElementById('winModal')?.addEventListener('click', function(e) {
        if (e.target === this) {
            const itemsTrack = document.getElementById('caseItemsTrack');
            if (itemsTrack) {
                itemsTrack.classList.remove('roulette-animation');
            }
        }
    });

    document.querySelectorAll('.case-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

// ==================== Global Functions ====================
window.openTab = openTab;
window.openDepositModal = openDepositModal;
window.closeDepositModal = closeDepositModal;
window.switchDepositTab = switchDepositTab;
window.processTonDeposit = processTonDeposit;
window.processStarsDeposit = processStarsDeposit;
window.keepItem = keepItem;
window.sellItem = sellItem;

// ==================== Start Application ====================
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    initApp();
});