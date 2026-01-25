export type DiscountType = "percentage" | "fixed";

export interface IPromoCode {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxTotalUses: number | null; // null = unlimited
  usedByCustomers: string[]; // Array of customer IDs
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date; // Auto-calculated: createdAt + 7 days
}

export interface IPromoCodeCreate {
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxTotalUses?: number | null;
  expiry?: number; // Number of days until expiration (default: 7)
}

export interface IPromoCodeUpdate {
  code?: string;
  discountType?: DiscountType;
  discountValue?: number;
  maxTotalUses?: number | null;
  isActive?: boolean;
}

export interface ValidatePromoCodeDTO {
  code: string;
  customerPhone: string; // Changed from customerId to support guest bookings
  bookingAmount: number;
}

export interface PromoCodeValidationResult {
  valid: boolean;
  message?: string;
  discount?: number;
  finalAmount?: number;
  promoCodeId?: string;
}
