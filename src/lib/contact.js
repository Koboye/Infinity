// The public contact address shown in the privacy policy and terms. Set NEXT_PUBLIC_CONTACT_EMAIL in Vercel (it is meant to be public;
// leave "Sensitive" off). Until it is set the pages say to use the contact details on the app-store listing.
export const CONTACT_EMAIL = (process.env.NEXT_PUBLIC_CONTACT_EMAIL || '').trim();
export const LEGAL_UPDATED = 'November 12, 2026';
