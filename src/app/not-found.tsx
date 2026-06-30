// src/app/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 24,
      textAlign: 'center',
      background: '#F8F7F4',
    }}>
      <div style={{ fontSize: 80, marginBottom: 16 }}>🔍</div>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: '#1A1A1A' }}>Page not found</h1>
      <p style={{ color: '#6B7280', marginBottom: 24 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        href="/"
        style={{
          background: 'linear-gradient(135deg,#3D6B4F,#5A9A6F)',
          color: 'white',
          padding: '12px 32px',
          borderRadius: 12,
          textDecoration: 'none',
          fontWeight: 600,
        }}
      >
        Go home
      </Link>
    </div>
  );
}
