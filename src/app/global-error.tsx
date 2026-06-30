// src/app/global-error.tsx
'use client';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // ✅ Log to console (or your error monitoring service)
    console.error('🔥 Global error:', error);
    
    // ✅ Log to your error monitoring service
    // Example: Sentry
    // import * as Sentry from '@sentry/nextjs';
    // Sentry.captureException(error);
    
    // Example: Log to your own API
    // fetch('/api/log-error', {
    //   method: 'POST',
    //   body: JSON.stringify({
    //     message: error.message,
    //     stack: error.stack,
    //     digest: error.digest,
    //     url: window.location.href,
    //     userAgent: navigator.userAgent,
    //   }),
    // });
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: 24,
            textAlign: 'center',
            background: '#F8F7F4',
          }}
        >
          {/* Error Icon */}
          <div
            style={{
              fontSize: 64,
              marginBottom: 16,
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            😵
          </div>
          
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: '#1A1A1A',
              marginBottom: 8,
              letterSpacing: '-0.5px',
            }}
          >
            Something went wrong
          </h1>
          
          <p
            style={{
              color: '#6B7280',
              marginBottom: 24,
              maxWidth: 400,
              fontSize: 16,
              lineHeight: 1.6,
            }}
          >
            We're sorry, but something unexpected happened.
            Please try again or contact support if the problem persists.
          </p>
          
          {/* Error details (only in development) */}
          {process.env.NODE_ENV === 'development' && (
            <div
              style={{
                background: '#F3F4F6',
                padding: '16px 20px',
                borderRadius: 12,
                marginBottom: 24,
                maxWidth: 500,
                width: '100%',
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: 200,
                fontSize: 13,
                color: '#374151',
                fontFamily: 'monospace',
              }}
            >
              <strong>{error.name}</strong>: {error.message}
              {error.digest && (
                <div style={{ marginTop: 8, color: '#9CA3AF' }}>
                  Digest: {error.digest}
                </div>
              )}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={reset}
              style={{
                background: 'linear-gradient(135deg,#3D6B4F,#5A9A6F)',
                color: 'white',
                border: 'none',
                padding: '12px 32px',
                borderRadius: 12,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 15,
                transition: 'transform 0.15s, box-shadow 0.15s',
                boxShadow: '0 4px 16px rgba(61,107,79,0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Try again
            </button>
            
            <a
              href="/"
              style={{
                background: 'white',
                color: '#1A1A1A',
                border: '1px solid rgba(0,0,0,0.1)',
                padding: '12px 32px',
                borderRadius: 12,
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 15,
                textDecoration: 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#F8F7F4';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
              }}
            >
              Go home
            </a>
          </div>
          
          <p
            style={{
              marginTop: 32,
              fontSize: 13,
              color: '#9CA3AF',
            }}
          >
            Need help? Contact{' '}
            <a
              href="mailto:support@infinity.com"
              style={{
                color: '#3D6B4F',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              support@infinity.com
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
