import {
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  serial,
  timestamp
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
const sensorSignalStatus = pgEnum("sensor_signal_status", [
  "DETECTED",
  "NO SIGNAL"
]);
const sensorHealthState = pgEnum("sensor_health_state", [
  "HEALTHY",
  "CRITICAL",
  "FAULTY"
]);
const sensorMeasurementsTable = pgTable("sensor_measurements", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  samplingRate: integer("sampling_rate").notNull(),
  sampleCount: integer("sample_count").notNull(),
  mean: doublePrecision("mean").notNull(),
  rms: doublePrecision("rms").notNull(),
  peak: doublePrecision("peak").notNull(),
  stdDev: doublePrecision("std_dev").notNull(),
  energy: doublePrecision("energy").notNull(),
  crestFactor: doublePrecision("crest_factor").notNull(),
  eventsPerSecond: doublePrecision("events_per_second").notNull(),
  signalStatus: sensorSignalStatus("signal_status").notNull(),
  // MOSFET health reported by the ESP32 (H/C/F). Nullable: rows stored before
  // this column existed, or windows posted without a health value, are NULL.
  healthState: sensorHealthState("health_state"),
  currentEventCount: integer("current_event_count").notNull()
});
const insertSensorMeasurementSchema = createInsertSchema(
  sensorMeasurementsTable
).omit({ id: true, timestamp: true });
export {
  insertSensorMeasurementSchema,
  sensorHealthState,
  sensorMeasurementsTable,
  sensorSignalStatus
};
