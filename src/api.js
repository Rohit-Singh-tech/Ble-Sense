import axios from 'axios';

const api = axios.create({
  baseURL: 'https://ble-sensor.onrender.com',//'http://localhost:8000',//'https://boxing-assembled-fell-expected.trycloudflare.com',//'http://localhost:8000',//
  // timeout: 15000,
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

