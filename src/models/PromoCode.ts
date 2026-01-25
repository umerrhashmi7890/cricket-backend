import mongoose, { Schema, Document } from "mongoose";
import { IPromoCode, DiscountType } from "../types/promoCode.types";

export interface IPromoCodeDocument extends IPromoCode, Document {}

const PromoCodeSchema = new Schema<IPromoCodeDocument>(
  {
    code: {
      type: String,
      required: [true, "Promo code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: [0, "Discount value must be positive"],
    },
    maxTotalUses: {
      type: Number,
      default: null, // null = unlimited
      min: [1, "Max uses must be at least 1"],
    },
    usedByCustomers: {
      type: [String],
      default: [],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for checking if expired
PromoCodeSchema.virtual("isExpired").get(function () {
  return new Date() > this.expiresAt;
});

// Virtual for usage count
PromoCodeSchema.virtual("usageCount").get(function () {
  return this.usedByCustomers.length;
});

// Virtual for remaining uses
PromoCodeSchema.virtual("remainingUses").get(function () {
  if (this.maxTotalUses === null) return null; // Unlimited
  return this.maxTotalUses - this.usedByCustomers.length;
});

// Pre-save hook to set expiry date (7 days from creation)
PromoCodeSchema.pre("save", function (next) {
  if (this.isNew && !this.expiresAt) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 days from now
    this.expiresAt = expiryDate;
  }
  next();
});

// Pre-save validation for percentage discount
PromoCodeSchema.pre("save", function (next) {
  if (this.discountType === "percentage" && this.discountValue > 100) {
    next(new Error("Percentage discount cannot exceed 100%"));
  } else {
    next();
  }
});

// Compound index for efficient queries
PromoCodeSchema.index({ code: 1, isActive: 1 });
PromoCodeSchema.index({ expiresAt: 1, isActive: 1 });

export default mongoose.model<IPromoCodeDocument>("PromoCode", PromoCodeSchema);
