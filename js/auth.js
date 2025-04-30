// auth.js
export function initTelegramAuth() {
    if (typeof Telegram === 'undefined' || !Telegram.WebApp) {
        console.warn('Telegram WebApp not detected');
        return null;
    }

    const webApp = Telegram.WebApp;
    
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

export function getTestUserData() {
    return {
        first_name: "Тестовый",
        last_name: "Пользователь",
        username: "test_user",
        photo_url: "",
        id: Math.floor(Math.random() * 100000)
    };
}

export function formatUserData(userData) {
    return {
        name: [userData.first_name, userData.last_name].filter(Boolean).join(' '),
        username: userData.username ? `@${userData.username}` : '',
        photo: userData.photo_url || '',
        id: userData.id || 0
    };
}