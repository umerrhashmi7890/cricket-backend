import express from "express";
import {
  validatePromoCode,
  getAllPromoCodes,
  getPromoCodeById,
  createPromoCode,
  updatePromoCode,
  togglePromoCodeStatus,
  deletePromoCode,
} from "../controllers/promoCode.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

const router = express.Router();

// Public route
router.post("/validate", validatePromoCode);

// Protected routes (Admin only)
router.get("/", authenticate, requireAdmin, getAllPromoCodes);
router.get("/:id", authenticate, requireAdmin, getPromoCodeById);
router.post("/", authenticate, requireAdmin, createPromoCode);
router.put("/:id", authenticate, requireAdmin, updatePromoCode);
router.patch("/:id/toggle", authenticate, requireAdmin, togglePromoCodeStatus);
router.delete("/:id", authenticate, requireAdmin, deletePromoCode);

export default router;
