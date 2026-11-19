const jwt = require("jsonwebtoken");
const issueToken = (user) => jwt.sign({ email: user.email }, process.env.JWT_SECRET);
const verifyToken = (token) => {
  if (typeof token !== "string") throw new Error("Invalid token");
  const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  if (!payload || typeof payload.email !== "string" || !payload.email.trim()) {
    throw new Error("Invalid token identity");
  }
  return payload;
};
module.exports = { issueToken, verifyToken };
