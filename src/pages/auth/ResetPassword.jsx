import React, { useState } from 'react';
import api from '../../api';

const ResetPassword = ({ apiUrl, resetTokenVal, setResetTokenVal, setAuthView, showNotification }) => {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', {
        token: resetTokenVal,
        new_password: newPassword
      });
      showNotification('success', 'Access credentials updated successfully. Please authenticate.');
      setAuthView('login');
      setResetTokenVal('');
      setNewPassword('');
      // Clean URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      const errorDetail = error.response?.data?.detail || 'Failed to update access credentials.';
      showNotification('error', errorDetail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h3>Apply New Access Credentials</h3>
      <p className="auth-description">Enter the verification token and define your new access credentials below.</p>
      <div className="form-group">
        <label>Verification Token</label>
        <input 
          type="text" 
          required 
          placeholder="Token from email" 
          value={resetTokenVal}
          onChange={(e) => setResetTokenVal(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className="form-group">
        <label>New Account Password</label>
        <input 
          type="password" 
          required 
          placeholder="Minimum 8 characters" 
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={loading}
        />
      </div>
      <button type="submit" className="btn-auth-submit" disabled={loading}>
        {loading ? 'Applying Changes...' : 'Update Credentials'}
      </button>
      <div className="auth-links">
        <span onClick={() => setAuthView('login')}>Return to Authentication</span>
      </div>
    </form>
  );
};

export default ResetPassword;
