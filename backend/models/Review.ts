import mongoose, { Document, Model } from "mongoose";

export interface IReview extends Document {
  user: mongoose.Types.ObjectId;
  driver: mongoose.Types.ObjectId;
  booking: mongoose.Types.ObjectId;
  rating: number;
  comment: string;
}

interface IReviewModel extends Model<IReview> {
  updateDriverRating(driverId: mongoose.Types.ObjectId | string): Promise<void>;
}

const reviewSchema = new mongoose.Schema<IReview, IReviewModel>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 1000 },
  },
  { timestamps: true }
);

reviewSchema.index({ driver: 1 });
reviewSchema.index({ user: 1, booking: 1 }, { unique: true });

reviewSchema.statics.updateDriverRating = async function (driverId: mongoose.Types.ObjectId | string) {
  const result = await this.aggregate([
    { $match: { driver: driverId } },
    {
      $group: {
        _id: "$driver",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  if (result.length > 0) {
    await mongoose.model("Driver").findByIdAndUpdate(driverId, {
      averageRating: Math.round(result[0].averageRating * 10) / 10,
      totalReviews: result[0].totalReviews,
    });
  } else {
    await mongoose.model("Driver").findByIdAndUpdate(driverId, {
      averageRating: 0,
      totalReviews: 0,
    });
  }
};

reviewSchema.post("save", async function (this: IReview) {
  try {
    await (this.constructor as IReviewModel).updateDriverRating(this.driver);
  } catch (err: any) {
    console.error("Failed to update driver rating after save:", err.message);
  }
});

reviewSchema.post("findOneAndDelete", async function (doc: IReview | null) {
  if (doc) {
    try {
      await (doc.constructor as IReviewModel).updateDriverRating(doc.driver);
    } catch (err: any) {
      console.error("Failed to update driver rating after delete:", err.message);
    }
  }
});

export default mongoose.model<IReview, IReviewModel>("Review", reviewSchema);