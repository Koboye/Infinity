// src/app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { requireUser, AuthError } from '@/lib/firebase/server-auth';

export async function POST(request: Request) {
  try {
    // Only authenticated users can upload
    const { uid } = await requireUser(request);
    
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 });
    }
    
    const timestamp = Math.round(Date.now() / 1000);
    const folder = `users/${uid}`;
    const uploadPreset = 'infinity_uploads';
    
    // Generate the signature
    const params = {
      timestamp,
      folder,
      upload_preset: uploadPreset,
    };
    
    const signatureString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key as keyof typeof params]}`)
      .join('&') + apiSecret;
    
    const signature = createHash('sha256')
      .update(signatureString)
      .digest('hex');
    
    return NextResponse.json({
      apiKey,
      cloudName,
      folder,
      timestamp,
      upload_preset: uploadPreset,
      signature,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Upload signature error:', err);
    return NextResponse.json({ error: 'Failed to generate upload signature' }, { status: 500 });
  }
}
