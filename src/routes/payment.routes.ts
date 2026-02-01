import express from "express";
import {
  createPaymentRequest,
  getPaymentStatus,
  handlePaymentCallback,
  refundPayment,
} from "../controllers/payment.controller";

const router = express.Router();

// Public routes
router.post("/create-request", createPaymentRequest); // Hosted checkout
router.get("/:paymentId", getPaymentStatus);
router.post("/callback", handlePaymentCallback);

// Admin routes (add auth middleware if needed)
router.post("/:paymentId/refund", refundPayment);

export default router;
