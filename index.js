require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectToDatabase = require("./db");
const { sendError } = require("./utils/errors");

const createServer = ({ isReady = () => mongoose.connection.readyState === 1 } = {}) => {
  const app = express();
  const server = http.createServer(app);
  const origin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
  const io = new Server(server, { cors: { origin, methods: ["GET", "POST"] }, maxHttpBufferSize: 2 * 1024 * 1024 });
  require("./utils/socketManager").setIo(io);
  app.disable("x-powered-by");
  app.use(cors({ origin }));
  app.get("/health", (req, res) => res.status(isReady() ? 200 : 503).json({ status: isReady() ? "ok" : "unavailable" }));
  app.use("/api", (req, res, next) => {
    if (!isReady()) return res.status(503).json({ success: false, message: "Database is unavailable. Please try again shortly." });
    next();
  });
  app.use(express.json({ limit: "2mb" }));
  app.use("/api/users", require("./routes/userRoute"));
  app.use("/api/canvases", require("./routes/canvasRoute"));
  app.use((req, res) => res.status(404).json({ success: false, message: "Route not found" }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    sendError(res, error);
  });
  require("./sockets")(io, isReady);
  return { app, server, io };
};

const start = async () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
  await connectToDatabase();
  const { server, io } = createServer();
  const port = process.env.PORT || 3030;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, resolve);
  });
  console.log(`Server is running on port-${port}`);
  const shutdown = () => {
    const deadline = setTimeout(() => process.exit(1), 10000);
    deadline.unref();
    io.close(async () => {
      await mongoose.disconnect();
      clearTimeout(deadline);
      process.exit(0);
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  return server;
};
if (require.main === module) {
  start().catch(async (error) => {
    console.error("Backend startup failed:", error.name, error.code || "Check database connection and environment settings");
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}
module.exports = { createServer, start };
