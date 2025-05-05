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
let isAnimationRunning = false;

async function openCase() {
    if (isAnimationRunning || !currentCase) return;
    isAnimationRunning = true;

    const openBtn = document.getElementById('openCaseBtn');
    if (openBtn) openBtn.disabled = true;

    try {
        const requestData = {
            user_id: currentUser?.id || null,
            case_id: currentCase.id,
            is_demo: isDemoMode
        };

        const response = await apiRequest('/users/open-case', 'POST', requestData);
        if (!response.success) throw new Error(response.error || 'Ошибка открытия кейса');

        await showCaseOpeningAnimation(response.items[0]);
    } catch (error) {
        console.error('Ошибка открытия кейса:', error);
        showToast(error.message || "Ошибка открытия кейса", "error");
    } finally {
        isAnimationRunning = false;
        if (openBtn) openBtn.disabled = false;
    }
}

async function showCaseOpeningAnimation(item) {
    const staticView = document.getElementById('caseStaticView');
    const rouletteView = document.getElementById('caseRouletteView');
    const track = document.getElementById('rouletteTrack');

    // 1. Подготовка анимации
    staticView.classList.add('hidden');
    rouletteView.classList.remove('hidden');
    track.innerHTML = '';

    // 2. Создаем дорожку с эффектом накопления скорости
    const rouletteItems = [];
    const spinUpItems = 15; // Элементы для разгона
    const mainSpinItems = 50; // Основные элементы
    const slowDownItems = 15; // Элементы для замедления

    // Фаза разгона
    for (let i = 0; i < spinUpItems; i++) {
        rouletteItems.push(caseItems[Math.floor(Math.random() * caseItems.length)]);
    }

    // Основная фаза
    for (let i = 0; i < mainSpinItems; i++) {
        rouletteItems.push(caseItems[Math.floor(Math.random() * caseItems.length)]);
    }

    // Фаза замедления (повторяем несколько последних предметов)
    const lastItems = [];
    for (let i = 0; i < slowDownItems - 5; i++) {
        lastItems.push(caseItems[Math.floor(Math.random() * caseItems.length)]);
    }
    
    // Последние 5 элементов перед выигрышным
    for (let i = 5; i > 0; i--) {
        lastItems.push(caseItems[Math.floor(Math.random() * caseItems.length)]);
    }
    
    // Выигрышный элемент
    lastItems.push(item);
    rouletteItems.push(...lastItems);

    // 3. Рендерим элементы
    track.style.width = `${rouletteItems.length * 140}px`;
    rouletteItems.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = `roulette-item ${item.rarity}`;
        
        if (item.image_url) {
            itemEl.style.backgroundImage = `url('${item.image_url}')`;
        } else {
            itemEl.innerHTML = '<i class="fas fa-gift"></i>';
        }
        
        if (index === rouletteItems.length - 1) {
            itemEl.dataset.winning = 'true';
            itemEl.classList.add('winning-item');
        }
        
        track.appendChild(itemEl);
    });

    // 4. Запуск анимации с прогрессивным замедлением
    await new Promise(resolve => {
        const startTime = Date.now();
        const totalDuration = 4000; // 4 секунды общее время
        const startSpeed = 0.3;
        const endSpeed = 0.02;
        
        let currentPosition = 0;
        const targetPosition = track.scrollWidth - rouletteView.clientWidth;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / totalDuration, 1);
            
            // Кривая замедления
            const speed = startSpeed + (endSpeed - startSpeed) * Math.pow(progress, 0.5);
            currentPosition += speed * (targetPosition - currentPosition);
            
            track.style.transform = `translateX(-${currentPosition}px)`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Точная остановка на выигрышном элементе
                const finalPosition = track.scrollWidth - rouletteView.clientWidth - 140;
                track.style.transition = 'transform 0.5s cubic-bezier(0.1, 0.8, 0.2, 1)';
                track.style.transform = `translateX(-${finalPosition}px)`;
                
                // Ждем завершения финальной анимации
                setTimeout(resolve, 600);
            }
        };
        
        track.style.transition = 'none';
        requestAnimationFrame(animate);
    });

    // 5. Показываем окно выигрыша
    showWinModal(item);
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
    track.innerHTML = '';
    
    // Создаем более длинную дорожку для плавности
    const rouletteItems = [];
    for (let i = 0; i < 80; i++) {
        const randomItem = caseItems[Math.floor(Math.random() * caseItems.length)];
        rouletteItems.push(randomItem);
    }
    
    // Добавляем целевой предмет в конец
    rouletteItems.push(targetItem);
    
    // Рендерим предметы
    track.style.width = `${rouletteItems.length * 140}px`;
    rouletteItems.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = `roulette-item ${item.rarity}`;
        
        if (item.image_url) {
            itemEl.style.backgroundImage = `url('${item.image_url}')`;
        } else {
            itemEl.innerHTML = '<i class="fas fa-gift"></i>';
        }
        
        if (index === rouletteItems.length - 1) {
            itemEl.dataset.winning = 'true';
            itemEl.style.border = '2px solid gold';
            itemEl.style.boxShadow = '0 0 20px gold';
        }
        
        track.appendChild(itemEl);
    });

    // Анимация с правильными параметрами
    const itemWidth = 140;
    const itemsPerScreen = 3;
    const centerOffset = Math.floor(itemsPerScreen / 2) * itemWidth;
    const targetPosition = (rouletteItems.length - 3) * itemWidth - centerOffset;
    
    // Сброс перед анимацией
    track.style.transform = 'translateX(0)';
    track.style.transition = 'none';
    void track.offsetWidth;
    
    // Запуск анимации
    track.style.transition = 'transform 3.8s cubic-bezier(0.2, 0.8, 0.3, 1)';
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

    // Анимация появления модального окна
    modal.style.opacity = '0';
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'none';
    
    setTimeout(() => {
        modal.style.transition = 'opacity 0.3s ease';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'all';
        
        // Заполняем данные о выигрыше
        document.getElementById('wonItemName').textContent = item.name;
        document.getElementById('wonItemPrice').textContent = item.price;
        document.getElementById('wonItemRarity').textContent = getRarityName(item.rarity);
        document.getElementById('wonItemRarity').className = `rarity ${item.rarity}`;
        
        const imgElement = document.getElementById('wonItemImage');
        if (item.image_url) {
            imgElement.src = item.image_url;
            imgElement.style.display = 'block';
        }
        
        // Запускаем конфетти для редких предметов
        if (item.rarity === 'legendary') {
            setTimeout(createConfetti, 300);
        }
    }, 100);
}

function resetCaseView() {
    const staticView = document.getElementById('caseStaticView');
    const rouletteView = document.getElementById('caseRouletteView');
    const track = document.getElementById('rouletteTrack');
    
    rouletteView.style.opacity = '1';
    staticView.style.opacity = '1';
    
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    track.innerHTML = '';
    
    setTimeout(() => {
        rouletteView.classList.add('hidden');
        staticView.classList.remove('hidden');
    }, 50);
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