// src/app/api/messages/route.ts
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, AuthError } from '@/lib/firebase/server-auth';

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await request.json();
    
    const { conversationId, text, otherId } = body;
    
    if (!conversationId || !text?.trim() || !otherId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Add message
    const messageRef = await adminDb().collection('messages').add({
      conversationId,
      text: text.trim(),
      senderId: uid,
      createdAt: FieldValue.serverTimestamp(),
      read: false,
    });
    
    // Update conversation
    await adminDb().collection('conversations').doc(conversationId).update({
      lastMessage: text.trim(),
      lastMessageAt: FieldValue.serverTimestamp(),
      [`unreadCount.${otherId}`]: FieldValue.increment(1),
    });
    
    return NextResponse.json({ 
      success: true, 
      messageId: messageRef.id 
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Message error:', err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
