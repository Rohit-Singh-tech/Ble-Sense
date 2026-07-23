import React from 'react';
import SensorChart from '../components/SensorChart';

const Analytics = ({ packets, loadingPackets, selectedAppId }) => {
  const filteredPackets = selectedAppId === 'All'
    ? packets
    : packets.filter(p => p.appId === selectedAppId);

  return (
    <div className="analytics-view">
      {loadingPackets ? (
        <div className="telemetry-loading">
          <div className="loader"></div>
          <p>Syncing analytics stream...</p>
        </div>
      ) : packets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <h3>No Data Stream to Chart</h3>
          <p>Telemetry packets are required to draw graphs.</p>
        </div>
      ) : (
        <div className="chart-card glassmorphism">
          <div className="chart-header">
            <h3>Real-time Numeric Telemetry Stream</h3>
            <p>Shows historical sensor patterns (Auto-updating)</p>
          </div>
          <SensorChart data={filteredPackets} />
        </div>
      )}
    </div>
  );
};

export default Analytics;
