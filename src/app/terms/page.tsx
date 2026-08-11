export const metadata = { title: 'Terms of Service — Infinity' };

const styles = {
  page: { minHeight: '100dvh', background: '#F7F5FC', color: '#1E1B2E', padding: '40px 20px', fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" },
  wrap: { maxWidth: 720, margin: '0 auto' },
  h1: { fontSize: 28, fontWeight: 800, marginBottom: 8 },
  updated: { color: 'rgba(30,27,46,0.5)', fontSize: 13, marginBottom: 28 },
  h2: { fontSize: 18, fontWeight: 700, marginTop: 28, marginBottom: 10 },
  p: { fontSize: 14.5, lineHeight: 1.7, color: 'rgba(30,27,46,0.8)', marginBottom: 10 },
  notice: { background: '#FFF7E8', border: '1px solid #F5D8A0', borderRadius: 14, padding: '14px 16px', fontSize: 13, lineHeight: 1.6, color: '#7A5B15', marginBottom: 28 },
} as const;

export default function TermsPage() {
  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <h1 style={styles.h1}>Terms of Service</h1>
        <div style={styles.updated}>Last updated: [insert date before launch]</div>

        <div style={styles.notice}>
          This is a starting-point template, not final legal advice. Have a lawyer
          review and localize it (especially the sections on data, minors, and
          liability) for your actual jurisdiction and business before you launch.
        </div>

        <h2 style={styles.h2}>1. Acceptance of terms</h2>
        <p style={styles.p}>By creating an account or using Infinity ("the app", "we", "us"), you agree to these Terms of Service and our Privacy Policy. If you don't agree, please don't use the app.</p>

        <h2 style={styles.h2}>2. Eligibility</h2>
        <p style={styles.p}>You must be at least 13 years old to use Infinity. If you're under 18, you confirm you have a parent or guardian's permission to use the app.</p>

        <h2 style={styles.h2}>3. Your account</h2>
        <p style={styles.p}>You're responsible for the activity on your account and for keeping your login credentials secure. Let us know right away if you believe your account has been compromised.</p>

        <h2 style={styles.h2}>4. Your content</h2>
        <p style={styles.p}>You retain ownership of what you post. By posting content, you grant Infinity a non-exclusive, worldwide, royalty-free license to host, store, reproduce, and display it as needed to operate and improve the app. You're responsible for having the rights to anything you upload.</p>

        <h2 style={styles.h2}>5. Acceptable use</h2>
        <p style={styles.p}>You agree not to use Infinity to harass or abuse others, post illegal content, impersonate someone else, distribute malware, or attempt to disrupt or reverse-engineer the service. We may remove content or suspend accounts that violate these rules.</p>

        <h2 style={styles.h2}>6. In-app coins and purchases</h2>
        <p style={styles.p}>Coins and any in-app balances are a virtual item for use within the app and have no cash value outside of it unless explicitly stated. Purchases, where enabled, are subject to the payment provider's own terms.</p>

        <h2 style={styles.h2}>7. Termination</h2>
        <p style={styles.p}>You can delete your account at any time from Settings. We may suspend or terminate accounts that violate these terms or applicable law.</p>

        <h2 style={styles.h2}>8. Disclaimers &amp; liability</h2>
        <p style={styles.p}>Infinity is provided "as is" without warranties of any kind. To the fullest extent permitted by law, we aren't liable for indirect, incidental, or consequential damages arising from your use of the app.</p>

        <h2 style={styles.h2}>9. Changes to these terms</h2>
        <p style={styles.p}>We may update these terms from time to time. We'll let you know about material changes, and continued use of the app after a change means you accept the updated terms.</p>

        <h2 style={styles.h2}>10. Contact</h2>
        <p style={styles.p}>Questions about these terms? Reach out at [insert support email].</p>
      </div>
    </div>
  );
}
