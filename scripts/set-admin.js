#!/usr/bin/env node
// Run locally (never deployed) to grant or revoke the admin custom claim.
// Usage:
//   node scripts/set-admin.js grant  someone@example.com
//   node scripts/set-admin.js revoke someone@example.com
//
// Requires the same FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
// service-account env vars as the server routes. This replaces the old hardcoded
// "if email === 'admin@x.com'" check — admin status is now a real, revocable claim
// enforced both in firestore.rules and in requireAdmin() on the server.

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
require('dotenv').config();

const [, , action, email] = process.argv;

if (!['grant', 'revoke'].includes(action) || !email) {
  console.error('Usage: node scripts/set-admin.js <grant|revoke> <email>');
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY in env.');
  process.exit(1);
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const auth = getAuth();

(async () => {
  const user = await auth.getUserByEmail(email);
  const claims = { ...(user.customClaims || {}) };

  if (action === 'grant') {
    claims.admin = true;
  } else {
    delete claims.admin;
  }

  await auth.setCustomUserClaims(user.uid, claims);
  console.log(`${action === 'grant' ? 'Granted' : 'Revoked'} admin for ${email} (uid: ${user.uid}).`);
  console.log('Note: the user must sign out and back in (or refresh their ID token) for this to take effect client-side.');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
