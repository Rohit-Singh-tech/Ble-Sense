import React, { useState } from 'react';
import api from '../../api';

const Login = ({ apiUrl, onLoginSuccess, setAuthView, showNotification }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal State
  const [showResendModal, setShowResendModal] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState(null); // null, 'not_verified', 'verified', 'not_found'
  const [lastSentTime, setLastSentTime] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('username', username);
      params.append('password', password);

      const response = await api.post('/api/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const userToken = response.data.access_token;
      onLoginSuccess(userToken);
      showNotification('success', 'Authentication successful.');
    } catch (error) {
      const errorDetail = error.response?.data?.detail || 'Authentication failed. Please verify credentials.';
      showNotification('error', errorDetail);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async (e) => {
    e.preventDefault();
    if (!resendEmail.trim()) {
      showNotification('error', 'Please enter a valid email address.');
      return;
    }
    setStatusLoading(true);
    setVerificationStatus(null);
    console.log(`[AXIOS DEBUG] Requesting verification-status for email: ${resendEmail.trim()}`);
    try {
      const response = await api.get('/api/auth/verification-status', {
        params: { email: resendEmail.trim() }
      });
      console.log(`[AXIOS DEBUG] Verification status response received:`, response.data);
      if (response.data.is_verified) {
        setVerificationStatus('verified');
      } else {
        setVerificationStatus('not_verified');
        setLastSentTime(response.data.verification_sent_at);
      }
    } catch (error) {
      console.error(`[AXIOS ERROR] Verification status retrieval failed:`, error);
      if (error.response) {
        console.error(`[AXIOS ERROR STATUS]: ${error.response.status}`);
        console.error(`[AXIOS ERROR DATA]:`, error.response.data);
      }
      
      const status = error.response?.status;
      if (status === 404) {
        setVerificationStatus('not_found');
      } else {
        const errorDetail = error.response?.data?.detail || 'Failed to retrieve email verification status.';
        showNotification('error', errorDetail);
      }
    } finally {
      setStatusLoading(false);
    }
  };

  const handleTriggerResend = async () => {
    setStatusLoading(true);
    console.log(`[AXIOS DEBUG] Triggering resend-verification for email: ${resendEmail.trim()}`);
    try {
      const response = await api.post('/api/auth/resend-verification', { email: resendEmail.trim() });
      console.log(`[AXIOS DEBUG] Resend verification response received:`, response.data);
      showNotification('success', `A new verification email has been sent to ${resendEmail}.`);
      setShowResendModal(false);
      setResendEmail('');
      setVerificationStatus(null);
    } catch (error) {
      console.error(`[AXIOS ERROR] Resend verification failed:`, error);
      if (error.response) {
        console.error(`[AXIOS ERROR STATUS]: ${error.response.status}`);
        console.error(`[AXIOS ERROR DATA]:`, error.response.data);
      }
      const errorDetail = error.response?.data?.detail || 'Failed to resend verification email.';
      showNotification('error', errorDetail);
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="auth-form">
        <h3>Authorization</h3>
        <div className="form-group">
          <label>User Credentials (Username / Email)</label>
          <input 
            type="text" 
            required 
            placeholder="Enter username or email" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label>Account Password</label>
          <input 
            type="password" 
            required 
            placeholder="••••••••" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>
        <button type="submit" className="btn-auth-submit" disabled={loading}>
          {loading ? 'Authenticating...' : 'Authenticate'}
        </button>
        <div className="auth-links" style={{ flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '15px' }}>
            <span onClick={() => setAuthView('register')}>Register Operator</span>
            <span onClick={() => setAuthView('forgot-password')}>Recover Credentials</span>
          </div>
          <span 
            onClick={() => {
              setShowResendModal(true);
              setResendEmail('');
              setVerificationStatus(null);
            }} 
            style={{ fontSize: '0.78rem', color: 'var(--accent-teal)', cursor: 'pointer', borderBottom: '1px dashed var(--accent-teal)' }}
          >
            Resend Verification Link
          </span>
        </div>
      </form>

      {/* Resend Verification Modal Dialog */}
      {showResendModal && (
        <div className="modal-overlay" onClick={() => setShowResendModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px', background: 'var(--bg-sidebar)' }}>
            <header className="modal-header">
              <h2>Resend Verification</h2>
              <button className="close-btn" onClick={() => setShowResendModal(false)}>&times;</button>
            </header>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '1.5rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Enter your registered operator email to check verification status and request a new link.
              </p>
              
              <form onSubmit={handleCheckStatus} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="email"
                  required
                  placeholder="operator@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  disabled={statusLoading}
                  style={{
                    flex: 1,
                    background: 'var(--input-bg)',
                    color: 'white',
                    border: '1px solid var(--card-border)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}
                />
                <button
                  type="submit"
                  disabled={statusLoading}
                  className="btn-promote"
                  style={{ padding: '8px 16px', margin: 0 }}
                >
                  {statusLoading ? 'Checking...' : 'Check'}
                </button>
              </form>

              {verificationStatus === 'verified' && (
                <div style={{ background: 'rgba(76,175,80,0.1)', border: '1px solid var(--success)', padding: '15px', borderRadius: '10px', color: 'var(--success)', fontSize: '0.82rem' }}>
                  <strong>✓ Already Verified</strong>
                  <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)' }}>This email is already verified. You can log in normally.</p>
                </div>
              )}

              {verificationStatus === 'not_found' && (
                <div style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid var(--danger)', padding: '15px', borderRadius: '10px', color: 'var(--danger)', fontSize: '0.82rem' }}>
                  <strong>❌ Account Not Found</strong>
                  <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)' }}>No registered account exists with this email address.</p>
                </div>
              )}

              {verificationStatus === 'not_verified' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ background: 'rgba(255,198,88,0.06)', border: '1px solid #ffc658', padding: '15px', borderRadius: '10px', fontSize: '0.82rem', color: '#ffc658' }}>
                    <strong>Last verification was sent:</strong>
                    <div style={{ margin: '4px 0 8px', fontWeight: 800, fontSize: '0.9rem', color: '#fff' }}>
                      {lastSentTime ? new Date(lastSentTime).toLocaleString() : 'Never'}
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: '1.4' }}>
                      ⚠️ <strong>Note</strong>: Requesting a new verification link will disable all previously sent links. Only the new one will be valid.
                    </p>
                  </div>
                  
                  <button
                    onClick={handleTriggerResend}
                    disabled={statusLoading}
                    className="btn-primary"
                    style={{ width: '100%', padding: '10px', justifyContent: 'center' }}
                  >
                    {statusLoading ? 'Resending Link...' : 'Send New Link'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Login;
