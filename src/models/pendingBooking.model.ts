import mongoose, { Document, Schema } from "mongoose";

export interface IPendingBooking extends Document {
  paymentId: string; // Moyasar payment/invoice ID
  courtId: mongoose.Types.ObjectId;
  date: Date;
  slots: string[];
  customerId: mongoose.Types.ObjectId;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  paymentOption: "full" | "partial";
  originalTotal: number; // Price before any discounts
  finalTotal: number; // Price after discounts
  amountNow: number;
  promoCodeId?: mongoose.Types.ObjectId;
  promoCode?: string;
  createdAt: Date;
  expiresAt: Date; // Auto-delete after 24 hours if payment not completed
}

const PendingBookingSchema = new Schema<IPendingBooking>(
  {
    paymentId: { type: String, required: true, unique: true, index: true },
    courtId: {
      type: Schema.Types.ObjectId,
      ref: "Court",
      required: true,
    },
    date: { type: Date, required: true },
    slots: [{ type: String, required: true }],
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String },
    paymentOption: {
      type: String,
      enum: ["full", "partial"],
      required: true,
    },
    originalTotal: { type: Number, required: true },
    finalTotal: { type: Number, required: true },
    amountNow: { type: Number, required: true },
    promoCodeId: {
      type: Schema.Types.ObjectId,
      ref: "PromoCode",
    },
    promoCode: { type: String },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      index: { expires: 0 }, // TTL index - MongoDB will auto-delete when expiresAt is reached
    },
  },
  { timestamps: true },
);

export default mongoose.model<IPendingBooking>(
  "PendingBooking",
  PendingBookingSchema,
);
