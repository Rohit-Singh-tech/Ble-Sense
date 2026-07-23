import React from 'react';

const FlaskIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12M18 3v3c0 2.2-1.8 4-4 4h-4c-2.2 0-4-1.8-4-4V3M5.5 21h13M8.5 10.5L3 21h18l-5.5-10.5" />
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
  </svg>
);

const GridIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

const ActivityIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const QueueIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06-.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const DownloadNavIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const LogOutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

const Sidebar = ({ viewMode, setViewMode, user, onLogout, isCollapsed, onToggle }) => {
  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header" style={{ display: 'flex', justifyContent: isCollapsed ? 'center' : 'space-between', alignItems: 'center', marginBottom: '2.25rem' }}>
        {!isCollapsed && (
          <div className="sidebar-logo" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="logo-icon">
              <FlaskIcon />
            </div>
            <span className="logo-text">BLE <span className="accent">Research</span></span>
          </div>
        )}
        <button 
          onClick={onToggle} 
          className="btn-sidebar-toggle"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--card-border)',
            borderRadius: '8px',
            color: 'var(--text-main)',
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s'
          }}
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? '»' : '«'}
        </button>
      </div>

      {user && (
        <div className="sidebar-profile" style={{ padding: isCollapsed ? '0' : '14px', justifyContent: isCollapsed ? 'center' : 'flex-start' }} title={`${user.username} (${user.is_superuser ? 'Administrator' : 'Operator'})`}>
          <div className="avatar">
            <UserIcon />
          </div>
          {!isCollapsed && (
            <div className="user-info">
              <div className="username">{user.username}</div>
              <div className="role-tag">{user.is_superuser ? 'Administrator' : 'Operator'}</div>
            </div>
          )}
        </div>
      )}
      <nav className="sidebar-nav">
        <div
          className={`nav-item ${viewMode === 'overview' ? 'active' : ''}`}
          onClick={() => setViewMode('overview')}
          title="Overview"
        >
          <span className="nav-icon" style={{ display: 'flex', alignItems: 'center' }}><GridIcon /></span>
          {!isCollapsed && <span className="nav-text">Overview</span>}
        </div>
        <div
          className={`nav-item ${viewMode === 'graph' ? 'active' : ''}`}
          onClick={() => setViewMode('graph')}
          title="Analytics"
        >
          <span className="nav-icon" style={{ display: 'flex', alignItems: 'center' }}><ActivityIcon /></span>
          {!isCollapsed && <span className="nav-text">Analytics</span>}
        </div>
        <div
          className={`nav-item ${viewMode === 'queue' ? 'active' : ''}`}
          onClick={() => setViewMode('queue')}
          title="Queue"
        >
          <span className="nav-icon" style={{ display: 'flex', alignItems: 'center' }}><QueueIcon /></span>
          {!isCollapsed && <span className="nav-text">Queue</span>}
        </div>
        <div
          className={`nav-item ${viewMode === 'datalogger' ? 'active' : ''}`}
          onClick={() => setViewMode('datalogger')}
          title="Inspector"
        >
          <span className="nav-icon" style={{ display: 'flex', alignItems: 'center' }}><SearchIcon /></span>
          {!isCollapsed && <span className="nav-text">Inspector</span>}
        </div>
        <div
          className={`nav-item ${viewMode === 'export' ? 'active' : ''}`}
          onClick={() => setViewMode('export')}
          title="Data Export"
        >
          <span className="nav-icon" style={{ display: 'flex', alignItems: 'center' }}><DownloadNavIcon /></span>
          {!isCollapsed && <span className="nav-text">Data Export</span>}
        </div>
        {user?.is_superuser && (
          <div
            className={`nav-item ${viewMode === 'admin' ? 'active' : ''}`}
            onClick={() => setViewMode('admin')}
            title="Admin"
          >
            <span className="nav-icon" style={{ display: 'flex', alignItems: 'center' }}><ShieldIcon /></span>
            {!isCollapsed && <span className="nav-text">Admin</span>}
          </div>
        )}
        <div
          className={`nav-item ${viewMode === 'settings' ? 'active' : ''}`}
          onClick={() => setViewMode('settings')}
          title="System Settings"
        >
          <span className="nav-icon" style={{ display: 'flex', alignItems: 'center' }}><SettingsIcon /></span>
          {!isCollapsed && <span className="nav-text">System Settings</span>}
        </div>
      </nav>

      <button onClick={onLogout} className="btn-logout" title="Sign Out">
        <span style={{ display: 'flex', alignItems: 'center' }}><LogOutIcon /></span>
        {!isCollapsed && <span>Sign Out</span>}
      </button>
    </aside>
  );
};

export default Sidebar;
