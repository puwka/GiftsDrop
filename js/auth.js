// auth.js
export function initTelegramAuth() {
    // Проверяем, что мы в Telegram WebApp
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        try {
            const webApp = Telegram.WebApp;
            
            // Инициализируем WebApp
            webApp.expand();
            webApp.ready();
            
            // Если есть данные пользователя - возвращаем их
            if (webApp.initDataUnsafe?.user) {
                console.log('Real Telegram user detected');
                return {
                    platform: 'telegram',
                    data: webApp.initDataUnsafe.user,
                    webAppInstance: webApp
                };
            }
            
            console.log('No Telegram user data available');
            return null;
        } catch (e) {
            console.error('Telegram auth error:', e);
            return null;
        }
    }
    console.log('Not in Telegram environment');
    return null;
}

export function getTestUserData() {
    return {
        id: 0,
        first_name: "Тестовый",
        last_name: "Пользователь",
        username: "test_user",
        photo_url: "",
        language_code: "ru"
    };
}

export function formatUserData(userData) {
    if (!userData) return null;
    
    return {
        id: userData.id || 0,
        name: [userData.first_name, userData.last_name].filter(Boolean).join(' '),
        username: userData.username ? `@${userData.username}` : '',
        photo: userData.photo_url || '',
        language: userData.language_code || 'ru'
    };
}