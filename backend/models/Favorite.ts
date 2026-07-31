import mongoose, { Document, Model } from "mongoose";

export interface IFavorite extends Document {
  user: mongoose.Types.ObjectId;
  driver: mongoose.Types.ObjectId;
}

const favoriteSchema = new mongoose.Schema<IFavorite>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
  },
  { timestamps: true }
);

favoriteSchema.index({ user: 1, driver: 1 }, { unique: true });

export default mongoose.model<IFavorite>("Favorite", favoriteSchema);