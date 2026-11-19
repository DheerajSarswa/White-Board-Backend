const validator = require("validator");
const { AppError } = require("./errors");
const requireValid = (condition, message) => {
  if (!condition) throw new AppError(400, message);
};
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const validateId = (id) => requireValid(typeof id === "string" && /^[a-f\d]{24}$/i.test(id), "Invalid canvas ID");
const validateEmail = (email) => {
  requireValid(typeof email === "string" && validator.isEmail(email.trim()), "A valid email is required");
  return email.trim();
};
const validateName = (name, maxLength = 200) => {
  requireValid(typeof name === "string" && name.trim().length > 0 && name.trim().length <= maxLength,
    `Name must contain between 1 and ${maxLength} characters`);
  return name.trim();
};
const finite = (value) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e7;
const shapeTypes = ["LINE", "RECTANGLE", "CIRCLE", "ARROW"];
const validateElements = (elements) => {
  requireValid(Array.isArray(elements) && elements.length <= 10000, "Elements must be an array of at most 10000 items");
  return elements.map((element) => {
    requireValid(isRecord(element), "Invalid drawing element");
    const { id, type, stroke, fill, size, x1, y1, x2, y2, points, text } = element;
    requireValid(Number.isSafeInteger(id) && id >= 0, "Invalid element ID");
    requireValid([...shapeTypes, "BRUSH", "TEXT"].includes(type), "Invalid drawing tool");
    requireValid(typeof stroke === "string" && /^#[a-f\d]{6}$/i.test(stroke), "Invalid stroke color");
    requireValid(typeof size === "number" && Number.isFinite(size) && size > 0 && size <= 256, "Invalid drawing size");
    const result = { id, type, stroke, size };
    if (type === "BRUSH") {
      requireValid(Array.isArray(points) && points.length > 0 && points.length <= 100000 &&
        points.every((point) => isRecord(point) && finite(point.x) && finite(point.y)), "Invalid brush points");
      result.points = points.map(({ x, y }) => ({ x, y }));
    } else {
      requireValid([x1, y1, x2, y2].every(finite), "Invalid drawing coordinates");
      Object.assign(result, { x1, y1, x2, y2 });
      if (type === "TEXT") {
        requireValid(typeof text === "string" && text.length <= 10000, "Invalid canvas text");
        result.text = text;
      }
      requireValid(fill == null || (typeof fill === "string" && /^#[a-f\d]{6}$/i.test(fill)), "Invalid fill color");
      result.fill = fill ?? null;
    }
    return result;
  });
};
module.exports = { requireValid, isRecord, validateId, validateEmail, validateName, validateElements, finite };
