import PromoCode from "../models/PromoCode";
import Customer from "../models/Customer";
import { PromoCodeValidationResult } from "../types/promoCode.types";
import { BadRequestError, NotFoundError } from "../utils/ApiError";

export class PromoCodeService {
  /**
   * Validate promo code for a booking using customer phone
   * This allows validation before customer record is created (guest booking)
   */
  static async validatePromoCode(
    code: string,
    customerPhone: string,
    bookingAmount: number,
  ): Promise<PromoCodeValidationResult> {
    // Find promo code (case-insensitive)
    const promoCode = await PromoCode.findOne({
      code: code.toUpperCase(),
    });

    if (!promoCode) {
      return {
        valid: false,
        message: "Invalid promo code",
      };
    }

    // Check 1: Is active?
    if (!promoCode.isActive) {
      return {
        valid: false,
        message: "This promo code is no longer active",
      };
    }

    // Check 2: Is expired?
    if (new Date() > promoCode.expiresAt) {
      return {
        valid: false,
        message: "This promo code has expired",
      };
    }

    // Check 3: Has customer already used it?
    // Find ALL customers with this phone to check if any have used this promo before
    const existingCustomers = await Customer.find({ phone: customerPhone });

    if (existingCustomers.length > 0) {
      const customerIds = existingCustomers.map((c) => c._id.toString());
      const hasUsedPromo = customerIds.some((id) =>
        promoCode.usedByCustomers.includes(id),
      );

      if (hasUsedPromo) {
        return {
          valid: false,
          message: "You have already used this promo code",
        };
      }
    }

    // Check 4: Has reached max total uses?
    if (
      promoCode.maxTotalUses !== null &&
      promoCode.usedByCustomers.length >= promoCode.maxTotalUses
    ) {
      return {
        valid: false,
        message: "This promo code usage limit has been reached",
      };
    }

    // Calculate discount
    const { discount, finalAmount } = this.calculateDiscount(
      bookingAmount,
      promoCode.discountType,
      promoCode.discountValue,
    );

    return {
      valid: true,
      discount,
      finalAmount,
      promoCodeId: promoCode._id.toString(),
      message: `Promo code applied! You saved ${discount} SAR`,
    };
  }

  /**
   * Calculate discount amount
   */
  static calculateDiscount(
    amount: number,
    discountType: "percentage" | "fixed",
    discountValue: number,
  ): { discount: number; finalAmount: number } {
    let discount = 0;

    if (discountType === "percentage") {
      discount = Math.round((amount * discountValue) / 100);
    } else {
      discount = discountValue;
    }

    // Ensure discount doesn't exceed total amount
    discount = Math.min(discount, amount);

    const finalAmount = amount - discount;

    return {
      discount,
      finalAmount,
    };
  }

  /**
   * Mark promo code as used by a customer
   */
  static async markAsUsed(
    promoCodeId: string,
    customerId: string,
  ): Promise<void> {
    const promoCode = await PromoCode.findById(promoCodeId);

    if (!promoCode) {
      throw new NotFoundError("Promo code");
    }

    // Check if already used (double-check)
    if (promoCode.usedByCustomers.includes(customerId)) {
      console.warn(
        `⚠️ Customer ${customerId} already used promo code ${promoCodeId}`,
      );
      throw new BadRequestError("Promo code already used by this customer");
    }

    // Add customer to used list
    promoCode.usedByCustomers.push(customerId);
    await promoCode.save();
  }

  /**
   * Remove customer from promo code usage (for cancelled bookings)
   */
  static async removeUsage(
    promoCodeId: string,
    customerId: string,
  ): Promise<void> {
    const promoCode = await PromoCode.findById(promoCodeId);

    if (!promoCode) {
      return; // Promo code might have been deleted
    }

    // Remove customer from used list
    promoCode.usedByCustomers = promoCode.usedByCustomers.filter(
      (id) => id !== customerId,
    );
    await promoCode.save();
  }
}
