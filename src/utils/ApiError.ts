// Custom API Error class
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Pre-defined error types for common scenarios
export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, `${resource} not found`);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string) {
    super(400, message);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = "Unauthorized access") {
    super(401, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = "Forbidden access") {
    super(403, message);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(422, message);
  }
}
