// @ts-nocheck
import logger from "../config/logger.js";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";

const sendErrorDev = (err: any, res: Response) => {
  res.status(err.statusCode || 500).json({
    success: false,
    status: err.status || 'error',
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err: any, res: Response) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
    });
  } else {
    // 1) Log error
    logger.error("PROGRAMMING ERROR 💥", err);

    // 2) Send generic message
    res.status(500).json({
      success: false,
      status: "error",
      message: "Something went very wrong!",
    });
  }
};

export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction): any => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log all errors to winston that are not operational (i.e. bugs)
  if (!err.isOperational) {
    logger.error(err.stack || err.message, {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    });
  }

  const isProduction = process.env.NODE_ENV === "production";
  
  // Clone error object
  let error = { ...err };
  error.message = err.message;
  error.name = err.name;
  error.stack = err.stack;
  
  if (error.name === "ValidationError") {
    const messages = Object.values(err.errors || {}).map((e: any) => e.message);
    error = new AppError(messages.join(", "), 400);
  }

  if (error.name === "CastError") {
    error = new AppError("Invalid ID format", 400);
  }

  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0];
    error = new AppError(`Duplicate field value: ${field}. Please use another value!`, 400);
  }

  if (error.name === "MulterError") {
    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: "File too large (max 5MB)",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field",
      LIMIT_FILE_COUNT: "Too many files",
    };
    error = new AppError(messages[error.code] || `Upload error: ${error.message}`, 400);
  }

  if (error.name === "JsonWebTokenError") {
    error = new AppError("Invalid token. Please log in again.", 401);
  }

  if (error.name === "TokenExpiredError") {
    error = new AppError("Your token has expired. Please log in again.", 401);
  }

  if (isProduction) {
    sendErrorProd(error, res);
  } else {
    sendErrorDev(error, res);
  }
};