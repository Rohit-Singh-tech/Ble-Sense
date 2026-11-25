import axios from 'axios';

const PRIMARY_URL = 'https://ble-sense-rqnu.onrender.com';
const STORAGE_KEY_TUNNEL = 'ble_sense_tunnel_url';

const api = axios.create({
  baseURL: PRIMARY_URL,
  timeout: 30000,
});

// Request Interceptor: Automatically inject Authorization token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Smart Failover to Local PC Tunnel
api.interceptors.response.use(
  (response) => {
    // If this was a successful tunnel response, cache the active tunnel URL
    if (response.config.url && response.config.url.includes('/api/system/tunnel')) {
      const tunnelUrl = response.data?.tunnel_url;
      if (tunnelUrl) {
        localStorage.setItem(STORAGE_KEY_TUNNEL, tunnelUrl);
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest || originalRequest._failoverRetried) {
      return Promise.reject(error);
    }

    // Check if the failure is due to Render sleeping, down, or server error
    const isNetworkOr5xx = !error.response || (error.response.status >= 500 && error.response.status <= 504);

    if (isNetworkOr5xx) {
      const cachedTunnel = localStorage.getItem(STORAGE_KEY_TUNNEL);
      if (cachedTunnel && originalRequest.baseURL !== cachedTunnel) {
        console.warn(`[BLE Sense Failover] Cloud backend unreachable (${error.message}). Retrying via local PC tunnel: ${cachedTunnel}`);
        originalRequest._failoverRetried = true;
        originalRequest.baseURL = cachedTunnel;
        try {
          return await axios(originalRequest);
        } catch (failoverError) {
          console.error('[BLE Sense Failover] Local PC tunnel also unreachable:', failoverError);
          return Promise.reject(failoverError);
        }
      }
    }

    return Promise.reject(error);
  }
);

// Auto-sync active tunnel URL on dashboard load
export const syncActiveTunnel = async () => {
  try {
    const res = await axios.get(`${PRIMARY_URL}/api/system/tunnel`, { timeout: 10000 });
    if (res.data?.tunnel_url) {
      localStorage.setItem(STORAGE_KEY_TUNNEL, res.data.tunnel_url);
      console.log('[BLE Sense] Active tunnel registered in dashboard:', res.data.tunnel_url);
    }
  } catch (err) {
    const cached = localStorage.getItem(STORAGE_KEY_TUNNEL);
    if (cached) {
      console.info('[BLE Sense] Cloud server idle; loaded cached tunnel for failover:', cached);
    }
  }
};

// Run tunnel sync in background when running in the browser
if (typeof window !== 'undefined') {
  syncActiveTunnel();
}

export const downloadCsvExport = async (params = {}) => {
  try {
    const response = await api.get('/api/packets/datalogger/export/csv', {
      params,
      responseType: 'blob'
    });

    let filename = `datalogger_export_${Date.now()}.csv`;
    const disposition = response.headers['content-disposition'];
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }

    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Failed to download CSV export:', error);
    throw error;
  }
};

export default api;
