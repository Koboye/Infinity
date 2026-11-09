import Link from 'next/link';
export default function NotFound() {
  return (
    <main style={{ minHeight:'100dvh',display:'grid',placeItems:'center',padding:24,background:'#072A1F',color:'#F4EBD0',textAlign:'center',fontFamily:'system-ui, sans-serif' }}>
      <div>
        <h1 style={{ fontSize: 24, margin: 0 }}>Page not found</h1>
        <p style={{ opacity: 0.8 }}>That page does not exist.</p>
        <Link href="/" style={{ marginTop:16,padding:'12px 24px',borderRadius:12,border:0,background:'#E8B53A',color:'#072A1F',fontWeight:700,fontSize:16,cursor:'pointer', display: 'inline-block', textDecoration: 'none' }}>Back to games</Link>
      </div>
    </main>
  );
}
