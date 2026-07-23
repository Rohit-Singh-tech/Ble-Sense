import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';

export function useSensorData({
  token,
  viewMode,
  overviewPage,
  overviewLimit,
  overviewSortField,
  overviewSortOrder,
  overviewSearch,
  overviewDeviceId,
  overviewStartTime,
  overviewEndTime,
  selectedAppId,
  activeCategory,
  inspectorPage,
  inspectorLimit,
  inspectorSortOrder,
  inspectorSearch,
  inspectorDeviceId,
  inspectorStartTime,
  inspectorEndTime,
  queuePage,
  queueStatusFilter,
  queueSortOrder,
  queueSearch,
  apiUrl
}) {
  const [packets, setPackets] = useState([]);
  const [statsPackets, setStatsPackets] = useState([]);
  const [loadingPackets, setLoadingPackets] = useState(true);
  const [rawPackets, setRawPackets] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [overviewTotal, setOverviewTotal] = useState(0);
  const [inspectorTotal, setInspectorTotal] = useState(0);
  const [queueTotal, setQueueTotal] = useState(0);
  const [deviceIdsList, setDeviceIdsList] = useState([]);

  const fetchPackets = useCallback(async () => {
    if (!token) return;
    try {
      setLoadingPackets(true);
      if (viewMode === 'overview' || viewMode === 'graph') {
        const limit = viewMode === 'graph' ? 100 : overviewLimit;
        const page = viewMode === 'graph' ? 1 : overviewPage;

        const params = {
          page,
          limit,
          appId: selectedAppId,
          type: activeCategory !== 'All' ? activeCategory : undefined,
          deviceId: overviewDeviceId !== 'All' ? overviewDeviceId : undefined,
          startTime: overviewStartTime && !isNaN(Date.parse(overviewStartTime)) ? new Date(overviewStartTime).toISOString() : undefined,
          endTime: overviewEndTime && !isNaN(Date.parse(overviewEndTime)) ? new Date(overviewEndTime).toISOString() : undefined,
          search: overviewSearch || undefined,
          sortField: overviewSortField,
          sortOrder: overviewSortOrder
        };

        const statsParams = { page: 1, limit: 100, appId: selectedAppId };

        const [response, statsResponse] = await Promise.all([
          api.get('/api/packets', { params }),
          viewMode === 'overview' ? api.get('/api/packets', { params: statsParams }) : Promise.resolve({ data: { records: [] } })
        ]);

        const { total, records } = response.data;
        const statsRecords = statsResponse.data.records || [];

        const mapPacket = (pkt) => {
          const payload = pkt.data || {};
          const innerData = payload.data || payload;

          let sensorType = 'Unknown';
          if (innerData.type === 'DataLogger' || innerData.points || innerData.deviceId) sensorType = 'DataLogger';
          else if (innerData.temperature && innerData.humidity) sensorType = 'SHT40';
          else if (innerData.nitrogen || innerData.phosphorus) sensorType = 'Soil Sensor';
          else if (innerData.co2 || innerData.pm25) sensorType = 'sen66';
          else if (innerData.lux) sensorType = 'Lux Sensor';
          else if (innerData.ammonia) sensorType = 'Ammonia Sensor';

          return {
            ...pkt,
            appId: pkt.appId || innerData.appId || payload.appId || 'Unknown',
            type: sensorType,
            displayData: innerData,
            timestamp: pkt.timestamp || payload.timestamp
          };
        };

        setPackets(records.map(mapPacket));
        if (viewMode === 'overview') setStatsPackets(statsRecords.map(mapPacket));
        setOverviewTotal(total);
      } else if (viewMode === 'datalogger') {
        const params = {
          page: inspectorPage,
          limit: inspectorLimit,
          deviceId: inspectorDeviceId !== 'All' ? inspectorDeviceId : undefined,
          startTime: inspectorStartTime && !isNaN(Date.parse(inspectorStartTime)) ? new Date(inspectorStartTime).toISOString() : undefined,
          endTime: inspectorEndTime && !isNaN(Date.parse(inspectorEndTime)) ? new Date(inspectorEndTime).toISOString() : undefined,
          sortOrder: inspectorSortOrder
        };

        const response = await api.get('/api/packets/datalogger/processed', { params });
        const { total, records } = response.data;

        const dlPackets = records.map(pkt => ({
          id: `dl-${pkt.id}`,
          appId: pkt.app_id || pkt.appId || 'Unknown',
          type: 'DataLogger',
          displayData: {
            appId: pkt.app_id || pkt.appId,
            deviceId: pkt.device_id,
            packetId: pkt.packet_id_num,
            totalPackets: pkt.total_packets,
            rawData: pkt.raw_data,
            points: pkt.points ? pkt.points.map(pt => ({ x: pt.x, y: pt.y, z: pt.z })) : [],
            rawPacket: pkt.raw_packet
          },
          timestamp: pkt.timestamp,
          rawPacket: pkt.raw_packet
        }));

        setPackets(dlPackets);
        setInspectorTotal(total);
      }
    } catch (error) {
      console.error("Error fetching telemetry packets:", error);
    } finally {
      setLoadingPackets(false);
    }
  }, [
    token, viewMode, overviewPage, overviewLimit, overviewSortField, overviewSortOrder,
    overviewSearch, overviewDeviceId, overviewStartTime, overviewEndTime, selectedAppId,
    activeCategory, inspectorPage, inspectorLimit, inspectorSortOrder, inspectorSearch,
    inspectorDeviceId, inspectorStartTime, inspectorEndTime
  ]);

  const fetchRawPackets = useCallback(async () => {
    if (!token || viewMode !== 'queue') return;
    try {
      setQueueLoading(true);
      const params = {
        page: queuePage,
        limit: 10,
        status: queueStatusFilter !== 'All' ? queueStatusFilter : undefined,
        search: queueSearch || undefined,
        sortOrder: queueSortOrder
      };
      const response = await api.get('/api/packets/datalogger/raw', { params });
      const { total, records } = response.data;
      setRawPackets(records);
      setQueueTotal(total);
    } catch (error) {
      console.error("Error fetching raw packets:", error);
    } finally {
      setQueueLoading(false);
    }
  }, [token, viewMode, queuePage, queueStatusFilter, queueSortOrder, queueSearch]);

  const fetchDeviceIds = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.get('/api/packets/devices');
      setDeviceIdsList(response.data);
    } catch (error) {
      console.error("Error fetching unique device IDs:", error);
    }
  }, [token]);

  // Initial and trigger fetches
  useEffect(() => {
    if (token && (viewMode === 'overview' || viewMode === 'graph' || viewMode === 'datalogger')) {
      fetchPackets();
    }
  }, [token, viewMode, fetchPackets]);

  useEffect(() => {
    if (token && viewMode === 'queue') {
      fetchRawPackets();
    }
  }, [token, viewMode, fetchRawPackets]);

  useEffect(() => {
    if (token && (viewMode === 'overview' || viewMode === 'datalogger')) {
      fetchDeviceIds();
    }
  }, [token, viewMode, fetchDeviceIds]);

  // Polling
  const fetchPacketsRef = useRef(fetchPackets);
  const fetchRawPacketsRef = useRef(fetchRawPackets);
  useEffect(() => {
    fetchPacketsRef.current = fetchPackets;
    fetchRawPacketsRef.current = fetchRawPackets;
  });

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      if (document.hidden || !document.hasFocus()) return;
      if (viewMode === 'overview' || viewMode === 'graph' || viewMode === 'datalogger') {
        fetchPacketsRef.current();
      } else if (viewMode === 'queue') {
        fetchRawPacketsRef.current();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [token, viewMode]);

  return {
    packets,
    statsPackets,
    loadingPackets,
    rawPackets,
    queueLoading,
    setQueueLoading,
    overviewTotal,
    inspectorTotal,
    queueTotal,
    deviceIdsList,
    fetchPackets,
    fetchRawPackets
  };
}
