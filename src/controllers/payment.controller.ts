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
import PendingBooking from "../models/pendingBooking.model";
import PromoCode from "../models/PromoCode";
import mongoose from "mongoose";

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
      metadata, // NOTE: Moyasar invoices don't preserve metadata, we'll save it separately
    };

    const paymentRequest =
      await PaymentService.createPaymentRequest(requestData);

    // Save booking data to database (since Moyasar invoices don't preserve metadata)
    if (metadata) {
      try {
        // Parse slots if it's a string
        const slotsArray =
          typeof metadata.slots === "string"
            ? JSON.parse(metadata.slots)
            : metadata.slots;

        // Find or create customer
        let customer = await Customer.findOne({
          phone: metadata.customerPhone,
        });
        if (!customer) {
          customer = await Customer.create({
            name: metadata.customerName,
            phone: metadata.customerPhone,
            email: metadata.customerEmail || undefined,
          });
        }

        // Look up promo code ID if promo code is provided
        let promoCodeId: mongoose.Types.ObjectId | undefined;
        if (metadata.promoCode) {
          const promoCodeDoc = await PromoCode.findOne({
            code: metadata.promoCode,
          });
          if (promoCodeDoc) {
            promoCodeId = promoCodeDoc._id;
          }
        }

        // Create pending booking
        await PendingBooking.create({
          paymentId: paymentRequest.id,
          courtId: metadata.courtId,
          date: new Date(metadata.date),
          slots: slotsArray,
          customerId: customer._id,
          customerName: metadata.customerName,
          customerPhone: metadata.customerPhone,
          customerEmail: metadata.customerEmail,
          paymentOption: metadata.paymentOption,
          finalTotal: metadata.finalTotal,
          amountNow: metadata.amountNow,
          promoCodeId: promoCodeId,
          promoCode: metadata.promoCode || undefined,
        });
      } catch (error) {
        console.error("❌ Failed to save pending booking:", error);
        // Don't fail the payment request, just log the error
      }
    }

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

    // Moyasar sends webhook in format: { id: 'webhook_id', type: 'payment_paid', data: { id: 'payment_id', ... } }
    // Extract the actual payment ID from the nested data object
    const paymentId = paymentData.data?.id || paymentData.id;
    const webhookType = paymentData.type;

    // Return 200 immediately (best practice - Moyasar requires quick response)
    res.status(200).json({
      success: true,
      message: "Webhook received",
    });

    // Process webhook asynchronously (don't await, don't block response)
    processWebhookAsync(paymentId, paymentData.data).catch((error) => {
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
async function processWebhookAsync(paymentId: string, paymentData?: any) {
  try {
    // Use the payment data from webhook if available, otherwise fetch it
    let payment = paymentData;

    if (!payment) {
      console.log(
        "⚠️ Payment data not in webhook, fetching from Moyasar API...",
      );
      payment = await PaymentService.getPaymentStatus(paymentId);
    }

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

        // Clean up pending booking (try both invoice_id and payment id)
        await PendingBooking.deleteOne({
          $or: [{ paymentId }, { paymentId: payment.invoice_id }],
        });
      } else {
        // Booking NOT created yet (user closed browser)
        // Retrieve booking data from pending booking (not from metadata!)
        console.log(
          `📝 Webhook: Creating booking from pending data for payment ${paymentId}`,
        );

        // Try to find pending booking by invoice_id first (since that's what we save),
        // fallback to payment id for backwards compatibility
        const invoiceId = payment.invoice_id;

        const pendingBooking = await PendingBooking.findOne({
          $or: [{ paymentId: invoiceId }, { paymentId }],
        });

        if (!pendingBooking) {
          console.error(
            `❌ No pending booking found for payment ${paymentId} or invoice ${invoiceId}`,
          );
          return;
        }

        // Sort slots properly (handle midnight crossing)
        const sortedSlots = pendingBooking.slots.sort(
          (a: string, b: string) => {
            const [aHour] = a.split(":").map(Number);
            const [bHour] = b.split(":").map(Number);
            const getOrder = (h: number) => (h >= 0 && h <= 3 ? h + 24 : h);
            return getOrder(aHour) - getOrder(bHour);
          },
        );

        const startTime = sortedSlots[0];
        const lastSlot = sortedSlots[sortedSlots.length - 1];
        const [lastHour, lastMin] = lastSlot.split(":").map(Number);
        const endHour = (lastHour + 1) % 24;
        const endTime = `${endHour.toString().padStart(2, "0")}:${lastMin.toString().padStart(2, "0")}`;

        // Get customer from pending booking
        const customer = await Customer.findById(pendingBooking.customerId);
        if (!customer) {
          console.error(`❌ Customer not found: ${pendingBooking.customerId}`);
          return;
        }

        // Calculate duration
        const durationHours = BookingService.calculateDuration(
          startTime,
          endTime,
        );

        // Calculate pricing for the booking (for breakdown only)
        const pricingResult = await PricingService.calculateBookingPrice(
          pendingBooking.date.toISOString(),
          startTime,
          endTime,
        );

        // Use pricing from PendingBooking (it already has discounts applied)
        let promoCodeId = pendingBooking.promoCodeId;
        const finalPrice = pendingBooking.finalTotal;
        const totalPrice = pricingResult.finalPrice; // Base price before discounts
        const discountAmount = totalPrice - finalPrice; // Calculate discount

        // Determine payment status based on payment option
        let paymentStatus: "paid" | "partial";
        let amountPaid: number;

        if (pendingBooking.paymentOption === "full") {
          paymentStatus = "paid";
          amountPaid = finalPrice;
        } else {
          // partial payment
          paymentStatus = "partial";
          amountPaid = pendingBooking.amountNow;
        }

        // Create the booking with customer reference
        const newBooking = await Booking.create({
          customer: customer._id,
          court: pendingBooking.courtId,
          bookingDate: pendingBooking.date,
          startTime: startTime,
          endTime: endTime,
          durationHours,
          totalPrice: totalPrice, // Base price
          pricingBreakdown: pricingResult.breakdown,
          promoCode: promoCodeId, // Save promo code ObjectId from pending booking
          discountAmount: discountAmount, // Calculated discount
          finalPrice: finalPrice, // Final price after all discounts
          paymentId: payment.id,
          paymentStatus: paymentStatus, // "paid" or "partial"
          amountPaid: amountPaid, // Actual amount paid now
          status: "confirmed",
          createdBy: "customer",
        });

        // Mark promo code as used (if applied)
        if (promoCodeId && customer?._id) {
          try {
            await PromoCodeService.markAsUsed(
              promoCodeId.toString(),
              customer._id.toString(),
            );
          } catch (error) {
            console.error(
              `❌ Webhook: Error marking promo as used:`,
              error instanceof Error ? error.message : error,
            );
            // Don't fail the entire booking if promo tracking fails
          }
        }

        // Clean up pending booking after successful booking creation
        await PendingBooking.deleteOne({
          $or: [{ paymentId: invoiceId }, { paymentId }],
        });

        // Increment customer's total bookings
        await Customer.findByIdAndUpdate(customer._id, {
          $inc: { totalBookings: 1 },
        });

        // Send confirmation email
        const court = await Court.findById(pendingBooking.courtId);
        if (court && pendingBooking.customerEmail) {
          await EmailService.sendBookingConfirmation({
            customerName: pendingBooking.customerName,
            customerEmail: pendingBooking.customerEmail,
            customerPhone: pendingBooking.customerPhone,
            bookingId: newBooking._id.toString(),
            courtName: court.name,
            bookingDate: new Date(pendingBooking.date).toLocaleDateString(
              "en-US",
              {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              },
            ),
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
