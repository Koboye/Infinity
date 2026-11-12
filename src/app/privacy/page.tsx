import { CONTACT_EMAIL, LEGAL_UPDATED } from '@/lib/contact';

const link = { color: '#F2B632' } as const;
const h2 = { marginTop: 28, fontSize: '1.15rem', color: '#FFC52E' } as const;

export const metadata = { title: 'Privacy Policy · Afro Zone' };

export default function Privacy() {
  const contact = CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`} style={link}>{CONTACT_EMAIL}</a> : <>the contact details on our app store listing</>;
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 64px', color: '#F4E9CF', lineHeight: 1.65 }}>
      <h1>Privacy Policy</h1>
      <p><small>Afro Zone · last updated {LEGAL_UPDATED}</small></p>
      <p>This explains what Afro Zone collects, why, who can see it, and how you can delete it. Playing against the computer or on one device needs no account and stores nothing except your settings on your own device.</p>

      <h2 style={h2}>What we collect when you have an account</h2>
      <ul>
        <li><b>Sign-in details:</b> your email address, and either a password (handled by Google Firebase Authentication; we never see or store your password) or, if you use Google sign-in, your name, email and profile picture from Google.</li>
        <li><b>Profile:</b> your username, display name, avatar or profile photo, and language.</li>
        <li><b>Game data:</b> match results, rating, wins and losses, coins, progress and daily streaks.</li>
        <li><b>Friends:</b> your friend list, friend requests, and the people you block, mute or pin.</li>
        <li><b>Chats:</b> the messages you send, and any photos, voice notes and documents you attach.</li>
        <li><b>Online status:</b> whether you are online and when you were last seen.</li>
        <li><b>Live game data:</b> the room you are in, your moves, and, in car races, your car's position while racing.</li>
      </ul>

      <h2 style={h2}>Who can see it</h2>
      <ul>
        <li>Other signed-in players can see your username, display name, avatar or photo, rating, and online status. Your email address is never shown to other players.</li>
        <li>Your chat messages are visible only to you and the person you are chatting with.</li>
        <li>Files you send in a chat are stored with a long, unguessable web link. Anyone who has that link can open the file, so only share what you are comfortable sharing with your friend.</li>
      </ul>

      <h2 style={h2}>Camera, photos and microphone</h2>
      <p>The app asks for the microphone only when you record a voice note, and for the camera or your photos only when you choose to send or set a picture. It does not use them in the background.</p>

      <h2 style={h2}>Ads</h2>
      <p>The app shows short ads from local advertisers (for example events and banks): when the app opens, before a game starts, and, only if you choose to watch, to earn extra lucky spins. We count how many times each ad was shown and tapped, per ad and per day. We do not use an advertising ID, build an advertising profile, or share your personal data with advertisers. Tapping an ad opens the advertiser's own website, which has its own privacy policy.</p>

      <h2 style={h2}>What we do not do</h2>
      <p>We do not sell your data. The app does not include third-party analytics or tracking tools.</p>

      <h2 style={h2}>Where your data is stored</h2>
      <p>Your data is stored with Google Firebase (Authentication, Cloud Firestore and Cloud Storage), and the website is hosted by Vercel. These providers may process data in countries other than your own. Data is sent over encrypted connections, and database and file access rules restrict who can read or change it.</p>

      <h2 style={h2}>Deleting your account and data</h2>
      <p>You can delete your account yourself inside the app. This removes your profile, username, friend list, coins and progress, your online status, your uploaded files, and your conversations. Because a conversation belongs to two people, deleting it also removes it for the other person. Your sign-in account is deleted at the same time. You can also ask us to delete your data by contacting {contact}.</p>

      <h2 style={h2}>Children</h2>
      <p>Afro Zone is not designed for children under 13, and we do not knowingly collect their data. If you believe a child has created an account, contact {contact} and we will remove it.</p>

      <h2 style={h2}>Changes</h2>
      <p>If we change this policy we will update the date above. Continuing to use the app after a change means you accept the updated policy.</p>

      <h2 style={h2}>Contact</h2>
      <p>Questions or requests about your data: {contact}.</p>
      <p><a href="/terms" style={link}>Terms of Service</a> · <a href="/" style={link}>Back to the game</a></p>
    </main>
  );
}
