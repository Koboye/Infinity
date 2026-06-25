'use client';
export function InboxScreen() {
  return (
    <div style={{ height:'100%', background:'#0B0B0F', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:16, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <h1 style={{ fontSize:22, fontWeight:900 }}>Inbox</h1>
      </div>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:24, textAlign:'center' }}>
        <div style={{ padding:16, borderRadius:16, background:'rgba(10,132,255,0.08)', border:'1px solid rgba(10,132,255,0.2)', marginBottom:8, textAlign:'left', width:'100%', maxWidth:340 }}>
          <div style={{ fontWeight:700, color:'#0A84FF', marginBottom:4 }}>✨ Smart replies available</div>
          <p style={{ fontSize:13, color:'rgba(255,255,255,0.6)', margin:0, lineHeight:1.5 }}>AI-generated reply suggestions activate automatically when you open any chat — similar to Gmail Smart Reply but for social messages.</p>
        </div>
        <div style={{ fontSize:48, marginTop:16 }}>💬</div>
        <h3 style={{ fontSize:18, fontWeight:700 }}>No conversations yet</h3>
        <p style={{ fontSize:13, color:'rgba(255,255,255,0.4)', maxWidth:280 }}>Your chats will appear here. Follow people and start messaging them from their profile.</p>
      </div>
    </div>
  );
}
