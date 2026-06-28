import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb, requireUser, AuthError } from '@/lib/firebase/admin';

interface RegisterBody {
  username: string;
  fullName?: string;
}

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);

    const body = await request.json().catch(() => null) as RegisterBody | null;
    if (!body?.username?.trim()) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    const db = adminDb();
    const userRef = db.collection('users').doc(uid);

    const snap = await userRef.get();
    if (snap.exists) {
      return NextResponse.json({ ok: true, created: false });
    }

    const username = body.username.trim();
    await userRef.set({
      id: uid,
      username,
      fullName: body.fullName?.trim() ?? '',
      email: '',
      avatar: username[0]!.toUpperCase(),
      avatarColor: `hsl(${Math.floor(Math.random() * 360)},70%,60%)`,
      avatarUrl: null,
      bio: 'New to Infinity! 🎬',
      link: '',
      verified: false,
      coins: 500,
      walletBalance: 500,
      level: 1,
      streak: 1,
      subscription: 'free',
      followers: [],
      following: [],
      blockedUsers: [],
      language: 'en',
      theme: 'dark',
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, created: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('register error', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
