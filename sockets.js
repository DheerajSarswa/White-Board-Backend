const Canvas = require("./models/canvasModel");
const { authenticateSocket } = require("./middlewares/socketAuth");
const { AppError, publicError } = require("./utils/errors");
const { isRecord, requireValid, validateId, validateElementId, validateElements, validateEditId, validateCanvasEdit, finite } = require("./utils/validation");
const { canvasSnapshot } = require("./utils/canvasElements");

module.exports = (io, isReady) => {
  io.use(authenticateSocket);
  io.on("connection", (socket) => {
    const joins = new Map();
    const handle = (event, handler, { requiresDatabase = true } = {}) => socket.on(event, async (data, ack) => {
      try {
        if (requiresDatabase && !isReady()) throw new AppError(503, "Database is unavailable");
        const result = await handler(data);
        if (typeof ack === "function") ack({ success: true, ...result });
      } catch (error) {
        const { status, message } = publicError(error);
        const payload = { success: false, status, message };
        if (typeof ack === "function") ack(payload);
        else socket.emit("error", payload);
      }
    });
    const requireRoom = (data) => {
      requireValid(isRecord(data), "An event object is required");
      validateId(data.canvasId);
      if (!socket.rooms.has(data.canvasId)) throw new AppError(403, "Join an authorized canvas before sending events");
    };
    const authorizeEvent = async (data) => {
      requireRoom(data);
      // Recheck permissions: a room alone is not proof that a canvas still exists.
      await Canvas.authorizeCanvas(data.canvasId, socket.email);
    };
    const clearPreviews = (canvasId) => {
      const room = socket.to(canvasId);
      room.emit("canvas-preview", { canvasId, sender: socket.id, element: null });
      room.emit("canvas-edit-preview", { canvasId, sender: socket.id, edit: null });
    };
    handle("join-canvas", async (id) => {
      validateId(id);
      const request = Symbol();
      joins.set(id, request);
      try {
        await Canvas.authorizeCanvas(id, socket.email);
        if (!socket.connected || joins.get(id) !== request) return {};
      } finally {
        if (joins.get(id) === request) joins.delete(id);
      }
      if (!socket.rooms.has(id)) {
        await socket.join(id);
        socket.to(id).emit("user-joined", { userEmail: socket.email, timestamp: new Date() });
      }
      const canvas = await Canvas.findById(id).select("elements revision");
      if (!canvas) {
        await socket.leave(id);
        throw new AppError(403, "Canvas not found or access denied");
      }
      return canvasSnapshot(canvas);
    });
    handle("leave-canvas", async (id) => {
      validateId(id);
      joins.delete(id);
      if (socket.rooms.has(id)) {
        await socket.leave(id);
        clearPreviews(id);
        socket.to(id).emit("user-left", { userEmail: socket.email, timestamp: new Date() });
      }
    });
    handle("canvas-preview", (data) => {
      requireRoom(data);
      const { canvasId, elementId } = data;
      if (data.element === null) {
        validateElementId(elementId);
        socket.to(canvasId).emit("canvas-preview", { canvasId, sender: socket.id, element: null, elementId });
      } else {
        const [element] = validateElements([data.element]);
        socket.to(canvasId).volatile.emit("canvas-preview", { canvasId, sender: socket.id, element });
      }
    });
    handle("canvas-edit-preview", (data) => {
      requireRoom(data);
      const { canvasId, editId, draft } = data;
      validateEditId(editId);
      requireValid(data.edit === null || isRecord(data.edit), "Invalid canvas edit preview");
      const edit = data.edit === null ? null : validateCanvasEdit({ ...data.edit, editId });
      const room = socket.to(canvasId);
      const broadcast = edit && draft === true ? room.volatile : room;
      broadcast.emit("canvas-edit-preview", { canvasId, sender: socket.id, editId, edit });
    }, { requiresDatabase: false });
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
        if (room === socket.id) continue;
        clearPreviews(room);
        socket.to(room).emit("user-left", { userEmail: socket.email, timestamp: new Date() });
      }
    });
  });
};
