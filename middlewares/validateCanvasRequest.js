const { isRecord, requireValid, validateId, validateEmail, validateName, validateElements } = require("../utils/validation");
const { sendError } = require("../utils/errors");
module.exports = (kind) => (req, res, next) => {
  try {
    if (req.params.id !== undefined) validateId(req.params.id);
    if (["create", "update", "share"].includes(kind)) requireValid(isRecord(req.body), "A JSON object is required");
    if (kind === "create") {
      if (req.body.name !== undefined) req.body.name = validateName(req.body.name);
      if (req.body.elements !== undefined) req.body.elements = validateElements(req.body.elements);
      requireValid(req.body.shared_with === undefined || (Array.isArray(req.body.shared_with) && req.body.shared_with.length === 0),
        "Use the share endpoint to share a canvas");
    }
    if (kind === "update") req.body.elements = validateElements(req.body.elements);
    if (kind === "share") req.body.sharedWithEmail = validateEmail(req.body.sharedWithEmail);
    next();
  } catch (error) { sendError(res, error); }
};
