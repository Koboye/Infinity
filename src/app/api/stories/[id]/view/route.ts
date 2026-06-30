import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, AuthError } from '@/lib/firebase/server-auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await requireUser(request);
    const { id: storyId } = await params;
    await adminDb().collection('stories').doc(storyId).update({
      views: FieldValue.arrayUnion(uid),
    });
    return NextResponse.json({ counted: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    console.error('register story view error', err);
    return NextResponse.json({ counted: false });
  }
}
