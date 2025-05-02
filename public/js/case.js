// ==================== API Functions ====================
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000' 
    : 'https://gifts-drop.vercel.app';

let currentUser = null;
let balance = 0;
let currentCase = null;
let caseItems = [];
let caseCount = 1;
let isQuickMode = false;
let isOpening = false;

// Инициализация страницы
document.addEventListener('DOMContentLoaded', async () => {
    await initUser();
    const caseId = getCaseIdFromUrl();
    if (caseId) {
        await loadCase(caseId);
    } else {
        redirectToMain();
    }
});

// Инициализация пользователя
async function initUser() {
    try {
        // Проверяем, авторизован ли пользователь через Telegram
        if (typeof Telegram !== 'undefined' && Telegram.WebApp.initDataUnsafe?.user) {
            const userData = Telegram.WebApp.initDataUnsafe.user;
            currentUser = {
                id: userData.id,
                first_name: userData.first_name,
                last_name: userData.last_name,
                username: userData.username,
                photo_url: userData.photo_url,
                language_code: userData.language_code
            };
            
            // Загружаем баланс пользователя
            const response = await apiRequest(`/users/transactions/${userData.id}`);
            if (response.success) {
                balance = response.balance || 0;
                updateBalanceDisplay();
            }
        } else {
            // Режим тестирования
            currentUser = getTestUserData();
            balance = 1000;
            updateBalanceDisplay();
            showToast("Режим тестирования", "warning");
        }
    } catch (error) {
        console.error('Error initializing user:', error);
        showToast("Ошибка загрузки данных пользователя", "error");
    }
}

function updateBalanceDisplay() {
    document.querySelectorAll('.balance-amount').forEach(el => {
        el.textContent = balance;
    });
}

function getTestUserData() {
    return {
        id: 999999,
        first_name: "Тестовый",
        last_name: "Пользователь",
        username: "test_user",
        photo_url: "",
        language_code: "ru"
    };
}

// Получаем ID кейса из URL
function getCaseIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function redirectToMain() {
    window.location.href = 'index.html';
}

// Загружаем данные кейса
async function loadCase(caseId) {
    try {
        showLoading(true);
        const response = await apiRequest(`/users/case/${caseId}`);
        if (response.success) {
            currentCase = response.case;
            caseItems = response.items;
            setupPage();
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

function showLoading(show) {
    const container = document.querySelector('.case-main');
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

function showErrorAndRedirect(message) {
    showToast(message, "error");
    setTimeout(redirectToMain, 2000);
}

// Настраиваем страницу после загрузки данных
function setupPage() {
    if (!currentCase) return;
    
    document.getElementById('caseTitle').textContent = `Открытие: ${currentCase.name}`;
    updateTotalPrice();
    setupPossibleItems();
}

function updateTotalPrice() {
    document.getElementById('totalPrice').textContent = currentCase.price * caseCount;
}

// Настраиваем список возможных предметов
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

// Изменяем количество кейсов
function changeCaseCount(change) {
    const newCount = caseCount + change;
    if (newCount >= 1 && newCount <= 3) {
        caseCount = newCount;
        document.getElementById('caseCount').textContent = caseCount;
        updateTotalPrice();
    }
}

// Переключаем режим быстрого открытия
function toggleQuickMode() {
    isQuickMode = !isQuickMode;
    const button = document.getElementById('quickToggle');
    button.classList.toggle('active', isQuickMode);
    button.innerHTML = isQuickMode ? 
        '<i class="fas fa-bolt"></i> Быстрое открытие' : 
        '<i class="fas fa-bolt"></i> Быстрое открытие';
}

// Открываем кейс(ы)
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
        }
    } catch (error) {
        console.error('Error opening cases:', error);
        showToast("Ошибка при открытии кейса", "error");
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

// Анимация открытия
async function animateCaseOpening(wonItems) {
    const caseTop = document.querySelector('.case-top');
    const caseReward = document.getElementById('caseReward');
    
    // Сбрасываем анимацию
    caseTop.style.animation = 'none';
    caseReward.style.animation = 'none';
    void caseTop.offsetWidth; // Trigger reflow
    void caseReward.offsetWidth;
    
    // Очищаем предыдущий результат
    caseReward.innerHTML = '';
    
    // Анимация открытия
    caseTop.style.animation = 'openHorizontal 1s forwards';
    await sleep(1000);
    
    // Показываем выигрыш
    caseReward.innerHTML = getItemContent(wonItems[0]);
    caseReward.style.animation = 'bounceIn 0.5s';
    await sleep(500);
}

// Показываем результаты
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
    
    // Прокручиваем к результатам
    document.querySelector('.case-results-container').scrollIntoView({
        behavior: 'smooth'
    });
}

// Вспомогательные функции
function getItemContent(item) {
    return item.image_url ? 
        `<img src="${item.image_url}" alt="${item.name}" style="max-width:80%; max-height:80%;">` : 
        `<i class="fas fa-gift"></i>`;
}

function getRarityClass(rarity) {
    return `rarity-${rarity.toLowerCase()}`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

// ==================== Notification System ====================
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