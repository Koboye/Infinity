import { NextResponse } from 'next/server';
import { createHash, randomInt } from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const OTP_TTL_MS = 10 * 60 * 1000;
const EMAILJS_SERVICE = 'service_c0xotdn';
const EMAILJS_TEMPLATE = 'template_vppithq';
const EMAILJS_PUBLIC_KEY = '5Zn_mOJ0NA7-Mqmf5';

function hashOtp(otp, email) {
  // Salted with the email + a server secret so a leaked Firestore doc alone isn't enough
  // to forge a code (defense in depth on top of the fact that /otps is now admin-only).
  const secret = process.env.OTP_HASH_SECRET || 'dev-only-fallback-secret-change-me';
  return createHash('sha256').update(`${otp}:${email.toLowerCase()}:${secret}`).digest('hex');
}

export async function POST(req) {
  try {
    const { email, username } = await req.json();
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

    // Username availability, checked here with the Admin SDK (bypasses firestore.rules)
    // instead of on the client. The client used to run this same check itself via
    // getDocs() against /users straight from the browser, but that collection requires
    // request.auth != null to read — and at this point in signup the user has no auth
    // session yet (the Firebase Auth account isn't created until verify-otp succeeds).
    // That mismatch is exactly what produced the "Missing or insufficient permissions"
    // error on the sign-up screen; checking it server-side removes the need for any
    // unauthenticated Firestore read at all.
    if (username && typeof username === 'string' && username.trim()) {
      const usernameLower = username.toLowerCase().trim();
      const existing = await adminDb.collection('users').where('usernameLower', '==', usernameLower).limit(1).get();
      if (!existing.empty) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
      }
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

    // EmailJS's REST API rejects server-side (non-browser) calls unless a private key
    // ("accessToken") is supplied — the public key alone (user_id) is only accepted from
    // requests EmailJS can verify came from a real browser via Origin/Referer headers,
    // which this Next.js server route obviously doesn't have. Without EMAILJS_PRIVATE_KEY
    // set, EmailJS returns 403 "API calls are disabled for non-browser applications", which
    // is exactly what was surfacing to the user as "Failed to send verification email".
    const emailBody = {
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
    };
    if (process.env.EMAILJS_PRIVATE_KEY) {
      emailBody.accessToken = process.env.EMAILJS_PRIVATE_KEY;
    }

    const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: 'https://api.emailjs.com' },
      body: JSON.stringify(emailBody),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error('EmailJS send failed', emailRes.status, errBody);
      // Clean up the OTP doc we just wrote so a failed send doesn't leave a dangling,
      // unusable code blocking the next legitimate attempt for this email.
      await adminDb.collection('otps').doc(normalizedEmail).delete().catch(() => {});
      const hint = !process.env.EMAILJS_PRIVATE_KEY
        ? 'Failed to send verification email. (Missing EMAILJS_PRIVATE_KEY on the server \u2014 see env.example.)'
        : 'Failed to send verification email';
      return NextResponse.json({ error: hint }, { status: 502 });
    }

    return NextResponse.json({ ok: true, expiresAt });
  } catch (e) {
    console.error('send-otp error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
