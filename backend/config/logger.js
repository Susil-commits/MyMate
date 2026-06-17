import winston from "winston";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level.toUpperCase()}]: ${stack || message}${metaStr}`;
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    process.env.NODE_ENV === "production" ? winston.format.json() : combine(colorize(), logFormat)
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error", maxsize: 5242880, maxFiles: 5 }),
    new winston.transports.File({ filename: "logs/combined.log", maxsize: 5242880, maxFiles: 5 }),
  ],
});

export default logger;