import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../utils/ApiError";

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
        email: string;
        role: string;
      };
    }
  }
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("No token provided");
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key-change-in-production"
    ) as any;

    // Attach user to request
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error: any) {
    if (error.name === "TokenExpiredError") {
      throw new UnauthorizedError("Token expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new UnauthorizedError("Invalid token");
    }
    throw new UnauthorizedError("Authentication failed");
  }
};

// Check if user is super admin
export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.user?.role !== "super_admin") {
    throw new UnauthorizedError("Super admin access required");
  }
  next();
};

// Check if user is admin or super admin
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!["admin", "super_admin"].includes(req.user?.role || "")) {
    throw new UnauthorizedError("Admin access required");
  }
  next();
};
