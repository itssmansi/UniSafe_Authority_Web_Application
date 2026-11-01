/* eslint-disable no-undef */
// Service worker for UniSafe Authority Web FCM push notifications
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const urlParams = new URL(location).searchParams;
const firebaseConfig = {
  apiKey: urlParams.get('apiKey') || 'AIzaSyPlaceholderKeyForUniSafeAuthorityPortal',
  authDomain: urlParams.get('authDomain') || 'unisafe-authority.firebaseapp.com',
  projectId: urlParams.get('projectId') || 'unisafe-authority',
  storageBucket: urlParams.get('storageBucket') || 'unisafe-authority.appspot.com',
  messagingSenderId: urlParams.get('messagingSenderId') || '123456789012',
  appId: urlParams.get('appId') || '1:123456789012:web:abcdef123456',
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background push:', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || 'UniSafe Authority Alert';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'New operational update received.',
      icon: payload.notification?.icon || '/favicon.svg',
      badge: '/favicon.svg',
      data: payload.data || {},
      tag: payload.data?.reference_id || 'unisafe-notification',
      renotify: true,
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Background messaging init:', err);
}

// Fallback native push event listener
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.notification?.title || payload.title || 'UniSafe Authority Notification';
    const body = payload.notification?.body || payload.body || 'Operational notification received.';
    const options = {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: payload.data || payload,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // String payload fallback
    event.waitUntil(
      self.registration.showNotification('UniSafe Notification', {
        body: event.data.text(),
        icon: '/favicon.svg',
      })
    );
  }
});

// Handle notification click to focus or open dashboard
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let targetUrl = '/';
  if (data.reference_type === 'complaint' && data.reference_id) {
    targetUrl = `/?complaintId=${data.reference_id}`;
  } else if (data.reference_type === 'sighting' && data.reference_id) {
    targetUrl = `/?sightingId=${data.reference_id}`;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: data,
          });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
