import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export async function GET(req) {
  const secret = req.nextUrl.searchParams.get('secret');
  const email = req.nextUrl.searchParams.get('email');

  if (secret !== 'change-this-to-something-random-123') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });

  return NextResponse.json({ success: true, uid: user.uid, email });
}
