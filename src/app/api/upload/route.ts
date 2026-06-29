// src/app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { requireUser, AuthError } from '@/lib/firebase/server-auth';

export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    
    console.log('🔑 Cloudinary config:', { cloudName, apiKey: apiKey ? 'exists' : 'missing', apiSecret: apiSecret ? 'exists' : 'missing' });
    
    if (!cloudName || !apiKey || !apiSecret) {
      console.error('❌ Cloudinary not configured');
      return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 });
    }
    
    const timestamp = Math.round(Date.now() / 1000);
    const folder = `users/${uid}`;
    const uploadPreset = 'infinity_uploads';
    
    // Generate the signature - CORRECT ORDER
    const params = {
      timestamp: timestamp.toString(),
      folder: folder,
      upload_preset: uploadPreset,
    };
    
    // Sort keys alphabetically
    const sortedKeys = Object.keys(params).sort();
    const signatureString = sortedKeys
      .map(key => `${key}=${params[key as keyof typeof params]}`)
      .join('&') + apiSecret;
    
    console.log('📝 Signature string:', signatureString);
    
    const signature = createHash('sha256')
      .update(signatureString)
      .digest('hex');
    
    console.log('✅ Signature generated:', signature);
    
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
