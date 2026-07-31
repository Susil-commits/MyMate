import mongoose, { Document, Model } from "mongoose";

export interface IPromoCode extends Document {
  code: string;
  discountPercentage: number;
  maxDiscount: number;
  expiryDate: Date;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
}

const promoCodeSchema = new mongoose.Schema<IPromoCode>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    discountPercentage: { type: Number, required: true, min: 1, max: 100 },
    maxDiscount: { type: Number, required: true },
    expiryDate: { type: Date, required: true },
    usageLimit: { type: Number, default: null }, // Null means unlimited
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IPromoCode>("PromoCode", promoCodeSchema);
