// src/app/loading.tsx
export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#F8F7F4',
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: '4px solid rgba(61,107,79,0.1)',
        borderTopColor: '#3D6B4F',
        animation: 'spin 1s linear infinite',
      }} />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
