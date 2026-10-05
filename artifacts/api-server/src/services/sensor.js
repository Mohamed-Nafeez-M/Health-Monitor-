import { db, sensorMeasurementsTable } from "@workspace/db";
import { GetSensorLatestResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { broadcastSensorUpdate } from "../lib/realtime";
let latestSnapshot = null;
let demoTimer;
let demoWindowIndex = 0;
let lastDeviceDataAt = 0;
const DEVICE_TIMEOUT_MS = Number(process.env.DEVICE_TIMEOUT_MS) > 0 ? Number(process.env.DEVICE_TIMEOUT_MS) : 5e3;
const HEALTH_STATE_MAP = {
  H: "HEALTHY",
  HEALTHY: "HEALTHY",
  C: "CRITICAL",
  CRITICAL: "CRITICAL",
  F: "FAULTY",
  FAULTY: "FAULTY"
};
function normalizeHealthState(value) {
  return typeof value === "string" ? HEALTH_STATE_MAP[value.trim().toUpperCase()] ?? null : null;
}
function isDeviceRecentlyActive() {
  return Date.now() - lastDeviceDataAt < DEVICE_TIMEOUT_MS;
}
function getLatestSensorSnapshot() {
  return latestSnapshot;
}
function extractFeatures(samples) {
  const sampleCount = samples.length;
  const mean = samples.reduce((sum, sample) => sum + sample, 0) / sampleCount;
  const energy = samples.reduce((sum, sample) => sum + sample * sample, 0);
  const rms = Math.sqrt(energy / sampleCount);
  const variance = samples.reduce((sum, sample) => sum + (sample - mean) ** 2, 0) / sampleCount;
  const stdDev = Math.sqrt(variance);
  const peak = Math.max(...samples);
  const eventThreshold = mean + Math.max(35, stdDev * 1.15);
  let currentEventCount = 0;
  let aboveThreshold = false;
  for (const sample of samples) {
    if (sample > eventThreshold && !aboveThreshold) {
      currentEventCount += 1;
      aboveThreshold = true;
    } else if (sample <= eventThreshold * 0.72) {
      aboveThreshold = false;
    }
  }
  const signalStatus = peak - mean >= 80 ? "DETECTED" : "NO SIGNAL";
  return {
    samplingRate: 1e3,
    sampleCount,
    mean,
    rms,
    peak,
    stdDev,
    energy,
    crestFactor: rms === 0 ? 0 : peak / rms,
    eventsPerSecond: currentEventCount,
    currentEventCount,
    signalStatus
  };
}
async function createAndStoreMeasurement(samples, connectionStatus, healthState = null) {
  if (connectionStatus === "CONNECTED") lastDeviceDataAt = Date.now();
  const features = extractFeatures(samples);
  const [stored] = await db.insert(sensorMeasurementsTable).values({
    ...features,
    signalStatus: features.signalStatus,
    healthState,
    samplingRate: 1e3,
    sampleCount: samples.length
  }).returning();
  const snapshot = GetSensorLatestResponse.parse({
    id: stored.id,
    timestamp: stored.timestamp.toISOString(),
    samples,
    ...features,
    healthState,
    connectionStatus
  });
  latestSnapshot = snapshot;
  broadcastSensorUpdate(snapshot);
  return snapshot;
}
function smoothstep(value) {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}
function createDemoWindow(windowIndex) {
  const count = 1e3;
  const eventCount = windowIndex % 5 === 0 ? 1 : windowIndex % 3 === 0 ? 3 : 2;
  const eventCenters = Array.from({ length: eventCount }, (_, index) => {
    const spread = eventCount === 1 ? 0 : index / (eventCount - 1);
    return 0.16 + spread * 0.66 + (Math.random() - 0.5) * 0.06;
  });
  const eventAmplitudes = eventCenters.map(
    () => 760 + Math.random() * 1050
  );
  return Array.from({ length: count }, (_, index) => {
    const time = index / 1e3;
    let envelope = 0;
    for (let eventIndex = 0; eventIndex < eventCenters.length; eventIndex += 1) {
      const age = time - eventCenters[eventIndex];
      if (age < 0) continue;
      const attackSeconds = 0.065;
      const decaySeconds = age - attackSeconds;
      const shape = age < attackSeconds ? smoothstep(age / attackSeconds) : Math.exp(-0.5 * (decaySeconds / 0.14) ** 2);
      envelope += eventAmplitudes[eventIndex] * shape;
    }
    const baseline = 82 + 7 * Math.sin(2 * Math.PI * time * 3.2) + 3 * Math.sin(2 * Math.PI * time * 17);
    const noise = (Math.random() - 0.5) * 22;
    return Math.max(0, Math.min(4095, baseline + envelope + noise));
  });
}
function startDemoGenerator() {
  if (process.env.SENSOR_DEMO_MODE?.toLowerCase() === "false") {
    logger.info("Sensor demo generator disabled by SENSOR_DEMO_MODE=false");
    return;
  }
  const emitDemoWindow = () => {
    if (isDeviceRecentlyActive()) return;
    const samples = createDemoWindow(demoWindowIndex);
    demoWindowIndex += 1;
    void createAndStoreMeasurement(samples, "DEMO MODE", "HEALTHY").catch((err) => {
      logger.error({ err }, "Unable to persist demo sensor measurement");
    });
  };
  emitDemoWindow();
  demoTimer = setInterval(emitDemoWindow, 1e3);
  logger.info("Sensor demo generator started at 1000 Hz");
}
function stopDemoGenerator() {
  if (demoTimer) clearInterval(demoTimer);
  demoTimer = void 0;
}
export {
  createAndStoreMeasurement,
  getLatestSensorSnapshot,
  normalizeHealthState,
  startDemoGenerator,
  stopDemoGenerator
};
