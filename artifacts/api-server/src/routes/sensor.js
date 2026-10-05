import { Router } from "express";
import { desc } from "drizzle-orm";
import {
  db,
  sensorMeasurementsTable
} from "@workspace/db";
import {
  GetSensorHistoryQueryParams,
  GetSensorHistoryResponse,
  GetSensorLatestResponse,
  PostSensorDataBody,
  PostSensorDataResponse
} from "@workspace/api-zod";
import {
  createAndStoreMeasurement,
  getLatestSensorSnapshot,
  normalizeHealthState
} from "../services/sensor";
import { logger } from "../lib/logger";
const router = Router();
router.get("/sensor/latest", (_req, res) => {
  const latest = getLatestSensorSnapshot();
  if (!latest) {
    res.status(404).json({ error: "No sensor measurement has been received" });
    return;
  }
  res.json(GetSensorLatestResponse.parse(latest));
});
router.get("/sensor/history", async (req, res) => {
  const parsed = GetSensorHistoryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db.select().from(sensorMeasurementsTable).orderBy(desc(sensorMeasurementsTable.timestamp)).limit(parsed.data.limit);
  res.json(
    GetSensorHistoryResponse.parse({
      measurements: rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp.toISOString(),
        samplingRate: row.samplingRate,
        sampleCount: row.sampleCount,
        rms: row.rms,
        peak: row.peak,
        energy: row.energy,
        eventsPerSecond: row.eventsPerSecond,
        signalStatus: row.signalStatus,
        healthState: row.healthState ?? null
      }))
    })
  );
});
router.post("/sensor/data", async (req, res) => {
  const parsed = PostSensorDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const invalidSampleIndex = parsed.data.samples.findIndex(
    (sample) => !Number.isFinite(sample) || sample < 0 || sample > 4095
  );
  if (invalidSampleIndex !== -1) {
    res.status(400).json({
      error: `Sample ${invalidSampleIndex} must be a finite ADC amplitude between 0 and 4095`
    });
    return;
  }
  const deviceMetrics = [
    "mean",
    "rms",
    "peak",
    "stdDev",
    "energy",
    "crestFactor",
    "eventsPerSecond"
  ];
  for (const key of deviceMetrics) {
    const value = parsed.data[key];
    if (value !== void 0 && (!Number.isFinite(value) || value < 0)) {
      res.status(400).json({
        error: `${key} must be a finite non-negative number`
      });
      return;
    }
  }
  const healthState = normalizeHealthState(parsed.data.healthState);
  if (!healthState) {
    logger.warn(
      {
        receivedHealthState: req.body?.healthState ?? null,
        receivedKeys: Object.keys(req.body ?? {}).filter((key) => key !== "samples")
      },
      "POST /sensor/data received without a valid healthState (expected H, C or F under the key \"healthState\")"
    );
  }
  const measurement = await createAndStoreMeasurement(
    parsed.data.samples,
    "CONNECTED",
    healthState
  );
  res.status(201).json(PostSensorDataResponse.parse(measurement));
});
var sensor_default = router;
export {
  sensor_default as default
};
