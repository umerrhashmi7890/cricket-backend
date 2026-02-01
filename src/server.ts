import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDatabase } from "./config/database";
import { EmailService } from "./services/email.service";
import authRoutes from "./routes/auth.routes";
import courtRoutes from "./routes/court.routes";
import customerRoutes from "./routes/customer.routes";
import pricingRoutes from "./routes/pricing.routes";
import bookingRoutes from "./routes/booking.routes";
import promoCodeRoutes from "./routes/promoCode.routes";
import contactRoutes from "./routes/contact.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import paymentRoutes from "./routes/payment.routes";
import { errorHandler, notFound } from "./middleware/errorHandler";
// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173", // Local development (Vite)
      "http://localhost:5174", // Alternative Vite port
      "http://localhost:8080", // Alternative dev port
      "https://www.jeddahcricketnets.com", // Production frontend
      "https://jeddahcricketnets.com", // Production frontend (without www)
      "https://api.jeddahcricketnets.com", // API subdomain
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test endpoint
app.get("/", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "🏏 Cricket Booking API is running!",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    success: true,
    status: "healthy",
    database: "connected",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Simple test endpoint
app.get("/api/test", (req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Backend is working perfectly! 🎉",
    data: {
      server: "Express + TypeScript",
      database: "MongoDB + Mongoose",
      status: "operational",
    },
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/courts", courtRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/promo-codes", promoCodeRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payments", paymentRoutes);

// 404 handler (must be after all routes)
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Test email service connection
    await EmailService.testConnection();

    // Start listening
    app.listen(PORT, () => {
      console.log(`\n🚀 Server started on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;
