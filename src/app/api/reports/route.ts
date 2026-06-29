// src/app/api/reports/route.ts
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, AuthError } from '@/lib/firebase/server-auth';

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await request.json();
    
    const { postId, reason } = body;
    
    if (!postId || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    await adminDb().collection('reports').add({
      postId,
      reportedBy: uid,
      reason,
      createdAt: FieldValue.serverTimestamp(),
    });
    
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Report error:', err);
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 });
  }
}
