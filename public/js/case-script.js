// case-script.js
let currentCase = null;
let caseItems = [];
let selectedCount = 1;
let isDemoMode = false;
let wonItem = null;

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

async function loadCasePage(caseId) {
    try {
        // Загружаем данные кейса и предметов с сервера
        const [caseResponse, itemsResponse] = await Promise.all([
            apiRequest(`/users/case/${caseId}`),
            apiRequest(`/users/case/${caseId}/items`)
        ]);
        
        if (!caseResponse.success || !itemsResponse.success) {
            throw new Error(caseResponse.error || itemsResponse.error || 'Ошибка загрузки данных');
        }
        
        currentCase = caseResponse.case;
        caseItems = itemsResponse.items;
        
        renderCasePage();
        
    } catch (error) {
        console.error('Ошибка загрузки кейса:', error);
        throw error;
    }
}

function renderCasePage() {
    if (!currentCase) return;
    
    // Обновляем основную информацию о кейсе
    document.getElementById('casePrice').textContent = `${currentCase.price} 🪙`;
    document.getElementById('totalCost').textContent = currentCase.price * selectedCount;
    
    // Рендерим предметы для сетки
    const itemsGrid = document.getElementById('caseItemsGrid');
    if (itemsGrid) {
        itemsGrid.innerHTML = caseItems.map(item => `
            <div class="case-item" data-rarity="${item.rarity}">
                <div class="item-image" style="background-image: url('${item.image_url || ''}')">
                    ${!item.image_url ? `<i class="fas fa-box-open"></i>` : ''}
                </div>
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <p class="item-rarity ${item.rarity}">
                        ${getRarityName(item.rarity)}
                    </p>
                    <p class="item-chance">
                        Шанс: ${item.drop_chance}%
                    </p>
                </div>
            </div>
        `).join('');
    }
}

async function openCase() {
    if (!currentCase) return;

    const openBtn = document.getElementById('openCaseBtn');
    if (openBtn) openBtn.disabled = true;

    // Проверяем баланс в реальном режиме
    if (!isDemoMode && balance < currentCase.price * selectedCount) {
        showToast("Недостаточно средств", "error");
        openBtn.disabled = false;
        return;
    }

    // Получаем элементы DOM
    const staticView = document.getElementById('caseStaticView');
    const rouletteView = document.getElementById('caseRouletteView');
    const track = document.getElementById('rouletteTrack');
    
    // Показываем рулетку
    staticView.classList.add('hidden');
    rouletteView.classList.remove('hidden');
    track.innerHTML = '';
    
    try {
        // Отправляем запрос на открытие кейса
        const response = await apiRequest('/cases/open', 'POST', {
            case_id: currentCase.id,
            count: selectedCount,
            is_demo: isDemoMode
        });
        
        if (!response.success) {
            throw new Error(response.error || 'Ошибка открытия кейса');
        }
        
        const wonItems = response.items || [];
        if (wonItems.length === 0) {
            throw new Error('Не получены выигранные предметы');
        }
        
        // Для демонстрации берем первый выигранный предмет
        const targetItem = wonItems[0];
        
        // Создаем дорожку с предметами
        const rouletteItems = [];
        for (let i = 0; i < 5; i++) {
            rouletteItems.push(...[...caseItems].sort(() => Math.random() - 0.5));
        }
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
        void track.offsetWidth;
        
        track.style.transition = 'transform 4s cubic-bezier(0.19, 1, 0.22, 1)';
        track.style.transform = `translateX(-${targetPosition}px)`;
        
        // После завершения анимации показываем модальное окно
        setTimeout(() => {
            showWinModal(targetItem);
            
            // Возвращаем в исходное состояние после закрытия модального окна
            const checkModalClose = setInterval(() => {
                if (!document.getElementById('winModal').classList.contains('active')) {
                    clearInterval(checkModalClose);
                    staticView.classList.remove('hidden');
                    rouletteView.classList.add('hidden');
                    track.style.transform = 'translateX(0)';
                    track.style.transition = 'none';
                    if (openBtn) openBtn.disabled = false;
                }
            }, 100);
        }, 4000);
        
    } catch (error) {
        console.error('Ошибка открытия кейса:', error);
        showToast(error.message || "Ошибка открытия кейса", "error");
        staticView.classList.remove('hidden');
        rouletteView.classList.add('hidden');
        if (openBtn) openBtn.disabled = false;
    }
}

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
    
    // Устанавливаем цену продажи
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

function createConfetti() {
    const container = document.querySelector('.confetti-container');
    container.innerHTML = '';
    
    const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
    const count = 100;
    
    for (let i = 0; i < count; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.top = '-10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        confetti.style.opacity = '0';
        
        container.appendChild(confetti);
        
        // Анимация
        const animation = confetti.animate([
            { 
                top: '-10px',
                opacity: 0,
                transform: `rotate(${Math.random() * 360}deg) scale(0.5)`
            },
            { 
                top: `${10 + Math.random() * 80}%`,
                opacity: 1,
                transform: `rotate(${Math.random() * 360}deg) scale(1)`
            },
            { 
                top: '110%',
                opacity: 0,
                transform: `rotate(${Math.random() * 360}deg) scale(0.5)`
            }
        ], {
            duration: 2000 + Math.random() * 3000,
            delay: Math.random() * 1000,
            easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)'
        });
        
        animation.onfinish = () => confetti.remove();
    }
}

function selectItemWithChance(items) {
    // Создаем "лотерейные билеты" с учетом шансов
    const lotteryTickets = [];
    items.forEach(item => {
        const chance = item.drop_chance || 1;
        for (let i = 0; i < chance; i++) {
            lotteryTickets.push(item);
        }
    });
    
    // Выбираем случайный "билет"
    const randomIndex = Math.floor(Math.random() * lotteryTickets.length);
    return lotteryTickets[randomIndex];
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