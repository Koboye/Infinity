export default function PrivacyPage() {
  return (
    <div style={{ maxWidth:600, margin:'0 auto', padding:'40px 20px', color:'white', background:'#0a0a0a', minHeight:'100vh' }}>
      <h1 style={{ fontSize:28, fontWeight:800, marginBottom:8 }}>Privacy Policy</h1>
      <p style={{ color:'rgba(255,255,255,0.4)', marginBottom:32 }}>Last updated: June 2025</p>

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>What we collect</h2>
      <p style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:24 }}>
        We collect your email address, username, and content you post (videos, images, comments).
        We also collect usage data to improve the app.
      </p>

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>How we use it</h2>
      <p style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:24 }}>
        Your data is used to operate DAGU, show your content to followers,
        and send you notifications. We never sell your data to third parties.
      </p>

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Third party services</h2>
      <p style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.7, marginBottom:24 }}>
        We use Firebase (Google) for authentication and database,
        and Cloudinary for media storage.
      </p>

      <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8 }}>Contact</h2>
      <p style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.7 }}>
        For any privacy questions email us at getachewshambel11@gmail.com
      </p>
    </div>
  );
}
