import React from 'react';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui', textAlign: 'center' }}>
      <h2 style={{ marginBottom: 8 }}>404 — Page not found</h2>
      <p style={{ color: '#666', marginBottom: 16 }}>
        The requested page does not exist or has been moved.
      </p>
      <Link to="/days" style={{ color: '#1976d2' }}>
        ← Back to Evidence
      </Link>
    </div>
  );
}
