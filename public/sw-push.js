self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    console.error('[SW] Push event data parsing failed:', e);
    data = { title: 'Nova notificação', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Nova reserva!';
  const options = {
    body: data.body || 'Você tem uma nova atualização no Nera.',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: data.data || { url: '/dashboard' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
