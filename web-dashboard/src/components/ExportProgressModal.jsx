import React, { useState, useEffect } from 'react';

const ExportProgressModal = ({ isOpen, totalCount = 0, exportType = 'packets', isDone = false, error = null, onClose }) => {
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const totalRows = exportType === 'samples' ? totalCount * 80 : totalCount;
  const estimatedDuration = Math.max(1.2, Math.min(12, parseFloat((totalRows / 2500).toFixed(1))));

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      setTimeLeft(0);
      return;
    }

    setTimeLeft(estimatedDuration);
    setProgress(5);

    const startTime = Date.now();
    const durationMs = estimatedDuration * 1000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(95, Math.round((elapsed / durationMs) * 90) + 5);
      const remainingSec = Math.max(0, parseFloat(((durationMs - elapsed) / 1000).toFixed(1)));
      
      setTimeLeft(remainingSec);
      setProgress(pct);
    }, 80);

    return () => clearInterval(interval);
  }, [isOpen, totalCount, exportType, estimatedDuration]);

  useEffect(() => {
    if (isDone) {
      setProgress(100);
      setTimeLeft(0);
      const timer = setTimeout(() => {
        if (onClose) onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isDone, onClose]);

  if (!isOpen) return null;

  // SVG Circle Calculations (Radius = 46, Circumference ≈ 289)
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.72)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div className="glassmorphism" style={{
        width: '90%',
        maxWidth: '380px',
        padding: '2.25rem 1.75rem',
        borderRadius: '24px',
        border: '1px solid var(--card-border)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        textAlign: 'center',
        background: 'var(--card-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        
        {/* Circular Progress Ring */}
        <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '1.5rem' }}>
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background Circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke="var(--input-bg)"
              strokeWidth="7"
              fill="transparent"
            />
            {/* Animated Progress Circle */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke={error ? '#FF6B6B' : 'var(--accent-teal)'}
              strokeWidth="7"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              style={{
                transition: 'stroke-dashoffset 0.25s linear, stroke 0.3s ease'
              }}
            />
          </svg>

          {/* Center Content: Percentage number OR Green Tick Mark */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column'
          }}>
            {isDone ? (
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--accent-teal)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : error ? (
              <span style={{ color: '#FF6B6B', fontSize: '1.5rem', fontWeight: 700 }}>✕</span>
            ) : (
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {progress}%
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Title */}
        <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
          {isDone ? 'Export Complete!' : error ? 'Export Failed' : 'Downloading CSV...'}
        </h3>

        {/* Row Count Subtitle */}
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {exportType === 'samples' ? '3D Point Samples' : 'Packet Summaries'}
          {' • '}
          <strong style={{ color: 'var(--text-main)' }}>{totalRows.toLocaleString()} rows</strong>
        </p>

        {/* Time Remaining / Completion Status Badge */}
        <div style={{
          fontSize: '0.8rem',
          color: isDone ? 'var(--accent-teal)' : error ? '#FF6B6B' : 'var(--text-secondary)',
          background: isDone ? 'rgba(0, 210, 180, 0.1)' : 'var(--input-bg)',
          border: isDone ? '1px solid rgba(0, 210, 180, 0.25)' : '1px solid var(--card-border)',
          padding: '6px 14px',
          borderRadius: '20px',
          fontWeight: 600
        }}>
          {isDone ? '✓ File saved to downloads' : error ? error : `Est. time: ~${timeLeft}s`}
        </div>

      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes popIn {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ExportProgressModal;
