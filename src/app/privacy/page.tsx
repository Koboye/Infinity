export const metadata = { title: 'Privacy Policy — Infinity' };

const styles = {
  page: { minHeight: '100dvh', background: '#F7F5FC', color: '#1E1B2E', padding: '40px 20px', fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" },
  wrap: { maxWidth: 720, margin: '0 auto' },
  h1: { fontSize: 28, fontWeight: 800, marginBottom: 8 },
  updated: { color: 'rgba(30,27,46,0.5)', fontSize: 13, marginBottom: 28 },
  h2: { fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 10 },
  p: { fontSize: 14.5, lineHeight: 1.7, color: 'rgba(30,27,46,0.8)', marginBottom: 10 },
  li: { fontSize: 14.5, lineHeight: 1.7, color: 'rgba(30,27,46,0.8)', marginBottom: 6 },
  notice: { background: '#FFF7E8', border: '1px solid #F5D8A0', borderRadius: 14, padding: '14px 16px', fontSize: 13, lineHeight: 1.6, color: '#7A5B15', marginBottom: 28 },
} as const;

export default function PrivacyPage() {
  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <h1 style={styles.h1}>Privacy Policy</h1>
        <div style={styles.updated}>Last updated: [insert date before launch]</div>

        <div style={styles.notice}>
          This is a starting-point template reflecting the data this app actually
          collects and the third parties it actually uses. Have a lawyer review it
          against your real jurisdiction's requirements (e.g. GDPR, CCPA) before launch.
        </div>

        <h2 style={styles.h2}>1. What we collect</h2>
        <p style={styles.p}>When you create an account, we collect your email, username, full name, and date of birth. As you use the app, we collect the content you post, your profile info, follower/following relationships, messages, and basic usage data (likes, views, comments).</p>

        <h2 style={styles.h2}>2. Third parties we use</h2>
        <ul>
          <li style={styles.li}><strong>Firebase (Google)</strong> — authentication, database, and hosting for your account and content.</li>
          <li style={styles.li}><strong>Cloudinary</strong> — stores and serves uploaded photos, videos, and audio.</li>
          <li style={styles.li}><strong>EmailJS</strong> — sends verification codes and support emails on our behalf.</li>
        </ul>
        <p style={styles.p}>Each of these providers processes data under their own privacy policies as sub-processors acting on our instructions.</p>

        <h2 style={styles.h2}>3. How we use your data</h2>
        <p style={styles.p}>We use your data to operate core features (feed, messaging, notifications), verify your identity at signup, respond to support requests, and improve the app. We don't sell your personal data.</p>

        <h2 style={styles.h2}>4. What's private</h2>
        <p style={styles.p}>Your phone number and date of birth are stored separately from your public profile and are never shown to other users. Your public profile, posts, and follower lists are visible to other signed-in users by design, since the app is a social feed.</p>

        <h2 style={styles.h2}>5. Your choices</h2>
        <p style={styles.p}>You can edit or delete most of your data from Settings, including resetting your account's content or deleting your account entirely. Blocking a user prevents them from contacting you.</p>

        <h2 style={styles.h2}>6. Data retention</h2>
        <p style={styles.p}>We retain your data as long as your account is active. If you delete your account, your posts, comments, and personal data are removed, though some information may persist in backups for a limited period.</p>

        <h2 style={styles.h2}>7. Children's privacy</h2>
        <p style={styles.p}>Infinity is not intended for children under 13. We don't knowingly collect data from children under 13.</p>

        <h2 style={styles.h2}>8. Changes to this policy</h2>
        <p style={styles.p}>We may update this policy from time to time. We'll notify you of material changes.</p>

        <h2 style={styles.h2}>9. Contact</h2>
        <p style={styles.p}>Questions about your data? Reach out at [insert support email].</p>
      </div>
    </div>
  );
}
