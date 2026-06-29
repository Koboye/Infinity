// src/app/api/conversations/route.ts
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { requireUser, AuthError } from '@/lib/firebase/server-auth';

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await request.json();
    
    const { otherId, otherUsername, otherAvatarColor, otherAvatarUrl } = body;
    
    if (!otherId || !otherUsername) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Get current user info
    const userSnap = await adminDb().collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = userSnap.data()!;
    
    // Check if conversation already exists
    const existingSnap = await adminDb().collection('conversations')
      .where('participants', 'array-contains', uid)
      .get();
    
    const existing = existingSnap.docs.find(doc => {
      const data = doc.data();
      return data.participants && data.participants.includes(otherId);
    });
    
    if (existing) {
      return NextResponse.json({ 
        success: true, 
        conversationId: existing.id,
        existing: true
      });
    }
    
    // Create new conversation
    const ref = await adminDb().collection('conversations').add({
      participants: [uid, otherId],
      participantNames: {
        [uid]: user.username,
        [otherId]: otherUsername
      },
      participantAvatars: {
        [uid]: user.avatar || user.username[0].toUpperCase(),
        [otherId]: otherUsername[0].toUpperCase()
      },
      participantAvatarColors: {
        [uid]: user.avatarColor || '#3D6B4F',
        [otherId]: otherAvatarColor || '#3D6B4F'
      },
      participantAvatarUrls: {
        [uid]: user.avatarUrl || null,
        [otherId]: otherAvatarUrl || null
      },
      lastMessage: '',
      lastMessageAt: FieldValue.serverTimestamp(),
      unreadCount: {
        [uid]: 0,
        [otherId]: 0
      },
    });
    
    return NextResponse.json({ 
      success: true, 
      conversationId: ref.id,
      existing: false
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Conversation error:', err);
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
  }
}
