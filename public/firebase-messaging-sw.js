/* Firebase Cloud Messaging background service worker.
   Must live at /firebase-messaging-sw.js (root scope) — this is the exact path the
   Firebase Messaging SDK auto-registers when getToken() is called without an explicit
   serviceWorkerRegistration option, which is how Infinity.jsx calls it. Without this
   file at this path, getToken() rejects (404) and push notifications never activate,
   silently, since the call site wraps it in a try/catch.

   IMPORTANT — action required before deploy:
   Static files in /public are served as-is; they can't read Next.js environment
   variables. Fill in YOUR OWN Firebase project's web config below (Firebase Console >
   Project Settings > General > Your apps > SDK setup and configuration) — the same
   values you put in .env.local's NEXT_PUBLIC_FIREBASE_* vars. These values aren't
   secret, but they ARE project-specific: leaving a placeholder or someone else's
   project here means push notifications silently go to the wrong Firebase project. */

importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "REPLACE_WITH_YOUR_FIREBASE_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_PROJECT.firebaseapp.com",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Infinity';
  const type = payload.data?.type || 'notif';
  const options = {
    body: payload.notification?.body || payload.data?.body || 'You have a new notification',
    icon: 'https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png',
    badge: 'https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png',
    vibrate: type === 'call' ? [300, 100, 300, 100, 300] : [200, 100, 200],
    data: payload.data || {},
    actions: type === 'call'
      ? [{ action: 'answer', title: '✅ Answer' }, { action: 'decline', title: '❌ Decline' }]
      : [{ action: 'open', title: 'Open' }],
    tag: type,
    renotify: true,
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = event.notification.data?.link || '/';
  event.waitUntil(clients.openWindow(link));
});
