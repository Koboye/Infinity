// src/app/api/conversations/read/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, AuthError } from '@/lib/firebase/server-auth';

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await request.json();
    
    const { conversationId } = body;
    
    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 });
    }
    
    await adminDb().collection('conversations').doc(conversationId).update({
      [`unreadCount.${uid}`]: 0,
    });
    
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Read error:', err);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}
