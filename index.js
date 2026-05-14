require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const connectToDatabase = require("./db");
const userRoute = require("./routes/userRoute");
const canvasRoute = require("./routes/canvasRoute");
const { authenticateSocket } = require("./middlewares/socketAuth");
const { setIo } = require("./utils/socketManager");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

setIo(io);

io.use(authenticateSocket);
connectToDatabase();

app.use(cors());
app.use(express.json());

app.use("/api/users", userRoute);
app.use("/api/canvases", canvasRoute);

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id} (${socket.email})`);

  socket.on("join-canvas", async (canvasId) => {
    try {
      const Canvas = require("./models/canvasModel");
      const User = require("./models/userModel");

      const user = await User.findOne({ email: socket.email });
      if (!user) {
        socket.emit("error", { message: "User not authenticated" });
        return;
      }

      const canvas = await Canvas.findOne({
        _id: canvasId,
        $or: [{ owner: user._id }, { shared_with: user._id }],
      });

      if (!canvas) {
        socket.emit("error", { message: "Access denied to canvas" });
        return;
      }

      socket.join(canvasId);
      console.log(`User ${socket.email} joined canvas room: ${canvasId}`);

      socket.to(canvasId).emit("user-joined", {
        userEmail: socket.email,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error joining canvas room:", error);
      socket.emit("error", { message: "Failed to join canvas room" });
    }
  });

  socket.on("leave-canvas", (canvasId) => {
    socket.leave(canvasId);
    console.log(`User ${socket.email} left canvas room: ${canvasId}`);

    socket.to(canvasId).emit("user-left", {
      userEmail: socket.email,
      timestamp: new Date(),
    });
  });

  socket.on("canvas-update", (data) => {
    const { canvasId, elements } = data;

    socket.to(canvasId).emit("canvas-updated", {
      elements,
      updatedBy: socket.email,
      timestamp: new Date(),
    });
  });

  socket.on("cursor-move", (data) => {
    const { canvasId, position } = data;
    socket.to(canvasId).emit("cursor-moved", {
      position,
      userEmail: socket.email,
      timestamp: new Date(),
    });
  });

  socket.on("user-presence", (data) => {
    const { canvasId, action } = data;
    socket.to(canvasId).emit("user-presence-changed", {
      userEmail: socket.email,
      action,
      timestamp: new Date(),
    });
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3030;
server.listen(PORT, () => {
  console.log(`Server is running on port-${PORT}`);
});
