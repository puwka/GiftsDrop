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
                <div class="item-image" style="background-image: url('${item.image_url || ''}')">
                    ${!item.image_url ? `<i class="fas fa-gift"></i>` : ''}
                </div>
                <div class="item-info">
                    <h4>${item.name || 'Без названия'}</h4>
                    <p class="item-rarity ${item.rarity || 'common'}">
                        ${getRarityName(item.rarity)}
                    </p>
                    <p class="item-chance">
                        Шанс: ${item.drop_chance || '0.00'}%
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

    if (!isDemoMode) {
        const balance = parseFloat(document.querySelector('.balance-amount').textContent || 0);
        if (balance < currentCase.price * selectedCount) {
            showToast("Недостаточно средств", "error");
            openBtn.disabled = false;
            return;
        }
    }

    try {
        const requestData = {
            user_id: currentUser?.id || null,
            case_id: currentCase.id,
            is_demo: isDemoMode
        };

        const response = await apiRequest('/users/open-case', 'POST', requestData);
        
        if (!response.success) {
            throw new Error(response.error || 'Ошибка открытия кейса');
        }

        const wonItems = response.items || [];
        if (wonItems.length === 0) {
            throw new Error('Не получены выигранные предметы');
        }

        showCaseOpeningAnimation(wonItems[0]);

    } catch (error) {
        console.error('Ошибка открытия кейса:', error);
        showToast(error.message || "Ошибка открытия кейса", "error");
        if (openBtn) openBtn.disabled = false;
    }
}

// Обновленная функция показа анимации открытия
function showCaseOpeningAnimation(item) {
    const staticView = document.getElementById('caseStaticView');
    const rouletteView = document.getElementById('caseRouletteView');
    
    // Добавляем эффект исчезновения статичного вида
    staticView.style.transition = 'opacity 0.3s';
    staticView.style.opacity = '0';
    
    setTimeout(() => {
        staticView.classList.add('hidden');
        rouletteView.classList.remove('hidden');
        createRouletteTrack(item);
        
        // Добавляем звуковые эффекты (если нужно)
        // new Audio('spin-sound.mp3').play();
        
    }, 300);

    // После завершения анимации
    setTimeout(() => {
        showWinModal(item);
        resetCaseView();
        
        const openBtn = document.getElementById('openCaseBtn');
        if (openBtn) openBtn.disabled = false;
    }, 3800); // Синхронизируем с длительностью анимации
}

// Обновленная функция сброса вида
function resetCaseView() {
    const staticView = document.getElementById('caseStaticView');
    const rouletteView = document.getElementById('caseRouletteView');
    const track = document.getElementById('rouletteTrack');
    
    rouletteView.classList.add('hidden');
    staticView.style.opacity = '1';
    staticView.classList.remove('hidden');
    track.style.transform = 'translateX(0)';
    track.style.transition = 'none';
}

// Добавить в case-script.js
function createConfetti() {
    const container = document.querySelector('.confetti-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        
        // Случайный цвет
        const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.background = color;
        
        // Случайная позиция и анимация
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.top = `${Math.random() * 100}%`;
        confetti.style.opacity = '1';
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        
        // Анимация падения
        confetti.style.animation = `fall ${Math.random() * 3 + 2}s linear forwards`;
        
        container.appendChild(confetti);
    }
}

// Создание дорожки для анимации рулетки
function createRouletteTrack(targetItem) {
    const track = document.getElementById('rouletteTrack');
    track.innerHTML = ''; // Очищаем предыдущие элементы
    
    // Создаем 50 случайных предметов для плавной анимации
    const rouletteItems = [];
    for (let i = 0; i < 50; i++) {
        const randomItem = caseItems[Math.floor(Math.random() * caseItems.length)];
        rouletteItems.push(randomItem);
    }
    
    // Добавляем целевой предмет в конец
    rouletteItems.push(targetItem);
    
    // Отображаем предметы с плавными переходами
    track.style.width = `${rouletteItems.length * 140}px`;
    rouletteItems.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = `roulette-item ${item.rarity}`;
        itemEl.style.backgroundImage = item.image_url ? `url('${item.image_url}')` : '';
        
        // Добавляем эффекты для редких предметов
        if (item.rarity === 'epic') {
            itemEl.style.boxShadow = '0 0 15px #9b59b6';
        } else if (item.rarity === 'legendary') {
            itemEl.style.boxShadow = '0 0 25px #f1c40f';
            itemEl.style.animation = 'pulseLegendary 1s infinite alternate';
        }
        
        if (index === rouletteItems.length - 1) {
            itemEl.dataset.winning = 'true';
            itemEl.style.border = '2px solid gold';
        }
        
        track.appendChild(itemEl);
    });

    // Улучшенная анимация с эффектом замедления
    const itemWidth = 140;
    const itemsPerScreen = 3;
    const centerOffset = Math.floor(itemsPerScreen / 2) * itemWidth;
    const targetPosition = (rouletteItems.length - 3) * itemWidth - centerOffset;
    
    // Начальная позиция
    track.style.transform = 'translateX(0)';
    track.style.transition = 'none';
    void track.offsetWidth; // Trigger reflow
    
    // Анимация с эффектом замедления
    track.style.transition = 'transform 3.5s cubic-bezier(0.15, 0.85, 0.35, 1)';
    track.style.transform = `translateX(-${targetPosition}px)`;
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