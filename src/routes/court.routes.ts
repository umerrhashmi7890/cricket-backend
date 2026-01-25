import express from "express";
import {
  getAllCourts,
  getCourtById,
  createCourt,
  updateCourt,
  deleteCourt,
  toggleCourtStatus,
  seedCourts,
} from "../controllers/court.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";
import { upload } from "../middleware/upload";

const router = express.Router();

// Public routes
router.get("/", getAllCourts);
router.get("/:id", getCourtById);

// Protected admin routes
router.post(
  "/",
  authenticate,
  requireAdmin,
  upload.single("image"),
  createCourt,
);
router.put(
  "/:id",
  authenticate,
  requireAdmin,
  upload.single("image"),
  updateCourt,
);
router.delete("/:id", authenticate, requireAdmin, deleteCourt);
router.patch("/:id/status", authenticate, requireAdmin, toggleCourtStatus);

// Development/Seed route
router.post("/seed/all", seedCourts);

export default router;
