const CACHE_NAME = 'neyrochat-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('push', (event) => {
    let data = {};
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = {
                title: 'NEYROCHAT',
                body: event.data.text()
            };
        }
    }
    
    const options = {
        body: data.body || 'Новое сообщение',
        icon: 'https://cdn-icons-png.flaticon.com/512/134/134914.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/134/134914.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || 'https://my-chat-ey1e.onrender.com'
        },
        actions: [
            {
                action: 'open',
                title: '📱 Открыть чат'
            },
            {
                action: 'close',
                title: '❌ Закрыть'
            }
        ],
        tag: 'chat-message',
        renotify: true
    };
    
    event.waitUntil(
        self.registration.showNotification(
            data.title || '💬 NEYROCHAT',
            options
        )
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow('https://my-chat-ey1e.onrender.com')
        );
    }
});
