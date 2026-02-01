import mongoose, { Schema, Document } from "mongoose";
import { ICourt } from "../types/court.types";

export interface ICourtDocument extends ICourt, Document {}

const courtSchema = new Schema<ICourtDocument>(
  {
    name: {
      type: String,
      required: [true, "Court name is required"],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "maintenance"],
      default: "active",
    },
    features: {
      type: [String],
      default: [],
    },
    imageUrl: {
      type: String,
      default: "",
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

// Index for faster queries
courtSchema.index({ status: 1 });

const Court = mongoose.model<ICourtDocument>("Court", courtSchema);

export default Court;
