import React, { useState } from 'react';
import SensorCard from '../components/SensorCard';
import { downloadCsvExport } from '../api';
import ExportProgressModal from '../components/ExportProgressModal';

const SENSOR_CATEGORIES = [
  'All', 'DataLogger'
];

const Overview = ({
  packets,
  statsPackets = [],
  loadingPackets,
  activeCategory,
  setActiveCategory,
  selectedAppId,
  setSelectedSensor,
  currentPage,
  setCurrentPage,
  totalRecords,
  itemsPerPage,
  setItemsPerPage,
  sortField,
  setSortField,
  sortOrder,
  setSortOrder,
  deviceIdFilter,
  setDeviceIdFilter,
  selectedDeviceId,
  setSelectedDeviceId,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  deviceIdsList = []
}) => {
  // Progress Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDone, setModalDone] = useState(false);
  const [modalError, setModalError] = useState(null);

  const handleOverviewExport = async () => {
    try {
      setModalError(null);
      setModalDone(false);
      setModalOpen(true);

      await downloadCsvExport({
        deviceId: selectedDeviceId !== 'All' ? selectedDeviceId : undefined,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        exportType: 'packets',
        sortOrder: sortOrder
      });
      setModalDone(true);
    } catch (err) {
      console.error("Overview export error:", err);
      setModalError("Export download failed.");
    }
  };

  // Stats grid packets filtering using statsPackets (overall latest unfiltered by page)
  const filteredByApp = selectedAppId === 'All'
    ? statsPackets
    : statsPackets.filter(p => p.appId === selectedAppId);

  const latestBySensorType = Array.from(new Map(
    filteredByApp.map(p => [p.type, p])
  ).values());

  const filteredLatest = activeCategory === 'All'
    ? latestBySensorType
    : latestBySensorType.filter(p => p.type === activeCategory);

  // For the table feed, the server has already paginated, sorted, and filtered
  const paginatedPackets = packets;
  const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;

  return (
    <>
      {/* Category Filter Bar */}
      <div className="filter-bar">
        {SENSOR_CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`filter-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {loadingPackets ? (
        <div className="telemetry-loading">
          <div className="loader"></div>
          <p>Synchronizing sensor registry...</p>
        </div>
      ) : packets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.58 16.14a5 5 0 0 1 6.84 0M12 20h.01" />
            </svg>
          </div>
          <h3>No Telemetry Packets Detected</h3>
          <p>Initiate BLE data transmission from the sensor nodes to begin telemetry logging.</p>
        </div>
      ) : (
        <>
          {/* Metrics Cards Grid */}
          {/* <div className="stats-grid">
            {filteredLatest.map(p => (
              <SensorCard
                key={p.id}
                type={p.type}
                data={p.displayData}
                lastUpdate={p.timestamp}
                onClick={() => setSelectedSensor(p)}
              />
            ))}
          </div> */}

          {/* Recents Table Feed */}
          <section className="data-section">
            <div className="section-header" style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Telemetry Feed</h3>
                  <span className="helper-text">Live logs</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sort:</span>
                  <select 
                    value={sortField} 
                    onChange={(e) => setSortField(e.target.value)}
                    style={{ background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem' }}
                  >
                    <option value="timestamp">Timestamp</option>
                    <option value="type">Sensor Type</option>
                    <option value="deviceId">Device ID</option>
                  </select>
                  <button 
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    style={{ background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    {sortOrder === 'asc' ? '▲ Asc' : '▼ Desc'}
                  </button>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '10px' }}>Page Size:</span>
                  <select 
                    value={itemsPerPage} 
                    onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
                    style={{ background: 'var(--input-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                  >
                    {[10, 20, 25, 50, 100].map(limit => (
                      <option key={limit} value={limit}>{limit} records</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Filters Area */}
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--input-bg)', padding: '12px 18px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                {/* Device ID select dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Device ID:</span>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    style={{ background: 'var(--bg-base)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none' }}
                  >
                    <option value="All">All Devices</option>
                    {deviceIdsList.map(id => (
                      <option key={id} value={id}>Device #{id}</option>
                    ))}
                  </select>
                </div>

                {/* Datetime start range picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Start:</span>
                  <input 
                    type="datetime-local" 
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{ background: 'var(--bg-base)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', colorScheme: 'dark' }}
                  />
                </div>

                {/* Datetime end range picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>End:</span>
                  <input 
                    type="datetime-local" 
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={{ background: 'var(--bg-base)', color: 'var(--text-main)', border: '1px solid var(--card-border)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.8rem', outline: 'none', colorScheme: 'dark' }}
                  />
                </div>

                {/* Reset button if any filter is active */}
                {(selectedDeviceId !== 'All' || startTime || endTime) && (
                  <button
                    onClick={() => {
                      setSelectedDeviceId('All');
                      setStartTime('');
                      setEndTime('');
                    }}
                    style={{ background: 'rgba(255, 60, 60, 0.1)', color: '#FF6B6B', border: '1px solid rgba(255, 60, 60, 0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Reset Filters
                  </button>
                )}

                {/* Quick Export CSV Button */}
                <button
                  onClick={handleOverviewExport}
                  style={{
                    background: 'linear-gradient(135deg, rgba(0, 210, 180, 0.2) 0%, rgba(0, 168, 150, 0.2) 100%)',
                    color: 'var(--accent-teal)',
                    border: '1px solid var(--accent-teal)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title="Quick export packet logs with current filters to CSV"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export CSV
                </button>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                  Found: <strong>{totalRecords}</strong>
                </div>
              </div>
            </div>
            
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>TIME</th>
                    <th>TYPE</th>
                    <th>SOURCE ID</th>
                    <th>READINGS</th>
                    <th>INSPECT</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPackets.map(pkt => (
                    <tr key={pkt.id} className="table-row-hover">
                      <td className="timestamp-cell">{new Date(pkt.timestamp).toLocaleTimeString()}</td>
                      <td>
                        <span className={`sensor-tag ${pkt.type.toLowerCase().replace(' ', '-')}`}>
                          {pkt.type}
                        </span>
                      </td>
                      <td className="app-id-cell">{pkt.appId.substring(0, 12)}...</td>
                      <td className="readings-cell">
                        {pkt.type === 'SHT40' && `Temperature: ${pkt.displayData?.temperature}°C | Humidity: ${pkt.displayData?.humidity}% | THI: ${(0.8 * (parseFloat(pkt.displayData?.temperature) || 0) + ((parseFloat(pkt.displayData?.humidity) || 0) / 100) * ((parseFloat(pkt.displayData?.temperature) || 0) - 14.4) + 46.4).toFixed(1)}`}
                        {pkt.type === 'Soil Sensor' && `Moisture: ${pkt.displayData?.moisture}% | Temperature: ${pkt.displayData?.temperature}°C`}
                        {pkt.type === 'sen66' && `CO2: ${pkt.displayData?.co2} ppm | PM2.5: ${pkt.displayData?.pm25} μg/m³`}
                        {pkt.type === 'Lux Sensor' && `Illuminance: ${pkt.displayData?.lux} lx`}
                        {pkt.type === 'Ammonia Sensor' && `Ammonia: ${pkt.displayData?.ammonia} ppm`}
                        {pkt.type === 'DataLogger' && (() => {
                          try {
                            const saved = localStorage.getItem('bovine_tags');
                            const tags = saved ? JSON.parse(saved) : {
                              "11": { name: "Bovine #11", breed: "Murrah Buffalo" },
                              "42": { name: "Bovine #42", breed: "Holstein Cow" },
                              "89": { name: "Bovine #89", breed: "Jersey Cow" },
                              "93": { name: "Bovine #93", breed: "Sahiwal Cow" },
                              "248": { name: "Bovine #248", breed: "Nili-Ravi Buffalo" }
                            };
                            const bovine = tags[pkt.displayData?.deviceId] || { name: `Tag #${pkt.displayData?.deviceId}`, breed: "Unknown" };
                            return `${bovine.name} (${bovine.breed}) | Sequence #${pkt.displayData?.packetId}`;
                          } catch (e) {
                            return `Device ID: ${pkt.displayData?.deviceId} | Sequence #${pkt.displayData?.packetId}`;
                          }
                        })()}
                        {pkt.type === 'Unknown' && `Raw Data Payload Ingested`}
                      </td>
                      <td>
                        <button
                          className="btn-detail-link"
                          onClick={() => setSelectedSensor(pkt)}
                        >
                          Inspect Telemetry
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0 10px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  style={{
                    background: currentPage === 1 ? 'rgba(255,255,255,0.02)' : 'var(--input-bg)',
                    color: currentPage === 1 ? 'rgba(255,255,255,0.2)' : 'white',
                    border: '1px solid var(--card-border)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  style={{
                    background: currentPage === totalPages ? 'rgba(255,255,255,0.02)' : 'var(--input-bg)',
                    color: currentPage === totalPages ? 'rgba(255,255,255,0.2)' : 'white',
                    border: '1px solid var(--card-border)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Export Progress Animation Modal */}
      <ExportProgressModal 
        isOpen={modalOpen}
        totalCount={totalRecords}
        exportType="packets"
        isDone={modalDone}
        error={modalError}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};

export default Overview;
