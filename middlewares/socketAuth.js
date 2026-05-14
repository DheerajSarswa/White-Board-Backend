const jwt = require("jsonwebtoken");

const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication token required"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    socket.email = decoded.email;
    next();
  } catch (error) {
    next(new Error("Invalid authentication token"));
  }
};

module.exports = { authenticateSocket };