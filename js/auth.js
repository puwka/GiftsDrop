// auth.js
export function initTelegramAuth() {
    // Проверяем, что находимся в Telegram WebApp
    if (typeof Telegram !== 'undefined' && Telegram.WebApp) {
        const webApp = Telegram.WebApp;
        
        try {
            // Инициализируем WebApp
            webApp.expand();
            webApp.ready();
            
            // Проверяем, есть ли данные пользователя
            if (webApp.initDataUnsafe?.user) {
                return {
                    platform: 'telegram',
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

export function getTestUserData() {
    return {
        id: Math.floor(Math.random() * 100000),
        first_name: "Тестовый",
        last_name: "Пользователь",
        username: "test_user",
        photo_url: ""
    };
}

export function formatUserData(userData) {
    if (!userData) return null;
    
    return {
        id: userData.id || 0,
        name: [userData.first_name, userData.last_name].filter(Boolean).join(' '),
        username: userData.username ? `@${userData.username}` : '',
        photo: userData.photo_url || ''
    };
}