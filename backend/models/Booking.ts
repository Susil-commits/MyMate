// @ts-nocheck
import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    hireType: {
      type: String,
      enum: ["temporary", "permanent"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "ongoing", "completed", "cancelled"],
      default: "pending",
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    pickupLocation: { type: String, required: true, trim: true },
    dropLocation: { type: String, trim: true, default: "" },
    purpose: { type: String, required: true, trim: true },
    totalAmount: { type: Number, default: 0 },
    cancellationReason: { type: String, default: "", trim: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "pending",
    },
  },
  { timestamps: true }
);

bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ driver: 1, status: 1 });

export default mongoose.model("Booking", bookingSchema);