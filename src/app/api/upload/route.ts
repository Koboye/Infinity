// src/app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/lib/firebase/server-auth';

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    
    console.log('🔑 Cloudinary config (UNSIGNED):', { 
      cloudName: cloudName || 'MISSING', 
      apiKey: apiKey ? 'EXISTS' : 'MISSING'
    });
    
    if (!cloudName || !apiKey) {
      return NextResponse.json({ 
        error: 'Cloudinary not configured' 
      }, { status: 500 });
    }
    
    const timestamp = Math.round(Date.now() / 1000);
    const folder = `users/${uid}`;
    const uploadPreset = 'infinity_uploads'; // Must be UNSIGNED in Cloudinary
    
    // ✅ For UNSIGNED - NO SIGNATURE!
    return NextResponse.json({
      apiKey,
      cloudName,
      folder,
      timestamp,
      upload_preset: uploadPreset,
      // ❌ NO signature field!
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('❌ Upload error:', err);
    return NextResponse.json({ 
      error: 'Failed to generate upload config' 
    }, { status: 500 });
  }
}
