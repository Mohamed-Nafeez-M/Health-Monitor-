import * as zod from "zod";
const HealthCheckResponse = zod.object({
  "status": zod.string()
});
const getSensorLatestResponseSamplesMin = 1e3;
const getSensorLatestResponseSamplesMax = 1e3;
const GetSensorLatestResponse = zod.object({
  "id": zod.number().int(),
  "timestamp": zod.coerce.date(),
  "samples": zod.array(zod.number()).min(getSensorLatestResponseSamplesMin).max(getSensorLatestResponseSamplesMax),
  "samplingRate": zod.literal(1e3),
  "sampleCount": zod.number().int(),
  "mean": zod.number(),
  "rms": zod.number(),
  "peak": zod.number(),
  "stdDev": zod.number(),
  "energy": zod.number(),
  "crestFactor": zod.number(),
  "eventsPerSecond": zod.number(),
  "signalStatus": zod.enum(["DETECTED", "NO SIGNAL"]),
  "healthState": zod.enum(["HEALTHY", "CRITICAL", "FAULTY"]).nullable(),
  "connectionStatus": zod.enum(["DEMO MODE", "CONNECTED", "DISCONNECTED"]),
  "currentEventCount": zod.number().int()
});
const getSensorHistoryQueryLimitDefault = 25;
const getSensorHistoryQueryLimitMax = 100;
const GetSensorHistoryQueryParams = zod.object({
  "limit": zod.coerce.number().int().min(1).max(getSensorHistoryQueryLimitMax).default(getSensorHistoryQueryLimitDefault)
});
const GetSensorHistoryResponse = zod.object({
  "measurements": zod.array(zod.object({
    "id": zod.number().int(),
    "timestamp": zod.coerce.date(),
    "samplingRate": zod.number().int(),
    "sampleCount": zod.number().int(),
    "rms": zod.number(),
    "peak": zod.number(),
    "energy": zod.number(),
    "eventsPerSecond": zod.number(),
    "signalStatus": zod.enum(["DETECTED", "NO SIGNAL"]),
    "healthState": zod.enum(["HEALTHY", "CRITICAL", "FAULTY"]).nullable()
  }))
});
const postSensorDataBodySamplesMin = 1e3;
const postSensorDataBodySamplesMax = 1e3;
const PostSensorDataBody = zod.object({
  "samples": zod.array(zod.number()).min(postSensorDataBodySamplesMin).max(postSensorDataBodySamplesMax),
  "samplingRate": zod.literal(1e3),
  "healthState": zod.preprocess(
    (value) => typeof value === "string" ? value.trim().toUpperCase() : value,
    zod.enum(["H", "C", "F", "HEALTHY", "CRITICAL", "FAULTY"]).optional()
  ).describe("MOSFET health reported by the ESP32: H/HEALTHY, C/CRITICAL or F/FAULTY."),
  "mean": zod.number().optional().describe("Optional device-computed metric; the server recomputes it from samples."),
  "rms": zod.number().optional().describe("Optional device-computed metric; the server recomputes it from samples."),
  "peak": zod.number().optional().describe("Optional device-computed metric; the server recomputes it from samples."),
  "stdDev": zod.number().optional().describe("Optional device-computed metric; the server recomputes it from samples."),
  "energy": zod.number().optional().describe("Optional device-computed metric; the server recomputes it from samples."),
  "crestFactor": zod.number().optional().describe("Optional device-computed metric; the server recomputes it from samples."),
  "eventsPerSecond": zod.number().optional().describe("Optional device-computed metric; the server recomputes it from samples.")
});
const postSensorDataResponseSamplesMin = 1e3;
const postSensorDataResponseSamplesMax = 1e3;
const PostSensorDataResponse = zod.object({
  "id": zod.number().int(),
  "timestamp": zod.coerce.date(),
  "samples": zod.array(zod.number()).min(postSensorDataResponseSamplesMin).max(postSensorDataResponseSamplesMax),
  "samplingRate": zod.literal(1e3),
  "sampleCount": zod.number().int(),
  "mean": zod.number(),
  "rms": zod.number(),
  "peak": zod.number(),
  "stdDev": zod.number(),
  "energy": zod.number(),
  "crestFactor": zod.number(),
  "eventsPerSecond": zod.number(),
  "signalStatus": zod.enum(["DETECTED", "NO SIGNAL"]),
  "healthState": zod.enum(["HEALTHY", "CRITICAL", "FAULTY"]).nullable(),
  "connectionStatus": zod.enum(["DEMO MODE", "CONNECTED", "DISCONNECTED"]),
  "currentEventCount": zod.number().int()
});
export {
  GetSensorHistoryQueryParams,
  GetSensorHistoryResponse,
  GetSensorLatestResponse,
  HealthCheckResponse,
  PostSensorDataBody,
  PostSensorDataResponse,
  getSensorHistoryQueryLimitDefault,
  getSensorHistoryQueryLimitMax,
  getSensorLatestResponseSamplesMax,
  getSensorLatestResponseSamplesMin,
  postSensorDataBodySamplesMax,
  postSensorDataBodySamplesMin,
  postSensorDataResponseSamplesMax,
  postSensorDataResponseSamplesMin
};
