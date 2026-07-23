import React from 'react';
import api from '../api';

const QueueMonitor = ({
  apiUrl,
  token,
  rawPackets,
  fetchRawPackets,
  queueLoading,
  setQueueLoading,
  showNotification,
  currentPage,
  setCurrentPage,
  totalRecords,
  itemsPerPage,
  queueSearch,
  setQueueSearch,
  queueStatusFilter,
  setQueueStatusFilter,
  queueSortOrder,
  setQueueSortOrder
}) => {

  const handleReprocessPacket = async (packetId) => {
    try {
      if (setQueueLoading) setQueueLoading(true);
      await api.post(`/api/packets/datalogger/${packetId}/reprocess`);
      showNotification('success', `Raw packet #${packetId} re-enqueued successfully.`);
      await fetchRawPackets();
    } catch (error) {
      showNotification('error', `Failed to re-enqueue raw packet #${packetId}.`);
    } finally {
      if (setQueueLoading) setQueueLoading(false);
    }
  };

  const getRawPacketMeta = (payload) => {
    try {
      const pkt = Array.isArray(payload) ? payload[0] : payload;
      const dataWrapper = pkt?.data || pkt || {};
      const innerData = dataWrapper?.data || dataWrapper || {};
      
      let deviceId = innerData?.deviceId || 'N/A';
      let packetId = innerData?.packetId !== undefined ? innerData.packetId : 'N/A';
      const appId = innerData?.appId || 'N/A';
      
      // If we only have rawData hex string, decode the first packet chunk metadata
      const rawData = innerData?.rawData || '';
      if ((deviceId === 'N/A' || packetId === 'N/A') && rawData) {
        // Clean up hex separators (spaces, etc.)
        const cleaned = rawData.replace(/[^a-fA-F0-9]/g, '');
        if (cleaned.length >= 492) {
          // Device ID (byte 0)
          const firstByteHex = cleaned.substring(0, 2);
          deviceId = parseInt(firstByteHex, 16).toString();
          
          // Current Packet index (bytes 241, 242) -> char indices 482-485 (little-endian)
          const lsbCurrent = parseInt(cleaned.substring(482, 484), 16);
          const msbCurrent = parseInt(cleaned.substring(484, 486), 16);
          packetId = msbCurrent * 256 + lsbCurrent;
        } else {
          // Fallback to space-split tokens if contiguous format fails
          const tokens = rawData.trim().split(/\s+/);
          if (tokens.length >= 246) {
            deviceId = parseInt(tokens[0], 16).toString();
            const lsbCurrent = parseInt(tokens[tokens.length - 5], 16);
            const msbCurrent = parseInt(tokens[tokens.length - 4], 16);
            packetId = msbCurrent * 256 + lsbCurrent;
          }
        }
      }
      
      return { deviceId, appId, packetId };
    } catch (e) {
      return { deviceId: 'Error', appId: 'Error', packetId: 'Error' };
    }
  };

  // For the queue monitor feed, the server has already filtered, sorted, and paginated
  const paginated = rawPackets;
  const totalPages = Math.ceil(totalRecords / itemsPerPage) || 1;

  return (
    <div className="admin-view glassmorphism">
      {/* Filter and Search Bar */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          {/* Search */}
          <div className="form-group" style={{ margin: 0, minWidth: '240px' }}>
            <input
              type="text"
              placeholder="Search ID..."
              value={queueSearch}
              onChange={(e) => setQueueSearch(e.target.value)}
              style={{ padding: '8px 14px', borderRadius: '100px' }}
            />
          </div>
          
          {/* Status Filter */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['All', 'pending', 'processed', 'failed'].map(statusVal => (
              <button
                key={statusVal}
                onClick={() => setQueueStatusFilter(statusVal)}
                className={`filter-btn ${queueStatusFilter === statusVal ? 'active' : ''}`}
                style={{ padding: '6px 14px', fontSize: '0.8rem' }}
              >
                {statusVal.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Order Selector */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span className="selector-label">Sort:</span>
          <select
            value={queueSortOrder}
            onChange={(e) => setQueueSortOrder(e.target.value)}
            className="app-id-select"
            style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--card-border)', padding: '6px 12px', borderRadius: '100px' }}
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
          
          <button onClick={fetchRawPackets} className="btn-secondary" style={{ padding: '8px 12px', borderRadius: '100px', fontSize: '0.8rem' }}>
            Refresh
          </button>
        </div>
      </div>

      {queueLoading && rawPackets.length === 0 ? (
        <div className="telemetry-loading">
          <div className="loader"></div>
          <p>Loading queue...</p>
        </div>
      ) : rawPackets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
          </div>
          <h3>Queue Empty</h3>
          <p>No raw telemetry packets detected. Start simulator.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>PACKET ID</th>
                <th>NODE</th>
                <th>SESSION</th>
                <th>SEQ</th>
                <th>INGESTED</th>
                <th>INDEXED</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No packets match the filter criteria.
                  </td>
                </tr>
              ) : (
                paginated.map(p => {
                  const meta = getRawPacketMeta(p.payload);
                  return (
                    <tr key={p.id} className="table-row-hover">
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>#{p.id}</td>
                      <td>
                        <span style={{
                          background: 'rgba(255,255,255,0.05)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 600
                        }}>
                          {meta.deviceId}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        {meta.appId.substring(0, 14)}...
                      </td>
                      <td style={{ fontWeight: 600 }}>{meta.packetId}</td>
                      <td className="timestamp-cell">{new Date(p.created_at).toLocaleString()}</td>
                      <td className="timestamp-cell">
                        {p.processed_at ? new Date(p.processed_at).toLocaleString() : '--'}
                      </td>
                      <td>
                        <span className={`status-badge-mini ${p.status}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        {p.status !== 'processed' ? (
                          <button
                            onClick={() => handleReprocessPacket(p.id)}
                            className="btn-promote"
                            disabled={queueLoading}
                            style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                          >
                            Re-enqueue
                          </button>
                        ) : (
                          <span style={{ color: 'var(--accent-green)', fontSize: '0.85rem', fontWeight: 600 }}>Indexed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '0 10px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> (Showing {totalRecords === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalRecords)} of {totalRecords} records)
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
        </div>
      )}
    </div>
  );
};

export default QueueMonitor;
