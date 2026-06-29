import { NextResponse } from 'next/server';
import { adminDb, requireUser, AuthError } from '@/lib/firebase/admin';

export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);

    const db = adminDb();
    const [meSnap, snap] = await Promise.all([
      db.collection('users').doc(uid).get(),
      db.collection('users').orderBy('createdAt', 'desc').limit(30).get(),
    ]);

    const following: string[] = meSnap.exists ? (meSnap.data()!.following ?? []) : [];

    const users = snap.docs
      .filter(d => d.id !== uid && !following.includes(d.id))
      .slice(0, 8)
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          username: data.username ?? '',
          fullName: data.fullName ?? '',
          avatar: data.avatar ?? (data.username?.[0]?.toUpperCase() ?? '?'),
          avatarColor: data.avatarColor ?? '#3D6B4F',
          avatarUrl: data.avatarUrl ?? null,
          bio: data.bio ?? '',
          verified: data.verified ?? false,
        };
      });

    return NextResponse.json({ users });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('suggested users error', err);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}
