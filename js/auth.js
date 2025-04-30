// auth.js - Отдельный модуль для работы с Telegram WebApp

/**
 * Инициализация Telegram WebApp
 * @returns {Object|null} Объект с данными пользователя или null
 */
export function initTelegramAuth() {
    // Проверяем доступность Telegram WebApp API
    if (typeof Telegram === 'undefined' || !Telegram.WebApp) {
      console.warn('Telegram WebApp not detected');
      return null;
    }
  
    const webApp = Telegram.WebApp;
    
    // Инициализируем WebApp
    try {
      webApp.expand();
      webApp.ready();
      
      if (!webApp.initDataUnsafe?.user) {
        console.log('Requesting user access...');
        webApp.requestWriteAccess();
        return null;
      }
  
      return {
        platform: 'telegram',
        data: webApp.initDataUnsafe.user,
        webAppInstance: webApp
      };
    } catch (e) {
      console.error('Telegram auth error:', e);
      return null;
    }
  }
  
  /**
   * Получение данных тестового пользователя
   * @returns {Object} Тестовые данные
   */
  export function getTestUserData() {
    return {
      first_name: "Тестовый",
      last_name: "Пользователь",
      username: "test_user",
      photo_url: "",
      id: Math.floor(Math.random() * 100000)
    };
  }
  
  /**
   * Форматирование данных пользователя
   * @param {Object} userData 
   * @returns {Object} Форматированные данные
   */
  export function formatUserData(userData) {
    return {
      name: [userData.first_name, userData.last_name].filter(Boolean).join(' '),
      username: userData.username ? `@${userData.username}` : '',
      photo: userData.photo_url || '',
      id: userData.id || 0
    };
  }