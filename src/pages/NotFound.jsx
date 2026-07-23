import React from 'react';

const NotFound = () => {
  const goHome = () => {
    window.location.hash = '#overview';
  };

  return (
    <div className="empty-state glassmorphism" style={{ padding: '6rem 2rem', textAlign: 'center', marginTop: '2rem' }}>
      <div className="empty-icon" style={{ color: 'var(--accent-coral)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 style={{ fontSize: '2rem', marginBottom: '12px', color: 'var(--text-main)', fontWeight: 800 }}>404 - Page Not Found</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto', fontSize: '0.9rem' }}>
        The telemetry portal path or node key you requested does not exist or has been relocated.
      </p>
      <button 
        onClick={goHome} 
        className="btn-promote" 
        style={{ padding: '10px 24px', fontSize: '0.85rem', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        Return to Dashboard
      </button>
    </div>
  );
};

export default NotFound;
