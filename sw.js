const CACHE_NAME = 'neyrochat-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('https://my-chat-ey1e.onrender.com')
    );
});
