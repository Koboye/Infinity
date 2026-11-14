import { NextResponse } from 'next/server';

// Firebase web configuration is public by design; never expose admin credentials.
export async function GET() {
  const keys = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'APP_ID', 'MESSAGING_SENDER_ID'];
  const values = Object.fromEntries(keys.map(k => [k, process.env['NEXT_PUBLIC_FIREBASE_' + k] || '']));
  return NextResponse.json({
    apiKey: values.API_KEY,
    authDomain: values.AUTH_DOMAIN,
    projectId: values.PROJECT_ID,
    appId: values.APP_ID,
    messagingSenderId: values.MESSAGING_SENDER_ID
  }, { headers: { 'Cache-Control': 'no-store' } });
}
