// Импорт функций авторизации
import { initTelegramAuth, getTestUserData, formatUserData } from './auth.js';

// Глобальные переменные
let balance = 1000;
let canSpin = true;
let activeBonuses = [];
let userDeposits = 0;
let currentUser = null;

// ====================== ОСНОВНЫЕ ФУНКЦИИ ======================

// Инициализация приложения
async function initApp() {
  // 1. Авторизация
  const authResult = initTelegramAuth();
  currentUser = authResult 
    ? formatUserData(authResult.data)
    : formatUserData(getTestUserData());

  // 2. Обновление интерфейса
  updateProfile();
  initTheme();
  initRoulette();
  initDepositModal();
  updateActiveBonuses();
  checkAvailableGiveaways();
  
  // 3. Открываем стартовую вкладку
  openTab('cases', true);

  // 4. Периодическое обновление
  setInterval(updateActiveBonuses, 60000);
}

// Обновление профиля
function updateProfile() {
  if (!currentUser) return;
  
  const userName = document.getElementById('userName');
  const avatar = document.getElementById('userAvatar');
  const placeholder = document.getElementById('avatarPlaceholder');

  userName.textContent = `${currentUser.name} ${currentUser.username}`;
  
  if (currentUser.photo) {
    placeholder.style.display = 'none';
    avatar.style.backgroundImage = `url(${currentUser.photo})`;
  } else {
    placeholder.style.display = 'flex';
    avatar.style.backgroundImage = 'none';
  }

  // Обновляем статистику
  updateUserStats();
}

// Обновление статистики
function updateUserStats() {
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
function openTab(tabName, isInitial = false) {
  try {
    if (!isInitial && !event) return;

    // Скрыть все вкладки
    document.querySelectorAll('.tab-content').forEach(tab => {
      tab?.classList.remove('active');
    });
    
    // Снять активность с кнопок
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn?.classList.remove('active');
    });
    
    // Показать выбранную вкладку
    const tab = document.getElementById(tabName);
    if (tab) tab.classList.add('active');
    
    // Активировать кнопку (если не начальная загрузка)
    if (!isInitial) {
      event.currentTarget?.classList.add('active');
    }
  } catch (e) {
    console.error('Tab error:', e);
  }
}

// ====================== РУЛЕТКА БОНУСОВ ======================
function initRoulette() {
  const track = document.getElementById('rouletteTrack');
  if (!track) return;
  
  track.innerHTML = '';
  
  for (let i = 0; i < 20; i++) {
    const type = getRandomBonusType();
    const bonus = getRandomVariant(type);
    
    const item = document.createElement('div');
    item.className = `roulette-item ${type}`;
    item.innerHTML = `<i class="fas ${bonus.icon}"></i>`;
    item.dataset.type = type;
    item.dataset.value = bonus.value;
    
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
  
  const track = document.getElementById('rouletteTrack');
  if (!track) return;
  
  track.style.transition = 'transform 3s cubic-bezier(0.25, 0.1, 0.25, 1)';
  track.style.transform = `translateX(${-Math.random() * 2000}px)`;
  
  setTimeout(() => {
    const items = document.querySelectorAll('.roulette-item');
    const winner = items[Math.floor(Math.random() * items.length)];
    
    activateBonus({
      type: winner.dataset.type,
      value: winner.dataset.value
    });
    
    setTimeout(() => {
      track.style.transition = 'none';
      initRoulette();
      canSpin = true;
    }, 500);
  }, 3000);
}

// ====================== СИСТЕМА ПОПОЛНЕНИЯ ======================
function initDepositModal() {
  const tonInput = document.getElementById('tonAmount');
  const starsInput = document.getElementById('starsAmount');
  
  tonInput?.addEventListener('input', updateTonCalculation);
  starsInput?.addEventListener('input', updateStarsCalculation);
}

function updateTonCalculation() {
  const ton = parseFloat(this.value) || 0;
  document.getElementById('tonGiftcoin').textContent = Math.floor(ton * 200);
}

function updateStarsCalculation() {
  const stars = parseInt(this.value) || 0;
  document.getElementById('starsGiftcoin').textContent = stars;
}

function openDepositModal() {
  document.getElementById('depositModal')?.classList.remove('hidden');
}

function closeDepositModal() {
  document.getElementById('depositModal')?.classList.add('hidden');
}

// ====================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======================
function updateBalance(amount) {
  balance += amount;
  document.querySelectorAll('.balance-amount').forEach(el => {
    el.textContent = balance;
  });
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.remove(), 3000);
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', initApp);