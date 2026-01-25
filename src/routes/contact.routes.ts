import { Router } from "express";
import { handleContactForm } from "../controllers/contact.controller";

const router = Router();

// POST /api/contact
router.post("/", handleContactForm);

export default router;
