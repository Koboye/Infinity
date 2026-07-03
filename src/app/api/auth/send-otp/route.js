import { NextResponse } from 'next/server';
import { createHash, randomInt } from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const OTP_TTL_MS = 10 * 60 * 1000;
const EMAILJS_SERVICE = 'service_mtqmvbb';
const EMAILJS_TEMPLATE = 'template_1k7wiqa';
const EMAILJS_PUBLIC_KEY = 'U9fs25Bcx5oQ6A2ru';

function hashOtp(otp, email) {
  // Salted with the email + a server secret so a leaked Firestore doc alone isn't enough
  // to forge a code (defense in depth on top of the fact that /otps is now admin-only).
  const secret = process.env.OTP_HASH_SECRET || 'dev-only-fallback-secret-change-me';
  return createHash('sha256').update(`${otp}:${email.toLowerCase()}:${secret}`).digest('hex');
}

export async function POST(req) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit by IP (broad abuse) and by email (targeted spam/enumeration).
    const ip = clientIp(req);
    const ipCheck = await rateLimit(`otp-send-ip:${ip}`, 10, 60 * 60);
    const emailCheck = await rateLimit(`otp-send-email:${normalizedEmail}`, 5, 15 * 60);
    if (!ipCheck.allowed || !emailCheck.allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }

    const otp = String(randomInt(100000, 1000000));
    const otpHash = hashOtp(otp, normalizedEmail);
    const expiresAt = Date.now() + OTP_TTL_MS;

    // Server-owned collection. firestore.rules denies ALL client read/write on /otps.
    await adminDb.collection('otps').doc(normalizedEmail).set({
      otpHash,
      expiresAt,
      attempts: 0,
      createdAt: Date.now(),
    });

    const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE,
        template_id: EMAILJS_TEMPLATE,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
          to_email: normalizedEmail,
          from_name: 'Infinity',
          message: `Your Infinity verification code is: ${otp}\n\nExpires in 10 minutes.`,
          otp_code: otp,
          code: otp,
        },
      }),
    });

    if (!emailRes.ok) {
      console.error('EmailJS send failed', emailRes.status, await emailRes.text());
      return NextResponse.json({ error: 'Failed to send verification email' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, expiresAt });
  } catch (e) {
    console.error('send-otp error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
