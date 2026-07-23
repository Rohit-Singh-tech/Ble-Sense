import React from 'react';

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const Header = ({
  viewMode,
  packets,
  rawPackets,
  theme,
  setTheme,
  selectedAppId,
  setSelectedAppId,
  uniqueAppIds
}) => {
  return (
    <header className="top-bar">
      <div>
        <h1 className="view-title">
          {viewMode === 'overview' && 'Dashboard'}
          {viewMode === 'graph' && 'Analytics'}
          {viewMode === 'queue' && 'Queue Monitor'}
          {viewMode === 'datalogger' && 'Log Inspector'}
          {viewMode === 'export' && 'Data Export Center'}
          {viewMode === 'admin' && 'Access Controls'}
          {viewMode === 'settings' && 'Settings'}
        </h1>
        <p className="view-subtitle">
          {viewMode === 'overview' && `${packets.length} records logged`}
          {viewMode === 'graph' && `Live telemetry stream`}
          {viewMode === 'queue' && `${rawPackets.length} enqueued packets`}
          {viewMode === 'datalogger' && `${packets.filter(p => p.type === 'DataLogger').length} parsed logs`}
          {viewMode === 'export' && `Export BLE telemetry & spatial logs as CSV`}
          {viewMode === 'admin' && `Manage user privileges`}
          {viewMode === 'settings' && `API configuration`}
        </p>
      </div>
      
      <div className="top-bar-actions">
        {/* App Device Selector Dropdown */}
        {(viewMode === 'overview' || viewMode === 'graph') && (
          <div className="device-selector">
            <span className="selector-label">Device Node:</span>
            <select
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
              className="app-id-select"
            >
              {uniqueAppIds.map(id => (
                <option key={id} value={id}>
                  {id === 'All' ? 'All Devices' : `App ${id.substring(0, 10)}...`}
                </option>
              ))}
            </select>
          </div>
        )}
        
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="btn-theme-toggle"
          title="Toggle UI Contrast Theme"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        
        <div className="status-badge live">
          <div className="pulse"></div>
          SYSTEM ONLINE
        </div>
      </div>
    </header>
  );
};

export default Header;
