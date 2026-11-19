const Canvas = require("./models/canvasModel");
const { authenticateSocket } = require("./middlewares/socketAuth");
const { AppError, publicError } = require("./utils/errors");
const { isRecord, requireValid, validateId, validateElements, finite } = require("./utils/validation");

module.exports = (io, isReady) => {
  io.use(authenticateSocket);
  io.on("connection", (socket) => {
    const handle = (event, handler) => socket.on(event, async (data, ack) => {
      try {
        if (!isReady()) throw new AppError(503, "Database is unavailable");
        const result = await handler(data);
        if (typeof ack === "function") ack({ success: true, ...result });
      } catch (error) {
        const { status, message } = publicError(error);
        const payload = { success: false, status, message };
        if (typeof ack === "function") ack(payload);
        else socket.emit("error", payload);
      }
    });
    const authorizeEvent = async (data) => {
      requireValid(isRecord(data), "An event object is required");
      validateId(data.canvasId);
      if (!socket.rooms.has(data.canvasId)) throw new AppError(403, "Join an authorized canvas before sending events");
      // Recheck permissions: a room alone is not proof that a canvas still exists.
      await Canvas.authorizeCanvas(data.canvasId, socket.email);
    };
    handle("join-canvas", async (id) => {
      validateId(id);
      await Canvas.authorizeCanvas(id, socket.email);
      if (!socket.rooms.has(id)) {
        await socket.join(id);
        socket.to(id).emit("user-joined", { userEmail: socket.email, timestamp: new Date() });
      }
      return { canvasId: id };
    });
    handle("leave-canvas", async (id) => {
      validateId(id);
      if (socket.rooms.has(id)) {
        await socket.leave(id);
        socket.to(id).emit("user-left", { userEmail: socket.email, timestamp: new Date() });
      }
    });
    handle("canvas-update", async (data) => {
      await authorizeEvent(data);
      const elements = validateElements(data.elements);
      socket.to(data.canvasId).emit("canvas-updated", { elements, updatedBy: socket.email, timestamp: new Date() });
    });
    handle("cursor-move", async (data) => {
      await authorizeEvent(data);
      requireValid(isRecord(data.position) && finite(data.position.x) && finite(data.position.y), "Invalid cursor position");
      socket.to(data.canvasId).emit("cursor-moved", { position: { x: data.position.x, y: data.position.y }, userEmail: socket.email, timestamp: new Date() });
    });
    handle("user-presence", async (data) => {
      await authorizeEvent(data);
      requireValid(["join", "leave"].includes(data.action), "Invalid presence action");
      socket.to(data.canvasId).emit("user-presence-changed", { userEmail: socket.email, action: data.action, timestamp: new Date() });
    });
    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (room !== socket.id) socket.to(room).emit("user-left", { userEmail: socket.email, timestamp: new Date() });
      }
    });
  });
};
