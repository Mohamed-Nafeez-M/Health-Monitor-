# Sensor Signal Dashboard — JavaScript source bundle

A JavaScript/JSX edition of the full-stack ESP32 envelope-signal dashboard. The original Replit workspace is unchanged.

## Requirements

- Node.js 20.19 or newer and npm.
- A reachable PostgreSQL database. This archive includes the Drizzle schema, not a database server or credentials.

## Install and configure

From this directory, install the dependencies:

```sh
npm install
```

Set `DATABASE_URL` in your shell to a PostgreSQL connection string, then create/update the schema:

```sh
npm run db:push
```

For macOS/Linux:

```sh
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE'
npm run db:push
```

For Windows PowerShell:

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@HOST:5432/DATABASE'
npm run db:push
```

Keep real database credentials out of source files and version control.

## Run locally

From this directory, start both the API and dashboard together:

```sh
npm run dev
```

Open `http://localhost:5173`. The API listens on port 8080, and the local Vite config proxies `/api` and `/api/socket.io` to it. You can set `API_PORT` or `DASHBOARD_PORT` to use different ports.

Demo mode generates representative envelope readings by default. To stop simulated readings when hardware is sending data, set `SENSOR_DEMO_MODE=false` for the API process. The ESP32 posts each 1,000-sample window to `POST /api/sensor/data`; see `SENSOR_DASHBOARD.md` for request and response details.
