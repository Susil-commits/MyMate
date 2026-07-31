import mongoose, { Document, Model } from "mongoose";

export interface IBooking extends Document {
  user: mongoose.Types.ObjectId;
  driver: mongoose.Types.ObjectId;
  hireType: "temporary" | "permanent";
  status: "pending" | "accepted" | "rejected" | "ongoing" | "completed" | "cancelled";
  startDate: Date;
  endDate?: Date;
  pickupLocation: string;
  dropLocation: string;
  stops: string[];
  purpose: string;
  
  // Pricing
  baseAmount: number;
  surgeMultiplier: number;
  totalAmount: number;
  promoCode?: string;
  discountAmount: number;
  
  // Recurring
  isRecurring: boolean;
  recurringPattern: "none" | "daily" | "weekly";
  recurringEndDate?: Date;
  recurringGroupId?: string;

  cancellationReason: string;
  paymentStatus: "pending" | "paid" | "refunded";
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new mongoose.Schema<IBooking>(
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
    stops: [{ type: String, trim: true }],
    purpose: { type: String, required: true, trim: true },
    
    // Pricing
    baseAmount: { type: Number, default: 0 },
    surgeMultiplier: { type: Number, default: 1 },
    totalAmount: { type: Number, default: 0 },
    promoCode: { type: String, default: null },
    discountAmount: { type: Number, default: 0 },
    
    // Recurring
    isRecurring: { type: Boolean, default: false },
    recurringPattern: { type: String, enum: ["none", "daily", "weekly"], default: "none" },
    recurringEndDate: { type: Date, default: null },
    recurringGroupId: { type: String, default: null },

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

export default mongoose.model<IBooking>("Booking", bookingSchema);