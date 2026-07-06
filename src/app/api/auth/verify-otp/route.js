import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { rateLimit, clientIp } from '@/lib/rate-limit';

function hashOtp(otp, email) {
  const secret = process.env.OTP_HASH_SECRET || 'dev-only-fallback-secret-change-me';
  return createHash('sha256').update(`${otp}:${email.toLowerCase()}:${secret}`).digest('hex');
}

export async function POST(req) {
  try {
    const { email, otp, password, username, fullName, birthdate } = await req.json();

    if (!email || !otp || !password || !username || !fullName || !birthdate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const normalizedEmail = String(email).toLowerCase().trim();

    const ip = clientIp(req);
    const ipCheck = await rateLimit(`otp-verify-ip:${ip}`, 20, 60 * 60);
    if (!ipCheck.allowed) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    // Server-side age gate — never trust the client's own math here.
    const ageMs = Date.now() - new Date(birthdate).getTime();
    if (!Number.isFinite(ageMs) || ageMs < 13 * 365.25 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'You must be at least 13 years old to sign up' }, { status: 400 });
    }

    const otpRef = adminDb.collection('otps').doc(normalizedEmail);
    const otpSnap = await otpRef.get();
    if (!otpSnap.exists) {
      return NextResponse.json({ error: 'No verification code found. Request a new one.' }, { status: 400 });
    }
    const otpData = otpSnap.data();

    if (Date.now() > otpData.expiresAt) {
      await otpRef.delete();
      return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 400 });
    }
    if (otpData.attempts >= 5) {
      await otpRef.delete();
      return NextResponse.json({ error: 'Too many incorrect attempts. Request a new code.' }, { status: 429 });
    }
    if (hashOtp(String(otp).trim(), normalizedEmail) !== otpData.otpHash) {
      await otpRef.update({ attempts: otpData.attempts + 1 });
      return NextResponse.json({ error: 'Incorrect code' }, { status: 400 });
    }

    // OTP correct and single-use — burn it immediately so it can't be replayed.
    await otpRef.delete();

    const usernameLower = String(username).toLowerCase().trim();
    const existing = await adminDb.collection('users').where('usernameLower', '==', usernameLower).limit(1).get();
    if (!existing.empty) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: normalizedEmail,
        password,
        displayName: fullName,
        emailVerified: true, // OTP already proved control of the inbox
      });
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        return NextResponse.json({ error: 'This email is already registered. Please sign in instead.' }, { status: 409 });
      }
      if (e.code === 'auth/invalid-password') {
        return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
      }
      throw e;
    }

    // Clean up any stale unverified doc left from a previous abandoned signup with this
    // email. This now runs strictly AFTER adminAuth.createUser succeeds, not before.
    // Previously it ran first, which meant: if the email already belonged to a real,
    // active account, this deleted that person's Firestore profile doc and only THEN
    // discovered (via 'auth/email-already-exists' above) that it shouldn't have —
    // by which point the real user's profile was already gone. Reaching this line at
    // all now proves the email had no existing Auth account, so any doc still sitting
    // on it is genuinely orphaned and safe to remove.
    const staleEmail = await adminDb.collection('users').where('email', '==', normalizedEmail).limit(1).get();
    if (!staleEmail.empty) {
      await adminDb.collection('users').doc(staleEmail.docs[0].id).delete();
    }

    const now = Date.now();
    await adminDb.collection('users').doc(userRecord.uid).set({
      username,
      usernameLower,
      fullName,
      email: normalizedEmail,
      coins: 0,
      walletBalance: 0,
      followers: [],
      following: [],
      createdAt: now,
    });
    await adminDb.collection('users').doc(userRecord.uid).collection('private').doc('contact').set({
      birthdate,
    });

    const customToken = await adminAuth.createCustomToken(userRecord.uid);
    return NextResponse.json({ ok: true, customToken, uid: userRecord.uid });
  } catch (e) {
    console.error('verify-otp error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
