export function ToastHost() {
  const toasts = useUIStore(s => s.toasts);
  const dismissToast = useUIStore(s => s.dismissToast);
  return (
    <div style={{ position:'fixed', top:60, left:0, right:0, zIndex:999, display:'flex', flexDirection:'column', alignItems:'center', gap:8, pointerEvents:'none' }}>
      {toasts.map(toast => {
        const c = COLORS[toast.variant] ?? COLORS.info;
        return (
          <div key={toast.id} onClick={() => dismissToast(toast.id)} style={{ background:c.bg, border:`1px solid ${c.border}`, borderRadius:14, padding:'10px 18px', display:'flex', alignItems:'center', gap:8, boxShadow:'0 4px 20px rgba(0,0,0,0.1)', maxWidth:320, pointerEvents:'auto', cursor:'pointer' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:c.dot }} />
            <span style={{ fontSize:14, fontWeight:600, color:c.text }}>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
