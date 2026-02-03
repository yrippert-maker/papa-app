'use client';

/**
 * Global Error Boundary
 * 
 * This catches errors that occur in the root layout.
 * It must include its own <html> and <body> tags.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f9fafb',
          fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{
            maxWidth: '400px',
            width: '100%',
            backgroundColor: 'white',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            borderRadius: '8px',
            padding: '32px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 16px',
              backgroundColor: '#fee2e2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <span style={{ fontSize: '24px' }}>!</span>
            </div>
            
            <h1 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '8px',
            }}>
              Критическая ошибка
            </h1>
            
            <p style={{
              color: '#6b7280',
              marginBottom: '24px',
            }}>
              {error.message || 'Произошла непредвиденная ошибка приложения.'}
            </p>
            
            {error.digest && (
              <p style={{
                fontSize: '12px',
                color: '#9ca3af',
                marginBottom: '16px',
              }}>
                Error ID: {error.digest}
              </p>
            )}
            
            <button
              onClick={() => reset()}
              style={{
                padding: '8px 16px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                marginRight: '8px',
              }}
            >
              Попробовать снова
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '8px 16px',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              На главную
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
