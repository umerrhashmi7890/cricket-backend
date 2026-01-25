import express from "express";
import {
  getAllCustomers,
  getCustomerById,
  getCustomerByPhone,
  createCustomer,
  findOrCreateCustomer,
  updateCustomer,
  deleteCustomer,
} from "../controllers/customer.controller";
import { authenticate, requireAdmin } from "../middleware/auth.middleware";

const router = express.Router();

// Public routes (for booking flow)
router.get("/phone/:phone", getCustomerByPhone);
router.post("/find-or-create", findOrCreateCustomer);

// Protected admin routes
router.get("/", authenticate, requireAdmin, getAllCustomers);
router.get("/:id", authenticate, requireAdmin, getCustomerById);
router.post("/", authenticate, requireAdmin, createCustomer);
router.put("/:id", authenticate, requireAdmin, updateCustomer);
router.delete("/:id", authenticate, requireAdmin, deleteCustomer);

export default router;
