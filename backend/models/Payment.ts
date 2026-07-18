// @ts-nocheck
import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "inr" },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

paymentSchema.index(
  { booking: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending", "completed"] } },
  }
);

export default mongoose.model("Payment", paymentSchema);