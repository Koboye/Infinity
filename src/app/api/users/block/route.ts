import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, AuthError } from '@/lib/firebase/server-auth';

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await request.json();
    
    const { userId } = body;
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }
    
    if (userId === uid) {
      return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
    }
    
    await adminDb().collection('users').doc(uid).update({
      blockedUsers: FieldValue.arrayUnion(userId),
    });
    
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Block error:', err);
    return NextResponse.json({ error: 'Failed to block user' }, { status: 500 });
  }
}
