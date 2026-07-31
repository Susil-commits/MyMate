import mongoose, { Document, Model } from "mongoose";

export interface IPayment extends Document {
  booking: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  driver: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  status: "pending" | "completed" | "failed" | "refunded";
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new mongoose.Schema<IPayment>(
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

export default mongoose.model<IPayment>("Payment", paymentSchema);