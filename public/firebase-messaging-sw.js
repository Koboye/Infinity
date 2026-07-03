/* Firebase Cloud Messaging background service worker.
   Must live at /firebase-messaging-sw.js (root scope) — this is the exact path the
   Firebase Messaging SDK auto-registers when getToken() is called without an explicit
   serviceWorkerRegistration option, which is how Infinity.jsx calls it. Without this
   file at this path, getToken() rejects (404) and push notifications never activate,
   silently, since the call site wraps it in a try/catch. */

importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD9jDk8gijMVAYrsFe4vpojI7GyZnkzGL8",
  authDomain: "dagu-8348c.firebaseapp.com",
  projectId: "dagu-8348c",
  storageBucket: "dagu-8348c.firebasestorage.app",
  messagingSenderId: "259738670911",
  appId: "1:259738670911:web:c4d1116e3697a8f67c658a",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Infinity';
  const options = {
    body: payload.notification?.body || payload.data?.body || 'You have a new notification',
    icon: 'https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png',
    badge: 'https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png',
    data: payload.data || {},
    tag: payload.data?.type || 'notif',
    renotify: true,
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
