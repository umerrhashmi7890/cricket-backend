import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

// Global error handler middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Error:", err);

  // Handle API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Handle Mongoose validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: err.message,
    });
  }

  // Handle Mongoose duplicate key error
  if (err.name === "MongoServerError" && (err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern)[0];
    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  // Handle Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
    });
  }

  // Default error
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
};

// 404 handler
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};
