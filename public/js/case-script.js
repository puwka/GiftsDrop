// case-script.js
let currentCase = null;
let caseItems = [];
let selectedCount = 1;
let isDemoMode = false;
let wonItem = null;

// Инициализация кнопок управления
function initCaseButtons() {
    document.getElementById('demoOpenBtn').addEventListener('click', toggleDemoMode);
    document.getElementById('openCaseBtn').addEventListener('click', openCase);
    document.getElementById('quickOpenBtn').addEventListener('click', () => {
        selectedCount = 3;
        updateOpenButtons();
        openCase();
    });
    document.getElementById('increaseCount').addEventListener('click', () => changeCount(1));
    document.getElementById('decreaseCount').addEventListener('click', () => changeCount(-1));
}

// Загрузка данных кейса
async function loadCasePage(caseId) {
    try {
        // Загружаем данные кейса и предметов
        const [caseResponse, itemsResponse] = await Promise.all([
            apiRequest(`/users/case/${caseId}`),
            apiRequest(`/users/case/${caseId}/items`)
        ]);
        
        if (!caseResponse.success || !itemsResponse.success) {
            throw new Error(caseResponse.error || itemsResponse.error || 'Ошибка загрузки данных');
        }
        
        currentCase = caseResponse.case;
        caseItems = itemsResponse.items;
        
        // Нормализуем шансы выпадения (если они не в процентах)
        normalizeDropChances();
        
        renderCasePage();
        
    } catch (error) {
        console.error('Ошибка загрузки кейса:', error);
        throw error;
    }
}

// Нормализация шансов выпадения в проценты
function normalizeDropChances() {
    if (!caseItems.length) return;
    
    // Проверяем, нужно ли нормализовать (если сумма не равна 100)
    const totalChance = caseItems.reduce((sum, item) => sum + (item.drop_chance || item.adjusted_chance || 0), 0);
    
    if (totalChance !== 100) {
        caseItems.forEach(item => {
            item.drop_chance = ((item.drop_chance || item.adjusted_chance || 1) / totalChance * 100).toFixed(2);
        });
    }
}

// Отображение данных кейса
function renderCasePage() {
    if (!currentCase) return;
    
    document.getElementById('casePrice').textContent = `${currentCase.price} 🪙`;
    updateTotalCost();

    const itemsGrid = document.getElementById('caseItemsGrid');
    if (itemsGrid) {
        itemsGrid.innerHTML = caseItems.map(item => `
            <div class="case-item" data-rarity="${item.rarity || 'common'}">
                <div class="item-image" style="${item.image_url ? `background-image: url('${item.image_url}')` : ''}">
                    ${!item.image_url ? `<i class="fas fa-gift"></i>` : ''}
                </div>
                <div class="item-info">
                    <h4>${item.name || 'Предмет'}</h4>
                    <div class="item-rarity ${item.rarity || 'common'}">
                        ${getRarityName(item.rarity)}
                    </div>
                    <p class="item-chance">
                        Шанс: ${item.drop_chance ? parseFloat(item.drop_chance).toFixed(2) : '0.00'}%
                    </p>
                </div>
            </div>
        `).join('');
    }
}

// Открытие кейса
async function openCase() {
    if (!currentCase) return;

    const openBtn = document.getElementById('openCaseBtn');
    if (openBtn) openBtn.disabled = true;

    // Проверка баланса в реальном режиме
    if (!isDemoMode && balance < currentCase.price * selectedCount) {
        showToast("Недостаточно средств", "error");
        openBtn.disabled = false;
        return;
    }

    // Переключаем вид на рулетку
    const staticView = document.getElementById('caseStaticView');
    const rouletteView = document.getElementById('caseRouletteView');
    const track = document.getElementById('rouletteTrack');
    
    staticView.classList.add('hidden');
    rouletteView.classList.remove('hidden');
    track.innerHTML = '';
    
    try {
        // Отправляем запрос на открытие кейса
        const response = await apiRequest('/users/open-case', 'POST', {
            user_id: currentUser?.id || 0,
            case_id: currentCase.id,
            count: selectedCount,
            is_demo: isDemoMode
        });
        
        if (!response.success) {
            throw new Error(response.error || 'Ошибка открытия кейса');
        }
        
        // Получаем выигранные предметы
        const wonItems = Array.isArray(response.items) ? response.items : [response.item];
        if (!wonItems.length) {
            throw new Error('Не получены выигранные предметы');
        }
        
        // Для демонстрации берем первый выигранный предмет
        const targetItem = wonItems[0];
        
        // Создаем дорожку с предметами для анимации
        createRouletteTrack(targetItem);
        
        // После анимации показываем модальное окно с выигрышем
        setTimeout(() => {
            showWinModal(targetItem);
            
            // Возвращаем в исходное состояние после закрытия модального окна
            const checkModalClose = setInterval(() => {
                if (!document.getElementById('winModal').classList.contains('active')) {
                    clearInterval(checkModalClose);
                    resetCaseView();
                    if (openBtn) openBtn.disabled = false;
                }
            }, 100);
        }, 4000);
        
    } catch (error) {
        console.error('Ошибка открытия кейса:', error);
        showToast(error.message || "Ошибка открытия кейса", "error");
        resetCaseView();
        if (openBtn) openBtn.disabled = false;
    }
}

// Создание дорожки для анимации рулетки
function createRouletteTrack(targetItem) {
    const track = document.getElementById('rouletteTrack');
    const rouletteItems = [];
    
    // Добавляем случайные предметы (5 наборов)
    for (let i = 0; i < 5; i++) {
        rouletteItems.push(...[...caseItems].sort(() => Math.random() - 0.5));
    }
    
    // Добавляем целевой предмет в конец
    rouletteItems.push(targetItem);
    
    // Отображаем предметы
    track.style.width = `${rouletteItems.length * 140}px`;
    rouletteItems.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = `roulette-item ${item.rarity}`;
        itemEl.style.backgroundImage = item.image_url ? `url('${item.image_url}')` : '';
        itemEl.innerHTML = !item.image_url ? `<i class="fas fa-gift"></i>` : '';
        if (index === rouletteItems.length - 1) {
            itemEl.dataset.winning = 'true';
        }
        track.appendChild(itemEl);
    });

    // Анимация рулетки
    const itemWidth = 140;
    const itemsPerScreen = 3;
    const centerOffset = Math.floor(itemsPerScreen / 2) * itemWidth;
    const targetPosition = (rouletteItems.length - 3) * itemWidth - centerOffset;
    
    track.style.transform = 'translateX(0)';
    track.style.transition = 'none';
    void track.offsetWidth; // Trigger reflow
    
    track.style.transition = 'transform 4s cubic-bezier(0.19, 1, 0.22, 1)';
    track.style.transform = `translateX(-${targetPosition}px)`;
}

// Сброс вида после открытия
function resetCaseView() {
    const staticView = document.getElementById('caseStaticView');
    const rouletteView = document.getElementById('caseRouletteView');
    const track = document.getElementById('rouletteTrack');
    
    staticView.classList.remove('hidden');
    rouletteView.classList.add('hidden');
    track.style.transform = 'translateX(0)';
    track.style.transition = 'none';
}

// Обновление общей стоимости
function updateTotalCost() {
    if (!currentCase) return;
    document.getElementById('totalCost').textContent = currentCase.price * selectedCount;
}

// Изменение количества
function changeCount(delta) {
    const newCount = selectedCount + delta;
    if (newCount >= 1 && newCount <= 3) {
        selectedCount = newCount;
        document.getElementById('openCount').textContent = selectedCount;
        updateTotalCost();
    }
}

// В функции normalizeDropChances()
function normalizeDropChances() {
    if (!caseItems.length) return;
    
    // Проверяем наличие drop_chance и преобразуем в числа
    caseItems.forEach(item => {
        if (!item.drop_chance && item.adjusted_chance) {
            item.drop_chance = item.adjusted_chance;
        }
        item.drop_chance = parseFloat(item.drop_chance) || 1; // Значение по умолчанию 1, если не указано
    });

    // Нормализуем шансы в проценты
    const totalChance = caseItems.reduce((sum, item) => sum + item.drop_chance, 0);
    if (totalChance !== 100) {
        caseItems.forEach(item => {
            item.drop_chance = ((item.drop_chance / totalChance) * 100).toFixed(2);
        });
    }
}

// Включение/выключение демо-режима
function toggleDemoMode() {
    const btn = document.getElementById('demoOpenBtn');
    isDemoMode = !isDemoMode;
    btn.classList.toggle('active', isDemoMode);
    
    showToast(
        isDemoMode ? "Демо-режим включен" : "Демо-режим выключен", 
        isDemoMode ? "info" : "warning"
    );
}

// Обновление кнопок открытия
function updateOpenButtons() {
    document.getElementById('openCount').textContent = selectedCount;
    updateTotalCost();
}

// Показ модального окна с выигрышем
function showWinModal(item) {
    const modal = document.getElementById('winModal');
    if (!modal || !item) return;
    
    // Устанавливаем данные предмета
    document.getElementById('wonItemName').textContent = item.name;
    document.getElementById('wonItemPrice').textContent = item.price;
    document.getElementById('wonItemRarity').textContent = getRarityName(item.rarity);
    document.getElementById('wonItemRarity').className = `rarity ${item.rarity}`;
    
    const imgElement = document.getElementById('wonItemImage');
    if (item.image_url) {
        imgElement.src = item.image_url;
        imgElement.style.display = 'block';
    } else {
        imgElement.style.display = 'none';
        document.querySelector('.prize-item').innerHTML = `<i class="fas fa-gift"></i>`;
    }
    
    // Устанавливаем цену продажи (70% от стоимости)
    const sellPrice = Math.floor((item.price || 0) * 0.7);
    document.getElementById('sellPrice').textContent = sellPrice;
    
    // Устанавливаем класс редкости для анимации
    const prizeItem = document.querySelector('.prize-item');
    prizeItem.className = 'prize-item';
    prizeItem.classList.add(item.rarity);
    
    // Показываем модальное окно
    modal.classList.add('active');
    
    // Запускаем конфетти для легендарных предметов
    if (item.rarity === 'legendary') {
        createConfetti();
    }
    
    // Сохраняем выигранный предмет
    wonItem = item;
}

// Получение названия редкости
function getRarityName(rarity) {
    const names = {
        'uncommon': 'Дефолт',
        'common': 'Обычный',
        'rare': 'Редкий',
        'epic': 'Эпический',
        'legendary': 'Легендарный'
    };
    return names[rarity] || rarity;
}

// Обработчики для кнопок модального окна
async function keepItem() {
    closeWinModal();
    showToast(`Предмет "${wonItem.name}" добавлен в вашу коллекцию`, "success");
    wonItem = null;
}

async function sellItem() {
    if (!wonItem) return;
    
    const sellPrice = Math.floor(wonItem.price * 0.7);
    const success = await updateBalance(
        sellPrice,
        'sell',
        `Продажа предмета: ${wonItem.name}`
    );
    
    if (success) {
        closeWinModal();
        showToast(`Предмет продан за ${sellPrice} 🪙`, "success");
        wonItem = null;
    } else {
        showToast("Ошибка при продаже предмета", "error");
    }
}

function closeWinModal() {
    const modal = document.getElementById('winModal');
    modal.classList.remove('active');
    wonItem = null;
}

// Глобальные функции
window.keepItem = keepItem;
window.sellItem = sellItem;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const caseId = urlParams.get('id');
        
        if (!caseId) {
            throw new Error('ID кейса не указан');
        }
        
        await loadCasePage(caseId);
        initCaseButtons();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showToast(error.message || "Ошибка загрузки", "error");
        setTimeout(() => window.location.href = 'index.html', 2000);
    }
});