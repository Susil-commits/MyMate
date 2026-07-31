import mongoose, { Document, Model } from "mongoose";

export interface IWalletTransaction extends Document {
  owner: mongoose.Types.ObjectId;
  ownerModel: "User" | "Driver";
  type: "credit" | "debit";
  amount: number;
  description: string;
  booking?: mongoose.Types.ObjectId;
  status: "completed" | "pending" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const walletTransactionSchema = new mongoose.Schema<IWalletTransaction>(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      refPath: "ownerModel",
    },
    ownerModel: {
      type: String,
      required: true,
      enum: ["User", "Driver"],
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
    status: {
      type: String,
      enum: ["completed", "pending", "failed"],
      default: "completed",
    },
  },
  { timestamps: true }
);

export default mongoose.model<IWalletTransaction>("WalletTransaction", walletTransactionSchema);
