import React from 'react';

const SHT40Icon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
  </svg>
);

const AccelerometerIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const LuxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const SoilIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const AirIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
  </svg>
);

const AmmoniaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M10 2v7.31M14 2v7.31M8.5 2h7M14 9.31a6.5 6.5 0 1 1-4 0M10 15h4M12 12v6" />
  </svg>
);

const DefaultIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.58 16.14a5 5 0 0 1 6.84 0M12 20h.01" />
  </svg>
);

const SensorCard = ({ type, data, lastUpdate, rssi, onClick }) => {
  const getSensorIcon = (sensorType) => {
    switch (sensorType) {
      case 'SHT40': return <SHT40Icon />;
      case 'LIS3DH': return <AccelerometerIcon />;
      case 'Lux Sensor': return <LuxIcon />;
      case 'Soil Sensor': return <SoilIcon />;
      case 'DataLogger': return <ChartIcon />;
      case 'sen66': return <AirIcon />;
      case 'Ammonia Sensor': return <AmmoniaIcon />;
      default: return <DefaultIcon />;
    }
  };

  const getPrimaryValue = () => {
    if (!data) return '--';
    switch (type) {
      case 'SHT40': return `${data.temperature}°C`;
      case 'Lux Sensor': return `${data.lux} lx`;
      case 'Soil Sensor': return `${data.moisture}%`;
      case 'DataLogger': return `#${data.packetId}`;
      case 'sen66': return `${data.pm25} μg`;
      case 'Ammonia Sensor': return `${data.ammonia}`;
      default: return 'Active';
    }
  };

  const getSecondaryValue = () => {
    if (!data) return null;
    switch (type) {
      case 'SHT40': {
        const t = data.temperature;
        const rh = data.humidity;
        if (t !== undefined && rh !== undefined) {
          const thi = 0.8 * t + (rh / 100) * (t - 14.4) + 46.4;
          const thiLimit = parseFloat(localStorage.getItem('thi_threshold') || '72');
          const diff = thiLimit - 72;
          let label = 'Optimal';
          if (thi >= 84 + diff) label = 'Severe Stress';
          else if (thi >= 79 + diff) label = 'Mod Stress';
          else if (thi >= thiLimit) label = 'Mild Stress';
          return `RH: ${rh}% | THI: ${thi.toFixed(1)} (${label})`;
        }
        return `Relative Humidity: ${rh}%`;
      }
      case 'Soil Sensor': return `Temperature: ${data.temperature}°C`;
      case 'sen66': return `CO2: ${data.co2} ppm`;
      case 'DataLogger': return `Acceleration Data`;
      case 'Ammonia Sensor': {
        const nh3 = parseFloat(data.ammonia);
        if (!isNaN(nh3)) {
          const ammoniaLimit = parseFloat(localStorage.getItem('ammonia_threshold') || '25');
          let safety = 'Optimal';
          if (nh3 >= ammoniaLimit) safety = 'Hazardous';
          else if (nh3 >= ammoniaLimit * 0.4) safety = 'Acceptable';
          return `Safety level: ${safety}`;
        }
        return null;
      }
      default: return null;
    }
  };

  return (
    <div className="sensor-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="card-header">
        <div className="sensor-icon">{getSensorIcon(type)}</div>
        <div className="status-badge" style={{ padding: '4px 8px', fontSize: '0.7rem' }}>
          <div className="pulse" style={{ width: 6, height: 6 }}></div>
          LIVE
        </div>
      </div>
      <div>
        <div className="sensor-label">{type}</div>
        <div className="sensor-value">
          {getPrimaryValue()}
          {type === 'SHT40' && <span className="sensor-unit" style={{ marginLeft: '4px' }}></span>}
        </div>
        <div className="sensor-footer" style={{ border: 'none', padding: 0 }}>
          <span>{getSecondaryValue()}</span>
        </div>
      </div>
      <div className="sensor-footer">
        <span>Signal: {rssi || '-65'} dBm</span>
        <span>{new Date(lastUpdate).toLocaleTimeString()}</span>
      </div>
    </div>
  );
};

export default SensorCard;
