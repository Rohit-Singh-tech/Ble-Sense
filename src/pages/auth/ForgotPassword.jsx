import React, { useState } from 'react';
import api from '../../api';

const ForgotPassword = ({ apiUrl, setAuthView, showNotification }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/auth/forgot-password', { email });
      showNotification('success', 'If the email address is registered, verification credentials have been dispatched.');
      setAuthView('login');
    } catch (error) {
      showNotification('error', 'Request execution failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h3>Recover Access Credentials</h3>
      <p className="auth-description">Enter your registered operator email address to receive credential recovery tokens.</p>
      <div className="form-group">
        <label>Operator Email Address</label>
        <input 
          type="email" 
          required 
          placeholder="name@institution.com" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>
      <button type="submit" className="btn-auth-submit" disabled={loading}>
        {loading ? 'Processing Request...' : 'Send Recovery Email'}
      </button>
      <div className="auth-links">
        <span onClick={() => setAuthView('login')}>Return to Authentication</span>
      </div>
    </form>
  );
};

export default ForgotPassword;
