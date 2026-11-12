import { CONTACT_EMAIL, LEGAL_UPDATED } from '@/lib/contact';

const link = { color: '#F2B632' } as const;
const h2 = { marginTop: 28, fontSize: '1.15rem', color: '#FFC52E' } as const;

export const metadata = { title: 'Terms of Service · Afro Zone' };

export default function Terms() {
  const contact = CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`} style={link}>{CONTACT_EMAIL}</a> : <>the contact details on our app store listing</>;
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 64px', color: '#F4E9CF', lineHeight: 1.65 }}>
      <h1>Terms of Service</h1>
      <p><small>Afro Zone · last updated {LEGAL_UPDATED}</small></p>
      <p>By using Afro Zone you agree to these terms. If you do not agree, please do not use the app.</p>

      <h2 style={h2}>Who can use it</h2>
      <p>You must be at least 13 years old, or older if the law where you live requires it. You are responsible for keeping your sign-in details safe and for what happens under your account.</p>

      <h2 style={h2}>Play fair and be kind</h2>
      <p>Choose a username and display name that are not offensive and do not pretend to be someone else. Do not cheat, use bots or exploits, harass or threaten other players, spam, or try to break or overload the service or other people's accounts.</p>

      <h2 style={h2}>What you send</h2>
      <p>You are responsible for the messages, photos, voice notes and documents you send. Do not send anything illegal, abusive, sexual, hateful, or that you do not have the right to share. You keep ownership of your content, and you allow the app to store and deliver it to the people you send it to so the chat works.</p>

      <h2 style={h2}>Coins and rewards</h2>
      <p>Coins, spins and rewards are part of the game. They have no cash value, cannot be exchanged for money, and cannot be transferred between accounts. We may adjust them to fix errors or abuse.</p>

      <h2 style={h2}>Ads</h2>
      <p>The app shows ads from local advertisers. Advertisers' websites and offers are theirs, not ours, and have their own terms.</p>

      <h2 style={h2}>Suspending or removing accounts</h2>
      <p>We may warn, limit or remove accounts that break these terms, cheat, or harm other players. You can stop using Afro Zone and delete your account at any time inside the app; see the <a href="/privacy" style={link}>Privacy Policy</a> for what is deleted.</p>

      <h2 style={h2}>The service as it is</h2>
      <p>Afro Zone is provided as is. We try to keep it running and fair, but we cannot promise it will always be available, error-free or that online matches will never be interrupted. To the extent the law allows, we are not liable for losses that result from using or being unable to use the app.</p>

      <h2 style={h2}>Changes</h2>
      <p>We may update these terms and will change the date above when we do. Continuing to use the app after a change means you accept the new terms.</p>

      <h2 style={h2}>Contact</h2>
      <p>Questions about these terms: {contact}.</p>
      <p><a href="/privacy" style={link}>Privacy Policy</a> · <a href="/" style={link}>Back to the game</a></p>
    </main>
  );
}
