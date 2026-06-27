export default function PrivacyPage() {
  return (
    <div style={{ maxWidth:680, margin:'0 auto', padding:'40px 20px', color:'white', background:'#0a0a0a', minHeight:'100vh' }}>
      <h1 style={{ fontSize:28, fontWeight:800, marginBottom:8 }}>Privacy Policy</h1>
      <p style={{ color:'rgba(255,255,255,0.4)', marginBottom:32 }}>Last updated: June 2026</p>

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>1. Who we are</h2>
      <p style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:24 }}>
        Infinity (የትየለሌ) is a social video platform built for Ethiopia and the broader African community.
        We are operated by Infinity team and can be reached at infinityinfinityv1@gmail.com.
      </p>

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>2. What we collect</h2>
      <p style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:24 }}>
        We collect your email address, username, and profile information you provide when you sign up.
        We collect content you post including videos, images, and comments. We collect usage data
        such as videos you watch, like, or share, to improve your experience. We do not collect
        your phone number, physical address, or payment information.
      </p>

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>3. How we use your data</h2>
      <p style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:24 }}>
        Your data is used solely to operate Infinity — to show your content to followers,
        send notifications, personalize your feed, and keep the platform safe through content moderation.
        We never sell your personal data to third parties. We never use your data for advertising.
      </p>

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>4. Third-party services</h2>
      <p style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:24 }}>
        We use Firebase (Google) for authentication and database storage. We use Cloudinary
        for media (video and image) storage and delivery. These services have their own privacy
        policies and are bound by their respective data processing agreements with Google and
        Cloudinary Inc.
      </p>

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>5. Data retention</h2>
      <p style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:24 }}>
        Your account and content remain stored as long as your account is active. You may delete
        your account at any time by contacting us. Upon deletion we will remove your personal
        profile and content from our systems within 30 days.
      </p>

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>6. Your rights</h2>
      <p style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:24 }}>
        You have the right to access, correct, or delete your personal data at any time.
        To exercise these rights, contact us at the email below. We will respond within 14 days.
      </p>

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>7. Children</h2>
      <p style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:24 }}>
        Infinity is not intended for children under the age of 13. We do not knowingly collect
        data from anyone under 13. If you believe a child has registered, contact us immediately.
      </p>

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>8. Changes to this policy</h2>
      <p style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:24 }}>
        We may update this policy from time to time. We will notify registered users by email
        of any significant changes. Continued use of the app after changes means you accept
        the updated policy.
      </p>

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>9. Contact</h2>
      <p style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.7 }}>
        For any privacy questions or data requests, email us at:{' '}
        <a href="mailto:infinityinfinityv1@gmail.com" style={{ color:'#6B4EFF' }}>
          infinityinfinityv1@gmail.com
        </a>
      </p>
    </div>
  );
}
