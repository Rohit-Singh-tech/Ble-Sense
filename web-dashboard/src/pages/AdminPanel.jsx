import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';

const DEFAULT_BOVINE_TAGS = {
  "11": { name: "Bovine #11", breed: "Murrah Buffalo", location: "Barn Sector A", weight: "480 kg", notes: "Lactation study subject A" },
  "42": { name: "Bovine #42", breed: "Holstein Cow", location: "Barn Sector B", weight: "620 kg", notes: "Milk yield telemetry group 1" },
  "89": { name: "Bovine #89", breed: "Jersey Cow", location: "Barn Sector B", weight: "510 kg", notes: "High fat content test cow" },
  "93": { name: "Bovine #93", breed: "Sahiwal Cow", location: "Barn Sector A", weight: "430 kg", notes: "Native heat tolerance study" },
  "248": { name: "Bovine #248", breed: "Nili-Ravi Buffalo", location: "Pasture Sector C", weight: "550 kg", notes: "Grazing behavior tracking collar" }
};

const AdminPanel = ({ apiUrl, token, user, showNotification }) => {
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'tags'
  const [allUsers, setAllUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);

  // Bovine Registry State
  const [bovineTags, setBovineTags] = useState(() => {
    const saved = localStorage.getItem('bovine_tags');
    return saved ? JSON.parse(saved) : DEFAULT_BOVINE_TAGS;
  });
  const [editingKey, setEditingKey] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', breed: '', location: '', weight: '', notes: '' });

  // Add Device Form State
  const [newDeviceForm, setNewDeviceForm] = useState({ id: '', name: '', breed: '', location: '', weight: '', notes: '' });

  // Tab 1 User Filter/Sort/Page State
  const [userSearch, setUserSearch] = useState('');
  const [userSortField, setUserSortField] = useState('username'); // 'username', 'email'
  const [userSortOrder, setUserSortOrder] = useState('asc'); // 'asc', 'desc'
  const [userPage, setUserPage] = useState(1);
  const usersPerPage = 5;

  // Tab 2 Tag Filter/Sort/Page State
  const [tagSearch, setTagSearch] = useState('');
  const [tagSortField, setTagSortField] = useState('key'); // 'key', 'name', 'breed'
  const [tagSortOrder, setTagSortOrder] = useState('asc'); // 'asc', 'desc'
  const [tagPage, setTagPage] = useState(1);
  const tagsPerPage = 5;

  const fetchAllUsers = async () => {
    if (!token || !user?.is_superuser) return;
    try {
      setAdminLoading(true);
      const response = await api.get('/api/users/');
      setAllUsers(response.data);
    } catch (error) {
      showNotification('error', 'Failed to retrieve user directory.');
    } finally {
      setAdminLoading(false);
    }
  };
  const handlePromoteAdmin = async (userId) => {
    try {
      await api.post(`/api/users/${userId}/promote`, {});
      showNotification('success', 'User access level updated to Administrator.');
      fetchAllUsers();
    } catch (error) {
      const errorDetail = error.response?.data?.detail || 'Failed to update user privilege level.';
      showNotification('error', errorDetail);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${username}"?`)) {
      return;
    }
    try {
      await api.delete(`/api/users/${userId}`);
      showNotification('success', `User "${username}" has been deleted.`);
      fetchAllUsers();
    } catch (error) {
      const errorDetail = error.response?.data?.detail || 'Failed to delete user.';
      showNotification('error', errorDetail);
    }
  };

  const handleResendVerification = async (email, lastSent) => {
    const formattedTime = lastSent ? new Date(lastSent).toLocaleString() : 'Never';
    if (!window.confirm(`Last verification email was sent: ${formattedTime}.\n\nAre you sure you want to send a new verification link? All previous verification links will be disabled and become invalid.`)) {
      return;
    }
    try {
      await api.post('/api/auth/resend-verification', { email });
      showNotification('success', `Verification link resent successfully to ${email}.`);
      fetchAllUsers();
    } catch (error) {
      const errorDetail = error.response?.data?.detail || 'Failed to resend verification link.';
      showNotification('error', errorDetail);
    }
  };

  const handleSaveBovine = (key) => {
    const updated = { ...bovineTags, [key]: { ...editForm } };
    setBovineTags(updated);
    localStorage.setItem('bovine_tags', JSON.stringify(updated));
    setEditingKey(null);
    showNotification('success', `Subject tag #${key} updated successfully.`);
  };

  const startEditing = (key, data) => {
    setEditingKey(key);
    setEditForm({ ...data });
  };

  const handleAddNewDevice = () => {
    const devId = newDeviceForm.id.trim();
    if (!devId) {
      showNotification('error', 'Device ID is required.');
      return;
    }
    if (bovineTags[devId]) {
      showNotification('error', `Device ID #${devId} is already registered.`);
      return;
    }

    const updated = {
      ...bovineTags,
      [devId]: {
        name: newDeviceForm.name.trim() || `Bovine #${devId}`,
        breed: newDeviceForm.breed.trim() || 'Unknown',
        location: newDeviceForm.location.trim() || 'Unknown',
        weight: newDeviceForm.weight.trim() || '--',
        notes: newDeviceForm.notes.trim() || ''
      }
    };

    setBovineTags(updated);
    localStorage.setItem('bovine_tags', JSON.stringify(updated));
    setNewDeviceForm({ id: '', name: '', breed: '', location: '', weight: '', notes: '' });
    showNotification('success', `Device ID #${devId} added to registry.`);
  };

  // Reset page indices on filters
  useEffect(() => {
    setUserPage(1);
  }, [userSearch, userSortField, userSortOrder]);

  useEffect(() => {
    setTagPage(1);
  }, [tagSearch, tagSortField, tagSortOrder]);

  // Tab 1 User Filter/Sort Logic
  const filteredUsers = useMemo(() => {
    let result = [...allUsers];
    if (userSearch.trim()) {
      const query = userSearch.trim().toLowerCase();
      result = result.filter(u => 
        (u.username || '').toLowerCase().includes(query) || 
        (u.email || '').toLowerCase().includes(query)
      );
    }
    result.sort((a, b) => {
      let valA = String(a[userSortField] || '').toLowerCase();
      let valB = String(b[userSortField] || '').toLowerCase();
      if (valA < valB) return userSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return userSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [allUsers, userSearch, userSortField, userSortOrder]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (userPage - 1) * usersPerPage;
    return filteredUsers.slice(startIndex, startIndex + usersPerPage);
  }, [filteredUsers, userPage]);

  const totalUserPages = Math.ceil(filteredUsers.length / usersPerPage) || 1;

  // Tab 2 Tag Filter/Sort Logic
  const filteredTags = useMemo(() => {
    let result = Object.entries(bovineTags).map(([key, data]) => ({ key, ...data }));
    if (tagSearch.trim()) {
      const query = tagSearch.trim().toLowerCase();
      result = result.filter(t => 
        t.key.toLowerCase().includes(query) || 
        t.name.toLowerCase().includes(query) || 
        t.breed.toLowerCase().includes(query) ||
        t.location.toLowerCase().includes(query)
      );
    }
    result.sort((a, b) => {
      let valA = String(a[tagSortField] || '').toLowerCase();
      let valB = String(b[tagSortField] || '').toLowerCase();
      if (tagSortField === 'key') {
        const numA = parseInt(a.key, 10);
        const numB = parseInt(b.key, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return tagSortOrder === 'asc' ? numA - numB : numB - numA;
        }
      }
      if (valA < valB) return tagSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return tagSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [bovineTags, tagSearch, tagSortField, tagSortOrder]);

  const paginatedTags = useMemo(() => {
    const startIndex = (tagPage - 1) * tagsPerPage;
    return filteredTags.slice(startIndex, startIndex + tagsPerPage);
  }, [filteredTags, tagPage]);

  const totalTagPages = Math.ceil(filteredTags.length / tagsPerPage) || 1;

  useEffect(() => {
    if (token && user?.is_superuser && activeTab === 'users') {
      fetchAllUsers();
    }
  }, [token, apiUrl, user, activeTab]);

  if (!user?.is_superuser) {
    return <div style={{ color: 'red', padding: '2rem' }}>Access Denied. Administrative rights required.</div>;
  }

  return (
    <div className="admin-view glassmorphism" style={{ padding: '2rem' }}>
      
      {/* Scientist Tabs Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--card-border)', marginBottom: '1.5rem', gap: '15px' }}>
        <button 
          onClick={() => setActiveTab('users')} 
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'users' ? 'var(--accent-teal)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'users' ? '3px solid var(--accent-teal)' : '3px solid transparent',
            padding: '10px 15px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.9rem'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Access
          </span>
        </button>
        <button 
          onClick={() => setActiveTab('tags')} 
          style={{
            background: 'none',
            border: 'none',
            color: activeTab === 'tags' ? 'var(--accent-teal)' : 'var(--text-secondary)',
            borderBottom: activeTab === 'tags' ? '3px solid var(--accent-teal)' : '3px solid transparent',
            padding: '10px 15px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.9rem'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            Registry
          </span>
        </button>
      </div>

      {/* Tab 1: Access Controls */}
      {activeTab === 'users' && (
        <div>
          <div className="section-header" style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'stretch', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Operators</h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Manage privileges</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sort:</span>
                <select 
                  value={userSortField}
                  onChange={(e) => setUserSortField(e.target.value)}
                  style={{ background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}
                >
                  <option value="username">Username</option>
                  <option value="email">Email</option>
                </select>
                <button 
                  onClick={() => setUserSortOrder(userSortOrder === 'asc' ? 'desc' : 'asc')}
                  style={{ background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  {userSortOrder === 'asc' ? '▲ Asc' : '▼ Desc'}
                </button>
                <button onClick={fetchAllUsers} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                  Refresh
                </button>
              </div>
            </div>

            {/* Filter Search */}
            <div style={{ display: 'flex', background: 'var(--input-bg)', padding: '10px 15px', borderRadius: '10px', border: '1px solid var(--card-border)', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Filter:</span>
              <input 
                type="text" 
                placeholder="Search..." 
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                style={{ flex: 1, background: 'var(--bg-base)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}
              />
            </div>
          </div>
          
          {adminLoading ? (
            <div className="telemetry-loading">
              <div className="loader"></div>
              <p>Loading directory...</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>USER</th>
                    <th>EMAIL</th>
                    <th>STATUS</th>
                    <th>ROLE</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map(u => (
                    <tr key={u.id}>
                      <td>{u.id}</td>
                      <td style={{ fontWeight: 600 }}>{u.username}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`status-badge-mini ${u.is_active ? 'active' : 'inactive'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className={`status-badge-mini ${u.is_verified ? 'verified' : 'unverified'}`} style={{ marginLeft: '5px' }}>
                          {u.is_verified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td>
                        <span className={`role-badge ${u.is_superuser ? 'admin' : 'operator'}`}>
                          {u.is_superuser ? 'Admin' : 'Operator'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {!u.is_superuser && (
                            <button
                              onClick={() => handlePromoteAdmin(u.id)}
                              className="btn-promote"
                              style={{ padding: '5px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                            >
                              Grant Admin
                            </button>
                          )}
                          {!u.is_verified && (
                            <button
                              onClick={() => handleResendVerification(u.email, u.verification_sent_at)}
                              className="btn-promote"
                              style={{ padding: '5px 10px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(255, 198, 88, 0.1)', color: '#ffc658', border: '1px solid rgba(255, 198, 88, 0.3)' }}
                            >
                              Resend Verification
                            </button>
                          )}
                          {u.id !== user.id ? (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="btn-danger"
                              style={{ padding: '5px 10px', fontSize: '0.75rem', borderRadius: '6px', margin: 0 }}
                            >
                              Delete
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>System (You)</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* User Pagination Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', padding: '0 10px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Page <strong>{userPage}</strong> of <strong>{totalUserPages}</strong> (Showing {filteredUsers.length === 0 ? 0 : (userPage - 1) * usersPerPage + 1} to {Math.min(userPage * usersPerPage, filteredUsers.length)} of {filteredUsers.length} users)
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    disabled={userPage === 1}
                    onClick={() => setUserPage(prev => Math.max(prev - 1, 1))}
                    style={{
                      background: userPage === 1 ? 'rgba(255,255,255,0.02)' : 'var(--input-bg)',
                      color: userPage === 1 ? 'rgba(255,255,255,0.2)' : 'var(--text-main)',
                      border: '1px solid var(--card-border)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: userPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    Previous
                  </button>
                  <button
                    disabled={userPage === totalUserPages}
                    onClick={() => setUserPage(prev => Math.min(prev + 1, totalUserPages))}
                    style={{
                      background: userPage === totalUserPages ? 'rgba(255,255,255,0.02)' : 'var(--input-bg)',
                      color: userPage === totalUserPages ? 'rgba(255,255,255,0.2)' : 'var(--text-main)',
                      border: '1px solid var(--card-border)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      cursor: userPage === totalUserPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Tag Registry */}
      {activeTab === 'tags' && (
        <div>
          <div className="section-header" style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'stretch', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Tags</h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Telemetry keys</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sort:</span>
                <select 
                  value={tagSortField}
                  onChange={(e) => setTagSortField(e.target.value)}
                  style={{ background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}
                >
                  <option value="key">Collar ID</option>
                  <option value="name">Subject Name</option>
                  <option value="breed">Breed</option>
                </select>
                <button 
                  onClick={() => setTagSortOrder(tagSortOrder === 'asc' ? 'desc' : 'asc')}
                  style={{ background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  {tagSortOrder === 'asc' ? '▲ Asc' : '▼ Desc'}
                </button>
              </div>
            </div>

            {/* Filter Search */}
            <div style={{ display: 'flex', background: 'var(--input-bg)', padding: '10px 15px', borderRadius: '10px', border: '1px solid var(--card-border)', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Filter:</span>
              <input 
                type="text" 
                placeholder="Search ID, name, breed..." 
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                style={{ flex: 1, background: 'var(--bg-base)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}
              />
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>ID</th>
                  <th>NAME</th>
                  <th>BREED</th>
                  <th>LOCATION</th>
                  <th style={{ width: '120px' }}>WEIGHT</th>
                  <th>NOTES</th>
                  <th style={{ width: '140px' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTags.map(({ key, ...data }) => (
                  <tr key={key}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>#{key}</td>
                    {editingKey === key ? (
                      <>
                        <td>
                          <input 
                            type="text" 
                            value={editForm.name} 
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} 
                            style={{ background: 'var(--bg-base)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '4px 8px', borderRadius: '4px', width: '100%' }}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            value={editForm.breed} 
                            onChange={(e) => setEditForm({ ...editForm, breed: e.target.value })} 
                            style={{ background: 'var(--bg-base)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '4px 8px', borderRadius: '4px', width: '100%' }}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            value={editForm.location} 
                            onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} 
                            style={{ background: 'var(--bg-base)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '4px 8px', borderRadius: '4px', width: '100%' }}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            value={editForm.weight} 
                            onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })} 
                            style={{ background: 'var(--bg-base)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '4px 8px', borderRadius: '4px', width: '100%' }}
                          />
                        </td>
                        <td>
                          <input 
                            type="text" 
                            value={editForm.notes} 
                            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} 
                            style={{ background: 'var(--bg-base)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '4px 8px', borderRadius: '4px', width: '100%' }}
                          />
                        </td>
                        <td>
                          <button onClick={() => handleSaveBovine(key)} className="btn-promote" style={{ background: 'var(--accent-green)', padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px', marginRight: '5px' }}>Save</button>
                          <button onClick={() => setEditingKey(null)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: '4px' }}>Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontWeight: 600 }}>{data.name}</td>
                        <td>{data.breed}</td>
                        <td>{data.location}</td>
                        <td>{data.weight}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{data.notes}</td>
                        <td>
                          <button onClick={() => startEditing(key, data)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}>Edit</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Tag Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', padding: '0 10px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Page <strong>{tagPage}</strong> of <strong>{totalTagPages}</strong> (Showing {filteredTags.length === 0 ? 0 : (tagPage - 1) * tagsPerPage + 1} to {Math.min(tagPage * tagsPerPage, filteredTags.length)} of {filteredTags.length} devices)
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  disabled={tagPage === 1}
                  onClick={() => setTagPage(prev => Math.max(prev - 1, 1))}
                  style={{
                    background: tagPage === 1 ? 'rgba(255,255,255,0.02)' : 'var(--input-bg)',
                    color: tagPage === 1 ? 'rgba(255,255,255,0.2)' : 'var(--text-main)',
                    border: '1px solid var(--card-border)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: tagPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={tagPage === totalTagPages}
                  onClick={() => setTagPage(prev => Math.min(prev + 1, totalTagPages))}
                  style={{
                    background: tagPage === totalTagPages ? 'rgba(255,255,255,0.02)' : 'var(--input-bg)',
                    color: tagPage === totalTagPages ? 'rgba(255,255,255,0.2)' : 'var(--text-main)',
                    border: '1px solid var(--card-border)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: tagPage === totalTagPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Add New Device Form */}
          <div style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '1.5rem', marginTop: '2rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>New Node</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.7rem' }}>Device ID</label>
                <input 
                  type="text" 
                  placeholder="100" 
                  value={newDeviceForm.id} 
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, id: e.target.value })}
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.7rem' }}>Subject Name</label>
                <input 
                  type="text" 
                  placeholder="Bovine #100" 
                  value={newDeviceForm.name} 
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, name: e.target.value })}
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.7rem' }}>Breed / Type</label>
                <input 
                  type="text" 
                  placeholder="Holstein" 
                  value={newDeviceForm.breed} 
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, breed: e.target.value })}
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.7rem' }}>Barn Location</label>
                <input 
                  type="text" 
                  placeholder="Sector A" 
                  value={newDeviceForm.location} 
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, location: e.target.value })}
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.7rem' }}>Weight</label>
                <input 
                  type="text" 
                  placeholder="500 kg" 
                  value={newDeviceForm.weight} 
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, weight: e.target.value })}
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: '0.7rem' }}>Research Notes</label>
                <input 
                  type="text" 
                  placeholder="Grazing" 
                  value={newDeviceForm.notes} 
                  onChange={(e) => setNewDeviceForm({ ...newDeviceForm, notes: e.target.value })}
                  style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                />
              </div>
              <button onClick={handleAddNewDevice} className="btn-promote" style={{ height: '38px', padding: '0 15px', borderRadius: '10px' }}>
                Add Node
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
