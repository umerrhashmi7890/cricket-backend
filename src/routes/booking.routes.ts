import express from "express";
import {
  checkAvailability,
  checkBatchAvailability,
  createBooking,
  createManualBooking,
  getAllBookings,
  getBookingById,
  getBookingByPaymentId,
  updateBookingStatus,
  updatePayment,
  updateBooking,
  cancelBooking,
  getCalendarBookings,
} from "../controllers/booking.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

const router = express.Router();

// Public routes
router.post("/check-availability", checkAvailability);
router.post("/check-batch-availability", checkBatchAvailability);
router.post("/", createBooking);
router.get("/by-payment/:paymentId", getBookingByPaymentId); // Get booking by payment ID
router.patch("/:id/cancel", cancelBooking); // Public - customer can cancel

// Protected routes (Admin only - before :id to prevent conflicts)
router.get("/calendar", authenticate, requireAdmin, getCalendarBookings);
router.get("/", authenticate, requireAdmin, getAllBookings);
router.post("/manual", authenticate, requireAdmin, createManualBooking);

// Parameterized route (must be last)
router.get("/:id", getBookingById);
router.patch("/:id/status", authenticate, requireAdmin, updateBookingStatus);
router.patch("/:id/payment", authenticate, requireAdmin, updatePayment);
router.put("/:id", authenticate, requireAdmin, updateBooking);

export default router;
