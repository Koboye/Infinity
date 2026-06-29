import { NextResponse } from 'next/server';
import { adminDb, requireUser, AuthError } from '@/lib/firebase/admin';

interface PublicUser {
  id: string;
  username: string;
  fullName: string;
  avatar: string;
  avatarColor: string;
  avatarUrl: string | null;
  bio: string;
  verified: boolean;
}

function toPublic(id: string, data: FirebaseFirestore.DocumentData): PublicUser {
  return {
    id,
    username: data.username ?? '',
    fullName: data.fullName ?? '',
    avatar: data.avatar ?? (data.username?.[0]?.toUpperCase() ?? '?'),
    avatarColor: data.avatarColor ?? '#3D6B4F',
    avatarUrl: data.avatarUrl ?? null,
    bio: data.bio ?? '',
    verified: data.verified ?? false,
  };
}

export async function GET(request: Request) {
  try {
    const { uid } = await requireUser(request);

    const { searchParams } = new URL(request.url);
    const qRaw = searchParams.get('q')?.trim() ?? '';
    if (!qRaw) return NextResponse.json({ users: [] });
    if (qRaw.length > 30) return NextResponse.json({ error: 'Query too long' }, { status: 400 });

    const q = qRaw.toLowerCase();

    const db = adminDb();
    const snap = await db
      .collection('users')
      .orderBy('username')
      .startAt(q)
      .endAt(q + '\uf8ff')
      .limit(15)
      .get();

    const users = snap.docs
      .filter(d => d.id !== uid)
      .map(d => toPublic(d.id, d.data()));

    return NextResponse.json({ users });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('user search error', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
