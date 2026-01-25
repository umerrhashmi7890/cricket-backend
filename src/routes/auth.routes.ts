import express from "express";
import {
  register,
  login,
  getProfile,
  verifyToken,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.get("/profile", authenticate, getProfile);
router.get("/verify", authenticate, verifyToken);

export default router;
