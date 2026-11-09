'use client';
// Last-resort boundary (errors in the root layout itself). Must render its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <main style={{ minHeight:'100dvh',display:'grid',placeItems:'center',padding:24,background:'#072A1F',color:'#F4EBD0',textAlign:'center',fontFamily:'system-ui, sans-serif' }} role="alert">
          <div>
            <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong</h1>
            <p style={{ opacity: 0.8 }}>Please reload the app.</p>
            <button style={{ marginTop:16,padding:'12px 24px',borderRadius:12,border:0,background:'#E8B53A',color:'#072A1F',fontWeight:700,fontSize:16,cursor:'pointer' }} onClick={() => reset()}>Reload</button>
            {error?.digest ? <p style={{ opacity: 0.5, fontSize: 12 }}>Ref: {error.digest}</p> : null}
          </div>
        </main>
      </body>
    </html>
  );
}
