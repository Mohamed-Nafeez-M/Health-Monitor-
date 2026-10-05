import "./lib/load-env";
import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachSensorSocketServer } from "./lib/realtime";
import { startDemoGenerator } from "./services/sensor";
const rawPort = process.env["PORT"];
if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided."
  );
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}
const server = createServer(app);
attachSensorSocketServer(server);
server.listen(port, () => {
  startDemoGenerator();
  logger.info({ port }, "Server listening");
});
server.on("error", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
});
