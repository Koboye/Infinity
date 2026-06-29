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
    
    console.log('🔑 Cloudinary config check:');
    console.log('  cloudName:', cloudName || '❌ MISSING');
    console.log('  apiKey:', apiKey ? '✅ EXISTS' : '❌ MISSING');
    console.log('  apiSecret:', apiSecret ? '✅ EXISTS' : '❌ MISSING');
    
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ 
        error: 'Cloudinary not configured - check FIREBASE env vars' 
      }, { status: 500 });
    }
    
    const timestamp = Math.round(Date.now() / 1000);
    const folder = `users/${uid}`;
    const uploadPreset = 'infinity_uploads';
    
    // ✅ Build the params object
    const params = {
      timestamp: timestamp,
      folder: folder,
      upload_preset: uploadPreset,
    };
    
    // ✅ Cloudinary requires keys to be sorted alphabetically
    const sortedKeys = Object.keys(params).sort();
    const signatureString = sortedKeys
      .map(key => `${key}=${params[key as keyof typeof params]}`)
      .join('&') + apiSecret;
    
    console.log('📝 Params:', params);
    console.log('📝 Signature string:', signatureString);
    
    // ✅ Generate SHA-256 signature
    const signature = createHash('sha256')
      .update(signatureString)
      .digest('hex');
    
    console.log('✅ Generated signature:', signature);
    
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
    console.error('❌ Upload error:', err);
    return NextResponse.json({ 
      error: 'Failed to generate upload signature' 
    }, { status: 500 });
  }
}
