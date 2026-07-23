import React, { useState } from 'react';
import api from '../api';

const Settings = ({ apiUrl, token, showNotification }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/users/change-password', 
        { old_password: oldPassword, new_password: newPassword }
      );
      showNotification('success', 'User password updated successfully.');
      setOldPassword('');
      setNewPassword('');
    } catch (error) {
      const errorDetail = error.response?.data?.detail || 'Failed to update user password.';
      showNotification('error', errorDetail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-view-grid">
      {/* Account Settings */}
      <div className="settings-card glassmorphism">
        <h3>Update User Password</h3>
        <form onSubmit={handleChangePassword} className="settings-form">
          <div className="form-group">
            <label>Current Account Password</label>
            <input 
              type="password" 
              required 
              placeholder="••••••••" 
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
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
          <button type="submit" className="btn-settings-save" disabled={loading}>
            {loading ? 'Updating...' : 'Save Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
