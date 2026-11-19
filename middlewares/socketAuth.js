const { verifyToken } = require("../utils/tokens");
const authenticateSocket = (socket, next) => {
  try {
    const decoded = verifyToken(socket.handshake.auth?.token);
    socket.email = decoded.email;
    next();
  } catch {
    next(new Error("Your session is invalid or expired. Please log in again."));
  }
};
module.exports = { authenticateSocket };
