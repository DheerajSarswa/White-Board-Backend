const { isRecord, validateEmail, requireValid } = require("../utils/validation");
const { sendError } = require("../utils/errors");
module.exports = (req, res, next) => {
  try {
    requireValid(isRecord(req.body), "A JSON object is required");
    req.body.email = validateEmail(req.body.email);
    const password = req.body.password;
    requireValid(typeof password === "string" && password.length >= 8 && Buffer.byteLength(password, "utf8") <= 72,
      "Password must be at least 8 characters and at most 72 UTF-8 bytes");
    next();
  } catch (error) { sendError(res, error); }
};
