import express from "express";
import {
  getDashboardStats,
  getDashboardBookings,
  getDashboardCourtUtilization,
  getRevenueSummary,
} from "../controllers/dashboard.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

const router = express.Router();

// All dashboard routes require admin authentication
router.use(authenticate, requireAdmin);

// Dashboard stats
router.get("/stats", getDashboardStats);

// Today's bookings
router.get("/bookings", getDashboardBookings);

// Court utilization
router.get("/court-utilization", getDashboardCourtUtilization);

// Revenue summary
router.get("/revenue-summary", getRevenueSummary);

export default router;
