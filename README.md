# BLE Sense Ecosystem

Welcome to the **BLE Sense Ecosystem**! This repository hosts a complete, end-to-end IoT environment designed to discover Bluetooth Low Energy (BLE) sensors, ingest high-frequency telemetry, process raw spatial coordinates asynchronously, and visualize real-time tracking metrics on a professional dark/light dashboard.

---

## 📐 System Architecture

```
                                  HTTP POST (202 Accepted)
 ┌─────────────────┐             ────────────────────────>  ┌─────────────────┐
 │                 │                                        │ Backend Gateway │
 │   Mobile App    │                                        │  (FastAPI/Py)   │
 │   (Android)     │  <───────────────────────────────────  │                 │
 │                 │            202 Ingested Receipt        └─────────────────┘
 └─────────────────┘                                                 │
                                                                     │ Async Queue
                                                                     ▼
 ┌─────────────────┐             HTTP GET (REST API)        ┌─────────────────┐
 │  Web Dashboard  │  <───────────────────────────────────  │ Async Worker    │ <───> [ PostgreSQL ]
 │  (React/Vite)   │                                        │ (Decoders & DB) │
 └─────────────────┘                                        └─────────────────┘
```

The ecosystem is divided into three key services working in tandem:

1. **📱 Android Mobile Application (`mobile` branch)**:
   - Scans for nearby BLE advertising packets.
   - Collects environmental sensor readings (SHT40 temperature/humidity, soil metrics, ammonia, light, battery).
   - Bundles raw high-frequency telemetry and posts concatenated binary payloads to the ingestion API.

2. **⚙️ FastAPI Backend Server (`backend` branch)**:
   - Built with **FastAPI (Python)** and **PostgreSQL** (SQLAlchemy ORM).
   - **Fast Ingestion API:** `POST /api/packets` writes incoming raw payloads directly to the `raw_packets` table and returns `202 Accepted` immediately, offloading heavy processing.
   - **Asynchronous Queue Worker:** An in-memory queue processor (`asyncio.Queue`) handles packet parsing in background worker threads, preventing ingestion blocks.

3. **📊 Web Dashboard (`frontend` branch)**:
   - Built with **React 19**, **Vite**, and **Vanilla CSS** (fully custom design system).
   - Adaptable **Dark / Light Theme** variables with glassmorphic cards and micro-animations.
   - **Hash-based SPA Router:** Full browser-native deep linking (e.g. `#overview`, `#analytics`, `#queue`, `#inspector`, `#admin`, `#settings`) with a fallback 404 handler.

---

## 🔬 Telemetry Processing & Database Continuity

### 1. Hex Stream Tokenizer
The backend background worker splits contiguous or space-separated hex strings into individual **246-byte sub-packets** (supporting up to 6 concatenated packets per HTTP request).

### 2. Binary Decoding Protocol (246-Byte Chunk)
* **Device ID:** Byte 0 (decoded as a decimal string).
* **80 XYZ Coordinates:** Bytes 1 to 240 (signed 8-bit integers using two's complement conversion).
* **Current Packet Index:** Bytes 241 & 242 (16-bit little-endian).
* **Total Packets:** Bytes 243 & 244 (16-bit little-endian).
* **Tail Byte Marker:** Byte 245 (verified as `FE` for chunk boundary integrity).

### 3. Database Sequence & Timestamp Continuity
To ensure logical continuity across telemetry streams:
- The parser queries the database for the last saved record matching the incoming `device_id`.
- **Timestamp continuity:** If a previous record exists, the new packet's timestamp is set to `last_record.timestamp + 8 seconds` (matching the 8-second capture span of 80 coordinates at 10 Hz).
- **Batch ID continuity:** The sequence index is set to `last_record.packet_id_num + 1`.
- If no previous record is found, the server back-calculates timestamps from the request time and uses the parsed sequence index from the hex payload.

---

## 🌿 Repository Branching Structure

To make deployment and development as clean as possible, this repository is organized using a **split-branch structure**:

* **`main`**: The primary branch containing the unified monorepo.
* **`mobile`**: Contains only the Android application source code directly at the repository root.
* **`backend`**: Contains only the FastAPI backend server code.
* **`frontend`**: Contains only the React & Vite dashboard code.

Any push to `main` automatically triggers a **GitHub Actions Subtree Split** (`.github/workflows/split.yaml`) to push `backend/` to `backend`, and `web-dashboard/` to `frontend`.

---

## 🚀 Getting Started

### 📱 Android Mobile App
* **Path:** `Mobile/`
* **Branch:** `mobile`
* **Prerequisites:** Android Studio (Hedgehog+), Android SDK 24+, BLE-compatible Android Device.
* **Quick Start:** Open the directory in Android Studio, sync Gradle, and run on a physical device.

### ⚙️ FastAPI Backend Server
* **Path:** `backend/`
* **Branch:** `backend`
* **Prerequisites:** Python 3.10+, PostgreSQL instance.
* **Quick Start:**
  ```bash
  cd backend
  pip install -r requirements.txt
  uvicorn app.main:app --reload
  ```

### 📊 Web Dashboard
* **Path:** `web-dashboard/`
* **Branch:** `frontend`
* **Prerequisites:** Node.js (v18+).
* **Quick Start:**
  ```bash
  cd web-dashboard
  npm install
  npm run dev
  ```

---

## 🛠️ Technology Stack
- **Mobile:** Kotlin, Jetpack Compose, Android Bluetooth LE API, Retrofit.
- **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL, asyncio.
- **Frontend Dashboard:** React.js, Vite, Recharts, Custom HSL Styling.

---

## 👤 Author
**Saurabh Sphere** - [GitHub Profile](https://github.com/SaurabhSphere)
