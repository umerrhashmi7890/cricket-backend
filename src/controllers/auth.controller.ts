import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin";
import { IAdminCreate, IAdminLogin } from "../types/admin.types";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
} from "../utils/ApiError";

// Generate JWT Token
const generateToken = (
  userId: string,
  username: string,
  email: string,
  role: string
) => {
  return jwt.sign(
    { userId, username, email, role },
    process.env.JWT_SECRET || "your-secret-key-change-in-production",
    { expiresIn: "7d" }
  );
};

// Register new admin (only super_admin should access this in production)
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { username, email, password, role }: IAdminCreate = req.body;

  // Validate required fields
  if (!username || !email || !password) {
    throw new BadRequestError("Username, email, and password are required");
  }

  // Check if admin already exists
  const existingAdmin = await Admin.findOne({
    $or: [{ username }, { email }],
  });

  if (existingAdmin) {
    if (existingAdmin.username === username) {
      throw new ConflictError("Username already exists");
    }
    if (existingAdmin.email === email) {
      throw new ConflictError("Email already exists");
    }
  }

  // Create admin
  const admin = await Admin.create({
    username,
    email,
    password,
    role: role || "admin",
  });

  // Generate token
  const token = generateToken(
    admin.id,
    admin.username,
    admin.email,
    admin.role
  );

  res.status(201).json({
    success: true,
    message: "Admin registered successfully",
    data: {
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
      token,
    },
  });
});

// Login admin
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { username, password }: IAdminLogin = req.body;

  // Validate input
  if (!username || !password) {
    throw new BadRequestError("Username and password are required");
  }

  // Find admin and include password
  const admin = await Admin.findOne({ username }).select("+password");

  if (!admin) {
    throw new UnauthorizedError("Invalid credentials");
  }

  // Check if admin is active
  if (!admin.isActive) {
    throw new UnauthorizedError("Account is deactivated");
  }

  // Verify password
  const isPasswordValid = await admin.comparePassword(password);

  if (!isPasswordValid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  // Update last login
  admin.lastLogin = new Date();
  await admin.save();

  // Generate token
  const token = generateToken(
    admin.id,
    admin.username,
    admin.email,
    admin.role
  );

  res.json({
    success: true,
    message: "Login successful",
    data: {
      admin: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
      },
      token,
    },
  });
});

// Get current admin profile
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const admin = await Admin.findById(req.user?.userId);

  if (!admin) {
    throw new UnauthorizedError("Admin not found");
  }

  res.json({
    success: true,
    data: admin,
  });
});

// Verify token (for frontend to check if logged in)
export const verifyToken = asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Token is valid",
    data: {
      user: req.user,
    },
  });
});
