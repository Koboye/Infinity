import { NextRequest, NextResponse } from 'next/server';
import { adminDb, requireUser } from '@/lib/firebase/admin';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { uid } = await requireUser(request);
    const body = await request.json().catch(() => ({}));
    const { username: requestedUsername, fullName, email } = body;

    const userRef = adminDb().collection('users').doc(uid);
    const existing = await userRef.get();

    // Generate username from email if not provided
    let username = requestedUsername;
    if (!username || username.trim() === '') {
      if (email) {
        username = email.split('@')[0]
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .slice(0, 20);
      }
      if (!username || username.length < 3) {
        username = `user_${randomBytes(4).toString('hex')}`;
      }
    }

    username = username.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 20);
    if (username.length < 3) {
      username = `user_${randomBytes(4).toString('hex')}`;
    }

    // Check if username is taken
    const existingUsers = await adminDb()
      .collection('users')
      .where('username', '==', username)
      .get();
    
    const taken = existingUsers.docs.some(d => d.id !== uid);
    if (taken) {
      username = `${username}_${randomBytes(3).toString('hex')}`;
    }

    if (existing.exists) {
      await userRef.update({
        username,
        fullName: fullName ?? existing.data()?.fullName ?? '',
        email: email ?? existing.data()?.email ?? '',
      });
    } else {
      await userRef.set({
        username,
        fullName: fullName ?? '',
        email: email ?? '',
        avatar: username[0]?.toUpperCase() ?? 'U',
        avatarColor: `hsl(${Math.floor(Math.random() * 360)},70%,60%)`,
        avatarUrl: null,
        bio: 'New to Infinity! 🎬',
        link: '',
        verified: false,
        followers: [],
        following: [],
        blockedUsers: [],
        coins: 500,
        walletBalance: 500,
        level: 1,
        streak: 1,
        subscription: 'free',
        language: 'en',
        theme: 'dark',
        createdAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, username });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Registration failed' },
      { status: 400 }
    );
  }
}
