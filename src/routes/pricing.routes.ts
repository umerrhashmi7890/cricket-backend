import express from "express";
import {
  getAllPricingRules,
  getPricingRuleById,
  createPricingRule,
  updatePricingRule,
  deletePricingRule,
  initializePricingRules,
  seedPricingRules,
  calculatePrice,
  getCurrentPricing,
} from "../controllers/pricing.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

const router = express.Router();

// Public routes (for booking flow)
router.get("/current", getCurrentPricing);
router.post("/calculate", calculatePrice);

// Protected admin routes
router.get("/", getAllPricingRules);
router.get("/:id", authenticate, requireAdmin, getPricingRuleById);
router.post("/", authenticate, requireAdmin, createPricingRule);
router.post("/initialize", authenticate, requireAdmin, initializePricingRules);
router.post("/seed/all", seedPricingRules);
router.put("/:id", authenticate, requireAdmin, updatePricingRule);
router.delete("/:id", authenticate, requireAdmin, deletePricingRule);

export default router;
