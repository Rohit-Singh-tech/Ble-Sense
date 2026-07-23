import { useState, useEffect, useRef } from 'react';
import api from './api';

// Reusable Components
import SensorDetails from './components/SensorDetails';
import Notification from './components/Notification';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Authentication Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Application Pages
import Overview from './pages/Overview';
import Analytics from './pages/Analytics';
import QueueMonitor from './pages/QueueMonitor';
import DataLoggerViewer from './pages/DataLoggerViewer';
import DataExport from './pages/DataExport';
import AdminPanel from './pages/AdminPanel';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

import './App.css';

function App() {
  // Authentication & Session State
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Dashboard & Navigation State
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'graph', 'queue', 'datalogger', 'admin', 'settings'
  const [authView, setAuthView] = useState('login'); // 'login', 'register', 'forgot-password', 'reset-password'
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [apiUrl, setApiUrl] = useState('https://ble-sensor.onrender.com');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(localStorage.getItem('sidebar_collapsed') === 'true');

  const toggleSidebar = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    localStorage.setItem('sidebar_collapsed', String(nextState));
  };
  
  // Telemetry Data State
  const [packets, setPackets] = useState([]);
  const [statsPackets, setStatsPackets] = useState([]);
  const [loadingPackets, setLoadingPackets] = useState(true);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedAppId, setSelectedAppId] = useState('All');
  const [selectedDlPacket, setSelectedDlPacket] = useState(null);
  
  // DataLogger Raw Ingestion Queue State
  const [rawPackets, setRawPackets] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);

  // Overview Tab Pagination & Filter State
  const [overviewPage, setOverviewPage] = useState(1);
  const [overviewLimit, setOverviewLimit] = useState(10);
  const [overviewTotal, setOverviewTotal] = useState(0);
  const [overviewSortField, setOverviewSortField] = useState('timestamp');
  const [overviewSortOrder, setOverviewSortOrder] = useState('desc');
  const [overviewSearch, setOverviewSearch] = useState('');
  const [overviewDeviceId, setOverviewDeviceId] = useState('All');
  const [overviewStartTime, setOverviewStartTime] = useState('');
  const [overviewEndTime, setOverviewEndTime] = useState('');

  // Inspector (DataLoggerViewer) Tab Pagination & Filter State
  const [inspectorPage, setInspectorPage] = useState(1);
  const [inspectorLimit, setInspectorLimit] = useState(8);
  const [inspectorTotal, setInspectorTotal] = useState(0);
  const [inspectorSortOrder, setInspectorSortOrder] = useState('desc');
  const [inspectorSearch, setInspectorSearch] = useState('');
  const [inspectorDeviceId, setInspectorDeviceId] = useState('All');
  const [inspectorStartTime, setInspectorStartTime] = useState('');
  const [inspectorEndTime, setInspectorEndTime] = useState('');

  // Queue Monitor Tab Pagination & Filter State
  const [queuePage, setQueuePage] = useState(1);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueSortOrder, setQueueSortOrder] = useState('desc');
  const [queueSearch, setQueueSearch] = useState('');
  const [queueStatusFilter, setQueueStatusFilter] = useState('All');

  // Shared Device ID list fetched from DB
  const [deviceIdsList, setDeviceIdsList] = useState([]);
  
  // Notification Toast Banner State
  const [notification, setNotification] = useState(null);

  // Password Reset Token State
  const [resetTokenVal, setResetTokenVal] = useState('');

  // Check URL query parameters for reset token or verify callback on initial mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    
    // Check if we are on a reset-password flow
    if (window.location.pathname.includes('reset-password') || tokenParam) {
      if (tokenParam) {
        setToken(''); // Ensure auth views trigger
        setResetTokenVal(tokenParam);
        window.location.hash = '#overview';
        setAuthView('reset-password');
      }
    }
  }, []);

  // Hash-based router listener for SPA state synchronization
  useEffect(() => {
    const handleHashChange = () => {
      const rawHash = window.location.hash || '#overview';
      const cleanHash = rawHash.split('?')[0].toLowerCase();
      
      if (cleanHash === '#overview') {
        setViewMode('overview');
      } else if (cleanHash === '#graph' || cleanHash === '#analytics') {
        setViewMode('graph');
      } else if (cleanHash === '#queue') {
        setViewMode('queue');
      } else if (cleanHash === '#datalogger' || cleanHash === '#inspector') {
        setViewMode('datalogger');
      } else if (cleanHash === '#export' || cleanHash === '#dataexport' || cleanHash === '#data-export' || cleanHash === '#export-data') {
        setViewMode('export');
      } else if (cleanHash === '#admin') {
        if (user && !user.is_superuser) {
          setViewMode('not-found');
        } else {
          setViewMode('admin');
        }
      } else if (cleanHash === '#settings') {
        setViewMode('settings');
      } else {
        setViewMode('not-found');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user]);

  const navigateTo = (mode) => {
    let mappedHash = mode;
    if (mode === 'graph') mappedHash = 'analytics';
    if (mode === 'datalogger') mappedHash = 'inspector';
    if (mode === 'export') mappedHash = 'export';
    window.location.hash = '#' + mappedHash;
  };

  // Set Theme Class on Body
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);



  // Helper for displaying notifications
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Fetch logged-in user profile
  const fetchUserProfile = async (authToken) => {
    try {
      setAuthLoading(true);
      const response = await api.get('/api/users/me');
      setUser(response.data);
    } catch (error) {
      console.error("Session verification failed:", error);
      handleLogout();
    } finally {
      setAuthLoading(false);
    }
  };

  // Verify token on mount or token change
  useEffect(() => {
    if (token) {
      fetchUserProfile(token);
    } else {
      setAuthLoading(false);
    }
  }, [token, apiUrl]);

  // Fetch BLE Packets from the backend based on current active view
  const fetchPackets = async (isBackground = false) => {
    if (!token) return;
    try {
      if (!isBackground) {
        setLoadingPackets(true);
        setPackets([]);
      }
      if (viewMode === 'overview' || viewMode === 'graph') {
        // For Overview / Graph, fetch paginated general packets (which include DataLogger)
        // If graph mode, we might want a larger limit (e.g. 100) or let it use default limit
        const limit = viewMode === 'graph' ? 100 : overviewLimit;
        const page = viewMode === 'graph' ? 1 : overviewPage;
        
        const params = {
          page: page,
          limit: limit,
          appId: selectedAppId,
          type: activeCategory !== 'All' ? activeCategory : undefined,
          deviceId: overviewDeviceId !== 'All' ? overviewDeviceId : undefined,
          startTime: overviewStartTime && !isNaN(Date.parse(overviewStartTime)) ? new Date(overviewStartTime).toISOString() : undefined,
          endTime: overviewEndTime && !isNaN(Date.parse(overviewEndTime)) ? new Date(overviewEndTime).toISOString() : undefined,
          search: overviewSearch || undefined,
          sortField: overviewSortField,
          sortOrder: overviewSortOrder
        };

        // Also fetch statsPackets for the top grid cards (always latest 100, unfiltered by page/search, but filtered by appId)
        const statsParams = {
          page: 1,
          limit: 100,
          appId: selectedAppId
        };
        
        const [response, statsResponse] = await Promise.all([
          api.get('/api/packets', { params }),
          viewMode === 'overview' ? api.get('/api/packets', { params: statsParams }) : Promise.resolve({ data: { records: [] } })
        ]);
        
        const { total, records } = response.data;
        const statsRecords = statsResponse.data.records || [];
        
        const mappedPackets = records.map(pkt => {
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
        });

        const mappedStatsPackets = statsRecords.map(pkt => {
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
        });
        
        setPackets(mappedPackets);
        if (viewMode === 'overview') {
          setStatsPackets(mappedStatsPackets);
        }
        setOverviewTotal(total);
      } else if (viewMode === 'datalogger') {
        // For Inspector (DataLoggerViewer), fetch paginated datalogger processed headers
        // In the Inspector, the client currently expects a combined packets list where type === 'DataLogger'
        // So we fetch the paginated headers, map them to the unified shape, and set the packets state!
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
        
        const dlPackets = records.map(pkt => {
          const pointsMapped = pkt.points ? pkt.points.map(pt => ({
            x: pt.x,
            y: pt.y,
            z: pt.z
          })) : [];

          return {
            id: `dl-${pkt.id}`,
            appId: pkt.app_id || pkt.appId || 'Unknown',
            type: 'DataLogger',
            displayData: {
              appId: pkt.app_id || pkt.appId,
              deviceId: pkt.device_id,
              packetId: pkt.packet_id_num,
              totalPackets: pkt.total_packets,
              rawData: pkt.raw_data,
              points: pointsMapped,
              rawPacket: pkt.raw_packet
            },
            timestamp: pkt.timestamp,
            rawPacket: pkt.raw_packet
          };
        });
        
        setPackets(dlPackets);
        setInspectorTotal(total);
      }
    } catch (error) {
      console.error("Error fetching telemetry packets:", error);
    } finally {
      setLoadingPackets(false);
    }
  };

  const fetchRawPackets = async (isBackground = false) => {
    if (!token || viewMode !== 'queue') return;
    try {
      if (!isBackground) {
        setQueueLoading(true);
        setRawPackets([]);
      }
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
  };

  const fetchDeviceIds = async () => {
    if (!token) return;
    try {
      const response = await api.get('/api/packets/devices');
      setDeviceIdsList(response.data);
    } catch (error) {
      console.error("Error fetching unique device IDs:", error);
    }
  };

  const fetchPacketsRef = useRef(fetchPackets);
  const fetchRawPacketsRef = useRef(fetchRawPackets);

  useEffect(() => {
    fetchPacketsRef.current = fetchPackets;
    fetchRawPacketsRef.current = fetchRawPackets;
  });

  // 1. Immediate fetch for Overview / Graph changes
  useEffect(() => {
    if (token) {
      if (viewMode === 'overview' || viewMode === 'graph') {
        setSelectedSensor(null); // Clear selected sensor detail when filters/view changes
        fetchPackets(false);
      }
    }
  }, [
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
    apiUrl
  ]);

  // 2. Immediate fetch for Inspector (DataLoggerViewer) changes
  useEffect(() => {
    if (token) {
      if (viewMode === 'datalogger') {
        setSelectedDlPacket(null); // Clear selected datalogger packet when filters change
        fetchPackets(false);
      }
    }
  }, [
    token,
    viewMode,
    inspectorPage,
    inspectorLimit,
    inspectorSortOrder,
    inspectorSearch,
    inspectorDeviceId,
    inspectorStartTime,
    inspectorEndTime,
    apiUrl
  ]);

  // 3. Immediate fetch for Queue Monitor changes
  useEffect(() => {
    if (token) {
      if (viewMode === 'queue') {
        fetchRawPackets(false);
      }
    }
  }, [
    token,
    viewMode,
    queuePage,
    queueStatusFilter,
    queueSortOrder,
    queueSearch,
    apiUrl
  ]);

  // Fetch unique device IDs on view mode load
  useEffect(() => {
    if (token && (viewMode === 'overview' || viewMode === 'datalogger')) {
      fetchDeviceIds();
    }
  }, [token, viewMode, apiUrl]);

  // Reset page when filters change
  useEffect(() => {
    setOverviewPage(1);
  }, [selectedAppId, activeCategory, overviewSearch, overviewLimit, overviewDeviceId, overviewStartTime, overviewEndTime]);

  useEffect(() => {
    setInspectorPage(1);
  }, [inspectorSearch, inspectorLimit, inspectorDeviceId, inspectorStartTime, inspectorEndTime]);

  useEffect(() => {
    setQueuePage(1);
  }, [queueSearch, queueStatusFilter]);

  // Periodic polling hook using refs to prevent stale closures and incorrect API requests
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      // Suspend polling if the browser tab is hidden or lacks window focus
      if (document.hidden || !document.hasFocus()) return;

      if (viewMode === 'overview' || viewMode === 'graph' || viewMode === 'datalogger') {
        fetchPacketsRef.current(true);
      } else if (viewMode === 'queue') {
        fetchRawPacketsRef.current(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [token, viewMode]);

  // Revalidate active tab immediately when window/tab regains focus or visibility
  useEffect(() => {
    if (!token) return;
    const handleFocusOrVisible = () => {
      if (!document.hidden && document.hasFocus()) {
        if (viewMode === 'overview' || viewMode === 'graph' || viewMode === 'datalogger') {
          fetchPacketsRef.current(true);
        } else if (viewMode === 'queue') {
          fetchRawPacketsRef.current(true);
        }
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [token, viewMode]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setPackets([]);
    setViewMode('overview');
  };

  // RENDER SECURITY / AUTHENTICATION INTERFACES
  if (!token || authLoading) {
    return (
      <div className={`auth-container ${theme === 'light' ? 'light-theme' : ''}`}>
        <Notification notification={notification} />
        
        {authLoading ? (
          <div className="auth-card glassmorphism loading-auth">
            <div className="loader"></div>
            <h3>Verifying session...</h3>
          </div>
        ) : (
          <div className="auth-card glassmorphism">
            <div className="auth-logo">
              <div className="logo-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M6 3h12M18 3v3c0 2.2-1.8 4-4 4h-4c-2.2 0-4-1.8-4-4V3M5.5 21h13M8.5 10.5L3 21h18l-5.5-10.5" />
                </svg>
              </div>
              <h2>BLE Sensor</h2>
            </div>
            
            {authView === 'login' && (
              <Login 
                apiUrl={apiUrl} 
                onLoginSuccess={(t) => {
                  localStorage.setItem('token', t);
                  setToken(t);
                }} 
                setAuthView={setAuthView} 
                showNotification={showNotification} 
              />
            )}

            {authView === 'register' && (
              <Register 
                apiUrl={apiUrl} 
                setAuthView={setAuthView} 
                showNotification={showNotification} 
              />
            )}

            {authView === 'forgot-password' && (
              <ForgotPassword 
                apiUrl={apiUrl} 
                setAuthView={setAuthView} 
                showNotification={showNotification} 
              />
            )}

            {authView === 'reset-password' && (
              <ResetPassword 
                apiUrl={apiUrl} 
                resetTokenVal={resetTokenVal}
                setResetTokenVal={setResetTokenVal} 
                setAuthView={setAuthView} 
                showNotification={showNotification} 
              />
            )}
            

          </div>
        )}
      </div>
    );
  }

  // RENDER AUTHENTICATED DASHBOARD
  const uniqueAppIds = ['All', ...new Set([...packets, ...statsPackets].map(p => p.appId).filter(id => id && id !== 'Unknown'))];

  return (
    <div className={`dashboard-wrapper ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${theme === 'light' ? 'light-theme' : ''}`}>
      <Notification notification={notification} />


        {/* Sidebar Nav */}
        <Sidebar 
          viewMode={viewMode} 
          setViewMode={navigateTo} 
          user={user} 
          onLogout={handleLogout} 
          isCollapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />

        {/* Main Content Area */}
        <main className="main-content">
          <Header 
            viewMode={viewMode}
            packets={packets}
            rawPackets={rawPackets}
            theme={theme}
            setTheme={setTheme}
            selectedAppId={selectedAppId}
            setSelectedAppId={setSelectedAppId}
            uniqueAppIds={uniqueAppIds}
          />

          {/* Conditional Page View Router */}
          {viewMode === 'overview' && (
            <Overview 
              packets={packets}
              statsPackets={statsPackets}
              loadingPackets={loadingPackets}
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              selectedAppId={selectedAppId}
              setSelectedSensor={setSelectedSensor}
              currentPage={overviewPage}
              setCurrentPage={setOverviewPage}
              totalRecords={overviewTotal}
              itemsPerPage={overviewLimit}
              setItemsPerPage={setOverviewLimit}
              sortField={overviewSortField}
              setSortField={setOverviewSortField}
              sortOrder={overviewSortOrder}
              setSortOrder={setOverviewSortOrder}
              deviceIdFilter={overviewSearch}
              setDeviceIdFilter={setOverviewSearch}
              selectedDeviceId={overviewDeviceId}
              setSelectedDeviceId={setOverviewDeviceId}
              startTime={overviewStartTime}
              setStartTime={setOverviewStartTime}
              endTime={overviewEndTime}
              setEndTime={setOverviewEndTime}
              deviceIdsList={deviceIdsList}
            />
          )}

          {viewMode === 'graph' && (
            <Analytics 
              packets={packets}
              loadingPackets={loadingPackets}
              selectedAppId={selectedAppId}
            />
          )}

          {viewMode === 'queue' && (
            <QueueMonitor 
              apiUrl={apiUrl}
              token={token}
              rawPackets={rawPackets}
              fetchRawPackets={fetchRawPackets}
              queueLoading={queueLoading}
              setQueueLoading={setQueueLoading}
              showNotification={showNotification}
              currentPage={queuePage}
              setCurrentPage={setQueuePage}
              totalRecords={queueTotal}
              itemsPerPage={10}
              queueSearch={queueSearch}
              setQueueSearch={setQueueSearch}
              queueStatusFilter={queueStatusFilter}
              setQueueStatusFilter={setQueueStatusFilter}
              queueSortOrder={queueSortOrder}
              setQueueSortOrder={setQueueSortOrder}
            />
          )}

          {viewMode === 'datalogger' && (
            <DataLoggerViewer 
              packets={packets}
              loadingPackets={loadingPackets}
              selectedDlPacket={selectedDlPacket}
              setSelectedDlPacket={setSelectedDlPacket}
              showNotification={showNotification}
              currentPage={inspectorPage}
              setCurrentPage={setInspectorPage}
              totalRecords={inspectorTotal}
              itemsPerPage={inspectorLimit}
              setItemsPerPage={setInspectorLimit}
              sortOrder={inspectorSortOrder}
              setSortOrder={setInspectorSortOrder}
              deviceIdFilter={inspectorSearch}
              setDeviceIdFilter={setInspectorSearch}
              selectedDeviceId={inspectorDeviceId}
              setSelectedDeviceId={setInspectorDeviceId}
              startTime={inspectorStartTime}
              setStartTime={setInspectorStartTime}
              endTime={inspectorEndTime}
              setEndTime={setInspectorEndTime}
              deviceIdsList={deviceIdsList}
            />
          )}

          {viewMode === 'export' && (
            <DataExport 
              deviceIdsList={deviceIdsList}
              showNotification={showNotification}
            />
          )}

          {viewMode === 'admin' && (
            <AdminPanel 
              apiUrl={apiUrl}
              token={token}
              user={user}
              showNotification={showNotification}
            />
          )}

          {viewMode === 'settings' && (
            <Settings 
              apiUrl={apiUrl}
              token={token}
              showNotification={showNotification}
            />
          )}

          {viewMode === 'not-found' && (
            <NotFound />
          )}
        </main>


      {/* Sensor Modal Overlay Details */}
      {selectedSensor && (
        <SensorDetails
          sensor={selectedSensor}
          onClose={() => setSelectedSensor(null)}
        />
      )}
    </div>
  );
}

export default App;
