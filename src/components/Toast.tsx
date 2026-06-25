'use client';
import { useUIStore } from '@/stores/uiStore';

const COLORS = { success: '#2ED573', error: '#FF2156', info: '#0A84FF', warning: '#FFB100' };
const ICONS = { success: '✓', error: '✕', warning: '!', info: 'i' };

export function ToastHost() {
  const toasts = useUIStore(s => s.toasts);
  const dismiss = useUIStore(s => s.dismissToast);
  return (
    <div style={{ position:'fixed', bottom:80, left:0, right:0, zIndex:9999, display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'0 16px', pointerEvents:'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents:'auto', display:'flex', alignItems:'center', gap:10, background:'rgba(15,15,15,0.97)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:999, padding:'10px 16px 10px 10px', maxWidth:'90vw', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:COLORS[t.variant], display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:14, flexShrink:0 }}>{ICONS[t.variant]}</div>
          <span style={{ fontSize:13, fontWeight:500, color:'white' }}>{t.message}</span>
          <button onClick={() => dismiss(t.id)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:14, marginLeft:4 }}>✕</button>
        </div>
      ))}
    </div>
  );
}
