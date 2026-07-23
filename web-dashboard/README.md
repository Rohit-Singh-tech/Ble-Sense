# BLE Sense - Web Dashboard

This branch hosts the **BLE Sense Web Dashboard**, the visualization frontend of the BLE Sense Ecosystem. Built with React and Vite, this application provides an interactive web-based interface for displaying real-time sensor measurements, charting historical telemetry, and tracking connected BLE sensor states.

---

## 📊 Features

- **Live Telemetry Grid:** Cards displaying real-time values for Temperature, Humidity, Battery, and Accelerometer data.
- **Dynamic Charting:** Interactive, responsive line charts showing sensor telemetry trends over time (powered by **Recharts**).
- **Sensor Details Inspector:** View specific historical logs, filter data packets by sensor/device ID, and download telemetry records.
- **Auto-Refresh Data Ingestion:** Connects to the backend server API to query the latest data packets automatically.
- **Modern Responsive Design:** Fully styled using optimized CSS variables and layouts that scale beautifully from mobile to large desktop displays.

---

## 📸 Dashboard Preview

Here is a preview of the web interface:

<div align="center">
  <img src="screenshots/BLE_Dashboard.png" width="800" alt="BLE Web Dashboard"/>
</div>

---

## 🚀 Getting Started

This branch contains only the React + Vite frontend dashboard. You can run it locally or compile a production bundle for hosting.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or newer recommended)

### Installation
1. Clone this branch directly:
   ```bash
   git clone -b dashboard https://github.com/SaurabhSphere/BLE-Sensor.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Dashboard
* **Development Server** (hot-reloads on edits):
   ```bash
   npm run dev
   ```
   *Note: Runs on `--host` by default, allowing you to access it from other devices in your local network (e.g., `http://<your-ip>:5173`).*

* **Build for Production**:
   ```bash
   npm run build
   ```
   *The built files will be located in the `dist/` directory, ready to be hosted on Vercel, Netlify, Github Pages, or AWS S3.*

---

## ⚙️ Connecting to Backend API

By default, the dashboard expects the backend API server to be running on `http://localhost:5000`. 

To configure a custom backend endpoint:
1. Open the project configuration or main layout file (usually `src/App.jsx`).
2. Update the API endpoint URL to point to your deployed backend (e.g., `https://your-backend.herokuapp.com/api/packets` or `http://192.168.1.100:5000/api/packets`).

---

## 🛠️ Technology Stack
- **Framework:** React.js (v19)
- **Bundler & Dev Server:** Vite
- **Charts:** Recharts
- **HTTP Client:** Axios
- **Styling:** Custom CSS
