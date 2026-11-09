'use client';
// Route-level error boundary: a crash shows a friendly retry screen instead of Next's raw error page.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ minHeight:'100dvh',display:'grid',placeItems:'center',padding:24,background:'#072A1F',color:'#F4EBD0',textAlign:'center',fontFamily:'system-ui, sans-serif' }} role="alert">
      <div>
        <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong</h1>
        <p style={{ opacity: 0.8 }}>Your game is safe. Please try again.</p>
        <button style={{ marginTop:16,padding:'12px 24px',borderRadius:12,border:0,background:'#E8B53A',color:'#072A1F',fontWeight:700,fontSize:16,cursor:'pointer' }} onClick={() => reset()}>Try again</button>
        {error?.digest ? <p style={{ opacity: 0.5, fontSize: 12 }}>Ref: {error.digest}</p> : null}
      </div>
    </main>
  );
}
