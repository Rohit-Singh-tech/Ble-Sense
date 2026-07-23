import React, { useState, useEffect } from 'react';
import api, { downloadCsvExport } from '../api';
import ExportProgressModal from '../components/ExportProgressModal';

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const DataExport = ({ deviceIdsList = [], showNotification }) => {
  const [selectedDeviceId, setSelectedDeviceId] = useState('All');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [exportType, setExportType] = useState('packets'); // 'packets' or 'samples'
  const [sortOrder, setSortOrder] = useState('desc');
  
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [previewRecords, setPreviewRecords] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  // Export Modal Progress States
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDone, setModalDone] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Quick Preset Helper
  const applyPreset = (hours) => {
    if (!hours) {
      setStartTime('');
      setEndTime('');
      return;
    }
    const end = new Date();
    const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
    
    const formatLocal = (d) => {
      const pad = (n) => (n < 10 ? '0' + n : n);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setStartTime(formatLocal(start));
    setEndTime(formatLocal(end));
  };

  // Fetch Live Preview & Count matching current filters
  useEffect(() => {
    let isSubscribed = true;

    const fetchPreview = async () => {
      setPreviewLoading(true);
      if (isSubscribed) {
        setPreviewCount(0);
        setPreviewRecords([]);
      }
      try {
        const params = {
          page: 1,
          limit: 5,
          deviceId: selectedDeviceId !== 'All' ? selectedDeviceId : undefined,
          startTime: startTime ? new Date(startTime).toISOString() : undefined,
          endTime: endTime ? new Date(endTime).toISOString() : undefined,
          sortOrder: sortOrder
        };

        const res = await api.get('/api/packets/datalogger/processed', { params });
        if (isSubscribed) {
          setPreviewCount(res.data.total || 0);
          setPreviewRecords(res.data.records || []);
        }
      } catch (err) {
        console.error("Failed to load export preview:", err);
      } finally {
        if (isSubscribed) setPreviewLoading(false);
      }
    };

    fetchPreview();

    return () => {
      isSubscribed = false;
    };
  }, [selectedDeviceId, startTime, endTime, sortOrder]);

  const handleTriggerExport = async () => {
    if (previewCount === 0) {
      if (showNotification) showNotification("No matching records found to export.", "error");
      return;
    }

    try {
      setIsExporting(true);
      setModalError(null);
      setModalDone(false);
      setModalOpen(true);

      const params = {
        deviceId: selectedDeviceId !== 'All' ? selectedDeviceId : undefined,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        exportType: exportType,
        sortOrder: sortOrder
      };

      await downloadCsvExport(params);
      setModalDone(true);
      if (showNotification) showNotification("CSV data download completed successfully!", "success");
    } catch (err) {
      console.error("Export download failed:", err);
      setModalError("Failed to generate CSV download stream.");
      if (showNotification) showNotification("Failed to generate CSV export. Please try again.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="data-export-container" style={{ padding: '1rem 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        
        {/* Filter Configuration Card */}
        <div className="glassmorphism" style={{ padding: '1.75rem', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Export Parameters</span>
          </h3>

          {/* Device ID Selection */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
              Device Node ID:
            </label>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                color: 'var(--text-main)',
                border: '1px solid var(--card-border)',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '0.9rem',
                outline: 'none'
              }}
            >
              <option value="All">All Registered Device Nodes</option>
              {deviceIdsList.map(id => (
                <option key={id} value={id}>Device Tag #{id}</option>
              ))}
            </select>
          </div>

          {/* Quick Presets */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
              Time Range Presets:
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => applyPreset(24)}
                style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Last 24h
              </button>
              <button
                onClick={() => applyPreset(168)}
                style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => applyPreset(720)}
                style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => applyPreset(null)}
                style={{ background: 'rgba(255, 107, 107, 0.1)', border: '1px solid rgba(255, 107, 107, 0.2)', color: '#FF6B6B', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
              >
                All Time
              </button>
            </div>
          </div>

          {/* Datetime Pickers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Start Time:
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--card-border)',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  colorScheme: 'dark'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                End Time:
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--input-bg)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--card-border)',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  colorScheme: 'dark'
                }}
              />
            </div>
          </div>

          {/* Sort Order */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
              Chronological Sorting:
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setSortOrder('desc')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: sortOrder === 'desc' ? '1px solid var(--accent-teal)' : '1px solid var(--card-border)',
                  background: sortOrder === 'desc' ? 'rgba(0, 210, 180, 0.15)' : 'var(--input-bg)',
                  color: sortOrder === 'desc' ? 'var(--accent-teal)' : 'var(--text-main)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ▼ Newest First (Desc)
              </button>
              <button
                onClick={() => setSortOrder('asc')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: sortOrder === 'asc' ? '1px solid var(--accent-teal)' : '1px solid var(--card-border)',
                  background: sortOrder === 'asc' ? 'rgba(0, 210, 180, 0.15)' : 'var(--input-bg)',
                  color: sortOrder === 'asc' ? 'var(--accent-teal)' : 'var(--text-main)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ▲ Oldest First (Asc)
              </button>
            </div>
          </div>
        </div>

        {/* Granularity & Format Selector Card */}
        <div className="glassmorphism" style={{ padding: '1.75rem', borderRadius: '16px', border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Select Data Granularity</span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, marginBottom: '1.5rem' }}>
            
            {/* Format Option 1: Packet Summaries */}
            <div
              onClick={() => setExportType('packets')}
              style={{
                padding: '1rem',
                borderRadius: '12px',
                border: exportType === 'packets' ? '2px solid var(--accent-teal)' : '1px solid var(--card-border)',
                background: exportType === 'packets' ? 'rgba(0, 210, 180, 0.08)' : 'var(--input-bg)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: exportType === 'packets' ? 'var(--accent-teal)' : 'var(--text-main)', fontSize: '0.95rem' }}>
                  1. Packet Summary Level
                </span>
                {exportType === 'packets' && <span style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 700 }}>✓ SELECTED</span>}
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Outputs 1 row per packet. Includes packet timestamp, app ID, device ID, sequence #, total packets, total 3D points, and raw hex telemetry.
              </p>
            </div>

            {/* Format Option 2: Detailed XYZ Point Samples */}
            <div
              onClick={() => setExportType('samples')}
              style={{
                padding: '1rem',
                borderRadius: '12px',
                border: exportType === 'samples' ? '2px solid var(--accent-teal)' : '1px solid var(--card-border)',
                background: exportType === 'samples' ? 'rgba(0, 210, 180, 0.08)' : 'var(--input-bg)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, color: exportType === 'samples' ? 'var(--accent-teal)' : 'var(--text-main)', fontSize: '0.95rem' }}>
                  2. Granular 3D Point Telemetry
                </span>
                {exportType === 'samples' && <span style={{ color: 'var(--accent-teal)', fontSize: '0.8rem', fontWeight: 700 }}>✓ SELECTED</span>}
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Outputs 1 row per sample. Decodes all 80 spatial points into individual rows with X, Y, Z axes coordinates and calculated vector magnitude.
              </p>
            </div>

          </div>

          {/* Download Action Button */}
          <button
            onClick={handleTriggerExport}
            disabled={isExporting || previewCount === 0}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '12px',
              background: previewCount === 0 ? 'var(--card-border)' : 'linear-gradient(135deg, #00d2b4 0%, #00a896 100%)',
              color: '#000',
              fontWeight: 700,
              fontSize: '1rem',
              border: 'none',
              cursor: previewCount === 0 || isExporting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: previewCount === 0 ? 'none' : '0 4px 14px rgba(0, 210, 180, 0.3)',
              transition: 'all 0.2s'
            }}
          >
            <DownloadIcon />
            {isExporting ? 'Generating Stream...' : `Download ${exportType === 'samples' ? 'XYZ Samples' : 'Packet Summaries'} CSV`}
          </button>
        </div>

      </div>

      {/* Live Export Preview Card */}
      <div className="glassmorphism" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Matched Dataset Preview</h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Showing sample match matching filters ({selectedDeviceId !== 'All' ? `Device #${selectedDeviceId}` : 'All Devices'})
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Total Packets Found: <strong style={{ color: 'var(--accent-teal)', fontSize: '1.1rem' }}>{previewCount}</strong>
              {exportType === 'samples' && (
                <span style={{ marginLeft: '10px', fontSize: '0.85rem' }}>
                  (~<strong style={{ color: '#00d2b4' }}>{previewCount * 80}</strong> XYZ points)
                </span>
              )}
            </span>
          </div>
        </div>

        {previewLoading ? (
          <div style={{ padding: '3rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px', color: 'var(--text-secondary)' }}>
            <div className="loader"></div>
            <div>Loading export dataset preview...</div>
          </div>
        ) : previewCount === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No DataLogger packets found matching the selected filter criteria.
          </div>
        ) : (
          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table className="custom-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>HEADER ID</th>
                  <th>TIMESTAMP (UTC)</th>
                  <th>DEVICE ID</th>
                  <th>SEQ #</th>
                  <th>TOTAL PKTS</th>
                  <th>RAW HEX PREVIEW</th>
                </tr>
              </thead>
              <tbody>
                {previewRecords.map((pkt) => (
                  <tr key={pkt.id}>
                    <td style={{ fontWeight: 600 }}>#{pkt.id}</td>
                    <td>{new Date(pkt.timestamp).toLocaleString()}</td>
                    <td><span className="sensor-tag datalogger">Tag #{pkt.device_id}</span></td>
                    <td>#{pkt.packet_id_num}</td>
                    <td>{pkt.total_packets}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pkt.raw_data ? pkt.raw_data.substring(0, 40) + '...' : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Download Progress Animation Modal */}
      <ExportProgressModal 
        isOpen={modalOpen}
        totalCount={previewCount}
        exportType={exportType}
        isDone={modalDone}
        error={modalError}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};

export default DataExport;
