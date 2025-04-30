import { 
    initTelegramAuth,
    getTestUserData,
    formatUserData
  } from './auth.js';
  
  // Глобальные переменные
  let balance = 1000;
  let canSpin = true;
  let activeBonuses = [];
  let userDeposits = 0;
  let currentUser = null;
  
  // Типы бонусов
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
  
  // ====================== ОСНОВНЫЕ ФУНКЦИИ ======================
  
  function initApp() {
    // 1. Инициализация авторизации
    const authResult = initTelegramAuth();
    currentUser = authResult 
      ? formatUserData(authResult.data)
      : formatUserData(getTestUserData());
  
    // 2. Обновление интерфейса
    updateProfile();
    updateUserStats(currentUser.id);
  
    // 3. Инициализация компонентов
    initTheme();
    initRoulette();
    initDepositModal();
    updateActiveBonuses();
    openTab('cases');
    checkAvailableGiveaways();
  
    // 4. Периодическое обновление
    setInterval(updateActiveBonuses, 60000);
  
    // 5. Добавляем кнопку для теста (только вне Telegram)
    if (typeof Telegram === 'undefined') {
      addTestButton();
    }
  }
  
  function updateProfile() {
    if (!currentUser) return;
  
    const userName = document.getElementById('userName');
    const avatar = document.getElementById('userAvatar');
    const placeholder = document.getElementById('avatarPlaceholder');
  
    userName.textContent = `${currentUser.name} ${currentUser.username}`;
  
    if (currentUser.photo) {
      placeholder.style.display = 'none';
      avatar.style.backgroundImage = `url(${currentUser.photo})`;
      avatar.style.backgroundSize = 'cover';
    } else {
      placeholder.style.display = 'flex';
      avatar.style.backgroundImage = 'none';
    }
  }
  
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
  
  // ====================== ФУНКЦИИ ИНТЕРФЕЙСА ======================
  
  function openTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    const buttons = document.querySelectorAll('.nav-btn');
    const targetTab = document.getElementById(tabName);
    const currentBtn = event?.currentTarget;
  
    if (!targetTab || !currentBtn) return;
  
    tabs.forEach(tab => tab?.classList.remove('active'));
    buttons.forEach(btn => btn?.classList.remove('active'));
  
    targetTab?.classList.add('active');
    currentBtn?.classList.add('active');
  }
  
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
  
  // ====================== РУЛЕТКА И КЕЙСЫ ======================
  
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
    const targetType = getRandomBonusType();
    const targetItems = Array.from(items).filter(item => item.dataset.type === targetType);
    const targetItem = targetItems[Math.floor(Math.random() * targetItems.length)];
    const itemIndex = Array.from(items).indexOf(targetItem);
    const itemWidth = 110;
    const stopPosition = -(itemIndex * itemWidth) + (window.innerWidth / 2 - itemWidth / 2);
    
    track.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)';
    track.style.transform = `translateX(${stopPosition}px)`;
    
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
      
      setTimeout(() => {
        track.style.transition = 'none';
        initRoulette();
        canSpin = true;
        document.querySelector('.spin-button').disabled = false;
      }, 500);
    }, 3000);
  }
  
  // ====================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======================
  
  function addTestButton() {
    const testBtn = document.createElement('button');
    testBtn.className = 'test-data-btn';
    testBtn.textContent = 'Тестовые данные';
    testBtn.onclick = () => {
      currentUser = formatUserData(getTestUserData());
      updateProfile();
      showToast("Тестовые данные загружены", "success");
    };
    document.body.appendChild(testBtn);
  }
  
  // Запуск приложения
  document.addEventListener('DOMContentLoaded', initApp);