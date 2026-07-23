import React, { useState } from 'react';
import api from '../../api';

const Register = ({ apiUrl, setAuthView, showNotification }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/auth/register', {
        username,
        email,
        password
      });

      showNotification('success', 'Operator account registered successfully. Verification email dispatched.');
      setAuthView('login');
    } catch (error) {
      const errorDetail = error.response?.data?.detail || 'Operator registration failed.';
      showNotification('error', errorDetail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">
      <h3>Register Node Operator Profile</h3>
      <div className="form-group">
        <label>Operator Username</label>
        <input 
          type="text" 
          required 
          placeholder="Choose username" 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={loading}
        />
      </div>
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
      <div className="form-group">
        <label>Account Password</label>
        <input 
          type="password" 
          required 
          placeholder="Minimum 8 characters" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
      </div>
      <button type="submit" className="btn-auth-submit" disabled={loading}>
        {loading ? 'Registering Operator...' : 'Create Profile'}
      </button>
      <div className="auth-links">
        <span onClick={() => setAuthView('login')}>Return to Authentication</span>
      </div>
    </form>
  );
};

export default Register;
