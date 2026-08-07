import { precacheAndRoute } from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: data.icon || '/icon.png',
      badge: '/icon.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: '2'
      }
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'POS Cake', options).then(() => {
        if ('setAppBadge' in navigator) {
          return self.registration.getNotifications().then(notifications => {
            navigator.setAppBadge(notifications.length);
          });
        }
      })
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/').then(() => {
      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge();
      }
    })
  );
});
