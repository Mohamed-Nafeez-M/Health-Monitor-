import { Server as SocketIOServer } from "socket.io";
import { logger } from "./logger";
let io = null;
function attachSensorSocketServer(server) {
  io = new SocketIOServer(server, {
    path: "/api/socket.io",
    cors: {
      origin: true
    }
  });
  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Dashboard client connected");
    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, reason }, "Dashboard client disconnected");
    });
  });
}
function broadcastSensorUpdate(snapshot) {
  io?.emit("sensor:update", snapshot);
}
export {
  attachSensorSocketServer,
  broadcastSensorUpdate
};
