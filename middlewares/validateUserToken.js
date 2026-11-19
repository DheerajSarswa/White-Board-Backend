const { verifyToken } = require("../utils/tokens");
module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  const match = typeof header === "string" && /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return res.status(401).json({ success: false, message: "Authentication required" });
  try {
    req.email = verifyToken(match[1]).email;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Your session is invalid or expired. Please log in again." });
  }
};
