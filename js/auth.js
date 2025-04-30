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
                const user = webApp.initDataUnsafe.user;
                console.log('Telegram user data:', user);
                return {
                    platform: 'telegram',
                    data: user,
                    webAppInstance: webApp
                };
            } else {
                console.log('User data not available, requesting access...');
                webApp.requestWriteAccess();
                webApp.requestContact();
                return null;
            }
        } catch (e) {
            console.error('Telegram auth error:', e);
            return null;
        }
    }
    
    console.warn('Telegram WebApp not detected, using test data');
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
        username: userData.username ? `@${userData.username}` : 'Без username',
        photo: userData.photo_url || '',
        language: userData.language_code || 'ru'
    };
}