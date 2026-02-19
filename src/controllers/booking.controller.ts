import { Request, Response } from "express";
import Booking from "../models/Booking";
import Court from "../models/Court";
import Customer from "../models/Customer";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "../utils/ApiError";
import { BookingService } from "../services/booking.service";
import { PricingService } from "../services/pricing.service";
import { PromoCodeService } from "../services/promoCode.service";
import { EmailService } from "../services/email.service";
import {
  CreateBookingDTO,
  CreateManualBookingDTO,
  CheckAvailabilityDTO,
  UpdateBookingStatusDTO,
  UpdatePaymentDTO,
  BookingFilters,
  BatchAvailabilityDTO,
} from "../types/booking.types";

/**
 * Check availability for a time slot
 * Public endpoint
 */
export const checkAvailability = asyncHandler(
  async (req: Request, res: Response) => {
    const { courtId, bookingDate, startTime, endTime } =
      req.body as CheckAvailabilityDTO;

    if (!courtId || !bookingDate || !startTime || !endTime) {
      throw new BadRequestError("All fields are required");
    }

    // Verify court exists
    const court = await Court.findById(courtId);
    if (!court) {
      throw new NotFoundError("Court");
    }

    // Check availability
    const result = await BookingService.checkAvailability({
      courtId,
      bookingDate,
      startTime,
      endTime,
    });

    res.json({
      success: true,
      data: result,
      message: "Availability checked successfully",
    });
  },
);

/**
 * Check batch availability for multiple courts and time slots
 * Public endpoint - optimized to reduce API calls
 */
export const checkBatchAvailability = asyncHandler(
  async (req: Request, res: Response) => {
    const { bookingDate, timeSlots, courtIds } =
      req.body as BatchAvailabilityDTO;

    if (!bookingDate || !timeSlots || timeSlots.length === 0) {
      throw new BadRequestError("Booking date and time slots are required");
    }

    // Validate each time slot has startTime and endTime
    for (const slot of timeSlots) {
      if (!slot.startTime || !slot.endTime) {
        throw new BadRequestError(
          "Each time slot must have startTime and endTime",
        );
      }
    }

    // If courtIds provided, verify they exist
    if (courtIds && courtIds.length > 0) {
      const courts = await Court.find({
        _id: { $in: courtIds },
        status: "active",
      });
      if (courts.length !== courtIds.length) {
        throw new BadRequestError("One or more courts not found or inactive");
      }
    } else {
      // If no courtIds provided, get all active courts
      const allCourts = await Court.find({ status: "active" });
      const allCourtIds = allCourts.map((court) => court._id.toString());

      // Check availability for all active courts
      const result = await BookingService.checkBatchAvailability({
        bookingDate,
        timeSlots,
        courtIds: allCourtIds,
      });

      return res.json({
        success: true,
        data: result,
        message: "Batch availability checked successfully",
      });
    }

    // Check availability with provided courtIds
    const result = await BookingService.checkBatchAvailability({
      bookingDate,
      timeSlots,
      courtIds,
    });

    res.json({
      success: true,
      data: result,
      message: "Batch availability checked successfully",
    });
  },
);

/**
 * Get bookings for calendar view (admin)
 * Query params: startDate=YYYY-MM-DD, endDate=YYYY-MM-DD
 */
export const getCalendarBookings = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query as any;

    // Determine date range (default: today) - Use UTC to ensure consistency across servers
    let start: Date;
    let end: Date;

    if (startDate) {
      start = new Date(startDate);
      start.setUTCHours(0, 0, 0, 0);
    } else {
      start = new Date();
      start.setUTCHours(0, 0, 0, 0);
    }

    if (endDate) {
      end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
    } else {
      end = new Date(start);
      end.setUTCHours(23, 59, 59, 999);
    }

    // Query bookings in range (exclude cancelled)
    const bookings = await Booking.find({
      bookingDate: { $gte: start, $lte: end },
      status: { $ne: "cancelled" },
    })
      .populate("customer", "name")
      .populate("court", "name")
      .sort({ bookingDate: 1, startTime: 1 });

    // Map to simplified calendar format expected by frontend
    const result = bookings.map((b) => {
      const courtId = (b.court as any)?._id?.toString?.() || (b.court as any);
      const courtName = (b.court as any)?.name || null;

      const startHour = parseInt(b.startTime.split(":")[0], 10);

      return {
        id: b._id,
        bookingId: b._id,
        courtId,
        courtName,
        bookingDate: b.bookingDate,
        startHour,
        duration: b.durationHours,
        customer: (b.customer as any)?.name || "Guest",
        status: b.status,
        amount: `${b.finalPrice ?? b.totalPrice ?? 0} SAR`,
      };
    });

    res.json({ success: true, count: result.length, data: result });
  },
);

/**
 * Create a new booking (customer flow)
 * Public endpoint
 */
export const createBooking = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      courtId,
      bookingDate,
      startTime,
      endTime,
      customerPhone,
      customerName,
      customerEmail,
      notes,
      promoCode,
      paymentId,
      paymentStatus,
      amountPaid,
    } = req.body as CreateBookingDTO;

    // Validate required fields
    if (
      !courtId ||
      !bookingDate ||
      !startTime ||
      !endTime ||
      !customerPhone ||
      !customerName
    ) {
      throw new BadRequestError("All required fields must be provided");
    }

    // Prevent duplicate bookings with same payment ID
    if (paymentId) {
      const existingBooking = await Booking.findOne({ paymentId });
      if (existingBooking) {
        // Return the existing booking instead of creating a duplicate
        const populatedExisting = await Booking.findById(existingBooking._id)
          .populate("customer", "name phone email")
          .populate("court", "name description")
          .populate("promoCode", "code discountType discountValue");

        return res.status(200).json({
          success: true,
          data: populatedExisting,
          message: "Booking already exists for this payment",
        });
      }
    }

    // Verify court exists
    const court = await Court.findById(courtId);
    if (!court) {
      throw new NotFoundError("Court");
    }

    // Check court status (active or maintenance)
    if (court.status === "inactive") {
      throw new BadRequestError("Court is not available for booking");
    }

    // Normalize booking date to midnight UTC
    const dateObj = new Date(bookingDate);
    dateObj.setUTCHours(0, 0, 0, 0);

    // Validate booking time
    BookingService.validateBookingTime(startTime, endTime, dateObj);

    // Check availability
    const availability = await BookingService.checkAvailability({
      courtId,
      bookingDate: dateObj,
      startTime,
      endTime,
    });

    if (!availability.available) {
      throw new ConflictError("Time slot is not available");
    }

    // Create new customer for each booking (allows same phone for different people)
    const customer = await Customer.create({
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
    });

    // Calculate duration
    const durationHours = BookingService.calculateDuration(startTime, endTime);

    // Calculate pricing
    const pricingResult = await PricingService.calculateBookingPrice(
      bookingDate,
      startTime,
      endTime,
    );

    // Apply promo code if provided
    let promoCodeId: string | undefined;
    let discountAmount = 0;
    let finalPrice = pricingResult.finalPrice;

    if (promoCode) {
      const promoValidation = await PromoCodeService.validatePromoCode(
        promoCode,
        customerPhone, // Use phone number, not customer ID
        pricingResult.finalPrice,
      );

      if (promoValidation.valid && promoValidation.promoCodeId) {
        promoCodeId = promoValidation.promoCodeId;
        discountAmount = promoValidation.discount || 0;
        finalPrice = promoValidation.finalAmount ?? pricingResult.finalPrice;
      } else {
        console.warn(
          `⚠️ Promo code validation failed: ${promoValidation.message}`,
        );
      }
      // If promo code is invalid, we just ignore it (no error thrown)
      // Booking proceeds without discount
    }

    // Create booking
    const booking = await Booking.create({
      customer: customer._id,
      court: courtId,
      bookingDate: dateObj,
      startTime,
      endTime,
      durationHours,
      totalPrice: pricingResult.finalPrice,
      pricingBreakdown: pricingResult.breakdown,
      promoCode: promoCodeId,
      discountAmount,
      finalPrice,
      paymentStatus: paymentStatus || "pending",
      paymentId: paymentId || undefined,
      amountPaid: amountPaid || 0,
      status: paymentStatus === "paid" ? "confirmed" : "pending",
      notes,
      createdBy: "customer",
    });

    // Mark promo code as used if applied
    if (promoCodeId && customer?._id) {
      try {
        await PromoCodeService.markAsUsed(promoCodeId, customer._id.toString());
      } catch (error) {
        // If promo was already marked as used, log but don't fail the booking
        console.error(
          `❌ Failed to mark promo as used:`,
          error instanceof Error ? error.message : error,
        );
      }
    } else {
      if (promoCodeId) {
        console.warn(
          `⚠️ Promo code ${promoCodeId} provided but customer ID is missing`,
        );
      }
    }

    // Increment customer's total bookings
    await Customer.findByIdAndUpdate(customer._id, {
      $inc: { totalBookings: 1 },
    });

    // Populate references for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate("customer", "name phone email")
      .populate("court", "name description")
      .populate("promoCode", "code discountType discountValue");

    // Send confirmation email for all bookings with email (including venue payments)
    if (customerEmail) {
      console.log(
        "📧 Attempting to send confirmation email for customer booking:",
        {
          bookingId: booking._id.toString(),
          customerEmail: customerEmail,
          paymentStatus: paymentStatus,
          amountPaid: amountPaid || 0,
          finalPrice: finalPrice,
        },
      );

      try {
        const emailSent = await EmailService.sendBookingConfirmation({
          customerName: customerName,
          customerEmail: customerEmail,
          customerPhone: customerPhone,
          bookingId: booking._id.toString(),
          courtName: court.name,
          bookingDate: dateObj.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          startTime,
          endTime,
          durationHours,
          totalPrice: finalPrice,
          amountPaid: amountPaid || 0,
          paymentStatus: paymentStatus as "pending" | "partial" | "paid",
          paymentMethod: paymentStatus === "pending" ? undefined : "Card",
        });

        if (emailSent) {
          console.log(
            "✅ Customer booking confirmation email sent successfully",
          );
        } else {
          console.error("❌ Email service returned false for customer booking");
        }
      } catch (emailError) {
        console.error(
          "❌ Failed to send customer booking confirmation email:",
          emailError,
        );
        // Don't fail the booking creation if email fails
      }
    }

    res.status(201).json({
      success: true,
      data: populatedBooking,
      message: "Booking created successfully",
    });
  },
);

/**
 * Create manual booking or block time slot (admin only)
 * Protected endpoint
 */
export const createManualBooking = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      courtId,
      bookingDate,
      startTime,
      endTime,
      customerPhone,
      customerName,
      customerEmail,
      notes,
      isBlocked,
      promoCode,
    } = req.body as CreateManualBookingDTO;

    // Validate required fields
    if (!courtId || !bookingDate || !startTime || !endTime) {
      throw new BadRequestError("Court, date, and time fields are required");
    }

    // If not blocked, customer info is required
    if (!isBlocked && (!customerPhone || !customerName)) {
      throw new BadRequestError(
        "Customer information is required for bookings",
      );
    }

    // Verify court exists
    const court = await Court.findById(courtId);
    if (!court) {
      throw new NotFoundError("Court");
    }

    // Normalize booking date to midnight UTC
    const dateObj = new Date(bookingDate);
    dateObj.setUTCHours(0, 0, 0, 0);

    // Validate booking time
    BookingService.validateBookingTime(startTime, endTime, dateObj);

    // Check availability
    const availability = await BookingService.checkAvailability({
      courtId,
      bookingDate: dateObj,
      startTime,
      endTime,
    });

    if (!availability.available) {
      throw new ConflictError("Time slot is not available");
    }

    // Calculate duration
    const durationHours = BookingService.calculateDuration(startTime, endTime);

    let customerId;
    let totalPrice = 0;
    let pricingBreakdown: any[] = [];
    let promoCodeId: string | undefined;
    let discountAmount = 0;
    let finalPrice = 0;

    // If not a blocked booking, handle customer and pricing
    if (!isBlocked) {
      // Create new customer for each booking (allows same phone for different people)
      const customer = await Customer.create({
        name: customerName!,
        phone: customerPhone!,
        email: customerEmail,
      });
      customerId = customer._id;

      // Calculate pricing
      const pricingResult = await PricingService.calculateBookingPrice(
        bookingDate,
        startTime,
        endTime,
      );
      totalPrice = pricingResult.finalPrice;
      pricingBreakdown = pricingResult.breakdown;

      // Apply promo code if provided (admin bookings skip phone validation)
      if (promoCode) {
        const promoValidation = await PromoCodeService.validatePromoCodeAdmin(
          promoCode,
          totalPrice,
        );

        if (promoValidation.valid && promoValidation.promoCodeId) {
          promoCodeId = promoValidation.promoCodeId;
          discountAmount = promoValidation.discount || 0;
          finalPrice = promoValidation.finalAmount ?? totalPrice;
        } else {
          console.warn(
            `⚠️ Promo code validation failed: ${promoValidation.message}`,
          );
          // If promo fails, proceed without discount
          finalPrice = totalPrice;
        }
      } else {
        finalPrice = totalPrice;
      }

      // Increment customer's total bookings
      await Customer.findByIdAndUpdate(customer._id, {
        $inc: { totalBookings: 1 },
      });
    }

    // Create booking
    const booking = await Booking.create({
      customer: customerId,
      court: courtId,
      bookingDate: dateObj,
      startTime,
      endTime,
      durationHours,
      totalPrice,
      pricingBreakdown,
      promoCode: promoCodeId,
      discountAmount,
      finalPrice,
      paymentStatus: isBlocked ? "paid" : "pending", // Blocked bookings are marked as paid
      amountPaid: 0,
      status: isBlocked ? "blocked" : "pending",
      notes,
      createdBy: "admin",
    });

    // Mark promo code as used if applied
    if (promoCodeId && customerId) {
      try {
        await PromoCodeService.markAsUsed(promoCodeId, customerId.toString());
      } catch (error) {
        console.error(
          `❌ Failed to mark promo as used:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    // Populate references for response
    const populatedBooking = await Booking.findById(booking._id)
      .populate("customer", "name phone email")
      .populate("court", "name description");

    // Send confirmation email for all non-blocked bookings (including venue payments)
    if (!isBlocked && customerEmail) {
      try {
        const court = await Court.findById(courtId);
        if (!court) {
          throw new NotFoundError("Court");
        }

        await EmailService.sendBookingConfirmation({
          customerName: customerName!,
          customerEmail: customerEmail,
          customerPhone: customerPhone!,
          bookingId: booking._id.toString(),
          courtName: court.name,
          bookingDate: dateObj.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          startTime,
          endTime,
          durationHours,
          totalPrice,
          amountPaid: 0,
          paymentStatus: "pending",
        });
      } catch (emailError) {
        console.error("Failed to send booking confirmation email:", emailError);
        // Don't fail the booking creation if email fails
      }
    }

    res.status(201).json({
      success: true,
      data: populatedBooking,
      message: isBlocked
        ? "Time slot blocked successfully"
        : "Manual booking created successfully",
    });
  },
);

/**
 * Get all bookings with filters (admin only)
 * Protected endpoint
 */
export const getAllBookings = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      courtId,
      customerId,
      customerName,
      status,
      paymentStatus,
      startDate,
      endDate,
      createdBy,
      page = 1,
      limit = 1000,
    } = req.query as any;

    const query: any = {};

    if (courtId) query.court = courtId;
    if (customerId) query.customer = customerId;
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (createdBy) query.createdBy = createdBy;

    // Customer name search (case-insensitive partial match)
    let customerFilter: any = null;
    if (customerName) {
      const customers = await Customer.find({
        name: { $regex: customerName, $options: "i" },
      }).select("_id");
      customerFilter = customers.map((c) => c._id);
      if (customerFilter.length > 0) {
        query.customer = { $in: customerFilter };
      } else {
        // No customers match, return empty result
        return res.json({
          success: true,
          count: 0,
          data: {
            bookings: [],
            pagination: {
              page: Number(page),
              limit: Number(limit),
              total: 0,
              pages: 0,
            },
          },
        });
      }
    }

    // Date range filter
    if (startDate || endDate) {
      query.bookingDate = {};
      if (startDate) {
        const start = new Date(startDate as string);
        start.setHours(0, 0, 0, 0);
        query.bookingDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        query.bookingDate.$lte = end;
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate("customer", "name phone email")
        .populate("court", "name description")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Booking.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: bookings.length,
      data: {
        bookings,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  },
);

/**
 * Get single booking by ID
 * Public endpoint (for customer to check their booking)
 */
export const getBookingById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate("customer", "name phone email")
      .populate("court", "name description");

    if (!booking) {
      throw new NotFoundError("Booking");
    }

    res.json({
      success: true,
      data: booking,
    });
  },
);

/**
 * Get booking by payment ID (public endpoint for confirmation page)
 * Used to check if booking already exists to prevent duplicates
 */
export const getBookingByPaymentId = asyncHandler(
  async (req: Request, res: Response) => {
    const { paymentId } = req.params;

    const booking = await Booking.findOne({ paymentId })
      .populate("court", "name description")
      .populate("customer", "name phone email");

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "No booking found with this payment ID",
      });
    }

    res.json({
      success: true,
      data: booking,
    });
  },
);

/**
 * Update booking status (admin only)
 * Protected endpoint
 */
export const updateBookingStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, notes } = req.body as UpdateBookingStatusDTO;

    if (!status) {
      throw new BadRequestError("Status is required");
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      throw new NotFoundError("Booking");
    }

    // Validate status transitions
    if (booking.status === "cancelled") {
      throw new BadRequestError("Cannot update status of cancelled booking");
    }

    if (booking.status === "completed") {
      throw new BadRequestError("Cannot update status of completed booking");
    }

    // Update booking
    booking.status = status;
    if (notes) {
      booking.notes = notes;
    }
    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("customer", "name phone email")
      .populate("court", "name description");

    res.json({
      success: true,
      data: populatedBooking,
      message: "Booking status updated successfully",
    });
  },
);

/**
 * Update payment information (admin or webhook)
 * Protected endpoint
 */
export const updatePayment = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { amountPaid, paymentStatus, paymentMethod, paymentReference } =
      req.body as UpdatePaymentDTO;

    const booking = await Booking.findById(id);
    if (!booking) {
      throw new NotFoundError("Booking");
    }

    // Update payment information
    if (amountPaid !== undefined) booking.amountPaid = amountPaid;
    if (paymentStatus) booking.paymentStatus = paymentStatus;
    if (paymentMethod) booking.paymentMethod = paymentMethod;
    if (paymentReference) booking.paymentReference = paymentReference;

    // Auto-update booking status based on payment
    if (paymentStatus === "paid" || paymentStatus === "partial") {
      if (booking.status === "pending") {
        booking.status = "confirmed";
      }
    }

    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("customer", "name phone email")
      .populate("court", "name description");

    res.json({
      success: true,
      data: populatedBooking,
      message: "Payment updated successfully",
    });
  },
);

/**
 * Update booking details (admin only)
 * Protected endpoint
 */
export const updateBooking = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { notes } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      throw new NotFoundError("Booking");
    }

    // Only allow updating notes for now
    // Time and date changes require availability check and should be handled separately
    if (notes !== undefined) {
      booking.notes = notes;
    }

    await booking.save();

    const populatedBooking = await Booking.findById(booking._id)
      .populate("customer", "name phone email")
      .populate("court", "name description");

    res.json({
      success: true,
      data: populatedBooking,
      message: "Booking updated successfully",
    });
  },
);

/**
 * Cancel booking (soft delete)
 * Public endpoint (customer can cancel) or Admin
 */
export const cancelBooking = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(id);
    if (!booking) {
      throw new NotFoundError("Booking");
    }

    if (booking.status === "cancelled") {
      throw new BadRequestError("Booking is already cancelled");
    }

    if (booking.status === "completed") {
      throw new BadRequestError("Cannot cancel completed booking");
    }

    // Soft delete - mark as cancelled
    booking.status = "cancelled";
    if (reason) {
      booking.notes = booking.notes
        ? `${booking.notes}\nCancellation reason: ${reason}`
        : `Cancellation reason: ${reason}`;
    }
    await booking.save();

    // Remove promo code usage if it was used
    if (booking.promoCode && booking.customer) {
      await PromoCodeService.removeUsage(
        booking.promoCode.toString(),
        booking.customer.toString(),
      );
    }

    const populatedBooking = await Booking.findById(booking._id)
      .populate("customer", "name phone email")
      .populate("court", "name description")
      .populate("promoCode", "code discountType discountValue");

    res.json({
      success: true,
      data: populatedBooking,
      message: "Booking cancelled successfully",
    });
  },
);
