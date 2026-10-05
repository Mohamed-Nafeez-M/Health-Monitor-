# ESP32 Sensor Signal Dashboard

This dashboard validates a one-second, 1 kHz envelope-signal processing window. In demo mode, the API generates smooth envelope-like events with a gradual rise, rounded peak, decaying tail, and light noise. It does not model a piezo sensor as producing PWM.

## Project layout

- `artifacts/sensor-dashboard/` — React and Vite dashboard.
- `artifacts/api-server/` — Express REST API and Socket.IO server.
- `docs/openapi.yaml` — API contract and generated client/schema source.
- `lib/db/src/schema/sensor-measurements.js` — PostgreSQL measurement table.

Raw 1,000-sample windows are held in memory and sent to the browser over Socket.IO. PostgreSQL stores processed measurements only.

## Install and configure

Install workspace dependencies from the project root:

```sh
npm install
```

The backend reads `DATABASE_URL` from the environment. This Replit project has a PostgreSQL database available to its workflows. For another PostgreSQL instance, set `DATABASE_URL` through the environment/secrets manager; do not commit credentials or put them in source files.

Create or update the development schema:

```sh
npm run db:push
```

The table is named `sensor_measurements`. Run the schema command after changing its Drizzle definition.

## Start the dashboard

In Replit, start these existing workflows:

- **API Server** — `npm run dev` (starts both the API and dashboard)
- **Sensor Signal Dashboard** — `npm run dev` (starts both the API and dashboard)

The workflows provide `PORT` and the frontend base path. The browser app is served at `/`; API requests and the Socket.IO connection use the shared `/api` route. For a local run outside the Replit workflows, configure equivalent `PORT` and base-path variables and a reverse proxy that forwards `/api` and `/api/socket.io` to the API service.

## Demo mode

Demo mode starts automatically with the API and writes one processed measurement per second. It is enabled by default. To stop simulation when the ESP32 begins posting data, set:

```text
SENSOR_DEMO_MODE=false
```

`PORT` is supplied by the service workflow. The API uses port 8080 in its artifact configuration.

## ESP32 endpoint

The device sends one window to:

```text
POST /api/sensor/data
Content-Type: application/json
```

Required fields:

```json
{
  "samplingRate": 1000,
  "samples": ["exactly 1000 finite ADC amplitudes from 0 to 4095"]
}
```

The request may also include device-computed `mean`, `rms`, `peak`, `stdDev`, `energy`, `crestFactor`, and `eventsPerSecond` fields. The API validates provided values but recomputes the authoritative features from `samples`. It stores those processed values, updates the latest in-memory window, and broadcasts the resulting snapshot as the Socket.IO `sensor:update` event.

## Read endpoints

- `GET /api/sensor/latest` — current processed window plus its 1,000 live samples.
- `GET /api/sensor/history?limit=20` — recent stored measurements (limit 1–100).
- `POST /api/sensor/data` — ingest one ESP32 window.
