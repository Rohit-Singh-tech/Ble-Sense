import React, { useState, useEffect, useMemo } from 'react';

const parseRawDataToChunks = (rawData) => {
  if (!rawData || typeof rawData !== 'string') return [];
  const hexParts = rawData.trim().split(/\s+/).filter(h => h.length > 0);
  const bytes = hexParts.map(hex => parseInt(hex, 16));

  const chunkSize = 246;
  const numChunks = Math.floor(bytes.length / chunkSize);
  if (numChunks === 0) return [];

  const chunks = [];
  for (let i = 0; i < numChunks; i++) {
    const offset = i * chunkSize;
    const chunkBytes = bytes.slice(offset, offset + chunkSize);

    // Byte 0 → device ID
    const deviceId = chunkBytes[0] & 0xFF;

    // Bytes 1..240 → 80 XYZ points (3 bytes each)
    const points = [];
    for (let p = 1; p <= 238; p += 3) {
      let x = chunkBytes[p] & 0xFF;
      let y = chunkBytes[p + 1] & 0xFF;
      let z = chunkBytes[p + 2] & 0xFF;

      const isNA = (x === 255 && y === 255 && z === 255);
      points.push({
        x: isNA ? '--' : (new Int8Array([x])[0]).toString(),
        y: isNA ? '--' : (new Int8Array([y])[0]).toString(),
        z: isNA ? '--' : (new Int8Array([z])[0]).toString()
      });
    }

    // Bytes 241..242 → packetId (little-endian)
    const packetId = (chunkBytes[241] & 0xFF) | ((chunkBytes[242] & 0xFF) << 8);

    // Bytes 243..244 → lastSavedPacketId (little-endian)
    const lastSavedPacketId = (chunkBytes[243] & 0xFF) | ((chunkBytes[244] & 0xFF) << 8);

    // Byte 245 → footer
    const footer = chunkBytes[245] & 0xFF;

    // Raw hex of this chunk
    const rawHex = chunkBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

    chunks.push({
      chunkIndex: i,
      deviceId,
      packetId,
      lastSavedPacketId,
      footer,
      points,
      rawHex
    });
  }
  return chunks;
};

const SensorDetails = ({ sensor, onClose }) => {
  const [selectedChunk, setSelectedChunk] = useState(0);

  // Reset selected chunk when sensor changes
  useEffect(() => {
    setSelectedChunk(0);
  }, [sensor]);

  if (!sensor) return null;

  const data = sensor.displayData || sensor.data;
  const type = sensor.type;

  const renderSpecificDetails = () => {
    switch (type) {
      case 'DataLogger': {
        const rawData = data.rawData || '';
        const chunks = parseRawDataToChunks(rawData);

        const handleCopyRaw = () => {
          navigator.clipboard.writeText(rawData);
          alert('Copied all raw data to clipboard');
        };

        const handleCopyChunk = () => {
          if (chunks[selectedChunk]) {
            navigator.clipboard.writeText(chunks[selectedChunk].rawHex);
            alert('Copied chunk hex to clipboard');
          }
        };

        if (chunks.length === 0) {
          return (
            <div className="data-logger-details">
              <p>⚠ Could not parse chunks — unexpected byte count or no raw data.</p>
              <button onClick={handleCopyRaw} className="btn-secondary" style={{ marginTop: '10px' }}>Copy Raw Hex</button>
            </div>
          );
        }

        const chunk = chunks[selectedChunk];
        const pointOffset = chunk.chunkIndex * 80;

        return (
          <div className="data-logger-details" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

            {/* Chunk Tabs */}
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
              {chunks.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedChunk(i)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    background: selectedChunk === i ? 'var(--accent-teal)' : 'var(--input-bg)',
                    border: 'none',
                    color: selectedChunk === i ? '#fff' : 'var(--text-main)',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  Part {i + 1}
                </button>
              ))}
            </div>

            {/* Metadata */}
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
              <h4 style={{ marginTop: 0, color: 'var(--text-secondary)' }}>FRAME {chunk.chunkIndex + 1} TELEMETRY METADATA</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Batch ID:</strong> {chunk.packetId}</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Previous Batch ID:</strong> {chunk.lastSavedPacketId}</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Node Address:</strong> 0x{chunk.deviceId.toString(16).padStart(2, '0').toUpperCase()}</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>Checksum:</strong> 0x{chunk.footer.toString(16).padStart(2, '0').toUpperCase()}</div>
              </div>
            </div>

            {/* XYZ Points Grid */}
            <div className="points-grid">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>XYZ SPATIAL COORDINATES</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>#{pointOffset + 1} – #{pointOffset + 80}</span>
              </div>
              <div className="grid-header" style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', gap: '10px', padding: '8px', background: 'rgba(255,255,255,0.1)' }}>
                <span>#</span>
                <span style={{ color: '#FF6B6B' }}>X</span>
                <span style={{ color: '#4ECDC4' }}>Y</span>
                <span style={{ color: '#95E1D3', textAlign: 'right' }}>Z</span>
              </div>
              <div className="grid-scroll" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {chunk.points.map((pt, i) => (
                  <div key={i} className="grid-row" style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 1fr', gap: '10px', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="pt-idx" style={{ fontFamily: 'monospace', color: '#888' }}>{String(pointOffset + i + 1).padStart(3, '0')}</span>
                    <span style={{ fontFamily: 'monospace', color: pt.x === '--' ? '#888' : '#FF6B6B' }}>{pt.x}</span>
                    <span style={{ fontFamily: 'monospace', color: pt.y === '--' ? '#888' : '#4ECDC4' }}>{pt.y}</span>
                    <span style={{ fontFamily: 'monospace', color: pt.z === '--' ? '#888' : '#95E1D3', textAlign: 'right' }}>{pt.z}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hex Viewer */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>FRAME BINARY HEX (246 bytes)</span>
                <button onClick={handleCopyChunk} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>Copy Frame Hex</button>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', wordBreak: 'break-all', color: '#4ECDC4', maxHeight: '100px', overflowY: 'auto' }}>
                {chunk.rawHex}
              </div>
            </div>

            {/* <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleCopyRaw} className="btn-primary" style={{ padding: '8px 16px' }}>Copy Binary Stream</button>
            </div> */}

          </div>
        );
      }
      case 'SHT40': {
        const t = data.temperature;
        const rh = data.humidity;
        const thi = (t !== undefined && rh !== undefined)
          ? 0.8 * t + (rh / 100) * (t - 14.4) + 46.4
          : null;
        
        const thiLimit = parseFloat(localStorage.getItem('thi_threshold') || '72');
        const diff = thiLimit - 72;

        let thiLabel = 'Optimal (No Stress)';
        let thiColor = 'var(--accent-teal)';
        if (thi >= 84 + diff) { thiLabel = 'Severe Heat Stress'; thiColor = '#FF6B6B'; }
        else if (thi >= 79 + diff) { thiLabel = 'Moderate Heat Stress'; thiColor = '#ffc658'; }
        else if (thi >= thiLimit) { thiLabel = 'Mild Heat Stress'; thiColor = '#82ca9d'; }

        return (
          <div className="sht40-details" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="sensor-card" style={{ border: 'none' }}>
                <div className="sensor-label">Temperature</div>
                <div className="sensor-value" style={{ color: 'var(--accent-secondary)' }}>{t}°C</div>
              </div>
              <div className="sensor-card" style={{ border: 'none' }}>
                <div className="sensor-label">Relative Humidity</div>
                <div className="sensor-value" style={{ color: 'var(--accent-primary)' }}>{rh}%</div>
              </div>
            </div>
            {thi !== null && (
              <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', borderLeft: `4px solid ${thiColor}` }}>
                <h4 style={{ marginTop: 0, color: 'var(--text-secondary)' }}>CATTLE HEAT STRESS STATUS</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Temperature Humidity Index (THI):</strong> {thi.toFixed(1)}
                  </div>
                  <span style={{ color: thiColor, fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                    {thiLabel}
                  </span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Threshold values based on veterinary research: THI ≥ 72 indicates onset of heat stress in dairy livestock, affecting milk production and rumination behavior.
                </p>
              </div>
            )}
          </div>
        );
      }
      case 'Soil Sensor':
        return (
          <div className="soil-details">
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              {[
                { label: 'Nitrogen', value: data.nitrogen, unit: 'mg/kg' },
                { label: 'Phosphorus', value: data.phosphorus, unit: 'mg/kg' },
                { label: 'Potassium', value: data.potassium, unit: 'mg/kg' },
                { label: 'Moisture', value: data.moisture, unit: '%' },
                { label: 'Temperature', value: data.temperature, unit: '°C' },
                { label: 'pH', value: data.pH, unit: '' },
                { label: 'EC', value: data.ec, unit: 'us/cm' },
                { label: 'Salinity', value: data.salinity, unit: 'mg/L' }
              ].map(item => (
                <div key={item.label} className="sensor-card" style={{ border: 'none', padding: '1rem' }}>
                  <div className="sensor-label">{item.label}</div>
                  <div className="sensor-value" style={{ fontSize: '1.1rem' }}>{item.value} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{item.unit}</span></div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'sen66':
        return (
          <div className="sen66-details">
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              {[
                { label: 'PM1.0', value: data.pm1, unit: 'μg/m³' },
                { label: 'PM2.5', value: data.pm25, unit: 'μg/m³' },
                { label: 'PM4.0', value: data.pm4, unit: 'μg/m³' },
                { label: 'PM10.0', value: data.pm10, unit: 'μg/m³' },
                { label: 'CO2', value: data.co2, unit: 'ppm' },
                { label: 'VOC', value: data.voc, unit: '' },
                { label: 'NOx', value: data.nox, unit: '' },
                { label: 'Temperature', value: data.temperature, unit: '°C' },
                { label: 'Relative Humidity', value: data.humidity, unit: '%' }
              ].map(item => (
                <div key={item.label} className="sensor-card" style={{ border: 'none', padding: '1rem' }}>
                  <div className="sensor-label">{item.label}</div>
                  <div className="sensor-value" style={{ fontSize: '1.1rem' }}>{item.value || '--'} <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{item.unit}</span></div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'Ammonia Sensor': {
        const nh3 = parseFloat(data.ammonia);
        const ammoniaLimit = parseFloat(localStorage.getItem('ammonia_threshold') || '25');
        
        let statusLabel = 'Optimal';
        let statusColor = 'var(--accent-teal)';
        let desc = 'Ammonia level is well within safe thresholds for livestock housing.';
        if (nh3 >= ammoniaLimit) {
          statusLabel = 'Hazardous (Action Required)';
          statusColor = '#FF6B6B';
          desc = `Concentration exceeds critical limit of ${ammoniaLimit} ppm. Chronic exposure leads to respiratory tract irritation, increased susceptibility to pathogens, and reduced livestock productivity.`;
        } else if (nh3 >= ammoniaLimit * 0.4) {
          statusLabel = 'Acceptable (Monitoring Advised)';
          statusColor = '#ffc658';
          desc = `Barn ammonia level is elevated (exceeds ${ammoniaLimit * 0.4} ppm) but acceptable. Ensure adequate ventilation exchange.`;
        }

        return (
          <div className="ammonia-details" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="stats-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="sensor-card" style={{ border: 'none' }}>
                <div className="sensor-label">Ammonia Gas (NH₃) Concentration</div>
                <div className="sensor-value" style={{ color: 'var(--accent-primary)' }}>{data.ammonia} ppm</div>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', borderLeft: `4px solid ${statusColor}` }}>
              <h4 style={{ marginTop: 0, color: 'var(--text-secondary)' }}>AIR QUALITY ASSESSMENT</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Housing Air Status:</strong>
                </div>
                <span style={{ color: statusColor, fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                  {statusLabel}
                </span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {desc}
              </p>
            </div>
          </div>
        );
      }
      default:
        return (
          <div className="raw-json">
            <pre style={{ background: '#000', padding: '1rem', borderRadius: '8px', overflow: 'auto' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>{type} Details</h2>
            <p className="modal-subtitle">Device ID: {data.packetId || data.deviceId || 'Unknown'}</p>
          </div>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </header>
        <div className="modal-body">
          {renderSpecificDetails()}

          {/* <div className="action-buttons">
            <button className="btn-primary" onClick={() => alert('Command requested: Get Data')}>Get Data</button>
            <button className="btn-secondary" onClick={() => alert('Command requested: Pause')}>Pause</button>
            <button className="btn-danger" onClick={() => alert('Command requested: Reset')}>Reset</button>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default SensorDetails;
