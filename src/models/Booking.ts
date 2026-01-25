import mongoose, { Schema, Document } from "mongoose";
import {
  IBooking,
  BookingStatus,
  PaymentStatus,
  CreatedBy,
} from "../types/booking.types";

export interface IBookingDocument
  extends Omit<IBooking, "customer" | "court" | "promoCode">, Document {
  customer?: mongoose.Types.ObjectId;
  court: mongoose.Types.ObjectId;
  promoCode?: mongoose.Types.ObjectId;
}

const PricingBreakdownSchema = new Schema(
  {
    hour: {
      type: String,
      required: true,
    },
    rate: {
      type: Number,
      required: true,
    },
    days: {
      type: String,
      enum: ["sun-wed", "thu", "fri", "sat"],
      required: true,
    },
    category: {
      type: String,
      enum: ["weekday-day", "weekday-night", "weekend-day", "weekend-night"],
      required: true,
    },
    timeSlot: {
      type: String,
      enum: ["day", "night"],
      required: true,
    },
  },
  { _id: false },
);

const BookingSchema = new Schema<IBookingDocument>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: false, // Not required for blocked bookings
    },
    court: {
      type: Schema.Types.ObjectId,
      ref: "Court",
      required: true,
    },
    bookingDate: {
      type: Date,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format
    },
    endTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format
    },
    durationHours: {
      type: Number,
      required: true,
      min: 1,
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    pricingBreakdown: {
      type: [PricingBreakdownSchema],
      required: true,
    },
    promoCode: {
      type: Schema.Types.ObjectId,
      ref: "PromoCode",
      required: false,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    finalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "partial", "paid", "refunded"],
      default: "pending",
      index: true,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentMethod: {
      type: String,
      required: false,
    },
    paymentReference: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "completed",
        "cancelled",
        "no-show",
        "blocked",
      ],
      default: "pending",
      index: true,
    },
    notes: {
      type: String,
      required: false,
    },
    createdBy: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for efficient availability queries
BookingSchema.index({ court: 1, bookingDate: 1, status: 1 });

// Index for customer bookings lookup
BookingSchema.index({ customer: 1, createdAt: -1 });

// Validate that blocked bookings don't require customer
BookingSchema.pre("save", function (next) {
  if (this.status === "blocked" && !this.customer) {
    // Blocked booking without customer is valid
    next();
  } else if (this.status !== "blocked" && !this.customer) {
    // Non-blocked booking must have customer
    next(new Error("Customer is required for non-blocked bookings"));
  } else {
    next();
  }
});

export default mongoose.model<IBookingDocument>("Booking", BookingSchema);
