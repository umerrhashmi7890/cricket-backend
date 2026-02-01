import mongoose, { Schema, Document } from "mongoose";
import { ICustomer } from "../types/customer.types";

interface ICustomerDocument extends ICustomer, Document {}

const customerSchema = new Schema<ICustomerDocument>(
  {
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          // Saudi phone number validation (mobile or landline)
          // Mobile: 05xxxxxxxx or +9665xxxxxxxx
          // Landline: +9661xxxxxxxx (where 1 can be 1-9 for different regions)
          return /^(05\d{8}|(\+966)(5|1[1-9])\d{7,8})$/.test(v);
        },
        message: "Please enter a valid Saudi phone number",
      },
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v: string) {
          if (!v) return true; // Email is optional
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Please enter a valid email address",
      },
    },
    totalBookings: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret: any) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

const Customer = mongoose.model<ICustomerDocument>("Customer", customerSchema);

export default Customer;
