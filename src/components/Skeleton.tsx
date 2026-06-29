export function Skeleton({ style }: { style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ borderRadius:8, ...style }} aria-hidden />;
}

export function VideoCardSkeleton() {
  return (
    <div style={{ position:'absolute', inset:0, background:'#15151C', display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <Skeleton style={{ width:44, height:44, borderRadius:'50%' }} />
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
          <Skeleton style={{ height:14, width:'50%' }} />
          <Skeleton style={{ height:12, width:'33%' }} />
        </div>
      </div>
      <Skeleton style={{ height:12, width:'80%', marginTop:14 }} />
      <Skeleton style={{ height:12, width:'60%', marginTop:8 }} />
    </div>
  );
}
