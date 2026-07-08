import logger from "../config/logger.js";

export const errorHandler = (err, req, res, _next) => {
  logger.error(err.stack || err.message, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
  });

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(", ") });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid ID format" });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ message: `${field} already exists` });
  }

  if (err.name === "MulterError") {
    const messages = {
      LIMIT_FILE_SIZE: "File too large (max 5MB)",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field",
      LIMIT_FILE_COUNT: "Too many files",
    };
    return res.status(400).json({
      message: messages[err.code] || `Upload error: ${err.message}`,
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({ message: "Invalid token" });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Token expired" });
  }

  const isProduction = process.env.NODE_ENV === "production";

  res.status(err.status || 500).json({
    message: isProduction && (err.status || 500) === 500 ? "Internal server error" : err.message || "Internal server error",
  });
};