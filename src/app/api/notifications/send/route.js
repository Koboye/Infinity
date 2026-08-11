import { NextResponse } from 'next/server';
import { adminDb, adminMessaging, requireAuth } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';

// ─────────────────────────────────────────────────────────────────────────
// Real push delivery (the piece that was entirely missing).
//
// Everywhere else in the app, "sending a notification" only ever meant
// addDoc(collection(db,'notifications'), {...}) — a Firestore document that
// the *client* has to be open and subscribed to see. That's why in-app
// toasts worked but nothing ever popped up outside the app (locked screen,
// backgrounded browser, app fully closed) like TikTok/WhatsApp do: no code
// anywhere called the FCM send API, so no push was ever actually dispatched
// to the device. This route is that missing call. It's invoked by the
// client's sendNotification() helper right after it writes the Firestore
// doc, using the stored fcmToken on the recipient's user document.
// ─────────────────────────────────────────────────────────────────────────

export async function POST(req) {
  try {
    const decoded = await requireAuth(req); // caller must be a real signed-in user
    const { allowed } = await rateLimit(`push:${decoded.uid}`, 40, 60);
    if (!allowed) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const { toUserId, title, body, data, type } = await req.json();
    if (!toUserId || !title) {
      return NextResponse.json({ error: 'toUserId and title are required' }, { status: 400 });
    }
    // Never let someone push-spam themselves via a stray call, and never
    // trust a fromUserId out of the body — it's not used, the token identity is.
    if (toUserId === decoded.uid) return NextResponse.json({ ok: true, skipped: 'self' });

    const userSnap = await adminDb.collection('users').doc(toUserId).get();
    const fcmToken = userSnap.data()?.fcmToken;
    if (!fcmToken) return NextResponse.json({ ok: true, skipped: 'no-token' });

    // FCM data payloads must be flat string key/values.
    const stringData = Object.fromEntries(
      Object.entries({ type: type || 'notif', ...(data || {}) }).map(([k, v]) => [k, String(v)])
    );

    try {
      await adminMessaging.send({
        token: fcmToken,
        notification: { title, body: body || '' },
        data: stringData,
        webpush: {
          notification: {
            icon: 'https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png',
            badge: 'https://res.cloudinary.com/dotvhzjmc/image/upload/znfksngv27boh3c1kxpv.png',
            tag: type || 'notif',
            renotify: true,
          },
          fcmOptions: { link: data?.link || '/' },
        },
      });
      return NextResponse.json({ ok: true });
    } catch (sendErr) {
      // A stale/uninstalled-app token fails every single time until cleared —
      // wipe it so future sends don't keep silently failing against it.
      const staleCodes = [
        'messaging/registration-token-not-registered',
        'messaging/invalid-registration-token',
        'messaging/invalid-argument',
      ];
      if (staleCodes.includes(sendErr?.code)) {
        await adminDb.collection('users').doc(toUserId).update({ fcmToken: null }).catch(() => {});
      }
      console.error('Push send failed:', sendErr?.code || sendErr?.message);
      return NextResponse.json({ ok: false, error: sendErr?.message }, { status: 200 });
    }
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
