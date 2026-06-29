// src/app/api/saves/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, AuthError } from '@/lib/firebase/server-auth';

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await request.json();
    
    const { videoId, currentlySaved } = body;
    
    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }
    
    const ref = adminDb().collection('saves').doc(`${videoId}_${uid}`);
    
    if (currentlySaved) {
      // Unsave - delete the document
      await ref.delete();
    } else {
      // Save - create the document
      await ref.set({
        videoId,
        userId: uid,
        createdAt: adminDb.FieldValue.serverTimestamp(),
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Save error:', err);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
