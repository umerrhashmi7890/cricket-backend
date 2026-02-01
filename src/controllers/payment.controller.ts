import { Request, Response } from "express";
import PaymentService, {
  CreatePaymentDTO,
  CreatePaymentRequestDTO,
} from "../services/payment.service";
import { BookingService } from "../services/booking.service";
import { PricingService } from "../services/pricing.service";
import { EmailService } from "../services/email.service";
import { PromoCodeService } from "../services/promoCode.service";
import Booking from "../models/Booking";
import Customer from "../models/Customer";
import Court from "../models/Court";

/**
 * Create a payment request (hosted checkout)
 * POST /api/payments/create-request
 */
export const createPaymentRequest = async (req: Request, res: Response) => {
  try {
    const { amount, currency = "SAR", description, metadata } = req.body;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    // Build callback URL
    const callbackUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/booking/confirmation`;

    const requestData: CreatePaymentRequestDTO = {
      amount: Math.round(amount * 100), // Convert SAR to halalas
      currency,
      description: description || "Court Booking Payment",
      callback_url: callbackUrl,
      success_url: callbackUrl, // Redirect here after successful payment
      payment_methods: ["creditcard"], // Only allow credit/debit cards (excludes Apple Pay, Samsung Pay)
      metadata,
    };

    const paymentRequest =
      await PaymentService.createPaymentRequest(requestData);

    return res.status(200).json({
      success: true,
      data: paymentRequest,
    });
  } catch (error: any) {
    console.error("Payment request creation error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create payment request",
    });
  }
};

/**
 * Get payment status
 * GET /api/payments/:paymentId
 */
export const getPaymentStatus = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    const payment = await PaymentService.getPaymentStatus(paymentId);

    return res.status(200).json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    console.error("Failed to fetch payment status:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch payment status",
    });
  }
};

/**
 * Handle payment callback/webhook from Moyasar
 * POST /api/payments/callback
 */
export const handlePaymentCallback = async (req: Request, res: Response) => {
  try {
    const paymentData = req.body;
    const paymentId = paymentData.id;

    // Return 200 immediately (best practice - Moyasar requires quick response)
    res.status(200).json({
      success: true,
      message: "Webhook received",
    });

    console.log("Received payment webhook for ID:", paymentId);
    console.log("Payment data:", paymentData);

    // Process webhook asynchronously (don't await, don't block response)
    processWebhookAsync(paymentId).catch((error) => {
      console.error("Webhook processing error:", error);
    });
  } catch (error: any) {
    console.error("Webhook handler error:", error);
    // Still return 200 even on error to prevent retries for malformed requests
    return res.status(200).json({
      success: true,
      message: "Webhook received",
    });
  }
};

/**
 * Process webhook data asynchronously
 * This runs in the background after responding to Moyasar
 */
async function processWebhookAsync(paymentId: string) {
  try {
    // Verify payment status with Moyasar
    const payment = await PaymentService.getPaymentStatus(paymentId);

    if (payment.status === "paid") {
      // Find booking by paymentId (not from metadata!)
      const existingBooking = await Booking.findOne({
        paymentId: paymentId,
      }).populate("courtId");

      if (existingBooking) {
        // Booking already created by Confirmation page
        console.log(
          `✅ Webhook: Booking already exists for payment ${paymentId}`,
        );

        // Update if needed (in case it was pending)
        if (existingBooking.status !== "confirmed") {
          await BookingService.updateBookingStatus(
            existingBooking._id.toString(),
            "confirmed",
            {
              paymentId: payment.id,
              paymentStatus: "paid",
              paidAmount: payment.amount / 100,
            },
          );
          console.log(
            `✅ Webhook: Updated booking ${existingBooking._id} to confirmed`,
          );
        }
      } else {
        // Booking NOT created yet (user closed browser)
        // CREATE the booking from payment metadata
        console.log(
          `📝 Webhook: Creating booking from payment metadata ${paymentId}`,
        );

        const metadata = payment.metadata;
        const slots = JSON.parse(metadata.slots || "[]");

        // Sort slots properly (handle midnight crossing)
        const sortedSlots = slots.sort((a: string, b: string) => {
          const [aHour] = a.split(":").map(Number);
          const [bHour] = b.split(":").map(Number);
          const getOrder = (h: number) => (h >= 0 && h <= 3 ? h + 24 : h);
          return getOrder(aHour) - getOrder(bHour);
        });

        const startTime = sortedSlots[0];
        const lastSlot = sortedSlots[sortedSlots.length - 1];
        const [lastHour, lastMin] = lastSlot.split(":").map(Number);
        const endHour = (lastHour + 1) % 24;
        const endTime = `${endHour.toString().padStart(2, "0")}:${lastMin.toString().padStart(2, "0")}`;

        // Find or create customer (same as normal booking flow)
        let customer = await Customer.findOne({
          phone: metadata.customerPhone,
        });
        if (!customer) {
          customer = await Customer.create({
            name: metadata.customerName,
            phone: metadata.customerPhone,
            email: metadata.customerEmail || "",
          });
          console.log(
            `✅ Webhook: Created new customer ${customer._id} (${metadata.customerPhone})`,
          );
        } else {
          console.log(
            `✅ Webhook: Found existing customer ${customer._id} (${metadata.customerPhone})`,
          );
        }

        // Calculate duration
        const durationHours = BookingService.calculateDuration(
          startTime,
          endTime,
        );

        // Calculate pricing for the booking
        const pricingResult = await PricingService.calculateBookingPrice(
          metadata.date,
          startTime,
          endTime,
        );

        // Validate promo code if provided and calculate discount
        let promoCodeId: string | undefined;
        let discountAmount = 0;
        let finalPrice = pricingResult.finalPrice;
        const promoCode = metadata.promoCode;

        console.log(`🎟️ Webhook: Checking for promo code in metadata:`, {
          promoCode: promoCode || "none",
          customerPhone: metadata.customerPhone,
          customerId: customer._id.toString(),
        });

        if (promoCode && promoCode.trim()) {
          console.log(
            `🎟️ Webhook: Validating promo code "${promoCode}" for customer ${metadata.customerPhone}`,
          );
          try {
            const promoValidation = await PromoCodeService.validatePromoCode(
              promoCode,
              metadata.customerPhone,
              pricingResult.finalPrice, // Validate against calculated price
            );

            console.log(`🎟️ Webhook: Promo validation result:`, {
              valid: promoValidation.valid,
              message: promoValidation.message,
              discount: promoValidation.discount,
              promoCodeId: promoValidation.promoCodeId,
            });

            if (promoValidation.valid && promoValidation.promoCodeId) {
              promoCodeId = promoValidation.promoCodeId;
              discountAmount = promoValidation.discount || 0;
              finalPrice =
                promoValidation.finalAmount || pricingResult.finalPrice;
              console.log(
                `✅ Webhook: Applied promo code ${promoCode} (${discountAmount} SAR discount) for payment ${paymentId}`,
              );
            } else {
              console.warn(
                `⚠️ Webhook: Promo code ${promoCode} invalid: ${promoValidation.message}`,
              );
            }
          } catch (error) {
            console.error(`❌ Webhook: Error validating promo code:`, error);
            // Continue without promo code if validation fails
          }
        }

        // Create the booking with customer reference
        const newBooking = await Booking.create({
          customer: customer._id,
          court: metadata.courtId,
          bookingDate: metadata.date,
          startTime: startTime,
          endTime: endTime,
          durationHours,
          totalPrice: pricingResult.finalPrice,
          pricingBreakdown: pricingResult.breakdown,
          promoCode: promoCodeId, // Save promo code ObjectId
          discountAmount: discountAmount, // Save promo discount amount
          finalPrice: finalPrice, // Final price after promo discount
          paymentId: payment.id,
          paymentStatus: "paid",
          amountPaid: payment.amount / 100,
          status: "confirmed",
          createdBy: "customer",
        });

        // Mark promo code as used (if applied)
        if (promoCodeId && customer?._id) {
          console.log(
            `🎟️ Webhook: Attempting to mark promo code ${promoCodeId} as used by customer ${customer._id}`,
          );
          try {
            await PromoCodeService.markAsUsed(
              promoCodeId,
              customer._id.toString(),
            );
            console.log(
              `✅ Webhook: Successfully marked promo code as used by customer ${customer._id}`,
            );
          } catch (error) {
            console.error(
              `❌ Webhook: Error marking promo as used:`,
              error instanceof Error ? error.message : error,
            );
            // Don't fail the entire booking if promo tracking fails
          }
        } else {
          if (promoCodeId) {
            console.warn(
              `⚠️ Webhook: Promo code ${promoCodeId} provided but customer ID is missing`,
            );
          }
        }

        // Increment customer's total bookings
        await Customer.findByIdAndUpdate(customer._id, {
          $inc: { totalBookings: 1 },
        });

        console.log(
          `✅ Webhook: Created booking ${newBooking._id} from payment ${paymentId}`,
        );

        // Send confirmation email
        const court = await Court.findById(metadata.courtId);
        if (court && metadata.customerEmail) {
          await EmailService.sendBookingConfirmation({
            customerName: metadata.customerName,
            customerEmail: metadata.customerEmail,
            customerPhone: metadata.customerPhone,
            bookingId: newBooking._id.toString(),
            courtName: court.name,
            bookingDate: new Date(metadata.date).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            startTime,
            endTime,
            durationHours,
            totalPrice: pricingResult.finalPrice,
            amountPaid: payment.amount / 100,
            paymentStatus: "paid",
            paymentMethod: payment.source?.company || "Card",
          });
        }
      }
    } else {
      console.log(
        `ℹ️ Webhook: Payment ${paymentId} status is ${payment.status}`,
      );
    }
  } catch (error: any) {
    console.error(
      `❌ Webhook processing failed for payment ${paymentId}:`,
      error.message,
    );
    throw error;
  }
}

/**
 * Refund a payment
 * POST /api/payments/:paymentId/refund
 */
export const refundPayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const { amount } = req.body; // Optional partial refund amount in SAR

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    const refundAmount = amount ? Math.round(amount * 100) : undefined;
    const payment = await PaymentService.refundPayment(paymentId, refundAmount);

    return res.status(200).json({
      success: true,
      data: payment,
      message: "Payment refunded successfully",
    });
  } catch (error: any) {
    console.error("Payment refund error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to refund payment",
    });
  }
};
