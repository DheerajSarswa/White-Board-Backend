class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const publicError = (error) => {
  if (error instanceof AppError) return { status: error.status, message: error.message };
  if (error.code === 11000) return { status: 409, message: "An account with this email already exists" };
  if (error.type === "entity.too.large") return { status: 413, message: "Request is too large (maximum 2 MB)" };
  if (error.type === "entity.parse.failed") return { status: 400, message: "Invalid JSON body" };
  if (error.name === "ValidationError" || error.name === "CastError") {
    return { status: 400, message: "Invalid request data" };
  }
  return { status: 500, message: "An unexpected server error occurred" };
};

const sendError = (res, error) => {
  const { status, message } = publicError(error);
  if (status === 500) console.error("Request failed:", error.name);
  return res.status(status).json({ success: false, message });
};

module.exports = { AppError, publicError, sendError };
